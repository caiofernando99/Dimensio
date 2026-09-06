import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Clock,
  Users,
  Layers,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Coffee,
  ArrowRight,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Sparkles,
  Search,
  Filter,
  Activity,
  Calendar,
  Zap,
  Target,
  ShieldCheck,
  ChevronRight,
  Timer,
  BarChart3,
  BellRing,
  Send,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  SectionHeader,
  Button,
  Badge,
  StatCard,
  EmptyState,
} from './ui';
import {
  formatDateBR,
  compareStringsBR,
  getCollaboratorStatus,
  matchesCollaboratorSearch,
} from '../utils/helpers';
import { playBreakSound } from '../utils/audioAlert';
import { dispatchHighlightToExtension, dispatchOpenSystemToExtension } from '../utils/extensionInstaller';
import { collabMenuOnContext } from '../utils/collabContextMenu';

interface BreakEventCollab {
  collabId: string;
  collabName: string;
  collabRole: string;
  collabShift: string;
  collabTeamLeader: string;
  taskName: string;
  taskExternalUrl?: string;
  breakSlotId: string;
  breakSlotTime: string; // e.g. "12:00"
  minutesUntilStart: number;
  minutesUntilEnd: number;
  status: 'upcoming' | 'ongoing' | 'returning';
}

export const OperationalMonitorPanel: React.FC = () => {
  const { state, showNotice, broadcastNotice } = useApp();

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShift, setSelectedShift] = useState<string>(
    state.selectedShiftFilter && state.selectedShiftFilter !== 'ALL' && state.selectedShiftFilter !== 'todos'
      ? state.selectedShiftFilter
      : state.teamShift || 'ALL'
  );
  const [selectedTL, setSelectedTL] = useState<string>(
    state.selectedTLFilter && state.selectedTLFilter !== 'ALL' && state.selectedTLFilter !== 'todos'
      ? state.selectedTLFilter
      : 'ALL'
  );
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedCollabId, setCopiedCollabId] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const alertedBreaksRef = useRef<Set<string>>(new Set());

  // Keep live time ticking every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync shift from global filter if changes
  useEffect(() => {
    if (state.selectedShiftFilter && state.selectedShiftFilter !== 'ALL' && state.selectedShiftFilter !== 'todos') {
      setSelectedShift(state.selectedShiftFilter);
    }
  }, [state.selectedShiftFilter]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const activeDate = state.selectedDate || new Date().toISOString().slice(0, 10);
  const dayAttendance = state.attendance[activeDate] || {};
  const dayIntervals = state.intervals[activeDate] || {};

  // Parse time helper (returns minutes from midnight)
  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return -1;
    const parts = timeStr.trim().split(':');
    if (parts.length < 2) return -1;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return -1;
    return h * 60 + m;
  };

  const currentMinutesFromMidnight = currentTime.getHours() * 60 + currentTime.getMinutes();

  // Filtered active collaborators
  const activeCollaborators = useMemo(() => {
    return state.collaborators.filter((c) => {
      const colShift = c.shift || 'Geral';
      const matchesShift = selectedShift === 'ALL' || selectedShift === 'todos' || colShift === selectedShift;
      const colTL = c.teamLeader || state.defaultTeamLeader || 'Sem Time';
      const matchesTL = selectedTL === 'ALL' || selectedTL === 'todos' || colTL === selectedTL;
      if (!matchesShift || !matchesTL) return false;

      const statusInfo = getCollaboratorStatus(c, activeDate, state);
      return statusInfo.status === 'presente' || statusInfo.status === 'atraso';
    });
  }, [state.collaborators, selectedShift, selectedTL, activeDate, state]);

  // Map each collaborator to their assigned task
  const collabTaskMap = useMemo(() => {
    const map = new Map<string, { id: string; name: string; externalUrl?: string }>();
    state.tasks.forEach((t) => {
      (t.members || []).forEach((collabId) => {
        map.set(collabId, { id: t.id, name: t.name, externalUrl: t.externalUrl });
      });
    });
    return map;
  }, [state.tasks]);

  // Analyze all break slots and find who is going soon, ongoing, or returning
  const breakEvents = useMemo(() => {
    const list: BreakEventCollab[] = [];
    const DEFAULT_BREAK_DURATION_MINUTES = 60; // 1 hora de almoço/refeição padrão

    Object.entries(dayIntervals).forEach(([slotId, memberIds]) => {
      const slot = state.breaks.find((b) => b.id === slotId);
      if (!slot || !slot.time) return;

      const slotMinutes = parseTimeToMinutes(slot.time);
      if (slotMinutes < 0) return;

      const breakDuration = slot.capacity ? 60 : DEFAULT_BREAK_DURATION_MINUTES;
      const endSlotMinutes = slotMinutes + breakDuration;

      const minutesUntilStart = slotMinutes - currentMinutesFromMidnight;
      const minutesUntilEnd = endSlotMinutes - currentMinutesFromMidnight;

      memberIds.forEach((mId) => {
        const collab = activeCollaborators.find((c) => c.id === mId);
        if (!collab) return;

        const taskInfo = collabTaskMap.get(collab.id);

        let status: 'upcoming' | 'ongoing' | 'returning' | null = null;

        // Ongoing: currently between start and end
        if (currentMinutesFromMidnight >= slotMinutes && currentMinutesFromMidnight < endSlotMinutes) {
          // If in the last 10 minutes of the break: returning soon
          if (minutesUntilEnd <= 10 && minutesUntilEnd >= 0) {
            status = 'returning';
          } else {
            status = 'ongoing';
          }
        }
        // Upcoming: starting within the next 20 minutes
        else if (minutesUntilStart > 0 && minutesUntilStart <= 25) {
          status = 'upcoming';
        }

        if (status) {
          list.push({
            collabId: collab.id,
            collabName: collab.name,
            collabRole: collab.role,
            collabShift: collab.shift,
            collabTeamLeader: collab.teamLeader || state.defaultTeamLeader || '',
            taskName: taskInfo?.name || 'Não alocado',
            taskExternalUrl: taskInfo?.externalUrl,
            breakSlotId: slot.id,
            breakSlotTime: slot.time,
            minutesUntilStart,
            minutesUntilEnd,
            status,
          });
        }
      });
    });

    return list;
  }, [dayIntervals, state.breaks, activeCollaborators, currentMinutesFromMidnight, collabTaskMap, state.defaultTeamLeader]);

  const upcomingBreaks = breakEvents.filter((b) => b.status === 'upcoming').sort((a, b) => a.minutesUntilStart - b.minutesUntilStart);
  const ongoingBreaks = breakEvents.filter((b) => b.status === 'ongoing').sort((a, b) => a.minutesUntilEnd - b.minutesUntilEnd);
  const returningBreaks = breakEvents.filter((b) => b.status === 'returning').sort((a, b) => a.minutesUntilEnd - b.minutesUntilEnd);

  // Trigger audio alert when someone enters <= 5 min for break
  useEffect(() => {
    if (!soundAlertsEnabled) return;
    upcomingBreaks.forEach((b) => {
      if (b.minutesUntilStart <= 5 && b.minutesUntilStart >= 4) {
        const key = `${b.collabId}_${b.breakSlotTime}_${activeDate}`;
        if (!alertedBreaksRef.current.has(key)) {
          alertedBreaksRef.current.add(key);
          playBreakSound();
        }
      }
    });
  }, [upcomingBreaks, soundAlertsEnabled, activeDate]);

  // Copy collaborator name and optional external URL open
  const handleCollabAction = async (collabName: string, collabId: string, externalUrl?: string, taskName?: string) => {
    try {
      await navigator.clipboard.writeText(collabName);
      setCopiedCollabId(collabId);
      setTimeout(() => setCopiedCollabId(null), 2000);

      if (externalUrl) {
        dispatchHighlightToExtension([collabName], taskName || 'Tarefa');
        dispatchOpenSystemToExtension(externalUrl);
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
        showNotice(`📋 "${collabName}" copiado para a área de transferência e abrindo sistema (${taskName || 'Tarefa'})!`);
      } else {
        showNotice(`📋 "${collabName}" copiado para a área de transferência!`);
      }
    } catch {
      showNotice(`📋 "${collabName}" selecionado.`);
    }
  };

  // Copy all task members
  const handleCopyTaskMembers = async (taskName: string, memberNames: string[], externalUrl?: string) => {
    if (memberNames.length === 0) {
      showNotice('Nenhum colaborador alocado nesta tarefa.');
      return;
    }
    const text = memberNames.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      if (externalUrl) {
        dispatchHighlightToExtension(memberNames, taskName);
        dispatchOpenSystemToExtension(externalUrl);
        window.open(externalUrl, '_blank', 'noopener,noreferrer');
        showNotice(`📋 ${memberNames.length} colaboradores de "${taskName}" copiados e abrindo o sistema!`);
      } else {
        showNotice(`📋 ${memberNames.length} colaboradores de "${taskName}" copiados para a área de transferência!`);
      }
    } catch {
      showNotice('Erro ao copiar colaboradores.');
    }
  };

  // Group tasks with present members
  const presentCollabIdSet = new Set(activeCollaborators.map((c) => c.id));

  const tasksWithMembers = useMemo(() => {
    return state.tasks
      .filter((t) => t.active !== false)
      .map((t) => {
        const assignedCollaborators = state.collaborators.filter(
          (c) => t.members.includes(c.id) && presentCollabIdSet.has(c.id)
        );

        const filteredMembers = searchTerm.trim()
          ? assignedCollaborators.filter((c) => matchesCollaboratorSearch(c, searchTerm, { defaultTeamLeader: state.defaultTeamLeader }))
          : assignedCollaborators;

        return {
          task: t,
          assigned: assignedCollaborators,
          filtered: filteredMembers,
          count: assignedCollaborators.length,
          targetHeadcount: t.minHeadcount || t.maxHeadcount || 0,
        };
      })
      .filter((item) => (searchTerm.trim() ? item.filtered.length > 0 : true))
      .sort((a, b) => b.count - a.count || compareStringsBR(a.task.name, b.task.name));
  }, [state.tasks, state.collaborators, presentCollabIdSet, searchTerm, state.defaultTeamLeader]);

  const totalPresentInTasks = tasksWithMembers.reduce((acc, t) => acc + t.count, 0);
  const unassignedPresent = activeCollaborators.filter((c) => !collabTaskMap.has(c.id));

  // Shift configs and timings
  const activeShiftConfig = state.shiftConfigs?.[selectedShift];
  const shiftTimeStr = activeShiftConfig
    ? `${activeShiftConfig.startTime || '—'} às ${activeShiftConfig.endTime || '—'}`
    : 'Turno Operacional';

  // Sector Metrics & Extension Connected metrics
  const metricsWithReadings = useMemo(() => {
    const defs = state.metricDefinitions || [];
    const readings = state.metricReadings || [];
    return defs.map((d) => {
      const latestReading = readings
        .filter((r) => r.metricId === d.id)
        .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0];
      const firstField = d.fields[0];
      const rawVal = latestReading && firstField ? latestReading.values[firstField.id] : undefined;
      return {
        definition: d,
        reading: latestReading,
        valStr: rawVal || '—',
      };
    });
  }, [state.metricDefinitions, state.metricReadings]);

  // Service Requests (Pending)
  const serviceRequests = state.serviceRequests || [];
  const pendingRequests = useMemo(() => {
    return serviceRequests.filter((r) => {
      const isPending = r.status === 'pendente' || r.status === 'lido';
      if (!isPending) return false;
      if (selectedShift !== 'ALL' && selectedShift !== 'todos' && r.shift && r.shift !== selectedShift) return false;
      return true;
    });
  }, [serviceRequests, selectedShift]);
  const urgentPendingCount = pendingRequests.filter((r) => r.priority === 'alta' || r.priority === 'urgente').length;

  return (
    <div
      ref={containerRef}
      className={`space-y-5 transition-all ${
        isFullscreen ? 'p-6 bg-[var(--bg)] overflow-y-auto min-h-screen z-50' : ''
      }`}
    >
      {/* Header Bar of Monitor */}
      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-600/30 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-[var(--ink)] tracking-tight">
                Monitor Operacional em Tempo Real
              </h2>
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <Badge tone="success" className="text-[10px] uppercase font-bold">
                Ao Vivo
              </Badge>
            </div>
            <p className="text-xs text-[var(--muted)] font-medium">
              Acompanhamento contínuo de tarefas, saídas e retornos de intervalo, e metas do setor.
            </p>
          </div>
        </div>

        {/* Live Clock & Fullscreen / Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Live Clock */}
          <div className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--line)] px-3 py-1.5 rounded-lg shadow-xs">
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div className="font-mono text-sm font-black text-[var(--ink)] tracking-wider">
              {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <span className="text-[10.5px] text-[var(--muted)] font-bold">
              ({formatDateBR(activeDate)})
            </span>
          </div>

          {/* Sound Alert Toggle */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            icon={soundAlertsEnabled ? Volume2 : VolumeX}
            title={soundAlertsEnabled ? 'Alertas sonoros ativados' : 'Alertas sonoros desativados'}
            onClick={() => {
              setSoundAlertsEnabled(!soundAlertsEnabled);
              if (!soundAlertsEnabled) playBreakSound();
            }}
            className={soundAlertsEnabled ? '!text-indigo-600 dark:!text-indigo-400' : '!text-slate-400'}
          >
            {soundAlertsEnabled ? 'Sons Ativos' : 'Mudo'}
          </Button>

          {/* Fullscreen TV Mode */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            icon={isFullscreen ? Minimize2 : Maximize2}
            onClick={toggleFullscreen}
            title="Expandir para modo Monitor / TV"
          >
            {isFullscreen ? 'Sair da Tela Cheia' : 'Modo Monitor / TV'}
          </Button>
        </div>
      </div>

      {/* Filter and Overview Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          icon={Users}
          label="Presentes na Operação"
          value={activeCollaborators.length}
          hint={`${totalPresentInTasks} em postos ativos • ${unassignedPresent.length} sem tarefa`}
          tone="primary"
        />
        <StatCard
          icon={Coffee}
          label="Saindo p/ Intervalo"
          value={upcomingBreaks.length}
          hint={upcomingBreaks.length > 0 ? `Próximo slot às ${upcomingBreaks[0].breakSlotTime}` : 'Nenhuma saída nos próx. 25 min'}
          tone={upcomingBreaks.length > 0 ? 'warning' : 'default'}
        />
        <StatCard
          icon={Timer}
          label="Em Intervalo Agora"
          value={ongoingBreaks.length + returningBreaks.length}
          hint={returningBreaks.length > 0 ? `${returningBreaks.length} retornando em < 10 min` : 'Operação em andamento normal'}
          tone={returningBreaks.length > 0 ? 'success' : 'default'}
        />
        <StatCard
          icon={Layers}
          label="Postos Atendidos"
          value={tasksWithMembers.filter((t) => t.count > 0).length}
          hint={`de ${state.tasks.filter((t) => t.active !== false).length} tarefas cadastradas`}
          tone="success"
        />
        <StatCard
          icon={Send}
          label="Pedidos Pendentes"
          value={pendingRequests.length}
          hint={
            urgentPendingCount > 0
              ? `🚨 ${urgentPendingCount} chamado(s) urgente(s)`
              : pendingRequests.length > 0
              ? `${pendingRequests.length} chamado(s) aguardando`
              : 'Nenhum pedido pendente'
          }
          tone={urgentPendingCount > 0 ? 'danger' : pendingRequests.length > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Quick Filters Bar */}
      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[var(--muted)] uppercase tracking-wider mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros do Monitor:</span>
          </div>

          {/* Shift selector pills */}
          <div className="flex items-center gap-1 bg-[var(--bg)] p-1 rounded-lg border border-[var(--line)]">
            <button
              type="button"
              onClick={() => setSelectedShift('ALL')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                selectedShift === 'ALL' || selectedShift === 'todos'
                  ? 'bg-[var(--primary)] text-white shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Todos Turnos
            </button>
            {(state.shifts || ['T1', 'T2', 'T3', 'ADM']).map((sh) => (
              <button
                key={sh}
                type="button"
                onClick={() => setSelectedShift(sh)}
                className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                  selectedShift === sh
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                Turno {sh}
              </button>
            ))}
          </div>

          {/* Team Leader Selector */}
          {(state.teamLeaders || []).length > 0 && (
            <select
              value={selectedTL}
              onChange={(e) => setSelectedTL(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-xs font-bold text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] cursor-pointer"
            >
              <option value="ALL">Todos os Times (TLs)</option>
              {(state.teamLeaders || []).map((tl) => (
                <option key={tl} value={tl}>
                  Time: {tl}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Real-time search inside monitor */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar colaborador ou posto..."
            className="w-full pl-8.5 pr-3 py-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-xs font-medium text-[var(--ink)] placeholder-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: BREAK RADAR (INTERVALOS IMINENTES: SAÍDAS & RETORNOS)           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Saindo em Breve */}
        <Card className="!border-amber-500/40 bg-amber-500/[0.02]">
          <CardHeader
            icon={<Coffee className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
            title="Saindo para Intervalo em Breve"
            subtitle="Colaboradores que devem pausar nos próximos 25 minutos"
            actions={
              <Badge tone={upcomingBreaks.length > 0 ? 'warning' : 'neutral'}>
                {upcomingBreaks.length} saindo
              </Badge>
            }
          />

          <div className="mt-3 space-y-2">
            {upcomingBreaks.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--muted)] italic bg-[var(--bg)] rounded-lg border border-[var(--line)]">
                Nenhum colaborador com saída agendada para os próximos 25 minutos.
              </div>
            ) : (
              upcomingBreaks.map((b) => (
                <div
                  key={`${b.collabId}_${b.breakSlotTime}`}
                  className="p-2.5 rounded-lg bg-[var(--paper)] border border-amber-500/30 flex items-center justify-between gap-2 text-xs shadow-xs hover:border-amber-500 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[var(--ink)] truncate">{b.collabName}</span>
                      <span className="font-mono text-[10.5px] font-black text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                        {b.breakSlotTime}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--muted)] truncate flex items-center gap-1 mt-0.5">
                      <Layers className="w-3 h-3 shrink-0" />
                      <span>{b.taskName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full">
                      em {b.minutesUntilStart} min
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCollabAction(b.collabName, b.collabId, b.taskExternalUrl, b.taskName)}
                      title="Copiar nome do colaborador e abrir sistema da tarefa"
                      className="p-1 rounded bg-[var(--bg)] hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Card 2: Em Intervalo Agora */}
        <Card className="!border-blue-500/30 bg-blue-500/[0.02]">
          <CardHeader
            icon={<Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
            title="Em Intervalo Agora"
            subtitle="Colaboradores que estão no horário de pausa / refeição"
            actions={
              <Badge tone={ongoingBreaks.length > 0 ? 'info' : 'neutral'}>
                {ongoingBreaks.length} pausados
              </Badge>
            }
          />

          <div className="mt-3 space-y-2">
            {ongoingBreaks.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--muted)] italic bg-[var(--bg)] rounded-lg border border-[var(--line)]">
                Nenhum colaborador em pausa no exato momento.
              </div>
            ) : (
              ongoingBreaks.map((b) => (
                <div
                  key={`${b.collabId}_${b.breakSlotTime}`}
                  className="p-2.5 rounded-lg bg-[var(--paper)] border border-blue-500/30 flex items-center justify-between gap-2 text-xs shadow-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[var(--ink)] truncate">{b.collabName}</span>
                      <span className="text-[10px] text-[var(--muted)]">({b.breakSlotTime})</span>
                    </div>
                    <div className="text-[11px] text-[var(--muted)] truncate flex items-center gap-1 mt-0.5">
                      <Layers className="w-3 h-3 shrink-0" />
                      <span>Posto de origem: {b.taskName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-extrabold text-blue-700 dark:text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded-full">
                      restam {b.minutesUntilEnd} min
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Card 3: Retornando em Breve */}
        <Card className="!border-emerald-500/40 bg-emerald-500/[0.02]">
          <CardHeader
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
            title="Retornando para o Posto"
            subtitle="Colaboradores finalizando o intervalo em menos de 10 minutos"
            actions={
              <Badge tone={returningBreaks.length > 0 ? 'success' : 'neutral'}>
                {returningBreaks.length} retornando
              </Badge>
            }
          />

          <div className="mt-3 space-y-2">
            {returningBreaks.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--muted)] italic bg-[var(--bg)] rounded-lg border border-[var(--line)]">
                Nenhum colaborador com retorno iminente nos próximos 10 minutos.
              </div>
            ) : (
              returningBreaks.map((b) => (
                <div
                  key={`${b.collabId}_${b.breakSlotTime}`}
                  className="p-2.5 rounded-lg bg-[var(--paper)] border border-emerald-500/30 flex items-center justify-between gap-2 text-xs shadow-xs hover:border-emerald-500 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[var(--ink)] truncate">{b.collabName}</span>
                      <Badge tone="success" className="text-[9.5px]">Retorno</Badge>
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold truncate flex items-center gap-1 mt-0.5">
                      <ArrowRight className="w-3 h-3 shrink-0" />
                      <span>Reassumir: {b.taskName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full animate-pulse">
                      volta em {b.minutesUntilEnd} min
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCollabAction(b.collabName, b.collabId, b.taskExternalUrl, b.taskName)}
                      title="Copiar nome do colaborador e abrir sistema da tarefa"
                      className="p-1 rounded bg-[var(--bg)] hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: LIVE TASK STATIONS & ALLOCATED COLLABORATORS                   */}
      {/* ========================================================================= */}
      <Card>
        <CardHeader
          icon={<Layers className="w-4.5 h-4.5" />}
          title="Postos de Trabalho & Dimensionamento Ativo"
          subtitle="Visualize os colaboradores posicionados em cada tarefa, links diretos para os sistemas e status de intervalo ao vivo."
          actions={
            <div className="flex items-center gap-2">
              <Badge tone="primary">
                {totalPresentInTasks} alocados em {tasksWithMembers.filter((t) => t.count > 0).length} postos
              </Badge>
            </div>
          }
        />

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tasksWithMembers.map(({ task, assigned, filtered, count, targetHeadcount }) => {
            const hasExternalUrl = !!task.externalUrl;
            const isUnderstaffed = targetHeadcount > 0 && count < targetHeadcount;
            const memberNames = assigned.map((c) => c.name);

            return (
              <div
                key={task.id}
                className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3.5 shadow-xs flex flex-col justify-between space-y-3 hover:shadow-md transition-shadow"
              >
                {/* Task Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-extrabold text-sm text-[var(--ink)] truncate" title={task.name}>
                          {task.name}
                        </h3>
                        {task.priority && (
                          <Badge tone="purple" className="text-[9.5px]">
                            P{task.priority}
                          </Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-[11px] text-[var(--muted)] line-clamp-1 mt-0.5">
                          {task.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)]">
                        {count} {targetHeadcount > 0 ? `/ ${targetHeadcount}` : 'HC'}
                      </span>
                    </div>
                  </div>

                  {/* Task System Action Link Button */}
                  {hasExternalUrl && (
                    <div className="mt-2">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        fullWidth
                        icon={ExternalLink}
                        onClick={() => handleCopyTaskMembers(task.name, memberNames, task.externalUrl)}
                        title="Abrir o sistema desta tarefa com todos os nomes dos alocados copiados"
                        className="!text-[11px] !font-bold !text-indigo-600 dark:!text-indigo-400 !border-indigo-500/30 hover:!bg-indigo-500/10"
                      >
                        Abrir Sistema ({memberNames.length} Nomes na Clipboard)
                      </Button>
                    </div>
                  )}
                </div>

                {/* Collaborators Badges Grid */}
                <div className="space-y-1.5 pt-2 border-t border-[var(--line)]">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] flex items-center justify-between">
                    <span>Colaboradores Alocados ({filtered.length}):</span>
                    {filtered.length > 0 && !hasExternalUrl && (
                      <button
                        type="button"
                        onClick={() => handleCopyTaskMembers(task.name, memberNames)}
                        className="text-[10px] text-[var(--primary)] hover:underline cursor-pointer font-bold inline-flex items-center gap-0.5"
                      >
                        <Copy className="w-2.5 h-2.5" /> Copiar todos
                      </button>
                    )}
                  </div>

                  {filtered.length === 0 ? (
                    <div className="p-3 text-center text-xs text-[var(--muted)] italic bg-[var(--bg)] rounded-lg">
                      {searchTerm.trim() ? 'Nenhum colaborador encontrado nesta tarefa.' : 'Nenhum colaborador alocado neste posto.'}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
                      {filtered.map((c) => {
                        const isCopied = copiedCollabId === c.id;
                        // Check if this collaborator has an upcoming or ongoing break
                        const colBreakEvent = breakEvents.find((b) => b.collabId === c.id);

                        return (
                          <div
                            key={c.id}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${
                              colBreakEvent?.status === 'upcoming'
                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300'
                                : colBreakEvent?.status === 'ongoing'
                                ? 'bg-blue-500/10 border-blue-500/40 text-blue-800 dark:text-blue-300 opacity-60'
                                : colBreakEvent?.status === 'returning'
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                                : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                            }`}
                            onContextMenu={collabMenuOnContext(c.id)}
                            title={`${c.name} (${c.role}) • Clique para copiar ou abrir sistema`}
                          >
                            <span className="truncate max-w-[120px] font-bold">{c.name}</span>

                            {colBreakEvent?.status === 'upcoming' && (
                              <span className="text-[9.5px] font-mono font-black text-amber-700 dark:text-amber-400 bg-amber-500/20 px-1 rounded">
                                {colBreakEvent.breakSlotTime}
                              </span>
                            )}

                            {colBreakEvent?.status === 'ongoing' && (
                              <Coffee className="w-3 h-3 text-blue-500 shrink-0" />
                            )}

                            {colBreakEvent?.status === 'returning' && (
                              <span className="text-[9.5px] font-bold text-emerald-700 dark:text-emerald-400 animate-pulse">
                                Volta!
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCollabAction(c.name, c.id, task.externalUrl, task.name)}
                              className="p-0.5 rounded hover:bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                              title="Copiar nome do colaborador"
                            >
                              {isCopied ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
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
      </Card>

      {/* ========================================================================= */}
      {/* SECTION 3: SECTOR METRICS & EXTENSION DATA                                */}
      {/* ========================================================================= */}
      {metricsWithReadings.length > 0 && (
        <Card>
          <CardHeader
            icon={<BarChart3 className="w-4.5 h-4.5" />}
            title="Métricas Operacionais & Produtividade do Setor"
            subtitle="Acompanhe indicadores coletados pela extensão ou preenchidos nos sistemas."
          />

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {metricsWithReadings.map(({ definition, reading, valStr }) => {
              return (
                <div
                  key={definition.id}
                  className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3.5 shadow-xs space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <h4 className="font-extrabold text-xs text-[var(--ink)] line-clamp-1">{definition.name}</h4>
                      {definition.unit && (
                        <span className="text-[10px] text-[var(--muted)] font-medium">
                          Unidade: {definition.unit}
                        </span>
                      )}
                    </div>
                    {reading && (
                      <Badge tone="success" className="text-[9.5px]">
                        Conectado
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-xl font-black text-[var(--ink)]">
                      {valStr}
                    </span>
                    {definition.targetType && (
                      <span className="text-[10px] font-bold text-[var(--muted)] capitalize">
                        {definition.targetType}
                      </span>
                    )}
                  </div>

                  {reading?.capturedAt && (
                    <div className="text-[10px] text-[var(--muted)] font-medium pt-1 border-t border-[var(--line)]">
                      Atualizado em {new Date(reading.capturedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
