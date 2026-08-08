import type { Meta, StoryObj } from '@storybook/react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/Button/Button';

const meta: Meta<typeof Button> = {
  title: 'Atoms/Button',
  component: Button,
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'outline', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Connect & test' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Re-sync schema', icon: <RefreshCw size={16} /> },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'View details' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Cancel' },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Remove datasource' },
};

export const WithIcon: Story = {
  args: { variant: 'primary', children: 'Connect a database', icon: <Plus size={16} /> },
};

export const IconOnly: Story = {
  args: { variant: 'ghost', iconOnly: true, icon: <Trash2 size={16} />, 'aria-label': 'Delete' },
};

export const Disabled: Story = {
  args: { variant: 'primary', children: 'Testing connection…', disabled: true },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      {(['primary', 'secondary', 'outline', 'ghost', 'danger'] as const).map((variant) => (
        <div key={variant} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Button variant={variant} size="sm">
            Dense 28
          </Button>
          <Button variant={variant} size="md">
            Default 32
          </Button>
          <Button variant={variant} size="lg">
            Comfortable 36
          </Button>
          <Button variant={variant} disabled>
            Disabled
          </Button>
        </div>
      ))}
    </div>
  ),
};
