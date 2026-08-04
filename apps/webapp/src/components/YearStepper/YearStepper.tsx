import { ArrowLeft, ArrowRight } from 'lucide-react';
import './YearStepper.css';

type YearStepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (year: number) => void;
  /** Field name printed above the control. */
  label?: string;
  /** Provenance of the selected period, e.g. "EFFIS · provisoire". */
  caption?: string;
  captionTone?: 'accent' | 'muted';
  previousLabel?: string;
  nextLabel?: string;
  className?: string;
};

/**
 * Period selector of a data story. Deliberately one year at a time: the arrows
 * are the reading rhythm, and they stop hard at the edges of the dataset.
 */
function YearStepper({
  value,
  min,
  max,
  onChange,
  label,
  caption,
  captionTone = 'accent',
  previousLabel = 'Année précédente',
  nextLabel = 'Année suivante',
  className,
}: YearStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;

  return (
    <div className={`year-stepper${className ? ` ${className}` : ''}`}>
      {label && <span className="year-stepper__label">{label}</span>}
      <div className="year-stepper__control">
        <button
          type="button"
          className="year-stepper__arrow"
          onClick={() => onChange(value - 1)}
          disabled={atMin}
          aria-label={previousLabel}
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        <output className="year-stepper__value ds-numeric">{value}</output>
        <button
          type="button"
          className="year-stepper__arrow"
          onClick={() => onChange(value + 1)}
          disabled={atMax}
          aria-label={nextLabel}
        >
          <ArrowRight size={16} strokeWidth={1.5} />
        </button>
      </div>
      {caption && (
        <span className={`year-stepper__caption year-stepper__caption--${captionTone}`}>
          {caption}
        </span>
      )}
    </div>
  );
}

export { YearStepper };
/** Public component API — consumers type their props with this. @public */
export type { YearStepperProps };
