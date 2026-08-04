import type { Meta, StoryObj } from '@storybook/react';
import { SourceNote } from '@/components/SourceNote/SourceNote';

const meta: Meta<typeof SourceNote> = {
  title: 'Atoms/SourceNote',
  component: SourceNote,
  parameters: {
    docs: {
      description: {
        component:
          'Provenance line under a figure block. The ember dot means the dataset is still moving; grey means it is closed.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SourceNote>;

export const Live: Story = {
  args: {
    children: 'EFFIS · données provisoires · données arrêtées au 1 août 2026',
    status: 'live',
  },
};

export const Final: Story = {
  args: { children: 'BDIFF · données consolidées · millésime 2025', status: 'final' },
};

export const WithoutDot: Story = {
  args: { children: 'Lecture : une ligne par département et par année.', status: 'none' },
};
