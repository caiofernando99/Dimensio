import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SearchInput } from '../components/SearchInput';
import { MultiSelectFilter } from '../components/MultiSelectFilter';
import {
  Clock,
  RefreshCw,
  CheckCircle2,
  Filter,
  SlidersHorizontal,
  Sparkles,
  GripVertical,
  Briefcase,
  Tag,
  Zap,
  Undo2,
  Trash2,
  X,
  Globe,
  Megaphone,
  FolderTree,
  GitFork,
  CornerDownRight,
  Layers,
  ChevronDown,
  ChevronUp,
  Users,
  List,
  RotateCw,
  RotateCcw,
  HelpCircle,
  Info,
  CalendarClock,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Button,
  Badge,
  Tabs,
  Toolbar,
  EmptyState,
  Avatar,
} from '../components/ui';
import { matchesSearch, isScaleOff, getCollaboratorStatus } from '../utils/helpers';
import { collabMenuOnContext } from '../utils/collabContextMenu';
import {
  getConsolidatedTaskGroups,
  ConsolidatedTaskGroup,
  buildTaskTree,
  TaskTreeNode,
} from '../utils/taskTreeHelpers';
import { Task, Collaborator } from '../types';

export const BreaksView: React.FC = () => {
  const {
    state,
    moveBreakInterval,
    generateBreaks,
    generateRotatingBreaks,
    breakRotationMap,
    clearBreaks,
    undo,
    canUndo,
    showNotice,
    broadcastNotice,
    showSubtasks,
    setShowSubtasks,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
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
  const [allocationMode, setAllocationMode] = useState<'grid' | 'list'>('grid');
  const [balancingMode, setBalancingMode] = useState<'parent' | 'subtasks' | 'rotation'>('parent');
  const [showRotationModal, setShowRotationModal] = useState(false);
  const [collapsedParentIds, setCollapsedParentIds] = useState<Record<string, boolean>>({});

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

  const toggleParentCollapse = (parentId: string) => {
    setCollapsedParentIds((prev) => ({
      ...prev,
      [parentId]: !prev[parentId],
    }));
  };

  // Guided Mode State
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const [draggingCollaboratorId, setDraggingCollaboratorId] = useState<string | null>(null);
  const [dragOverTargetKey, setDragOverTargetKey] = useState<string | null>(null);
  const [dragOverTopSlotId, setDragOverTopSlotId] = useState<string | null>(null);

  // Quick switch slot dropdown for a collaborator
  const [activeSlotMenuColId, setActiveSlotMenuColId] = useState<string | null>(null);

  const activeDate = state.selectedDate;
  const dayIntervals = state.intervals[activeDate] || {};

  // Filter break slots for active shift or general sector defaults
  const activeBreaks = state.breaks.filter((b) => {
    if (selectedShifts.length === 0) return true;
    return !b.shift || b.shift === 'Geral' || selectedShifts.includes(b.shift);
  });

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

  // Unique roles, categories and skills for multi-select filters
  const allRoles = Array.from(new Set(state.collaborators.map((c) => c.role).filter(Boolean)));
  const roleOptions = allRoles.map((r) => ({ label: r, value: r }));

  const allCategories = Array.from(new Set(state.collaborators.map((c) => c.category).filter(Boolean)));
  const categoryOptions = allCategories.map((cat) => ({ label: cat, value: cat }));

  const allSkills = Array.from(new Set(state.skills || []));
  const skillOptions = allSkills.map((s) => ({ label: s, value: s }));

  // Helper to render skill badges
  const renderSkillBadges = (col: any, maxDisplay = 2) => {
    if (!col.skills) return null;
    const activeEntries = Object.entries(col.skills).filter(([_, lvl]) => Number(lvl) > 0);
    if (activeEntries.length === 0) return null;

    const displayed = activeEntries.slice(0, maxDisplay);
    const remaining = activeEntries.length - maxDisplay;

    return (
      <div className="flex flex-wrap items-center gap-1 mt-1">
        {displayed.map(([sName, lvlVal]) => {
          const lvl = Number(lvlVal);
          const lvlLabel = lvl === 3 ? 'Nv 3' : lvl === 2 ? 'Nv 2' : 'Nv 1';
          return (
            <Badge
              key={sName}
              tone="purple"
              title={`Skill: ${sName} (${lvlLabel})`}
              className="gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-black border border-purple-300 dark:border-purple-800"
            >
              <Sparkles className="w-2.5 h-2.5 text-purple-500 shrink-0" />
              <span className="truncate max-w-[85px]">{sName}</span>
              <span className="text-[7.5px] opacity-80 bg-purple-200/80 dark:bg-purple-900/90 px-0.5 rounded font-bold">
                {lvlLabel}
              </span>
            </Badge>
          );
        })}
        {remaining > 0 && (
          <Badge
            tone="purple"
            title={`${remaining} outra(s) skill(s)`}
            className="gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-black border border-purple-300 dark:border-purple-800"
          >
            +{remaining}
          </Badge>
        )}
      </div>
    );
  };

  // Active present people (includes manual presence overrides e.g. troca de folga)
  const presentPeople = state.collaborators.filter((c) => {
    const colShift = c.shift || 'Geral';
    const matchesShift = selectedShifts.length === 0 || selectedShifts.includes(colShift);
    const colTL = c.teamLeader || state.defaultTeamLeader || 'Sem Time';
    const matchesTL = selectedTLs.length === 0 || selectedTLs.includes(colTL);
    if (!matchesShift || !matchesTL) return false;

    const statusInfo = getCollaboratorStatus(c, activeDate, state);
    return statusInfo.status === 'presente' || statusInfo.status === 'atraso';
  });

  // Filter present people
  const filteredPeopleIds = new Set(
    presentPeople
      .filter((p) => {
        const matchesQuery = matchesSearch(p.name, searchTerm) || matchesSearch(p.role, searchTerm);
        const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(p.role);
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(p.category);
        const matchesSkill =
          selectedSkills.length === 0 ||
          selectedSkills.some((s) => Number(p.skills?.[s]) > 0);
        return matchesQuery && matchesRole && matchesCategory && matchesSkill;
      })
      .map((p) => p.id)
  );

  // Filter active tasks matching selected roles / categories
  const activeTasks = (state.tasks || [])
    .filter((t) => t.active !== false)
    .filter((t) => {
      if (selectedRoles.length === 0) return true;
      if (!t.allowedRoles || t.allowedRoles.length === 0) return true;
      return t.allowedRoles.some((r) => selectedRoles.includes(r));
    })
    .filter((t) => {
      if (selectedCategories.length === 0) return true;
      if (!t.allowedCategories || t.allowedCategories.length === 0) return true;
      return t.allowedCategories.some((cat) => selectedCategories.includes(cat));
    });

  // Consolidated task groups for hierarchical interval management
  const taskGroups = useMemo(() => {
    return getConsolidatedTaskGroups(activeTasks, true);
  }, [activeTasks]);

  // Helper to find break slot for a person
  const getPersonBreakSlot = (personId: string) => {
    return activeBreaks.find((b) => (dayIntervals[b.id] || []).includes(personId)) || null;
  };

  // Tasks with members for the list allocation view
  const tasksWithMembers = activeTasks.filter((t) =>
    t.members.some((mId) => filteredPeopleIds.has(mId))
  );

  const toggleSelect = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Collaborators still pending a break slot (list view)
  const pendingCollaborators = state.collaborators.filter(
    (c) => filteredPeopleIds.has(c.id) && !getPersonBreakSlot(c.id)
  );

  const handleBulkAssignBreak = (breakSlotId: string | null) => {
    if (selectedMemberIds.length === 0) return;
    selectedMemberIds.forEach((mId) => {
      const currentSlot = getPersonBreakSlot(mId);
      moveBreakInterval(mId, currentSlot ? currentSlot.id : null, breakSlotId);
    });
    const slotObj = activeBreaks.find((b) => b.id === breakSlotId);
    showNotice(
      `${selectedMemberIds.length} colaborador(es) dimensionado(s) para ${slotObj ? slotObj.time : 'Intervalos pendentes'}!`
    );
    setSelectedMemberIds([]);
  };

  // Standardized Collaborator Card inside Break Slot
  const renderBreakCollaboratorCard = (col: Collaborator, currentSlot: typeof state.breaks[number] | null) => {
    const statusInfo = getCollaboratorStatus(col, activeDate, state);
    const isLate = statusInfo.status === 'atraso';
    const isPending = !currentSlot;
    const isMenuOpen = activeSlotMenuColId === col.id;

    return (
      <div
        key={col.id}
        draggable
        onContextMenu={collabMenuOnContext(col.id)}
        onDragStart={(e) => {
          setDraggingCollaboratorId(col.id);
          e.dataTransfer.setData(
            'text/plain',
            JSON.stringify({
              collaboratorId: col.id,
              fromSlotId: currentSlot ? currentSlot.id : null,
            })
          );
        }}
        className={`p-2 border rounded-xl flex items-center justify-between text-[10px] cursor-grab active:cursor-grabbing transition-all shadow-xs group relative ${
          isLate
            ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
            : isPending
            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-900/60 hover:border-amber-400'
            : 'bg-[var(--paper)] border-[var(--line)] hover:border-[var(--primary)] hover:shadow-md'
        }`}
        title="Arraste para mudar o horário ou clique no botão de troca rápida"
      >
        <div className="flex items-center gap-1.5 min-w-0 pr-1">
          <GripVertical className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--primary)] shrink-0" />
          <Avatar name={col.name} photoUrl={col.photoUrl} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="font-black text-[var(--ink)] truncate block text-xs leading-tight">
                {col.name}
              </span>
              {isLate && (
                <Badge tone="warning" dot className="uppercase text-[8px]">
                  Atraso
                </Badge>
              )}
              {isPending && (
                <Badge tone="warning" dot className="uppercase text-[8px]">
                  Pendente
                </Badge>
              )}
            </div>
            <span className="text-[9px] text-[var(--muted)] truncate block font-medium mt-0.5">
              <span className="text-[var(--primary)] font-black">{col.scale || 'A'}</span> • {col.role || 'Geral'} • {col.category || 'Geral'}
            </span>
            {renderSkillBadges(col, 2)}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Quick slot selection pill / trigger */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveSlotMenuColId(isMenuOpen ? null : col.id);
              }}
              className={`px-1.5 py-0.5 text-[9px] font-black rounded-lg border flex items-center gap-1 cursor-pointer transition-all shadow-2xs ${
                currentSlot
                  ? 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--primary-border)] hover:bg-[var(--primary-soft)]'
                  : 'bg-amber-500 text-white border-amber-600'
              }`}
              title="Trocar horário de intervalo"
            >
              <Clock className="w-2.5 h-2.5" />
              <span>{currentSlot ? currentSlot.time : 'Pendente'}</span>
              <ChevronDown className="w-2.5 h-2.5 opacity-60" />
            </button>

            {/* Quick Slot Dropdown Menu */}
            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlotMenuColId(null);
                  }}
                />
                <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--paper)] border border-[var(--line)] rounded-xl shadow-[var(--shadow-pop)] z-50 p-1.5 space-y-1 text-xs animate-in fade-in zoom-in-95">
                  <div className="px-2 py-1 text-[9px] font-black uppercase text-[var(--muted)] border-b border-[var(--line)]">
                    Mover {col.name.split(' ')[0]} para:
                  </div>
                  {activeBreaks.map((b) => (
                    <button
                      key={b.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBreakInterval(col.id, currentSlot ? currentSlot.id : null, b.id);
                        setActiveSlotMenuColId(null);
                        showNotice(`Intervalo de ${col.name} alterado para ${b.time}!`);
                      }}
                      className={`w-full text-left px-2 py-1 rounded-lg flex items-center justify-between text-[10.5px] font-bold transition-all cursor-pointer ${
                        currentSlot?.id === b.id
                          ? 'bg-[var(--primary)] text-white'
                          : 'hover:bg-[var(--primary-soft)] text-[var(--ink)]'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        <span>{b.time}</span>
                      </span>
                      {currentSlot?.id === b.id && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                  ))}
                  {currentSlot && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBreakInterval(col.id, currentSlot.id, null);
                        setActiveSlotMenuColId(null);
                        showNotice(`Intervalo de ${col.name} movido para pendentes.`);
                      }}
                      className="w-full text-left px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-[10px] font-black border-t border-[var(--line)] mt-1 flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Desvincular (Pendente)</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Reusable time-slot groups (members grouped by break slot) for a given task
  const renderTimeSlotGroups = (task: Task, taskMembers: Collaborator[]) => {
    const timeSlotGroups: Array<{
      slot: typeof state.breaks[number] | null;
      members: Collaborator[];
    }> = [];

    activeBreaks.forEach((b) => {
      const inThisSlot = taskMembers.filter((m) => (dayIntervals[b.id] || []).includes(m.id));
      if (inThisSlot.length > 0 || !searchTerm) {
        timeSlotGroups.push({
          slot: b,
          members: inThisSlot,
        });
      }
    });

    // Members with no break slot assigned (Intervalos pendentes)
    const noSlotMembers = taskMembers.filter((m) => !getPersonBreakSlot(m.id));
    if (noSlotMembers.length > 0) {
      timeSlotGroups.push({
        slot: null,
        members: noSlotMembers,
      });
    }

    return (
      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-0.5">
        {timeSlotGroups.map(({ slot, members }) => {
          const slotLabel = slot ? slot.time : 'Intervalos pendentes';
          const targetKey = `${task.id}-${slot ? slot.id : 'no-slot'}`;
          const isTargetHovered = dragOverTargetKey === targetKey;
          const isPending = !slot;

          return (
            <div
              key={slot ? slot.id : 'no-slot'}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverTargetKey !== targetKey) setDragOverTargetKey(targetKey);
              }}
              onDragLeave={() => setDragOverTargetKey(null)}
              onDrop={(e) => {
                e.preventDefault();
                try {
                  const raw = e.dataTransfer.getData('text/plain');
                  if (raw) {
                    const { collaboratorId, fromSlotId } = JSON.parse(raw);
                    const toSlotId = slot ? slot.id : null;
                    if (collaboratorId) {
                      moveBreakInterval(collaboratorId, fromSlotId, toSlotId);
                      showNotice(`Intervalo atualizado com sucesso!`);
                    }
                  }
                } catch (err) {
                  // fallback
                }
                setDragOverTargetKey(null);
                setDraggingCollaboratorId(null);
              }}
              className={`space-y-1.5 p-1 rounded-xl transition-all duration-150 ${
                isTargetHovered
                  ? 'bg-[var(--primary-soft)] border-2 border-dashed border-[var(--primary)] shadow-sm'
                  : ''
              }`}
            >
              {/* CLEAR, HIGH-CONTRAST HORIZONTAL TIME SLOT HEADER */}
              <div className="flex items-center gap-2 my-1.5">
                <div className="h-px flex-1 bg-[var(--line)]" />
                <Badge
                  tone={isPending ? 'warning' : 'primary'}
                  className={`shrink-0 border ${
                    isPending
                      ? '!bg-amber-500 !text-white border-amber-600'
                      : isTargetHovered
                      ? '!bg-[var(--primary)] !text-white border-[var(--primary)]'
                      : 'border-[var(--primary-border)]'
                  }`}
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>{slotLabel}</span>
                  <span
                    className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-full ${
                      isPending
                        ? 'bg-amber-700/60 text-white'
                        : isTargetHovered
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--primary)] text-white'
                    }`}
                  >
                    {members.length}
                  </span>
                </Badge>
                <div className="h-px flex-1 bg-[var(--line)]" />
              </div>

              {/* Members inside this time slot */}
              {members.length > 0 ? (
                <div className="space-y-1.5">
                  {members.map((col) => renderBreakCollaboratorCard(col, slot))}
                </div>
              ) : (
                <div className="text-[9px] text-center text-[var(--muted)] py-1.5 italic bg-[var(--surface-2)]/60 rounded-lg border border-dashed border-[var(--line)]">
                  Arraste colaboradores para este horário
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Standardized Single Task Card (No Subtasks)
  const renderTaskSlotDistribution = (task: Task, isSubtask = false) => {
    const taskMembers = task.members
      .map((id) => state.collaborators.find((c) => c.id === id))
      .filter((c): c is Collaborator => Boolean(c) && filteredPeopleIds.has(c.id));

    const pendingCount = taskMembers.filter((m) => !getPersonBreakSlot(m.id)).length;
    const hasPendingBreaks = pendingCount > 0;

    return (
      <div
        key={task.id}
        className={`rounded-xl transition-all shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card)] overflow-hidden break-inside-avoid inline-block w-full align-top mb-3.5 border border-[var(--line)] ${
          isSubtask
            ? 'bg-[var(--surface-2)] hover:border-[var(--primary-border)]'
            : `bg-[var(--surface-2)] hover:border-[var(--primary-border)] ${
                hasPendingBreaks ? 'ring-1 ring-amber-400' : ''
              }`
        }`}
      >
        {/* Activity Header matching AssignmentView standard */}
        <div className="p-3 bg-[var(--primary)] border-b border-[var(--primary-hover)] space-y-2">
          <div className="flex items-start justify-between gap-1.5">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h4 className="text-[15px] font-black text-white truncate" title={task.name}>
                  {task.name}
                </h4>
                {task.priority && (
                  <Badge
                    tone={
                      task.priority === 'alta'
                        ? 'danger'
                        : task.priority === 'media'
                        ? 'warning'
                        : 'neutral'
                    }
                    className="uppercase text-[8px]"
                  >
                    {task.priority}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/70 mt-0.5">
                {isSubtask ? (
                  <span className="flex items-center gap-1 text-white font-black">
                    <CornerDownRight className="w-3 h-3" />
                    <span>Subdivisão Operacional</span>
                  </span>
                ) : (
                  <span>Posto Direto</span>
                )}
                {task.minHeadcount && task.minHeadcount > 0 ? (
                  <span>• Meta: {task.minHeadcount}</span>
                ) : null}
              </div>
            </div>

            {/* Headcount Badge */}
            <Badge
              tone={hasPendingBreaks ? 'warning' : 'primary'}
              className={`shrink-0 border ${
                hasPendingBreaks
                  ? 'border-amber-300 dark:border-amber-800'
                  : 'border-[var(--primary-border)]'
              }`}
              title={hasPendingBreaks ? `${pendingCount} colaborador(es) com intervalo pendente!` : `${taskMembers.length} pessoas`}
            >
              {hasPendingBreaks && <Clock className="w-2.5 h-2.5 shrink-0" />}
              <span>{taskMembers.length} pessoas</span>
              {hasPendingBreaks && (
                <span className="text-[8.5px] bg-amber-700/50 px-1 rounded font-black">
                  ({pendingCount} pend.)
                </span>
              )}
            </Badge>
          </div>
        </div>

        {/* Time Slots Divider & Member Groups Body */}
        <div className="p-2.5 space-y-2">
          {renderTimeSlotGroups(task, taskMembers)}
        </div>
      </div>
    );
  };

  // Hierarchical rendering for a subtask node (recursive, vertical only)
  const renderSubtaskNode = (node: TaskTreeNode, depth: number): React.ReactNode => {
    const { task, children } = node;
    const taskMembers = (task.members || [])
      .map((id) => state.collaborators.find((c) => c.id === id))
      .filter((c): c is Collaborator => Boolean(c) && filteredPeopleIds.has(c.id));
    const hasOwnMembers = taskMembers.length > 0;
    const pendingCount = taskMembers.filter((m) => !getPersonBreakSlot(m.id)).length;
    const hasPending = pendingCount > 0;

    return (
      <div
        key={task.id}
        className={`relative space-y-1.5 ${
          depth > 0 ? 'ml-3 sm:ml-4 pl-2.5 sm:pl-3 border-l-2 border-[var(--primary-border)]/60' : ''
        }`}
      >
        {/* Branch connector line */}
        {depth > 0 && (
          <div className="absolute -left-[6px] sm:-left-[7px] top-[10px] w-3 sm:w-3.5 border-t-2 border-[var(--primary-border)]/60" />
        )}

        {/* Subtask Card Container matching AssignmentView */}
        <div className="bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--primary-border)] rounded-xl p-2.5 space-y-1.5 transition-all shadow-xs hover:shadow-sm">
          {/* Subtask header row */}
          <div className="flex items-center justify-between gap-1.5 border-b border-[var(--line)]/60 pb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <CornerDownRight className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
              <span className="text-xs font-black text-[var(--ink)] truncate" title={task.name}>
                {task.name}
              </span>
              <Badge tone="neutral" className="uppercase text-[8.5px] border border-[var(--line)]">
                Subtarefa
              </Badge>
            </div>

            <Badge
              tone={hasPending ? 'warning' : 'primary'}
              className={`shrink-0 border ${
                hasPending
                  ? 'border-amber-300 dark:border-amber-800'
                  : 'border-[var(--primary-border)]'
              }`}
              title={hasPending ? `${pendingCount} colaborador(es) com intervalo pendente!` : `${taskMembers.length} pessoas`}
            >
              {hasPending && <Clock className="w-2.5 h-2.5" />}
              <span>{taskMembers.length} pessoas</span>
              {hasPending && <span className="text-[8px] bg-amber-700/50 px-1 rounded font-black">({pendingCount} pend.)</span>}
            </Badge>
          </div>

          {/* Time slot breakdown inside this subtask */}
          {hasOwnMembers ? (
            renderTimeSlotGroups(task, taskMembers)
          ) : (
            <div className="p-2 text-center text-[9px] text-[var(--muted)] italic">
              Nenhum colaborador atribuído diretamente a esta subtarefa.
            </div>
          )}
        </div>

        {/* Recursive children */}
        {children.length > 0 && (
          <div className="space-y-2 pt-1">
            {children.map((child) => renderSubtaskNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      <PageHeader
        icon={Clock}
        title="Gestão e Balanceamento de Intervalos"
        subtitle={`Escala de Intervalos • ${
          selectedShifts.length === 1
            ? `Turno ${selectedShifts[0]}`
            : selectedShifts.length > 1
            ? `${selectedShifts.length} Turnos`
            : 'Todos os Turnos'
        }`}
        actions={
          <>
            <Tabs
              items={[
                { value: 'grid', label: 'Visão Geral (Grid)' },
                { value: 'list', label: 'Lista', icon: List },
              ]}
              value={allocationMode}
              onChange={(v) => setAllocationMode(v as 'grid' | 'list')}
            />
            <Button
              variant="outline"
              size="sm"
              icon={Undo2}
              onClick={() => undo()}
              disabled={!canUndo}
              title="Desfazer última alteração (Ctrl+Z)"
            >
              Desfazer
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={RotateCw}
              className="!bg-purple-600 hover:!bg-purple-700 !text-white !border-purple-700 shadow-xs"
              onClick={() => {
                generateRotatingBreaks();
              }}
              title="Aplica a rotação diária de intervalos (+1 slot em relação ao dia anterior)"
            >
              Rotação Diária (+1)
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={RefreshCw}
              onClick={() => {
                if (balancingMode === 'rotation') {
                  generateRotatingBreaks();
                } else {
                  generateBreaks(balancingMode);
                  showNotice(
                    `Intervalos gerados com distribuição aleatória e balanceamento (${balancingMode === 'parent' ? 'Modo Tarefa Pai' : 'Modo por Subtarefas'})!`
                  );
                }
              }}
              title={
                balancingMode === 'rotation'
                  ? 'Aplica rotação cíclica (+1 slot em relação ao dia anterior)'
                  : 'Gera e distribui os colaboradores entre os horários, mantendo o balanceamento rigoroso por posto'
              }
            >
              {balancingMode === 'rotation' ? 'Executar Rotação' : 'Gerar / Balancear'}
            </Button>
          </>
        }
      />

      {/* Horários de Intervalo no Turno */}
      <Card>
        <CardHeader
          icon={<SlidersHorizontal className="w-4.5 h-4.5" />}
          title="Horários de Intervalo no Turno"
          subtitle="Arraste colaboradores diretamente para os cards abaixo ou use o seletor rápido no cartão."
          actions={
            <Badge tone="primary" className="border border-[var(--primary-border)]">
              Equipe Presente: <strong>{presentPeople.length} pessoas</strong>
            </Badge>
          }
        />

        <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
          {activeBreaks.map((b) => {
            const assignedList = (dayIntervals[b.id] || []).filter((id) =>
              presentPeople.some((p) => p.id === id)
            );
            const count = assignedList.length;
            const isHoveredSlot = dragOverTopSlotId === b.id;
            const isCustomShift = Boolean(b.shift && b.shift !== 'Geral');

            return (
              <div
                key={b.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverTopSlotId !== b.id) setDragOverTopSlotId(b.id);
                }}
                onDragLeave={() => setDragOverTopSlotId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  try {
                    const raw = e.dataTransfer.getData('text/plain');
                    if (raw) {
                      const { collaboratorId, fromSlotId } = JSON.parse(raw);
                      if (collaboratorId) {
                        moveBreakInterval(collaboratorId, fromSlotId, b.id);
                        showNotice(`Colaborador movido para o intervalo das ${b.time}!`);
                      }
                    }
                  } catch (err) {
                    // fallback
                  }
                  setDragOverTopSlotId(null);
                  setDraggingCollaboratorId(null);
                }}
                className={`p-3 rounded-xl border border-[var(--line)] flex flex-col justify-between transition-all duration-150 shadow-[var(--shadow-card)] ${
                  isHoveredSlot
                    ? 'border-2 border-dashed border-[var(--primary)] bg-[var(--primary-soft)] scale-[1.02] shadow-md'
                    : 'bg-[var(--bg)]/90 text-[var(--ink)] hover:border-[var(--primary-border)] hover:bg-[var(--paper)] hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between font-black mb-1">
                    <span className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                      <span>{b.time}</span>
                    </span>
                    {isCustomShift ? (
                      <Badge
                        tone="purple"
                        className="gap-0.5 px-1.5 py-0.5 rounded-md text-[8.5px] border border-purple-300 dark:border-purple-800"
                        title={`Configuração personalizada do Turno ${b.shift}`}
                      >
                        <Zap className="w-2.5 h-2.5 text-purple-600 shrink-0" />
                        <span>T{b.shift}</span>
                      </Badge>
                    ) : (
                      <Badge
                        tone="info"
                        className="gap-0.5 px-1.5 py-0.5 rounded-md text-[8.5px] border border-sky-300 dark:border-sky-800"
                        title="Configuração padrão do setor"
                      >
                        <Globe className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                        <span>Geral</span>
                      </Badge>
                    )}
                  </div>
                  <div className="text-lg font-black my-0.5 text-[var(--primary)]">
                    {count}{' '}
                    <span className="text-[10px] font-semibold opacity-75 text-[var(--muted)]">
                      alocado{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {isHoveredSlot ? (
                  <div className="text-[9px] font-black text-[var(--primary)] animate-pulse text-center pt-1 border-t border-[var(--primary-border)]">
                    Solte em {b.time}
                  </div>
                ) : (
                  <div className="text-[9px] text-[var(--muted)] text-center pt-1 border-t border-[var(--line)]/50">
                    Arraste até aqui
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <CardFooter className="flex flex-wrap items-center gap-2.5">
          <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
            Modo de Balanceamento:
          </span>
          <Tabs
            items={[
              { value: 'parent', label: 'Pela Tarefa Pai', icon: FolderTree },
              { value: 'subtasks', label: 'Por Subtarefas', icon: Layers },
              { value: 'rotation', label: 'Rotação Diária (+1)', icon: RotateCw },
            ]}
            value={balancingMode}
            onChange={(v) => setBalancingMode(v as 'parent' | 'subtasks' | 'rotation')}
          />
          <div className="w-px h-5 bg-[var(--line)]" />
          <Button
            variant={showSubtasks ? 'secondary' : 'outline'}
            size="sm"
            icon={showSubtasks ? GitFork : Layers}
            onClick={() => setShowSubtasks(!showSubtasks)}
            title={showSubtasks ? 'Ocultar subdivisões (visão gerencial)' : 'Exibir subdivisões (visão detalhada)'}
          >
            {showSubtasks ? 'Ocultar Subtarefas' : 'Exibir Subtarefas'}
          </Button>
          <Button
            size="sm"
            icon={Megaphone}
            className="!bg-amber-500 hover:!bg-amber-600 !text-white !border-amber-600 shadow-xs"
            onClick={() => {
              const shiftLabel = selectedShifts.length === 1 ? selectedShifts[0] : state.teamShift || 'Geral';
              const breakTimes = activeBreaks.map((b) => b.time).join(', ') || '—';
              broadcastNotice({
                title: `Horários de Intervalo Disponíveis — Turno ${shiftLabel}`,
                message: `Intervalos de hoje: ${breakTimes}. Consulte seu horário na tela Meu Painel.`,
                targetShift: shiftLabel,
                targetShiftAudience: 'atual',
              });
              showNotice(`Aviso de intervalos enviado para o Turno ${shiftLabel}.`);
            }}
            title="Avisar todos do turno sobre os horários de intervalo disponíveis"
          >
            Avisar
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            onClick={() => clearBreaks()}
            title="Limpar escala de intervalos do dia"
          >
            Limpar
          </Button>
        </CardFooter>
      </Card>

      {/* Banner Explicativo do Modo de Rotação Cíclica */}
      {balancingMode === 'rotation' && (
        <div className="bg-purple-500/10 border border-purple-300 dark:border-purple-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <RotateCw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm text-[var(--ink)]">
                  Rotação Cíclica de Intervalos Ativada
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-600 text-white">
                  +1 Slot Diário
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] font-medium mt-1 leading-relaxed">
                Cada colaborador avança <strong>+1 slot</strong> em relação ao horário que realizou no dia anterior:
                <span className="inline-flex items-center gap-1 font-bold text-purple-700 dark:text-purple-300 ml-1">
                  1º Horário ➔ 2º Horário ➔ 3º Horário ➔ 4º Horário ➔ 1º Horário (cíclico).
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:shrink-0">
            <Button
              variant="secondary"
              size="sm"
              icon={Info}
              onClick={() => setShowRotationModal(true)}
              className="border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200"
            >
              Como Funciona / Mapa
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={RotateCw}
              className="!bg-purple-600 hover:!bg-purple-700 !text-white !border-purple-700 shadow-xs"
              onClick={() => {
                generateRotatingBreaks();
              }}
            >
              Aplicar Rotação (+1)
            </Button>
          </div>
        </div>
      )}

      {/* Filtros da Escala */}
      <Card>
        <CardHeader
          icon={<Filter className="w-4.5 h-4.5" />}
          title="Filtros da Escala"
          subtitle="Combine turno, time, cargo, categoria e skill para refinar a escala."
        />
        <div className="mt-3.5">
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

            <div className="flex-1 min-w-[220px] max-w-xs">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Buscar colaborador..."
                className="w-full"
              />
            </div>
          </Toolbar>
        </div>
      </Card>

      {/* MODE 1: HIERARCHICAL GRID ALLOCATION VIEW */}
      {allocationMode === 'grid' && (
        <div className="space-y-4">
          {taskGroups.length === 0 ? (
            <EmptyState
              icon={FolderTree}
              title="Nenhum posto ativo encontrado"
              description="Nenhum posto ou tarefa ativa encontrada com os filtros selecionados."
            />
          ) : (
            <div className="columns-1 md:columns-2 xl:columns-3 gap-3.5 [column-fill:_balance] space-y-0">
              {taskGroups.map((group) => {
                const root = group.rootTask;
                const isCollapsed = Boolean(collapsedParentIds[root.id]);

                // Compute total group members and pending count
                const allGroupTasks = [root, ...group.subtasks];
                const allGroupMemberIds = allGroupTasks.flatMap((t) => t.members || []);
                const groupPresentMembers = allGroupMemberIds
                  .map((id) => state.collaborators.find((c) => c.id === id))
                  .filter((c): c is Collaborator => Boolean(c) && filteredPeopleIds.has(c.id));
                const totalGroupMembers = groupPresentMembers.length;
                const pendingGroupMembers = groupPresentMembers.filter((m) => !getPersonBreakSlot(m.id)).length;
                const hasPendingGroup = pendingGroupMembers > 0;

                // TAREFA COM SUBTAREFAS (ESTRUTURA HIERÁRQUICA)
                if (group.hasSubtasks) {
                  const tree = buildTaskTree(group.allTasks);
                  const rootNode = tree.find((n) => n.task.id === root.id);
                  const rootDirectMembers = (root.members || [])
                    .map((id) => state.collaborators.find((c) => c.id === id))
                    .filter((c): c is Collaborator => Boolean(c) && filteredPeopleIds.has(c.id));
                  const hasRootDirect = rootDirectMembers.length > 0;
                  const directChildren = rootNode ? rootNode.children : [];

                  return (
                    <div
                      key={root.id}
                      className={`bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--primary-border)] rounded-xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card)] overflow-hidden transition-all break-inside-avoid inline-block w-full align-top mb-3.5 ${
                        hasPendingGroup ? 'ring-1 ring-amber-400' : ''
                      }`}
                    >
                      {/* Activity Header (Parent Task) matching AssignmentView */}
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
                                  tone={
                                    root.priority === 'alta'
                                      ? 'danger'
                                      : root.priority === 'media'
                                      ? 'warning'
                                      : 'neutral'
                                  }
                                  className="uppercase text-[8px]"
                                >
                                  {root.priority}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/70 mt-0.5">
                              <span className="flex items-center gap-1 text-white font-black">
                                <GitFork className="w-3 h-3" />
                                <span>{group.subtasks.length} subdivisões</span>
                              </span>
                              {group.minHeadcountTotal > 0 && (
                                <span>• Meta: {group.minHeadcountTotal}</span>
                              )}
                            </div>
                          </div>

                          {/* Headcount Badge & Expand/Collapse Toggle */}
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge
                              tone={hasPendingGroup ? 'warning' : 'primary'}
                              className={`shrink-0 border ${
                                hasPendingGroup
                                  ? 'border-amber-300 dark:border-amber-800'
                                  : 'border-[var(--primary-border)]'
                              }`}
                              title={
                                hasPendingGroup
                                  ? `${pendingGroupMembers} colaborador(es) com intervalo pendente!`
                                  : `Total consolidado da atividade: ${totalGroupMembers} pessoas`
                              }
                            >
                              {hasPendingGroup && <Clock className="w-2.5 h-2.5 shrink-0" />}
                              <span>Total: {totalGroupMembers}</span>
                              {hasPendingGroup && (
                                <span className="text-[8.5px] bg-amber-700/50 px-1 rounded font-black">
                                  ({pendingGroupMembers} pend.)
                                </span>
                              )}
                            </Badge>

                            <Button
                              variant="ghost"
                              size="xs"
                              icon={isCollapsed ? ChevronDown : ChevronUp}
                              onClick={() => toggleParentCollapse(root.id)}
                              className="text-white/80! hover:bg-white/15! hover:text-white!"
                              title={isCollapsed ? 'Expandir subdivisões' : 'Recolher subdivisões'}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Hierarchical Body: Posto Geral/Apoio + Subdivisões em árvore */}
                      {!isCollapsed && (
                        <div className="p-3 space-y-3 animate-in fade-in duration-150">
                          {/* RAIA 1: Atribuição Direta na Tarefa Pai (Posto Geral / Apoio) */}
                          {hasRootDirect && (
                            <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-2.5 space-y-1.5">
                              <div className="flex items-center justify-between text-[10.5px] border-b border-[var(--line)]/60 pb-1">
                                <span className="font-black text-[var(--ink)] flex items-center gap-1">
                                  <CornerDownRight className="w-3 h-3 text-[var(--primary)]" />
                                  <span>Posto Geral / Apoio</span>
                                </span>
                                <Badge tone="neutral">{rootDirectMembers.length} pessoas</Badge>
                              </div>
                              {renderTimeSlotGroups(root, rootDirectMembers)}
                            </div>
                          )}

                          {/* RAIA 2: Subdivisões Operacionais (Subtarefas) */}
                          {directChildren.length > 0 && showSubtasks && (
                            <div className="space-y-2 pt-2.5 border-t-2 border-[var(--primary-border)]">
                              <div className="flex items-center justify-between text-[11px] font-black text-[var(--ink)]">
                                <span className="flex items-center gap-1 text-[var(--primary)]">
                                  <GitFork className="w-3.5 h-3.5" />
                                  <span>Subdivisões Operacionais ({directChildren.length})</span>
                                </span>
                              </div>

                              <div className="space-y-2">
                                {directChildren.map((child) => renderSubtaskNode(child, 0))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                // TAREFA SIMPLES (SEM SUBTAREFAS)
                return renderTaskSlotDistribution(root, false);
              })}
            </div>
          )}
        </div>
      )}

      {/* MODE 2: ORGANIZED LIST ALLOCATION VIEW (2 Columns: Left = Pendentes, Right = Grade em Lista sem cards) */}
      {allocationMode === 'list' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* ========================================================================= */}
          {/* LEFT COLUMN: INTERVALOS PENDENTES (4 cols)                                */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 space-y-3 sticky top-4">
            <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl overflow-hidden shadow-xs">
              {/* Header */}
              <div className="p-3 bg-[var(--primary)] text-white flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="w-4 h-4 shrink-0 text-white/90" />
                  <h3 className="font-extrabold text-sm text-white truncate">
                    Intervalos Pendentes
                  </h3>
                  <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingCollaborators.length}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMemberIds.length === pendingCollaborators.length) {
                        setSelectedMemberIds([]);
                      } else {
                        setSelectedMemberIds(pendingCollaborators.map((c) => c.id));
                      }
                    }}
                    className="p-1 hover:bg-white/10 rounded text-white text-xs font-bold"
                    title={selectedMemberIds.length === pendingCollaborators.length ? 'Desmarcar todos' : 'Selecionar todos pendentes'}
                  >
                    {selectedMemberIds.length === pendingCollaborators.length && pendingCollaborators.length > 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="text-[10.5px]">Todos</span>
                    )}
                  </button>
                </div>
              </div>

              {/* Bulk Quick Assign Bar if selected */}
              {selectedMemberIds.length > 0 && (
                <div className="p-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    {selectedMemberIds.length} selec.:
                  </span>
                  {activeBreaks.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => handleBulkAssignBreak(b.id)}
                      className="px-2 py-0.5 bg-[var(--primary)] text-white rounded text-[10px] font-bold hover:opacity-90 transition-opacity"
                    >
                      {b.time}
                    </button>
                  ))}
                </div>
              )}

              {/* Pending List Body */}
              <div className="p-2 max-h-[calc(100vh-240px)] overflow-y-auto space-y-1.5">
                {pendingCollaborators.length === 0 ? (
                  <div className="py-8 px-3 text-center space-y-1 text-[var(--muted)]">
                    <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500/80 mb-1" />
                    <p className="text-xs font-bold text-[var(--ink)]">Todos com intervalo definido!</p>
                    <p className="text-[11px]">Nenhum colaborador pendente de pausa.</p>
                  </div>
                ) : (
                  pendingCollaborators.map((col) => {
                    const task = state.tasks.find((t) => t.members.includes(col.id));
                    const taskName = task?.name || 'Sem Tarefa';
                    const isSelected = selectedMemberIds.includes(col.id);

                    return (
                      <div
                        key={col.id}
                        onContextMenu={collabMenuOnContext(col.id)}
                        className={`p-2 rounded-lg border flex flex-col gap-1.5 transition-all ${
                          isSelected
                            ? 'bg-amber-500/10 border-amber-500/50'
                            : 'bg-[var(--paper)] border-[var(--line)] hover:border-[var(--primary-border)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(col.id)}
                              className="rounded border-[var(--line)] cursor-pointer"
                            />
                            <Avatar src={col.photoUrl} name={col.name} size="xs" />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-[var(--ink)] truncate block" title={col.name}>
                                {col.name}
                              </span>
                              <div className="flex items-center gap-1 text-[9.5px] text-[var(--muted)]">
                                <span>{col.shift}</span>
                                <span>•</span>
                                <span className="truncate max-w-[90px] font-medium text-[var(--primary)]">{taskName}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Quick 1-click slot buttons */}
                        <div className="flex items-center gap-1 overflow-x-auto pt-1 border-t border-[var(--line)]/40">
                          {activeBreaks.map((b) => (
                            <button
                              key={b.id}
                              type="button"
                              onClick={() => {
                                moveBreakInterval(col.id, null, b.id);
                                showNotice(`"${col.name}" atribuído para ${b.time}.`);
                              }}
                              className="px-2 py-0.5 bg-[var(--surface-1)] hover:bg-[var(--primary)] hover:text-white text-[var(--ink)] text-[10px] font-bold rounded border border-[var(--line)] transition-colors shrink-0"
                              title={`Definir ${b.time}`}
                            >
                              {b.time}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: HORÁRIOS EM LISTA LINEAR (8 cols, sem cards)                */}
          {/* ========================================================================= */}
          <div className="lg:col-span-8 space-y-3">
            <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-2 flex-wrap">
                <Clock className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-sm font-extrabold text-[var(--ink)]">
                  Grade de Horários de Intervalo
                </h3>
                <Badge tone="primary">
                  {activeBreaks.length} Horários
                </Badge>
                <Badge tone="neutral">
                  {presentPeople.length - pendingCollaborators.length} Definidos
                </Badge>
              </div>
            </div>

            {activeBreaks.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Nenhum horário configurado"
                description="Configure os horários de intervalo nas Configurações da Equipe."
              />
            ) : (
              <div className="space-y-2.5">
                {activeBreaks.map((b) => {
                  const memberIds = dayIntervals[b.id] || [];
                  const members = memberIds
                    .map((mId) => state.collaborators.find((c) => c.id === mId))
                    .filter((c): c is Collaborator => Boolean(c) && filteredPeopleIds.has(c.id));

                  return (
                    <div
                      key={b.id}
                      className="bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--primary-border)] rounded-xl overflow-hidden shadow-2xs transition-colors"
                    >
                      {/* Linear Strip Header */}
                      <div className="px-3.5 py-2.5 bg-[var(--surface-1)] border-b border-[var(--line)] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" />
                          <h4 className="text-sm font-black text-[var(--ink)]">
                            {b.time}
                          </h4>
                          {b.name && (
                            <span className="text-[11px] text-[var(--muted)] font-medium">
                              ({b.name})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-bold text-[var(--ink)] bg-[var(--paper)] px-2 py-0.5 rounded border border-[var(--line)]">
                            {members.length} colaboradores
                          </span>
                          {members.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                members.forEach((m) => moveBreakInterval(m.id, b.id, null));
                                showNotice(`Todos os colaboradores desvinculados do horário ${b.time}.`);
                              }}
                              className="p-1 text-[var(--muted)] hover:text-red-600 hover:bg-red-500/10 rounded transition-colors"
                              title="Limpar todos deste horário (mover para pendentes)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Members List */}
                      <div className="p-2">
                        {members.length === 0 ? (
                          <p className="text-xs text-[var(--muted)] italic py-2 text-center">
                            Nenhum colaborador atribuído a este horário.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                            {members.map((col) => {
                              const task = state.tasks.find((t) => t.members.includes(col.id));
                              const taskName = task?.name || 'Sem Tarefa';

                              return (
                                <div
                                  key={col.id}
                                  onContextMenu={collabMenuOnContext(col.id)}
                                  className="p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg flex items-center justify-between gap-2 hover:border-[var(--primary-border)] transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Avatar src={col.photoUrl} name={col.name} size="xs" />
                                    <div className="min-w-0">
                                      <span className="text-xs font-bold text-[var(--ink)] truncate block" title={col.name}>
                                        {col.name}
                                      </span>
                                      <div className="flex items-center gap-1 text-[9.5px] text-[var(--muted)]">
                                        <span>{col.shift}</span>
                                        <span>•</span>
                                        <span className="truncate max-w-[100px] text-[var(--primary)] font-medium">{taskName}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    {/* Quick change slot selector */}
                                    <select
                                      value={b.id}
                                      onChange={(e) => {
                                        const newSlotId = e.target.value;
                                        moveBreakInterval(col.id, b.id, newSlotId || null);
                                        const newBreak = state.breaks.find((x) => x.id === newSlotId);
                                        showNotice(`"${col.name}" movido para ${newBreak?.time || 'Pendentes'}.`);
                                      }}
                                      className="text-[10px] font-bold bg-[var(--surface-1)] border border-[var(--line)] rounded px-1 py-0.5 text-[var(--ink)] cursor-pointer"
                                    >
                                      {activeBreaks.map((opt) => (
                                        <option key={opt.id} value={opt.id}>
                                          {opt.time}
                                        </option>
                                      ))}
                                      <option value="">Pendente</option>
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        moveBreakInterval(col.id, b.id, null);
                                        showNotice(`"${col.name}" movido para intervalos pendentes.`);
                                      }}
                                      className="p-1 text-[var(--muted)] hover:text-red-600 hover:bg-red-500/10 rounded transition-colors"
                                      title="Desvincular (Pendente)"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
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
      )}

      {/* Modal / Painel Informativo de Rotação de Intervalos */}
      {showRotationModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-purple-700 to-indigo-700 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <RotateCw className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white leading-tight">
                    Rotação Contínua de Intervalos
                  </h3>
                  <p className="text-xs text-white/80 font-medium">
                    Regra de progressão diária (+1 slot cíclico)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRotationModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
              {/* Diagram */}
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs uppercase tracking-wider text-[var(--ink)]">
                    Fluxo Cíclico dos Horários
                  </span>
                  <Badge tone="purple" className="font-black text-[10px]">
                    {activeBreaks.length} Horários Configurados
                  </Badge>
                </div>

                <div className="flex items-center justify-center gap-2 flex-wrap py-2">
                  {activeBreaks.map((b, idx) => (
                    <React.Fragment key={b.id}>
                      <div className="px-3 py-2 bg-[var(--paper)] border border-purple-300 dark:border-purple-800 rounded-xl flex flex-col items-center shadow-xs">
                        <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase">
                          {idx + 1}º Slot
                        </span>
                        <span className="text-xs font-black text-[var(--ink)]">{b.time}</span>
                      </div>
                      {idx < activeBreaks.length - 1 ? (
                        <span className="text-purple-500 font-black text-sm">➔</span>
                      ) : (
                        <span className="text-purple-500 font-black text-xs px-1 bg-purple-100 dark:bg-purple-950/70 rounded-md">
                          ↺ volta ao 1º
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>

                <p className="text-[11.5px] text-[var(--muted)] leading-relaxed">
                  <strong>Como funciona:</strong> Ao clicar em <em>Aplicar Rotação (+1)</em>, o sistema consulta a escala do dia anterior. Se um colaborador fez o 2º intervalo ontem, hoje ele receberá automaticamente o 3º intervalo. Ao atingir o último horário, ele retorna ciclicamente para o 1º horário.
                </p>
              </div>

              {/* Status dos Colaboradores */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs uppercase tracking-wider text-[var(--ink)]">
                    Status da Rotação Atual ({presentPeople.length} presentes)
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto border border-[var(--line)] rounded-xl divide-y divide-[var(--line)] bg-[var(--bg)]">
                  {presentPeople.length === 0 ? (
                    <div className="p-4 text-center text-[var(--muted)]">
                      Nenhum colaborador presente no dia selecionado.
                    </div>
                  ) : (
                    presentPeople.map((p) => {
                      const currentSlot = getPersonBreakSlot(p.id);
                      const rotInfo = breakRotationMap ? breakRotationMap[p.id] : null;

                      return (
                        <div key={p.id} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <span className="font-black text-[var(--ink)] block truncate">
                              {p.name}
                            </span>
                            <span className="text-[10px] text-[var(--muted)]">
                              Turno {p.shift || 'Geral'} • Turma {p.scale || 'A'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {rotInfo?.prevSlotTime && (
                              <span className="text-[10.5px] text-[var(--muted)] line-through">
                                {rotInfo.prevSlotTime}
                              </span>
                            )}
                            {currentSlot ? (
                              <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-800 rounded-lg font-black text-[11px] flex items-center gap-1">
                                <Clock className="w-3 h-3 text-purple-600" />
                                {currentSlot.time}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 rounded-md font-bold text-[10px]">
                                Pendente
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-[var(--bg)] border-t border-[var(--line)] flex items-center justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowRotationModal(false)}>
                Fechar
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={RotateCw}
                className="!bg-purple-600 hover:!bg-purple-700 !text-white !border-purple-700 shadow-xs"
                onClick={() => {
                  generateRotatingBreaks();
                  setShowRotationModal(false);
                }}
              >
                Aplicar Rotação (+1 Slot)
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};