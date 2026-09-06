import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Filter, X } from 'lucide-react';
import { StandardSelectorOption } from '../types/interactions';

export interface SingleSelectOption {
  label: string;
  value: string;
  badge?: string | number;
  icon?: React.ReactNode;
}

export interface SingleSelectFilterProps {
  label?: string;
  options: (SingleSelectOption | StandardSelectorOption)[];
  value: string | null;
  onChange: (value: string | null) => void;
  allLabel?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  required?: boolean;
}

export const SingleSelectFilter: React.FC<SingleSelectFilterProps> = ({
  label,
  options,
  value,
  onChange,
  allLabel,
  placeholder = 'Selecionar...',
  icon,
  className = '',
  required = false,
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

  const isNone = value === null || value === '' || value === 'all' || value === 'ALL' || value === 'todos';

  const selectOption = (v: string | null) => {
    onChange(v);
    setIsOpen(false);
    setSearchTerm('');
  };

  const selectedOpt = options.find((o) => o.value === value);
  const selectedLabel = selectedOpt?.label;

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div ref={containerRef} className={`relative flex-1 min-w-[140px] ${className}`}>
      {label && (
        <label className="block text-[11px] font-extrabold text-[var(--muted)] uppercase tracking-wider mb-1 flex items-center gap-1">
          {icon || <Filter className="w-3 h-3 text-[var(--primary)]" />}
          <span>{label}</span>
          {!isNone && selectedOpt?.badge !== undefined && (
            <span className="ml-auto text-[10px] bg-[var(--primary-soft)] text-[var(--primary)] font-black px-1.5 py-0.2 rounded-full border border-[var(--primary-border)]">
              {selectedOpt.badge}
            </span>
          )}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 rounded-xl border text-xs font-bold text-left flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
          isOpen
            ? 'border-[var(--primary)] bg-[var(--paper)] ring-2 ring-[var(--primary-border)]'
            : !isNone
            ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
            : 'border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:border-[var(--primary-border)] hover:shadow-2xs'
        }`}
      >
        <span className="truncate">{isNone ? allLabel || placeholder : selectedLabel || value}</span>
        <div className="flex items-center gap-1 shrink-0">
          {!isNone && !required && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                selectOption(allLabel ? (allLabel.toLowerCase().includes('todos') ? 'all' : null) : null);
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
              autoFocus
            />
          )}

          <div className="max-h-52 overflow-y-auto space-y-0.5 pr-1">
            {allLabel && !required && (
              <>
                <button
                  type="button"
                  onClick={() => selectOption(allLabel.toLowerCase().includes('todos') ? 'all' : null)}
                  className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center justify-between gap-2 hover:bg-[var(--bg)] transition-colors cursor-pointer ${
                    isNone ? 'text-[var(--primary)] bg-[var(--primary-soft)]' : 'text-[var(--ink)]'
                  }`}
                >
                  <span className="truncate">{allLabel}</span>
                  {isNone && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0 text-[var(--primary)]" />}
                </button>
                <div className="border-t border-[var(--line)] my-1"></div>
              </>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = value !== null && (opt.value === value || (!value && opt.value === 'all'));
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => selectOption(opt.value)}
                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2 hover:bg-[var(--bg)] transition-colors cursor-pointer ${
                      isSelected
                        ? 'text-[var(--primary)] font-black bg-[var(--primary-soft)]'
                        : 'text-[var(--ink)] font-bold'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <span className="truncate">{opt.label}</span>
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge !== undefined && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-md bg-[var(--bg)] text-[var(--muted)] border border-[var(--line)]">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0 text-[var(--primary)]" />}
                    </div>
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
