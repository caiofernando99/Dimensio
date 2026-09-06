import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateBR, getTodayISO } from '../utils/helpers';
import { APPS_SCRIPT_VERSION, APP_VERSION } from '../version';
import { WorkspaceHubPanel } from './WorkspaceHubPanel';
import {
  FileSpreadsheet,
  Zap,
  Globe,
  Database,
  Download,
  Upload,
  Code2,
  Terminal,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Copy,
  Check,
  Share2,
  Sparkles,
  WifiOff,
  CloudOff,
  ShieldCheck,
  Users,
  Calendar,
  Layers,
  ArrowRight,
  ListTodo,
  ExternalLink,
  MessageSquare,
  BarChart3,
  HelpCircle,
  Radio,
  FileText,
} from 'lucide-react';
import { PresenceSyncEvent, PresenceSyncRecord } from '../types';

interface IntegrationsSettingsPanelProps {
  databaseProvider?: 'sheets' | 'firestore';
  setDatabaseProvider?: (val: 'sheets' | 'firestore') => void;
  firestoreCollection?: string;
  setFirestoreCollection?: (val: string) => void;
  sheetName: string;
  setSheetName: (val: string) => void;
  sheetUrl: string;
  setSheetUrl: (val: string) => void;
  webhookUrl: string;
  setWebhookUrl: (val: string) => void;
  turnServers: string;
  setTurnServers: (val: string) => void;
  autoSync: boolean;
  setAutoSync: (val: boolean) => void;
  isSyncing: boolean;
  isTesting: boolean;
  testDiag: { success: boolean; message: string; details?: string } | null;
  handleSaveSpreadsheetConfig: (e: React.FormEvent) => void;
  handleSyncNow: () => Promise<void>;
  handleForceRecreate: () => Promise<void>;
  handleCopyShareConnectionLink: () => void;
  copiedShareLink: boolean;
  setShowAppsScriptModal: (val: boolean) => void;
  handleExportConfig: () => void;
  handleSelectImportFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setIsTesting: (val: boolean) => void;
  setTestDiag: (val: any) => void;
  checkPermissionOrAlert?: () => boolean;
}

export const IntegrationsSettingsPanel: React.FC<IntegrationsSettingsPanelProps> = ({
  databaseProvider = 'sheets',
  setDatabaseProvider,
  firestoreCollection = 'dimensio_workspaces',
  setFirestoreCollection,
  sheetName,
  setSheetName,
  sheetUrl,
  setSheetUrl,
  webhookUrl,
  setWebhookUrl,
  turnServers,
  setTurnServers,
  autoSync,
  setAutoSync,
  isSyncing,
  isTesting,
  testDiag,
  handleSaveSpreadsheetConfig,
  handleSyncNow,
  handleForceRecreate,
  handleCopyShareConnectionLink,
  copiedShareLink,
  setShowAppsScriptModal,
  handleExportConfig,
  handleSelectImportFile,
  setIsTesting,
  setTestDiag,
  checkPermissionOrAlert,
}) => {
  const {
    state,
    setOnlineSpreadsheetConfig,
    testWebhookConnection,
    exportPresenceList,
    importExternalPresenceList,
    syncPresenceToApi,
    fetchPresenceEvents,
    showNotice,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<
    'workspace_hub' | 'spreadsheet_webhook' | 'dimensio_api' | 'presence_extract_insert' | 'code_docs' | 'sync_events'
  >('workspace_hub');

  // Presence extract/insert state
  const [selectedDate, setSelectedDate] = useState<string>(state.selectedDate || getTodayISO());
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');
  const [scaleFilter, setScaleFilter] = useState<string>('ALL');

  // Insert state
  const [inputText, setInputText] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [parsedPreview, setParsedPreview] = useState<PresenceSyncRecord[]>([]);

  // Docs state
  const [codeTab, setCodeTab] = useState<'curl' | 'js' | 'python' | 'appsscript' | 'webhook'>('curl');
  const [apiTestStatus, setApiTestStatus] = useState<{ loading: boolean; success?: boolean; msg?: string; payload?: any } | null>(null);

  // Events state
  const [events, setEvents] = useState<PresenceSyncEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);

  // Copied indicator
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live endpoint test selector
  const [selectedEndpointTest, setSelectedEndpointTest] = useState<string>('/api/dimensio/overview');
  const [isTestingEndpoint, setIsTestingEndpoint] = useState<boolean>(false);
  const [endpointResult, setEndpointResult] = useState<any | null>(null);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const apiUrlGet = `${baseUrl}/api/presence?date=${selectedDate}${shiftFilter !== 'ALL' ? `&shift=${shiftFilter}` : ''}${scaleFilter !== 'ALL' ? `&scale=${scaleFilter}` : ''}&format=${format}`;
  const apiUrlPost = `${baseUrl}/api/presence`;
  const apiUrlWebhook = `${baseUrl}/api/presence/webhook`;
  const apiUrlDimensioOverview = `${baseUrl}/api/dimensio/overview`;

  useEffect(() => {
    // Sincroniza presença com servidor da API
    syncPresenceToApi();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'sync_events') {
      loadEvents();
    }
  }, [activeSubTab]);

  const loadEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const list = await fetchPresenceEvents();
      setEvents(list);
    } catch {
      // Handled
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    showNotice('Copiado para a área de transferência!');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Parser para texto de importação
  useEffect(() => {
    if (!inputText.trim()) {
      setParsedPreview([]);
      return;
    }
    try {
      const trimmed = inputText.trim();
      let records: PresenceSyncRecord[] = [];
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          records = Array.isArray(parsed) ? parsed : (parsed.records || parsed.data || [parsed]);
        } catch {
          // fallback to CSV
        }
      }
      if (records.length === 0) {
        const lines = trimmed.split(/[\r\n]+/).filter(Boolean);
        lines.forEach((line, idx) => {
          if (idx === 0 && (line.toLowerCase().includes('nome') || line.toLowerCase().includes('status'))) return;
          const parts = line.split(/[;,]/).map((p) => p.replace(/^["']|["']$/g, '').trim());
          if (parts.length >= 2) {
            records.push({
              name: parts[0],
              status: (parts[1] as any) || 'presente',
              login: parts[2] || undefined,
              registration: parts[3] || undefined,
              reason: parts[4] || undefined,
              date: selectedDate,
            });
          }
        });
      }
      setParsedPreview(records);
    } catch {
      setParsedPreview([]);
    }
  }, [inputText, selectedDate]);

  const handleImport = async () => {
    if (!inputText.trim() || parsedPreview.length === 0) {
      showNotice('Insira ou cole uma lista de presença válida.');
      return;
    }
    setIsImporting(true);
    try {
      const res = await importExternalPresenceList(inputText, selectedDate);
      if (res.success) {
        setInputText('');
        setParsedPreview([]);
        loadEvents();
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleApplyExampleCsv = () => {
    setInputText(
      `Nome;Status;Login;Matricula;Motivo\n` +
      `Carlos Oliveira;presente;carlos.oliveira;10492;\n` +
      `Mariana Santos;atraso;mariana.santos;10493;Transporte\n` +
      `Beatriz Lima;folga;beatriz.lima;10494;\n` +
      `Lucas Ferreira;atestado;lucas.ferreira;10495;Consulta médica`
    );
  };

  const handleApplyExampleJson = () => {
    setInputText(
      JSON.stringify(
        [
          { name: 'Carlos Oliveira', status: 'presente', login: 'carlos.oliveira' },
          { name: 'Mariana Santos', status: 'atraso', reason: 'Atraso 15min', login: 'mariana.santos' },
          { name: 'Beatriz Lima', status: 'folga', login: 'beatriz.lima' },
          { name: 'Lucas Ferreira', status: 'atestado', reason: 'Atestado médico 1 dia', login: 'lucas.ferreira' },
        ],
        null,
        2
      )
    );
  };

  const handleTestPresenceApi = async () => {
    setApiTestStatus({ loading: true });
    try {
      const res = await fetch(`/api/presence?date=${selectedDate}&format=json`);
      if (res.ok) {
        const json = await res.json();
        setApiTestStatus({
          loading: false,
          success: true,
          msg: `API online e respondendo! Total de ${json.total || 0} registros retornados.`,
          payload: json,
        });
      } else {
        setApiTestStatus({
          loading: false,
          success: false,
          msg: `Erro HTTP ${res.status}: ${res.statusText}`,
        });
      }
    } catch (err: any) {
      setApiTestStatus({
        loading: false,
        success: false,
        msg: `Falha na requisição: ${err?.message}`,
      });
    }
  };

  const handleExecuteLiveEndpointTest = async () => {
    setIsTestingEndpoint(true);
    setEndpointResult(null);
    try {
      const targetUrl = selectedEndpointTest.startsWith('http')
        ? selectedEndpointTest
        : `${baseUrl}${selectedEndpointTest}`;
      const res = await fetch(targetUrl);
      const data = await res.json();
      setEndpointResult({
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        url: targetUrl,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        data,
      });
    } catch (err: any) {
      setEndpointResult({
        status: 500,
        statusText: 'Error',
        ok: false,
        error: err?.message,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });
    } finally {
      setIsTestingEndpoint(false);
    }
  };

  const apiEndpoints = [
    {
      method: 'GET',
      path: '/api/dimensio/overview',
      desc: 'Resumo operacional, contagem de presentes/ausentes, postos e chamados ativos.',
      category: 'Geral',
    },
    {
      method: 'GET',
      path: '/api/presence?date=' + selectedDate,
      desc: 'Consulta lista de presença, faltas, férias, atestados e turnos da data.',
      category: 'Presença',
    },
    {
      method: 'POST',
      path: '/api/presence',
      desc: 'Insere ou atualiza registros de presença (aceita JSON com match por login, nome ou matrícula).',
      category: 'Presença',
    },
    {
      method: 'POST',
      path: '/api/presence/webhook',
      desc: 'Webhook de ponto eletrônico para recepção instantânea de batidas de ponto.',
      category: 'Presença',
    },
    {
      method: 'GET',
      path: '/api/collaborators',
      desc: 'Lista todos os colaboradores cadastrados, turnos, escalas e cargos.',
      category: 'Equipe',
    },
    {
      method: 'GET',
      path: '/api/tasks',
      desc: 'Lista postos de trabalho e quantidade de operadores alocados.',
      category: 'Alocação',
    },
    {
      method: 'POST',
      path: '/api/tasks/assign',
      desc: 'Aloca um colaborador em um posto operacional via API.',
      category: 'Alocação',
    },
    {
      method: 'GET',
      path: '/api/breaks?date=' + selectedDate,
      desc: 'Consulta a escala de horários de intervalos e refeição da data.',
      category: 'Intervalos',
    },
    {
      method: 'GET',
      path: '/api/routines',
      desc: 'Consulta rotinas agendadas, feedbacks e checklists operacionais.',
      category: 'Rotinas',
    },
    {
      method: 'GET',
      path: '/api/metrics',
      desc: 'Consulta definições de métricas e leituras da extensão do Dimensio.',
      category: 'Métricas',
    },
    {
      method: 'GET',
      path: '/api/support/requests',
      desc: 'Lista chamados de suporte, pedidos de insumos e helpdesk da operação.',
      category: 'Suporte',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Overview Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Card Planilha Google */}
        <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3.5 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold shrink-0 border border-emerald-300 dark:border-emerald-800">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Planilha Compartilhada
              </div>
              <div className="text-xs font-black text-[var(--ink)] truncate">
                {state.onlineSpreadsheet?.name || 'Não configurada'}
              </div>
              <div className="text-[10px] font-semibold text-[var(--muted)] truncate">
                {state.onlineSpreadsheet?.lastSyncedAt
                  ? `Sincronizada em ${state.onlineSpreadsheet.lastSyncedAt}`
                  : 'Aguardando sincronização'}
              </div>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 text-[9.5px] font-black uppercase rounded-md shrink-0 border ${
              state.onlineSpreadsheet
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
            }`}
          >
            {state.onlineSpreadsheet ? 'Conectada' : 'Local'}
          </span>
        </div>

        {/* Card API REST Dimensio */}
        <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3.5 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold shrink-0 border border-[var(--primary-border)]">
              <Zap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                API REST Dimensio
              </div>
              <div className="text-xs font-black text-[var(--ink)] truncate">
                Servidor de Endpoints Ativo
              </div>
              <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 font-bold truncate">
                • 11 endpoints REST disponíveis
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[9.5px] font-black uppercase rounded-md shrink-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            Online
          </span>
        </div>

        {/* Card Webhook Apps Script */}
        <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3.5 shadow-2xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold shrink-0 border border-purple-300 dark:border-purple-800">
              <Globe className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Webhook & Ponto
              </div>
              <div className="text-xs font-black text-[var(--ink)] truncate">
                Apps Script & Webhooks
              </div>
              <div className="text-[10px] font-semibold text-[var(--muted)] truncate">
                Versão script: v{APPS_SCRIPT_VERSION}
              </div>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 text-[9.5px] font-black uppercase rounded-md shrink-0 border ${
              webhookUrl.trim()
                ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 dark:border-amber-800'
            }`}
          >
            {webhookUrl.trim() ? 'Configurado' : 'Pendente'}
          </span>
        </div>
      </div>

      {/* Subtabs Bar */}
      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-1.5 shadow-2xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveSubTab('workspace_hub')}
          className={`px-3.5 py-2 rounded-lg font-black text-xs transition-all flex items-center gap-2 cursor-pointer border ${
            activeSubTab === 'workspace_hub'
              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
              : 'bg-[var(--bg)] text-[var(--ink)] border-transparent hover:border-[var(--line)]'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Google Workspace & Cloud SQL</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('spreadsheet_webhook')}
          className={`px-3.5 py-2 rounded-lg font-black text-xs transition-all flex items-center gap-2 cursor-pointer border ${
            activeSubTab === 'spreadsheet_webhook'
              ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
              : 'bg-[var(--bg)] text-[var(--ink)] border-transparent hover:border-[var(--line)]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Planilha Google & Webhook</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('dimensio_api')}
          className={`px-3.5 py-2 rounded-lg font-black text-xs transition-all flex items-center gap-2 cursor-pointer border ${
            activeSubTab === 'dimensio_api'
              ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
              : 'bg-[var(--bg)] text-[var(--ink)] border-transparent hover:border-[var(--line)]'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>API REST do Dimensio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('presence_extract_insert')}
          className={`px-3.5 py-2 rounded-lg font-black text-xs transition-all flex items-center gap-2 cursor-pointer border ${
            activeSubTab === 'presence_extract_insert'
              ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
              : 'bg-[var(--bg)] text-[var(--ink)] border-transparent hover:border-[var(--line)]'
          }`}
        >
          <Download className="w-4 h-4" />
          <span>Extração & Inserção de Presença</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('code_docs')}
          className={`px-3.5 py-2 rounded-lg font-black text-xs transition-all flex items-center gap-2 cursor-pointer border ${
            activeSubTab === 'code_docs'
              ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
              : 'bg-[var(--bg)] text-[var(--ink)] border-transparent hover:border-[var(--line)]'
          }`}
        >
          <Code2 className="w-4 h-4" />
          <span>Documentação & Exemplos de Código</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('sync_events')}
          className={`px-3.5 py-2 rounded-lg font-black text-xs transition-all flex items-center gap-2 cursor-pointer border ${
            activeSubTab === 'sync_events'
              ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
              : 'bg-[var(--bg)] text-[var(--ink)] border-transparent hover:border-[var(--line)]'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Histórico de Logs & Webhooks</span>
        </button>
      </div>

      {/* SUBTAB 0: GOOGLE WORKSPACE & CLOUD SQL HUB */}
      {activeSubTab === 'workspace_hub' && <WorkspaceHubPanel />}

      {/* SUBTAB 1: PLANILHA GOOGLE & WEBHOOK NUVEM */}
      {activeSubTab === 'spreadsheet_webhook' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Main Database & Storage Integration (7 cols) */}
          <div className="lg:col-span-7 bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg ${databaseProvider === 'firestore' ? 'bg-amber-600' : 'bg-emerald-600'} text-white flex items-center justify-center font-bold`}>
                  {databaseProvider === 'firestore' ? <Database className="w-4 h-4" /> : <FileSpreadsheet className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--ink)]">
                    {databaseProvider === 'firestore' ? 'Banco em Nuvem em Tempo Real (Firebase Firestore)' : 'Conectar Planilha Compartilhada (Google Sheets)'}
                  </h3>
                  <p className="text-[11px] text-[var(--muted)] font-semibold">
                    {databaseProvider === 'firestore' ? 'Sincronização instantânea milissegundo a milissegundo com notificações push imediatas.' : 'Banco de dados online compartilhado em tempo real com os líderes do setor.'}
                  </p>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {state.onlineSpreadsheet && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 text-[10px] font-black uppercase tracking-wider border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3" /> Conectado ({state.onlineSpreadsheet.databaseProvider === 'firestore' ? 'Firestore' : 'Sheets'})
                  </span>
                )}
              </div>
            </div>

            {/* Provider Switcher Selector */}
            <div className="bg-[var(--bg)] p-1.5 rounded-xl border border-[var(--line)] flex items-center gap-1">
              <button
                type="button"
                onClick={() => setDatabaseProvider && setDatabaseProvider('firestore')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  databaseProvider === 'firestore'
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Firebase Firestore (Ultra Rápido / Tempo Real)</span>
              </button>
              <button
                type="button"
                onClick={() => setDatabaseProvider && setDatabaseProvider('sheets')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  databaseProvider === 'sheets'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Google Sheets (Planilha Oficial)</span>
              </button>
            </div>

            <form onSubmit={handleSaveSpreadsheetConfig} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                    Nome do Espaço / Banco
                  </label>
                  <input
                    type="text"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-1.5 font-semibold text-[var(--ink)]"
                    placeholder={databaseProvider === 'firestore' ? 'Ex: Equipe Logística T2' : 'Ex: Planilha de Turnos T2'}
                  />
                </div>

                {databaseProvider === 'firestore' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                      ID da Coleção / Sala de Trabalho
                    </label>
                    <input
                      type="text"
                      value={firestoreCollection}
                      onChange={(e) => setFirestoreCollection && setFirestoreCollection(e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-1.5 font-mono text-[11px] text-[var(--ink)]"
                      placeholder="dimensio_workspaces"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                      Link de Acesso (URL)
                    </label>
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-1.5 font-semibold text-[var(--ink)]"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                    />
                  </div>
                )}
              </div>

              {databaseProvider === 'sheets' && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <label className="block text-[11px] font-bold text-[var(--ink)]">
                        Webhook / Script URL (Google Apps Script)
                      </label>
                      <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[10px] font-black rounded-md">
                        v{APPS_SCRIPT_VERSION}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAppsScriptModal(true)}
                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-md flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Code2 className="w-3 h-3" />
                      <span>Ver Passo a Passo & Copiar Código (v{APPS_SCRIPT_VERSION})</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-1.5 font-mono text-[11px] text-[var(--ink)]"
                    placeholder="https://script.google.com/macros/s/.../exec"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                  Servidores TURN (áudio P2P e sinalização de voz)
                </label>
                <textarea
                  value={turnServers}
                  onChange={(e) => setTurnServers(e.target.value)}
                  rows={2}
                  className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-lg px-3 py-1.5 font-mono text-[11px] text-[var(--ink)]"
                  placeholder={'turn:turn.example.com:3478\nuser:pass@turn:turn.example.com:3478'}
                />
                <p className="text-[10px] text-[var(--muted)] mt-1">
                  Deixe vazio para usar o relay público automático.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--line)]">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                  <span>Sincronização Automática em Segundo Plano</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsTesting(true);
                      setTestDiag(null);
                      if (sheetName.trim() && sheetUrl.trim()) {
                        setOnlineSpreadsheetConfig(
                          {
                            name: sheetName.trim(),
                            url: sheetUrl.trim(),
                            webhookUrl: webhookUrl.trim() || undefined,
                            turnServers: turnServers.trim() || undefined,
                            autoSyncEnabled: autoSync,
                            lastSyncedAt: state.onlineSpreadsheet?.lastSyncedAt || '',
                            syncCount: state.onlineSpreadsheet?.syncCount || 0,
                          },
                          true
                        );
                      }
                      const res = await testWebhookConnection(webhookUrl);
                      setTestDiag(res);
                      setIsTesting(false);
                    }}
                    disabled={isTesting || !webhookUrl.trim()}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                    <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
                  </button>

                  {state.onlineSpreadsheet && (
                    <button
                      type="button"
                      onClick={handleSyncNow}
                      disabled={isSyncing}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Sincronizar Agora</span>
                    </button>
                  )}

                  {(state.onlineSpreadsheet || webhookUrl.trim().length > 0) && (
                    <button
                      type="button"
                      onClick={handleForceRecreate}
                      disabled={isSyncing || !webhookUrl.trim()}
                      title="Recria todas as abas da planilha e o banco de dados em nuvem a partir dos dados locais atuais."
                      className="px-3 py-1.5 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'Recriando...' : 'Recriar Planilha + Banco'}</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    Salvar Conexão
                  </button>
                </div>
              </div>

              {testDiag && (
                <div
                  className={`p-3 rounded-xl text-xs border ${
                    testDiag.success
                      ? 'bg-emerald-50 text-emerald-950 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-100 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-950 border-rose-300 dark:bg-rose-950/60 dark:text-rose-100 dark:border-rose-800'
                  }`}
                >
                  <div className="font-black flex items-center gap-1.5 mb-0.5">
                    {testDiag.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{testDiag.message}</span>
                  </div>
                  {testDiag.details && (
                    <p className="text-[11px] opacity-90 pl-5 leading-relaxed">{testDiag.details}</p>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Safe Export & Import Box (5 cols) */}
          <div className="lg:col-span-5 bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[var(--primary)] font-extrabold text-sm border-b border-[var(--line)] pb-3">
                <Database className="w-4 h-4" />
                <h3 className="text-sm text-[var(--ink)] font-black">Exportar e Importar Seguros (.JSON)</h3>
              </div>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Exporte todo o cadastro, regras de negócio e credenciais em arquivo JSON portátil. Ao importar, você poderá escolher entre atualizar apenas as regras ou realizar restauração completa com backup automático.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleCopyShareConnectionLink}
                className="w-full px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                {copiedShareLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span>{copiedShareLink ? 'Link de Conexão Copiado!' : 'Compartilhar Conexão em Nuvem'}</span>
              </button>

              <button
                type="button"
                onClick={handleExportConfig}
                className="w-full px-3.5 py-2.5 bg-[var(--primary)] text-white text-xs font-bold rounded-xl hover:bg-[var(--primary-hover)] flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Exportar Backup do Sistema (.JSON)</span>
              </button>

              <label className="w-full cursor-pointer px-3.5 py-2.5 border border-[var(--line)] text-xs font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-2 text-[var(--ink)] transition-colors">
                <Upload className="w-4 h-4 text-[var(--muted)]" />
                <span>Importar Backup (.JSON) com Alerta de Segurança</span>
                <input type="file" accept="application/json" onChange={handleSelectImportFile} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: API REST DO DIMENSIO */}
      {activeSubTab === 'dimensio_api' && (
        <div className="space-y-4">
          {/* Header da API */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-3 border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center font-bold border border-[var(--primary-border)]">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--ink)] flex items-center gap-2">
                    <span>API REST Dimensio — Conexão Direta</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-black rounded-md border border-emerald-300 dark:border-emerald-800">
                      HTTP JSON
                    </span>
                  </h3>
                  <p className="text-[11px] text-[var(--muted)]">
                    Integre ferramentas internas, scripts Python/Node, relógios de ponto ou sistemas legados ao Dimensio.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(baseUrl, 'baseUrl')}
                  className="px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--line)] border border-[var(--line)] text-[var(--ink)] text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  {copiedKey === 'baseUrl' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[var(--muted)]" />}
                  <span>Copiar URL Base: <code className="font-mono">{baseUrl}</code></span>
                </button>
              </div>
            </div>

            {/* Testador Interativo de Endpoints */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[var(--primary)]" />
                  <span>Testador de Requisições da API em Tempo Real</span>
                </div>
                <span className="text-[10px] font-bold text-[var(--muted)]">
                  Executa chamadas diretas ao backend local
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <select
                  value={selectedEndpointTest}
                  onChange={(e) => setSelectedEndpointTest(e.target.value)}
                  className="flex-1 bg-[var(--paper)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                >
                  <option value="/api/dimensio/overview">GET /api/dimensio/overview (Resumo Geral Operacional)</option>
                  <option value={`/api/presence?date=${selectedDate}&format=json`}>GET /api/presence (Lista de Presença do Dia)</option>
                  <option value="/api/collaborators">GET /api/collaborators (Todos os Colaboradores)</option>
                  <option value="/api/tasks">GET /api/tasks (Postos de Trabalho & Alocações)</option>
                  <option value={`/api/breaks?date=${selectedDate}`}>GET /api/breaks (Escala de Intervalos)</option>
                  <option value="/api/routines">GET /api/routines (Rotinas e Google Tasks)</option>
                  <option value="/api/metrics">GET /api/metrics (Métricas & Extensão)</option>
                  <option value="/api/support/requests">GET /api/support/requests (Chamados de Suporte)</option>
                  <option value="/api/health">GET /api/health (Health Check & Uptime)</option>
                </select>

                <button
                  type="button"
                  onClick={handleExecuteLiveEndpointTest}
                  disabled={isTestingEndpoint}
                  className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTestingEndpoint ? 'animate-spin' : ''}`} />
                  <span>{isTestingEndpoint ? 'Executando...' : 'Executar Teste'}</span>
                </button>
              </div>

              {endpointResult && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Status {endpointResult.status} {endpointResult.statusText}</span>
                    </span>
                    <span className="text-[var(--muted)] text-[10px]">
                      Respondido às {endpointResult.timestamp}
                    </span>
                  </div>
                  <pre className="bg-[#1e1e2e] text-[#cdd6f4] p-3.5 rounded-xl font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed">
                    {JSON.stringify(endpointResult.data || endpointResult.error, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Tabela de Endpoints da API */}
            <div className="space-y-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
                Catálogo de Endpoints REST Disponíveis
              </h4>

              <div className="border border-[var(--line)] rounded-xl overflow-hidden divide-y divide-[var(--line)]">
                {apiEndpoints.map((ep, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[var(--paper)] hover:bg-[var(--bg)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[10.5px] font-black shrink-0 ${
                          ep.method === 'GET'
                            ? 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border border-blue-300 dark:border-blue-800'
                            : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono font-bold text-[var(--ink)] truncate">
                          {ep.path}
                        </div>
                        <div className="text-[11px] text-[var(--muted)]">
                          {ep.desc}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <span className="text-[9.5px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)]">
                        {ep.category}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(`${baseUrl}${ep.path}`, `ep_${idx}`)}
                        className="p-1.5 text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--paper)] rounded-lg transition-colors cursor-pointer"
                        title="Copiar URL completa"
                      >
                        {copiedKey === `ep_${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: EXTRAÇÃO & INSERÇÃO DE PRESENÇA */}
      {activeSubTab === 'presence_extract_insert' && (
        <div className="space-y-4">
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-bold">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--ink)]">
                    Extração & Inserção Direta de Presença
                  </h3>
                  <p className="text-[11px] text-[var(--muted)]">
                    Exporte relatórios de presença em tempo real ou importe registros externos colando dados.
                  </p>
                </div>
              </div>
            </div>

            {/* Seção 1: Extrair Presença */}
            <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-2">
                <Download className="w-4 h-4 text-[var(--primary)]" />
                <span>1. Extrair e Consultar Lista de Presença</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-1">
                    Data da Presença
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl px-3 py-1.5 font-bold text-[var(--ink)] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-1">
                    Formato
                  </label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFormat('json')}
                      className={`flex-1 py-1.5 rounded-lg font-black text-xs border ${
                        format === 'json'
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)]'
                      }`}
                    >
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormat('csv')}
                      className={`flex-1 py-1.5 rounded-lg font-black text-xs border ${
                        format === 'csv'
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                          : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)]'
                      }`}
                    >
                      CSV
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-1">
                    Filtrar Turno
                  </label>
                  <select
                    value={shiftFilter}
                    onChange={(e) => setShiftFilter(e.target.value)}
                    className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl px-3 py-1.5 font-bold text-[var(--ink)] text-xs"
                  >
                    <option value="ALL">Todos os Turnos</option>
                    {(state.shifts || ['T1', 'T2', 'T3', 'T4', 'T5']).map((s) => (
                      <option key={s} value={s}>
                        Turno {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[var(--muted)] mb-1">
                    Filtrar Turma (Escala)
                  </label>
                  <select
                    value={scaleFilter}
                    onChange={(e) => setScaleFilter(e.target.value)}
                    className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl px-3 py-1.5 font-bold text-[var(--ink)] text-xs"
                  >
                    <option value="ALL">Todas as Turmas</option>
                    <option value="A">Turma A</option>
                    <option value="B">Turma B</option>
                    <option value="C">Turma C</option>
                    <option value="D">Turma D</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[var(--line)] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[10px] font-black uppercase text-[var(--muted)]">
                    Endpoint REST Direto (GET)
                  </label>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(apiUrlGet, 'apiGet')}
                    className="text-[11px] font-extrabold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'apiGet' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>Copiar URL da API</span>
                  </button>
                </div>
                <div className="flex items-center gap-2 bg-[var(--paper)] border border-[var(--line)] rounded-xl p-2 font-mono text-[11px] text-[var(--ink)] overflow-x-auto">
                  <span className="text-emerald-600 font-bold">GET</span>
                  <span className="truncate flex-1">{apiUrlGet}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => exportPresenceList('json', selectedDate)}
                    className="px-3.5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Baixar JSON Completo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportPresenceList('csv', selectedDate)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Baixar CSV (Excel)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const curlCmd = `curl -X GET "${apiUrlGet}" -H "Accept: application/json"`;
                      copyToClipboard(curlCmd, 'curlGet');
                    }}
                    className="px-3.5 py-2 bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--line)] text-[var(--ink)] rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Terminal className="w-4 h-4 text-[var(--primary)]" />
                    <span>Copiar Comando cURL</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Seção 2: Inserir / Importar Lista */}
            <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-600" />
                  <span>2. Inserir ou Importar Presença em Lote (Colar Dados)</span>
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleApplyExampleCsv}
                    className="text-[11px] font-extrabold text-[var(--primary)] hover:underline cursor-pointer"
                  >
                    Exemplo CSV
                  </button>
                  <span className="text-[var(--line)]">•</span>
                  <button
                    type="button"
                    onClick={handleApplyExampleJson}
                    className="text-[11px] font-extrabold text-[var(--primary)] hover:underline cursor-pointer"
                  >
                    Exemplo JSON
                  </button>
                  {inputText && (
                    <>
                      <span className="text-[var(--line)]">•</span>
                      <button
                        type="button"
                        onClick={() => setInputText('')}
                        className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        Limpar
                      </button>
                    </>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-[var(--muted)]">
                Cole dados de presença gerados por sistemas externos (CSV, ponto-e-vírgula ou JSON). O Dimensio realiza o match automático por <strong>Login/LDAP</strong>, <strong>Matrícula</strong> ou <strong>Nome</strong>.
              </p>

              <textarea
                rows={5}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Nome; Status; Login; Matricula; Motivo\nAna Paula Silva; presente; ana.silva; 10450;\nBruno Costa; atraso; bruno.costa; 10451; Trânsito\nCarlos Rocha; folga; carlos.rocha; 10452;\n\nOu cole um JSON Array [...]`}
                className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3 font-mono text-[11px] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
              />

              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[var(--line)]">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-xs text-[var(--ink)]">
                    Registros Identificados:{' '}
                    <span className={parsedPreview.length > 0 ? 'text-emerald-600' : 'text-[var(--muted)]'}>
                      {parsedPreview.length}
                    </span>
                  </span>
                  {parsedPreview.length > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 rounded-full text-[10px] font-black border border-emerald-300 dark:border-emerald-800">
                      Pronto para importar
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={isImporting || parsedPreview.length === 0}
                  className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white rounded-xl font-black text-xs flex items-center gap-2 cursor-pointer shadow-md transition-all"
                >
                  {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Importar e Aplicar no Dimensio ({parsedPreview.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: DOCUMENTAÇÃO & EXEMPLOS DE CÓDIGO */}
      {activeSubTab === 'code_docs' && (
        <div className="space-y-4">
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--ink)]">
                    Documentação & Exemplos Prontos
                  </h3>
                  <p className="text-[11px] text-[var(--muted)]">
                    Exemplos em cURL, JavaScript, Python e Google Apps Script prontos para copiar e rodar.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTestPresenceApi}
                disabled={apiTestStatus?.loading}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              >
                {apiTestStatus?.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>Testar Chamada de API</span>
              </button>
            </div>

            {apiTestStatus && (
              <div
                className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
                  apiTestStatus.success
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-100 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}
              >
                {apiTestStatus.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                <span>{apiTestStatus.msg}</span>
              </div>
            )}

            {/* Code Language Pills */}
            <div className="flex items-center gap-1.5 border-b border-[var(--line)] pb-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setCodeTab('curl')}
                className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                  codeTab === 'curl' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                cURL (Shell)
              </button>
              <button
                type="button"
                onClick={() => setCodeTab('js')}
                className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                  codeTab === 'js' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                JavaScript / Node.js
              </button>
              <button
                type="button"
                onClick={() => setCodeTab('python')}
                className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                  codeTab === 'python' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                Python (requests)
              </button>
              <button
                type="button"
                onClick={() => setCodeTab('appsscript')}
                className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                  codeTab === 'appsscript' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                Google Apps Script
              </button>
              <button
                type="button"
                onClick={() => setCodeTab('webhook')}
                className={`px-3 py-1 rounded-lg font-bold text-xs cursor-pointer ${
                  codeTab === 'webhook' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                Webhook Ponto Externo
              </button>
            </div>

            {/* Snippet Viewer */}
            <div className="relative">
              <pre className="bg-[#1e1e2e] text-[#cdd6f4] p-4 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed max-h-80">
                {codeTab === 'curl' &&
`# 1. Obter visão geral operacional
curl -X GET "${apiUrlDimensioOverview}" \\
  -H "Accept: application/json"

# 2. Consultar lista de presença do dia
curl -X GET "${apiUrlGet}" \\
  -H "Accept: application/json"

# 3. Inserir/Atualizar presenças em lote
curl -X POST "${apiUrlPost}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "date": "${selectedDate}",
    "records": [
      { "name": "Carlos Oliveira", "login": "carlos.oliveira", "status": "presente" },
      { "name": "Mariana Santos", "login": "mariana.santos", "status": "atraso", "reason": "Trânsito" },
      { "name": "Lucas Ferreira", "login": "lucas.ferreira", "status": "atestado", "reason": "Consulta médica" }
    ]
  }'`}

                {codeTab === 'js' &&
`// Exemplo em Node.js / Frontend JavaScript
async function syncPresenceWithDimensio() {
  const payload = {
    date: "${selectedDate}",
    records: [
      { login: "carlos.oliveira", status: "presente" },
      { login: "mariana.santos", status: "atraso", reason: "Transporte" }
    ]
  };

  const response = await fetch("${apiUrlPost}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log("Resultado:", data);
}`}

                {codeTab === 'python' &&
`# Exemplo em Python (requests)
import requests

url = "${apiUrlPost}"
payload = {
    "date": "${selectedDate}",
    "records": [
        {"login": "carlos.oliveira", "status": "presente"},
        {"login": "mariana.santos", "status": "atraso", "reason": "Trânsito"},
        {"login": "beatriz.lima", "status": "folga"}
    ]
}

response = requests.post(url, json=payload)
print(response.json())`}

                {codeTab === 'appsscript' &&
`// Exemplo no Google Apps Script (Executando a partir da Planilha)
function exportPresenceToDimensio() {
  var url = "${apiUrlPost}";
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Presenca");
  var data = sheet.getDataRange().getValues();
  
  var records = [];
  for (var i = 1; i < data.length; i++) {
    records.push({
      name: data[i][0],
      status: data[i][1] || "presente",
      login: data[i][2] || ""
    });
  }

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      date: "${selectedDate}",
      records: records
    })
  };

  var response = UrlFetchApp.fetch(url, options);
  Logger.log(response.getContentText());
}`}

                {codeTab === 'webhook' &&
`// Endpoint do Webhook de Ponto Eletrônico:
// POST ${apiUrlWebhook}

// Payload aceito para integração com relógios de ponto (Tangerino, Senior, PontoTel, Ahgora):
{
  "matricula": "10492",
  "nome": "Carlos Oliveira",
  "tipo": "in", // "in", "delay", "absent", "folga"
  "data": "${selectedDate}",
  "motivo": "Batida de ponto via catraca/relógio",
  "app_name": "RelogioPonto_Portaria"
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: HISTÓRICO DE LOGS & WEBHOOKS */}
      {activeSubTab === 'sync_events' && (
        <div className="space-y-4">
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[var(--ink)]">
                    Histórico de Sincronizações da API & Webhooks
                  </h3>
                  <p className="text-[11px] text-[var(--muted)]">
                    Registro das últimas requisições e eventos recebidos pela API de presença e webhooks externos.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadEvents}
                disabled={isLoadingEvents}
                className="px-3 py-1.5 bg-[var(--bg)] hover:bg-[var(--line)] border border-[var(--line)] text-[var(--ink)] text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEvents ? 'animate-spin' : ''}`} />
                <span>Atualizar Logs</span>
              </button>
            </div>

            {isLoadingEvents ? (
              <div className="py-8 text-center text-xs font-bold text-[var(--muted)] flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-[var(--primary)]" />
                <span>Carregando histórico de eventos...</span>
              </div>
            ) : events.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--muted)] bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                Nenhum evento de sincronização registrado ainda nesta sessão.
              </div>
            ) : (
              <div className="border border-[var(--line)] rounded-xl overflow-hidden divide-y divide-[var(--line)] max-h-96 overflow-y-auto">
                {events.map((ev) => (
                  <div key={ev.id} className="p-3 bg-[var(--paper)] hover:bg-[var(--bg)] transition-colors flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                          ev.type === 'webhook'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}
                      >
                        {ev.type === 'webhook' ? <Globe className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-extrabold text-[var(--ink)] flex items-center gap-2 truncate">
                          <span>{ev.details || `${ev.count} registros sincronizados`}</span>
                          <span className="text-[10px] px-1.5 py-0.2 bg-[var(--bg)] border border-[var(--line)] rounded text-[var(--muted)] font-mono">
                            {ev.source}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--muted)]">
                          {new Date(ev.timestamp).toLocaleString('pt-BR')} • {ev.count} registro(s)
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
                      Sucesso
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
