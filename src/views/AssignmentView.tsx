import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SearchInput } from '../components/SearchInput';
import { MultiSelectFilter } from '../components/MultiSelectFilter';
import { AutoAssignModal } from '../components/AutoAssignModal';
import {
  PageHeader,
  Card,
  CardHeader,
  SectionHeader,
  Button,
  Badge,
  Tabs,
  Toolbar,
  EmptyState,
  Modal,
  Avatar,
} from '../components/ui';
import {
  Shuffle,
  Briefcase,
  Tag,
  X,
  CheckCircle2,
  Users,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Undo2,
  Zap,
  Eye,
  EyeOff,
  Trash2,
  Layers,
  GripVertical,
  Clock,
  Sliders,
  GitFork,
  CornerDownRight,
  ArrowRightLeft,
  CheckSquare,
  Square,
  FolderTree,
  ListTree,
  List,
  Star,
  Filter,
} from 'lucide-react';
import {
  matchesSearch,
  matchesCollaboratorSearch,
  compareStringsBR,
  sortCollaboratorsAlphabetical,
  isScaleOff,
  getCollaboratorStatus,
} from '../utils/helpers';
import { collabMenuOnContext } from '../utils/collabContextMenu';
import {
  getConsolidatedTaskGroups,
  ConsolidatedTaskGroup,
  buildTaskTree,
  getTaskPath,
} from '../utils/taskTreeHelpers';
import { calculateCollabTaskScore } from '../utils/autoAssignEngine';
import { Task, Collaborator, AutoAssignOptions } from '../types';

export const AssignmentView: React.FC = () => {
  const {
    state,
    assignTask,
    unassignTask,
    clearAssignments,
    clearTaskAssignments,
    autoAssign,
    updateTask,
    undo,
    canUndo,
    setSelectedGlobalFilters,
    showNotice,
    showSubtasks,
    setShowSubtasks,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [taskSearchTerm, setTaskSearchTerm] = useState('');
  const [selectedShifts, setSelectedShifts] = useState<string[]>(
    state.selectedShiftFilter && state.selectedShiftFilter !== 'ALL' && state.selectedShiftFilter !== 'todos'
      ? [state.selectedShiftFilter]
      : []
  );
  const [selectedTLs, setSelectedTLs] = useState<string[]>(
    state.selectedTLFilter && state.selectedTLFilter !== 'ALL' && state.selectedTLFilter !== 'todos'
      ? [state.selectedTLFilter]
      : []
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [showInactiveTasks, setShowInactiveTasks] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [autoAssignModalOpen, setAutoAssignModalOpen] = useState(false);

  // Collapsed state for parent task subdivisions
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<Record<string, boolean>>({});

  // View mode: hierarchical grid (tree) or organized list
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');

  // Drag-and-drop & Multiple Selection State
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [selectedColIds, setSelectedColIds] = useState<string[]>([]);
  
  // Unassigned Pool View & Grouping Mode (18.3)
  const [unassignedGroupBy, setUnassignedGroupBy] = useState<'cargo_categoria' | 'cargo' | 'categoria' | 'geral' | 'skills'>('cargo_categoria');

  // Quick Assignment Popover / Target Picker State
  const [popoverState, setPopoverState] = useState<{
    colId?: string;
    colIds: string[];
    top: number;
    left: number;
  } | null>(null);
  const [popoverSearchTerm, setPopoverSearchTerm] = useState('');
  const [showOtherTasksInPopover, setShowOtherTasksInPopover] = useState(false);

  // Move Collaborator Modal / Popover State
  const [movingCollab, setMovingCollab] = useState<{
    collaborator: Collaborator;
    currentTaskId?: string;
  } | null>(null);

  const activeDate = state.selectedDate;

  // Sync active shift filter when session shift or selected shift filter changes
  useEffect(() => {
    const active = state.selectedShiftFilter || state.teamShift;
    if (active && active !== 'ALL' && active !== 'todos') {
      setSelectedShifts([active]);
    } else {
      setSelectedShifts([]);
    }
  }, [state.teamShift, state.selectedShiftFilter]);

  // Sync active TL filter when selectedTLFilter changes
  useEffect(() => {
    if (state.selectedTLFilter && state.selectedTLFilter !== 'ALL' && state.selectedTLFilter !== 'todos') {
      setSelectedTLs([state.selectedTLFilter]);
    } else {
      setSelectedTLs([]);
    }
  }, [state.selectedTLFilter, state.teamShift]);

  // Options for multi-select filters
  const colShifts = state.collaborators.map((c) => c.shift || 'Geral');
  const availableShifts = Array.from(new Set([...(state.shifts || []), ...colShifts]));
  if (!availableShifts.includes('Geral')) availableShifts.unshift('Geral');
  const shiftOptions = availableShifts.map((s) => ({ label: `Turno ${s}`, value: s }));

  const availableTLs = Array.from(
    new Set(
      state.collaborators
        .filter((c) => selectedShifts.length === 0 || selectedShifts.includes(c.shift || 'Geral'))
        .map((c) => c.teamLeader || state.defaultTeamLeader || 'Sem Time')
    )
  );
  const tlOptions = availableTLs.map((tl) => ({ label: tl, value: tl }));

  const roleOptions = useMemo(() => [...state.roles].sort(compareStringsBR).map((r) => ({ label: r, value: r })), [state.roles]);
  const categoryOptions = useMemo(() => [...state.categories].sort(compareStringsBR).map((c) => ({ label: c, value: c })), [state.categories]);
  const skillOptions = useMemo(() => [...state.skills].sort(compareStringsBR).map((s) => ({ label: s, value: s })), [state.skills]);

  // Active present people today matching active shift & TL filters, sorted alphabetically
  const presentPeople = useMemo(() => {
    return state.collaborators
      .filter((c) => {
        const colShift = c.shift || 'Geral';
        const matchesShift = selectedShifts.length === 0 || selectedShifts.includes(colShift);
        const colTL = c.teamLeader || state.defaultTeamLeader || 'Sem Time';
        const matchesTL = selectedTLs.length === 0 || selectedTLs.includes(colTL);
        if (!matchesShift || !matchesTL) return false;

        const statusInfo = getCollaboratorStatus(c, activeDate, state);
        return statusInfo.status === 'presente' || statusInfo.status === 'atraso';
      })
      .sort((a, b) => compareStringsBR(a.name, b.name));
  }, [state.collaborators, selectedShifts, selectedTLs, activeDate, state]);

  // Filter present people by robust search term, role, category, skill
  const filteredPeople = useMemo(() => {
    return presentPeople
      .filter(
        (c) =>
          matchesCollaboratorSearch(c, searchTerm, { defaultTeamLeader: state.defaultTeamLeader }) &&
          (selectedRoles.length === 0 || selectedRoles.includes(c.role)) &&
          (selectedCategories.length === 0 || selectedCategories.includes(c.category)) &&
          (selectedSkills.length === 0 || selectedSkills.some((s) => Number(c.skills?.[s]) > 0))
      )
      .sort((a, b) => compareStringsBR(a.name, b.name));
  }, [presentPeople, searchTerm, selectedRoles, selectedCategories, selectedSkills, state.defaultTeamLeader]);

  const assignedSet = useMemo(() => {
    return new Set(state.tasks.flatMap((t) => t.members));
  }, [state.tasks]);

  const unassignedPeople = useMemo(() => {
    return filteredPeople
      .filter((p) => !assignedSet.has(p.id))
      .sort((a, b) => compareStringsBR(a.name, b.name));
  }, [filteredPeople, assignedSet]);

  // Groups of unassigned collaborators based on unassignedGroupBy mode (18.3)
  const unassignedGroups = useMemo(() => {
    if (unassignedPeople.length === 0) return [];

    if (unassignedGroupBy === 'geral') {
      return [
        {
          id: 'geral',
          title: 'Lista Geral',
          subtitle: `${unassignedPeople.length} colaborador${unassignedPeople.length !== 1 ? 'es' : ''}`,
          icon: <Users className="w-3.5 h-3.5 text-[var(--primary)]" />,
          collaborators: unassignedPeople,
        },
      ];
    }

    if (unassignedGroupBy === 'cargo_categoria') {
      const map = new Map<string, Collaborator[]>();
      unassignedPeople.forEach((c) => {
        const key = `${c.role || 'Sem Cargo'} • ${c.category || 'Sem Categoria'}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      });
      return Array.from(map.entries()).map(([key, list]) => ({
        id: key,
        title: key,
        subtitle: `${list.length} pessoa${list.length !== 1 ? 's' : ''}`,
        icon: <Layers className="w-3.5 h-3.5 text-[var(--primary)]" />,
        collaborators: list.sort((a, b) => compareStringsBR(a.name, b.name)),
      }));
    }

    if (unassignedGroupBy === 'cargo') {
      const map = new Map<string, Collaborator[]>();
      unassignedPeople.forEach((c) => {
        const key = c.role || 'Sem Cargo';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      });
      return Array.from(map.entries()).map(([key, list]) => ({
        id: key,
        title: key,
        subtitle: `${list.length} pessoa${list.length !== 1 ? 's' : ''}`,
        icon: <Briefcase className="w-3.5 h-3.5 text-[var(--primary)]" />,
        collaborators: list.sort((a, b) => compareStringsBR(a.name, b.name)),
      }));
    }

    if (unassignedGroupBy === 'categoria') {
      const map = new Map<string, Collaborator[]>();
      unassignedPeople.forEach((c) => {
        const key = c.category || 'Sem Categoria';
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(c);
      });
      return Array.from(map.entries()).map(([key, list]) => ({
        id: key,
        title: key,
        subtitle: `${list.length} pessoa${list.length !== 1 ? 's' : ''}`,
        icon: <Tag className="w-3.5 h-3.5 text-amber-500" />,
        collaborators: list.sort((a, b) => compareStringsBR(a.name, b.name)),
      }));
    }

    if (unassignedGroupBy === 'skills') {
      const skillMap = new Map<string, Collaborator[]>();
      const noSkillList: Collaborator[] = [];

      unassignedPeople.forEach((c) => {
        const activeSkills = Object.entries(c.skills || {}).filter(([_, lvl]) => Number(lvl) > 0).map(([s]) => s);
        if (activeSkills.length === 0) {
          noSkillList.push(c);
        } else {
          activeSkills.forEach((s) => {
            if (!skillMap.has(s)) skillMap.set(s, []);
            skillMap.get(s)!.push(c);
          });
        }
      });

      const list = Array.from(skillMap.entries()).map(([sName, people]) => ({
        id: sName,
        title: `Habilitação: ${sName}`,
        subtitle: `${people.length} pessoa${people.length !== 1 ? 's' : ''} habilitada${people.length !== 1 ? 's' : ''}`,
        icon: <Sparkles className="w-3.5 h-3.5 text-purple-500" />,
        collaborators: people.sort((a, b) => compareStringsBR(a.name, b.name)),
      }));

      if (noSkillList.length > 0) {
        list.push({
          id: 'sem-skills',
          title: 'Sem Habilitações Registradas',
          subtitle: `${noSkillList.length} pessoa${noSkillList.length !== 1 ? 's' : ''}`,
          icon: <Users className="w-3.5 h-3.5 text-[var(--muted)]" />,
          collaborators: noSkillList.sort((a, b) => compareStringsBR(a.name, b.name)),
        });
      }
      return list;
    }

    return [];
  }, [unassignedPeople, unassignedGroupBy]);

  // Compatibility evaluator for quick assignment contextual filtering
  const checkTaskCompatibility = (
    task: Task,
    targetCollab?: Collaborator,
    targetCollabs?: Collaborator[]
  ) => {
    const collabs = targetCollabs && targetCollabs.length > 0
      ? targetCollabs
      : targetCollab
      ? [targetCollab]
      : [];

    if (collabs.length === 0) return { isCompatible: true, hasStrictRestriction: false, matchReasons: [], mismatchReasons: [] };

    let hasStrictRestriction = false;
    const matchReasons: string[] = [];
    const mismatchReasons: string[] = [];

    const allowedRoles = task.allowedRoles || [];
    const allowedCategories = task.allowedCategories || [];
    const requiredSkills = task.requiredSkills || [];

    if (allowedRoles.length > 0) {
      hasStrictRestriction = true;
      const roleMatch = collabs.every((c) => allowedRoles.includes(c.role));
      if (roleMatch) {
        matchReasons.push(`Cargo ${collabs[0].role}`);
      } else {
        mismatchReasons.push(`Exige Cargo: ${allowedRoles.join(', ')}`);
      }
    }

    if (allowedCategories.length > 0) {
      hasStrictRestriction = true;
      const catMatch = collabs.every((c) => allowedCategories.includes(c.category));
      if (catMatch) {
        matchReasons.push(`Categoria ${collabs[0].category}`);
      } else {
        mismatchReasons.push(`Exige Categoria: ${allowedCategories.join(', ')}`);
      }
    }

    if (requiredSkills.length > 0) {
      hasStrictRestriction = true;
      const skillsMatch = collabs.every((c) =>
        requiredSkills.every((req) => Number(c.skills?.[req]) > 0)
      );
      if (skillsMatch) {
        matchReasons.push(`Skills atendidas`);
      } else {
        mismatchReasons.push(`Exige Skill: ${requiredSkills.join(', ')}`);
      }
    }

    if (task.shift && task.shift !== 'all') {
      const shiftMatch = collabs.every((c) => (c.shift || 'Geral') === task.shift);
      if (shiftMatch) {
        matchReasons.push(`Turno ${task.shift}`);
      } else {
        mismatchReasons.push(`Exige Turno ${task.shift}`);
      }
    }

    const isCompatible = mismatchReasons.length === 0;

    return {
      isCompatible,
      hasStrictRestriction,
      matchReasons,
      mismatchReasons,
    };
  };

  // Consolidated Task Groups (Hierarchical Tree)
  const taskGroups = useMemo(() => {
    const groups = getConsolidatedTaskGroups(state.tasks, !showInactiveTasks);
    if (!taskSearchTerm.trim()) return groups;

    const term = taskSearchTerm.toLowerCase();
    return groups.filter((g) => {
      const matchRoot = g.rootTask.name.toLowerCase().includes(term);
      const matchSub = g.subtasks.some((st) => st.name.toLowerCase().includes(term));
      return matchRoot || matchSub;
    });
  }, [state.tasks, showInactiveTasks, taskSearchTerm]);

  // Stats for AutoAssignModal (previously passed incorrectly)
  const autoAssignStats = useMemo(() => {
    const activeTasks = state.tasks.filter((t) => t.active !== false);
    const tasksWithSkills = activeTasks.filter((t) => (t.requiredSkills || []).length > 0);
    const highPriorityTasks = activeTasks.filter((t) => t.priority === 'alta');
    return {
      presentCount: presentPeople.length,
      activeTasksCount: activeTasks.length,
      tasksWithSkillsCount: tasksWithSkills.length,
      highPriorityTasksCount: highPriorityTasks.length,
    };
  }, [state.tasks, presentPeople]);

  // Helper to render skill badges for a collaborator
  const renderSkillBadges = (col: Collaborator, maxDisplay = 2) => {
    if (!col.skills) return null;
    const activeEntries = Object.entries(col.skills).filter(([_, lvl]) => Number(lvl) > 0);
    if (activeEntries.length === 0) return null;

    const displayed = activeEntries.slice(0, maxDisplay);
    const remaining = activeEntries.length - maxDisplay;

    return (
      <div className="flex flex-wrap items-center gap-1 mt-0.5">
        {displayed.map(([sName, lvlVal]) => {
          const lvl = Number(lvlVal);
          const lvlLabel = lvl === 3 ? 'Nv 3' : lvl === 2 ? 'Nv 2' : 'Nv 1';
          return (
            <span
              key={sName}
              className={`text-[8px] font-black px-1 py-0.2 rounded border flex items-center gap-0.5 ${
                lvl === 3
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                  : lvl === 2
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title={`Skill: ${sName} (Nível ${lvl})`}
            >
              <Sparkles className="w-2 h-2 shrink-0" />
              <span>{sName}</span>
              <span className="opacity-75 font-normal">({lvlLabel})</span>
            </span>
          );
        })}
        {remaining > 0 && (
          <span className="text-[8px] font-bold text-[var(--muted)] px-0.5">
            +{remaining}
          </span>
        )}
      </div>
    );
  };

  // Toggle Collapse of a parent task
  const toggleCollapse = (taskId: string) => {
    setCollapsedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  // Expand all / Collapse all subdivisions
  const collapseAllSubdivisions = () => {
    const update: Record<string, boolean> = {};
    taskGroups.forEach((g) => {
      if (g.hasSubtasks) update[g.rootTask.id] = true;
    });
    setCollapsedTaskIds(update);
  };

  const expandAllSubdivisions = () => {
    setCollapsedTaskIds({});
  };

  // Drag-and-drop Handlers
  const handleDragStart = (e: React.DragEvent, colId: string) => {
    setDraggedColId(colId);
    e.dataTransfer.setData('text/plain', colId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    const colId = e.dataTransfer.getData('text/plain') || draggedColId;
    if (!colId) return;

    if (selectedColIds.includes(colId) && selectedColIds.length > 1) {
      selectedColIds.forEach((id) => assignTask(id, targetTaskId));
      const target = state.tasks.find((t) => t.id === targetTaskId);
      showNotice(`${selectedColIds.length} colaboradores alocados para "${target?.name || 'Tarefa'}".`);
      setSelectedColIds([]);
    } else {
      assignTask(colId, targetTaskId);
    }
    setDraggedColId(null);
  };

  const handleDropUnassign = (e: React.DragEvent) => {
    e.preventDefault();
    const colId = e.dataTransfer.getData('text/plain') || draggedColId;
    if (!colId) return;

    if (selectedColIds.includes(colId) && selectedColIds.length > 1) {
      selectedColIds.forEach((id) => unassignTask(id));
      showNotice(`${selectedColIds.length} colaboradores removidos das tarefas.`);
      setSelectedColIds([]);
    } else {
      unassignTask(colId);
    }
    setDraggedColId(null);
  };

  // Selection toggle
  const toggleSelectCol = (colId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedColIds((prev) =>
      prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]
    );
  };

  const selectAllUnassigned = () => {
    setSelectedColIds(unassignedPeople.map((c) => c.id));
  };

  const clearSelection = () => {
    setSelectedColIds([]);
  };

  // Open Quick Assignment Popover
  const handleOpenPopover = (e: React.MouseEvent, colId?: string) => {
    e.stopPropagation();
    const targetIds = colId ? [colId] : selectedColIds;
    if (targetIds.length === 0) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const top = Math.min(rect.bottom + 8, window.innerHeight - 380);
    const left = Math.min(rect.left, window.innerWidth - 320);

    setPopoverState({
      colId,
      colIds: targetIds,
      top: Math.max(16, top),
      left: Math.max(16, left),
    });
  };

  // Batch assign selected collaborators
  const handleBatchAssign = (taskId: string) => {
    const ids = popoverState?.colIds || selectedColIds;
    if (ids.length === 0) return;

    ids.forEach((id) => assignTask(id, taskId));
    const targetTask = state.tasks.find((t) => t.id === taskId);
    showNotice(`${ids.length} colaborador(es) alocado(s) para "${targetTask?.name || 'Tarefa'}".`);
    setPopoverState(null);
    setSelectedColIds([]);
  };

  // Move single collaborator modal handler
  const handleMoveCollaborator = (targetTaskId: string) => {
    if (!movingCollab) return;
    assignTask(movingCollab.collaborator.id, targetTaskId);
    const targetTask = state.tasks.find((t) => t.id === targetTaskId);
    showNotice(`"${movingCollab.collaborator.name}" movido para "${targetTask?.name || 'Tarefa'}".`);
    setMovingCollab(null);
  };

  // Check if any intervals are pending for collaborators in this task
  const getPendingBreaks = (memberIds: string[]) => {
    const dayIntervals = state.intervals[activeDate] || {};
    return memberIds.filter(
      (mId) => !state.breaks.some((b) => (dayIntervals[b.id] || []).includes(mId))
    ).length;
  };

  // Small chip for a collaborator inside the list view
  const renderListMemberChip = (col: Collaborator, taskId: string, unassignable = true): React.ReactNode => (
    <div
      key={col.id}
      onContextMenu={collabMenuOnContext(col.id)}
      className="px-2 py-1 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs font-bold text-[var(--ink)] flex items-center gap-1.5 shadow-xs cursor-context-menu"
      title="Clique com o botão direito para opções do colaborador"
    >
      <span>{col.name}</span>
      <span className="text-[9px] text-[var(--muted)] font-medium hidden sm:inline">{col.role || 'Operador'}</span>
      {unassignable && (
        <button
          onClick={() => {
            unassignTask(col.id);
            showNotice(`"${col.name}" removido do dimensionamento.`);
          }}
          className="p-0.5 hover:bg-red-100 dark:hover:bg-red-950 text-red-600 rounded cursor-pointer"
          title={`Remover ${col.name} de todas as tarefas`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  // Organized list visualization (Left: Sem Tarefa list, Right: Tarefas list, without cards)
  const renderAssignmentList = (): React.ReactNode => {
    const resolveMembers = (ids: string[]) =>
      ids
        .map((mId) => state.collaborators.find((c) => c.id === mId))
        .filter((c): c is Collaborator => Boolean(c));

    const totalAssignedCount = taskGroups.reduce((acc, g) => acc + g.totalCount, 0);
    const totalMeta = taskGroups.reduce((acc, g) => acc + g.minHeadcountTotal, 0);

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: SEM TAREFA (Colaboradores Disponíveis) - 4 cols             */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 space-y-3 sticky top-4">
          <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl overflow-hidden shadow-xs">
            {/* Header */}
            <div className="p-3 bg-[var(--primary)] text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="w-4 h-4 shrink-0 text-white/90" />
                <h3 className="font-extrabold text-sm text-white truncate">
                  Sem Tarefa
                </h3>
                <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {unassignedPeople.length}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {selectedColIds.length > 0 && (
                  <Button
                    size="xs"
                    variant="primary"
                    onClick={(e) => handleOpenPopover(e)}
                    className="font-bold text-[11px] flex items-center gap-1 shadow-sm !bg-amber-600 hover:!bg-amber-700 !text-white"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Alocar ({selectedColIds.length})</span>
                  </Button>
                )}
                <button
                  type="button"
                  onClick={selectedColIds.length === unassignedPeople.length ? clearSelection : selectAllUnassigned}
                  className="p-1.5 hover:bg-white/10 rounded text-white/90 hover:text-white transition-colors text-xs font-bold"
                  title={selectedColIds.length === unassignedPeople.length ? 'Desmarcar todos' : 'Selecionar todos'}
                >
                  {selectedColIds.length === unassignedPeople.length && unassignedPeople.length > 0 ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Sub-header Controls */}
            <div className="p-2.5 bg-[var(--surface-1)] border-b border-[var(--line)] space-y-2">
              {/* Grouping switcher */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px] font-bold text-[var(--muted)]">
                <span className="text-[10px] uppercase font-bold shrink-0 mr-1 text-[var(--muted)]/80">Agrupar:</span>
                {[
                  { id: 'cargo_categoria', label: 'Cargo + Categoria' },
                  { id: 'cargo', label: 'Cargo' },
                  { id: 'categoria', label: 'Categoria' },
                  { id: 'skills', label: 'Skills' },
                  { id: 'geral', label: 'Lista Direta' },
                ].map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setUnassignedGroupBy(grp.id as any)}
                    className={`px-2 py-0.5 rounded-md whitespace-nowrap transition-colors cursor-pointer text-[10.5px] font-semibold ${
                      unassignedGroupBy === grp.id
                        ? 'bg-[var(--primary)] text-white shadow-2xs'
                        : 'bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--line)]/60'
                    }`}
                  >
                    {grp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List Body */}
            <div className="p-2 max-h-[calc(100vh-220px)] overflow-y-auto space-y-2">
              {unassignedPeople.length === 0 ? (
                <div className="py-8 px-3 text-center space-y-1 text-[var(--muted)]">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/80 mb-1" />
                  <p className="text-xs font-bold text-[var(--ink)]">Todos os presentes alocados!</p>
                  <p className="text-[11px]">Nenhum colaborador sem tarefa no momento.</p>
                </div>
              ) : (
                unassignedGroups.map((group) => {
                  if (group.collaborators.length === 0) return null;
                  return (
                    <div key={group.id} className="space-y-1">
                      {unassignedGroupBy !== 'geral' && (
                        <div className="flex items-center justify-between px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--muted)] uppercase tracking-wider bg-[var(--surface-1)] rounded border border-[var(--line)]/50">
                          <span className="truncate">{group.title}</span>
                          <span className="bg-[var(--paper)] text-[var(--ink)] px-1.5 py-0.2 rounded text-[9.5px]">
                            {group.collaborators.length}
                          </span>
                        </div>
                      )}
                      <div className="space-y-1">
                        {group.collaborators.map((col) => {
                          const isSelected = selectedColIds.includes(col.id);
                          const isLate = getCollaboratorStatus(col, activeDate, state).status === 'atraso';
                          const isDragging = draggedColId === col.id;

                          return (
                            <div
                              key={col.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, col.id)}
                              onContextMenu={collabMenuOnContext(col.id)}
                              onClick={(e) => toggleSelectCol(col.id, e)}
                              className={`group p-2 rounded-lg border flex items-center justify-between gap-2 transition-all cursor-pointer select-none ${
                                isSelected
                                  ? 'bg-amber-500/10 border-amber-500/50 shadow-2xs'
                                  : 'bg-[var(--paper)] border-[var(--line)] hover:border-[var(--primary-border)] hover:bg-[var(--surface-1)]'
                              } ${isDragging ? 'opacity-40 scale-98' : ''}`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  type="button"
                                  onClick={(e) => toggleSelectCol(col.id, e)}
                                  className="text-[var(--muted)] group-hover:text-[var(--primary)] shrink-0"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <Avatar
                                  src={col.photoUrl}
                                  name={col.name}
                                  size="sm"
                                  className="ring-1 ring-[var(--line)]"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold text-[var(--ink)] truncate max-w-[150px]">
                                      {col.name}
                                    </span>
                                    {isLate && (
                                      <span className="text-[9px] font-black bg-amber-500 text-white px-1 rounded">
                                        Atraso
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
                                    <span>{col.shift}</span>
                                    <span>•</span>
                                    <span>{col.role || 'Operador'}</span>
                                    {col.category && (
                                      <>
                                        <span>•</span>
                                        <span className="truncate max-w-[80px]">{col.category}</span>
                                      </>
                                    )}
                                  </div>
                                  {renderSkillBadges(col, 2)}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenPopover(e, col.id);
                                  }}
                                  className="p-1 text-[var(--muted)] hover:text-amber-600 hover:bg-amber-500/10 rounded transition-colors"
                                  title="Alocar para tarefa"
                                >
                                  <Zap className="w-3.5 h-3.5" />
                                </button>
                                <GripVertical className="w-3.5 h-3.5 text-[var(--muted)]/40 cursor-grab active:cursor-grabbing shrink-0" />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: TAREFAS (Sem Cards, Formato de Lista Linear) - 8 cols       */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 space-y-3">
          {/* List Toolbar / Status Bar */}
          <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <FolderTree className="w-4 h-4 text-[var(--primary)]" />
              <h3 className="text-sm font-extrabold text-[var(--ink)]">
                Lista de Tarefas & Postos
              </h3>
              <Badge tone="primary">
                {taskGroups.length} Postos
              </Badge>
              <Badge tone="neutral">
                {totalAssignedCount} alocados {totalMeta > 0 ? `/ meta ${totalMeta}` : ''}
              </Badge>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={expandAllSubdivisions}
                className="text-[11px] font-bold text-[var(--primary)] hover:underline"
              >
                Expandir Todas
              </button>
              <span className="text-[var(--line)]">|</span>
              <button
                type="button"
                onClick={collapseAllSubdivisions}
                className="text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)]"
              >
                Recolher
              </button>
            </div>
          </div>

          {taskGroups.length === 0 ? (
            <EmptyState
              icon={FolderTree}
              title="Nenhuma tarefa encontrada"
              description="Verifique os filtros aplicados ou cadastre novas tarefas na área de Gestão de Tarefas."
            />
          ) : (
            <div className="space-y-2.5">
              {taskGroups.map((group) => {
                const root = group.rootTask;
                const isInactive = root.active === false;
                const pendingBreaksCount = getPendingBreaks(group.allMembers);
                const hasPendingBreaks = pendingBreaksCount > 0;
                const rootMembers = resolveMembers(group.directMembers);
                const subtaskEntries = group.subtaskBreakdown || [];
                const isCollapsed = Boolean(collapsedTaskIds[root.id]);
                const dayIntervals = state.intervals[activeDate] || {};

                return (
                  <div
                    key={root.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const colId = e.dataTransfer.getData('text/plain') || draggedColId;
                      if (colId) {
                        assignTask(colId, root.id);
                        const c = state.collaborators.find((x) => x.id === colId);
                        showNotice(`"${c?.name || 'Colaborador'}" alocado para "${root.name}".`);
                        setDraggedColId(null);
                      }
                    }}
                    className={`bg-[var(--surface-2)] border rounded-xl overflow-hidden transition-all shadow-2xs ${
                      isInactive
                        ? 'opacity-60 border-dashed border-slate-300 dark:border-slate-800'
                        : 'border-[var(--line)] hover:border-[var(--primary-border)]'
                    }`}
                  >
                    {/* Compact Section Strip Header (NO GIANT CARD) */}
                    <div className="px-3.5 py-2.5 bg-[var(--surface-1)] border-b border-[var(--line)] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {group.hasSubtasks && (
                          <button
                            type="button"
                            onClick={() => toggleCollapse(root.id)}
                            className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded cursor-pointer"
                          >
                            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <h4 className="text-sm font-extrabold text-[var(--ink)] truncate" title={root.name}>
                          {root.name}
                        </h4>
                        {root.priority && (
                          <Badge
                            tone={root.priority === 'alta' ? 'danger' : root.priority === 'media' ? 'warning' : 'neutral'}
                            className="text-[9px] uppercase px-1.5 py-0"
                          >
                            {root.priority}
                          </Badge>
                        )}
                        {group.hasSubtasks && (
                          <span className="text-[10px] font-semibold text-[var(--muted)] hidden sm:inline">
                            ({group.subtasks.length} subdivisões)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {hasPendingBreaks && (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {pendingBreaksCount} int. pendente(s)
                          </span>
                        )}
                        <div className="text-xs font-bold text-[var(--ink)] bg-[var(--paper)] px-2 py-0.5 rounded border border-[var(--line)]">
                          <span>{group.totalCount}</span>
                          {group.minHeadcountTotal > 0 && (
                            <span className="text-[var(--muted)] font-normal"> / {group.minHeadcountTotal} meta</span>
                          )}
                        </div>
                        {group.totalCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              group.allMembers.forEach((mId) => unassignTask(mId));
                              showNotice(`Todos os membros removidos de "${root.name}".`);
                            }}
                            className="p-1 text-[var(--muted)] hover:text-red-600 hover:bg-red-500/10 rounded transition-colors text-[10.5px] font-medium"
                            title="Desalocar todos os colaboradores deste posto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Member Rows in List Format */}
                    {!isCollapsed && (
                      <div className="p-2 space-y-2">
                        {/* Direct Members / Root Section */}
                        {group.hasSubtasks && (
                          <div className="px-2 py-1 text-[10.5px] font-black uppercase text-[var(--muted)] flex items-center gap-1.5 border-b border-[var(--line)]/50 pb-1">
                            <CornerDownRight className="w-3 h-3 text-[var(--primary)]" />
                            <span>Posto Direto / Geral ({rootMembers.length})</span>
                          </div>
                        )}

                        {rootMembers.length === 0 && !group.hasSubtasks ? (
                          <div className="py-3 px-3 text-center text-xs text-[var(--muted)] bg-[var(--paper)]/50 rounded-lg border border-dashed border-[var(--line)]">
                            Nenhum operador alocado • Arraste ou use o botão ⚡ ao lado para alocar.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {rootMembers.map((col) => {
                              const assignedBreak = state.breaks.find((b) => (dayIntervals[b.id] || []).includes(col.id));
                              return (
                                <div
                                  key={col.id}
                                  onContextMenu={collabMenuOnContext(col.id)}
                                  className="p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg flex items-center justify-between gap-2 hover:border-[var(--primary-border)] transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Avatar src={col.photoUrl} name={col.name} size="sm" />
                                    <div className="min-w-0">
                                      <span className="text-xs font-bold text-[var(--ink)] truncate block" title={col.name}>
                                        {col.name}
                                      </span>
                                      <div className="flex items-center gap-1 text-[9.5px] text-[var(--muted)]">
                                        <span>{col.shift}</span>
                                        <span>•</span>
                                        <span className="truncate max-w-[100px]">{col.role || 'Operador'}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {assignedBreak ? (
                                      <span className="text-[9.5px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                                        {assignedBreak.time || assignedBreak.name}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">
                                        Int. Pend.
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setMovingCollab({ collaborator: col, currentTaskId: root.id })}
                                      className="p-1 text-[var(--muted)] hover:text-blue-600 hover:bg-blue-500/10 rounded transition-colors"
                                      title="Mover para outra tarefa"
                                    >
                                      <ArrowRightLeft className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        unassignTask(col.id);
                                        showNotice(`"${col.name}" desalocado.`);
                                      }}
                                      className="p-1 text-[var(--muted)] hover:text-red-600 hover:bg-red-500/10 rounded transition-colors"
                                      title="Desalocar (Retornar para Sem Tarefa)"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Subtasks */}
                        {group.hasSubtasks && subtaskEntries.length > 0 && (
                          <div className="space-y-2 pt-1">
                            {subtaskEntries.map((entry) => {
                              const subMembers = resolveMembers(entry.members);
                              return (
                                <div
                                  key={entry.task.id}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const colId = e.dataTransfer.getData('text/plain') || draggedColId;
                                    if (colId) {
                                      assignTask(colId, entry.task.id);
                                      const c = state.collaborators.find((x) => x.id === colId);
                                      showNotice(`"${c?.name || 'Colaborador'}" alocado para "${entry.task.name}".`);
                                      setDraggedColId(null);
                                    }
                                  }}
                                  className="bg-[var(--surface-1)] border border-[var(--line)] rounded-lg p-2 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2 px-1">
                                    <div className="flex items-center gap-1.5 text-xs font-black text-[var(--ink)]">
                                      <GitFork className="w-3 h-3 text-[var(--primary)] shrink-0" />
                                      <span>{entry.task.name}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-[var(--muted)] bg-[var(--paper)] px-1.5 py-0.2 rounded border border-[var(--line)]">
                                      {subMembers.length} alocados
                                    </span>
                                  </div>

                                  {subMembers.length === 0 ? (
                                    <p className="text-[10.5px] text-[var(--muted)] italic px-1 py-1">
                                      Nenhum colaborador nesta subdivisão.
                                    </p>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                      {subMembers.map((col) => {
                                        const assignedBreak = state.breaks.find((b) => (dayIntervals[b.id] || []).includes(col.id));
                                        return (
                                          <div
                                            key={col.id}
                                            onContextMenu={collabMenuOnContext(col.id)}
                                            className="p-1.5 bg-[var(--paper)] border border-[var(--line)] rounded-md flex items-center justify-between gap-2 hover:border-[var(--primary-border)] transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              <Avatar src={col.photoUrl} name={col.name} size="xs" />
                                              <span className="text-xs font-bold text-[var(--ink)] truncate max-w-[130px]">
                                                {col.name}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                              {assignedBreak ? (
                                                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1 rounded">
                                                  {assignedBreak.time || assignedBreak.name}
                                                </span>
                                              ) : null}
                                              <button
                                                type="button"
                                                onClick={() => setMovingCollab({ collaborator: col, currentTaskId: entry.task.id })}
                                                className="p-0.5 text-[var(--muted)] hover:text-blue-600 rounded"
                                                title="Mover"
                                              >
                                                <ArrowRightLeft className="w-2.5 h-2.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  unassignTask(col.id);
                                                  showNotice(`"${col.name}" desalocado.`);
                                                }}
                                                className="p-0.5 text-[var(--muted)] hover:text-red-600 rounded"
                                                title="Desalocar"
                                              >
                                                <X className="w-2.5 h-2.5" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        icon={FolderTree}
        title="Dimensionamento Operacional"
        subtitle="Atribua colaboradores em atividades principais e subdivisões com suporte hierárquico consolidado."
        meta={<Badge tone="neutral">{taskGroups.length} Atividades Principais</Badge>}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              icon={Undo2}
              onClick={undo}
              disabled={!canUndo}
              title="Desfazer última alteração (Ctrl+Z)"
            >
              Desfazer (Ctrl+Z)
            </Button>

            <Tabs
              items={[
                { value: 'tree', label: 'Visão Hierárquica', icon: ListTree },
                { value: 'list', label: 'Lista', icon: List },
              ]}
              value={viewMode}
              onChange={(v) => setViewMode(v as 'tree' | 'list')}
            />

            <Button
              variant={showSubtasks ? 'secondary' : 'outline'}
              size="sm"
              icon={showSubtasks ? GitFork : Layers}
              onClick={() => setShowSubtasks(!showSubtasks)}
              title={showSubtasks ? 'Ocultar subdivisões (visão gerencial consolidada)' : 'Exibir subdivisões (visão detalhada por subtarefa)'}
            >
              {showSubtasks ? 'Ocultar Subtarefas' : 'Exibir Subtarefas'}
            </Button>

            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                let countRemoved = 0;
                state.tasks.forEach((t) => {
                  t.members.forEach((mId) => {
                    const col = state.collaborators.find((c) => c.id === mId);
                    if (!col) {
                      unassignTask(mId);
                      countRemoved++;
                      return;
                    }
                    const colShift = col.shift || 'Geral';
                    const colTL = col.teamLeader || state.defaultTeamLeader || 'Sem Time';
                    const matchesShift = selectedShifts.length === 0 || selectedShifts.includes(colShift);
                    const matchesTL = selectedTLs.length === 0 || selectedTLs.includes(colTL);
                    const statusInfo = getCollaboratorStatus(col, activeDate, state);

                    if (statusInfo.status !== 'presente' || !matchesShift || !matchesTL) {
                      unassignTask(mId);
                      countRemoved++;
                    }
                  });
                });
                showNotice(
                  countRemoved > 0
                    ? `${countRemoved} colaborador(es) ausente(s) ou fora do filtro foram removido(s) das tarefas.`
                    : 'Nenhum colaborador ausente estava alocado.'
                );
              }}
              title="Limpa colaboradores ausentes ou de outros turnos/times das tarefas"
            >
              Limpar Ausentes
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearAssignments();
                showNotice('Dimensionamento limpo.');
              }}
            >
              Limpar Tudo
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={() => setAutoAssignModalOpen(true)}
              title="Configurar estratégias e executar dimensionamento inteligente balanceado"
            >
              <Shuffle className={`w-3.5 h-3.5 ${isAutoAssigning ? 'animate-spin' : ''}`} />
              <span>Auto Dimensionar</span>
              <Sliders className="w-3 h-3 ml-0.5 opacity-80" />
            </Button>
          </>
        }
      />

      {/* Filters and Search Bar */}
      <Card>
        <CardHeader
          icon={<Users className="w-4.5 h-4.5" />}
          title="Filtros e Busca"
          subtitle="Filtre por turno, time, cargo, categoria e habilidades para refinar o dimensionamento."
          actions={
            (searchTerm || taskSearchTerm || selectedShifts.length > 0 || selectedTLs.length > 0 || selectedRoles.length > 0 || selectedCategories.length > 0 || selectedSkills.length > 0) ? (
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                onClick={() => {
                  setSearchTerm('');
                  setTaskSearchTerm('');
                  setSelectedShifts([]);
                  setSelectedTLs([]);
                  setSelectedRoles([]);
                  setSelectedCategories([]);
                  setSelectedSkills([]);
                  setSelectedGlobalFilters({ shift: 'ALL', teamLeader: 'ALL' });
                }}
              >
                Limpar Filtros
              </Button>
            ) : undefined
          }
        />

        <div className="mt-3.5 space-y-3">
          <Toolbar>
            <MultiSelectFilter
              label="Turno"
              options={shiftOptions}
              selectedValues={selectedShifts}
              onChange={setSelectedShifts}
              placeholder="Todos os turnos"
              allLabel="Todos os Turnos"
            />

            <MultiSelectFilter
              label="Time / TL"
              options={tlOptions}
              selectedValues={selectedTLs}
              onChange={setSelectedTLs}
              placeholder="Todos os times"
              allLabel="Todos os Times"
              icon={<Users className="w-3 h-3 text-[var(--primary)]" />}
            />

            <MultiSelectFilter
              label="Cargo"
              options={roleOptions}
              selectedValues={selectedRoles}
              onChange={setSelectedRoles}
              placeholder="Todos os cargos"
              allLabel="Todos os Cargos"
              icon={<Briefcase className="w-3 h-3 text-[var(--primary)]" />}
            />

            <MultiSelectFilter
              label="Categoria"
              options={categoryOptions}
              selectedValues={selectedCategories}
              onChange={setSelectedCategories}
              placeholder="Todas as categorias"
              allLabel="Todas as Categorias"
              icon={<Tag className="w-3 h-3 text-[var(--primary)]" />}
            />

            <MultiSelectFilter
              label="Skill"
              options={skillOptions}
              selectedValues={selectedSkills}
              onChange={setSelectedSkills}
              placeholder="Todas as skills"
              allLabel="Todas as Skills"
              icon={<Sparkles className="w-3 h-3 text-purple-500" />}
            />

            <div className="flex-1 min-w-[200px] max-w-xs">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar colaborador..."
                className="w-full"
              />
            </div>
          </Toolbar>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--paper)] border border-[var(--line)] rounded-lg font-bold text-[11px] text-[var(--ink)] cursor-pointer hover:border-[var(--primary-border)]">
                <input
                  type="checkbox"
                  checked={showInactiveTasks}
                  onChange={(e) => setShowInactiveTasks(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-[var(--primary)] cursor-pointer"
                />
                <span>Exibir Tarefas Inativas</span>
              </label>

              <div className="flex items-center gap-1 bg-[var(--paper)] border border-[var(--line)] rounded-lg p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setShowSubtasks(!showSubtasks)}
                  className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 cursor-pointer transition-all ${
                    showSubtasks
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)]'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                  title={showSubtasks ? 'Ocultar subdivisões (visão gerencial consolidada)' : 'Exibir subdivisões (visão detalhada por subtarefa)'}
                >
                  <GitFork className="w-3 h-3" />
                  <span>{showSubtasks ? 'Ocultar Subtarefas' : 'Exibir Subtarefas'}</span>
                </button>
                <span className="text-[var(--line)]">|</span>
                <button
                  onClick={expandAllSubdivisions}
                  className="px-2 py-0.5 rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer transition-colors"
                  title="Expandir todas as subdivisões de tarefas"
                >
                  Expandir Todas
                </button>
                <span className="text-[var(--line)]">|</span>
                <button
                  onClick={collapseAllSubdivisions}
                  className="px-2 py-0.5 rounded text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer transition-colors"
                  title="Recolher todas as subdivisões de tarefas"
                >
                  Recolher Todas
                </button>
              </div>
            </div>

            <div className="w-48">
              <SearchInput
                value={taskSearchTerm}
                onChange={setTaskSearchTerm}
                placeholder="Filtrar tarefas..."
                className="w-full text-xs"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Main Dimensioning Area: Unassigned Pool (Left) + Hierarchical Task Groups (Right) */}
      {viewMode === 'tree' ? (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Available Unassigned People Pool */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropUnassign}
          className="lg:col-span-3 sticky top-3"
        >
          <Card>
            <CardHeader
              icon={<Users className="w-4.5 h-4.5" />}
              title={`Sem Tarefa (${unassignedPeople.length})`}
              actions={
                <Badge tone="neutral">
                  {presentPeople.length} Presentes
                </Badge>
              }
            />

            {/* Group View Switcher for Unassigned Pool (18.3) */}
            <div className="mt-2.5 mb-2.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-[var(--muted)] mb-1.5">
                <span>Agrupar por:</span>
                <span className="capitalize font-mono">{unassignedGroupBy.replace('_', ' + ')}</span>
              </div>
              <div className="grid grid-cols-5 gap-1 bg-[var(--surface-2)] p-1 rounded-lg border border-[var(--line)] text-[10px] font-black">
                <button
                  onClick={() => setUnassignedGroupBy('cargo_categoria')}
                  className={`py-1 rounded-md text-center transition-all cursor-pointer truncate px-1 ${
                    unassignedGroupBy === 'cargo_categoria'
                      ? 'bg-[var(--primary)] text-white shadow-2xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)]'
                  }`}
                  title="Agrupar por Cargo + Categoria"
                >
                  Carg+Cat
                </button>
                <button
                  onClick={() => setUnassignedGroupBy('cargo')}
                  className={`py-1 rounded-md text-center transition-all cursor-pointer truncate px-1 ${
                    unassignedGroupBy === 'cargo'
                      ? 'bg-[var(--primary)] text-white shadow-2xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)]'
                  }`}
                  title="Agrupar por Cargo"
                >
                  Cargo
                </button>
                <button
                  onClick={() => setUnassignedGroupBy('categoria')}
                  className={`py-1 rounded-md text-center transition-all cursor-pointer truncate px-1 ${
                    unassignedGroupBy === 'categoria'
                      ? 'bg-[var(--primary)] text-white shadow-2xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)]'
                  }`}
                  title="Agrupar por Categoria"
                >
                  Cat.
                </button>
                <button
                  onClick={() => setUnassignedGroupBy('skills')}
                  className={`py-1 rounded-md text-center transition-all cursor-pointer truncate px-1 ${
                    unassignedGroupBy === 'skills'
                      ? 'bg-[var(--primary)] text-white shadow-2xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)]'
                  }`}
                  title="Agrupar por Skills / Habilitações"
                >
                  Skills
                </button>
                <button
                  onClick={() => setUnassignedGroupBy('geral')}
                  className={`py-1 rounded-md text-center transition-all cursor-pointer truncate px-1 ${
                    unassignedGroupBy === 'geral'
                      ? 'bg-[var(--primary)] text-white shadow-2xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)]'
                  }`}
                  title="Lista Geral contínua"
                >
                  Geral
                </button>
              </div>
            </div>

            {/* Batch Selection Action Bar */}
            {unassignedPeople.length > 0 && (
              <div className="flex items-center justify-between gap-1.5 bg-[var(--surface-2)] p-1.5 rounded-lg border border-[var(--line)] text-xs mb-2.5">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={selectedColIds.length === unassignedPeople.length ? clearSelection : selectAllUnassigned}
                    className="flex items-center gap-1 text-[11px] font-bold text-[var(--ink)] hover:text-[var(--primary)] cursor-pointer px-1 py-0.5 rounded"
                    title="Selecionar / Desmarcar todos os visíveis"
                  >
                    {selectedColIds.length > 0 && selectedColIds.length === unassignedPeople.length ? (
                      <CheckSquare className="w-3.5 h-3.5 text-[var(--primary)]" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-[var(--muted)]" />
                    )}
                    <span>{selectedColIds.length > 0 ? `${selectedColIds.length} sel.` : 'Selecionar Tudo'}</span>
                  </button>
                </div>

                {selectedColIds.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="xs"
                      iconRight={ChevronDown}
                      onClick={(e) => handleOpenPopover(e)}
                      title="Atribuir todos os colaboradores selecionados"
                    >
                      Atribuir ({selectedColIds.length})
                    </Button>
                    <button
                      onClick={clearSelection}
                      className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded cursor-pointer"
                      title="Limpar seleção"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-[var(--muted)] font-medium">Clique para selecionar</span>
                )}
              </div>
            )}

            {/* Collaborator Groups & Cards in the Pool */}
            <div className="space-y-2.5 max-h-[calc(100vh-300px)] overflow-y-auto pr-0.5">
              {unassignedPeople.length > 0 ? (
                unassignedGroups.map((group) => {
                  const groupCollabIds = group.collaborators.map((c) => c.id);
                  const isGroupAllSelected = groupCollabIds.length > 0 && groupCollabIds.every((id) => selectedColIds.includes(id));
                  const isGroupPartiallySelected = !isGroupAllSelected && groupCollabIds.some((id) => selectedColIds.includes(id));

                  const toggleSelectEntireGroup = () => {
                    if (isGroupAllSelected) {
                      setSelectedColIds((prev) => prev.filter((id) => !groupCollabIds.includes(id)));
                    } else {
                      setSelectedColIds((prev) => Array.from(new Set([...prev, ...groupCollabIds])));
                    }
                  };

                  return (
                    <div key={group.id} className="space-y-1 bg-[var(--surface-2)]/60 p-1.5 rounded-xl border border-[var(--line)]/80">
                      {/* Sub-Group Header (Only if not flat general list) */}
                      {unassignedGroupBy !== 'geral' && (
                        <div className="flex items-center justify-between px-1 py-0.5">
                          <div className="flex items-center gap-1 min-w-0 pr-1">
                            {group.icon}
                            <span className="text-[10.5px] font-black text-[var(--ink)] truncate" title={group.title}>
                              {group.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={toggleSelectEntireGroup}
                              className="text-[9.5px] font-bold text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-0.5 bg-[var(--paper)] px-1 py-0.2 rounded border border-[var(--line)]"
                              title={isGroupAllSelected ? 'Desmarcar grupo' : 'Selecionar grupo todo'}
                            >
                              {isGroupAllSelected ? (
                                <CheckSquare className="w-2.5 h-2.5" />
                              ) : isGroupPartiallySelected ? (
                                <Square className="w-2.5 h-2.5 text-[var(--primary)]" />
                              ) : (
                                <Square className="w-2.5 h-2.5" />
                              )}
                              <span>{group.collaborators.length}</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Group Member Cards */}
                      <div className="space-y-1">
                        {group.collaborators.map((col) => {
                          const isSelected = selectedColIds.includes(col.id);
                          const statusInfo = getCollaboratorStatus(col, activeDate, state);
                          const isLate = statusInfo.status === 'atraso';

                          return (
                            <div
                              key={col.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, col.id)}
                              onClick={(e) => toggleSelectCol(col.id, e)}
                              onContextMenu={collabMenuOnContext(col.id)}
                              className={`p-2 bg-[var(--paper)] hover:bg-[var(--primary-soft)] border rounded-xl cursor-pointer transition-all space-y-1 shadow-xs hover:shadow-md group ${
                                isSelected
                                  ? 'border-[var(--primary)] ring-2 ring-[var(--primary-border)] bg-[var(--primary-soft)]'
                                  : isLate
                                  ? 'border-amber-400 dark:border-amber-600 bg-amber-50/40 dark:bg-amber-950/20'
                                  : 'border-[var(--line)] hover:border-[var(--primary-border)]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                                  <button
                                    type="button"
                                    onClick={(e) => toggleSelectCol(col.id, e)}
                                    className="text-[var(--muted)] hover:text-[var(--primary)] cursor-pointer"
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
                                    )}
                                  </button>
                                  <span className="text-xs font-black text-[var(--ink)] truncate">{col.name}</span>
                                  {isLate && (
                                    <span className="px-1 py-0.2 bg-amber-500 text-white dark:bg-amber-600 rounded text-[8.5px] font-black shrink-0 uppercase tracking-wide">
                                      Atraso
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-[9px] font-bold bg-[var(--bg)] px-1 py-0.2 rounded border border-[var(--line)] text-[var(--muted)]">
                                    {col.shift}
                                  </span>
                                  <button
                                    onClick={(e) => handleOpenPopover(e, col.id)}
                                    className="p-1 hover:bg-[var(--bg)] text-[var(--primary)] rounded cursor-pointer opacity-80 group-hover:opacity-100 transition-opacity"
                                    title="Atribuir tarefa rápido"
                                  >
                                    <Zap className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1 text-[9.5px]">
                                <span className="px-1.5 py-0.2 bg-[var(--bg)] border border-[var(--line)] rounded font-extrabold text-[var(--ink)] truncate">
                                  {col.role || 'Geral'}
                                </span>
                                <span className="px-1.5 py-0.2 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50 rounded font-extrabold truncate">
                                  {col.category || 'Operacional'}
                                </span>
                              </div>

                              {renderSkillBadges(col, 3)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Tudo dimensionado!"
                  description="Todos os colaboradores presentes foram alocados."
                />
              )}
            </div>
          </Card>
        </div>

        {/* Hierarchical Task Groups Grid */}
        <div className="lg:col-span-9 space-y-3">
          {taskGroups.length === 0 ? (
            <EmptyState
              icon={FolderTree}
              title="Nenhuma tarefa encontrada"
              description="Verifique os filtros aplicados ou cadastre novas tarefas na área de Gestão de Tarefas."
            />
          ) : (
            <div className="columns-1 md:columns-2 xl:columns-3 gap-3.5 [column-fill:_balance] space-y-0">
              {taskGroups.map((group) => {
                const root = group.rootTask;
                const isInactive = root.active === false;
                const isCollapsed = collapsedTaskIds[root.id] || false;
                const pendingBreaksCount = getPendingBreaks(group.allMembers);
                const hasPendingBreaks = pendingBreaksCount > 0;
                const hasSubtasks = group.hasSubtasks;

                const directMembers = group.directMembers
                  .map((mId) => state.collaborators.find((c) => c.id === mId))
                  .filter((c): c is Collaborator => Boolean(c));

                // All family members across root and subtasks (for consolidated view when subtasks are hidden)
                const allFamilyMembers = group.allMembers
                  .map((mId) => {
                    const collab = state.collaborators.find((c) => c.id === mId);
                    if (!collab) return null;
                    const subtaskOwner = group.subtasks.find((st) => (st.members || []).includes(mId));
                    return {
                      collaborator: collab,
                      subtask: subtaskOwner,
                      assignedTaskId: subtaskOwner ? subtaskOwner.id : root.id,
                    };
                  })
                  .filter((item): item is { collaborator: Collaborator; subtask: typeof group.subtasks[0] | undefined; assignedTaskId: string } => Boolean(item));

                return (
                  <div
                    key={root.id}
                    className={`bg-[var(--surface-2)] border border-[var(--line)] rounded-xl shadow-[var(--shadow-card)] overflow-hidden break-inside-avoid inline-block w-full align-top mb-3.5 transition-all hover:shadow-[var(--shadow-card)] ${
                      isInactive
                        ? 'bg-slate-100! dark:bg-slate-900/50! border-dashed! border-slate-300! dark:border-slate-800! opacity-60'
                        : 'hover:border-[var(--primary-border)]'
                    }`}
                  >
                    {/* Activity Header (Parent Task) */}
                    <div className="p-3 bg-[var(--primary)] border-b border-[var(--primary-hover)] space-y-2">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4
                              className="text-[15px] font-black text-white truncate"
                              title={root.name}
                            >
                              {root.name}
                            </h4>
                            {root.priority && (
                              <Badge
                                tone={root.priority === 'alta' ? 'danger' : root.priority === 'media' ? 'warning' : 'neutral'}
                                className="px-1.5 py-0.5 uppercase"
                              >
                                {root.priority}
                              </Badge>
                            )}
                          </div>

                          {/* Subtasks Count & Status */}
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/70 mt-0.5">
                            {hasSubtasks ? (
                              <span className="flex items-center gap-1 text-white font-black">
                                <GitFork className="w-3 h-3" />
                                <span>{group.subtasks.length} subdivisões</span>
                              </span>
                            ) : (
                              <span>Posto Direto</span>
                            )}
                            {group.minHeadcountTotal > 0 && (
                              <span>• Meta: {group.minHeadcountTotal}</span>
                            )}
                          </div>
                        </div>

                        {/* Headcount Badge & Quick Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Consolidated Total Badge */}
                          <Badge
                            tone={hasPendingBreaks ? 'warning' : group.minHeadcountTotal > 0 && group.totalCount >= group.minHeadcountTotal ? 'success' : 'primary'}
                            title={
                              hasPendingBreaks
                                ? `${pendingBreaksCount} colaborador(es) com intervalo pendente!`
                                : `Total consolidado da atividade: ${group.totalCount} pessoas`
                            }
                            className="px-2 py-0.5"
                          >
                            {hasPendingBreaks && <Clock className="w-2.5 h-2.5 shrink-0" />}
                            {group.totalCount} alocados
                          </Badge>

                          {/* Toggle Collapse Subdivisions (if has subtasks) */}
                          {hasSubtasks && (
                            <Button
                              variant="ghost"
                              size="xs"
                              icon={isCollapsed ? ChevronDown : ChevronUp}
                              onClick={() => toggleCollapse(root.id)}
                              className="text-white/80! hover:bg-white/15! hover:text-white!"
                              title={isCollapsed ? 'Expandir subdivisões' : 'Recolher subdivisões'}
                            />
                          )}

                          {/* Clear All in this Family */}
                          <Button
                            variant="ghost"
                            size="xs"
                            icon={Trash2}
                            onClick={() => {
                              group.allTasks.forEach((t) => clearTaskAssignments(t.id));
                              showNotice(`Alocações da atividade "${root.name}" limpas.`);
                            }}
                            disabled={group.totalCount === 0}
                            className="text-white/70! hover:bg-white/15! hover:text-rose-300!"
                            title="Limpar todos os colaboradores desta atividade"
                          />

                          {/* Toggle Active/Inactive */}
                          <Button
                            variant="ghost"
                            size="xs"
                            icon={isInactive ? EyeOff : Eye}
                            onClick={() => updateTask(root.id, { active: isInactive ? true : false })}
                            className={isInactive ? 'text-amber-300! hover:bg-white/15! hover:text-amber-200!' : 'text-white/70! hover:bg-white/15! hover:text-white!'}
                            title={isInactive ? 'Ativar Tarefa' : 'Desativar Tarefa'}
                          />
                        </div>
                      </div>

                      {/* Role & Category Restrictions */}
                      {((root.allowedRoles || []).length > 0 || (root.allowedCategories || []).length > 0) && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {(root.allowedRoles || []).map((r) => (
                            <Badge
                              key={r}
                              tone="primary"
                              className="px-1.5 py-0.5 max-w-[130px] truncate"
                            >
                              {r}
                            </Badge>
                          ))}
                          {(root.allowedCategories || []).map((cat) => (
                            <Badge
                              key={cat}
                              tone="warning"
                              className="px-1.5 py-0.5 max-w-[130px] truncate"
                            >
                              {cat}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Activity Body: Direct Root Members + Subdivisions */}
                    <div className="p-3 space-y-2.5">
                      {/* CASO 1: HIERÁRQUICA DETALHADA COM SUBTAREFAS ABERTAS */}
                      {hasSubtasks && !isCollapsed && showSubtasks && (
                        <>
                          {/* RAIA 1: Atribuição Direta na Tarefa Pai (Geral / Apoio) */}
                          <div
                            onDragOver={(e) => !isInactive && e.preventDefault()}
                            onDrop={(e) => !isInactive && handleDrop(e, root.id)}
                            className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-2.5 space-y-1.5 shadow-xs"
                          >
                            <SectionHeader
                              icon={<CornerDownRight className="w-3 h-3" />}
                              title="Posto Geral / Apoio"
                              subtitle="Nível Principal"
                              right={<Badge tone="neutral">{directMembers.length}</Badge>}
                              className="pb-1! mb-1.5!"
                            />

                            <div className="space-y-1.5">
                              {directMembers.length > 0 ? (
                                directMembers.map((col) => (
                                  <CollaboratorAssignedCard
                                    key={col.id}
                                    col={col}
                                    taskId={root.id}
                                    activeDate={activeDate}
                                    state={state}
                                    selectedShifts={selectedShifts}
                                    selectedTLs={selectedTLs}
                                    onDragStart={handleDragStart}
                                    onUnassign={() => unassignTask(col.id)}
                                    onMove={() => setMovingCollab({ collaborator: col, currentTaskId: root.id })}
                                    renderSkillBadges={renderSkillBadges}
                                  />
                                ))
                              ) : (
                                <div className="p-2.5 text-center text-[9.5px] font-bold text-[var(--muted)] italic bg-[var(--paper)]/50 rounded-lg border border-dashed border-[var(--line)]">
                                  Solte colaboradores aqui para alocação direta na tarefa pai
                                </div>
                              )}
                            </div>
                          </div>

                          {/* RAIA 2: Subdivisões Operacionais (Subtarefas) */}
                          <div className="space-y-2 border-t border-[var(--line)] pt-2.5">
                            <SectionHeader
                              icon={<GitFork className="w-3.5 h-3.5" />}
                              title={`Subdivisões Operacionais (${group.subtasks.length})`}
                              className="pb-1! mb-2!"
                            />

                            <div className="space-y-2">
                              {group.subtasks.map((subtask) => {
                                const subMembers = (subtask.members || [])
                                  .map((mId) => state.collaborators.find((c) => c.id === mId))
                                  .filter((c): c is Collaborator => Boolean(c));
                                const subPending = getPendingBreaks(subtask.members || []);

                                return (
                                  <div
                                    key={subtask.id}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => handleDrop(e, subtask.id)}
                                    className="bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--primary-border)] rounded-xl p-2.5 space-y-1.5 transition-all shadow-xs hover:shadow-sm"
                                  >
                                    {/* Subtask Header */}
                                    <div className="flex items-center justify-between gap-1 border-b border-[var(--line)]/60 pb-1">
                                      <div className="flex items-center gap-1 min-w-0">
                                        <CornerDownRight className="w-3 h-3 text-[var(--primary)] shrink-0" />
                                        <span className="text-xs font-black text-[var(--ink)] truncate" title={subtask.name}>
                                          {subtask.name}
                                        </span>
                                        {subtask.minHeadcount && (
                                          <span className="text-[8.5px] font-bold text-[var(--muted)] shrink-0">
                                            (Meta: {subtask.minHeadcount})
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <Badge
                                          tone={subPending > 0 ? 'warning' : 'neutral'}
                                          className="px-2 py-0.5"
                                        >
                                          {subMembers.length}
                                        </Badge>

                                        <button
                                          onClick={() => clearTaskAssignments(subtask.id)}
                                          disabled={subMembers.length === 0}
                                          className="p-0.5 hover:bg-rose-100 dark:hover:bg-rose-950 text-slate-400 hover:text-rose-600 rounded disabled:opacity-20 cursor-pointer"
                                          title="Limpar esta subdivisão"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Subtask Members */}
                                    <div className="space-y-1.5">
                                      {subMembers.length > 0 ? (
                                        subMembers.map((col) => (
                                          <CollaboratorAssignedCard
                                            key={col.id}
                                            col={col}
                                            taskId={subtask.id}
                                            activeDate={activeDate}
                                            state={state}
                                            selectedShifts={selectedShifts}
                                            selectedTLs={selectedTLs}
                                            onDragStart={handleDragStart}
                                            onUnassign={() => unassignTask(col.id)}
                                            onMove={() => setMovingCollab({ collaborator: col, currentTaskId: subtask.id })}
                                            renderSkillBadges={renderSkillBadges}
                                          />
                                        ))
                                      ) : (
                                        <div className="p-2 text-center text-[9px] font-bold text-[var(--muted)] border border-dashed border-[var(--line)] rounded-lg bg-[var(--paper)]/40">
                                          Solte pessoas nesta subdivisão
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}

                      {/* CASO 2: TAREFA COM SUBTAREFAS RECOLHIDAS / OCULTAS (VISÃO GERENCIAL CONSOLIDADA) */}
                      {hasSubtasks && (isCollapsed || !showSubtasks) && (
                        <div
                          onDragOver={(e) => !isInactive && e.preventDefault()}
                          onDrop={(e) => !isInactive && handleDrop(e, root.id)}
                          className="space-y-1.5"
                        >
                          <SectionHeader
                            title={`Visão Consolidada (${allFamilyMembers.length} pessoas)`}
                            right={
                              <span className="text-[9px] text-[var(--primary)] font-black">
                                {group.subtasks.length} subdivisões ocultas
                              </span>
                            }
                            className="pb-1! mb-1.5!"
                          />

                          <div className="space-y-1">
                            {allFamilyMembers.length > 0 ? (
                              allFamilyMembers.map(({ collaborator: col, subtask, assignedTaskId }) => (
                                <div key={col.id} className="relative">
                                  <CollaboratorAssignedCard
                                    col={col}
                                    taskId={assignedTaskId}
                                    activeDate={activeDate}
                                    state={state}
                                    selectedShifts={selectedShifts}
                                    selectedTLs={selectedTLs}
                                    onDragStart={handleDragStart}
                                    onUnassign={() => unassignTask(col.id)}
                                    onMove={() => setMovingCollab({ collaborator: col, currentTaskId: assignedTaskId })}
                                    renderSkillBadges={renderSkillBadges}
                                  />
                                  {subtask && (
                                    <div className="text-[8.5px] font-black text-[var(--primary)] px-2 py-0.5 -mt-1 mb-1 bg-[var(--bg)] border-x border-b border-[var(--line)] rounded-b-lg flex items-center gap-1">
                                      <CornerDownRight className="w-2.5 h-2.5" />
                                      <span>Subdivisão: {subtask.name}</span>
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-center text-[10px] font-bold text-[var(--muted)] border border-dashed border-[var(--line)] rounded-xl bg-[var(--bg)]/40">
                                Solte colaboradores aqui para alocar no posto
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* CASO 3: TAREFA SIMPLES (SEM SUBTAREFAS) */}
                      {!hasSubtasks && (
                        <div
                          onDragOver={(e) => !isInactive && e.preventDefault()}
                          onDrop={(e) => !isInactive && handleDrop(e, root.id)}
                          className="space-y-1"
                        >
                          {directMembers.length > 0 ? (
                            directMembers.map((col) => (
                              <CollaboratorAssignedCard
                                key={col.id}
                                col={col}
                                taskId={root.id}
                                activeDate={activeDate}
                                state={state}
                                selectedShifts={selectedShifts}
                                selectedTLs={selectedTLs}
                                onDragStart={handleDragStart}
                                onUnassign={() => unassignTask(col.id)}
                                onMove={() => setMovingCollab({ collaborator: col, currentTaskId: root.id })}
                                renderSkillBadges={renderSkillBadges}
                              />
                            ))
                          ) : (
                            <div className="p-4 text-center text-[10px] font-bold text-[var(--muted)] border border-dashed border-[var(--line)] rounded-xl bg-[var(--bg)]/40">
                              Solte colaboradores aqui
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      ) : (
        renderAssignmentList()
      )}

      {/* QUICK ASSIGNMENT POPOVER (HIERARCHICAL TREE SELECTION WITH CONTEXTUAL RECOMMENDATION) */}
      {popoverState && (() => {
        const popoverCollabs = popoverState.colIds
          .map((id) => state.collaborators.find((c) => c.id === id))
          .filter((c): c is Collaborator => !!c);
        const primaryCollab = popoverCollabs[0];

        // Filter taskGroups by search term
        const searchedGroups = taskGroups.filter((g) => {
          if (!popoverSearchTerm.trim()) return true;
          const term = popoverSearchTerm.toLowerCase();
          const matchRoot = g.rootTask.name.toLowerCase().includes(term);
          const matchSub = g.subtasks.some((st) => st.name.toLowerCase().includes(term));
          return matchRoot || matchSub;
        });

        // Split into compatible and other groups
        const compatibleGroups: ConsolidatedTaskGroup[] = [];
        const otherGroups: ConsolidatedTaskGroup[] = [];

        searchedGroups.forEach((group) => {
          const rootEval = checkTaskCompatibility(group.rootTask, primaryCollab, popoverCollabs);
          const hasCompatibleSubtask = group.subtasks.some(
            (st) => checkTaskCompatibility(st, primaryCollab, popoverCollabs).isCompatible
          );

          if (rootEval.isCompatible || hasCompatibleSubtask) {
            compatibleGroups.push(group);
          } else {
            otherGroups.push(group);
          }
        });

        // Ordena as tarefas compatíveis: as que melhor combinam o perfil completo
        // (cargo + categoria + skills + turno) aparecem primeiro.
        if (primaryCollab) {
          const scoreGroup = (group: ConsolidatedTaskGroup): number => {
            const targets = [group.rootTask, ...group.subtasks];
            return Math.max(
              ...targets.map((t) =>
                calculateCollabTaskScore(primaryCollab, t, {
                  considerSkills: true,
                  considerRoles: true,
                  considerCategories: true,
                  considerPriorities: false,
                })
              )
            );
          };
          compatibleGroups.sort((a, b) => scoreGroup(b) - scoreGroup(a));
        }

        const renderTaskGroupItem = (group: ConsolidatedTaskGroup, isOther = false) => {
          const root = group.rootTask;
          const rootEval = checkTaskCompatibility(root, primaryCollab, popoverCollabs);

          return (
            <div
              key={root.id}
              className={`space-y-1 p-1.5 rounded-xl border ${
                isOther
                  ? 'bg-[var(--bg)]/70 border-[var(--line)] opacity-85 hover:opacity-100'
                  : 'bg-[var(--bg)] border-[var(--line)]'
              }`}
            >
              {/* Root Task Button */}
              <button
                onClick={() => handleBatchAssign(root.id)}
                className={`w-full text-left p-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between group cursor-pointer border shadow-2xs ${
                  rootEval.isCompatible
                    ? 'bg-[var(--paper)] hover:bg-[var(--primary)] hover:text-white border-[var(--line)]'
                    : 'bg-[var(--paper)]/80 hover:bg-amber-600 hover:text-white border-amber-200 dark:border-amber-900/60'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0 pr-1">
                  <FolderTree className="w-3.5 h-3.5 text-[var(--primary)] group-hover:text-white shrink-0" />
                  <span className="truncate">{root.name}</span>
                  {group.hasSubtasks && (
                    <span className="text-[9px] font-normal opacity-70">(Geral)</span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!rootEval.isCompatible && rootEval.mismatchReasons.length > 0 && (
                    <span className="text-[8px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-1 py-0.2 rounded border border-amber-300 dark:border-amber-800">
                      {rootEval.mismatchReasons[0]}
                    </span>
                  )}
                  <span className="text-[9px] font-black bg-[var(--bg)] text-[var(--ink)] group-hover:bg-white group-hover:text-[var(--primary)] px-1.5 py-0.2 rounded-full border border-[var(--line)] shrink-0">
                    {group.totalCount}
                  </span>
                </div>
              </button>

              {/* Subtasks under Root */}
              {group.hasSubtasks && (
                <div className="pl-3 space-y-1 border-l-2 border-[var(--primary-border)]/60 ml-2">
                  {group.subtasks.map((subtask) => {
                    const subEval = checkTaskCompatibility(subtask, primaryCollab, popoverCollabs);
                    return (
                      <button
                        key={subtask.id}
                        onClick={() => handleBatchAssign(subtask.id)}
                        className={`w-full text-left p-1 rounded-md text-[11px] font-bold transition-colors flex items-center justify-between group cursor-pointer border shadow-2xs ${
                          subEval.isCompatible
                            ? 'bg-[var(--paper)]/90 hover:bg-[var(--primary)] hover:text-white border-[var(--line)]/80'
                            : 'bg-[var(--paper)]/60 hover:bg-amber-600 hover:text-white border-amber-200/70 dark:border-amber-900/50'
                        }`}
                      >
                        <div className="flex items-center gap-1 min-w-0 pr-1">
                          <CornerDownRight className="w-3 h-3 text-[var(--primary)] group-hover:text-white shrink-0" />
                          <span className="truncate">{subtask.name}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!subEval.isCompatible && subEval.mismatchReasons.length > 0 && (
                            <span className="text-[7.5px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-1 py-0.1 rounded">
                              {subEval.mismatchReasons[0]}
                            </span>
                          )}
                          <span className="text-[8.5px] font-bold bg-[var(--bg)] text-[var(--muted)] group-hover:bg-white group-hover:text-[var(--primary)] px-1 py-0.1 rounded-full shrink-0">
                            {(subtask.members || []).length}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        };

        return (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
              onClick={() => {
                setPopoverState(null);
                setPopoverSearchTerm('');
                setShowOtherTasksInPopover(false);
                clearSelection();
              }}
            />

            <div
              style={{
                position: 'fixed',
                top: `${Math.min(popoverState.top, window.innerHeight - 450)}px`,
                left: `${Math.min(popoverState.left, window.innerWidth - 360)}px`,
              }}
              className="z-50 w-84 bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3 shadow-[var(--shadow-pop)] space-y-2.5 animate-in fade-in zoom-in-95 duration-150 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-start justify-between border-b border-[var(--line)] pb-2 shrink-0">
                <div>
                  <span className="text-[9.5px] font-black text-[var(--primary)] uppercase tracking-wider block">
                    Atribuição Rápida de Tarefa
                  </span>
                  <h4 className="text-xs font-black text-[var(--ink)] leading-tight">
                    {popoverCollabs.length > 1
                      ? `${popoverCollabs.length} Colaboradores Selecionados`
                      : primaryCollab?.name || 'Colaborador'}
                  </h4>
                </div>

                <button
                  onClick={() => {
                    setPopoverState(null);
                    setPopoverSearchTerm('');
                    setShowOtherTasksInPopover(false);
                    clearSelection();
                  }}
                  className="p-1 text-[var(--muted)] hover:text-[var(--ink)] rounded-md hover:bg-[var(--bg)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Contextual Profile Summary for Selected Collaborator */}
              {primaryCollab && (
                <div className="bg-[var(--bg)] p-2 rounded-xl border border-[var(--line)] space-y-1 shrink-0">
                  <div className="flex items-center justify-between text-[11px] font-black text-[var(--ink)]">
                    <span className="truncate">{primaryCollab.name}</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-[var(--paper)] border border-[var(--line)] rounded text-[var(--muted)]">
                      Turno {primaryCollab.shift || 'Geral'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 text-[9.5px]">
                    <span className="px-1.5 py-0.2 bg-[var(--paper)] border border-[var(--line)] rounded font-extrabold text-[var(--ink)]">
                      {primaryCollab.role || 'Sem Cargo'}
                    </span>
                    <span className="px-1.5 py-0.2 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50 rounded font-extrabold">
                      {primaryCollab.category || 'Operacional'}
                    </span>
                  </div>

                  {/* Skills do colaborador para contextualizar as sugestões */}
                  {(() => {
                    const activeSkills = Object.entries(primaryCollab.skills || {})
                      .filter(([_, lvl]) => Number(lvl) > 0)
                      .map(([skill]) => skill);
                    if (activeSkills.length === 0) return null;
                    return (
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <Sparkles className="w-3 h-3 text-purple-500 shrink-0" />
                        {activeSkills.slice(0, 4).map((skill) => (
                          <span
                            key={skill}
                            className="px-1.5 py-0.2 bg-purple-50 text-purple-900 dark:bg-purple-950/60 dark:text-purple-200 border border-purple-200 dark:border-purple-800/50 rounded font-extrabold"
                          >
                            {skill}
                          </span>
                        ))}
                        {activeSkills.length > 4 && (
                          <span className="text-[9px] font-bold text-[var(--muted)]">
                            +{activeSkills.length - 4}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Search Filter for Task Tree */}
              <div className="shrink-0">
                <input
                  type="text"
                  value={popoverSearchTerm}
                  onChange={(e) => setPopoverSearchTerm(e.target.value)}
                  placeholder="Buscar postos ou subdivisões..."
                  className="w-full text-xs px-2.5 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] placeholder-[var(--muted)] focus:outline-hidden focus:border-[var(--primary)] font-bold"
                />
              </div>

              {/* Hierarchical Task Picker List */}
              <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5 max-h-[320px]">
                {/* SECTION 1: COMPATIBLE TASKS (PRIMARY SUGGESTIONS) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10.5px] font-black text-[var(--primary)] px-0.5">
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-[var(--primary)] text-[var(--primary)]" />
                      <span>Tarefas Compatíveis ({compatibleGroups.length})</span>
                    </span>
                  </div>

                  {compatibleGroups.length > 0 ? (
                    <div className="space-y-1">
                      {compatibleGroups.map((group) => renderTaskGroupItem(group, false))}
                    </div>
                  ) : (
                    <div className="p-3 bg-[var(--bg)] border border-dashed border-[var(--line)] rounded-xl text-center text-[11px] text-[var(--muted)]">
                      Nenhuma tarefa com compatibilidade direta encontrada.
                    </div>
                  )}
                </div>

                {/* SECTION 2: OTHER TASKS OF DIFFERENT ROLES / CATEGORIES (COLLAPSIBLE) */}
                {otherGroups.length > 0 && (
                  <div className="pt-2 border-t border-[var(--line)] space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setShowOtherTasksInPopover(!showOtherTasksInPopover)}
                      className="w-full py-1.5 px-2 bg-[var(--bg)] hover:bg-[var(--line)]/50 rounded-xl text-[11px] font-black text-[var(--muted)] hover:text-[var(--ink)] flex items-center justify-between transition-colors cursor-pointer border border-[var(--line)]"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                        <Filter className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
                        <span className="truncate">Exibir tarefas de outros cargos e categorias ({otherGroups.length})</span>
                      </div>
                      {showOtherTasksInPopover ? (
                        <ChevronUp className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>

                    {showOtherTasksInPopover && (
                      <div className="space-y-1 pt-1 animate-in fade-in duration-150">
                        {otherGroups.map((group) => renderTaskGroupItem(group, true))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* MOVE COLLABORATOR DIRECT MODAL */}
      <Modal
        isOpen={!!movingCollab}
        onClose={() => setMovingCollab(null)}
        icon={<ArrowRightLeft className="w-4.5 h-4.5" />}
        title={movingCollab ? `Mover ${movingCollab.collaborator.name}` : ''}
        subtitle="Escolha o novo posto ou subdivisão para transferir este colaborador."
        size="md"
        footer={
          movingCollab ? (
            <>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  unassignTask(movingCollab.collaborator.id);
                  setMovingCollab(null);
                  showNotice(`"${movingCollab.collaborator.name}" removido da tarefa.`);
                }}
              >
                Remover da Tarefa
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMovingCollab(null)}>
                Cancelar
              </Button>
            </>
          ) : undefined
        }
      >
        {movingCollab && (
          <div className="space-y-1.5">
            {taskGroups.map((group) => {
              const root = group.rootTask;
              return (
                <div key={root.id} className="bg-[var(--surface-2)] p-2 rounded-xl border border-[var(--line)] space-y-1">
                  <button
                    onClick={() => handleMoveCollaborator(root.id)}
                    className={`w-full text-left p-2 rounded-lg text-xs font-black transition-colors flex items-center justify-between cursor-pointer border ${
                      movingCollab.currentTaskId === root.id
                        ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 text-amber-900 dark:text-amber-200'
                        : 'bg-[var(--paper)] hover:bg-[var(--primary)] hover:text-white border-[var(--line)] shadow-xs'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                      <FolderTree className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                      <span className="truncate">{root.name}</span>
                      {group.hasSubtasks && <span className="text-[9.5px] font-normal opacity-75">(Geral)</span>}
                    </div>
                    {movingCollab.currentTaskId === root.id && (
                      <span className="text-[9px] font-bold uppercase bg-amber-200 dark:bg-amber-900 px-1.5 py-0.2 rounded">
                        Atual
                      </span>
                    )}
                  </button>

                  {group.hasSubtasks && (
                    <div className="pl-3 space-y-1 border-l border-[var(--line)]/60 ml-2">
                      {group.subtasks.map((subtask) => (
                        <button
                          key={subtask.id}
                          onClick={() => handleMoveCollaborator(subtask.id)}
                          className={`w-full text-left p-1.5 rounded-md text-xs font-bold transition-colors flex items-center justify-between cursor-pointer border ${
                            movingCollab.currentTaskId === subtask.id
                              ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-300 text-amber-900 dark:text-amber-200'
                              : 'bg-[var(--paper)] hover:bg-[var(--primary)] hover:text-white border-[var(--line)] shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-1 min-w-0 pr-1">
                            <CornerDownRight className="w-3 h-3 text-[var(--primary)] shrink-0" />
                            <span className="truncate">{subtask.name}</span>
                          </div>
                          {movingCollab.currentTaskId === subtask.id && (
                            <span className="text-[8.5px] font-bold uppercase bg-amber-200 dark:bg-amber-900 px-1 py-0.1 rounded">
                              Atual
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Intelligent Auto Assign Modal */}
      <AutoAssignModal
        isOpen={autoAssignModalOpen}
        onClose={() => setAutoAssignModalOpen(false)}
        onExecute={(options) => {
          setIsAutoAssigning(true);
          autoAssign(options);
          setAutoAssignModalOpen(false);
          setTimeout(() => setIsAutoAssigning(false), 500);
        }}
        presentCount={autoAssignStats.presentCount}
        activeTasksCount={autoAssignStats.activeTasksCount}
        tasksWithSkillsCount={autoAssignStats.tasksWithSkillsCount}
        highPriorityTasksCount={autoAssignStats.highPriorityTasksCount}
      />
    </div>
  );
};

// Sub-component for rendering assigned collaborator card inside task or subtask
interface CollaboratorAssignedCardProps {
  col: Collaborator;
  taskId: string;
  activeDate: string;
  state: any;
  selectedShifts: string[];
  selectedTLs: string[];
  onDragStart: (e: React.DragEvent, colId: string) => void;
  onUnassign: () => void;
  onMove: () => void;
  renderSkillBadges: (col: Collaborator, maxDisplay?: number) => React.ReactNode;
}

const CollaboratorAssignedCard: React.FC<CollaboratorAssignedCardProps> = ({
  col,
  taskId,
  activeDate,
  state,
  selectedShifts,
  selectedTLs,
  onDragStart,
  onUnassign,
  onMove,
  renderSkillBadges,
}) => {
  const statusInfo = getCollaboratorStatus(col, activeDate, state);
  const colShift = col.shift || 'Geral';
  const colTL = col.teamLeader || state.defaultTeamLeader || 'Sem Time';
  const matchesShift = selectedShifts.length === 0 || selectedShifts.includes(colShift);
  const matchesTL = selectedTLs.length === 0 || selectedTLs.includes(colTL);
  const isPresent = statusInfo.status === 'presente' || statusInfo.status === 'atraso';
  const isLate = statusInfo.status === 'atraso';
  const isFilteredOut = !matchesShift || !matchesTL;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, col.id)}
      onContextMenu={collabMenuOnContext(col.id)}
      className={`p-2 border rounded-xl flex items-center justify-between text-[10px] transition-all shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing group ${
        !isPresent
          ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900'
          : isLate
          ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
          : isFilteredOut
          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-900'
          : 'bg-[var(--paper)] border-[var(--line)] hover:border-[var(--primary)]'
      }`}
      title="Arraste para mover para outra tarefa ou subdivisão"
    >
      <div className="flex items-center gap-1.5 min-w-0 pr-1">
        <GripVertical className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--primary)] shrink-0 cursor-grab" />
        <div className="min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="font-black text-[var(--ink)] truncate block text-xs leading-tight">
              {col.name}
            </span>
            {isLate && (
              <span className="text-[8px] font-black px-1.5 py-0.2 bg-amber-500 text-white dark:bg-amber-600 rounded border border-amber-600 uppercase shadow-2xs">
                ⏰ Atraso
              </span>
            )}
            {!isPresent && (
              <span className="text-[8px] font-black px-1.5 py-0.2 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 rounded border border-rose-300">
                {statusInfo.status}
              </span>
            )}
          </div>
          <span className="text-[9px] text-[var(--muted)] truncate block font-medium mt-0.5">
            <span className="text-[var(--primary)] font-black">{col.scale || 'A'}</span> • {col.role || 'Geral'} • {col.category || 'Geral'}
          </span>
          {renderSkillBadges(col, 2)}
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMove();
          }}
          className="p-1 text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--bg)] rounded cursor-pointer"
          title="Mover para outro posto / subdivisão"
        >
          <ArrowRightLeft className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onUnassign();
          }}
          className="p-1 text-[var(--muted)] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950 rounded cursor-pointer"
          title="Remover da tarefa"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
