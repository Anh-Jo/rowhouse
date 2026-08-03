import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from '../Textarea';

describe('Textarea', () => {
  it('renders with label', () => {
    render(<Textarea label="Description" />);
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
  });

  it('accepts user input', async () => {
    const user = userEvent.setup();
    render(<Textarea label="Description" />);
    const textarea = screen.getByLabelText('Description');
    await user.type(textarea, 'Hello world');
    expect(textarea).toHaveValue('Hello world');
  });

  it('shows error message', () => {
    render(<Textarea label="Description" error="Too short" />);
    expect(screen.getByText('Too short')).toBeInTheDocument();
  });

  it('has aria-invalid when error is present', () => {
    render(<Textarea label="Description" error="Required" />);
    expect(screen.getByLabelText('Description')).toHaveAttribute('aria-invalid', 'true');
  });

  it('has aria-describedby linked to error element', () => {
    render(<Textarea label="Description" error="Required" />);
    const textarea = screen.getByLabelText('Description');
    const errorId = textarea.getAttribute('aria-describedby');
    expect(errorId).toBeTruthy();
    expect(screen.getByText('Required')).toHaveAttribute('id', errorId);
  });

  it('does not have aria-invalid when no error', () => {
    render(<Textarea label="Description" />);
    expect(screen.getByLabelText('Description')).toHaveAttribute('aria-invalid', 'false');
  });

  it('is disabled when disabled prop is true', () => {
    render(<Textarea label="Description" disabled />);
    expect(screen.getByLabelText('Description')).toBeDisabled();
  });
});
