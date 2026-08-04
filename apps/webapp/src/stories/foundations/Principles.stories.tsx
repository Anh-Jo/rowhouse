import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const styles = {
  page: {
    maxWidth: 720,
    margin: '0 auto',
    padding: 'var(--space-8) var(--space-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-6)',
  },
  title: {
    fontSize: 'var(--font-size-28)',
    fontWeight: 700,
  },
  lead: {
    fontSize: 'var(--font-size-16)',
    color: 'var(--color-text-secondary)',
    lineHeight: 'var(--line-height-relaxed)',
  },
  h2: {
    fontSize: 'var(--font-size-18)',
    fontWeight: 600,
    marginBottom: 'var(--space-2)',
  },
  p: {
    fontSize: 'var(--font-size-14)',
    color: 'var(--color-text-secondary)',
    lineHeight: 'var(--line-height-relaxed)',
  },
} satisfies Record<string, CSSProperties>;

function PrinciplesPage() {
  return (
    <div style={styles.page}>
      <header>
        <span className="eyebrow">Foundations</span>
        <h1 style={styles.title}>Principles</h1>
      </header>
      <p style={styles.lead}>
        Rowhouse is a governed database workspace: rows of data, and the safety
        of a well-built house. The UI expresses guardrails, audit and PII
        masking calmly — <strong>sober, lean, fluid</strong>.
      </p>
      <section>
        <h2 style={styles.h2}>Data speaks mono</h2>
        <p style={styles.p}>
          Everything that is data — table cells, identifiers, SQL, schema
          names, durations — uses the tabular mono stack at 13px. UI chrome
          uses the humanist stack at 14px. The contrast between the two voices
          is the core of the personality; decoration is not.
        </p>
      </section>
      <section>
        <h2 style={styles.h2}>One accent, spent carefully</h2>
        <p style={styles.p}>
          Cool slate neutrals carry the whole interface. The deep ledger green
          appears only where it means something: primary actions, active
          states, focus. Semantic colors (success, warning, danger, info) are
          separate from the accent, and PII has its own warm amber-brown tint
          so sensitive data is recognizable at a glance.
        </p>
      </section>
      <section>
        <h2 style={styles.h2}>Borders over shadows</h2>
        <p style={styles.p}>
          Structure comes from 1px neutral borders and precise 4px-grid
          spacing. Shadows are reserved for real elevation — menus and dialogs
          — and stay subtle. Radius is 6px, 4px on small controls; only Badge
          may be a pill. No gradients, no glass, no oversized cards.
        </p>
      </section>
      <section>
        <h2 style={styles.h2}>Fluid, never bouncy</h2>
        <p style={styles.p}>
          Motion is 120–160ms ease-out on hover, focus and expansion. Reduced
          motion preferences are respected globally. Density defaults to 32px
          controls, 28px in tables — a data tool, comfortable on any device.
        </p>
      </section>
    </div>
  );
}

const meta: Meta<typeof PrinciplesPage> = {
  title: 'Foundations/Principles',
  component: PrinciplesPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof PrinciplesPage>;

export const Principles: Story = {};
