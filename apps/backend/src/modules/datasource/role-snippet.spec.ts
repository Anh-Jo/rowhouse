import { buildRoleSnippet } from './role-snippet';

describe('buildRoleSnippet', () => {
  it('generates the two-role script scoped to the database and schema', () => {
    const sql = buildRoleSnippet({ database: 'appdb' });

    expect(sql).toContain('CREATE ROLE rowhouse_ro LOGIN');
    expect(sql).toContain('CREATE ROLE rowhouse_rw LOGIN');
    expect(sql).toContain('GRANT CONNECT ON DATABASE appdb');
    expect(sql).toContain(
      'GRANT SELECT ON ALL TABLES IN SCHEMA public TO rowhouse_ro;',
    );
    expect(sql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rowhouse_rw;',
    );
    // Future tables stay covered — the guardrail must not rot as the schema grows.
    expect(sql).toContain('ALTER DEFAULT PRIVILEGES IN SCHEMA public');
  });

  it('never embeds a real password — placeholders only', () => {
    const sql = buildRoleSnippet({ database: 'appdb' });
    expect(sql).toContain("'<choose-a-read-only-password>'");
    expect(sql).toContain("'<choose-a-read-write-password>'");
  });

  it('honors a custom schema', () => {
    const sql = buildRoleSnippet({ database: 'appdb', schema: 'sales' });
    expect(sql).toContain('GRANT USAGE ON SCHEMA sales');
    expect(sql).not.toContain('SCHEMA public');
  });

  it('rejects identifiers that could break out of the script', () => {
    expect(() =>
      buildRoleSnippet({ database: "app'; DROP TABLE users; --" }),
    ).toThrow(/database must match/);
    expect(() =>
      buildRoleSnippet({ database: 'appdb', schema: 'Public Schema' }),
    ).toThrow(/schema must match/);
  });
});
