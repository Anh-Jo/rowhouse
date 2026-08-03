import './Badge.css';

type BadgeProps = {
  label: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
  size?: 'sm' | 'md';
  className?: string;
};

function Badge({ label, variant = 'default', size = 'sm', className }: BadgeProps) {
  const classes = ['badge', `badge--${variant}`, `badge--${size}`].join(' ');
  return <span className={`${classes}${className ? ` ${className}` : ''}`}>{label}</span>;
}

export { Badge };
/** Public component API — consumers type their props with this. @public */
export type { BadgeProps };
