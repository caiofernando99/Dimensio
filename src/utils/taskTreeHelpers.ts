import { Task } from '../types';

export interface TaskTreeNode {
  task: Task;
  depth: number;
  children: TaskTreeNode[];
  isLastChild: boolean;
  parent?: Task;
}

export interface FlattenedTaskItem {
  task: Task;
  depth: number;
  hasChildren: boolean;
  isLastChild: boolean;
  parentTask?: Task;
  ancestors: Task[];
  childCount: number;
}

export interface SubtaskBreakdownItem {
  task: Task;
  members: string[];
  count: number;
  depth: number;
  path: string;
}

export interface ConsolidatedTaskGroup {
  rootTask: Task;
  subtasks: Task[];
  allTasks: Task[];
  directMembers: string[];
  allMembers: string[];
  totalCount: number;
  minHeadcountTotal: number;
  maxHeadcountTotal: number;
  hasSubtasks: boolean;
  subtaskBreakdown: SubtaskBreakdownItem[];
}

/**
 * Retorna todos os IDs descendentes de uma tarefa (filhas, netas, etc.)
 */
export function getAllDescendantIds(tasks: Task[], taskId: string): string[] {
  const descendants: string[] = [];
  const directChildren = tasks.filter((t) => t.parentId === taskId);

  for (const child of directChildren) {
    descendants.push(child.id);
    descendants.push(...getAllDescendantIds(tasks, child.id));
  }

  return descendants;
}

/**
 * Retorna todas as tarefas descendentes de uma tarefa
 */
export function getAllDescendants(tasks: Task[], taskId: string): Task[] {
  const descendantIds = new Set(getAllDescendantIds(tasks, taskId));
  return tasks.filter((t) => descendantIds.has(t.id));
}

/**
 * Verifica se um parentId é válido para uma tarefa (previne auto-referência e ciclos)
 */
export function canSetParent(tasks: Task[], taskId: string | undefined, potentialParentId: string): boolean {
  if (!taskId) return true;
  if (taskId === potentialParentId) return false;
  const descendantIds = getAllDescendantIds(tasks, taskId);
  return !descendantIds.includes(potentialParentId);
}

/**
 * Retorna as tarefas válidas que podem ser selecionadas como pai
 */
export function getValidParentOptions(tasks: Task[], currentTaskId?: string): Task[] {
  if (!currentTaskId) return tasks;
  const invalidIds = new Set([currentTaskId, ...getAllDescendantIds(tasks, currentTaskId)]);
  return tasks.filter((t) => !invalidIds.has(t.id));
}

/**
 * Retorna a tarefa raiz (topo da hierarquia) de qualquer tarefa ou subtarefa
 */
export function getRootTask(tasks: Task[], taskId: string): Task | undefined {
  const taskMap = new Map<string, Task>();
  tasks.forEach((t) => taskMap.set(t.id, t));

  let current = taskMap.get(taskId);
  const visited = new Set<string>();

  while (current && current.parentId && taskMap.has(current.parentId) && !visited.has(current.id)) {
    visited.add(current.id);
    current = taskMap.get(current.parentId);
  }

  return current;
}

/**
 * Retorna todos os IDs da família de uma tarefa (raiz + todas as subtarefas)
 */
export function getAllTaskIdsInFamily(tasks: Task[], taskId: string): string[] {
  const root = getRootTask(tasks, taskId);
  if (!root) return [taskId];
  return [root.id, ...getAllDescendantIds(tasks, root.id)];
}

/**
 * Constrói uma árvore hierárquica a partir da lista plana de tarefas
 */
export function buildTaskTree(tasks: Task[]): TaskTreeNode[] {
  const taskMap = new Map<string, Task>();
  tasks.forEach((t) => taskMap.set(t.id, t));

  const childrenMap = new Map<string, Task[]>();
  const rootTasks: Task[] = [];

  tasks.forEach((task) => {
    if (task.parentId && taskMap.has(task.parentId) && task.parentId !== task.id) {
      if (!childrenMap.has(task.parentId)) {
        childrenMap.set(task.parentId, []);
      }
      childrenMap.get(task.parentId)!.push(task);
    } else {
      rootTasks.push(task);
    }
  });

  function buildNodes(taskList: Task[], depth: number, parent?: Task): TaskTreeNode[] {
    return taskList.map((task, index) => {
      const isLastChild = index === taskList.length - 1;
      const subtasks = childrenMap.get(task.id) || [];
      const node: TaskTreeNode = {
        task,
        depth,
        isLastChild,
        parent,
        children: [],
      };
      node.children = buildNodes(subtasks, depth + 1, task);
      return node;
    });
  }

  return buildNodes(rootTasks, 0);
}

/**
 * Achata a árvore preservando a ordem hierárquica e adicionando metadados visuais de ramificação
 */
export function flattenTaskTree(tasks: Task[]): FlattenedTaskItem[] {
  const tree = buildTaskTree(tasks);
  const result: FlattenedTaskItem[] = [];

  function traverse(nodes: TaskTreeNode[], ancestors: Task[]) {
    nodes.forEach((node) => {
      const directChildrenCount = node.children.length;
      result.push({
        task: node.task,
        depth: node.depth,
        hasChildren: directChildrenCount > 0,
        isLastChild: node.isLastChild,
        parentTask: node.parent,
        ancestors: [...ancestors],
        childCount: directChildrenCount,
      });

      if (node.children.length > 0) {
        traverse(node.children, [...ancestors, node.task]);
      }
    });
  }

  traverse(tree, []);
  return result;
}

/**
 * Retorna a trilha de navegação / caminho hierárquico da tarefa (ex: "Recebimento › Separação")
 */
export function getTaskPath(tasks: Task[], taskId: string): string {
  const taskMap = new Map<string, Task>();
  tasks.forEach((t) => taskMap.set(t.id, t));

  const names: string[] = [];
  let current = taskMap.get(taskId);
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? taskMap.get(current.parentId) : undefined;
  }

  return names.join(' › ');
}

/**
 * Retorna as subtarefas diretas de uma tarefa
 */
export function getDirectSubtasks(tasks: Task[], parentId: string): Task[] {
  return tasks.filter((t) => t.parentId === parentId);
}

/**
 * Agrupa todas as tarefas na unidade principal (Tarefa Raiz) consolidando
 * suas subtarefas e colaboradores vinculados em todos os níveis.
 */
export function getConsolidatedTaskGroups(
  tasks: Task[],
  activeOnly: boolean = false
): ConsolidatedTaskGroup[] {
  const sourceTasks = activeOnly ? tasks.filter((t) => t.active !== false) : tasks;
  const taskMap = new Map<string, Task>();
  sourceTasks.forEach((t) => taskMap.set(t.id, t));

  // Identifica as tarefas raiz (que não têm parentId ou cujo parentId não existe nesta lista)
  const rootTasks = sourceTasks.filter((t) => !t.parentId || !taskMap.has(t.parentId));

  return rootTasks.map((rootTask) => {
    // Busca todas as tarefas descendentes da raiz
    const descendantIds = getAllDescendantIds(sourceTasks, rootTask.id);
    const subtasks = sourceTasks.filter((t) => descendantIds.includes(t.id));
    const allTasks = [rootTask, ...subtasks];

    const directMembers = [...(rootTask.members || [])];
    
    // Todos os membros únicos desta família de tarefas
    const memberSet = new Set<string>();
    allTasks.forEach((t) => {
      (t.members || []).forEach((mId) => memberSet.add(mId));
    });
    const allMembers = Array.from(memberSet);

    // Meta mínima total combinada
    const minHeadcountTotal = allTasks.reduce(
      (sum, t) => sum + (t.minHeadcount !== undefined ? t.minHeadcount : 0),
      0
    );
    const maxHeadcountTotal = allTasks.reduce(
      (sum, t) => sum + (t.maxHeadcount !== undefined ? t.maxHeadcount : 0),
      0
    );

    // Detalhamento hierárquico das subtarefas
    const subtaskTree = buildTaskTree(subtasks);
    const subtaskBreakdown: SubtaskBreakdownItem[] = [];

    function traverseSubtree(nodes: TaskTreeNode[]) {
      nodes.forEach((node) => {
        subtaskBreakdown.push({
          task: node.task,
          members: node.task.members || [],
          count: (node.task.members || []).length,
          depth: node.depth + 1,
          path: getTaskPath(sourceTasks, node.task.id),
        });
        if (node.children.length > 0) {
          traverseSubtree(node.children);
        }
      });
    }
    traverseSubtree(subtaskTree);

    return {
      rootTask,
      subtasks,
      allTasks,
      directMembers,
      allMembers,
      totalCount: allMembers.length,
      minHeadcountTotal,
      maxHeadcountTotal,
      hasSubtasks: subtasks.length > 0,
      subtaskBreakdown,
    };
  });
}
