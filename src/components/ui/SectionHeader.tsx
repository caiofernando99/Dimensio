import React from 'react';

export interface SectionHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  icon,
  right,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--line)] pb-2.5 mb-3.5 ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-[var(--primary)] shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)] leading-tight truncate">
            {title}
          </h4>
          {subtitle && <div className="text-[10.5px] text-[var(--muted)] font-medium mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  );
};