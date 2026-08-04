import type { Meta, StoryObj } from '@storybook/react';
import { ScaleLegend } from '@/components/ScaleLegend/ScaleLegend';

const meta: Meta<typeof ScaleLegend> = {
  title: 'Atoms/ScaleLegend',
  component: ScaleLegend,
  parameters: {
    docs: {
      description: {
        component:
          'Reading key of the sequential scale. It renders the same `--color-scale-*` tokens the map fills with, so legend and shapes cannot drift apart.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ScaleLegend>;

export const Default: Story = {
  args: { title: 'Surface brûlée', min: '0 ha', max: '≥ 30 000 ha' },
};

export const WithNoDataClass: Story = {
  args: {
    title: 'Surface brûlée',
    min: '0 ha',
    max: '≥ 30 000 ha',
    emptyLabel: 'Pas de données',
  },
};

export const FourClasses: Story = {
  args: { title: 'Nombre de feux', min: 'Rare', max: 'Fréquent', stops: 4 },
};
