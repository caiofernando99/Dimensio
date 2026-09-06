import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  requireKeyword?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  requireKeyword,
}) => {
  const [inputVal, setInputVal] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const isConfirmDisabled = requireKeyword
    ? inputVal.trim().toUpperCase() !== requireKeyword.toUpperCase()
    : false;

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;
    
    // Focus the first focusable element
    setTimeout(() => {
      const input = modalRef.current?.querySelector<HTMLInputElement>('input');
      const confirmBtn = modalRef.current?.querySelector<HTMLButtonElement>('button:not([disabled])');
      (input || confirmBtn)?.focus();
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusableElements?.length) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
    >
      <div 
        ref={modalRef}
        className="bg-[var(--paper)] border border-[var(--line)] rounded-xl max-w-md w-full p-6 shadow-2xl relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-3 mb-4 text-red-600">
          <div className="p-3 bg-red-100 rounded-full dark:bg-red-950/50" aria-hidden="true">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 id="confirm-modal-title" className="text-lg font-bold text-[var(--ink)]">{title}</h3>
        </div>

        <p id="confirm-modal-description" className="text-sm text-[var(--muted)] mb-4 leading-relaxed">{description}</p>

        {requireKeyword && (
          <div className="mb-5">
            <label htmlFor="keyword-input" className="block text-xs font-semibold text-[var(--muted)] mb-1">
              Digite <span className="font-mono text-red-600 uppercase">{requireKeyword}</span> para confirmar:
            </label>
            <input
              id="keyword-input"
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={requireKeyword}
              className="w-full p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-sm text-[var(--ink)] uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-[var(--line)] rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 min-h-[44px] min-w-[44px]"
          >
            Cancelar
          </button>
          <button
            disabled={isConfirmDisabled}
            onClick={() => {
              onConfirm();
              setInputVal('');
              onClose();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 min-h-[44px] min-w-[44px]"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
