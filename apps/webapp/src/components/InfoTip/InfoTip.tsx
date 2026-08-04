import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Popover } from '@/components/Popover/Popover';
import './InfoTip.css';

type InfoTipProps = {
  /** What the figure actually measures — the methodology note. */
  children: ReactNode;
  /** Accessible name of the trigger, e.g. "About: burnt area". */
  label: string;
  className?: string;
};

/**
 * The small circled glyph next to a metric label. A data story states its
 * method next to the number, not in a footnote nobody scrolls to.
 */
function InfoTip({ children, label, className }: InfoTipProps) {
  return (
    <Popover
      align="start"
      className="info-tip__panel"
      trigger={
        <button
          type="button"
          className={`info-tip__trigger${className ? ` ${className}` : ''}`}
          aria-label={label}
        >
          <Info size={13} strokeWidth={1.75} />
        </button>
      }
    >
      <div className="info-tip__body">{children}</div>
    </Popover>
  );
}

export { InfoTip };
/** Public component API — consumers type their props with this. @public */
export type { InfoTipProps };
