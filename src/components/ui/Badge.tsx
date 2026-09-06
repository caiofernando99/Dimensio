import React from 'react';

export type BadgeTone =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--surface-3)] text-[var(--muted)]',
  primary: 'bg-[var(--primary-soft)] text-[var(--primary)]',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  tone = 'neutral',
  dot = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-extrabold whitespace-nowrap ${toneClasses[tone]} ${className}`}
      {...rest}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
};