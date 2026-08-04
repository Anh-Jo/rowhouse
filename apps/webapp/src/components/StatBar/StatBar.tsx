import type { ReactNode } from 'react';
import './StatBar.css';

type StatBarProps = {
  /** StatCard / YearStepper cells. Hairlines are drawn by the bar, not the cells. */
  children: ReactNode;
  /** Accessible name of the figure block, e.g. "Chiffres clés 2026". */
  label?: string;
  className?: string;
};

/**
 * The band of key figures under a masthead. It owns the rules between cells so
 * any mix of steppers and stat cards keeps a single printed grid.
 */
function StatBar({ children, label, className }: StatBarProps) {
  return (
    <section className={`stat-bar${className ? ` ${className}` : ''}`} aria-label={label}>
      {children}
    </section>
  );
}

export { StatBar };
/** Public component API — consumers type their props with this. @public */
export type { StatBarProps };
