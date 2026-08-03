import { useId } from 'react';
import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import './Select.css';

type SelectProps = {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
};

function Select({ label, placeholder = 'Selectionner...', options, value, defaultValue, onValueChange, error, disabled, className }: SelectProps) {
  const generatedId = useId();
  const triggerId = `select-trigger-${generatedId}`;
  const errorId = `select-error-${generatedId}`;

  return (
    <div className={`form-field select-field${error ? ' select-field--error' : ''}${className ? ` ${className}` : ''}`}>
      {label && <label className="form-field__label" htmlFor={triggerId}>{label}</label>}
      <RadixSelect.Root value={value} defaultValue={value === undefined ? defaultValue : undefined} onValueChange={onValueChange} disabled={disabled}>
        <RadixSelect.Trigger className="select-field__trigger" id={triggerId} aria-invalid={!!error} aria-describedby={error ? errorId : undefined}>
          <RadixSelect.Value placeholder={placeholder} />
          <RadixSelect.Icon className="select-field__chevron">
            <ChevronDown size={16} />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>
        <RadixSelect.Portal>
          <RadixSelect.Content className="select-field__content" position="popper" sideOffset={4}>
            <RadixSelect.Viewport className="select-field__viewport">
              {options.map((option) => (
                <RadixSelect.Item key={option.value} value={option.value} className="select-field__item">
                  <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  <RadixSelect.ItemIndicator className="select-field__indicator">
                    <Check size={14} />
                  </RadixSelect.ItemIndicator>
                </RadixSelect.Item>
              ))}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>
      {error && <span className="form-field__error" id={errorId}>{error}</span>}
    </div>
  );
}

export { Select };
