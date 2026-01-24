// ============================================================================
// FilterBar Component
// Barre de filtres réutilisable
// ============================================================================

import { Input } from '@components/ui/input';
import { Button } from '@components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Search, X } from 'lucide-react';

export interface FilterOption {
  key: string;
  label: string;
  type: 'select' | 'text' | 'date';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface FilterBarProps {
  filters: FilterOption[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onReset: () => void;
  showReset?: boolean;
}

export function FilterBar({
  filters,
  values,
  onChange,
  onReset,
  showReset = true,
}: FilterBarProps) {
  const hasActiveFilters = Object.values(values).some((v) => v !== '');

  return (
    <div className="flex flex-wrap gap-4 items-end">
      {filters.map((filter) => (
        <div key={filter.key} className="flex-1 min-w-[200px]">
          <label className="text-sm font-medium mb-2 block">
            {filter.label}
          </label>
          {filter.type === 'select' && filter.options ? (
            <Select
              value={values[filter.key] || ''}
              onValueChange={(value) => onChange(filter.key, value)}
            >
              <SelectTrigger>
                <SelectValue placeholder={filter.placeholder || 'Sélectionner...'} />
              </SelectTrigger>
              <SelectContent>
                {filter.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : filter.type === 'date' ? (
            <Input
              type="date"
              value={values[filter.key] || ''}
              onChange={(e) => onChange(filter.key, e.target.value)}
            />
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={filter.placeholder || 'Rechercher...'}
                value={values[filter.key] || ''}
                onChange={(e) => onChange(filter.key, e.target.value)}
                className="pl-10"
              />
            </div>
          )}
        </div>
      ))}

      {showReset && hasActiveFilters && (
        <Button
          variant="outline"
          onClick={onReset}
          className="flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          Réinitialiser
        </Button>
      )}
    </div>
  );
}
