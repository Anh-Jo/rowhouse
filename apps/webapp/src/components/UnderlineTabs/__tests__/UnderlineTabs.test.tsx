import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnderlineTabs } from '../UnderlineTabs';

const tabs = [
  { value: 'carte', label: 'Carte' },
  { value: 'evolution', label: 'Évolution' },
];

describe('UnderlineTabs', () => {
  it('renders one tab per item', () => {
    render(<UnderlineTabs tabs={tabs} value="carte" onValueChange={vi.fn()} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('marks the current tab as selected', () => {
    render(<UnderlineTabs tabs={tabs} value="evolution" onValueChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Évolution' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Carte' })).toHaveAttribute('aria-selected', 'false');
  });

  it('reports the tab the reader picked', async () => {
    const onValueChange = vi.fn();
    render(<UnderlineTabs tabs={tabs} value="carte" onValueChange={onValueChange} />);

    await userEvent.click(screen.getByRole('tab', { name: 'Évolution' }));
    expect(onValueChange).toHaveBeenCalledWith('evolution');
  });

  it('names the tab list for assistive tech', () => {
    render(
      <UnderlineTabs tabs={tabs} value="carte" onValueChange={vi.fn()} label="Mode de lecture" />,
    );
    expect(screen.getByRole('tablist', { name: 'Mode de lecture' })).toBeInTheDocument();
  });
});
