import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatDateBR, getTodayISO } from '../utils/helpers';
import {
  X,
  Download,
  Upload,
  Link as LinkIcon,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Code2,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Zap,
  Globe,
  Database,
  ArrowRight,
  Sparkles,
  Users,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { PresenceSyncEvent, PresenceSyncRecord } from '../types';

interface PresenceApiModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'extract' | 'insert' | 'docs' | 'events';
}

export const PresenceApiModal: React.FC<PresenceApiModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'extract',
}) => {
  const {
    state,
    exportPresenceList,
    importExternalPresenceList,
    syncPresenceToApi,
    fetchPresenceEvents,
    showNotice,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'extract' | 'insert' | 'docs' | 'events'>(initialTab);
  const [selectedDate, setSelectedDate] = useState<string>(state.selectedDate || getTodayISO());
  const [format, setFormat] = useState<'json' | 'csv'>('json');
  const [shiftFilter, setShiftFilter] = useState<string>('ALL');
  const [scaleFilter, setScaleFilter] = useState<string>('ALL');

  // Insert state
  const [inputText, setInputText] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [parsedPreview, setParsedPreview] = useState<PresenceSyncRecord[]>([]);

  // Docs state
  const [codeTab, setCodeTab] = useState<'curl' | 'js' | 'python' | 'appsscript'>('curl');
  const [apiTestStatus, setApiTestStatus] = useState<{ loading: boolean; success?: boolean; msg?: string } | null>(null);

  // Events state
  const [events, setEvents] = useState<PresenceSyncEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(false);

  // Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSelectedDate(state.selectedDate || getTodayISO());
      // Sync local state with API server on open
      syncPresenceToApi();
      loadEvents();
    }
  }, [isOpen, initialTab, state.selectedDate]);

  useEffect(() => {
    // Parse input text preview on change
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

  const loadEvents = async () => {
    setIsLoadingEvents(true);
    try {
      const list = await fetchPresenceEvents();
      setEvents(list);
    } catch {
      // error handled
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

  const handleTestApi = async () => {
    setApiTestStatus({ loading: true });
    try {
      const res = await fetch(`/api/presence?date=${selectedDate}&format=json`);
      if (res.ok) {
        const json = await res.json();
        setApiTestStatus({
          loading: false,
          success: true,
          msg: `API online e respondendo! Total de ${json.total || 0} registros retornados.`,
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

  if (!isOpen) return null;

  const baseUrl = window.location.origin;
  const apiUrlGet = `${baseUrl}/api/presence?date=${selectedDate}${shiftFilter !== 'ALL' ? `&shift=${shiftFilter}` : ''}${scaleFilter !== 'ALL' ? `&scale=${scaleFilter}` : ''}&format=${format}`;
  const apiUrlPost = `${baseUrl}/api/presence`;
  const apiUrlWebhook = `${baseUrl}/api/presence/webhook`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in duration-200">
      <div className="bg-[var(--paper)] border-2 border-[var(--line)] rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--line)] bg-[var(--bg)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center border border-[var(--primary-border)]">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
                <span>API & Integração de Presença</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  REST & Webhook
                </span>
              </h3>
              <p className="text-[11px] text-[var(--muted)] font-medium">
                Conecte o Dimensio a outros sistemas, Apps Script ou aplicativos externos de ponto e presença
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)] rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 py-2.5 border-b border-[var(--line)] bg-[var(--paper)] overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveTab('extract')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer border ${
              activeTab === 'extract'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--primary-border)]'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Extrair Presença (Exportar)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('insert')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer border ${
              activeTab === 'insert'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--primary-border)]'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Inserir Lista Conectada</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('docs')}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer border ${
              activeTab === 'docs'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--primary-border)]'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Documentação da API & Exemplos</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('events');
              loadEvents();
            }}
            className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer border ${
              activeTab === 'events'
                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-xs'
                : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--primary-border)]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Histórico de Sincronizações</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* TAB 1: EXTRAIR PRESENÇA */}
          {activeTab === 'extract' && (
            <div className="space-y-4">
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-2">
                  <Download className="w-4 h-4 text-[var(--primary)]" />
                  <span>Opções de Extração e Consulta</span>
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
                      className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl px-3 py-1.5 font-bold text-[var(--ink)]"
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
                      className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl px-3 py-1.5 font-bold text-[var(--ink)]"
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
                      className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl px-3 py-1.5 font-bold text-[var(--ink)]"
                    >
                      <option value="ALL">Todas as Turmas</option>
                      {(state.scaleGroups || []).map((g) => (
                        <option key={g} value={g}>
                          Turma {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* API URL and Action Buttons */}
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
                      {copiedKey === 'apiGet' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
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

              {/* Live Preview List */}
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--line)] bg-[var(--paper)]">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[var(--primary)]" />
                    <span className="font-black text-xs text-[var(--ink)]">
                      Visualização da Lista de Presença ({state.collaborators.length} colaboradores)
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--muted)]">
                    Data: {formatDateBR(selectedDate)}
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto divide-y divide-[var(--line)]">
                  {state.collaborators.slice(0, 10).map((c) => {
                    const dayAtt = state.attendance[selectedDate]?.[c.id];
                    const isPresent = dayAtt === true || dayAtt === undefined;
                    return (
                      <div key={c.id} className="flex items-center justify-between px-4 py-2 hover:bg-[var(--paper)]">
                        <div className="min-w-0">
                          <div className="font-extrabold text-xs text-[var(--ink)] truncate">{c.name}</div>
                          <div className="text-[10px] font-semibold text-[var(--muted)]">
                            {c.login || 'Sem LDAP'} • {c.shift || 'Geral'} • Turma {c.scale || '—'}
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isPresent
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {isPresent ? 'Presente' : 'Ausente/Folga'}
                        </span>
                      </div>
                    );
                  })}
                  {state.collaborators.length > 10 && (
                    <div className="px-4 py-2 text-center text-[10px] font-bold text-[var(--muted)] bg-[var(--paper)]">
                      + {state.collaborators.length - 10} outros colaboradores incluídos na extração completa.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INSERIR LISTA CONECTADA */}
          {activeTab === 'insert' && (
            <div className="space-y-4">
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[var(--primary)]" />
                    <span>Colar Lista de Presença Conectada</span>
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
                  Cole os dados gerados pelo seu outro app de presença (em formato texto delimitado por vírgula/ponto-e-vírgula ou JSON). O Dimensio fará o match automático por <strong>Login/LDAP</strong>, <strong>Matrícula</strong> ou <strong>Nome</strong>.
                </p>

                <textarea
                  rows={5}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Exemplo CSV:\nNome; Status; Login; Matricula; Motivo\nAna Paula Silva; presente; ana.silva; 10450;\nBruno Costa; atraso; bruno.costa; 10451; Trânsito\nCarlos Rocha; folga; carlos.rocha; 10452;\n\nOu cole um JSON Array [...]`}
                  className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3 font-mono text-[11px] text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                />

                {/* Parsed Preview Counter */}
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
                    <span>Importar e Sincronizar ({parsedPreview.length})</span>
                  </button>
                </div>
              </div>

              {/* Webhook Endpoint Info */}
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-600" />
                    <span>Webhook de Sincronização em Tempo Real</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(apiUrlWebhook, 'apiWebhook')}
                    className="text-[11px] font-extrabold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'apiWebhook' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>Copiar Webhook URL</span>
                  </button>
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  Configure o seu outro app para enviar requisições <code>POST</code> automáticas sempre que alguém marcar presença:
                </p>
                <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-2.5 font-mono text-[11px] text-[var(--ink)]">
                  <span className="text-purple-600 font-bold">POST</span> {apiUrlWebhook}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DOCUMENTAÇÃO & EXEMPLOS */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-[var(--primary)]" />
                    <span>Exemplos de Código Prontos para Conectar</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleTestApi}
                    disabled={apiTestStatus?.loading}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
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

                {/* Code Tabs */}
                <div className="flex items-center gap-1 border-b border-[var(--line)] pb-2">
                  <button
                    type="button"
                    onClick={() => setCodeTab('curl')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs ${
                      codeTab === 'curl' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    cURL
                  </button>
                  <button
                    type="button"
                    onClick={() => setCodeTab('js')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs ${
                      codeTab === 'js' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    JavaScript / Node.js
                  </button>
                  <button
                    type="button"
                    onClick={() => setCodeTab('python')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs ${
                      codeTab === 'python' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Python
                  </button>
                  <button
                    type="button"
                    onClick={() => setCodeTab('appsscript')}
                    className={`px-3 py-1 rounded-lg font-bold text-xs ${
                      codeTab === 'appsscript' ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Google Apps Script
                  </button>
                </div>

                {/* Code Snippet Box */}
                <div className="relative">
                  <pre className="bg-[#1e1e2e] text-[#cdd6f4] p-4 rounded-xl font-mono text-[11px] overflow-x-auto leading-relaxed max-h-72">
                    {codeTab === 'curl' &&
`# 1. Obter lista de presença de hoje
curl -X GET "${apiUrlGet}" \\
  -H "Accept: application/json"

# 2. Inserir/Atualizar presença de colaboradores
curl -X POST "${apiUrlPost}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "date": "${selectedDate}",
    "records": [
      { "login": "carlos.oliveira", "status": "presente" },
      { "login": "mariana.santos", "status": "atraso", "reason": "Trânsito" },
      { "login": "beatriz.lima", "status": "folga" }
    ]
  }'`}

                    {codeTab === 'js' &&
`// Exemplo de integração em JavaScript / TypeScript (Frontend ou Node.js)
async function syncPresenceWithDimensio() {
  const payload = {
    date: "${selectedDate}",
    records: [
      { login: "carlos.oliveira", status: "presente" },
      { login: "mariana.santos", status: "atraso", reason: "Consulta" }
    ]
  };

  const response = await fetch("${apiUrlPost}", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log("Presença sincronizada:", data);
}`}

                    {codeTab === 'python' &&
`import requests

# Sincronizar presença a partir de script Python
url = "${apiUrlPost}"
payload = {
    "date": "${selectedDate}",
    "records": [
        {"name": "Carlos Oliveira", "status": "presente"},
        {"name": "Mariana Santos", "status": "atraso", "reason": "Atraso 20m"}
    ]
}

response = requests.post(url, json=payload)
print("Status:", response.status_code)
print("Resposta:", response.json())`}

                    {codeTab === 'appsscript' &&
`// Código para colar no Editor de Apps Script da sua Planilha de Presença
function enviarPresencaParaDimensio() {
  var url = "${apiUrlPost}";
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  
  var records = [];
  for (var i = 1; i < rows.length; i++) {
    var nome = rows[i][0];
    var status = rows[i][1];
    var login = rows[i][2];
    if (nome) {
      records.push({ name: nome, status: status || 'presente', login: login });
    }
  }

  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ date: "${selectedDate}", records: records })
  };

  var res = UrlFetchApp.fetch(url, options);
  Logger.log(res.getContentText());
}`}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      let code = '';
                      if (codeTab === 'curl') code = `curl -X GET "${apiUrlGet}"`;
                      if (codeTab === 'js') code = `fetch("${apiUrlPost}", { method: "POST" })`;
                      if (codeTab === 'python') code = `requests.post("${apiUrlPost}", json={})`;
                      if (codeTab === 'appsscript') code = `UrlFetchApp.fetch("${apiUrlPost}", options)`;
                      copyToClipboard(code, 'docCode');
                    }}
                    className="absolute top-3 right-3 px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copiar</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EVENTOS / HISTÓRICO */}
          {activeTab === 'events' && (
            <div className="space-y-4">
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--line)] bg-[var(--paper)]">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--primary)]" />
                    <span className="font-black text-xs text-[var(--ink)]">
                      Registro de Eventos de Sincronização da API ({events.length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={loadEvents}
                    disabled={isLoadingEvents}
                    className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] rounded-lg transition-colors cursor-pointer"
                    title="Atualizar eventos"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingEvents ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {events.length === 0 ? (
                  <div className="p-6 text-center text-[var(--muted)] font-medium space-y-1">
                    <p className="font-extrabold text-xs">Nenhum evento registrado ainda.</p>
                    <p className="text-[11px]">
                      Quando o outro aplicativo enviar uma chamada REST ou você importar uma lista, o log aparecerá aqui em tempo real.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--line)] max-h-72 overflow-y-auto">
                    {events.map((evt) => (
                      <div key={evt.id} className="p-3 hover:bg-[var(--paper)] flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[var(--primary-soft)] text-[var(--primary)]">
                              {evt.source || 'API'}
                            </span>
                            <span className="font-extrabold text-xs text-[var(--ink)]">
                              {evt.count} registro(s) sincronizado(s)
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--muted)]">
                            {evt.details || `${evt.records?.length || 0} colaboradores atualizados`}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-[var(--muted)] shrink-0">
                          {new Date(evt.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--line)] bg-[var(--bg)]">
          <div className="flex items-center gap-2 text-[11px] font-bold text-[var(--muted)]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Dimensio Open API v1.0 • Seguro e em tempo real</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--line)] text-[var(--ink)] rounded-xl font-extrabold text-xs cursor-pointer transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
