import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { TabFilter } from '@/components/TabFilter/TabFilter';

const meta: Meta<typeof TabFilter> = {
  title: 'Molecules/TabFilter',
  component: TabFilter,
};

export default meta;
type Story = StoryObj<typeof TabFilter>;

function InteractiveTabFilter() {
  const [value, setValue] = useState('all');
  return (
    <TabFilter
      tabs={[
        { value: 'all', label: 'All events', count: 128 },
        { value: 'reads', label: 'Reads', count: 97 },
        { value: 'writes', label: 'Writes', count: 4 },
        { value: 'errors', label: 'Errors', count: 2 },
      ]}
      value={value}
      onValueChange={setValue}
    />
  );
}

export const AuditFilters: Story = {
  render: () => <InteractiveTabFilter />,
};

export const WithoutCounts: Story = {
  render: () => (
    <TabFilter
      tabs={[
        { value: 'columns', label: 'Columns' },
        { value: 'relations', label: 'Relations' },
        { value: 'metadata', label: 'Metadata' },
      ]}
      value="columns"
      onValueChange={() => {}}
    />
  ),
};
