import type { ExecutionContext } from '@nestjs/common';
import type { RequestWithUser } from './auth.d.ts';

/**
 * Resolves the underlying Fastify request from the execution context. Shared
 * by AuthGuard and the @CurrentUser decorator so the extraction logic lives in
 * one place — extend it here (not in the callers) if another transport joins
 * later (e.g. GraphQL, where the request hides inside the resolver context).
 */
export function getRequestFromContext(
  context: ExecutionContext,
): RequestWithUser {
  return context.switchToHttp().getRequest<RequestWithUser>();
}
