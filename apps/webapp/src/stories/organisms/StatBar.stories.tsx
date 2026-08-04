import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SourceNote } from '@/components/SourceNote/SourceNote';
import { StatBar } from '@/components/StatBar/StatBar';
import { StatCard } from '@/components/StatCard/StatCard';
import { YearStepper } from '@/components/YearStepper/YearStepper';

const meta: Meta<typeof StatBar> = {
  title: 'Organisms/StatBar',
  component: StatBar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The band of key figures under a masthead. The bar owns the hairlines, so a period selector and any number of metrics keep one printed grid — and collapse to a single column on small screens.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatBar>;

const YEARS: Record<number, { surface: number; feux?: number; habitants: number }> = {
  2025: { surface: 21740, feux: 4218, habitants: 3106 },
  2026: { surface: 102931, habitants: 14392 },
};

function KeyFigures() {
  const [year, setYear] = useState(2026);
  const [metric, setMetric] = useState('surface');
  const data = YEARS[year] ?? YEARS[2026];
  const provisional = year === 2026;

  return (
    <div style={{ padding: '2rem 0' }}>
      <StatBar label={`Chiffres clés ${year}`}>
        <YearStepper
          label="Année observée"
          value={year}
          min={2025}
          max={2026}
          onChange={setYear}
          caption={provisional ? 'EFFIS · provisoire' : 'BDIFF · consolidé'}
          captionTone={provisional ? 'accent' : 'muted'}
        />
        <StatCard
          label="Surface brûlée"
          value={data.surface}
          unit="ha"
          hint="Surface estimée par télédétection (Sentinel-2). Les feux de moins de 30 hectares passent sous le seuil de détection."
          active={metric === 'surface'}
          onSelect={() => setMetric('surface')}
        />
        <StatCard
          label="Nombre de feux"
          value={data.feux}
          hint="Nombre d’événements recensés par les services départementaux d’incendie et de secours."
          active={metric === 'feux'}
          onSelect={() => setMetric('feux')}
        />
        <StatCard
          label="Habitants des surfaces brûlées"
          value={data.habitants}
          unit="personnes"
          hint="Population résidant dans les mailles de 1 km² recoupant une surface brûlée."
          active={metric === 'habitants'}
          onSelect={() => setMetric('habitants')}
        />
      </StatBar>
      <div style={{ padding: '0.75rem 1.25rem' }}>
        <SourceNote status={provisional ? 'live' : 'final'}>
          {provisional
            ? 'EFFIS · données provisoires · données arrêtées au 1 août 2026'
            : 'BDIFF · données consolidées · millésime 2025'}
        </SourceNote>
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => <KeyFigures />,
};

export const WithoutStepper: Story = {
  render: () => (
    <StatBar label="Chiffres clés">
      <StatCard label="Surface brûlée" value={102931} unit="ha" active />
      <StatCard label="Nombre de feux" />
      <StatCard label="Habitants des surfaces brûlées" value={14392} unit="personnes" />
    </StatBar>
  ),
};
