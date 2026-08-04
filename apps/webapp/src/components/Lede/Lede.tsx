import type { ReactNode } from 'react';
import './Lede.css';

type LedeProps = {
  children: ReactNode;
  /** Leading figure printed in the accent colour (e.g. the number of years covered). */
  highlight?: ReactNode;
  className?: string;
};

/**
 * The standfirst under a headline. Capped at a readable measure so it keeps a
 * newspaper column feel whatever the viewport does.
 */
function Lede({ children, highlight, className }: LedeProps) {
  return (
    <p className={`lede${className ? ` ${className}` : ''}`}>
      {highlight != null && <strong className="lede__highlight">{highlight} </strong>}
      {children}
    </p>
  );
}

export { Lede };
/** Public component API — consumers type their props with this. @public */
export type { LedeProps };
