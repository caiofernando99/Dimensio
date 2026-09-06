import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Buscar colaborador por nome...',
  className = '',
}) => {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-9 py-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          title="Limpar pesquisa"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
