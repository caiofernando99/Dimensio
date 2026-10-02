import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { FileSpreadsheet, Link as LinkIcon, Download, Check, X, Shield, RefreshCw, Code2, Cloud, Sparkles } from 'lucide-react';
import { AppsScriptModal } from './AppsScriptModal';
import { DEFAULT_FIRESTORE_CONFIG } from '../utils/initialData';

interface ConnectSpreadsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConnectSpreadsheetModal: React.FC<ConnectSpreadsheetModalProps> = ({ isOpen, onClose }) => {
  const { state, setOnlineSpreadsheetConfig, generateTemplateSpreadsheet, exportTeamRosterSpreadsheet, syncToOnlineSpreadsheet, showNotice } = useApp();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const currentConfig = state.onlineSpreadsheet;

  const [name, setName] = useState(currentConfig?.name || '');
  const [url, setUrl] = useState(currentConfig?.url || '');
  const [webhookUrl, setWebhookUrl] = useState(currentConfig?.webhookUrl || '');
  const [autoSync, setAutoSync] = useState<boolean>(currentConfig?.autoSyncEnabled !== false);
  const [isTesting, setIsTesting] = useState(false);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;
    
    setTimeout(() => {
      const firstInput = modalRef.current?.querySelector<HTMLInputElement>('input');
      firstInput?.focus();
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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showNotice('Informe o nome da planilha.');
      return;
    }
    if (!url.trim()) {
      showNotice('Informe o link/URL da planilha do Google Sheets.');
      return;
    }

    setOnlineSpreadsheetConfig({
      name: name.trim(),
      url: url.trim(),
      webhookUrl: webhookUrl.trim() || undefined,
      autoSyncEnabled: autoSync,
      lastSyncedAt: currentConfig?.lastSyncedAt || '',
      syncCount: currentConfig?.syncCount || 0,
    }, true);
    onClose();
  };

  const handleDisconnect = () => {
    setOnlineSpreadsheetConfig(null);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connect-spreadsheet-title"
      aria-describedby="connect-spreadsheet-description"
    >
      <div 
        ref={modalRef}
        className="bg-[var(--paper)] border border-[var(--line)] w-full max-w-xl rounded-2xl shadow-xl overflow-hidden space-y-0"
      >
        {/* Header */}
        <div className="bg-[var(--primary-soft)] border-b border-[var(--primary-border)] p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shadow-xs" aria-hidden="true">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 id="connect-spreadsheet-title" className="text-base font-extrabold text-[var(--ink)]">Conectar Planilha Compartilhada</h3>
              <p id="connect-spreadsheet-description" className="text-xs text-[var(--muted)] font-medium">
                Transforme uma planilha do Google Sheets em seu banco de dados online.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[var(--muted)] hover:text-[var(--ink)] rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 min-h-[44px] min-w-[44px]"
            aria-label="Fechar modal de conexão"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Firestore Direct Activation Option */}
        <div className="p-5 pb-0">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="text-xs font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Nuvem Automática Dimensio (Firebase Firestore)
              </div>
              <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 font-medium">
                Sem planilhas ou webhooks. Sincronização em tempo real entre todos os aparelhos e computadores.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOnlineSpreadsheetConfig({
                  ...DEFAULT_FIRESTORE_CONFIG,
                  name: state.teamName ? `${state.teamName} (Nuvem)` : 'Nuvem Dimensio',
                }, true);
                showNotice('Nuvem Firebase Firestore ativada com sucesso!');
                onClose();
              }}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-lg flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer transition-colors"
            >
              <Cloud className="w-3.5 h-3.5" />
              Ativar Nuvem Firestore
            </button>
          </div>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="sheet-name" className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider block">
              Nome da Planilha
            </label>
            <input
              id="sheet-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Planilha Oficial da Equipe - Logística T2"
              className="w-full px-3.5 py-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 min-h-[44px]"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sheet-url" className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider block">
              Link / URL do Google Sheets (Compartilhada)
            </label>
            <div className="relative">
              <input
                id="sheet-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="w-full pl-9 pr-3.5 py-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 min-h-[44px]"
                required
              />
              <LinkIcon className="w-4 h-4 text-[var(--muted)] absolute left-3 top-3" aria-hidden="true" />
            </div>
            <p className="text-[11px] text-[var(--muted)]">
              Cole o link da planilha no Google Drive com permissão de edição para administradores.
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="webhook-url" className="text-xs font-bold text-[var(--ink)] uppercase tracking-wider block">
                URL do Webhook (Google Apps Script — Opcional)
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowAppsScriptModal(true)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-2xs min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Ver Passo a Passo / Copiar Código</span>
                </button>

                {webhookUrl.trim() && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (webhookUrl.includes('docs.google.com/spreadsheets')) {
                        showNotice('A URL do Webhook deve ser o link do Web App do Apps Script (iniciando com https://script.google.com/macros/s/.../exec) e não o link da planilha.');
                        return;
                      }
                      setIsTesting(true);
                      setOnlineSpreadsheetConfig({
                        name: name.trim() || 'Planilha Oficial',
                        url: url.trim() || 'https://docs.google',
                        webhookUrl: webhookUrl.trim(),
                        autoSyncEnabled: autoSync,
                      }, true);
                      const success = await syncToOnlineSpreadsheet();
                      setIsTesting(false);
                      if (success) {
                        showNotice('Conexão testada e aprovada! Planilha atualizada na nuvem.');
                      }
                    }}
                    disabled={isTesting}
                    className="px-2.5 py-1 bg-[var(--primary-soft)] hover:bg-[var(--line)] text-[var(--primary)] text-[11px] font-extrabold rounded-lg border border-[var(--primary-border)] flex items-center gap-1.5 transition-colors cursor-pointer min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
                  </button>
                )}
              </div>
            </div>
            <input
              id="webhook-url"
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full px-3.5 py-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 min-h-[44px]"
            />
            {webhookUrl.includes('docs.google.com/spreadsheets') && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-900" role="alert">
                ⚠️ Atenção: Você inseriu o link da planilha. O Webhook deve ser a URL gerada no Google Apps Script (terminando em /exec).
              </p>
            )}
            <p className="text-[11px] text-[var(--muted)]">
              Sua planilha funciona como banco de dados online em tempo real. Todos os membros da equipe que utilizarem a aplicação com essa mesma configuração verão atualizações em tempo real.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="autoSyncModal"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-4 h-4 text-[var(--primary)] rounded accent-[var(--primary)] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
              />
              <label htmlFor="autoSyncModal" className="text-xs font-extrabold text-[var(--ink)] cursor-pointer">
                Sincronização Automática em Tempo Real (Auto-Sync ao alterar colaboradores ou configurações)
              </label>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3.5 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 w-full">
              <span className="font-bold">Dica para criar sua planilha compartilhada:</span>
              <p className="text-[11px] opacity-90">
                {state.collaborators.length > 0
                  ? `Exporte os dados da sua equipe (${state.collaborators.length} membros) para criar sua planilha no Google Sheets:`
                  : 'Você pode baixar um modelo inicial no botão abaixo para importar no Google Sheets:'}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {state.collaborators.length > 0 && (
                  <button
                    type="button"
                    onClick={exportTeamRosterSpreadsheet}
                    className="inline-flex items-center gap-1.5 font-black text-[11px] text-amber-800 dark:text-amber-200 bg-amber-200/60 dark:bg-amber-900/40 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-800 hover:bg-amber-200 transition-colors min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Gerar Planilha da Equipe ({state.collaborators.length} .CSV)</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={generateTemplateSpreadsheet}
                  className="inline-flex items-center gap-1.5 font-bold text-[11px] text-amber-700 dark:text-amber-300 underline hover:no-underline min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Baixar Modelo Em Branco (.CSV)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-3">
            {currentConfig ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="px-3.5 py-2 text-xs font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Desconectar Planilha
              </button>
            ) : (
              <div></div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[var(--line)] text-xs font-bold rounded-xl text-[var(--ink)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[var(--primary)] text-white text-xs font-black rounded-xl hover:bg-[var(--primary-hover)] flex items-center gap-2 shadow-xs transition-colors min-h-[44px] min-w-[44px] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Salvar & Conectar Planilha</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Apps Script Guide Modal */}
      <AppsScriptModal
        isOpen={showAppsScriptModal}
        onClose={() => setShowAppsScriptModal(false)}
      />
    </div>
  );
};
