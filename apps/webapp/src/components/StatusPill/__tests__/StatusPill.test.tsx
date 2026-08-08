import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusPill } from '../StatusPill';

describe('StatusPill', () => {
  it('defaults the label to the uppercased status', () => {
    render(<StatusPill status="ok" />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });

  it('renders a custom label', () => {
    render(<StatusPill status="error" label="FAILED" />);
    const pill = screen.getByText('FAILED');
    expect(pill).toHaveClass('status-pill--error');
  });

  it.each(['ok', 'error', 'pending', 'neutral'] as const)(
    'applies the %s status class',
    (status) => {
      render(<StatusPill status={status} label={`label-${status}`} />);
      expect(screen.getByText(`label-${status}`)).toHaveClass(`status-pill--${status}`);
    },
  );
});
