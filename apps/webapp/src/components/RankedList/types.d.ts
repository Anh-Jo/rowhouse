type RankedItem = {
  id: string;
  label: string;
  /** Raw figure — formatting is the list's job, so every row aligns. */
  value: number;
};

type RankedListProps = {
  items: RankedItem[];
  /** Printed after each value in a lighter weight (ha, km²…). */
  unit?: string;
  selectedId?: string;
  onSelect?: (id: string) => void;
  /** Rank of the first row — lets a list continue a previous page. */
  startRank?: number;
  emptyMessage?: string;
  locale?: string;
  className?: string;
};
