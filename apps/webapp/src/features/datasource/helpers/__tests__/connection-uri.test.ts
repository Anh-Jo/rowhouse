import { describe, expect, it } from 'vitest';
import { parseConnectionUri } from '../connection-uri';

/** Unwraps a result the test expects to be a success. */
function parsed(input: string) {
  const result = parseConnectionUri(input);
  if (!result.ok) {
    throw new Error(`expected a parse success, got: ${result.message}`);
  }
  return result.value;
}

/** Unwraps a result the test expects to be a failure. */
function failure(input: string): string {
  const result = parseConnectionUri(input);
  if (result.ok) {
    throw new Error('expected a parse failure');
  }
  return result.message;
}

describe('parseConnectionUri', () => {
  it('parses a full URI with credentials', () => {
    expect(
      parsed(
        'postgres://momently:aea49d47e189ad7c@163.172.135.76:5222/momently',
      ),
    ).toEqual({
      host: '163.172.135.76',
      port: 5222,
      database: 'momently',
      sslMode: 'REQUIRE',
      username: 'momently',
      password: 'aea49d47e189ad7c',
    });
  });

  it('accepts the postgresql:// scheme and surrounding whitespace', () => {
    expect(parsed('  postgresql://db.example.com/app  ')).toEqual({
      host: 'db.example.com',
      // No port in the URI: Postgres' own default.
      port: 5432,
      database: 'app',
      sslMode: 'REQUIRE',
    });
  });

  it('omits credentials the URI does not carry, and keeps a username without a password', () => {
    expect(parsed('postgres://db.example.com:5432/app')).not.toHaveProperty(
      'username',
    );
    expect(parsed('postgres://rowhouse_ro@db.example.com/app')).toMatchObject({
      username: 'rowhouse_ro',
    });
    expect(
      parsed('postgres://rowhouse_ro@db.example.com/app'),
    ).not.toHaveProperty('password');
  });

  it('percent-decodes the userinfo and the database name', () => {
    expect(
      parsed('postgres://ro%40corp:p%40ss%2Fword@db.example.com/my%20db'),
    ).toMatchObject({
      username: 'ro@corp',
      password: 'p@ss/word',
      database: 'my db',
    });
  });

  it('unwraps an IPv6 literal from its brackets', () => {
    expect(parsed('postgres://[2001:db8::1]:5432/app').host).toBe(
      '2001:db8::1',
    );
  });

  it('maps sslmode=disable to DISABLE and anything else to the stricter REQUIRE', () => {
    expect(parsed('postgres://h/app?sslmode=disable').sslMode).toBe('DISABLE');
    expect(parsed('postgres://h/app?sslmode=DISABLE').sslMode).toBe('DISABLE');
    for (const mode of ['require', 'prefer', 'allow', 'verify-full']) {
      expect(parsed(`postgres://h/app?sslmode=${mode}`).sslMode).toBe(
        'REQUIRE',
      );
    }
    // Unknown or absent: never silently downgrade.
    expect(parsed('postgres://h/app?sslmode=nonsense').sslMode).toBe('REQUIRE');
    expect(parsed('postgres://h/app').sslMode).toBe('REQUIRE');
  });

  it('rejects an empty input', () => {
    expect(failure('   ')).toBe('Paste a connection URI first');
  });

  it('rejects anything that is not a postgres URI', () => {
    const message =
      'Must be a connection URI like postgres://user:password@host:5432/database';
    expect(failure('mysql://db.example.com/app')).toBe(message);
    expect(failure('db.example.com:5432/app')).toBe(message);
    expect(failure('https://db.example.com/app')).toBe(message);
    // Out-of-range port: not a URL the parser can make sense of either.
    expect(failure('postgres://db.example.com:70000/app')).toBe(message);
  });

  it('rejects a URI with no host', () => {
    expect(failure('postgres:///app')).toBe(
      'The URI has no host — Rowhouse connects over TCP, not a Unix socket',
    );
  });

  it('rejects a URI with no database, or a multi-segment path', () => {
    const message = 'The URI must end with a database name (…:5432/database)';
    expect(failure('postgres://db.example.com:5432')).toBe(message);
    expect(failure('postgres://db.example.com:5432/')).toBe(message);
    expect(failure('postgres://db.example.com:5432/app/extra')).toBe(message);
  });

  it('rejects a password with a broken percent-escape instead of guessing', () => {
    expect(failure('postgres://user:pa%zzss@db.example.com/app')).toBe(
      'The password contains an invalid percent-escape — percent-encode special characters (@ : / ?)',
    );
  });
});
