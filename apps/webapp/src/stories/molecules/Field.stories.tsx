import type { Meta, StoryObj } from '@storybook/react';
import { Field } from '@/components/Field/Field';
import { Input } from '@/components/Input/Input';

const meta: Meta<typeof Field> = {
  title: 'Molecules/Field',
  component: Field,
};

export default meta;
type Story = StoryObj<typeof Field>;

export const WithCustomControl: Story = {
  render: () => (
    <Field label="Connection string" hint="Only shown once — stored encrypted" htmlFor="conn">
      <input
        id="conn"
        className="input-field__input font-data"
        defaultValue="postgres://rowhouse_ro@db.example.com:5432/app"
      />
    </Field>
  ),
};

export const WithError: Story = {
  render: () => (
    <Field label="Table description" error="Description must be at most 500 characters" errorId="desc-error">
      <textarea className="textarea-field__input" aria-describedby="desc-error" aria-invalid />
    </Field>
  ),
};

export const LabelledInputs: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', maxWidth: 360 }}>
      <Input label="Name" placeholder="Production" />
      <Input label="Host" placeholder="db.example.com" hint="Reachable from Rowhouse workers" />
      <Input label="Port" error="Port must be between 1 and 65535" defaultValue="70000" />
    </div>
  ),
};
