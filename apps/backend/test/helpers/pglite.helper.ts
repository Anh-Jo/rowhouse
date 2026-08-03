import { PGlite } from '@electric-sql/pglite';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Resolves the backend package root independently of the current working
 * directory: the e2e runner sets cwd to the backend package, but running Jest
 * from the monorepo root must still find the migrations. `__dirname` is
 * unavailable under the ESM e2e runner and `import.meta` is rejected by the
 * CommonJS typecheck, so we probe the two known launch layouts (anchored on
 * `prisma/schema.prisma`, which always exists) and fail loudly instead of
 * silently booting an empty database.
 */
export function resolveBackendDir(relative: string): string {
  const roots = [process.cwd(), path.resolve(process.cwd(), 'apps/backend')];
  const found = roots.find((dir) =>
    fs.existsSync(path.join(dir, 'prisma/schema.prisma')),
  );
  if (!found) {
    throw new Error(
      `Backend package root not found. Looked in:\n  ${roots.join('\n  ')}\n` +
        'Run the e2e suite from the backend package or the monorepo root.',
    );
  }
  return path.join(found, relative);
}

/**
 * Bootstraps an in-memory PGlite instance and applies the Prisma migrations
 * found in `migrationsDir` (defaults to the backend's `prisma/migrations`).
 * Designed for e2e tests — no external Postgres required.
 *
 * An explicitly passed `migrationsDir` that does not exist throws — booting an
 * empty database instead surfaces later as opaque "relation does not exist"
 * errors. The default dir is allowed to be absent (fresh template, no models
 * yet) but warns so the empty database is never a silent surprise.
 */
export async function setupPGlite(migrationsDir?: string) {
  if (migrationsDir !== undefined && !fs.existsSync(migrationsDir)) {
    throw new Error(
      `Migrations directory not found: ${migrationsDir}. ` +
        'Generate the Prisma migrations before running the e2e suite.',
    );
  }

  const resolvedDir = migrationsDir ?? resolveBackendDir('prisma/migrations');

  const pg = new PGlite();

  if (fs.existsSync(resolvedDir)) {
    const entries = fs.readdirSync(resolvedDir, { withFileTypes: true });
    const migrationFolders = entries
      .filter((e) => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const folder of migrationFolders) {
      const sqlPath = path.join(resolvedDir, folder.name, 'migration.sql');
      if (fs.existsSync(sqlPath)) {
        const sql = fs.readFileSync(sqlPath, 'utf-8');
        await pg.exec(sql);
      }
    }
  } else {
    console.warn(
      `[pglite.helper] No migrations found at ${resolvedDir} — booting an ` +
        'EMPTY database. Expected only on the fresh template (no models yet); ' +
        'once you add models, generate migrations with ' +
        '`pnpm --filter backend database:generate-migration <name>`.',
    );
  }

  let closed = false;
  return {
    pg,
    stop: async () => {
      if (closed) return;
      closed = true;
      await pg.close();
    },
  };
}
