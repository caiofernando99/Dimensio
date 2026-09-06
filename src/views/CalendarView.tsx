import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Download,
  Upload,
  Calendar as CalendarIcon,
  Sparkles,
  Settings,
  Check,
  CalendarCheck2,
  ListChecks,
  Users,
  ListTodo,
  User,
  CheckSquare,
  Square,
  Plus,
  RefreshCw,
  ExternalLink,
  Clock,
  MapPin,
  Trash2,
  CheckCheck,
} from 'lucide-react';
import { SUGGESTED_CALENDAR_2026 } from '../utils/suggestedScale';
import { PageHeader, Card, Toolbar, Button, Badge, Select, Modal, Input } from '../components/ui';
import { getCollaboratorStatus } from '../utils/helpers';
import { isTaskDueOnDate, formatRecurrenceLabel } from '../utils/routineHelpers';
import { STATUS_BADGE_CLASSES } from '../constants';
import { Collaborator, ScheduledTask } from '../types';
import { fetchCalendarEvents, createCalendarEvent, deleteCalendarEvent, CalendarEventItem } from '../lib/workspace';
import { getAccessToken } from '../lib/firebase';

const DEFAULT_GROUPS = ['A', 'B', 'C', 'D'];
const GROUP_COLORS = [
  'bg-red-500 text-white',
  'bg-amber-400 text-slate-900',
  'bg-teal-400 text-slate-900',
  'bg-indigo-400 text-white',
  'bg-emerald-500 text-white',
  'bg-fuchsia-500 text-white',
  'bg-sky-500 text-white',
  'bg-orange-500 text-white',
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const STATUS_LABELS: Record<string, string> = {
  presente: 'Presentes',
  atraso: 'Em Atraso',
  ausente: 'Ausentes',
  folga: 'Em Folga',
  ferias: 'Férias',
  licenca: 'Licença Médica',
  treinamento: 'Treinamento',
  atestado: 'Atestado',
  banco_horas: 'Banco de Horas',
  falta_injustificada: 'Falta Injustificada',
};

export const CalendarView: React.FC = () => {
  const {
    state,
    setYear,
    markDayScale,
    setDate,
    showNotice,
    importFullState,
    identifiedUser,
    toggleScheduledTaskComplete,
    syncTaskToGoogleCalendar,
    syncTaskToGoogleTasks,
    syncTasksToGoogleWorkspace,
  } = useApp();
  const scaleGroups = state.scaleGroups && state.scaleGroups.length > 0 ? state.scaleGroups : DEFAULT_GROUPS;
  const [selectedOff, setSelectedOff] = useState<string>('A');
  const [mode, setMode] = useState<'view' | 'config'>('view');
  const [detailDay, setDetailDay] = useState<string | null>(null);
  const [showTasksInCalendar, setShowTasksInCalendar] = useState<boolean>(true);
  const [filterMyTasks, setFilterMyTasks] = useState<boolean>(false);

  // Google Calendar state
  const [googleEvents, setGoogleEvents] = useState<CalendarEventItem[]>([]);
  const [isLoadingGoogleEvents, setIsLoadingGoogleEvents] = useState<boolean>(false);
  const [showGoogleEvents, setShowGoogleEvents] = useState<boolean>(true);
  const [isSyncingDay, setIsSyncingDay] = useState<boolean>(false);

  // Create Google Event Modal
  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState<boolean>(false);
  const [newEventSummary, setNewEventSummary] = useState<string>('');
  const [newEventDate, setNewEventDate] = useState<string>('');
  const [newEventStartTime, setNewEventStartTime] = useState<string>('09:00');
  const [newEventEndTime, setNewEventEndTime] = useState<string>('10:00');
  const [newEventDescription, setNewEventDescription] = useState<string>('');
  const [newEventLocation, setNewEventLocation] = useState<string>('');
  const [isCreatingEvent, setIsCreatingEvent] = useState<boolean>(false);

  const allScheduledTasks: ScheduledTask[] = useMemo(() => state.scheduledTasks || [], [state.scheduledTasks]);

  const activeTasks = useMemo(() => {
    if (!showTasksInCalendar) return [];
    if (filterMyTasks && identifiedUser) {
      return allScheduledTasks.filter(
        (t) =>
          (t.assignedTo || []).includes(identifiedUser.id) ||
          (t.assignedTo || []).includes('all') ||
          (identifiedUser.role && t.assignedRole === identifiedUser.role)
      );
    }
    return allScheduledTasks;
  }, [allScheduledTasks, showTasksInCalendar, filterMyTasks, identifiedUser]);

  // Load Google Calendar Events when user is logged in
  const loadGoogleEvents = async (silent = false) => {
    try {
      const token = await getAccessToken();
      if (!token) return;
      setIsLoadingGoogleEvents(true);
      const events = await fetchCalendarEvents();
      setGoogleEvents(events || []);
      if (!silent) {
        showNotice(`📅 ${events.length} evento(s) carregado(s) do seu Google Calendar!`);
      }
    } catch (err: any) {
      if (!silent) {
        showNotice(err?.message || 'Não foi possível carregar os eventos do Google Calendar.');
      }
    } finally {
      setIsLoadingGoogleEvents(false);
    }
  };

  useEffect(() => {
    loadGoogleEvents(true);
  }, []);

  const handleCreateGoogleEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventSummary.trim() || !newEventDate) {
      showNotice('Preencha o título e a data do evento.');
      return;
    }

    try {
      setIsCreatingEvent(true);
      const startDateTime = new Date(`${newEventDate}T${newEventStartTime || '09:00'}:00`).toISOString();
      const endDateTime = new Date(`${newEventDate}T${newEventEndTime || '10:00'}:00`).toISOString();

      await createCalendarEvent({
        summary: newEventSummary.trim(),
        description: newEventDescription.trim() || undefined,
        location: newEventLocation.trim() || undefined,
        startDateTime,
        endDateTime,
      });

      showNotice(`Evento "${newEventSummary}" criado no Google Calendar com sucesso!`);
      setIsCreateEventModalOpen(false);
      setNewEventSummary('');
      setNewEventDescription('');
      setNewEventLocation('');
      await loadGoogleEvents(true);
    } catch (err: any) {
      showNotice(err?.message || 'Erro ao criar evento no Google Calendar.');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const handleDeleteGoogleEvent = async (eventId: string, title: string) => {
    if (!confirm(`Deseja realmente remover o evento "${title}" do seu Google Calendar?`)) return;
    try {
      await deleteCalendarEvent(eventId);
      setGoogleEvents((prev) => prev.filter((e) => e.id !== eventId));
      showNotice(`Evento "${title}" excluído do Google Calendar.`);
    } catch (err: any) {
      showNotice(err?.message || 'Erro ao excluir evento.');
    }
  };

  const handleSyncDayTasks = async (dayTasks: ScheduledTask[]) => {
    if (dayTasks.length === 0) {
      showNotice('Não há tarefas nesta data para sincronizar.');
      return;
    }
    try {
      setIsSyncingDay(true);
      await syncTasksToGoogleWorkspace(dayTasks.map((t) => t.id));
      await loadGoogleEvents(true);
    } finally {
      setIsSyncingDay(false);
    }
  };

  const colorForGroup = (group: string): string => {
    const idx = scaleGroups.indexOf(group);
    if (idx === -1) return 'bg-slate-400 text-white';
    return GROUP_COLORS[idx % GROUP_COLORS.length];
  };

  const handleDayClick = (dayStr: string) => {
    markDayScale(dayStr, selectedOff as any);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (mode !== 'config') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (!['a', 'b', 'c', 'd'].includes(key)) return;
      const group = key.toUpperCase();
      if (!scaleGroups.includes(group)) return;
      e.preventDefault();
      setSelectedOff(group);
      const active = document.activeElement as HTMLElement | null;
      if (active?.dataset?.day) {
        markDayScale(active.dataset.day, group as any);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scaleGroups, markDayScale, mode]);

  const handleLoadSuggestedScale = () => {
    importFullState({
      calendar: { ...state.calendar, ...SUGGESTED_CALENDAR_2026 },
      year: 2026,
    });
    setYear(2026);
    showNotice('Escala Sugerida de 2026 carregada com sucesso no calendário!');
  };

  const handleExportCalendar = () => {
    const data = {
      type: 'people-scheduler-calendar',
      version: 3,
      year: state.year,
      calendar: state.calendar,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendario-escala-${state.year}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Calendário exportado.');
  };

  const handleImportCalendar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && typeof json === 'object') {
          const calendarData = json.calendar || (json.type === 'people-scheduler-calendar' ? json.calendar : null);
          if (calendarData) {
            importFullState({
              calendar: { ...state.calendar, ...calendarData },
              ...(json.year ? { year: json.year } : {}),
            });
            showNotice('Calendário de escala importado com sucesso!');
          } else {
            showNotice('Arquivo JSON não possui dados de calendário válidos.');
          }
        }
      } catch (err) {
        showNotice('Erro ao ler o arquivo JSON de calendário.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const todayStr = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  })();

  const renderMonth = useMemo(() => {
    return (monthIndex: number) => {
      const firstDay = new Date(state.year, monthIndex, 1).getDay();
      const totalDays = new Date(state.year, monthIndex + 1, 0).getDate();

      const blanks = Array.from({ length: firstDay });
      const days = Array.from({ length: totalDays }, (_, i) => i + 1);

      return (
        <div key={monthIndex} className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-2 shadow-[var(--shadow-card)]">
          <h4 className="text-xs font-black text-center text-[var(--ink)] mb-1 uppercase tracking-tight">{MONTH_NAMES[monthIndex]}</h4>
          <div className="grid grid-cols-7 text-center text-[9px] font-extrabold text-[var(--muted)] border-b border-[var(--line)] pb-0.5 mb-1">
            <span>D</span>
            <span>S</span>
            <span>T</span>
            <span>Q</span>
            <span>Q</span>
            <span>S</span>
            <span>S</span>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {blanks.map((_, idx) => (
              <div key={`blank-${idx}`} className="aspect-square" />
            ))}
            {days.map((dayNum) => {
              const dayStr = `${state.year}-${String(monthIndex + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const offGroup = state.calendar[dayStr];
              const isSelectedDay = dayStr === state.selectedDate;
              const isPast = dayStr < todayStr;
              const dayTasks = activeTasks.filter((t) => isTaskDueOnDate(t, dayStr, state.calendar));
              const dayGoogleEvents = googleEvents.filter((ev) => {
                const evDate = (ev.start?.dateTime || ev.start?.date || '').slice(0, 10);
                return evDate === dayStr;
              });

              return (
                <button
                  key={dayStr}
                  data-day={dayStr}
                  onClick={() => (mode === 'config' ? handleDayClick(dayStr) : setDetailDay(dayStr))}
                  onDoubleClick={() => setDate(dayStr)}
                  className={`aspect-square text-[9.5px] font-bold rounded flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                    offGroup ? colorForGroup(offGroup) : 'bg-[var(--surface-2)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] text-[var(--ink)]'
                  } ${isSelectedDay ? 'ring-2 ring-[var(--ink)] font-black scale-105' : ''} ${isPast && mode === 'view' && !offGroup ? 'opacity-80' : ''}`}
                  title={
                    mode === 'config'
                      ? offGroup
                        ? `Folga Turma ${offGroup} (clique para mudar)`
                        : 'Clique para marcar folga'
                      : `${offGroup ? `Folga Turma ${offGroup}` : 'Dia de Trabalho'}${dayTasks.length > 0 ? ` • ${dayTasks.length} tarefa(s)` : ''}${dayGoogleEvents.length > 0 ? ` • ${dayGoogleEvents.length} evento(s) no Calendar` : ''}`
                  }
                >
                  <span>{dayNum}</span>
                  {/* Indicators for tasks & google events */}
                  {mode === 'view' && (dayTasks.length > 0 || (showGoogleEvents && dayGoogleEvents.length > 0)) && (
                    <div className="absolute bottom-0.5 flex items-center gap-0.5">
                      {dayTasks.length > 0 && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            offGroup ? 'bg-white ring-1 ring-black/30' : 'bg-[var(--primary)]'
                          }`}
                        />
                      )}
                      {showGoogleEvents && dayGoogleEvents.length > 0 && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            offGroup ? 'bg-sky-200 ring-1 ring-black/30' : 'bg-sky-500'
                          }`}
                          title={`${dayGoogleEvents.length} evento(s) do Google Calendar`}
                        />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      );
    };
  }, [state.year, state.calendar, state.selectedDate, markDayScale, setDate, mode, todayStr, activeTasks, googleEvents, showGoogleEvents]);

  const buildDayDetail = (dayStr: string) => {
    const [y, m, d] = dayStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const fullDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const offGroup = state.calendar[dayStr];
    const isPast = dayStr < todayStr;

    const counts: Record<string, number> = {};
    const offCollaborators: Collaborator[] = [];
    state.collaborators.forEach((c) => {
      const st = getCollaboratorStatus(c, dayStr, state).status;
      counts[st] = (counts[st] || 0) + 1;
      if (offGroup && c.scale === offGroup) offCollaborators.push(c);
    });

    const historyEntry = state.history.find((h) => h.date === dayStr);
    const manualOverrides = Object.keys(state.attendance[dayStr] || {}).length;
    const dayTasks = allScheduledTasks.filter((t) => isTaskDueOnDate(t, dayStr, state.calendar));
    const dayGoogleEvents = googleEvents.filter((ev) => {
      const evDate = (ev.start?.dateTime || ev.start?.date || '').slice(0, 10);
      return evDate === dayStr;
    });

    return { weekday, fullDate, offGroup, isPast, counts, offCollaborators, historyEntry, manualOverrides, dayTasks, dayGoogleEvents };
  };

  return (
    <div className="space-y-4">
      <PageHeader
        icon={CalendarIcon}
        title={mode === 'config' ? 'Configuração da Escala' : 'Calendário Anual'}
        subtitle={
          mode === 'config'
            ? 'Modo de edição: clique nos dias para marcar a folga por turma.'
            : 'Visualização — clique em um dia para ver a escala e os dados da data.'
        }
        actions={
          mode === 'config' ? (
            <Button
              variant="primary"
              size="sm"
              icon={Check}
              onClick={() => setMode('view')}
              title="Concluir configuração e voltar à visualização"
            >
              Concluir
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              icon={Settings}
              onClick={() => setMode('config')}
              title="Abrir configuração e edição da escala"
            >
              Configurar Escala
            </Button>
          )
        }
      />

      <Card>
        <Toolbar>
          <div className="flex items-center gap-2">
            <label className="font-extrabold text-[var(--muted)] text-[11px]">Ano:</label>
            <Select
              value={state.year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-auto !h-8 text-xs"
            >
              <option value={state.year - 1}>{state.year - 1}</option>
              <option value={state.year}>{state.year}</option>
              <option value={state.year + 1}>{state.year + 1}</option>
            </Select>
          </div>

          {mode === 'config' && (
            <div className="flex items-center gap-2">
              <label className="font-extrabold text-[var(--muted)] text-[11px]">Folga Para:</label>
              <div className="flex items-center gap-1">
                {scaleGroups.map((grp) => (
                  <button
                    key={grp}
                    onClick={() => setSelectedOff(grp)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-black transition-all cursor-pointer ${
                      selectedOff === grp
                        ? `${colorForGroup(grp)} ring-2 ring-[var(--ink)] shadow-2xs`
                        : 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] hover:border-[var(--primary-border)]'
                    }`}
                  >
                    Turma {grp}
                  </button>
                ))}
                <button
                  onClick={() => setSelectedOff('')}
                  className={`px-2 py-1 rounded-md text-[10px] font-bold border border-[var(--line)] cursor-pointer ${
                    selectedOff === '' ? 'bg-[var(--line)] text-[var(--ink)]' : 'bg-[var(--surface-2)] text-[var(--muted)]'
                  }`}
                >
                  Limpar
                </button>
              </div>
            </div>
          )}

          {mode === 'config' && (
            <div className="ml-auto flex items-center gap-2">
              <Button variant="primary" size="sm" icon={Sparkles} onClick={handleLoadSuggestedScale} title="Preencher calendário com a sugestão oficial de escala 2026">
                Escala 2026
              </Button>
              <label className="inline-flex items-center justify-center h-8 px-3 text-xs gap-1.5 rounded-lg font-bold select-none cursor-pointer transition-all duration-150 active:scale-[0.98] bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--bg)]">
                <Upload className="w-3.5 h-3.5" />
                <span>Importar</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportCalendar}
                  className="hidden"
                />
              </label>
              <Button variant="outline" size="sm" icon={Download} onClick={handleExportCalendar}>
                Exportar
              </Button>
            </div>
          )}

          {mode === 'view' && (
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {/* Google Calendar Controls */}
              <div className="flex items-center gap-1.5 bg-[var(--surface-2)] p-1 rounded-lg border border-[var(--line)]">
                <button
                  onClick={() => loadGoogleEvents(false)}
                  disabled={isLoadingGoogleEvents}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-sky-700 dark:text-sky-400 hover:bg-sky-500/10 transition-all cursor-pointer disabled:opacity-50"
                  title="Atualizar eventos do Google Calendar"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGoogleEvents ? 'animate-spin' : ''}`} />
                  <span>Agenda Google</span>
                  {googleEvents.length > 0 && (
                    <span className="text-[10px] px-1 py-0.2 rounded-full font-black bg-sky-500 text-white">
                      {googleEvents.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => setShowGoogleEvents(!showGoogleEvents)}
                  className={`px-2 py-1 rounded-md text-[10px] font-black transition-all cursor-pointer ${
                    showGoogleEvents
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                  title="Exibir/Ocultar marcadores de eventos do Google Calendar"
                >
                  {showGoogleEvents ? 'Visível' : 'Oculto'}
                </button>
              </div>

              {/* Task display toggles */}
              <div className="flex items-center gap-1.5 bg-[var(--surface-2)] p-1 rounded-lg border border-[var(--line)]">
                <button
                  onClick={() => setShowTasksInCalendar(!showTasksInCalendar)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    showTasksInCalendar
                      ? 'bg-[var(--primary)] text-white shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                  title="Exibir marcadores de tarefas e rotinas no calendário"
                >
                  <ListTodo className="w-3.5 h-3.5" />
                  <span>Tarefas</span>
                  {allScheduledTasks.length > 0 && (
                    <span className={`text-[10px] px-1 py-0.2 rounded-full font-black ${
                      showTasksInCalendar ? 'bg-white/20 text-white' : 'bg-[var(--line)] text-[var(--muted)]'
                    }`}>
                      {allScheduledTasks.length}
                    </span>
                  )}
                </button>

                {identifiedUser && (
                  <button
                    onClick={() => setFilterMyTasks(!filterMyTasks)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                      filterMyTasks
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                    title="Filtrar calendário para ver apenas as minhas tarefas atribuídas"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Minhas</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] font-bold">
                {scaleGroups.map((grp) => (
                  <div key={grp} className="flex items-center gap-1">
                    <span className={`w-2.5 h-2.5 rounded-xs ${colorForGroup(grp)}`}></span>
                    <span className="text-[var(--muted)]">T-{grp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Toolbar>

        {mode === 'config' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--muted)] border-t border-[var(--line)] pt-2.5">
            <span>Atalhos de teclado:</span>
            {scaleGroups.map((grp) => (
              <kbd
                key={grp}
                className="px-1.5 py-0.5 rounded-md bg-[var(--surface-2)] border border-[var(--line)] font-mono text-[10px] text-[var(--ink)] shadow-xs"
              >
                {grp}
              </kbd>
            ))}
            <span className="text-[10px]">
              seleciona a turma de folga · com um dia focado (Tab), a tecla marca a folga direto nele
            </span>
            <Badge tone="primary" className="ml-auto">Fechar ano calendário: {state.year}</Badge>
          </div>
        )}

        {mode === 'config' && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-bold text-amber-800 dark:text-amber-300">
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span>Modo de configuração ativo — clique nos dias para marcar a folga. Use "Concluir" para voltar à visualização.</span>
          </div>
        )}
      </Card>

      {/* 12 Months Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {MONTH_NAMES.map((_, idx) => renderMonth(idx))}
      </div>

      {/* Day Details Modal (view mode) */}
      {detailDay && (() => {
        const detail = buildDayDetail(detailDay);
        const visibleStatuses = Object.keys(detail.counts).filter((k) => (detail.counts[k] || 0) > 0);

        return (
          <Modal
            isOpen
            onClose={() => setDetailDay(null)}
            icon={<CalendarCheck2 className="w-4.5 h-4.5" />}
            title={detail.fullDate}
            subtitle={`${detail.weekday}${detail.isPast ? ' • Dia anterior' : detailDay === todayStr ? ' • Hoje' : ' • Dia futuro'}`}
            size="md"
            footer={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDate(detailDay);
                    setDetailDay(null);
                  }}
                  title="Selecionar este dia em todo o sistema"
                >
                  Ir para este dia
                </Button>
              </>
            }
          >
            <div className="space-y-4">
              {/* Scale status */}
              <div className="flex flex-wrap items-center gap-2">
                {detail.offGroup ? (
                  <Badge tone="primary" className={`${colorForGroup(detail.offGroup)} border border-black/10`}>
                    <CalendarIcon className="w-3 h-3 shrink-0" />
                    Folga da Turma {detail.offGroup}
                  </Badge>
                ) : (
                  <Badge tone="neutral">Dia normal de trabalho</Badge>
                )}
                {detail.isPast && (
                  <Badge tone="info">Dados registrados deste dia</Badge>
                )}
              </div>

              {/* Day data summary */}
              <div>
                <h4 className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5 mb-2">
                  <ListChecks className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Dados do dia ({state.collaborators.length} colaboradores)</span>
                </h4>
                {visibleStatuses.length > 0 ? (
                  <div className="grid grid-cols-2 gap-1.5">
                    {visibleStatuses.map((st) => (
                      <div key={st} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-lg">
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${STATUS_BADGE_CLASSES[st as keyof typeof STATUS_BADGE_CLASSES] || 'bg-slate-100 text-slate-700'}`}>
                          {STATUS_LABELS[st] || st}
                        </span>
                        <span className="text-xs font-black text-[var(--ink)]">{detail.counts[st]}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)] italic">Nenhum colaborador cadastrado para este dia.</p>
                )}
              </div>

              {/* History snapshot for past days */}
              {detail.historyEntry && (
                <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Registro do dia (histórico)</span>
                  <span className="text-xs font-black text-[var(--ink)]">
                    {detail.historyEntry.peoplePresent} presentes
                  </span>
                </div>
              )}

              {detail.manualOverrides > 0 && (
                <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--muted)]">Ajustes manuais de presença</span>
                  <Badge tone="neutral">{detail.manualOverrides}</Badge>
                </div>
              )}

              {/* Google Calendar Events for this Day */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5">
                    <CalendarCheck2 className="w-3.5 h-3.5 text-sky-500" />
                    <span>Agenda Google (Google Calendar) ({detail.dayGoogleEvents.length})</span>
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Plus}
                    onClick={() => {
                      setNewEventDate(detailDay);
                      setNewEventSummary('');
                      setNewEventStartTime('09:00');
                      setNewEventEndTime('10:00');
                      setIsCreateEventModalOpen(true);
                    }}
                    className="!py-0.5 !px-2 !text-[10px] text-sky-700 dark:text-sky-400 border-sky-300 dark:border-sky-700"
                  >
                    Novo Evento
                  </Button>
                </div>

                {detail.dayGoogleEvents.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {detail.dayGoogleEvents.map((ev) => {
                      const startTime = ev.start?.dateTime
                        ? new Date(ev.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : 'Dia inteiro';
                      const endTime = ev.end?.dateTime
                        ? new Date(ev.end.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        : '';

                      return (
                        <div
                          key={ev.id}
                          className="p-2.5 rounded-lg border border-sky-200 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/20 text-xs flex items-start justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-[11px] text-sky-950 dark:text-sky-200 truncate">
                              {ev.summary || '(Sem título)'}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-sky-700 dark:text-sky-400 mt-0.5">
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                {startTime}{endTime ? ` - ${endTime}` : ''}
                              </span>
                              {ev.location && (
                                <span className="flex items-center gap-0.5 truncate max-w-[150px]">
                                  <MapPin className="w-3 h-3" />
                                  {ev.location}
                                </span>
                              )}
                            </div>
                            {ev.description && (
                              <p className="text-[10px] text-[var(--muted)] mt-1 line-clamp-2">
                                {ev.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {ev.htmlLink && (
                              <a
                                href={ev.htmlLink}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-sky-600 hover:text-sky-800 transition-colors"
                                title="Abrir no Google Calendar"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              onClick={() => handleDeleteGoogleEvent(ev.id, ev.summary)}
                              className="p-1 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                              title="Remover do Google Calendar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-2.5 bg-[var(--surface-2)] border border-dashed border-[var(--line)] rounded-lg text-xs text-[var(--muted)]">
                    Nenhum compromisso marcado na sua Agenda Google neste dia.
                  </div>
                )}
              </div>

              {/* Scheduled Tasks & Routines for this Day */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Tarefas & Rotinas do Dia ({detail.dayTasks.length})</span>
                  </h4>
                  {detail.dayTasks.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={RefreshCw}
                      disabled={isSyncingDay}
                      onClick={() => handleSyncDayTasks(detail.dayTasks)}
                      className="!py-0.5 !px-2 !text-[10px] text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
                      title="Sincronizar tarefas deste dia com Google Calendar e Google Tasks"
                    >
                      {isSyncingDay ? 'Sincronizando...' : 'Sincronizar com Workspace'}
                    </Button>
                  )}
                </div>

                {detail.dayTasks.length > 0 ? (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {detail.dayTasks.map((t) => {
                      const isComplete = t.status === 'concluida';
                      return (
                        <div
                          key={t.id}
                          className={`p-2 rounded-lg border text-xs transition-all flex items-start gap-2.5 ${
                            isComplete
                              ? 'bg-[var(--surface-2)]/50 border-[var(--line)] opacity-70'
                              : 'bg-[var(--paper)] border-[var(--line)] shadow-2xs'
                          }`}
                        >
                          <button
                            onClick={() => toggleScheduledTaskComplete(t.id)}
                            className="mt-0.5 text-[var(--muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                          >
                            {isComplete ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold text-[11px] truncate ${
                                  isComplete ? 'line-through text-[var(--muted)]' : 'text-[var(--ink)]'
                                }`}
                              >
                                {t.title}
                              </span>
                              {t.priority === 'urgente' && (
                                <Badge tone="danger" className="text-[9px] py-0 px-1">Urgente</Badge>
                              )}
                              {t.priority === 'alta' && (
                                <Badge tone="warning" className="text-[9px] py-0 px-1">Alta</Badge>
                              )}
                              {t.syncedToGoogleCalendar && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-sky-600 dark:text-sky-400" title="Sincronizado com Google Calendar">
                                  <CheckCheck className="w-2.5 h-2.5" />
                                  Cal
                                </span>
                              )}
                              {t.syncedToGoogleTasks && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-emerald-600 dark:text-emerald-400" title="Sincronizado com Google Tasks">
                                  <Check className="w-2.5 h-2.5" />
                                  Tasks
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--muted)] mt-0.5">
                              {t.dueTime && (
                                <span>⏰ {t.dueTime}{t.dueEndTime ? ` - ${t.dueEndTime}` : ''}</span>
                              )}
                              {t.recurrence && t.recurrence.type !== 'none' && (
                                <span className="text-[var(--primary)] font-bold">
                                  🔄 {formatRecurrenceLabel(t.recurrence)}
                                </span>
                              )}
                              {t.subtasks && t.subtasks.length > 0 && (
                                <span>
                                  ☑️ {t.subtasks.filter((st) => st.completed).length}/{t.subtasks.length}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {!t.syncedToGoogleCalendar && (
                              <button
                                onClick={() => syncTaskToGoogleCalendar(t.id)}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 transition-colors cursor-pointer"
                                title="Enviar para o Google Calendar"
                              >
                                + Agenda
                              </button>
                            )}
                            {!t.syncedToGoogleTasks && (
                              <button
                                onClick={() => syncTaskToGoogleTasks(t.id)}
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 transition-colors cursor-pointer"
                                title="Enviar para o Google Tasks"
                              >
                                + Tasks
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-3 bg-[var(--surface-2)] border border-dashed border-[var(--line)] rounded-lg text-xs text-[var(--muted)]">
                    Nenhuma tarefa agendada para esta data.
                  </div>
                )}
              </div>

              {/* Off group members */}
              {detail.offGroup && detail.offCollaborators.length > 0 && (
                <div>
                  <h4 className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5 mb-2">
                    <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Turma {detail.offGroup} em folga ({detail.offCollaborators.length})</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {detail.offCollaborators.slice(0, 14).map((c) => (
                      <span key={c.id} className="px-2 py-0.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[10px] font-bold text-[var(--ink)]">
                        {c.name}
                      </span>
                    ))}
                    {detail.offCollaborators.length > 14 && (
                      <span className="px-2 py-0.5 text-[10px] font-black text-[var(--muted)]">
                        +{detail.offCollaborators.length - 14} mais
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* Modal for Creating Google Calendar Event */}
      {isCreateEventModalOpen && (
        <Modal
          isOpen
          onClose={() => setIsCreateEventModalOpen(false)}
          icon={<CalendarCheck2 className="w-4.5 h-4.5 text-sky-500" />}
          title="Novo Evento no Google Calendar"
          subtitle="Adicionar compromisso diretamente na sua agenda corporativa do Google"
          size="md"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCreateEventModalOpen(false)}
                disabled={isCreatingEvent}
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Check}
                onClick={handleCreateGoogleEvent}
                disabled={isCreatingEvent}
                className="!bg-sky-600 hover:!bg-sky-700 text-white"
              >
                {isCreatingEvent ? 'Agendando...' : 'Criar Evento no Google'}
              </Button>
            </>
          }
        >
          <form onSubmit={handleCreateGoogleEvent} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                Título do Evento *
              </label>
              <Input
                type="text"
                placeholder="Ex: Reunião de Alinhamento de Escala"
                value={newEventSummary}
                onChange={(e) => setNewEventSummary(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                  Data *
                </label>
                <Input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                  Horário Início
                </label>
                <Input
                  type="time"
                  value={newEventStartTime}
                  onChange={(e) => setNewEventStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                  Horário Término
                </label>
                <Input
                  type="time"
                  value={newEventEndTime}
                  onChange={(e) => setNewEventEndTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                Local / Sala / Link
              </label>
              <Input
                type="text"
                placeholder="Ex: Sala de Operações ou Google Meet"
                value={newEventLocation}
                onChange={(e) => setNewEventLocation(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                Descrição ou Pauta
              </label>
              <textarea
                rows={3}
                placeholder="Detalhes adicionais sobre o compromisso..."
                value={newEventDescription}
                onChange={(e) => setNewEventDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-none"
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};