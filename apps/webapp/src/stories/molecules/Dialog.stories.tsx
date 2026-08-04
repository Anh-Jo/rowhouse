import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '@/components/Button/Button';
import { Callout } from '@/components/Callout/Callout';
import { Dialog } from '@/components/Dialog/Dialog';

const meta: Meta<typeof Dialog> = {
  title: 'Molecules/Dialog',
  component: Dialog,
};

export default meta;
type Story = StoryObj<typeof Dialog>;

export const ConfirmRemoval: Story = {
  render: () => (
    <Dialog
      title="Remove datasource?"
      description="Production — db.example.com:5432/app"
      trigger={<Button variant="danger">Remove datasource</Button>}
    >
      <Callout variant="warning" title="This cannot be undone">
        The schema snapshot and team metadata will be deleted. Audit history is
        append-only and stays.
      </Callout>
      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Remove</Button>
      </div>
    </Dialog>
  ),
};
