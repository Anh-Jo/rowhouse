import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { DataTableProps, SortDirection } from './types';
import './DataTable.css';

function DataTable<T>({ columns, data, keyExtractor, onRowClick, actions, emptyMessage = 'Aucune donnee', className }: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortKey(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const col = columns.find((c) => c.key === sortKey);
      if (!col) return 0;
      const aVal = col.sortValue ? col.sortValue(a) : String(col.render(a));
      const bVal = col.sortValue ? col.sortValue(b) : String(col.render(b));
      const cmp = typeof aVal === 'number' && typeof bVal === 'number'
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal), 'fr', { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return <ArrowUpDown size={14} />;
    if (sortDir === 'asc') return <ArrowUp size={14} />;
    return <ArrowDown size={14} />;
  };

  if (data.length === 0) {
    return <div className="data-table__empty">{emptyMessage}</div>;
  }

  return (
    <div className={`data-table__wrapper${className ? ` ${className}` : ''}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`data-table__th ${col.sortable ? 'data-table__th--sortable' : ''}`}
                style={col.width ? { width: col.width } : undefined}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                aria-sort={col.sortable ? (sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : 'none') : 'none') : undefined}
                role={col.sortable ? 'button' : undefined}
                tabIndex={col.sortable ? 0 : undefined}
                onKeyDown={col.sortable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col.key); } } : undefined}
              >
                <span className="data-table__th-content">
                  {col.header}
                  {col.sortable && <span className="data-table__sort-icon">{getSortIcon(col.key)}</span>}
                </span>
              </th>
            ))}
            {actions && <th className="data-table__th" style={{ width: '120px' }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row) => (
            <tr
              key={keyExtractor(row)}
              className={`data-table__row ${onRowClick ? 'data-table__row--clickable' : ''}`}
              onClick={() => onRowClick?.(row)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } } : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} className="data-table__td">
                  {col.render(row)}
                </td>
              ))}
              {actions && (
                <td className="data-table__td data-table__td--actions" onClick={(e) => e.stopPropagation()}>
                  {actions(row)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { DataTable };
/** Public component API — consumers type their props with this. @public */
export type { DataTableProps, Column } from './types';
