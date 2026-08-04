import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Foundations/Colors',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

type Swatch = { token: string; note?: string };

const groups: {
  title: string;
  caption: string;
  swatches: Swatch[];
  dark?: boolean;
}[] = [
  {
    title: 'Ink',
    caption: 'Warm near-blacks. Text, rules and the primary action all come from here.',
    swatches: [
      { token: '--color-ink-900', note: 'body text, headlines' },
      { token: '--color-ink-800' },
      { token: '--color-ink-700', note: 'lede, panel body' },
      { token: '--color-ink-500', note: 'secondary text, labels' },
      { token: '--color-ink-300', note: 'muted / no-data text' },
      { token: '--color-ink-200' },
      { token: '--color-ink-100' },
    ],
  },
  {
    title: 'Paper',
    caption: 'Surfaces. The page is warm off-white; pure white is reserved for data panels.',
    swatches: [
      { token: '--color-paper', note: 'page background' },
      { token: '--color-paper-warm', note: 'masthead wash' },
      { token: '--color-paper-deep' },
      { token: '--color-surface', note: 'stat bar, rail, popovers' },
      { token: '--color-rule', note: 'hairlines' },
      { token: '--color-rule-strong' },
      { token: '--color-rule-soft' },
    ],
  },
  {
    title: 'Ember — accent',
    caption:
      'The single accent of the system. Reserved for the data, the live state and one action per view.',
    swatches: [
      { token: '--color-ember-50', note: 'selected cell background' },
      { token: '--color-ember-100' },
      { token: '--color-ember-200' },
      { token: '--color-ember-300' },
      { token: '--color-ember-400' },
      { token: '--color-ember-500', note: 'focus ring' },
      { token: '--color-ember-600', note: '--color-accent' },
      { token: '--color-ember-700', note: 'hover on accent' },
      { token: '--color-ember-800' },
    ],
  },
  {
    title: 'Sequential data scale',
    caption:
      'Choropleths and heatmaps. scale-0 is a measured near-zero; scale-empty means no measurement at all — never the same colour.',
    swatches: [
      { token: '--color-scale-0' },
      { token: '--color-scale-1' },
      { token: '--color-scale-2' },
      { token: '--color-scale-3' },
      { token: '--color-scale-4' },
      { token: '--color-scale-5' },
      { token: '--color-scale-empty', note: 'no data' },
    ],
  },
  {
    title: 'Categorical series',
    caption: 'Up to five compared dimensions. Earth tones, so no series outshouts the ember ramp.',
    swatches: [
      { token: '--color-series-1' },
      { token: '--color-series-2' },
      { token: '--color-series-3' },
      { token: '--color-series-4' },
      { token: '--color-series-5' },
    ],
  },
  {
    title: 'Status',
    caption: 'States of a record, not of the data. Muted on purpose.',
    swatches: [
      { token: '--color-success' },
      { token: '--color-warning' },
      { token: '--color-danger' },
      { token: '--color-info' },
    ],
  },
];

function SwatchCard({ token, note }: Swatch) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div
        style={{
          height: '4.5rem',
          backgroundColor: `var(${token})`,
          border: '1px solid var(--color-rule)',
          borderRadius: 'var(--radius-md)',
        }}
      />
      <code
        style={{
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-xs)',
        }}
      >
        {token}
      </code>
      {note && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
          }}
        >
          {note}
        </span>
      )}
    </div>
  );
}

export const Palette: Story = {
  render: () => (
    <div
      style={{
        padding: '2.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '3rem',
      }}
    >
      {groups.map((group) => (
        <section
          key={group.title}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <div>
            <h2 className="display-title display-title--sm">{group.title}</h2>
            <p
              style={{
                maxWidth: 'var(--measure-text)',
                marginTop: '0.5rem',
                color: 'var(--color-text-secondary)',
              }}
            >
              {group.caption}
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
              gap: '1rem',
            }}
          >
            {group.swatches.map((swatch) => (
              <SwatchCard key={swatch.token} {...swatch} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};
