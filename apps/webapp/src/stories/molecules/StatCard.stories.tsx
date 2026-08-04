import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { StatCard } from '@/components/StatCard/StatCard';

const meta: Meta<typeof StatCard> = {
  title: 'Molecules/StatCard',
  component: StatCard,
  parameters: {
    docs: {
      description: {
        component:
          'One measured figure. Numbers are passed raw and formatted by the component, so every cell groups its thousands the same way. A missing measurement is a state, not an empty string.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Measured: Story = {
  args: { label: 'Surface brûlée', value: 102931, unit: 'ha' },
};

export const Selected: Story = {
  args: { label: 'Surface brûlée', value: 102931, unit: 'ha', active: true },
};

export const NoData: Story = {
  args: { label: 'Nombre de feux' },
};

export const WithMethodologyNote: Story = {
  args: {
    label: 'Habitants des surfaces brûlées',
    value: 14392,
    unit: 'personnes',
    hint: 'Population résidant dans les mailles de 1 km² recoupant une surface brûlée.',
  },
};

function MetricSwitcher() {
  const [selected, setSelected] = useState('surface');

  return (
    <div style={{ display: 'flex', gap: '1px', backgroundColor: 'var(--color-rule)' }}>
      <div style={{ flex: 1, backgroundColor: 'var(--color-surface)' }}>
        <StatCard
          label="Surface brûlée"
          value={102931}
          unit="ha"
          active={selected === 'surface'}
          onSelect={() => setSelected('surface')}
        />
      </div>
      <div style={{ flex: 1, backgroundColor: 'var(--color-surface)' }}>
        <StatCard
          label="Nombre de feux"
          active={selected === 'feux'}
          onSelect={() => setSelected('feux')}
        />
      </div>
      <div style={{ flex: 1, backgroundColor: 'var(--color-surface)' }}>
        <StatCard
          label="Habitants exposés"
          value={14392}
          unit="personnes"
          active={selected === 'habitants'}
          onSelect={() => setSelected('habitants')}
        />
      </div>
    </div>
  );
}

export const Selectable: Story = {
  render: () => <MetricSwitcher />,
};
