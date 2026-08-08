import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/Button/Button';
import { Callout } from '@/components/Callout/Callout';
import { CodeBlock } from '@/components/CodeBlock/CodeBlock';
import { Input } from '@/components/Input/Input';
import { PageHeader } from '@/components/PageHeader/PageHeader';
import { Select } from '@/components/Select/Select';

const ROLE_SQL = `-- Run once on the target database, as an admin.
CREATE ROLE rowhouse_ro LOGIN PASSWORD '<read-only-password>';
GRANT CONNECT ON DATABASE app TO rowhouse_ro;
GRANT USAGE ON SCHEMA public TO rowhouse_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rowhouse_ro;`;

const fieldsetStyle: CSSProperties = {
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--color-surface)',
  padding: 'var(--space-4)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4)',
  minWidth: 0,
};

const legendStyle: CSSProperties = {
  padding: '0 var(--space-2)',
};

/**
 * The connect-datasource flow rebuilt from primitives only: PageHeader,
 * Callout (including the guardrail failure), CodeBlock, Input, Select,
 * Button. What the real page composes, without the data layer.
 */
function ConnectDatasourceRecipe({ failed }: { failed?: boolean }) {
  return (
    <div
      style={{
        maxWidth: 720,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-6)',
      }}
    >
      <PageHeader
        title="Connect a database"
        subtitle="Rowhouse connects with two dedicated least-privilege roles — never a superuser."
      />

      <CodeBlock code={ROLE_SQL} label="SQL — create the roles first" />

      {failed && (
        <Callout variant="danger" title="Connection test failed">
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <li>Host unreachable: connection timed out</li>
            <li
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                alignItems: 'flex-start',
                padding: 'var(--space-3)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-danger-border)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <ShieldAlert size={18} aria-hidden />
              <span>
                <strong>Guardrail: </strong>
                The read-only role can write. Fix the role&apos;s grants, then retry the test.
              </span>
            </li>
          </ul>
        </Callout>
      )}

      <form style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <fieldset style={fieldsetStyle}>
          <legend className="eyebrow" style={legendStyle}>
            Database
          </legend>
          <Input label="Name" placeholder="Production" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 'var(--space-4)' }}>
            <Input label="Host" placeholder="db.example.com" />
            <Input label="Port" defaultValue="5432" />
          </div>
          <Input label="Database" placeholder="app_production" />
          <Select
            label="TLS (SSL mode)"
            options={[
              { value: 'REQUIRE', label: 'Required (recommended)' },
              { value: 'DISABLE', label: 'Disabled — local databases only' },
            ]}
            value="REQUIRE"
          />
        </fieldset>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
          <fieldset style={fieldsetStyle}>
            <legend className="eyebrow" style={legendStyle}>
              Read-only role
            </legend>
            <Input label="Read-only username" placeholder="rowhouse_ro" />
            <Input label="Read-only password" type="password" />
          </fieldset>
          <fieldset style={fieldsetStyle}>
            <legend className="eyebrow" style={legendStyle}>
              Read-write role
            </legend>
            <Input label="Read-write username" placeholder="rowhouse_rw" />
            <Input label="Read-write password" type="password" />
          </fieldset>
        </div>

        <Button type="button" size="lg">
          Connect & test
        </Button>
      </form>
    </div>
  );
}

const meta: Meta<typeof ConnectDatasourceRecipe> = {
  title: 'Recipes/Connect a datasource',
  component: ConnectDatasourceRecipe,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof ConnectDatasourceRecipe>;

export const Form: Story = {};

export const FailedWithGuardrail: Story = {
  args: { failed: true },
};
