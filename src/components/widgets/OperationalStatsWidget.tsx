import React from 'react';
import { Users, CheckCircle2, UserX, Clock, ArrowUpRight, Activity, Send, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getCollaboratorStatus, type StatusType } from '../../utils/helpers';

interface OperationalStatsWidgetProps {
  onOpenPresence?: () => void;
  onOpenTasks?: () => void;
  onOpenRequests?: () => void;
  className?: string;
}

export const OperationalStatsWidget: React.FC<OperationalStatsWidgetProps> = ({
  onOpenPresence,
  onOpenTasks,
  onOpenRequests,
  className = '',
}) => {
  const { state } = useApp();
  const selectedDate = state.selectedDate;
  const collaborators = state.collaborators || [];
  const serviceRequests = state.serviceRequests || [];

  const statusByCollab = new Map<string, StatusType>();
  collaborators.forEach((c) => {
    statusByCollab.set(c.id, getCollaboratorStatus(c, selectedDate, state).status);
  });

  const presentCount = collaborators.filter(
    (c) => statusByCollab.get(c.id) === 'presente' || statusByCollab.get(c.id) === 'atraso'
  ).length;

  const absentCount = collaborators.filter(
    (c) => statusByCollab.get(c.id) === 'ausente' || statusByCollab.get(c.id) === 'falta_injustificada'
  ).length;

  const offCount = collaborators.filter((c) => statusByCollab.get(c.id) === 'folga').length;
  const medicalCount = collaborators.filter((c) => statusByCollab.get(c.id) === 'atestado' || statusByCollab.get(c.id) === 'licenca').length;

  // Task allocation
  const presentIds = new Set(
    collaborators.filter((c) => statusByCollab.get(c.id) === 'presente' || statusByCollab.get(c.id) === 'atraso').map((c) => c.id)
  );
  const assignedPresentCount = new Set(
    state.tasks.flatMap((t) => t.members.filter((m) => presentIds.has(m)))
  ).size;

  const assignedPercent = presentCount > 0 ? Math.round((assignedPresentCount / presentCount) * 100) : 0;

  // Pending service requests
  const pendingRequests = serviceRequests.filter((r) => r.status === 'pendente' || r.status === 'lido');
  const urgentPending = pendingRequests.filter((r) => r.priority === 'alta' || r.priority === 'urgente');

  return (
    <div
      id="widget-operational-stats"
      className={`bg-[var(--paper)] border border-[var(--line)] rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-col justify-between transition-all hover:border-[var(--primary-border)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider text-[var(--muted)] truncate">Widget Operacional</div>
            <div className="text-sm font-bold text-[var(--ink)] truncate">Panorama do Turno</div>
          </div>
        </div>

        {onOpenPresence && (
          <button
            type="button"
            onClick={onOpenPresence}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--line)]/50 transition-colors"
            title="Abrir Lista de Presença Completa"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Headcount Grid */}
      <div className="grid grid-cols-4 gap-1.5 mb-2.5">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 text-center">
          <div className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-none">{presentCount}</div>
          <div className="text-[10px] font-bold text-[var(--muted)] uppercase mt-1">Presentes</div>
        </div>

        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2 text-center">
          <div className="text-base font-black text-rose-600 dark:text-rose-400 leading-none">{absentCount}</div>
          <div className="text-[10px] font-bold text-[var(--muted)] uppercase mt-1">Faltas</div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-2 text-center">
          <div className="text-base font-black text-blue-600 dark:text-blue-400 leading-none">{offCount}</div>
          <div className="text-[10px] font-bold text-[var(--muted)] uppercase mt-1">Folgas</div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 text-center">
          <div className="text-base font-black text-amber-600 dark:text-amber-400 leading-none">{medicalCount}</div>
          <div className="text-[10px] font-bold text-[var(--muted)] uppercase mt-1">Atest/Lic</div>
        </div>
      </div>

      {/* Pending Requests Metric Pill */}
      <div
        onClick={onOpenRequests}
        className={`flex items-center justify-between px-3 py-1.5 rounded-xl border mb-2.5 text-xs transition-all ${
          pendingRequests.length > 0
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-300 hover:bg-amber-500/20 cursor-pointer'
            : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)]'
        }`}
        title="Chamados e Pedidos de Serviço Pendentes"
      >
        <div className="flex items-center gap-1.5 font-bold">
          <Send className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Pedidos Pendentes:</span>
          {urgentPending.length > 0 && (
            <span className="text-[9px] bg-rose-500 text-white font-black px-1.5 py-0.2 rounded-full uppercase">
              {urgentPending.length} urgente(s)
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono font-black text-sm text-[var(--ink)]">
            {pendingRequests.length}
          </span>
          {onOpenRequests && <ArrowUpRight className="w-3 h-3 text-[var(--muted)]" />}
        </div>
      </div>

      {/* Dimensioning Progress Bar */}
      <div className="border-t border-[var(--line)] pt-2.5">
        <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
          <span className="text-[var(--muted)]">Dimensionamento de Tarefas</span>
          <span className="text-[var(--ink)] font-mono">{assignedPresentCount} / {presentCount} ({assignedPercent}%)</span>
        </div>

        <div className="w-full bg-[var(--bg)] border border-[var(--line)] h-2.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              assignedPercent === 100 ? 'bg-emerald-500' : assignedPercent > 60 ? 'bg-blue-500' : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min(assignedPercent, 100)}%` }}
          />
        </div>

        {onOpenTasks && (
          <button
            type="button"
            onClick={onOpenTasks}
            className="w-full mt-2.5 text-center text-xs font-bold text-[var(--primary)] hover:underline flex items-center justify-center gap-1 cursor-pointer"
          >
            <span>Ver Postos & Dimensionamento</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
