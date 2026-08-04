import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@/components/Badge/Badge';

const meta: Meta<typeof Badge> = {
  title: 'Atoms/Badge',
  component: Badge,
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'success', 'warning', 'danger', 'info', 'muted', 'pii'],
    },
    size: { control: 'select', options: ['sm', 'md'] },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = {
  args: { label: 'postgres', variant: 'default' },
};

export const PII: Story = {
  args: { label: 'PII', variant: 'pii' },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <Badge label="postgres" variant="default" />
      <Badge label="TLS" variant="success" />
      <Badge label="No TLS" variant="warning" />
      <Badge label="revoked" variant="danger" />
      <Badge label="PK" variant="info" />
      <Badge label="public" variant="muted" />
      <Badge label="PII" variant="pii" />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
      <Badge label="read-only" variant="muted" size="sm" />
      <Badge label="read-write" variant="warning" size="md" />
    </div>
  ),
};
