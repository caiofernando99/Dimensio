import type { AppState, Collaborator } from '../types';
import { getCollaboratorStatus } from './helpers';
import { matchesSearch } from './helpers';

/**
 * Filtros de presença/mesa compartilhados.
 *
 * Correções centrais (erros reais encontrados em ShareView e
 * QuickPresentationView169):
 * 1. Valores sentinela ('Todos', 'Todas', 'ALL', 'todos') significam
 *    "sem filtro" — antes eram tratados como allow-list literal e zeravam
 *    o resumo ("0 presentes" com equipe presente e dimensionada).
 * 2. overrides manuais em objeto ({absent:true, reason}) eram ignorados
 *    (só `=== false` filtrava) — agora passam por getCollaboratorStatus.
 */

export const FILTER_ALL_SENTINELS = ['ALL', 'all', 'todos', 'Todas', 'Todos'];

/** Remove sentinelas "tudo" de uma seleção multi (migração de filtros salvos). */
export function stripAllSentinels(selected: string[] | undefined): string[] {
  if (!Array.isArray(selected)) return [];
  return selected.filter((s) => !FILTER_ALL_SENTINELS.includes(s));
}

/** true = a seleção não restringe nada (vazia ou só sentinelas). */
export function isOpenFilter(selected: string[] | undefined): boolean {
  if (!selected || selected.length === 0) return true;
  return selected.every((s) => FILTER_ALL_SENTINELS.includes(s));
}

/** allow-list que entende sentinelas. */
export function matchesDeskFilter(value: string | undefined, selected: unknown, fallback = ''): boolean {
  if (!Array.isArray(selected)) return true;
  if (isOpenFilter(selected as string[])) return true;
  return (selected as string[]).includes(value || fallback);
}

export interface DeskFilterOpts {
  shifts?: string[];
  categories?: string[];
  roles?: string[];
  tls?: string[];
  search?: unknown;
  /** filtro de turno único (ex: selectedShiftFilter/teamShift). Ignorado se shifts tiver seleção real. */
  activeShift?: string;
  defaultTL?: string;
}

const ACTIVE_SHIFT_SENTINELS = ['ALL', 'todos'];

/** Colaboradores que passam nos filtros de mesa (sem checar presença). */
export function filterDeskCollaborators(
  collaborators: Collaborator[],
  opts: DeskFilterOpts
): Collaborator[] {
  const shifts = stripAllSentinels(opts.shifts);
  const activeShift =
    shifts.length === 0 && opts.activeShift && !ACTIVE_SHIFT_SENTINELS.includes(opts.activeShift)
      ? opts.activeShift
      : null;
  return (collaborators || []).filter((c) => {
    const colShift = c.shift || 'Geral';
    if (shifts.length > 0) {
      if (!shifts.includes(colShift)) return false;
    } else if (activeShift && colShift !== activeShift) {
      return false;
    }
    if (!matchesDeskFilter(c.category || 'Geral', opts.categories)) return false;
    if (!matchesDeskFilter(c.role || 'Operador', opts.roles)) return false;
    if (!matchesDeskFilter(c.teamLeader || opts.defaultTL || 'Sem Time', opts.tls)) return false;
    if (typeof opts.search === 'string' && opts.search && !matchesSearch(c.name, opts.search)) return false;
    return true;
  });
}

export function isPresentStatus(status: string): boolean {
  return status === 'presente' || status === 'atraso';
}

/**
 * Colaboradores presentes (presente/atraso) no dia, já com filtros de mesa.
 * Usa getCollaboratorStatus — única fonte da verdade (folga, férias,
 * atestado, banco de horas, overrides manuais booleanos E em objeto,
 * presença extra em dia de folga).
 */
export function filterPresentCollaborators(
  collaborators: Collaborator[],
  dateStr: string,
  state: AppState,
  opts: DeskFilterOpts
): Collaborator[] {
  return filterDeskCollaborators(collaborators, opts).filter((c) =>
    isPresentStatus(getCollaboratorStatus(c, dateStr, state).status)
  );
}
