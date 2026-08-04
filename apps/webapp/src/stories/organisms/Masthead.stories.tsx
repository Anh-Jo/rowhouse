import type { Meta, StoryObj } from '@storybook/react';
import { Masthead } from '@/components/Masthead/Masthead';

const meta: Meta<typeof Masthead> = {
  title: 'Organisms/Masthead',
  component: Masthead,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Opening block of a data story: kicker, headline, standfirst. The warm wash behind it is what separates the narrative from the figures underneath — it is the only gradient in the system.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Masthead>;

export const Default: Story = {
  args: {
    eyebrow: ['Feux de forêt', 'France métropolitaine', '2006—2026'],
    title: 'Quand la France',
    accent: 'prend feu',
    ledeHighlight: '21',
    lede: 'années d’incendies cartographiées pour comprendre où les feux se concentrent — et pourquoi certaines saisons laissent une trace hors norme.',
    footer: (
      <a className="ds-link" href="#sources">
        Sources ↓
      </a>
    ),
  },
};

export const WithoutLede: Story = {
  args: {
    eyebrow: ['Méthodologie'],
    title: 'Comment nous avons',
    accent: 'compté',
  },
};
