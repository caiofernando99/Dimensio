import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X, Filter } from 'lucide-react';

export interface MultiSelectOption {
  label: string;
  value: string;
  badge?: string | number;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
  icon?: React.ReactNode;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = 'Selecionar...',
  allLabel = 'Todos',
  className = '',
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAllSelected = selectedValues.length === options.length && options.length > 0;

  const handleToggleAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange([]);
    }
  };

  const handleToggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      const updated = selectedValues.filter((v) => v !== value);
      onChange(updated);
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative flex-1 min-w-[140px] ${className}`}>
      {label && (
        <label className="block text-[11px] font-extrabold text-[var(--muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
          {icon || <Filter className="w-3 h-3 text-[var(--primary)]" />}
          <span>{label}</span>
          {selectedValues.length > 0 && selectedValues.length < options.length && (
            <span className="ml-auto text-[10px] bg-[var(--primary-soft)] text-[var(--primary)] font-black px-1.5 py-0.2 rounded-full border border-[var(--primary-border)]">
              {selectedValues.length}
            </span>
          )}
        </label>
      )}

      {/* Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 rounded-xl border text-xs font-bold text-left flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
          isOpen
            ? 'border-[var(--primary)] bg-[var(--paper)] ring-2 ring-[var(--primary-border)]'
            : selectedValues.length > 0 && selectedValues.length < options.length
            ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
            : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--primary-border)] hover:shadow-2xs'
        }`}
      >
        <span className="truncate">
          {selectedValues.length === 0
            ? allLabel
            : selectedValues.length === options.length
            ? `${allLabel} (${options.length})`
            : selectedValues.length === 1
            ? options.find((o) => o.value === selectedValues[0])?.label || selectedValues[0]
            : `${selectedValues.length} selecionados`}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selectedValues.length > 0 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full cursor-pointer text-[var(--muted)]"
              title="Limpar seleção"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-[var(--muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] max-w-[320px] bg-[var(--paper)] border-2 border-[var(--primary-border)] rounded-2xl shadow-xl p-2 space-y-1.5 animate-in fade-in duration-100 left-0">
          {options.length > 5 && (
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
            />
          )}

          <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
            {/* Clear Selection Option */}
            <button
              type="button"
              onClick={handleToggleAll}
              className="w-full px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center justify-between hover:bg-[var(--bg)] text-[var(--ink)] cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                    selectedValues.length > 0
                      ? 'bg-rose-100 dark:bg-rose-950 border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400'
                      : 'border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]'
                  }`}
                >
                  {selectedValues.length > 0 && <X className="w-3 h-3 stroke-[3]" />}
                </div>
                <span>{selectedValues.length > 0 ? 'Limpar seleção' : `${allLabel} (todas)`}</span>
              </span>
            </button>

            <div className="border-t border-[var(--line)] my-1"></div>

            {/* Individual Options */}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggleOption(opt.value)}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                        : 'hover:bg-[var(--bg)] text-[var(--ink)]'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <div
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                            : 'border-[var(--line)] bg-[var(--paper)]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{opt.label}</span>
                    </span>

                    {opt.badge !== undefined && (
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)]">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              <p className="text-xs text-[var(--muted)] py-2 text-center italic">Nenhuma opção encontrada</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
