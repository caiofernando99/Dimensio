import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  Settings2,
  Plus,
  Trash2,
  Headphones,
  Check,
  Activity,
  Layers,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  Card,
  SectionHeader,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Field,
  type BadgeTone,
} from './ui';

export interface AttachedTaskMetricConfig {
  id: string;
  type: 'pending_by_category' | 'routines_completed' | 'support_queue' | 'systemic_queue' | 'operational_readings' | 'custom_counter';
  title: string;
  categoryFilter?: string; // for pending_by_category
  customTarget?: number;
  customUnit?: string;
  enabled: boolean;
}

const DEFAULT_METRIC_CONFIGS: AttachedTaskMetricConfig[] = [
  {
    id: 'cfg_pending_routines',
    type: 'pending_by_category',
    title: 'Rotinas Operacionais Pendentes',
    categoryFilter: 'todas',
    enabled: true,
  },
  {
    id: 'cfg_completed_routines',
    type: 'routines_completed',
    title: 'Conclusão de Rotinas Agendadas',
    enabled: true,
  },
  {
    id: 'cfg_support_queue',
    type: 'support_queue',
    title: 'Chamados de Suporte na Fila',
    enabled: true,
  },
  {
    id: 'cfg_systemic_queue',
    type: 'systemic_queue',
    title: 'Ações Sistêmicas Pendentes',
    enabled: true,
  },
  {
    id: 'cfg_operational_metrics',
    type: 'operational_readings',
    title: 'Métricas de Produtividade do Dia',
    enabled: true,
  },
];

interface ReportAttachedTaskMetricsProps {
  onMetricsComputed?: (metricsText: string) => void;
}

export const ReportAttachedTaskMetrics: React.FC<ReportAttachedTaskMetricsProps> = ({
  onMetricsComputed,
}) => {
  const { state, showNotice } = useApp();
  const activeDate = state.selectedDate;

  const [configs, setConfigs] = useState<AttachedTaskMetricConfig[]>(() => {
    try {
      const saved = localStorage.getItem('report_attached_metrics_config');
      return saved ? JSON.parse(saved) : DEFAULT_METRIC_CONFIGS;
    } catch {
      return DEFAULT_METRIC_CONFIGS;
    }
  });

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAddCustomModalOpen, setIsAddCustomModalOpen] = useState(false);

  // New custom metric form state
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<AttachedTaskMetricConfig['type']>('pending_by_category');
  const [newCategory, setNewCategory] = useState('todas');
  const [newTarget, setNewTarget] = useState('');
  const [newUnit, setNewUnit] = useState('');

  // Persist configs
  useEffect(() => {
    try {
      localStorage.setItem('report_attached_metrics_config', JSON.stringify(configs));
    } catch (e) {
      console.error('Failed to save attached metrics configs', e);
    }
  }, [configs]);

  // Extract all unique task categories from scheduledTasks and tasks
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    (state.scheduledTasks || []).forEach((t) => {
      if (t.category) set.add(t.category);
    });
    (state.tasks || []).forEach((t) => {
      if (t.allowedCategories) t.allowedCategories.forEach((c) => set.add(c));
    });
    return Array.from(set).filter(Boolean).sort();
  }, [state.scheduledTasks, state.tasks]);

  // Calculations for each metric type
  const computedMetrics = useMemo(() => {
    const scheduled = state.scheduledTasks || [];
    const support = state.supportMessages || [];
    const serviceReqs = state.serviceRequests || [];
    const readings = state.metricReadings || [];
    const metricDefs = state.metricDefinitions || [];

    // Filter routines for today/current shift if applicable
    const todayRoutines = scheduled.filter((r) => {
      if (!r.dueDate) return true;
      return r.dueDate === activeDate;
    });

    const results = configs.map((cfg) => {
      if (!cfg.enabled) return null;

      if (cfg.type === 'pending_by_category') {
        let matching = todayRoutines;
        if (cfg.categoryFilter && cfg.categoryFilter !== 'todas') {
          matching = matching.filter((r) => r.category === cfg.categoryFilter);
        }
        const pendingCount = matching.filter((r) => r.status !== 'concluida' && r.status !== 'cancelada').length;
        const totalCount = matching.length;
        const tone: BadgeTone = pendingCount === 0 ? 'success' : pendingCount > 3 ? 'danger' : 'warning';

        return {
          id: cfg.id,
          title: cfg.title,
          subtitle: cfg.categoryFilter && cfg.categoryFilter !== 'todas' ? `Categoria: ${cfg.categoryFilter}` : 'Todas as categorias',
          value: `${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}`,
          numericValue: pendingCount,
          total: totalCount,
          detail: totalCount > 0 ? `${totalCount - pendingCount} de ${totalCount} concluídas` : 'Nenhuma rotina cadastrada',
          tone,
          icon: Clock,
        };
      }

      if (cfg.type === 'routines_completed') {
        const total = todayRoutines.length;
        const completed = todayRoutines.filter((r) => r.status === 'concluida' || Boolean(r.completedAt)).length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 100;
        const tone: BadgeTone = pct >= 90 ? 'success' : pct >= 50 ? 'warning' : 'danger';

        return {
          id: cfg.id,
          title: cfg.title,
          subtitle: 'Rotinas do Turno',
          value: `${completed}/${total} (${pct}%)`,
          numericValue: completed,
          total,
          detail: pct >= 100 ? 'Todas as rotinas do turno entregues' : `${total - completed} rotinas aguardando conclusão`,
          tone,
          icon: CheckCircle2,
        };
      }

      if (cfg.type === 'support_queue') {
        const openSupport = support.filter((m) => m.status === 'enviado' || m.status === 'em_atendimento').length;
        const resolvedToday = support.filter(
          (m) => m.status === 'resolvido' && (m.date === activeDate || m.createdAt?.startsWith(activeDate))
        ).length;
        const tone: BadgeTone = openSupport === 0 ? 'success' : openSupport > 4 ? 'danger' : 'warning';

        return {
          id: cfg.id,
          title: cfg.title,
          subtitle: 'Solicitações de Apoio',
          value: `${openSupport} na fila`,
          numericValue: openSupport,
          detail: `${resolvedToday} resolvidos hoje`,
          tone,
          icon: Headphones,
        };
      }

      if (cfg.type === 'systemic_queue') {
        const openReqs = serviceReqs.filter((r) => r.status === 'pendente' || r.status === 'lido').length;
        const doneToday = serviceReqs.filter(
          (r) => r.status === 'realizado' && r.createdAt?.startsWith(activeDate)
        ).length;
        const tone: BadgeTone = openReqs === 0 ? 'success' : openReqs > 2 ? 'danger' : 'warning';

        return {
          id: cfg.id,
          title: cfg.title,
          subtitle: 'Avisos & Ações Sistêmicas',
          value: `${openReqs} em aberto`,
          numericValue: openReqs,
          detail: `${doneToday} atendidos hoje`,
          tone,
          icon: ClipboardList,
        };
      }

      if (cfg.type === 'operational_readings') {
        const todaysReadings = readings.filter((r) => r.capturedAt && r.capturedAt.startsWith(activeDate));
        const count = todaysReadings.length;
        const defCount = metricDefs.length;

        return {
          id: cfg.id,
          title: cfg.title,
          subtitle: `${defCount} métricas cadastradas`,
          value: `${count} leitura${count !== 1 ? 's' : ''}`,
          numericValue: count,
          detail: count > 0 ? 'Capturas registradas na data ativa' : 'Nenhuma leitura realizada hoje',
          tone: (count > 0 ? 'info' : 'neutral') as BadgeTone,
          icon: Activity,
        };
      }

      return null;
    }).filter(Boolean);

    return results as Array<{
      id: string;
      title: string;
      subtitle: string;
      value: string;
      numericValue: number;
      total?: number;
      detail: string;
      tone: BadgeTone;
      icon: any;
    }>;
  }, [configs, state.scheduledTasks, state.supportMessages, state.serviceRequests, state.metricReadings, state.metricDefinitions, activeDate]);

  // Generate a clean text representation of attached metrics for spreadsheet/export
  useEffect(() => {
    if (!onMetricsComputed) return;
    const lines: string[] = [];
    computedMetrics.forEach((m) => {
      lines.push(`${m.title}: ${m.value} (${m.detail})`);
    });
    onMetricsComputed(lines.join('\n'));
  }, [computedMetrics, onMetricsComputed]);

  const toggleConfig = (id: string) => {
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const removeConfig = (id: string) => {
    setConfigs((prev) => prev.filter((c) => c.id !== id));
    showNotice('Métrica anexada removida da configuração.');
  };

  const handleAddCustomMetric = () => {
    if (!newTitle.trim()) {
      showNotice('Informe um título para a métrica.');
      return;
    }
    const newId = 'cfg_' + Date.now();
    const newMetric: AttachedTaskMetricConfig = {
      id: newId,
      type: newType,
      title: newTitle.trim(),
      categoryFilter: newType === 'pending_by_category' ? newCategory : undefined,
      customTarget: newTarget ? parseFloat(newTarget) : undefined,
      customUnit: newUnit.trim() || undefined,
      enabled: true,
    };

    setConfigs([...configs, newMetric]);
    setIsAddCustomModalOpen(false);
    setNewTitle('');
    setNewCategory('todas');
    setNewTarget('');
    setNewUnit('');
    showNotice(`✅ Métrica "${newMetric.title}" anexada ao relatório!`);
  };

  return (
    <Card className="flex flex-col space-y-3">
      <SectionHeader
        icon={<Layers className="w-4 h-4 text-[var(--primary)]" />}
        title="Métricas & Indicadores de Tarefas Anexados ao Turno"
        subtitle="Métricas operacionais e tarefas pendentes selecionadas para acompanhamento deste relatório."
        right={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              icon={Plus}
              onClick={() => setIsAddCustomModalOpen(true)}
              title="Adicionar uma nova métrica ou contagem específica de tarefas"
            >
              Anexar Métrica
            </Button>
            <Button
              variant="ghost"
              size="xs"
              icon={Settings2}
              onClick={() => setIsConfigModalOpen(true)}
              title="Gerenciar quais métricas aparecem neste relatório"
            >
              Configurar
            </Button>
          </div>
        }
      />

      {computedMetrics.length === 0 ? (
        <div className="p-4 bg-[var(--surface-2)] border border-dashed border-[var(--line)] rounded-xl text-center space-y-2">
          <p className="text-xs text-[var(--muted)] font-bold">
            Nenhuma métrica de tarefa configurada para exibição neste relatório.
          </p>
          <Button
            variant="secondary"
            size="xs"
            icon={Plus}
            onClick={() => setIsConfigModalOpen(true)}
          >
            Habilitar Métricas
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {computedMetrics.map((metric) => {
            const Icon = metric.icon || Activity;
            return (
              <div
                key={metric.id}
                className="bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--primary-border)] p-3 rounded-xl flex flex-col justify-between space-y-2 transition-all shadow-2xs group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-[var(--muted)] uppercase tracking-wider block truncate">
                      {metric.subtitle}
                    </span>
                    <h5 className="text-xs font-black text-[var(--ink)] line-clamp-1 group-hover:text-[var(--primary)] transition-colors">
                      {metric.title}
                    </h5>
                  </div>
                  <span className="p-1.5 rounded-lg bg-[var(--paper)] border border-[var(--line)] text-[var(--primary)] shrink-0">
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-[var(--line)]/50">
                  <span className="text-sm sm:text-base font-black text-[var(--ink)] tracking-tight">
                    {metric.value}
                  </span>
                  <Badge tone={metric.tone} className="text-[9px] uppercase">
                    {metric.tone === 'success' ? 'Normal' : metric.tone === 'danger' ? 'Alerta' : 'Atenção'}
                  </Badge>
                </div>

                <p className="text-[10px] text-[var(--muted)] font-medium truncate">
                  {metric.detail}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Configurar Métricas Anexadas */}
      <Modal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Configurar Métricas Anexadas ao Relatório"
        icon={<Settings2 className="w-4.5 h-4.5" />}
        size="md"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setConfigs(DEFAULT_METRIC_CONFIGS);
                showNotice('Configurações restauradas para o padrão.');
              }}
            >
              Restaurar Padrão
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Check}
              onClick={() => setIsConfigModalOpen(false)}
            >
              Concluir
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--muted)]">
            Marque as métricas que você deseja que apareçam no card de passagem de turno e sejam anexadas ao relatório consolidado:
          </p>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {configs.map((cfg) => (
              <div
                key={cfg.id}
                className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                  cfg.enabled
                    ? 'bg-[var(--paper)] border-[var(--primary-border)]/60 shadow-2xs'
                    : 'bg-[var(--surface-2)] border-[var(--line)] opacity-60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={cfg.enabled}
                    onChange={() => toggleConfig(cfg.id)}
                    className="w-4 h-4 accent-[var(--primary)] rounded cursor-pointer shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[var(--ink)] truncate">{cfg.title}</p>
                    <p className="text-[10px] text-[var(--muted)] truncate">
                      {cfg.categoryFilter ? `Filtro: ${cfg.categoryFilter}` : cfg.type}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge tone={cfg.enabled ? 'primary' : 'neutral'} className="text-[9px]">
                    {cfg.enabled ? 'Ativo' : 'Oculto'}
                  </Badge>
                  {cfg.id.startsWith('cfg_custom_') && (
                    <Button
                      variant="danger"
                      size="xs"
                      icon={Trash2}
                      onClick={() => removeConfig(cfg.id)}
                      title="Excluir métrica personalizada"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[var(--line)] flex justify-end">
            <Button
              variant="outline"
              size="xs"
              icon={Plus}
              onClick={() => {
                setIsConfigModalOpen(false);
                setIsAddCustomModalOpen(true);
              }}
            >
              Criar Nova Métrica Anexada
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Adicionar Métrica Personalizada */}
      <Modal
        isOpen={isAddCustomModalOpen}
        onClose={() => setIsAddCustomModalOpen(false)}
        title="Anexar Nova Métrica de Tarefa"
        icon={<Plus className="w-4.5 h-4.5" />}
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIsAddCustomModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" icon={Check} onClick={handleAddCustomMetric}>
              Adicionar Métrica
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <Field label="Tipo de Indicador:">
            <Select
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
            >
              <option value="pending_by_category">Quantidade de Tarefas Pendentes (por Categoria)</option>
              <option value="routines_completed">Taxa de Conclusão de Rotinas do Turno</option>
              <option value="support_queue">Fila de Solicitações / Suporte Operacional</option>
              <option value="systemic_queue">Fila de Ações Sistêmicas</option>
              <option value="operational_readings">Métricas de Produtividade do Dia</option>
            </Select>
          </Field>

          <Field label="Nome da Métrica / Rótulo:">
            <Input
              type="text"
              placeholder="Ex: Auditorias 5S Pendentes, Pendências de Segurança, etc."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </Field>

          {newType === 'pending_by_category' && (
            <Field label="Filtrar por Categoria de Tarefa:">
              <Select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                <option value="todas">Todas as categorias</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <div className="p-3 bg-[var(--surface-2)] rounded-xl border border-[var(--line)] text-[11px] text-[var(--muted)]">
            💡 Esta métrica calculará automaticamente os dados das tarefas e ficará disponível para a passagem de turno e para o relatório diário.
          </div>
        </div>
      </Modal>
    </Card>
  );
};
