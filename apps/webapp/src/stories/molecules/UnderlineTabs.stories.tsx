import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { UnderlineTabs } from '@/components/UnderlineTabs/UnderlineTabs';

const meta: Meta<typeof UnderlineTabs> = {
  title: 'Molecules/UnderlineTabs',
  component: UnderlineTabs,
  parameters: {
    docs: {
      description: {
        component:
          'Reading-mode switcher of a data story. It sits on the hairline that opens the visualisation area, so the active marker reads as a printed section index.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof UnderlineTabs>;

function Interactive() {
  const [mode, setMode] = useState('carte');

  return (
    <div>
      <UnderlineTabs
        label="Mode de lecture"
        value={mode}
        onValueChange={setMode}
        tabs={[
          { value: 'carte', label: 'Carte' },
          { value: 'evolution', label: 'Évolution' },
          { value: 'donnees', label: 'Données' },
        ]}
      />
      <p style={{ padding: '1.5rem 0', color: 'var(--color-text-secondary)' }}>
        Vue active : <strong style={{ color: 'var(--color-text)' }}>{mode}</strong>
      </p>
    </div>
  );
}

export const Default: Story = {
  render: () => <Interactive />,
};

export const TwoTabs: Story = {
  args: {
    value: 'evolution',
    onValueChange: () => {},
    tabs: [
      { value: 'carte', label: 'Carte' },
      { value: 'evolution', label: 'Évolution' },
    ],
  },
};
