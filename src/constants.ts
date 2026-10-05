export { APP_VERSION, BUILD_TS as APP_BUILD_DATE, BUILD_TS, GIT_COMMIT, GIT_BRANCH, FULL_VERSION, APPS_SCRIPT_VERSION, WEBHOOK_SCRIPT_VERSION } from './version';

// Legado: exemplo inicial de turmas. NÃO é mais um esquema fixo — o usuário
// define suas próprias turmas (state.scaleGroups). Mantido apenas como
// fallback para instalações antigas.
export const SHIFT_GROUPS = ['A', 'B', 'C', 'D'] as const;
export type ShiftGroup = string;

export const TEAM_SHIFTS = ['T1', 'T2', 'T3', 'T4', 'T5', 'Manhã', 'Tarde', 'Noite', 'Geral'] as const;
export type TeamShift = typeof TEAM_SHIFTS[number];

export const ABSENCE_TYPES = ['atraso', 'ferias', 'licenca', 'treinamento', 'atestado', 'banco_horas', 'falta_injustificada'] as const;
export type AbsenceType = typeof ABSENCE_TYPES[number];

export const STATUS_TYPES = ['presente', 'atraso', 'ausente', 'folga', 'ferias', 'licenca', 'treinamento', 'atestado', 'banco_horas', 'falta_injustificada'] as const;
export type StatusType = typeof STATUS_TYPES[number];

export const THEME_OPTIONS = [
  'dimensio',
  'aurora',
  'ocean',
  'sunset',
  'crimson',
  'midnight',
  'graphite',
  'material-emerald',
  'material-blue',
  'material-purple',
  'material-terracotta',
  'material-dark',
] as const;
export type ThemeOption = typeof THEME_OPTIONS[number];

export const FILTER_ALL_VALUES = ['ALL', 'todos'] as const;
export type FilterAllValue = typeof FILTER_ALL_VALUES[number];

export const DEFAULT_SHIFTS = ['Geral', 'T1', 'T2', 'T3', 'T4', 'T5'] as const;

export const STORAGE_KEYS = {
  APP_STATE: 'people-scheduler-v3',
  AUTO_BACKUP: 'escalapro_auto_backup_v1',
  BACKUP_HISTORY: 'escalapro_backup_history_v2',
  TUTORIAL_SEEN: 'escalapro_tutorial_seen_v1',
} as const;

export const BROADCAST_CHANNEL = 'escalapro_live_channel';

export const UNDO_STACK_MAX = 40;
export const BACKUP_HISTORY_MAX = 15;
export const AUTO_SYNC_DEBOUNCE_MS = 800;
export const POLLING_INTERVAL_MS = 2000;
export const LOCAL_EDIT_COOLDOWN_MS = 1200;

export const REASON_LABELS: Record<AbsenceType, string> = {
  atraso: 'Atraso',
  ferias: 'Férias',
  licenca: 'Licença Médica',
  treinamento: 'Treinamento',
  atestado: 'Atestado Médico',
  banco_horas: 'Banco de Horas',
  falta_injustificada: 'Falta Injustificada',
};

export const STATUS_BADGE_CLASSES: Record<StatusType, string> = {
  presente: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  atraso: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300',
  ausente: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  folga: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
  ferias: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  licenca: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  treinamento: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  atestado: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  banco_horas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  falta_injustificada: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
};