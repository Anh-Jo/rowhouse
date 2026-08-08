/**
 * Least-privilege onboarding for Cloud SQL (decisions D11 + D12): the connect
 * flow hands the customer this gcloud + SQL script, to run once as a project
 * admin on THEIR Google Cloud project. It creates one service account per
 * Rowhouse role — the ro/rw duality (decision D2) needs two distinct IAM
 * identities, a single account would collapse it — grants both the minimum
 * to reach the instance through the connector, registers them as IAM
 * database users and applies the same least-privilege SQL grants as the
 * direct-method snippet. No password ever exists on the IAM path.
 */

const IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;
const INSTANCE_CONNECTION_NAME_PATTERN =
  /^[a-z][-a-z0-9]*:[a-z0-9-]+:[a-z][-a-z0-9]*$/;

/** Validates and normalizes a Postgres identifier we inject into the script. */
function identifier(value: string, label: string): string {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(
      `${label} must match ${IDENTIFIER_PATTERN.source} (lowercase Postgres identifier)`,
    );
  }
  return value;
}

export type CloudSqlSnippetInput = {
  instanceConnectionName: string;
  database: string;
  schema?: string;
};

export function buildCloudSqlSnippet(input: CloudSqlSnippetInput): string {
  if (!INSTANCE_CONNECTION_NAME_PATTERN.test(input.instanceConnectionName)) {
    throw new Error('instanceConnectionName must be "project:region:instance"');
  }
  const [project, , instance] = input.instanceConnectionName.split(':');
  const database = identifier(input.database, 'database');
  const schema = identifier(input.schema ?? 'public', 'schema');

  // IAM database users in Cloud SQL for Postgres are named after the service
  // account email with the ".gserviceaccount.com" suffix truncated — these
  // exact strings go into the Rowhouse connect form as the role usernames.
  const roUser = `rowhouse-ro@${project}.iam`;
  const rwUser = `rowhouse-rw@${project}.iam`;
  const roEmail = `rowhouse-ro@${project}.iam.gserviceaccount.com`;
  const rwEmail = `rowhouse-rw@${project}.iam.gserviceaccount.com`;

  return `# Rowhouse Cloud SQL least-privilege setup — run once as a project admin.
# Instance: ${input.instanceConnectionName} · database: ${database}
#
# One service account per Rowhouse role: the read-only identity used by the
# explorer and the read-write identity used only behind approvals must stay
# two distinct IAM principals, so neither can borrow the other's grants.

# 1) Create the two service accounts.
gcloud iam service-accounts create rowhouse-ro --project=${project} \\
  --display-name="Rowhouse read-only"
gcloud iam service-accounts create rowhouse-rw --project=${project} \\
  --display-name="Rowhouse read-write"

# 2) Let them reach the instance through the Cloud SQL connector
#    (cloudsql.client) and log in with IAM tokens (cloudsql.instanceUser).
for SA in ${roEmail} ${rwEmail}; do
  gcloud projects add-iam-policy-binding ${project} \\
    --member="serviceAccount:\${SA}" --role=roles/cloudsql.client
  gcloud projects add-iam-policy-binding ${project} \\
    --member="serviceAccount:\${SA}" --role=roles/cloudsql.instanceUser
done

# 3) Register both as IAM database users on the instance. Cloud SQL for
#    Postgres names an IAM user after the service-account email with the
#    ".gserviceaccount.com" suffix truncated: the resulting database users
#    are "${roUser}" and "${rwUser}" — paste exactly these as the role
#    usernames in the Rowhouse connect form (IAM auth, no passwords).
gcloud sql users create "${roEmail}" \\
  --instance=${instance} --project=${project} --type=cloud_iam_service_account
gcloud sql users create "${rwEmail}" \\
  --instance=${instance} --project=${project} --type=cloud_iam_service_account

# 4) Create a key for the service account and paste the JSON file's content
#    into the Rowhouse connect form (it is sealed at rest, never returned).
gcloud iam service-accounts keys create rowhouse-key.json \\
  --iam-account=${roEmail}

# 5) Least-privilege grants — run this SQL on "${database}", e.g. via:
#    gcloud sql connect ${instance} --project=${project} --database=${database}
cat <<'SQL'
GRANT CONNECT ON DATABASE ${database} TO "${roUser}", "${rwUser}";
GRANT USAGE ON SCHEMA ${schema} TO "${roUser}", "${rwUser}";

-- Read-only user: SELECT and nothing else, now and for future tables.
GRANT SELECT ON ALL TABLES IN SCHEMA ${schema} TO "${roUser}";
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema}
  GRANT SELECT ON TABLES TO "${roUser}";

-- Read-write user: row mutations, no DDL.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO "${rwUser}";
GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${schema} TO "${rwUser}";
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema}
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${rwUser}";
ALTER DEFAULT PRIVILEGES IN SCHEMA ${schema}
  GRANT USAGE ON SEQUENCES TO "${rwUser}";
SQL
`;
}
