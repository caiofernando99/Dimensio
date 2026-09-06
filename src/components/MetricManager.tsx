import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  MetricDefinition,
  MetricFieldConfig,
  MetricReading,
  MetricTargetType,
  MetricSchedule,
  MetricFlowStep,
  MetricCountTerm,
} from '../types';
import { Card, CardHeader, Button, Badge, Modal, Field, Input, Select, EmptyState, SectionHeader, Toggle } from './ui';
import { isExtensionInstalled } from '../utils/extensionInstaller';
import {
  BarChart3,
  Plus,
  Trash2,
  Pencil,
  Play,
  Wand2,
  Database,
  X,
  Check,
  Building2,
  Users,
  FolderTree,
  Target,
  Info,
  TrendingUp,
  ClipboardList,
  MapPin,
  MousePointerClick,
} from 'lucide-react';

interface Props {
  className?: string;
}

interface FieldDraft {
  id: string;
  label: string;
  selector: string;
  mode: 'text' | 'attribute' | 'value';
  attribute: string;
}

interface FormState {
  name: string;
  unit: string;
  url: string;
  targetType: MetricTargetType;
  targetId: string;
  kind: 'generic' | 'task_counts';
  countKind: 'pending' | 'processing' | 'generic';
  countTerms: MetricCountTerm[];
  countScope: string;
  fields: FieldDraft[];
  schedule: MetricSchedule;
  flow: MetricFlowStep[];
}

const genId = () => Math.random().toString(36).substring(2, 10);

const defaultSchedule = (): MetricSchedule => ({
  enabled: false,
  cadence: 'diaria',
  times: ['07:00'],
  daysOfWeek: [1, 2, 3, 4, 5],
});

const emptyForm = (targetType: MetricTargetType, targetId: string): FormState => ({
  name: '',
  unit: '',
  url: '',
  targetType,
  targetId,
  kind: 'generic',
  countKind: 'generic',
  countTerms: [],
  countScope: '',
  fields: [{ id: genId(), label: '', selector: '', mode: 'text', attribute: '' }],
  schedule: defaultSchedule(),
  flow: [],
});

const formatTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? iso
      : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
};

const MODE_LABEL: Record<string, string> = {
  text: 'Texto do elemento',
  attribute: 'Atributo',
  value: 'Campo de formulário (value)',
};

const FLOW_LABEL: Record<MetricFlowStep['type'], string> = {
  open_url: 'Abrir link',
  click: 'Clicar',
  input: 'Digitar',
  select_option: 'Selecionar opção',
  wait: 'Aguardar (ms)',
  wait_selector: 'Aguardar elemento',
};

const flowStepSummary = (s: MetricFlowStep) => {
  if (s.type === 'open_url') return s.url ? `Abrir ${s.url}` : 'Abrir link';
  if (s.type === 'click') return `Clicar em ${s.selector || '—'}`;
  if (s.type === 'input') return `Digitar "${s.value || ''}" em ${s.selector || '—'}`;
  if (s.type === 'select_option') return `Selecionar "${s.value || ''}" em ${s.selector || '—'}`;
  if (s.type === 'wait') return `Aguardar ${s.ms || 1000} ms`;
  if (s.type === 'wait_selector') return `Aguardar ${s.selector || '—'}`;
  return s.type;
};

// Linhas legíveis de uma coleta: para contagens de tarefas os valores são
// chaveados pelo nome da área; para métricas comuns, pelo id do campo.
const readingValueRows = (def: MetricDefinition | undefined, values: Record<string, string>) => {
  const rows: { key: string; label: string; value?: string }[] = [];
  if (!def) return rows;
  if (def.kind === 'task_counts') {
    (def.countTerms || []).forEach((t) => {
      rows.push({ key: t.id, label: t.area, value: values[t.area] });
    });
  } else {
    (def.fields || []).forEach((f) => {
      rows.push({ key: f.id, label: f.label, value: values[f.id] });
    });
  }
  return rows;
};

export const MetricManager: React.FC<Props> = ({ className = '' }) => {
  const {
    state,
    addMetricDefinition,
    updateMetricDefinition,
    deleteMetricDefinition,
    addMetricReading,
    deleteMetricReading,
    getTaskAreaCounts,
    ensureTaskCountMetric,
    showNotice,
  } = useApp();

  const defs = state.metricDefinitions || [];
  const readings = state.metricReadings || [];
  const teams = state.teams || [];
  const tasks = state.tasks || [];

  const [activeType, setActiveType] = useState<MetricTargetType>('setor');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm('setor', ''));
  const [manualMetric, setManualMetric] = useState<MetricDefinition | null>(null);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [chartDef, setChartDef] = useState<MetricDefinition | null>(null);

  const [extInstalled, setExtInstalled] = useState<boolean>(() => isExtensionInstalled());
  useEffect(() => {
    const refresh = () => setExtInstalled(isExtensionInstalled());
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('dimensio-ext-installed', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('dimensio-ext-installed', refresh);
    };
  }, []);

  const sendToExt = (type: string, payload: Record<string, unknown>) => {
    window.postMessage({ source: 'DIMENSIO_APP', type, ...payload }, '*');
  };

  const openUrl = (url: string) => {
    const bridge = (window as any).__DIMENSIO_BRIDGE__;
    if (bridge && typeof bridge.openSystem === 'function') {
      bridge.openSystem(url);
    } else {
      window.open(url, '_blank', 'noopener');
    }
  };

  const targetLabel = (def: MetricDefinition) => {
    if (def.targetType === 'setor') return state.sector || 'Setor';
    if (def.targetType === 'time') {
      const t = teams.find((x) => x.id === def.targetId);
      return t ? t.name : def.targetId;
    }
    const task = tasks.find((x) => x.id === def.targetId);
    return task ? task.name : def.targetId;
  };

  const metricName = (id: string) => {
    const d = defs.find((x) => x.id === id);
    return d ? d.name : 'Métrica removida';
  };

  const grouped = useMemo(() => {
    const g: Record<string, MetricDefinition[]> = {};
    defs
      .filter((d) => d.targetType === activeType)
      .forEach((d) => {
        const key = d.targetId || 'default';
        if (!g[key]) g[key] = [];
        g[key].push(d);
      });
    return g;
  }, [defs, activeType]);

  const orderedGroups = useMemo(() => {
    const entries = Object.entries(grouped);
    const sortKey = (id: string) => {
      if (activeType === 'time') return teams.find((t) => t.id === id)?.name || id;
      if (activeType === 'tarefa') return tasks.find((t) => t.id === id)?.name || id;
      return id;
    };
    return entries.sort((a, b) => sortKey(a[0]).localeCompare(sortKey(b[0]), 'pt-BR'));
  }, [grouped, activeType, teams, tasks]);

  const recentReadings = useMemo(() => {
    return [...readings].sort((a, b) => (b.capturedAt || '').localeCompare(a.capturedAt || '')).slice(0, 12);
  }, [readings]);

  const areaCounts = useMemo(
    () => getTaskAreaCounts(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.metricDefinitions, state.metricReadings, state.tasks]
  );

  const grandTotal = useMemo(() => {
    let p = 0;
    let pr = 0;
    areaCounts.forEach((a) => {
      p += a.pending;
      pr += a.processing;
    });
    return { pending: p, processing: pr, total: p + pr };
  }, [areaCounts]);

  const todayReadings = useMemo(() => {
    const n = new Date();
    return readings.filter((r) => {
      try {
        const d = new Date(r.capturedAt);
        return d.toDateString() === n.toDateString();
      } catch {
        return false;
      }
    }).length;
  }, [readings]);

  const openAdd = (type: MetricTargetType) => {
    setEditingId(null);
    setForm(emptyForm(type, ''));
    setModalOpen(true);
  };

  const openEdit = (def: MetricDefinition) => {
    setEditingId(def.id);
    setForm({
      name: def.name,
      unit: def.unit || '',
      url: def.url || '',
      targetType: def.targetType,
      targetId: def.targetId || '',
      kind: def.kind === 'task_counts' ? 'task_counts' : 'generic',
      countKind: def.countKind || 'generic',
      countTerms: (def.countTerms || []).map((t) => ({ ...t })),
      countScope: def.countScope || '',
      fields: (def.fields || []).map((f) => ({
        id: f.id,
        label: f.label,
        selector: f.selector,
        mode: f.mode || 'text',
        attribute: f.attribute || '',
      })),
      schedule: {
        enabled: def.schedule?.enabled ?? false,
        cadence: def.schedule?.cadence || 'diaria',
        times: def.schedule?.times?.length ? def.schedule.times : ['07:00'],
        daysOfWeek: def.schedule?.daysOfWeek?.length ? def.schedule.daysOfWeek : [1, 2, 3, 4, 5],
      },
      flow: Array.isArray(def.flow) ? def.flow.map((s) => ({ ...s })) : [],
    });
    setModalOpen(true);
  };

  const setField = (index: number, patch: Partial<FieldDraft>) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    }));
  };

  const addFieldRow = () => {
    setForm((prev) => ({
      ...prev,
      fields: [...prev.fields, { id: genId(), label: '', selector: '', mode: 'text' as const, attribute: '' }],
    }));
  };

  const removeFieldRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.length > 1 ? prev.fields.filter((_, i) => i !== index) : prev.fields,
    }));
  };

  const setFlowStep = (index: number, patch: Partial<MetricFlowStep>) => {
    setForm((prev) => ({
      ...prev,
      flow: prev.flow.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const addFlowStep = (type: MetricFlowStep['type']) => {
    setForm((prev) => ({
      ...prev,
      flow: [...prev.flow, { type, selector: '', value: '', url: '', ms: 1000 } as MetricFlowStep],
    }));
  };

  const removeFlowStep = (index: number) => {
    setForm((prev) => ({ ...prev, flow: prev.flow.filter((_, i) => i !== index) }));
  };

  const setCountTerm = (index: number, patch: Partial<MetricCountTerm>) => {
    setForm((prev) => ({
      ...prev,
      countTerms: prev.countTerms.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    }));
  };

  const addCountTerm = () => {
    setForm((prev) => ({
      ...prev,
      countTerms: [...prev.countTerms, { id: genId(), area: '', selector: '' }],
    }));
  };

  const removeCountTerm = (index: number) => {
    setForm((prev) => ({ ...prev, countTerms: prev.countTerms.filter((_, i) => i !== index) }));
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showNotice('Informe o nome da métrica.');
      return;
    }
    if (activeType !== 'setor' && !form.targetId) {
      showNotice('Selecione o time ou a tarefa da métrica.');
      return;
    }
    if (form.kind === 'task_counts' && form.countTerms.filter((t) => t.area.trim()).length === 0) {
      showNotice('Adicione ao menos uma área (nome a contar na página) para a contagem.');
      return;
    }
    const isCount = form.kind === 'task_counts';
    const fields: MetricFieldConfig[] = isCount
      ? []
      : form.fields
          .filter((f) => f.label.trim())
          .map((f) => ({
            id: f.id,
            label: f.label.trim(),
            selector: f.selector.trim(),
            mode: f.mode,
            attribute: f.mode === 'attribute' ? f.attribute.trim() : undefined,
          }));
    const payload = {
      name: form.name.trim(),
      unit: form.unit.trim() || undefined,
      url: form.url.trim() || undefined,
      targetType: form.targetType,
      targetId: form.targetType === 'setor' ? state.sector || '' : form.targetId,
      kind: isCount ? ('task_counts' as const) : ('generic' as const),
      countKind: isCount ? form.countKind : ('generic' as const),
      countTerms: isCount
        ? form.countTerms.filter((t) => t.area.trim()).map((t) => ({
            id: t.id,
            area: t.area.trim(),
            selector: (t.selector || '').trim() || undefined,
          }))
        : [],
      countScope: isCount ? form.countScope.trim() || undefined : undefined,
      fields,
      flow: form.flow.filter((s) => s && s.type),
      schedule: {
        enabled: !!form.schedule.enabled,
        cadence: form.schedule.cadence || 'diaria',
        times: (form.schedule.times || []).map((t) => t.trim()).filter(Boolean),
        daysOfWeek: form.schedule.daysOfWeek || [],
      },
    };
    if (editingId) {
      updateMetricDefinition(editingId, payload);
    } else {
      addMetricDefinition(payload);
    }
    setModalOpen(false);
  };

  const collect = (def: MetricDefinition) => {
    if (!def.url) {
      showNotice('Informe o link da fonte (URL) para coletar automaticamente.');
      return;
    }
    const isCount = def.kind === 'task_counts';
    if (!isCount && (!def.fields || def.fields.length === 0)) {
      showNotice('Adicione ao menos um campo (valor) com seletor.');
      return;
    }
    if (isCount && (!def.countTerms || def.countTerms.length === 0)) {
      showNotice('Adicione ao menos uma área (nome a contar) para a contagem.');
      return;
    }
    const config = {
      requestId: genId(),
      metricId: def.id,
      name: def.name,
      url: def.url,
      mode: isCount ? 'count' : 'extract',
      fields: isCount
        ? []
        : def.fields.map((f) => ({
            id: f.id,
            label: f.label,
            selector: f.selector,
            mode: f.mode || 'text',
            attribute: f.attribute || '',
          })),
      countTerms: (def.countTerms || []).map((t) => ({ area: t.area, selector: t.selector || '' })),
      countScope: def.countScope || '',
      flow: Array.isArray(def.flow) ? def.flow : [],
    };
    const bridge = (window as any).__DIMENSIO_BRIDGE__;
    if (bridge) {
      sendToExt('DIMENSIO_COLLECT', { collect: config });
      showNotice('Coleta enviada para a extensão. Abrindo o sistema...');
      openUrl(def.url);
    } else {
      openUrl(def.url);
      showNotice('Extensão não detectada. Abrindo o link — cadastre o valor manualmente.');
    }
  };

  const pickField = (def: MetricDefinition) => {
    if (!def.url) {
      showNotice('Informe o link da fonte (URL) para usar o seletor de campos.');
      return;
    }
    const config = {
      requestId: genId(),
      metricId: def.id,
      name: def.name,
      url: def.url,
      fields: (def.fields || []).map((f) => ({
        id: f.id,
        label: f.label,
        selector: f.selector || '',
        mode: f.mode || 'text',
        attribute: f.attribute || '',
      })),
    };
    const bridge = (window as any).__DIMENSIO_BRIDGE__;
    if (bridge) {
      sendToExt('DIMENSIO_PICK_START', { pick: config });
      showNotice('Modo seletor ativado. A extensão abrirá a página e pedirá para marcar cada campo.');
      openUrl(def.url);
    } else {
      openUrl(def.url);
      showNotice('Extensão não detectada — instale a extensão Dimensio para usar o seletor.');
    }
  };

  const recordFlow = (def: MetricDefinition) => {
    if (!def.url) {
      showNotice('Informe o link da fonte (URL) para gravar o fluxo de cliques.');
      return;
    }
    const config = {
      requestId: genId(),
      metricId: def.id,
      name: def.name,
      url: def.url,
      flow: Array.isArray(def.flow) ? def.flow : [],
    };
    const bridge = (window as any).__DIMENSIO_BRIDGE__;
    if (bridge) {
      sendToExt('DIMENSIO_FLOW_RECORD_START', { record: config });
      showNotice('Gravador de fluxo ativado. Na página aberta, execute os cliques/digitações e finalize na barra da extensão.');
      openUrl(def.url);
    } else {
      openUrl(def.url);
      showNotice('Extensão não detectada — instale a extensão Dimensio para gravar o fluxo.');
    }
  };

  const openManual = (def: MetricDefinition) => {
    setManualMetric(def);
    const values: Record<string, string> = {};
    if (def.kind === 'task_counts') {
      (def.countTerms || []).forEach((t) => {
        values[t.area] = '';
      });
    } else {
      (def.fields || []).forEach((f) => {
        values[f.id] = '';
      });
    }
    setManualValues(values);
  };

  const saveManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMetric) return;
    const values: Record<string, string> = {};
    if (manualMetric.kind === 'task_counts') {
      (manualMetric.countTerms || []).forEach((t) => {
        if (manualValues[t.area]) values[t.area] = manualValues[t.area].trim();
      });
    } else {
      (manualMetric.fields || []).forEach((f) => {
        if (manualValues[f.id]) values[f.id] = manualValues[f.id].trim();
      });
    }
    if (Object.keys(values).length === 0) {
      showNotice('Preencha ao menos um valor antes de salvar.');
      return;
    }
    addMetricReading({ metricId: manualMetric.id, values, capturedBy: 'Manual' });
    setManualMetric(null);
  };

  const renderGroup = (groupId: string, items: MetricDefinition[]) => {
    const groupLabel =
      activeType === 'setor'
        ? (state.sector || 'Setor')
        : activeType === 'time'
          ? teams.find((t) => t.id === groupId)?.name || groupId
          : tasks.find((t) => t.id === groupId)?.name || groupId;

    return (
      <div key={groupId} className="space-y-2">
        <div className="flex items-center gap-2">
          {activeType === 'setor' && <Building2 className="w-3.5 h-3.5 text-[var(--primary)]" />}
          {activeType === 'time' && <Users className="w-3.5 h-3.5 text-[var(--primary)]" />}
          {activeType === 'tarefa' && <FolderTree className="w-3.5 h-3.5 text-[var(--primary)]" />}
          <span className="text-[11px] font-black uppercase tracking-wider text-[var(--ink)]">{groupLabel}</span>
          <Badge tone="neutral">{items.length}</Badge>
          {activeType === 'tarefa' && (
            <>
              <button
                type="button"
                onClick={() => {
                  const res = ensureTaskCountMetric(groupId, 'pending');
                  const metric = (state.metricDefinitions || []).find((d) => d.id === res?.metricId);
                  showNotice(
                    res?.created
                      ? 'Métrica de contagem criada! Adicione as áreas e o fluxo de filtros para automatizar.'
                      : 'Este posto já possui métrica de Pendentes.'
                  );
                  if (metric) openEdit(metric);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:underline cursor-pointer"
                title="Criar/editar a contagem de Pendentes deste posto (áreas a contar + fluxo de filtros)"
              >
                <ClipboardList className="w-3 h-3" /> Pendentes
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = ensureTaskCountMetric(groupId, 'processing');
                  const metric = (state.metricDefinitions || []).find((d) => d.id === res?.metricId);
                  showNotice(
                    res?.created
                      ? 'Métrica de contagem criada! Adicione as áreas e o fluxo de filtros para automatizar.'
                      : 'Este posto já possui métrica de Em processamento.'
                  );
                  if (metric) openEdit(metric);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:underline cursor-pointer"
                title="Criar/editar a contagem de Em processamento deste posto (áreas a contar + fluxo de filtros)"
              >
                <ClipboardList className="w-3 h-3" /> Processando
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => openAdd(activeType)}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] hover:underline cursor-pointer"
          >
            <Plus className="w-3 h-3" /> Adicionar
          </button>
        </div>

        {items.map((def) => (
          <div
            key={def.id}
            className="flex flex-wrap items-center gap-2.5 p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
                <Target className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-extrabold text-[var(--ink)] truncate">{def.name}</span>
                  {def.unit && <Badge tone="info">{def.unit}</Badge>}
                  {def.kind === 'task_counts' ? (
                    <Badge tone="neutral">{(def.countTerms || []).length} área(s)</Badge>
                  ) : (
                    <Badge tone="neutral">{(def.fields || []).length} campo(s)</Badge>
                  )}
                  {(def.flow || []).length > 0 && (
                    <Badge tone="primary" title={flowStepSummary(def.flow![0])}>
                      <MousePointerClick className="w-3 h-3" /> {def.flow!.length} passo(s)
                    </Badge>
                  )}
                </div>
                <div className="text-[11px] text-[var(--muted)] font-medium truncate mt-0.5">
                  {def.url ? def.url : 'Sem link de fonte'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" variant="secondary" icon={Play} onClick={() => collect(def)} title="Coletar agora via extensão">
                Coletar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={TrendingUp}
                onClick={() => setChartDef(def)}
                title="Ver histórico em gráfico"
              />
              {def.kind !== 'task_counts' && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Wand2}
                  onClick={() => pickField(def)}
                  title="Usar seletor de campos na página (estilo Automa)"
                >
                  Selecionar
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                icon={MousePointerClick}
                onClick={() => recordFlow(def)}
                title="Gravar fluxo de cliques na página (ex: aplicar filtros) e reproduzir antes de cada coleta"
              >
                Fluxo
              </Button>
              <Button size="sm" variant="ghost" icon={Database} onClick={() => openManual(def)} title="Registrar valores manualmente">
                Valor
              </Button>
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => openEdit(def)} title="Editar métrica" />
              <Button
                size="sm"
                variant="ghost"
                className="!text-rose-600 hover:!bg-rose-50 dark:hover:!bg-rose-950/40"
                icon={Trash2}
                onClick={() => deleteMetricDefinition(def.id)}
                title="Excluir métrica"
              />
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="p-3 bg-[var(--bg)] border border-dashed border-[var(--line)] rounded-xl text-[11px] text-[var(--muted)] font-medium">
            Nenhuma métrica neste {activeType === 'setor' ? 'setor' : activeType === 'time' ? 'time' : 'grupo'} ainda.
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader
        icon={<BarChart3 className="w-4.5 h-4.5" />}
        title="Métricas do Setor, Times & Tarefas"
        subtitle="Configure indicadores de cada área, aponte o link do sistema e colete os valores com a extensão (poderes Automa) ou manualmente."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {extInstalled ? (
              <Badge tone="success" dot title="Extensão Dimensio detectada nesta página">
                Extensão ativa
              </Badge>
            ) : (
              <Badge
                tone="warning"
                dot
                title="Instale a extensão no menu Ajuda › Baixar Extensão (.zip) para coletas automáticas e seletor de campos"
              >
                Extensão não detectada
              </Badge>
            )}
            <Button size="sm" variant="outline" icon={Info} onClick={() => showNotice('Coleta automática: a extensão abre o link, localiza o seletor e devolve o valor para esta tela.')}>
              Como funciona
            </Button>
            <Button size="sm" icon={Plus} onClick={() => openAdd(activeType)}>
              Nova Métrica
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
          <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Métricas</div>
          <div className="text-lg font-black text-[var(--ink)] mt-0.5">{defs.length}</div>
        </div>
        <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
          <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Coletas</div>
          <div className="text-lg font-black text-[var(--ink)] mt-0.5">{readings.length}</div>
        </div>
        <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
          <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Coletas hoje</div>
          <div className="text-lg font-black text-[var(--ink)] mt-0.5">{todayReadings}</div>
        </div>
        <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
          <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Automáticas</div>
          <div className="text-lg font-black text-[var(--ink)] mt-0.5">{defs.filter((d) => d.schedule?.enabled).length}</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveType('setor')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              activeType === 'setor'
                ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> Setor
          </button>
          <button
            type="button"
            onClick={() => setActiveType('time')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              activeType === 'time'
                ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Times
          </button>
          <button
            type="button"
            onClick={() => setActiveType('tarefa')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              activeType === 'tarefa'
                ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" /> Tarefas
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {activeType === 'tarefa' && (
          <div className="p-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span className="text-[11px] font-black uppercase tracking-wider text-[var(--ink)]">
                  Tarefas por área (contagem de postos)
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge tone="success" dot>Total: {grandTotal.total}</Badge>
                <Badge tone="warning">Pendentes: {grandTotal.pending}</Badge>
                <Badge tone="info">Processando: {grandTotal.processing}</Badge>
              </div>
            </div>
            {areaCounts.length === 0 ? (
              <p className="text-[11px] text-[var(--muted)] font-medium leading-relaxed">
                Ainda não há contagens coletadas. Um posto (tarefa) atende VÁRIAS áreas — cadastre as métricas{" "}
                <strong>"Pendentes"</strong> e <strong>"Em processamento"</strong> por posto, grave o fluxo de filtros
                e liste as áreas a contar (a extensão conta as ocorrências de cada nome na página, como CTRL+F). O
                resumo soma os postos por área para planejar rotas (o sistema da empresa não diferencia geografia).
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {areaCounts.map((a) => (
                  <div
                    key={a.area}
                    className="p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-extrabold text-[var(--ink)] truncate">{a.area}</div>
                      <div className="text-[10px] text-[var(--muted)] font-semibold">
                        {a.tasks} posto(s) • atualizado {formatTime(a.updatedAt || '')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="px-1.5 py-0.5 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black">
                        {a.pending} pend.
                      </span>
                      <span className="px-1.5 py-0.5 rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-black">
                        {a.processing} proc.
                      </span>
                      <span className="px-1.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                        {a.total} total
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {defs.filter((d) => d.targetType === activeType).length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title={`Nenhuma métrica de ${activeType === 'setor' ? 'setor' : activeType === 'time' ? 'time' : 'tarefa'}`}
            description="Cadastre a primeira métrica para começar a acompanhar indicadores deste tipo."
          />
        ) : (
          orderedGroups.map(([gid, items]) => renderGroup(gid, items))
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-[var(--line)]">
        <SectionHeader
          title="Coletas registradas"
          subtitle="Últimos valores coletados (extensão ou manual) — ordene a operação pelos números."
        />
        <div className="mt-3 space-y-1.5">
          {recentReadings.length === 0 ? (
            <div className="text-[11px] text-[var(--muted)] font-medium italic">
              Nenhuma coleta registrada ainda. Use "Coletar" ou "Valor" em uma métrica acima.
            </div>
          ) : (
            recentReadings.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-2 p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-extrabold text-[var(--ink)] truncate">{metricName(r.metricId)}</span>
                    <Badge tone="neutral">{formatTime(r.capturedAt)}</Badge>
                    {r.capturedBy && <Badge tone="primary">{r.capturedBy}</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {readingValueRows(r.metricId ? defs.find((d) => d.id === r.metricId) : undefined, r.values || {}).map(
                      (row) => (
                        <span key={row.key} className="text-[11px] font-semibold text-[var(--muted)]">
                          {row.label}: <span className="text-[var(--ink)] font-extrabold">{row.value ?? '—'}</span>
                        </span>
                      )
                    )}
                    {readingValueRows(r.metricId ? defs.find((d) => d.id === r.metricId) : undefined, r.values || {})
                      .length === 0 && (
                      <span className="text-[11px] font-semibold text-[var(--muted)]">
                        {Object.entries(r.values || {})
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' • ')}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMetricReading(r.id)}
                  className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                  title="Remover registro"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Editar métrica' : 'Nova métrica'}
        subtitle="Defina nome, link do sistema e a coleta (campos por seletor ou contagem de áreas por CTRL+F)."
        size="lg"
        icon={<BarChart3 className="w-4.5 h-4.5" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} icon={Check}>
              {editingId ? 'Salvar alterações' : 'Cadastrar métrica'}
            </Button>
          </>
        }
      >
        <form onSubmit={save} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nome da métrica" hint="Ex: Produção do dia, Lead time, Ocupação do time">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Produção acumulada (picks/hora)" />
            </Field>
            <Field label="Unidade" hint="Opcional">
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Ex: caixas, %, un." />
            </Field>
          </div>

          <Field label="Link da fonte (sistema)" hint="URL onde o valor aparece. A extensão abre este link para coletar.">
            <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://sistema.empresa.com.br/..." />
          </Field>

          <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2.5">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">Tipo de coleta</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, kind: 'generic' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  form.kind !== 'task_counts'
                    ? 'bg-[var(--primary-soft)] border-[var(--primary)]'
                    : 'bg-[var(--surface-2)] border-[var(--line)]'
                }`}
              >
                <div className="text-xs font-extrabold text-[var(--ink)]">Valores por campo</div>
                <div className="text-[11px] text-[var(--muted)] font-medium mt-0.5">
                  Extrai números/textos de elementos da página por seletor CSS (ex: produção do dia).
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, kind: 'task_counts' })}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  form.kind === 'task_counts'
                    ? 'bg-[var(--primary-soft)] border-[var(--primary)]'
                    : 'bg-[var(--surface-2)] border-[var(--line)]'
                }`}
              >
                <div className="text-xs font-extrabold text-[var(--ink)]">Contagem de áreas (CTRL+F)</div>
                <div className="text-[11px] text-[var(--muted)] font-medium mt-0.5">
                  Aplica filtros (fluxo) e conta as ocorrências de cada nome de área na página. Um posto atende várias áreas.
                </div>
              </button>
            </div>
          </div>

          <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2.5">
            <Toggle
              checked={!!form.schedule.enabled}
              onChange={(v) => setForm({ ...form, schedule: { ...form.schedule, enabled: v } })}
              label="Coleta automática recorrente"
              hint="Enquanto o app estiver aberto, a coleta roda sozinha nos horários abaixo: abre o link do sistema e a extensão devolve os valores automaticamente."
            />
            {form.schedule.enabled && (
              <>
                <Field label="Frequência">
                  <Select
                    value={form.schedule.cadence}
                    onChange={(e) =>
                      setForm({ ...form, schedule: { ...form.schedule, cadence: e.target.value as 'diaria' | 'semanal' } })
                    }
                  >
                    <option value="diaria">Diária (todos os dias)</option>
                    <option value="semanal">Semanal (dias da semana)</option>
                  </Select>
                </Field>
                {form.schedule.cadence === 'semanal' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => {
                      const active = (form.schedule.daysOfWeek || []).includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const days = form.schedule.daysOfWeek || [];
                            setForm({
                              ...form,
                              schedule: {
                                ...form.schedule,
                                daysOfWeek: active ? days.filter((x) => x !== i) : [...days, i],
                              },
                            });
                          }}
                          className={`w-8 h-8 rounded-lg text-[11px] font-black cursor-pointer transition-colors ${
                            active ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'bg-[var(--surface-2)] text-[var(--muted)]'
                          }`}
                          title={`${d}${i === 0 ? 'omingo' : i === 6 ? 'ábado' : ''}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                )}
                <Field label="Horários (HH:MM)">
                  <div className="space-y-1.5">
                    {(form.schedule.times && form.schedule.times.length ? form.schedule.times : ['07:00']).map((t, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Input
                          value={t}
                          onChange={(e) => {
                            const times = [...(form.schedule.times && form.schedule.times.length ? form.schedule.times : ['07:00'])];
                            times[idx] = e.target.value;
                            setForm({ ...form, schedule: { ...form.schedule, times } });
                          }}
                          placeholder="HH:MM"
                          className="!w-28"
                        />
                        {(form.schedule.times || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const times = [...(form.schedule.times || ['07:00'])];
                              times.splice(idx, 1);
                              setForm({ ...form, schedule: { ...form.schedule, times } });
                            }}
                            className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
                            title="Remover horário"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {idx === 0 && (
                          <Button
                            size="xs"
                            variant="outline"
                            icon={Plus}
                            onClick={() => {
                              const times = [...(form.schedule.times && form.schedule.times.length ? form.schedule.times : ['07:00']), '12:00'];
                              setForm({ ...form, schedule: { ...form.schedule, times } });
                            }}
                          >
                            Horário
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </Field>
              </>
            )}
          </div>

          {activeType !== 'setor' && (
            <Field label={activeType === 'time' ? 'Time' : 'Tarefa'}>
              <Select value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })}>
                <option value="">Selecione...</option>
                {activeType === 'time'
                  ? teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))
                  : tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
              </Select>
            </Field>
          )}

          {form.kind !== 'task_counts' && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                  Campos a extrair
                </span>
                <Button size="xs" variant="outline" icon={Plus} onClick={addFieldRow}>
                  Adicionar campo
                </Button>
              </div>
              <p className="text-[11px] text-[var(--muted)] font-medium mt-1">
                Cada campo vira um valor na coleta. O seletor CSS localiza o elemento na página (ex:{" "}
                <code className="bg-[var(--surface-2)] px-1 rounded">.total-prod .qtd</code>).
              </p>
              <div className="mt-2 space-y-2">
                {form.fields.map((f, idx) => (
                  <div key={f.id} className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-[var(--ink)]">Campo {idx + 1}</span>
                      {form.fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFieldRow(idx)}
                          className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
                          title="Remover campo"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={f.label}
                        onChange={(e) => setField(idx, { label: e.target.value })}
                        placeholder="Rótulo (ex: Produção acumulada)"
                      />
                      <Select value={f.mode} onChange={(e) => setField(idx, { mode: e.target.value as FieldDraft['mode'] })}>
                        <option value="text">{MODE_LABEL.text}</option>
                        <option value="attribute">{MODE_LABEL.attribute}</option>
                        <option value="value">{MODE_LABEL.value}</option>
                      </Select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={f.selector}
                        onChange={(e) => setField(idx, { selector: e.target.value })}
                        placeholder="Seletor CSS"
                      />
                      {f.mode === 'attribute' && (
                        <Input
                          value={f.attribute}
                          onChange={(e) => setField(idx, { attribute: e.target.value })}
                          placeholder="Atributo (ex: title, data-codigo)"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {form.kind === 'task_counts' && (
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]">
                    Áreas a contar (estilo CTRL+F)
                  </span>
                </div>
                <Button size="xs" variant="outline" icon={Plus} onClick={addCountTerm}>
                  Adicionar área
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Visão filtrada">
                  <Select
                    value={form.countKind}
                    onChange={(e) => setForm({ ...form, countKind: e.target.value as FormState['countKind'] })}
                  >
                    <option value="pending">Pendentes</option>
                    <option value="processing">Em processamento</option>
                  </Select>
                </Field>
                <Field label="Contêiner da busca (opcional)" hint="Seletor CSS da região onde procurar. Vazio = página toda.">
                  <Input
                    value={form.countScope}
                    onChange={(e) => setForm({ ...form, countScope: e.target.value })}
                    placeholder="ex: .tabela-pendencias"
                  />
                </Field>
              </div>
              <p className="text-[11px] text-[var(--muted)] font-medium">
                Após aplicar os filtros (fluxo abaixo), a extensão conta quantas vezes cada nome de área aparece na
                página — como dar CTRL+F em cada área. Um posto atende várias áreas; o resumo soma por área.
              </p>
              {form.countTerms.length === 0 ? (
                <div className="text-[11px] text-[var(--muted)] font-medium italic">
                  Nenhuma área ainda. Adicione os nomes exatos que aparecem na página (ex: "Expedição", "Andar 2").
                </div>
              ) : (
                <div className="space-y-1.5">
                  {form.countTerms.map((t, idx) => (
                    <div key={t.id} className="p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 shrink-0 rounded-md bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <Input
                          value={t.area}
                          onChange={(e) => setCountTerm(idx, { area: e.target.value })}
                          placeholder="Nome da área (ex: Expedição)"
                        />
                        <button
                          type="button"
                          onClick={() => removeCountTerm(idx)}
                          className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
                          title="Remover área"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <Input
                        value={t.selector || ''}
                        onChange={(e) => setCountTerm(idx, { selector: e.target.value })}
                        placeholder="Seletor opcional (conta apenas nesse elemento)"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fluxo de automação (passos executados antes da coleta) */}
          <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MousePointerClick className="w-4 h-4 text-violet-600" />
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]">
                  Fluxo de automação (aplicar filtros)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {(['click', 'input', 'select_option', 'wait'] as const).map((t) => (
                  <Button key={t} size="xs" variant="outline" icon={Plus} onClick={() => addFlowStep(t)}>
                    {FLOW_LABEL[t]}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-[var(--muted)] font-medium">
              A extensão executa estes passos na página do sistema antes de coletar (ex: selecionar turno/área nos filtros).
              Use <strong>"Fluxo"</strong> na métrica para gravar os cliques diretamente na página.
            </p>
            {form.flow.length === 0 ? (
              <div className="text-[11px] text-[var(--muted)] font-medium italic">
                Nenhum passo ainda — a coleta abre o link e segue direto para a extração/contagem.
              </div>
            ) : (
              <div className="space-y-1.5">
                {form.flow.map((s, idx) => (
                  <div key={idx} className="p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-5 h-5 shrink-0 rounded-md bg-violet-600 text-white text-[10px] font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <select
                        value={s.type}
                        onChange={(e) => setFlowStep(idx, { type: e.target.value as MetricFlowStep['type'] })}
                        className="text-[11px] font-bold bg-[var(--bg)] border border-[var(--line)] rounded-lg px-2 py-1 text-[var(--ink)]"
                      >
                        {Object.keys(FLOW_LABEL).map((k) => (
                          <option key={k} value={k}>
                            {FLOW_LABEL[k as MetricFlowStep['type']]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeFlowStep(idx)}
                        className="ml-auto p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
                        title="Remover passo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {(s.type === 'click' || s.type === 'input' || s.type === 'select_option' || s.type === 'wait_selector') && (
                      <Input
                        value={s.selector || ''}
                        onChange={(e) => setFlowStep(idx, { selector: e.target.value })}
                        placeholder={s.type === 'wait_selector' ? 'Seletor CSS a aguardar' : 'Seletor CSS do elemento'}
                      />
                    )}
                    {(s.type === 'input' || s.type === 'select_option') && (
                      <Input
                        value={s.value || ''}
                        onChange={(e) => setFlowStep(idx, { value: e.target.value })}
                        placeholder={s.type === 'select_option' ? 'Opção a selecionar (texto ou valor)' : 'Valor a digitar'}
                      />
                    )}
                    {s.type === 'open_url' && (
                      <Input
                        value={s.url || ''}
                        onChange={(e) => setFlowStep(idx, { url: e.target.value })}
                        placeholder="https://..."
                      />
                    )}
                    {s.type === 'wait' && (
                      <Input
                        type="number"
                        value={String(s.ms || 1000)}
                        onChange={(e) => setFlowStep(idx, { ms: parseInt(e.target.value, 10) || 0 })}
                        placeholder="Milissegundos"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!manualMetric}
        onClose={() => setManualMetric(null)}
        title={manualMetric ? `Registrar valores — ${manualMetric.name}` : 'Registrar valores'}
        subtitle="Digite os valores coletados manualmente para esta métrica."
        size="md"
        icon={<Database className="w-4.5 h-4.5" />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setManualMetric(null)}>
              Cancelar
            </Button>
            <Button onClick={saveManual} icon={Check}>
              Salvar coleta
            </Button>
          </>
        }
      >
        {manualMetric && (
          <form onSubmit={saveManual} className="space-y-3">
            {manualMetric.kind === 'task_counts' ? (
              <>
                <div className="text-xs text-[var(--muted)] font-medium">
                  Digite a contagem de cada área nesta visão ({manualMetric.countKind === 'processing' ? 'Em processamento' : 'Pendentes'}).
                </div>
                {(manualMetric.countTerms || []).map((t) => (
                  <Field key={t.id} label={t.area || 'Área'} hint={t.selector ? `Conta apenas em: ${t.selector}` : undefined}>
                    <Input
                      type="number"
                      min="0"
                      value={manualValues[t.area] || ''}
                      onChange={(e) => setManualValues((prev) => ({ ...prev, [t.area]: e.target.value }))}
                      placeholder="0"
                    />
                  </Field>
                ))}
                {(!manualMetric.countTerms || manualMetric.countTerms.length === 0) && (
                  <div className="text-xs text-[var(--muted)] font-medium">
                    Nenhuma área cadastrada. Edite a métrica e adicione as áreas a contar.
                  </div>
                )}
              </>
            ) : (
              (manualMetric.fields || []).map((f) => (
                <Field key={f.id} label={f.label || 'Valor'} hint={f.selector ? `Seletor: ${f.selector}` : undefined}>
                  <Input
                    value={manualValues[f.id] || ''}
                    onChange={(e) => setManualValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                    placeholder="Valor"
                  />
                </Field>
              ))
            )}
            {manualMetric.kind !== 'task_counts' && (!manualMetric.fields || manualMetric.fields.length === 0) && (
              <div className="text-xs text-[var(--muted)] font-medium">
                Esta métrica não possui campos cadastrados. Edite a métrica para adicionar campos.
              </div>
            )}
          </form>
        )}
      </Modal>

      <Modal
        isOpen={!!chartDef}
        onClose={() => setChartDef(null)}
        title={chartDef ? `Histórico — ${chartDef.name}` : 'Histórico'}
        subtitle="Evolução dos valores coletados ao longo do tempo."
        size="lg"
        icon={<TrendingUp className="w-4.5 h-4.5" />}
        footer={
          <Button variant="ghost" onClick={() => setChartDef(null)}>
            Fechar
          </Button>
        }
      >
        {chartDef && (
          <div className="space-y-4">
            {(chartDef.kind === 'task_counts'
              ? (chartDef.countTerms || []).map((t) => ({
                  id: t.id,
                  label: t.area,
                  valueKey: t.area,
                }))
              : (chartDef.fields || []).map((f) => ({
                  id: f.id,
                  label: f.label || 'Valor',
                  valueKey: f.id,
                }))
            ).map((f) => {
              const series = readings
                .filter((r) => r.metricId === chartDef.id && r.values?.[f.valueKey] != null && r.values[f.valueKey] !== '')
                .map((r) => ({
                  t: formatTime(r.capturedAt),
                  v: parseFloat(String(r.values[f.valueKey]).replace(',', '.')),
                  raw: r.values[f.valueKey],
                }))
                .filter((p) => !isNaN(p.v));
              return (
                <div key={f.id} className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-[var(--ink)]">{f.label || 'Valor'}</span>
                    <Badge tone="neutral">{series.length} ponto(s)</Badge>
                  </div>
                  <div className="mt-2 overflow-x-auto">
                    <SparkLine points={series.map((s) => ({ t: s.t, v: s.v }))} />
                  </div>
                  {series.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {series
                        .slice(-5)
                        .reverse()
                        .map((s) => (
                          <Badge key={s.t} tone="primary" className="!normal-case">
                            {s.t}: {s.raw}
                          </Badge>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
            {chartDef.kind === 'task_counts'
              ? (!chartDef.countTerms || chartDef.countTerms.length === 0) && (
                  <div className="text-xs text-[var(--muted)] font-medium">Métrica de contagem sem áreas cadastradas.</div>
                )
              : (!chartDef.fields || chartDef.fields.length === 0) && (
                  <div className="text-xs text-[var(--muted)] font-medium">Métrica sem campos cadastrados.</div>
                )}
          </div>
        )}
      </Modal>
    </Card>
  );
};

function SparkLine({ points }: { points: { t: string; v: number }[] }) {
  const width = 280;
  const height = 90;
  if (points.length === 0) {
    return <div className="text-[11px] text-[var(--muted)] italic">Sem dados numéricos para gerar gráfico.</div>;
  }
  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const range = max - min || 1;
  const stepX = width / (points.length - 1 || 1);
  const coords = points.map((p, i) => ({
    x: i * stepX,
    y: height - 10 - ((p.v - min) / range) * (height - 24),
    t: p.t,
  }));
  const poly = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <line x1="0" y1={height - 10} x2={width} y2={height - 10} stroke="var(--line)" strokeWidth="1" />
      <polyline
        points={poly}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--primary)">
          <title>{`${c.t}: ${points[i].v}`}</title>
        </circle>
      ))}
      <text x="0" y={height - 1} fontSize="8" fill="var(--muted)">
        {min}
      </text>
      <text x={width - 26} y={height - 1} fontSize="8" fill="var(--muted)">
        {max}
      </text>
      {coords.length > 0 && (
        <text x={coords[0].x} y={coords[0].y - 6} fontSize="8" fill="var(--muted)">
          {coords[0].t}
        </text>
      )}
    </svg>
  );
}
