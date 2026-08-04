import './StatusPill.css';

type StatusPillProps = {
  status: 'ok' | 'error' | 'pending' | 'neutral';
  /** Defaults to the uppercased status itself (OK / ERROR / …). */
  label?: string;
  className?: string;
};

/** Machine-status marker (audit OK/ERROR): mono, uppercase, dot + label. */
function StatusPill({ status, label, className }: StatusPillProps) {
  return (
    <span className={`status-pill status-pill--${status}${className ? ` ${className}` : ''}`}>
      <span className="status-pill__dot" aria-hidden />
      {label ?? status.toUpperCase()}
    </span>
  );
}

export { StatusPill };
/** Public component API — consumers type their props with this. @public */
export type { StatusPillProps };
