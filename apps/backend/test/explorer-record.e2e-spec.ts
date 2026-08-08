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
type RowsBody = {
  items?: Array<{ key: string | null; values: Record<string, unknown> }>;
};
type RecordBody = {
  row?: { key: string; values: Record<string, unknown> };
  references?: Array<{
    column: string;
    tableName: string;
    tableId: string | null;
    row: { key: string | null; values: Record<string, unknown> } | null;
  }>;
  referencedBy?: Array<{
    tableName: string;
    viaColumn: string;
    count: number;
    rows: Array<{ key: string | null; values: Record<string, unknown> }>;
  }>;
};

function catalogRow(
  table: string,
  column: string,
  dataType: string,
  options?: Partial<{
    is_primary_key: boolean;
    fk_table: string;
    fk_column: string;
  }>,
) {
  return {
    table_schema: 'public',
    table_name: table,
    column_name: column,
    data_type: dataType,
    is_nullable: 'YES',
    is_primary_key: options?.is_primary_key ?? false,
    fk_table: options?.fk_table ?? null,
    fk_column: options?.fk_column ?? null,
  };
}

/** customers ← orders (customer_id): two tables, one relation each way. */
class FakeRelationalConnectionFactory {
  customers = [
    { id: 1, email: 'ada@example.test' },
    { id: 2, email: 'grace@example.test' },
  ];
  orders = [
    { id: 10, customer_id: 1, status: 'paid' },
    { id: 11, customer_id: 1, status: 'shipped' },
    { id: 12, customer_id: 2, status: 'pending' },
  ];

  connect() {
    return Promise.resolve({
      query: (sql: string, params?: unknown[]) => {
        if (sql.includes('information_schema.columns')) {
          return Promise.resolve({
            rows: [
              catalogRow('customers', 'id', 'integer', {
                is_primary_key: true,
              }),
              catalogRow('customers', 'email', 'text'),
              catalogRow('orders', 'id', 'integer', { is_primary_key: true }),
              catalogRow('orders', 'customer_id', 'integer', {
                fk_table: 'customers',
                fk_column: 'id',
              }),
              catalogRow('orders', 'status', 'text'),
            ],
          });
        }
        const value = params?.[0];
        if (sql.includes('FROM "public"."customers"')) {
          const rows = this.customers.filter((row) =>
            sql.includes('WHERE') ? row.id === Number(value) : true,
          );
          return Promise.resolve({ rows });
        }
        if (sql.includes('FROM "public"."orders"')) {
          if (sql.includes('count(*)')) {
            return Promise.resolve({
              rows: [
                {
                  count: this.orders.filter(
                    (row) => row.customer_id === Number(value),
                  ).length,
                },
              ],
            });
          }
          const rows = this.orders.filter((row) =>
            sql.includes('WHERE "customer_id"')
              ? row.customer_id === Number(value)
              : sql.includes('WHERE "id"')
                ? row.id === Number(value)
                : true,
          );
          return Promise.resolve({ rows });
        }
        return Promise.resolve({ rows: [] });
      },
      end: () => Promise.resolve(),
    });
  }
}

function cookieHeader(setCookie: string[] | undefined): string {
  return (setCookie ?? []).map((entry) => entry.split(';')[0]).join('; ');
}

describe('Explorer record detail (e2e)', () => {
  let app: NestFastifyApplication;
  let cleanup: () => Promise<void>;

  let cookieA: string;
  let workspaceA: string;
  let projectA: string;
  let datasourceA: string;
  let customersTableId: string;
  let ordersTableId: string;

  beforeAll(async () => {
    const {
      prismaService,
      authPrismaService,
      cleanup: cleanupFn,
    } = await createPGliteDatabases();
    cleanup = cleanupFn;

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
      .useValue(new FakeRelationalConnectionFactory())
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const http = app.getHttpServer();
    cookieA = cookieHeader(
      (
        await request(http).post('/api/auth/sign-up/email').send({
          email: 'record-a@rowhouse.test',
          password: 'sup3r-secret-pw',
          name: 'Record A',
        })
      ).headers['set-cookie'] as unknown as string[] | undefined,
    );
    workspaceA = (
      (
        await request(http)
          .post('/api/auth/organization/create')
          .set('Cookie', cookieA)
          .send({ name: 'record-acme', slug: 'record-acme' })
      ).body as IdBody
    ).id as string;
    projectA = (
      (
        await request(http)
          .post(`/workspaces/${workspaceA}/projects`)
          .set('Cookie', cookieA)
          .send({ name: 'Prod' })
      ).body as IdBody
    ).id as string;
    datasourceA = (
      (
        await request(http)
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
          })
      ).body as IdBody
    ).id as string;

    await request(http)
      .post(
        `/workspaces/${workspaceA}/projects/${projectA}/datasources/${datasourceA}/schema/sync`,
      )
      .set('Cookie', cookieA)
      .expect(200);
    const schema = await request(http)
      .get(
        `/workspaces/${workspaceA}/projects/${projectA}/datasources/${datasourceA}/schema`,
      )
      .set('Cookie', cookieA);
    const tables = (
      schema.body as { tables: Array<{ id: string; name: string }> }
    ).tables;
    customersTableId = tables.find((t) => t.name === 'customers')?.id as string;
    ordersTableId = tables.find((t) => t.name === 'orders')?.id as string;
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  const base = () =>
    `/workspaces/${workspaceA}/projects/${projectA}/datasources/${datasourceA}`;

  async function firstRowKey(tableId: string): Promise<string> {
    const rows = await request(app.getHttpServer())
      .get(`${base()}/tables/${tableId}/rows?limit=1`)
      .set('Cookie', cookieA)
      .expect(200);
    return (rows.body as RowsBody).items?.[0].key as string;
  }

  it('resolves outgoing FKs: an order shows its customer, keyed for navigation', async () => {
    const orderKey = await firstRowKey(ordersTableId);
    const response = await request(app.getHttpServer())
      .get(`${base()}/tables/${ordersTableId}/rows/${orderKey}`)
      .set('Cookie', cookieA)
      .expect(200);

    const body = response.body as RecordBody;
    expect(body.row?.values.status).toBe('paid');
    const customerRef = body.references?.find(
      (ref) => ref.column === 'customer_id',
    );
    expect(customerRef?.tableName).toBe('customers');
    expect(customerRef?.tableId).toBe(customersTableId);
    expect(customerRef?.row?.values).toEqual({
      id: 1,
      email: 'ada@example.test',
    });
    expect(customerRef?.row?.key).toEqual(expect.any(String));
  });

  it('lists incoming relations: a customer shows their orders with a count', async () => {
    const customerKey = await firstRowKey(customersTableId);
    const response = await request(app.getHttpServer())
      .get(`${base()}/tables/${customersTableId}/rows/${customerKey}`)
      .set('Cookie', cookieA)
      .expect(200);

    const body = response.body as RecordBody;
    const orders = body.referencedBy?.find((rel) => rel.tableName === 'orders');
    expect(orders?.viaColumn).toBe('customer_id');
    expect(orders?.count).toBe(2);
    expect(orders?.rows.map((row) => row.values.id)).toEqual([10, 11]);
    expect(orders?.rows[0].key).toEqual(expect.any(String));
  });

  it('404s an unknown record and 400s a malformed key', async () => {
    const ghostKey = Buffer.from(JSON.stringify([999]), 'utf8').toString(
      'base64url',
    );
    await request(app.getHttpServer())
      .get(`${base()}/tables/${customersTableId}/rows/${ghostKey}`)
      .set('Cookie', cookieA)
      .expect(404);
    await request(app.getHttpServer())
      .get(`${base()}/tables/${customersTableId}/rows/garbage`)
      .set('Cookie', cookieA)
      .expect(400);
  });
});
