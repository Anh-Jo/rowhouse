import type { Meta, StoryObj } from '@storybook/react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/Button/Button';
import { PageHeader } from '@/components/PageHeader/PageHeader';

const meta: Meta<typeof PageHeader> = {
  title: 'Molecules/PageHeader',
  component: PageHeader,
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {
    title: 'Audit log',
    subtitle: 'Every statement executed against your databases — append-only, no exceptions.',
  },
};

export const WithActions: Story = {
  args: {
    eyebrow: 'Production',
    title: 'Schema',
    subtitle: 'Last synced 2 minutes ago',
    actions: (
      <Button variant="secondary" icon={<RefreshCw size={16} />}>
        Re-sync
      </Button>
    ),
  },
};
