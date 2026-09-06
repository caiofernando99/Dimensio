import React, { useState } from 'react';
import { ShieldAlert, Download, Layers, Users, CheckCircle2, RotateCcw, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { AppState } from '../types';

interface ConfirmImportBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  importedData: Partial<AppState> | null;
  currentCollaboratorCount: number;
  currentTeamName: string;
  onConfirmImport: (mode: 'full' | 'config_only', createSafetyBackup: boolean) => void;
}

export const ConfirmImportBackupModal: React.FC<ConfirmImportBackupModalProps> = ({
  isOpen,
  onClose,
  importedData,
  currentCollaboratorCount,
  currentTeamName,
  onConfirmImport,
}) => {
  const [mode, setMode] = useState<'config_only' | 'full'>('config_only');
  const [createBackup, setCreateBackup] = useState(true);

  if (!isOpen || !importedData) return null;

  const fileColsCount = importedData.collaborators?.length || 0;
  const fileTasksCount = importedData.tasks?.length || 0;
  const fileTeamName = importedData.teamName || 'Equipe Não Identificada';

  const handleConfirm = () => {
    onConfirmImport(mode, createBackup);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--paper)] border border-[var(--line)] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-amber-500/10 border-b border-amber-500/30 p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[var(--ink)] leading-snug">
                Importar Backup / Configuração
              </h3>
              <p className="text-xs text-[var(--muted)] font-semibold">
                Confirme como deseja aplicar o arquivo selecionado
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Comparison summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
              <span className="text-[10px] font-black uppercase text-[var(--muted)] tracking-wider">
                Dados Atuais no Sistema
              </span>
              <div className="font-extrabold text-sm text-[var(--ink)] truncate">{currentTeamName || 'Sua Equipe'}</div>
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                {currentCollaboratorCount} colaboradores ativos
              </div>
            </div>

            <div className="p-3.5 bg-[var(--primary-soft)] border border-[var(--primary-border)] rounded-xl space-y-1">
              <span className="text-[10px] font-black uppercase text-[var(--primary)] tracking-wider">
                Arquivo Selecionado
              </span>
              <div className="font-extrabold text-sm text-[var(--ink)] truncate">{fileTeamName}</div>
              <div className="text-[11px] font-bold text-[var(--primary)]">
                {fileColsCount} colaboradores e {fileTasksCount} tarefas
              </div>
            </div>
          </div>

          {/* Import Modes Choice */}
          <div className="space-y-2">
            <label className="text-[11px] font-extrabold text-[var(--ink)] uppercase tracking-wider block">
              Como deseja aplicar estes dados?
            </label>

            {/* Option 1: Config only */}
            <div
              onClick={() => setMode('config_only')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer space-y-1.5 ${
                mode === 'config_only'
                  ? 'border-emerald-600 bg-emerald-500/10 dark:bg-emerald-950/30'
                  : 'border-[var(--line)] bg-[var(--bg)] hover:border-[var(--muted)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-sm text-[var(--ink)]">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span>1. Importar Apenas Configurações & Estrutura</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-full uppercase">
                  Recomendado / Seguro
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed pl-6">
                <strong>Mantém sua equipe atual, registros do dia e relatórios.</strong> Atualiza apenas regras do setor, cargos, tarefas, horários de intervalo, temas e links de planilha.
              </p>
            </div>

            {/* Option 2: Full replacement */}
            <div
              onClick={() => setMode('full')}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer space-y-1.5 ${
                mode === 'full'
                  ? 'border-red-600 bg-red-500/10 dark:bg-red-950/30'
                  : 'border-[var(--line)] bg-[var(--bg)] hover:border-[var(--muted)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-sm text-[var(--ink)]">
                  <RotateCcw className="w-4 h-4 text-red-600" />
                  <span>2. Substituição Completa (Restaurar Backup Total)</span>
                </div>
                <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-full uppercase">
                  Substitui Tudo
                </span>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed pl-6">
                Substitui completamente a lista de colaboradores e dados de presença atual pelos colaboradores do arquivo importado.
              </p>
            </div>
          </div>

          {/* Safety Backup Checkbox */}
          <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl flex items-center gap-3">
            <input
              type="checkbox"
              id="safetyBackupCheck"
              checked={createBackup}
              onChange={(e) => setCreateBackup(e.target.checked)}
              className="w-4 h-4 rounded text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
            />
            <label htmlFor="safetyBackupCheck" className="text-[11px] font-bold text-[var(--ink)] cursor-pointer select-none">
              Criar um ponto de restauração de segurança dos meus dados atuais no histórico de backups antes de aplicar.
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--ink)] text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className={`px-5 py-2.5 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${
              mode === 'config_only'
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Confirmar Importação</span>
          </button>
        </div>
      </div>
    </div>
  );
};
