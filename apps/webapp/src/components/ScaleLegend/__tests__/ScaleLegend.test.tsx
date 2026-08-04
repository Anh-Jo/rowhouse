import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScaleLegend } from '../ScaleLegend';

function swatches(container: HTMLElement): Element[] {
  return Array.from(container.querySelectorAll('.scale-legend__swatch'));
}

describe('ScaleLegend', () => {
  it('renders the six ramp classes by default', () => {
    const { container } = render(<ScaleLegend min="0 ha" max="≥ 30 000 ha" />);
    expect(swatches(container)).toHaveLength(6);
  });

  it('anchors both ends of the ramp when fewer classes are asked for', () => {
    const { container } = render(<ScaleLegend min="0" max="max" stops={3} />);
    const styles = swatches(container).map((node) => node.getAttribute('style'));
    expect(styles).toHaveLength(3);
    expect(styles[0]).toContain('--color-scale-0');
    expect(styles[2]).toContain('--color-scale-5');
  });

  it('clamps an out-of-range number of classes', () => {
    const { container } = render(<ScaleLegend min="0" max="max" stops={12} />);
    expect(swatches(container)).toHaveLength(6);
  });

  it('adds a distinct no-data swatch when the dimension has gaps', () => {
    const { container } = render(
      <ScaleLegend min="0" max="max" stops={4} emptyLabel="Pas de données" />,
    );
    expect(swatches(container)).toHaveLength(5);
    expect(screen.getByText('Pas de données')).toBeInTheDocument();
  });

  it('renders the range labels', () => {
    render(<ScaleLegend title="Surface brûlée" min="0 ha" max="≥ 30 000 ha" />);
    expect(screen.getByText('Surface brûlée')).toBeInTheDocument();
    expect(screen.getByText('0 ha')).toBeInTheDocument();
    expect(screen.getByText('≥ 30 000 ha')).toBeInTheDocument();
  });
});
