import { useState, type SyntheticEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Callout } from '@/components/Callout/Callout';
import { Card } from '@/components/Card/Card';
import { CodeBlock } from '@/components/CodeBlock/CodeBlock';
import { FormError } from '@/components/FormError/FormError';
import { Input } from '@/components/Input/Input';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { Select } from '@/components/Select/Select';
import { Textarea } from '@/components/Textarea/Textarea';
import {
  buildCloudSqlSnippet,
  createDatasource,
  testConnection,
  updateDatasource,
  type CreateDatasourceInput,
  type UpdateDatasourceInput,
} from '@/api/datasources';
import { syncSchema } from '@/api/schema';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import { parseConnectionUri } from '../helpers/connection-uri';
import {
  isReadOnlyCanWriteProblem,
  validateInstanceConnectionName,
  validatePort,
  validateRequired,
  validateSaKeyJson,
} from '../helpers/validation';
import './ConnectDatasourcePage.css';

type ConnectionMethod = 'DIRECT' | 'CLOUDSQL';
type CloudSqlAuthType = 'IAM' | 'BUILT_IN';

/**
 * One flat bag of fields for both methods; the form runs with
 * `shouldUnregister: true`, so only the mounted branch's fields validate and
 * reach the submit handler. `database` and `cloudSqlDatabase` stay separate
 * names on purpose — a shared name would be unmounted/remounted on a method
 * switch and lose its value.
 */
type ConnectFormValues = {
  name: string;
  // DIRECT
  host: string;
  port: string;
  database: string;
  sslMode: 'REQUIRE' | 'DISABLE';
  caCert: string;
  // CLOUDSQL
  instanceConnectionName: string;
  cloudSqlDatabase: string;
  saKeyJson: string;
  // Roles (both methods; passwords only rendered when the method has them)
  readOnlyUsername: string;
  readOnlyPassword: string;
  readWriteUsername: string;
  readWritePassword: string;
};

type ConnectStage =
  | { step: 'form' }
  | { step: 'testing' }
  | { step: 'failed'; problems: string[] }
  | { step: 'syncing' };

/** Cloud SQL snippet fetch state — driven by opening the collapsed block. */
type SnippetState =
  | { status: 'idle' }
  | { status: 'missing-input' }
  | { status: 'loading' }
  | { status: 'ready'; script: string }
  | { status: 'error'; message: string };

/* Least-privilege onboarding (transverse decision D11): we never ask for a
   superuser — the customer creates two scoped roles with this snippet. */
const ROLE_SQL_SNIPPET = `-- Run once on the target database, as an admin.
CREATE ROLE rowhouse_ro LOGIN PASSWORD '<read-only-password>';
GRANT CONNECT ON DATABASE <database> TO rowhouse_ro;
GRANT USAGE ON SCHEMA public TO rowhouse_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rowhouse_ro;

CREATE ROLE rowhouse_rw LOGIN PASSWORD '<read-write-password>';
GRANT CONNECT ON DATABASE <database> TO rowhouse_rw;
GRANT USAGE ON SCHEMA public TO rowhouse_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rowhouse_rw;`;

/** The snippet endpoint only accepts lowercase Postgres identifiers. */
const POSTGRES_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]{0,62}$/;

/**
 * What the server currently holds for the registered datasource. Secrets
 * (role passwords, the service-account key) are sealed server-side and never
 * echoed back — only usernames and non-secret settings are kept. Retries
 * diff the form against this snapshot to PATCH only what changed.
 */
type SavedDatasource =
  | {
      id: string;
      method: 'DIRECT';
      name: string;
      host: string;
      port: number;
      database: string;
      sslMode: 'REQUIRE' | 'DISABLE';
      /** Trimmed PEM, '' when no CA is stored. */
      caCert: string;
      readOnlyUsername: string;
      readWriteUsername: string;
    }
  | {
      id: string;
      method: 'CLOUDSQL';
      name: string;
      instanceConnectionName: string;
      database: string;
      authType: CloudSqlAuthType;
      readOnlyUsername: string;
      readWriteUsername: string;
    };

const SSL_MODE_OPTIONS = [
  // REQUIRE alone encrypts but does not verify the server's identity —
  // pasting the CA below upgrades it to full chain verification.
  { value: 'REQUIRE', label: 'Required — encrypted, CA not verified' },
  { value: 'DISABLE', label: 'Disabled — local databases only' },
];

function toCreateInput(
  method: ConnectionMethod,
  authType: CloudSqlAuthType,
  values: ConnectFormValues,
): CreateDatasourceInput {
  // The new UI always sends `method` explicitly, on both branches — DIRECT
  // is only optional server-side for pre-D12 clients.
  if (method === 'CLOUDSQL') {
    // Under IAM auth the password properties are omitted entirely (the API
    // rejects them): ephemeral tokens, no stored DB secret at all.
    const withPassword = authType === 'BUILT_IN';
    return {
      method: 'CLOUDSQL',
      name: values.name.trim(),
      instanceConnectionName: values.instanceConnectionName.trim(),
      database: values.cloudSqlDatabase.trim(),
      authType,
      saKeyJson: values.saKeyJson,
      readOnly: {
        username: values.readOnlyUsername.trim(),
        ...(withPassword ? { password: values.readOnlyPassword } : {}),
      },
      readWrite: {
        username: values.readWriteUsername.trim(),
        ...(withPassword ? { password: values.readWritePassword } : {}),
      },
    };
  }
  const caCert = values.caCert.trim();
  return {
    method: 'DIRECT',
    name: values.name.trim(),
    host: values.host.trim(),
    port: Number(values.port),
    database: values.database.trim(),
    sslMode: values.sslMode,
    ...(caCert !== '' ? { caCert } : {}),
    readOnly: {
      username: values.readOnlyUsername.trim(),
      password: values.readOnlyPassword,
    },
    readWrite: {
      username: values.readWriteUsername.trim(),
      password: values.readWritePassword,
    },
  };
}

function toSavedDatasource(
  id: string,
  method: ConnectionMethod,
  authType: CloudSqlAuthType,
  values: ConnectFormValues,
): SavedDatasource {
  const common = {
    id,
    name: values.name.trim(),
    readOnlyUsername: values.readOnlyUsername.trim(),
    readWriteUsername: values.readWriteUsername.trim(),
  };
  if (method === 'CLOUDSQL') {
    return {
      ...common,
      method: 'CLOUDSQL',
      instanceConnectionName: values.instanceConnectionName.trim(),
      database: values.cloudSqlDatabase.trim(),
      authType,
    };
  }
  return {
    ...common,
    method: 'DIRECT',
    host: values.host.trim(),
    port: Number(values.port),
    database: values.database.trim(),
    sslMode: values.sslMode,
    caCert: values.caCert.trim(),
  };
}

/**
 * Only what differs from the saved snapshot goes into the PATCH. Write-only
 * secrets follow blank-to-keep: a blank password (or a blank service-account
 * key) means "keep the current sealed one", so they are only included when
 * the user typed a replacement. The method itself is never in the PATCH —
 * it cannot change (the picker is locked once registered).
 */
function buildUpdatePatch(
  values: ConnectFormValues,
  saved: SavedDatasource,
): UpdateDatasourceInput {
  const patch: UpdateDatasourceInput = {};
  const name = values.name.trim();
  if (name !== saved.name) {
    patch.name = name;
  }

  if (saved.method === 'CLOUDSQL') {
    const cloudSql: NonNullable<UpdateDatasourceInput['cloudSql']> = {};
    const instanceConnectionName = values.instanceConnectionName.trim();
    if (instanceConnectionName !== saved.instanceConnectionName) {
      cloudSql.instanceConnectionName = instanceConnectionName;
    }
    const database = values.cloudSqlDatabase.trim();
    if (database !== saved.database) {
      cloudSql.database = database;
    }
    if (values.saKeyJson.trim() !== '') {
      cloudSql.saKeyJson = values.saKeyJson;
    }
    if (Object.keys(cloudSql).length > 0) {
      patch.cloudSql = cloudSql;
    }
    if (saved.authType === 'BUILT_IN') {
      if (values.readOnlyPassword !== '') {
        patch.readOnly = {
          username: values.readOnlyUsername.trim(),
          password: values.readOnlyPassword,
        };
      }
      if (values.readWritePassword !== '') {
        patch.readWrite = {
          username: values.readWriteUsername.trim(),
          password: values.readWritePassword,
        };
      }
    } else {
      // IAM: there is no password at all — a changed username simply
      // re-targets the IAM database user.
      const readOnlyUsername = values.readOnlyUsername.trim();
      if (readOnlyUsername !== saved.readOnlyUsername) {
        patch.readOnly = { username: readOnlyUsername };
      }
      const readWriteUsername = values.readWriteUsername.trim();
      if (readWriteUsername !== saved.readWriteUsername) {
        patch.readWrite = { username: readWriteUsername };
      }
    }
    return patch;
  }

  const host = values.host.trim();
  if (host !== saved.host) {
    patch.host = host;
  }
  const port = Number(values.port);
  if (port !== saved.port) {
    patch.port = port;
  }
  const database = values.database.trim();
  if (database !== saved.database) {
    patch.database = database;
  }
  if (values.sslMode !== saved.sslMode) {
    patch.sslMode = values.sslMode;
  }
  const caCert = values.caCert.trim();
  if (caCert !== saved.caCert) {
    // An emptied field removes the stored certificate (null), a new PEM
    // replaces it — the CA is public-key material, not blank-to-keep.
    patch.caCert = caCert === '' ? null : caCert;
  }
  if (values.readOnlyPassword !== '') {
    patch.readOnly = {
      username: values.readOnlyUsername.trim(),
      password: values.readOnlyPassword,
    };
  }
  if (values.readWritePassword !== '') {
    patch.readWrite = {
      username: values.readWriteUsername.trim(),
      password: values.readWritePassword,
    };
  }
  return patch;
}

/**
 * Registers a datasource, then walks the trust checks in one flow: connection
 * test (both roles + the read-only-cannot-write guardrail), then the first
 * schema sync, then straight to the schema browser. Failures surface as
 * actionable inline problems, never a dead end: every field stays editable
 * after a failed test, and the retry PATCHes whatever changed (wrong password
 * included) before re-running the test.
 */
function ConnectDatasourcePage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { workspaceId } = useWorkspaceId();
  const [stage, setStage] = useState<ConnectStage>({ step: 'form' });
  const [saved, setSaved] = useState<SavedDatasource | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  // The picker and auth type live outside react-hook-form: they decide which
  // branch of the form is mounted, and both lock once the datasource exists.
  const [method, setMethod] = useState<ConnectionMethod>('DIRECT');
  const [authType, setAuthType] = useState<CloudSqlAuthType>('IAM');
  const [snippet, setSnippet] = useState<SnippetState>({ status: 'idle' });
  // The pasted URI is a filling tool, not a value: it lives outside
  // react-hook-form and is never part of a create/update payload.
  const [uri, setUri] = useState('');

  const form = useForm<ConnectFormValues>({
    // Unmounted branch fields drop out of validation and submitted values —
    // a Cloud SQL submit must not trip over hidden host/port validators.
    shouldUnregister: true,
    defaultValues: {
      name: '',
      host: '',
      port: '5432',
      database: '',
      sslMode: 'REQUIRE',
      caCert: '',
      instanceConnectionName: '',
      cloudSqlDatabase: '',
      saKeyJson: '',
      readOnlyUsername: '',
      readOnlyPassword: '',
      readWriteUsername: '',
      readWritePassword: '',
    },
  });

  const locked = saved !== null;
  const hasPasswords = method === 'DIRECT' || authType === 'BUILT_IN';

  // After a successful save the write-only secrets are sealed server-side;
  // the inputs go back to blank ("keep the current one") so a failed test
  // never leaves secrets sitting in the DOM, and a retry only re-sends what
  // the user re-typed.
  const rememberSaved = (id: string, values: ConnectFormValues) => {
    setSaved(toSavedDatasource(id, method, authType, values));
    if (hasPasswords) {
      form.resetField('readOnlyPassword');
      form.resetField('readWritePassword');
    }
    if (method === 'CLOUDSQL') {
      form.resetField('saKeyJson');
    }
  };

  /**
   * Fills the Direct fields from the pasted URI as it is pasted or edited; a
   * value that does not parse simply fills nothing, leaving the fields below
   * to be typed by hand. Credentials the URI carries only ever land on the
   * **read-only** role — Rowhouse is never handed a write path implicitly,
   * and the connection test still has to prove that role cannot write.
   */
  const onUriChange = (input: string) => {
    setUri(input);
    const result = parseConnectionUri(input);
    if (!result.ok) {
      return;
    }
    const { host, port, database, sslMode, username, password } = result.value;
    // shouldValidate clears the "… is required" errors a failed submit left on
    // the fields we are filling.
    form.setValue('host', host, { shouldValidate: true });
    form.setValue('port', String(port), { shouldValidate: true });
    form.setValue('database', database, { shouldValidate: true });
    form.setValue('sslMode', sslMode);
    if (username !== undefined) {
      form.setValue('readOnlyUsername', username, { shouldValidate: true });
    }
    if (password !== undefined) {
      form.setValue('readOnlyPassword', password, { shouldValidate: true });
    }
  };

  const onSubmit = async (values: ConnectFormValues) => {
    if (!workspaceId) {
      return;
    }
    setApiError(null);
    try {
      let id: string;
      if (saved === null) {
        const created = await createDatasource(
          workspaceId,
          projectId,
          toCreateInput(method, authType, values),
        );
        id = created.id;
        rememberSaved(id, values);
      } else {
        // Retry: PATCH the fields that changed since the last save (if any)
        // so a wrong secret is fixable in place, then re-run the test.
        id = saved.id;
        const patch = buildUpdatePatch(values, saved);
        if (Object.keys(patch).length > 0) {
          await updateDatasource(workspaceId, projectId, id, patch);
          rememberSaved(id, values);
        }
      }
      setStage({ step: 'testing' });
      const result = await testConnection(workspaceId, projectId, id);
      if (!result.ok) {
        setStage({ step: 'failed', problems: result.problems });
        return;
      }
      setStage({ step: 'syncing' });
      const syncResult = await syncSchema(workspaceId, projectId, id);
      // The browser shows the first sync's diff the same way a re-sync does.
      navigate(`/projects/${projectId}/datasources/${id}/schema`, {
        replace: true,
        state: { syncResult },
      });
    } catch (error) {
      setStage({ step: 'form' });
      setApiError(
        error instanceof Error
          ? error.message
          : 'Could not reach the server, please try again.',
      );
    }
  };

  // The gcloud script is generated from the typed instance + database, so it
  // is fetched when the collapsed block opens (and refreshed on re-open).
  const onSnippetToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    if (!event.currentTarget.open || workspaceId === null) {
      return;
    }
    const instanceConnectionName = form
      .getValues('instanceConnectionName')
      .trim();
    const database = form.getValues('cloudSqlDatabase').trim();
    if (
      validateInstanceConnectionName(instanceConnectionName) !== true ||
      !POSTGRES_IDENTIFIER_PATTERN.test(database)
    ) {
      setSnippet({ status: 'missing-input' });
      return;
    }
    setSnippet({ status: 'loading' });
    buildCloudSqlSnippet(workspaceId, { instanceConnectionName, database })
      .then((result) => setSnippet({ status: 'ready', script: result.script }))
      .catch((error: unknown) =>
        setSnippet({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Could not generate the script, please try again.',
        }),
      );
  };

  const busy =
    form.formState.isSubmitting ||
    stage.step === 'testing' ||
    stage.step === 'syncing';
  const buttonLabel =
    stage.step === 'testing'
      ? 'Testing connection…'
      : stage.step === 'syncing'
        ? 'Connection OK — syncing schema…'
        : locked
          ? 'Retry connection test'
          : 'Connect & test';

  // After registration, secrets are optional: blank keeps the sealed one.
  // But a username change forces a re-seal, which needs the password too.
  const validatePassword =
    (label: string, usernameField: 'readOnlyUsername' | 'readWriteUsername') =>
    (value: string, formValues: ConnectFormValues): string | true => {
      if (saved === null) {
        return validateRequired(label)(value);
      }
      const savedUsername =
        usernameField === 'readOnlyUsername'
          ? saved.readOnlyUsername
          : saved.readWriteUsername;
      if (value === '' && formValues[usernameField].trim() !== savedUsername) {
        return `${label} is required when changing the username`;
      }
      return true;
    };
  const passwordHint = locked
    ? 'Leave blank to keep the current password'
    : undefined;

  const methodCard = (
    value: ConnectionMethod,
    title: string,
    description: string,
    badge?: string,
  ) => (
    <Card
      className={`connect-method${method === value ? ' connect-method--selected' : ''}`}
    >
      <label className="connect-method__option">
        <input
          className="connect-method__input"
          type="radio"
          name="connection-method"
          value={value}
          checked={method === value}
          disabled={busy || locked}
          onChange={() => setMethod(value)}
        />
        <span className="connect-method__content">
          <span className="connect-method__name">{title}</span>
          <span className="connect-method__description">{description}</span>
          {badge && <Badge label={badge} variant="success" />}
        </span>
      </label>
    </Card>
  );

  return (
    <div className="connect-page">
      <PageHeader
        title="Connect a database"
        subtitle="Rowhouse connects with two dedicated least-privilege roles — never a
          superuser. Reads use the read-only role; the read-write role is only
          used behind approvals."
      />

      <div
        className="connect-page__methods"
        role="radiogroup"
        aria-label="Connection method"
      >
        {methodCard(
          'DIRECT',
          'Direct connection',
          'Reach the database on its host and port, TLS encrypted — any managed or self-hosted Postgres.',
        )}
        {methodCard(
          'CLOUDSQL',
          'Google Cloud SQL',
          'Through the Cloud SQL connector, with IAM database authentication.',
          'No stored password',
        )}
      </div>
      {locked && (
        <p className="connect-page__hint">
          The connection method is fixed after creation — connect a new
          datasource to use a different one.
        </p>
      )}

      {method === 'DIRECT' ? (
        <details className="connect-page__sql">
          <summary className="connect-page__sql-summary">
            Need to create the roles? Run this snippet on your database first.
          </summary>
          <CodeBlock code={ROLE_SQL_SNIPPET} label="SQL" />
        </details>
      ) : (
        <details className="connect-page__sql" onToggle={onSnippetToggle}>
          <summary className="connect-page__sql-summary">
            Need to set up the service accounts? Generate the gcloud + SQL
            script.
          </summary>
          {snippet.status === 'missing-input' && (
            <p className="connect-page__hint">
              Fill in a valid instance connection name and database below
              first — the script is generated from them.
            </p>
          )}
          {snippet.status === 'loading' && (
            <p className="connect-page__hint">Generating the script…</p>
          )}
          {snippet.status === 'error' && <FormError message={snippet.message} />}
          {snippet.status === 'ready' && (
            <CodeBlock code={snippet.script} label="gcloud + SQL" />
          )}
        </details>
      )}

      {stage.step === 'syncing' && (
        <Callout variant="success" title="Connection OK.">
          Both roles verified — the read-only role cannot write. Syncing the
          schema…
        </Callout>
      )}

      {stage.step === 'failed' && (
        <Callout variant="danger" title="Connection test failed">
          <ul className="connect-result__problems">
            {stage.problems.map((problem) =>
              isReadOnlyCanWriteProblem(problem) ? (
                <li
                  key={problem}
                  className="connect-result__problem connect-result__problem--critical"
                >
                  <ShieldAlert size={18} aria-hidden />
                  <span>
                    <strong>Guardrail: </strong>
                    {problem} Fix the role&apos;s grants (revoke write
                    privileges), then retry the test.
                  </span>
                </li>
              ) : (
                <li key={problem} className="connect-result__problem">
                  {problem}
                </li>
              ),
            )}
          </ul>
          <p className="connect-result__retry-hint">
            Fix the fields below — password fields left blank keep the stored
            password — then retry the test.
          </p>
        </Callout>
      )}

      <form
        className="connect-page__form"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FormError message={apiError} />

        {/* Fields lock only while a request is in flight; after a failed test
            everything stays editable so the user can fix and retry. */}
        {method === 'DIRECT' ? (
          <fieldset className="connect-page__fieldset" disabled={busy}>
            <legend className="connect-page__legend">Database</legend>
            {/* Shortcut, not a second source of truth: it writes into the
                fields below, which stay the values that get saved. */}
            <Input
              className="connect-uri"
              label="Connection URI"
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="postgres://user:password@db.example.com:5432/app_production"
              hint="Optional — pasting one fills the fields below. Credentials it carries go to the read-only role; the URI itself is never sent or stored."
              value={uri}
              onChange={(event) => onUriChange(event.target.value)}
            />
            <Input
              label="Name"
              type="text"
              placeholder="Production"
              error={form.formState.errors.name?.message}
              {...form.register('name', { validate: validateRequired('Name') })}
            />
            <div className="connect-page__row">
              <Input
                label="Host"
                type="text"
                placeholder="db.example.com"
                error={form.formState.errors.host?.message}
                {...form.register('host', {
                  validate: validateRequired('Host'),
                })}
              />
              <Input
                label="Port"
                type="number"
                inputMode="numeric"
                error={form.formState.errors.port?.message}
                {...form.register('port', { validate: validatePort })}
              />
            </div>
            <Input
              label="Database"
              type="text"
              placeholder="app_production"
              error={form.formState.errors.database?.message}
              {...form.register('database', {
                validate: validateRequired('Database'),
              })}
            />
            <Controller
              control={form.control}
              name="sslMode"
              render={({ field }) => (
                <Select
                  label="TLS (SSL mode)"
                  options={SSL_MODE_OPTIONS}
                  value={field.value}
                  onValueChange={field.onChange}
                />
              )}
            />
            <Textarea
              label="CA certificate (optional)"
              rows={5}
              placeholder="-----BEGIN CERTIFICATE-----"
              hint="Paste the server CA PEM to enable full TLS verification (verify-full)."
              error={form.formState.errors.caCert?.message}
              {...form.register('caCert', {
                validate: (value: string) =>
                  value.trim() === '' ||
                  value.includes('-----BEGIN CERTIFICATE-----') ||
                  'Must be a PEM-encoded certificate',
              })}
            />
          </fieldset>
        ) : (
          <fieldset className="connect-page__fieldset" disabled={busy}>
            <legend className="connect-page__legend">Cloud SQL instance</legend>
            <Input
              label="Name"
              type="text"
              placeholder="Production"
              error={form.formState.errors.name?.message}
              {...form.register('name', { validate: validateRequired('Name') })}
            />
            <Input
              label="Instance connection name"
              type="text"
              placeholder="project:region:instance"
              error={form.formState.errors.instanceConnectionName?.message}
              {...form.register('instanceConnectionName', {
                validate: validateInstanceConnectionName,
              })}
            />
            <Input
              label="Database"
              type="text"
              placeholder="app_production"
              error={form.formState.errors.cloudSqlDatabase?.message}
              {...form.register('cloudSqlDatabase', {
                validate: validateRequired('Database'),
              })}
            />
            <div
              className="connect-page__radio-group"
              role="radiogroup"
              aria-label="Database authentication"
            >
              <span className="connect-page__radio-group-label">
                Database authentication
              </span>
              <label className="connect-page__radio">
                <input
                  type="radio"
                  name="cloud-sql-auth-type"
                  value="IAM"
                  checked={authType === 'IAM'}
                  disabled={busy || locked}
                  onChange={() => setAuthType('IAM')}
                />
                <span>IAM (recommended) — ephemeral tokens, no password</span>
              </label>
              <label className="connect-page__radio">
                <input
                  type="radio"
                  name="cloud-sql-auth-type"
                  value="BUILT_IN"
                  checked={authType === 'BUILT_IN'}
                  disabled={busy || locked}
                  onChange={() => setAuthType('BUILT_IN')}
                />
                <span>Built-in password</span>
              </label>
              {locked && (
                <p className="connect-page__hint">
                  The auth type is fixed after creation — connect a new
                  datasource to switch.
                </p>
              )}
            </div>
            <Textarea
              label="Service account key JSON"
              rows={6}
              autoComplete="off"
              placeholder={
                locked
                  ? 'Paste a new key to replace'
                  : '{ "type": "service_account", … }'
              }
              hint={
                locked
                  ? 'Service account key stored — sealed. Leave blank to keep it.'
                  : 'Sealed on save — never displayed or returned again.'
              }
              error={form.formState.errors.saKeyJson?.message}
              {...form.register('saKeyJson', {
                validate: validateSaKeyJson(saved === null),
              })}
            />
          </fieldset>
        )}

        <div className="connect-page__roles">
          <fieldset className="connect-page__fieldset" disabled={busy}>
            <legend className="connect-page__legend">Read-only role</legend>
            <p className="connect-page__hint">
              Default execution path — every read goes through this role.
            </p>
            <Input
              label="Read-only username"
              type="text"
              placeholder={
                method === 'CLOUDSQL' ? 'rowhouse-ro@project.iam' : 'rowhouse_ro'
              }
              autoComplete="off"
              error={form.formState.errors.readOnlyUsername?.message}
              {...form.register('readOnlyUsername', {
                validate: validateRequired('Read-only username'),
              })}
            />
            {hasPasswords ? (
              <Input
                label="Read-only password"
                type="password"
                autoComplete="new-password"
                placeholder={passwordHint}
                error={form.formState.errors.readOnlyPassword?.message}
                {...form.register('readOnlyPassword', {
                  validate: validatePassword(
                    'Read-only password',
                    'readOnlyUsername',
                  ),
                })}
              />
            ) : (
              <p className="connect-page__hint">
                IAM auth — no password: tokens are minted per connection.
              </p>
            )}
          </fieldset>

          <fieldset className="connect-page__fieldset" disabled={busy}>
            <legend className="connect-page__legend">Read-write role</legend>
            <p className="connect-page__hint">
              Only used behind explicit approvals (from P2), never by default.
            </p>
            <Input
              label="Read-write username"
              type="text"
              placeholder={
                method === 'CLOUDSQL' ? 'rowhouse-rw@project.iam' : 'rowhouse_rw'
              }
              autoComplete="off"
              error={form.formState.errors.readWriteUsername?.message}
              {...form.register('readWriteUsername', {
                validate: validateRequired('Read-write username'),
              })}
            />
            {hasPasswords ? (
              <Input
                label="Read-write password"
                type="password"
                autoComplete="new-password"
                placeholder={passwordHint}
                error={form.formState.errors.readWritePassword?.message}
                {...form.register('readWritePassword', {
                  validate: validatePassword(
                    'Read-write password',
                    'readWriteUsername',
                  ),
                })}
              />
            ) : (
              <p className="connect-page__hint">
                IAM auth — no password: tokens are minted per connection.
              </p>
            )}
          </fieldset>
        </div>

        <Button type="submit" size="lg" disabled={busy}>
          {buttonLabel}
        </Button>
      </form>
    </div>
  );
}

export { ConnectDatasourcePage };
