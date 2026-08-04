import type { Meta, StoryObj } from '@storybook/react';
import { CodeBlock } from '@/components/CodeBlock/CodeBlock';

const ROLE_SQL = `-- Run once on the target database, as an admin.
CREATE ROLE rowhouse_ro LOGIN PASSWORD '<read-only-password>';
GRANT CONNECT ON DATABASE app TO rowhouse_ro;
GRANT USAGE ON SCHEMA public TO rowhouse_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO rowhouse_ro;`;

const meta: Meta<typeof CodeBlock> = {
  title: 'Molecules/CodeBlock',
  component: CodeBlock,
};

export default meta;
type Story = StoryObj<typeof CodeBlock>;

export const SQL: Story = {
  args: { code: ROLE_SQL, label: 'SQL' },
};

export const NoCopy: Story = {
  args: { code: 'ds_01j9y0v3xqfw8r2k', label: 'Datasource id', copyable: false },
};
