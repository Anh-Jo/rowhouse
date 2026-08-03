import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    await user.click(screen.getByRole('button', { name: 'Click me' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when disabled prop is true', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Disabled</Button>);
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it.each(['primary', 'secondary', 'outline', 'ghost', 'danger'] as const)(
    'renders with %s variant',
    (variant) => {
      render(<Button variant={variant}>Variant</Button>);
      const button = screen.getByRole('button', { name: 'Variant' });
      expect(button).toHaveClass(`btn--${variant}`);
    },
  );

  it('renders with icon', () => {
    const icon = <svg data-testid="icon" />;
    render(<Button icon={icon}>With icon</Button>);
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByText('With icon')).toBeInTheDocument();
  });

  it('applies iconOnly correctly', () => {
    const icon = <svg data-testid="icon" />;
    render(<Button icon={icon} iconOnly aria-label="Action">Label</Button>);
    const button = screen.getByRole('button', { name: 'Action' });
    expect(button).toHaveClass('btn--icon-only');
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.queryByText('Label')).not.toBeInTheDocument();
  });
});
