import React from 'react';
import { type LucideIcon } from 'lucide-react';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  meta,
  icon: Icon,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-wrap items-start justify-between gap-3 mb-4 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="w-10 h-10 shrink-0 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shadow-[var(--shadow-card)]">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-extrabold text-[var(--ink)] tracking-tight leading-tight truncate">
            {title}
          </h2>
          {subtitle && <div className="text-xs text-[var(--muted)] font-medium mt-0.5">{subtitle}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {meta}
        {actions}
      </div>
    </div>
  );
};