import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DatasourceDto } from '@/api/datasources';
import type { DatasourceSchemaDto, SyncResultDto } from '@/api/schema';
import { SchemaBrowserPage } from '../SchemaBrowserPage';

const { getDatasourceSchema, syncSchema, getDatasource } = vi.hoisted(() => ({
  getDatasourceSchema: vi.fn<() => Promise<DatasourceSchemaDto>>(),
  syncSchema: vi.fn<() => Promise<SyncResultDto>>(),
  getDatasource: vi.fn<() => Promise<DatasourceDto>>(),
}));

vi.mock('@/api/schema', () => ({ getDatasourceSchema, syncSchema }));
vi.mock('@/api/datasources', () => ({ getDatasource }));
vi.mock('@/hooks/useWorkspaceId', () => ({
  useWorkspaceId: () => ({ workspaceId: 'ws-1', isPending: false }),
}));

const SCHEMA: DatasourceSchemaDto = {
  syncedAt: '2026-08-04T10:00:00.000Z',
  tables: [
    {
      id: 't-customers',
      schema: 'public',
      name: 'customers',
      description: 'One row per customer',
      columns: [],
    },
    {
      id: 't-orders',
      schema: 'public',
      name: 'orders',
      description: null,
      columns: [],
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/p-1/datasources/ds-1/schema']}>
        <Routes>
          <Route
            path="/projects/:projectId/datasources/:datasourceId/schema"
            element={<SchemaBrowserPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SchemaBrowserPage', () => {
  beforeEach(() => {
    getDatasourceSchema.mockReset();
    syncSchema.mockReset();
    getDatasource.mockReset();
    getDatasourceSchema.mockResolvedValue(SCHEMA);
    getDatasource.mockResolvedValue({ name: 'Production' } as DatasourceDto);
  });

  it('renders the searchable table list', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('customers')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText('One row per customer')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search tables'), 'cust');
    expect(screen.getByText('customers')).toBeInTheDocument();
    expect(screen.queryByText('orders')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search tables'));
    await user.type(screen.getByLabelText('Search tables'), 'zzz');
    expect(
      screen.getByText('No table matches this search'),
    ).toBeInTheDocument();
  });

  it('re-syncs and reports the diff', async () => {
    syncSchema.mockResolvedValue({
      tablesCreated: 2,
      tablesRemoved: 1,
      tablesKept: 12,
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Re-sync' }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(
      'Schema synced — 2 new, 1 removed, 12 kept.',
    );
    expect(syncSchema).toHaveBeenCalledExactlyOnceWith('ws-1', 'p-1', 'ds-1');
    // The diff banner comes with a refreshed snapshot, not a stale one.
    expect(getDatasourceSchema.mock.calls.length).toBeGreaterThan(1);
  });
});
