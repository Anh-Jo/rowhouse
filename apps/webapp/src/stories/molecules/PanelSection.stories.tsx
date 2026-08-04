import type { Meta, StoryObj } from '@storybook/react';
import { PanelSection } from '@/components/PanelSection/PanelSection';
import { RankedList } from '@/components/RankedList/RankedList';
import { Select } from '@/components/Select/Select';

const meta: Meta<typeof PanelSection> = {
  title: 'Molecules/PanelSection',
  component: PanelSection,
  parameters: {
    docs: {
      description: {
        component:
          'Titled block of the detail rail. Sections stack against hairlines instead of being boxed in cards — that is what keeps a dense sidebar readable.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PanelSection>;

export const Default: Story = {
  args: {
    title: 'Détail départemental',
    children: 'Sélectionnez un département sur la carte pour voir le détail.',
  },
};

export const RailStack: Story = {
  render: () => (
    <div style={{ maxWidth: '20rem' }}>
      <PanelSection title="Choisir un département" flush>
        <Select
          options={[
            { value: 'gironde', label: 'Gironde' },
            { value: 'var', label: 'Var' },
            { value: 'landes', label: 'Landes' },
          ]}
        />
      </PanelSection>
      <PanelSection title="Détail départemental">
        Sélectionnez un département sur la carte pour voir le détail.
      </PanelSection>
      <PanelSection title="Les plus touchés">
        <RankedList
          unit="ha"
          items={[
            { id: 'gironde', label: 'Gironde', value: 38275 },
            { id: 'pyrenees-atlantiques', label: 'Pyrénées-Atlantiques', value: 27925 },
            { id: 'var', label: 'Var', value: 6423 },
          ]}
        />
      </PanelSection>
    </div>
  ),
};
