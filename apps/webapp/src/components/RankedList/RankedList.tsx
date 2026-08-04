import { formatNumber, formatRank } from '@/helpers/format';
import './RankedList.css';

/**
 * Ordered leaderboard of a dimension ("les plus touchés"). Ranks are printed as
 * two-digit markers and values are tabular, so the column reads as a table
 * without drawing a table.
 */
function RankedList({
  items,
  unit,
  selectedId,
  onSelect,
  startRank = 1,
  emptyMessage = 'Aucune donnée',
  locale,
  className,
}: RankedListProps) {
  if (items.length === 0) {
    return (
      <p className={`ranked-list__empty${className ? ` ${className}` : ''}`}>{emptyMessage}</p>
    );
  }

  return (
    <ol className={`ranked-list${className ? ` ${className}` : ''}`}>
      {items.map((item, index) => {
        const selected = item.id === selectedId;
        const row = (
          <>
            <span className="ranked-list__rank ds-numeric">{formatRank(startRank + index)}</span>
            <span className="ranked-list__label">{item.label}</span>
            <span className="ranked-list__value ds-numeric">
              {formatNumber(item.value, locale) ?? '—'}
              {unit && <span className="ranked-list__unit"> {unit}</span>}
            </span>
          </>
        );

        return (
          <li
            key={item.id}
            className={`ranked-list__row${selected ? ' ranked-list__row--selected' : ''}`}
          >
            {onSelect ? (
              <button
                type="button"
                className="ranked-list__button"
                onClick={() => onSelect(item.id)}
                aria-current={selected ? 'true' : undefined}
              >
                {row}
              </button>
            ) : (
              <span className="ranked-list__static">{row}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export { RankedList };
