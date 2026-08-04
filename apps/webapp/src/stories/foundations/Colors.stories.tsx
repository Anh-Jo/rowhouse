import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

type TokenGroup = {
  name: string;
  tokens: string[];
};

const NEUTRAL_SCALE: TokenGroup = {
  name: 'Neutral scale (slate primitives)',
  tokens: [
    '--rh-slate-25',
    '--rh-slate-50',
    '--rh-slate-100',
    '--rh-slate-200',
    '--rh-slate-300',
    '--rh-slate-400',
    '--rh-slate-500',
    '--rh-slate-600',
    '--rh-slate-700',
    '--rh-slate-800',
    '--rh-slate-850',
    '--rh-slate-900',
    '--rh-slate-925',
    '--rh-slate-950',
  ],
};

const ACCENT_SCALE: TokenGroup = {
  name: 'Ledger green scale (accent primitives)',
  tokens: [
    '--rh-green-100',
    '--rh-green-200',
    '--rh-green-300',
    '--rh-green-400',
    '--rh-green-500',
    '--rh-green-600',
    '--rh-green-700',
    '--rh-green-800',
    '--rh-green-900',
  ],
};

const SEMANTIC_GROUPS: TokenGroup[] = [
  {
    name: 'Surfaces',
    tokens: [
      '--color-bg',
      '--color-surface',
      '--color-surface-raised',
      '--color-surface-sunken',
    ],
  },
  {
    name: 'Borders',
    tokens: ['--color-border-subtle', '--color-border', '--color-border-strong'],
  },
  {
    name: 'Text',
    tokens: ['--color-text', '--color-text-secondary', '--color-text-muted'],
  },
  {
    name: 'Accent',
    tokens: [
      '--color-accent',
      '--color-accent-hover',
      '--color-accent-subtle',
      '--color-accent-border',
      '--color-accent-text',
    ],
  },
  {
    name: 'Success',
    tokens: [
      '--color-success',
      '--color-success-text',
      '--color-success-subtle',
      '--color-success-border',
    ],
  },
  {
    name: 'Warning',
    tokens: [
      '--color-warning',
      '--color-warning-text',
      '--color-warning-subtle',
      '--color-warning-border',
    ],
  },
  {
    name: 'Danger',
    tokens: [
      '--color-danger',
      '--color-danger-text',
      '--color-danger-subtle',
      '--color-danger-border',
    ],
  },
  {
    name: 'Info',
    tokens: [
      '--color-info',
      '--color-info-text',
      '--color-info-subtle',
      '--color-info-border',
    ],
  },
  {
    name: 'PII / sensitive',
    tokens: ['--color-pii', '--color-pii-text', '--color-pii-subtle', '--color-pii-border'],
  },
];

/** Reads the token's computed value so the label always tells the truth. */
function Swatch({ token }: { token: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [resolved, setResolved] = useState('');
  // Safe as a one-shot per token: primitives are theme-invariant and the
  // semantic groups render inside boards pinned with data-theme.
  useEffect(() => {
    if (ref.current) {
      setResolved(getComputedStyle(ref.current).getPropertyValue(token).trim());
    }
  }, [token]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
      <span
        ref={ref}
        style={{
          width: 44,
          height: 28,
          flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--color-border)',
          background: `var(${token})`,
        }}
      />
      <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <code style={{ fontSize: 'var(--font-size-12)' }}>{token}</code>
        <code style={{ fontSize: 'var(--font-size-12)', color: 'var(--color-text-muted)' }}>
          {resolved}
        </code>
      </span>
    </div>
  );
}

function Group({ group }: { group: TokenGroup }) {
  return (
    <section>
      <h3
        className="eyebrow"
        style={{ marginBottom: 'var(--space-3)' }}
      >
        {group.name}
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {group.tokens.map((token) => (
          <Swatch key={token} token={token} />
        ))}
      </div>
    </section>
  );
}

/** One full board, pinned to a theme so both can sit side by side. */
function ThemeBoard({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <div
      data-theme={theme}
      style={{
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-6)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
      <span className="eyebrow">{theme} theme</span>
      {SEMANTIC_GROUPS.map((group) => (
        <Group key={group.name} group={group} />
      ))}
    </div>
  );
}

const page: CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto',
  padding: 'var(--space-8) var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-8)',
};

function ColorsPage() {
  return (
    <div style={page}>
      <header>
        <span className="eyebrow">Foundations</span>
        <h1 style={{ fontSize: 'var(--font-size-28)', fontWeight: 700 }}>Colors</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-2)' }}>
          Swatches are rendered from the live tokens — what you see is what
          ships. Semantic aliases are the only names components may use;
          primitives stay inside tokens.css.
        </p>
      </header>
      <Group group={NEUTRAL_SCALE} />
      <Group group={ACCENT_SCALE} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <ThemeBoard theme="light" />
        <ThemeBoard theme="dark" />
      </div>
    </div>
  );
}

const meta: Meta<typeof ColorsPage> = {
  title: 'Foundations/Colors',
  component: ColorsPage,
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof ColorsPage>;

export const Colors: Story = {};
