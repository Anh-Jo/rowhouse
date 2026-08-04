/**
 * Narrows an unknown error payload (Nest exception filter / nestjs-zod shape:
 * `{ message: string | string[] }`) down to a human-readable message.
 */
function extractApiErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
    if (Array.isArray(message) && message.every((m) => typeof m === 'string')) {
      return message.join(', ');
    }
  }
  return 'Unexpected server error, please try again.';
}

/**
 * Collapses an openapi-fetch `{ data, error }` result into the data, throwing
 * a human-readable `Error` when the call failed. Every api module funnels its
 * responses through this so features only ever deal with typed data or an
 * `Error` with a displayable message.
 */
function unwrapApiResult<T>(result: { data?: T; error?: unknown }): T {
  if (result.data === undefined) {
    throw new Error(extractApiErrorMessage(result.error));
  }
  return result.data;
}

export { unwrapApiResult };
