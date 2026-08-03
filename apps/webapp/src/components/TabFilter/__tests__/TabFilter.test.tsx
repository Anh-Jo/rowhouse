import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabFilter } from '../TabFilter';

const tabs = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs', count: 5 },
  { value: 'pending', label: 'En attente', count: 3 },
];

describe('TabFilter', () => {
  it('renders all tab labels', () => {
    render(<TabFilter tabs={tabs} value="all" onValueChange={() => {}} />);
    expect(screen.getByText('Tous')).toBeInTheDocument();
    expect(screen.getByText('Actifs')).toBeInTheDocument();
    expect(screen.getByText('En attente')).toBeInTheDocument();
  });

  it('renders badge counts', () => {
    render(<TabFilter tabs={tabs} value="all" onValueChange={() => {}} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not render badge for tab without count', () => {
    render(<TabFilter tabs={tabs} value="all" onValueChange={() => {}} />);
    const firstTab = screen.getByRole('tab', { name: 'Tous', selected: true });
    expect(firstTab).toBeInTheDocument();
    // "Tous" tab has no count, so its text content should only be the label
    expect(firstTab.textContent).toBe('Tous');
  });

  it('calls onValueChange when tab is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TabFilter tabs={tabs} value="all" onValueChange={onChange} />);
    await user.click(screen.getByText('Actifs'));
    expect(onChange).toHaveBeenCalledWith('active');
  });

  it('marks the correct tab as active', () => {
    render(<TabFilter tabs={tabs} value="active" onValueChange={() => {}} />);
    const activeTab = screen.getByRole('tab', { name: /Actifs/, selected: true });
    expect(activeTab).toBeInTheDocument();
  });
});
