import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Callout } from '../Callout';

describe('Callout', () => {
  it('renders title and content', () => {
    render(
      <Callout variant="success" title="Connection OK">
        Both roles verified.
      </Callout>,
    );
    expect(screen.getByText('Connection OK')).toBeInTheDocument();
    expect(screen.getByText('Both roles verified.')).toBeInTheDocument();
  });

  it.each(['info', 'success', 'warning', 'danger', 'pii'] as const)(
    'applies the %s variant class',
    (variant) => {
      render(<Callout variant={variant}>Message</Callout>);
      expect(screen.getByText('Message').closest('.callout')).toHaveClass(`callout--${variant}`);
    },
  );

  it('is an alert for danger and a status for success by default', () => {
    render(<Callout variant="danger">Problem</Callout>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    render(<Callout variant="success">Fine</Callout>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('accepts an explicit role override', () => {
    render(
      <Callout variant="success" role="alert">
        Urgent good news
      </Callout>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
