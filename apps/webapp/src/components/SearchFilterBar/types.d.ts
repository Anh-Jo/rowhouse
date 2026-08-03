type FilterConfig = {
  key: string;
  placeholder: string;
  options: SelectOption[];
  value?: string;
  onValueChange?: (value: string) => void;
};

type SearchFilterBarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  className?: string;
};
