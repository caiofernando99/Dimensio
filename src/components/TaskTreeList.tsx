import React, { useState } from 'react';
import {
  GitBranch,
  Sparkles,
  Briefcase,
  Tag,
  Plus,
  Pencil,
  Trash2,
  Users,
  Target,
  FolderTree,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Task } from '../types';
import { buildTaskTree, TaskTreeNode } from '../utils/taskTreeHelpers';
import { ConfirmModal } from './ConfirmModal';

interface TaskTreeListProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddSubtask: (parentTaskId: string) => void;
}

export const TaskTreeList: React.FC<TaskTreeListProps> = ({
  tasks,
  onEditTask,
  onDeleteTask,
  onAddSubtask,
}) => {
  const tree = buildTaskTree(tasks);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Record<string, boolean>>({});

  const toggleCollapse = (taskId: string) => {
    setCollapsedNodeIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const collapseAll = () => {
    const map: Record<string, boolean> = {};
    const traverse = (nodes: TaskTreeNode[]) => {
      nodes.forEach((n) => {
        if (n.children.length > 0) {
          map[n.task.id] = true;
          traverse(n.children);
        }
      });
    };
    traverse(tree);
    setCollapsedNodeIds(map);
  };

  const expandAll = () => {
    setCollapsedNodeIds({});
  };

  if (tasks.length === 0) {
    return (
      <div className="p-8 text-center bg-[var(--bg)] rounded-2xl border border-[var(--line)] space-y-2">
        <FolderTree className="w-8 h-8 text-[var(--muted)] mx-auto opacity-50" />
        <p className="text-xs font-bold text-[var(--muted)]">Nenhuma tarefa cadastrada ainda.</p>
        <p className="text-[11px] text-[var(--muted)]">
          Crie tarefas principais e ramifique em subtarefas especializadas.
        </p>
      </div>
    );
  }

  const renderNode = (node: TaskTreeNode, _isLastChild: boolean = false) => {
    const { task, depth, children } = node;
    const hasChildren = children.length > 0;
    const isRoot = depth === 0;
    const isCollapsed = collapsedNodeIds[task.id] || false;

    const priorityBadge = task.priority
      ? {
          alta: { label: '🔴 Alta', bg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
          media: { label: '🟡 Média', bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
          baixa: { label: '🟢 Baixa', bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
        }[task.priority]
      : null;

    return (
      <div key={task.id} className="relative group">
        <div
          className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 p-3 rounded-xl border transition-all ${
            isRoot
              ? 'bg-[var(--paper)] border-[var(--line)] shadow-2xs hover:border-[var(--primary)]'
              : 'bg-[var(--bg)] border-[var(--line)] hover:border-[var(--primary)]'
          }`}
          style={{
            marginLeft: depth > 0 ? `${Math.min(depth * 24, 96)}px` : '0px',
          }}
        >
          {/* Left Branch / Title / Info */}
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            {/* Hierarchy Branch Icon / Guide / Collapse Toggle */}
            <div className="mt-0.5 shrink-0 flex items-center gap-1 text-[var(--muted)]">
              {hasChildren && (
                <button
                  type="button"
                  onClick={() => toggleCollapse(task.id)}
                  className="p-1 -ml-1 text-[var(--muted)] hover:text-[var(--ink)] bg-[var(--bg)] hover:bg-[var(--line)]/50 rounded border border-[var(--line)] cursor-pointer"
                  title={isCollapsed ? 'Expandir subtarefas' : 'Ocultar subtarefas'}
                >
                  {isCollapsed ? <ChevronRight className="w-3 h-3 text-[var(--primary)]" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              )}
              {depth > 0 ? (
                <div className="flex items-center text-[var(--primary)]">
                  <span className="text-xs font-mono select-none font-bold">└──</span>
                  <GitBranch className="w-3.5 h-3.5 ml-1" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold">
                  <FolderTree className="w-3.5 h-3.5" />
                </div>
              )}
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs ${isRoot ? 'font-black text-sm' : 'font-extrabold'} text-[var(--ink)]`}>
                  {task.name}
                </span>

                {/* Subtask count badge if collapsed */}
                {hasChildren && isCollapsed && (
                  <button
                    type="button"
                    onClick={() => toggleCollapse(task.id)}
                    className="px-2 py-0.5 bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)] rounded-full text-[10px] font-black flex items-center gap-1 hover:bg-[var(--primary)]/15 cursor-pointer"
                  >
                    <Layers className="w-2.5 h-2.5" />
                    <span>{children.length} subtarefa{children.length !== 1 ? 's' : ''} oculta{children.length !== 1 ? 's' : ''}</span>
                  </button>
                )}

                {/* Priority Badge (only when a priority is explicitly defined) */}
                {priorityBadge && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${priorityBadge.bg}`}>
                    {priorityBadge.label}
                  </span>
                )}

                {/* Headcount Target Badge */}
                {task.minHeadcount !== undefined && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-[10px] font-black">
                    <Target className="w-3 h-3" />
                    <span>Meta: {task.minHeadcount}{task.maxHeadcount ? ` - ${task.maxHeadcount}` : ''} pax</span>
                  </span>
                )}

                {/* Turno específico */}
                {task.shift && task.shift !== 'all' && (
                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[10px] font-bold">
                    Turno {task.shift}
                  </span>
                )}

                {/* Inactive badge */}
                {task.active === false && (
                  <span className="px-1.5 py-0.5 bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 rounded text-[10px] font-bold">
                    Inativa
                  </span>
                )}
              </div>

              {/* Tags for Required Skills, Roles & Categories */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                {/* Required Skills */}
                {(task.requiredSkills || []).length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 flex items-center gap-0.5">
                      <Sparkles className="w-3 h-3" />
                      <span>Skills:</span>
                    </span>
                    {task.requiredSkills?.map((sk) => (
                      <span
                        key={sk}
                        className="px-1.5 py-0.2 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded text-[10px] font-bold"
                      >
                        {sk}
                      </span>
                    ))}
                  </div>
                )}

                {/* Allowed Roles */}
                {(task.allowedRoles || []).length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 flex items-center gap-0.5">
                      <Briefcase className="w-3 h-3" />
                      <span>Cargos:</span>
                    </span>
                    {task.allowedRoles?.map((r) => (
                      <span
                        key={r}
                        className="px-1.5 py-0.2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900 rounded text-[10px] font-bold"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}

                {/* Allowed Categories */}
                {(task.allowedCategories || []).length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                      <Tag className="w-3 h-3" />
                      <span>Cat:</span>
                    </span>
                    {task.allowedCategories?.map((c) => (
                      <span
                        key={c}
                        className="px-1.5 py-0.2 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900 rounded text-[10px] font-bold"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {/* Description snippet */}
                {task.description && (
                  <span className="text-[10px] text-[var(--muted)] truncate max-w-xs" title={task.description}>
                    📝 {task.description}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            {/* Members Count Badge */}
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs font-black text-[var(--ink)]"
              title="Colaboradores alocados nesta tarefa hoje"
            >
              <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>{task.members?.length || 0}</span>
            </span>

            {/* Add Subtask Button */}
            <button
              type="button"
              onClick={() => onAddSubtask(task.id)}
              className="p-1.5 text-[var(--primary)] hover:bg-[var(--primary-soft)] rounded-lg text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer border border-transparent hover:border-[var(--primary-border)]"
              title="Adicionar subtarefa / ramificação dentro desta tarefa"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px] font-black">Subtarefa</span>
            </button>

            {/* Edit Button */}
            <button
              type="button"
              onClick={() => onEditTask(task)}
              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer"
              title="Editar configurações completas da tarefa"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>

            {/* Delete Button */}
            <button
              type="button"
              onClick={() => setPendingDelete(task)}
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              title="Excluir tarefa"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Recursive Children Rendering (if not collapsed) */}
        {hasChildren && !isCollapsed && (
          <div className="space-y-2 mt-2">
            {children.map((child, idx) =>
              renderNode(child, idx === children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const hasAnySubtasks = tree.some((n) => n.children.length > 0);

  return (
    <div className="space-y-2.5">
      {hasAnySubtasks && (
        <div className="flex items-center justify-end gap-2 pb-1 text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="px-2.5 py-1 bg-[var(--paper)] border border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary-border)] rounded-lg text-[11px] font-bold cursor-pointer"
          >
            Expandir Todas
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="px-2.5 py-1 bg-[var(--paper)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--primary-border)] rounded-lg text-[11px] font-bold cursor-pointer"
          >
            Ocultar Subtarefas
          </button>
        </div>
      )}

      {tree.map((rootNode, idx) => renderNode(rootNode, idx === tree.length - 1))}

      <ConfirmModal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            onDeleteTask(pendingDelete.id);
          }
          setPendingDelete(null);
        }}
        title="Excluir Tarefa"
        description={`Tem certeza que deseja excluir a tarefa "${pendingDelete?.name || ''}"? As subtarefas vinculadas se tornarão tarefas principais.`}
        confirmText="Excluir"
      />
    </div>
  );
};

