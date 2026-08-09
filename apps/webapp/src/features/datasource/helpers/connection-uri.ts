/**
 * libpq connection-URI parsing for the Direct connection form.
 *
 * Operators copy a `postgres://…` URI out of their provider's console far more
 * often than they know the four fields by heart, so the form accepts one and
 * fills itself from it. Parsing stays client-side on purpose: the URI is never
 * sent anywhere and never stored — only the fields it fills are, through the
 * regular datasource API.
 */

type ParsedConnectionUri = {
  host: string;
  port: number;
  database: string;
  sslMode: 'REQUIRE' | 'DISABLE';
  /** Percent-decoded userinfo — absent when the URI carries none. */
  username?: string;
  password?: string;
};

type ParseConnectionUriResult =
  | { ok: true; value: ParsedConnectionUri }
  | { ok: false; message: string };

const ACCEPTED_PROTOCOLS = ['postgres:', 'postgresql:'];

/** Postgres' own default — a URI may legitimately omit the port. */
const DEFAULT_PORT = 5432;

const NOT_A_URI =
  'Must be a connection URI like postgres://user:password@host:5432/database';

function decode(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    // Malformed percent-escape (e.g. a bare "%" in the password).
    return null;
  }
}

/**
 * Parses a libpq URI into the Direct form's fields. Returns a message meant to
 * be shown as-is under the input — the user pasted something, they need to
 * know what is wrong with it, not a generic failure.
 */
function parseConnectionUri(input: string): ParseConnectionUriResult {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: false, message: 'Paste a connection URI first' };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, message: NOT_A_URI };
  }
  if (!ACCEPTED_PROTOCOLS.includes(url.protocol)) {
    return { ok: false, message: NOT_A_URI };
  }

  // IPv6 literals come back bracketed from the URL parser; the pg driver wants
  // the bare address.
  const host = url.hostname.replace(/^\[/, '').replace(/\]$/, '');
  if (host === '') {
    return {
      ok: false,
      message:
        'The URI has no host — Rowhouse connects over TCP, not a Unix socket',
    };
  }

  const path = url.pathname.replace(/^\//, '');
  if (path === '' || path.includes('/')) {
    return {
      ok: false,
      message: 'The URI must end with a database name (…:5432/database)',
    };
  }
  const database = decode(path);
  if (database === null) {
    return { ok: false, message: NOT_A_URI };
  }

  // Only two modes exist in the model: anything that is not an explicit
  // "disable" resolves to REQUIRE — the stricter of the two, never the looser.
  const sslMode =
    url.searchParams.get('sslmode')?.toLowerCase() === 'disable'
      ? 'DISABLE'
      : 'REQUIRE';

  const value: ParsedConnectionUri = {
    host,
    port: url.port === '' ? DEFAULT_PORT : Number(url.port),
    database,
    sslMode,
  };

  if (url.username !== '') {
    const username = decode(url.username);
    if (username === null) {
      return { ok: false, message: NOT_A_URI };
    }
    value.username = username;
  }
  if (url.password !== '') {
    const password = decode(url.password);
    if (password === null) {
      return {
        ok: false,
        message:
          'The password contains an invalid percent-escape — percent-encode special characters (@ : / ?)',
      };
    }
    value.password = password;
  }

  return { ok: true, value };
}

export { parseConnectionUri };
