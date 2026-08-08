import type { ComponentProps, ReactNode } from 'react';
import './Input.css';

// ComponentProps (not InputHTMLAttributes) so `ref` is accepted as a regular
// prop (React 19) — react-hook-form's `register` spread relies on it.
type InputProps = ComponentProps<'input'> & {
  label?: string;
  error?: string;
  icon?: ReactNode;
};

function Input({ label, error, icon, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const errorId = inputId ? `${inputId}-error` : undefined;

  return (
    <div className={`form-field input-field ${error ? 'input-field--error' : ''} ${className}`}>
      {label && (
        <label className="form-field__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className="input-field__wrapper">
        {icon && <span className="input-field__icon">{icon}</span>}
        <input className={`input-field__input ${icon ? 'input-field__input--with-icon' : ''}`} id={inputId} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} {...props} />
      </div>
      {error && <span className="form-field__error" id={errorId}>{error}</span>}
    </div>
  );
}

export { Input };
/** Public component API — consumers type their props with this. @public */
export type { InputProps };
