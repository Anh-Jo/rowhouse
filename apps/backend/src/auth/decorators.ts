import {
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { getRequestFromContext } from './get-request';

/** Metadata key flagging a route as reachable without a session. */
export const IS_PUBLIC_KEY = 'isPublic';

/** Marks a controller or route as public (skips AuthGuard). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Injects the authenticated app user id resolved by AuthGuard.
 *
 * Invariant: `userId` is present iff the handler is protected by AuthGuard (no
 * `@Public()`), because the guard sets it from a verified session before the
 * handler runs. It is therefore safe to consume as a non-optional `string` on a
 * protected handler. The return type stays `string | undefined` to stay honest:
 * a handler that is both `@Public()` and reads `@CurrentUser()` gets `undefined`
 * — annotate that parameter as optional there.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | undefined =>
    getRequestFromContext(context).userId,
);
