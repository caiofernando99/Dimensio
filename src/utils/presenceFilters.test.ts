import { describe, it, expect } from 'vitest';
import type { AppState, Collaborator } from '../types';
import {
  stripAllSentinels,
  isOpenFilter,
  matchesDeskFilter,
  filterDeskCollaborators,
  filterPresentCollaborators,
} from './presenceFilters';

/**
 * Equipe fictícia cobrindo os casos reais:
 * - Ana/Rui: presentes, dimensionados (Doca 01)
 * - Bruno: folga pela escala
 * - Carla: atestado via override em objeto {absent:true, reason}
 * - Diego: presença extra (marcado presente mesmo em dia de folga)
 * - Elisa: ausente (override booleano false)
 */
const DATE = '2026-10-03';

const collaborators: Collaborator[] = [
  { id: 'c-ana', name: 'Ana Silva', shift: 'T2', scale: 'Alfa', role: 'Operador', category: 'Geral' },
  { id: 'c-rui', name: 'Rui Costa', shift: 'T2', scale: 'Alfa', role: 'Operador', category: 'Geral' },
  { id: 'c-bruno', name: 'Bruno Souza', shift: 'T2', scale: 'Noturna', role: 'Operador', category: 'Geral' },
  { id: 'c-carla', name: 'Carla Dias', shift: 'T2', scale: 'Alfa', role: 'Operador', category: 'Geral' },
  { id: 'c-diego', name: 'Diego Lima', shift: 'T2', scale: 'Noturna', role: 'Operador', category: 'Geral' },
  { id: 'c-elisa', name: 'Elisa Rocha', shift: 'T1', scale: 'Alfa', role: 'Operador', category: 'Geral' },
];

const state = {
  calendar: { [DATE]: { offGroups: ['Noturna'] } },
  attendance: {
    [DATE]: {
      'c-carla': { absent: true, reason: 'atestado' },
      'c-diego': true,
      'c-elisa': false,
    },
  },
  dailyReports: {},
  collaborators,
  tasks: [{ id: 't1', name: 'Doca 01', members: ['c-ana', 'c-rui'] }],
} as unknown as AppState;

describe('presenceFilters (cenário do resumo compartilhar)', () => {
  it('não zera com filtros em branco (defaults)', () => {
    const present = filterPresentCollaborators(collaborators, DATE, state, {});
    expect(present.map((c) => c.id).sort()).toEqual(['c-ana', 'c-diego', 'c-rui']);
  });

  it('trata sentinelas "Todos"/"Todas" como sem filtro (o bug do 0 presentes)', () => {
    const opts = { shifts: ['Todos'], categories: ['Todas'], roles: ['Todos'], tls: ['Todos'] };
    const present = filterPresentCollaborators(collaborators, DATE, state, opts);
    expect(present).toHaveLength(3);
  });

  it('exclui atestado via override em objeto', () => {
    const present = filterPresentCollaborators(collaborators, DATE, state, {});
    expect(present.some((c) => c.id === 'c-carla')).toBe(false);
  });

  it('inclui presença extra em dia de folga', () => {
    const present = filterPresentCollaborators(collaborators, DATE, state, {});
    expect(present.some((c) => c.id === 'c-diego')).toBe(true);
  });

  it('respeita seleção explícita de turno', () => {
    const t1 = filterPresentCollaborators(collaborators, DATE, state, { shifts: ['T1'] });
    expect(t1).toHaveLength(0); // Elisa (T1) está ausente
    const t2 = filterPresentCollaborators(collaborators, DATE, state, { shifts: ['T2'] });
    expect(t2).toHaveLength(3);
  });

  it('desk filter sem presença conta o total do filtro', () => {
    const desk = filterDeskCollaborators(collaborators, { shifts: ['T2'] });
    expect(desk).toHaveLength(5);
  });

  it('helpers de sentinela', () => {
    expect(stripAllSentinels(['Todos', 'T2'])).toEqual(['T2']);
    expect(stripAllSentinels(['Todas'])).toEqual([]);
    expect(isOpenFilter([])).toBe(true);
    expect(isOpenFilter(['Todos'])).toBe(true);
    expect(isOpenFilter(['T2'])).toBe(false);
    expect(matchesDeskFilter('T2', ['Todos'])).toBe(true);
    expect(matchesDeskFilter('T2', ['T1'])).toBe(false);
  });
});
