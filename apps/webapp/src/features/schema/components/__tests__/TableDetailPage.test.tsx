import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type {
  DatasourceSchemaDto,
  SchemaColumnDto,
  UpdateColumnMetadataInput,
} from '@/api/schema';
import { TableDetailPage } from '../TableDetailPage';

const { getDatasourceSchema, updateColumnMetadata, updateTableMetadata } =
  vi.hoisted(() => ({
    getDatasourceSchema: vi.fn<() => Promise<DatasourceSchemaDto>>(),
    updateColumnMetadata:
      vi.fn<
        (
          workspaceId: string,
          projectId: string,
          datasourceId: string,
          columnId: string,
          input: UpdateColumnMetadataInput,
        ) => Promise<SchemaColumnDto>
      >(),
    updateTableMetadata: vi.fn(),
  }));

vi.mock('@/api/schema', () => ({
  getDatasourceSchema,
  updateColumnMetadata,
  updateTableMetadata,
}));
vi.mock('@/hooks/useWorkspaceId', () => ({
  useWorkspaceId: () => ({ workspaceId: 'ws-1', isPending: false }),
}));

function buildSchema(emailIsPii: boolean): DatasourceSchemaDto {
  return {
    syncedAt: '2026-08-04T10:00:00.000Z',
    tables: [
      {
        id: 't-customers',
        schema: 'public',
        name: 'customers',
        description: null,
        columns: [
          {
            id: 'c-id',
            name: 'id',
            dataType: 'integer',
            isNullable: false,
            isPrimaryKey: true,
            refTable: null,
            refColumn: null,
            position: 1,
            description: null,
            isPii: false,
            enumValues: [],
          },
          {
            id: 'c-email',
            name: 'email',
            dataType: 'text',
            isNullable: true,
            isPrimaryKey: false,
            refTable: null,
            refColumn: null,
            position: 2,
            description: null,
            isPii: emailIsPii,
            enumValues: [],
          },
          {
            id: 'c-org',
            name: 'org_id',
            dataType: 'integer',
            isNullable: false,
            isPrimaryKey: false,
            refTable: 'organizations',
            refColumn: 'id',
            position: 3,
            description: null,
            isPii: false,
            enumValues: [],
          },
        ],
      },
      {
        id: 't-orgs',
        schema: 'public',
        name: 'organizations',
        description: null,
        columns: [
          {
            id: 'c-org-owner',
            name: 'owner_id',
            dataType: 'integer',
            isNullable: false,
            isPrimaryKey: false,
            refTable: 'customers',
            refColumn: 'id',
            position: 1,
            description: null,
            isPii: false,
            enumValues: [],
          },
        ],
      },
    ],
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[
          '/projects/p-1/datasources/ds-1/schema/tables/t-customers',
        ]}
      >
        <Routes>
          <Route
            path="/projects/:projectId/datasources/:datasourceId/schema/tables/:tableId"
            element={<TableDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TableDetailPage', () => {
  beforeEach(() => {
    getDatasourceSchema.mockReset();
    updateColumnMetadata.mockReset();
    updateTableMetadata.mockReset();
    getDatasourceSchema.mockResolvedValue(buildSchema(false));
  });

  it('renders columns with type, PK badge and an FK link to the referenced table', async () => {
    renderPage();

    expect(await screen.findByText('email')).toBeInTheDocument();
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('PK')).toBeInTheDocument();
    // `id` and `org_id` are both non-nullable integers; `email` is nullable.
    expect(screen.getAllByText('integer · not null')).toHaveLength(2);
    expect(screen.getByText('text')).toBeInTheDocument();

    const fkLink = screen.getByRole('link', { name: 'organizations' });
    expect(fkLink).toHaveAttribute(
      'href',
      '/projects/p-1/datasources/ds-1/schema/tables/t-orgs',
    );
  });

  it('lists the tables referencing this one, each linking to its detail', async () => {
    renderPage();

    const section = await screen.findByRole('region', {
      name: 'Referenced by',
    });
    const incoming = within(section).getByRole('link', {
      name: 'organizations.owner_id',
    });
    expect(incoming).toHaveAttribute(
      'href',
      '/projects/p-1/datasources/ds-1/schema/tables/t-orgs',
    );
    // Which column of this table the relation lands on.
    expect(within(section).getByText('→ id')).toBeInTheDocument();
  });

  it('toggles the PII flag through the API and shows the badge', async () => {
    // After the PATCH, the invalidated schema query refetches the flagged state.
    updateColumnMetadata.mockImplementation(async () => {
      getDatasourceSchema.mockResolvedValue(buildSchema(true));
      return { id: 'c-email', isPii: true } as SchemaColumnDto;
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('email')).toBeInTheDocument();
    expect(screen.queryByText('PII')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /email/ }));
    await user.click(
      screen.getByLabelText(
        'Personal data (PII) — masked for non-approved roles from P2',
      ),
    );

    expect(updateColumnMetadata).toHaveBeenCalledExactlyOnceWith(
      'ws-1',
      'p-1',
      'ds-1',
      'c-email',
      { isPii: true },
    );
    expect(await screen.findByText('PII')).toBeInTheDocument();
  });
});
