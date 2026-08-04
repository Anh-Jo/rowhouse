import type { ComponentProps } from 'react';
import { Field } from '@/components/Field/Field';
import './Textarea.css';

type TextareaProps = ComponentProps<'textarea'> & {
  label?: string;
  error?: string;
  hint?: string;
};

function Textarea({ label, error, hint, className = '', id, ...props }: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const errorId = textareaId ? `${textareaId}-error` : undefined;

  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      htmlFor={textareaId}
      errorId={errorId}
      className={`textarea-field${error ? ' textarea-field--error' : ''}${className ? ` ${className}` : ''}`}
    >
      <textarea
        className="textarea-field__input"
        id={textareaId}
        rows={4}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
    </Field>
  );
}

export { Textarea };
/** Public component API — consumers type their props with this. @public */
export type { TextareaProps };
