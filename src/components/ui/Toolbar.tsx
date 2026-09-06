import React from 'react';

export interface ToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export const Toolbar: React.FC<ToolbarProps> = ({ children, className = '' }) => {
  return (
    <div
      className={`flex flex-wrap items-center gap-2.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-2.5 ${className}`}
    >
      {children}
    </div>
  );
};