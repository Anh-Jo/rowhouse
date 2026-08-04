import type { ReactNode } from 'react';
import './PageHeader.css';

type PageHeaderProps = {
  /** Uppercase micro-label above the title (section eyebrow). */
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned actions (buttons…). */
  actions?: ReactNode;
  className?: string;
};

/** Standard page heading: eyebrow / title / subtitle with optional actions. */
function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header className={`page-header${className ? ` ${className}` : ''}`}>
      <div className="page-header__heading">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 className="page-header__title">{title}</h1>
        {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export { PageHeader };
/** Public component API — consumers type their props with this. @public */
export type { PageHeaderProps };
