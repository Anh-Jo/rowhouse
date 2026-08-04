import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { YearStepper } from '../YearStepper';

describe('YearStepper', () => {
  it('renders the selected year and its label', () => {
    render(
      <YearStepper label="Année observée" value={2026} min={2006} max={2026} onChange={vi.fn()} />,
    );
    expect(screen.getByText('Année observée')).toBeInTheDocument();
    expect(screen.getByText('2026')).toBeInTheDocument();
  });

  it('steps backwards', async () => {
    const onChange = vi.fn();
    render(<YearStepper value={2015} min={2006} max={2026} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Année précédente' }));
    expect(onChange).toHaveBeenCalledWith(2014);
  });

  it('steps forwards', async () => {
    const onChange = vi.fn();
    render(<YearStepper value={2015} min={2006} max={2026} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Année suivante' }));
    expect(onChange).toHaveBeenCalledWith(2016);
  });

  it('stops at the lower bound', async () => {
    const onChange = vi.fn();
    render(<YearStepper value={2006} min={2006} max={2026} onChange={onChange} />);

    const previous = screen.getByRole('button', { name: 'Année précédente' });
    expect(previous).toBeDisabled();

    await userEvent.click(previous);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops at the upper bound', async () => {
    const onChange = vi.fn();
    render(<YearStepper value={2026} min={2006} max={2026} onChange={onChange} />);

    const next = screen.getByRole('button', { name: 'Année suivante' });
    expect(next).toBeDisabled();

    await userEvent.click(next);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops when the value sits outside the bounds', () => {
    render(<YearStepper value={2030} min={2006} max={2026} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Année suivante' })).toBeDisabled();
  });

  it('uses translated arrow labels when provided', () => {
    render(
      <YearStepper
        value={2015}
        min={2006}
        max={2026}
        onChange={vi.fn()}
        previousLabel="Previous year"
        nextLabel="Next year"
      />,
    );
    expect(screen.getByRole('button', { name: 'Previous year' })).toBeInTheDocument();
  });

  it('renders the provenance caption', () => {
    render(
      <YearStepper
        value={2026}
        min={2006}
        max={2026}
        onChange={vi.fn()}
        caption="EFFIS · provisoire"
      />,
    );
    expect(screen.getByText('EFFIS · provisoire')).toHaveClass('year-stepper__caption--accent');
  });
});
