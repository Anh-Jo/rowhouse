import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TabFilter } from '@/components/TabFilter/TabFilter';

const meta: Meta<typeof TabFilter> = {
  title: 'Organisms/TabFilter',
  component: TabFilter,
};

export default meta;
type Story = StoryObj<typeof TabFilter>;

function DefaultTabFilter() {
  const [value, setValue] = useState('tous');
  return (
    <TabFilter
      tabs={[
        { value: 'tous', label: 'Tous' },
        { value: 'simulation', label: 'Simulation', count: 5 },
        { value: 'signature', label: 'Signature en cours', count: 3 },
        { value: 'signe', label: 'Signe', count: 12 },
        { value: 'refuse', label: 'Refuse', count: 2 },
      ]}
      value={value}
      onValueChange={setValue}
    />
  );
}

function StatusTabFilter() {
  const [value, setValue] = useState('en_attente');
  return (
    <TabFilter
      tabs={[
        { value: 'en_attente', label: 'En attente', count: 8 },
        { value: 'traitees', label: 'Traitees' },
      ]}
      value={value}
      onValueChange={setValue}
    />
  );
}

export const Default: Story = {
  render: () => <DefaultTabFilter />,
};

export const StatusTabs: Story = {
  render: () => <StatusTabFilter />,
};
