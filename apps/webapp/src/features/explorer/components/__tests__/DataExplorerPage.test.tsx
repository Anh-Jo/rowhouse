import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DatasourceDto } from '@/api/datasources';
import type { RowPageDto } from '@/api/explorer';
import type { DatasourceSchemaDto, SchemaColumnDto } from '@/api/schema';
import { DataExplorerPage } from '../DataExplorerPage';

const { getDatasourceSchema, getDatasource, listTableRows } = vi.hoisted(() => ({
  getDatasourceSchema: vi.fn<() => Promise<DatasourceSchemaDto>>(),
  getDatasource: vi.fn<() => Promise<DatasourceDto>>(),
  listTableRows: vi.fn<(...args: unknown[]) => Promise<RowPageDto>>(),
}));

vi.mock('@/api/schema', () => ({ getDatasourceSchema }));
vi.mock('@/api/datasources', () => ({ getDatasource }));
vi.mock('@/api/explorer', () => ({ listTableRows }));
vi.mock('@/hooks/useWorkspaceId', () => ({
  useWorkspaceId: () => ({ workspaceId: 'ws-1', isPending: false }),
}));

function column(overrides: Partial<SchemaColumnDto> & Pick<SchemaColumnDto, 'id' | 'name' | 'position'>): SchemaColumnDto {
  return {
    dataType: 'text',
    isNullable: true,
    isPrimaryKey: false,
    refTable: null,
    refColumn: null,
    description: null,
    isPii: false,
    ...overrides,
  };
}

const SCHEMA: DatasourceSchemaDto = {
  syncedAt: '2026-08-04T10:00:00.000Z',
  tables: [
    {
      id: 't-orders',
      schema: 'public',
      name: 'orders',
      description: null,
      columns: [
        column({ id: 'c-id', name: 'id', position: 1, isPrimaryKey: true, dataType: 'integer', isNullable: false }),
        column({ id: 'c-paid', name: 'paid', position: 2, dataType: 'boolean' }),
        column({ id: 'c-email', name: 'email', position: 3, isPii: true }),
        column({ id: 'c-created', name: 'created_at', position: 4, dataType: 'timestamptz' }),
      ],
    },
    {
      id: 't-logs',
      schema: 'public',
      name: 'logs',
      description: null,
      columns: [column({ id: 'c-msg', name: 'message', position: 1 })],
    },
  ],
};

/**
 * `orders` with two foreign keys: one onto a table of the snapshot, one onto
 * a table absent from it. Kept out of the shared fixture — extra columns mean
 * extra NULL cells, which the value-rendering tests count.
 */
function withForeignKeys(schema: DatasourceSchemaDto): DatasourceSchemaDto {
  return {
    ...schema,
    tables: schema.tables.map((table) =>
      table.id === 't-orders'
        ? {
            ...table,
            columns: [
              ...table.columns,
              column({
                id: 'c-log',
                name: 'log_id',
                position: 5,
                dataType: 'integer',
                refTable: 'logs',
                refColumn: 'id',
              }),
              column({
                id: 'c-ghost',
                name: 'ghost_id',
                position: 6,
                dataType: 'integer',
                refTable: 'ghosts',
                refColumn: 'id',
              }),
            ],
          }
        : table,
    ),
  };
}

const ORDERS_PAGE_1: RowPageDto = {
  items: [
    {
      key: 'k1',
      values: {
        id: 1,
        paid: true,
        email: null,
        created_at: '2026-08-01T14:05:00.000Z',
      },
    },
  ],
  nextCursor: 'cursor-1',
};

const ORDERS_PAGE_2: RowPageDto = {
  items: [
    {
      key: 'k2',
      values: { id: 2, paid: false, email: 'a@b.c', created_at: null },
    },
  ],
  nextCursor: null,
};

function renderPage(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/projects/:projectId/datasources/:datasourceId/data"
            element={<DataExplorerPage />}
          />
          <Route
            path="/projects/:projectId/datasources/:datasourceId/data/tables/:tableId"
            element={<DataExplorerPage />}
          />
          <Route
            path="/projects/:projectId/datasources/:datasourceId/data/tables/:tableId/records/:rowKey"
            element={<div>record-screen</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const BASE = '/projects/p-1/datasources/ds-1/data';

describe('DataExplorerPage', () => {
  beforeEach(() => {
    getDatasourceSchema.mockReset();
    getDatasource.mockReset();
    listTableRows.mockReset();
    getDatasourceSchema.mockResolvedValue(SCHEMA);
    getDatasource.mockResolvedValue({ name: 'Production' } as DatasourceDto);
    listTableRows.mockResolvedValue(ORDERS_PAGE_1);
  });

  it('lists every table in the switcher, searchable', async () => {
    const user = userEvent.setup();
    renderPage(BASE);

    const rail = await screen.findByRole('complementary', { name: 'Tables' });
    expect(within(rail).getByText('orders')).toBeInTheDocument();
    expect(within(rail).getByText('logs')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Search tables'), 'ord');
    expect(within(rail).getByText('orders')).toBeInTheDocument();
    expect(within(rail).queryByText('logs')).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Search tables'));
    await user.type(screen.getByLabelText('Search tables'), 'zzz');
    expect(
      within(rail).getByText('No table matches this search'),
    ).toBeInTheDocument();
  });

  it('renders the selected table rows with smart values and header badges', async () => {
    renderPage(`${BASE}/tables/t-orders`);

    // Values: NULL token, boolean word, ISO date shortened with full title.
    expect(await screen.findByText('NULL')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    const date = screen.getByText('2026-08-01 14:05');
    expect(date).toHaveAttribute('title', '2026-08-01T14:05:00.000Z');

    // Header badges: PK on the primary key, PII on the flagged column.
    const idHeader = screen.getByRole('columnheader', { name: /^id/ });
    expect(within(idHeader).getByText('PK')).toBeInTheDocument();
    const emailHeader = screen.getByRole('columnheader', { name: /^email/ });
    expect(within(emailHeader).getByText('PII')).toBeInTheDocument();

    expect(listTableRows).toHaveBeenCalledWith('ws-1', 'p-1', 'ds-1', 't-orders', {
      cursor: undefined,
    });
  });

  it('shows a foreign key on the column header, linking to the referenced table', async () => {
    getDatasourceSchema.mockResolvedValue(withForeignKeys(SCHEMA));
    renderPage(`${BASE}/tables/t-orders`);

    const fkHeader = await screen.findByRole('columnheader', {
      name: /^log_id/,
    });
    const link = within(fkHeader).getByRole('link', {
      name: 'References logs.id',
    });
    expect(link).toHaveAttribute(
      'href',
      '/projects/p-1/datasources/ds-1/data/tables/t-logs',
    );

    // The relation is still surfaced when its target is not in the snapshot,
    // but there is nowhere to navigate to.
    const ghostHeader = screen.getByRole('columnheader', { name: /^ghost_id/ });
    expect(within(ghostHeader).getByText('ghosts')).toBeInTheDocument();
    expect(within(ghostHeader).queryByRole('link')).not.toBeInTheDocument();
  });

  it('loads the next page with the cursor and appends the rows', async () => {
    listTableRows
      .mockResolvedValueOnce(ORDERS_PAGE_1)
      .mockResolvedValueOnce(ORDERS_PAGE_2);
    const user = userEvent.setup();
    renderPage(`${BASE}/tables/t-orders`);

    await user.click(await screen.findByRole('button', { name: 'Load more' }));

    // Both pages stay in the grid.
    expect(await screen.findByText('a@b.c')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
    expect(screen.getByText('2 rows loaded')).toBeInTheDocument();

    expect(listTableRows).toHaveBeenLastCalledWith(
      'ws-1',
      'p-1',
      'ds-1',
      't-orders',
      { cursor: 'cursor-1' },
    );
    // Last page: no further cursor, the button goes away.
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument();
  });

  it('opens the record page when a keyed row is clicked', async () => {
    const user = userEvent.setup();
    renderPage(`${BASE}/tables/t-orders`);

    const row = (await screen.findByText('true')).closest('tr');
    expect(row).not.toBeNull();
    await user.click(row as HTMLElement);

    expect(await screen.findByText('record-screen')).toBeInTheDocument();
  });

  it('keeps rows of PK-less tables inert (no record to open)', async () => {
    listTableRows.mockResolvedValue({
      items: [{ key: null, values: { message: 'hello' } }],
      nextCursor: null,
    });
    const user = userEvent.setup();
    renderPage(`${BASE}/tables/t-logs`);

    const row = (await screen.findByText('hello')).closest('tr');
    expect(row).not.toBeNull();
    // Not presented as clickable, and clicking goes nowhere.
    expect(row).not.toHaveAttribute('role', 'button');
    await user.click(row as HTMLElement);
    expect(screen.queryByText('record-screen')).not.toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('shows the quiet first-page-only notice for tables without a PK', async () => {
    listTableRows.mockResolvedValue({
      items: [{ key: null, values: { message: 'hello' } }],
      nextCursor: null,
    });
    renderPage(`${BASE}/tables/t-logs`);

    expect(await screen.findByText('hello')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No primary key — first page only, and rows cannot be opened individually.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument();
  });
});
