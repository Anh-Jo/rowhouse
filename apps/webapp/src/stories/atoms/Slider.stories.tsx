import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from '@/components/Slider/Slider';

const meta: Meta<typeof Slider> = {
  title: 'Atoms/Slider',
  component: Slider,
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: {
    label: 'Rows per page',
    min: 25,
    max: 500,
    step: 25,
    defaultValue: [100],
    formatValue: (value: number) => `${value} rows`,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Query timeout',
    min: 1,
    max: 60,
    defaultValue: [30],
    disabled: true,
    formatValue: (value: number) => `${value}s`,
  },
};
