import { Fragment } from 'react';
import './Eyebrow.css';

type EyebrowProps = {
  /** Segments rendered in order, separated by a middot. */
  items: string[];
  tone?: 'default' | 'accent';
  className?: string;
};

/**
 * The kicker line that sits above a headline: subject · scope · period.
 * Wide-tracked small caps — the system's quietest voice.
 */
function Eyebrow({ items, tone = 'default', className }: EyebrowProps) {
  return (
    <p className={`eyebrow eyebrow--${tone}${className ? ` ${className}` : ''}`}>
      {items.map((item, index) => (
        <Fragment key={item}>
          {index > 0 && (
            <span className="eyebrow__separator" aria-hidden="true">
              ·
            </span>
          )}
          <span>{item}</span>
        </Fragment>
      ))}
    </p>
  );
}

export { Eyebrow };
/** Public component API — consumers type their props with this. @public */
export type { EyebrowProps };
