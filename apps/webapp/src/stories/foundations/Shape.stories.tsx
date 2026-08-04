import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = {
  title: 'Foundations/Shape & Space',
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj;

const spaceTokens = [
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-5',
  '--space-6',
  '--space-8',
  '--space-10',
  '--space-12',
  '--space-16',
];

const radiusTokens = ['--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-full'];

const shadowTokens = ['--shadow-sm', '--shadow-md', '--shadow-lg'];

function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div>
        <h2 className="display-title display-title--sm">{title}</h2>
        <p
          style={{
            maxWidth: 'var(--measure-text)',
            marginTop: '0.5rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          {caption}
        </p>
      </div>
      {children}
    </section>
  );
}

export const Tokens: Story = {
  render: () => (
    <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      <Section
        title="Space"
        caption="A 4px base grid. Cells breathe with 16–20px, sections with 24–40px; nothing in between is invented locally."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {spaceTokens.map((token) => (
            <div key={token} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <code
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontSize: 'var(--font-size-xs)',
                  width: '7rem',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {token}
              </code>
              <div
                style={{
                  height: '0.75rem',
                  width: `var(${token})`,
                  backgroundColor: 'var(--color-ember-300)',
                }}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Radius"
        caption="Nearly square. Corners are a printing artefact here, not a UI flourish — only avatars and dots use the full radius."
      >
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {radiusTokens.map((token) => (
            <div key={token} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div
                style={{
                  width: '5rem',
                  height: '3.5rem',
                  backgroundColor: 'var(--color-surface)',
                  border: '1px solid var(--color-rule)',
                  borderRadius: `var(${token})`,
                }}
              />
              <code
                style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-xs)' }}
              >
                {token}
              </code>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Rules over elevation"
        caption="Layout separates with hairlines. Shadows exist only for things that float above the page — popovers, dialogs."
      >
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '12rem',
              padding: '1rem',
              border: '1px solid var(--color-rule)',
              backgroundColor: 'var(--color-surface)',
            }}
          >
            <span className="ds-label">hairline</span>
            <p style={{ marginTop: '0.5rem', fontSize: 'var(--font-size-sm)' }}>
              Default separation
            </p>
          </div>
          {shadowTokens.map((token) => (
            <div
              key={token}
              style={{
                width: '12rem',
                padding: '1rem',
                backgroundColor: 'var(--color-surface)',
                borderRadius: 'var(--radius-md)',
                boxShadow: `var(${token})`,
              }}
            >
              <code
                style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-xs)' }}
              >
                {token}
              </code>
            </div>
          ))}
        </div>
      </Section>
    </div>
  ),
};
