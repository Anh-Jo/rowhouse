import type { TextareaHTMLAttributes } from 'react';
import './Textarea.css';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
};

function Textarea({ label, error, className = '', id, ...props }: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const errorId = textareaId ? `${textareaId}-error` : undefined;

  return (
    <div className={`form-field textarea-field ${error ? 'textarea-field--error' : ''} ${className}`}>
      {label && (
        <label className="form-field__label" htmlFor={textareaId}>
          {label}
        </label>
      )}
      <textarea className="textarea-field__input" id={textareaId} rows={4} aria-invalid={!!error} aria-describedby={error ? errorId : undefined} {...props} />
      {error && <span className="form-field__error" id={errorId}>{error}</span>}
    </div>
  );
}

export { Textarea };
/** Public component API — consumers type their props with this. @public */
export type { TextareaProps };
