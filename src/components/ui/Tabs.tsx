import React from 'react';
import { type LucideIcon } from 'lucide-react';

export interface TabItem {
  value: string;
  label: React.ReactNode;
  icon?: LucideIcon;
  badge?: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ items, value, onChange, className = '' }) => {
  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1 bg-[var(--surface-2)] border border-[var(--line)] p-1 rounded-xl max-w-full ${className}`}
      role="tablist"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--primary)_22%,transparent)] ${
              isActive
                ? 'bg-[var(--paper)] text-[var(--primary)] shadow-2xs'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {item.label}
            {item.badge != null && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                  isActive ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'bg-[var(--surface-3)] text-[var(--muted)]'
                }`}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};