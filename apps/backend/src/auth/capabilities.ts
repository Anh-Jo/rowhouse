/**
 * Workspace capabilities derive from the Better Auth organization role
 * (decision D9 — the org plugin is the membership backbone; we do not build a
 * separate RBAC table). Slice A wires the `write` capability only; slice B adds
 * `revealPii` and `approve` to complete the matrix.
 */

/** Roles allowed to mutate customer data. Plain members are read-only. */
const WRITE_ROLES: ReadonlySet<string> = new Set(['owner', 'admin']);

/** Whether a workspace role may edit records through the single-record write path. */
export function canWrite(role: string | undefined): boolean {
  return role !== undefined && WRITE_ROLES.has(role);
}
