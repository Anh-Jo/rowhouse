import type { Meta, StoryObj } from '@storybook/react';
import { Callout } from '@/components/Callout/Callout';

const meta: Meta<typeof Callout> = {
  title: 'Molecules/Callout',
  component: Callout,
  argTypes: {
    variant: { control: 'select', options: ['info', 'success', 'warning', 'danger', 'pii'] },
  },
};

export default meta;
type Story = StoryObj<typeof Callout>;

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Connection OK.',
    children: 'Both roles verified — the read-only role cannot write. Syncing the schema…',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    title: 'Connection test failed',
    children: 'Host unreachable: connection timed out.',
  },
};

export const PII: Story = {
  args: {
    variant: 'pii',
    title: 'Sensitive columns detected',
    children: 'customers.email and customers.phone are flagged as PII — values will be masked for non-approved roles.',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', maxWidth: 560 }}>
      <Callout variant="info">Schema sync runs with the read-only role.</Callout>
      <Callout variant="success" title="Schema synced">
        2 new tables, 0 removed, 14 kept.
      </Callout>
      <Callout variant="warning" title="No TLS">
        This datasource connects without TLS — fine locally, never in production.
      </Callout>
      <Callout variant="danger" title="Guardrail">
        The read-only role can write. Revoke its write grants, then retry the test.
      </Callout>
      <Callout variant="pii" title="Masked cell">
        This value is hidden by a PII rule. Request approval to reveal it.
      </Callout>
    </div>
  ),
};
