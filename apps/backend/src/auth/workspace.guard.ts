import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthPrismaService } from './auth-prisma.service';
import { getRequestFromContext } from './get-request';

/**
 * Scopes a route to a workspace the caller belongs to. Reads `:workspaceId`
 * from the route params (the better-auth organization id), verifies the
 * authenticated user is a member, and exposes `request.workspaceId` /
 * `request.workspaceRole` (read by `@CurrentWorkspace()`).
 *
 * Runs after the global AuthGuard, so `request.userId` is already set. A
 * non-member gets a 404 — never a 403 — so the workspace id space cannot be
 * probed for existence (trust layer: same response for "not yours" and
 * "not there").
 */
@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private readonly authPrisma: AuthPrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = getRequestFromContext(context);
    const params = request.params as { workspaceId?: string };
    const workspaceId = params.workspaceId;
    const userId = request.userId;

    if (!workspaceId || !userId) {
      throw new NotFoundException('Workspace not found');
    }

    const membership = await this.authPrisma.client.member.findFirst({
      where: { organizationId: workspaceId, userId },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found');
    }

    request.workspaceId = workspaceId;
    request.workspaceRole = membership.role;
    return true;
  }
}
