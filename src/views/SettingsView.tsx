import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { RoleAccessLevel } from '../types';
import { encodeConnectionParams } from '../utils/urlConnection';
import { ConfirmModal } from '../components/ConfirmModal';
import { AppsScriptModal } from '../components/AppsScriptModal';
import { ConfirmImportBackupModal } from '../components/ConfirmImportBackupModal';
import { IntegrationsSettingsPanel } from '../components/IntegrationsSettingsPanel';
import { ExtensionSettingsPanel } from '../components/ExtensionSettingsPanel';
import { SectorsSettingsPanel } from '../components/SectorsSettingsPanel';
import { PageHeader, Button } from '../components/ui';
import {
  Palette,
  Building2,
  Download,
  Upload,
  Trash2,
  Check,
  ShieldAlert,
  Database,
  FileSpreadsheet,
  Link as LinkIcon,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  History,
  Pencil,
  Plus,
  Clock,
  Briefcase,
  Layers,
  Award,
  Users,
  Presentation,
  UserCheck,
  Radio,
  Box,
  Info,
  EyeOff,
  SlidersHorizontal,
  Code2,
  Activity,
  Copy,
  Share2,
  Zap,
  Puzzle,
  Smartphone,
  Wifi,
  WifiOff,
  HardDriveDownload,
  CloudOff,
  Cloud,
  ListTodo,
  CloudDownload,
  MessageSquareText,
  Search,
  Keyboard,
  ListOrdered,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Shuffle,
  Calendar,
  Send,
  FileText,
  Home,
  Settings,
  HelpCircle,
  Headphones,
  BellRing,
  Volume2,
  Vibrate,
  X,
  Lock,
  Key,
  KeyRound,
  Shield,
  LayoutGrid,
} from 'lucide-react';
import { ThemeOption, AppState, SupportTypeField, ActionLinkVar } from '../types';
import { DEFAULT_SUPPORT_TYPES } from '../utils/initialData';
import { APP_VERSION, BUILD_TS as APP_BUILD_DATE, GIT_COMMIT, GIT_BRANCH, HAS_GIT, FULL_VERSION, APPS_SCRIPT_VERSION } from '../version';
import {
  ACTION_LINK_SOURCES,
  slugifyActionLinkKey,
  extractActionLinkTokens,
} from '../utils/supportActionLink';
import { formatSupportFieldValue } from '../utils/fieldFormat';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const SupportTypeFieldsEditor: React.FC<{
  fields: SupportTypeField[];
  onChange: (fields: SupportTypeField[]) => void;
}> = ({ fields, onChange }) => {
  const updateField = (idx: number, patch: Partial<SupportTypeField>) => {
    onChange(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  };
  const addField = () => {
    onChange([
      ...fields,
      {
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        label: '',
        required: false,
        uppercase: false,
      },
    ]);
  };
  const removeField = (idx: number) => onChange(fields.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--ink)]">
          Campos personalizados do chamado
        </span>
        <button
          type="button"
          onClick={addField}
          className="px-2 py-1 bg-violet-600/10 hover:bg-violet-600/20 text-violet-700 dark:text-violet-300 text-[10px] font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Plus className="w-3 h-3" />
          Adicionar campo
        </button>
      </div>
      <p className="text-[10px] text-[var(--muted)]">
        Ex.: "Código da Impressora", "Código do Produto". Cada campo vira um texto separado no formulário de suporte.
      </p>
      {fields.length === 0 && (
        <p className="text-[10px] text-[var(--muted)] italic bg-[var(--bg)] border border-[var(--line)] p-2 rounded-lg">
          Nenhum campo personalizado. O chamado usará o campo de texto simples padrão.
        </p>
      )}
      <div className="space-y-1.5">
        {fields.map((f, idx) => (
          <div key={f.id} className="bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={f.label}
                onChange={(e) => updateField(idx, { label: e.target.value })}
                placeholder="Rótulo do campo (ex.: Código da Impressora)"
                className="flex-1 min-w-0 px-2 py-1 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[var(--ink)] font-bold focus:outline-none focus:border-violet-500"
              />
              <button
                type="button"
                onClick={() => removeField(idx)}
                className="p-1.5 text-[var(--muted)] hover:text-rose-600 hover:bg-[var(--paper)] rounded-lg transition-colors cursor-pointer"
                title="Remover campo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={f.uppercase === true}
                  onChange={(e) => updateField(idx, { uppercase: e.target.checked })}
                  className="w-3 h-3 accent-violet-600 rounded"
                />
                Caixa alta
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={f.required === true}
                  onChange={(e) => updateField(idx, { required: e.target.checked })}
                  className="w-3 h-3 accent-violet-600 rounded"
                />
                Obrigatório
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)]">
                <span>Máx.</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={f.maxLength ?? ''}
                  onChange={(e) =>
                    updateField(idx, { maxLength: e.target.value ? Number(e.target.value) : undefined })
                  }
                  placeholder="caracteres"
                  className="w-20 px-2 py-0.5 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-md text-[var(--ink)] font-bold focus:outline-none focus:border-violet-500"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-[var(--muted)]">
                <span>Variável no link:</span>
                <input
                  type="text"
                  value={f.key ?? ''}
                  onChange={(e) => updateField(idx, { key: e.target.value })}
                  placeholder="ex: codigo_impressora"
                  className="w-40 px-2 py-0.5 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-md text-[var(--ink)] font-mono font-bold focus:outline-none focus:border-violet-500"
                />
              </label>
            </div>
            {/* Formatação automática */}
            <div className="rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 p-2 space-y-1.5">
              <div className="text-[9.5px] font-extrabold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                Formatação automática (opcional)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                <label className="sm:col-span-1 block text-[9px] font-bold text-[var(--muted)]">
                  Exemplo do formato final
                  <input
                    type="text"
                    value={f.format?.example ?? ''}
                    onChange={(e) =>
                      updateField(idx, { format: { ...(f.format || {}), example: e.target.value } })
                    }
                    placeholder="ex: PS-1-104-136-02-01"
                    className="w-full mt-0.5 px-2 py-1 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-md text-[var(--ink)] font-mono font-bold focus:outline-none focus:border-violet-500"
                  />
                </label>
                <label className="block text-[9px] font-bold text-[var(--muted)]">
                  Separadores de entrada
                  <input
                    type="text"
                    value={f.format?.inputSeparators ?? ''}
                    onChange={(e) =>
                      updateField(idx, { format: { ...(f.format || {}), inputSeparators: e.target.value } })
                    }
                    placeholder="ex:  . /  (vazio = auto)"
                    className="w-full mt-0.5 px-2 py-1 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-md text-[var(--ink)] font-mono font-bold focus:outline-none focus:border-violet-500"
                  />
                </label>
                <label className="block text-[9px] font-bold text-[var(--muted)]">
                  Separador de saída
                  <input
                    type="text"
                    value={f.format?.outputSeparator ?? ''}
                    onChange={(e) =>
                      updateField(idx, { format: { ...(f.format || {}), outputSeparator: e.target.value } })
                    }
                    placeholder="ex: -  (vazio = do exemplo)"
                    className="w-full mt-0.5 px-2 py-1 text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-md text-[var(--ink)] font-mono font-bold focus:outline-none focus:border-violet-500"
                  />
                </label>
              </div>
              <p className="text-[9px] text-[var(--muted)]">
                Ex.: digitado <span className="font-mono font-bold">ps 1 104 136 2 1</span> vira{' '}
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {formatSupportFieldValue('ps 1 104 136 2 1', { ...f, uppercase: f.uppercase === true })}
                </span>
                {' '}ao enviar o pedido. Espaços, hífens, pontos, barras, vírgulas e sublinhados são aceitos na digitação.
              </p>
            </div>
            <p className="text-[9px] text-[var(--muted)]">
              A variável <span className="font-mono font-bold">{"{" + (f.key || f.id) + "}"}</span> poderá ser usada no
              link de ação rápida do tipo de chamado.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Editor visual do link de ação rápida: cola o link, seleciona o trecho e
// vincula o trecho a um campo/valor. As substituições ficam registradas em vars.
const SupportActionLinkEditor: React.FC<{
  value: string;
  vars: ActionLinkVar[];
  fields: SupportTypeField[];
  onValueChange: (value: string) => void;
  onVarsChange: (vars: ActionLinkVar[]) => void;
}> = ({ value, vars, fields, onValueChange, onVarsChange }) => {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const [sel, setSel] = useState<{ start: number; end: number } | null>(null);
  const [hint, setHint] = useState('');

  // Ao colar/editar o link, vincula automaticamente tokens que casam com campos ou fontes
  useEffect(() => {
    if (!value) return;
    const tokens = extractActionLinkTokens(value);
    const existing = new Set(vars.map((v) => v.token));
    const additions: ActionLinkVar[] = [];
    for (const t of tokens) {
      if (existing.has(t)) continue;
      const field = fields.find((f) => f.key === t || f.id === t);
      if (field) {
        additions.push({ token: t, source: 'field', fieldId: field.id, fieldKey: field.key, label: field.label });
        existing.add(t);
        continue;
      }
      const pre = ACTION_LINK_SOURCES.find((s) => s.value === t);
      if (pre) {
        additions.push({ token: t, source: pre.value, label: pre.label });
        existing.add(t);
      }
    }
    if (additions.length) onVarsChange([...vars, ...additions]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const bind = (source: ActionLinkVar['source'], field?: SupportTypeField) => {
    if (!sel || sel.start === sel.end) {
      setHint('Selecione um trecho do link acima e depois clique no campo/valor para substituí-lo.');
      return;
    }
    const baseToken =
      source === 'field'
        ? field?.key?.trim() || slugifyActionLinkKey(field?.label || 'campo') || field?.id || 'campo'
        : source;
    let token = baseToken;
    let n = 2;
    const taken = new Set(vars.map((v) => v.token));
    while (taken.has(token)) {
      token = `${baseToken}_${n}`;
      n++;
    }
    const label =
      source === 'field' ? field?.label : ACTION_LINK_SOURCES.find((s) => s.value === source)?.label;
    onValueChange(value.slice(0, sel.start) + `{${token}}` + value.slice(sel.end));
    onVarsChange([
      ...vars,
      { token, source, fieldId: field?.id, fieldKey: field?.key, label },
    ]);
    setSel(null);
    setHint('');
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (ta) {
        ta.focus();
        const pos = sel.start + token.length + 2;
        ta.setSelectionRange(pos, pos);
      }
    });
  };

  const unlink = (token: string) => {
    onVarsChange(vars.filter((v) => v.token !== token));
  };

  // Renderiza o link com os tokens destacados e vinculações coloridas
  const renderPreview = () => {
    const parts: React.ReactNode[] = [];
    const regex = /\{([a-zA-Z0-9_]+)\}/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = regex.exec(value)) !== null) {
      if (m.index > last) parts.push(<span key={`t${i++}`}>{value.slice(last, m.index)}</span>);
      const token = m[1];
      const v = vars.find((x) => x.token === token);
      parts.push(
        <mark
          key={`v${i++}`}
          className={`px-1 rounded font-mono font-bold text-[10px] border ${
            v
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30'
          }`}
        >
          {"{"}
          {token}
          {"}"}
          {v && (
            <span className="ml-1 not-italic font-sans font-extrabold">
              → {v.label || v.source}
            </span>
          )}
          {!v && <span className="ml-1 not-italic font-sans font-extrabold">→ sem vínculo</span>}
        </mark>
      );
      last = m.index + m[0].length;
    }
    if (last < value.length) parts.push(<span key={`t${i++}`}>{value.slice(last)}</span>);
    return parts;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <LinkIcon className="w-3.5 h-3.5 text-[var(--muted)]" />
        <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[var(--ink)]">
          Link de ação rápida (Copiar & Abrir)
        </span>
      </div>

      <textarea
        ref={taRef}
        rows={2}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onSelect={(e) => {
          const ta = e.currentTarget;
          setSel({ start: ta.selectionStart, end: ta.selectionEnd });
        }}
        placeholder="Cole aqui o link do sistema, ex: https://sistema.empresa.com/consulta?codigo=VALOR&operador=NOME"
        className="w-full px-2.5 py-1.5 text-[11px] bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--ink)] font-mono font-bold focus:outline-none focus:border-violet-500 resize-y"
      />

      <p className="text-[9.5px] text-[var(--muted)]">
        <strong>Como funciona:</strong> selecione com o mouse o trecho do link que deve ser preenchido e clique no
        campo/valor abaixo. O trecho vira uma variável colorida no link.
      </p>
      {hint && <p className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400">{hint}</p>}

      {/* Fontes de valores para vincular */}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[9px] font-bold text-[var(--muted)]">Substituir seleção por:</span>
        {fields
          .filter((f) => f.label.trim())
          .map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => bind('field', f)}
              className="px-1.5 py-0.5 rounded-md bg-violet-600/10 hover:bg-violet-600/20 text-violet-700 dark:text-violet-300 text-[9px] font-bold cursor-pointer transition-colors"
              title={`Substituir o trecho selecionado pelo campo "${f.label}"`}
            >
              {f.label}
            </button>
          ))}
        {ACTION_LINK_SOURCES.filter((s) => s.value !== 'field').map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => bind(s.value)}
            className="px-1.5 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--line)] hover:border-violet-500 text-[9px] font-mono font-bold text-[var(--ink)] cursor-pointer transition-colors"
            title={`Substituir o trecho selecionado por ${s.label}`}
          >
            {"{"}
            {s.value}
            {"}"}
          </button>
        ))}
      </div>

      {/* Prévia do link com variáveis */}
      <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2 text-[10.5px] font-mono text-[var(--ink)] break-all leading-relaxed">
        {value ? renderPreview() : <span className="text-[var(--muted)]">Sem link configurado.</span>}
      </div>

      {/* Lista de vinculações */}
      {vars.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-[9px] font-bold text-[var(--muted)]">Vínculos:</span>
          {vars.map((v) => (
            <span
              key={v.token}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[9px] font-bold text-emerald-700 dark:text-emerald-300"
            >
              <span className="font-mono">{"{"}
                {v.token}
                {"}"}</span>
              <span>→ {v.label || v.source}</span>
              <button
                type="button"
                onClick={() => unlink(v.token)}
                className="text-[var(--muted)] hover:text-rose-600 cursor-pointer"
                title="Remover vínculo"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export const SettingsView: React.FC = () => {
  const {
    state,
    setTheme,
    importFullStateWithBackup,
    resetAllData,
    showNotice,
    setOnlineSpreadsheetConfig,
    syncToOnlineSpreadsheet,
    forceRecreateCloudSpreadsheet,
    testWebhookConnection,
    exportLocalSpreadsheet,
    generateTemplateSpreadsheet,
    lastAutoBackupInfo,
    backupHistory,
    createAutoBackup,
    restoreFromAutoBackup,
    restoreBackupById,
    deleteBackupById,
    clearBackupHistory,
    exportBackupToFile,
    generateShareableConnectionLink,
    disconnectOnlineSpreadsheet,
    addCatalogItem,
    removeCatalogItem,
    editCatalogItem,
    addTeamLeader,
    removeTeamLeader,
    editTeamLeader,
    addBreakSlot,
    updateBreakSlot,
    deleteBreakSlot,
    setModuleVisibility,
    setPortalNameAbbreviation,
    setCustomShortcuts,
    setSidebarOrder,
    resetNavigationSettings,
    openSetupWizard,
    updateFeedbackConfig,
    setAbsenteeismPeriodDays,
    fetchFromOnlineSpreadsheet,
    identifiedUser,
    toggleEditorRole,
    setRolePermission,
    setRequireUserPassword,
    setUserPassword,
    updateAutoBackupSettings,
    restoreFromAuditLog,
    clearAuditLogs,
    updateHelpdeskConfig,
    updatePortalNotificationConfig,
    setIsWidgetsModalOpen,
    updateWidgetsConfig,
    sessionConfig,
    setSessionConfig,
    cloudOnline,
    logoutUser,
    loadSampleBackupData,
    downloadSampleBackupFile,
    clearSampleData,
  } = useApp();

  const checkPermissionOrAlert = (requireAdmin: boolean = false): boolean => {
    if (!identifiedUser) {
      showNotice(
        '⚠️ Acesso Negado: Identificação Necessária! Por favor, identifique-se no menu superior ou lateral com seu usuário (TL ou Administrador) para alterar as configurações do sistema.'
      );
      return false;
    }
    if (requireAdmin && !identifiedUser.isAdmin && !identifiedUser.isSuperAdmin) {
      showNotice(
        `⚠️ Acesso Restrito: O usuário "${identifiedUser.name}" não possui perfil de Administrador/Gestor para esta ação.`
      );
      return false;
    }
    if (!identifiedUser.isEditor && !identifiedUser.isAdmin && !identifiedUser.isSuperAdmin) {
      showNotice(
        `⚠️ Acesso Restrito: O cargo "${identifiedUser.role}" de ${identifiedUser.name} não possui permissão de edição/configuração no sistema.`
      );
      return false;
    }
    return true;
  };

  const [activeTab, setActiveTab] = useState<'general' | 'spreadsheet' | 'extension' | 'sectors' | 'portal_panel' | 'backups' | 'audit_logs' | 'editor_roles' | 'catalogs' | 'developer'>('spreadsheet');
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('todos');

  // Hidden developer mode (unlock by tapping the version chip 5 times)
  const [devMode, setDevMode] = useState(() => localStorage.getItem('escalapro_dev_mode') === '1');
  const [devClicks, setDevClicks] = useState(0);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [portalPresetShift, setPortalPresetShift] = useState<string>('all');
  const [employeePresetShift, setEmployeePresetShift] = useState<string>('all');
  const [portalPresetRoles, setPortalPresetRoles] = useState<string[]>([]);
  const [portalPresetCategories, setPortalPresetCategories] = useState<string[]>([]);
  const [portalPresetOnlyMine, setPortalPresetOnlyMine] = useState<boolean>(false);

  // Helpdesk & Support Type Management State in Settings
  const [newSupportTypeName, setNewSupportTypeName] = useState('');
  const [newSupportTypePriority, setNewSupportTypePriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [newSupportTypePlaceholder, setNewSupportTypePlaceholder] = useState('');
  const [newSupportTypeActionLink, setNewSupportTypeActionLink] = useState('');
  const [newSupportTypeActionLinkVars, setNewSupportTypeActionLinkVars] = useState<ActionLinkVar[]>([]);
  const [editingSupportTypeId, setEditingSupportTypeId] = useState<string | null>(null);
  const [editingSupportTypeName, setEditingSupportTypeName] = useState('');
  const [editingSupportTypePriority, setEditingSupportTypePriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [editingSupportTypeFields, setEditingSupportTypeFields] = useState<SupportTypeField[]>([]);
  const [editingSupportTypeActionLink, setEditingSupportTypeActionLink] = useState('');
  const [editingSupportTypeActionLinkVars, setEditingSupportTypeActionLinkVars] = useState<ActionLinkVar[]>([]);
  const [newSupportTypeFields, setNewSupportTypeFields] = useState<SupportTypeField[]>([]);

  const [databaseProvider, setDatabaseProvider] = useState<'sheets' | 'firestore'>(
    state.onlineSpreadsheet?.databaseProvider || 'sheets'
  );
  const [firestoreCollection, setFirestoreCollection] = useState(
    state.onlineSpreadsheet?.firestoreCollection || 'dimensio_workspaces'
  );
  const [sheetName, setSheetName] = useState(
    state.onlineSpreadsheet?.name || 'Planilha Oficial de Turnos - Logística T2'
  );
  const [sheetUrl, setSheetUrl] = useState(
    state.onlineSpreadsheet?.url ||
      'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit'
  );
  const [webhookUrl, setWebhookUrl] = useState(
    state.onlineSpreadsheet?.webhookUrl || ''
  );
  const [turnServers, setTurnServers] = useState(
    state.onlineSpreadsheet?.turnServers || ''
  );
  const [autoSync, setAutoSync] = useState(
    state.onlineSpreadsheet?.autoSyncEnabled !== false
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testDiag, setTestDiag] = useState<{ success: boolean; message: string; details?: string } | null>(null);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<
    Array<{
      id: string;
      index: number;
      type: string;
      timestamp: string;
      formattedDate: string;
      reason: string;
      collaboratorCount: number;
      teamName: string;
    }>
  >([]);
  const [cloudBackupsLoading, setCloudBackupsLoading] = useState(false);
  const [cloudBackupsError, setCloudBackupsError] = useState('');
  const [confirmCloudRestoreId, setConfirmCloudRestoreId] = useState<string | null>(null);
  const [restoringCloud, setRestoringCloud] = useState(false);
  const [pendingCloudRestorePublish, setPendingCloudRestorePublish] = useState(false);

  // Feedback form advanced config (Google Form URL hidden from regular users)
  const [feedbackFormUrl, setFeedbackFormUrl] = useState(state.feedbackConfig?.formUrl || '');
  const [feedbackEntryMessage, setFeedbackEntryMessage] = useState(state.feedbackConfig?.entryMessage || '');
  const [feedbackEntryName, setFeedbackEntryName] = useState(state.feedbackConfig?.entryName || '');
  const [feedbackEntryCategory, setFeedbackEntryCategory] = useState(state.feedbackConfig?.entryCategory || '');

  const handleSaveFeedbackConfig = () => {
    updateFeedbackConfig({
      formUrl: feedbackFormUrl.trim(),
      entryMessage: feedbackEntryMessage.trim(),
      entryName: feedbackEntryName.trim(),
      entryCategory: feedbackEntryCategory.trim(),
    });
    showNotice('Formulário de feedback configurado com sucesso!');
  };

  const handleCheckForUpdate = async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) {
        showNotice('Sem atualização em cache disponível.');
        return;
      }
      await reg.update();
      showNotice('Verificação de atualização concluída. Se houver uma nova versão, ela será aplicada ao recarregar.');
    } catch {
      showNotice('Não foi possível verificar atualizações agora.');
    }
  };

  const handleDownloadRawState = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dimensio-estado-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice('Estado bruto exportado em JSON para diagnóstico.');
  };

  const handleResetDevConfig = () => {
    updateFeedbackConfig({ formUrl: '', entryMessage: '', entryName: '', entryCategory: '' });
    setFeedbackFormUrl('');
    setFeedbackEntryMessage('');
    setFeedbackEntryName('');
    setFeedbackEntryCategory('');
    showNotice('Configurações de desenvolvedor limpas.');
  };

  const loadCloudBackups = async () => {
    const url = state.onlineSpreadsheet?.webhookUrl?.trim();
    if (!url) {
      showNotice('Conecte uma planilha com o Apps Script atualizado primeiro.');
      return;
    }
    setCloudBackupsLoading(true);
    setCloudBackupsError('');
    try {
      const res = await fetch(`${url}?mode=backups`);
      const data = await res.json();
      const ok = data && (data.ok === true || data.status === 'success');
      if (ok && Array.isArray(data.backups)) {
        setCloudBackups(
          data.backups.map((b: Record<string, unknown>) => ({
            id: String(b.id || (b.type === 'DAILY' ? 'DAILY:' : 'SYNC:') + (b.index ?? b.i)),
            index: Number(b.index ?? b.i) || 0,
            type: String(b.type || ''),
            timestamp: String(b.timestamp || ''),
            formattedDate: String(b.formattedDate || b.timestamp || ''),
            reason: String(b.reason || 'Backup automático de sincronização'),
            collaboratorCount: Number(b.collaboratorCount ?? b.collaborators) || 0,
            teamName: String(b.teamName || ''),
          }))
        );
        if (data.backups.length === 0) {
          showNotice('Nenhum backup encontrado na planilha ainda. Eles são criados automaticamente a cada sincronização.');
        }
      } else {
        setCloudBackups([]);
        setCloudBackupsError(
          data?.error ||
            'Não foi possível listar backups. Atualize o Apps Script na planilha para a versão mais recente (que mantém backups automáticos na própria planilha).'
        );
      }
    } catch {
      setCloudBackups([]);
      setCloudBackupsError('Erro de rede ao consultar os backups da planilha.');
    } finally {
      setCloudBackupsLoading(false);
    }
  };

  const handleRestoreFromCloudBackup = async () => {
    if (!confirmCloudRestoreId) return;
    const url = state.onlineSpreadsheet?.webhookUrl?.trim();
    if (!url) return;
    setRestoringCloud(true);
    try {
      const res = await fetch(`${url}?mode=backup&id=${encodeURIComponent(confirmCloudRestoreId)}`);
      const data = await res.json();
      const ok = data && (data.ok === true || data.status === 'success');
      let restoredState = data && (data.state || data.stateRaw);
      if (typeof restoredState === 'string') {
        try {
          restoredState = JSON.parse(restoredState);
        } catch {
          restoredState = null;
        }
      }
      if (ok && restoredState) {
        importFullStateWithBackup(restoredState, 'full', true);
        setPendingCloudRestorePublish(true);
        showNotice(
          'Backup restaurado no aplicativo. Publicando os dados na planilha...',
          undefined,
          undefined,
          'sync'
        );
      } else {
        showNotice(data?.error || data?.message || 'Falha ao ler o backup da planilha.');
      }
    } catch {
      showNotice('Erro de rede ao restaurar o backup da planilha.');
    } finally {
      setRestoringCloud(false);
      setConfirmCloudRestoreId(null);
    }
  };

  // After a cloud restore, publish the restored state back to the spreadsheet so
  // that fresh connections (shared links) receive the real team data.
  useEffect(() => {
    if (!pendingCloudRestorePublish) return;
    const t = setTimeout(async () => {
      setPendingCloudRestorePublish(false);
      try {
        const ok = await syncToOnlineSpreadsheet(false);
        if (ok) {
          showNotice(
            'Dados restaurados e republicados na planilha com sucesso! Quem abrir o link compartilhado agora receberá os dados reais da equipe.',
            undefined,
            undefined,
            'sync'
          );
        } else {
          showNotice(
            'Restauração local concluída, mas não foi possível republicar na planilha automaticamente. Use "Enviar para a Planilha" para publicar os dados restaurados.',
            'Enviar para a Planilha',
            () => {
              syncToOnlineSpreadsheet(false);
            },
            'sync'
          );
        }
      } catch {
        showNotice('Erro ao republicar os dados na planilha. Tente "Enviar para a Planilha" manualmente.');
      }
    }, 900);
    return () => clearTimeout(t);
  }, [pendingCloudRestorePublish, syncToOnlineSpreadsheet, showNotice]);

  // PWA install state
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };
    const onDisplayModeChange = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalone(standalone);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    window.addEventListener('appinstalled', onDisplayModeChange);
    onDisplayModeChange();
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.removeEventListener('appinstalled', onDisplayModeChange);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null);
      setIsStandalone(true);
    }
  };

  // Safe import modal state
  const [pendingImportData, setPendingImportData] = useState<Partial<AppState> | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Catalog editing state
  const [catalogTab, setCatalogTab] = useState<'roles' | 'categories' | 'skills' | 'breaks' | 'leaders'>('roles');
  const [newCatalogInput, setNewCatalogInput] = useState('');
  const [editingItem, setEditingItem] = useState<{ key: 'roles' | 'categories' | 'skills' | 'leaders'; oldVal: string; newVal: string } | null>(null);
  const [newBreakTime, setNewBreakTime] = useState('20:00');
  const [newBreakCap, setNewBreakCap] = useState<number>(10);
  const [editingBreak, setEditingBreak] = useState<{ id: string; time: string; capacity: number } | null>(null);

  const handleSaveSpreadsheetConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkPermissionOrAlert()) return;
    if (!sheetName.trim()) {
      showNotice('Informe o nome da planilha ou espaço.');
      return;
    }
    if (databaseProvider === 'sheets' && !sheetUrl.trim()) {
      showNotice('Informe o link/URL da planilha.');
      return;
    }

    setOnlineSpreadsheetConfig({
      name: sheetName.trim(),
      url: sheetUrl.trim() || 'https://console.firebase.google.com',
      databaseProvider,
      firestoreCollection: firestoreCollection.trim() || 'dimensio_workspaces',
      webhookUrl: webhookUrl.trim() || undefined,
      turnServers: turnServers.trim() || undefined,
      autoSyncEnabled: autoSync,
      lastSyncedAt: state.onlineSpreadsheet?.lastSyncedAt || '',
      syncCount: state.onlineSpreadsheet?.syncCount || 0,
    }, true);
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    await syncToOnlineSpreadsheet();
    setTimeout(() => setIsSyncing(false), 600);
  };

  const handleForceRecreate = async () => {
    if (!webhookUrl.trim()) return;
    setIsSyncing(true);
    try {
      await forceRecreateCloudSpreadsheet(webhookUrl, sheetUrl, sheetName);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopyShareConnectionLink = () => {
    const link = generateShareableConnectionLink();
    if (!state.onlineSpreadsheet?.url) {
      showNotice(
        'Ainda não há planilha online configurada. Primeiro conecte uma planilha compartilhada (Configurações > Conectar Planilha Online) e depois gere o link.'
      );
      return;
    }
    navigator.clipboard.writeText(link);
    setCopiedShareLink(true);
    showNotice('Link direto de conexão em nuvem copiado com sucesso! Compartilhe com os colegas de turno.');
    setTimeout(() => setCopiedShareLink(false), 2500);
  };

  const themeOptions: Array<{
    id: ThemeOption;
    name: string;
    category: string;
    colorBg: string;
    colorAccent: string;
  }> = [
    { id: 'dimensio', name: 'Índigo & Violeta', category: 'Padrão', colorBg: '#f5f6fb', colorAccent: '#4f46e5' },
    { id: 'aurora', name: 'Verde Aurora', category: 'Refrescante', colorBg: '#f0fbf7', colorAccent: '#0d9488' },
    { id: 'ocean', name: 'Azul Oceano', category: 'Claro', colorBg: '#f2f7fd', colorAccent: '#2563eb' },
    { id: 'sunset', name: 'Pôr do Sol', category: 'Caloroso', colorBg: '#fffaf5', colorAccent: '#ea580c' },
    { id: 'crimson', name: 'Crimson Moderno', category: 'Ousado', colorBg: '#fdf2f4', colorAccent: '#be123c' },
    { id: 'midnight', name: 'Meia-Noite', category: 'Modo Escuro', colorBg: '#0b0f1f', colorAccent: '#6366f1' },
    { id: 'graphite', name: 'Grafite Ouro', category: 'Modo Escuro', colorBg: '#16171c', colorAccent: '#f0b429' },
    { id: 'material-emerald', name: 'Material You Esmeralda', category: 'Material You', colorBg: '#f4fbf7', colorAccent: '#006c4c' },
    { id: 'material-blue', name: 'Material You Azul Cobalto', category: 'Material You', colorBg: '#f8f9ff', colorAccent: '#005ac1' },
    { id: 'material-purple', name: 'Material You Ametista', category: 'Material You', colorBg: '#fdf7ff', colorAccent: '#6b4ea2' },
    { id: 'material-terracotta', name: 'Material You Terracota', category: 'Material You', colorBg: '#fff8f5', colorAccent: '#984715' },
    { id: 'material-dark', name: 'Material You Dark Slate', category: 'Material You', colorBg: '#101412', colorAccent: '#81d5a2' },
  ];

  const handleExportConfig = () => {
    exportBackupToFile();
  };

  const handleSelectImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        setPendingImportData(json);
        setIsImportModalOpen(true);
      } catch (err) {
        showNotice('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = (mode: 'full' | 'config_only', createSafetyBackup: boolean) => {
    if (pendingImportData) {
      importFullStateWithBackup(pendingImportData, mode, createSafetyBackup);
      setPendingImportData(null);
    }
  };

  const navBtnCls = (tab: string) => {
    const active = activeTab === tab;
    return `w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
      active
        ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
        : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
    }`;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <PageHeader
        icon={Settings}
        title="Configurações"
        subtitle="Ajuste dados, sincronização, aparência e permissões da operação."
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={copiedShareLink ? Check : Share2}
            onClick={handleCopyShareConnectionLink}
            title="Gera um link com credenciais da planilha prontas para colegas se conectarem sem trocar arquivos JSON"
          >
            {copiedShareLink ? 'Link Copiado!' : 'Compartilhar Conexão em Nuvem'}
          </Button>
        }
      />

      <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:items-start lg:gap-5">
        {/* Menu lateral de configurações */}
        <aside className="lg:sticky lg:top-[4.5rem]">
          <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-2 shadow-[var(--shadow-card)] flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            <div className="hidden lg:block px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Dados & Sincronização
            </div>
            <button type="button" onClick={() => setActiveTab('sectors')} className={navBtnCls('sectors')}>
              <Building2 className="w-4 h-4 shrink-0 text-blue-500" />
              <span>Gestão de Setores (Multissetorial)</span>
              {(state.sectorDefinitions?.length || state.registeredSectors?.length || 0) > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[9px] font-black rounded-full">
                  {state.sectorDefinitions?.length || state.registeredSectors?.length || 1}
                </span>
              )}
            </button>
            <button type="button" onClick={() => setActiveTab('spreadsheet')} className={navBtnCls('spreadsheet')}>
              <Zap className="w-4 h-4 shrink-0 text-amber-500" />
              <span>Integrações</span>
            </button>
            <button type="button" onClick={() => setActiveTab('extension')} className={navBtnCls('extension')}>
              <Puzzle className="w-4 h-4 shrink-0 text-amber-500" />
              <span>Configurações da Extensão</span>
            </button>
            <button type="button" onClick={() => setActiveTab('backups')} className={navBtnCls('backups')}>
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Backups & Avançado</span>
              {backupHistory.length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[9px] font-black rounded-full">
                  {backupHistory.length}
                </span>
              )}
            </button>
            <button type="button" onClick={() => setActiveTab('editor_roles')} className={navBtnCls('editor_roles')}>
              <Award className="w-4 h-4 shrink-0" />
              <span>Cargos & Permissões</span>
            </button>

            <div className="hidden lg:block px-3 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Painéis & Aparência
            </div>
            <button type="button" onClick={() => setActiveTab('portal_panel')} className={navBtnCls('portal_panel')}>
              <Smartphone className="w-4 h-4 shrink-0" />
              <span>Painel & Portal da Base</span>
            </button>
            <button type="button" onClick={() => setActiveTab('general')} className={navBtnCls('general')}>
              <Palette className="w-4 h-4 shrink-0" />
              <span>Instalação & Aparência</span>
            </button>

            <div className="hidden lg:block px-3 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Registros
            </div>
            <button type="button" onClick={() => setActiveTab('audit_logs')} className={navBtnCls('audit_logs')}>
              <History className="w-4 h-4 shrink-0" />
              <span>Histórico de Alterações</span>
              {(state.auditLogs || []).length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-[var(--surface-3)] text-[var(--muted)] text-[9px] font-black rounded-full">
                  {(state.auditLogs || []).length}
                </span>
              )}
            </button>

            {devMode && (
              <button type="button" onClick={() => setActiveTab('developer')} className={navBtnCls('developer')}>
                <Code2 className="w-4 h-4 shrink-0" />
                <span>Opções de Desenvolvedor</span>
              </button>
            )}

            <div className="hidden lg:flex flex-col gap-1.5 border-t border-[var(--line)] mt-2 pt-2 px-1">
              <button
                onClick={() => {
                  setDevClicks((c) => {
                    const n = c + 1;
                    if (n >= 5) {
                      setDevMode(true);
                      localStorage.setItem('escalapro_dev_mode', '1');
                      showNotice('Opções de Desenvolvedor desbloqueadas!');
                      return 0;
                    }
                    return n;
                  });
                }}
                title={devMode ? 'Menu do desenvolvedor ativo' : 'Toque 5 vezes para acessar o menu do desenvolvedor'}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black border transition-colors cursor-pointer select-none ${
                  devMode
                    ? 'bg-slate-900 text-emerald-400 border-slate-700'
                    : 'border-dashed border-[var(--line)] text-[var(--muted)] hover:bg-[var(--bg)]'
                }`}
              >
                {devMode ? `DEV ${APP_VERSION}` : `Dimensio v${APP_VERSION}`}
              </button>

              {devMode && (
                <button
                  onClick={() => {
                    setDevMode(false);
                    localStorage.removeItem('escalapro_dev_mode');
                    if (activeTab === 'developer') setActiveTab('general');
                    showNotice('Opções de Desenvolvedor desativadas e ocultadas.');
                  }}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-200 border border-rose-200 dark:border-rose-900 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
                  title="Ocultar e desativar menu de desenvolvedor"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Desativar Dev</span>
                </button>
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0 space-y-4">

      {/* TAB: GESTÃO DE SETORES (MULTISSETORIAL) */}
      {activeTab === 'sectors' && (
        <SectorsSettingsPanel />
      )}

      {/* TAB 1: INTEGRAÇÕES & CONEXÕES (PLANILHA, WEBHOOK & REST API) */}
      {activeTab === 'spreadsheet' && (
        <IntegrationsSettingsPanel
          databaseProvider={databaseProvider}
          setDatabaseProvider={setDatabaseProvider}
          firestoreCollection={firestoreCollection}
          setFirestoreCollection={setFirestoreCollection}
          sheetName={sheetName}
          setSheetName={setSheetName}
          sheetUrl={sheetUrl}
          setSheetUrl={setSheetUrl}
          webhookUrl={webhookUrl}
          setWebhookUrl={setWebhookUrl}
          turnServers={turnServers}
          setTurnServers={setTurnServers}
          autoSync={autoSync}
          setAutoSync={setAutoSync}
          isSyncing={isSyncing}
          isTesting={isTesting}
          testDiag={testDiag}
          handleSaveSpreadsheetConfig={handleSaveSpreadsheetConfig}
          handleSyncNow={handleSyncNow}
          handleForceRecreate={handleForceRecreate}
          handleCopyShareConnectionLink={handleCopyShareConnectionLink}
          copiedShareLink={copiedShareLink}
          setShowAppsScriptModal={setShowAppsScriptModal}
          handleExportConfig={handleExportConfig}
          handleSelectImportFile={handleSelectImportFile}
          setIsTesting={setIsTesting}
          setTestDiag={setTestDiag}
          checkPermissionOrAlert={checkPermissionOrAlert}
        />
      )}

      {/* TAB: CONFIGURAÇÕES DA EXTENSÃO */}
      {activeTab === 'extension' && (
        <ExtensionSettingsPanel />
      )}

      {/* TAB 2: OPÇÕES AVANÇADAS & GESTÃO DE BACKUPS */}
      {activeTab === 'backups' && (
        <div className="space-y-4">
          {/* Header Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--ink)]">
                  Central de Segurança, Diagnósticos e Gestão de Backups
                </h3>
                <p className="text-xs text-[var(--muted)] font-semibold">
                  Proteja sua operação contra perdas acidentais de dados durante importações e trocas de turno.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (!checkPermissionOrAlert()) return;
                const info = createAutoBackup('Backup de Emergência Manual');
                if (info) showNotice('Novo ponto de restauração criado com sucesso!');
              }}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Ponto de Restauração Manual Agora</span>
            </button>
          </div>

          {/* Configuração de Backup Automático */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Configurar Backup Automático do Sistema</span>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                (state.autoBackupSettings?.enabled ?? true) ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
              }`}>
                {(state.autoBackupSettings?.enabled ?? true) ? 'Backup Automático Ativo' : 'Desativado'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <label className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-extrabold text-[var(--ink)]">Ativar Backup Automático</div>
                  <div className="text-[10px] text-[var(--muted)] font-medium">Gera snapshots periódicos locais</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.autoBackupSettings?.enabled ?? true}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateAutoBackupSettings({ enabled: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                <label className="block text-[10px] font-black uppercase text-[var(--muted)]">Intervalo de Backup</label>
                <select
                  value={state.autoBackupSettings?.intervalMinutes ?? 30}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateAutoBackupSettings({ intervalMinutes: Number(e.target.value) });
                  }}
                  className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                >
                  <option value={15}>A cada 15 minutos</option>
                  <option value={30}>A cada 30 minutos (recomendado)</option>
                  <option value={60}>A cada 1 hora</option>
                  <option value={120}>A cada 2 horas</option>
                  <option value={360}>A cada 6 horas</option>
                  <option value={1440}>A cada 24 horas (Diário)</option>
                </select>
              </div>

              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                <label className="block text-[10px] font-black uppercase text-[var(--muted)]">Limite de Retenção</label>
                <select
                  value={state.autoBackupSettings?.maxRetainSnapshots ?? 20}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateAutoBackupSettings({ maxRetainSnapshots: Number(e.target.value) });
                  }}
                  className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                >
                  <option value={5}>Manter 5 últimos pontos</option>
                  <option value={10}>Manter 10 últimos pontos</option>
                  <option value={20}>Manter 20 últimos pontos</option>
                  <option value={50}>Manter 50 últimos pontos</option>
                </select>
              </div>
            </div>

            {state.autoBackupConfig?.lastBackupAtMs && (
              <div className="text-[11px] text-[var(--muted)] font-medium bg-[var(--bg)] p-2.5 rounded-xl border border-[var(--line)] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>
                  Último backup automático executado em: <strong>{new Date(state.autoBackupConfig.lastBackupAtMs).toLocaleString('pt-BR')}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Dados da Operação (Opções Avançadas) */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 text-[var(--primary)] font-extrabold text-sm">
                <SlidersHorizontal className="w-4 h-4" />
                <h3 className="text-sm font-black text-[var(--ink)]">Dados da Operação</h3>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${state.setupCompleted ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                {state.setupCompleted ? 'Configurado' : 'Configuração pendente'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Local / Unidade</div>
                <div className="text-xs font-extrabold text-[var(--ink)]">{state.location || '—'}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Setor</div>
                <div className="text-xs font-extrabold text-[var(--ink)]">{state.sector || '—'}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Tipo de Escala</div>
                <div className="text-xs font-extrabold text-[var(--ink)]">
                  {state.scaleType === 'custom' ? 'Personalizada' : '6x2'}
                  <span className="ml-1.5 text-[10px] text-[var(--muted)] font-mono">
                    Turmas {(state.scaleGroups || []).join(', ')}
                  </span>
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Turnos</div>
                <div className="text-xs font-extrabold text-[var(--ink)]">
                  {(state.shifts || []).map((s) => `Turno ${s}`).join(' · ') || '—'}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Período Absenteísmo</div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={state.absenteeismPeriodDays || 30}
                    onChange={(e) => setAbsenteeismPeriodDays(Number(e.target.value))}
                    title="Período padrão de cálculo do absenteísmo da operação"
                    className="px-2 py-1 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[10px] font-black text-[var(--ink)] cursor-pointer focus:outline-none focus:border-rose-500"
                  >
                    {[7, 15, 30, 45, 60, 90].map((d) => (
                      <option key={d} value={d}>{d} dias</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-[var(--muted)] font-bold">padrão</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-[var(--line)]">
              <p className="text-xs text-[var(--muted)] leading-relaxed max-w-xl">
                Refaça o assistente guiado para ajustar local, turnos, tipo de escala, times/TL, cargos, tarefas e horários da operação.
              </p>
              <button
                onClick={openSetupWizard}
                className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Reconfigurar Operação</span>
              </button>
            </div>
          </div>

          {/* Backup History Table */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 text-[var(--ink)] font-extrabold text-sm">
                <History className="w-4 h-4 text-amber-600" />
                <span>Histórico de Pontos de Restauração Salvos (Local & Nuvem)</span>
              </div>
              {backupHistory.length > 0 && (
                <button
                  onClick={clearBackupHistory}
                  className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Limpar Histórico de Backups
                </button>
              )}
            </div>

            {backupHistory.length === 0 ? (
              <div className="p-8 text-center text-[var(--muted)] text-xs space-y-2 bg-[var(--bg)] rounded-xl border border-[var(--line)]">
                <ShieldCheck className="w-8 h-8 mx-auto text-amber-500 opacity-60" />
                <p className="font-bold text-[var(--ink)]">Nenhum ponto de restauração manual criado ainda.</p>
                <p className="text-[11px]">
                  O sistema gera pontos de restauração automaticamente antes de limpezas ou importações.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] uppercase font-black text-[10px]">
                      <th className="p-3">Data e Hora</th>
                      <th className="p-3">Motivo / Origem</th>
                      <th className="p-3">Equipe / Qtd Colaboradores</th>
                      <th className="p-3 text-right">Ações de Segurança</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {backupHistory.map((snap) => (
                      <tr key={snap.id} className="hover:bg-[var(--bg)]/50 transition-colors">
                        <td className="p-3 font-bold text-[var(--ink)] whitespace-nowrap">
                          {snap.formattedDate}
                        </td>
                        <td className="p-3 font-semibold text-[var(--ink)]">
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20 rounded-md font-mono text-[11px]">
                            {snap.reason}
                          </span>
                        </td>
                        <td className="p-3 text-[var(--muted)]">
                          <strong className="text-[var(--ink)]">{snap.teamName || 'Equipe'}</strong> ({snap.collaboratorCount} colaboradores)
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => restoreBackupById(snap.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                              title="Restaurar este ponto de backup"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restaurar</span>
                            </button>
                            <button
                              onClick={() => exportBackupToFile(snap)}
                              className="p-1.5 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--paper)] text-[var(--ink)] rounded-lg text-[11px] cursor-pointer"
                              title="Baixar JSON deste ponto"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteBackupById(snap.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg cursor-pointer"
                              title="Excluir do histórico"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cloud Backups Stored Inside the Spreadsheet */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 text-[var(--ink)] font-extrabold text-sm">
                <Cloud className="w-4 h-4 text-sky-600" />
                <span>Backups na Nuvem (Guardados Dentro da Planilha)</span>
              </div>
              <button
                onClick={loadCloudBackups}
                disabled={cloudBackupsLoading || !state.onlineSpreadsheet?.webhookUrl}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cloudBackupsLoading ? 'animate-spin' : ''}`} />
                <span>{cloudBackupsLoading ? 'Carregando...' : 'Carregar Backups'}</span>
              </button>
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Antes de cada sincronização completa, o Apps Script guarda uma cópia automática de segurança da escala
              dentro da própria planilha (aba <code className="font-mono">__BACKUP__</code>). Se a planilha for
              sobrescrita por acidente com dados de exemplo, você pode restaurar um destes pontos diretamente da nuvem.
            </p>

            {!state.onlineSpreadsheet?.webhookUrl ? (
              <div className="p-6 text-center text-[var(--muted)] text-xs bg-[var(--bg)] rounded-xl border border-[var(--line)]">
                <CloudOff className="w-7 h-7 mx-auto text-slate-400 opacity-60 mb-2" />
                <p className="font-bold text-[var(--ink)]">Nenhuma planilha conectada.</p>
                <p className="text-[11px]">Conecte a planilha (com o Apps Script atualizado) para usar os backups da nuvem.</p>
              </div>
            ) : cloudBackupsError ? (
              <div className="p-6 text-center text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="font-bold text-red-700 dark:text-red-200">Não foi possível listar backups na planilha.</p>
                <p className="text-[11px] text-red-600 dark:text-red-300 mt-1">{cloudBackupsError}</p>
              </div>
            ) : cloudBackups.length === 0 ? (
              <div className="p-6 text-center text-[var(--muted)] text-xs bg-[var(--bg)] rounded-xl border border-[var(--line)]">
                <HardDriveDownload className="w-7 h-7 mx-auto text-sky-500 opacity-60 mb-2" />
                <p className="font-bold text-[var(--ink)]">Nenhum backup na nuvem ainda.</p>
                <p className="text-[11px]">
                  Clique em "Carregar Backups" para consultar. Os backups são criados automaticamente sempre que a
                  escala é sincronizada com a planilha.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] uppercase font-black text-[10px]">
                      <th className="p-3">Data e Hora</th>
                      <th className="p-3">Motivo / Origem</th>
                      <th className="p-3">Equipe / Qtd Colaboradores</th>
                      <th className="p-3 text-right">Ações de Segurança</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {cloudBackups.map((cb) => (
                      <tr key={cb.id || cb.index} className="hover:bg-[var(--bg)]/50 transition-colors">
                        <td className="p-3 font-bold text-[var(--ink)] whitespace-nowrap">{cb.formattedDate}</td>
                        <td className="p-3 font-semibold text-[var(--ink)]">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] border ${
                            cb.type === 'DAILY'
                              ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/20'
                              : 'bg-sky-500/10 text-sky-800 dark:text-sky-200 border-sky-500/20'
                          }`}>
                            {cb.reason}
                          </span>
                        </td>
                        <td className="p-3 text-[var(--muted)]">
                          <strong className="text-[var(--ink)]">{cb.teamName || 'Equipe'}</strong> ({cb.collaboratorCount} colaboradores)
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setConfirmCloudRestoreId(cb.id)}
                            disabled={restoringCloud}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                            title="Baixar este backup da nuvem e restaurar no aplicativo"
                          >
                            <CloudDownload className="w-3.5 h-3.5" />
                            <span>Restaurar da Nuvem</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Share Connection Link */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>Link Direto de Compartilhamento de Equipe (Evita Sobrescrever Dados)</span>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Em vez de enviar arquivos JSON de backup por e-mail, compartilhe o link direto abaixo com outros gestores. Ao abrir, o colega conecta o aplicativo à mesma planilha do Google Sheets de forma limpa e sem risco de perda de registros!
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={generateShareableConnectionLink()}
                className="flex-1 bg-[var(--bg)] border border-[var(--line)] px-3 py-2 rounded-xl font-mono text-xs text-[var(--ink)] select-all"
              />
              <button
                onClick={handleCopyShareConnectionLink}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
              >
                {copiedShareLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedShareLink ? 'Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>
          </div>

          {/* Limpeza de Estado & Reset para Operação */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--ink)]">
                    Gerenciamento & Limpeza de Dados da Operação
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    Permite resetar o ambiente para um estado 100% limpo quando for necessário reiniciar a configuração.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!checkPermissionOrAlert(true)) return;
                  if (window.confirm('Tem certeza de que deseja remover todos os colaboradores, cargos, turnos e postos? Um ponto de restauração de segurança será criado antes da limpeza.')) {
                    clearSampleData();
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 rounded-xl flex items-center justify-center gap-2 text-xs font-black transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Limpar e Resetar Todos os Dados da Operação</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HISTÓRICO DE ALTERAÇÕES (AUDIT LOGS) */}
      {activeTab === 'audit_logs' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl">
            <div>
              <h3 className="text-base font-black text-[var(--ink)] flex items-center gap-2">
                <History className="w-5 h-5 text-[var(--primary)]" />
                Histórico de Alterações e Trilha de Auditoria
              </h3>
              <p className="text-xs text-[var(--muted)] font-medium mt-0.5">
                Registra quem modificou escalas, atribuições, presenças e configurações no sistema. Permite reverter e retornar a qualquer estado anterior.
              </p>
            </div>

            {(state.auditLogs || []).length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (!checkPermissionOrAlert(true)) return;
                  clearAuditLogs();
                }}
                className="px-3.5 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Trilha
              </button>
            )}
          </div>

          {/* Search & Action Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--paper)] border border-[var(--line)] p-3 rounded-2xl text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-[var(--ink)]">Ação:</span>
              {['todos', 'escala', 'ausencia', 'atribuicao', 'configuracao', 'pedido'].map((act) => (
                <button
                  key={act}
                  type="button"
                  onClick={() => setAuditActionFilter(act)}
                  className={`px-3 py-1 rounded-xl font-bold uppercase text-[10px] transition-all cursor-pointer ${
                    auditActionFilter === act
                      ? 'bg-[var(--primary)] text-white'
                      : 'bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {act}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[var(--muted)] absolute left-3 top-2.5" />
              <input
                type="text"
                value={auditSearchTerm}
                onChange={(e) => setAuditSearchTerm(e.target.value)}
                placeholder="Buscar por usuário ou detalhes..."
                className="w-full bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
              />
            </div>
          </div>

          {/* Audit Logs Table */}
          {(!state.auditLogs || state.auditLogs.length === 0) ? (
            <div className="p-12 text-center text-xs text-[var(--muted)] bg-[var(--paper)] border border-[var(--line)] rounded-2xl">
              Nenhuma alteração registrada ainda.
            </div>
          ) : (
            <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] uppercase font-black text-[10px]">
                      <th className="p-3">Data / Hora</th>
                      <th className="p-3">Identificação (Usuário)</th>
                      <th className="p-3">Tipo de Ação</th>
                      <th className="p-3">Descrição da Alteração</th>
                      <th className="p-3 text-right">Reversão de Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {state.auditLogs
                      .filter((log) => {
                        const act = log.action || log.actionType;
                        if (auditActionFilter !== 'todos' && act !== auditActionFilter) return false;
                        if (auditSearchTerm.trim()) {
                          const term = auditSearchTerm.toLowerCase();
                          return (
                            log.userName.toLowerCase().includes(term) ||
                            log.description.toLowerCase().includes(term) ||
                            (log.details && String(log.details).toLowerCase().includes(term))
                          );
                        }
                        return true;
                      })
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-[var(--bg)]/50 transition-colors">
                          <td className="p-3 font-mono font-bold text-[var(--muted)] whitespace-nowrap text-[11px]">
                            {new Date(log.timestamp).toLocaleString('pt-BR')}
                          </td>
                          <td className="p-3 font-extrabold text-[var(--ink)] whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-[var(--primary)]" />
                              {log.userName}
                              {log.userRole && <span className="text-[var(--muted)] font-normal text-[10px]">({log.userRole})</span>}
                            </span>
                          </td>
                          <td className="p-3 font-bold">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)]">
                              {log.action || log.actionType}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-[var(--ink)]">
                            <div>{log.description}</div>
                            {log.details && (
                              <div className="text-[10.5px] text-[var(--muted)] font-mono mt-0.5">
                                {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details)}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            {log.snapshot ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!checkPermissionOrAlert(true)) return;
                                  restoreFromAuditLog(log.id);
                                }}
                                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10.5px] rounded-lg shadow-2xs transition-all inline-flex items-center gap-1 cursor-pointer"
                                title="Retornar o sistema exatamente ao estado salvo nesta alteração"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Reverter para este estado</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-[var(--muted)] font-medium italic">Sem snapshot</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CARGOS EDITORES & PERMISSÕES */}
      {activeTab === 'editor_roles' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
              <Award className="w-5 h-5 text-[var(--primary)]" />
              <h3>Configuração de Níveis de Acesso por Cargo</h3>
            </div>

            <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">
              Defina as permissões de acesso para cada cargo. Colaboradores da base terão acesso restrito de acordo com o nível configurado.
            </p>

            <div className="space-y-3 pt-2">
              {state.roles.map((role) => {
                const currentLevel: RoleAccessLevel =
                  state.rolePermissions?.[role] ||
                  (role === 'TL' || role === 'Admin' ? 'admin' : role === 'PS' ? 'editor' : 'portal');

                return (
                  <div
                    key={role}
                    className="p-4 rounded-2xl border border-[var(--line)] bg-[var(--bg)] space-y-3"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <Award className="w-4 h-4 text-[var(--primary)]" />
                        <span className="text-sm font-black text-[var(--ink)]">{role}</span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          currentLevel === 'admin'
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
                            : currentLevel === 'editor'
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                            : currentLevel === 'viewer'
                            ? 'bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400'
                            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {currentLevel === 'admin' && 'Administrador (Acesso Total)'}
                        {currentLevel === 'editor' && 'Editor (Gestão e Edição)'}
                        {currentLevel === 'viewer' && 'Visualizador (Apenas Leitura)'}
                        {currentLevel === 'portal' && 'Só Portal (Restrito à Base)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'portal', label: 'Só Portal', desc: 'Acesso restrito ao Portal Operacional (coletores)' },
                        { id: 'viewer', label: 'Visualizador', desc: 'Apenas leitura do painel de gestão' },
                        { id: 'editor', label: 'Editor', desc: 'Gerenciar escalas, tarefas e relatórios' },
                        { id: 'admin', label: 'Administrador', desc: 'Acesso total e configurações' },
                      ].map((lvl) => {
                        const isSelected = currentLevel === lvl.id;
                        return (
                          <button
                            key={lvl.id}
                            type="button"
                            onClick={() => {
                              if (!checkPermissionOrAlert(true)) return;
                              setRolePermission(role, lvl.id as RoleAccessLevel);
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-extrabold'
                                : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                            }`}
                          >
                            <div className="text-xs font-black">{lvl.label}</div>
                            <div
                              className={`text-[9.5px] mt-1 leading-tight font-medium ${
                                isSelected ? 'text-white/80' : 'text-[var(--muted)]'
                              }`}
                            >
                              {lvl.desc}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* POLÍTICA DE SENHA DO SETOR (EXIGÊNCIA DE SENHA) */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm">
                <Lock className="w-5 h-5 text-[var(--primary)]" />
                <h3>Política de Senha do Setor (Identificação)</h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                  state.requireUserPassword
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {state.requireUserPassword ? '🔒 Senha Obrigatória' : '🔓 Senha Opcional'}
              </span>
            </div>

            <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">
              Defina se todos os colaboradores do setor devem obrigatoriamente possuir e digitar uma senha ao se identificar no sistema, ou se a identificação pode ser direta (opcional).
            </p>

            {/* Mode Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!checkPermissionOrAlert(true)) return;
                  setRequireUserPassword(false);
                  showNotice('Política de identificação atualizada: Senha Opcional.');
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  !state.requireUserPassword
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-extrabold ring-2 ring-[var(--primary)]/30'
                    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    <span>Opcional (Padrão Operacional)</span>
                  </div>
                  {!state.requireUserPassword && <Check className="w-4 h-4" />}
                </div>
                <p
                  className={`text-[11px] leading-relaxed font-medium ${
                    !state.requireUserPassword ? 'text-white/85' : 'text-[var(--muted)]'
                  }`}
                >
                  Colaboradores sem senha podem se identificar diretamente com 1 clique. Colaboradores que já cadastraram senha continuam protegidos e digitam sua senha.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!checkPermissionOrAlert(true)) return;
                  setRequireUserPassword(true);
                  showNotice('Política de identificação atualizada: Senha Obrigatória para todos.');
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  state.requireUserPassword
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-extrabold ring-2 ring-[var(--primary)]/30'
                    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    <span>Obrigatório (Todos com Senha)</span>
                  </div>
                  {state.requireUserPassword && <Check className="w-4 h-4" />}
                </div>
                <p
                  className={`text-[11px] leading-relaxed font-medium ${
                    state.requireUserPassword ? 'text-white/85' : 'text-[var(--muted)]'
                  }`}
                >
                  Exige que todos os colaboradores digitem uma senha para acessar. Colaboradores sem senha são convidados a criar sua senha pessoal na primeira identificação.
                </p>
              </button>
            </div>

            {/* Metrics Overview */}
            <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                <div className="text-[10.5px] text-[var(--muted)] font-bold">Total no Quadro</div>
                <div className="text-base font-black text-[var(--ink)] mt-0.5">
                  {state.collaborators.length}
                </div>
              </div>
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
                <div className="text-[10.5px] text-[var(--muted)] font-bold">Com Senha Ativa</div>
                <div className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {Object.keys(state.userPasswords || {}).length}
                </div>
              </div>
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl col-span-2 sm:col-span-1">
                <div className="text-[10.5px] text-[var(--muted)] font-bold">Sem Senha Cadastrada</div>
                <div className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">
                  {Math.max(0, state.collaborators.length - Object.keys(state.userPasswords || {}).length)}
                </div>
              </div>
            </div>
          </div>

          {/* SESSÃO & SEGURANÇA DO DISPOSITIVO */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3>Sessão & Segurança do Dispositivo</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                Política desta máquina
              </span>
            </div>

            <p className="text-xs text-[var(--muted)] font-medium leading-relaxed">
              Estas opções controlam como o portal se comporta <strong>neste navegador/dispositivo</strong>.
              Por padrão nada de dados de equipe ou de usuário fica gravado: tudo vive somente durante a
              sessão e some ao fechar a aba.
            </p>

            {/* Armazenamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!checkPermissionOrAlert(true)) return;
                  setSessionConfig({ sessionOnly: true });
                  showNotice('Armazenamento de sessão ativado: nenhum dado fica gravado neste navegador.');
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  sessionConfig.sessionOnly
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-extrabold ring-2 ring-[var(--primary)]/30'
                    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Somente na sessão (Recomendado)</span>
                  </div>
                  {sessionConfig.sessionOnly && <Check className="w-4 h-4" />}
                </div>
                <p className={`text-[11px] leading-relaxed font-medium ${sessionConfig.sessionOnly ? 'text-white/85' : 'text-[var(--muted)]'}`}>
                  Dados de equipe e identidade ficam só na memória da sessão e somem ao fechar a aba.
                  A próxima pessoa não vê nada seu e não consegue usar sua conta.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!checkPermissionOrAlert(true)) return;
                  setSessionConfig({ sessionOnly: false });
                  showNotice('Persistência local ativada: os dados passarão a ser gravados neste navegador. Exporte um backup antes de trocar de política.');
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                  !sessionConfig.sessionOnly
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-extrabold ring-2 ring-[var(--primary)]/30'
                    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    <span>Persistir neste navegador</span>
                  </div>
                  {!sessionConfig.sessionOnly && <Check className="w-4 h-4" />}
                </div>
                <p className={`text-[11px] leading-relaxed font-medium ${!sessionConfig.sessionOnly ? 'text-white/85' : 'text-[var(--muted)]'}`}>
                  Mantém os dados salvos neste navegador (localStorage). Use apenas se o dispositivo não
                  é compartilhado. A identidade do usuário continua sendo sempre por sessão.
                </p>
              </button>
            </div>

            {/* Modo sempre conectado */}
            <div className="flex items-start justify-between gap-4 bg-[var(--bg)] border border-[var(--line)] rounded-2xl p-4">
              <div className="space-y-1">
                <div className="text-xs font-black text-[var(--ink)] flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-emerald-600" />
                  Modo sempre conectado
                </div>
                <p className="text-[11px] text-[var(--muted)] font-medium leading-relaxed">
                  Quando ativo, o portal opera somente online com a planilha compartilhada. Sem conexão,
                  nada pode ser alterado (somente leitura) até reconectar — eliminando o risco de
                  divergência e sobrescrita entre local e online.
                </p>
                <p className="text-[10px] text-[var(--muted)]/80 font-bold">
                  Status atual:{' '}
                  <span className={cloudOnline ? 'text-emerald-600' : 'text-amber-600'}>
                    {cloudOnline ? 'Conexão ativa' : 'Sem conexão'}
                  </span>{' '}
                  {state.onlineSpreadsheet?.webhookUrl ? '' : '• Nenhuma planilha conectada'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={sessionConfig.alwaysOnline}
                onClick={() => {
                  if (!checkPermissionOrAlert(true)) return;
                  setSessionConfig({ alwaysOnline: !sessionConfig.alwaysOnline });
                  showNotice(
                    sessionConfig.alwaysOnline
                      ? 'Modo sempre conectado desativado.'
                      : 'Modo sempre conectado ativado: o portal exigirá conexão para permitir alterações.'
                  );
                }}
                className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer shrink-0 ${
                  sessionConfig.alwaysOnline ? 'bg-emerald-600' : 'bg-[var(--line)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                    sessionConfig.alwaysOnline ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Acesso anônimo */}
            <div className="flex items-start justify-between gap-4 bg-[var(--bg)] border border-[var(--line)] rounded-2xl p-4">
              <div className="space-y-1">
                <div className="text-xs font-black text-[var(--ink)] flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-amber-600" />
                  Bloquear acesso anônimo
                </div>
                <p className="text-[11px] text-[var(--muted)] font-medium leading-relaxed">
                  Quando ativo, o portal exige uma <strong>tela de login</strong> ao abrir. A pessoa
                  escolhe seu usuário (colaborador/TL/administrador) e digita a senha cadastrada. Cada
                  sessão termina ao fechar a aba — ninguém herda o acesso de outra pessoa.
                </p>
                {identifiedUser && (
                  <p className="text-[10px] text-[var(--muted)]/80 font-bold">
                    Sessão atual: {identifiedUser.name} (
                    <button
                      type="button"
                      onClick={() => {
                        logoutUser();
                        showNotice('Sessão encerrada. Na próxima abertura o login será solicitado.');
                      }}
                      className="underline cursor-pointer text-amber-600 hover:text-amber-700"
                    >
                      encerrar
                    </button>
                    )
                  </p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={sessionConfig.allowAnonymousAccess === false}
                onClick={() => {
                  if (!checkPermissionOrAlert(true)) return;
                  const block = sessionConfig.allowAnonymousAccess !== false;
                  setSessionConfig({ allowAnonymousAccess: !block });
                  showNotice(
                    block
                      ? 'Acesso anônimo bloqueado: será solicitado login ao abrir o portal.'
                      : 'Acesso anônimo liberado novamente.'
                  );
                }}
                className={`relative w-12 h-7 rounded-full transition-colors cursor-pointer shrink-0 ${
                  sessionConfig.allowAnonymousAccess === false ? 'bg-amber-600' : 'bg-[var(--line)]'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${
                    sessionConfig.allowAnonymousAccess === false ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB DEVELOPER: OPÇÕES DE DESENVOLVEDOR (menu oculto) */}
      {activeTab === 'developer' && (
        <div className="space-y-4">
          {/* Header note */}
          <div className="bg-slate-900 text-slate-100 border border-slate-700 p-4 rounded-2xl flex items-start gap-3">
            <Code2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Opções de Desenvolvedor</h3>
              <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
                Menu oculto para o gestor/desenvolvedor. Não aparece para usuários comuns. Use com cuidado — alterações aqui afetam a configuração global do aplicativo.
              </p>
            </div>
          </div>

          {/* Feedback Form Config */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
              <MessageSquareText className="w-4 h-4 text-emerald-600" />
              <span>Feedback dos Usuários (Google Forms)</span>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              O colaborador preenche um campo simples na tela de <strong>Ajuda</strong>. Cada envio vira uma resposta do formulário — para receber em uma <strong>planilha organizada</strong>, abra o formulário no Google Forms e ative a aba <strong>"Respostas" → "Vincular ao Planilhas"</strong>. Cada feedback entrará como uma linha na planilha, com data e hora.
            </p>
            <div className="space-y-2">
              <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
                URL do Formulário (base, termina em /viewform)
              </label>
              <input
                type="text"
                value={feedbackFormUrl}
                onChange={(e) => setFeedbackFormUrl(e.target.value)}
                placeholder="https://docs.google.com/forms/d/e/1FAIpQLS.../viewform"
                className="w-full bg-[var(--bg)] border border-[var(--line)] px-3 py-2 rounded-xl font-mono text-xs text-[var(--ink)]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
                  Entry ID — Mensagem (obrigatório)
                </label>
                <input
                  type="text"
                  value={feedbackEntryMessage}
                  onChange={(e) => setFeedbackEntryMessage(e.target.value)}
                  placeholder="entry.123456789"
                  className="w-full bg-[var(--bg)] border border-[var(--line)] px-3 py-2 rounded-xl font-mono text-xs text-[var(--ink)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
                  Entry ID — Nome (reservado)
                </label>
                <input
                  type="text"
                  value={feedbackEntryName}
                  onChange={(e) => setFeedbackEntryName(e.target.value)}
                  placeholder="entry.987654321"
                  className="w-full bg-[var(--bg)] border border-[var(--line)] px-3 py-2 rounded-xl font-mono text-xs text-[var(--ink)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">
                  Entry ID — Categoria (reservado)
                </label>
                <input
                  type="text"
                  value={feedbackEntryCategory}
                  onChange={(e) => setFeedbackEntryCategory(e.target.value)}
                  placeholder="entry.555555555"
                  className="w-full bg-[var(--bg)] border border-[var(--line)] px-3 py-2 rounded-xl font-mono text-xs text-[var(--ink)]"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              <p className="text-[11px] text-[var(--muted)] font-semibold">
                Para descobrir os IDs: abra o formulário em uma aba anônima, envie um teste e veja os parâmetros <code className="bg-[var(--bg)] px-1 py-0.5 rounded font-mono">entry.</code> na URL da resposta.
              </p>
              <button
                onClick={handleSaveFeedbackConfig}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Salvar Configuração</span>
              </button>
            </div>
          </div>

          {/* Dev utilities */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Diagnóstico & Utilidades</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3 space-y-1.5">
                <div className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">Estado Local</div>
                <div className="text-xs font-bold text-[var(--ink)]">
                  {(new Blob([JSON.stringify(state)]).size / 1024).toFixed(1)} KB armazenados • {state.collaborators.length} colaboradores
                </div>
              </div>
              <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3 space-y-1.5">
                <div className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider">Conexão em Nuvem</div>
                <div className="text-xs font-bold text-[var(--ink)]">
                  {state.onlineSpreadsheet ? `Conectado a "${state.onlineSpreadsheet.name}"` : 'Sem planilha conectada'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleDownloadRawState}
                className="px-3.5 py-2 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--paper)] text-[var(--ink)] text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Estado Bruto (JSON)</span>
              </button>
              <button
                onClick={async () => {
                  if (!state.onlineSpreadsheet?.webhookUrl) {
                    showNotice('Nenhuma planilha/webhook conectado para buscar.');
                    return;
                  }
                  showNotice('Buscando dados da planilha...');
                  const ok = await fetchFromOnlineSpreadsheet(true);
                  showNotice(ok ? 'Dados atualizados da planilha!' : 'Falha ao buscar da planilha.');
                }}
                className="px-3.5 py-2 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--paper)] text-[var(--ink)] text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Buscar Agora da Planilha</span>
              </button>
              <button
                onClick={handleCheckForUpdate}
                className="px-3.5 py-2 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--paper)] text-[var(--ink)] text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Revalida o service worker para carregar a versão mais recente do aplicativo"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Verificar Atualização</span>
              </button>
              <button
                onClick={handleResetDevConfig}
                className="px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Configurações do Desenvolvedor</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[var(--muted)] font-bold">
              <span className="px-2 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--line)]">Versão: v{APP_VERSION}</span>
              <span className="px-2 py-0.5 rounded-md bg-[var(--bg)] border border-[var(--line)]">Build: {APP_BUILD_DATE}</span>
              {GIT_COMMIT ? (
                <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 font-mono">
                  Git Ativo: {GIT_BRANCH ? `${GIT_BRANCH}@` : ''}{GIT_COMMIT}
                </span>
              ) : HAS_GIT ? (
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Git Repositório Detectado
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  Git não inicializado
                </span>
              )}
            </div>
            <p className="text-[10px] text-[var(--muted)] font-medium">
              Dica: para ocultar este menu novamente, limpe os dados locais ou apague a chave "escalapro_dev_mode" do armazenamento.
            </p>
          </div>
        </div>
      )}

      {/* TAB: PAINEL & PORTAL DA BASE (CONFIGURAÇÃO UNIFICADA + HELPDESK) */}
      {activeTab === 'portal_panel' && (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-2 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-[var(--ink)]">
                  Painel & Portal da Base Operacional
                </h2>
                <p className="text-xs text-[var(--muted)] font-medium">
                  Central de links dedicados, acessos rápidos para dispositivos móveis, filtros pré-configurados e gerenciamento da Central de Atendimento.
                </p>
              </div>
            </div>
          </div>

          {/* 1. SEÇÃO CENTRAL DE ATENDIMENTO & SUPORTE */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center font-black">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
                    Fluxo de Suporte & Central de Atendimento Operacional
                  </h3>
                  <p className="text-[10.5px] text-[var(--muted)]">
                    Configure as regras de atendimento, alertas sonoros, tipos de chamado e cargos autorizados para atender
                  </p>
                </div>
              </div>

              <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider ${
                state.helpdeskConfig?.enabled !== false
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
              }`}>
                {state.helpdeskConfig?.enabled !== false ? 'Atendimento Ativo' : 'Desativado'}
              </span>
            </div>

            {/* Configurações Globais de Atendimento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.helpdeskConfig?.enabled !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold">Habilitar Chamados de Suporte</div>
                  <div className="text-[10px] font-medium opacity-80">Permitir que operadores e painéis enviem pedidos de ajuda</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.helpdeskConfig?.enabled !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateHelpdeskConfig({ enabled: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.helpdeskConfig?.notifySound !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold">Alerta Sonoro de Novos Chamados</div>
                  <div className="text-[10px] font-medium opacity-80">Tocar sinal sonoro quando um novo chamado de suporte entrar na fila</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.helpdeskConfig?.notifySound !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateHelpdeskConfig({ notifySound: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>
            </div>

            {/* Cargos Autorizados para Atendimento */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-extrabold text-[var(--ink)] uppercase tracking-wider">
                  Cargos com Permissão para Atender a Fila (Equipe de Suporte do Turno):
                </div>
                <span className="text-[10px] font-bold text-[var(--primary)]">
                  {(state.helpdeskConfig?.supportRoles || []).length} cargo(s) selecionado(s)
                </span>
              </div>
              <p className="text-[10px] text-[var(--muted)]">
                Usuários identificados com estes cargos terão acesso ao botão "Atender", contador de TMA e resolução dos chamados.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {state.roles.map((r) => {
                  const currentSupportRoles = state.helpdeskConfig?.supportRoles || ['Suporte', 'TL', 'Supervisor', 'Analista', 'Administrador'];
                  const isSupportRole = currentSupportRoles.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        if (!checkPermissionOrAlert()) return;
                        const newRoles = isSupportRole
                          ? currentSupportRoles.filter((item) => item !== r)
                          : [...currentSupportRoles, r];
                        updateHelpdeskConfig({ supportRoles: newRoles });
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSupportRole
                          ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                          : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink)] hover:border-violet-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSupportRole}
                        readOnly
                        className="w-3 h-3 rounded pointer-events-none"
                      />
                      <span>{r}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gestão de Tipos de Pedido / Presets */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-[11px] font-extrabold text-[var(--ink)] uppercase tracking-wider">
                  Tipos de Chamado Pré-configurados (Opções para o Colaborador):
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!checkPermissionOrAlert()) return;
                      const currentTypes = state.helpdeskConfig?.supportTypes || [];
                      const existingNames = new Set(currentTypes.map((t) => t.name.toLowerCase().trim()));
                      const missingDefaults = DEFAULT_SUPPORT_TYPES.filter(
                        (d) => !existingNames.has(d.name.toLowerCase().trim())
                      );
                      const merged = [...currentTypes, ...missingDefaults];
                      updateHelpdeskConfig({ supportTypes: merged });
                      showNotice('Tipos de chamados padrão restaurados/mesclados com sucesso!');
                    }}
                    className="px-2.5 py-1 bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--ink)] text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Restaurar tipos pré-configurados do sistema"
                  >
                    <RotateCcw className="w-3 h-3 text-[var(--primary)]" />
                    <span>Restaurar Padrões</span>
                  </button>
                  <span className="text-[10px] font-bold text-[var(--muted)]">
                    {(state.helpdeskConfig?.supportTypes || []).length} tipo(s) cadastrado(s)
                  </span>
                </div>
              </div>

              {/* Lista de Tipos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(state.helpdeskConfig?.supportTypes || []).map((preset) => {
                  const priorityColors = {
                    baixa: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-400/30',
                    media: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/30',
                    alta: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30',
                    urgente: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/30',
                  };

                  return (
                    <div
                      key={preset.id}
                      className="p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--ink)] truncate">{preset.name}</span>
                          <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase border ${priorityColors[preset.priority] || priorityColors.media}`}>
                            {preset.priority}
                          </span>
                        </div>
                        {preset.placeholder && (
                          <div className="text-[10px] text-[var(--muted)] truncate opacity-80">{preset.placeholder}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSupportTypeId(preset.id);
                            setEditingSupportTypeName(preset.name);
                            setEditingSupportTypePriority(preset.priority);
                            setEditingSupportTypeFields(preset.fields || []);
                            setEditingSupportTypeActionLink(preset.actionLink || '');
                            setEditingSupportTypeActionLinkVars(preset.actionLinkVars || []);
                          }}
                          className="p-1.5 text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--bg)] rounded-lg transition-colors cursor-pointer"
                          title="Editar tipo"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!checkPermissionOrAlert()) return;
                            const updated = (state.helpdeskConfig?.supportTypes || []).filter((p) => p.id !== preset.id);
                            updateHelpdeskConfig({ supportTypes: updated });
                            showNotice(`Tipo "${preset.name}" removido.`);
                          }}
                          className="p-1.5 text-[var(--muted)] hover:text-rose-600 hover:bg-[var(--bg)] rounded-lg transition-colors cursor-pointer"
                          title="Excluir tipo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal / Edição Inline */}
              {editingSupportTypeId && (
                <div className="p-3 bg-[var(--paper)] border-2 border-violet-500 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-[var(--ink)]">Editar Tipo de Chamado</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editingSupportTypeName}
                      onChange={(e) => setEditingSupportTypeName(e.target.value)}
                      placeholder="Nome do tipo"
                      className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--ink)] focus:outline-none focus:border-violet-500 font-bold"
                    />
                    <select
                      value={editingSupportTypePriority}
                      onChange={(e) => setEditingSupportTypePriority(e.target.value as any)}
                      className="px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--ink)] font-bold focus:outline-none"
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                  <SupportTypeFieldsEditor fields={editingSupportTypeFields} onChange={setEditingSupportTypeFields} />
                  <SupportActionLinkEditor
                    value={editingSupportTypeActionLink}
                    vars={editingSupportTypeActionLinkVars}
                    fields={editingSupportTypeFields}
                    onValueChange={setEditingSupportTypeActionLink}
                    onVarsChange={setEditingSupportTypeActionLinkVars}
                  />
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingSupportTypeId(null)}
                      className="px-2.5 py-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!editingSupportTypeName.trim()) return;
                        const updated = (state.helpdeskConfig?.supportTypes || []).map((t) =>
                          t.id === editingSupportTypeId
                            ? {
                                ...t,
                                name: editingSupportTypeName.trim(),
                                priority: editingSupportTypePriority,
                                fields: editingSupportTypeFields,
                                actionLink: editingSupportTypeActionLink.trim() || undefined,
                                actionLinkVars:
                                  editingSupportTypeActionLinkVars.length > 0
                                    ? editingSupportTypeActionLinkVars
                                    : undefined,
                              }
                            : t
                        );
                        updateHelpdeskConfig({ supportTypes: updated });
                        setEditingSupportTypeId(null);
                        showNotice('Tipo de chamado atualizado!');
                      }}
                      className="px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </div>
              )}

              {/* Form para adicionar novo tipo */}
              <div className="pt-2 border-t border-[var(--line)]">
                <div className="text-[10.5px] font-bold text-[var(--ink)] mb-1.5 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-violet-600" />
                  <span>Adicionar Novo Tipo de Chamado:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={newSupportTypeName}
                    onChange={(e) => setNewSupportTypeName(e.target.value)}
                    placeholder="Ex.: Troca de Coletor / Bateria"
                    className="sm:col-span-2 px-3 py-1.5 text-xs bg-[var(--paper)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none focus:border-violet-500 font-bold"
                  />
                  <select
                    value={newSupportTypePriority}
                    onChange={(e) => setNewSupportTypePriority(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs bg-[var(--paper)] border border-[var(--line)] rounded-xl text-[var(--ink)] font-bold focus:outline-none"
                  >
                    <option value="baixa">Prioridade: Baixa</option>
                    <option value="media">Prioridade: Média</option>
                    <option value="alta">Prioridade: Alta</option>
                    <option value="urgente">Prioridade: Urgente</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!checkPermissionOrAlert()) return;
                      if (!newSupportTypeName.trim()) {
                        showNotice('Digite o nome do tipo de chamado.');
                        return;
                      }
                      const newId = `type_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
                      const newType = {
                        id: newId,
                        name: newSupportTypeName.trim(),
                        priority: newSupportTypePriority,
                        placeholder: newSupportTypePlaceholder.trim() || undefined,
                        fields: newSupportTypeFields.length > 0 ? newSupportTypeFields : undefined,
                        actionLink: newSupportTypeActionLink.trim() || undefined,
                        actionLinkVars:
                          newSupportTypeActionLinkVars.length > 0 ? newSupportTypeActionLinkVars : undefined,
                      };
                      const currentTypes = state.helpdeskConfig?.supportTypes || [];
                      updateHelpdeskConfig({ supportTypes: [...currentTypes, newType] });
                      setNewSupportTypeName('');
                      setNewSupportTypePlaceholder('');
                      setNewSupportTypeFields([]);
                      setNewSupportTypeActionLink('');
                      setNewSupportTypeActionLinkVars([]);
                      showNotice(`Tipo "${newType.name}" cadastrado com sucesso!`);
                    }}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>
                <div className="mt-3">
                  <SupportTypeFieldsEditor fields={newSupportTypeFields} onChange={setNewSupportTypeFields} />
                </div>
                <div className="mt-2">
                  <SupportActionLinkEditor
                    value={newSupportTypeActionLink}
                    vars={newSupportTypeActionLinkVars}
                    fields={newSupportTypeFields}
                    onValueChange={setNewSupportTypeActionLink}
                    onVarsChange={setNewSupportTypeActionLinkVars}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 1.5 SEÇÃO NOTIFICAÇÕES DO PORTAL */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
                    Notificações do Portal
                  </h3>
                  <p className="text-[10.5px] text-[var(--muted)]">
                    Configure quais alertas os operadores recebem no Portal da Base (som, vibração, redirecionamentos, avisos de turno e status de suporte)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.portalNotificationConfig?.soundAlerts !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" />
                    Alerta Sonoro
                  </div>
                  <div className="text-[10px] font-medium opacity-80">Tocar sinal sonoro nas notificações e alertas do portal</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.portalNotificationConfig?.soundAlerts !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updatePortalNotificationConfig({ soundAlerts: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.portalNotificationConfig?.vibrationAlerts === true
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <Vibrate className="w-3.5 h-3.5" />
                    Vibração do Dispositivo
                  </div>
                  <div className="text-[10px] font-medium opacity-80">Vibrar o coletor/dispositivo quando houver novos alertas</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.portalNotificationConfig?.vibrationAlerts === true}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updatePortalNotificationConfig({ vibrationAlerts: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.portalNotificationConfig?.taskRedirectionAlert !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5" />
                    Redirecionamento de Tarefa
                  </div>
                  <div className="text-[10px] font-medium opacity-80">Alertar o operador quando for redirecionado para uma nova tarefa</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.portalNotificationConfig?.taskRedirectionAlert !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updatePortalNotificationConfig({ taskRedirectionAlert: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.portalNotificationConfig?.shiftNotices !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" />
                    Avisos de Turno
                  </div>
                  <div className="text-[10px] font-medium opacity-80">Exibir avisos direcionados ao turno do operador (troca de turno e comunicados)</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.portalNotificationConfig?.shiftNotices !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updatePortalNotificationConfig({ shiftNotices: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.portalNotificationConfig?.supportStatusAlerts !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5" />
                    Status de Suporte
                  </div>
                  <div className="text-[10px] font-medium opacity-80">Notificar o solicitante quando o chamado de suporte for atendido, resolvido ou cancelado</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.portalNotificationConfig?.supportStatusAlerts !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updatePortalNotificationConfig({ supportStatusAlerts: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 2. SEÇÃO MEU PAINEL (PAINEL DO COLABORADOR POR TURNO) */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-xs font-mono">
                  M
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
                    Meu Painel — Gerador de Link do Colaborador por Turno
                  </h3>
                  <p className="text-[10.5px] text-[var(--muted)]">
                    Gere um link exclusivo para cada turno (T1, T2, T3, etc.) para que seus colaboradores recebam as informações, avisos e solicitem suporte
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.showEmployeePortal !== false}
                    onChange={(e) => {
                      if (!checkPermissionOrAlert()) return;
                      setModuleVisibility({ showEmployeePortal: e.target.checked });
                    }}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-[var(--ink)]">Ativo no App</span>
                </label>
              </div>
            </div>

            {/* SELEÇÃO DO TURNO DO LINK */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-3.5 rounded-2xl space-y-3">
              <div className="text-[11px] font-extrabold text-[var(--ink)] flex items-center gap-1.5 uppercase tracking-wider">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>Selecione o Turno do Link do Colaborador:</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setEmployeePresetShift('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    employeePresetShift === 'all'
                      ? 'bg-[var(--primary)] text-white shadow-2xs'
                      : 'bg-[var(--paper)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Todos os Turnos
                </button>
                {(state.shifts || ['T1', 'T2', 'T3', 'T4', 'ADM']).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEmployeePresetShift(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      employeePresetShift === s
                        ? 'bg-[var(--primary)] text-white shadow-2xs'
                        : 'bg-[var(--paper)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Turno {s}
                  </button>
                ))}
              </div>
            </div>

            {/* DYNAMIC EMPLOYEE LINK URL FIELD */}
            {(() => {
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
              const params = new URLSearchParams();
              params.set('view', 'employee');
              if (employeePresetShift !== 'all') params.set('shift', employeePresetShift);

              if (state.onlineSpreadsheet?.url || state.onlineSpreadsheet?.webhookUrl) {
                const cx = encodeConnectionParams({
                  sheetUrl: state.onlineSpreadsheet.url,
                  webhookUrl: state.onlineSpreadsheet.webhookUrl,
                  sheetName: state.onlineSpreadsheet.name,
                  teamName: state.teamName,
                });
                if (cx) {
                  params.set('cx', cx);
                }
              }

              const generatedEmpUrl = `${origin}${pathname}?${params.toString()}`;

              return (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--ink)] block">
                    Link Gerado para o Painel do Colaborador ({employeePresetShift === 'all' ? 'Geral' : `Turno ${employeePresetShift}`}):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedEmpUrl}
                      className="flex-1 px-3 py-2 text-xs font-mono bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedEmpUrl);
                        showNotice(`Link do Painel do Colaborador (${employeePresetShift === 'all' ? 'Todos os turnos' : `Turno ${employeePresetShift}`}) copiado!`);
                      }}
                      className="px-3.5 py-2 bg-[var(--primary)] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-[var(--primary-dark)] cursor-pointer transition-colors shadow-2xs shrink-0"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Copiar Link</span>
                    </button>
                    <a
                      href={generatedEmpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Testar Link</span>
                    </a>
                  </div>
                  <p className="text-[10px] text-[var(--muted)] font-medium leading-relaxed pt-1">
                    💡 <strong>Como usar:</strong> Envie este link para os colaboradores do <strong>{employeePresetShift === 'all' ? 'seu time' : `Turno ${employeePresetShift}`}</strong> via WhatsApp ou atalho. Ao abrir no celular, o painel se conectará automaticamente com as informações sincronizadas do turno.
                  </p>
                </div>
              );
            })()}
          </div>

          {/* 3. SEÇÃO PORTAL DA BASE OPERACIONAL (INTERFACE DE COLETORES) */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs font-mono">
                  P
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
                    Portal da Base — Gerador de Link para Dispositivos Móveis e Coletores
                  </h3>
                  <p className="text-[10.5px] text-[var(--muted)]">
                    Configure os filtros padrão desejados para enviar o link pré-filtrado para coletores Honeywell RFID, tablets ou WhatsApp da equipe
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.showOperatorPortal !== false}
                    onChange={(e) => {
                      if (!checkPermissionOrAlert()) return;
                      setModuleVisibility({ showOperatorPortal: e.target.checked });
                    }}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-[var(--ink)]">Ativo no App</span>
                </label>
              </div>
            </div>

            {/* CONTROLES DE FILTRO PRÉ-CONFIGURADO DO LINK */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-3.5 rounded-2xl space-y-3">
              <div className="text-[11px] font-extrabold text-[var(--ink)] flex items-center gap-1.5 uppercase tracking-wider">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>Configurar Filtros Padrão do Link do Portal:</span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Turno */}
                <div>
                  <label className="block text-[10px] font-bold text-[var(--muted)] mb-1 uppercase">
                    Turno Padrão:
                  </label>
                  <select
                    value={portalPresetShift}
                    onChange={(e) => setPortalPresetShift(e.target.value)}
                    className="w-full max-w-xs px-2.5 py-1.5 text-xs bg-[var(--paper)] border border-[var(--line)] rounded-xl font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="all">Todos os Turnos</option>
                    {(state.shifts || ['T1', 'T2', 'T3', 'T4', 'T5']).map((s) => (
                      <option key={s} value={s}>
                        Turno {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cargos (Multisseleção) */}
                <div className="space-y-1.5 border-t border-[var(--line)] pt-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase">
                      Filtro de Cargo(s) (Multisseleção):
                    </label>
                    <span className="text-[10px] font-bold text-[var(--primary)]">
                      {portalPresetRoles.length === 0 ? 'Todos os Cargos' : `${portalPresetRoles.length} selecionado(s)`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {state.roles.map((r) => {
                      const checked = portalPresetRoles.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            if (checked) {
                              setPortalPresetRoles(portalPresetRoles.filter((item) => item !== r));
                            } else {
                              setPortalPresetRoles([...portalPresetRoles, r]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            checked
                              ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs'
                              : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            className="w-3 h-3 rounded pointer-events-none"
                          />
                          <span>{r}</span>
                        </button>
                      );
                    })}
                    {portalPresetRoles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPortalPresetRoles([])}
                        className="px-2 py-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 underline cursor-pointer"
                      >
                        Limpar Cargos
                      </button>
                    )}
                  </div>
                </div>

                {/* Categorias (Multisseleção) */}
                <div className="space-y-1.5 border-t border-[var(--line)] pt-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase">
                      Filtro de Categoria(s) (Multisseleção):
                    </label>
                    <span className="text-[10px] font-bold text-[var(--primary)]">
                      {portalPresetCategories.length === 0 ? 'Todas as Categorias' : `${portalPresetCategories.length} selecionada(s)`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {state.categories.map((cat) => {
                      const checked = portalPresetCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            if (checked) {
                              setPortalPresetCategories(portalPresetCategories.filter((item) => item !== cat));
                            } else {
                              setPortalPresetCategories([...portalPresetCategories, cat]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            checked
                              ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs'
                              : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            className="w-3 h-3 rounded pointer-events-none"
                          />
                          <span>{cat}</span>
                        </button>
                      );
                    })}
                    {portalPresetCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPortalPresetCategories([])}
                        className="px-2 py-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 underline cursor-pointer"
                      >
                        Limpar Categorias
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Exibição: Apenas tarefas do operador x Todas */}
              <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={portalPresetOnlyMine}
                    onChange={(e) => setPortalPresetOnlyMine(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-[var(--ink)]">
                    Abrir diretamente em "Minhas Tarefas" (filtrado pelo operador logado)
                  </span>
                </label>

                {(portalPresetShift !== 'all' || portalPresetRoles.length > 0 || portalPresetCategories.length > 0 || portalPresetOnlyMine) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPortalPresetShift('all');
                      setPortalPresetRoles([]);
                      setPortalPresetCategories([]);
                      setPortalPresetOnlyMine(false);
                    }}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                  >
                    Resetar Filtros
                  </button>
                )}
              </div>

              {/* Abreviar nomes dos colaboradores no Portal */}
              <label className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={state.abbreviatePortalNames === true}
                    onChange={(e) => {
                      if (!checkPermissionOrAlert()) return;
                      setPortalNameAbbreviation(e.target.checked);
                    }}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-[var(--ink)]">
                    Abreviar nomes dos colaboradores no Portal
                  </span>
                </div>
                <span className="text-[10px] text-[var(--muted)] font-medium text-right max-w-[220px]">
                  Ex.: "Maria Silva Souza" → "Maria S."
                </span>
              </label>
            </div>

            {/* DYNAMIC URL FIELD */}
            {(() => {
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
              const params = new URLSearchParams();
              params.set('view', 'portal');
              if (portalPresetShift !== 'all') params.set('shift', portalPresetShift);
              if (portalPresetRoles.length > 0) params.set('roles', portalPresetRoles.join(','));
              if (portalPresetCategories.length > 0) params.set('categories', portalPresetCategories.join(','));
              if (portalPresetOnlyMine) params.set('onlyMine', 'true');
              if (state.abbreviatePortalNames === true) params.set('abbrev', 'true');

              // Attach masked connection data so the link connects automatically without exposing raw spreadsheet/webhook URLs
              if (state.onlineSpreadsheet?.url || state.onlineSpreadsheet?.webhookUrl) {
                const cx = encodeConnectionParams({
                  sheetUrl: state.onlineSpreadsheet.url,
                  webhookUrl: state.onlineSpreadsheet.webhookUrl,
                  sheetName: state.onlineSpreadsheet.name,
                  teamName: state.teamName,
                });
                if (cx) {
                  params.set('cx', cx);
                }
              }

              const generatedUrl = `${origin}${pathname}?${params.toString()}`;

              return (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--ink)] block">
                    Link do Portal com Filtros Aplicados:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedUrl}
                      className="flex-1 px-3 py-2 text-xs font-mono bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedUrl);
                        showNotice('Link do Portal com filtros copiado com sucesso!');
                      }}
                      className="px-3.5 py-2 bg-[var(--primary)] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-[var(--primary-dark)] cursor-pointer transition-colors shadow-2xs shrink-0"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Copiar Link</span>
                    </button>
                    <a
                      href={generatedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Testar Link</span>
                    </a>
                  </div>
                  <p className="text-[10px] text-[var(--muted)] font-medium leading-relaxed pt-1">
                    💡 <strong>Como usar:</strong> Cole este link nos coletores da equipe ou distribua o link para a operação. Ao ser aberto, o Portal inicializará automaticamente com os filtros configurados e a interface isolada para a base operacional.
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB 3: INSTALAÇÃO, APARÊNCIA, TEMAS, MÓDULOS & RESET LOCAL */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          {/* Instalação & Modo Local */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl shadow-2xs">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm font-black text-[var(--ink)]">Instalação e Modo Local (Offline)</h3>
                  <p className="text-xs text-[var(--ink)] font-semibold leading-relaxed max-w-2xl">
                    O Dimensio é <span className="text-[var(--primary)] font-black">100% local</span>: seus dados ficam salvos neste navegador (cache PWA) e funcionam sem internet.
                    O compartilhamento ou a sincronização online só acontece quando você conecta uma planilha compartilhada ou webhook — e sempre com a sua autorização.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-300 dark:border-emerald-800">
                      <WifiOff className="w-3 h-3" /> Funciona Offline (PWA)
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] text-[10px] font-black uppercase tracking-wider border border-[var(--primary)]/30">
                      <HardDriveDownload className="w-3 h-3" /> Dados no dispositivo
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-300 text-[10px] font-black uppercase tracking-wider border border-sky-300 dark:border-sky-800">
                      <CloudOff className="w-3 h-3" /> Sem servidor obrigatório
                    </span>
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                {isStandalone ? (
                  <div className="px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-black flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>App instalado neste dispositivo</span>
                  </div>
                ) : installPrompt ? (
                  <button
                    onClick={handleInstallClick}
                    className="px-5 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Instalar Aplicativo</span>
                  </button>
                ) : (
                  <div className="px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] text-xs font-bold flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[var(--muted)]" />
                    <span>Instale pelo navegador: “Adicionar à tela inicial”</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Central de Widgets & Menu Minimalista */}
          {(() => {
            const isWidgetsModuleEnabled = state.showWidgetsModule !== false && state.widgetsConfig?.enabled !== false;
            const activeDashboardWidgets = state.widgetsConfig?.dashboardWidgets || ['calendar', 'info_hub', 'stats', 'requests'];

            const toggleDashboardWidget = (id: string) => {
              if (!checkPermissionOrAlert()) return;
              const next = activeDashboardWidgets.includes(id)
                ? activeDashboardWidgets.filter((w) => w !== id)
                : [...activeDashboardWidgets, id];
              updateWidgetsConfig({ dashboardWidgets: next });
            };

            const toggleAllWidgetsModule = (enable: boolean) => {
              if (!checkPermissionOrAlert()) return;
              setModuleVisibility({ showWidgetsModule: enable });
            };

            return (
              <div className="bg-gradient-to-r from-[var(--paper)] to-[var(--primary-soft)] border-2 border-[var(--primary-border)] p-5 rounded-2xl space-y-4 shadow-2xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shadow-xs shrink-0 ${
                      isWidgetsModuleEnabled ? 'bg-[var(--primary)] text-white' : 'bg-slate-400 text-white'
                    }`}>
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-[var(--ink)]">
                          Central de Widgets & Menu Minimalista
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isWidgetsModuleEnabled
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                        }`}>
                          {isWidgetsModuleEnabled ? 'Módulo Ativo' : 'Módulo Desativado'}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--muted)] font-medium">
                        Ative ou desative widgets rápidos no Painel Inicial e oculte itens secundários do menu lateral para manter uma interface limpa e focada.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <label className="flex items-center gap-2 cursor-pointer bg-[var(--paper)] px-3 py-2 rounded-xl border border-[var(--line)] shadow-xs hover:border-[var(--primary)] transition-all">
                      <input
                        type="checkbox"
                        checked={isWidgetsModuleEnabled}
                        onChange={(e) => toggleAllWidgetsModule(e.target.checked)}
                        className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-[var(--ink)]">
                        {isWidgetsModuleEnabled ? 'Módulo Ligado' : 'Módulo Desligado'}
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => setIsWidgetsModalOpen(true)}
                      className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span>Abrir Central Completa</span>
                    </button>
                  </div>
                </div>

                {/* Granular Widget Toggles directly in Settings */}
                <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Widgets Rápidos Visíveis no Painel Inicial</span>
                    </div>
                    <span className="text-[11px] text-[var(--muted)] font-bold">
                      {isWidgetsModuleEnabled
                        ? `${activeDashboardWidgets.length} de 5 selecionado(s)`
                        : 'Módulo desativado'}
                    </span>
                  </div>

                  <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 transition-opacity ${
                    !isWidgetsModuleEnabled ? 'opacity-40 pointer-events-none' : ''
                  }`}>
                    {[
                      { id: 'calendar', label: 'Calendário & Escala', icon: Calendar },
                      { id: 'info_hub', label: 'Hub de Informações', icon: Info },
                      { id: 'stats', label: 'Panorama do Turno', icon: Activity },
                      { id: 'requests', label: 'Pedidos / Chamados', icon: Send },
                      { id: 'radio', label: 'Rádio PTT (Voz)', icon: Radio },
                    ].map((w) => {
                      const isActive = activeDashboardWidgets.includes(w.id);
                      const Icon = w.icon;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          disabled={!isWidgetsModuleEnabled}
                          onClick={() => toggleDashboardWidget(w.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            isActive
                              ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)] shadow-xs'
                              : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)] hover:border-[var(--line)]/80'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Icon className="w-4 h-4" />
                            {isActive ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--primary)]" />
                            ) : (
                              <span className="w-3 h-3 rounded-full border border-[var(--line)]" />
                            )}
                          </div>
                          <div className="text-xs font-bold leading-tight">{w.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl">
                    <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Status dos Widgets</div>
                    <div className={`text-sm font-black mt-0.5 ${isWidgetsModuleEnabled ? 'text-[var(--primary)]' : 'text-amber-600'}`}>
                      {isWidgetsModuleEnabled ? `${activeDashboardWidgets.length} ativo(s)` : 'Desativado'}
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl">
                    <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Itens Ocultos no Menu</div>
                    <div className="text-sm font-black text-amber-600 dark:text-amber-400 mt-0.5">
                      {(state.hiddenSidebarItems || []).length} item(ns)
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl">
                    <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Acesso Rápido</div>
                    <div className="text-xs font-bold text-[var(--ink)] mt-0.5">
                      {isWidgetsModuleEnabled ? 'Botão flutuante & Menu' : 'Oculto na barra flutuante'}
                    </div>
                  </div>
                  <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl">
                    <div className="text-[10px] font-bold text-[var(--muted)] uppercase">Preset Recomendado</div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Menu Minimalista
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Personalização da Navegação e Atalhos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Ordem dos itens do menu lateral */}
            <div className="bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-[var(--primary)]" />
                  <h3 className="text-xs font-black text-[var(--ink)]">Ordem do Menu Lateral</h3>
                </div>
                <button
                  onClick={() => {
                    if (!checkPermissionOrAlert()) return;
                    resetNavigationSettings();
                  }}
                  className="px-2.5 py-1 bg-[var(--bg)] hover:bg-[var(--paper)] border border-[var(--line)] text-[var(--ink)] text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Restaurar ordem e atalhos padrão"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar Padrão</span>
                </button>
              </div>

              <p className="text-[11px] text-[var(--ink)] font-semibold leading-relaxed">
                Defina a ordem dos itens no menu lateral usando as setas de reordenação.
              </p>

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {(() => {
                  const ALL_NAV_ITEMS = [
                    { id: 'presence', label: 'Presença de hoje', icon: CheckSquare, defaultShortcut: '1' },
                    { id: 'operator_portal', label: 'Portal do Operador', icon: Radio, defaultShortcut: 'P' },
                    { id: 'employee', label: 'Meu Painel', icon: UserCheck, defaultShortcut: 'M' },
                    { id: 'routines', label: 'Rotinas e Tarefas', icon: ListTodo, defaultShortcut: 'T' },
                    { id: 'assignment', label: 'Dimensionamento', icon: Shuffle, defaultShortcut: '2' },
                    { id: 'breaks', label: 'Intervalos', icon: Clock, defaultShortcut: '3' },
                    { id: 'share', label: 'Resumo / Compartilhar', icon: Share2, defaultShortcut: '4' },
                    { id: 'calendar', label: 'Calendário anual', icon: Calendar, defaultShortcut: '5' },
                    { id: 'team', label: 'Equipe e cadastros', icon: Users, defaultShortcut: '6' },
                    { id: 'info_hub', label: 'Hub de Informações', icon: Info, defaultShortcut: 'I' },
                    { id: 'briefing', label: 'Montagem de slide', icon: Presentation, defaultShortcut: '7' },
                    { id: 'requests', label: 'Pedidos de serviço', icon: Send, defaultShortcut: '8' },
                    { id: 'report', label: 'Relatório diário', icon: FileText, defaultShortcut: '9' },
                    { id: 'home', label: 'Visão geral', icon: Home, defaultShortcut: '0' },
                    { id: 'settings', label: 'Configurações', icon: Settings, defaultShortcut: 'S' },
                    { id: 'help', label: 'Ajuda', icon: HelpCircle, defaultShortcut: 'H' },
                  ];

                  const itemMap = new Map(ALL_NAV_ITEMS.map((item) => [item.id, item]));
                  const currentOrder = state.sidebarOrder && state.sidebarOrder.length > 0
                    ? state.sidebarOrder
                    : ALL_NAV_ITEMS.map((i) => i.id);

                  const orderedList: typeof ALL_NAV_ITEMS = [];
                  currentOrder.forEach((id) => {
                    const found = itemMap.get(id);
                    if (found) {
                      orderedList.push(found);
                      itemMap.delete(id);
                    }
                  });
                  itemMap.forEach((found) => orderedList.push(found));

                  const moveItem = (index: number, direction: 'up' | 'down') => {
                    if (!checkPermissionOrAlert()) return;
                    const newOrder = orderedList.map((item) => item.id);
                    const targetIndex = direction === 'up' ? index - 1 : index + 1;
                    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
                    const temp = newOrder[index];
                    newOrder[index] = newOrder[targetIndex];
                    newOrder[targetIndex] = temp;
                    setSidebarOrder(newOrder);
                  };

                  return orderedList.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-[10px] font-mono text-[var(--muted)] font-black w-4 text-right">
                            {idx + 1}
                          </span>
                          <Icon className="w-4 h-4 text-[var(--primary)] shrink-0" />
                          <span className="text-xs font-bold text-[var(--ink)] truncate">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            disabled={idx === 0}
                            onClick={() => moveItem(idx, 'up')}
                            className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink)] disabled:opacity-30 cursor-pointer transition-colors"
                            title="Mover para cima"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            disabled={idx === orderedList.length - 1}
                            onClick={() => moveItem(idx, 'down')}
                            className="p-1 rounded-lg hover:bg-[var(--paper)] text-[var(--ink)] disabled:opacity-30 cursor-pointer transition-colors"
                            title="Mover para baixo"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Personalização de atalhos do teclado */}
            <div className="bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-2.5">
                <div className="flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-[var(--primary)]" />
                  <h3 className="text-xs font-black text-[var(--ink)]">Atalhos do Teclado</h3>
                </div>
                <button
                  onClick={() => {
                    if (!checkPermissionOrAlert()) return;
                    setCustomShortcuts({});
                  }}
                  className="px-2.5 py-1 bg-[var(--bg)] hover:bg-[var(--paper)] border border-[var(--line)] text-[var(--ink)] text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Restaurar atalhos originais"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurar Atalhos</span>
                </button>
              </div>

              <p className="text-[11px] text-[var(--ink)] font-semibold leading-relaxed">
                Personalize os atalhos de teclado para navegação direta entre as páginas do sistema.
              </p>

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {(() => {
                  const ALL_NAV_ITEMS = [
                    { id: 'presence', label: 'Presença de hoje', icon: CheckSquare, defaultShortcut: '1' },
                    { id: 'operator_portal', label: 'Portal do Operador', icon: Radio, defaultShortcut: 'P' },
                    { id: 'employee', label: 'Meu Painel', icon: UserCheck, defaultShortcut: 'M' },
                    { id: 'routines', label: 'Rotinas e Tarefas', icon: ListTodo, defaultShortcut: 'T' },
                    { id: 'assignment', label: 'Dimensionamento', icon: Shuffle, defaultShortcut: '2' },
                    { id: 'breaks', label: 'Intervalos', icon: Clock, defaultShortcut: '3' },
                    { id: 'share', label: 'Resumo / Compartilhar', icon: Share2, defaultShortcut: '4' },
                    { id: 'calendar', label: 'Calendário anual', icon: Calendar, defaultShortcut: '5' },
                    { id: 'team', label: 'Equipe e cadastros', icon: Users, defaultShortcut: '6' },
                    { id: 'info_hub', label: 'Hub de Informações', icon: Info, defaultShortcut: 'I' },
                    { id: 'briefing', label: 'Montagem de slide', icon: Presentation, defaultShortcut: '7' },
                    { id: 'requests', label: 'Pedidos de serviço', icon: Send, defaultShortcut: '8' },
                    { id: 'report', label: 'Relatório diário', icon: FileText, defaultShortcut: '9' },
                    { id: 'home', label: 'Visão geral', icon: Home, defaultShortcut: '0' },
                    { id: 'settings', label: 'Configurações', icon: Settings, defaultShortcut: 'S' },
                    { id: 'help', label: 'Ajuda', icon: HelpCircle, defaultShortcut: 'H' },
                  ];

                  const customMap = state.customShortcuts || {};

                  return ALL_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const activeVal = customMap[item.id] !== undefined ? customMap[item.id] : item.defaultShortcut;

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className="w-4 h-4 text-[var(--primary)] shrink-0" />
                          <span className="text-xs font-bold text-[var(--ink)] truncate">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="text"
                            maxLength={2}
                            value={activeVal}
                            onChange={(e) => {
                              if (!checkPermissionOrAlert()) return;
                              const val = e.target.value.toUpperCase().trim();
                              setCustomShortcuts({
                                ...(state.customShortcuts || {}),
                                [item.id]: val,
                              });
                            }}
                            className="w-12 h-7 text-center font-mono text-xs font-black bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[var(--ink)] focus:border-[var(--primary)] focus:outline-none uppercase"
                            placeholder="—"
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          {/* Painéis compactos lado a lado */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Módulos Opcionais */}
            <div className="bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2.5">
                <SlidersHorizontal className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-xs font-black text-[var(--ink)]">Módulos Opcionais</h3>
              </div>
              <p className="text-[11px] text-[var(--ink)] font-semibold leading-relaxed">
                Controle quais módulos aparecem no menu lateral para evitar opções desnecessárias no seu setor.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showInfoHub !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Info className={`w-4 h-4 ${state.showInfoHub !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Hub de Informações</div>
                      <div className="text-[10px] font-medium opacity-80">Preenchimento rápido, atalhos & lembretes</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showInfoHub !== false}
                    onChange={(e) => setModuleVisibility({ showInfoHub: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showBriefingSlide !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Presentation className={`w-4 h-4 ${state.showBriefingSlide !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Montagem de Slide</div>
                      <div className="text-[10px] font-medium opacity-80">Passagens de turno e alinhamentos</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showBriefingSlide !== false}
                    onChange={(e) => setModuleVisibility({ showBriefingSlide: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showEmployeePortal !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <UserCheck className={`w-4 h-4 ${state.showEmployeePortal !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Meu Painel</div>
                      <div className="text-[10px] font-medium opacity-80">Painel do colaborador identificado</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showEmployeePortal !== false}
                    onChange={(e) => setModuleVisibility({ showEmployeePortal: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showOperatorPortal !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Box className={`w-4 h-4 ${state.showOperatorPortal !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Portal da Base</div>
                      <div className="text-[10px] font-medium opacity-80">Interface isolada para coletores e operadores</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showOperatorPortal !== false}
                    onChange={(e) => setModuleVisibility({ showOperatorPortal: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showRadioModule !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <Radio className={`w-4 h-4 ${state.showRadioModule !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Rádio Walkie-Talkie (Dimensio Talk)</div>
                      <div className="text-[10px] font-medium opacity-80">Comunicação PTT por voz em tempo real entre coletores e gestão</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showRadioModule !== false}
                    onChange={(e) => setModuleVisibility({ showRadioModule: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>

                <label className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  state.showWidgetsModule !== false && state.widgetsConfig?.enabled !== false
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                    : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <LayoutGrid className={`w-4 h-4 ${state.showWidgetsModule !== false && state.widgetsConfig?.enabled !== false ? 'text-[var(--primary)]' : 'text-slate-400'}`} />
                    <div>
                      <div className="text-xs font-extrabold">Central de Widgets Rápidos</div>
                      <div className="text-[10px] font-medium opacity-80">Cards contextuais no painel inicial e atalhos rápidos</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={state.showWidgetsModule !== false && state.widgetsConfig?.enabled !== false}
                    onChange={(e) => setModuleVisibility({ showWidgetsModule: e.target.checked })}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Ajuste de Tema Visual */}
            <div className="bg-[var(--paper)] border border-[var(--line)] p-4 rounded-2xl space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[var(--line)] pb-2.5">
                <Palette className="w-4 h-4 text-[var(--primary)]" />
                <h3 className="text-xs font-black text-[var(--ink)]">Ajuste de Tema Visual</h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {themeOptions.map((t) => {
                  const isSelected = state.theme === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      title={t.name}
                      className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[var(--primary)] shadow-2xs scale-105'
                          : 'border-[var(--line)] hover:border-slate-400'
                      }`}
                      style={{ backgroundColor: t.colorAccent }}
                    >
                      {isSelected && <Check className="w-4 h-4 text-white drop-shadow" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-[var(--muted)] font-semibold">
                Tema ativo:{' '}
                <span className="text-[var(--ink)] font-black">
                  {themeOptions.find((t) => t.id === state.theme)?.name || state.theme}
                </span>
              </p>
            </div>

            {/* Gestão de Limpeza e Reset Local */}
            <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 border-b border-red-200 dark:border-red-800 pb-2.5">
                <ShieldAlert className="w-4 h-4 text-red-700 dark:text-red-300" />
                <h3 className="text-xs font-black text-red-800 dark:text-red-100">Gestão de Limpeza e Reset Local</h3>
              </div>
              <p className="text-[11px] text-red-900 dark:text-red-200 font-semibold leading-relaxed">
                Remove os dados salvos neste navegador sem alterar a planilha online conectada ao Google Sheets.
              </p>
              <button
                onClick={() => setResetModalOpen(true)}
                className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>Limpar Dados Locais</span>
              </button>
            </div>
          </div>
        </div>
      )}

        </section>
      </div>

      <ConfirmModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={resetAllData}
        title="Limpar Dados Locais da Aplicação"
        description="Tem certeza de que deseja apagar os dados locais? Um backup automático será gerado antes da limpeza."
        confirmText="Limpar Dados Locais"
        requireKeyword="DELETAR"
      />

      <ConfirmModal
        isOpen={confirmCloudRestoreId !== null}
        onClose={() => setConfirmCloudRestoreId(null)}
        onConfirm={handleRestoreFromCloudBackup}
        title="Restaurar Backup da Nuvem"
        description="O estado atual deste navegador será substituído pelos dados deste backup da planilha. Um backup de segurança local será criado automaticamente antes da restauração. Após restaurar, use 'Enviar para a Planilha' para republicar os dados na planilha, se desejar."
        confirmText="Restaurar Backup"
      />

      <ConfirmImportBackupModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        importedData={pendingImportData}
        currentCollaboratorCount={state.collaborators.length}
        currentTeamName={state.teamName}
        onConfirmImport={handleConfirmImport}
      />

      <AppsScriptModal
        isOpen={showAppsScriptModal}
        onClose={() => setShowAppsScriptModal(false)}
      />
    </div>
  );
};
