import type { ReactNode } from 'react';
import { DisplayTitle } from '@/components/DisplayTitle/DisplayTitle';
import { Eyebrow } from '@/components/Eyebrow/Eyebrow';
import { Lede } from '@/components/Lede/Lede';
import './Masthead.css';

type MastheadProps = {
  /** Kicker segments: subject · scope · period. */
  eyebrow: string[];
  title: ReactNode;
  /** Trailing fragment of the headline, printed in the ember accent. */
  accent?: ReactNode;
  lede?: ReactNode;
  ledeHighlight?: ReactNode;
  /** Trailing slot for the sources link, a share button, a byline… */
  footer?: ReactNode;
  className?: string;
};

/**
 * Opening block of a data story: kicker, headline, standfirst. The warm wash
 * behind it is what separates the narrative from the figures underneath.
 */
function Masthead({
  eyebrow,
  title,
  accent,
  lede,
  ledeHighlight,
  footer,
  className,
}: MastheadProps) {
  return (
    <header className={`masthead${className ? ` ${className}` : ''}`}>
      <Eyebrow items={eyebrow} />
      <DisplayTitle accent={accent}>{title}</DisplayTitle>
      {lede && <Lede highlight={ledeHighlight}>{lede}</Lede>}
      {footer && <div className="masthead__footer">{footer}</div>}
    </header>
  );
}

export { Masthead };
/** Public component API — consumers type their props with this. @public */
export type { MastheadProps };
