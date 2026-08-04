import type { Meta, StoryObj } from '@storybook/react';
import { StatusPill } from '@/components/StatusPill/StatusPill';

const meta: Meta<typeof StatusPill> = {
  title: 'Atoms/StatusPill',
  component: StatusPill,
  argTypes: {
    status: { control: 'select', options: ['ok', 'error', 'pending', 'neutral'] },
  },
};

export default meta;
type Story = StoryObj<typeof StatusPill>;

export const OK: Story = {
  args: { status: 'ok' },
};

export const AllStatuses: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <StatusPill status="ok" />
      <StatusPill status="error" />
      <StatusPill status="pending" label="AWAITING APPROVAL" />
      <StatusPill status="neutral" label="DRAFT" />
    </div>
  ),
};
