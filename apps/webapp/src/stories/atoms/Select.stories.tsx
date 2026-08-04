import type { Meta, StoryObj } from '@storybook/react';
import { Select } from '@/components/Select/Select';

const meta: Meta<typeof Select> = {
  title: 'Atoms/Select',
  component: Select,
};

export default meta;
type Story = StoryObj<typeof Select>;

export const Default: Story = {
  args: {
    label: 'Statut',
    placeholder: 'Selectionner un statut',
    options: [
      { value: 'recu', label: 'Recu' },
      { value: 'contacte', label: 'Contacte' },
      { value: 'devis', label: 'Devis' },
      { value: 'signe', label: 'Signe' },
      { value: 'perdu', label: 'Perdu' },
    ],
  },
};

export const ContractType: Story = {
  args: {
    label: 'Type de contrat',
    options: [
      { value: 'emprunteur', label: 'Emprunteur' },
      { value: 'rc_pro', label: 'RC Pro' },
      { value: 'sante', label: 'Sante' },
      { value: 'prevoyance', label: 'Prevoyance' },
      { value: 'decennale', label: 'Decennale' },
    ],
  },
};

export const PartnerType: Story = {
  args: {
    label: 'Type de partenaire',
    options: [
      { value: 'professionnel', label: 'Professionnel' },
      { value: 'particulier', label: 'Particulier' },
    ],
  },
};

export const WithValue: Story = {
  args: {
    label: 'TLS (SSL mode)',
    options: [
      { value: 'REQUIRE', label: 'Required (recommended)' },
      { value: 'DISABLE', label: 'Disabled — local databases only' },
    ],
    value: 'REQUIRE',
  },
};

/* The selected value must keep the normal text color even when disabled —
   only a genuine placeholder may render muted (regression: fieldset-disabled
   TLS select looked like an empty placeholder). */
export const DisabledWithValue: Story = {
  args: {
    label: 'TLS (SSL mode)',
    options: [
      { value: 'REQUIRE', label: 'Required (recommended)' },
      { value: 'DISABLE', label: 'Disabled — local databases only' },
    ],
    value: 'REQUIRE',
    disabled: true,
  },
};

export const WithError: Story = {
  args: {
    label: 'Statut',
    options: [{ value: 'test', label: 'Test' }],
    error: 'Ce champ est requis',
  },
};
