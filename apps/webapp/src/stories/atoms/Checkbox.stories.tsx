import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Checkbox } from '@/components/Checkbox/Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: { label: 'Selectionner' },
};

export const Checked: Story = {
  args: { label: 'Selectionne', checked: true },
};

export const Disabled: Story = {
  args: { label: 'Desactive', disabled: true },
};

function InteractiveCheckbox() {
  const [checked, setChecked] = useState(false);
  return <Checkbox label="Accepter les conditions" checked={checked} onCheckedChange={setChecked} />;
}

export const Interactive: Story = {
  render: () => <InteractiveCheckbox />,
};
