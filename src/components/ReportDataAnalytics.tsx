import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import {
  BarChart3,
  TrendingUp,
  History,
  Users,
  Gauge,
  ClipboardList,
  Headphones,
  Database,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  Filter,
  Search,
  Layers,
  Lock,
  Eye,
  FileText,
  Briefcase,
  Tag,
  Shuffle,
  ChevronRight,
  Printer,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Card,
  CardHeader,
  SectionHeader,
  Button,
  Badge,
  StatCard,
  Input,
  Select,
  EmptyState,
  Toolbar,
  Modal,
  type BadgeTone,
} from './ui';
import { formatDateBR, formatDateLongBR, getCollaboratorStatus, getCollaboratorAbsenteeismRate, isAbsenteeismStatus, escapeSearchTerm, type StatusType } from '../utils/helpers';
import { getConsolidatedTaskGroups } from '../utils/taskTreeHelpers';
import { fetchShiftClosingsFromFirestore } from '../lib/firestoreStorage';
import { ShiftClosingRecord } from '../types';

export const ReportDataAnalytics: React.FC = () => {
  const { state, setDate, showNotice, setAbsenteeismPeriodDays } = useApp();
  const activeDate = state.selectedDate;
  const absenteeismPeriodDays = state.absenteeismPeriodDays || 30;

  // View module inside Data Analytics
  const [subModule, setSubModule] = useState<'visao_geral' | 'frequencia' | 'tarefas' | 'pedidos' | 'cofre_nuvem'>('visao_geral');

  // Filters
  const [periodFilter, setPeriodFilter] = useState<'7dias' | '15dias' | '30dias' | '60dias' | 'todos'>('30dias');
  const [shiftFilter, setShiftFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Historical closings from Firestore
  const [closedShifts, setClosedShifts] = useState<ShiftClosingRecord[]>([]);
  const [loadingClosings, setLoadingClosings] = useState(false);
  const [selectedClosingDetail, setSelectedClosingDetail] = useState<ShiftClosingRecord | null>(null);

  const isFirestore = state.onlineSpreadsheet?.databaseProvider === 'firestore';
  const workspaceName = state.onlineSpreadsheet?.firestoreCollection || 'dimensio_workspaces';

  // Load cloud shift closings
  useEffect(() => {
    if (!isFirestore) return;
    const fetchClosings = async () => {
      setLoadingClosings(true);
      try {
        const records = await fetchShiftClosingsFromFirestore(50);
        setClosedShifts(records);
      } catch (err) {
        console.error('Failed to load shift closing history', err);
      } finally {
        setLoadingClosings(false);
      }
    };
    fetchClosings();
  }, [isFirestore, workspaceName, subModule]);

  // Filtered collaborators based on active shift filter
  const activeCollaborators = useMemo(() => {
    return state.collaborators.filter((c) => {
      if (shiftFilter !== 'todos' && c.shift !== shiftFilter) return false;
      return true;
    });
  }, [state.collaborators, shiftFilter]);

  // Overall attendance status distribution
  const statusInfo = useMemo(() => {
    return activeCollaborators.map((c) => ({
      collaborator: c,
      ...getCollaboratorStatus(c, activeDate, state),
    }));
  }, [activeCollaborators, activeDate, state]);

  const presentCount = statusInfo.filter((s) => s.status === 'presente' || s.status === 'atraso').length;
  const absentCount = statusInfo.filter((s) => isAbsenteeismStatus(s.status)).length;
  const offCount = statusInfo.filter((s) => s.status === 'folga').length;
  const vacationCount = statusInfo.filter((s) => s.status === 'ferias').length;
  const totalHeadcount = activeCollaborators.length;
  const attendanceRate = totalHeadcount > 0 ? Math.round((presentCount / totalHeadcount) * 100) : 0;
  const absenteeismRate = totalHeadcount > 0 ? Math.round((absentCount / totalHeadcount) * 100) : 0;

  // Collaborators with highest absenteeism
  const collabAbsenteeismRanking = useMemo(() => {
    return activeCollaborators
      .map((c) => {
        const st = getCollaboratorStatus(c, activeDate, state);
        const rate = Math.round(getCollaboratorAbsenteeismRate(state, c, activeDate, absenteeismPeriodDays));
        return {
          id: c.id,
          name: c.name,
          role: c.role || 'Sem cargo',
          shift: c.shift || 'Geral',
          status: st.status,
          rate,
        };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [activeCollaborators, activeDate, state, absenteeismPeriodDays]);

  // Multi-day historical attendance timeline
  const historicalTimeline = useMemo(() => {
    const datesSet = new Set<string>();
    Object.keys(state.dailyReports || {}).forEach((d) => {
      if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) datesSet.add(d);
    });
    Object.keys(state.attendance || {}).forEach((d) => {
      if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) datesSet.add(d);
    });
    datesSet.add(activeDate);

    const sortedDates = Array.from(datesSet).sort();
    const today = activeDate || new Date().toISOString().slice(0, 10);
    const limitDate = new Date(today + 'T12:00:00');

    if (periodFilter === '7dias') limitDate.setDate(limitDate.getDate() - 7);
    else if (periodFilter === '15dias') limitDate.setDate(limitDate.getDate() - 15);
    else if (periodFilter === '30dias') limitDate.setDate(limitDate.getDate() - 30);
    else if (periodFilter === '60dias') limitDate.setDate(limitDate.getDate() - 60);

    const filteredDates = sortedDates.filter((d) => {
      if (periodFilter === 'todos') return true;
      const cur = new Date(d + 'T12:00:00');
      return !isNaN(cur.getTime()) && cur >= limitDate;
    });

    return filteredDates.map((dateKey) => {
      let p = 0;
      let a = 0;
      let total = 0;

      activeCollaborators.forEach((c) => {
        total++;
        const st = getCollaboratorStatus(c, dateKey, state).status;
        if (st === 'presente' || st === 'atraso') p++;
        else if (isAbsenteeismStatus(st)) a++;
      });

      const rate = total > 0 ? Math.round((p / total) * 100) : 0;
      const absRate = total > 0 ? Math.round((a / total) * 100) : 0;

      return {
        date: dateKey,
        formattedDate: formatDateBR(dateKey),
        presentes: p,
        ausentes: a,
        taxaPresenca: rate,
        taxaAbsenteismo: absRate,
        total,
      };
    });
  }, [state.dailyReports, state.attendance, activeDate, activeCollaborators, periodFilter, state]);

  // Dimensioning per Task Group
  const dimensioningGroups = useMemo(() => {
    return getConsolidatedTaskGroups(state.tasks, true).map((g) => ({
      name: g.rootTask.name,
      total: g.totalCount,
      subtasksCount: g.subtasks.length,
    })).sort((a, b) => b.total - a.total);
  }, [state.tasks]);

  // Routines / Scheduled tasks fulfillment
  const scheduledTasksMetrics = useMemo(() => {
    const list = state.scheduledTasks || [];
    const total = list.length;
    const completed = list.filter((r) => r.status === 'concluida' || Boolean(r.completedAt)).length;
    const inProgress = list.filter((r) => r.status === 'em_andamento').length;
    const pending = list.filter((r) => r.status === 'a_fazer' || r.status === 'aguardando').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // By category
    const byCat: Record<string, { total: number; completed: number }> = {};
    list.forEach((t) => {
      const cat = t.category || 'Geral';
      if (!byCat[cat]) byCat[cat] = { total: 0, completed: 0 };
      byCat[cat].total++;
      if (t.status === 'concluida' || Boolean(t.completedAt)) byCat[cat].completed++;
    });

    const categoryData = Object.entries(byCat).map(([cat, val]) => ({
      name: cat,
      total: val.total,
      concluidas: val.completed,
      taxa: val.total > 0 ? Math.round((val.completed / val.total) * 100) : 0,
    }));

    return { total, completed, inProgress, pending, rate, categoryData };
  }, [state.scheduledTasks]);

  // Support and Service requests metrics
  const requestsMetrics = useMemo(() => {
    const support = state.supportMessages || [];
    const service = state.serviceRequests || [];

    const totalSupport = support.length;
    const openSupport = support.filter((m) => m.status === 'enviado' || m.status === 'em_atendimento').length;
    const resolvedSupport = support.filter((m) => m.status === 'resolvido').length;

    const attendedSupport = support.filter((m) => typeof m.durationSeconds === 'number' && m.durationSeconds > 0);
    const avgTmaSeconds = attendedSupport.length > 0
      ? Math.round(attendedSupport.reduce((acc, m) => acc + (m.durationSeconds || 0), 0) / attendedSupport.length)
      : 0;

    const totalService = service.length;
    const openService = service.filter((r) => r.status === 'pendente' || r.status === 'lido').length;
    const resolvedService = service.filter((r) => r.status === 'realizado').length;

    return {
      totalSupport,
      openSupport,
      resolvedSupport,
      avgTmaSeconds,
      totalService,
      openService,
      resolvedService,
    };
  }, [state.supportMessages, state.serviceRequests]);

  // Status pie chart colors
  const statusPieData = useMemo(() => {
    return [
      { name: 'Presentes', value: presentCount, color: '#10b981' },
      { name: 'Ausentes', value: absentCount, color: '#f43f5e' },
      { name: 'Folgas', value: offCount, color: '#64748b' },
      { name: 'Férias', value: vacationCount, color: '#a855f7' },
    ].filter((d) => d.value > 0);
  }, [presentCount, absentCount, offCount, vacationCount]);

  const statusTone = (st: StatusType): BadgeTone =>
    st === 'presente' ? 'success' : st === 'atraso' ? 'warning' : isAbsenteeismStatus(st) ? 'danger' : 'neutral';

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Sub-module Navigation Bar */}
      <Toolbar className="justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-[var(--surface-2)] p-1 rounded-xl border border-[var(--line)] overflow-x-auto max-w-full">
          <Button
            size="xs"
            variant={subModule === 'visao_geral' ? 'secondary' : 'ghost'}
            icon={BarChart3}
            onClick={() => setSubModule('visao_geral')}
          >
            Visão Geral & KPIs
          </Button>
          <Button
            size="xs"
            variant={subModule === 'frequencia' ? 'secondary' : 'ghost'}
            icon={TrendingUp}
            onClick={() => setSubModule('frequencia')}
          >
            Frequência & Absenteísmo
          </Button>
          <Button
            size="xs"
            variant={subModule === 'tarefas' ? 'secondary' : 'ghost'}
            icon={Shuffle}
            onClick={() => setSubModule('tarefas')}
          >
            Tarefas & Rotinas
          </Button>
          <Button
            size="xs"
            variant={subModule === 'pedidos' ? 'secondary' : 'ghost'}
            icon={Headphones}
            onClick={() => setSubModule('pedidos')}
          >
            Chamados & Suporte
          </Button>
          <Button
            size="xs"
            variant={subModule === 'cofre_nuvem' ? 'secondary' : 'ghost'}
            icon={Lock}
            onClick={() => setSubModule('cofre_nuvem')}
          >
            Cofre de Fechamentos (Nuvem)
          </Button>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="h-8! w-auto! text-xs font-bold"
            title="Filtrar por Turno"
          >
            <option value="todos">Todos os Turnos</option>
            {(state.shifts || []).map((s) => (
              <option key={s} value={s}>
                Turno {s}
              </option>
            ))}
          </Select>

          <Select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as any)}
            className="h-8! w-auto! text-xs font-bold"
            title="Filtrar Período de Análise"
          >
            <option value="7dias">Últimos 7 dias</option>
            <option value="15dias">Últimos 15 dias</option>
            <option value="30dias">Últimos 30 dias</option>
            <option value="60dias">Últimos 60 dias</option>
            <option value="todos">Todo o Histórico</option>
          </Select>
        </div>
      </Toolbar>

      {/* 1. VISÃO GERAL & KPIS */}
      {subModule === 'visao_geral' && (
        <div className="space-y-5">
          {/* Main KPI Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Taxa de Presença"
              value={`${attendanceRate}%`}
              icon={CheckCircle2}
              tone={attendanceRate >= 90 ? 'success' : attendanceRate >= 75 ? 'warning' : 'danger'}
              hint={<span className="text-[10px] text-[var(--muted)]">{presentCount} de {totalHeadcount} ativos</span>}
            />
            <StatCard
              label="Absenteísmo (Hoje)"
              value={`${absenteeismRate}%`}
              icon={Gauge}
              tone={absenteeismRate === 0 ? 'success' : 'danger'}
              hint={<span className="text-[10px] text-[var(--muted)]">{absentCount} ausência{absentCount !== 1 ? 's' : ''}</span>}
            />
            <StatCard
              label="Rotinas Cumpridas"
              value={`${scheduledTasksMetrics.rate}%`}
              icon={ClipboardList}
              tone={scheduledTasksMetrics.rate >= 80 ? 'success' : 'warning'}
              hint={<span className="text-[10px] text-[var(--muted)]">{scheduledTasksMetrics.completed} de {scheduledTasksMetrics.total}</span>}
            />
            <StatCard
              label="Chamados em Aberto"
              value={requestsMetrics.openSupport + requestsMetrics.openService}
              icon={Headphones}
              tone={requestsMetrics.openSupport + requestsMetrics.openService === 0 ? 'success' : 'warning'}
              hint={<span className="text-[10px] text-[var(--muted)]">Fila de apoio e sistemas</span>}
            />
            <StatCard
              label="TMA Médio"
              value={requestsMetrics.avgTmaSeconds > 0 ? `${Math.round(requestsMetrics.avgTmaSeconds / 60)}min` : '—'}
              icon={Clock}
              tone="primary"
              hint={<span className="text-[10px] text-[var(--muted)]">Tempo Médio de Atendimento</span>}
            />
            <StatCard
              label="Headcount Ativo"
              value={totalHeadcount}
              icon={Users}
              tone="default"
              hint={<span className="text-[10px] text-[var(--muted)]">{dimensioningGroups.length} tarefas mapeadas</span>}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Historical Attendance AreaChart */}
            <div className="lg:col-span-8">
              <Card>
                <SectionHeader
                  icon={<TrendingUp className="w-4 h-4 text-[var(--primary)]" />}
                  title="Evolução Temporal da Taxa de Presença (%)"
                  subtitle="Acompanhamento diário da presença e absenteísmo no período selecionado."
                />
                <div className="h-64 sm:h-72 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historicalTimeline} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPresenca" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorAusentes" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.5} />
                      <XAxis dataKey="formattedDate" stroke="var(--muted)" fontSize={10} tickLine={false} />
                      <YAxis stroke="var(--muted)" fontSize={10} domain={[0, 100]} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--paper)',
                          borderColor: 'var(--line)',
                          borderRadius: '8px',
                          fontSize: '11px',
                          boxShadow: 'var(--shadow-card)',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Area
                        type="monotone"
                        dataKey="taxaPresenca"
                        name="Taxa Presença (%)"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorPresenca)"
                      />
                      <Area
                        type="monotone"
                        dataKey="taxaAbsenteismo"
                        name="Taxa Absenteísmo (%)"
                        stroke="#f43f5e"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorAusentes)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            {/* Status Distribution PieChart */}
            <div className="lg:col-span-4">
              <Card className="h-full flex flex-col justify-between">
                <SectionHeader
                  icon={<Users className="w-4 h-4" />}
                  title="Composição de Frequência"
                  subtitle="Distribuição de colaboradores hoje."
                />
                <div className="h-52 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {statusPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--paper)',
                          borderColor: 'var(--line)',
                          borderRadius: '8px',
                          fontSize: '11px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--line)]">
                  {statusPieData.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-[var(--muted)] font-medium truncate">{d.name}:</span>
                      <strong className="text-[var(--ink)] font-black">{d.value}</strong>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* 2. FREQUÊNCIA & ABSENTEÍSMO */}
      {subModule === 'frequencia' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Ranking Table */}
            <div className="lg:col-span-7">
              <Card>
                <SectionHeader
                  icon={<Gauge className="w-4 h-4 text-rose-500" />}
                  title="Ranking de Absenteísmo por Colaborador"
                  subtitle={`Calculado com base no período de ${absenteeismPeriodDays} dias configurado.`}
                  right={
                    <Select
                      value={absenteeismPeriodDays}
                      onChange={(e) => setAbsenteeismPeriodDays(Number(e.target.value))}
                      className="h-7! w-20! text-[10px] font-black"
                    >
                      {[7, 15, 30, 45, 60, 90].map((d) => (
                        <option key={d} value={d}>
                          {d} dias
                        </option>
                      ))}
                    </Select>
                  }
                />

                <div className="overflow-x-auto max-h-[420px] overflow-y-auto pr-1">
                  <table className="w-full text-left text-xs border-collapse min-w-[380px]">
                    <thead className="sticky top-0 bg-[var(--paper)] z-10 shadow-xs">
                      <tr className="border-b border-[var(--line)] text-[var(--muted)] font-bold uppercase text-[9px]">
                        <th className="p-2">Colaborador</th>
                        <th className="p-2">Turno</th>
                        <th className="p-2">Status Hoje</th>
                        <th className="p-2 text-right">Taxa Absenteísmo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {collabAbsenteeismRanking.map((c) => (
                        <tr key={c.id} className="hover:bg-[var(--surface-2)]">
                          <td className="p-2 font-bold text-[var(--ink)]">
                            <div>{c.name}</div>
                            <div className="text-[10px] text-[var(--muted)] font-normal">{c.role}</div>
                          </td>
                          <td className="p-2 text-[var(--muted)] font-semibold">{c.shift}</td>
                          <td className="p-2">
                            <Badge tone={statusTone(c.status as StatusType)} className="uppercase text-[8.5px]">
                              {c.status}
                            </Badge>
                          </td>
                          <td className="p-2 text-right font-black">
                            <span className={c.rate > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}>
                              {c.rate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            {/* Timeline Breakdown */}
            <div className="lg:col-span-5">
              <Card className="h-full flex flex-col">
                <SectionHeader
                  icon={<CalendarDays className="w-4 h-4" />}
                  title="Histórico Diário de Presença"
                  subtitle="Contagem consolidada de operadores por data."
                />
                <div className="overflow-y-auto max-h-[420px] divide-y divide-[var(--line)] pr-1 flex-1">
                  {historicalTimeline.map((item) => (
                    <div
                      key={item.date}
                      onClick={() => {
                        setDate(item.date);
                        showNotice(`Data alterada para ${item.formattedDate}`);
                      }}
                      className="py-2.5 px-2 hover:bg-[var(--surface-2)] rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5">
                          <span>{item.formattedDate}</span>
                          {item.date === activeDate && (
                            <Badge tone="primary" className="text-[8px]">
                              Hoje / Ativa
                            </Badge>
                          )}
                        </div>
                        <div className="text-[10px] text-[var(--muted)]">
                          {item.presentes} presentes • {item.ausentes} ausentes ({item.total} total)
                        </div>
                      </div>

                      <div className="text-right">
                        <span
                          className={`text-xs font-black ${
                            item.taxaPresenca >= 90 ? 'text-emerald-600' : item.taxaPresenca >= 75 ? 'text-amber-600' : 'text-rose-600'
                          }`}
                        >
                          {item.taxaPresenca}%
                        </span>
                        <div className="w-16 h-1.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${item.taxaPresenca >= 90 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                            style={{ width: `${item.taxaPresenca}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAREFAS & ROTINAS */}
      {subModule === 'tarefas' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Dimensioning Chart */}
            <Card>
              <SectionHeader
                icon={<Shuffle className="w-4 h-4 text-[var(--primary)]" />}
                title="Distribuição de Pessoas por Posto / Atividade"
                subtitle="Quantidade de colaboradores alocados em cada tarefa principal."
              />
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dimensioningGroups} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" opacity={0.5} />
                    <XAxis type="number" stroke="var(--muted)" fontSize={10} />
                    <YAxis dataKey="name" type="category" stroke="var(--muted)" fontSize={10} width={90} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--paper)',
                        borderColor: 'var(--line)',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="total" name="Colaboradores" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Scheduled Tasks Fulfillment */}
            <Card>
              <SectionHeader
                icon={<ClipboardList className="w-4 h-4 text-emerald-600" />}
                title="Cumprimento de Rotinas por Categoria"
                subtitle="Status das rotinas agendadas cadastradas no sistema."
              />
              <div className="space-y-3 pt-2">
                {scheduledTasksMetrics.categoryData.length === 0 ? (
                  <EmptyState icon={ClipboardList} title="Nenhuma rotina agendada cadastrada." className="py-8" />
                ) : (
                  scheduledTasksMetrics.categoryData.map((cat) => (
                    <div key={cat.name} className="p-3 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-[var(--ink)]">{cat.name}</span>
                        <span className="font-bold text-[var(--muted)]">
                          {cat.concluidas} de {cat.total} ({cat.taxa}%)
                        </span>
                      </div>
                      <div className="h-2 bg-[var(--paper)] border border-[var(--line)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            cat.taxa >= 90 ? 'bg-emerald-500' : cat.taxa >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${cat.taxa}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 4. CHAMADOS & PEDIDOS */}
      {subModule === 'pedidos' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total de Chamados" value={requestsMetrics.totalSupport} tone="primary" icon={Headphones} />
            <StatCard label="Chamados em Aberto" value={requestsMetrics.openSupport} tone="warning" icon={Clock} />
            <StatCard label="Chamados Resolvidos" value={requestsMetrics.resolvedSupport} tone="success" icon={CheckCircle2} />
            <StatCard
              label="TMA Médio de Suporte"
              value={requestsMetrics.avgTmaSeconds > 0 ? `${Math.round(requestsMetrics.avgTmaSeconds / 60)}min` : '—'}
              tone="default"
              icon={Clock}
            />
          </div>

          <Card>
            <SectionHeader
              icon={<Headphones className="w-4 h-4" />}
              title="Solicitações Recentes de Apoio Operacional"
              subtitle="Últimos chamados abertos pelos colaboradores e líderes."
            />
            {(state.supportMessages || []).length === 0 ? (
              <EmptyState icon={Headphones} title="Nenhum chamado de suporte registrado." className="py-8" />
            ) : (
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto pr-1">
                <table className="w-full text-left text-xs border-collapse min-w-[500px]">
                  <thead className="sticky top-0 bg-[var(--paper)] z-10 shadow-xs">
                    <tr className="border-b border-[var(--line)] text-[var(--muted)] font-bold uppercase text-[9px]">
                      <th className="p-2">Data/Hora</th>
                      <th className="p-2">Solicitante</th>
                      <th className="p-2">Tipo</th>
                      <th className="p-2">Assunto</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">Atendente</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {(state.supportMessages || []).map((m) => (
                      <tr key={m.id} className="hover:bg-[var(--surface-2)]">
                        <td className="p-2 whitespace-nowrap text-[var(--muted)]">
                          {m.date || m.createdAt?.slice(0, 10)} {m.time || ''}
                        </td>
                        <td className="p-2 font-bold text-[var(--ink)]">{m.senderName}</td>
                        <td className="p-2 text-[var(--muted)]">{m.supportType || 'Suporte'}</td>
                        <td className="p-2 max-w-[200px] truncate text-[var(--ink)]">{m.codeText || '—'}</td>
                        <td className="p-2">
                          <Badge
                            tone={
                              m.status === 'resolvido'
                                ? 'success'
                                : m.status === 'em_atendimento'
                                ? 'info'
                                : 'warning'
                            }
                            className="uppercase text-[8.5px]"
                          >
                            {m.status}
                          </Badge>
                        </td>
                        <td className="p-2 text-[var(--muted)]">{m.assignedToName || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 5. COFRE DE FECHAMENTOS (FIRESTORE) */}
      {subModule === 'cofre_nuvem' && (
        <div className="space-y-5">
          <Card>
            <CardHeader
              icon={<Lock className="w-4.5 h-4.5 text-amber-500" />}
              title="Cofre de Fechamentos Históricos (Nuvem / Firestore)"
              subtitle="Registros imutáveis de turnos fechados e consolidados no banco de dados."
              actions={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setLoadingClosings(true);
                    try {
                      const records = await fetchShiftClosingsFromFirestore(50);
                      setClosedShifts(records);
                      showNotice('✅ Histórico de fechamentos atualizado da nuvem!');
                    } catch (e) {
                      showNotice('Erro ao carregar fechamentos.');
                    } finally {
                      setLoadingClosings(false);
                    }
                  }}
                >
                  Atualizar Lista
                </Button>
              }
            />

            {!isFirestore ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs space-y-2">
                <p className="font-bold text-amber-800 dark:text-amber-300">
                  ⚠️ O Firebase Firestore não está configurado como provedor ativo nesta sessão.
                </p>
                <p className="text-[var(--muted)]">
                  Para habilitar o salvamento imutável de fechamentos em tempo real, conecte o Firestore através do menu de compartilhamento.
                </p>
              </div>
            ) : loadingClosings ? (
              <div className="p-8 text-center text-xs text-[var(--muted)]">
                <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
                Carregando registros de fechamento da nuvem...
              </div>
            ) : closedShifts.length === 0 ? (
              <EmptyState
                icon={Lock}
                title="Nenhum fechamento de turno gravado ainda."
                description="Use o botão 'Fechar Turno (Nuvem)' na aba de Início / Passagem de Turno para arquivar o snapshot oficial do turno."
                className="py-10"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                {closedShifts.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-3.5 bg-[var(--surface-2)] border border-[var(--line)] hover:border-amber-500/50 rounded-xl space-y-2.5 transition-all shadow-2xs cursor-pointer group"
                    onClick={() => setSelectedClosingDetail(rec)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-black text-[var(--ink)]">
                          {formatDateBR(rec.date)} • Turno {rec.shift}
                        </span>
                      </div>
                      <Badge tone="success" className="text-[8.5px]">
                        {rec.attendanceRate}% Presença
                      </Badge>
                    </div>

                    <div className="text-[11px] text-[var(--muted)] space-y-0.5">
                      <div>Líder: <strong className="text-[var(--ink)]">{rec.closedBy}</strong></div>
                      <div>Horário: {rec.closedAt?.slice(11, 16) || '—'}</div>
                      <div>Headcount: {rec.presentCount} presentes / {rec.absenceCount} ausentes</div>
                    </div>

                    <div className="pt-2 border-t border-[var(--line)]/50 flex items-center justify-between text-[10px] text-[var(--primary)] font-bold group-hover:underline">
                      <span>Ver detalhes do fechamento</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Closing Detail Modal */}
          <Modal
            isOpen={Boolean(selectedClosingDetail)}
            onClose={() => setSelectedClosingDetail(null)}
            title={`Fechamento de Turno — ${selectedClosingDetail ? formatDateBR(selectedClosingDetail.date) : ''} (Turno ${selectedClosingDetail?.shift || ''})`}
            icon={<Lock className="w-4.5 h-4.5 text-amber-500" />}
            size="lg"
            footer={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Printer}
                  onClick={() => window.print()}
                >
                  Imprimir
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSelectedClosingDetail(null)}
                >
                  Fechar
                </Button>
              </>
            }
          >
            {selectedClosingDetail && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatCard label="Data" value={formatDateBR(selectedClosingDetail.date)} tone="default" />
                  <StatCard label="Turno" value={selectedClosingDetail.shift} tone="primary" />
                  <StatCard label="Taxa Presença" value={`${selectedClosingDetail.attendanceRate}%`} tone="success" />
                  <StatCard label="Líder" value={selectedClosingDetail.closedBy} tone="default" />
                </div>

                {selectedClosingDetail.supervisorNotes && (
                  <div className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--line)] space-y-1">
                    <span className="text-[10px] font-bold uppercase text-[var(--muted)]">Observações de Passagem:</span>
                    <p className="text-[11px] text-[var(--ink)] leading-relaxed whitespace-pre-wrap">
                      {selectedClosingDetail.supervisorNotes}
                    </p>
                  </div>
                )}

                {selectedClosingDetail.absentList && selectedClosingDetail.absentList.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="font-bold text-[var(--ink)]">Colaboradores Ausentes no Fechamento:</span>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {selectedClosingDetail.absentList.map((a, idx) => (
                        <div key={idx} className="p-2 bg-[var(--surface-2)] rounded-lg flex items-center justify-between text-[11px]">
                          <span className="font-bold text-[var(--ink)]">{a.name}</span>
                          <span className="text-[var(--muted)]">{a.reason || a.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Modal>
        </div>
      )}
    </div>
  );
};
