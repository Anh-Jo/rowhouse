import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type {
  ConnectionTestResult,
  CreateDatasourceInput,
  DatasourceDto,
} from '@/api/datasources';
import type { SyncResultDto } from '@/api/schema';
import { ConnectDatasourcePage } from '../ConnectDatasourcePage';

const { createDatasource, testConnection, syncSchema } = vi.hoisted(() => ({
  createDatasource:
    vi.fn<
      (
        workspaceId: string,
        projectId: string,
        input: CreateDatasourceInput,
      ) => Promise<DatasourceDto>
    >(),
  testConnection: vi.fn<() => Promise<ConnectionTestResult>>(),
  syncSchema: vi.fn<() => Promise<SyncResultDto>>(),
}));

vi.mock('@/api/datasources', () => ({ createDatasource, testConnection }));
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

describe('ConnectDatasourcePage', () => {
  beforeEach(() => {
    createDatasource.mockReset();
    testConnection.mockReset();
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
    // sslMode defaulting to REQUIRE) and the retry path reuses it.
    expect(createDatasource).toHaveBeenCalledExactlyOnceWith('ws-1', 'p-1', {
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
    expect(syncSchema).toHaveBeenCalledExactlyOnceWith('ws-1', 'p-1', 'ds-1');
  });
});
