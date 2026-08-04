import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'accent' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  iconOnly?: boolean;
  fab?: boolean;
  children?: ReactNode;
};

function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconOnly = false,
  fab = false,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    iconOnly && 'btn--icon-only',
    fab && 'btn--fab',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} {...props}>
      {icon && <span className="btn__icon">{icon}</span>}
      {!iconOnly && children && <span className="btn__label">{children}</span>}
    </button>
  );
}

export { Button };
/** Public component API — consumers type their props with this. @public */
export type { ButtonProps };
