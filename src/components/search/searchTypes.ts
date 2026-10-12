import { Collaborator, Task, BreakSlot } from '../../types';
import { StatusType } from '../../utils/helpers';

export const STATUS_META: Record<StatusType, { label: string; text: string; bg: string; dot: string }> = {
  presente: {
    label: 'Presente',
    text: 'text-emerald-800 dark:text-emerald-200',
    bg: 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-600',
  },
  atraso: {
    label: 'Atraso',
    text: 'text-amber-800 dark:text-amber-200',
    bg: 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800',
    dot: 'bg-amber-600',
  },
  folga: {
    label: 'Folga',
    text: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-500',
  },
  ferias: {
    label: 'Férias',
    text: 'text-purple-800 dark:text-purple-200',
    bg: 'bg-purple-100 dark:bg-purple-950/70 border-purple-300 dark:border-purple-800',
    dot: 'bg-purple-600',
  },
  licenca: {
    label: 'Licença',
    text: 'text-amber-800 dark:text-amber-200',
    bg: 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800',
    dot: 'bg-amber-600',
  },
  atestado: {
    label: 'Atestado',
    text: 'text-blue-800 dark:text-blue-200',
    bg: 'bg-blue-100 dark:bg-blue-950/70 border-blue-300 dark:border-blue-800',
    dot: 'bg-blue-600',
  },
  banco_horas: {
    label: 'Banco de Horas',
    text: 'text-teal-800 dark:text-teal-200',
    bg: 'bg-teal-100 dark:bg-teal-950/70 border-teal-300 dark:border-teal-800',
    dot: 'bg-teal-600',
  },
  falta_injustificada: {
    label: 'Falta Injustificada',
    text: 'text-rose-800 dark:text-rose-200',
    bg: 'bg-rose-100 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800',
    dot: 'bg-rose-600',
  },
  treinamento: {
    label: 'Treinamento',
    text: 'text-cyan-800 dark:text-cyan-200',
    bg: 'bg-cyan-100 dark:bg-cyan-950/70 border-cyan-300 dark:border-cyan-800',
    dot: 'bg-cyan-600',
  },
  ausente: {
    label: 'Ausente',
    text: 'text-red-800 dark:text-red-200',
    bg: 'bg-red-100 dark:bg-red-950/70 border-red-300 dark:border-red-800',
    dot: 'bg-red-600',
  },
};

export const STATUS_ORDER: StatusType[] = [
  'presente',
  'atraso',
  'folga',
  'ferias',
  'licenca',
  'atestado',
  'treinamento',
  'banco_horas',
  'falta_injustificada',
  'ausente',
];

export const ABSENCE_TERMS: { term: string; status: StatusType; label: string }[] = [
  { term: 'presente', status: 'presente', label: 'Presente' },
  { term: 'atraso', status: 'atraso', label: 'Atraso' },
  { term: 'folga', status: 'folga', label: 'Folga' },
  { term: 'ferias', status: 'ferias', label: 'Férias' },
  { term: 'férias', status: 'ferias', label: 'Férias' },
  { term: 'licenca', status: 'licenca', label: 'Licença' },
  { term: 'licença', status: 'licenca', label: 'Licença' },
  { term: 'atestado', status: 'atestado', label: 'Atestado' },
  { term: 'treinamento', status: 'treinamento', label: 'Treinamento' },
  { term: 'banco de horas', status: 'banco_horas', label: 'Banco de Horas' },
  { term: 'banco_horas', status: 'banco_horas', label: 'Banco de Horas' },
  { term: 'falta injustificada', status: 'falta_injustificada', label: 'Falta Injustificada' },
  { term: 'falta_injustificada', status: 'falta_injustificada', label: 'Falta Injustificada' },
  { term: 'falta', status: 'falta_injustificada', label: 'Falta Injustificada' },
  { term: 'ausente', status: 'ausente', label: 'Ausente' },
];

export interface CollabResult {
  collab: Collaborator;
  status: StatusType;
  tasksToday: Task[];
  breakSlot?: BreakSlot;
  isOffScale: boolean;
  isExtraPresence: boolean;
}

export interface TaskResult {
  task: Task;
  members: Array<{
    collab: Collaborator;
    status: StatusType;
    breakSlot?: BreakSlot;
    viaSubtask?: boolean;
    subtaskName?: string;
  }>;
  rootTaskName?: string;
  isSubtask: boolean;
  hasSubtasks: boolean;
  subtaskCount: number;
}

export interface SkillCollabResult {
  collab: Collaborator;
  status: StatusType;
  skills: Array<{ name: string; level: number }>;
}
