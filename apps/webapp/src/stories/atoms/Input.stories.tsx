import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '@/components/Input/Input';
import { Search, Mail, Phone as PhoneIcon } from 'lucide-react';

const meta: Meta<typeof Input> = {
  title: 'Atoms/Input',
  component: Input,
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: { label: 'Nom', placeholder: 'Entrez votre nom' },
};

export const Email: Story = {
  args: { label: 'Email', type: 'email', placeholder: 'email@exemple.com', icon: <Mail size={16} /> },
};

export const Telephone: Story = {
  args: { label: 'Telephone', type: 'tel', placeholder: '06 00 00 00 00', icon: <PhoneIcon size={16} /> },
};

export const SearchInput: Story = {
  args: { placeholder: 'Rechercher un lead...', icon: <Search size={16} /> },
};

export const Password: Story = {
  args: { label: 'Mot de passe', type: 'password', placeholder: '********' },
};

export const WithError: Story = {
  args: { label: 'Email', type: 'email', error: 'Email invalide', value: 'bad-email' },
};

export const Number: Story = {
  args: { label: 'Montant', type: 'number', placeholder: '0' },
};
