import { useState } from 'react';
import { ListFilter } from 'lucide-react';
import { Button } from '@/components/Button/Button';
import { Input } from '@/components/Input/Input';
import { Popover } from '@/components/Popover/Popover';
import { Select } from '@/components/Select/Select';
import type { SchemaColumnDto } from '@/api/schema';
import {
  OP_LABELS,
  coerceFilterValue,
  columnKind,
  opNeedsValue,
  operatorsForColumn,
  type FilterOp,
  type RowFilter,
} from '../helpers/row-query';

/** What the value input hints at, per column family. */
const VALUE_PLACEHOLDERS: Record<string, string> = {
  number: 'e.g. 42',
  date: 'e.g. 2026-08-01',
  boolean: 'true or false',
};

/**
 * The filter affordance of one column header: a small funnel button opening
 * a popover with an operator select (adapted to the column's snapshot type),
 * a value input (hidden for the NULL checks) and apply/clear. Applying hands
 * a ready-to-serialize filter up to the grid; clearing drops every filter of
 * this column.
 */
function ColumnFilterPopover({
  column,
  activeCount,
  onApply,
  onClear,
}: {
  column: SchemaColumnDto;
  /** How many filters currently target this column (badges the funnel). */
  activeCount: number;
  onApply: (filter: RowFilter) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const operators = operatorsForColumn(column.dataType);
  const [op, setOp] = useState<FilterOp>(operators[0]);
  const [value, setValue] = useState('');

  const needsValue = opNeedsValue(op);
  const canApply = !needsValue || value !== '';

  const apply = () => {
    if (!canApply) {
      return;
    }
    onApply(
      needsValue
        ? {
            column: column.name,
            op,
            value: coerceFilterValue(column.dataType, value),
          }
        : { column: column.name, op },
    );
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      className="column-filter__popover"
      trigger={
        <button
          type="button"
          className={`column-filter__trigger${
            activeCount > 0 ? ' column-filter__trigger--active' : ''
          }`}
          aria-label={`Filter ${column.name}`}
        >
          <ListFilter size={13} aria-hidden />
          {activeCount > 0 && (
            <span className="column-filter__count">{activeCount}</span>
          )}
        </button>
      }
    >
      <form
        className="column-filter__form"
        onSubmit={(event) => {
          event.preventDefault();
          apply();
        }}
      >
        <p className="column-filter__title">
          Filter <code>{column.name}</code>
        </p>
        <Select
          label="Operator"
          options={operators.map((operator) => ({
            value: operator,
            label: OP_LABELS[operator],
          }))}
          value={op}
          onValueChange={(next) => setOp(next as FilterOp)}
        />
        {needsValue && (
          <Input
            label="Value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={VALUE_PLACEHOLDERS[columnKind(column.dataType)] ?? 'Value'}
            // Distinct id per column — the label-derived default would
            // collide across the simultaneous header popovers.
            id={`column-filter-value-${column.id}`}
          />
        )}
        <div className="column-filter__actions">
          <Button type="submit" size="sm" disabled={!canApply}>
            Apply
          </Button>
          {activeCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </form>
    </Popover>
  );
}

export { ColumnFilterPopover };
