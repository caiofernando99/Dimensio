import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  className?: string;
  hideClose?: boolean;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  footer,
  size = 'md',
  children,
  className = '',
  hideClose = false,
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', onKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className={`relative z-10 w-full ${sizeClasses[size]} bg-[var(--paper)] border border-[var(--line)] rounded-t-2xl sm:rounded-2xl shadow-[var(--shadow-pop)] flex flex-col max-h-[92vh] sm:max-h-[88vh] ${className}`}
          >
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[var(--line)] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {icon && (
                    <div className="w-9 h-9 shrink-0 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
                      {icon}
                    </div>
                  )}
                  <div className="min-w-0">
                    {title && <h3 className="text-base font-extrabold text-[var(--ink)] leading-tight truncate">{title}</h3>}
                    {subtitle && <p className="text-[11px] text-[var(--muted)] font-medium mt-0.5">{subtitle}</p>}
                  </div>
                </div>
                {!hideClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)] transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_srgb,var(--primary)_22%,transparent)]"
                    aria-label="Fechar"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                )}
              </div>
            )}
            <div className="px-5 py-4 overflow-y-auto flex-1 min-h-0">{children}</div>
            {footer && (
              <div className="px-5 py-3.5 border-t border-[var(--line)] flex items-center justify-end gap-2 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};