import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  flush?: boolean;
}

export const Card: React.FC<CardProps> = ({
  padded = true,
  flush = false,
  className = '',
  children,
  ...rest
}) => {
  return (
    <div
      className={`bg-[var(--paper)] border border-[var(--line)] rounded-xl shadow-[var(--shadow-card)] ${
        padded && !flush ? 'p-4 sm:p-5' : ''
      } ${flush ? 'overflow-hidden' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  icon,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2.5 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && (
          <div className="w-9 h-9 shrink-0 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-[var(--ink)] leading-tight truncate">{title}</h3>
          {subtitle && <div className="text-[11px] text-[var(--muted)] font-medium mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardBody: React.FC<CardBodyProps> = ({ className = '', children, ...rest }) => {
  return (
    <div className={`${className}`} {...rest}>
      {children}
    </div>
  );
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter: React.FC<CardFooterProps> = ({ className = '', children, ...rest }) => {
  return (
    <div className={`mt-4 pt-3.5 border-t border-[var(--line)] ${className}`} {...rest}>
      {children}
    </div>
  );
};