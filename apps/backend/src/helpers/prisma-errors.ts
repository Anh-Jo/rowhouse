/**
 * Narrow an unknown thrown value to a Prisma known-request error carrying a
 * specific code (e.g. `P2002` unique violation, `P2003` foreign-key violation).
 * Avoids importing Prisma's error classes at call sites.
 */
export function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
