import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import {
  BarChart3,
  TrendingUp,
  Database,
  Search,
  Filter,
  Download,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  Layers,
  Wand2,
  AlertCircle,
  ExternalLink,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  FolderTree,
  Check,
  MousePointerClick,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts';
import { Card, SectionHeader, Button, Badge, Input, Select, EmptyState, StatCard, type BadgeTone } from './ui';
import { formatDateBR } from '../utils/helpers';
import { isExtensionInstalled } from '../utils/extensionInstaller';
import { navigateTo } from '../utils/navigation';
import { MetricDefinition, MetricReading, TaskAreaCount } from '../types';

export const ReportMetricsExtensionAnalytics: React.FC = () => {
  const {
    state,
    deleteMetricReading,
    getTaskAreaCounts,
    showNotice,
  } = useApp();

  const [metricFilter, setMetricFilter] = useState<string>('todos');
  const [periodFilter, setPeriodFilter] = useState<'hoje' | '7dias' | '30dias' | 'todos'>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMetricId, setSelectedMetricId] = useState<string>('');

  const definitions = state.metricDefinitions || [];
  const readings = state.metricReadings || [];
  const taskAreaCounts = getTaskAreaCounts();

  // Set default selected metric for deep-dive analysis
  React.useEffect(() => {
    if (definitions.length > 0 && !selectedMetricId) {
      setSelectedMetricId(definitions[0].id);
    }
  }, [definitions, selectedMetricId]);

  // Filtered readings based on UI controls
  const filteredReadings = useMemo(() => {
    const today = state.selectedDate || new Date().toISOString().slice(0, 10);
    const limitDate = new Date(today + 'T12:00:00');

    if (periodFilter === '7dias') limitDate.setDate(limitDate.getDate() - 7);
    else if (periodFilter === '30dias') limitDate.setDate(limitDate.getDate() - 30);

    return readings
      .filter((r) => {
        if (metricFilter !== 'todos' && r.metricId !== metricFilter) return false;
        if (periodFilter === 'hoje') {
          const capDate = (r.capturedAt || '').slice(0, 10);
          if (capDate !== today) return false;
        } else if (periodFilter === '7dias' || periodFilter === '30dias') {
          const d = new Date(r.capturedAt || '');
          if (isNaN(d.getTime()) || d < limitDate) return false;
        }

        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase();
          const def = definitions.find((d) => d.id === r.metricId);
          const valuesStr = Object.values(r.values || {}).join(' ').toLowerCase();
          const defName = (def?.name || '').toLowerCase();
          const capturedBy = (r.capturedBy || '').toLowerCase();
          if (!defName.includes(q) && !valuesStr.includes(q) && !capturedBy.includes(q)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : a.capturedAt > b.capturedAt ? -1 : 0));
  }, [readings, metricFilter, periodFilter, searchTerm, state.selectedDate, definitions]);

  // Global KPIs for collected metrics
  const kpis = useMemo(() => {
    const totalReadings = readings.length;
    const totalDefinitions = definitions.length;
    const activeTasksTracked = taskAreaCounts.length;
    const totalPendingItems = taskAreaCounts.reduce((sum, item) => sum + (item.pending || 0), 0);
    const totalProcessingItems = taskAreaCounts.reduce((sum, item) => sum + (item.processing || 0), 0);

    const latestReading = readings.length > 0
      ? [...readings].sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))[0]
      : null;

    return {
      totalReadings,
      totalDefinitions,
      activeTasksTracked,
      totalPendingItems,
      totalProcessingItems,
      latestReadingAt: latestReading?.capturedAt || null,
    };
  }, [readings, definitions, taskAreaCounts]);

  // Selected metric analytics (deep dive)
  const selectedMetricInfo = useMemo(() => {
    if (!selectedMetricId) return null;
    const def = definitions.find((d) => d.id === selectedMetricId);
    if (!def) return null;

    const metricReadings = readings
      .filter((r) => r.metricId === selectedMetricId)
      .sort((a, b) => (a.capturedAt > b.capturedAt ? 1 : -1)); // chronological order

    // Extract numeric values series
    const seriesData = metricReadings.map((r) => {
      const dt = new Date(r.capturedAt);
      const timeLabel = !isNaN(dt.getTime())
        ? `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
        : r.capturedAt;

      // Consolidate primary numeric value
      let primaryVal = 0;
      const values = r.values || {};
      const numericVals: number[] = [];

      Object.values(values).forEach((v) => {
        const num = parseFloat(String(v).replace(',', '.'));
        if (!isNaN(num)) numericVals.push(num);
      });

      if (numericVals.length > 0) {
        primaryVal = numericVals.reduce((a, b) => a + b, 0);
      }

      return {
        timestamp: r.capturedAt,
        timeLabel,
        value: primaryVal,
        capturedBy: r.capturedBy || 'Extensão',
        rawValues: values,
      };
    });

    const valuesOnly = seriesData.map((s) => s.value).filter((v) => !isNaN(v));
    const avg = valuesOnly.length > 0 ? Math.round((valuesOnly.reduce((a, b) => a + b, 0) / valuesOnly.length) * 10) / 10 : 0;
    const min = valuesOnly.length > 0 ? Math.min(...valuesOnly) : 0;
    const max = valuesOnly.length > 0 ? Math.max(...valuesOnly) : 0;
    const latest = valuesOnly.length > 0 ? valuesOnly[valuesOnly.length - 1] : 0;
    const previous = valuesOnly.length > 1 ? valuesOnly[valuesOnly.length - 2] : null;

    let deltaPct = 0;
    if (previous !== null && previous > 0) {
      deltaPct = Math.round(((latest - previous) / previous) * 1000) / 10;
    }

    return {
      def,
      seriesData,
      count: seriesData.length,
      avg,
      min,
      max,
      latest,
      previous,
      deltaPct,
    };
  }, [selectedMetricId, definitions, readings]);

  // Chart data for task counts by area
  const taskAreaChartData = useMemo(() => {
    return taskAreaCounts.map((a) => ({
      area: a.area,
      pendentes: a.pending,
      processamento: a.processing,
      total: a.total,
    }));
  }, [taskAreaCounts]);

  // Export raw metric readings to CSV
  const handleExportReadingsCsv = () => {
    if (filteredReadings.length === 0) {
      showNotice('Nenhum dado de coleta para exportar.');
      return;
    }

    let csv = '\uFEFF';
    csv += 'Data e Hora;Métrica;Tipo;Unidade;Coletado Por;Valores Coletados\n';

    filteredReadings.forEach((r) => {
      const def = definitions.find((d) => d.id === r.metricId);
      const valuesStr = Object.entries(r.values || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ');

      const formattedTime = new Date(r.capturedAt).toLocaleString('pt-BR');
      csv += `"${formattedTime}";"${def?.name || 'Métrica'}";"${def?.kind === 'task_counts' ? 'Contagem de Tarefas' : 'Geral'}";"${def?.unit || ''}";"${r.capturedBy || 'Extensão'}";"${valuesStr}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coletas-metricas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(`Dados de ${filteredReadings.length} coletas exportados em CSV.`);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[var(--surface-1)] p-4 rounded-xl border border-[var(--line)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
              Análise de Métricas & Coletas da Extensão
              <Badge tone="primary" className="text-[10px]">
                {definitions.length} métricas ativas
              </Badge>
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Monitore contagens por área capturadas pela extensão, gargalos operacionais e histórico de medições.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            onClick={handleExportReadingsCsv}
          >
            Exportar CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Wand2}
            onClick={() => navigateTo('settings')}
          >
            Configurar Automações
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total de Coletas Gravadas"
          value={kpis.totalReadings}
          icon={Database}
          tone="info"
          hint={`${kpis.totalDefinitions} métricas configuradas`}
        />
        <StatCard
          label="Tarefas Pendentes (Total)"
          value={kpis.totalPendingItems}
          icon={Clock}
          tone={kpis.totalPendingItems > 50 ? 'warning' : 'success'}
          hint={`Em ${kpis.activeTasksTracked} área(s) operacional(is)`}
        />
        <StatCard
          label="Em Processamento"
          value={kpis.totalProcessingItems}
          icon={RefreshCw}
          tone="default"
          hint="Itens sendo trabalhados"
        />
        <StatCard
          label="Última Sincronização"
          value={
            kpis.latestReadingAt
              ? new Date(kpis.latestReadingAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              : 'Nenhuma'
          }
          icon={CheckCircle2}
          tone={kpis.latestReadingAt ? 'success' : 'default'}
          hint={kpis.latestReadingAt ? new Date(kpis.latestReadingAt).toLocaleDateString('pt-BR') : 'Sem dados'}
        />
      </div>

      {/* Module 1: Task Area Counts (Extensão Automa) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 min-w-0">
          <Card className="h-full flex flex-col">
            <SectionHeader
              icon={<FolderTree className="w-4 h-4 text-[var(--primary)]" />}
              title="Contagem de Tarefas por Área Operacional"
              subtitle="Coletado automaticamente pela extensão nos sistemas da empresa"
            />

            {taskAreaCounts.length === 0 ? (
              <EmptyState
                icon={Database}
                title="Nenhuma contagem de área registrada ainda."
                description="Use a extensão do Dimensio para capturar automaticamente os volumes de pendências."
                className="py-12"
              />
            ) : (
              <div className="h-[260px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={taskAreaChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="area" stroke="var(--muted)" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
                    <YAxis stroke="var(--muted)" tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--paper)',
                        borderColor: 'var(--line)',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: 'var(--ink)',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                    <Bar dataKey="pendentes" name="Pendentes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="processamento" name="Em Processamento" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        <div className="lg:col-span-5 min-w-0">
          <Card className="h-full flex flex-col">
            <SectionHeader
              icon={<Layers className="w-4 h-4" />}
              title="Resumo por Área & Filas"
            />

            <div className="flex-1 overflow-y-auto max-h-[280px] divide-y divide-[var(--line)] pr-1">
              {taskAreaCounts.length === 0 ? (
                <p className="text-xs text-[var(--muted)] text-center py-8">
                  Nenhuma contagem registrada.
                </p>
              ) : (
                taskAreaCounts.map((area) => (
                  <div key={area.area} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-[var(--ink)] truncate">{area.area}</div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {area.tasks} posto(s) vinculado(s)
                        {area.updatedAt && ` • Atualizado às ${new Date(area.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-md text-[10px] border border-amber-200 dark:border-amber-900/60">
                        {area.pending} pend.
                      </span>
                      <span className="bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded-md text-[10px] border border-blue-200 dark:border-blue-900/60">
                        {area.processing} proc.
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Module 2: Deep-Dive Analysis of Selected Metric */}
      {definitions.length > 0 && (
        <Card className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--line)]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
              <h4 className="text-xs font-bold text-[var(--ink)] uppercase tracking-wide">
                Análise Temporal de Métrica Específica
              </h4>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-[var(--muted)]">Selecionar Métrica:</label>
              <Select
                value={selectedMetricId}
                onChange={(e) => setSelectedMetricId(e.target.value)}
                className="text-xs font-bold h-8! py-0!"
              >
                {definitions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.kind === 'task_counts' ? 'Contagem' : 'Geral'})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {selectedMetricInfo && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Stats badges */}
              <div className="lg:col-span-4 space-y-3">
                <div className="bg-[var(--surface-2)] p-4 rounded-xl border border-[var(--line)] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--muted)] font-bold">Último Valor Coletado</span>
                    <span className="text-lg font-black text-[var(--primary)]">
                      {selectedMetricInfo.latest} {selectedMetricInfo.def.unit || ''}
                    </span>
                  </div>

                  {selectedMetricInfo.previous !== null && (
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--line)]">
                      <span className="text-[var(--muted)]">Variação vs Leitura Anterior:</span>
                      <span
                        className={`font-bold flex items-center gap-0.5 ${
                          selectedMetricInfo.deltaPct > 0
                            ? 'text-emerald-600'
                            : selectedMetricInfo.deltaPct < 0
                            ? 'text-rose-600'
                            : 'text-[var(--muted)]'
                        }`}
                      >
                        {selectedMetricInfo.deltaPct > 0 ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : selectedMetricInfo.deltaPct < 0 ? (
                          <ArrowDownRight className="w-3.5 h-3.5" />
                        ) : null}
                        {selectedMetricInfo.deltaPct > 0 ? `+${selectedMetricInfo.deltaPct}%` : `${selectedMetricInfo.deltaPct}%`}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--line)] text-center text-xs">
                    <div>
                      <span className="text-[9px] text-[var(--muted)] uppercase font-bold block">Média</span>
                      <span className="font-bold text-[var(--ink)]">{selectedMetricInfo.avg}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[var(--muted)] uppercase font-bold block">Mínimo</span>
                      <span className="font-bold text-[var(--ink)]">{selectedMetricInfo.min}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[var(--muted)] uppercase font-bold block">Máximo</span>
                      <span className="font-bold text-[var(--ink)]">{selectedMetricInfo.max}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-[var(--muted)] leading-relaxed">
                  <p>
                    <strong>Tipo:</strong> {selectedMetricInfo.def.kind === 'task_counts' ? 'Contagem de Tarefas por Texto' : 'Captura de Elementos Web'}
                  </p>
                  {selectedMetricInfo.def.url && (
                    <p className="truncate">
                      <strong>Link:</strong>{' '}
                      <a
                        href={selectedMetricInfo.def.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--primary)] hover:underline"
                      >
                        {selectedMetricInfo.def.url}
                      </a>
                    </p>
                  )}
                </div>
              </div>

              {/* Metric Line / Area Chart */}
              <div className="lg:col-span-8 min-w-0">
                {selectedMetricInfo.seriesData.length === 0 ? (
                  <EmptyState
                    icon={Database}
                    title="Nenhuma leitura registrada para esta métrica."
                    description="Acione a extensão ou insira valores para gerar a curva temporal."
                    className="py-12"
                  />
                ) : (
                  <div className="h-[220px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={selectedMetricInfo.seriesData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorMetricVal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                        <XAxis dataKey="timeLabel" stroke="var(--muted)" tick={{ fontSize: 10 }} />
                        <YAxis stroke="var(--muted)" tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--paper)',
                            borderColor: 'var(--line)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: 'var(--ink)',
                          }}
                          formatter={(val: any) => [`${val} ${selectedMetricInfo.def.unit || ''}`, selectedMetricInfo.def.name]}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          name={selectedMetricInfo.def.name}
                          stroke="var(--primary)"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorMetricVal)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Module 3: Raw Metric Readings Audit Log */}
      <Card className="flex flex-col">
        <SectionHeader
          icon={<Database className="w-4 h-4" />}
          title="Histórico Completo de Coletas & Auditoria"
          subtitle="Registros individuais extraídos pela extensão ou informados manualmente"
          right={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-[var(--surface-2)] p-0.5 rounded-lg border border-[var(--line)] text-xs">
                {(['hoje', '7dias', '30dias', 'todos'] as const).map((period) => (
                  <button
                    key={period}
                    onClick={() => setPeriodFilter(period)}
                    className={`px-2 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                      periodFilter === period
                        ? 'bg-[var(--primary)] text-white'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {period === 'hoje'
                      ? 'Hoje'
                      : period === '7dias'
                      ? '7D'
                      : period === '30dias'
                      ? '30D'
                      : 'Todos'}
                  </button>
                ))}
              </div>

              <div className="relative w-40">
                <Input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar leitura..."
                  className="h-7! text-[11px] pl-6!"
                />
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              </div>
            </div>
          }
        />

        <div className="overflow-x-auto border border-[var(--line)] rounded-xl max-h-[360px] overflow-y-auto mt-3">
          <table className="w-full text-left text-xs border-collapse min-w-[650px]">
            <thead className="sticky top-0 bg-[var(--paper)] z-10 shadow-xs border-b border-[var(--line)] text-[var(--muted)] font-bold uppercase">
              <tr>
                <th className="p-2.5">Data / Hora</th>
                <th className="p-2.5">Métrica</th>
                <th className="p-2.5">Origem / Coletado Por</th>
                <th className="p-2.5">Valores Capturados</th>
                <th className="p-2.5 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filteredReadings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[var(--muted)]">
                    Nenhum registro de coleta encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredReadings.map((reading) => {
                  const def = definitions.find((d) => d.id === reading.metricId);
                  const formattedDate = new Date(reading.capturedAt).toLocaleString('pt-BR');

                  return (
                    <tr key={reading.id} className="hover:bg-[var(--surface-2)]">
                      <td className="p-2.5 font-bold text-[var(--ink)] whitespace-nowrap">
                        {formattedDate}
                      </td>
                      <td className="p-2.5 font-bold text-[var(--ink)]">
                        <div>{def?.name || 'Métrica Removida'}</div>
                        <div className="text-[10px] text-[var(--muted)] font-normal">
                          {def?.kind === 'task_counts' ? 'Contagem de Tarefas' : 'Geral'}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <Badge tone="info" className="text-[10px]">
                          {reading.capturedBy || 'Extensão Dimensio'}
                        </Badge>
                      </td>
                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {Object.entries(reading.values || {}).map(([key, val]) => (
                            <span
                              key={key}
                              className="bg-[var(--surface-2)] border border-[var(--line)] px-2 py-0.5 rounded text-[11px] font-semibold text-[var(--ink)]"
                            >
                              <strong>{key}:</strong> {val}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-2.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          className="text-rose-500 hover:text-rose-700"
                          onClick={() => deleteMetricReading(reading.id)}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
