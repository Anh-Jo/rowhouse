import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import './Checkbox.css';

type CheckboxProps = {
  label?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
};

function Checkbox({ label, checked, defaultChecked, onCheckedChange, disabled, id, className }: CheckboxProps) {
  const checkboxId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`checkbox-field${className ? ` ${className}` : ''}`}>
      <RadixCheckbox.Root
        className="checkbox-field__root"
        checked={checked}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        onCheckedChange={(val) => onCheckedChange?.(val === true)}
        disabled={disabled}
        id={checkboxId}
      >
        <RadixCheckbox.Indicator className="checkbox-field__indicator">
          <Check size={14} />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      {label && (
        <label className="checkbox-field__label" htmlFor={checkboxId}>
          {label}
        </label>
      )}
    </div>
  );
}

export { Checkbox };
