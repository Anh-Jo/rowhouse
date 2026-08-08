import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import type { RecordDetailDto } from '@/api/explorer';
import type { DatasourceSchemaDto, SchemaColumnDto } from '@/api/schema';
import { RecordDetailPage } from '../RecordDetailPage';

const { getDatasourceSchema, getTableRecord } = vi.hoisted(() => ({
  getDatasourceSchema: vi.fn<() => Promise<DatasourceSchemaDto>>(),
  getTableRecord: vi.fn<(...args: unknown[]) => Promise<RecordDetailDto>>(),
}));

vi.mock('@/api/schema', () => ({ getDatasourceSchema }));
vi.mock('@/api/explorer', () => ({ getTableRecord }));
vi.mock('@/hooks/useWorkspaceId', () => ({
  useWorkspaceId: () => ({ workspaceId: 'ws-1', isPending: false }),
}));

function column(
  overrides: Partial<SchemaColumnDto> &
    Pick<SchemaColumnDto, 'id' | 'name' | 'position'>,
): SchemaColumnDto {
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
        column({ id: 'c-o-id', name: 'id', position: 1, isPrimaryKey: true, dataType: 'integer', isNullable: false }),
        column({ id: 'c-o-customer', name: 'customer_id', position: 2, dataType: 'integer', refTable: 'customers', refColumn: 'id' }),
        column({ id: 'c-o-note', name: 'note', position: 3 }),
      ],
    },
    {
      id: 't-customers',
      schema: 'public',
      name: 'customers',
      description: null,
      columns: [
        column({ id: 'c-c-id', name: 'id', position: 1, isPrimaryKey: true, dataType: 'integer', isNullable: false }),
        column({ id: 'c-c-email', name: 'email', position: 2, isPii: true }),
      ],
    },
    {
      id: 't-items',
      schema: 'public',
      name: 'order_items',
      description: null,
      columns: [
        column({ id: 'c-i-id', name: 'id', position: 1, isPrimaryKey: true, dataType: 'integer', isNullable: false }),
        column({ id: 'c-i-order', name: 'order_id', position: 2, dataType: 'integer', refTable: 'orders', refColumn: 'id' }),
        column({ id: 'c-i-sku', name: 'sku', position: 3 }),
      ],
    },
  ],
};

const ORDER_RECORD: RecordDetailDto = {
  row: {
    key: 'k-order-7',
    values: { id: 7, customer_id: 42, note: null },
  },
  references: [
    {
      column: 'customer_id',
      tableId: 't-customers',
      tableName: 'customers',
      row: { key: 'k-cust-42', values: { id: 42, email: 'ada@example.test' } },
    },
  ],
  referencedBy: [
    {
      tableId: 't-items',
      tableName: 'order_items',
      viaColumn: 'order_id',
      count: 3,
      rows: [
        { key: 'k-item-1', values: { id: 1, order_id: 7, sku: 'SKU-A' } },
        { key: 'k-item-2', values: { id: 2, order_id: 7, sku: 'SKU-B' } },
      ],
    },
  ],
};

const CUSTOMER_RECORD: RecordDetailDto = {
  row: { key: 'k-cust-42', values: { id: 42, email: 'ada@example.test' } },
  references: [],
  referencedBy: [],
};

const ITEM_RECORD: RecordDetailDto = {
  row: { key: 'k-item-1', values: { id: 1, order_id: 7, sku: 'SKU-A' } },
  references: [
    {
      column: 'order_id',
      tableId: 't-orders',
      tableName: 'orders',
      row: { key: 'k-order-7', values: { id: 7, customer_id: 42, note: null } },
    },
  ],
  referencedBy: [],
};

/** Serves the record matching the requested table/key, like the API would. */
function serveRecords() {
  getTableRecord.mockImplementation((...args: unknown[]) => {
    const [, , , tableId, rowKey] = args;
    if (tableId === 't-orders' && rowKey === 'k-order-7') {
      return Promise.resolve(ORDER_RECORD);
    }
    if (tableId === 't-customers' && rowKey === 'k-cust-42') {
      return Promise.resolve(CUSTOMER_RECORD);
    }
    if (tableId === 't-items' && rowKey === 'k-item-1') {
      return Promise.resolve(ITEM_RECORD);
    }
    return Promise.reject(new ApiError('Record not found', 404));
  });
}

const BASE = '/projects/p-1/datasources/ds-1';

function renderPage(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/projects/:projectId/datasources/:datasourceId/data/tables/:tableId/records/:rowKey"
            element={<RecordDetailPage />}
          />
          <Route
            path="/projects/:projectId/datasources/:datasourceId/data/tables/:tableId"
            element={<div>grid-screen</div>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RecordDetailPage', () => {
  beforeEach(() => {
    getDatasourceSchema.mockReset();
    getTableRecord.mockReset();
    getDatasourceSchema.mockResolvedValue(SCHEMA);
    serveRecords();
  });

  it('renders the field list with badges, muted NULL and the resolved FK link', async () => {
    renderPage(`${BASE}/data/tables/t-orders/records/k-order-7`);

    // Header: table name + compact PK identity.
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'orders · id 7',
    );

    // Full field list: every column, values through the formatters.
    const idRow = screen.getByText('id', { selector: 'dt' }).closest('div');
    expect(idRow).not.toBeNull();
    expect(within(idRow as HTMLElement).getByText('PK')).toBeInTheDocument();
    expect(within(idRow as HTMLElement).getByText('7')).toBeInTheDocument();
    expect(screen.getByText('NULL')).toBeInTheDocument();

    // FK field doubles as a link to the referenced record, human identity.
    const refLink = screen.getByRole('link', {
      name: /customers.*ada@example\.test/,
    });
    expect(refLink).toHaveAttribute(
      'href',
      `${BASE}/data/tables/t-customers/records/k-cust-42`,
    );

    expect(getTableRecord).toHaveBeenCalledWith(
      'ws-1',
      'p-1',
      'ds-1',
      't-orders',
      'k-order-7',
    );
  });

  it('badges PII columns in the field list', async () => {
    renderPage(`${BASE}/data/tables/t-customers/records/k-cust-42`);

    const emailRow = (
      await screen.findByText('email', { selector: 'dt' })
    ).closest('div');
    expect(emailRow).not.toBeNull();
    expect(within(emailRow as HTMLElement).getByText('PII')).toBeInTheDocument();
    expect(
      within(emailRow as HTMLElement).getByText('ada@example.test'),
    ).toBeInTheDocument();
  });

  it('shows one linked-records panel per incoming relation, with count and rows', async () => {
    renderPage(`${BASE}/data/tables/t-orders/records/k-order-7`);

    const panel = (
      await screen.findByText(/via order_id/)
    ).closest('section');
    expect(panel).not.toBeNull();
    const scoped = within(panel as HTMLElement);
    expect(scoped.getByText('3')).toBeInTheDocument();
    expect(scoped.getByText('SKU-A')).toBeInTheDocument();
    expect(scoped.getByText('SKU-B')).toBeInTheDocument();
    expect(
      scoped.getByRole('link', { name: 'View all 3 in order_items' }),
    ).toHaveAttribute('href', `${BASE}/data/tables/t-items`);
  });

  it('navigates to the related record when its row is clicked, record to record', async () => {
    const user = userEvent.setup();
    renderPage(`${BASE}/data/tables/t-orders/records/k-order-7`);

    const itemRow = (await screen.findByText('SKU-A')).closest('tr');
    expect(itemRow).not.toBeNull();
    await user.click(itemRow as HTMLElement);

    // Now on the order_items record — its own header and back-reference.
    await screen.findByRole('link', { name: /orders/ });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'order_items · id 1',
    );
    expect(getTableRecord).toHaveBeenLastCalledWith(
      'ws-1',
      'p-1',
      'ds-1',
      't-items',
      'k-item-1',
    );

    // And from there, the FK link goes back to the order: depth works.
    await user.click(screen.getByRole('link', { name: /orders/ }));
    await screen.findByRole('link', { name: /customers/ });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'orders · id 7',
    );
  });

  it('shows the not-found empty state on a 404', async () => {
    getTableRecord.mockRejectedValue(new ApiError('Record not found', 404));
    renderPage(`${BASE}/data/tables/t-orders/records/k-gone`);

    expect(await screen.findByText('Record not found')).toBeInTheDocument();
    // The way back to the grid stays available.
    expect(screen.getByRole('link', { name: /orders/ })).toHaveAttribute(
      'href',
      `${BASE}/data/tables/t-orders`,
    );
  });

  it('shows a danger callout for the 400 no-primary-key case', async () => {
    getTableRecord.mockRejectedValue(
      new ApiError(
        'This table has no primary key — records cannot be addressed individually',
        400,
      ),
    );
    renderPage(`${BASE}/data/tables/t-orders/records/k-any`);

    expect(
      await screen.findByText('Could not load this record'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'This table has no primary key — records cannot be addressed individually',
      ),
    ).toBeInTheDocument();
  });
});
