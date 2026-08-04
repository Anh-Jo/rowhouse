import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from '../Select';

const options = [
  { value: 'fr', label: 'France' },
  { value: 'de', label: 'Allemagne' },
  { value: 'es', label: 'Espagne' },
];

describe('Select', () => {
  it('renders with label', () => {
    render(<Select label="Pays" options={options} />);
    expect(screen.getByText('Pays')).toBeInTheDocument();
  });

  it('shows placeholder text', () => {
    render(<Select label="Pays" options={options} placeholder="Choisir un pays" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('Choisir un pays');
  });

  it('renders combobox trigger', () => {
    render(<Select label="Pays" options={options} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(<Select label="Pays" options={options} error="Champ requis" />);
    expect(screen.getByText('Champ requis')).toBeInTheDocument();
  });

  it('has aria-invalid when error is present', () => {
    render(<Select label="Pays" options={options} error="Champ requis" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not have aria-invalid when no error', () => {
    render(<Select label="Pays" options={options} />);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-invalid', 'false');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Select label="Pays" options={options} disabled />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('displays selected value', () => {
    render(<Select label="Pays" options={options} value="fr" />);
    expect(screen.getByRole('combobox')).toHaveTextContent('France');
  });

  it('marks the trigger as placeholder only when genuinely empty', () => {
    // [data-placeholder] drives the muted placeholder color — a selected
    // value must never carry it, or it renders in placeholder-grey.
    const { rerender } = render(<Select label="Pays" options={options} />);
    expect(screen.getByRole('combobox')).toHaveAttribute('data-placeholder');
    rerender(<Select label="Pays" options={options} value="fr" />);
    expect(screen.getByRole('combobox')).not.toHaveAttribute('data-placeholder');
  });

  it('keeps the selected value rendered when disabled', () => {
    render(<Select label="Pays" options={options} value="fr" disabled />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent('France');
    expect(trigger).not.toHaveAttribute('data-placeholder');
  });

  it('calls onValueChange prop is passed', () => {
    const onValueChange = vi.fn();
    render(<Select label="Pays" options={options} onValueChange={onValueChange} />);
    // Verify the component renders without crashing when callback is provided
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('applies error class to wrapper', () => {
    const { container } = render(<Select label="Pays" options={options} error="Required" />);
    const wrapper = container.querySelector('.select-field--error');
    expect(wrapper).toBeInTheDocument();
  });

  it('has aria-describedby linked to error element', () => {
    render(<Select label="Pays" options={options} error="Required" />);
    const trigger = screen.getByRole('combobox');
    const errorId = trigger.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(screen.getByText('Required')).toHaveAttribute('id', errorId);
  });
});
