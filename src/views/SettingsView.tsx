import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n';
import { ConfirmModal } from '../components/ConfirmModal';
import { IntegrationsSettingsPanel } from '../components/IntegrationsSettingsPanel';
import { ExtensionSettingsPanel } from '../components/ExtensionSettingsPanel';
import { SectorsSettingsPanel } from '../components/SectorsSettingsPanel';
import { PageHeader, Button } from '../components/ui';
import { DeveloperSettingsPanel } from './settings/DeveloperSettingsPanel';
import { AuditLogsSettingsPanel } from './settings/AuditLogsSettingsPanel';
import { EditorRolesSettingsPanel } from './settings/EditorRolesSettingsPanel';
import { CompanyManagersSettingsPanel } from './settings/CompanyManagersSettingsPanel';
import { BackupsSettingsPanel } from './settings/BackupsSettingsPanel';
import { PortalSettingsPanel } from './settings/PortalSettingsPanel';
import { GeneralSettingsPanel } from './settings/GeneralSettingsPanel';
import {
  Settings,
  Building2,
  Palette,
  FileSpreadsheet,
  Puzzle,
  ShieldCheck,
  History,
  Award,
  Users,
  Code2,
  Smartphone,
  KeyRound,
  Share2,
  Check,
  Zap,
  EyeOff,
} from 'lucide-react';
import { APP_VERSION, FULL_VERSION } from '../version';

export const SettingsView: React.FC = () => {
  const {
    state,
    showNotice,
    setOnlineSpreadsheetConfig,
    syncToOnlineSpreadsheet,
    forceRecreateCloudSpreadsheet,
    exportBackupToFile,
    importFullStateWithBackup,
    identifiedUser,
    deleteCurrentUserAccount,
    generateShareableConnectionLink,
    backupHistory,
  } = useApp();

  const { t } = useI18n();

  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);

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

  const [activeTab, setActiveTab] = useState<
    'general' | 'spreadsheet' | 'extension' | 'sectors' | 'portal_panel' | 'backups' | 'audit_logs' | 'editor_roles' | 'managers' | 'catalogs' | 'developer'
  >('spreadsheet');

  // Hidden developer mode (unlock by tapping the version chip 5 times)
  const [devMode, setDevMode] = useState(() => {
    try {
      return typeof window !== 'undefined' && localStorage.getItem('escalapro_dev_mode') === '1';
    } catch {
      return false;
    }
  });
  const [devClicks, setDevClicks] = useState(0);

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
    await syncToOnlineSpreadsheet(false);
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
        importFullStateWithBackup(json, 'full', true);
      } catch {
        showNotice('Arquivo JSON inválido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
            <button type="button" onClick={() => setActiveTab('managers')} className={navBtnCls('managers')}>
              <KeyRound className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>Gestores da Empresa</span>
              {(state.companyManagers || []).filter((m) => m.status === 'active').length > 0 && (
                <span className="ml-auto px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-black rounded-full">
                  {(state.companyManagers || []).filter((m) => m.status === 'active').length}
                </span>
              )}
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
              <span>Instalação, Idioma & Aparência</span>
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
                  const nextClicks = devClicks + 1;
                  if (nextClicks >= 5) {
                    setDevClicks(0);
                    setDevMode(true);
                    try {
                      localStorage.setItem('escalapro_dev_mode', '1');
                    } catch {
                      // ignore
                    }
                    showNotice('Opções de Desenvolvedor desbloqueadas!');
                  } else {
                    setDevClicks(nextClicks);
                  }
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
                    try {
                      localStorage.removeItem('escalapro_dev_mode');
                    } catch {
                      // ignore
                    }
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
        <BackupsSettingsPanel
          checkPermissionOrAlert={checkPermissionOrAlert}
          copiedShareLink={copiedShareLink}
          onCopyShareConnectionLink={handleCopyShareConnectionLink}
        />
      )}

      {/* TAB 3: HISTÓRICO DE ALTERAÇÕES (AUDIT LOGS) */}
      {activeTab === 'audit_logs' && (
        <AuditLogsSettingsPanel checkPermissionOrAlert={checkPermissionOrAlert} />
      )}

      {/* TAB 4: CARGOS EDITORES & PERMISSÕES */}
      {activeTab === 'editor_roles' && (
        <EditorRolesSettingsPanel checkPermissionOrAlert={checkPermissionOrAlert} />
      )}

      {/* TAB GESTORES DA EMPRESA (multi-donos, saída segura) */}
      {activeTab === 'managers' && (
        <CompanyManagersSettingsPanel checkPermissionOrAlert={checkPermissionOrAlert} />
      )}

      {/* TAB DEVELOPER: OPÇÕES DE DESENVOLVEDOR (menu oculto) */}
      {activeTab === 'developer' && (
        <DeveloperSettingsPanel checkPermissionOrAlert={checkPermissionOrAlert} />
      )}
      {/* TAB: PAINEL & PORTAL DA BASE (CONFIGURAÇÃO UNIFICADA + HELPDESK) */}
      {activeTab === 'portal_panel' && (
        <PortalSettingsPanel checkPermissionOrAlert={checkPermissionOrAlert} />
      )}

      {/* TAB 3: INSTALAÇÃO, APARÊNCIA, TEMAS, MÓDULOS & RESET LOCAL */}
      {activeTab === 'general' && (
        <GeneralSettingsPanel checkPermissionOrAlert={checkPermissionOrAlert} />
      )}

        </section>
      </div>

      <ConfirmModal
        isOpen={isDeleteAccountModalOpen}
        onClose={() => setIsDeleteAccountModalOpen(false)}
        onConfirm={async () => {
          setIsDeleteAccountModalOpen(false);
          await deleteCurrentUserAccount();
        }}
        title="Excluir Minha Conta e Credenciais"
        description="Tem certeza de que deseja excluir permanentemente sua conta de gestor do Firebase Authentication e seu perfil em nuvem? Esta ação não pode ser desfeita. Digite EXCLUIR para confirmar."
        confirmText="Excluir Permanentemente"
        requireKeyword="EXCLUIR"
      />
    </div>
  );
};
