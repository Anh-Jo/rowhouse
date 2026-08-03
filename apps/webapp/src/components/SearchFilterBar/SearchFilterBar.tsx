import { Search } from 'lucide-react';
import { Input } from '@/components/Input/Input';
import { Select } from '@/components/Select/Select';
import './SearchFilterBar.css';

function SearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  filters = [],
  className,
}: SearchFilterBarProps) {
  return (
    <div className={`search-filter-bar${className ? ` ${className}` : ''}`}>
      <div className="search-filter-bar__search">
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          icon={<Search size={16} />}
          aria-label="Rechercher"
        />
      </div>
      {filters.length > 0 && (
        <div className="search-filter-bar__filters">
          {filters.map((filter) => (
            <Select
              key={filter.key}
              placeholder={filter.placeholder}
              options={filter.options}
              value={filter.value}
              onValueChange={filter.onValueChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export { SearchFilterBar };
