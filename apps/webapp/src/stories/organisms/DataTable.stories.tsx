import type { Meta, StoryObj } from '@storybook/react';
import { DataTable } from '@/components/DataTable/DataTable';
import type { Column } from '@/components/DataTable/DataTable';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';

type SampleRow = {
  id: string;
  name: string;
  role: string;
  status: string;
};

const sampleData: SampleRow[] = [
  { id: '1', name: 'Alice Martin', role: 'Developer', status: 'Active' },
  { id: '2', name: 'Bob Dupont', role: 'Designer', status: 'Pending' },
  { id: '3', name: 'Claire Moreau', role: 'Manager', status: 'Active' },
  { id: '4', name: 'David Bernard', role: 'Developer', status: 'Inactive' },
];

const columns: Column<SampleRow>[] = [
  { key: 'name', header: 'Name', render: (r) => r.name, sortable: true },
  { key: 'role', header: 'Role', render: (r) => r.role, sortable: true },
  { key: 'status', header: 'Status', render: (r) => <Badge label={r.status} variant={r.status === 'Active' ? 'success' : r.status === 'Inactive' ? 'danger' : 'warning'} /> },
];

const meta: Meta<typeof DataTable<SampleRow>> = {
  title: 'Organisms/DataTable',
  component: DataTable,
};

export default meta;
type Story = StoryObj<typeof DataTable<SampleRow>>;

export const Default: Story = {
  render: () => (
    <DataTable
      columns={columns}
      data={sampleData}
      keyExtractor={(r) => r.id}
      actions={(r) => (
        <Button variant="outline" size="sm" onClick={() => alert(`Action on ${r.name}`)}>
          View
        </Button>
      )}
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable columns={columns} data={[]} keyExtractor={(r) => r.id} emptyMessage="No data" />
  ),
};
