import type { ReactNode } from 'react';

type FieldProps = {
  label?: string;
  /** Quiet helper line under the control. */
  hint?: string;
  error?: string;
  /** id of the control the label points at. */
  htmlFor?: string;
  /** id to put on the error element (pair with aria-describedby). */
  errorId?: string;
  children: ReactNode;
  className?: string;
};

/** Label + control + hint/error wrapper — the one layout for every form row. */
function Field({ label, hint, error, htmlFor, errorId, children, className }: FieldProps) {
  return (
    <div className={`form-field${className ? ` ${className}` : ''}`}>
      {label && (
        <label className="form-field__label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && !error && <span className="form-field__hint">{hint}</span>}
      {error && (
        <span className="form-field__error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

export { Field };
/** Public component API — consumers type their props with this. @public */
export type { FieldProps };
