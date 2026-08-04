import type { Meta, StoryObj } from '@storybook/react';
import { Eyebrow } from '@/components/Eyebrow/Eyebrow';

const meta: Meta<typeof Eyebrow> = {
  title: 'Atoms/Eyebrow',
  component: Eyebrow,
  parameters: {
    docs: {
      description: {
        component:
          'Kicker line above a headline. Segments read subject · scope · period and are separated by the component, never typed by hand.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Eyebrow>;

export const Default: Story = {
  args: { items: ['Feux de forêt', 'France métropolitaine', '2006—2026'] },
};

export const Accent: Story = {
  args: { items: ['Mise à jour', '1 août 2026'], tone: 'accent' },
};

export const SingleSegment: Story = {
  args: { items: ['Méthodologie'] },
};
