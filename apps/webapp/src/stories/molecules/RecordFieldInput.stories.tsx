import { type ComponentProps, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RecordFieldInput } from '@/components/RecordFieldInput/RecordFieldInput';

/**
 * The editor picks one of these per column from its DB type: a date picker for
 * a date, a dropdown for a boolean or enum, a textarea for JSON, a numeric or
 * plain text field otherwise. Fully controlled — `''` is the null value, and
 * the boolean/enum dropdowns show an explicit "null" choice when nullable.
 */
const meta: Meta<typeof RecordFieldInput> = {
  title: 'Molecules/RecordFieldInput',
  component: RecordFieldInput,
  // Overridden by the controlled render wrapper; here only to satisfy the type.
  args: { onChange: () => undefined },
  parameters: { layout: 'centered' },
  render: (args) => <Controlled {...args} />,
};

export default meta;
type Story = StoryObj<typeof RecordFieldInput>;

/** Holds the value so the controls are interactive inside Storybook. */
function Controlled(args: ComponentProps<typeof RecordFieldInput>) {
  const [value, setValue] = useState(args.value);
  return (
    <div style={{ width: 320 }}>
      <RecordFieldInput {...args} value={value} onChange={setValue} />
    </div>
  );
}

export const Text: Story = {
  args: { kind: 'text', label: 'name', hint: 'text', value: 'Ada Lovelace' },
};

export const Number: Story = {
  args: {
    kind: 'number',
    label: 'quantity',
    hint: 'integer',
    step: '1',
    value: '7',
  },
};

export const DateField: Story = {
  args: { kind: 'date', label: 'born_on', hint: 'date', value: '2026-01-02' },
};

export const DateTime: Story = {
  args: {
    kind: 'datetime',
    label: 'created_at',
    hint: 'timestamp',
    value: '2026-01-02T14:30',
  },
};

export const Boolean: Story = {
  args: { kind: 'boolean', label: 'is_active', hint: 'boolean', value: 'true' },
};

export const NullableBoolean: Story = {
  args: {
    kind: 'boolean',
    label: 'verified',
    hint: 'boolean · nullable',
    nullable: true,
    value: '',
  },
};

export const Enum: Story = {
  args: {
    kind: 'enum',
    label: 'status',
    hint: 'order_status enum',
    enumValues: ['pending', 'paid', 'shipped', 'cancelled'],
    value: 'paid',
  },
};

export const Json: Story = {
  args: {
    kind: 'json',
    label: 'metadata',
    hint: 'jsonb',
    value: '{\n  "source": "web"\n}',
  },
};
