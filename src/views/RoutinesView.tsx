import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckSquare,
  Square,
  Plus,
  Clock,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ListTodo,
  Kanban,
  CalendarDays,
  Repeat,
  User,
  Users,
  Tag,
  ExternalLink,
  Check,
  X,
  Layers,
  ArrowRight,
  Calendar as CalendarIcon,
  Filter,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ScheduledTask,
  ScheduledTaskList,
  ScheduledTaskPriority,
  ScheduledTaskStatus,
  RoutineRecurrenceType,
  ScheduledTaskSubtask,
} from '../types';
import {
  formatRecurrenceLabel,
  formatDueBadge,
  getTaskProgress,
  isTaskDueOnDate,
  DEFAULT_TASK_LISTS,
} from '../utils/routineHelpers';
import { getTodayISO, formatDateBR, abbreviateName } from '../utils/helpers';
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  StatCard,
  Badge,
  BadgeTone,
  Button,
  Tabs,
  Toolbar,
  Modal,
  Field,
  Input,
  Select,
  Textarea,
  EmptyState,
  SingleSelectFilter,
} from '../components/ui';
import { SearchInput } from '../components/SearchInput';

export const RoutinesView: React.FC = () => {
  const {
    state,
    addScheduledTask,
    updateScheduledTask,
    deleteScheduledTask,
    toggleScheduledTaskComplete,
    toggleScheduledSubtaskComplete,
    addScheduledTaskList,
    identifiedUser,
    showNotice,
  } = useApp();

  // Active view mode: 'list' (Google Tasks style), 'board' (Kanban), 'routines' (Recurrences overview), 'calendar' (Mini calendar), 'feed' (Acompanhamento)
  const [viewMode, setViewMode] = useState<'list' | 'board' | 'routines' | 'calendar' | 'feed'>('list');

  // Selected List Tab
  const [activeListId, setActiveListId] = useState<string>('all');

  // Selected Performer for task execution
  const [selectedPerformerId, setSelectedPerformerId] = useState<string>(
    identifiedUser?.id || (state.collaborators && state.collaborators[0]?.id) || ''
  );

  const selectedPerformer = useMemo(() => {
    const found = state.collaborators?.find((c) => c.id === selectedPerformerId);
    if (found) return { id: found.id, name: found.name };
    if (identifiedUser) return { id: identifiedUser.id, name: identifiedUser.name };
    return { id: 'operador', name: 'Operador' };
  }, [state.collaborators, selectedPerformerId, identifiedUser]);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [onlyMyTasks, setOnlyMyTasks] = useState<boolean>(false);
  const [onlyOverdueOrToday, setOnlyOverdueOrToday] = useState<boolean>(false);

  // Expanded subtasks in list view
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});

  // Quick inline add task state
  const [quickTitle, setQuickTitle] = useState<string>('');
  const [quickDate, setQuickDate] = useState<string>(getTodayISO());
  const [quickPriority, setQuickPriority] = useState<ScheduledTaskPriority>('media');

  // Modal State for Task Details & Creation
  const [isTaskModalOpen, setIsTaskModalOpen] = useState<boolean>(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);

  // Modal State for New List
  const [isListModalOpen, setIsListModalOpen] = useState<boolean>(false);
  const [newListName, setNewListName] = useState<string>('');
  const [newListColor, setNewListColor] = useState<string>('#6366f1');

  // Calendar mini view state
  const [calendarMonth, setCalendarMonth] = useState<number>(() => new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState<number>(() => new Date().getFullYear());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(getTodayISO());

  // Feed Filters
  const [feedFilterCollaborator, setFeedFilterCollaborator] = useState<string>('all');
  const [feedFilterType, setFeedFilterType] = useState<string>('all');

  const tasks: ScheduledTask[] = useMemo(() => state.scheduledTasks || [], [state.scheduledTasks]);
  const lists: ScheduledTaskList[] = useMemo(() => {
    return state.scheduledTaskLists && state.scheduledTaskLists.length > 0
      ? state.scheduledTaskLists
      : DEFAULT_TASK_LISTS;
  }, [state.scheduledTaskLists]);

  const listMap = useMemo(() => {
    const map = new Map<string, ScheduledTaskList>();
    lists.forEach((l) => map.set(l.id, l));
    return map;
  }, [lists]);

  // Activity Feed of completions (Who & When)
  const completionFeed = useMemo(() => {
    const feed: Array<{
      id: string;
      taskId: string;
      taskTitle: string;
      subtaskTitle?: string;
      isSubtask: boolean;
      completedAt: string;
      completedBy?: string;
      completedByName: string;
      listName?: string;
      listColor?: string;
      category?: string;
      priority: ScheduledTaskPriority;
      task: ScheduledTask;
    }> = [];

    tasks.forEach((t) => {
      const list = listMap.get(t.listId);
      if (t.status === 'concluida') {
        feed.push({
          id: `task_${t.id}_${t.completedAt || 'done'}`,
          taskId: t.id,
          taskTitle: t.title,
          isSubtask: false,
          completedAt: t.completedAt || new Date().toISOString(),
          completedBy: t.completedBy,
          completedByName: t.completedByName || 'Operador',
          listName: list?.name,
          listColor: list?.color,
          category: t.category,
          priority: t.priority,
          task: t,
        });
      }
      (t.subtasks || []).forEach((s) => {
        if (s.completed) {
          feed.push({
            id: `sub_${t.id}_${s.id}_${s.completedAt || 'done'}`,
            taskId: t.id,
            taskTitle: t.title,
            subtaskTitle: s.title,
            isSubtask: true,
            completedAt: s.completedAt || new Date().toISOString(),
            completedBy: s.completedBy,
            completedByName: s.completedByName || 'Operador',
            listName: list?.name,
            listColor: list?.color,
            category: t.category,
            priority: t.priority,
            task: t,
          });
        }
      });
    });

    return feed.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }, [tasks, listMap]);

  // Filtered completions feed
  const filteredFeed = useMemo(() => {
    return completionFeed.filter((item) => {
      if (feedFilterCollaborator !== 'all') {
        const matchesId = item.completedBy === feedFilterCollaborator;
        const matchesName = item.completedByName === feedFilterCollaborator;
        if (!matchesId && !matchesName) return false;
      }
      if (feedFilterType === 'task' && item.isSubtask) return false;
      if (feedFilterType === 'subtask' && !item.isSubtask) return false;
      if (activeListId !== 'all' && item.task.listId !== activeListId) return false;
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = item.taskTitle.toLowerCase().includes(query);
        const matchesSub = item.subtaskTitle?.toLowerCase().includes(query);
        const matchesName = item.completedByName.toLowerCase().includes(query);
        const matchesList = item.listName?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesSub && !matchesName && !matchesList) return false;
      }
      return true;
    });
  }, [completionFeed, feedFilterCollaborator, feedFilterType, activeListId, searchTerm]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    const todayStr = getTodayISO();
    return tasks.filter((task) => {
      // List filter
      if (activeListId !== 'all' && task.listId !== activeListId) {
        return false;
      }

      // My tasks filter (logged in user)
      if (onlyMyTasks) {
        if (!identifiedUser) return false;
        const isAssigned =
          task.assignedTo &&
          (task.assignedTo.includes(identifiedUser.id) ||
            task.assignedTo.includes('all') ||
            (identifiedUser.role && task.assignedRole === identifiedUser.role));
        if (!isAssigned) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending') {
          if (task.status === 'concluida' || task.status === 'cancelada') return false;
        } else if (task.status !== statusFilter) {
          return false;
        }
      }

      // Priority filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }

      // Shift filter
      if (shiftFilter !== 'all' && task.assignedShift && task.assignedShift !== shiftFilter) {
        return false;
      }

      // Only overdue or today
      if (onlyOverdueOrToday) {
        if (!task.dueDate) return false;
        if (task.dueDate > todayStr && task.status !== 'concluida') return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(query);
        const matchDesc = task.description ? task.description.toLowerCase().includes(query) : false;
        const matchCategory = task.category ? task.category.toLowerCase().includes(query) : false;
        const matchTags = (task.tags || []).some((t) => t.toLowerCase().includes(query));
        const matchSubtasks = (task.subtasks || []).some((s) => s.title.toLowerCase().includes(query));
        if (!matchTitle && !matchDesc && !matchCategory && !matchTags && !matchSubtasks) return false;
      }

      return true;
    });
  }, [tasks, activeListId, onlyMyTasks, identifiedUser, statusFilter, priorityFilter, shiftFilter, onlyOverdueOrToday, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const todayStr = getTodayISO();
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'concluida').length;
    const pending = tasks.filter((t) => t.status !== 'concluida' && t.status !== 'cancelada').length;
    const overdue = tasks.filter((t) => t.status !== 'concluida' && t.dueDate && t.dueDate < todayStr).length;
    const dueToday = tasks.filter((t) => t.status !== 'concluida' && t.dueDate === todayStr).length;
    const routines = tasks.filter((t) => t.recurrence && t.recurrence.type !== 'none').length;

    return { total, completed, pending, overdue, dueToday, routines };
  }, [tasks]);

  // Toggle Subtask Expand
  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // Quick Add Task Handler
  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    addScheduledTask({
      title: quickTitle.trim(),
      listId: activeListId !== 'all' ? activeListId : 'default',
      priority: quickPriority,
      status: 'a_fazer',
      dueDate: quickDate || getTodayISO(),
      subtasks: [],
      assignedTo: identifiedUser ? [identifiedUser.id] : [],
    });

    setQuickTitle('');
    showNotice('Tarefa adicionada à lista!');
  };

  // Open task editor modal
  const openNewTaskModal = (initialDate?: string) => {
    setEditingTask({
      id: '',
      title: '',
      description: '',
      listId: activeListId !== 'all' ? activeListId : 'default',
      category: 'Rotina de Turno',
      priority: 'media',
      status: 'a_fazer',
      dueDate: initialDate || getTodayISO(),
      dueTime: '08:00',
      assignedTo: identifiedUser ? [identifiedUser.id] : [],
      subtasks: [],
      recurrence: { type: 'none' },
      createdAt: new Date().toISOString(),
    });
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: ScheduledTask) => {
    setEditingTask({ ...task });
    setIsTaskModalOpen(true);
  };

  // Save Task from Modal
  const handleSaveModalTask = () => {
    if (!editingTask) return;
    if (!editingTask.title.trim()) {
      showNotice('O título da tarefa é obrigatório.');
      return;
    }

    if (editingTask.id) {
      updateScheduledTask(editingTask.id, editingTask);
      showNotice(`Tarefa "${editingTask.title}" atualizada.`);
    } else {
      addScheduledTask(editingTask);
      showNotice(`Tarefa "${editingTask.title}" criada.`);
    }
    setIsTaskModalOpen(false);
    setEditingTask(null);
  };

  // Create List
  const handleCreateList = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    const created = addScheduledTaskList({
      name: newListName.trim(),
      color: newListColor,
    });
    setActiveListId(created.id);
    setNewListName('');
    setIsListModalOpen(false);
    showNotice(`Lista "${created.name}" criada.`);
  };

  // View Mode Tabs
  const viewModeTabs = [
    { value: 'list', label: 'Lista' },
    { value: 'board', label: 'Quadro' },
    { value: 'routines', label: 'Rotinas' },
    { value: 'calendar', label: 'Calendário' },
    { value: 'feed', label: 'Acompanhamento (Quem & Quando)' },
  ];

  // List Selection Tabs
  const listTabs = [
    { value: 'all', label: `Todas (${tasks.length})` },
    ...lists.map((l) => ({
      value: l.id,
      label: `${l.name} (${tasks.filter((t) => t.listId === l.id).length})`,
    })),
  ];

  // Filter Select Options
  const statusOptions = [
    { value: 'all', label: 'Todos os Status' },
    { value: 'pending', label: 'Pendentes (Não Concluídas)' },
    { value: 'a_fazer', label: 'A Fazer' },
    { value: 'em_andamento', label: 'Em Andamento' },
    { value: 'aguardando', label: 'Aguardando' },
    { value: 'concluida', label: 'Concluídas' },
  ];

  const priorityOptions = [
    { value: 'all', label: 'Todas as Prioridades' },
    { value: 'urgente', label: 'Urgente', badge: '🚨' },
    { value: 'alta', label: 'Alta', badge: '🔥' },
    { value: 'media', label: 'Média', badge: '⚡' },
    { value: 'baixa', label: 'Baixa', badge: '🟢' },
  ];

  const shiftOptions = [
    { value: 'all', label: 'Todos os Turnos' },
    ...(state.shifts || ['T1', 'T2', 'T3', 'T4', 'T5']).map((s) => ({
      value: s,
      label: `Turno ${s}`,
    })),
  ];

  const hasActiveFilters =
    searchTerm ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    shiftFilter !== 'all' ||
    onlyMyTasks ||
    onlyOverdueOrToday;

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setShiftFilter('all');
    setOnlyMyTasks(false);
    setOnlyOverdueOrToday(false);
  };

  const getPriorityTone = (priority: ScheduledTaskPriority): BadgeTone => {
    switch (priority) {
      case 'urgente':
        return 'danger';
      case 'alta':
        return 'warning';
      case 'media':
        return 'info';
      case 'baixa':
      default:
        return 'neutral';
    }
  };

  const getStatusTone = (status: ScheduledTaskStatus): BadgeTone => {
    switch (status) {
      case 'concluida':
        return 'success';
      case 'em_andamento':
        return 'info';
      case 'aguardando':
        return 'warning';
      case 'cancelada':
        return 'danger';
      case 'a_fazer':
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ListTodo}
        title="Programação & Rotinas"
        subtitle="Agendamento, rotinas operacionais recorrentes, subtarefas e acompanhamento em tempo real"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={FolderPlus}
              onClick={() => setIsListModalOpen(true)}
            >
              Nova Lista
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => openNewTaskModal()}
            >
              Nova Tarefa
            </Button>
          </div>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total de Tarefas" value={stats.total} icon={ListTodo} tone="default" />
        <StatCard label="Para Hoje" value={stats.dueToday} icon={CalendarIcon} tone="warning" />
        <StatCard label="Atrasadas" value={stats.overdue} icon={AlertCircle} tone="danger" />
        <StatCard label="Pendentes" value={stats.pending} icon={Clock} tone="info" />
        <StatCard label="Concluídas" value={stats.completed} icon={CheckCircle2} tone="success" />
        <StatCard label="Rotinas Ativas" value={stats.routines} icon={Repeat} tone="purple" />
      </div>

      {/* Filter and Mode Control Card */}
      <Card>
        <CardHeader
          icon={<Filter className="w-4.5 h-4.5" />}
          title="Filtros e Visualização"
          subtitle="Selecione a lista operacional e alterne entre visualização em Lista, Kanban, Rotinas ou Calendário."
          actions={
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" icon={X} onClick={clearAllFilters}>
                  Limpar Filtros
                </Button>
              )}
            </div>
          }
        />

        <div className="mt-3.5 space-y-3.5">
          {/* Top Control Line: List Tabs and View Mode Switcher */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
            <div className="overflow-x-auto max-w-full pb-1">
              <Tabs
                items={listTabs}
                value={activeListId}
                onChange={setActiveListId}
                className="shrink-0"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {identifiedUser && (
                <Button
                  variant={onlyMyTasks ? 'primary' : 'outline'}
                  size="sm"
                  icon={User}
                  onClick={() => setOnlyMyTasks(!onlyMyTasks)}
                >
                  Minhas Tarefas
                </Button>
              )}
              <Tabs
                items={viewModeTabs}
                value={viewMode}
                onChange={(v) => setViewMode(v as any)}
              />
            </div>
          </div>

          {/* Standardized Toolbar with SingleSelectFilters & SearchInput */}
          <Toolbar>
            {/* Executing As / Performer Selector */}
            <div className="flex items-center gap-2 bg-[var(--surface-2)] px-2.5 py-1 rounded-xl border border-[var(--line)]">
              <div className="flex items-center gap-1 text-[11px] font-bold text-[var(--muted)]">
                <User className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span className="hidden sm:inline">Executando como:</span>
              </div>
              <select
                value={selectedPerformerId}
                onChange={(e) => setSelectedPerformerId(e.target.value)}
                className="bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-bold text-[var(--ink)] px-2 py-1 cursor-pointer focus:outline-none focus:border-[var(--primary)] max-w-[160px] truncate"
                title="Selecione quem está marcando e executando as rotinas para registrar o acompanhamento"
              >
                {identifiedUser && (
                  <option value={identifiedUser.id}>
                    {identifiedUser.name} (Meu Usuário)
                  </option>
                )}
                {(state.collaborators || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.role ? `• ${c.role}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <SingleSelectFilter
              label="Status"
              options={statusOptions}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v || 'all')}
              allLabel="Todos os Status"
              icon={<CheckSquare className="w-3 h-3 text-[var(--primary)]" />}
              className="flex-1 min-w-[140px]"
            />

            <SingleSelectFilter
              label="Prioridade"
              options={priorityOptions}
              value={priorityFilter}
              onChange={(v) => setPriorityFilter(v || 'all')}
              allLabel="Todas as Prioridades"
              icon={<SlidersHorizontal className="w-3 h-3 text-[var(--primary)]" />}
              className="flex-1 min-w-[140px]"
            />

            <SingleSelectFilter
              label="Turno"
              options={shiftOptions}
              value={shiftFilter}
              onChange={(v) => setShiftFilter(v || 'all')}
              allLabel="Todos os Turnos"
              icon={<Users className="w-3 h-3 text-[var(--primary)]" />}
              className="flex-1 min-w-[130px]"
            />

            <div className="flex-1 min-w-[200px] max-w-sm">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Pesquisar tarefas, tags, rotinas..."
                className="w-full"
              />
            </div>
          </Toolbar>
        </div>
      </Card>

      {/* VIEW 1: GOOGLE TASKS STYLE (LIST VIEW) */}
      {viewMode === 'list' && (
        <Card padded={false}>
          <div className="p-4 sm:p-5 border-b border-[var(--line)]">
            {/* Quick Add Bar */}
            <form onSubmit={handleQuickAdd} className="flex items-center gap-2.5">
              <div className="flex-1">
                <Input
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  placeholder="Adicionar nova tarefa rápida... (pressione Enter para salvar)"
                />
              </div>

              <div className="w-36 hidden sm:block">
                <Input
                  type="date"
                  value={quickDate}
                  onChange={(e) => setQuickDate(e.target.value)}
                  title="Data de vencimento"
                />
              </div>

              <div className="w-32 hidden sm:block">
                <Select
                  value={quickPriority}
                  onChange={(e) => setQuickPriority(e.target.value as ScheduledTaskPriority)}
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </Select>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={Plus}
                disabled={!quickTitle.trim()}
              >
                Adicionar
              </Button>
            </form>
          </div>

          <div className="divide-y divide-[var(--line)]">
            {filteredTasks.length === 0 ? (
              <EmptyState
                icon={CheckSquare}
                title="Nenhuma tarefa encontrada"
                description={
                  hasActiveFilters
                    ? 'Tente ajustar ou limpar os filtros para encontrar as tarefas.'
                    : 'Nenhuma tarefa agendada nesta lista. Use o campo acima para adicionar uma nova tarefa.'
                }
                actionLabel={hasActiveFilters ? 'Limpar Filtros' : undefined}
                onAction={hasActiveFilters ? clearAllFilters : undefined}
              />
            ) : (
              filteredTasks.map((task) => {
                const isCompleted = task.status === 'concluida';
                const isOverdue = task.dueDate && task.dueDate < getTodayISO() && !isCompleted;
                const isDueToday = task.dueDate === getTodayISO() && !isCompleted;
                const progress = getTaskProgress(task);
                const isExpanded = expandedTaskIds[task.id];
                const list = listMap.get(task.listId);

                return (
                  <div
                    key={task.id}
                    className={`p-4 transition-colors hover:bg-[var(--bg)]/50 ${
                      isCompleted ? 'opacity-60 bg-[var(--bg)]/30' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left: Checkbox & Title */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleScheduledTaskComplete(task.id, undefined, selectedPerformer)}
                          className="mt-0.5 text-[var(--muted)] hover:text-[var(--primary)] transition-colors cursor-pointer shrink-0"
                          title={isCompleted ? 'Marcar como não concluída' : `Marcar como concluída por ${selectedPerformer.name}`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5 hover:border-[var(--primary)]" />
                          )}
                        </button>

                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-extrabold cursor-pointer ${
                                isCompleted ? 'line-through text-[var(--muted)]' : 'text-[var(--ink)]'
                              }`}
                              onClick={() => openEditTaskModal(task)}
                            >
                              {task.title}
                            </span>

                            <Badge tone={getPriorityTone(task.priority)} className="text-[10px] py-0 px-1.5">
                              {task.priority.toUpperCase()}
                            </Badge>

                            {list && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md border text-[var(--ink)]"
                                style={{
                                  borderColor: list.color || 'var(--line)',
                                  backgroundColor: 'var(--surface-2)',
                                }}
                              >
                                {list.name}
                              </span>
                            )}

                            {task.recurrence && task.recurrence.type !== 'none' && (
                              <Badge tone="purple" className="text-[10px] py-0 px-1.5">
                                🔄 {formatRecurrenceLabel(task.recurrence)}
                              </Badge>
                            )}

                            {isOverdue && (
                              <Badge tone="danger" className="text-[10px] py-0 px-1.5">
                                Atrasada
                              </Badge>
                            )}

                            {isDueToday && (
                              <Badge tone="warning" className="text-[10px] py-0 px-1.5">
                                Vence Hoje
                              </Badge>
                            )}
                          </div>

                          {/* Completion Tracker Badge */}
                          {isCompleted && (
                            <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                Concluído por <strong className="underline">{task.completedByName || 'Operador'}</strong>
                                {task.completedAt ? ` às ${new Date(task.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                                {task.completedAt && task.completedAt.split('T')[0] !== getTodayISO() ? ` em ${formatDateBR(task.completedAt.split('T')[0])}` : ''}
                              </span>
                            </div>
                          )}

                          {task.description && (
                            <p className="text-xs text-[var(--muted)] font-medium line-clamp-2">
                              {task.description}
                            </p>
                          )}

                          {/* Task Metadata Row */}
                          <div className="flex items-center gap-3 text-[11px] text-[var(--muted)] font-medium flex-wrap pt-0.5">
                            {task.dueDate && (
                              <span className="flex items-center gap-1">
                                <CalendarIcon className="w-3 h-3 text-[var(--primary)]" />
                                <span>{formatDateBR(task.dueDate)}</span>
                                {task.dueTime && <span>às {task.dueTime}</span>}
                              </span>
                            )}

                            {task.assignedShift && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                <span>Turno {task.assignedShift}</span>
                              </span>
                            )}

                            {(task.assignedTo || []).length > 0 && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>
                                  {task.assignedTo
                                    .map((id) => {
                                      const c = state.collaborators.find((col) => col.id === id);
                                      return c ? abbreviateName(c.name) : id;
                                    })
                                    .join(', ')}
                                </span>
                              </span>
                            )}

                            {task.externalUrl && (
                              <a
                                href={task.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[var(--primary)] hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Link</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Subtasks Toggle & Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(task.subtasks || []).length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(task.id)}
                            icon={isExpanded ? ChevronDown : ChevronRight}
                            className="text-xs"
                          >
                            Checklist ({progress.completed}/{progress.total})
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit2}
                          onClick={() => openEditTaskModal(task)}
                          aria-label="Editar"
                        />

                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={() => {
                            if (window.confirm(`Deseja excluir a tarefa "${task.title}"?`)) {
                              deleteScheduledTask(task.id);
                              showNotice('Tarefa excluída.');
                            }
                          }}
                          className="hover:text-rose-600"
                          aria-label="Excluir"
                        />
                      </div>
                    </div>

                    {/* Expandable Subtasks Checklist */}
                    {isExpanded && (task.subtasks || []).length > 0 && (
                      <div className="mt-3 pl-8 space-y-1.5 pt-2 border-t border-[var(--line)]/50">
                        {task.subtasks.map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between gap-2 text-xs py-1 text-[var(--ink)]"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => toggleScheduledSubtaskComplete(task.id, sub.id, undefined, selectedPerformer)}
                                className="cursor-pointer text-[var(--muted)] hover:text-[var(--primary)] shrink-0"
                                title={sub.completed ? 'Desmarcar etapa' : `Marcar etapa por ${selectedPerformer.name}`}
                              >
                                {sub.completed ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                              <span
                                className={
                                  sub.completed ? 'line-through text-[var(--muted)] truncate' : 'font-medium truncate'
                                }
                              >
                                {sub.title}
                              </span>
                            </div>
                            {sub.completed && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                ✓ {sub.completedByName || 'Operador'} {sub.completedAt ? `às ${new Date(sub.completedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}

      {/* VIEW 2: KANBAN BOARD */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { status: 'a_fazer' as ScheduledTaskStatus, title: 'A Fazer', tone: 'default' },
            { status: 'em_andamento' as ScheduledTaskStatus, title: 'Em Andamento', tone: 'info' },
            { status: 'aguardando' as ScheduledTaskStatus, title: 'Aguardando', tone: 'warning' },
            { status: 'concluida' as ScheduledTaskStatus, title: 'Concluídas', tone: 'success' },
          ].map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.status);
            return (
              <div
                key={col.status}
                className="bg-[var(--surface-2)] border border-[var(--line)] rounded-2xl p-3.5 space-y-3 flex flex-col min-h-[400px]"
              >
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)]" />
                    <h4 className="text-xs font-black text-[var(--ink)] uppercase tracking-wide">
                      {col.title}
                    </h4>
                  </div>
                  <Badge tone={col.tone as any} className="text-[10px]">
                    {colTasks.length}
                  </Badge>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colTasks.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[var(--muted)] italic">
                      Nenhuma tarefa nesta coluna
                    </div>
                  ) : (
                    colTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => openEditTaskModal(t)}
                        className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3 shadow-2xs hover:border-[var(--primary-border)] hover:shadow-xs transition-all cursor-pointer space-y-2"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="text-xs font-bold text-[var(--ink)] leading-snug">
                            {t.title}
                          </span>
                          <Badge tone={getPriorityTone(t.priority)} className="text-[9px] py-0 px-1 shrink-0">
                            {t.priority}
                          </Badge>
                        </div>

                        {t.description && (
                          <p className="text-[11px] text-[var(--muted)] line-clamp-2">
                            {t.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] text-[var(--muted)] font-medium pt-1 border-t border-[var(--line)]">
                          <span>{t.dueDate ? formatDateBR(t.dueDate) : 'Sem data'}</span>
                          {t.recurrence && t.recurrence.type !== 'none' && (
                            <span className="text-[var(--primary)] font-bold">🔄 Recorrente</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: ROUTINES & RECURRENCES */}
      {viewMode === 'routines' && (
        <Card>
          <CardHeader
            icon={<Repeat className="w-4.5 h-4.5 text-[var(--primary)]" />}
            title="Rotinas Operacionais Recorrentes"
            subtitle="Visão consolidada das rotinas automáticas de turno e tarefas periódicas configuradas."
            actions={
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingTask({
                    id: '',
                    title: '',
                    description: '',
                    listId: activeListId !== 'all' ? activeListId : 'default',
                    category: 'Rotina Diária',
                    priority: 'media',
                    status: 'a_fazer',
                    dueDate: getTodayISO(),
                    dueTime: '07:00',
                    assignedTo: [],
                    subtasks: [],
                    recurrence: { type: 'daily', time: '07:00' },
                    createdAt: new Date().toISOString(),
                  });
                  setIsTaskModalOpen(true);
                }}
              >
                Nova Rotina
              </Button>
            }
          />

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {tasks
              .filter((t) => t.recurrence && t.recurrence.type !== 'none')
              .map((routine) => {
                const rec = routine.recurrence!;
                const progress = getTaskProgress(routine);
                return (
                  <div
                    key={routine.id}
                    className="p-4 bg-[var(--surface-2)] border border-[var(--line)] rounded-2xl space-y-3 hover:border-[var(--primary-border)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-xs font-black text-[var(--ink)] block truncate">
                          {routine.title}
                        </span>
                        <span className="text-[11px] font-bold text-[var(--primary)]">
                          {formatRecurrenceLabel(rec)}
                        </span>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit2}
                        onClick={() => openEditTaskModal(routine)}
                      />
                    </div>

                    {routine.description && (
                      <p className="text-xs text-[var(--muted)] line-clamp-2">
                        {routine.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-[var(--muted)] pt-2 border-t border-[var(--line)]">
                      <span className="font-semibold">⏰ {rec.time || routine.dueTime || 'Qualquer horário'}</span>
                      <Button
                        variant={routine.status === 'concluida' ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => toggleScheduledTaskComplete(routine.id)}
                      >
                        {routine.status === 'concluida' ? '✓ Concluída Hoje' : 'Marcar Concluída'}
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {/* VIEW 4: CALENDAR MINI VIEW */}
      {viewMode === 'calendar' && (
        <Card>
          <CardHeader
            icon={<CalendarIcon className="w-4.5 h-4.5 text-[var(--primary)]" />}
            title="Agendamento Mensal de Tarefas & Rotinas"
            subtitle="Acompanhe a distribuição cronológica das tarefas operacionais por dia."
            actions={
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (calendarMonth === 0) {
                      setCalendarMonth(11);
                      setCalendarYear((y) => y - 1);
                    } else {
                      setCalendarMonth((m) => m - 1);
                    }
                  }}
                >
                  ◀ Mês Anterior
                </Button>
                <span className="text-xs font-black uppercase text-[var(--ink)] px-2">
                  {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
                    new Date(calendarYear, calendarMonth, 1)
                  )}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0);
                      setCalendarYear((y) => y + 1);
                    } else {
                      setCalendarMonth((m) => m + 1);
                    }
                  }}
                >
                  Próximo Mês ▶
                </Button>
              </div>
            }
          />

          <div className="mt-4 space-y-4">
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                <div key={day} className="text-[10px] font-black uppercase text-[var(--muted)] py-1">
                  {day}
                </div>
              ))}

              {(() => {
                const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
                const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                const cells = [];

                // Empty prefix cells
                for (let i = 0; i < firstDayIndex; i++) {
                  cells.push(
                    <div key={`empty-${i}`} className="p-2 rounded-xl bg-[var(--bg)]/30 min-h-[70px]" />
                  );
                }

                // Days cells
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const dayTasks = tasks.filter((t) => isTaskDueOnDate(t, dateStr, state.calendar));
                  const isToday = dateStr === getTodayISO();
                  const isSelected = dateStr === selectedCalendarDate;

                  cells.push(
                    <div
                      key={dateStr}
                      onClick={() => setSelectedCalendarDate(dateStr)}
                      className={`p-1.5 rounded-xl border text-left min-h-[75px] transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] ring-2 ring-[var(--primary)]/30'
                          : isToday
                          ? 'border-amber-500/50 bg-amber-500/5'
                          : 'border-[var(--line)] bg-[var(--paper)] hover:border-[var(--line)]/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[11px] font-black ${isToday ? 'text-amber-600' : 'text-[var(--ink)]'}`}
                        >
                          {d}
                        </span>
                        {dayTasks.length > 0 && (
                          <span className="w-4 h-4 rounded-full bg-[var(--primary)] text-white text-[9px] font-bold flex items-center justify-center">
                            {dayTasks.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        {dayTasks.slice(0, 2).map((t) => (
                          <div
                            key={t.id}
                            className={`px-1 py-0.5 rounded text-[9px] font-bold truncate ${
                              t.status === 'concluida'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)]'
                            }`}
                          >
                            {t.title}
                          </div>
                        ))}
                        {dayTasks.length > 2 && (
                          <span className="text-[8.5px] text-[var(--muted)] font-bold">
                            +{dayTasks.length - 2} mais
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                return cells;
              })()}
            </div>

            {/* Selected Date Details Panel */}
            <div className="p-4 bg-[var(--surface-2)] border border-[var(--line)] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-[var(--primary)]" />
                  <h4 className="text-xs font-black text-[var(--ink)] uppercase">
                    Tarefas programadas para {formatDateBR(selectedCalendarDate)}:
                  </h4>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => openNewTaskModal(selectedCalendarDate)}
                >
                  Agendar para este Dia
                </Button>
              </div>

              {(() => {
                const dayTasks = tasks.filter((t) => isTaskDueOnDate(t, selectedCalendarDate, state.calendar));
                if (dayTasks.length === 0) {
                  return (
                    <p className="text-xs text-[var(--muted)] italic">
                      Nenhuma tarefa ou rotina agendada para este dia.
                    </p>
                  );
                }
                return (
                  <div className="space-y-2">
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        className="p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => toggleScheduledTaskComplete(t.id)}
                            className="cursor-pointer text-[var(--muted)] hover:text-[var(--primary)]"
                          >
                            {t.status === 'concluida' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                          <span
                            className={`font-bold ${
                              t.status === 'concluida' ? 'line-through text-[var(--muted)]' : 'text-[var(--ink)]'
                            }`}
                          >
                            {t.title}
                          </span>
                          {t.dueTime && (
                            <span className="text-[10px] text-[var(--muted)] font-mono">⏰ {t.dueTime}</span>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Edit2}
                          onClick={() => openEditTaskModal(t)}
                        />
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </Card>
      )}

      {/* VIEW 5: ACTIVITY FEED & WORK DISTRIBUTION (QUEM CONCLUIU E QUANDO) */}
      {viewMode === 'feed' && (
        <div className="space-y-4">
          {/* Explanation & Work Distribution Banner */}
          <div className="p-4 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-500/20 rounded-2xl flex items-start gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-black uppercase text-[var(--ink)] tracking-wider">
                Acompanhamento em Tempo Real & Divisão de Trabalho
              </h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Acompanhe quem concluiu cada tarefa ou etapa de checklist e em qual horário. Use este painel para visualizar o andamento por setor/andar em tempo real (ex.: se um colega já concluiu o checklist no andar X, você pode se direcionar para o andar Y).
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Total de Conclusões"
              value={completionFeed.length}
              hint="Tarefas e etapas finalizadas"
              icon={CheckCircle2}
              tone="success"
            />
            <StatCard
              label="Tarefas Concluídas"
              value={completionFeed.filter((i) => !i.isSubtask).length}
              hint="Rotinas completas"
              icon={CheckSquare}
              tone="info"
            />
            <StatCard
              label="Etapas de Checklist"
              value={completionFeed.filter((i) => i.isSubtask).length}
              hint="Itens individuais marcados"
              icon={ListTodo}
              tone="purple"
            />
            <StatCard
              label="Colaboradores Ativos"
              value={new Set(completionFeed.map((i) => i.completedByName)).size}
              hint="Que registraram conclusões"
              icon={Users}
              tone="warning"
            />
          </div>

          {/* Feed Filter Bar */}
          <Card padded={false}>
            <div className="p-3.5 border-b border-[var(--line)] flex items-center justify-between gap-3 flex-wrap bg-[var(--surface-2)]">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[var(--muted)]">Filtrar por Colaborador:</span>
                <select
                  value={feedFilterCollaborator}
                  onChange={(e) => setFeedFilterCollaborator(e.target.value)}
                  className="bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs font-bold text-[var(--ink)] px-2.5 py-1 focus:outline-none focus:border-[var(--primary)]"
                >
                  <option value="all">Todos os Colaboradores</option>
                  {Array.from(new Set(completionFeed.map((i) => i.completedByName))).map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>

                <span className="text-xs font-bold text-[var(--muted)] ml-2">Tipo:</span>
                <select
                  value={feedFilterType}
                  onChange={(e) => setFeedFilterType(e.target.value)}
                  className="bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs font-bold text-[var(--ink)] px-2.5 py-1 focus:outline-none focus:border-[var(--primary)]"
                >
                  <option value="all">Todos os Registros</option>
                  <option value="task">Apenas Tarefas Inteiras</option>
                  <option value="subtask">Apenas Etapas / Checklist</option>
                </select>
              </div>

              <div className="text-xs font-bold text-[var(--muted)]">
                Mostrando <strong className="text-[var(--ink)]">{filteredFeed.length}</strong> conclusões
              </div>
            </div>

            {/* Timeline Activity List */}
            <div className="divide-y divide-[var(--line)]">
              {filteredFeed.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Nenhum registro de conclusão recente"
                  description="Quando os colaboradores marcarem tarefas ou etapas do checklist como concluídas, o histórico com nome e horário aparecerá aqui em tempo real."
                />
              ) : (
                filteredFeed.map((item) => {
                  const dateObj = new Date(item.completedAt);
                  const isValidDate = !isNaN(dateObj.getTime());
                  const timeFormatted = isValidDate
                    ? dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                    : '--:--';
                  const dateFormatted = isValidDate
                    ? formatDateBR(item.completedAt.split('T')[0])
                    : '';
                  const isToday = item.completedAt.split('T')[0] === getTodayISO();

                  return (
                    <div
                      key={item.id}
                      className="p-4 hover:bg-[var(--bg)]/50 transition-colors flex items-start justify-between gap-3"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        {/* Avatar / Initial circle */}
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                          {item.completedByName.charAt(0).toUpperCase()}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-[var(--ink)]">
                              {item.completedByName}
                            </span>

                            <Badge
                              tone={item.isSubtask ? 'purple' : 'success'}
                              className="text-[10px] py-0 px-1.5 font-bold"
                            >
                              {item.isSubtask ? '✓ Etapa de Checklist' : '✓ Tarefa Concluída'}
                            </Badge>

                            {item.listName && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-md border text-[var(--ink)]"
                                style={{
                                  borderColor: item.listColor || 'var(--line)',
                                  backgroundColor: 'var(--surface-2)',
                                }}
                              >
                                {item.listName}
                              </span>
                            )}

                            <Badge tone={getPriorityTone(item.priority)} className="text-[9px] py-0 px-1">
                              {item.priority}
                            </Badge>
                          </div>

                          <div className="text-xs text-[var(--ink)]">
                            {item.isSubtask ? (
                              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                                Etapa: &ldquo;{item.subtaskTitle}&rdquo; <span className="text-[var(--muted)] font-normal">na tarefa</span> &ldquo;{item.taskTitle}&rdquo;
                              </p>
                            ) : (
                              <p className="font-semibold text-[var(--ink)]">
                                Tarefa: &ldquo;{item.taskTitle}&rdquo;
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-[var(--muted)] font-medium pt-0.5">
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <strong className="text-[var(--ink)]">{timeFormatted}</strong>
                              <span>{isToday ? '(Hoje)' : `em ${dateFormatted}`}</span>
                            </span>
                            {item.task.assignedShift && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                <span>Turno {item.task.assignedShift}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Edit2}
                        onClick={() => openEditTaskModal(item.task)}
                        className="text-xs"
                      >
                        Ver Tarefa
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: TASK CREATION & DETAILS */}
      {isTaskModalOpen && editingTask && (
        <Modal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          title={editingTask.id ? 'Editar Tarefa / Rotina' : 'Nova Tarefa ou Rotina'}
          subtitle="Configure agendamento, recorrência, subtarefas e responsáveis."
          icon={<ListTodo className="w-5 h-5 text-[var(--primary)]" />}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              {editingTask.id ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Deseja excluir a tarefa "${editingTask.title}"?`)) {
                      deleteScheduledTask(editingTask.id);
                      setIsTaskModalOpen(false);
                      showNotice('Tarefa excluída.');
                    }
                  }}
                >
                  Excluir Tarefa
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsTaskModalOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveModalTask}>
                  {editingTask.id ? 'Salvar Alterações' : 'Criar Tarefa'}
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <Field label="Título da Tarefa / Rotina *">
              <Input
                value={editingTask.title}
                onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                placeholder="Ex: Auditoria 5S na Doca de Recebimento"
              />
            </Field>

            <Field label="Descrição & Instruções Operacionais">
              <Textarea
                rows={2}
                value={editingTask.description || ''}
                onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                placeholder="Orientações detalhadas para quem for executar a tarefa..."
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl">
              <Field label="Lista / Grupo">
                <Select
                  value={editingTask.listId}
                  onChange={(e) => setEditingTask({ ...editingTask, listId: e.target.value })}
                >
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Prioridade">
                <Select
                  value={editingTask.priority}
                  onChange={(e) =>
                    setEditingTask({
                      ...editingTask,
                      priority: e.target.value as ScheduledTaskPriority,
                    })
                  }
                >
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">🚨 Urgente</option>
                </Select>
              </Field>

              <Field label="Status Atual">
                <Select
                  value={editingTask.status}
                  onChange={(e) =>
                    setEditingTask({
                      ...editingTask,
                      status: e.target.value as ScheduledTaskStatus,
                    })
                  }
                >
                  <option value="a_fazer">A Fazer</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="aguardando">Aguardando</option>
                  <option value="concluida">Concluída</option>
                  <option value="cancelada">Cancelada</option>
                </Select>
              </Field>

              <Field label="Categoria / Tag">
                <Input
                  value={editingTask.category || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, category: e.target.value })}
                  placeholder="Ex: Auditoria, 5S, Qualidade"
                />
              </Field>
            </div>

            {/* Scheduling & Recurrence */}
            <div className="p-3.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-[var(--primary)]" />
                <span>Agendamento & Recorrência</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Data de Vencimento">
                  <Input
                    type="date"
                    value={editingTask.dueDate || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                  />
                </Field>

                <Field label="Horário Limite">
                  <Input
                    type="time"
                    value={editingTask.dueTime || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, dueTime: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Regra de Recorrência">
                <Select
                  value={editingTask.recurrence?.type || 'none'}
                  onChange={(e) => {
                    const type = e.target.value as RoutineRecurrenceType;
                    setEditingTask({
                      ...editingTask,
                      recurrence: {
                        ...(editingTask.recurrence || {}),
                        type,
                        daysOfWeek: type === 'weekly' ? [1, 2, 3, 4, 5] : undefined,
                      },
                    });
                  }}
                >
                  <option value="none">Não recorrente (única)</option>
                  <option value="daily">Diária (todos os dias)</option>
                  <option value="weekdays">Dias úteis (Segunda a Sexta)</option>
                  <option value="weekly">Semanal (dias selecionados)</option>
                  <option value="monthly">Mensal</option>
                  <option value="shift_scale">Conforme escala de folga do turno</option>
                </Select>
              </Field>

              {editingTask.recurrence?.type === 'weekly' && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dayName, idx) => {
                    const isSelected = (editingTask.recurrence?.daysOfWeek || []).includes(idx);
                    return (
                      <Button
                        key={dayName}
                        variant={isSelected ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => {
                          const current = editingTask.recurrence?.daysOfWeek || [];
                          const next = isSelected
                            ? current.filter((d) => d !== idx)
                            : [...current, idx];
                          setEditingTask({
                            ...editingTask,
                            recurrence: {
                              ...(editingTask.recurrence || { type: 'weekly' }),
                              daysOfWeek: next,
                            },
                          });
                        }}
                      >
                        {dayName}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Assignee & Shift */}
            <div className="p-3.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl space-y-3">
              <div className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[var(--primary)]" />
                <span>Atribuição & Turno</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Turno Vinculado">
                  <Select
                    value={editingTask.assignedShift || ''}
                    onChange={(e) =>
                      setEditingTask({ ...editingTask, assignedShift: e.target.value || undefined })
                    }
                  >
                    <option value="">Qualquer Turno</option>
                    {(state.shifts || ['T1', 'T2', 'T3', 'T4', 'T5']).map((s) => (
                      <option key={s} value={s}>
                        Turno {s}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="Link Externo / Documentação">
                  <Input
                    type="url"
                    value={editingTask.externalUrl || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, externalUrl: e.target.value })}
                    placeholder="https://sistema.empresa.com/..."
                  />
                </Field>
              </div>

              <Field label="Responsáveis Designados">
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-[var(--paper)] border border-[var(--line)] rounded-xl">
                  {state.collaborators.map((c) => {
                    const isAssigned = (editingTask.assignedTo || []).includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          const current = editingTask.assignedTo || [];
                          const next = isAssigned
                            ? current.filter((id) => id !== c.id)
                            : [...current, c.id];
                          setEditingTask({ ...editingTask, assignedTo: next });
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                          isAssigned
                            ? 'bg-[var(--primary)] text-white shadow-2xs'
                            : 'bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        <span>{abbreviateName(c.name)}</span>
                        {isAssigned && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            {/* Subtasks Builder */}
            <div className="p-3.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-[var(--primary)]" />
                  <span>Checklist de Subtarefas ({editingTask.subtasks?.length || 0})</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    const newSub: ScheduledTaskSubtask = {
                      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                      title: '',
                      completed: false,
                    };
                    setEditingTask({
                      ...editingTask,
                      subtasks: [...(editingTask.subtasks || []), newSub],
                    });
                  }}
                >
                  Adicionar Passo
                </Button>
              </div>

              <div className="space-y-1.5">
                {(editingTask.subtasks || []).map((sub, idx) => (
                  <div key={sub.id} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-black text-[var(--muted)] w-4">
                      {idx + 1}.
                    </span>
                    <Input
                      value={sub.title}
                      onChange={(e) => {
                        const updated = [...editingTask.subtasks];
                        updated[idx] = { ...updated[idx], title: e.target.value };
                        setEditingTask({ ...editingTask, subtasks: updated });
                      }}
                      placeholder="Descreva o passo da tarefa..."
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={Trash2}
                      onClick={() => {
                        const updated = editingTask.subtasks.filter((_, i) => i !== idx);
                        setEditingTask({ ...editingTask, subtasks: updated });
                      }}
                      className="hover:text-rose-600"
                      aria-label="Remover passo"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL: NEW LIST CREATION */}
      {isListModalOpen && (
        <Modal
          isOpen={isListModalOpen}
          onClose={() => setIsListModalOpen(false)}
          title="Nova Lista de Tarefas"
          subtitle="Crie um novo agrupador temático para suas tarefas e rotinas."
          icon={<FolderPlus className="w-5 h-5 text-[var(--primary)]" />}
          size="sm"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setIsListModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateList}
                disabled={!newListName.trim()}
              >
                Criar Lista
              </Button>
            </div>
          }
        >
          <form onSubmit={handleCreateList} className="space-y-3.5">
            <Field label="Nome da Lista *">
              <Input
                autoFocus
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Ex: Auditorias 5S, Manutenção Semanal..."
              />
            </Field>

            <Field label="Cor de Identificação">
              <div className="flex items-center gap-2 pt-1">
                {['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#0ea5e9', '#ec4899'].map(
                  (col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewListColor(col)}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center ${
                        newListColor === col ? 'scale-110 ring-2 ring-[var(--primary)]' : ''
                      }`}
                      style={{ backgroundColor: col }}
                    >
                      {newListColor === col && <Check className="w-4 h-4 text-white" />}
                    </button>
                  )
                )}
              </div>
            </Field>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default RoutinesView;
