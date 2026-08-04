import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RankedList } from '@/components/RankedList/RankedList';

const meta: Meta<typeof RankedList> = {
  title: 'Molecules/RankedList',
  component: RankedList,
  parameters: {
    docs: {
      description: {
        component:
          'Ordered leaderboard of a dimension. Two-digit rank markers and tabular values make the column read as a table without drawing one.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RankedList>;

const departments = [
  { id: 'gironde', label: 'Gironde', value: 38275 },
  { id: 'pyrenees-atlantiques', label: 'Pyrénées-Atlantiques', value: 27925 },
  { id: 'var', label: 'Var', value: 6423 },
  { id: 'pyrenees-orientales', label: 'Pyrénées-Orientales', value: 4630 },
  { id: 'landes', label: 'Landes', value: 4485 },
];

export const Default: Story = {
  args: { items: departments, unit: 'ha' },
};

function Selectable() {
  const [selected, setSelected] = useState('var');

  return <RankedList items={departments} unit="ha" selectedId={selected} onSelect={setSelected} />;
}

export const WithSelection: Story = {
  render: () => <Selectable />,
};

export const SecondPage: Story = {
  args: {
    items: [
      { id: 'aude', label: 'Aude', value: 3120 },
      { id: 'corse-du-sud', label: 'Corse-du-Sud', value: 2880 },
    ],
    unit: 'ha',
    startRank: 6,
  },
};

export const Empty: Story = {
  args: { items: [], emptyMessage: 'Aucun département touché cette année' },
};
