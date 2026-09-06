import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Clock, ArrowUpRight, ArrowDownLeft, AlertCircle, Sparkles, UserCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayISO, formatDateBR } from '../../utils/helpers';

interface BreaksMonitorWidgetProps {
  onOpenMonitor?: () => void;
  onOpenBreaks?: () => void;
}

export const BreaksMonitorWidget: React.FC<BreaksMonitorWidgetProps> = ({ onOpenMonitor, onOpenBreaks }) => {
  const { state } = useApp();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const activeDate = state.selectedDate || getTodayISO();
  const dayIntervals = state.intervals[activeDate] || {};

  // Build list of active breaks and assignees
  const breakDepartures = useMemo(() => {
    const currentHour = currentTime.getHours();
    const currentMin = currentTime.getMinutes();
    const currentTotalMin = currentHour * 60 + currentMin;

    const list: Array<{
      collabId: string;
      collabName: string;
      breakTime: string;
      timeDiffMin: number;
      isDepartingSoon: boolean;
      isReturningSoon: boolean;
      isCurrentlyOnBreak: boolean;
      taskName: string;
    }> = [];

    state.breaks.forEach((slot) => {
      const collabIds = dayIntervals[slot.id] || [];
      if (!collabIds.length) return;

      const [slotH, slotM] = slot.time.split(':').map((n) => parseInt(n, 10));
      if (isNaN(slotH) || isNaN(slotM)) return;

      const slotTotalMin = slotH * 60 + slotM;
      const timeDiff = slotTotalMin - currentTotalMin;
      const breakDuration = 60;
      const endTotalMin = slotTotalMin + breakDuration;
      const returnDiff = endTotalMin - currentTotalMin;

      collabIds.forEach((cId) => {
        const collab = state.collaborators.find((c) => c.id === cId);
        if (!collab) return;

        const assignedTask = state.tasks.find((t) => (t.members || []).includes(cId))?.name || 'Não alocado';

        const isDepartingSoon = timeDiff > 0 && timeDiff <= 20;
        const isCurrentlyOnBreak = currentTotalMin >= slotTotalMin && currentTotalMin < endTotalMin;
        const isReturningSoon = returnDiff > 0 && returnDiff <= 15;

        list.push({
          collabId: cId,
          collabName: collab.name,
          breakTime: slot.time,
          timeDiffMin: timeDiff,
          isDepartingSoon,
          isReturningSoon,
          isCurrentlyOnBreak,
          taskName: assignedTask,
        });
      });
    });

    return list.sort((a, b) => a.timeDiffMin - b.timeDiffMin);
  }, [state.breaks, dayIntervals, state.collaborators, state.tasks, currentTime]);

  const leavingSoon = breakDepartures.filter((d) => d.isDepartingSoon);
  const returningSoon = breakDepartures.filter((d) => d.isReturningSoon);
  const onBreakNow = breakDepartures.filter((d) => d.isCurrentlyOnBreak);

  return (
    <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl p-4 flex flex-col justify-between h-full shadow-xs hover:border-[var(--primary)]/30 transition-all">
      {/* Widget Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--ink)]">Monitor de Pausas</h3>
              <p className="text-[10px] text-[var(--muted)]">Próximas saídas e retornos</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenMonitor || onOpenBreaks}
            className="text-[11px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-0.5 cursor-pointer"
          >
            Abrir Painel <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Real-time alerts */}
        <div className="space-y-2 text-xs">
          {leavingSoon.length > 0 && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200">
              <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Saindo para intervalo em breve:
                </span>
                <span className="text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded-md">{leavingSoon.length}</span>
              </div>
              <p className="text-[11px] font-medium truncate">
                {leavingSoon.map((l) => `${l.collabName.split(' ')[0]} (${l.breakTime})`).join(', ')}
              </p>
            </div>
          )}

          {returningSoon.length > 0 && (
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200">
              <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                <span className="flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Retornando do intervalo em breve:
                </span>
                <span className="text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded-md">{returningSoon.length}</span>
              </div>
              <p className="text-[11px] font-medium truncate">
                {returningSoon.map((r) => r.collabName.split(' ')[0]).join(', ')}
              </p>
            </div>
          )}

          {leavingSoon.length === 0 && returningSoon.length === 0 && (
            <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-center text-[var(--muted)]">
              <p className="text-[11px]">Nenhum intervalo iminente nos próximos 20 minutos.</p>
              {onBreakNow.length > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1">
                  {onBreakNow.length} colaborador(es) em intervalo agora.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer info */}
      <div className="mt-3 pt-2.5 border-t border-[var(--line)] flex items-center justify-between text-[10px] text-[var(--muted)]">
        <span>Total escalados: {breakDepartures.length}</span>
        <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Monitor Ativo
        </span>
      </div>
    </div>
  );
};
