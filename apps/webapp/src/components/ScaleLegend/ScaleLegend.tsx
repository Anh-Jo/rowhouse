import './ScaleLegend.css';

type ScaleLegendProps = {
  /** Label under the lightest swatch. */
  min: string;
  /** Label under the darkest swatch. */
  max: string;
  /** Number of classes in the choropleth (2–6, matching --color-scale-*). */
  stops?: number;
  /** Adds a distinct "no data" swatch at the end of the ramp. */
  emptyLabel?: string;
  title?: string;
  className?: string;
};

const RAMP_LAST_INDEX = 5;

/** Pick evenly spaced tokens from the 6-step ramp so both ends stay anchored. */
function rampTokens(stops: number): string[] {
  const count = Math.min(Math.max(Math.trunc(stops), 2), RAMP_LAST_INDEX + 1);
  return Array.from({ length: count }, (_, index) => {
    const tokenIndex = Math.round((index * RAMP_LAST_INDEX) / (count - 1));
    return `var(--color-scale-${tokenIndex})`;
  });
}

/**
 * Reading key for the sequential data scale. It renders the same tokens the map
 * fills with, so the legend can never drift from the shapes it explains.
 */
function ScaleLegend({ min, max, stops = 6, emptyLabel, title, className }: ScaleLegendProps) {
  return (
    <div className={`scale-legend${className ? ` ${className}` : ''}`}>
      {title && <span className="scale-legend__title">{title}</span>}
      <div className="scale-legend__ramp">
        {rampTokens(stops).map((color) => (
          <span key={color} className="scale-legend__swatch" style={{ backgroundColor: color }} />
        ))}
        {emptyLabel && (
          <span
            className="scale-legend__swatch scale-legend__swatch--empty"
            style={{ backgroundColor: 'var(--color-scale-empty)' }}
          />
        )}
      </div>
      <div className="scale-legend__labels">
        {/* The range labels track the ramp; the no-data label stays with its own swatch */}
        <span className="scale-legend__range">
          <span>{min}</span>
          <span>{max}</span>
        </span>
        {emptyLabel && <span className="scale-legend__empty-label">{emptyLabel}</span>}
      </div>
    </div>
  );
}

export { ScaleLegend };
/** Public component API — consumers type their props with this. @public */
export type { ScaleLegendProps };
