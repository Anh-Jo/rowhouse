import { AuditService } from './audit.service';
import type { PrismaService } from '@/prisma/prisma.service';

function buildService() {
  const create = jest
    .fn()
    .mockImplementation((args: { data: unknown }) =>
      Promise.resolve({ id: 'evt-1', ...(args.data as object) }),
    );
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    client: { auditEvent: { create, findMany } },
  } as unknown as PrismaService;
  return { service: new AuditService(prisma), create, findMany };
}

describe('AuditService', () => {
  it('journals an execution with a params digest, never the raw params', async () => {
    const { service, create } = buildService();

    await service.record({
      workspaceId: 'ws-1',
      actorId: 'user-1',
      datasourceId: 'ds-1',
      role: 'READ_ONLY',
      action: 'READ',
      statement: 'SELECT * FROM customers WHERE email = $1',
      params: ['pii@example.com'],
      rowCount: 1,
      durationMs: 12,
      status: 'OK',
    });

    const data = (
      create.mock.calls[0] as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(data.paramsDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(data)).not.toContain('pii@example.com');
    expect(data.action).toBe('READ');
  });

  it('omits the digest when there are no params', async () => {
    const { service, create } = buildService();

    await service.record({
      workspaceId: 'ws-1',
      actorId: 'user-1',
      action: 'CONNECTION_TEST',
      durationMs: 5,
      status: 'ERROR',
      errorMessage: 'ECONNREFUSED',
    });

    const data = (
      create.mock.calls[0] as [{ data: Record<string, unknown> }]
    )[0].data;
    expect(data.paramsDigest).toBeUndefined();
    expect(data.errorMessage).toBe('ECONNREFUSED');
  });

  it('exposes no update or delete surface (append-only, decision D3)', () => {
    const { service } = buildService();
    const surface = Object.getOwnPropertyNames(
      Object.getPrototypeOf(service) as object,
    );
    expect(surface.sort()).toEqual(['constructor', 'list', 'record']);
  });

  it('lists workspace-scoped, newest first, cursor-paginated', async () => {
    const { service, findMany } = buildService();

    await service.list('ws-1', { cursor: 'evt-9', limit: 10 });

    expect(findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 11,
      cursor: { id: 'evt-9' },
      skip: 1,
    });
  });
});
