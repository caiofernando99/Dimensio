import React from 'react';
import { ChevronDown } from 'lucide-react';

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  htmlFor?: string;
  className?: string;
}

export const Field: React.FC<FieldProps & { children: React.ReactNode }> = ({
  label,
  hint,
  error,
  htmlFor,
  className = '',
  children,
}) => {
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="text-[11px] font-bold text-rose-600">{error}</span>
      ) : hint ? (
        <span className="text-[11px] text-[var(--muted)]">{hint}</span>
      ) : null}
    </div>
  );
};

const baseInput =
  'w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)] placeholder:text-[var(--muted)]/60 focus:outline-none focus:border-[var(--primary)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--primary)_18%,transparent)] hover:border-[var(--primary-border)] transition-all';

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...rest
}) => <input className={`${baseInput} h-9 px-3 ${className}`} {...rest} />;

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  ...rest
}) => (
  <div className="relative w-full">
    <select
      className={`${baseInput} h-9 px-3 pr-8 appearance-none cursor-pointer ${className}`}
      {...rest}
    >
      {children}
    </select>
    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--muted)]">
      <ChevronDown className="w-3.5 h-3.5" />
    </div>
  </div>
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...rest
}) => <textarea className={`${baseInput} px-3 py-2 min-h-[80px] font-medium ${className}`} {...rest} />;

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled, label, hint, className = '' }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-3 w-full text-left cursor-pointer disabled:opacity-50 ${className}`}
    >
      <span
        className={`relative inline-flex h-5.5 w-10 shrink-0 items-center rounded-full transition-colors duration-200 ${
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--line)]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
      {(label || hint) && (
        <span className="min-w-0">
          {label && <span className="block text-xs font-bold text-[var(--ink)]">{label}</span>}
          {hint && <span className="block text-[11px] text-[var(--muted)] font-medium">{hint}</span>}
        </span>
      )}
    </button>
  );
};