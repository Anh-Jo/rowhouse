import type { Meta, StoryObj } from '@storybook/react';
import { Select } from '@/components/Select/Select';

const SSL_OPTIONS = [
  { value: 'REQUIRE', label: 'Required (recommended)' },
  { value: 'DISABLE', label: 'Disabled — local databases only' },
];

const meta: Meta<typeof Select> = {
  title: 'Atoms/Select',
  component: Select,
  args: {
    label: 'TLS (SSL mode)',
    options: SSL_OPTIONS,
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {};

export const WithValue: Story = {
  args: { value: 'REQUIRE' },
};

export const WithError: Story = {
  args: { error: 'Choose an SSL mode' },
};

/* The selected value must keep the normal text color even when disabled —
   only a genuine placeholder may render muted (regression: fieldset-disabled
   TLS select looked like an empty placeholder). */
export const Disabled: Story = {
  args: { value: 'REQUIRE', disabled: true },
};
