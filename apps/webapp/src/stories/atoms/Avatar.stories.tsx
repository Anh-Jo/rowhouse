import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from '@/components/Avatar/Avatar';

const meta: Meta<typeof Avatar> = {
  title: 'Atoms/Avatar',
  component: Avatar,
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Small: Story = {
  args: { name: 'Thomas Jean', size: 'sm' },
};

export const Medium: Story = {
  args: { name: 'Thomas Jean', size: 'md' },
};

export const Large: Story = {
  args: { name: 'Thomas Jean', size: 'lg' },
};

export const SingleName: Story = {
  args: { name: 'Marie', size: 'md' },
};

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Avatar name="TJ" size="sm" />
      <Avatar name="Thomas Jean" size="md" />
      <Avatar name="Thomas Jean" size="lg" />
    </div>
  ),
};
