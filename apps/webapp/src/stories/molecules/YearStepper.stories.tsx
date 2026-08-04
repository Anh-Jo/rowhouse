import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { YearStepper } from '@/components/YearStepper/YearStepper';

const meta: Meta<typeof YearStepper> = {
  title: 'Molecules/YearStepper',
  component: YearStepper,
  parameters: {
    docs: {
      description: {
        component:
          'Period selector. The arrows stop hard at the bounds of the dataset — a reader can never step into a year that was never measured.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof YearStepper>;

function Interactive({ initial = 2026 }: { initial?: number }) {
  const [year, setYear] = useState(initial);

  return (
    <YearStepper
      label="Année observée"
      value={year}
      min={2006}
      max={2026}
      onChange={setYear}
      caption={year === 2026 ? 'EFFIS · provisoire' : 'BDIFF · consolidé'}
      captionTone={year === 2026 ? 'accent' : 'muted'}
    />
  );
}

export const Default: Story = {
  render: () => <Interactive />,
};

export const AtLowerBound: Story = {
  render: () => <Interactive initial={2006} />,
};

export const WithoutCaption: Story = {
  args: { label: 'Année observée', value: 2015, min: 2006, max: 2026, onChange: () => {} },
};
