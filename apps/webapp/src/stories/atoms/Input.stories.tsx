import type { Meta, StoryObj } from '@storybook/react';
import { Search } from 'lucide-react';
import { Input } from '@/components/Input/Input';

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { label: 'Host', placeholder: 'db.example.com' },
};

export const WithHint: Story = {
  args: { label: 'Port', defaultValue: '5432', hint: 'PostgreSQL default is 5432' },
};

export const WithIcon: Story = {
  args: { placeholder: 'Search tables…', icon: <Search size={16} />, 'aria-label': 'Search' },
};

export const WithError: Story = {
  args: { label: 'Database', error: 'Database is required' },
};

export const Password: Story = {
  args: { label: 'Read-only password', type: 'password', defaultValue: 'secret' },
};

export const Disabled: Story = {
  args: { label: 'Host', defaultValue: 'db.example.com', disabled: true },
};
