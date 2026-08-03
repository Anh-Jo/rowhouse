import { useId } from 'react';
import * as RadixSlider from '@radix-ui/react-slider';
import './Slider.css';

type SliderProps = {
  label?: string;
  value?: number;
  defaultValue?: number[];
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  className?: string;
};

function Slider({
  label,
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  showValue = true,
  formatValue = (v) => `${v}%`,
  className,
}: SliderProps) {
  const generatedId = useId();
  const labelId = `slider-label-${generatedId}`;
  const displayValue = value ?? defaultValue?.[0] ?? min;

  return (
    <div className={`slider-field${className ? ` ${className}` : ''}`}>
      {(label || showValue) && (
        <div className="slider-field__header">
          {label && <label className="slider-field__label" id={labelId}>{label}</label>}
          {showValue && <span className="slider-field__value">{formatValue(displayValue)}</span>}
        </div>
      )}
      <RadixSlider.Root
        className="slider-field__root"
        aria-labelledby={label ? labelId : undefined}
        {...(value !== undefined ? { value: [value] } : { defaultValue: defaultValue ?? [min] })}
        onValueChange={(vals) => onValueChange?.(vals[0])}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      >
        <RadixSlider.Track className="slider-field__track">
          <RadixSlider.Range className="slider-field__range" />
        </RadixSlider.Track>
        <RadixSlider.Thumb className="slider-field__thumb" />
      </RadixSlider.Root>
    </div>
  );
}

export { Slider };
