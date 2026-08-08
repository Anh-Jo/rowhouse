import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { DataTable } from '@/components/DataTable/DataTable';
import type { Column } from '@/components/DataTable/DataTable';
import { StatusPill } from '@/components/StatusPill/StatusPill';

type ColumnRow = {
  id: string;
  name: string;
  dataType: string;
  nullable: boolean;
  pii: boolean;
  distinct: number;
};

const columnRows: ColumnRow[] = [
  { id: '1', name: 'id', dataType: 'uuid', nullable: false, pii: false, distinct: 182340 },
  { id: '2', name: 'email', dataType: 'text', nullable: false, pii: true, distinct: 182340 },
  { id: '3', name: 'full_name', dataType: 'text', nullable: true, pii: true, distinct: 179882 },
  { id: '4', name: 'plan', dataType: 'text', nullable: false, pii: false, distinct: 4 },
  { id: '5', name: 'mrr_cents', dataType: 'integer', nullable: false, pii: false, distinct: 1240 },
  { id: '6', name: 'created_at', dataType: 'timestamptz', nullable: false, pii: false, distinct: 182102 },
];

const columns: Column<ColumnRow>[] = [
  { key: 'name', header: 'Column', render: (r) => r.name, sortable: true },
  { key: 'dataType', header: 'Type', render: (r) => r.dataType, sortable: true },
  { key: 'nullable', header: 'Null', render: (r) => (r.nullable ? 'yes' : 'no') },
  {
    key: 'pii',
    header: 'PII',
    render: (r) => (r.pii ? <Badge label="PII" variant="pii" /> : null),
  },
  {
    key: 'distinct',
    header: 'Distinct',
    render: (r) => r.distinct.toLocaleString('en-US'),
    sortable: true,
    sortValue: (r) => r.distinct,
  },
];

const meta: Meta<typeof DataTable<ColumnRow>> = {
  title: 'Organisms/DataTable',
  component: DataTable,
};

export default meta;
type Story = StoryObj<typeof DataTable<ColumnRow>>;

export const SchemaColumns: Story = {
  render: () => (
    <DataTable
      columns={columns}
      data={columnRows}
      keyExtractor={(r) => r.id}
      onRowClick={(r) => console.info(`open ${r.name}`)}
      actions={(r) => (
        <Button variant="ghost" size="sm" onClick={() => console.info(`edit ${r.name}`)}>
          Edit
        </Button>
      )}
    />
  ),
};

type AuditRow = {
  id: string;
  action: string;
  role: string;
  status: 'OK' | 'ERROR';
  durationMs: number;
  at: string;
};

const auditRows: AuditRow[] = [
  { id: 'a1', action: 'READ', role: 'read-only', status: 'OK', durationMs: 38, at: '2026-08-04 09:12:44' },
  { id: 'a2', action: 'INTROSPECT', role: 'read-only', status: 'OK', durationMs: 412, at: '2026-08-04 09:02:10' },
  { id: 'a3', action: 'CONNECTION_TEST', role: 'read-write', status: 'ERROR', durationMs: 5003, at: '2026-08-04 08:58:01' },
];

export const AuditEvents: Story = {
  render: () => (
    <DataTable<AuditRow>
      columns={[
        { key: 'action', header: 'Action', render: (r) => r.action },
        { key: 'role', header: 'Role', render: (r) => <Badge label={r.role} variant={r.role === 'read-only' ? 'muted' : 'warning'} /> },
        { key: 'status', header: 'Status', render: (r) => <StatusPill status={r.status === 'OK' ? 'ok' : 'error'} label={r.status} /> },
        { key: 'durationMs', header: 'Duration', render: (r) => `${r.durationMs} ms`, sortable: true, sortValue: (r) => r.durationMs },
        { key: 'at', header: 'At', render: (r) => r.at, sortable: true },
      ]}
      data={auditRows}
      keyExtractor={(r) => r.id}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable columns={columns} data={[]} keyExtractor={(r) => r.id} emptyMessage="No columns match this filter" />
  ),
};

export const StickyHeader: Story = {
  render: () => (
    <div style={{ height: 240 }}>
      <DataTable
        columns={columns}
        data={[...columnRows, ...columnRows, ...columnRows].map((row, index) => ({
          ...row,
          id: `${row.id}-${index}`,
        }))}
        keyExtractor={(r) => r.id}
      />
    </div>
  ),
};
