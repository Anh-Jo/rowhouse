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
import { encodeRowKey } from '@/target-db/postgres-sql.builders';
import { createPGliteDatabases } from './helpers/pglite-prisma.helper';

type IdBody = { id?: string };
type FakeRow = Record<string, unknown>;
type RecordBody = {
  row?: { key: string | null; values: Record<string, unknown> };
};
type AuditItem = {
  action: string;
  role: string | null;
  status: string;
  approvedBy: string | null;
};

const INTROSPECT_COLUMNS = [
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
    column_name: 'name',
    data_type: 'text',
    is_nullable: 'YES',
    is_primary_key: false,
    fk_table: null,
    fk_column: null,
  },
];

/** Parse `"col" = $n` assignment/condition fragments into resolved pairs. */
function parseEquals(
  fragment: string,
  params: unknown[],
): { column: string; value: unknown }[] {
  return fragment.split(' AND ').flatMap((part) =>
    part.split(', ').map((piece) => {
      const match = /^"(\w+)" = \$(\d+)$/.exec(piece.trim());
      if (!match) throw new Error(`Fake cannot interpret fragment: ${piece}`);
      return { column: match[1], value: params[Number(match[2]) - 1] };
    }),
  );
}

function project(row: FakeRow, returning: string): FakeRow {
  const columns = returning.split(', ').map((c) => c.replace(/"/g, ''));
  const out: FakeRow = {};
  for (const column of columns) out[column] = row[column];
  return out;
}

/**
 * Stateful fake target database. It serves the introspection catalog and
 * interprets the exact `UPDATE … RETURNING` / single-row `SELECT` the builders
 * emit against an in-memory `customers` table, so the write path (transaction,
 * single-row guard, RETURNING) is exercised against data, not SQL strings. Two
 * rows deliberately share id=99 so a full-PK UPDATE can match more than one row.
 */
class FakeWritableConnectionFactory {
  customers: FakeRow[] = [
    { id: 1, email: 'c1@example.test', name: 'One' },
    { id: 2, email: 'c2@example.test', name: 'Two' },
    { id: 99, email: 'dup-a@example.test', name: 'Dup A' },
    { id: 99, email: 'dup-b@example.test', name: 'Dup B' },
  ];

  connect() {
    return Promise.resolve({
      query: (sql: string, params?: unknown[]) => {
        const values = params ?? [];
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        if (sql.includes('information_schema.columns')) {
          return Promise.resolve({ rows: INTROSPECT_COLUMNS });
        }
        const update =
          /^UPDATE "public"\."customers" SET (.+) WHERE (.+) RETURNING (.+)$/.exec(
            sql,
          );
        if (update) {
          const sets = parseEquals(update[1], values);
          const where = parseEquals(update[2], values);
          const matched = this.customers.filter((row) =>
            where.every((cond) => row[cond.column] === cond.value),
          );
          for (const row of matched) {
            for (const set of sets) row[set.column] = set.value;
          }
          return Promise.resolve({
            rows: matched.map((row) => project(row, update[3])),
          });
        }
        const select =
          /^SELECT (.+) FROM "public"\."customers" WHERE (.+) LIMIT 1$/.exec(
            sql,
          );
        if (select) {
          const where = parseEquals(select[2], values);
          const matched = this.customers.filter((row) =>
            where.every((cond) => row[cond.column] === cond.value),
          );
          return Promise.resolve({
            rows: matched.slice(0, 1).map((row) => project(row, select[1])),
          });
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

describe('Explorer record edit (e2e)', () => {
  let app: NestFastifyApplication;
  let cleanup: () => Promise<void>;

  let cookieOwner: string;
  let cookieMember: string;
  let cookieOutsider: string;
  let workspace: string;
  let project$: string;
  let datasource: string;
  let tableId: string;

  const keyOf = (id: number) => encodeRowKey([id]);

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
      .useValue(new FakeWritableConnectionFactory())
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const http = app.getHttpServer();
    const signUp = async (email: string, name: string) => {
      const res = await request(http)
        .post('/api/auth/sign-up/email')
        .send({ email, password: 'sup3r-secret-pw', name });
      return cookieHeader(
        res.headers['set-cookie'] as unknown as string[] | undefined,
      );
    };
    cookieOwner = await signUp('edit-owner@rowhouse.test', 'Owner');
    cookieMember = await signUp('edit-member@rowhouse.test', 'Member');
    cookieOutsider = await signUp('edit-outsider@rowhouse.test', 'Outsider');

    workspace = (
      (
        await request(http)
          .post('/api/auth/organization/create')
          .set('Cookie', cookieOwner)
          .send({ name: 'edit-acme', slug: 'edit-acme' })
      ).body as IdBody
    ).id as string;
    project$ = (
      (
        await request(http)
          .post(`/workspaces/${workspace}/projects`)
          .set('Cookie', cookieOwner)
          .send({ name: 'Prod' })
      ).body as IdBody
    ).id as string;
    datasource = (
      (
        await request(http)
          .post(`/workspaces/${workspace}/projects/${project$}/datasources`)
          .set('Cookie', cookieOwner)
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
        `/workspaces/${workspace}/projects/${project$}/datasources/${datasource}/schema/sync`,
      )
      .set('Cookie', cookieOwner)
      .expect(200);
    const schema = await request(http)
      .get(
        `/workspaces/${workspace}/projects/${project$}/datasources/${datasource}/schema`,
      )
      .set('Cookie', cookieOwner);
    tableId = (schema.body as { tables: Array<{ id: string }> }).tables[0].id;

    // Make the "member" user a read-only member of the workspace directly (the
    // invitation UI lands in P2) so the write-capability gate can be exercised.
    const memberUser = await authPrismaService.client.user.findFirst({
      where: { email: 'edit-member@rowhouse.test' },
    });
    await authPrismaService.client.member.create({
      data: {
        id: 'member-edit-ro',
        organizationId: workspace,
        userId: memberUser!.id,
        role: 'member',
        createdAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  const rowUrl = (id: number) =>
    `/workspaces/${workspace}/projects/${project$}/datasources/${datasource}/tables/${tableId}/rows/${keyOf(id)}`;

  it('applies a single-record edit and returns the persisted row', async () => {
    const response = await request(app.getHttpServer())
      .patch(rowUrl(1))
      .set('Cookie', cookieOwner)
      .send({ set: { name: 'Renamed One' } });
    expect(response.status).toBe(200);
    expect((response.body as RecordBody).row?.values).toMatchObject({
      id: 1,
      name: 'Renamed One',
    });
  });

  it('persists the change: a follow-up read returns the new value', async () => {
    const response = await request(app.getHttpServer())
      .get(rowUrl(1))
      .set('Cookie', cookieOwner)
      .expect(200);
    expect((response.body as RecordBody).row?.values.name).toBe('Renamed One');
  });

  it('journals the edit as one WRITE on the READ_WRITE role, unapproved', async () => {
    const events = await request(app.getHttpServer())
      .get(`/workspaces/${workspace}/audit-events`)
      .set('Cookie', cookieOwner)
      .expect(200);
    const writes = (events.body as { items: AuditItem[] }).items.filter(
      (event) => event.action === 'WRITE',
    );
    expect(writes.length).toBeGreaterThanOrEqual(1);
    expect(writes[0].role).toBe('READ_WRITE');
    expect(writes[0].status).toBe('OK');
    expect(writes[0].approvedBy).toBeNull();
  });

  it('rejects an unknown column (400)', async () => {
    await request(app.getHttpServer())
      .patch(rowUrl(1))
      .set('Cookie', cookieOwner)
      .send({ set: { nope: 'x' } })
      .expect(400);
  });

  it('refuses to edit a primary-key column (400)', async () => {
    await request(app.getHttpServer())
      .patch(rowUrl(1))
      .set('Cookie', cookieOwner)
      .send({ set: { id: 5 } })
      .expect(400);
  });

  it('rejects an empty set (400)', async () => {
    await request(app.getHttpServer())
      .patch(rowUrl(1))
      .set('Cookie', cookieOwner)
      .send({ set: {} })
      .expect(400);
  });

  it('returns 404 for a well-formed key matching no record', async () => {
    await request(app.getHttpServer())
      .patch(rowUrl(12345))
      .set('Cookie', cookieOwner)
      .send({ set: { name: 'Ghost' } })
      .expect(404);
  });

  it('forbids a read-only member from editing (403)', async () => {
    await request(app.getHttpServer())
      .patch(rowUrl(2))
      .set('Cookie', cookieMember)
      .send({ set: { name: 'Nope' } })
      .expect(403);
  });

  it('hides the edit route from non-members (404)', async () => {
    await request(app.getHttpServer())
      .patch(rowUrl(2))
      .set('Cookie', cookieOutsider)
      .send({ set: { name: 'Nope' } })
      .expect(404);
  });

  it('refuses a write that matches more than one row and audits an ERROR', async () => {
    const response = await request(app.getHttpServer())
      .patch(rowUrl(99))
      .set('Cookie', cookieOwner)
      .send({ set: { name: 'Collision' } });
    expect(response.status).toBe(409);

    const events = await request(app.getHttpServer())
      .get(`/workspaces/${workspace}/audit-events`)
      .set('Cookie', cookieOwner)
      .expect(200);
    const failedWrites = (events.body as { items: AuditItem[] }).items.filter(
      (event) => event.action === 'WRITE' && event.status === 'ERROR',
    );
    expect(failedWrites.length).toBeGreaterThanOrEqual(1);
  });
});
