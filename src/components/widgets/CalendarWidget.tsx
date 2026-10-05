import React from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, ArrowUpRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatDateBR, isScaleOff } from '../../utils/helpers';

interface CalendarWidgetProps {
  onOpenFull?: () => void;
  className?: string;
  compact?: boolean;
}

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({ onOpenFull, className = '', compact = false }) => {
  const { state, setDate } = useApp();
  const selectedDate = state.selectedDate;

  // Compute scale groups on duty vs on off today
  const groups = state.scaleGroups || [];
  const offGroups = groups.filter((g) => isScaleOff(state.calendar, selectedDate, g));
  const workingGroups = groups.filter((g) => !offGroups.includes(g));

  const changeDay = (offset: number) => {
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      d.setDate(d.getDate() + offset);
      const nextDate = d.toISOString().split('T')[0];
      setDate(nextDate);
    } catch {
      // ignore
    }
  };

  // Next 3 days preview
  const daysForecast = [1, 2, 3].map((offset) => {
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      d.setDate(d.getDate() + offset);
      const dateStr = d.toISOString().split('T')[0];
      const dayOffs = groups.filter((g) => isScaleOff(state.calendar, dateStr, g));
      const dayWorks = groups.filter((g) => !dayOffs.includes(g));
      const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' });
      return {
        dateStr,
        dayName,
        dayNum: d.getDate(),
        works: dayWorks,
        offs: dayOffs,
      };
    } catch {
      return null;
    }
  }).filter(Boolean);

  const formattedDate = formatDateBR(selectedDate);
  const weekday = (() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('pt-BR', { weekday: 'long' });
    } catch {
      return '';
    }
  })();

  return (
    <div
      id="widget-calendar"
      className={`bg-[var(--paper)] border border-[var(--line)] rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-col justify-between transition-all hover:border-[var(--primary-border)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider text-[var(--muted)] truncate">Widget de Escala</div>
            <div className="text-sm font-bold text-[var(--ink)] capitalize truncate">{weekday}</div>
          </div>
        </div>

        {onOpenFull && (
          <button
            type="button"
            onClick={onOpenFull}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--line)]/50 transition-colors"
            title="Abrir Calendário Anual Completo"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Date Navigation Strip */}
      <div className="flex items-center justify-between bg-[var(--bg)] border border-[var(--line)] rounded-xl px-3 py-2 mb-3">
        <button
          type="button"
          onClick={() => changeDay(-1)}
          className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          title="Dia Anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-center font-mono font-bold text-sm text-[var(--ink)] tracking-tight">
          {formattedDate}
        </div>

        <button
          type="button"
          onClick={() => changeDay(1)}
          className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          title="Próximo Dia"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Today's Working & Off Scale Groups */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            Trabalham Hoje
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {workingGroups.length > 0 ? (
              workingGroups.map((g) => (
                <span
                  key={g}
                  className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-black text-xs shadow-xs"
                >
                  Turma {g}
                </span>
              ))
            ) : (
              <span className="text-xs text-[var(--muted)]">Nenhuma</span>
            )}
          </div>
        </div>

        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
            Folga Escalar
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {offGroups.length > 0 ? (
              offGroups.map((g) => (
                <span
                  key={g}
                  className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-black text-xs shadow-xs"
                >
                  Turma {g}
                </span>
              ))
            ) : (
              <span className="text-xs text-[var(--muted)]">Nenhuma</span>
            )}
          </div>
        </div>
      </div>

      {/* Mini Forecast for Next Days */}
      {!compact && (
        <div className="border-t border-[var(--line)] pt-2.5 mt-auto">
          <div className="text-[10.5px] font-bold text-[var(--muted)] mb-1.5 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Próximos dias da Escala</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {daysForecast.map((item) => item && (
              <div
                key={item.dateStr}
                className="bg-[var(--bg)] border border-[var(--line)] rounded-lg p-1.5 text-center"
              >
                <div className="text-[10px] uppercase font-bold text-[var(--muted)]">{item.dayName} {item.dayNum}</div>
                <div className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 truncate mt-0.5">
                  T: {item.works.join('')}
                </div>
                <div className="text-[9.5px] font-bold text-rose-500 truncate">
                  F: {item.offs.join('')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
