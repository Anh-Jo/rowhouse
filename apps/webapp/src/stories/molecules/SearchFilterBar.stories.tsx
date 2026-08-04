import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SearchFilterBar } from '@/components/SearchFilterBar/SearchFilterBar';

const meta: Meta<typeof SearchFilterBar> = {
  title: 'Molecules/SearchFilterBar',
  component: SearchFilterBar,
};

export default meta;
type Story = StoryObj<typeof SearchFilterBar>;

function InteractiveSearchFilterBar() {
  const [search, setSearch] = useState('');
  const [schema, setSchema] = useState<string | undefined>();
  const [pii, setPii] = useState<string | undefined>();
  return (
    <SearchFilterBar
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search tables…"
      filters={[
        {
          key: 'schema',
          placeholder: 'Schema',
          options: [
            { value: 'public', label: 'public' },
            { value: 'billing', label: 'billing' },
            { value: 'audit', label: 'audit' },
          ],
          value: schema,
          onValueChange: setSchema,
        },
        {
          key: 'pii',
          placeholder: 'PII',
          options: [
            { value: 'with', label: 'With PII columns' },
            { value: 'without', label: 'Without PII columns' },
          ],
          value: pii,
          onValueChange: setPii,
        },
      ]}
    />
  );
}

export const TableSearch: Story = {
  render: () => <InteractiveSearchFilterBar />,
};

export const SearchOnly: Story = {
  render: () => {
    return <SearchFilterBar searchValue="" onSearchChange={() => {}} searchPlaceholder="Search…" />;
  },
};
