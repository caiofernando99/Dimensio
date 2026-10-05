/**
 * Roteador de importação de arquivos JSON.
 *
 * Causa raiz de "importei e sumiu tudo": o import aceitava QUALQUER json
 * (inclusive exportações parciais como a do calendário) como backup total,
 * e o modal sugeria `config_only` por padrão (que nunca importa rotinas,
 * pedidos e hub). Este módulo classifica o arquivo antes de aplicar:
 * - `calendar`: exportação parcial de escala → só o calendário é mesclado,
 *   o resto do sistema nunca é tocado;
 * - `full-state`: backup/estado completo (inclui embrulhos BackupSnapshot
 *   `{state}` e payloads stringificados);
 * - `unknown`: json válido mas sem cara de backup → tratado com cautela.
 */

export type BackupFileKind = 'calendar' | 'full-state' | 'unknown';

function tryParse(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/** Desembrulha formatos conhecidos (BackupSnapshot, rawState, string) até o estado. */
export function unwrapBackupJson(input: unknown): unknown {
  let cur = tryParse(input);
  for (let i = 0; i < 4 && cur && typeof cur === 'object' && !Array.isArray(cur); i++) {
    const o = cur as Record<string, unknown>;
    const inner = o.state ?? o.rawState ?? o.stateRaw ?? o.snapshot;
    if (inner && (typeof inner === 'object' || typeof inner === 'string')) {
      const parsed = tryParse(inner);
      if (parsed && typeof parsed === 'object') {
        cur = parsed;
        continue;
      }
    }
    // `data` como objeto-estado (algumas exportações antigas)
    if (o.data && typeof o.data === 'object' && !Array.isArray(o.data) && (o.data as Record<string, unknown>).collaborators) {
      cur = o.data;
      continue;
    }
    break;
  }
  return cur;
}

/**
 * Exportação parcial de calendário (ex: `calendario-escala-2026.json`):
 * tem calendário mas NEM as chaves de colaboradores/tarefas.
 * Um estado completo sempre tem essas chaves (mesmo vazias).
 */
export function isCalendarOnlyExport(input: unknown): boolean {
  const cur = unwrapBackupJson(input);
  if (!cur || typeof cur !== 'object' || Array.isArray(cur)) return false;
  const o = cur as Record<string, unknown>;
  const hasCalendar = 'calendar' in o || 'calendarEvents' in o;
  if (!hasCalendar) return false;
  const hasRosterKeys = 'collaborators' in o || 'tasks' in o || 'teamName' in o;
  if ((o as Record<string, unknown>).type === 'people-scheduler-calendar') return true;
  return !hasRosterKeys;
}

export function classifyBackupFile(input: unknown): { kind: BackupFileKind; data: unknown } {
  if (isCalendarOnlyExport(input)) {
    return { kind: 'calendar', data: unwrapBackupJson(input) };
  }
  const data = unwrapBackupJson(input);
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    if ('collaborators' in o || 'tasks' in o || 'teamName' in o) {
      return { kind: 'full-state', data };
    }
  }
  return { kind: 'unknown', data };
}
