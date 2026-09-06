import { Collaborator, Task, AutoAssignOptions, AutoAssignStrategy } from '../types';

export interface AutoAssignResult {
  tasks: Task[];
  stats: {
    totalAllocated: number;
    totalAvailable: number;
    tasksFilled: number;
    totalActiveTasks: number;
    skillsMatchCount: number;
    perfectMatchCount: number;
    unassignedCount: number;
    strategyUsed: AutoAssignStrategy;
  };
}

/**
 * Calcula a pontuação de compatibilidade entre um colaborador e uma tarefa
 */
export function calculateCollabTaskScore(
  collab: Collaborator,
  task: Task,
  options: AutoAssignOptions = {},
  currentTaskCount = 0
): number {
  const {
    considerSkills = true,
    considerRoles = true,
    considerCategories = true,
    considerPriorities = true,
  } = options;

  let score = 50; // Pontuação base neutra

  // 1. Cargo (Role Match)
  if (considerRoles && task.allowedRoles && task.allowedRoles.length > 0) {
    if (task.allowedRoles.includes(collab.role)) {
      score += 35;
    } else {
      score -= 60; // Penalidade forte para cargo incompatível
    }
  }

  // 2. Categoria (Category Match)
  if (considerCategories && task.allowedCategories && task.allowedCategories.length > 0) {
    if (task.allowedCategories.includes(collab.category)) {
      score += 20;
    } else {
      score -= 25;
    }
  }

  // 3. Skills Requeridas (Skill Match)
  if (considerSkills && task.requiredSkills && task.requiredSkills.length > 0) {
    const collabSkills = collab.skills || {};
    let matchedSkills = 0;
    let skillPoints = 0;

    task.requiredSkills.forEach((reqSkill) => {
      const level = collabSkills[reqSkill] || 0;
      if (level > 0) {
        matchedSkills++;
        // Nível 3: +30 pts, Nível 2: +20 pts, Nível 1: +10 pts
        skillPoints += level * 10;
      }
    });

    if (matchedSkills === task.requiredSkills.length) {
      score += 60 + skillPoints; // Match perfeito de todas as skills!
    } else if (matchedSkills > 0) {
      score += 25 + skillPoints; // Match parcial
    } else {
      score -= 40; // Não possui nenhuma das skills requeridas para a tarefa
    }
  } else if (considerSkills && (!task.requiredSkills || task.requiredSkills.length === 0)) {
    // Tarefa sem skills específicas requeridas é flexível para qualquer um
    score += 5;
  }

  // 4. Prioridade da Tarefa
  if (considerPriorities && task.priority) {
    if (task.priority === 'alta') score += 30;
    else if (task.priority === 'media') score += 10;
    else if (task.priority === 'baixa') score += 0;
  }

  // 5. Balanceamento de Carga (penalidade suave conforme mais pessoas são alocadas na tarefa)
  const targetMin = task.minHeadcount || 1;
  if (currentTaskCount < targetMin) {
    // Tarefa ainda está abaixo da meta mínima planejada: ganha bônus de atratividade
    score += 40 * (1 - currentTaskCount / targetMin);
  } else {
    // Tarefa já bateu a meta mínima: penalidade proporcional ao excesso
    score -= currentTaskCount * 12;
  }

  // Se tiver limite máximo definido e já atingiu, penalidade drástica
  if (options.respectMaxHeadcount && task.maxHeadcount && currentTaskCount >= task.maxHeadcount) {
    score -= 1000;
  }

  return score;
}

/**
 * Executa o auto-dimensionamento inteligente com suporte a múltiplas estratégias
 */
export function executeAutoAssign(
  collaborators: Collaborator[],
  allTasks: Task[],
  options: AutoAssignOptions = {}
): AutoAssignResult {
  const strategy: AutoAssignStrategy = options.strategy || 'balanced';
  const considerSkills = options.considerSkills !== false;
  const considerRoles = options.considerRoles !== false;
  const considerCategories = options.considerCategories !== false;
  const considerPriorities = options.considerPriorities !== false;
  const respectMinHeadcount = options.respectMinHeadcount !== false;
  const respectMaxHeadcount = options.respectMaxHeadcount !== false;

  // Filtrar apenas tarefas ativas e alvo (se especificado)
  const targetTasks = allTasks.filter((t) => {
    if (t.active === false) return false;
    if (options.targetTaskIds && options.targetTaskIds.length > 0) {
      return options.targetTaskIds.includes(t.id);
    }
    return true;
  });

  if (targetTasks.length === 0 || collaborators.length === 0) {
    return {
      tasks: allTasks.map((t) => (t.active === false ? { ...t, members: [] } : t)),
      stats: {
        totalAllocated: 0,
        totalAvailable: collaborators.length,
        tasksFilled: 0,
        totalActiveTasks: targetTasks.length,
        skillsMatchCount: 0,
        perfectMatchCount: 0,
        unassignedCount: collaborators.length,
        strategyUsed: strategy,
      },
    };
  }

  // Inicializar mapa de alocações limpo para tarefas alvo
  const allocationMap = new Map<string, string[]>();
  targetTasks.forEach((t) => allocationMap.set(t.id, []));

  // Preparar lista de colaboradores
  let availableCollabs = [...collaborators];

  // Ajuste de ordenação dos colaboradores conforme a estratégia
  if (strategy === 'skills') {
    // Ordena colaboradores com mais skills primeiro para alocá-los nos postos certos
    availableCollabs.sort((a, b) => {
      const skillsA = Object.keys(a.skills || {}).length;
      const skillsB = Object.keys(b.skills || {}).length;
      return skillsB - skillsA || a.name.localeCompare(b.name);
    });
  } else if (strategy === 'priority') {
    // Ordena alfabeticamente ou estável
    availableCollabs.sort((a, b) => a.name.localeCompare(b.name));
  } else if (strategy === 'rotation') {
    // Rotação: embaralha com seed determinístico baseado no hash do dia/nome ou shuffle
    availableCollabs.sort((a, b) => {
      const hashA = a.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      const hashB = b.name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
      return (hashA % 17) - (hashB % 17) || a.name.localeCompare(b.name);
    });
  } else {
    // 'balanced': ordenação estável por nome
    availableCollabs.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Ordenar tarefas prioritárias se a estratégia for prioridade
  const sortedTasks = [...targetTasks].sort((a, b) => {
    if (strategy === 'priority' || considerPriorities) {
      const priorityWeight: Record<string, number> = { alta: 3, media: 2, baixa: 1 };
      const weightA = a.priority ? priorityWeight[a.priority] || 2 : 2;
      const weightB = b.priority ? priorityWeight[b.priority] || 2 : 2;
      if (weightB !== weightA) return weightB - weightA;
    }
    // Tarefas com minHeadcount vêm antes para garantir preenchimento da cota básica
    const minA = a.minHeadcount || 1;
    const minB = b.minHeadcount || 1;
    return minB - minA;
  });

  // PASSO 1: Garantir que tarefas com skills específicas ou prioridade alta recebam especialistas
  if (strategy === 'skills' || considerSkills) {
    const tasksWithSkills = sortedTasks.filter((t) => (t.requiredSkills || []).length > 0);

    for (const task of tasksWithSkills) {
      const needed = task.minHeadcount || 1;
      let currentMembers = allocationMap.get(task.id) || [];

      while (currentMembers.length < needed && availableCollabs.length > 0) {
        // Encontrar o colaborador com maior pontuação para esta tarefa
        let bestCollabIndex = -1;
        let bestScore = -999;

        for (let i = 0; i < availableCollabs.length; i++) {
          const col = availableCollabs[i];
          const score = calculateCollabTaskScore(col, task, options, currentMembers.length);
          if (score > bestScore && score > 20) {
            bestScore = score;
            bestCollabIndex = i;
          }
        }

        if (bestCollabIndex !== -1) {
          const selectedCollab = availableCollabs.splice(bestCollabIndex, 1)[0];
          currentMembers.push(selectedCollab.id);
          allocationMap.set(task.id, currentMembers);
        } else {
          break; // Nenhum colaborador compatível disponível
        }
      }
    }
  }

  // PASSO 2: Garantir cobertura mínima (respeitar minHeadcount de todas as tarefas)
  if (respectMinHeadcount) {
    for (const task of sortedTasks) {
      const minReq = task.minHeadcount || 1;
      let currentMembers = allocationMap.get(task.id) || [];

      while (currentMembers.length < minReq && availableCollabs.length > 0) {
        let bestIndex = 0;
        let bestScore = -999;

        for (let i = 0; i < availableCollabs.length; i++) {
          const col = availableCollabs[i];
          const score = calculateCollabTaskScore(col, task, options, currentMembers.length);
          if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
          }
        }

        const selectedCollab = availableCollabs.splice(bestIndex, 1)[0];
        currentMembers.push(selectedCollab.id);
        allocationMap.set(task.id, currentMembers);
      }
    }
  }

  // PASSO 3: Distribuir os colaboradores restantes de forma homogênea e balanceada
  while (availableCollabs.length > 0) {
    const col = availableCollabs.shift()!;

    // Avaliar todas as tarefas alvo e encontrar a tarefa com melhor fit e menor sobrecarga
    let bestTaskId: string | null = null;
    let bestScore = -999999;

    for (const task of sortedTasks) {
      const currentMembers = allocationMap.get(task.id) || [];

      // Se respeitar maxHeadcount e já atingiu, pular se existirem outras tarefas disponíveis
      if (respectMaxHeadcount && task.maxHeadcount && currentMembers.length >= task.maxHeadcount) {
        continue;
      }

      const score = calculateCollabTaskScore(col, task, options, currentMembers.length);

      // Fator de balanceamento homogêneo: penalizar tarefas que já têm muito mais pessoas que a média
      const countPenalty = strategy === 'balanced' ? currentMembers.length * 15 : currentMembers.length * 8;
      const adjustedScore = score - countPenalty;

      if (adjustedScore > bestScore) {
        bestScore = adjustedScore;
        bestTaskId = task.id;
      }
    }

    // Se todas as tarefas estiverem no limite maxHeadcount, alocar na que tiver menos pessoas
    if (!bestTaskId) {
      let minCount = Infinity;
      for (const task of sortedTasks) {
        const count = (allocationMap.get(task.id) || []).length;
        if (count < minCount) {
          minCount = count;
          bestTaskId = task.id;
        }
      }
    }

    if (bestTaskId) {
      const current = allocationMap.get(bestTaskId) || [];
      current.push(col.id);
      allocationMap.set(bestTaskId, current);
    }
  }

  // Montar novo array de tarefas
  let totalAllocated = 0;
  let skillsMatchCount = 0;
  let perfectMatchCount = 0;

  const collabMap = new Map<string, Collaborator>();
  collaborators.forEach((c) => collabMap.set(c.id, c));

  const updatedTasks = allTasks.map((task) => {
    if (task.active === false) {
      return { ...task, members: [] };
    }

    if (allocationMap.has(task.id)) {
      const assignedIds = allocationMap.get(task.id) || [];
      totalAllocated += assignedIds.length;

      // Calcular estatísticas de skills
      if (task.requiredSkills && task.requiredSkills.length > 0) {
        assignedIds.forEach((colId) => {
          const col = collabMap.get(colId);
          if (col) {
            const hasAll = task.requiredSkills!.every((s) => (col.skills?.[s] || 0) > 0);
            const hasAny = task.requiredSkills!.some((s) => (col.skills?.[s] || 0) > 0);
            if (hasAll) perfectMatchCount++;
            if (hasAny) skillsMatchCount++;
          }
        });
      }

      return {
        ...task,
        members: assignedIds,
      };
    }

    return task;
  });

  const tasksFilled = targetTasks.filter((t) => (allocationMap.get(t.id) || []).length > 0).length;

  return {
    tasks: updatedTasks,
    stats: {
      totalAllocated,
      totalAvailable: collaborators.length,
      tasksFilled,
      totalActiveTasks: targetTasks.length,
      skillsMatchCount,
      perfectMatchCount,
      unassignedCount: Math.max(0, collaborators.length - totalAllocated),
      strategyUsed: strategy,
    },
  };
}
