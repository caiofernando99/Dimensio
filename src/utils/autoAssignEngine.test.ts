import { describe, it, expect } from 'vitest';
import { executeAutoAssign, calculateCollabTaskScore } from '../utils/autoAssignEngine';
import { Collaborator, Task } from '../types';

describe('autoAssignEngine', () => {
  const sampleCollaborators: Collaborator[] = [
    {
      id: 'c1',
      name: 'Carlos Silva',
      role: 'Operador',
      category: 'Inbound',
      shift: 'T1',
      scale: 'A',
      skills: { 'Bipagem': 3, 'Conferência': 1 },
    },
    {
      id: 'c2',
      name: 'Mariana Costa',
      role: 'Operador',
      category: 'Outbound',
      shift: 'T1',
      scale: 'A',
      skills: { 'Empilhadeira': 3 },
    },
    {
      id: 'c3',
      name: 'Rafael Souza',
      role: 'PS',
      category: 'Inbound',
      shift: 'T1',
      scale: 'A',
      skills: { 'Bipagem': 2 },
    },
    {
      id: 'c4',
      name: 'Beatriz Lima',
      role: 'Operador',
      category: 'Inbound',
      shift: 'T1',
      scale: 'A',
      skills: {},
    },
  ];

  const sampleTasks: Task[] = [
    {
      id: 't1',
      name: 'Recebimento Pesado',
      members: [],
      requiredSkills: ['Empilhadeira'],
      minHeadcount: 1,
      maxHeadcount: 1,
      priority: 'alta',
      active: true,
    },
    {
      id: 't2',
      name: 'Conferência de Carga',
      members: [],
      requiredSkills: ['Bipagem'],
      allowedCategories: ['Inbound'],
      minHeadcount: 1,
      maxHeadcount: 2,
      priority: 'media',
      active: true,
    },
    {
      id: 't3',
      name: 'Apoio Geral',
      members: [],
      minHeadcount: 1,
      maxHeadcount: 3,
      priority: 'baixa',
      active: true,
    },
  ];

  it('calculates higher score for matching skills', () => {
    const scoreEmpilhadeira = calculateCollabTaskScore(sampleCollaborators[1], sampleTasks[0]);
    const scoreNoSkill = calculateCollabTaskScore(sampleCollaborators[0], sampleTasks[0]);
    expect(scoreEmpilhadeira).toBeGreaterThan(scoreNoSkill);
  });

  it('allocates specialists to tasks requiring their skills in skills strategy', () => {
    const result = executeAutoAssign(sampleCollaborators, sampleTasks, {
      strategy: 'skills',
      considerSkills: true,
      respectMinHeadcount: true,
    });

    const task1 = result.tasks.find((t) => t.id === 't1');
    const task2 = result.tasks.find((t) => t.id === 't2');

    expect(task1?.members).toContain('c2'); // Mariana has Empilhadeira
    expect(task2?.members.length).toBeGreaterThanOrEqual(1);
    expect(result.stats.totalAllocated).toBe(sampleCollaborators.length);
  });

  it('respects minHeadcount and distributes people balancedly', () => {
    const result = executeAutoAssign(sampleCollaborators, sampleTasks, {
      strategy: 'balanced',
      respectMinHeadcount: true,
    });

    expect(result.stats.tasksFilled).toBeGreaterThanOrEqual(2);
    expect(result.stats.totalAllocated).toBe(4);
    expect(result.stats.unassignedCount).toBe(0);
  });

  it('handles empty collaborators or inactive tasks gracefully', () => {
    const emptyResult = executeAutoAssign([], sampleTasks);
    expect(emptyResult.stats.totalAllocated).toBe(0);
    expect(emptyResult.stats.totalAvailable).toBe(0);

    const inactiveTasks = sampleTasks.map((t) => ({ ...t, active: false }));
    const inactiveResult = executeAutoAssign(sampleCollaborators, inactiveTasks);
    expect(inactiveResult.stats.tasksFilled).toBe(0);
  });
});
