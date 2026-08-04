import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DisplayTitle } from '@/components/DisplayTitle/DisplayTitle';
import { Eyebrow } from '@/components/Eyebrow/Eyebrow';
import { Lede } from '@/components/Lede/Lede';

const meta: Meta = {
  title: 'Foundations/Typography',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

function Row({ token, children }: { token: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr)',
        gap: '0.5rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--color-rule-soft)',
      }}
    >
      <code
        style={{
          fontFamily: 'var(--font-family-mono)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-secondary)',
        }}
      >
        {token}
      </code>
      {children}
    </div>
  );
}

export const Scale: Story = {
  render: () => (
    <div
      style={{
        padding: '2.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        maxWidth: '64rem',
      }}
    >
      <Row token="--font-size-display-lg · weight 800 · tracking -0.035em">
        <DisplayTitle accent="prend feu">Quand la France</DisplayTitle>
      </Row>
      <Row token="--font-size-display-md">
        <DisplayTitle as="h2" size="md" accent="hors norme">
          Une saison
        </DisplayTitle>
      </Row>
      <Row token="--font-size-display-sm">
        <DisplayTitle as="h3" size="sm">
          Détail départemental
        </DisplayTitle>
      </Row>
      <Row token="Eyebrow · --font-size-2xs · tracking 0.14em">
        <Eyebrow items={['Feux de forêt', 'France métropolitaine', '2006—2026']} />
      </Row>
      <Row token="Lede · --font-size-md · measure 34rem">
        <Lede highlight="21">
          années d’incendies cartographiées pour comprendre où les feux se concentrent — et pourquoi
          certaines saisons laissent une trace hors norme.
        </Lede>
      </Row>
      <Row token=".ds-label — every field and section title">
        <span className="ds-label">Surface brûlée</span>
      </Row>
      <Row token="--font-size-metric · .ds-numeric (tabular figures)">
        <span
          className="ds-numeric"
          style={{
            fontSize: 'var(--font-size-metric)',
            fontWeight: 'var(--font-weight-bold)',
            letterSpacing: 'var(--tracking-tight)',
          }}
        >
          102 931 ha
        </span>
      </Row>
      <Row token="--font-size-base — body copy">
        <p style={{ maxWidth: 'var(--measure-text)' }}>
          Le corps de texte reste petit et dense : dans un récit de données, la hiérarchie vient des
          titres et des chiffres, pas du corps.
        </p>
      </Row>
      <Row token="--font-family-mono">
        <code style={{ fontFamily: 'var(--font-family-mono)' }}>--color-scale-5: #8f3a20;</code>
      </Row>
    </div>
  ),
};
