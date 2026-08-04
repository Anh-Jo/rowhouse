import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const SPACES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];

const page: CSSProperties = {
  maxWidth: 880,
  margin: '0 auto',
  padding: 'var(--space-8) var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-8)',
};

const sectionTitle: CSSProperties = { marginBottom: 'var(--space-3)' };

function SpacingRadiusPage() {
  return (
    <div style={page}>
      <header>
        <span className="eyebrow">Foundations</span>
        <h1 style={{ fontSize: 'var(--font-size-28)', fontWeight: 700 }}>Spacing & Radius</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
          Everything sits on a 4px grid. Radius is 6px standard, 4px on small
          controls — pills are reserved for Badge. Borders (1px, neutral) do
          the structural work; shadows only mark real elevation.
        </p>
      </header>

      <section>
        <h3 className="eyebrow" style={sectionTitle}>
          Spacing — 4px grid
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {SPACES.map((step) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
              <code style={{ width: 100 }}>{`--space-${step}`}</code>
              <span
                style={{
                  display: 'inline-block',
                  width: `var(--space-${step})`,
                  height: 16,
                  background: 'var(--color-accent-subtle)',
                  border: '1px solid var(--color-accent-border)',
                  borderRadius: 2,
                }}
              />
              <code style={{ color: 'var(--color-text-muted)' }}>{step * 4}px</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="eyebrow" style={sectionTitle}>
          Radius & control heights
        </h3>
        <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {(
            [
              ['--radius-sm', '4px — small controls'],
              ['--radius-md', '6px — standard'],
              ['--radius-full', 'pill — Badge only'],
            ] as const
          ).map(([token, label]) => (
            <div key={token} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 96,
                  height: 56,
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: `var(${token})`,
                  background: 'var(--color-surface)',
                  marginBottom: 'var(--space-2)',
                }}
              />
              <code style={{ display: 'block' }}>{token}</code>
              <span style={{ fontSize: 'var(--font-size-12)', color: 'var(--color-text-muted)' }}>{label}</span>
            </div>
          ))}
          {(
            [
              ['--control-height-sm', '28 dense'],
              ['--control-height-md', '32 default'],
              ['--control-height-lg', '36 comfortable'],
            ] as const
          ).map(([token, label]) => (
            <div key={token} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 120,
                  height: `var(${token})`,
                  border: '1px solid var(--color-accent-border)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-accent-subtle)',
                  marginBottom: 'var(--space-2)',
                }}
              />
              <code style={{ display: 'block' }}>{token}</code>
              <span style={{ fontSize: 'var(--font-size-12)', color: 'var(--color-text-muted)' }}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="eyebrow" style={sectionTitle}>
          Elevation — borders first
        </h3>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <div
            style={{
              width: 200,
              padding: 'var(--space-4)',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <strong style={{ fontSize: 'var(--font-size-13)' }}>Flat surface</strong>
            <p style={{ fontSize: 'var(--font-size-12)', color: 'var(--color-text-muted)' }}>
              Cards, lists, panels: border only.
            </p>
          </div>
          <div
            style={{
              width: 200,
              padding: 'var(--space-4)',
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-raised)',
            }}
          >
            <strong style={{ fontSize: 'var(--font-size-13)' }}>Raised</strong>
            <p style={{ fontSize: 'var(--font-size-12)', color: 'var(--color-text-muted)' }}>
              Menus, popovers: --shadow-raised.
            </p>
          </div>
          <div
            style={{
              width: 200,
              padding: 'var(--space-4)',
              background: 'var(--color-surface-raised)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-overlay)',
            }}
          >
            <strong style={{ fontSize: 'var(--font-size-13)' }}>Overlay</strong>
            <p style={{ fontSize: 'var(--font-size-12)', color: 'var(--color-text-muted)' }}>
              Dialogs: --shadow-overlay.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

const meta: Meta<typeof SpacingRadiusPage> = {
  title: 'Foundations/Spacing & Radius',
  component: SpacingRadiusPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof SpacingRadiusPage>;

export const SpacingRadius: Story = {};
