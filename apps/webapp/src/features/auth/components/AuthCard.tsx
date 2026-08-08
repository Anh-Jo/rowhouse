import type { ReactNode } from 'react';
import './AuthCard.css';

type AuthCardProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** Centered card shared by the public auth pages (sign-in / sign-up). */
function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="auth-page">
      <main className="auth-card">
        <header className="auth-card__header">
          <span className="auth-card__brand">Rowhouse</span>
          <h1 className="auth-card__title">{title}</h1>
          {subtitle && <p className="auth-card__subtitle">{subtitle}</p>}
        </header>
        {children}
        {footer && <footer className="auth-card__footer">{footer}</footer>}
      </main>
    </div>
  );
}

export { AuthCard };
