import React from 'react';
import { type LucideIcon } from 'lucide-react';

export type StatTone = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

const iconTone: Record<StatTone, string> = {
  default: 'bg-[var(--surface-3)] text-[var(--muted)]',
  primary: 'bg-[var(--primary-soft)] text-[var(--primary)]',
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
  danger: 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
  info: 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400',
};

const valueTone: Record<StatTone, string> = {
  default: 'text-[var(--ink)]',
  primary: 'text-[var(--primary)]',
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-rose-600 dark:text-rose-400',
  info: 'text-sky-600 dark:text-sky-400',
  purple: 'text-purple-600 dark:text-purple-400',
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  tone?: StatTone;
  hint?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon: Icon,
  tone = 'default',
  hint,
  onClick,
  className = '',
}) => {
  const Wrapper: React.ElementType = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3.5 shadow-[var(--shadow-card)] text-left ${
        onClick ? 'cursor-pointer hover:border-[var(--primary-border)] hover:shadow-[var(--shadow-card)] transition-all active:scale-[0.99]' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] truncate">{label}</p>
          <p className={`text-2xl font-black leading-tight mt-0.5 ${valueTone[tone]}`}>{value}</p>
        </div>
        {Icon && (
          <div className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center ${iconTone[tone]}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
        )}
      </div>
      {hint && <div className="text-[10.5px] text-[var(--muted)] font-semibold mt-1 truncate">{hint}</div>}
    </Wrapper>
  );
};