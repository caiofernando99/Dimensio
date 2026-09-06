import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, RefreshCw, X, Sparkles } from 'lucide-react';

export const FloatingToast: React.FC = () => {
  const { noticeMessage, noticeType, noticeActionLabel, onNoticeAction, showNotice } = useApp();

  const isSyncNotice =
    noticeType === 'sync' ||
    (noticeMessage && (noticeMessage.toLowerCase().includes('sincroniz') || noticeMessage.toLowerCase().includes('tempo real')));

  const toastId = 'floating-toast-notification';

  return (
    <AnimatePresence>
      {noticeMessage && (
        <motion.div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          id={toastId}
          initial={{ opacity: 0, y: 30, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="fixed bottom-5 right-5 sm:right-6 z-[9999] max-w-sm w-auto"
        >
          <div
            className={`bg-[var(--ink)] text-[var(--paper)] border px-3.5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-md ${
              isSyncNotice
                ? 'border-purple-500/50 shadow-purple-500/20 ring-1 ring-purple-500/30'
                : 'border-[var(--line)]'
            }`}
          >
            {isSyncNotice ? (
              <div className="w-7 h-7 rounded-full bg-purple-500/25 text-purple-300 flex items-center justify-center shrink-0 border border-purple-400/40 animate-pulse" aria-hidden="true">
                <RefreshCw className="w-4 h-4 animate-spin text-purple-300" />
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0" aria-hidden="true">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            )}

            <div className="text-xs font-bold leading-tight truncate max-w-[220px]">
              {noticeMessage}
            </div>

            {noticeActionLabel && onNoticeAction && (
              <button
                type="button"
                onClick={() => {
                  onNoticeAction();
                }}
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-[10px] uppercase tracking-wide rounded-lg cursor-pointer transition-transform active:scale-95 shrink-0 shadow-xs min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                {noticeActionLabel}
              </button>
            )}

            <button
              type="button"
              onClick={() => showNotice('')}
              className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-lg shrink-0 min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-slate-900"
              title="Fechar alerta"
              aria-label="Fechar notificação"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

