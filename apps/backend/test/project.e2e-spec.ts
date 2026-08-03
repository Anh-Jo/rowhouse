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
import { createPGliteDatabases } from './helpers/pglite-prisma.helper';

type OrganizationBody = { id?: string };
type ProjectBody = { id?: string; workspaceId?: string; name?: string };
type ProjectPageBody = { items?: ProjectBody[]; nextCursor?: string | null };

/** Rebuilds a `Cookie` header from a supertest `set-cookie` response header. */
function cookieHeader(setCookie: string[] | undefined): string {
  return (setCookie ?? []).map((entry) => entry.split(';')[0]).join('; ');
}

describe('Projects (e2e)', () => {
  let app: NestFastifyApplication;
  let cleanup: () => Promise<void>;

  /** Signs up a fresh user and returns their session cookie. */
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

  /** Creates a workspace (better-auth organization) and returns its id. */
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
    const body = response.body as OrganizationBody;
    expect(body.id).toBeDefined();
    return body.id as string;
  }

  let cookieA: string;
  let cookieB: string;
  let workspaceA: string;
  let workspaceB: string;

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
      .compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    cookieA = await signUp('owner-a@rowhouse.test', 'Owner A');
    cookieB = await signUp('owner-b@rowhouse.test', 'Owner B');
    workspaceA = await createWorkspace(cookieA, 'acme');
    workspaceB = await createWorkspace(cookieB, 'globex');
  });

  afterAll(async () => {
    await app.close();
    await cleanup();
  });

  it('creates a project and reads it back (list and detail)', async () => {
    const created = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/projects`)
      .set('Cookie', cookieA)
      .send({ name: 'Production' });

    expect(created.status).toBe(201);
    const createdBody = created.body as ProjectBody;
    expect(createdBody.workspaceId).toBe(workspaceA);
    expect(createdBody.name).toBe('Production');

    const list = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceA}/projects`)
      .set('Cookie', cookieA);
    expect(list.status).toBe(200);
    const listBody = list.body as ProjectPageBody;
    expect(listBody.items?.map((p) => p.name)).toContain('Production');

    const detail = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceA}/projects/${createdBody.id}`)
      .set('Cookie', cookieA);
    expect(detail.status).toBe(200);
    expect((detail.body as ProjectBody).id).toBe(createdBody.id);
  });

  it('rejects a duplicate name inside the workspace (409) but allows it in another workspace', async () => {
    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/projects`)
      .set('Cookie', cookieA)
      .send({ name: 'Staging' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/projects`)
      .set('Cookie', cookieA)
      .send({ name: 'Staging' })
      .expect(409);

    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceB}/projects`)
      .set('Cookie', cookieB)
      .send({ name: 'Staging' })
      .expect(201);
  });

  it('rejects an invalid body at the Zod boundary (400)', async () => {
    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/projects`)
      .set('Cookie', cookieA)
      .send({ name: '   ' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/projects`)
      .set('Cookie', cookieA)
      .send({})
      .expect(400);
  });

  it('paginates with a cursor, newest first', async () => {
    for (const name of ['Page 1', 'Page 2', 'Page 3']) {
      await request(app.getHttpServer())
        .post(`/workspaces/${workspaceB}/projects`)
        .set('Cookie', cookieB)
        .send({ name })
        .expect(201);
    }

    const first = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceB}/projects?limit=2`)
      .set('Cookie', cookieB);
    expect(first.status).toBe(200);
    const firstBody = first.body as ProjectPageBody;
    expect(firstBody.items).toHaveLength(2);
    expect(firstBody.nextCursor).not.toBeNull();

    const second = await request(app.getHttpServer())
      .get(
        `/workspaces/${workspaceB}/projects?limit=2&cursor=${firstBody.nextCursor}`,
      )
      .set('Cookie', cookieB);
    expect(second.status).toBe(200);
    const secondBody = second.body as ProjectPageBody;
    const firstIds = (firstBody.items ?? []).map((p) => p.id);
    for (const item of secondBody.items ?? []) {
      expect(firstIds).not.toContain(item.id);
    }
  });

  it('hides other workspaces entirely: list, create and detail all 404 for a non-member', async () => {
    await request(app.getHttpServer())
      .get(`/workspaces/${workspaceA}/projects`)
      .set('Cookie', cookieB)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/projects`)
      .set('Cookie', cookieB)
      .send({ name: 'Intrusion' })
      .expect(404);

    // A real project id from workspace A resolved through workspace B: the
    // workspace filter is part of the query, so it 404s like a missing row.
    const created = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceA}/projects`)
      .set('Cookie', cookieA)
      .send({ name: 'Cross-tenant probe' })
      .expect(201);
    await request(app.getHttpServer())
      .get(
        `/workspaces/${workspaceB}/projects/${(created.body as ProjectBody).id}`,
      )
      .set('Cookie', cookieB)
      .expect(404);
  });

  it('requires a session (401) before workspace membership is even considered', async () => {
    await request(app.getHttpServer())
      .get(`/workspaces/${workspaceA}/projects`)
      .expect(401);
  });
});
