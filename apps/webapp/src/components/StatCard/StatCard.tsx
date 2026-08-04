import { InfoTip } from '@/components/InfoTip/InfoTip';
import { formatNumber } from '@/helpers/format';
import './StatCard.css';

type StatCardProps = {
  label: string;
  /** `undefined` or a non-finite number renders the "no data" state. */
  value?: number | string;
  /** Printed after the value in a lighter weight (ha, personnes, °C…). */
  unit?: string;
  /** Methodology note, surfaced through an InfoTip next to the label. */
  hint?: string;
  emptyLabel?: string;
  active?: boolean;
  locale?: string;
  /** Makes the cell selectable — the bar then behaves like a metric switcher. */
  onSelect?: () => void;
  className?: string;
};

/**
 * One measured figure in a stat bar. Three states, all visible in the same
 * layout: measured, selected (ember underline), and no-data.
 */
function StatCard({
  label,
  value,
  unit,
  hint,
  emptyLabel = 'Pas de données',
  active = false,
  locale,
  onSelect,
  className,
}: StatCardProps) {
  const formatted = typeof value === 'number' ? formatNumber(value, locale) : (value ?? null);
  const isEmpty = formatted === null || formatted === '';

  const classes = [
    'stat-card',
    active && 'stat-card--active',
    isEmpty && 'stat-card--empty',
    onSelect && 'stat-card--interactive',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <span className="stat-card__label">
        <span>{label}</span>
        {hint && <InfoTip label={`À propos : ${label}`}>{hint}</InfoTip>}
      </span>
      <span className="stat-card__value ds-numeric">
        {isEmpty ? (
          <span className="stat-card__empty">{emptyLabel}</span>
        ) : (
          <>
            {formatted}
            {unit && <span className="stat-card__unit"> {unit}</span>}
          </>
        )}
      </span>
    </>
  );

  if (!onSelect) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <button type="button" className={classes} onClick={onSelect} aria-pressed={active}>
      {content}
    </button>
  );
}

export { StatCard };
/** Public component API — consumers type their props with this. @public */
export type { StatCardProps };
