import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const page: CSSProperties = {
  maxWidth: 880,
  margin: '0 auto',
  padding: 'var(--space-8) var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-8)',
};

function MotionPage() {
  return (
    <div style={page}>
      <header>
        <span className="eyebrow">Foundations</span>
        <h1 style={{ fontSize: 'var(--font-size-28)', fontWeight: 700 }}>Motion</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
          Two durations, one easing: 120ms for hover/focus feedback, 160ms for
          expansion and overlays, always <code>--ease-out</code>{' '}
          (cubic-bezier(0.2, 0, 0, 1)). Nothing bounces. Reduced-motion users
          get instant transitions globally (see global.css).
        </p>
      </header>

      <section>
        <h3 className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
          Tokens
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <code>--duration-fast: 120ms — hover, focus, color feedback</code>
          <code>--duration-base: 160ms — expand, dialogs, popovers</code>
          <code>--ease-out: cubic-bezier(0.2, 0, 0, 1)</code>
          <code>--transition-fast / --transition-base — ready-made pairs</code>
        </div>
      </section>

      <section>
        <h3 className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
          Try it
        </h3>
        <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <button
            type="button"
            style={{
              height: 'var(--control-height-md)',
              padding: '0 var(--space-4)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = 'var(--color-border-strong)';
              event.currentTarget.style.backgroundColor = 'var(--color-row-hover)';
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = 'var(--color-border)';
              event.currentTarget.style.backgroundColor = 'var(--color-surface)';
            }}
          >
            Hover — 120ms ease-out
          </button>
        </div>
      </section>
    </div>
  );
}

const meta: Meta<typeof MotionPage> = {
  title: 'Foundations/Motion',
  component: MotionPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof MotionPage>;

export const Motion: Story = {};
