import type { ReactNode } from 'react';

export type Column<T> = {
  key: string;
  /** Header cell content — plain text or decorated (badges…). */
  header: ReactNode;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  width?: string;
};

export type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => ReactNode;
  emptyMessage?: string;
  className?: string;
};

export type SortDirection = 'asc' | 'desc' | null;
