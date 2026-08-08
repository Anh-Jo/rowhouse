import type { CSSProperties } from 'react';
import './Skeleton.css';

type SkeletonProps = {
  variant?: 'text' | 'block' | 'circle';
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  className?: string;
};

/** Loading placeholder — quiet pulse, silenced by prefers-reduced-motion. */
function Skeleton({ variant = 'text', width, height, className }: SkeletonProps) {
  return (
    <span
      className={`skeleton skeleton--${variant}${className ? ` ${className}` : ''}`}
      style={{ width, height }}
      aria-hidden
    />
  );
}

export { Skeleton };
/** Public component API — consumers type their props with this. @public */
export type { SkeletonProps };
