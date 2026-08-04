import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const SIZES = [
  { token: '--font-size-12', px: 12, use: 'Micro-labels, eyebrows, hints' },
  { token: '--font-size-13', px: 13, use: 'Data default (mono), secondary UI' },
  { token: '--font-size-14', px: 14, use: 'UI default' },
  { token: '--font-size-16', px: 16, use: 'Emphasized body, empty states' },
  { token: '--font-size-18', px: 18, use: 'Dialog titles, section headings' },
  { token: '--font-size-22', px: 22, use: 'Page titles' },
  { token: '--font-size-28', px: 28, use: 'Hero numbers, docs titles' },
];

const page: CSSProperties = {
  maxWidth: 880,
  margin: '0 auto',
  padding: 'var(--space-8) var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-8)',
};

const sectionTitle: CSSProperties = { marginBottom: 'var(--space-3)' };

function TypographyPage() {
  return (
    <div style={page}>
      <header>
        <span className="eyebrow">Foundations</span>
        <h1 style={{ fontSize: 'var(--font-size-28)', fontWeight: 700 }}>Typography</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
          Two voices: a humanist UI stack for chrome, a tabular mono stack for
          data. UI defaults to 14px, data to 13px mono.
        </p>
      </header>

      <section>
        <h3 className="eyebrow" style={sectionTitle}>
          The two voices
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <div style={{ fontSize: 'var(--font-size-16)' }}>
              Connect a database with two least-privilege roles.
            </div>
            <code style={{ color: 'var(--color-text-muted)' }}>
              --font-ui · humanist stack · UI chrome, labels, prose
            </code>
          </div>
          <div>
            <div className="font-data" style={{ fontSize: 'var(--font-size-16)' }}>
              SELECT id, email FROM customers LIMIT 50; — 1 024 rows, 38 ms
            </div>
            <code style={{ color: 'var(--color-text-muted)' }}>
              --font-mono · tabular-nums · cells, ids, SQL, schema names
            </code>
          </div>
        </div>
      </section>

      <section>
        <h3 className="eyebrow" style={sectionTitle}>
          Scale — 12 / 13 / 14 / 16 / 18 / 22 / 28
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {SIZES.map((size) => (
            <div
              key={size.token}
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr 220px',
                gap: 'var(--space-4)',
                alignItems: 'baseline',
                borderBottom: '1px solid var(--color-border-subtle)',
                paddingBottom: 'var(--space-2)',
              }}
            >
              <code>{size.token}</code>
              <span style={{ fontSize: `var(${size.token})` }}>
                Rows of data, safely housed
              </span>
              <span style={{ fontSize: 'var(--font-size-12)', color: 'var(--color-text-muted)' }}>
                {size.use}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="eyebrow" style={sectionTitle}>
          Weights & micro-labels
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <span style={{ fontWeight: 400 }}>Regular 400 — body (--font-weight-regular)</span>
          <span style={{ fontWeight: 500 }}>Medium 500 — labels, buttons (--font-weight-medium)</span>
          <span style={{ fontWeight: 600 }}>Semibold 600 — headings, emphasis (--font-weight-semibold)</span>
          <span style={{ fontWeight: 700 }}>Bold 700 — page titles (--font-weight-bold)</span>
          <span className="eyebrow" style={{ marginTop: 'var(--space-2)' }}>
            Uppercase eyebrow — sections, table headers
          </span>
        </div>
      </section>
    </div>
  );
}

const meta: Meta<typeof TypographyPage> = {
  title: 'Foundations/Typography',
  component: TypographyPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof TypographyPage>;

export const Typography: Story = {};
