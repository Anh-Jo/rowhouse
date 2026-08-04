import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatCard } from '../StatCard';

/** fr-FR groups with a narrow no-break space; compare on digits only. */
function digitsOf(element: HTMLElement): string {
  return (element.textContent ?? '').replace(/[\s  ]/g, '');
}

describe('StatCard', () => {
  it('formats a raw number and appends the unit', () => {
    const { container } = render(<StatCard label="Surface brûlée" value={102931} unit="ha" />);
    const value = container.querySelector('.stat-card__value');
    expect(value).not.toBeNull();
    expect(digitsOf(value as HTMLElement)).toBe('102931ha');
  });

  it('renders a pre-formatted string as-is', () => {
    render(<StatCard label="Surface brûlée" value="≈ 100 000" />);
    expect(screen.getByText('≈ 100 000')).toBeInTheDocument();
  });

  it('shows the no-data state when the value is missing', () => {
    render(<StatCard label="Nombre de feux" />);
    expect(screen.getByText('Pas de données')).toBeInTheDocument();
  });

  it('shows the no-data state for a non-finite value', () => {
    render(<StatCard label="Nombre de feux" value={Number.NaN} />);
    expect(screen.getByText('Pas de données')).toBeInTheDocument();
  });

  it('accepts a custom no-data label', () => {
    render(<StatCard label="Nombre de feux" emptyLabel="Non publié" />);
    expect(screen.getByText('Non publié')).toBeInTheDocument();
  });

  it('renders zero as a measurement, not as missing data', () => {
    render(<StatCard label="Surface brûlée" value={0} />);
    expect(screen.queryByText('Pas de données')).not.toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('is a plain cell when no handler is given', () => {
    const { container } = render(<StatCard label="Surface brûlée" value={1} />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('becomes a pressable cell when selectable', async () => {
    const onSelect = vi.fn();
    render(<StatCard label="Surface brûlée" value={1} active onSelect={onSelect} />);

    const cell = screen.getByRole('button');
    expect(cell).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(cell);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('exposes the methodology note through a labelled trigger', () => {
    render(<StatCard label="Surface brûlée" value={1} hint="Estimation par télédétection." />);
    expect(screen.getByRole('button', { name: 'À propos : Surface brûlée' })).toBeInTheDocument();
  });
});
