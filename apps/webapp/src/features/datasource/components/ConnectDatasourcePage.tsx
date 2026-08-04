import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/Button/Button';
import { Callout } from '@/components/Callout/Callout';
import { CodeBlock } from '@/components/CodeBlock/CodeBlock';
import { FormError } from '@/components/FormError/FormError';
import { Input } from '@/components/Input/Input';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { Select } from '@/components/Select/Select';
import {
  createDatasource,
  testConnection,
  type CreateDatasourceInput,
} from '@/api/datasources';
import { syncSchema } from '@/api/schema';
import { useWorkspaceId } from '@/hooks/useWorkspaceId';
import {
  isReadOnlyCanWriteProblem,
  validatePort,
  validateRequired,
} from '../helpers/validation';
import './ConnectDatasourcePage.css';

type ConnectFormValues = {
  name: string;
  host: string;
  port: string;
  database: string;
  sslMode: 'REQUIRE' | 'DISABLE';
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

const SSL_MODE_OPTIONS = [
  { value: 'REQUIRE', label: 'Required (recommended)' },
  { value: 'DISABLE', label: 'Disabled — local databases only' },
];

function toCreateInput(values: ConnectFormValues): CreateDatasourceInput {
  return {
    name: values.name.trim(),
    host: values.host.trim(),
    port: Number(values.port),
    database: values.database.trim(),
    sslMode: values.sslMode,
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

/**
 * Registers a datasource, then walks the trust checks in one flow: connection
 * test (both roles + the read-only-cannot-write guardrail), then the first
 * schema sync, then straight to the schema browser. Failures surface as
 * actionable inline problems, never a dead end.
 */
function ConnectDatasourcePage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { workspaceId } = useWorkspaceId();
  const [stage, setStage] = useState<ConnectStage>({ step: 'form' });
  const [datasourceId, setDatasourceId] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const form = useForm<ConnectFormValues>({
    defaultValues: {
      name: '',
      host: '',
      port: '5432',
      database: '',
      sslMode: 'REQUIRE',
      readOnlyUsername: '',
      readOnlyPassword: '',
      readWriteUsername: '',
      readWritePassword: '',
    },
  });

  const onSubmit = async (values: ConnectFormValues) => {
    if (!workspaceId) {
      return;
    }
    setApiError(null);
    try {
      // The datasource has no update endpoint in P0: once registered, a
      // failed test is retried against the same record (fix grants database
      // side), not by re-creating it.
      let id = datasourceId;
      if (id === null) {
        const created = await createDatasource(
          workspaceId,
          projectId,
          toCreateInput(values),
        );
        id = created.id;
        setDatasourceId(id);
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

  const busy =
    form.formState.isSubmitting ||
    stage.step === 'testing' ||
    stage.step === 'syncing';
  const buttonLabel =
    stage.step === 'testing'
      ? 'Testing connection…'
      : stage.step === 'syncing'
        ? 'Connection OK — syncing schema…'
        : datasourceId !== null
          ? 'Retry connection test'
          : 'Connect & test';

  return (
    <div className="connect-page">
      <PageHeader
        title="Connect a database"
        subtitle="Rowhouse connects with two dedicated least-privilege roles — never a
          superuser. Reads use the read-only role; the read-write role is only
          used behind approvals."
      />

      <details className="connect-page__sql">
        <summary className="connect-page__sql-summary">
          Need to create the roles? Run this snippet on your database first.
        </summary>
        <CodeBlock code={ROLE_SQL_SNIPPET} label="SQL" />
      </details>

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
        </Callout>
      )}

      <form
        className="connect-page__form"
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
      >
        <FormError message={apiError} />

        <fieldset
          className="connect-page__fieldset"
          // Registered datasources cannot be edited in P0 — the retry only
          // re-runs the test, so editing fields here would silently lie.
          disabled={datasourceId !== null}
        >
          <legend className="connect-page__legend">Database</legend>
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
              {...form.register('host', { validate: validateRequired('Host') })}
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
        </fieldset>

        <div className="connect-page__roles">
          <fieldset
            className="connect-page__fieldset"
            disabled={datasourceId !== null}
          >
            <legend className="connect-page__legend">Read-only role</legend>
            <p className="connect-page__hint">
              Default execution path — every read goes through this role.
            </p>
            <Input
              label="Read-only username"
              type="text"
              placeholder="rowhouse_ro"
              autoComplete="off"
              error={form.formState.errors.readOnlyUsername?.message}
              {...form.register('readOnlyUsername', {
                validate: validateRequired('Read-only username'),
              })}
            />
            <Input
              label="Read-only password"
              type="password"
              autoComplete="new-password"
              error={form.formState.errors.readOnlyPassword?.message}
              {...form.register('readOnlyPassword', {
                validate: validateRequired('Read-only password'),
              })}
            />
          </fieldset>

          <fieldset
            className="connect-page__fieldset"
            disabled={datasourceId !== null}
          >
            <legend className="connect-page__legend">Read-write role</legend>
            <p className="connect-page__hint">
              Only used behind explicit approvals (from P2), never by default.
            </p>
            <Input
              label="Read-write username"
              type="text"
              placeholder="rowhouse_rw"
              autoComplete="off"
              error={form.formState.errors.readWriteUsername?.message}
              {...form.register('readWriteUsername', {
                validate: validateRequired('Read-write username'),
              })}
            />
            <Input
              label="Read-write password"
              type="password"
              autoComplete="new-password"
              error={form.formState.errors.readWritePassword?.message}
              {...form.register('readWritePassword', {
                validate: validateRequired('Read-write password'),
              })}
            />
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
