import type { ReactNode } from 'react';
import './DataStoryLayout.css';

type DataStoryLayoutProps = {
  /** Masthead, stat bar, tabs — everything above the visualisation. */
  header?: ReactNode;
  /** The visualisation itself (map, chart, table). */
  children: ReactNode;
  /** Detail rail: filters, selection detail, rankings. */
  rail?: ReactNode;
  /** Methodology and credits, printed under the whole story. */
  footer?: ReactNode;
  className?: string;
};

/**
 * Page shell of a data story: full-width narrative header, then a
 * visualisation + rail split that collapses to a single column on small
 * screens (the rail follows the map instead of squeezing it).
 */
function DataStoryLayout({ header, children, rail, footer, className }: DataStoryLayoutProps) {
  return (
    <div className={`data-story${className ? ` ${className}` : ''}`}>
      {header && <div className="data-story__header">{header}</div>}
      <div className="data-story__body">
        <main className="data-story__canvas">{children}</main>
        {rail && <aside className="data-story__rail">{rail}</aside>}
      </div>
      {footer && <footer className="data-story__footer">{footer}</footer>}
    </div>
  );
}

export { DataStoryLayout };
/** Public component API — consumers type their props with this. @public */
export type { DataStoryLayoutProps };
