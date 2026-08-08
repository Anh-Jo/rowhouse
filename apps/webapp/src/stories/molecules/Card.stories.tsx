import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Card } from '@/components/Card/Card';
import { KeyValue } from '@/components/KeyValue/KeyValue';

const meta: Meta<typeof Card> = {
  title: 'Molecules/Card',
  component: Card,
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Plain: Story = {
  render: () => (
    <Card>
      <p style={{ fontSize: 'var(--font-size-13)', color: 'var(--color-text-secondary)' }}>
        A plain bordered surface — no header, no shadow.
      </p>
    </Card>
  ),
};

export const WithHeader: Story = {
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <Card
        title="Production"
        description="Primary customer database"
        actions={<Button variant="secondary" size="sm">Open schema</Button>}
      >
        <KeyValue
          items={[
            { label: 'Host', value: 'db.example.com:5432/app' },
            { label: 'Engine', value: <Badge label="postgres" variant="muted" />, mono: false },
            { label: 'TLS', value: <Badge label="TLS" variant="success" />, mono: false },
          ]}
        />
      </Card>
    </div>
  ),
};
