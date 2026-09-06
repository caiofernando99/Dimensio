import React from 'react';
import { motion } from 'motion/react';
import { ListTodo, CheckSquare, Square, ArrowUpRight, Calendar, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayISO, formatDateBR } from '../../utils/helpers';

interface RoutinesWidgetProps {
  onOpenRoutines?: () => void;
}

export const RoutinesWidget: React.FC<RoutinesWidgetProps> = ({ onOpenRoutines }) => {
  const { state, toggleScheduledTaskComplete, toggleScheduledSubtaskComplete, showNotice } = useApp();

  const activeDate = state.selectedDate || getTodayISO();
  const scheduledTasks = state.scheduledTasks || [];

  // Filter tasks due today or pending
  const todayTasks = scheduledTasks.filter(
    (t) => !t.dueDate || t.dueDate === activeDate || t.status !== 'concluida'
  );

  const completedCount = todayTasks.filter((t) => t.status === 'concluida').length;

  return (
    <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl p-4 flex flex-col justify-between h-full shadow-xs hover:border-[var(--primary)]/30 transition-all">
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <ListTodo className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--ink)]">Rotinas & Agendamentos</h3>
              <p className="text-[10px] text-[var(--muted)]">Checklists e tarefas do dia</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenRoutines}
            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-0.5 cursor-pointer"
          >
            Abrir <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Task Items */}
        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
          {todayTasks.slice(0, 4).map((task) => {
            const isDone = task.status === 'concluida';
            return (
              <div
                key={task.id}
                onClick={() => toggleScheduledTaskComplete(task.id)}
                className={`p-2 rounded-xl border flex items-center gap-2 text-xs transition-all cursor-pointer ${
                  isDone
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-[var(--muted)] line-through'
                    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-blue-500/40'
                }`}
              >
                <button
                  type="button"
                  className="text-blue-600 dark:text-blue-400 shrink-0"
                >
                  {isDone ? <CheckSquare className="w-4 h-4 text-emerald-500" /> : <Square className="w-4 h-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold truncate">{task.title}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isDone ? (
                      <span className="text-[9.5px] text-emerald-600 dark:text-emerald-400 font-bold truncate">
                        ✓ {task.completedByName || 'Operador'} {task.completedAt ? `às ${new Date(task.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                      </span>
                    ) : (
                      task.dueDate && (
                        <span className="text-[9px] text-[var(--muted)] flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" /> {formatDateBR(task.dueDate)}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {todayTasks.length === 0 && (
            <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-center text-[11px] text-[var(--muted)]">
              Nenhuma rotina agendada para hoje.
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-[var(--line)] flex items-center justify-between text-[10px] text-[var(--muted)]">
        <span>Concluídas: {completedCount}/{todayTasks.length}</span>
        <button
          type="button"
          onClick={onOpenRoutines}
          className="font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5 cursor-pointer"
        >
          <Plus className="w-3 h-3" /> Nova Rotina
        </button>
      </div>
    </div>
  );
};
