import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DatasourcePageDto } from '@/api/datasources';
import { DatasourceListPage } from '../DatasourceListPage';

const { listDatasources } = vi.hoisted(() => ({
  listDatasources: vi.fn<() => Promise<DatasourcePageDto>>(),
}));

vi.mock('@/api/datasources', () => ({ listDatasources }));
vi.mock('@/hooks/useWorkspaceId', () => ({
  useWorkspaceId: () => ({ workspaceId: 'ws-1', isPending: false }),
}));

const PAGE: DatasourcePageDto = {
  items: [
    {
      id: 'ds-1',
      projectId: 'p-1',
      name: 'Production',
      type: 'POSTGRES',
      method: 'DIRECT',
      host: 'db.example.com',
      port: 5432,
      database: 'app',
      sslMode: 'REQUIRE',
      caCert: null,
      roles: [],
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    },
    {
      id: 'ds-2',
      projectId: 'p-1',
      name: 'Cloud prod',
      type: 'POSTGRES',
      method: 'CLOUDSQL',
      cloudSql: {
        instanceConnectionName: 'my-project:europe-west1:prod-db',
        database: 'app',
        authType: 'IAM',
      },
      roles: [],
      createdAt: '2026-08-02T10:00:00.000Z',
      updatedAt: '2026-08-02T10:00:00.000Z',
    },
  ],
  nextCursor: null,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/p-1/datasources']}>
        <Routes>
          <Route
            path="/projects/:projectId/datasources"
            element={<DatasourceListPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DatasourceListPage', () => {
  beforeEach(() => {
    listDatasources.mockReset();
    listDatasources.mockResolvedValue(PAGE);
  });

  it('shows each datasource with its connection-method badge and target', async () => {
    renderPage();

    // Direct: method badge, host target, TLS badge from sslMode.
    expect(await screen.findByText('Production')).toBeInTheDocument();
    expect(screen.getByText('Direct')).toBeInTheDocument();
    expect(screen.getByText('db.example.com:5432/app')).toBeInTheDocument();
    expect(screen.getByText('TLS')).toBeInTheDocument();

    // Cloud SQL + IAM: the badge calls the passwordless path out; the target
    // is the instance connection name, and no sslMode badge applies (the
    // connector is always mTLS).
    expect(screen.getByText('Cloud prod')).toBeInTheDocument();
    expect(screen.getByText('Cloud SQL · IAM')).toBeInTheDocument();
    expect(
      screen.getByText('my-project:europe-west1:prod-db/app'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No TLS')).not.toBeInTheDocument();
  });
});
