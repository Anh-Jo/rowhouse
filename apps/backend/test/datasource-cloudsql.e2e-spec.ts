import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { AuthPrismaService } from '@/auth/auth-prisma.service';
import { MailProvider } from '@/mail/mail.provider';
import { InMemoryMailProvider } from '@/mail/in-memory-mail.provider';
import {
  TargetConnectionFactory,
  type TargetConnectionParams,
} from '@/target-db/target-connection.factory';
import { createPGliteDatabases } from './helpers/pglite-prisma.helper';

type IdBody = { id?: string };
type DatasourceBody = {
  id?: string;
  method?: string;
  host?: string;
  cloudSql?: {
    instanceConnectionName?: string;
    database?: string;
    authType?: string;
  };
  roles?: Array<{ role: string; username: string }>;
};
type ConnectionTestBody = { ok?: boolean; problems?: string[] };

/**
 * Stands in for real Cloud SQL instances (no network in the e2e runner).
 * Records every connect attempt so the tests can assert what the strategy
 * would have received — notably that the SA key arrives as the unsealed
 * plaintext (the whole seal → persist → unseal chain) and that IAM auth
 * carries no password at all.
 */
class FakeTargetConnectionFactory {
  attempts: TargetConnectionParams[] = [];

  connect(params: TargetConnectionParams) {
    this.attempts.push(params);
    return Promise.resolve({
      query: (sql: string) =>
        Promise.resolve(
          sql.includes('has_schema_privilege')
            ? { rows: [{ can_create: false, can_mutate: false }] }
            : { rows: [] },
        ),
      end: () => Promise.resolve(),
    });
  }
}

function cookieHeader(setCookie: string[] | undefined): string {
  return (setCookie ?? []).map((entry) => entry.split(';')[0]).join('; ');
}

const SA_KEY_JSON = JSON.stringify({
  type: 'service_account',
  client_email: 'rowhouse-ro@my-project.iam.gserviceaccount.com',
  private_key: 'super-secret-private-key-material',
});

const IAM_BODY = {
  method: 'CLOUDSQL',
  name: 'Cloud SQL prod',
  instanceConnectionName: 'my-project:europe-west1:prod',
  database: 'app',
  authType: 'IAM',
  saKeyJson: SA_KEY_JSON,
  readOnly: { username: 'rowhouse-ro@my-project.iam' },
  readWrite: { username: 'rowhouse-rw@my-project.iam' },
};

describe('Cloud SQL datasources (e2e)', () => {
  let app: NestFastifyApplication;
  let prismaService: PrismaService;
  let cleanup: () => Promise<void>;
  let connections: FakeTargetConnectionFactory;

  let cookie: string;
  let workspace: string;
  let project: string;
  let datasourceId: string;

  beforeAll(async () => {
    const {
      prismaService: prisma,
      authPrismaService,
      cleanup: cleanupFn,
    } = await createPGliteDatabases();
    prismaService = prisma;
    cleanup = cleanupFn;
    connections = new FakeTargetConnectionFactory();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaService)
      .overrideProvider(AuthPrismaService)
      .useValue(authPrismaService)
      .overrideProvider(MailProvider)
      .useClass(InMemoryMailProvider)
      .overrideProvider(TargetConnectionFactory)
      .useValue(connections)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const signUp = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Content-Type', 'application/json')
      .send({
        email: 'cloudsql-owner@rowhouse.test',
        password: 'sup3r-secret-pw',
        name: 'Cloud Owner',
      });
    expect(signUp.status).toBe(200);
    cookie = cookieHeader(
      signUp.headers['set-cookie'] as unknown as string[] | undefined,
    );

    const org = await request(app.getHttpServer())
      .post('/api/auth/organization/create')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send({ name: 'cs-acme', slug: 'cs-acme' });
    expect(org.status).toBe(200);
    workspace = (org.body as IdBody).id as string;

    const proj = await request(app.getHttpServer())
      .post(`/workspaces/${workspace}/projects`)
      .set('Cookie', cookie)
      .send({ name: 'Prod' });
    expect(proj.status).toBe(201);
    project = (proj.body as IdBody).id as string;
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  it('creates an IAM datasource; the response exposes method info but never the SA key', async () => {
    const response = await request(app.getHttpServer())
      .post(`/workspaces/${workspace}/projects/${project}/datasources`)
      .set('Cookie', cookie)
      .send(IAM_BODY);

    expect(response.status).toBe(201);
    const body = response.body as DatasourceBody;
    datasourceId = body.id as string;
    expect(body.method).toBe('CLOUDSQL');
    expect(body.cloudSql).toEqual({
      instanceConnectionName: 'my-project:europe-west1:prod',
      database: 'app',
      authType: 'IAM',
    });
    // No DIRECT fields on a CLOUDSQL datasource.
    expect(body.host).toBeUndefined();
    // The write-only secret is absent from the response, in any form.
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('saKeyJson');
    expect(serialized).not.toContain('super-secret-private-key-material');
  });

  it('stores only SA-key ciphertext at rest, under the sealed triplet', async () => {
    const row = await prismaService.client.cloudSqlConnection.findFirstOrThrow({
      where: { datasourceId },
    });
    expect(row.authType).toBe('IAM');
    const sealed = Buffer.from(row.saKeySealed).toString('utf8');
    expect(sealed).not.toContain('super-secret-private-key-material');
    expect(sealed).not.toContain('client_email');
    expect(row.saKeyDekKeyId).toMatch(/^env:/);
    // The role credentials exist (ro/rw duality unchanged, decision D12) —
    // sealed empty secrets, since IAM holds no password.
    const credentials =
      await prismaService.client.datasourceCredential.findMany({
        where: { datasourceId },
      });
    expect(credentials.map((c) => c.role).sort()).toEqual([
      'READ_ONLY',
      'READ_WRITE',
    ]);
  });

  it('test-connection resolves through the CLOUDSQL strategy with the unsealed key and no password', async () => {
    connections.attempts = [];
    const response = await request(app.getHttpServer())
      .post(
        `/workspaces/${workspace}/projects/${project}/datasources/${datasourceId}/test-connection`,
      )
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect((response.body as ConnectionTestBody).ok).toBe(true);

    expect(connections.attempts).toHaveLength(2);
    for (const attempt of connections.attempts) {
      expect(attempt.method).toBe('CLOUDSQL');
      if (attempt.method === 'CLOUDSQL') {
        // The unsealed plaintext reached the strategy (seal → persist →
        // unseal works) — and, IAM: no password, not even an empty one.
        expect(attempt.saKeyJson).toBe(SA_KEY_JSON);
        expect(attempt.instanceConnectionName).toBe(
          'my-project:europe-west1:prod',
        );
        expect('password' in attempt).toBe(false);
      }
    }
    expect(connections.attempts.map((attempt) => attempt.user).sort()).toEqual([
      'rowhouse-ro@my-project.iam',
      'rowhouse-rw@my-project.iam',
    ]);
    expect(JSON.stringify(response.body)).not.toContain('private-key');
  });

  it('never leaks the key through list or get either', async () => {
    const list = await request(app.getHttpServer())
      .get(`/workspaces/${workspace}/projects/${project}/datasources`)
      .set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).not.toContain(
      'super-secret-private-key-material',
    );

    const get = await request(app.getHttpServer())
      .get(
        `/workspaces/${workspace}/projects/${project}/datasources/${datasourceId}`,
      )
      .set('Cookie', cookie);
    expect(get.status).toBe(200);
    expect(JSON.stringify(get.body)).not.toContain(
      'super-secret-private-key-material',
    );
    expect((get.body as DatasourceBody).cloudSql?.authType).toBe('IAM');
  });

  it('rejects malformed CLOUDSQL payloads at the Zod boundary (400)', async () => {
    // Not an instance connection name.
    await request(app.getHttpServer())
      .post(`/workspaces/${workspace}/projects/${project}/datasources`)
      .set('Cookie', cookie)
      .send({
        ...IAM_BODY,
        name: 'Bad instance',
        instanceConnectionName: 'not-a-connection-name',
      })
      .expect(400);

    // IAM users hold no password.
    await request(app.getHttpServer())
      .post(`/workspaces/${workspace}/projects/${project}/datasources`)
      .set('Cookie', cookie)
      .send({
        ...IAM_BODY,
        name: 'IAM with password',
        readOnly: { username: 'x', password: 'nope' },
      })
      .expect(400);

    // BUILT_IN users require one.
    await request(app.getHttpServer())
      .post(`/workspaces/${workspace}/projects/${project}/datasources`)
      .set('Cookie', cookie)
      .send({ ...IAM_BODY, name: 'Built-in missing pw', authType: 'BUILT_IN' })
      .expect(400);

    // The key must at least be JSON.
    await request(app.getHttpServer())
      .post(`/workspaces/${workspace}/projects/${project}/datasources`)
      .set('Cookie', cookie)
      .send({ ...IAM_BODY, name: 'Bad key', saKeyJson: 'not json' })
      .expect(400);
  });

  it('PATCH cannot change the connection method (P1.5) nor apply DIRECT fields', async () => {
    const methodChange = await request(app.getHttpServer())
      .patch(
        `/workspaces/${workspace}/projects/${project}/datasources/${datasourceId}`,
      )
      .set('Cookie', cookie)
      .send({ method: 'DIRECT' });
    expect(methodChange.status).toBe(400);
    expect(JSON.stringify(methodChange.body)).toContain(
      'create a new datasource',
    );

    await request(app.getHttpServer())
      .patch(
        `/workspaces/${workspace}/projects/${project}/datasources/${datasourceId}`,
      )
      .set('Cookie', cookie)
      .send({ host: 'db.internal' })
      .expect(400);
  });

  it('PATCH re-seals a replacement SA key without ever echoing it', async () => {
    const newKey = JSON.stringify({
      type: 'service_account',
      client_email: 'rowhouse-ro@my-project.iam.gserviceaccount.com',
      private_key: 'rotated-private-key-material',
    });
    const patched = await request(app.getHttpServer())
      .patch(
        `/workspaces/${workspace}/projects/${project}/datasources/${datasourceId}`,
      )
      .set('Cookie', cookie)
      .send({ cloudSql: { saKeyJson: newKey } });
    expect(patched.status).toBe(200);
    expect(JSON.stringify(patched.body)).not.toContain('rotated-private-key');

    connections.attempts = [];
    await request(app.getHttpServer())
      .post(
        `/workspaces/${workspace}/projects/${project}/datasources/${datasourceId}/test-connection`,
      )
      .set('Cookie', cookie)
      .expect(200);
    const attempt = connections.attempts[0];
    expect(attempt.method === 'CLOUDSQL' && attempt.saKeyJson).toBe(newKey);
  });

  it('serves the Cloud SQL least-privilege snippet, workspace-guarded', async () => {
    const response = await request(app.getHttpServer())
      .post(`/workspaces/${workspace}/datasource-role-snippet/cloud-sql`)
      .set('Cookie', cookie)
      .send({
        instanceConnectionName: 'my-project:europe-west1:prod',
        database: 'appdb',
      });

    expect(response.status).toBe(200);
    const script = (response.body as { script: string }).script;
    expect(script).toContain('gcloud iam service-accounts create rowhouse-ro');
    expect(script).toContain('--type=cloud_iam_service_account');
    expect(script).toContain('GRANT CONNECT ON DATABASE appdb');

    await request(app.getHttpServer())
      .post(`/workspaces/${workspace}/datasource-role-snippet/cloud-sql`)
      .set('Cookie', cookie)
      .send({
        instanceConnectionName: 'my-project;rm -rf:x:y',
        database: 'appdb',
      })
      .expect(400);
  });
});
