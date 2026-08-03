import dotenv from 'dotenv';
import { resolve } from 'path';

process.env['NODE_ENV'] = 'test';

// Load .env.test so DATABASE_URL, SMTP_*, MAILPIT_*, etc. are set for all e2e
// tests. `process.cwd()` is the backend package root (the test runner's working
// dir) — works under both CJS and ESM (no __dirname).
dotenv.config({
  path: resolve(process.cwd(), '.env.test'),
  override: true,
  quiet: true,
});

// The e2e timeout (PGlite WASM init can be slow on first run) is configured via
// `testTimeout` in jest-e2e.json — the `jest` global is not available in
// setupFiles under the ESM runner (`--experimental-vm-modules`).
