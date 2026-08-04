import type { Meta, StoryObj } from '@storybook/react';
import { InfoTip } from '@/components/InfoTip/InfoTip';

const meta: Meta<typeof InfoTip> = {
  title: 'Atoms/InfoTip',
  component: InfoTip,
  parameters: {
    docs: {
      description: {
        component:
          'Methodology note attached to a metric label. Click the glyph to open — the trigger always carries an explicit accessible name.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof InfoTip>;

export const Default: Story = {
  args: {
    label: 'À propos : surface brûlée',
    children:
      'Surface estimée par télédétection (Sentinel-2). Les feux de moins de 30 hectares sont sous le seuil de détection et ne sont pas comptés.',
  },
};

export const NextToALabel: Story = {
  render: (args) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span className="ds-label">Surface brûlée</span>
      <InfoTip {...args} />
    </span>
  ),
  args: {
    label: 'À propos : surface brûlée',
    children: 'Cumul annuel, en hectares, sur la France métropolitaine.',
  },
};
