import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankedList } from '../RankedList';

const items = [
  { id: 'gironde', label: 'Gironde', value: 38275 },
  { id: 'var', label: 'Var', value: 6423 },
];

describe('RankedList', () => {
  it('prints two-digit rank markers', () => {
    render(<RankedList items={items} />);
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
  });

  it('continues the numbering from startRank', () => {
    render(<RankedList items={items} startRank={6} />);
    expect(screen.getByText('06')).toBeInTheDocument();
    expect(screen.getByText('07')).toBeInTheDocument();
  });

  it('formats values and appends the unit', () => {
    const { container } = render(<RankedList items={items} unit="ha" />);
    const firstValue = container.querySelector('.ranked-list__value');
    expect((firstValue?.textContent ?? '').replace(/[\s  ]/g, '')).toBe('38275ha');
  });

  it('renders static rows when no handler is given', () => {
    render(<RankedList items={items} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onSelect with the row id', async () => {
    const onSelect = vi.fn();
    render(<RankedList items={items} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole('button', { name: /Var/ }));
    expect(onSelect).toHaveBeenCalledWith('var');
  });

  it('marks the selected row for assistive tech', () => {
    render(<RankedList items={items} selectedId="var" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Var/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /Gironde/ })).not.toHaveAttribute('aria-current');
  });

  it('renders the empty message instead of an empty list', () => {
    const { container } = render(<RankedList items={[]} emptyMessage="Aucun département touché" />);
    expect(screen.getByText('Aucun département touché')).toBeInTheDocument();
    expect(container.querySelector('ol')).toBeNull();
  });

  it('falls back to a dash for a non-finite value', () => {
    render(<RankedList items={[{ id: 'x', label: 'Inconnu', value: Number.NaN }]} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
