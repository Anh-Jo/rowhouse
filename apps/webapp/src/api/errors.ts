/**
 * Error thrown for any failed API call: a displayable message plus the HTTP
 * status, so features can branch on it (404 → empty state, 400 → callout…)
 * without parsing message text.
 */
class ApiError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

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
 * an `ApiError` (message + HTTP status) when the call failed. Every api module
 * funnels its responses through this so features only ever deal with typed
 * data or a displayable error.
 */
function unwrapApiResult<T>(result: {
  data?: T;
  error?: unknown;
  response?: Response;
}): T {
  if (result.data === undefined) {
    throw new ApiError(
      extractApiErrorMessage(result.error),
      result.response?.status ?? null,
    );
  }
  return result.data;
}

export { ApiError, unwrapApiResult };
