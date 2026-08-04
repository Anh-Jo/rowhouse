import type { Meta, StoryObj } from '@storybook/react';
import { Lede } from '@/components/Lede/Lede';

const meta: Meta<typeof Lede> = {
  title: 'Atoms/Lede',
  component: Lede,
  parameters: {
    docs: {
      description: {
        component:
          'Standfirst under a headline, capped at a 34rem measure. The optional highlight is the one figure the reader should leave with.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Lede>;

export const WithHighlight: Story = {
  args: {
    highlight: '21',
    children:
      'années d’incendies cartographiées pour comprendre où les feux se concentrent — et pourquoi certaines saisons laissent une trace hors norme.',
  },
};

export const Plain: Story = {
  args: {
    children:
      'Les surfaces brûlées sont estimées par télédétection : un feu inférieur à 30 hectares peut passer sous le seuil de détection.',
  },
};
