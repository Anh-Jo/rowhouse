import type { Meta, StoryObj } from '@storybook/react';
import type { CSSProperties } from 'react';
import { Badge } from '@/components/Badge/Badge';
import { Button } from '@/components/Button/Button';
import { Callout } from '@/components/Callout/Callout';
import { Card } from '@/components/Card/Card';
import { CodeBlock } from '@/components/CodeBlock/CodeBlock';
import { DataTable } from '@/components/DataTable/DataTable';
import type { Column } from '@/components/DataTable/DataTable';
import { KeyValue } from '@/components/KeyValue/KeyValue';
import { PageHeader } from '@/components/PageHeader/PageHeader';

type SchemaColumnRow = {
  id: string;
  name: string;
  dataType: string;
  nullable: boolean;
  key: 'PK' | 'FK' | null;
  pii: boolean;
};

const rows: SchemaColumnRow[] = [
  { id: '1', name: 'id', dataType: 'uuid', nullable: false, key: 'PK', pii: false },
  { id: '2', name: 'workspace_id', dataType: 'uuid', nullable: false, key: 'FK', pii: false },
  { id: '3', name: 'email', dataType: 'text', nullable: false, key: null, pii: true },
  { id: '4', name: 'full_name', dataType: 'text', nullable: true, key: null, pii: true },
  { id: '5', name: 'plan', dataType: 'text', nullable: false, key: null, pii: false },
  { id: '6', name: 'created_at', dataType: 'timestamptz', nullable: false, key: null, pii: false },
];

const columns: Column<SchemaColumnRow>[] = [
  { key: 'name', header: 'Column', render: (r) => r.name, sortable: true },
  { key: 'dataType', header: 'Type', render: (r) => r.dataType, sortable: true },
  { key: 'nullable', header: 'Null', render: (r) => (r.nullable ? 'yes' : 'no') },
  {
    key: 'key',
    header: 'Key',
    render: (r) => (r.key ? <Badge label={r.key} variant="info" /> : null),
  },
  {
    key: 'pii',
    header: 'PII',
    render: (r) => (r.pii ? <Badge label="PII" variant="pii" /> : null),
  },
];

const pageStyle: CSSProperties = {
  maxWidth: 860,
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-5)',
};

/**
 * A schema table detail rebuilt from primitives: mono-voiced PageHeader,
 * KeyValue metadata, PII callout, dense DataTable and a sample query.
 */
function SchemaTableDetailRecipe() {
  return (
    <div style={pageStyle}>
      <PageHeader
        eyebrow="public"
        title={<span className="font-data" style={{ fontSize: 'inherit' }}>customers</span>}
        subtitle="Team metadata is editable; PII flags feed masking."
        actions={<Button variant="secondary">Edit metadata</Button>}
      />

      <Callout variant="pii" title="2 sensitive columns">
        email and full_name are flagged as PII — masked for non-approved roles.
      </Callout>

      <Card title="Table">
        <KeyValue
          items={[
            { label: 'Schema', value: 'public' },
            { label: 'Rows (est.)', value: '182,340' },
            { label: 'Primary key', value: 'id' },
            {
              label: 'Description',
              value: 'One row per customer account. Owned by the billing team.',
              mono: false,
            },
          ]}
        />
      </Card>

      <DataTable columns={columns} data={rows} keyExtractor={(r) => r.id} />

      <CodeBlock
        label="Sample query — read-only role"
        code={"SELECT id, plan, created_at\nFROM public.customers\nORDER BY created_at DESC\nLIMIT 50;"}
      />
    </div>
  );
}

const meta: Meta<typeof SchemaTableDetailRecipe> = {
  title: 'Recipes/Schema table detail',
  component: SchemaTableDetailRecipe,
  parameters: { layout: 'padded' },
};

export default meta;
type Story = StoryObj<typeof SchemaTableDetailRecipe>;

export const Detail: Story = {};
