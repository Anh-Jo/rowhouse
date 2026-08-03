import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchFilterBar } from '../SearchFilterBar';

describe('SearchFilterBar', () => {
  it('renders search input with placeholder', () => {
    render(<SearchFilterBar searchValue="" onSearchChange={() => {}} searchPlaceholder="Search..." />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('calls onSearchChange when typing', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchFilterBar searchValue="" onSearchChange={onChange} searchPlaceholder="Search..." />);
    await user.type(screen.getByPlaceholderText('Search...'), 'test');
    expect(onChange).toHaveBeenCalledWith('t');
    expect(onChange).toHaveBeenCalledWith('e');
    expect(onChange).toHaveBeenCalledWith('s');
    expect(onChange).toHaveBeenCalledWith('t');
  });

  it('displays current search value', () => {
    render(<SearchFilterBar searchValue="hello" onSearchChange={() => {}} />);
    const input = screen.getByDisplayValue('hello');
    expect(input).toBeInTheDocument();
  });

  it('renders filter dropdowns', () => {
    render(
      <SearchFilterBar
        searchValue=""
        onSearchChange={() => {}}
        filters={[
          {
            key: 'status',
            placeholder: 'Statut',
            options: [{ value: 'active', label: 'Actif' }],
          },
        ]}
      />,
    );
    expect(screen.getByText('Statut')).toBeInTheDocument();
  });

  it('renders without filters when none provided', () => {
    render(<SearchFilterBar searchValue="" onSearchChange={() => {}} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});
