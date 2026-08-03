import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/Button/Button';
import { Plus, Trash2 } from 'lucide-react';

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
  args: { variant: 'primary', children: 'Se connecter' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Annuler' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Voir les details' },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Retour' },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Supprimer' },
};

export const WithIcon: Story = {
  args: { variant: 'primary', children: 'Creer', icon: <Plus size={16} /> },
};

export const IconOnly: Story = {
  args: { variant: 'ghost', iconOnly: true, icon: <Trash2 size={16} />, 'aria-label': 'Supprimer' },
};

export const FAB: Story = {
  args: { variant: 'primary', fab: true, iconOnly: true, icon: <Plus size={24} />, 'aria-label': 'Nouveau lead' },
};

export const Disabled: Story = {
  args: { variant: 'primary', children: 'Disabled', disabled: true },
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
};
