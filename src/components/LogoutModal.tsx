import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useCommunication } from '../context/CommunicationContext';
import { LogOut, UserX, Trash2, ShieldCheck, X } from 'lucide-react';

interface LogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({ isOpen, onClose }) => {
  const { identifiedUser, logoutUser, resetAllData, showNotice } = useApp();
  const { leaveAll } = useCommunication();
  const [confirmClearTeam, setConfirmClearTeam] = useState(false);

  if (!isOpen) return null;

  const handleOnlyLogout = () => {
    try {
      leaveAll();
    } catch {}
    try {
      localStorage.removeItem('dimensio_portal_operator_id');
      localStorage.removeItem('dimensio_portal_operator_login_at');
    } catch {}
    logoutUser();
    showNotice('Sessão encerrada com sucesso. Rádio desconectado.');
    onClose();
  };

  const handleLogoutAndClearDevice = () => {
    try {
      leaveAll();
    } catch {}
    try {
      localStorage.removeItem('dimensio_portal_operator_id');
      localStorage.removeItem('dimensio_portal_operator_login_at');
    } catch {}
    logoutUser();
    resetAllData();
    showNotice(
      'Dados da equipe e sessão limpos com sucesso neste dispositivo. Pronto para nova equipe.',
      undefined,
      undefined,
      'success'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--ink)]">Sair da Sessão</h3>
              <p className="text-[11px] text-[var(--muted)] font-medium">
                {identifiedUser ? (
                  <>
                    Conectado como <strong className="text-[var(--ink)]">{identifiedUser.name}</strong> ({identifiedUser.role})
                  </>
                ) : (
                  'Desconectar e limpar presença deste dispositivo'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--ink)] p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content options */}
        {!confirmClearTeam ? (
          <div className="space-y-3">
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Escolha como deseja encerrar a sessão neste dispositivo:
            </p>

            {/* Option 1: Apenas trocar operador / deslogar */}
            <button
              type="button"
              onClick={handleOnlyLogout}
              className="w-full p-3.5 rounded-xl border border-[var(--line)] hover:border-emerald-500/50 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 text-left transition-all cursor-pointer flex items-start gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <UserX className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-black text-[var(--ink)]">Trocar de Usuário / Desconectar Perfil</div>
                <div className="text-[11px] text-[var(--muted)] leading-relaxed">
                  Desconecta o rádio e remove sua presença online imediatamente. Os dados da equipe continuam salvos neste dispositivo para o próximo colega entrar.
                </div>
              </div>
            </button>

            {/* Option 2: Sair e limpar dados para outra equipe */}
            <button
              type="button"
              onClick={() => setConfirmClearTeam(true)}
              className="w-full p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50/40 dark:hover:bg-rose-950/30 text-left transition-all cursor-pointer flex items-start gap-3 group"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <Trash2 className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-black text-rose-700 dark:text-rose-300">
                  Sair e Limpar Dados deste Dispositivo (Nova Equipe)
                </div>
                <div className="text-[11px] text-[var(--muted)] leading-relaxed">
                  Use se outro colaborador de uma <strong>equipe diferente</strong> for assumir este coletor/aparelho. Remove dados locais da equipe anterior (com backup de segurança automático).
                </div>
              </div>
            </button>
          </div>
        ) : (
          <div className="space-y-3 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-black text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Confirmar Limpeza para Nova Equipe
            </div>
            <p className="text-[11px] text-[var(--ink)] leading-relaxed">
              O rádio será desconectado, o usuário deslogado e o cache local dos colaboradores e tarefas da equipe atual será reiniciado neste navegador.
              Um backup de segurança local será criado antes da limpeza para proteção contra perdas.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirmClearTeam(false)}
                className="px-3 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--paper)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-2)] cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleLogoutAndClearDevice}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs cursor-pointer transition-colors"
              >
                Confirmar e Limpar Dispositivo
              </button>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-[var(--line)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
