import { buildCloudSqlSnippet } from './cloud-sql-snippet';

const INPUT = {
  instanceConnectionName: 'my-project:europe-west1:prod',
  database: 'appdb',
};

describe('buildCloudSqlSnippet', () => {
  it('creates one service account per Rowhouse role with the connector grants', () => {
    const script = buildCloudSqlSnippet(INPUT);

    expect(script).toContain(
      'gcloud iam service-accounts create rowhouse-ro --project=my-project',
    );
    expect(script).toContain(
      'gcloud iam service-accounts create rowhouse-rw --project=my-project',
    );
    expect(script).toContain('roles/cloudsql.client');
    expect(script).toContain('roles/cloudsql.instanceUser');
  });

  it('registers IAM database users and documents the truncated naming', () => {
    const script = buildCloudSqlSnippet(INPUT);

    expect(script).toContain(
      'gcloud sql users create "rowhouse-ro@my-project.iam.gserviceaccount.com"',
    );
    expect(script).toContain('--type=cloud_iam_service_account');
    expect(script).toContain('--instance=prod');
    // The truncation rule is what turns the SA email into the username the
    // customer must paste into the connect form — it must be spelled out.
    expect(script).toContain('".gserviceaccount.com" suffix truncated');
    expect(script).toContain('"rowhouse-ro@my-project.iam"');
    expect(script).toContain('"rowhouse-rw@my-project.iam"');
  });

  it('grants SELECT to the read-only user and row mutations to the read-write user', () => {
    const script = buildCloudSqlSnippet(INPUT);

    expect(script).toContain(
      'GRANT SELECT ON ALL TABLES IN SCHEMA public TO "rowhouse-ro@my-project.iam";',
    );
    expect(script).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "rowhouse-rw@my-project.iam";',
    );
    // Future tables stay covered — the guardrail must not rot as the schema grows.
    expect(script).toContain('ALTER DEFAULT PRIVILEGES IN SCHEMA public');
    expect(script).toContain('GRANT CONNECT ON DATABASE appdb');
    // The zero-stored-password path: no password placeholder anywhere.
    expect(script).not.toContain('PASSWORD');
  });

  it('honors a custom schema', () => {
    const script = buildCloudSqlSnippet({ ...INPUT, schema: 'sales' });
    expect(script).toContain('GRANT USAGE ON SCHEMA sales');
    expect(script).not.toContain('SCHEMA public');
  });

  it('rejects inputs that could break out of the script', () => {
    expect(() =>
      buildCloudSqlSnippet({
        ...INPUT,
        instanceConnectionName: 'my-project;rm -rf:region:x',
      }),
    ).toThrow(/project:region:instance/);
    expect(() =>
      buildCloudSqlSnippet({
        ...INPUT,
        database: "app'; DROP TABLE users; --",
      }),
    ).toThrow(/database must match/);
    expect(() =>
      buildCloudSqlSnippet({ ...INPUT, schema: 'Public Schema' }),
    ).toThrow(/schema must match/);
  });
});
