import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Slider } from '@/components/Slider/Slider';

const meta: Meta<typeof Slider> = {
  title: 'Atoms/Slider',
  component: Slider,
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: { label: 'Taux de commission', value: 50, min: 0, max: 100 },
};

function InteractiveSlider() {
  const [value, setValue] = useState(30);
  return <Slider label="Taux de commission" value={value} onValueChange={setValue} />;
}

export const Interactive: Story = {
  render: () => <InteractiveSlider />,
};
