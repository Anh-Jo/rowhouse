import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { WorkspaceMemberGuard } from './workspace.guard';
import type { AuthPrismaService } from './auth-prisma.service';

type RequestLike = {
  params: Record<string, string>;
  userId?: string;
  workspaceId?: string;
  workspaceRole?: string;
};

function httpContext(request: RequestLike): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => jest.fn(),
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function createGuard(membership: { role: string } | null) {
  const findFirst = jest.fn().mockResolvedValue(membership);
  const authPrisma = {
    client: { member: { findFirst } },
  } as unknown as AuthPrismaService;
  return { guard: new WorkspaceMemberGuard(authPrisma), findFirst };
}

describe('WorkspaceMemberGuard', () => {
  it('exposes the workspace id and role for a member', async () => {
    const { guard, findFirst } = createGuard({ role: 'owner' });
    const request: RequestLike = {
      params: { workspaceId: 'ws-1' },
      userId: 'user-1',
    };

    await expect(guard.canActivate(httpContext(request))).resolves.toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'ws-1', userId: 'user-1' },
      select: { role: true },
    });
    expect(request.workspaceId).toBe('ws-1');
    expect(request.workspaceRole).toBe('owner');
  });

  it('rejects a non-member with 404 (no existence probing)', async () => {
    const { guard } = createGuard(null);
    const request: RequestLike = {
      params: { workspaceId: 'ws-1' },
      userId: 'intruder',
    };

    await expect(guard.canActivate(httpContext(request))).rejects.toThrow(
      NotFoundException,
    );
    expect(request.workspaceId).toBeUndefined();
  });

  it('rejects when the route has no workspaceId param', async () => {
    const { guard, findFirst } = createGuard({ role: 'member' });

    await expect(
      guard.canActivate(httpContext({ params: {}, userId: 'user-1' })),
    ).rejects.toThrow(NotFoundException);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejects when no authenticated user is on the request', async () => {
    const { guard, findFirst } = createGuard({ role: 'member' });

    await expect(
      guard.canActivate(httpContext({ params: { workspaceId: 'ws-1' } })),
    ).rejects.toThrow(NotFoundException);
    expect(findFirst).not.toHaveBeenCalled();
  });
});
