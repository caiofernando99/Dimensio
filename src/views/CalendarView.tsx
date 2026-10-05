import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Download,
  Upload,
  Calendar as CalendarIcon,
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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { PageHeader, Card, Toolbar, Button, Badge, Modal, Input } from '../components/ui';
import { getCollaboratorStatus, getDayOffGroups, getDayHoliday, normalizeCalendarDay } from '../utils/helpers';
import { isTaskDueOnDate, formatRecurrenceLabel } from '../utils/routineHelpers';
import { STATUS_BADGE_CLASSES } from '../constants';
import { Collaborator, ScheduledTask } from '../types';
import { fetchCalendarEvents, createCalendarEvent, deleteCalendarEvent, CalendarEventItem } from '../lib/workspace';
import { getAccessToken } from '../lib/firebase';

// Paleta selecionável de cores das turmas. Cada turma criada pelo usuário
// recebe uma cor da paleta (editável). O `hex` alimenta o fundo dos dias com
// múltiplas folgas (gradiente); o `cls` mantém o estilo atual nos selos.
export const CREW_PALETTE: Array<{ hex: string; cls: string }> = [
  { hex: '#ef4444', cls: 'bg-red-500 text-white' },
  { hex: '#fbbf24', cls: 'bg-amber-400 text-slate-900' },
  { hex: '#2dd4bf', cls: 'bg-teal-400 text-slate-900' },
  { hex: '#818cf8', cls: 'bg-indigo-400 text-white' },
  { hex: '#10b981', cls: 'bg-emerald-500 text-white' },
  { hex: '#d946ef', cls: 'bg-fuchsia-500 text-white' },
  { hex: '#0ea5e9', cls: 'bg-sky-500 text-white' },
  { hex: '#f97316', cls: 'bg-orange-500 text-white' },
];

/** Fundo em fatias quando 2+ turmas folgam no mesmo dia. */
export function multiCrewBackground(hexes: string[]): string {
  const n = hexes.length;
  const stops = hexes.map((h, i) => `${h} ${(i * 100) / n}% ${((i + 1) * 100) / n}%`).join(', ');
  return `linear-gradient(135deg, ${stops})`;
}

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
    setDayHoliday,
    setDayOffGroups,
    addCalendarEvent,
    removeCalendarEvent,
    upsertScaleGroup,
    removeScaleGroup,
    setDate,
    showNotice,
    importFullState,
    identifiedUser,
    toggleScheduledTaskComplete,
    syncTaskToGoogleCalendar,
    syncTaskToGoogleTasks,
    syncTasksToGoogleWorkspace,
  } = useApp();
  // Zero turmas por padrão: tudo é criado pelo usuário. Sem fallback A-D.
  const scaleGroups = state.scaleGroups || [];
  const crewDefs = state.scaleGroupDefs || [];
  const [selectedOff, setSelectedOff] = useState<string[]>([]);
  const [newCrewName, setNewCrewName] = useState<string>('');
  const [newCrewColor, setNewCrewColor] = useState<string>(CREW_PALETTE[0].hex);

  const paletteEntryFor = (hex?: string) =>
    CREW_PALETTE.find((p) => p.hex.toLowerCase() === (hex || '').toLowerCase());

  const hexForGroup = (group: string): string => {
    const def = crewDefs.find((d) => d.name === group || d.id === group);
    if (def?.color) {
      const pal = paletteEntryFor(def.color);
      if (pal) return pal.hex;
      return def.color;
    }
    const idx = scaleGroups.indexOf(group);
    if (idx === -1) return '#64748b';
    return CREW_PALETTE[idx % CREW_PALETTE.length].hex;
  };

  const colorForGroup = (group: string): string => {
    const def = crewDefs.find((d) => d.name === group || d.id === group);
    if (def?.color) {
      const pal = paletteEntryFor(def.color);
      if (pal) return pal.cls;
    }
    const idx = scaleGroups.indexOf(group);
    if (idx === -1) return 'bg-slate-400 text-white';
    return CREW_PALETTE[idx % CREW_PALETTE.length].cls;
  };
  const [holidayDraft, setHolidayDraft] = useState<Record<string, { title: string; allowWork: boolean }>>({});
  const [localEventDraft, setLocalEventDraft] = useState<Record<string, string>>({});
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

  // Multi-folga: alterna cada turma selecionada no dia (mantém feriado).
  const handleDayClick = (dayStr: string) => {
    if (selectedOff.length === 0) {
      markDayScale(dayStr, '');
      return;
    }
    const current = getDayOffGroups(state.calendar, dayStr);
    const next = [...current];
    selectedOff.forEach((g) => {
      const i = next.indexOf(g);
      if (i >= 0) next.splice(i, 1);
      else next.push(g);
    });
    setDayOffGroups(dayStr, next);
  };

  const toggleSelectedOff = (group: string) => {
    setSelectedOff((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]));
  };

  const handleAddCrew = (e?: React.FormEvent) => {
    e?.preventDefault();
    const name = newCrewName.trim();
    if (!name) return;
    if (scaleGroups.includes(name)) {
      showNotice(`Turma "${name}" já existe.`);
      return;
    }
    upsertScaleGroup(name, { color: newCrewColor });
    setNewCrewName('');
    // Avança a cor padrão para a próxima da paleta.
    const nextIdx = (CREW_PALETTE.findIndex((p) => p.hex === newCrewColor) + 1) % CREW_PALETTE.length;
    setNewCrewColor(CREW_PALETTE[nextIdx >= 0 ? nextIdx : 0].hex);
    setSelectedOff((prev) => [...prev, name]);
    showNotice(`Turma "${name}" criada! Defina suas próprias turmas livremente.`);
  };

  // Sem atalhos de teclado no calendário: as teclas numéricas conflitavam com
  // outros atalhos do app. A seleção de turmas é feita por clique/toque.

  const handleExportCalendar = () => {
    const data = {
      type: 'people-scheduler-calendar',
      version: 4,
      year: state.year,
      calendar: state.calendar,
      calendarEvents: state.calendarEvents || {},
      scaleGroups: state.scaleGroups,
      scaleGroupDefs: state.scaleGroupDefs || [],
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
              ...(json.calendarEvents ? { calendarEvents: { ...(state.calendarEvents || {}), ...json.calendarEvents } } : {}),
              ...(json.scaleGroups ? { scaleGroups: json.scaleGroups } : {}),
              ...(json.scaleGroupDefs ? { scaleGroupDefs: json.scaleGroupDefs } : {}),
              ...(json.year ? { year: json.year } : {}),
            });
            showNotice('Calendário de escala importado com sucesso (folgas + feriados + turmas)!');
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
              const offGroups = getDayOffGroups(state.calendar, dayStr);
              const holiday = getDayHoliday(state.calendar, dayStr);
              const localEvents = (state.calendarEvents || {})[dayStr] || [];
              const primaryGroup = offGroups[0];
              // 2+ turmas em folga: fundo fatiado com as cores das turmas.
              const dayHexes = offGroups.map(hexForGroup);
              const multiStyle: React.CSSProperties | undefined =
                dayHexes.length > 1
                  ? { background: multiCrewBackground(dayHexes), color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.55)' }
                  : undefined;
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
                  style={multiStyle}
                  className={`aspect-square text-[9.5px] font-bold rounded flex flex-col items-center justify-center relative transition-all cursor-pointer ${
                    dayHexes.length > 1
                      ? ''
                      : primaryGroup
                        ? colorForGroup(primaryGroup)
                        : 'bg-[var(--surface-2)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)] text-[var(--ink)]'
                  } ${holiday.isHoliday ? 'ring-1 ring-rose-500/70' : ''} ${isSelectedDay ? 'ring-2 ring-[var(--ink)] font-black scale-105' : ''} ${isPast && mode === 'view' && offGroups.length === 0 ? 'opacity-80' : ''}`}
                  title={
                    mode === 'config'
                      ? offGroups.length > 0
                        ? `Folga: ${offGroups.join(', ')} (clique para alternar)`
                        : 'Clique para marcar folga'
                      : `${offGroups.length > 0 ? `Folga: ${offGroups.join(', ')}` : 'Dia de Trabalho'}${holiday.isHoliday ? ` • 🎉 ${holiday.title || 'Feriado'}${holiday.allowWork ? ' (com trabalho)' : ''}` : ''}${localEvents.length > 0 ? ` • ${localEvents.length} evento(s)` : ''}${dayTasks.length > 0 ? ` • ${dayTasks.length} tarefa(s)` : ''}${dayGoogleEvents.length > 0 ? ` • ${dayGoogleEvents.length} evento(s) no Calendar` : ''}`
                  }
                >
                  <span>{dayNum}</span>
                  {holiday.isHoliday && <span className="text-[7px] leading-none">🎉</span>}
                  {offGroups.length > 1 && (
                    <span className="text-[7px] leading-tight opacity-90 truncate max-w-full px-0.5">
                      {offGroups.join('·')}
                    </span>
                  )}
                  {localEvents.length > 0 && mode === 'view' && (
                    <span className="absolute top-0 left-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 ring-1 ring-white" />
                  )}
                  {/* Indicators for tasks & google events */}
                  {mode === 'view' && (dayTasks.length > 0 || (showGoogleEvents && dayGoogleEvents.length > 0)) && (
                    <div className="absolute bottom-0.5 flex items-center gap-0.5">
                      {dayTasks.length > 0 && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            primaryGroup ? 'bg-white ring-1 ring-black/30' : 'bg-[var(--primary)]'
                          }`}
                        />
                      )}
                      {showGoogleEvents && dayGoogleEvents.length > 0 && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            primaryGroup ? 'bg-sky-200 ring-1 ring-black/30' : 'bg-sky-500'
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
  }, [state.year, state.calendar, state.calendarEvents, state.selectedDate, state.scaleGroups, state.scaleGroupDefs, markDayScale, setDayOffGroups, setDate, mode, todayStr, activeTasks, googleEvents, showGoogleEvents]);

  const buildDayDetail = (dayStr: string) => {
    const [y, m, d] = dayStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const fullDate = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const offGroups = getDayOffGroups(state.calendar, dayStr);
    const holiday = getDayHoliday(state.calendar, dayStr);
    const localEvents = (state.calendarEvents || {})[dayStr] || [];
    const isPast = dayStr < todayStr;

    const counts: Record<string, number> = {};
    const offCollaborators: Collaborator[] = [];
    const offByGroup: Record<string, Collaborator[]> = {};
    state.collaborators.forEach((c) => {
      const st = getCollaboratorStatus(c, dayStr, state).status;
      counts[st] = (counts[st] || 0) + 1;
      if (offGroups.includes(c.scale)) {
        offCollaborators.push(c);
        if (!offByGroup[c.scale]) offByGroup[c.scale] = [];
        offByGroup[c.scale].push(c);
      }
    });

    const historyEntry = state.history.find((h) => h.date === dayStr);
    const manualOverrides = Object.keys(state.attendance[dayStr] || {}).length;
    const dayTasks = allScheduledTasks.filter((t) => isTaskDueOnDate(t, dayStr, state.calendar));
    const dayGoogleEvents = googleEvents.filter((ev) => {
      const evDate = (ev.start?.dateTime || ev.start?.date || '').slice(0, 10);
      return evDate === dayStr;
    });

    return { weekday, fullDate, offGroups, offGroup: offGroups[0], holiday, localEvents, isPast, counts, offCollaborators, offByGroup, historyEntry, manualOverrides, dayTasks, dayGoogleEvents };
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
          <div className="flex items-center gap-1">
            <label className="font-extrabold text-[var(--muted)] text-[11px]">Ano:</label>
            <button
              onClick={() => setYear(state.year - 1)}
              className="p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
              title="Ano anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <Input
              type="number"
              value={state.year}
              onChange={(e) => {
                const y = Number(e.target.value);
                if (Number.isFinite(y) && y >= 1900 && y <= 2200) setYear(Math.trunc(y));
              }}
              className="!h-8 !text-xs w-20 text-center"
            />
            <button
              onClick={() => setYear(state.year + 1)}
              className="p-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
              title="Próximo ano"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {mode === 'config' && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="font-extrabold text-[var(--muted)] text-[11px]">Folga Para (pode marcar várias):</label>
              {scaleGroups.length === 0 ? (
                <span className="text-[11px] text-[var(--muted)] italic font-bold">
                  Nenhuma turma cadastrada — crie a primeira abaixo para começar a marcar folgas.
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-1">
                  {scaleGroups.map((grp) => (
                    <button
                      key={grp}
                      onClick={() => toggleSelectedOff(grp)}
                      title="Clique para selecionar/deselecionar"
                      className={`px-2.5 py-1 rounded-md text-[11px] font-black transition-all cursor-pointer ${
                        selectedOff.includes(grp)
                          ? `${colorForGroup(grp)} ring-2 ring-[var(--ink)] shadow-2xs`
                          : 'bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)] hover:border-[var(--primary-border)]'
                      }`}
                    >
                      {grp}
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedOff([])}
                    className="px-2 py-1 rounded-md text-[10px] font-bold border border-[var(--line)] cursor-pointer bg-[var(--surface-2)] text-[var(--muted)]"
                  >
                    Limpar
                  </button>
                </div>
              )}
              <form onSubmit={handleAddCrew} className="flex flex-wrap items-center gap-1.5">
                <Input
                  value={newCrewName}
                  onChange={(e) => setNewCrewName(e.target.value)}
                  placeholder="Nova turma: ex. Alfa, Noturna..."
                  className="!h-8 !text-xs w-44"
                />
                <div className="flex items-center gap-1" title="Cor da turma">
                  {CREW_PALETTE.map((p) => (
                    <button
                      key={p.hex}
                      type="button"
                      onClick={() => setNewCrewColor(p.hex)}
                      className={`w-5 h-5 rounded-full cursor-pointer transition-all ${p.cls.split(' ')[0]} ${
                        newCrewColor === p.hex ? 'ring-2 ring-[var(--ink)] scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: p.hex }}
                      title={`Cor ${p.hex}`}
                    />
                  ))}
                </div>
                <Button variant="outline" size="sm" icon={Plus} onClick={handleAddCrew}>
                  Criar turma
                </Button>
              </form>
            </div>
          )}

          {mode === 'config' && (
            <div className="ml-auto flex items-center gap-2">
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
                {scaleGroups.length === 0 ? (
                  <span className="text-[var(--muted)] italic">Nenhuma turma cadastrada</span>
                ) : (
                  scaleGroups.map((grp) => (
                    <div key={grp} className="flex items-center gap-1">
                      <span
                        className="w-2.5 h-2.5 rounded-xs ring-1 ring-black/20"
                        style={{ backgroundColor: hexForGroup(grp) }}
                      ></span>
                      <span className="text-[var(--muted)]">{grp}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </Toolbar>

        {mode === 'config' && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[var(--muted)] border-t border-[var(--line)] pt-2.5">
            <span className="text-[10px]">
              Selecione as turmas e clique nos dias para marcar as folgas — várias turmas podem folgar no mesmo dia (o dia exibe as cores combinadas)
            </span>
            <Badge tone="primary" className="ml-auto">Fechar ano calendário: {state.year}</Badge>
          </div>
        )}

        {mode === 'config' && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-bold text-amber-800 dark:text-amber-300">
            <Settings className="w-3.5 h-3.5 shrink-0" />
            <span>Modo de configuração ativo — selecione as turmas e clique nos dias para marcar as folgas (várias por dia). Use "Concluir" para voltar à visualização.</span>
          </div>
        )}

        {mode === 'config' && (
          <div className="mt-3 border border-[var(--line)] rounded-xl p-3">
            <h4 className="text-xs font-black text-[var(--ink)]">Minhas turmas</h4>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">Crie turmas com o nome e a cor que fizerem sentido na sua operação. Nenhuma turma vem pronta no app.</p>
            <div className="mt-2 flex flex-col gap-2">
              {scaleGroups.map((grp) => (
                <div key={grp} className="flex flex-wrap items-center gap-2 px-2 py-1.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-lg">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black ${colorForGroup(grp)}`}>
                    {grp}
                  </span>
                  <div className="flex items-center gap-1" title={`Cor da turma ${grp}`}>
                    {CREW_PALETTE.map((p) => (
                      <button
                        key={p.hex}
                        onClick={() => upsertScaleGroup(grp, { color: p.hex })}
                        className={`w-5 h-5 rounded-full cursor-pointer transition-all ${
                          hexForGroup(grp).toLowerCase() === p.hex.toLowerCase()
                            ? 'ring-2 ring-[var(--ink)] scale-110'
                            : 'opacity-60 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: p.hex }}
                        title={`${grp} → ${p.hex}`}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Remover a turma "${grp}"? Os dias marcados com ela serão mantidos como histórico.`)) {
                        removeScaleGroup(grp);
                        setSelectedOff((prev) => prev.filter((g) => g !== grp));
                      }
                    }}
                    className="ml-auto p-1 text-[var(--muted)] hover:text-rose-600 cursor-pointer"
                    title={`Remover turma ${grp}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {scaleGroups.length === 0 && (
                <span className="text-[11px] text-[var(--muted)] italic">Nenhuma turma cadastrada — crie a primeira no campo acima.</span>
              )}
            </div>
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
              {/* Scale status (multi-folga + feriado com título; feriado pode ter trabalho) */}
              <div className="flex flex-wrap items-center gap-2">
                {detail.offGroups.length > 0 ? (
                  detail.offGroups.map((g) => (
                    <Badge key={g} tone="primary" className={`${colorForGroup(g)} border border-black/10`}>
                      <CalendarIcon className="w-3 h-3 shrink-0" />
                      Folga: {g}
                    </Badge>
                  ))
                ) : (
                  <Badge tone="neutral">Dia normal de trabalho</Badge>
                )}
                {detail.holiday.isHoliday && (
                  <Badge tone="warning">
                    🎉 {detail.holiday.title || 'Feriado'}{detail.holiday.allowWork ? ' (com trabalho)' : ''}
                  </Badge>
                )}
                {detail.isPast && (
                  <Badge tone="info">Dados registrados deste dia</Badge>
                )}
              </div>

              {/* Feriado com título + eventos locais */}
              <div className="border border-[var(--line)] rounded-xl p-3 space-y-2 bg-[var(--surface-2)]/50">
                <h4 className="text-xs font-black text-[var(--ink)]">🎉 Feriado / Eventos do dia ({detail.localEvents.length})</h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Título do feriado — ex: Natal, Tiradentes..."
                    value={holidayDraft[detailDay]?.title ?? detail.holiday.title ?? ''}
                    onChange={(e) =>
                      setHolidayDraft((prev) => ({
                        ...prev,
                        [detailDay]: {
                          title: e.target.value,
                          allowWork: prev[detailDay]?.allowWork ?? detail.holiday.allowWork ?? true,
                        },
                      }))
                    }
                    className="!text-xs"
                  />
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--muted)] whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={holidayDraft[detailDay]?.allowWork ?? detail.holiday.allowWork ?? true}
                      onChange={(e) =>
                        setHolidayDraft((prev) => ({
                          ...prev,
                          [detailDay]: {
                            title: prev[detailDay]?.title ?? detail.holiday.title ?? '',
                            allowWork: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>Permitir trabalho no feriado</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Check}
                    onClick={() => {
                      const draft = holidayDraft[detailDay] ?? { title: detail.holiday.title ?? '', allowWork: detail.holiday.allowWork ?? true };
                      if (!draft.title.trim()) {
                        setDayHoliday(detailDay, null);
                      } else {
                        setDayHoliday(detailDay, { title: draft.title.trim(), isHoliday: true, allowWork: draft.allowWork });
                      }
                      setHolidayDraft((prev) => {
                        const next = { ...prev };
                        delete next[detailDay];
                        return next;
                      });
                      showNotice(draft.title.trim() ? `Feriado "${draft.title.trim()}" salvo (trabalho ${draft.allowWork ? 'permitido' : 'pausado'}).` : 'Feriado removido.');
                    }}
                  >
                    Salvar feriado
                  </Button>
                  {detail.holiday.isHoliday && (
                    <Button variant="ghost" size="sm" icon={Trash2} onClick={() => {
                      setDayHoliday(detailDay, null);
                      setHolidayDraft((prev) => {
                        const next = { ...prev };
                        delete next[detailDay];
                        return next;
                      });
                    }}>
                      Remover feriado
                    </Button>
                  )}
                </div>
                {detail.localEvents.length > 0 ? (
                  <div className="space-y-1.5">
                    {detail.localEvents.map((ev) => (
                      <div key={ev.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs">
                        <span className="font-bold text-[var(--ink)] truncate">
                          {ev.type === 'feriado' ? '🎉 ' : ev.type === 'folga' ? '🛌 ' : '📌 '}{ev.title}
                          {ev.startTime ? ` • ${ev.startTime}${ev.endTime ? `-${ev.endTime}` : ''}` : ''}
                        </span>
                        <button onClick={() => removeCalendarEvent(detailDay, ev.id)} className="text-rose-500 hover:text-rose-700 cursor-pointer" title="Remover evento">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--muted)] italic">Nenhum evento local neste dia.</p>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const title = (localEventDraft[detailDay] || '').trim();
                    if (!title) return;
                    addCalendarEvent({ date: detailDay, title, type: 'evento', allowWork: true });
                    setLocalEventDraft((prev) => ({ ...prev, [detailDay]: '' }));
                  }}
                  className="flex gap-1.5"
                >
                  <Input
                    placeholder="Novo evento: ex. Manutenção, Auditoria..."
                    value={localEventDraft[detailDay] || ''}
                    onChange={(e) => setLocalEventDraft((prev) => ({ ...prev, [detailDay]: e.target.value }))}
                    className="!text-xs"
                  />
                  <Button variant="outline" size="sm" icon={Plus} onClick={() => {
                    const title = (localEventDraft[detailDay] || '').trim();
                    if (!title) return;
                    addCalendarEvent({ date: detailDay, title, type: 'evento', allowWork: true });
                    setLocalEventDraft((prev) => ({ ...prev, [detailDay]: '' }));
                  }}>
                    Adicionar
                  </Button>
                </form>
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

              {/* Off group members (multi-turma) */}
              {detail.offGroups.length > 0 && detail.offCollaborators.length > 0 && (
                <div className="space-y-2">
                  {detail.offGroups.map((g) => {
                    const members = detail.offByGroup[g] || [];
                    if (members.length === 0) return null;
                    return (
                      <div key={g}>
                        <h4 className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5 mb-2">
                          <Users className="w-3.5 h-3.5 text-[var(--primary)]" />
                          <span>Turma {g} em folga ({members.length})</span>
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {members.slice(0, 14).map((c) => (
                            <span key={c.id} className="px-2 py-0.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[10px] font-bold text-[var(--ink)]">
                              {c.name}
                            </span>
                          ))}
                          {members.length > 14 && (
                            <span className="px-2 py-0.5 text-[10px] font-black text-[var(--muted)]">
                              +{members.length - 14} mais
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
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