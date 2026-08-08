import type { ReactNode } from 'react';
import './Card.css';

type CardProps = {
  /** Optional header block; omit all three for a plain surface. */
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Bordered surface section — borders over shadows, 6px radius, no drama. */
function Card({ title, description, actions, children, className }: CardProps) {
  const hasHeader = Boolean(title || description || actions);
  return (
    <section className={`card${className ? ` ${className}` : ''}`}>
      {hasHeader && (
        <header className="card__header">
          <div className="card__heading">
            {title && <h2 className="card__title">{title}</h2>}
            {description && <p className="card__description">{description}</p>}
          </div>
          {actions && <div className="card__actions">{actions}</div>}
        </header>
      )}
      <div className="card__body">{children}</div>
    </section>
  );
}

export { Card };
/** Public component API — consumers type their props with this. @public */
export type { CardProps };
