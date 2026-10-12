import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  History,
  Trash2,
  Search,
  UserCheck,
  RotateCcw,
} from 'lucide-react';

interface AuditLogsSettingsPanelProps {
  checkPermissionOrAlert: (requireAdmin?: boolean) => boolean;
}

export const AuditLogsSettingsPanel: React.FC<AuditLogsSettingsPanelProps> = ({
  checkPermissionOrAlert,
}) => {
  const { state, clearAuditLogs, restoreFromAuditLog } = useApp();
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('todos');

  return (
    <div className="space-y-4 animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl">
        <div>
          <h3 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--primary)]" />
            Histórico de Alterações e Trilha de Auditoria
          </h3>
          <p className="text-xs text-[var(--muted)] font-medium mt-0.5">
            Registra quem modificou escalas, atribuições, presenças e configurações no sistema. Permite reverter e retornar a qualquer estado anterior.
          </p>
        </div>
        {(state.auditLogs || []).length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (!checkPermissionOrAlert(true)) return;
              clearAuditLogs();
            }}
            className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpar Trilha
          </button>
        )}
      </div>

      {/* Search & Action Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--paper)] border border-[var(--line)] p-3 rounded-2xl text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-extrabold text-[var(--ink)]">Ação:</span>
          {['todos', 'escala', 'ausencia', 'atribuicao', 'configuracao', 'pedido'].map((act) => (
            <button
              key={act}
              type="button"
              onClick={() => setAuditActionFilter(act)}
              className={`px-3 py-1 rounded-xl font-bold uppercase text-[10px] transition-all cursor-pointer ${
                auditActionFilter === act
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              {act}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-2.5" />
          <input
            type="text"
            value={auditSearchTerm}
            onChange={(e) => setAuditSearchTerm(e.target.value)}
            placeholder="Buscar por usuário ou detalhes..."
            className="w-full bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
          />
        </div>
      </div>

      {/* Audit Logs Table */}
      {(!state.auditLogs || state.auditLogs.length === 0) ? (
        <div className="p-12 text-center text-xs text-[var(--muted)] bg-[var(--paper)] border border-[var(--line)] rounded-2xl">
          Nenhuma alteração registrada ainda.
        </div>
      ) : (
        <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] uppercase font-black text-[10px]">
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Identificação (Usuário)</th>
                  <th className="p-3">Tipo de Ação</th>
                  <th className="p-3">Descrição da Alteração</th>
                  <th className="p-3 text-right">Reversão de Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {state.auditLogs
                  .filter((log) => {
                    const act = log.action || log.actionType;
                    if (auditActionFilter !== 'todos' && act !== auditActionFilter) return false;
                    if (auditSearchTerm.trim()) {
                      const term = auditSearchTerm.toLowerCase();
                      return (
                        log.userName.toLowerCase().includes(term) ||
                        log.description.toLowerCase().includes(term) ||
                        (log.details && String(log.details).toLowerCase().includes(term))
                      );
                    }
                    return true;
                  })
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--bg)]/50 transition-colors">
                      <td className="p-3 font-mono font-bold text-[var(--muted)] whitespace-nowrap text-[11px]">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="p-3 font-extrabold text-[var(--ink)] whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-[var(--primary)]" />
                          {log.userName}
                          {log.userRole && (
                            <span className="text-[var(--muted)] font-normal text-[10px]">
                              ({log.userRole})
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="p-3 font-bold">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)]">
                          {log.action || log.actionType}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-[var(--ink)]">
                        <div>{log.description}</div>
                        {log.details && (
                          <div className="text-[10.5px] text-[var(--muted)] font-mono mt-0.5">
                            {typeof log.details === 'object'
                              ? JSON.stringify(log.details)
                              : String(log.details)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {log.snapshot ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (!checkPermissionOrAlert(true)) return;
                              restoreFromAuditLog(log.id);
                            }}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10.5px] rounded-lg shadow-2xs transition-all inline-flex items-center gap-1 cursor-pointer"
                            title="Retornar o sistema exatamente ao estado salvo nesta alteração"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reverter para este estado</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-[var(--muted)] font-medium italic">
                            Sem snapshot
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
