import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@/components/Badge/Badge';

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { label: 'Default', variant: 'default' },
};

export const Success: Story = {
  args: { label: 'Active', variant: 'success' },
};

export const Warning: Story = {
  args: { label: 'Pending', variant: 'warning' },
};

export const Danger: Story = {
  args: { label: 'Error', variant: 'danger' },
};

export const Info: Story = {
  args: { label: 'Info', variant: 'info' },
};

export const Muted: Story = {
  args: { label: 'Muted', variant: 'muted' },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <Badge label="Default" variant="default" />
      <Badge label="Success" variant="success" />
      <Badge label="Warning" variant="warning" />
      <Badge label="Danger" variant="danger" />
      <Badge label="Info" variant="info" />
      <Badge label="Muted" variant="muted" />
    </div>
  ),
};
