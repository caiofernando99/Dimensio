import React from 'react';
import { Send, CheckCircle2, Clock, ArrowUpRight, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface ServiceRequestsWidgetProps {
  onOpenRequests?: () => void;
  className?: string;
}

export const ServiceRequestsWidget: React.FC<ServiceRequestsWidgetProps> = ({
  onOpenRequests,
  className = '',
}) => {
  const { state, markRequestAsCompleted } = useApp();
  const requests = state.serviceRequests || [];

  const pendingRequests = requests.filter((r) => r.status === 'pendente' || r.status === 'lido');
  const recentPending = pendingRequests.slice(0, 3);

  return (
    <div
      id="widget-service-requests"
      className={`bg-[var(--paper)] border border-[var(--line)] rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-col justify-between transition-all hover:border-[var(--primary-border)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Send className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider text-[var(--muted)] truncate">Widget de Suporte</div>
            <div className="text-sm font-bold text-[var(--ink)] truncate">Chamados & Pedidos</div>
          </div>
        </div>

        {onOpenRequests && (
          <button
            type="button"
            onClick={onOpenRequests}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--line)]/50 transition-colors"
            title="Abrir Central de Pedidos de Serviço"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Pending Badge */}
      <div className="flex items-center justify-between bg-[var(--bg)] border border-[var(--line)] rounded-xl px-3 py-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs font-bold text-[var(--ink)]">Aguardando Atendimento</span>
        </div>
        <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono font-bold text-xs">
          {pendingRequests.length}
        </span>
      </div>

      {/* List */}
      <div className="space-y-1.5 flex-1 mb-2">
        {recentPending.length > 0 ? (
          recentPending.map((req) => (
            <div
              key={req.id}
              className="p-2 rounded-xl bg-[var(--bg)] border border-[var(--line)] flex items-start justify-between gap-2 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[var(--ink)] truncate flex items-center gap-1">
                  <span>{req.collaboratorName || 'Operador'}</span>
                  {req.priority === 'alta' && (
                    <span className="text-[9px] bg-rose-500/20 text-rose-600 px-1 rounded uppercase font-black">Urgente</span>
                  )}
                </div>
                <div className="text-[11px] text-[var(--muted)] truncate">{req.type || req.description}</div>
              </div>
              <button
                type="button"
                onClick={() => markRequestAsCompleted(req.id)}
                className="p-1 text-emerald-600 hover:bg-emerald-500/10 rounded-lg shrink-0"
                title="Marcar como atendido"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          ))
        ) : (
          <div className="text-xs text-[var(--muted)] italic p-2 bg-[var(--bg)] rounded-xl border border-[var(--line)] text-center">
            Nenhum chamado pendente no momento.
          </div>
        )}
      </div>

      {onOpenRequests && (
        <button
          type="button"
          onClick={onOpenRequests}
          className="w-full text-center text-xs font-bold text-[var(--primary)] hover:underline flex items-center justify-center gap-1 cursor-pointer pt-1"
        >
          <span>Ver todos os chamados ({requests.length})</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
