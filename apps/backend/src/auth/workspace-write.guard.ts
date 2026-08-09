import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { canWrite } from './capabilities';
import { getRequestFromContext } from './get-request';

/**
 * Gates a route to workspace members whose role may write (owner/admin). Runs
 * after WorkspaceMemberGuard, which has already resolved `request.workspaceRole`
 * from a verified membership. A read-only member is still a member — so this is
 * a 403 (you may not do this), never a 404 (existence is not being hidden).
 */
@Injectable()
export class WorkspaceWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = getRequestFromContext(context);
    if (!canWrite(request.workspaceRole)) {
      throw new ForbiddenException(
        'You do not have permission to edit records in this workspace',
      );
    }
    return true;
  }
}
