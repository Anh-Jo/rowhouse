import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SearchFilterBar } from '@/components/SearchFilterBar/SearchFilterBar';

const meta: Meta<typeof SearchFilterBar> = {
  title: 'Organisms/SearchFilterBar',
  component: SearchFilterBar,
};

export default meta;
type Story = StoryObj<typeof SearchFilterBar>;

function DefaultSearchFilterBar() {
  const [search, setSearch] = useState('');
  return (
    <SearchFilterBar
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Rechercher un lead..."
      filters={[
        {
          key: 'status',
          placeholder: 'Statut',
          options: [
            { value: 'recu', label: 'Recu' },
            { value: 'contacte', label: 'Contacte' },
            { value: 'signe', label: 'Signe' },
          ],
        },
        {
          key: 'partner',
          placeholder: 'Partenaire',
          options: [
            { value: 'jean', label: 'Jean Martin' },
            { value: 'sophie', label: 'Sophie Leroy' },
          ],
        },
      ]}
    />
  );
}

function SearchOnlyFilterBar() {
  const [search, setSearch] = useState('');
  return <SearchFilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Rechercher..." />;
}

function NotificationPanelSearchFilterBar() {
  const [search, setSearch] = useState('');
  return (
    <SearchFilterBar
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Rechercher un partenaire..."
      filters={[
        {
          key: 'type',
          placeholder: 'Type',
          options: [
            { value: 'professionnel', label: 'Professionnel' },
            { value: 'particulier', label: 'Particulier' },
          ],
        },
      ]}
    />
  );
}

export const Default: Story = {
  render: () => <DefaultSearchFilterBar />,
};

export const SearchOnly: Story = {
  render: () => <SearchOnlyFilterBar />,
};

export const NotificationPanel: Story = {
  name: 'NotificationPanel',
  render: () => <NotificationPanelSearchFilterBar />,
};
