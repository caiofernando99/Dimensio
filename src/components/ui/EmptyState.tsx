import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center gap-2 py-10 px-6 border border-dashed border-[var(--line)] rounded-xl bg-[var(--surface-2)] ${className}`}
    >
      {Icon && (
        <div className="w-11 h-11 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div>
        <div className="text-sm font-extrabold text-[var(--ink)]">{title}</div>
        {description && <div className="text-xs text-[var(--muted)] mt-0.5 max-w-sm">{description}</div>}
      </div>
      {actionLabel && onAction && <Button size="sm" variant="secondary" onClick={onAction}>{actionLabel}</Button>}
    </div>
  );
};