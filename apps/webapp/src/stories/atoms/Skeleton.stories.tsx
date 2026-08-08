import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from '@/components/Skeleton/Skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Atoms/Skeleton',
  component: Skeleton,
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Text: Story = {
  args: { variant: 'text', width: 240 },
};

export const LoadingList: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 480 }}>
      {[0, 1, 2].map((row) => (
        <div key={row} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <Skeleton variant="circle" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <Skeleton width="40%" />
            <Skeleton width="70%" />
          </div>
        </div>
      ))}
    </div>
  ),
};
