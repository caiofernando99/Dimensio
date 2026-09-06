import React from 'react';
import { type LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'xs' | 'sm' | 'md';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-xs',
  secondary: 'bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[color-mix(in_srgb,var(--primary-soft)_80%,var(--primary-border))]',
  outline: 'bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--bg)]',
  ghost: 'bg-transparent text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-[11px] gap-1.5 rounded-lg',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9.5 px-4 text-[13px] gap-2 rounded-lg',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  fullWidth = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center font-bold select-none cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--primary)_22%,transparent)] disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {Icon && <Icon className={size === 'md' ? 'w-4 h-4' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />}
      {children}
      {IconRight && <IconRight className={size === 'md' ? 'w-4 h-4' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />}
    </button>
  );
};