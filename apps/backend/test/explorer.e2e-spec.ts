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
  nextCursor?: string | null;
};

/**
 * Serves both the introspection catalog and table data. SELECTs on
 * "public"."customers" honor the keyset WHERE + LIMIT the builders emit, so
 * pagination is exercised for real.
 */
class FakeDataConnectionFactory {
  customers = Array.from({ length: 5 }, (_v, index) => ({
    id: index + 1,
    email: `c${index + 1}@example.test`,
    created_at: new Date(`2026-01-0${index + 1}T00:00:00Z`),
  }));

  connect() {
    return Promise.resolve({
      query: (sql: string, params?: unknown[]) => {
        if (sql.includes('information_schema.columns')) {
          return Promise.resolve({
            rows: [
              {
                table_schema: 'public',
                table_name: 'customers',
                column_name: 'id',
                data_type: 'integer',
                is_nullable: 'NO',
                is_primary_key: true,
                fk_table: null,
                fk_column: null,
              },
              {
                table_schema: 'public',
                table_name: 'customers',
                column_name: 'email',
                data_type: 'text',
                is_nullable: 'NO',
                is_primary_key: false,
                fk_table: null,
                fk_column: null,
              },
              {
                table_schema: 'public',
                table_name: 'customers',
                column_name: 'created_at',
                data_type: 'timestamp without time zone',
                is_nullable: 'YES',
                is_primary_key: false,
                fk_table: null,
                fk_column: null,
              },
            ],
          });
        }
        if (sql.includes('FROM "public"."customers"')) {
          let rows = [...this.customers].sort((a, b) => a.id - b.id);
          if (sql.includes('WHERE ("id") > ($1)')) {
            const after = Number((params as unknown[])[0]);
            rows = rows.filter((row) => row.id > after);
          }
          const limitMatch = /LIMIT (\d+)/.exec(sql);
          if (limitMatch) {
            rows = rows.slice(0, Number(limitMatch[1]));
          }
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

describe('Explorer rows (e2e)', () => {
  let app: NestFastifyApplication;
  let cleanup: () => Promise<void>;

  let cookieA: string;
  let cookieB: string;
  let workspaceA: string;
  let projectA: string;
  let datasourceA: string;
  let tableId: string;

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
      .useValue(new FakeDataConnectionFactory())
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const http = app.getHttpServer();
    const signUpA = await request(http).post('/api/auth/sign-up/email').send({
      email: 'explorer-a@rowhouse.test',
      password: 'sup3r-secret-pw',
      name: 'Explorer A',
    });
    cookieA = cookieHeader(
      signUpA.headers['set-cookie'] as unknown as string[] | undefined,
    );
    const signUpB = await request(http).post('/api/auth/sign-up/email').send({
      email: 'explorer-b@rowhouse.test',
      password: 'sup3r-secret-pw',
      name: 'Explorer B',
    });
    cookieB = cookieHeader(
      signUpB.headers['set-cookie'] as unknown as string[] | undefined,
    );

    workspaceA = (
      (
        await request(http)
          .post('/api/auth/organization/create')
          .set('Cookie', cookieA)
          .send({ name: 'explorer-acme', slug: 'explorer-acme' })
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
    tableId = (schema.body as { tables: Array<{ id: string }> }).tables[0].id;
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  const rowsUrl = () =>
    `/workspaces/${workspaceA}/projects/${projectA}/datasources/${datasourceA}/tables/${tableId}/rows`;

  it('serves rows in PK order with per-row keys and JSON-safe values', async () => {
    const response = await request(app.getHttpServer())
      .get(`${rowsUrl()}?limit=2`)
      .set('Cookie', cookieA);

    expect(response.status).toBe(200);
    const body = response.body as RowsBody;
    expect(body.items).toHaveLength(2);
    expect(body.items?.[0].values).toEqual({
      id: 1,
      email: 'c1@example.test',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    expect(body.items?.[0].key).toEqual(expect.any(String));
    expect(body.nextCursor).not.toBeNull();
  });

  it('paginates to the end through the keyset cursor', async () => {
    const seen: number[] = [];
    let cursor: string | null | undefined;
    for (let page = 0; page < 4; page += 1) {
      const url: string =
        `${rowsUrl()}?limit=2` + (cursor ? `&cursor=${cursor}` : '');
      const response = await request(app.getHttpServer())
        .get(url)
        .set('Cookie', cookieA)
        .expect(200);
      const body = response.body as RowsBody;
      seen.push(...(body.items ?? []).map((item) => item.values.id as number));
      cursor = body.nextCursor;
      if (!cursor) break;
    }
    expect(seen).toEqual([1, 2, 3, 4, 5]);
  });

  it('journals each served page as a READ audit event', async () => {
    const events = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceA}/audit-events`)
      .set('Cookie', cookieA);
    const reads = (
      events.body as { items: Array<{ action: string; statement: string }> }
    ).items.filter((event) => event.action === 'READ');
    expect(reads.length).toBeGreaterThanOrEqual(4);
    expect(reads[0].statement).toContain('FROM "public"."customers"');
  });

  it('rejects a malformed cursor with a 4xx, not a 500', async () => {
    const response = await request(app.getHttpServer())
      .get(`${rowsUrl()}?cursor=garbage`)
      .set('Cookie', cookieA);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  it('hides rows from non-members (404) like the rest of the tree', async () => {
    await request(app.getHttpServer())
      .get(rowsUrl())
      .set('Cookie', cookieB)
      .expect(404);
  });
});
