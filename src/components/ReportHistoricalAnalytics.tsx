import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import {
  CalendarDays,
  TrendingUp,
  History,
  FileText,
  Users,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  Search,
  ArrowRight,
  ArrowLeftRight,
  Filter,
  BarChart3,
  Eye,
  Check,
  X,
  Gauge,
  Clock,
  Sparkles,
  Layers,
  ChevronRight,
  Printer,
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
} from 'recharts';
import { formatDateBR, formatDateLongBR, getCollaboratorStatus, isAbsenteeismStatus } from '../utils/helpers';
import { Card, SectionHeader, Button, Badge, Input, Select, EmptyState, StatCard, type BadgeTone } from './ui';

export const ReportHistoricalAnalytics: React.FC = () => {
  const { state, setDate, showNotice, deleteDailyReport } = useApp();

  const [dateRangeFilter, setDateRangeFilter] = useState<'7dias' | '15dias' | '30dias' | '60dias' | 'todos'>('30dias');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState<string | null>(null);

  // Compare mode: select two dates to compare side by side
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [compareDateA, setCompareDateA] = useState<string>('');
  const [compareDateB, setCompareDateB] = useState<string>('');

  // Collect all available recorded dates from dailyReports + attendance
  const allRecordedDates = useMemo(() => {
    const datesSet = new Set<string>();
    Object.keys(state.dailyReports || {}).forEach((d) => {
      if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) datesSet.add(d);
    });
    Object.keys(state.attendance || {}).forEach((d) => {
      if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) datesSet.add(d);
    });
    // Also include today's date
    if (state.selectedDate) datesSet.add(state.selectedDate);

    return Array.from(datesSet).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  }, [state.dailyReports, state.attendance, state.selectedDate]);

  // Set default compare dates when dates are loaded
  React.useEffect(() => {
    if (allRecordedDates.length >= 2) {
      if (!compareDateA) setCompareDateA(allRecordedDates[0]);
      if (!compareDateB) setCompareDateB(allRecordedDates[1]);
    } else if (allRecordedDates.length === 1) {
      if (!compareDateA) setCompareDateA(allRecordedDates[0]);
      if (!compareDateB) setCompareDateB(allRecordedDates[0]);
    }
  }, [allRecordedDates, compareDateA, compareDateB]);

  // Compute structured historical dataset for each date
  const historicalReportsList = useMemo(() => {
    const today = state.selectedDate || new Date().toISOString().slice(0, 10);
    const limitDate = new Date(today + 'T12:00:00');

    if (dateRangeFilter === '7dias') limitDate.setDate(limitDate.getDate() - 7);
    else if (dateRangeFilter === '15dias') limitDate.setDate(limitDate.getDate() - 15);
    else if (dateRangeFilter === '30dias') limitDate.setDate(limitDate.getDate() - 30);
    else if (dateRangeFilter === '60dias') limitDate.setDate(limitDate.getDate() - 60);

    const filteredDates = allRecordedDates.filter((d) => {
      if (dateRangeFilter === 'todos') return true;
      const cur = new Date(d + 'T12:00:00');
      return !isNaN(cur.getTime()) && cur >= limitDate;
    });

    return filteredDates.map((dateKey) => {
      const report = state.dailyReports?.[dateKey] || {};
      const dayAtt = state.attendance?.[dateKey] || {};
      const hasSavedSnapshot = Boolean(report.generatedAt || (report.snapshot && report.snapshot.length > 0));

      // Calculate attendance & absences for this specific date
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let medicalCount = 0;
      let vacationCount = 0;
      let leaveCount = 0;
      let offCount = 0;
      let totalAssigned = 0;
      let scheduledWorkforce = 0;

      state.collaborators.forEach((c) => {
        const st = getCollaboratorStatus(c, dateKey, state);
        if (st.status === 'presente') presentCount++;
        else if (st.status === 'atraso') {
          presentCount++;
          lateCount++;
        } else if (st.status === 'folga') offCount++;
        else if (st.status === 'ferias') vacationCount++;
        else if (st.status === 'atestado') medicalCount++;
        else if (st.status === 'licenca') leaveCount++;
        else absentCount++;

        if (st.status !== 'folga' && st.status !== 'ferias') {
          scheduledWorkforce++;
        }
      });

      const totalCols = state.collaborators.length;
      const absenteeismAbsences = absentCount + medicalCount + leaveCount;
      const absenteeismRate =
        scheduledWorkforce > 0
          ? Math.round((absenteeismAbsences / scheduledWorkforce) * 1000) / 10
          : 0;

      const occurrenceCount = Object.keys(report.occurrences || {}).filter(
        (k) => (report.occurrences?.[k] || '').trim().length > 0
      ).length;

      const absenceReasonCount = Object.keys(report.absenceReasons || {}).filter(
        (k) => (report.absenceReasons?.[k] || '').trim().length > 0
      ).length;

      return {
        date: dateKey,
        formattedDate: formatDateBR(dateKey),
        dateLong: formatDateLongBR(dateKey),
        generatedAt: report.generatedAt || null,
        hasSavedSnapshot,
        totalCols,
        scheduledWorkforce,
        presentCount,
        lateCount,
        absentCount: absenteeismAbsences,
        vacationCount,
        offCount,
        medicalCount,
        absenteeismRate,
        occurrenceCount,
        absenceReasonCount,
        generalNotes: report.generalNotes || '',
        report,
      };
    });
  }, [allRecordedDates, dateRangeFilter, state]);

  // Aggregate KPI summary
  const summaryKpis = useMemo(() => {
    const totalReports = historicalReportsList.length;
    if (totalReports === 0) {
      return {
        totalReports: 0,
        savedReportsCount: 0,
        avgAttendanceRate: 0,
        avgAbsenteeismRate: 0,
        totalOccurrences: 0,
        bestDay: null as string | null,
        worstDay: null as string | null,
      };
    }

    const savedReportsCount = historicalReportsList.filter((r) => r.hasSavedSnapshot).length;
    const avgAttendanceRate =
      Math.round(
        (historicalReportsList.reduce((acc, r) => acc + (r.scheduledWorkforce > 0 ? (r.presentCount / r.scheduledWorkforce) * 100 : 0), 0) /
          totalReports) *
          10
      ) / 10;

    const avgAbsenteeismRate =
      Math.round(
        (historicalReportsList.reduce((acc, r) => acc + r.absenteeismRate, 0) / totalReports) * 10
      ) / 10;

    const totalOccurrences = historicalReportsList.reduce((acc, r) => acc + r.occurrenceCount, 0);

    const sortedByAbs = [...historicalReportsList].sort((a, b) => a.absenteeismRate - b.absenteeismRate);
    const bestDay = sortedByAbs[0]?.date || null;
    const worstDay = sortedByAbs[sortedByAbs.length - 1]?.date || null;

    return {
      totalReports,
      savedReportsCount,
      avgAttendanceRate,
      avgAbsenteeismRate,
      totalOccurrences,
      bestDay,
      worstDay,
    };
  }, [historicalReportsList]);

  // Chart data sorted chronologically (oldest -> newest)
  const chartData = useMemo(() => {
    return [...historicalReportsList]
      .reverse()
      .map((r) => ({
        date: r.date.slice(5), // MM-DD
        fullDate: r.formattedDate,
        presentes: r.presentCount,
        ausentes: r.absentCount,
        folgas: r.offCount,
        ferias: r.vacationCount,
        absenteismo: r.absenteeismRate,
        ocorrencias: r.occurrenceCount,
        hcTotal: r.totalCols,
      }));
  }, [historicalReportsList]);

  // Detailed view of selected historical date
  const selectedReportDetails = useMemo(() => {
    if (!selectedHistoricalDate) return null;
    const reportItem = historicalReportsList.find((r) => r.date === selectedHistoricalDate);
    if (!reportItem) return null;

    const dayReport = state.dailyReports?.[selectedHistoricalDate] || {};
    const dayIntervals = state.intervals?.[selectedHistoricalDate] || {};

    const rows = state.collaborators.map((c) => {
      const st = getCollaboratorStatus(c, selectedHistoricalDate, state);
      const task = state.tasks.find((t) => (t.members || []).includes(c.id))?.name || 'Não Dimensionado';
      const breakSlot = state.breaks.find((b) => (dayIntervals[b.id] || []).includes(c.id))?.time || 'Sem intervalo';
      const absenceReason = dayReport.absenceReasons?.[c.id] || (st.absenceDetail?.type || st.absenceReason || '');
      const occurrence = dayReport.occurrences?.[c.id] || '';

      return {
        id: c.id,
        name: c.name,
        role: c.role || 'Operador',
        shift: c.shift || state.teamShift || 'T1',
        scale: c.scale || 'A',
        teamLeader: c.teamLeader || state.defaultTeamLeader || 'Geral',
        status: st.status,
        task,
        breakSlot,
        absenceReason,
        occurrence,
      };
    });

    return {
      item: reportItem,
      rows,
      generalNotes: dayReport.generalNotes || '',
      generatedAt: dayReport.generatedAt || null,
    };
  }, [selectedHistoricalDate, historicalReportsList, state]);

  // Compare Two Dates computation
  const compareData = useMemo(() => {
    if (!compareDateA || !compareDateB) return null;
    const itemA = historicalReportsList.find((r) => r.date === compareDateA);
    const itemB = historicalReportsList.find((r) => r.date === compareDateB);
    if (!itemA || !itemB) return null;

    const diff = {
      presentDiff: itemB.presentCount - itemA.presentCount,
      absentDiff: itemB.absentCount - itemA.absentCount,
      absenteeismDiff: Math.round((itemB.absenteeismRate - itemA.absenteeismRate) * 10) / 10,
      occurrencesDiff: itemB.occurrenceCount - itemA.occurrenceCount,
    };

    return {
      itemA,
      itemB,
      diff,
    };
  }, [compareDateA, compareDateB, historicalReportsList]);

  // Export selected historical report to CSV
  const handleExportHistoricalCsv = (dateKey: string) => {
    const reportItem = historicalReportsList.find((r) => r.date === dateKey);
    if (!reportItem) return;

    const dayReport = state.dailyReports?.[dateKey] || {};
    const dayIntervals = state.intervals?.[dateKey] || {};

    let csv = '\uFEFF';
    csv += 'Data;Colaborador;Matrícula;LDAP;Turno;Escala;Cargo;Team Leader;Status;Tarefa Dimensionada;Horário Intervalo;Justificativa Ausência;Ocorrência Individual\n';

    state.collaborators.forEach((c) => {
      const st = getCollaboratorStatus(c, dateKey, state);
      const task = state.tasks.find((t) => (t.members || []).includes(c.id))?.name || 'Não Dimensionado';
      const breakSlot = state.breaks.find((b) => (dayIntervals[b.id] || []).includes(c.id))?.time || 'Sem intervalo';
      const absenceReason = dayReport.absenceReasons?.[c.id] || st.absenceReason || '';
      const occurrence = dayReport.occurrences?.[c.id] || '';

      csv += `"${formatDateBR(dateKey)}";"${c.name}";"${c.registration || ''}";"${c.login || ''}";"${c.shift || state.teamShift}";"${c.scale}";"${c.role}";"${c.teamLeader || state.defaultTeamLeader || ''}";"${st.status}";"${task}";"${breakSlot}";"${absenceReason}";"${occurrence}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-historico-${dateKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(`Relatório de ${formatDateBR(dateKey)} exportado em CSV.`);
  };

  // Delete saved daily report
  const handleDeleteDailyReport = (dateKey: string) => {
    if (!window.confirm(`Deseja realmente excluir os dados gravados do relatório do dia ${formatDateBR(dateKey)}?`)) {
      return;
    }
    deleteDailyReport(dateKey);
    if (selectedHistoricalDate === dateKey) setSelectedHistoricalDate(null);
  };

  const statusTone = (status: string): BadgeTone => {
    if (status === 'presente') return 'success';
    if (status === 'atraso') return 'warning';
    if (status === 'folga') return 'neutral';
    if (status === 'ferias') return 'purple';
    if (status === 'licenca') return 'info';
    return 'danger';
  };

  return (
    <div className="space-y-6">
      {/* Header Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[var(--surface-1)] p-4 rounded-xl border border-[var(--line)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              Histórico & Análise Comparativa de Relatórios
              <Badge tone="primary" className="text-[10px]">
                {historicalReportsList.length} datas gravadas
              </Badge>
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Consulte relatórios passados, analise tendências de absenteísmo e compare desempenho entre dias.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-[var(--surface-2)] p-1 rounded-lg border border-[var(--line)] text-xs">
            {(['7dias', '15dias', '30dias', '60dias', 'todos'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setDateRangeFilter(period)}
                className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                  dateRangeFilter === period
                    ? 'bg-[var(--primary)] text-white shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                {period === '7dias'
                  ? '7 Dias'
                  : period === '15dias'
                  ? '15 Dias'
                  : period === '30dias'
                  ? '30 Dias'
                  : period === '60dias'
                  ? '60 Dias'
                  : 'Todos'}
              </button>
            ))}
          </div>

          <Button
            variant={isCompareMode ? 'primary' : 'outline'}
            size="sm"
            icon={ArrowLeftRight}
            onClick={() => setIsCompareMode(!isCompareMode)}
          >
            {isCompareMode ? 'Modo Comparar Ativo' : 'Comparar 2 Dias'}
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Média de Presença"
          value={`${summaryKpis.avgAttendanceRate}%`}
          icon={CheckCircle2}
          tone="success"
          hint={`Em ${summaryKpis.totalReports} dia(s) analisado(s)`}
        />
        <StatCard
          label="Média de Absenteísmo"
          value={`${summaryKpis.avgAbsenteeismRate}%`}
          icon={Gauge}
          tone={summaryKpis.avgAbsenteeismRate > 8 ? 'danger' : 'warning'}
          hint={summaryKpis.bestDay ? `Melhor dia: ${formatDateBR(summaryKpis.bestDay)}` : undefined}
        />
        <StatCard
          label="Relatórios Salvos"
          value={summaryKpis.savedReportsCount}
          icon={FileText}
          tone="info"
          hint={`${summaryKpis.totalReports - summaryKpis.savedReportsCount} gerados por escala`}
        />
        <StatCard
          label="Ocorrências Registradas"
          value={summaryKpis.totalOccurrences}
          icon={AlertTriangle}
          tone="warning"
          hint="Total de registros individuais"
        />
      </div>

      {/* Compare Mode Panel */}
      <AnimatePresence>
        {isCompareMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-[var(--primary-border)] bg-[var(--surface-1)]">
              <SectionHeader
                icon={<ArrowLeftRight className="w-4 h-4 text-[var(--primary)]" />}
                title="Comparador Lado a Lado de Relatórios"
                right={
                  <Button variant="ghost" size="sm" icon={X} onClick={() => setIsCompareMode(false)}>
                    Fechar Comparador
                  </Button>
                }
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-bold text-[var(--ink)] block mb-1.5">
                    Data Base (Dia A):
                  </label>
                  <Select
                    value={compareDateA}
                    onChange={(e) => setCompareDateA(e.target.value)}
                    className="text-xs font-bold"
                  >
                    {allRecordedDates.map((d) => (
                      <option key={d} value={d}>
                        {formatDateBR(d)} ({formatDateLongBR(d)})
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[var(--ink)] block mb-1.5">
                    Data de Comparação (Dia B):
                  </label>
                  <Select
                    value={compareDateB}
                    onChange={(e) => setCompareDateB(e.target.value)}
                    className="text-xs font-bold"
                  >
                    {allRecordedDates.map((d) => (
                      <option key={d} value={d}>
                        {formatDateBR(d)} ({formatDateLongBR(d)})
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {compareData && (
                <div className="overflow-x-auto border border-[var(--line)] rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[var(--surface-2)] text-[var(--muted)] font-bold uppercase border-b border-[var(--line)]">
                      <tr>
                        <th className="p-3">Indicador / Métrica</th>
                        <th className="p-3 text-center">{formatDateBR(compareData.itemA.date)} (A)</th>
                        <th className="p-3 text-center">{formatDateBR(compareData.itemB.date)} (B)</th>
                        <th className="p-3 text-right">Variação (B vs A)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      <tr className="hover:bg-[var(--surface-2)]">
                        <td className="p-3 font-bold text-[var(--ink)]">Headcount Total</td>
                        <td className="p-3 text-center font-bold">{compareData.itemA.totalCols}</td>
                        <td className="p-3 text-center font-bold">{compareData.itemB.totalCols}</td>
                        <td className="p-3 text-right font-bold text-[var(--muted)]">
                          {compareData.itemB.totalCols - compareData.itemA.totalCols >= 0
                            ? `+${compareData.itemB.totalCols - compareData.itemA.totalCols}`
                            : compareData.itemB.totalCols - compareData.itemA.totalCols}
                        </td>
                      </tr>
                      <tr className="hover:bg-[var(--surface-2)]">
                        <td className="p-3 font-bold text-emerald-700 dark:text-emerald-400">Presentes</td>
                        <td className="p-3 text-center font-bold">{compareData.itemA.presentCount}</td>
                        <td className="p-3 text-center font-bold">{compareData.itemB.presentCount}</td>
                        <td className="p-3 text-right font-bold">
                          <span
                            className={
                              compareData.diff.presentDiff > 0
                                ? 'text-emerald-600'
                                : compareData.diff.presentDiff < 0
                                ? 'text-rose-600'
                                : 'text-[var(--muted)]'
                            }
                          >
                            {compareData.diff.presentDiff > 0 ? `+${compareData.diff.presentDiff}` : compareData.diff.presentDiff}
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-[var(--surface-2)]">
                        <td className="p-3 font-bold text-rose-700 dark:text-rose-400">Ausentes (Total)</td>
                        <td className="p-3 text-center font-bold">{compareData.itemA.absentCount}</td>
                        <td className="p-3 text-center font-bold">{compareData.itemB.absentCount}</td>
                        <td className="p-3 text-right font-bold">
                          <span
                            className={
                              compareData.diff.absentDiff < 0
                                ? 'text-emerald-600'
                                : compareData.diff.absentDiff > 0
                                ? 'text-rose-600'
                                : 'text-[var(--muted)]'
                            }
                          >
                            {compareData.diff.absentDiff > 0 ? `+${compareData.diff.absentDiff}` : compareData.diff.absentDiff}
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-[var(--surface-2)]">
                        <td className="p-3 font-bold text-rose-700 dark:text-rose-400">Taxa de Absenteísmo</td>
                        <td className="p-3 text-center font-black">{compareData.itemA.absenteeismRate}%</td>
                        <td className="p-3 text-center font-black">{compareData.itemB.absenteeismRate}%</td>
                        <td className="p-3 text-right font-black">
                          <span
                            className={
                              compareData.diff.absenteeismDiff < 0
                                ? 'text-emerald-600'
                                : compareData.diff.absenteeismDiff > 0
                                ? 'text-rose-600'
                                : 'text-[var(--muted)]'
                            }
                          >
                            {compareData.diff.absenteeismDiff > 0
                              ? `+${compareData.diff.absenteeismDiff}%`
                              : `${compareData.diff.absenteeismDiff}%`}
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-[var(--surface-2)]">
                        <td className="p-3 font-bold text-amber-700 dark:text-amber-400">Atestados Médicos</td>
                        <td className="p-3 text-center font-bold">{compareData.itemA.medicalCount}</td>
                        <td className="p-3 text-center font-bold">{compareData.itemB.medicalCount}</td>
                        <td className="p-3 text-right font-bold text-[var(--muted)]">
                          {compareData.itemB.medicalCount - compareData.itemA.medicalCount >= 0
                            ? `+${compareData.itemB.medicalCount - compareData.itemA.medicalCount}`
                            : compareData.itemB.medicalCount - compareData.itemA.medicalCount}
                        </td>
                      </tr>
                      <tr className="hover:bg-[var(--surface-2)]">
                        <td className="p-3 font-bold text-[var(--ink)]">Ocorrências Registradas</td>
                        <td className="p-3 text-center font-bold">{compareData.itemA.occurrenceCount}</td>
                        <td className="p-3 text-center font-bold">{compareData.itemB.occurrenceCount}</td>
                        <td className="p-3 text-right font-bold text-[var(--muted)]">
                          {compareData.diff.occurrencesDiff >= 0
                            ? `+${compareData.diff.occurrencesDiff}`
                            : compareData.diff.occurrencesDiff}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Historical Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 min-w-0">
          <Card className="h-full flex flex-col">
            <SectionHeader
              icon={<TrendingUp className="w-4 h-4" />}
              title="Tendência de Presença vs Absenteísmo Diário"
              right={
                <span className="text-[11px] text-[var(--muted)] font-semibold">
                  {chartData.length} pontos temporais
                </span>
              }
            />

            <div className="h-[280px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--muted)" tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--paper)',
                      borderColor: 'var(--line)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'var(--ink)',
                    }}
                    labelFormatter={(val, payload) => {
                      const item = payload?.[0]?.payload;
                      return item ? `Data: ${item.fullDate}` : val;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Area
                    type="monotone"
                    dataKey="presentes"
                    name="Presentes"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPresent)"
                  />
                  <Area
                    type="monotone"
                    dataKey="ausentes"
                    name="Ausentes"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAbsent)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-4 min-w-0">
          <Card className="h-full flex flex-col">
            <SectionHeader
              icon={<Gauge className="w-4 h-4" />}
              title="Evolução do Absenteísmo (%)"
            />

            <div className="h-[280px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" stroke="var(--muted)" tick={{ fontSize: 11 }} />
                  <YAxis stroke="var(--muted)" tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--paper)',
                      borderColor: 'var(--line)',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: 'var(--ink)',
                    }}
                    formatter={(val: any) => [`${val}%`, 'Taxa de Absenteísmo']}
                    labelFormatter={(val, payload) => {
                      const item = payload?.[0]?.payload;
                      return item ? `Data: ${item.fullDate}` : val;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="absenteismo"
                    name="Taxa de Absenteísmo"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--primary)' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* Historical Reports Timeline & Detailed View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* List of Historical Reports */}
        <div className="lg:col-span-5 xl:col-span-4 min-w-0">
          <Card className="flex flex-col h-[520px]">
            <SectionHeader
              icon={<CalendarDays className="w-4 h-4" />}
              title="Relatórios Gravados"
              right={
                <div className="relative w-36">
                  <Input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar data..."
                    className="h-7! text-[11px] pl-6!"
                  />
                  <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                </div>
              }
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-[var(--line)]">
              {historicalReportsList.length === 0 ? (
                <EmptyState icon={History} title="Nenhum relatório encontrado no período." className="py-12" />
              ) : (
                historicalReportsList
                  .filter((r) => {
                    if (!searchTerm) return true;
                    return r.formattedDate.includes(searchTerm) || r.date.includes(searchTerm);
                  })
                  .map((item) => {
                    const isSelected = selectedHistoricalDate === item.date;
                    const isCurrentActive = state.selectedDate === item.date;

                    return (
                      <div
                        key={item.date}
                        onClick={() => setSelectedHistoricalDate(item.date)}
                        className={`pt-2.5 first:pt-0 p-2.5 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[var(--primary-soft)] ring-2 ring-[var(--primary-border)]'
                            : 'hover:bg-[var(--surface-2)]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-[var(--ink)]">
                              {item.formattedDate}
                            </span>
                            {isCurrentActive && (
                              <Badge tone="primary" className="text-[9px]">
                                Hoje / Atual
                              </Badge>
                            )}
                            {item.hasSavedSnapshot && (
                              <Badge tone="success" className="text-[9px]">
                                Salvo
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] font-black text-rose-600 dark:text-rose-400">
                            {item.absenteeismRate}% abs.
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
                          <span>
                            {item.presentCount} presentes de {item.scheduledWorkforce} escalados
                          </span>
                          <span className="flex items-center gap-1 text-[var(--ink)] font-semibold">
                            {item.occurrenceCount > 0 && (
                              <span className="text-amber-600 flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" /> {item.occurrenceCount}
                              </span>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)]" />
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </Card>
        </div>

        {/* Selected Report Snapshot Viewer */}
        <div className="lg:col-span-7 xl:col-span-8 min-w-0">
          <Card className="flex flex-col min-h-[520px]">
            {selectedReportDetails ? (
              <>
                <SectionHeader
                  icon={<FileText className="w-4 h-4 text-[var(--primary)]" />}
                  title={`Detalhes do Relatório — ${selectedReportDetails.item.formattedDate}`}
                  subtitle={selectedReportDetails.item.dateLong}
                  right={
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Download}
                        onClick={() => handleExportHistoricalCsv(selectedReportDetails.item.date)}
                      >
                        Exportar CSV
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        icon={CalendarDays}
                        onClick={() => {
                          setDate(selectedReportDetails.item.date);
                          showNotice(`Data ativa alterada para ${selectedReportDetails.item.formattedDate}.`);
                        }}
                      >
                        Abrir nesta Data
                      </Button>
                      {selectedReportDetails.item.hasSavedSnapshot && (
                        <Button
                          variant="danger"
                          size="sm"
                          icon={Trash2}
                          onClick={() => handleDeleteDailyReport(selectedReportDetails.item.date)}
                        />
                      )}
                    </div>
                  }
                />

                {/* Quick metrics header of selected day */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 bg-[var(--surface-2)] p-3 rounded-xl border border-[var(--line)]">
                  <div>
                    <span className="text-[10px] text-[var(--muted)] uppercase font-bold block">Presentes</span>
                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                      {selectedReportDetails.item.presentCount} ({selectedReportDetails.item.scheduledWorkforce > 0 ? Math.round((selectedReportDetails.item.presentCount / selectedReportDetails.item.scheduledWorkforce) * 100) : 0}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)] uppercase font-bold block">Ausentes</span>
                    <span className="text-sm font-black text-rose-700 dark:text-rose-400">
                      {selectedReportDetails.item.absentCount}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)] uppercase font-bold block">Taxa Absenteísmo</span>
                    <span className="text-sm font-black text-rose-700 dark:text-rose-400">
                      {selectedReportDetails.item.absenteeismRate}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)] uppercase font-bold block">Ocorrências</span>
                    <span className="text-sm font-black text-amber-700 dark:text-amber-400">
                      {selectedReportDetails.item.occurrenceCount}
                    </span>
                  </div>
                </div>

                {/* General notes if any */}
                {selectedReportDetails.generalNotes && (
                  <div className="mb-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 p-3 rounded-xl">
                    <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 block mb-1">
                      📝 Observações Gerais do Turno Registradas:
                    </span>
                    <p className="text-xs text-amber-900/90 dark:text-amber-200/90 whitespace-pre-wrap leading-relaxed">
                      {selectedReportDetails.generalNotes}
                    </p>
                  </div>
                )}

                {/* Table of collaborators on that date */}
                <div className="flex-1 overflow-x-auto border border-[var(--line)] rounded-xl max-h-[300px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse min-w-[600px]">
                    <thead className="sticky top-0 bg-[var(--paper)] z-10 shadow-xs border-b border-[var(--line)] text-[var(--muted)] font-bold uppercase">
                      <tr>
                        <th className="p-2.5">Colaborador</th>
                        <th className="p-2.5">Status</th>
                        <th className="p-2.5">Tarefa</th>
                        <th className="p-2.5">Intervalo</th>
                        <th className="p-2.5">Justificativa / Ocorrência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--line)]">
                      {selectedReportDetails.rows.map((row) => (
                        <tr key={row.id} className="hover:bg-[var(--surface-2)]">
                          <td className="p-2.5 font-bold text-[var(--ink)]">
                            <div>{row.name}</div>
                            <div className="text-[10px] text-[var(--muted)] font-normal">{row.role} • {row.teamLeader}</div>
                          </td>
                          <td className="p-2.5">
                            <Badge tone={statusTone(row.status)} className="uppercase text-[9px]">
                              {row.status}
                            </Badge>
                          </td>
                          <td className="p-2.5 text-[var(--ink)] font-medium">{row.task}</td>
                          <td className="p-2.5 text-[var(--muted)]">{row.breakSlot}</td>
                          <td className="p-2.5">
                            {row.absenceReason && (
                              <span className="text-rose-600 dark:text-rose-400 font-semibold block">
                                {row.absenceReason}
                              </span>
                            )}
                            {row.occurrence && (
                              <span className="text-amber-600 dark:text-amber-400 text-[11px] block">
                                ⚠️ {row.occurrence}
                              </span>
                            )}
                            {!row.absenceReason && !row.occurrence && (
                              <span className="text-[var(--muted)]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[var(--muted)]">
                <FileText className="w-12 h-12 mb-3 text-[var(--muted)]/50" />
                <h4 className="text-sm font-bold text-[var(--ink)]">Selecione uma data ao lado</h4>
                <p className="text-xs max-w-sm mt-1">
                  Clique em qualquer relatório na lista da esquerda para visualizar o histórico completo daquele dia.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
