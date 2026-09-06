import React, { useEffect, useRef } from 'react';
import { FileSpreadsheet, Link as LinkIcon, ShieldCheck, CheckCircle2, X } from 'lucide-react';

interface IncomingConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  teamName: string;
  sheetUrl: string;
  webhookUrl?: string;
  onAcceptConnection: () => void;
}

export const IncomingConnectionModal: React.FC<IncomingConnectionModalProps> = ({
  isOpen,
  onClose,
  teamName,
  sheetUrl,
  webhookUrl,
  onAcceptConnection,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;
    
    setTimeout(() => {
      const acceptBtn = modalRef.current?.querySelector<HTMLButtonElement>('[data-action="accept"]');
      acceptBtn?.focus();
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
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-connection-title"
      aria-describedby="incoming-connection-description"
    >
      <div 
        ref={modalRef}
        className="bg-[var(--paper)] border border-[var(--line)] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-[var(--primary-soft)] border-b border-[var(--primary-border)] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center font-black shadow-xs shrink-0" aria-hidden="true">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-[var(--primary)] tracking-wider">
                Convite de Conexão em Nuvem
              </span>
              <h3 id="incoming-connection-title" className="text-base font-extrabold text-[var(--ink)] leading-snug">
                Conectar à Equipe "{teamName || 'Operacional'}"
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 min-h-[44px] min-w-[44px]"
            aria-label="Fechar convite de conexão"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs text-[var(--muted)]">
          <p id="incoming-connection-description" className="font-semibold text-[var(--ink)]">
            Você abriu um link de compartilhamento para conectar seu aplicativo diretamente à planilha oficial da equipe na nuvem.
          </p>

          <div className="bg-[var(--bg)] p-3.5 rounded-xl border border-[var(--line)] space-y-2 font-mono text-[11px]">
            <div>
              <span className="font-sans font-bold text-[var(--muted)] text-[10px] uppercase block">
                Link do Google Sheets:
              </span>
              <p className="text-[var(--ink)] truncate">{sheetUrl}</p>
            </div>
            {webhookUrl ? (
              <div>
                <span className="font-sans font-bold text-[var(--muted)] text-[10px] uppercase block">
                  Webhook de Integração (Apps Script):
                </span>
                <p className="text-emerald-600 dark:text-emerald-400 truncate">Configurado (/exec)</p>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-100">
                <p className="text-[11px] font-semibold">Atenção:</p>
                <p className="text-[11px]">
                  Este link não contém a URL do Webhook do Apps Script. Sem o Webhook, a sincronização em nuvem não será ativada automaticamente.
                </p>
              </div>
            )}
          </div>

          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-900 dark:text-emerald-200 flex items-start gap-2" role="note">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
            <p>
              <strong>Segurança Garantida:</strong> Seus dados locais atuais serão preservados automaticamente em um ponto de restauração de segurança antes de sincronizar.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--ink)] text-xs font-bold rounded-xl transition-all cursor-pointer min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
          >
            Ignorar
          </button>
          <button
            onClick={() => {
              onAcceptConnection();
              onClose();
            }}
            data-action="accept"
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            <span>Conectar e Sincronizar Agora</span>
          </button>
        </div>
      </div>
    </div>
  );
};
