import type { ReactNode } from 'react';
import './PanelSection.css';

type PanelSectionProps = {
  title: string;
  children: ReactNode;
  /** Drops the hairline above the section — use on the first block of a rail. */
  flush?: boolean;
  className?: string;
};

/**
 * A titled block of the detail rail. Sections stack against hairlines, which is
 * what keeps a dense sidebar readable without boxing everything in cards.
 */
function PanelSection({ title, children, flush = false, className }: PanelSectionProps) {
  return (
    <section
      className={`panel-section${flush ? ' panel-section--flush' : ''}${className ? ` ${className}` : ''}`}
    >
      <h3 className="panel-section__title">{title}</h3>
      <div className="panel-section__body">{children}</div>
    </section>
  );
}

export { PanelSection };
/** Public component API — consumers type their props with this. @public */
export type { PanelSectionProps };
