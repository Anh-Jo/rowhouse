import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type {
  CloudSqlSnippetInput,
  CloudSqlSnippetResult,
  ConnectionTestResult,
  CreateDatasourceInput,
  DatasourceDto,
  UpdateDatasourceInput,
} from '@/api/datasources';
import type { SyncResultDto } from '@/api/schema';
import { ConnectDatasourcePage } from '../ConnectDatasourcePage';

const {
  createDatasource,
  testConnection,
  updateDatasource,
  buildCloudSqlSnippet,
  syncSchema,
} = vi.hoisted(() => ({
  createDatasource:
    vi.fn<
      (
        workspaceId: string,
        projectId: string,
        input: CreateDatasourceInput,
      ) => Promise<DatasourceDto>
    >(),
  testConnection: vi.fn<() => Promise<ConnectionTestResult>>(),
  updateDatasource:
    vi.fn<
      (
        workspaceId: string,
        projectId: string,
        datasourceId: string,
        input: UpdateDatasourceInput,
      ) => Promise<DatasourceDto>
    >(),
  buildCloudSqlSnippet:
    vi.fn<
      (
        workspaceId: string,
        input: CloudSqlSnippetInput,
      ) => Promise<CloudSqlSnippetResult>
    >(),
  syncSchema: vi.fn<() => Promise<SyncResultDto>>(),
}));

vi.mock('@/api/datasources', () => ({
  createDatasource,
  testConnection,
  updateDatasource,
  buildCloudSqlSnippet,
}));
vi.mock('@/api/schema', () => ({ syncSchema }));
vi.mock('@/hooks/useWorkspaceId', () => ({
  useWorkspaceId: () => ({ workspaceId: 'ws-1', isPending: false }),
}));

const CREATED_DATASOURCE = { id: 'ds-1' } as DatasourceDto;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/projects/p-1/datasources/new']}>
      <Routes>
        <Route
          path="/projects/:projectId/datasources/new"
          element={<ConnectDatasourcePage />}
        />
        <Route
          path="/projects/:projectId/datasources/:datasourceId/schema"
          element={<div>schema browser</div>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Name'), 'Production');
  await user.type(screen.getByLabelText('Host'), 'db.example.com');
  await user.type(screen.getByLabelText('Database'), 'app');
  await user.type(screen.getByLabelText('Read-only username'), 'rowhouse_ro');
  await user.type(screen.getByLabelText('Read-only password'), 'ro-secret');
  await user.type(screen.getByLabelText('Read-write username'), 'rowhouse_rw');
  await user.type(screen.getByLabelText('Read-write password'), 'rw-secret');
}

const SA_KEY_JSON = '{"type":"service_account","project_id":"my-project"}';

/** Switches to the Cloud SQL method and fills its form (IAM auth default). */
async function fillValidCloudSqlForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('radio', { name: /Google Cloud SQL/ }));
  await user.type(screen.getByLabelText('Name'), 'Cloud prod');
  await user.type(
    screen.getByLabelText('Instance connection name'),
    'my-project:europe-west1:prod-db',
  );
  await user.type(screen.getByLabelText('Database'), 'app');
  // paste, not type: userEvent.type treats "{" as a key descriptor.
  await user.click(screen.getByLabelText('Service account key JSON'));
  await user.paste(SA_KEY_JSON);
  await user.type(
    screen.getByLabelText('Read-only username'),
    'rowhouse-ro@my-project.iam',
  );
  await user.type(
    screen.getByLabelText('Read-write username'),
    'rowhouse-rw@my-project.iam',
  );
}

describe('ConnectDatasourcePage', () => {
  beforeEach(() => {
    createDatasource.mockReset();
    testConnection.mockReset();
    updateDatasource.mockReset();
    buildCloudSqlSnippet.mockReset();
    syncSchema.mockReset();
  });

  it('shows validation errors and does not call the API on an empty submit', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Connect & test' }));

    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByText('Host is required')).toBeInTheDocument();
    expect(screen.getByText('Database is required')).toBeInTheDocument();
    expect(screen.getByText('Read-only username is required')).toBeInTheDocument();
    expect(screen.getByText('Read-only password is required')).toBeInTheDocument();
    expect(screen.getByText('Read-write username is required')).toBeInTheDocument();
    expect(screen.getByText('Read-write password is required')).toBeInTheDocument();
    expect(createDatasource).not.toHaveBeenCalled();
  });

  it('rejects an out-of-range port before hitting the API', async () => {
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    const port = screen.getByLabelText('Port');
    await user.clear(port);
    await user.type(port, '70000');
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));

    expect(
      await screen.findByText('Port must be an integer between 1 and 65535'),
    ).toBeInTheDocument();
    expect(createDatasource).not.toHaveBeenCalled();
  });

  it('renders the problems on a failed test, with the read-only guardrail called out, and never syncs', async () => {
    createDatasource.mockResolvedValue(CREATED_DATASOURCE);
    testConnection.mockResolvedValue({
      ok: false,
      problems: [
        'Host unreachable: connection timed out',
        'The read-only role can write: INSERT succeeded in the probe transaction',
      ],
    });
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Connection test failed');
    expect(alert).toHaveTextContent('Host unreachable: connection timed out');
    const guardrail = screen
      .getByText(/The read-only role can write/)
      .closest('li');
    expect(guardrail).toHaveClass('connect-result__problem--critical');
    expect(guardrail).toHaveTextContent('Guardrail:');
    expect(syncSchema).not.toHaveBeenCalled();

    // The datasource was created with the submitted values (secrets included,
    // sslMode defaulting to REQUIRE, method always explicit) and the retry
    // path reuses it.
    expect(createDatasource).toHaveBeenCalledExactlyOnceWith('ws-1', 'p-1', {
      method: 'DIRECT',
      name: 'Production',
      host: 'db.example.com',
      port: 5432,
      database: 'app',
      sslMode: 'REQUIRE',
      readOnly: { username: 'rowhouse_ro', password: 'ro-secret' },
      readWrite: { username: 'rowhouse_rw', password: 'rw-secret' },
    });
    expect(
      screen.getByRole('button', { name: 'Retry connection test' }),
    ).toBeInTheDocument();
  });

  it('re-runs only the test on retry, then syncs and opens the schema browser on success', async () => {
    createDatasource.mockResolvedValue(CREATED_DATASOURCE);
    testConnection.mockResolvedValueOnce({
      ok: false,
      problems: ['Invalid password for the read-only role'],
    });
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));
    await screen.findByRole('alert');

    testConnection.mockResolvedValueOnce({ ok: true, problems: [] });
    syncSchema.mockResolvedValue({
      tablesCreated: 3,
      tablesRemoved: 0,
      tablesKept: 0,
    });
    await user.click(
      screen.getByRole('button', { name: 'Retry connection test' }),
    );

    expect(await screen.findByText('schema browser')).toBeInTheDocument();
    expect(createDatasource).toHaveBeenCalledTimes(1);
    expect(testConnection).toHaveBeenCalledTimes(2);
    // Nothing changed between the attempts, so no PATCH was issued.
    expect(updateDatasource).not.toHaveBeenCalled();
    expect(syncSchema).toHaveBeenCalledExactlyOnceWith('ws-1', 'p-1', 'ds-1');
  });

  it('keeps every field editable after a failed test, with blanked password fields hinting the stored secret is kept', async () => {
    createDatasource.mockResolvedValue(CREATED_DATASOURCE);
    testConnection.mockResolvedValue({
      ok: false,
      problems: ['Invalid password for the read-only role'],
    });
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));
    await screen.findByRole('alert');

    // A wrong password must not be a dead end: everything stays editable.
    for (const label of [
      'Name',
      'Host',
      'Port',
      'Database',
      'Read-only username',
      'Read-only password',
      'Read-write username',
      'Read-write password',
    ]) {
      expect(screen.getByLabelText(label)).toBeEnabled();
    }
    expect(screen.getByRole('combobox')).toBeEnabled();

    // Passwords are sealed server-side, never echoed back: the inputs are
    // blanked and hint that leaving them blank keeps the stored secret.
    const roPassword = screen.getByLabelText('Read-only password');
    const rwPassword = screen.getByLabelText('Read-write password');
    expect(roPassword).toHaveValue('');
    expect(rwPassword).toHaveValue('');
    expect(roPassword).toHaveAttribute(
      'placeholder',
      'Leave blank to keep the current password',
    );
    expect(rwPassword).toHaveAttribute(
      'placeholder',
      'Leave blank to keep the current password',
    );
  });

  it('PATCHes only the changed role on retry with a new password, then re-tests and syncs', async () => {
    createDatasource.mockResolvedValue(CREATED_DATASOURCE);
    testConnection.mockResolvedValueOnce({
      ok: false,
      problems: ['Invalid password for the read-only role'],
    });
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));
    await screen.findByRole('alert');

    testConnection.mockResolvedValueOnce({ ok: true, problems: [] });
    updateDatasource.mockResolvedValue(CREATED_DATASOURCE);
    syncSchema.mockResolvedValue({
      tablesCreated: 1,
      tablesRemoved: 0,
      tablesKept: 0,
    });
    await user.type(
      screen.getByLabelText('Read-only password'),
      'corrected-secret',
    );
    await user.click(
      screen.getByRole('button', { name: 'Retry connection test' }),
    );

    expect(await screen.findByText('schema browser')).toBeInTheDocument();
    // Only the read-only role went into the PATCH — the untouched fields and
    // the blank read-write password were omitted.
    expect(updateDatasource).toHaveBeenCalledExactlyOnceWith(
      'ws-1',
      'p-1',
      'ds-1',
      { readOnly: { username: 'rowhouse_ro', password: 'corrected-secret' } },
    );
    expect(createDatasource).toHaveBeenCalledTimes(1);
    expect(testConnection).toHaveBeenCalledTimes(2);
    expect(syncSchema).toHaveBeenCalledExactlyOnceWith('ws-1', 'p-1', 'ds-1');
  });

  it('omits blank password fields from the PATCH when other fields change', async () => {
    createDatasource.mockResolvedValue(CREATED_DATASOURCE);
    testConnection.mockResolvedValue({
      ok: false,
      problems: ['Host unreachable: connection timed out'],
    });
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));
    await screen.findByRole('alert');

    updateDatasource.mockResolvedValue(CREATED_DATASOURCE);
    const host = screen.getByLabelText('Host');
    await user.clear(host);
    await user.type(host, 'db2.example.com');
    await user.click(
      screen.getByRole('button', { name: 'Retry connection test' }),
    );

    await screen.findByRole('alert');
    // Blank passwords mean "keep the sealed ones": no role objects in the
    // PATCH, only the changed host.
    expect(updateDatasource).toHaveBeenCalledExactlyOnceWith(
      'ws-1',
      'p-1',
      'ds-1',
      { host: 'db2.example.com' },
    );
    expect(testConnection).toHaveBeenCalledTimes(2);
  });

  it('requires the password when the username changes on retry, and does not PATCH', async () => {
    createDatasource.mockResolvedValue(CREATED_DATASOURCE);
    testConnection.mockResolvedValue({
      ok: false,
      problems: ['Invalid password for the read-only role'],
    });
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));
    await screen.findByRole('alert');

    const roUsername = screen.getByLabelText('Read-only username');
    await user.clear(roUsername);
    await user.type(roUsername, 'rowhouse_ro2');
    await user.click(
      screen.getByRole('button', { name: 'Retry connection test' }),
    );

    // Re-sealing credentials needs the password too — blank cannot mean
    // "keep" once the username differs from the stored one.
    expect(
      await screen.findByText(
        'Read-only password is required when changing the username',
      ),
    ).toBeInTheDocument();
    expect(updateDatasource).not.toHaveBeenCalled();
    expect(testConnection).toHaveBeenCalledTimes(1);
  });

  it('switches between the Direct and Cloud SQL forms with the method picker', async () => {
    const user = userEvent.setup();
    renderPage();

    // Direct is the default: host/port form, no Cloud SQL fields.
    expect(
      screen.getByRole('radio', { name: /Direct connection/ }),
    ).toBeChecked();
    expect(screen.getByLabelText('Host')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Instance connection name'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Google Cloud SQL/ }));
    expect(
      screen.getByRole('radio', { name: /Google Cloud SQL/ }),
    ).toBeChecked();
    expect(screen.getByLabelText('Instance connection name')).toBeInTheDocument();
    expect(screen.getByLabelText('Service account key JSON')).toBeInTheDocument();
    expect(screen.queryByLabelText('Host')).not.toBeInTheDocument();
    // The IAM path stores no password at all — badge on the card, and the
    // role password inputs are simply not there.
    expect(screen.getByText('No stored password')).toBeInTheDocument();
    expect(screen.queryByLabelText('Read-only password')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: /Direct connection/ }));
    expect(screen.getByLabelText('Host')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Instance connection name'),
    ).not.toBeInTheDocument();
  });

  it('includes the pasted CA certificate in the Direct create payload', async () => {
    createDatasource.mockResolvedValue(CREATED_DATASOURCE);
    testConnection.mockResolvedValue({ ok: false, problems: ['nope'] });
    const user = userEvent.setup();
    renderPage();

    await fillValidForm(user);
    const pem =
      '-----BEGIN CERTIFICATE-----\nMIIBbase64\n-----END CERTIFICATE-----';
    await user.click(screen.getByLabelText('CA certificate (optional)'));
    await user.paste(pem);
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));

    await screen.findByRole('alert');
    expect(createDatasource).toHaveBeenCalledExactlyOnceWith('ws-1', 'p-1', {
      method: 'DIRECT',
      name: 'Production',
      host: 'db.example.com',
      port: 5432,
      database: 'app',
      sslMode: 'REQUIRE',
      caCert: pem,
      readOnly: { username: 'rowhouse_ro', password: 'ro-secret' },
      readWrite: { username: 'rowhouse_rw', password: 'rw-secret' },
    });
  });

  it('fills the Direct fields from a pasted connection URI, then creates the datasource from them', async () => {
    createDatasource.mockResolvedValue(CREATED_DATASOURCE);
    testConnection.mockResolvedValue({ ok: false, problems: ['nope'] });
    const user = userEvent.setup();
    renderPage();

    const uriInput = screen.getByLabelText('Connection URI');
    await user.click(uriInput);
    await user.paste(
      'postgres://momently:aea49d47e189ad7c@163.172.135.76:5222/momently?sslmode=disable',
    );

    // The paste itself is the trigger — no button, no Enter.
    expect(screen.getByLabelText('Host')).toHaveValue('163.172.135.76');
    expect(screen.getByLabelText('Port')).toHaveValue(5222);
    expect(screen.getByLabelText('Database')).toHaveValue('momently');
    // Credentials land on the read-only role only — never on the write path.
    expect(screen.getByLabelText('Read-only username')).toHaveValue('momently');
    expect(screen.getByLabelText('Read-only password')).toHaveValue(
      'aea49d47e189ad7c',
    );
    expect(screen.getByLabelText('Read-write username')).toHaveValue('');
    expect(screen.getByLabelText('Read-write password')).toHaveValue('');

    await user.type(screen.getByLabelText('Name'), 'Production');
    await user.type(
      screen.getByLabelText('Read-write username'),
      'rowhouse_rw',
    );
    await user.type(screen.getByLabelText('Read-write password'), 'rw-secret');
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));

    await screen.findByRole('alert');
    // The URI itself is never part of the payload: only the fields it filled,
    // with sslmode=disable carried over.
    expect(createDatasource).toHaveBeenCalledExactlyOnceWith('ws-1', 'p-1', {
      method: 'DIRECT',
      name: 'Production',
      host: '163.172.135.76',
      port: 5222,
      database: 'momently',
      sslMode: 'DISABLE',
      readOnly: { username: 'momently', password: 'aea49d47e189ad7c' },
      readWrite: { username: 'rowhouse_rw', password: 'rw-secret' },
    });
  });

  it('re-fills the fields when the pasted URI is edited', async () => {
    const user = userEvent.setup();
    renderPage();

    const uriInput = screen.getByLabelText('Connection URI');
    await user.click(uriInput);
    await user.paste('postgres://db.example.com:5432/app');
    expect(screen.getByLabelText('Host')).toHaveValue('db.example.com');

    // Editing the URI in place re-fills, same as the paste did.
    await user.type(uriInput, '2');
    expect(screen.getByLabelText('Database')).toHaveValue('app2');
  });

  it('fills nothing while the URI is unusable, leaving the fields as typed', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('Host'), 'db.example.com');
    const uriInput = screen.getByLabelText('Connection URI');
    await user.click(uriInput);
    await user.paste('mysql://root@db.example.com/other');

    // A value that does not parse is left alone: no field is overwritten and
    // the text stays in place so it can be fixed.
    expect(screen.getByLabelText('Host')).toHaveValue('db.example.com');
    expect(screen.getByLabelText('Database')).toHaveValue('');
    expect(uriInput).toHaveValue('mysql://root@db.example.com/other');
    expect(createDatasource).not.toHaveBeenCalled();
  });

  it('offers the connection URI shortcut on the Direct method only', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByLabelText('Connection URI')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Google Cloud SQL/ }));
    expect(screen.queryByLabelText('Connection URI')).not.toBeInTheDocument();
  });

  it('creates a Cloud SQL datasource with the discriminated payload — no password fields under IAM', async () => {
    createDatasource.mockResolvedValue(CREATED_DATASOURCE);
    testConnection.mockResolvedValue({ ok: false, problems: ['nope'] });
    const user = userEvent.setup();
    renderPage();

    await fillValidCloudSqlForm(user);
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));

    await screen.findByRole('alert');
    // IAM auth: the role objects carry no password property at all — the
    // API rejects passwords on this path (ephemeral tokens, nothing stored).
    expect(createDatasource).toHaveBeenCalledExactlyOnceWith('ws-1', 'p-1', {
      method: 'CLOUDSQL',
      name: 'Cloud prod',
      instanceConnectionName: 'my-project:europe-west1:prod-db',
      database: 'app',
      authType: 'IAM',
      saKeyJson: SA_KEY_JSON,
      readOnly: { username: 'rowhouse-ro@my-project.iam' },
      readWrite: { username: 'rowhouse-rw@my-project.iam' },
    });
  });

  it('sends role passwords on Cloud SQL create when Built-in auth is chosen', async () => {
    createDatasource.mockResolvedValue(CREATED_DATASOURCE);
    testConnection.mockResolvedValue({ ok: false, problems: ['nope'] });
    const user = userEvent.setup();
    renderPage();

    await fillValidCloudSqlForm(user);
    await user.click(screen.getByRole('radio', { name: 'Built-in password' }));
    await user.type(screen.getByLabelText('Read-only password'), 'ro-secret');
    await user.type(screen.getByLabelText('Read-write password'), 'rw-secret');
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));

    await screen.findByRole('alert');
    expect(createDatasource).toHaveBeenCalledExactlyOnceWith('ws-1', 'p-1', {
      method: 'CLOUDSQL',
      name: 'Cloud prod',
      instanceConnectionName: 'my-project:europe-west1:prod-db',
      database: 'app',
      authType: 'BUILT_IN',
      saKeyJson: SA_KEY_JSON,
      readOnly: {
        username: 'rowhouse-ro@my-project.iam',
        password: 'ro-secret',
      },
      readWrite: {
        username: 'rowhouse-rw@my-project.iam',
        password: 'rw-secret',
      },
    });
  });

  it('blanks the sealed service-account key after save, omits it from the PATCH when left blank, and locks the picker', async () => {
    createDatasource.mockResolvedValue(CREATED_DATASOURCE);
    testConnection.mockResolvedValue({ ok: false, problems: ['nope'] });
    const user = userEvent.setup();
    renderPage();

    await fillValidCloudSqlForm(user);
    await user.click(screen.getByRole('button', { name: 'Connect & test' }));
    await screen.findByRole('alert');

    // The key is write-only: after save the field is emptied, hints that the
    // stored key is sealed, and a blank retry keeps it.
    const saKey = screen.getByLabelText('Service account key JSON');
    expect(saKey).toHaveValue('');
    expect(saKey).toHaveAttribute('placeholder', 'Paste a new key to replace');
    expect(
      screen.getByText(/Service account key stored — sealed/),
    ).toBeInTheDocument();

    // The method cannot change once the datasource exists: dead radios plus
    // a quiet hint, the PATCH would reject it anyway.
    expect(screen.getByRole('radio', { name: /Direct connection/ })).toBeDisabled();
    expect(screen.getByRole('radio', { name: /Google Cloud SQL/ })).toBeDisabled();
    expect(
      screen.getByText(/The connection method is fixed after creation/),
    ).toBeInTheDocument();

    updateDatasource.mockResolvedValue(CREATED_DATASOURCE);
    const database = screen.getByLabelText('Database');
    await user.clear(database);
    await user.type(database, 'app2');
    await user.click(
      screen.getByRole('button', { name: 'Retry connection test' }),
    );

    await screen.findByRole('alert');
    // Only the changed database went out — no saKeyJson key at all (blank
    // means "keep the sealed one"), no role objects, no method.
    expect(updateDatasource).toHaveBeenCalledExactlyOnceWith(
      'ws-1',
      'p-1',
      'ds-1',
      { cloudSql: { database: 'app2' } },
    );
  });

  it('fetches the Cloud SQL onboarding script when the collapsed snippet opens', async () => {
    buildCloudSqlSnippet.mockResolvedValue({
      script: 'gcloud iam service-accounts create rowhouse-ro',
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('radio', { name: /Google Cloud SQL/ }));
    await user.type(
      screen.getByLabelText('Instance connection name'),
      'my-project:europe-west1:prod-db',
    );
    await user.type(screen.getByLabelText('Database'), 'app');

    // jsdom does not reliably toggle <details> on summary clicks: open it
    // directly and fire the toggle event the page listens for. (Setting
    // `open` makes jsdom queue its own toggle too, hence not "exactly once".)
    const details = screen
      .getByText(/Need to set up the service accounts/)
      .closest('details') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));

    await waitFor(() => expect(buildCloudSqlSnippet).toHaveBeenCalled());
    expect(buildCloudSqlSnippet).toHaveBeenCalledWith('ws-1', {
      instanceConnectionName: 'my-project:europe-west1:prod-db',
      database: 'app',
    });
    expect(
      await screen.findByText(
        'gcloud iam service-accounts create rowhouse-ro',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
  });
});
