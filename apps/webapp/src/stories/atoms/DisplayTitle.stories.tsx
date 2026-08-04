import type { Meta, StoryObj } from '@storybook/react';
import { DisplayTitle } from '@/components/DisplayTitle/DisplayTitle';

const meta: Meta<typeof DisplayTitle> = {
  title: 'Atoms/DisplayTitle',
  component: DisplayTitle,
  parameters: {
    docs: {
      description: {
        component:
          'The headline voice: black weight, negative tracking, at most one accented fragment. The accent carries the point of the story — “prend feu”, not “La France”.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DisplayTitle>;

export const Hero: Story = {
  args: { children: 'Quand la France', accent: 'prend feu' },
};

export const WithoutAccent: Story = {
  args: { children: 'Vingt et un ans de feux de forêt' },
};

export const Section: Story = {
  args: { children: 'Évolution', accent: '2006—2026', size: 'md', as: 'h2' },
};

export const Small: Story = {
  args: { children: 'Détail départemental', size: 'sm', as: 'h3' },
};
