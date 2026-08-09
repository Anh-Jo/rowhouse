import { useId, useState } from 'react';
import { CornerUpRight, Search, X } from 'lucide-react';
import { Button } from '@/components/Button/Button';
import { Field } from '@/components/Field/Field';
import type { SchemaColumnDto, SchemaTableDto } from '@/api/schema';
import type { ColumnRelation } from '../helpers/column-relation';
import { RelationPicker } from './RelationPicker';
import './RelationField.css';

type RelationFieldProps = {
  column: SchemaColumnDto;
  relation: ColumnRelation;
  /** The referenced table, or undefined when it is not in the snapshot. */
  targetTable: SchemaTableDto | undefined;
  /** Canonical string value of the FK column; `''` means NULL. */
  value: string;
  onChange: (value: string) => void;
  /** Human identity of the row currently referenced, when the API resolved it. */
  initialIdentity?: string;
  /** Type/nullability line shared with the other editor controls. */
  hint?: string;
  ids: { workspaceId: string; projectId: string; datasourceId: string };
};

/**
 * The editor control for a foreign-key column: a **read-only** value plus a
 * "Select" action that opens the referenced table in a drawer. A relation is
 * an identity, not a string — typing one by hand is how records end up
 * pointing at rows that do not exist, so the field never accepts free input.
 * Clearing is offered only where the column is nullable.
 *
 * When the referenced table is missing from the schema snapshot there is no
 * list to pick from; the field then stays read-only and says why, rather than
 * falling back to a text box that could write a dangling key.
 */
function RelationField({
  column,
  relation,
  targetTable,
  value,
  onChange,
  initialIdentity,
  hint,
  ids,
}: RelationFieldProps) {
  const [open, setOpen] = useState(false);
  // Identity of the referenced row: the API resolved the loaded one, the
  // picker names the one just chosen. Null value carries no identity.
  const [identity, setIdentity] = useState(initialIdentity ?? '');
  const buttonId = useId();

  const target = `${relation.tableName}.${relation.columnName}`;
  const hintLine = [hint, `→ ${target}`].filter(Boolean).join(' · ');

  if (!targetTable) {
    return (
      <Field
        label={column.name}
        hint={`${hintLine} · not in this schema snapshot — sync the schema to edit it`}
        className="relation-field"
      >
        <span className="relation-field__value relation-field__value--muted">
          {value === '' ? '∅ null' : value}
        </span>
      </Field>
    );
  }

  return (
    <Field
      label={column.name}
      hint={hintLine}
      htmlFor={buttonId}
      className="relation-field"
    >
      <div className="relation-field__control">
        <span className="relation-field__value">
          {value === '' ? (
            <span className="relation-field__null">∅ null</span>
          ) : (
            <>
              <CornerUpRight size={13} aria-hidden />
              <span className="relation-field__key">{value}</span>
              {identity !== '' && identity !== value && (
                <span className="relation-field__identity">· {identity}</span>
              )}
            </>
          )}
        </span>
        <span className="relation-field__actions">
          <Button
            type="button"
            id={buttonId}
            variant="secondary"
            size="sm"
            icon={<Search size={14} />}
            onClick={() => setOpen(true)}
          >
            {value === '' ? 'Select' : 'Change'}
          </Button>
          {column.isNullable && value !== '' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={<X size={14} />}
              iconOnly
              aria-label={`Clear ${column.name}`}
              onClick={() => {
                onChange('');
                setIdentity('');
              }}
            />
          )}
        </span>
      </div>
      <RelationPicker
        open={open}
        onOpenChange={setOpen}
        workspaceId={ids.workspaceId}
        projectId={ids.projectId}
        datasourceId={ids.datasourceId}
        table={targetTable}
        valueColumn={relation.columnName}
        currentValue={value}
        nullable={column.isNullable}
        onSelect={(next, nextIdentity) => {
          onChange(next);
          setIdentity(nextIdentity);
        }}
      />
    </Field>
  );
}

export { RelationField };
