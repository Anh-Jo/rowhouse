/**
 * The write path refuses to commit a statement that did not affect exactly one
 * row. A full-primary-key predicate can match more than one row only through a
 * builder bug, and committing such a write would break the single-record safety
 * guarantee (guardrails live in the execution path, never in a prompt). Thrown
 * *after* the surrounding transaction has already rolled back, so no partial
 * write ever survives.
 */
export class SingleRowWriteError extends Error {
  constructor(readonly affectedRows: number) {
    super(
      `Refusing to commit a write that affected ${affectedRows} rows (expected exactly one)`,
    );
    this.name = 'SingleRowWriteError';
  }
}
