import { ScheduledTask, ScheduledTaskList, RoutineRecurrence } from '../types';
import { getTodayISO } from './helpers';

export const DEFAULT_TASK_LISTS: ScheduledTaskList[] = [
  { id: 'default', name: 'Minhas Tarefas', color: '#6366f1', icon: 'CheckSquare', isDefault: true, order: 0 },
  { id: 'rotinas_turno', name: 'Rotinas de Turno & 5S', color: '#10b981', icon: 'RefreshCw', order: 1 },
  { id: 'auditorias', name: 'Auditorias & Qualidade', color: '#f59e0b', icon: 'ShieldCheck', order: 2 },
  { id: 'manutencao', name: 'Manutenção & Infra', color: '#8b5cf6', icon: 'Wrench', order: 3 },
  { id: 'operacao', name: 'Operação & Inventário', color: '#0ea5e9', icon: 'Boxes', order: 4 },
];

export const DEFAULT_SAMPLE_TASKS: ScheduledTask[] = [];

/**
 * Checks if a date falls on a given scheduled task (considering single dates and recurrence rules).
 */
export function isTaskDueOnDate(
  task: ScheduledTask,
  dateStr: string,
  calendarScaleState?: Record<string, string>
): boolean {
  if (!dateStr) return false;

  // Direct date match
  if (task.dueDate === dateStr || task.startDate === dateStr) {
    return true;
  }

  // Date range match (if startDate and dueDate span across dateStr)
  if (task.startDate && task.dueDate && dateStr >= task.startDate && dateStr <= task.dueDate) {
    return true;
  }

  // Recurrence rule evaluation
  const rec = task.recurrence;
  if (!rec || rec.type === 'none') {
    return false;
  }

  // If task has an end date for recurrence, respect it
  if (rec.endDate && dateStr > rec.endDate) {
    return false;
  }

  // If task has a start date, recurrence only starts from then
  if (task.startDate && dateStr < task.startDate) {
    return false;
  }

  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day, 12, 0, 0);
    const dayOfWeek = dateObj.getDay(); // 0 = Domingo, 1 = Segunda, ... 6 = Sábado
    const dayOfMonth = dateObj.getDate();

    switch (rec.type) {
      case 'daily':
        return true;

      case 'weekdays':
        return dayOfWeek >= 1 && dayOfWeek <= 5; // Segunda a Sexta

      case 'weekly':
        if (rec.daysOfWeek && rec.daysOfWeek.length > 0) {
          return rec.daysOfWeek.includes(dayOfWeek);
        }
        // If not specified, default to day of week of dueDate or Monday
        if (task.dueDate) {
          const [dy, dm, dd] = task.dueDate.split('-').map(Number);
          return new Date(dy, dm - 1, dd, 12, 0, 0).getDay() === dayOfWeek;
        }
        return dayOfWeek === 1;

      case 'monthly':
        if (rec.dayOfMonth) {
          return dayOfMonth === rec.dayOfMonth;
        }
        if (task.dueDate) {
          const [, , dd] = task.dueDate.split('-').map(Number);
          return dayOfMonth === dd;
        }
        return dayOfMonth === 1;

      case 'custom_days':
        if (rec.daysOfWeek && rec.daysOfWeek.length > 0) {
          return rec.daysOfWeek.includes(dayOfWeek);
        }
        return false;

      case 'shift_scale':
        // Checks if scale group or shift is active on this day
        if (rec.scaleGroups && rec.scaleGroups.length > 0 && calendarScaleState) {
          const offGroup = calendarScaleState[dateStr];
          // If group is NOT on off, it is working
          return rec.scaleGroups.some((g) => g !== offGroup);
        }
        return true;

      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Returns all tasks scheduled for a given date.
 */
export function getTasksForDate(
  tasks: ScheduledTask[],
  dateStr: string,
  calendarScaleState?: Record<string, string>,
  filterUserId?: string
): ScheduledTask[] {
  if (!tasks || !Array.isArray(tasks)) return [];

  return tasks.filter((t) => {
    // If filterUserId is specified, check if task is assigned to this user
    if (filterUserId) {
      const isAssigned = t.assignedTo && (t.assignedTo.includes(filterUserId) || t.assignedTo.includes('all'));
      if (!isAssigned) return false;
    }
    return isTaskDueOnDate(t, dateStr, calendarScaleState);
  });
}

/**
 * Returns progress statistics of a task and its subtasks.
 */
export function getTaskProgress(task: ScheduledTask): {
  total: number;
  completed: number;
  percent: number;
  isAllDone: boolean;
} {
  const subtasks = task.subtasks || [];
  if (subtasks.length === 0) {
    const isDone = task.status === 'concluida';
    return {
      total: 1,
      completed: isDone ? 1 : 0,
      percent: isDone ? 100 : 0,
      isAllDone: isDone,
    };
  }

  const completed = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isAllDone = total > 0 && completed === total;

  return { total, completed, percent, isAllDone };
}

/**
 * Formats a human-readable label for a recurrence rule.
 */
export function formatRecurrenceLabel(rec?: RoutineRecurrence): string {
  if (!rec || rec.type === 'none') return 'Não recorrente (única)';

  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  switch (rec.type) {
    case 'daily':
      return rec.time ? `Diariamente às ${rec.time}` : 'Diariamente';
    case 'weekdays':
      return rec.time ? `Segunda a Sexta às ${rec.time}` : 'Dias úteis (Seg a Sex)';
    case 'weekly': {
      const days = (rec.daysOfWeek || []).map((d) => DAYS[d] || '').filter(Boolean).join(', ');
      const daysTxt = days ? `(${days})` : 'semanalmente';
      return rec.time ? `Semanal ${daysTxt} às ${rec.time}` : `Semanal ${daysTxt}`;
    }
    case 'monthly':
      return rec.dayOfMonth ? `Mensal (todo dia ${rec.dayOfMonth})` : 'Mensal';
    case 'shift_scale':
      return 'Conforme escala de turno';
    case 'custom_days': {
      const days = (rec.daysOfWeek || []).map((d) => DAYS[d] || '').filter(Boolean).join(', ');
      return `Dias selecionados: ${days}`;
    }
    default:
      return 'Recorrente';
  }
}

/**
 * Computes status pill / badge info for due date & time.
 */
export function formatDueBadge(
  dueDate?: string,
  dueTime?: string
): {
  text: string;
  tone: 'danger' | 'warning' | 'info' | 'success' | 'neutral';
  isOverdue: boolean;
  isToday: boolean;
} {
  if (!dueDate) {
    return { text: 'Sem data', tone: 'neutral', isOverdue: false, isToday: false };
  }

  const todayStr = getTodayISO();

  if (dueDate < todayStr) {
    return {
      text: dueTime ? `Atrasada (${formatDateShort(dueDate)} ${dueTime})` : `Atrasada (${formatDateShort(dueDate)})`,
      tone: 'danger',
      isOverdue: true,
      isToday: false,
    };
  }

  if (dueDate === todayStr) {
    return {
      text: dueTime ? `Hoje às ${dueTime}` : 'Hoje',
      tone: 'warning',
      isOverdue: false,
      isToday: true,
    };
  }

  return {
    text: dueTime ? `${formatDateShort(dueDate)} às ${dueTime}` : formatDateShort(dueDate),
    tone: 'info',
    isOverdue: false,
    isToday: false,
  };
}

function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${d}/${m}`;
}
