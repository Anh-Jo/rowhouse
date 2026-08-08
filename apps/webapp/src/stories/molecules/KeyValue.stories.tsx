import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@/components/Badge/Badge';
import { KeyValue } from '@/components/KeyValue/KeyValue';

const meta: Meta<typeof KeyValue> = {
  title: 'Molecules/KeyValue',
  component: KeyValue,
};

export default meta;
type Story = StoryObj<typeof KeyValue>;

export const DatasourceDetails: Story = {
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <KeyValue
        items={[
          { label: 'Host', value: 'db.example.com' },
          { label: 'Port', value: '5432' },
          { label: 'Database', value: 'app_production' },
          { label: 'Read-only role', value: 'rowhouse_ro' },
          { label: 'Status', value: <Badge label="TLS" variant="success" />, mono: false },
          {
            label: 'Notes',
            value: 'Primary OLTP database, synced nightly.',
            mono: false,
          },
        ]}
      />
    </div>
  ),
};
