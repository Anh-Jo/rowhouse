import type { ReactNode } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import './Callout.css';

type CalloutProps = {
  variant?: 'info' | 'success' | 'warning' | 'danger' | 'pii';
  /** Bold first line; omit for a single-line message. */
  title?: string;
  /** Override the default per-variant icon; `null` hides it. */
  icon?: ReactNode;
  children: ReactNode;
  /** Defaults to alert for danger/warning, status otherwise. */
  role?: 'alert' | 'status';
  className?: string;
};

const DEFAULT_ICONS = {
  info: <Info size={18} aria-hidden />,
  success: <CheckCircle2 size={18} aria-hidden />,
  warning: <AlertTriangle size={18} aria-hidden />,
  danger: <XCircle size={18} aria-hidden />,
  pii: <ShieldAlert size={18} aria-hidden />,
} as const;

/** Bordered inline message panel — the calm voice for outcomes and guardrails. */
function Callout({ variant = 'info', title, icon, children, role, className }: CalloutProps) {
  const resolvedRole =
    role ?? (variant === 'danger' || variant === 'warning' ? 'alert' : 'status');
  return (
    <div
      className={`callout callout--${variant}${className ? ` ${className}` : ''}`}
      role={resolvedRole}
    >
      <span className="callout__icon">{icon === undefined ? DEFAULT_ICONS[variant] : icon}</span>
      <div className="callout__body">
        {title && <strong className="callout__title">{title}</strong>}
        <div className="callout__content">{children}</div>
      </div>
    </div>
  );
}

export { Callout };
/** Public component API — consumers type their props with this. @public */
export type { CalloutProps };
