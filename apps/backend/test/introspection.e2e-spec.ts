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
import { TargetConnectionFactory } from '@/target-db/target-connection.factory';
import { createPGliteDatabases } from './helpers/pglite-prisma.helper';

type IdBody = { id?: string };
type ColumnBody = {
  id: string;
  name: string;
  dataType: string;
  enumValues: string[];
  isPii: boolean;
  description: string | null;
  refTable: string | null;
};
type TableBody = {
  id: string;
  name: string;
  description: string | null;
  columns: ColumnBody[];
};
type SchemaBody = { tables: TableBody[]; syncedAt: string | null };

/** One row of the postgres introspection catalog query. */
function catalogRow(
  table: string,
  column: string,
  dataType: string,
  options?: Partial<{
    is_primary_key: boolean;
    fk_table: string;
    fk_column: string;
    is_nullable: 'YES' | 'NO';
    enum_values: string[];
  }>,
) {
  return {
    table_schema: 'public',
    table_name: table,
    column_name: column,
    data_type: dataType,
    is_nullable: options?.is_nullable ?? 'YES',
    is_primary_key: options?.is_primary_key ?? false,
    fk_table: options?.fk_table ?? null,
    fk_column: options?.fk_column ?? null,
    enum_values: options?.enum_values ?? null,
  };
}

/** Serves a mutable catalog to the engine's introspection query. */
class FakeCatalogConnectionFactory {
  rows: ReturnType<typeof catalogRow>[] = [];

  connect() {
    return Promise.resolve({
      query: (sql: string) =>
        Promise.resolve(
          sql.includes('information_schema.columns')
            ? { rows: this.rows }
            : { rows: [] },
        ),
      end: () => Promise.resolve(),
    });
  }
}

function cookieHeader(setCookie: string[] | undefined): string {
  return (setCookie ?? []).map((entry) => entry.split(';')[0]).join('; ');
}

describe('Introspection (e2e)', () => {
  let app: NestFastifyApplication;
  let cleanup: () => Promise<void>;
  let catalog: FakeCatalogConnectionFactory;

  let cookieA: string;
  let cookieB: string;
  let workspaceA: string;
  let projectA: string;
  let datasourceA: string;

  beforeAll(async () => {
    const {
      prismaService,
      authPrismaService,
      cleanup: cleanupFn,
    } = await createPGliteDatabases();
    cleanup = cleanupFn;
    catalog = new FakeCatalogConnectionFactory();

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
      .useValue(catalog)
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const http = app.getHttpServer();
    const signUpA = await request(http).post('/api/auth/sign-up/email').send({
      email: 'intro-a@rowhouse.test',
      password: 'sup3r-secret-pw',
      name: 'Intro A',
    });
    cookieA = cookieHeader(
      signUpA.headers['set-cookie'] as unknown as string[] | undefined,
    );
    const signUpB = await request(http).post('/api/auth/sign-up/email').send({
      email: 'intro-b@rowhouse.test',
      password: 'sup3r-secret-pw',
      name: 'Intro B',
    });
    cookieB = cookieHeader(
      signUpB.headers['set-cookie'] as unknown as string[] | undefined,
    );

    const workspace = await request(http)
      .post('/api/auth/organization/create')
      .set('Cookie', cookieA)
      .send({ name: 'intro-acme', slug: 'intro-acme' });
    workspaceA = (workspace.body as IdBody).id as string;

    const project = await request(http)
      .post(`/workspaces/${workspaceA}/projects`)
      .set('Cookie', cookieA)
      .send({ name: 'Prod' });
    projectA = (project.body as IdBody).id as string;

    const datasource = await request(http)
      .post(`/workspaces/${workspaceA}/projects/${projectA}/datasources`)
      .set('Cookie', cookieA)
      .send({
        method: 'DIRECT',
        name: 'Main DB',
        host: 'db.internal',
        port: 5432,
        database: 'app',
        sslMode: 'DISABLE',
        readOnly: { username: 'ro', password: 'ro-pw' },
        readWrite: { username: 'rw', password: 'rw-pw' },
      });
    datasourceA = (datasource.body as IdBody).id as string;
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  const schemaUrl = () =>
    `/workspaces/${workspaceA}/projects/${projectA}/datasources/${datasourceA}/schema`;

  it('syncs the catalog into a browsable snapshot', async () => {
    catalog.rows = [
      catalogRow('customers', 'id', 'integer', {
        is_primary_key: true,
        is_nullable: 'NO',
      }),
      catalogRow('customers', 'email', 'text', { is_nullable: 'NO' }),
      catalogRow('orders', 'id', 'integer', {
        is_primary_key: true,
        is_nullable: 'NO',
      }),
      catalogRow('orders', 'customer_id', 'integer', {
        fk_table: 'customers',
        fk_column: 'id',
      }),
      catalogRow('orders', 'status', 'USER-DEFINED', {
        is_nullable: 'NO',
        enum_values: ['pending', 'paid', 'shipped', 'cancelled'],
      }),
    ];

    const sync = await request(app.getHttpServer())
      .post(`${schemaUrl()}/sync`)
      .set('Cookie', cookieA);
    expect(sync.status).toBe(200);
    expect(sync.body).toEqual({
      tablesCreated: 2,
      tablesRemoved: 0,
      tablesKept: 0,
    });

    const schema = await request(app.getHttpServer())
      .get(schemaUrl())
      .set('Cookie', cookieA);
    expect(schema.status).toBe(200);
    const body = schema.body as SchemaBody;
    expect(body.tables.map((t) => t.name)).toEqual(['customers', 'orders']);
    const orders = body.tables.find((t) => t.name === 'orders');
    expect(
      orders?.columns.find((c) => c.name === 'customer_id')?.refTable,
    ).toBe('customers');
    // The native enum's labels are persisted and exposed for the dropdown…
    expect(
      orders?.columns.find((c) => c.name === 'status')?.enumValues,
    ).toEqual(['pending', 'paid', 'shipped', 'cancelled']);
    // …and a non-enum column carries an empty list.
    expect(
      orders?.columns.find((c) => c.name === 'customer_id')?.enumValues,
    ).toEqual([]);
    expect(body.syncedAt).not.toBeNull();
  });

  it('re-sync refreshes structure but preserves team metadata (the core contract)', async () => {
    // Author metadata on customers.email.
    const schema = await request(app.getHttpServer())
      .get(schemaUrl())
      .set('Cookie', cookieA);
    const customers = (schema.body as SchemaBody).tables.find(
      (t) => t.name === 'customers',
    ) as TableBody;
    const email = customers.columns.find(
      (c) => c.name === 'email',
    ) as ColumnBody;

    await request(app.getHttpServer())
      .patch(`${schemaUrl()}/columns/${email.id}`)
      .set('Cookie', cookieA)
      .send({ isPii: true, description: 'Customer contact email' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`${schemaUrl()}/tables/${customers.id}`)
      .set('Cookie', cookieA)
      .send({ description: 'One row per customer' })
      .expect(200);

    // The database evolves: email type widens, a column appears, orders die.
    catalog.rows = [
      catalogRow('customers', 'id', 'integer', {
        is_primary_key: true,
        is_nullable: 'NO',
      }),
      catalogRow('customers', 'email', 'character varying', {
        is_nullable: 'NO',
      }),
      catalogRow('customers', 'country', 'text'),
    ];

    const resync = await request(app.getHttpServer())
      .post(`${schemaUrl()}/sync`)
      .set('Cookie', cookieA);
    expect(resync.body).toEqual({
      tablesCreated: 0,
      tablesRemoved: 1,
      tablesKept: 1,
    });

    const after = await request(app.getHttpServer())
      .get(schemaUrl())
      .set('Cookie', cookieA);
    const body = after.body as SchemaBody;
    expect(body.tables.map((t) => t.name)).toEqual(['customers']);
    const customersAfter = body.tables[0];
    // Team metadata survived the sync…
    expect(customersAfter.description).toBe('One row per customer');
    const emailAfter = customersAfter.columns.find((c) => c.name === 'email');
    expect(emailAfter?.isPii).toBe(true);
    expect(emailAfter?.description).toBe('Customer contact email');
    // …while the structure was refreshed.
    expect(emailAfter?.dataType).toBe('character varying');
    expect(customersAfter.columns.map((c) => c.name)).toContain('country');
  });

  it('is idempotent: an unchanged database re-syncs to zero changes', async () => {
    const resync = await request(app.getHttpServer())
      .post(`${schemaUrl()}/sync`)
      .set('Cookie', cookieA);
    expect(resync.body).toEqual({
      tablesCreated: 0,
      tablesRemoved: 0,
      tablesKept: 1,
    });
  });

  it('journals every sync as an INTROSPECT audit event', async () => {
    const events = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceA}/audit-events`)
      .set('Cookie', cookieA);
    const introspections = (
      events.body as { items: Array<{ action: string; status: string }> }
    ).items.filter((event) => event.action === 'INTROSPECT');
    expect(introspections.length).toBeGreaterThanOrEqual(3);
    expect(introspections.every((event) => event.status === 'OK')).toBe(true);
  });

  it('hides the schema tree from non-members (404 everywhere)', async () => {
    await request(app.getHttpServer())
      .get(schemaUrl())
      .set('Cookie', cookieB)
      .expect(404);
    await request(app.getHttpServer())
      .post(`${schemaUrl()}/sync`)
      .set('Cookie', cookieB)
      .expect(404);
  });
});
