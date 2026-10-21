import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../types';
import { parseNaturalDateBR, parseSmartSearchAction } from './smartSearchEngine';

describe('parseNaturalDateBR', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses explicit dd/mm using the current year', () => {
    expect(parseNaturalDateBR('16/09')).toEqual({
      isoDate: '2026-09-16',
      formattedBR: '16/09/2026',
    });
  });

  it('rejects impossible dates', () => {
    expect(parseNaturalDateBR('31/02')).toBeNull();
    expect(parseNaturalDateBR('32/01/2026')).toBeNull();
  });

  it('parses the next occurrence of a weekday', () => {
    expect(parseNaturalDateBR('segunda')?.isoDate).toBe('2026-10-26');
    expect(parseNaturalDateBR('sexta-feira')?.isoDate).toBe('2026-10-23');
  });

  it('parses "próxima" weekday as the following week', () => {
    expect(parseNaturalDateBR('próxima segunda')?.isoDate).toBe('2026-11-02');
  });
});

describe('parseSmartSearchAction', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const state = {
    collaborators: [
      {
        id: 'collab-1',
        name: 'Carlos Eduardo',
        role: 'Operador',
        shift: 'T2',
        scale: 'B',
        skills: {},
      },
    ],
    tasks: [{ id: 'task-1', name: 'Recebimento', members: [], active: true }],
    breaks: [],
    scheduledTaskLists: [],
    scheduledTasks: [],
    selectedDate: '2026-10-20',
  } as unknown as AppState;

  it('treats "tarefa <pessoa> em <posto>" as allocation, not a routine task', () => {
    const parsed = parseSmartSearchAction('/tarefa Carlos em Recebimento', { state });
    expect(parsed?.actionType).toBe('allocate_task');
    expect(parsed?.params.collaborator?.id).toBe('collab-1');
    expect(parsed?.params.task?.id).toBe('task-1');
  });

  it('still creates a scheduled task when there is no allocation target', () => {
    const parsed = parseSmartSearchAction('/tarefa fechar caixa amanhã', { state });
    expect(parsed?.actionType).toBe('scheduled_task_custom');
    expect(parsed?.params.targetDate).toBe('2026-10-21');
  });
});
