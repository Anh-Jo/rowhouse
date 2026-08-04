import type { ReactNode } from 'react';
import './DisplayTitle.css';

type DisplayTitleProps = {
  children: ReactNode;
  /** Trailing fragment printed in the ember accent — the headline's payload. */
  accent?: ReactNode;
  size?: 'lg' | 'md' | 'sm';
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
};

/**
 * The headline voice of the system: black weight, negative tracking, and at
 * most one accented fragment. Two accents in one title means neither reads.
 */
function DisplayTitle({
  children,
  accent,
  size = 'lg',
  as: Tag = 'h1',
  className,
}: DisplayTitleProps) {
  return (
    <Tag className={`display-title display-title--${size}${className ? ` ${className}` : ''}`}>
      {children}
      {accent != null && <span className="display-title__accent"> {accent}</span>}
    </Tag>
  );
}

export { DisplayTitle };
/** Public component API — consumers type their props with this. @public */
export type { DisplayTitleProps };
