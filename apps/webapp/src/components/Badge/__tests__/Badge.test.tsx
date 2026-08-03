import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '../Badge';

describe('Badge', () => {
  it('renders label text', () => {
    render(<Badge label="Active" variant="success" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies variant class', () => {
    render(<Badge label="Warning" variant="warning" />);
    const el = screen.getByText('Warning');
    expect(el).toHaveClass('badge--warning');
  });

  it('applies size class', () => {
    render(<Badge label="Large" variant="default" size="md" />);
    const el = screen.getByText('Large');
    expect(el).toHaveClass('badge--md');
  });
});
