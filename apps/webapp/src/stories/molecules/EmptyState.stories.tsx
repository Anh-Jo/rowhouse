import type { Meta, StoryObj } from '@storybook/react';
import { Database } from 'lucide-react';
import { Button } from '@/components/Button/Button';
import { EmptyState } from '@/components/EmptyState/EmptyState';

const meta: Meta<typeof EmptyState> = {
  title: 'Molecules/EmptyState',
  component: EmptyState,
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const NoDatasource: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
      <EmptyState
        icon={<Database size={48} />}
        message="No database connected yet"
        description="Connect a PostgreSQL database with two least-privilege roles to start browsing its schema."
      />
      <Button size="lg">Connect a database</Button>
    </div>
  ),
};
