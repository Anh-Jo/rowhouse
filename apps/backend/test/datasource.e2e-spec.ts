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
  name?: string;
  roles?: Array<{ role: string; username: string }>;
};
type ConnectionTestBody = { ok?: boolean; problems?: string[] };

/**
 * Stands in for live target databases (pglite has no TCP listener). Records
 * every connection attempt — the recorded password proves the whole
 * seal → persist → unseal chain end to end — and answers the write-capability
 * catalog probe according to `writeCapableUsers`.
 */
class FakeTargetConnectionFactory {
  attempts: TargetConnectionParams[] = [];
  writeCapableUsers = new Set<string>();
  refuseUsers = new Set<string>();

  connect(params: TargetConnectionParams) {
    this.attempts.push(params);
    if (this.refuseUsers.has(params.user)) {
      return Promise.reject(new Error('password authentication failed'));
    }
    const canWrite = this.writeCapableUsers.has(params.user);
    return Promise.resolve({
      query: (sql: string) =>
        Promise.resolve(
          sql.includes('has_schema_privilege')
            ? { rows: [{ can_create: canWrite, can_mutate: canWrite }] }
            : { rows: [] },
        ),
      end: () => Promise.resolve(),
    });
  }
}

function cookieHeader(setCookie: string[] | undefined): string {
  return (setCookie ?? []).map((entry) => entry.split(';')[0]).join('; ');
}

const VALID_BODY = {
  method: 'DIRECT',
  name: 'Main DB',
  host: 'db.internal',
  port: 5432,
  database: 'app',
  sslMode: 'DISABLE',
  readOnly: { username: 'rowhouse_ro', password: 'ro-secret-pw' },
  readWrite: { username: 'rowhouse_rw', password: 'rw-secret-pw' },
};

describe('Datasources (e2e)', () => {
  let app: NestFastifyApplication;
  let prismaService: PrismaService;
  let cleanup: () => Promise<void>;
  let connections: FakeTargetConnectionFactory;

  let cookieA: string;
  let cookieB: string;
  let workspaceA: string;
  let workspaceB: string;
  let projectA: string;

  async function signUp(email: string, name: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/sign-up/email')
      .set('Content-Type', 'application/json')
      .send({ email, password: 'sup3r-secret-pw', name });
    expect(response.status).toBe(200);
    return cookieHeader(
      response.headers['set-cookie'] as unknown as string[] | undefined,
    );
  }

  async function createWorkspace(
    cookie: string,
    slug: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/api/auth/organization/create')
      .set('Cookie', cookie)
      .set('Content-Type', 'application/json')
      .send({ name: slug, slug });
    expect(response.status).toBe(200);
    return (response.body as IdBody).id as string;
  }

  async function createProject(
    cookie: string,
    workspaceId: string,
    name: string,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/projects`)
      .set('Cookie', cookie)
      .send({ name });
    expect(response.status).toBe(201);
    return (response.body as IdBody).id as string;
  }

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

    cookieA = await signUp('ds-owner-a@rowhouse.test', 'Owner A');
    cookieB = await signUp('ds-owner-b@rowhouse.test', 'Owner B');
    workspaceA = await createWorkspace(cookieA, 'ds-acme');
    workspaceB = await createWorkspace(cookieB, 'ds-globex');
    projectA = await createProject(cookieA, workspaceA, 'Prod');
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  it('creates a datasource; the response carries role usernames but never a secret', async () => {
    const response = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/projects/${projectA}/datasources`)
      .set('Cookie', cookieA)
      .send(VALID_BODY);

    expect(response.status).toBe(201);
    const body = response.body as DatasourceBody;
    expect(body.roles).toEqual(
      expect.arrayContaining([
        { role: 'READ_ONLY', username: 'rowhouse_ro' },
        { role: 'READ_WRITE', username: 'rowhouse_rw' },
      ]),
    );
    expect(JSON.stringify(response.body)).not.toContain('ro-secret-pw');
    expect(JSON.stringify(response.body)).not.toContain('rw-secret-pw');
  });

  it('stores only ciphertext at rest', async () => {
    const rows = await prismaService.client.datasourceCredential.findMany();
    expect(rows.length).toBeGreaterThanOrEqual(2);
    for (const row of rows) {
      const sealed = Buffer.from(row.secretSealed).toString('utf8');
      expect(sealed).not.toContain('ro-secret-pw');
      expect(sealed).not.toContain('rw-secret-pw');
      expect(row.dekKeyId).toMatch(/^env:/);
    }
  });

  it('unseals just-in-time for the connection test and hands the real password to the probe', async () => {
    const list = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceA}/projects/${projectA}/datasources`)
      .set('Cookie', cookieA);
    const datasourceId = (list.body as { items: IdBody[] }).items[0]
      .id as string;

    connections.attempts = [];
    const response = await request(app.getHttpServer())
      .post(
        `/workspaces/${workspaceA}/projects/${projectA}/datasources/${datasourceId}/test-connection`,
      )
      .set('Cookie', cookieA);

    expect(response.status).toBe(200);
    expect((response.body as ConnectionTestBody).ok).toBe(true);

    // The fake factory received the original plaintexts: the full
    // seal → persist → unseal chain works, and secrets never appear in the
    // HTTP response itself.
    const byUser = Object.fromEntries(
      connections.attempts.map((attempt) => [attempt.user, attempt.password]),
    );
    expect(byUser).toEqual({
      rowhouse_ro: 'ro-secret-pw',
      rowhouse_rw: 'rw-secret-pw',
    });
    expect(JSON.stringify(response.body)).not.toContain('ro-secret-pw');
  });

  it('fails the test with an explicit message when the read-only role can write', async () => {
    connections.writeCapableUsers.add('rowhouse_ro');
    const list = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceA}/projects/${projectA}/datasources`)
      .set('Cookie', cookieA);
    const datasourceId = (list.body as { items: IdBody[] }).items[0]
      .id as string;

    const response = await request(app.getHttpServer())
      .post(
        `/workspaces/${workspaceA}/projects/${projectA}/datasources/${datasourceId}/test-connection`,
      )
      .set('Cookie', cookieA);

    expect(response.status).toBe(200);
    const body = response.body as ConnectionTestBody;
    expect(body.ok).toBe(false);
    expect(body.problems).toEqual([
      expect.stringContaining('READ_ONLY: this role can write'),
    ]);
    connections.writeCapableUsers.clear();
  });

  it('journals connection tests in the workspace audit log, invisible to non-members', async () => {
    const events = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceA}/audit-events`)
      .set('Cookie', cookieA);

    expect(events.status).toBe(200);
    const items = (
      events.body as {
        items: Array<{
          action: string;
          role: string | null;
          status: string;
          errorMessage: string | null;
          actorId: string;
        }>;
      }
    ).items;
    const connectionTests = items.filter(
      (event) => event.action === 'CONNECTION_TEST',
    );
    // Two test-connection calls ran above (one clean, one with a
    // write-capable read-only role) — two roles journaled each time.
    expect(connectionTests.length).toBeGreaterThanOrEqual(4);
    expect(connectionTests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'READ_ONLY', status: 'OK' }),
        expect.objectContaining({
          role: 'READ_ONLY',
          status: 'ERROR',
          errorMessage: expect.stringContaining(
            'this role can write',
          ) as string,
        }),
      ]),
    );

    // The journal is workspace-scoped like everything else: 404, not 403.
    await request(app.getHttpServer())
      .get(`/workspaces/${workspaceA}/audit-events`)
      .set('Cookie', cookieB)
      .expect(404);
  });

  it('lets a wrong password be corrected: PATCH re-seals and the next test uses it', async () => {
    // Register with a wrong read-only password.
    const created = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/projects/${projectA}/datasources`)
      .set('Cookie', cookieA)
      .send({ ...VALID_BODY, name: 'Typo DB' })
      .expect(201);
    const datasourceId = (created.body as IdBody).id as string;

    connections.refuseUsers.add('rowhouse_ro');
    const failed = await request(app.getHttpServer())
      .post(
        `/workspaces/${workspaceA}/projects/${projectA}/datasources/${datasourceId}/test-connection`,
      )
      .set('Cookie', cookieA);
    expect((failed.body as ConnectionTestBody).ok).toBe(false);
    connections.refuseUsers.clear();

    // Fix the password (and only it) through the update endpoint.
    const patched = await request(app.getHttpServer())
      .patch(
        `/workspaces/${workspaceA}/projects/${projectA}/datasources/${datasourceId}`,
      )
      .set('Cookie', cookieA)
      .send({ readOnly: { username: 'rowhouse_ro', password: 'fixed-pw' } });
    expect(patched.status).toBe(200);
    expect(JSON.stringify(patched.body)).not.toContain('fixed-pw');

    connections.attempts = [];
    const retried = await request(app.getHttpServer())
      .post(
        `/workspaces/${workspaceA}/projects/${projectA}/datasources/${datasourceId}/test-connection`,
      )
      .set('Cookie', cookieA);
    expect((retried.body as ConnectionTestBody).ok).toBe(true);

    const byUser = Object.fromEntries(
      connections.attempts.map((attempt) => [attempt.user, attempt.password]),
    );
    // The read-only role now probes with the corrected password; the
    // untouched read-write credential still unseals to its original one.
    expect(byUser.rowhouse_ro).toBe('fixed-pw');
    expect(byUser.rowhouse_rw).toBe('rw-secret-pw');

    // Cross-tenant PATCH 404s like everything else.
    await request(app.getHttpServer())
      .patch(
        `/workspaces/${workspaceA}/projects/${projectA}/datasources/${datasourceId}`,
      )
      .set('Cookie', cookieB)
      .send({ host: 'evil' })
      .expect(404);
  });

  it('serves the least-privilege role snippet, workspace-guarded', async () => {
    const response = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/datasource-role-snippet`)
      .set('Cookie', cookieA)
      .send({ database: 'appdb' });

    expect(response.status).toBe(200);
    const sql = (response.body as { sql: string }).sql;
    expect(sql).toContain('CREATE ROLE rowhouse_ro LOGIN');
    expect(sql).toContain('GRANT CONNECT ON DATABASE appdb');

    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/datasource-role-snippet`)
      .set('Cookie', cookieB)
      .send({ database: 'appdb' })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/datasource-role-snippet`)
      .set('Cookie', cookieA)
      .send({ database: "app'; DROP TABLE x; --" })
      .expect(400);
  });

  it('rejects an incomplete body at the Zod boundary (400)', async () => {
    const missingRole: Partial<typeof VALID_BODY> = { ...VALID_BODY };
    delete missingRole.readWrite;
    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/projects/${projectA}/datasources`)
      .set('Cookie', cookieA)
      .send({ ...missingRole, name: 'Broken' })
      .expect(400);
  });

  it('rejects a duplicate datasource name in the project (409)', async () => {
    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/projects/${projectA}/datasources`)
      .set('Cookie', cookieA)
      .send(VALID_BODY)
      .expect(409);
  });

  it('hides the datasource tree from non-members (404 on list and create)', async () => {
    await request(app.getHttpServer())
      .get(`/workspaces/${workspaceA}/projects/${projectA}/datasources`)
      .set('Cookie', cookieB)
      .expect(404);

    // Member of workspace B probing project A through their own workspace id:
    // the project filter is part of the query, so it 404s identically.
    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceB}/projects/${projectA}/datasources`)
      .set('Cookie', cookieB)
      .send(VALID_BODY)
      .expect(404);
  });
});
