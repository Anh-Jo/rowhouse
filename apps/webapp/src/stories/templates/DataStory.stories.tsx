import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Masthead } from '@/components/Masthead/Masthead';
import { PanelSection } from '@/components/PanelSection/PanelSection';
import { RankedList } from '@/components/RankedList/RankedList';
import { ScaleLegend } from '@/components/ScaleLegend/ScaleLegend';
import { Select } from '@/components/Select/Select';
import { SourceNote } from '@/components/SourceNote/SourceNote';
import { StatBar } from '@/components/StatBar/StatBar';
import { StatCard } from '@/components/StatCard/StatCard';
import { UnderlineTabs } from '@/components/UnderlineTabs/UnderlineTabs';
import { YearStepper } from '@/components/YearStepper/YearStepper';
import { DataStoryLayout } from '@/layouts/DataStoryLayout/DataStoryLayout';
import { formatNumber } from '@/helpers/format';

const meta: Meta<typeof DataStoryLayout> = {
  title: 'Templates/DataStory',
  component: DataStoryLayout,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The reference assembly of the system: masthead, key figures, reading-mode tabs, a choropleth and its detail rail. Every colour, rule and label here comes from a token or a component — nothing is styled locally.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof DataStoryLayout>;

/* ── Sample dataset ──
   Tile cartogram of the metropolitan regions: one square per region, laid out
   roughly geographically. A tile grid is honest about being a schematic — it
   never suggests a precision the sample data does not have. */
type Region = {
  id: string;
  label: string;
  column: number;
  row: number;
  burnt: number;
  inhabitants: number;
};

const REGIONS: Region[] = [
  { id: 'hdf', label: 'Hauts-de-France', column: 3, row: 1, burnt: 210, inhabitants: 40 },
  { id: 'nor', label: 'Normandie', column: 2, row: 1, burnt: 320, inhabitants: 55 },
  { id: 'ges', label: 'Grand Est', column: 4, row: 2, burnt: 1180, inhabitants: 210 },
  { id: 'idf', label: 'Île-de-France', column: 3, row: 2, burnt: 140, inhabitants: 96 },
  { id: 'pdl', label: 'Pays de la Loire', column: 2, row: 2, burnt: 2450, inhabitants: 380 },
  { id: 'bre', label: 'Bretagne', column: 1, row: 2, burnt: 1870, inhabitants: 260 },
  { id: 'bfc', label: 'Bourgogne-Franche-Comté', column: 4, row: 3, burnt: 640, inhabitants: 90 },
  { id: 'cvl', label: 'Centre-Val de Loire', column: 3, row: 3, burnt: 720, inhabitants: 110 },
  { id: 'naq', label: 'Nouvelle-Aquitaine', column: 2, row: 4, burnt: 71800, inhabitants: 9120 },
  { id: 'ara', label: 'Auvergne-Rhône-Alpes', column: 3, row: 4, burnt: 5240, inhabitants: 810 },
  { id: 'occ', label: 'Occitanie', column: 2, row: 5, burnt: 12460, inhabitants: 2140 },
  {
    id: 'pac',
    label: "Provence-Alpes-Côte d'Azur",
    column: 3,
    row: 5,
    burnt: 6890,
    inhabitants: 1290,
  },
  { id: 'cor', label: 'Corse', column: 4, row: 5, burnt: 1510, inhabitants: 130 },
];

/** Class breaks of the choropleth, in hectares. Six classes, six scale tokens. */
const BREAKS = [500, 2000, 6000, 15000, 40000];

function scaleToken(burnt: number): string {
  const classIndex = BREAKS.filter((limit) => burnt >= limit).length;
  return `var(--color-scale-${classIndex})`;
}

function TileMap({
  selectedId,
  onSelect,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gridTemplateRows: 'repeat(5, minmax(0, 1fr))',
        gap: '4px',
        maxWidth: '34rem',
        aspectRatio: '4 / 5',
      }}
    >
      {REGIONS.map((region) => {
        const selected = region.id === selectedId;
        return (
          <button
            key={region.id}
            type="button"
            onClick={() => onSelect(region.id)}
            aria-pressed={selected}
            title={`${region.label} — ${formatNumber(region.burnt)} ha`}
            style={{
              gridColumn: region.column,
              gridRow: region.row,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              gap: '0.25rem',
              padding: '0.5rem',
              backgroundColor: scaleToken(region.burnt),
              border: selected ? '2px solid var(--color-ink-900)' : '1px solid var(--color-paper)',
              color: region.burnt >= BREAKS[3] ? 'var(--color-paper)' : 'var(--color-ink-800)',
              cursor: 'pointer',
              textAlign: 'left',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-2xs)',
                fontWeight: 'var(--font-weight-semibold)',
                letterSpacing: '0.04em',
                lineHeight: 1.2,
              }}
            >
              {region.label}
            </span>
            <span
              className="ds-numeric"
              style={{ fontSize: 'var(--font-size-2xs)', opacity: 0.85 }}
            >
              {formatNumber(region.burnt)} ha
            </span>
          </button>
        );
      })}
    </div>
  );
}

function FireStory() {
  const [year, setYear] = useState(2026);
  const [mode, setMode] = useState('carte');
  const [metric, setMetric] = useState('surface');
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const provisional = year === 2026;
  const selected = REGIONS.find((region) => region.id === selectedId);

  const totals = useMemo(
    () => ({
      burnt: REGIONS.reduce((sum, region) => sum + region.burnt, 0),
      inhabitants: REGIONS.reduce((sum, region) => sum + region.inhabitants, 0),
    }),
    [],
  );

  const ranking = useMemo(
    () =>
      [...REGIONS]
        .sort((a, b) => b.burnt - a.burnt)
        .slice(0, 5)
        .map((region) => ({ id: region.id, label: region.label, value: region.burnt })),
    [],
  );

  return (
    <DataStoryLayout
      header={
        <>
          <Masthead
            eyebrow={['Feux de forêt', 'France métropolitaine', '2006—2026']}
            title="Quand la France"
            accent="prend feu"
            ledeHighlight="21"
            lede="années d’incendies cartographiées pour comprendre où les feux se concentrent — et pourquoi certaines saisons laissent une trace hors norme."
            footer={
              <a className="ds-link" href="#sources">
                Sources ↓
              </a>
            }
          />
          <StatBar label={`Chiffres clés ${year}`}>
            <YearStepper
              label="Année observée"
              value={year}
              min={2006}
              max={2026}
              onChange={setYear}
              caption={provisional ? 'EFFIS · provisoire' : 'BDIFF · consolidé'}
              captionTone={provisional ? 'accent' : 'muted'}
            />
            <StatCard
              label="Surface brûlée"
              value={totals.burnt}
              unit="ha"
              hint="Surface estimée par télédétection (Sentinel-2). Les feux de moins de 30 hectares passent sous le seuil de détection."
              active={metric === 'surface'}
              onSelect={() => setMetric('surface')}
            />
            <StatCard
              label="Nombre de feux"
              hint="Non publié pour une année provisoire : le décompte n’est consolidé qu’en fin de campagne."
              active={metric === 'feux'}
              onSelect={() => setMetric('feux')}
            />
            <StatCard
              label="Habitants des surfaces brûlées"
              value={totals.inhabitants}
              unit="personnes"
              hint="Population résidant dans les mailles de 1 km² recoupant une surface brûlée."
              active={metric === 'habitants'}
              onSelect={() => setMetric('habitants')}
            />
          </StatBar>
          <div style={{ padding: '0.75rem 1.5rem' }}>
            <SourceNote status={provisional ? 'live' : 'final'}>
              {provisional
                ? 'EFFIS · données provisoires · données arrêtées au 1 août 2026'
                : 'BDIFF · données consolidées'}
            </SourceNote>
          </div>
        </>
      }
      rail={
        <>
          <PanelSection title="Choisir une région" flush>
            <Select
              placeholder="Sélectionner…"
              value={selectedId}
              onValueChange={setSelectedId}
              options={REGIONS.map((region) => ({ value: region.id, label: region.label }))}
            />
          </PanelSection>
          <PanelSection title="Détail régional">
            {selected ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <strong style={{ fontSize: 'var(--font-size-md)' }}>{selected.label}</strong>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="ds-label">Surface brûlée</span>
                  <span className="ds-numeric">{formatNumber(selected.burnt)} ha</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="ds-label">Habitants exposés</span>
                  <span className="ds-numeric">{formatNumber(selected.inhabitants)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="ds-label">Part nationale</span>
                  <span className="ds-numeric">
                    {formatNumber(Math.round((selected.burnt / totals.burnt) * 1000) / 10)} %
                  </span>
                </div>
              </div>
            ) : (
              'Sélectionnez une région sur la carte pour voir le détail.'
            )}
          </PanelSection>
          <PanelSection title="Les plus touchés">
            <RankedList
              items={ranking}
              unit="ha"
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </PanelSection>
        </>
      }
      footer={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }} id="sources">
          <span className="ds-label">Sources</span>
          <SourceNote status="none">
            EFFIS (Copernicus) pour les surfaces brûlées · BDIFF pour le décompte des feux · INSEE
            (grille 1 km²) pour la population exposée. Données d’illustration.
          </SourceNote>
        </div>
      }
    >
      <UnderlineTabs
        label="Mode de lecture"
        value={mode}
        onValueChange={setMode}
        tabs={[
          { value: 'carte', label: 'Carte' },
          { value: 'evolution', label: 'Évolution' },
        ]}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          paddingTop: '1.5rem',
        }}
      >
        {mode === 'carte' ? (
          <>
            <TileMap selectedId={selectedId} onSelect={setSelectedId} />
            <ScaleLegend
              title="Surface brûlée"
              min="0 ha"
              max="≥ 40 000 ha"
              emptyLabel="Pas de données"
            />
          </>
        ) : (
          <p style={{ maxWidth: 'var(--measure-text)', color: 'var(--color-text-secondary)' }}>
            La vue « Évolution » accueille la série temporelle 2006—2026. Elle réutilise les mêmes
            tokens de couleur : la série principale en <code>--color-series-1</code>, les années de
            comparaison en <code>--color-ink-200</code>.
          </p>
        )}
      </div>
    </DataStoryLayout>
  );
}

export const Default: Story = {
  render: () => <FireStory />,
};
