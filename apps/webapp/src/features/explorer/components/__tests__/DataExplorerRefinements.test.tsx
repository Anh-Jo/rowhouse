import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DatasourceDto } from '@/api/datasources';
import { ApiError } from '@/api/errors';
import type { RowPageDto } from '@/api/explorer';
import type { DatasourceSchemaDto, SchemaColumnDto } from '@/api/schema';
import { DataExplorerPage } from '../DataExplorerPage';

const { getDatasourceSchema, getDatasource, listTableRows } = vi.hoisted(
  () => ({
    getDatasourceSchema: vi.fn<() => Promise<DatasourceSchemaDto>>(),
    getDatasource: vi.fn<() => Promise<DatasourceDto>>(),
    listTableRows: vi.fn<(...args: unknown[]) => Promise<RowPageDto>>(),
  }),
);

vi.mock('@/api/schema', () => ({ getDatasourceSchema }));
vi.mock('@/api/datasources', () => ({ getDatasource }));
vi.mock('@/api/explorer', () => ({ listTableRows }));
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
    enumValues: [],
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
        column({
          id: 'c-id',
          name: 'id',
          position: 1,
          isPrimaryKey: true,
          dataType: 'integer',
          isNullable: false,
        }),
        column({ id: 'c-email', name: 'email', position: 2 }),
      ],
    },
  ],
};

const PAGE_1: RowPageDto = {
  items: [{ key: 'k1', values: { id: 1, email: 'a@gmail.com' } }],
  nextCursor: 'cursor-1',
};

const PAGE_2: RowPageDto = {
  items: [{ key: 'k2', values: { id: 2, email: 'b@proton.me' } }],
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
            path="/projects/:projectId/datasources/:datasourceId/data/tables/:tableId"
            element={<DataExplorerPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const TABLE_PATH = '/projects/p-1/datasources/ds-1/data/tables/t-orders';

/** The refinement args of every rows call that carried the given key. */
function refinedCalls(key: 'filters' | 'sort' | 'search') {
  return listTableRows.mock.calls.filter((call) => {
    const options = call[4] as Record<string, unknown> | undefined;
    return options?.[key] !== undefined;
  });
}

describe('DataExplorerPage — grid refinements (slice C)', () => {
  beforeEach(() => {
    getDatasourceSchema.mockReset();
    getDatasource.mockReset();
    listTableRows.mockReset();
    getDatasourceSchema.mockResolvedValue(SCHEMA);
    getDatasource.mockResolvedValue({ name: 'Production' } as DatasourceDto);
    listTableRows.mockImplementation((...args: unknown[]) => {
      const options = args[4] as { cursor?: string } | undefined;
      return Promise.resolve(options?.cursor === 'cursor-1' ? PAGE_2 : PAGE_1);
    });
  });

  it('cycles header sort none → asc → desc → none and resets pagination', async () => {
    const user = userEvent.setup();
    renderPage(TABLE_PATH);

    // Two pages loaded — the sort change must throw the cursor chain away.
    await user.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('2 rows loaded')).toBeInTheDocument();

    const sortButton = screen.getByRole('button', { name: 'id' });
    await user.click(sortButton);
    expect(await screen.findByText('1 row loaded')).toBeInTheDocument();
    expect(listTableRows).toHaveBeenLastCalledWith(
      'ws-1',
      'p-1',
      'ds-1',
      't-orders',
      {
        cursor: undefined,
        sort: 'id:asc',
      },
    );

    await user.click(screen.getByRole('button', { name: 'id' }));
    await waitFor(() => {
      expect(listTableRows).toHaveBeenLastCalledWith(
        'ws-1',
        'p-1',
        'ds-1',
        't-orders',
        {
          cursor: undefined,
          sort: 'id:desc',
        },
      );
    });

    // Third click: back to the natural order — no sort param at all.
    await user.click(screen.getByRole('button', { name: 'id' }));
    await waitFor(() => {
      const lastOptions = listTableRows.mock.lastCall?.[4] as {
        sort?: string;
      };
      expect(lastOptions.sort).toBeUndefined();
    });
  });

  it('applies a contains filter (JSON param), shows the chip, removes it on ✕', async () => {
    const user = userEvent.setup();
    renderPage(TABLE_PATH);
    await screen.findByText('a@gmail.com');

    await user.click(screen.getByRole('button', { name: 'Filter email' }));
    // Text column: 'contains' is the default operator — only the value needed.
    await user.type(await screen.findByLabelText('Value'), '@gmail');
    await user.click(screen.getByRole('button', { name: 'Apply' }));

    // The filter travels as the JSON string the backend parses.
    await waitFor(() => {
      expect(listTableRows).toHaveBeenLastCalledWith(
        'ws-1',
        'p-1',
        'ds-1',
        't-orders',
        {
          cursor: undefined,
          filters: JSON.stringify([
            { column: 'email', op: 'contains', value: '@gmail' },
          ]),
        },
      );
    });
    expect(screen.getByText('email contains "@gmail"')).toBeInTheDocument();

    // Removing the chip refetches without the filter.
    await user.click(
      screen.getByRole('button', {
        name: 'Remove filter email contains "@gmail"',
      }),
    );
    await waitFor(() => {
      const lastOptions = listTableRows.mock.lastCall?.[4] as {
        filters?: string;
      };
      expect(lastOptions.filters).toBeUndefined();
    });
    expect(
      screen.queryByText('email contains "@gmail"'),
    ).not.toBeInTheDocument();
  });

  it('debounces the search box into a single `search` request', async () => {
    const user = userEvent.setup();
    renderPage(TABLE_PATH);
    await screen.findByText('a@gmail.com');

    await user.type(screen.getByLabelText('Search rows'), 'gmail');
    // Nothing sent yet: the debounce pause has not elapsed.
    expect(refinedCalls('search')).toHaveLength(0);

    await waitFor(() => {
      expect(listTableRows).toHaveBeenLastCalledWith(
        'ws-1',
        'p-1',
        'ds-1',
        't-orders',
        {
          cursor: undefined,
          search: 'gmail',
        },
      );
    });
    // One request for five keystrokes.
    expect(refinedCalls('search')).toHaveLength(1);

    // ✕ clears immediately (no debounce on the way out).
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByLabelText('Search rows')).toHaveValue('');
    await waitFor(() => {
      const lastOptions = listTableRows.mock.lastCall?.[4] as {
        search?: string;
      };
      expect(lastOptions.search).toBeUndefined();
    });
  });

  it('applies refinements pre-set in the URL (shareable view)', async () => {
    const filters = JSON.stringify([
      { column: 'email', op: 'contains', value: '@gmail' },
    ]);
    renderPage(
      `${TABLE_PATH}?filters=${encodeURIComponent(filters)}&sort=id:desc&search=gmail`,
    );

    await waitFor(() => {
      expect(listTableRows).toHaveBeenCalledWith(
        'ws-1',
        'p-1',
        'ds-1',
        't-orders',
        {
          cursor: undefined,
          filters,
          sort: 'id:desc',
          search: 'gmail',
        },
      );
    });
    // The controls reflect the URL: chip rendered, search box prefilled.
    expect(
      await screen.findByText('email contains "@gmail"'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Search rows')).toHaveValue('gmail');
  });

  it('surfaces the server 400 message when a filter is rejected', async () => {
    listTableRows.mockRejectedValue(
      new ApiError('Unknown filter column "bogus"', 400),
    );
    const filters = JSON.stringify([{ column: 'bogus', op: 'eq', value: '1' }]);
    renderPage(`${TABLE_PATH}?filters=${encodeURIComponent(filters)}`);

    expect(
      await screen.findByText('Invalid filter or sort'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Unknown filter column "bogus"'),
    ).toBeInTheDocument();
    // The offending chip stays removable — the way out of the 400.
    expect(screen.getByText('bogus = "1"')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove filter bogus = "1"' }),
    ).toBeInTheDocument();
  });
});
