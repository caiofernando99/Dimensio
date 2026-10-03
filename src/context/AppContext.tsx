import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppWidgetsConfig, AuditLogEntry, AutoAssignOptions, AutoBackupInfo, AutoBackupSettings, BackupSnapshot, BreakGenerationMode, BreakRotationInfo, BreakSlot, BriefingConfig, Collaborator, DeletedCollaborator, ExtensionConfig, FeedbackConfig, IdentifiedUser, InfoHubLink, InfoHubQuickFill, InfoHubReminder, MetricDefinition, MetricReading, NotificationPreferences, OnlineSpreadsheetConfig, PresenceSyncEvent, PresenceSyncRecord, ProcessKnowledge, RoleAccessLevel, RoutineRecurrence, ScaleType, ScheduledAbsence, ScheduledTask, ScheduledTaskList, SectorDefinition, ServiceRequest, ShiftCustomConfig, ShiftGroup, SystemNotification, Task, TaskAreaCount, TeamDefinition, ThemeOption, UserPersonalPreferences, UserProfileData, UserWorkStatus } from '../types';
import { pushStateToFirestore, subscribeToFirestoreState, fetchStateFromFirestoreOnce, saveUserProfileToFirestore, getUserProfileFromFirestore, subscribeToUserProfile, saveUserScratchpad as saveUserScratchpadToFirestore, updateUserWorkStatus as updateUserWorkStatusInFirestore } from '../lib/firestoreStorage';
import {
  auth,
  googleProvider,
  signInWithPopup,
  getAccessToken,
  emailSignIn,
  emailSignUp,
  resetPassword,
  signOut,
  onAuthStateChanged,
  User,
} from '../lib/firebase';
import { createCalendarEvent, deleteCalendarEvent, createGoogleTask, updateGoogleTaskStatus } from '../lib/workspace';
import { THEME_OPTIONS } from '../constants';
import { generateId, isScaleOff, getTodayISO, formatDateBR, getCollaboratorStatus, formatPersonName, applySuggestedScale6x2, isAbsenteeismStatus, getActiveAbsence, shuffleArray, calculateRotatingBreaks, BreakRotationExecutionResult, type StatusType } from '../utils/helpers';
import { initialAppState, DEFAULT_FIRESTORE_CONFIG } from '../utils/initialData';
import { SAMPLE_BACKUP_STATE } from '../data/sampleBackupData';
import { normalizeAppState } from '../utils/stateNormalizer';
import { playNotificationSound, triggerDeviceVibration } from '../utils/audioAlert';
import { showNativeOSNotification } from '../utils/notifications';
import { navigateTo, focusServiceRequest } from '../utils/navigation';
import { dispatchQuickFillsToExtension, dispatchExtensionConfig } from '../utils/extensionInstaller';
import { encodeConnectionParams, decodeConnectionParams } from '../utils/urlConnection';
import { executeAutoAssign } from '../utils/autoAssignEngine';
import { getRootTask } from '../utils/taskTreeHelpers';
import {
  SessionConfig,
  readSessionConfig,
  writeSessionConfig,
  applySessionStoragePolicy,
  getAppStorage,
  getSessionStorage,
} from '../utils/storagePolicy';

const STORAGE_KEY = 'people-scheduler-v3';
const AUTO_BACKUP_KEY = 'escalapro_auto_backup_v1';
const BACKUP_SNAPSHOTS_KEY = 'escalapro_backup_history_v2';
const IDENTIFIED_USER_KEY = 'escalapro_identified_user_v1';
const LAST_SYNCED_TIMESTAMP_KEY = 'escalapro_last_synced_timestamp_v1';

interface AppContextType {
  state: AppState;
  setDate: (date: string) => void;
  setYear: (year: number) => void;
  setTeamInfo: (info: { teamName?: string; sector?: string; manager?: string; teamShift?: string; location?: string; shifts?: string[]; scaleType?: ScaleType; scaleGroups?: string[]; shiftConfigs?: Record<string, ShiftCustomConfig> }) => void;
  updateShiftConfig: (shift: string, config: Partial<ShiftCustomConfig>) => void;
  updateTeamShift: (shift: string) => void;
  setSetupCompleted: (done: boolean) => void;
  applySuggestedScaleCalendar: (year: number) => void;
  isSetupWizardOpen: boolean;
  openSetupWizard: () => void;
  closeSetupWizard: () => void;
  setTheme: (theme: ThemeOption) => void;
  addCollaborator: (col?: Partial<Collaborator>) => void;
  updateCollaborator: (id: string, updates: Partial<Collaborator>) => void;
  bulkUpdateCollaborators: (ids: string[], updates: Partial<Collaborator>) => void;
  deleteCollaborator: (id: string) => void;
  restoreCollaborator: (deletedId: string) => void;
  permanentlyDeleteCollaborator: (deletedId: string) => void;
  clearTrashBin: () => void;
  addScheduledAbsence: (collaboratorId: string, absence: Omit<ScheduledAbsence, 'id'>) => void;
  removeScheduledAbsence: (collaboratorId: string, absenceId: string) => void;
  addTask: (taskDataOrName: string | (Partial<Task> & { name: string }), allowedRoles?: string[], allowedCategories?: string[], externalUrl?: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addBreakSlot: (time: string, capacity?: number, shift?: string) => void;
  updateBreakSlot: (id: string, updates: Partial<BreakSlot>) => void;
  deleteBreakSlot: (id: string) => void;
  addInterval: (collaboratorId: string, time: string) => void;
  markDayScale: (dateStr: string, scale: ShiftGroup | '') => void;
  toggleAttendance: (collaboratorId: string, present: boolean) => void;
  setAttendanceStatus: (collaboratorId: string, status: 'presente' | 'ausente' | 'atestado' | 'banco_horas' | 'falta_injustificada' | 'atraso') => void;
  setStatusReason: (collaboratorId: string, status: StatusType, reason: string) => void;
  resetAttendance: () => void;
  assignTask: (collaboratorId: string, taskId: string) => void;
  unassignTask: (collaboratorId: string) => void;
  clearAssignments: () => void;
  clearTaskAssignments: (taskId: string) => void;
  autoAssign: (options?: AutoAssignOptions) => void;
  undo: () => boolean;
  canUndo: boolean;
  moveBreakInterval: (collaboratorId: string, fromBreakId: string | null, toBreakId: string | null) => void;
  generateBreaks: (mode?: 'parent' | 'subtasks' | 'rotation') => void;
  generateRotatingBreaks: (options?: { referenceDate?: string; shift?: string }) => BreakRotationExecutionResult | null;
  breakRotationMap: Record<string, BreakRotationInfo>;
  clearBreaks: () => void;
  syncPresenceToApi: () => Promise<boolean>;
  importExternalPresenceList: (recordsOrText: PresenceSyncRecord[] | string, dateOverride?: string) => Promise<{ success: boolean; processed: number; errors?: string[] }>;
  exportPresenceList: (format?: 'json' | 'csv', dateOverride?: string) => void;
  fetchPresenceEvents: () => Promise<PresenceSyncEvent[]>;
  addCatalogItem: (key: 'roles' | 'categories' | 'skills', item: string) => void;
  removeCatalogItem: (key: 'roles' | 'categories' | 'skills', item: string) => void;
  editCatalogItem: (key: 'roles' | 'categories' | 'skills', oldItem: string, newItem: string) => void;
  setRoleType: (roleName: string, type: 'operacional' | 'administrativo') => void;
  setRolePermission: (roleName: string, level: RoleAccessLevel) => void;
  editTeamLeader: (oldName: string, newName: string, newShift?: string) => void;
  setSelectedGlobalFilters: (filters: { shift?: string; teamLeader?: string }) => void;
  setAbsenteeismPeriodDays: (days: number) => void;
  setModuleVisibility: (modules: { showBriefingSlide?: boolean; showEmployeePortal?: boolean; showOperatorPortal?: boolean; showInfoHub?: boolean; showRadioModule?: boolean; showWidgetsModule?: boolean }) => void;
  setPortalNameAbbreviation: (value: boolean) => void;
  setCustomShortcuts: (shortcuts: Record<string, string>) => void;
  setSidebarOrder: (order: string[]) => void;
  toggleSidebarItemHidden: (itemId: string) => void;
  setHiddenSidebarItems: (items: string[]) => void;
  updateWidgetsConfig: (config: Partial<AppWidgetsConfig>) => void;
  isWidgetsModalOpen: boolean;
  setIsWidgetsModalOpen: (open: boolean) => void;
  resetNavigationSettings: () => void;
  setSkillLevel: (collaboratorId: string, skill: string, level: number) => void;
  bulkSetSkillLevel: (collaboratorIds: string[], skill: string, level: number) => void;
  addCollabNote: (collaboratorId: string, text: string) => void;
  removeCollabNote: (collaboratorId: string, noteId: string) => void;
  setAbsenceReason: (collaboratorId: string, reason: string) => void;
  setOccurrence: (collaboratorId: string, text: string) => void;
  setGeneralNotes: (notes: string) => void;
  saveDailyReport: () => void;
  deleteDailyReport: (dateKey: string) => void;
  saveHistory: () => void;
  importFullState: (newState: Partial<AppState>) => void;
  importFullStateWithBackup: (newState: Partial<AppState>, mode?: 'full' | 'config_only', createSafetyBackup?: boolean) => void;
  importRosterRows: (rows: any[], options?: { replaceAll?: boolean; formatNames?: boolean }) => number;
  resetAllData: () => void;
  clearSampleData: () => void;
  loadSampleBackupData: () => void;
  downloadSampleBackupFile: () => void;
  lastAutoBackupInfo: AutoBackupInfo | null;
  backupHistory: BackupSnapshot[];
  createAutoBackup: (reason?: string, targetState?: AppState) => AutoBackupInfo | null;
  restoreFromAutoBackup: () => boolean;
  restoreBackupById: (backupId: string) => boolean;
  deleteBackupById: (backupId: string) => void;
  clearBackupHistory: () => void;
  exportBackupToFile: (snapshot?: BackupSnapshot) => void;
  generateShareableConnectionLink: () => string;
  disconnectOnlineSpreadsheet: () => void;
  noticeMessage: string | null;
  noticeType?: 'success' | 'sync' | 'info';
  noticeActionLabel?: string | null;
  onNoticeAction?: (() => void) | null;
  showNotice: (msg: string, actionLabel?: string, onAction?: () => void, noticeType?: 'success' | 'sync' | 'info') => void;
  addTeamLeader: (name: string, shift?: string, leaderName?: string) => void;
  removeTeamLeader: (name: string) => void;
  setOnlineSpreadsheetConfig: (config: OnlineSpreadsheetConfig | null, forcePull?: boolean) => void;
  syncToOnlineSpreadsheet: (isAutoSync?: boolean) => Promise<boolean>;
  fetchFromOnlineSpreadsheet: (isSilent?: boolean) => Promise<boolean>;
  forceRecreateCloudSpreadsheet: (webhookUrl?: string, sheetUrl?: string, sheetName?: string) => Promise<boolean>;
  testWebhookConnection: (url?: string) => Promise<{ success: boolean; message: string; details?: string }>;
  exportLocalSpreadsheet: () => void;
  exportTeamRosterSpreadsheet: () => void;
  generateTemplateSpreadsheet: () => void;
  addProcessKnowledge: (item: Omit<ProcessKnowledge, 'id'>) => void;
  updateProcessKnowledge: (id: string, updates: Partial<ProcessKnowledge>) => void;
  deleteProcessKnowledge: (id: string) => void;
  updateBriefingConfig: (updates: Partial<BriefingConfig>) => void;
  updateFeedbackConfig: (updates: Partial<FeedbackConfig>) => void;
  updateExtensionConfig: (updates: Partial<ExtensionConfig>) => void;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Identification & Editor Roles
  identifiedUser: IdentifiedUser | null;
  identifyUser: (collaboratorIdOrAdmin: string, passwordInput?: string) => { success: boolean; message: string };
  logoutUser: () => void;
  setUserPassword: (collaboratorId: string, passwordInput: string) => void;
  setRequireUserPassword: (required: boolean) => void;
  requestPasswordReset: (collaboratorId: string) => { success: boolean; message: string };
  authorizePasswordReset: (notificationId: string) => void;
  toggleEditorRole: (roleName: string) => void;

  // Sessão & Segurança do dispositivo
  sessionConfig: SessionConfig;
  setSessionConfig: (patch: Partial<SessionConfig>) => void;
  cloudOnline: boolean;
  isConnectionBlocked: () => boolean;

  // Auto Backup & Audit Log
  updateAutoBackupSettings: (settings: Partial<AutoBackupSettings>) => void;
  addAuditLog: (actionType: AuditLogEntry['actionType'], description: string, dateStr?: string, details?: any, includeSnapshot?: boolean) => void;
  restoreFromAuditLog: (logId: string) => boolean;
  clearAuditLogs: () => void;

  // Notifications
  addNotification: (notification: Omit<SystemNotification, 'id' | 'createdAt' | 'read'>) => void;
  broadcastNotice: (opts: {
    title: string;
    message: string;
    targetShift?: string;
    targetShiftAudience?: 'atual' | 'proximo' | 'proximos' | 'todos';
    type?: 'notice' | 'request' | 'system';
  }) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  deleteNotification: (id: string, scope?: 'self' | 'global') => void;
  clearAllNotifications: (filter?: 'read_only' | 'all', scope?: 'self' | 'global') => void;
  isNotificationForCurrentUser: (notification: SystemNotification, showOwnSent?: boolean, contextUserId?: string) => boolean;
  getUnreadNotificationsCount: (contextUserId?: string) => number;
  notifSoundEnabled: boolean;
  notifPopupEnabled: boolean;
  setNotifSoundEnabled: (enabled: boolean) => void;
  setNotifPopupEnabled: (enabled: boolean) => void;
  notificationPreferences: NotificationPreferences;
  setNotificationPreferences: (prefs: NotificationPreferences | ((prev: NotificationPreferences) => NotificationPreferences)) => void;

  // Pedidos e Avisos (Service Requests)
  createServiceRequest: (request: Omit<ServiceRequest, 'id' | 'createdAt' | 'status' | 'requesterId' | 'requesterName' | 'requesterRole'>) => { success: boolean; message: string };
  updateServiceRequest: (id: string, updates: Partial<ServiceRequest>) => { success: boolean; message: string };
  markRequestAsRead: (id: string) => void;
  markRequestAsCompleted: (id: string) => void;
  deleteServiceRequest: (id: string) => { success: boolean; message: string };
  updateTaskExternalUrl: (taskId: string, url: string) => void;

  // Hub de Informações
  addInfoHubReminder: (reminder: Omit<InfoHubReminder, 'id' | 'createdAt'>) => void;
  updateInfoHubReminder: (id: string, updates: Partial<InfoHubReminder>) => { success: boolean; message: string };
  deleteInfoHubReminder: (id: string) => void;
  addInfoHubLink: (link: Omit<InfoHubLink, 'id'>) => void;
  updateInfoHubLink: (id: string, updates: Partial<InfoHubLink>) => void;
  deleteInfoHubLink: (id: string) => void;
  addInfoHubQuickFill: (item: Omit<InfoHubQuickFill, 'id'>) => void;
  updateInfoHubQuickFill: (id: string, updates: Partial<InfoHubQuickFill>) => void;
  deleteInfoHubQuickFill: (id: string) => void;

  // Métricas (coleta de indicadores via extensão)
  addMetricDefinition: (def: Omit<MetricDefinition, 'id' | 'createdAt'>) => void;
  updateMetricDefinition: (id: string, updates: Partial<MetricDefinition>) => void;
  deleteMetricDefinition: (id: string) => void;
  addMetricReading: (reading: Omit<MetricReading, 'id' | 'capturedAt'>) => void;
  deleteMetricReading: (id: string) => void;
  getTaskAreaCounts: () => import('../types').TaskAreaCount[];
  ensureTaskCountMetric: (taskId: string, kind?: 'pending' | 'processing') => { created: boolean; metricId: string } | null;

  // Support Messages & Helpdesk
  addSupportMessage: (msg: {
    codeText?: string;
    imageUrl?: string;
    supportType?: string;
    priority?: 'baixa' | 'media' | 'alta' | 'urgente';
    taskId?: string;
    taskName?: string;
    channelId?: string;
    senderOverride?: { id: string; name: string; role?: string; shift?: string; category?: string };
    fields?: Array<{ id: string; label: string; value: string; key?: string }>;
  }) => void;
  acceptSupportMessage: (id: string, staffUser?: { id: string; name: string; role?: string }) => void;
  resolveSupportMessage: (id: string, resolutionNotes?: string) => void;
  returnSupportMessageToQueue: (id: string) => void;
  cancelSupportMessage: (id: string, reason?: string) => void;
  updateSupportMessageStatus: (id: string, status: 'enviado' | 'em_atendimento' | 'resolvido' | 'cancelado') => void;
  deleteSupportMessage: (id: string) => void;
  updateHelpdeskConfig: (updates: Partial<import('../types').HelpdeskConfig>) => void;
  updatePortalNotificationConfig: (updates: Partial<import('../types').PortalNotificationConfig>) => void;
  updateShareCustomConfig: (updates: Partial<import('../types').ShareCustomConfig>) => void;
  updateShareFilters: (updates: Partial<import('../types').ShareFilterConfig>) => void;
  updateReportExportConfig: (updates: Partial<import('../types').ReportExportConfig>) => void;
  updatePortalConfig: (updates: Partial<import('../types').PortalPresetConfig>) => void;

  // Programação e Rotinas de Tarefas (Módulo Robusto / Google Tasks + Notion)
  addScheduledTask: (task: Omit<ScheduledTask, 'id' | 'createdAt'> & { id?: string }) => ScheduledTask;
  updateScheduledTask: (id: string, updates: Partial<ScheduledTask>) => void;
  deleteScheduledTask: (id: string) => void;
  toggleScheduledTaskComplete: (id: string, completed?: boolean, performer?: { id?: string; name?: string }) => void;
  toggleScheduledSubtaskComplete: (taskId: string, subtaskId: string, completed?: boolean, performer?: { id?: string; name?: string }) => void;
  addScheduledTaskList: (list: Omit<ScheduledTaskList, 'id'> & { id?: string }) => ScheduledTaskList;
  updateScheduledTaskList: (id: string, updates: Partial<ScheduledTaskList>) => void;
  deleteScheduledTaskList: (id: string) => void;
  reorderScheduledTasks: (tasks: ScheduledTask[]) => void;
  syncTaskToGoogleCalendar: (taskId: string) => Promise<{ success: boolean; message: string; eventId?: string }>;
  syncTaskToGoogleTasks: (taskId: string) => Promise<{ success: boolean; message: string; taskId?: string }>;
  syncTasksToGoogleWorkspace: (taskIds: string[]) => Promise<{ success: boolean; message: string; count: number }>;

  // Visão hierárquica: gerencial (ocultar subtarefas) x detalhada (exibir subtarefas)
  showSubtasks: boolean;
  setShowSubtasks: (show: boolean) => void;

  // Sessão Personalizada & Perfil em Nuvem no Firebase
  userProfile: UserProfileData | null;
  saveUserProfile: (patch: Partial<UserProfileData>) => Promise<void>;
  setUserWorkStatus: (status: UserWorkStatus, customMessage?: string) => Promise<void>;
  saveUserScratchpad: (text: string) => Promise<void>;
  firebaseUser: User | null;
  isAuthLoading: boolean;
  signInWithGoogleAuth: () => Promise<{ success: boolean; message: string }>;
  signInWithEmailAuth: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  signUpWithEmailAuth: (email: string, pass: string, displayName?: string, companyName?: string) => Promise<{ success: boolean; message: string }>;
  sendPasswordResetEmailAuth: (email: string) => Promise<{ success: boolean; message: string }>;
  signOutAuth: () => Promise<void>;
  registerCompanyWorkspace: (companyName: string, sector?: string, location?: string) => Promise<void>;
  isFirestoreActive: boolean;
  linkCollaboratorWithAuth: (collaboratorId: string) => Promise<{ success: boolean; message: string }>;

  // Gestão Multissetorial e Conexão Intersetorial
  addRegisteredSector: (sectorName: string) => void;
  removeRegisteredSector: (sectorName: string) => void;
  addSectorDefinition: (sector: Omit<SectorDefinition, 'id' | 'createdAt'> & { id?: string }) => void;
  updateSectorDefinition: (id: string, updates: Partial<SectorDefinition>) => void;
  deleteSectorDefinition: (id: string) => void;
  switchActiveSector: (sectorName: string) => void;
  setUserSector: (sectorName: string) => Promise<void>;
  setCanProvideCrossSectorSupport: (canProvide: boolean) => Promise<void>;
  setAllowedSectors: (sectors: string[]) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const tabId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const isRemoteOrBroadcastUpdate = useRef<boolean>(false);
  const lastLocalEditTime = useRef<number>(0);
  const lastSyncedTimestampMs = useRef<number>((() => {
    try {
      const saved = localStorage.getItem(LAST_SYNCED_TIMESTAMP_KEY);
      if (saved) return Number(saved) || 0;
    } catch {
      // Ignore
    }
    return 0;
  })());
  const isConnectingRef = useRef<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);
  const liveBcRef = useRef<BroadcastChannel | null>(null);
  const lastCloudBackupAttemptAt = useRef<number>(0);
  const lastRemoteCollaboratorCount = useRef<number>(0);
  const notificationsRef = useRef<SystemNotification[]>([]);
  const seenNotificationIds = useRef<Set<string>>(new Set());
  const lastRemoteFetchAt = useRef<number>(0);
  const consecutiveFailuresRef = useRef<number>(0);
  // true when a GET/POST reached the server successfully this session (used by the
  // session bootstrap to decide if it is safe to push local data up).
  const lastFetchReachedServer = useRef<boolean>(false);
  const warnedRemoteOlder = useRef<boolean>(false);
  const didRunSessionBootstrap = useRef<boolean>(false);

  const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  /**
   * Appends spreadsheet URL/ID (+ extra params) to an Apps Script webhook URL so
   * the doGet can locate the correct spreadsheet even for standalone web app
   * deployments (not bound to the sheet). Without these params the script falls
   * back to an empty-payload lookup and reports "empty" even when the sheet has data.
   */
  const buildWebhookUrl = (
    webhookUrl: string,
    config: OnlineSpreadsheetConfig | null | undefined,
    extra: Record<string, string> = {}
  ): string => {
    let getUrl = webhookUrl;
    try {
      const u = new URL(webhookUrl);
      if (config?.url) {
        u.searchParams.set('spreadsheetUrl', config.url);
        const m = config.url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (m) u.searchParams.set('spreadsheetId', m[1]);
      }
      for (const [k, v] of Object.entries(extra)) {
        if (v) u.searchParams.set(k, v);
      }
      getUrl = u.toString();
    } catch {
      // Invalid URL - keep original (the fetch below surfaces the error).
    }
    return getUrl;
  };

  /** Normalizes any legacy/nested remote-state shapes into the app state object. */
  const normalizeRemoteState = (candidate: any): any => {
    if (!candidate) return null;
    return normalizeAppState(candidate, stateRef.current || state);
  };

  /**
   * Recovery path: the webhook GET reported "empty", but the cloud spreadsheet
   * may still contain snapshots (aba __BACKUP__ / __BACKUP_DAILY__). Pull the
   * most recent real snapshot and apply it locally, so a shared connection link
   * never wrongly shows an empty roster while the spreadsheet has data.
   */
  const fetchLatestCloudBackup = async (
    config: OnlineSpreadsheetConfig | null | undefined,
    isSilent = false
  ): Promise<boolean> => {
    const currentConfig = config || null;
    if (!currentConfig?.webhookUrl) return false;

    // Throttle: only probe the cloud snapshots at most once every 30s, otherwise
    // the background poller would re-run this recovery (list + fetch) every second
    // while the sheet remains unreachable, burning Apps Script quota.
    const nowMs = Date.now();
    if (nowMs - lastCloudBackupAttemptAt.current < 30000) return false;
    lastCloudBackupAttemptAt.current = nowMs;

    try {
      // 1. List snapshots stored on the cloud spreadsheet.
      const listUrl = buildWebhookUrl(currentConfig.webhookUrl.trim(), currentConfig, { mode: 'backups' });
      let listRes: Response | null = null;
      try {
        listRes = await fetchWithTimeout(listUrl, { method: 'GET' }, 12000);
      } catch {
        return false;
      }
      if (!listRes || !listRes.ok) return false;
      const listData = await listRes.json().catch(() => null);
      const backups: any[] = Array.isArray(listData?.backups) ? listData.backups : [];
      if (backups.length === 0) return false;

      // 2. Prefer the most recent snapshots that actually carry collaborators.
      const withData = backups
        .filter((b: any) => Number(b?.collaboratorCount) > 0)
        .sort((a: any, b: any) => String(b?.timestamp || '').localeCompare(String(a?.timestamp || '')));
      if (withData.length === 0) return false;

      // 3. Try the newest few until a usable real (non-sample) state is found.
      for (const snapshot of withData.slice(0, 5)) {
        const itemUrl = buildWebhookUrl(currentConfig.webhookUrl, currentConfig, {
          mode: 'backup',
          id: String(snapshot?.id ?? ''),
        });
        let itemRes: Response | null = null;
        try {
          itemRes = await fetchWithTimeout(itemUrl, { method: 'GET' }, 12000);
        } catch {
          continue;
        }
        if (!itemRes || !itemRes.ok) continue;
        const itemData = await itemRes.json().catch(() => null);
        if (!itemData || typeof itemData !== 'object') continue;
        const remoteState = normalizeRemoteState(itemData.state || itemData.stateRaw || itemData.rawState || itemData);
        if (!remoteState || !Array.isArray(remoteState.collaborators) || remoteState.collaborators.length === 0) continue;

        const backupUpdatedAtMs = Number(remoteState.updatedAtMs) || Number(itemData.timestamp) || 0;
        // CRITICAL SAFETY: nunca aplicar um backup em nuvem que seja mais antigo
        // (ou de idade desconhecida) que os dados locais — isso apagaria edições
        // locais recentes que ainda não foram publicadas. Só aplica se for
        // estritamente mais novo; caso contrário tenta o próximo snapshot.
        const applied = applyRemoteToLocal(remoteState, backupUpdatedAtMs);
        if (!applied) continue;
        if (!isSilent) {
          showNotice(
            `A planilha estava indisponível em tempo real, mas os dados foram recuperados do backup em nuvem mais recente (${remoteState.collaborators.length} colaboradores). Tudo sincronizado!`,
            undefined,
            undefined,
            'sync'
          );
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

    // Sessão: política de armazenamento + segurança do dispositivo (definida antes
  // do estado para que a inicialização leia do armazenamento correto).
  const [sessionConfig, setSessionConfigState] = useState<SessionConfig>(() => {
    const cfg = readSessionConfig();
    applySessionStoragePolicy(cfg);
    return cfg;
  });
  const sessionConfigRef = useRef<SessionConfig>(sessionConfig);
  useEffect(() => {
    sessionConfigRef.current = sessionConfig;
  }, [sessionConfig]);

  const setSessionConfig = (patch: Partial<SessionConfig>) => {
    setSessionConfigState((prev) => {
      const next = { ...prev, ...patch };
      applySessionStoragePolicy(next);
      writeSessionConfig(next);
      return next;
    });
  };

  // Conexão com a nuvem em tempo real (usada pelo "modo sempre conectado").
  const cloudOnlineRef = useRef<boolean>(true);
  const [cloudOnline, setCloudOnlineState] = useState<boolean>(true);
  const setCloudOnline = (online: boolean) => {
    cloudOnlineRef.current = online;
    setCloudOnlineState(online);
  };
  const isConnectionBlocked = (): boolean => {
    const cfg = sessionConfigRef.current;
    if (!cfg.alwaysOnline) return false;
    const connected = Boolean(stateRef.current?.onlineSpreadsheet?.webhookUrl);
    return !connected || !cloudOnlineRef.current;
  };

  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = getAppStorage().getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed.isSampleData ||
          parsed.teamName === 'Centro de Distribuição Cajamar' ||
          parsed.teamName === 'Operação Logística Multissetorial'
        ) {
          getAppStorage().removeItem(STORAGE_KEY);
          return {
            ...initialAppState,
            updatedAtMs: Date.now(),
            isSampleData: false,
          };
        }
        const normalized = normalizeAppState(parsed, initialAppState);
        return {
          ...normalized,
          selectedDate: getTodayISO(),
          updatedAtMs: parsed.updatedAtMs || Date.now(),
        };
      }
    } catch {
      // Fallback
    }
    const formattedInitialCols = initialAppState.collaborators.map((c) => ({
      ...c,
      name: formatPersonName(c.name),
    }));
    return {
      ...initialAppState,
      updatedAtMs: Date.now(),
      collaborators: formattedInitialCols,
      isSampleData: false,
    };
  });

  const stateRef = useRef<AppState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
  const openSetupWizard = () => setIsSetupWizardOpen(true);
  const closeSetupWizard = () => setIsSetupWizardOpen(false);

  const [isWidgetsModalOpen, setIsWidgetsModalOpen] = useState(false);

  const [noticeState, setNoticeState] = useState<{
    message: string | null;
    noticeType?: 'success' | 'sync' | 'info';
    actionLabel?: string | null;
    onAction?: (() => void) | null;
  }>({ message: null, noticeType: 'success' });

  const [backupHistory, setBackupHistory] = useState<BackupSnapshot[]>(() => {
    try {
      const raw = getAppStorage().getItem(BACKUP_SNAPSHOTS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Fallback
    }
    return [];
  });

  const [lastAutoBackupInfo, setLastAutoBackupInfo] = useState<AutoBackupInfo | null>(() => {
    try {
      const raw = getAppStorage().getItem(AUTO_BACKUP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          id: parsed.id,
          timestamp: parsed.timestamp || '',
          formattedDate: parsed.formattedDate || '',
          reason: parsed.reason || 'Backup Automático',
          collaboratorCount: parsed.state?.collaborators?.length || 0,
          taskCount: parsed.state?.tasks?.length || 0,
          teamName: parsed.state?.teamName || 'Equipe',
        };
      }
    } catch {
      // Fallback
    }
    return null;
  });

  // Identified User state — SEMPRE por sessão (sessionStorage): a identidade
  // nunca persiste entre sessões, impedindo que outra pessoa use a conta de
  // alguém em seguida.
  const [identifiedUser, setIdentifiedUser] = useState<IdentifiedUser | null>(() => {
    try {
      const saved = getSessionStorage().getItem(IDENTIFIED_USER_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // Fallback
    }
    return null;
  });

  useEffect(() => {
    try {
      if (identifiedUser) {
        getSessionStorage().setItem(IDENTIFIED_USER_KEY, JSON.stringify(identifiedUser));
      } else {
        getSessionStorage().removeItem(IDENTIFIED_USER_KEY);
      }
    } catch {
      // ignore
    }
  }, [identifiedUser]);

  // Firebase Auth State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Monitor Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // User Profile State (sincronizado em tempo real com o Firestore)
  const [userProfile, setUserProfile] = useState<UserProfileData | null>(null);

  // Subscribe to real-time User Profile in Firestore whenever identifiedUser changes
  useEffect(() => {
    if (!identifiedUser) {
      setUserProfile((prev) => (prev === null ? prev : null));
      return;
    }

    const uid = identifiedUser.firebaseUid || identifiedUser.id || identifiedUser.collaboratorId;
    if (!uid) return;

    const unsubscribe = subscribeToUserProfile(uid, (profile) => {
      if (profile) {
        setUserProfile(profile);
        // Synchronize workStatus, photoUrl, isSupportAttendant and message back to identifiedUser if changed
        setIdentifiedUser((prev) => {
          if (!prev) return null;
          let changed = false;
          const next = { ...prev };
          if (profile.photoUrl && profile.photoUrl !== prev.photoUrl) {
            next.photoUrl = profile.photoUrl;
            changed = true;
          }
          if (profile.workStatus && profile.workStatus !== prev.workStatus) {
            next.workStatus = profile.workStatus;
            changed = true;
          }
          if (profile.statusCustomMessage !== undefined && profile.statusCustomMessage !== prev.statusCustomMessage) {
            next.statusCustomMessage = profile.statusCustomMessage;
            changed = true;
          }
          if (profile.isSupportAttendant !== undefined && profile.isSupportAttendant !== prev.isSupportAttendant) {
            next.isSupportAttendant = profile.isSupportAttendant;
            changed = true;
          }
          return changed ? next : prev;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [identifiedUser?.id, identifiedUser?.firebaseUid, identifiedUser?.collaboratorId]);

  // Break Rotation Map State
  const [breakRotationMap, setBreakRotationMap] = useState<Record<string, BreakRotationInfo>>({});

  // Notification Sound & Popup Preferences
  const NOTIF_SOUND_KEY = 'escalapro_notif_sound_v1';
  const NOTIF_POPUP_KEY = 'escalapro_notif_popup_v1';

  const [notifSoundEnabled, setNotifSoundEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_SOUND_KEY);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [notifPopupEnabled, setNotifPopupEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_POPUP_KEY);
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const setNotifSoundEnabled = (enabled: boolean) => {
    setNotifSoundEnabledState(enabled);
    try {
      localStorage.setItem(NOTIF_SOUND_KEY, String(enabled));
    } catch {
      // ignore
    }
  };

  const setNotifPopupEnabled = (enabled: boolean) => {
    setNotifPopupEnabledState(enabled);
    try {
      localStorage.setItem(NOTIF_POPUP_KEY, String(enabled));
    } catch {
      // ignore
    }
  };

  const NOTIF_PREFERENCES_KEY = 'escalapro_notif_preferences_v2';

  const [notificationPreferences, setNotificationPreferencesState] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem(NOTIF_PREFERENCES_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      enabledTypes: {
        request: true,
        notice: true,
        password_reset: true,
        system: true,
      },
      filterByRoleMode: 'my_role_only',
      enabledRoles: [],
    };
  });

  const setNotificationPreferences = (
    prefs: NotificationPreferences | ((prev: NotificationPreferences) => NotificationPreferences)
  ) => {
    setNotificationPreferencesState((prev) => {
      const updated = typeof prefs === 'function' ? prefs(prev) : prefs;
      try {
        localStorage.setItem(NOTIF_PREFERENCES_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const undoStackRef = useRef<AppState[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  // Visão hierárquica: por padrão exibe subtarefas (detalhada); ocultar = visão gerencial
  const [showSubtasks, setShowSubtasks] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dimensio_show_subtasks');
      return saved === null ? true : saved !== 'false';
    } catch {
      return true;
    }
  });
  const setShowSubtasksPersisted = (show: boolean) => {
    setShowSubtasks(show);
    try {
      localStorage.setItem('dimensio_show_subtasks', String(show));
    } catch {}
  };

  const pushUndo = (prevState: AppState) => {
    undoStackRef.current.push(prevState);
    if (undoStackRef.current.length > 40) {
      undoStackRef.current.shift();
    }
    setCanUndo(true);
  };

  const showNotice = useCallback((
    msg: string,
    actionLabel?: string | null,
    onAction?: (() => void) | null,
    noticeType: 'success' | 'sync' | 'info' = 'success'
  ) => {
    setNoticeState({ message: msg, actionLabel, onAction, noticeType });
    setTimeout(() => {
      setNoticeState((prev) => (prev.message === msg ? { message: null } : prev));
    }, 7000);
  }, []);

  // Helper for applying local mutations cleanly with timestamp update
  const updateLocalState = (updater: (prev: AppState) => AppState) => {
    // MODO SEMPRE CONECTADO: com a conexão indisponível (ou sem planilha
    // conectada), NENHUMA alteração é permitida — evita divergência entre o
    // local e o online e previne sobrescritas acidentais. O app fica somente
    // leitura até reconectar.
    if (isConnectionBlocked()) {
      showNotice(
        'Modo sempre conectado: a conexão com a nuvem está indisponível. As alterações estão bloqueadas até reconectar.',
        undefined,
        undefined,
        'sync'
      );
      return;
    }
    lastLocalEditTime.current = Date.now();
    isRemoteOrBroadcastUpdate.current = false;
    setState((prev) => {
      pushUndo(prev);
      const next = updater(prev);
      const nowMs = Date.now();
      const nextState = {
        ...next,
        updatedAtMs: nowMs,
      };
      stateRef.current = nextState;
      try {
        window.dispatchEvent(new CustomEvent('dimensio-state-changed', { detail: { updatedAtMs: nowMs } }));
      } catch {}
      return nextState;
    });
  };

  useEffect(() => {
    notificationsRef.current = state.notifications || [];
  }, [state.notifications]);

  const undo = (): boolean => {
    if (undoStackRef.current.length === 0) {
      showNotice('Nenhuma ação recente para desfazer.');
      setCanUndo(false);
      return false;
    }
    const previous = undoStackRef.current.pop()!;
    lastLocalEditTime.current = Date.now();
    isRemoteOrBroadcastUpdate.current = false;
    setState({
      ...previous,
      updatedAtMs: Date.now(),
    });
    setCanUndo(undoStackRef.current.length > 0);
    showNotice('Ação desfeita com sucesso! (Ctrl+Z)');
    return true;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        const activeEl = document.activeElement;
        if (
          activeEl &&
          (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)
        ) {
          return;
        }
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const createAutoBackup = (
    reason: string = 'Backup de Segurança',
    targetState?: AppState
  ): AutoBackupInfo | null => {
    try {
      const now = new Date();
      const formattedDate = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      const snapshotState = targetState || state;
      const snapshotId = generateId();

      const newSnapshot: BackupSnapshot = {
        id: snapshotId,
        timestamp: now.toISOString(),
        formattedDate,
        reason,
        collaboratorCount: snapshotState.collaborators?.length || 0,
        taskCount: snapshotState.tasks?.length || 0,
        teamName: snapshotState.teamName || 'Equipe',
        state: snapshotState,
      };

      try {
        getAppStorage().setItem(AUTO_BACKUP_KEY, JSON.stringify(newSnapshot));
      } catch (e) {
        console.warn('Storage full for single backup:', e);
      }

      setBackupHistory((prev) => {
        const updated = [newSnapshot, ...prev.filter((s) => s.id !== newSnapshot.id)].slice(0, 15);
        try {
          getAppStorage().setItem(BACKUP_SNAPSHOTS_KEY, JSON.stringify(updated));
        } catch (err) {
          console.warn('Could not save full history to the active storage:', err);
        }
        return updated;
      });

      const info: AutoBackupInfo = {
        id: snapshotId,
        timestamp: now.toISOString(),
        formattedDate,
        reason,
        collaboratorCount: snapshotState.collaborators?.length || 0,
        taskCount: snapshotState.tasks?.length || 0,
        teamName: snapshotState.teamName,
      };

      setLastAutoBackupInfo(info);
      return info;
    } catch (e) {
      console.error('Erro ao criar backup automático:', e);
      return null;
    }
  };

  const restoreFromAutoBackup = (): boolean => {
    try {
      const raw = getAppStorage().getItem(AUTO_BACKUP_KEY);
      if (!raw) {
        showNotice('Nenhum backup automático disponível para restauração.');
        return false;
      }
      const parsed = JSON.parse(raw);
      if (parsed && parsed.state) {
        createAutoBackup('Backup de Segurança Antes de Restaurar');
        setState(parsed.state);
        showNotice(`Dados restaurados com sucesso do backup automático de ${parsed.formattedDate || 'data anterior'}!`);
        return true;
      }
    } catch (e) {
      console.error('Erro ao restaurar do backup automático:', e);
      showNotice('Erro ao tentar restaurar os dados do backup automático.');
    }
    return false;
  };

  const restoreBackupById = (backupId: string): boolean => {
    try {
      const target = backupHistory.find((b) => b.id === backupId);
      if (!target || !target.state) {
        showNotice('Ponto de restauração não encontrado.');
        return false;
      }

      createAutoBackup(`Backup de Segurança Pré-Restauração de ${target.formattedDate}`);
      setState({
        ...target.state,
        updatedAtMs: Date.now(),
      });
      showNotice(`Restaurado com sucesso do ponto: "${target.reason}" (${target.formattedDate})!`);
      return true;
    } catch (e) {
      console.error('Erro ao restaurar do histórico de backup:', e);
      showNotice('Erro ao restaurar os dados do ponto selecionado.');
      return false;
    }
  };

  const deleteBackupById = (backupId: string) => {
    setBackupHistory((prev) => {
      const updated = prev.filter((b) => b.id !== backupId);
      try {
        getAppStorage().setItem(BACKUP_SNAPSHOTS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
    showNotice('Ponto de backup removido do histórico.');
  };

  const clearBackupHistory = () => {
    setBackupHistory([]);
    try {
      getAppStorage().removeItem(BACKUP_SNAPSHOTS_KEY);
    } catch {
      // ignore
    }
    showNotice('Histórico de backups da sessão limpo com sucesso.');
  };

  const exportBackupToFile = (snapshot?: BackupSnapshot) => {
    const exportData = snapshot ? snapshot.state : state;
    const teamSlug = (exportData.teamName || 'equipe').replace(/\s+/g, '_').toLowerCase();
    const fileName = `dimensio-backup-${teamSlug}-${getTodayISO()}.json`;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(`Backup baixado com sucesso: ${fileName}`);
  };

  const generateShareableConnectionLink = (): string => {
    const currentConfig = state.onlineSpreadsheet;
    const baseUrl = `${window.location.origin}${window.location.pathname}`;

    const params = new URLSearchParams();
    params.set('view', 'share_connection');
    params.set('teamName', state.teamName || 'Equipe Operacional');
    params.set('sector', state.sector || '');
    params.set('shift', state.teamShift || 'T2');

    if (currentConfig?.url || currentConfig?.webhookUrl) {
      const cx = encodeConnectionParams({
        sheetUrl: currentConfig.url,
        webhookUrl: currentConfig.webhookUrl,
        sheetName: currentConfig.name,
        teamName: state.teamName,
      });
      if (cx) {
        params.set('cx', cx);
      }
    }

    return `${baseUrl}?${params.toString()}`;
  };

  const disconnectOnlineSpreadsheet = () => {
    isConnectingRef.current = false;
    setState((prev) => ({
      ...prev,
      onlineSpreadsheet: null,
    }));
    showNotice('Sincronização com a Planilha Online desconectada. Seus dados locais continuam preservados.');
  };

  // Save state to the active storage (sessionStorage por padrão; localStorage se
  // o modo "persistir neste navegador" estiver ativo) and broadcast live changes
  // across tabs whenever state changes
  useEffect(() => {
    try {
      const jsonStr = JSON.stringify(state);
      getAppStorage().setItem(STORAGE_KEY, jsonStr);

      if (liveBcRef.current && !isRemoteOrBroadcastUpdate.current) {
        liveBcRef.current.postMessage({ type: 'STATE_UPDATED', state, senderId: tabId.current });
      }
    } catch (err) {
      console.error('Failed to save or broadcast state', err);
    }
  }, [state]);

  // Listen for live updates from other tabs and inter-device pings
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('escalapro_live_channel');
      liveBcRef.current = bc;
      bc.onmessage = (event) => {
        if (
          event.data &&
          event.data.type === 'STATE_UPDATED' &&
          event.data.state &&
          event.data.senderId !== tabId.current
        ) {
          const remoteMs = Number(event.data.state.updatedAtMs) || 0;
          const currentLocal = stateRef.current || state;
          const localMs = Number(currentLocal.updatedAtMs) || 0;
          if (remoteMs > localMs) {
            isRemoteOrBroadcastUpdate.current = true;
            showNotice(
              'Alteração sincronizada em tempo real entre abas!',
              undefined,
              undefined,
              'sync'
            );
            setState(event.data.state);
            stateRef.current = event.data.state;
          }
        }
      };
    }

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed) {
            const remoteMs = Number(parsed.updatedAtMs) || 0;
            const currentLocal = stateRef.current || state;
            const localMs = Number(currentLocal.updatedAtMs) || 0;
            if (remoteMs > localMs) {
              isRemoteOrBroadcastUpdate.current = true;
              setState(parsed);
              stateRef.current = parsed;
            }
          }
        } catch {
          // ignore
        }
      }
    };

    const handleRemotePing = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const pingMs = Number(detail?.updatedAtMs) || 0;
      const currentLocal = stateRef.current || state;
      const localMs = Number(currentLocal.updatedAtMs) || 0;
      if (pingMs > localMs) {
        fetchFromOnlineSpreadsheetRef.current?.(true);
      }
    };

    window.addEventListener('storage', handleStorageEvent);
    window.addEventListener('dimensio-remote-state-ping', handleRemotePing);
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
      window.removeEventListener('dimensio-remote-state-ping', handleRemotePing);
      if (liveBcRef.current) {
        liveBcRef.current.close();
        liveBcRef.current = null;
      }
    };
  }, []);

  // Apply theme to document element
  useEffect(() => {
    const currentTheme = state.theme || 'dimensio';
    document.documentElement.setAttribute('data-theme', currentTheme);
    const isDark = ['midnight', 'graphite', 'material-dark'].includes(currentTheme);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  const setDate = (selectedDate: string) => {
    updateLocalState((prev) => ({ ...prev, selectedDate }));
  };

  const setYear = (year: number) => {
    updateLocalState((prev) => ({ ...prev, year }));
  };

  const setTeamInfo = (info: { teamName?: string; sector?: string; manager?: string; teamShift?: string; location?: string; shifts?: string[]; scaleType?: ScaleType; scaleGroups?: string[]; shiftConfigs?: Record<string, ShiftCustomConfig> }) => {
    updateLocalState((prev) => {
      const nextShift = info.teamShift !== undefined ? info.teamShift : prev.teamShift;
      const nextShifts = info.shifts !== undefined
        ? info.shifts
        : (info.teamShift !== undefined && !prev.shifts.includes(info.teamShift) ? [...prev.shifts, info.teamShift] : prev.shifts);
      return {
        ...prev,
        ...info,
        teamShift: nextShift,
        shifts: nextShifts,
        selectedShiftFilter: nextShift || prev.selectedShiftFilter,
      };
    });
    showNotice('Informações da operação atualizadas.');
  };

  const updateShiftConfig = (shift: string, config: Partial<ShiftCustomConfig>) => {
    if (!shift) return;
    updateLocalState((prev) => {
      const existing = prev.shiftConfigs?.[shift] || { shift };
      const startTime = config.startTime !== undefined ? config.startTime : existing.startTime;
      const endTime = config.endTime !== undefined ? config.endTime : existing.endTime;
      const workHours = config.workHours !== undefined
        ? config.workHours
        : (startTime && endTime ? `${startTime} às ${endTime}` : (startTime ? `Início: ${startTime}` : (endTime ? `Fim: ${endTime}` : existing.workHours)));

      const updated: ShiftCustomConfig = {
        ...existing,
        ...config,
        shift,
        startTime,
        endTime,
        workHours,
      };

      return {
        ...prev,
        shiftConfigs: {
          ...(prev.shiftConfigs || {}),
          [shift]: updated,
        },
      };
    });
    showNotice(`Horário do Turno ${shift} configurado.`);
  };

  const updateTeamShift = (shift: string) => {
    updateLocalState((prev) => {
      const nextShifts = prev.shifts.includes(shift) ? prev.shifts : [...prev.shifts, shift];
      return {
        ...prev,
        teamShift: shift,
        selectedShiftFilter: shift,
        selectedTLFilter: 'ALL',
        shifts: nextShifts,
      };
    });
  };

  const setSetupCompleted = (done: boolean) => {
    updateLocalState((prev) => ({
      ...prev,
      setupCompleted: done,
      isSampleData: done ? (prev.isSampleData === true ? false : prev.isSampleData) : prev.isSampleData,
    }));
  };

  const applySuggestedScaleCalendar = (year: number) => {
    updateLocalState((prev) => ({
      ...prev,
      calendar: applySuggestedScale6x2(year, prev.scaleGroups),
    }));
    showNotice(`Calendário 6x2 sugerido aplicado para o ano ${year}.`);
  };

  const setTheme = (theme: ThemeOption) => {
    updateLocalState((prev) => ({ ...prev, theme }));
    showNotice(`Tema alterado para ${theme}.`);
  };

  const addCollaborator = (customProps?: Partial<Collaborator>) => {
    const rawName = customProps?.name || 'Novo Colaborador';
    const targetTeam = customProps?.teamLeader || state.defaultTeamLeader || (state.teamLeaders?.[0] || 'Sem Time');
    const teamShift = state.teamShiftMap?.[targetTeam] || state.selectedShiftFilter || state.teamShift || 'T1';

    const newCol: Collaborator = {
      id: generateId(),
      name: formatPersonName(rawName),
      login: customProps?.login || '',
      registration: customProps?.registration || '',
      shift: customProps?.shift || teamShift,
      scale: customProps?.scale || 'A',
      teamLeader: targetTeam,
      role: customProps?.role || (state.roles[0] || 'Operador de Processo'),
      category: customProps?.category || (state.categories[0] || 'Inbound'),
      skills: customProps?.skills || {},
      notes: customProps?.notes || '',
      absences: customProps?.absences || [],
    };
    updateLocalState((prev) => ({
      ...prev,
      isSampleData: false,
      collaborators: [...prev.collaborators, newCol],
    }));
    showNotice('Novo colaborador cadastrado.');
  };

  const addTeamLeader = (name: string, shift?: string, leaderName?: string) => {
    const clean = name.trim();
    if (!clean) return;
    const targetShift = shift || state.selectedShiftFilter || state.teamShift || 'T1';
    updateLocalState((prev) => {
      const current = prev.teamLeaders || [];
      const currentTeams = prev.teams || [];
      const currentShiftMap = { ...(prev.teamShiftMap || {}) };
      currentShiftMap[clean] = targetShift;

      if (current.includes(clean)) {
        return {
          ...prev,
          teamShiftMap: currentShiftMap,
          teams: currentTeams.map((t) => (t.name === clean ? { ...t, shift: targetShift, leaderName: leaderName || t.leaderName } : t)),
        };
      }

      const newTeamObj: TeamDefinition = {
        id: generateId(),
        name: clean,
        shift: targetShift,
        leaderName,
      };

      return {
        ...prev,
        teamLeaders: [...current, clean],
        teams: [...currentTeams, newTeamObj],
        teamShiftMap: currentShiftMap,
        defaultTeamLeader: prev.defaultTeamLeader || clean,
      };
    });
    showNotice(`Time / TL "${clean}" vinculado ao Turno ${targetShift}!`);
  };

  const removeTeamLeader = (name: string) => {
    updateLocalState((prev) => {
      const current = prev.teamLeaders || [];
      const updatedLeaders = current.filter((t) => t !== name);
      const updatedTeams = (prev.teams || []).filter((t) => t.name !== name);
      const updatedShiftMap = { ...(prev.teamShiftMap || {}) };
      delete updatedShiftMap[name];

      return {
        ...prev,
        teamLeaders: updatedLeaders,
        teams: updatedTeams,
        teamShiftMap: updatedShiftMap,
        defaultTeamLeader: prev.defaultTeamLeader === name ? updatedLeaders[0] || '' : prev.defaultTeamLeader,
      };
    });
    showNotice(`Time / TL "${name}" removido.`);
  };

  const editTeamLeader = (oldName: string, newName: string, newShift?: string) => {
    const cleanNew = newName.trim();
    if (!cleanNew) return;
    updateLocalState((prev) => {
      const targetShift = newShift || prev.teamShiftMap?.[oldName] || prev.teamShift || 'T1';
      const updatedLeaders = (prev.teamLeaders || []).map((tl) => (tl === oldName ? cleanNew : tl));
      const updatedShiftMap = { ...(prev.teamShiftMap || {}) };
      delete updatedShiftMap[oldName];
      updatedShiftMap[cleanNew] = targetShift;

      const updatedTeams = (prev.teams || []).map((t) =>
        t.name === oldName ? { ...t, name: cleanNew, shift: targetShift } : t
      );

      // Automatically update collaborators belonging to this team to the team's new name AND new shift!
      const updatedCols = prev.collaborators.map((c) =>
        c.teamLeader === oldName ? { ...c, teamLeader: cleanNew, shift: targetShift } : c
      );

      return {
        ...prev,
        teamLeaders: updatedLeaders,
        teams: updatedTeams,
        teamShiftMap: updatedShiftMap,
        collaborators: updatedCols,
        defaultTeamLeader: prev.defaultTeamLeader === oldName ? cleanNew : prev.defaultTeamLeader,
      };
    });
    showNotice(`Time renomeado para "${cleanNew}".`);
  };

  const updateCollaborator = (id: string, updates: Partial<Collaborator>) => {
    updateLocalState((prev) => {
      let finalUpdates = { ...updates };
      if (updates.teamLeader && prev.teamShiftMap?.[updates.teamLeader]) {
        finalUpdates.shift = prev.teamShiftMap[updates.teamLeader];
      }
      return {
        ...prev,
        collaborators: prev.collaborators.map((c) => (c.id === id ? { ...c, ...finalUpdates } : c)),
      };
    });
  };

  const bulkUpdateCollaborators = (ids: string[], updates: Partial<Collaborator>) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    updateLocalState((prev) => {
      let finalUpdates = { ...updates };
      if (updates.teamLeader && prev.teamShiftMap?.[updates.teamLeader]) {
        finalUpdates.shift = prev.teamShiftMap[updates.teamLeader];
      }
      return {
        ...prev,
        collaborators: prev.collaborators.map((c) => (idSet.has(c.id) ? { ...c, ...finalUpdates } : c)),
      };
    });
  };

  const addProcessKnowledge = (item: Omit<ProcessKnowledge, 'id'>) => {
    const newItem: ProcessKnowledge = {
      ...item,
      id: generateId(),
      active: item.active !== undefined ? item.active : true,
    };
    updateLocalState((prev) => ({
      ...prev,
      processKnowledgeList: [...(prev.processKnowledgeList || []), newItem],
    }));
    showNotice(`Processo "${item.title}" cadastrado com sucesso!`);
  };

  const updateProcessKnowledge = (id: string, updates: Partial<ProcessKnowledge>) => {
    updateLocalState((prev) => ({
      ...prev,
      processKnowledgeList: (prev.processKnowledgeList || []).map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    }));
    showNotice('Item de processo atualizado.');
  };

  const deleteProcessKnowledge = (id: string) => {
    updateLocalState((prev) => ({
      ...prev,
      processKnowledgeList: (prev.processKnowledgeList || []).filter((p) => p.id !== id),
    }));
    showNotice('Item de processo removido.');
  };

  const deleteCollaborator = (id: string) => {
    const target = state.collaborators.find((c) => c.id === id);
    if (!target) return;

    const now = new Date();
    const expires = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days retention
    const deletedEntry: DeletedCollaborator = {
      id: generateId(),
      collaborator: target,
      deletedAt: now.toISOString(),
      expiresAt: expires.toISOString(),
    };

    updateLocalState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.filter((c) => c.id !== id),
      deletedCollaborators: [...(prev.deletedCollaborators || []), deletedEntry],
      tasks: prev.tasks.map((t) => ({
        ...t,
        members: t.members.filter((m) => m !== id),
      })),
      intervals: Object.fromEntries(
        Object.entries(prev.intervals).map(([dateKey, dayIntervals]) => [
          dateKey,
          Object.fromEntries(
            Object.entries(dayIntervals).map(([breakId, memberIds]) => [
              breakId,
              memberIds.filter((m) => m !== id),
            ])
          ),
        ])
      ),
    }));

    showNotice(
      `Colaborador "${target.name}" movido para a Lixeira (mantido por 60 dias).`,
      'Desfazer Exclusão',
      () => restoreCollaborator(deletedEntry.id)
    );
  };

  const restoreCollaborator = (deletedId: string) => {
    const entry = state.deletedCollaborators?.find((d) => d.id === deletedId);
    if (!entry) return;

    updateLocalState((prev) => ({
      ...prev,
      collaborators: [...prev.collaborators, entry.collaborator],
      deletedCollaborators: (prev.deletedCollaborators || []).filter((d) => d.id !== deletedId),
    }));

    showNotice(`Colaborador "${entry.collaborator.name}" restaurado com sucesso!`);
  };

  const permanentlyDeleteCollaborator = (deletedId: string) => {
    const entry = state.deletedCollaborators?.find((d) => d.id === deletedId);
    updateLocalState((prev) => ({
      ...prev,
      deletedCollaborators: (prev.deletedCollaborators || []).filter((d) => d.id !== deletedId),
    }));

    showNotice(`Colaborador "${entry?.collaborator.name || ''}" excluído permanentemente.`);
  };

  const clearTrashBin = () => {
    updateLocalState((prev) => ({
      ...prev,
      deletedCollaborators: [],
    }));
    showNotice('Lixeira de colaboradores esvaziada.');
  };

  const addScheduledAbsence = (collaboratorId: string, absence: Omit<ScheduledAbsence, 'id'>) => {
    const newAbsence: ScheduledAbsence = {
      ...absence,
      id: generateId(),
    };
    updateLocalState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.map((c) => {
        if (c.id === collaboratorId) {
          return {
            ...c,
            absences: [...(c.absences || []), newAbsence],
          };
        }
        return c;
      }),
    }));
    showNotice('Afastamento (Férias/Licença/Treinamento) cadastrado.');
  };

  const removeScheduledAbsence = (collaboratorId: string, absenceId: string) => {
    updateLocalState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.map((c) => {
        if (c.id === collaboratorId) {
          return {
            ...c,
            absences: (c.absences || []).filter((a) => a.id !== absenceId),
          };
        }
        return c;
      }),
    }));
    showNotice('Afastamento removido.');
  };

  const addTask = (
    taskDataOrName: string | (Partial<Task> & { name: string }),
    allowedRoles: string[] = [],
    allowedCategories: string[] = [],
    externalUrl?: string
  ) => {
    let newTask: Task;
    if (typeof taskDataOrName === 'object') {
      if (!taskDataOrName.name?.trim()) return;
      newTask = {
        id: taskDataOrName.id || generateId(),
        name: taskDataOrName.name.trim(),
        members: Array.isArray(taskDataOrName.members) ? taskDataOrName.members : [],
        allowedRoles: taskDataOrName.allowedRoles,
        allowedCategories: taskDataOrName.allowedCategories,
        requiredSkills: taskDataOrName.requiredSkills,
        parentId: taskDataOrName.parentId,
        priority: taskDataOrName.priority,
        minHeadcount: taskDataOrName.minHeadcount,
        maxHeadcount: taskDataOrName.maxHeadcount,
        description: taskDataOrName.description,
        active: taskDataOrName.active !== false,
        externalUrl: taskDataOrName.externalUrl?.trim() || undefined,
        shift: taskDataOrName.shift,
        allowedShifts: taskDataOrName.allowedShifts,
      };
    } else {
      if (!taskDataOrName.trim()) return;
      newTask = {
        id: generateId(),
        name: taskDataOrName.trim(),
        members: [],
        allowedRoles,
        allowedCategories,
        externalUrl: externalUrl?.trim() || undefined,
        active: true,
      };
    }

    updateLocalState((prev) => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
    }));
    showNotice(`Tarefa "${newTask.name}" adicionada.`);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    const existingTask = state.tasks.find((t) => t.id === id);
    updateLocalState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));

    if (existingTask && updates.members && Array.isArray(updates.members)) {
      const sellerName = identifiedUser?.name || 'Gestor';
      const newMembers = updates.members.filter((mId) => !existingTask.members.includes(mId));
      newMembers.forEach((mId) => {
        const col = state.collaborators.find((c) => c.id === mId);
        if (col) {
          addNotification({
            targetUserId: col.id,
            shift: col.shift || state.teamShift,
            senderName: sellerName,
            title: `Nova tarefa: ${updates.name || existingTask.name}`,
            message: `${sellerName} atribuiu você para a tarefa "${updates.name || existingTask.name}".`,
            type: 'notice',
            data: {
              collaboratorId: col.id,
              collaboratorName: col.name,
              taskId: id,
              taskName: updates.name || existingTask.name,
              userId: identifiedUser?.id,
              userName: sellerName,
              action: 'task_assigned',
            },
          });
        }
      });
    }
  };

  const deleteTask = (id: string) => {
    updateLocalState((prev) => ({
      ...prev,
      tasks: prev.tasks
        .filter((t) => t.id !== id)
        .map((t) => (t.parentId === id ? { ...t, parentId: undefined } : t)),
    }));
    showNotice('Tarefa excluída.');
  };

  const addBreakSlot = (time: string, capacity?: number, shift?: string) => {
    const cleanShift = shift && shift !== 'all' && shift !== 'Geral' && shift !== 'todos' ? shift : undefined;
    const newSlot: BreakSlot = {
      id: generateId(),
      time: time || '20:00',
      shift: cleanShift,
      capacity: capacity || undefined,
    };
    updateLocalState((prev) => ({
      ...prev,
      breaks: [...prev.breaks, newSlot],
    }));
    showNotice(cleanShift ? `Horário de intervalo adicionado para o Turno ${cleanShift}.` : 'Horário de intervalo adicionado.');
  };

  const updateBreakSlot = (id: string, updates: Partial<BreakSlot>) => {
    updateLocalState((prev) => ({
      ...prev,
      breaks: prev.breaks.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
  };

  const deleteBreakSlot = (id: string) => {
    updateLocalState((prev) => ({
      ...prev,
      breaks: prev.breaks.filter((b) => b.id !== id),
    }));
    showNotice('Horário de intervalo removido.');
  };

  const markDayScale = (dateStr: string, scale: string) => {
    updateLocalState((prev) => {
      const newCal = { ...prev.calendar };
      if (scale) {
        newCal[dateStr] = scale;
      } else {
        delete newCal[dateStr];
      }
      return { ...prev, calendar: newCal };
    });
  };

  const toggleAttendance = (collaboratorId: string, present: boolean) => {
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const dayAtt = { ...(prev.attendance[dateKey] || {}) };
      dayAtt[collaboratorId] = present;
      return {
        ...prev,
        attendance: {
          ...prev.attendance,
          [dateKey]: dayAtt,
        },
      };
    });
  };

  const setAttendanceStatus = (collaboratorId: string, status: 'presente' | 'ausente' | 'atestado' | 'banco_horas' | 'falta_injustificada' | 'atraso') => {
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const dayAtt = { ...(prev.attendance[dateKey] || {}) };
      
      if (status === 'presente') {
        const collab = prev.collaborators.find((c) => c.id === collaboratorId);
        const offScale = collab ? isScaleOff(prev.calendar, dateKey, collab.scale) : false;
        const scheduledAbsence = collab ? getActiveAbsence(collab, dateKey) : null;
        if (!offScale && !scheduledAbsence) {
          delete dayAtt[collaboratorId];
        } else {
          dayAtt[collaboratorId] = true;
        }
      } else {
        // Store absence type as object with status
        dayAtt[collaboratorId] = { absent: true, reason: status };
      }
      
      // Also sync absenceReasons in the same state update to avoid race conditions
      const dayReport = prev.dailyReports[dateKey] || {};
      const absenceReasons = { ...(dayReport.absenceReasons || {}) };
      
      if (status === 'presente') {
        delete absenceReasons[collaboratorId];
      } else {
        const reasonLabels: Record<string, string> = {
          atraso: 'Atraso (Início de Turno)',
          atestado: 'Atestado Médico',
          banco_horas: 'Banco de Horas',
          falta_injustificada: 'Falta Injustificada',
          ausente: 'Ausente',
        };
        absenceReasons[collaboratorId] = reasonLabels[status] || status;
      }
      
      return {
        ...prev,
        attendance: {
          ...prev.attendance,
          [dateKey]: dayAtt,
        },
        dailyReports: {
          ...prev.dailyReports,
          [dateKey]: {
            ...dayReport,
            absenceReasons,
          },
        },
      };
    });
  };

  const resetAttendance = () => {
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const newAtt = { ...prev.attendance };
      delete newAtt[dateKey];
      return { ...prev, attendance: newAtt };
    });
    showNotice('Presença restaurada conforme o cálculo automático da escala.');
  };

  const setStatusReason = (collaboratorId: string, status: StatusType, reason: string) => {
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const dayAtt = { ...(prev.attendance[dateKey] || {}) };

      if (status === 'presente') {
        dayAtt[collaboratorId] = true;
      } else if (status === 'folga') {
        delete dayAtt[collaboratorId];
      } else {
        dayAtt[collaboratorId] = { absent: true, reason: status };
      }

      const dayReport = prev.dailyReports[dateKey] || {};
      const absenceReasons = { ...(dayReport.absenceReasons || {}) };

      if (status === 'presente' || status === 'folga') {
        delete absenceReasons[collaboratorId];
      } else {
        absenceReasons[collaboratorId] = reason || status;
      }

      return {
        ...prev,
        attendance: {
          ...prev.attendance,
          [dateKey]: dayAtt,
        },
        dailyReports: {
          ...prev.dailyReports,
          [dateKey]: {
            ...dayReport,
            absenceReasons,
          },
        },
      };
    });
  };

  const addInterval = (collaboratorId: string, time: string) => {
    const trimmed = time.trim();
    if (!trimmed) return;
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const existing = prev.breaks.find((b) => b.time === trimmed);
      const breaks = existing
        ? prev.breaks
        : [...prev.breaks, { id: generateId(), time: trimmed, shift: prev.teamShift || 'T2' } as BreakSlot];
      const slot = existing || breaks[breaks.length - 1];

      const dayIntervals = { ...(prev.intervals[dateKey] || {}) };
      for (const slotId of Object.keys(dayIntervals)) {
        dayIntervals[slotId] = dayIntervals[slotId].filter((id) => id !== collaboratorId);
      }
      dayIntervals[slot.id] = [...(dayIntervals[slot.id] || []), collaboratorId];

      return {
        ...prev,
        breaks,
        intervals: {
          ...prev.intervals,
          [dateKey]: dayIntervals,
        },
      };
    });
  };

  const assignTask = (collaboratorId: string, taskId: string) => {
    const col = state.collaborators.find((c) => c.id === collaboratorId);
    const alreadyAssigned = taskId
      ? state.tasks.some((t) => t.id === taskId && t.active !== false && t.members.includes(collaboratorId))
      : false;

    updateLocalState((prev) => {
      const updatedTasks = prev.tasks.map((t) => {
        const filtered = t.members.filter((m) => m !== collaboratorId);
        if (t.id === taskId) {
          return { ...t, members: [...filtered, collaboratorId] };
        }
        return { ...t, members: filtered };
      });
      return { ...prev, tasks: updatedTasks };
    });

    // Notifica o colaborador dimensionado (chega a ele via sincronização nuvem).
    if (col && taskId && !alreadyAssigned) {
      const task = state.tasks.find((t) => t.id === taskId);
      const sellerName = identifiedUser?.name || 'Gestor';
      addNotification({
        targetUserId: col.id,
        shift: col.shift || state.teamShift,
        senderName: sellerName,
        title: `Nova tarefa: ${task?.name || 'Atribuição'}`,
        message: `${sellerName} dimensionou você para a tarefa "${task?.name || ''}".`,
        type: 'notice',
        data: {
          collaboratorId: col.id,
          collaboratorName: col.name,
          taskId: taskId,
          taskName: task?.name,
          userId: identifiedUser?.id,
          userName: sellerName,
          action: 'task_assigned',
        },
      });
    }
  };

  const unassignTask = (collaboratorId: string) => {
    const col = state.collaborators.find((c) => c.id === collaboratorId);
    const previousTask = state.tasks.find((t) => t.active !== false && t.members.includes(collaboratorId));

    updateLocalState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => ({
        ...t,
        members: t.members.filter((m) => m !== collaboratorId),
      })),
    }));

    if (col && previousTask) {
      const sellerName = identifiedUser?.name || 'Gestor';
      addNotification({
        targetUserId: col.id,
        shift: col.shift || state.teamShift,
        senderName: sellerName,
        title: 'Tarefa removida',
        message: `${sellerName} removeu você da tarefa "${previousTask.name}".`,
        type: 'notice',
        data: {
          collaboratorId: col.id,
          collaboratorName: col.name,
          taskId: previousTask.id,
          taskName: previousTask.name,
          userId: identifiedUser?.id,
          userName: sellerName,
          action: 'task_unassigned',
        },
      });
    }
  };

  const clearAssignments = () => {
    updateLocalState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => ({ ...t, members: [] })),
    }));
    showNotice('Dimensionamento de tarefas limpo.');
  };

  const clearTaskAssignments = (taskId: string) => {
    const targetTask = state.tasks.find((t) => t.id === taskId);
    updateLocalState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, members: [] } : t)),
    }));
    showNotice(`Dimensionamento da tarefa "${targetTask?.name || ''}" foi limpo.`);
  };

  const autoAssign = (options: AutoAssignOptions = {}) => {
    let resultSummary = '';
    updateLocalState((prev) => {
      if (!prev.tasks.length) return prev;
      const activeShift = prev.selectedShiftFilter || 'ALL';
      const activeTL = prev.selectedTLFilter || 'ALL';

      const activePeople = prev.collaborators.filter((c) => {
        const colShift = c.shift || 'Geral';
        const matchesShift = activeShift === 'ALL' || activeShift === 'todos' || colShift === activeShift;
        const colTL = c.teamLeader || prev.defaultTeamLeader || 'Sem Time';
        const matchesTL = activeTL === 'ALL' || activeTL === 'todos' || colTL === activeTL;
        if (!matchesShift || !matchesTL) return false;

        const statusInfo = getCollaboratorStatus(c, prev.selectedDate, prev);
        return statusInfo.status === 'presente' || statusInfo.status === 'atraso';
      });

      const result = executeAutoAssign(activePeople, prev.tasks, options);
      const strategyLabel = {
        balanced: 'Balanceamento por Quantidade',
        skills: 'Match de Habilidades (Skills)',
        priority: 'Prioridade Operacional',
        rotation: 'Rotação de Colaboradores',
      }[result.stats.strategyUsed || 'balanced'];

      resultSummary = `Auto dimensionamento (${strategyLabel}): ${result.stats.totalAllocated} pessoas alocadas em ${result.stats.tasksFilled} postos.`;
      return { ...prev, tasks: result.tasks };
    });

    if (resultSummary) {
      showNotice(resultSummary);
    }
  };

  const moveBreakInterval = (collaboratorId: string, fromBreakId: string | null, toBreakId: string | null) => {
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const dayIntervals = { ...(prev.intervals[dateKey] || {}) };

      if (fromBreakId && dayIntervals[fromBreakId]) {
        dayIntervals[fromBreakId] = dayIntervals[fromBreakId].filter((m) => m !== collaboratorId);
      }

      if (toBreakId) {
        dayIntervals[toBreakId] = [...(dayIntervals[toBreakId] || []).filter((m) => m !== collaboratorId), collaboratorId];
      }

      return {
        ...prev,
        intervals: {
          ...prev.intervals,
          [dateKey]: dayIntervals,
        },
      };
    });
  };

  const generateRotatingBreaks = (options?: { referenceDate?: string; shift?: string }) => {
    let resultSummary = '';
    let executionRes: BreakRotationExecutionResult | null = null;

    updateLocalState((prev) => {
      if (!prev.breaks.length) return prev;
      const dateKey = prev.selectedDate || getTodayISO();
      executionRes = calculateRotatingBreaks(prev, options);

      resultSummary = `Rotação de Intervalos aplicada com sucesso! ${executionRes.totalRotated} colaboradores avançaram +1 slot em relação a ${executionRes.referenceDateUsed ? formatDateBR(executionRes.referenceDateUsed) : 'ontem'}.`;
      if (executionRes.totalNew > 0) {
        resultSummary += ` (${executionRes.totalNew} novos/sem registro anterior balanceados).`;
      }

      return {
        ...prev,
        intervals: {
          ...prev.intervals,
          [dateKey]: executionRes.intervals,
        },
      };
    });

    if (executionRes && (executionRes as any).rotations) {
      setBreakRotationMap((executionRes as any).rotations);
    }

    if (resultSummary) {
      showNotice(resultSummary);
    }

    return executionRes;
  };

  const generateBreaks = (mode: 'parent' | 'subtasks' | 'rotation' = 'parent') => {
    if (mode === 'rotation') {
      generateRotatingBreaks();
      return;
    }

    updateLocalState((prev) => {
      if (!prev.breaks.length) return prev;
      const dateKey = prev.selectedDate;
      const result: Record<string, string[]> = Object.fromEntries(prev.breaks.map((b) => [b.id, []]));

      // 1. Filtrar apenas colaboradores ativos e presentes no dia selecionado
      const activePeople = prev.collaborators.filter((c) => {
        const hasAbsence = (c.absences || []).some((a) => dateKey >= a.startDate && dateKey <= a.endDate);
        const off = isScaleOff(prev.calendar, dateKey, c.scale);
        const manual = prev.attendance[dateKey]?.[c.id];
        if (hasAbsence) return false;
        if (manual !== undefined) {
          if (typeof manual === 'boolean') return manual;
          if (typeof manual === 'object' && manual.absent) return false;
          return true;
        }
        return !off;
      });

      if (activePeople.length === 0) {
        return {
          ...prev,
          intervals: {
            ...prev.intervals,
            [dateKey]: result,
          },
        };
      }

      // 2. Mapear cada colaborador ao seu grupo de tarefa (modo pai ou subtarefas)
      const taskFor: Record<string, string> = {};
      prev.tasks.forEach((t) => {
        const effectiveGroupId = mode === 'parent' ? (getRootTask(prev.tasks, t.id)?.id || t.id) : t.id;
        (t.members || []).forEach((m) => {
          taskFor[m] = effectiveGroupId;
        });
      });

      // 3. Agrupar colaboradores por grupo operacional e turno para manter o balanceamento ideal por posto
      const groupsMap = new Map<string, Collaborator[]>();
      for (const person of activePeople) {
        const groupKey = `${person.shift || 'Geral'}__${taskFor[person.id] || 'unassigned'}`;
        if (!groupsMap.has(groupKey)) {
          groupsMap.set(groupKey, []);
        }
        groupsMap.get(groupKey)!.push(person);
      }

      // 4. Distribuição aleatória / rotativa:
      // Embaralhar aleatoriamente os colaboradores dentro de cada grupo de tarefa
      const shuffledGroups: Array<{ groupKey: string; members: Collaborator[] }> = [];
      groupsMap.forEach((members, groupKey) => {
        shuffledGroups.push({
          groupKey,
          members: shuffleArray(members),
        });
      });

      // Embaralha a ordem dos grupos para garantir distribuição uniforme e descorrelacionada
      const groupsList = shuffleArray(shuffledGroups);

      // Rastreador de carga por posto/tarefa (`${taskGroupId}-${slotId}`)
      const loadCount: Record<string, number> = {};

      // 5. Alocar cada colaborador no horário que mantenha o balanceamento perfeito, com desempate aleatório
      for (const group of groupsList) {
        for (const person of group.members) {
          const eligible = prev.breaks.filter(
            (b) => !b.shift || b.shift === 'Geral' || b.shift === person.shift
          );
          const pool = eligible.length ? eligible : prev.breaks;
          const personTaskGroup = taskFor[person.id] || 'none';

          // Identificar a menor carga da tarefa da pessoa e a menor carga global entre os horários elegíveis
          let minTaskLoad = Infinity;
          let minTotalLoad = Infinity;

          for (const slot of pool) {
            const taskKey = `${personTaskGroup}-${slot.id}`;
            const tLoad = loadCount[taskKey] || 0;
            const totLoad = result[slot.id]?.length || 0;

            if (tLoad < minTaskLoad) {
              minTaskLoad = tLoad;
              minTotalLoad = totLoad;
            } else if (tLoad === minTaskLoad && totLoad < minTotalLoad) {
              minTotalLoad = totLoad;
            }
          }

          // Filtrar os slots que empatam rigorosamente na menor carga por tarefa e menor carga total
          let candidateSlots = pool.filter((slot) => {
            const taskKey = `${personTaskGroup}-${slot.id}`;
            const tLoad = loadCount[taskKey] || 0;
            const totLoad = result[slot.id]?.length || 0;
            return tLoad === minTaskLoad && totLoad === minTotalLoad;
          });

          // Se necessário, ampliar para todos os slots com menor carga de tarefa
          if (candidateSlots.length === 0) {
            candidateSlots = pool.filter((slot) => {
              const taskKey = `${personTaskGroup}-${slot.id}`;
              return (loadCount[taskKey] || 0) === minTaskLoad;
            });
          }

          // Escolhe aleatoriamente entre os horários candidatos empatados
          const chosen = candidateSlots.length > 0
            ? candidateSlots[Math.floor(Math.random() * candidateSlots.length)]
            : pool[0];

          if (chosen) {
            result[chosen.id].push(person.id);
            const key = `${personTaskGroup}-${chosen.id}`;
            loadCount[key] = (loadCount[key] || 0) + 1;
          }
        }
      }

      return {
        ...prev,
        intervals: {
          ...prev.intervals,
          [dateKey]: result,
        },
      };
    });
    showNotice(
      mode === 'subtasks'
        ? 'Intervalos gerados com distribuição aleatória e balanceamento por subtarefas.'
        : 'Intervalos gerados com distribuição aleatória e balanceamento pela tarefa pai.'
    );
  };

  const syncPresenceToApi = async (): Promise<boolean> => {
    try {
      const payload = {
        selectedDate: state.selectedDate,
        date: state.selectedDate,
        collaborators: state.collaborators,
        attendance: state.attendance,
      };

      // Full Dimensio State Snapshot for all connected apps & extensions
      const fullDimensioPayload = {
        collaborators: state.collaborators.map((c) => ({
          id: c.id,
          name: c.name,
          login: c.login,
          registration: c.registration,
          shift: c.shift,
          scale: c.scale,
          role: c.role,
        })),
        tasks: state.tasks.map((t) => ({
          id: t.id,
          name: t.name,
          minHeadcount: t.minHeadcount,
          maxHeadcount: t.maxHeadcount,
          members: t.members,
          externalUrl: t.externalUrl,
        })),
        intervals: state.intervals,
        scheduledTaskLists: state.scheduledTaskLists,
        scheduledTasks: state.scheduledTasks,
        serviceRequests: state.serviceRequests,
        infoHubReminders: state.infoHubReminders,
        infoHubLinks: state.infoHubLinks,
      };

      await Promise.allSettled([
        fetch('/api/presence/state-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
        fetch('/api/dimensio/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullDimensioPayload),
        }),
      ]);

      return true;
    } catch (err) {
      console.error('Failed to sync presence/dimensio to API:', err);
      return false;
    }
  };

  const importExternalPresenceList = async (
    recordsOrText: PresenceSyncRecord[] | string,
    dateOverride?: string
  ): Promise<{ success: boolean; processed: number; errors?: string[] }> => {
    try {
      const date = dateOverride || state.selectedDate || getTodayISO();
      let records: PresenceSyncRecord[] = [];

      if (typeof recordsOrText === 'string') {
        const trimmed = recordsOrText.trim();
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
                date,
              });
            }
          });
        }
      } else if (Array.isArray(recordsOrText)) {
        records = recordsOrText;
      }

      if (records.length === 0) {
        showNotice('Nenhum registro de presença válido encontrado para importar.');
        return { success: false, processed: 0, errors: ['Formato vazio ou não reconhecido'] };
      }

      updateLocalState((prev) => {
        const dayAtt = { ...(prev.attendance[date] || {}) };
        const dayReport = prev.dailyReports[date] || {};
        const absenceReasons = { ...(dayReport.absenceReasons || {}) };

        records.forEach((rec) => {
          const col = prev.collaborators.find(
            (c) =>
              (rec.collaboratorId && c.id === rec.collaboratorId) ||
              (rec.login && c.login && c.login.toLowerCase() === rec.login.toLowerCase()) ||
              (rec.registration && c.registration && c.registration === rec.registration) ||
              (rec.name && c.name.toLowerCase() === rec.name.toLowerCase()) ||
              (rec.name && c.name.toLowerCase().includes(rec.name.toLowerCase()))
          );

          const colId = col ? col.id : rec.collaboratorId || rec.id;
          if (!colId) return;

          const rawSt = (rec.status || 'presente').toLowerCase();
          if (['presente', 'present', 'p', '1', 'true'].includes(rawSt)) {
            dayAtt[colId] = true;
            delete absenceReasons[colId];
          } else if (['atraso', 'delay', 'atrasado'].includes(rawSt)) {
            dayAtt[colId] = { absent: true, reason: 'atraso' };
            absenceReasons[colId] = rec.reason || 'Atraso (Importado via API)';
          } else if (['folga', 'off'].includes(rawSt)) {
            delete dayAtt[colId];
            delete absenceReasons[colId];
          } else {
            dayAtt[colId] = { absent: true, reason: rawSt };
            absenceReasons[colId] = rec.reason || rawSt;
          }
        });

        return {
          ...prev,
          attendance: {
            ...prev.attendance,
            [date]: dayAtt,
          },
          dailyReports: {
            ...prev.dailyReports,
            [date]: {
              ...dayReport,
              absenceReasons,
            },
          },
        };
      });

      fetch('/api/presence/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, records, source: 'app_import' }),
      }).catch(() => {});

      showNotice(`Lista de presença importada com sucesso: ${records.length} registros processados!`);
      return { success: true, processed: records.length };
    } catch (err: any) {
      showNotice(`Erro ao importar lista de presença: ${err?.message}`);
      return { success: false, processed: 0, errors: [err?.message] };
    }
  };

  const exportPresenceList = (format: 'json' | 'csv' = 'json', dateOverride?: string) => {
    const date = dateOverride || state.selectedDate || getTodayISO();
    if (format === 'csv') {
      const link = document.createElement('a');
      link.href = `/api/presence?date=${date}&format=csv`;
      link.download = `presenca-${date}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showNotice(`Download do relatório CSV de presença iniciado para ${formatDateBR(date)}.`);
    } else {
      // Build JSON download
      const dayAtt = state.attendance[date] || {};
      const dayReport = state.dailyReports[date] || {};
      const absenceReasons = dayReport.absenceReasons || {};

      const data = state.collaborators.map((c) => {
        const statusInfo = getCollaboratorStatus(c, date, state);
        return {
          id: c.id,
          name: c.name,
          login: c.login,
          registration: c.registration,
          shift: c.shift,
          scale: c.scale,
          role: c.role,
          status: statusInfo.status,
          isOffScale: statusInfo.isOffScale,
          absenceReason: absenceReasons[c.id] || statusInfo.absenceReason || '',
          date,
        };
      });

      const blob = new Blob([JSON.stringify({ date, count: data.length, data }, null, 2)], {
        type: 'application/json;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `presenca-${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotice(`Exportação JSON de presença concluída para ${formatDateBR(date)}.`);
    }
  };

  const fetchPresenceEvents = async (): Promise<PresenceSyncEvent[]> => {
    try {
      const res = await fetch('/api/presence/events');
      if (res.ok) {
        const json = await res.json();
        return json.events || [];
      }
    } catch (err) {
      console.error('Failed to fetch presence events:', err);
    }
    return [];
  };

  const clearBreaks = () => {
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const newIntervals = { ...prev.intervals };
      delete newIntervals[dateKey];
      return {
        ...prev,
        intervals: newIntervals,
      };
    });
    showNotice('Escala de intervalos do dia foi limpa com sucesso.');
  };

  const addCatalogItem = (key: 'roles' | 'categories' | 'skills', item: string) => {
    const trimmed = item.trim();
    if (!trimmed) return;
    updateLocalState((prev) => {
      if (prev[key].includes(trimmed)) return prev;
      return { ...prev, [key]: [...prev[key], trimmed] };
    });
    showNotice(`Item "${trimmed}" adicionado a ${key}.`);
  };

  const removeCatalogItem = (key: 'roles' | 'categories' | 'skills', item: string) => {
    updateLocalState((prev) => ({
      ...prev,
      [key]: prev[key].filter((i) => i !== item),
    }));
    showNotice('Item removido.');
  };

  const editCatalogItem = (key: 'roles' | 'categories' | 'skills', oldItem: string, newItem: string) => {
    const trimmed = newItem.trim();
    if (!trimmed || trimmed === oldItem) return;
    updateLocalState((prev) => {
      const updatedList = prev[key].map((item) => (item === oldItem ? trimmed : item));
      let updatedCollaborators = prev.collaborators;
      let updatedTasks = prev.tasks;

      if (key === 'roles') {
        updatedCollaborators = prev.collaborators.map((c) =>
          c.role === oldItem ? { ...c, role: trimmed } : c
        );
        updatedTasks = prev.tasks.map((t) => ({
          ...t,
          allowedRoles: (t.allowedRoles || []).map((r) => (r === oldItem ? trimmed : r)),
        }));
      } else if (key === 'categories') {
        updatedCollaborators = prev.collaborators.map((c) =>
          c.category === oldItem ? { ...c, category: trimmed } : c
        );
        updatedTasks = prev.tasks.map((t) => ({
          ...t,
          allowedCategories: (t.allowedCategories || []).map((cat) => (cat === oldItem ? trimmed : cat)),
        }));
      } else if (key === 'skills') {
        updatedCollaborators = prev.collaborators.map((c) => {
          if (c.skills && oldItem in c.skills) {
            const newSkills = { ...c.skills, [trimmed]: c.skills[oldItem] };
            delete newSkills[oldItem];
            return { ...c, skills: newSkills };
          }
          return c;
        });
      }

      return {
        ...prev,
        [key]: updatedList,
        collaborators: updatedCollaborators,
        tasks: updatedTasks,
      };
    });
    showNotice(`Item renomeado de "${oldItem}" para "${trimmed}".`);
  };

  const setRoleType = (roleName: string, type: 'operacional' | 'administrativo') => {
    updateLocalState((prev) => ({
      ...prev,
      roleTypes: {
        ...(prev.roleTypes || {}),
        [roleName]: type,
      },
    }));
    showNotice(`Cargo "${roleName}" definido como ${type === 'administrativo' ? 'Administrativo (não conta no HC)' : 'Operacional (conta no HC)'}.`);
  };

  const setRolePermission = (roleName: string, level: RoleAccessLevel) => {
    updateLocalState((prev) => ({
      ...prev,
      rolePermissions: {
        ...(prev.rolePermissions || {}),
        [roleName]: level,
      },
    }));
    const levelLabels: Record<RoleAccessLevel, string> = {
      portal: 'Só Portal',
      viewer: 'Visualizador',
      editor: 'Editor',
      admin: 'Administrador',
    };
    showNotice(`Acesso do cargo "${roleName}" alterado para: ${levelLabels[level] || level}.`);
  };

const setSelectedGlobalFilters = (filters: { shift?: string; teamLeader?: string }) => {
    updateLocalState((prev) => ({
      ...prev,
      selectedShiftFilter: filters.shift !== undefined ? filters.shift : prev.selectedShiftFilter,
      selectedTLFilter: filters.teamLeader !== undefined ? filters.teamLeader : prev.selectedTLFilter,
    }));
  };

  const setAbsenteeismPeriodDays = (days: number) => {
    const normalized = Math.min(90, Math.max(7, Math.round(days) || 30));
    updateLocalState((prev) => ({
      ...prev,
      absenteeismPeriodDays: normalized,
    }));
    showNotice(`Período de cálculo do absenteísmo definido para ${normalized} dias.`);
  };

  const setModuleVisibility = (modules: {
    showBriefingSlide?: boolean;
    showEmployeePortal?: boolean;
    showOperatorPortal?: boolean;
    showInfoHub?: boolean;
    showRadioModule?: boolean;
    showWidgetsModule?: boolean;
  }) => {
    updateLocalState((prev) => {
      const nextWidgetsConfig = {
        ...(prev.widgetsConfig || {
          enabled: true,
          showCalendarWidget: true,
          showInfoHubWidget: true,
          showStatsWidget: true,
          showRequestsWidget: true,
          showRadioWidget: true,
          dashboardWidgets: ['calendar', 'info_hub', 'stats', 'requests'],
        }),
        ...(modules.showWidgetsModule !== undefined ? { enabled: modules.showWidgetsModule } : {}),
      };

      return {
        ...prev,
        showBriefingSlide: modules.showBriefingSlide !== undefined ? modules.showBriefingSlide : prev.showBriefingSlide,
        showEmployeePortal: modules.showEmployeePortal !== undefined ? modules.showEmployeePortal : prev.showEmployeePortal,
        showOperatorPortal: modules.showOperatorPortal !== undefined ? modules.showOperatorPortal : prev.showOperatorPortal,
        showInfoHub: modules.showInfoHub !== undefined ? modules.showInfoHub : prev.showInfoHub,
        showRadioModule: modules.showRadioModule !== undefined ? modules.showRadioModule : prev.showRadioModule,
        showWidgetsModule: modules.showWidgetsModule !== undefined ? modules.showWidgetsModule : prev.showWidgetsModule,
        widgetsConfig: nextWidgetsConfig,
      };
    });
    showNotice('Visibilidade dos módulos atualizada com sucesso.');
  };

  const setPortalNameAbbreviation = (value: boolean) => {
    updateLocalState((prev) => ({
      ...prev,
      abbreviatePortalNames: value,
    }));
    showNotice(value ? 'Nomes abreviados ativados no Portal da Base.' : 'Nomes completos no Portal da Base.');
  };

  const setCustomShortcuts = (shortcuts: Record<string, string>) => {
    updateLocalState((prev) => ({
      ...prev,
      customShortcuts: shortcuts,
    }));
    showNotice('Atalhos de teclado atualizados!');
  };

  const setSidebarOrder = (order: string[]) => {
    updateLocalState((prev) => ({
      ...prev,
      sidebarOrder: order,
    }));
    showNotice('Ordem do menu lateral atualizada!');
  };

  const toggleSidebarItemHidden = (itemId: string) => {
    updateLocalState((prev) => {
      const current = prev.hiddenSidebarItems || [];
      const isHidden = current.includes(itemId);
      const nextHidden = isHidden ? current.filter((id) => id !== itemId) : [...current, itemId];
      return {
        ...prev,
        hiddenSidebarItems: nextHidden,
      };
    });
  };

  const setHiddenSidebarItems = (items: string[]) => {
    updateLocalState((prev) => ({
      ...prev,
      hiddenSidebarItems: items,
    }));
    showNotice('Visibilidade dos itens do menu lateral atualizada!');
  };

  const updateWidgetsConfig = (config: Partial<AppWidgetsConfig>) => {
    updateLocalState((prev) => {
      const nextWidgetsConfig = {
        ...(prev.widgetsConfig || {
          enabled: true,
          showCalendarWidget: true,
          showInfoHubWidget: true,
          showStatsWidget: true,
          showRequestsWidget: true,
          showRadioWidget: true,
          dashboardWidgets: ['calendar', 'info_hub', 'stats', 'requests'],
        }),
        ...config,
      };
      return {
        ...prev,
        showWidgetsModule: nextWidgetsConfig.enabled !== false,
        widgetsConfig: nextWidgetsConfig,
      };
    });
    showNotice('Configurações de Widgets salvas com sucesso!');
  };

  const resetNavigationSettings = () => {
    updateLocalState((prev) => ({
      ...prev,
      customShortcuts: {},
      sidebarOrder: [
        'presence',
        'operator_portal',
        'employee',
        'assignment',
        'breaks',
        'share',
        'calendar',
        'team',
        'info_hub',
        'briefing',
        'requests',
        'report',
        'home',
        'settings',
        'help',
      ],
    }));
    showNotice('Navegação e atalhos restaurados para o padrão.');
  };

  const setSkillLevel = (collaboratorId: string, skill: string, level: number) => {
    updateLocalState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.map((c) => {
        if (c.id === collaboratorId) {
          return {
            ...c,
            skills: { ...(c.skills || {}), [skill]: level },
          };
        }
        return c;
      }),
    }));
  };

  const addCollabNote = (collaboratorId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    updateLocalState((prev) => ({
      ...prev,
      tempNotes: {
        ...(prev.tempNotes || {}),
        [collaboratorId]: [
          ...(prev.tempNotes?.[collaboratorId] || []),
          { id: generateId(), text: trimmed, createdAt: new Date().toISOString() },
        ],
      },
    }));
    showNotice('Lembrete adicionado.');
  };

  const removeCollabNote = (collaboratorId: string, noteId: string) => {
    updateLocalState((prev) => ({
      ...prev,
      tempNotes: {
        ...(prev.tempNotes || {}),
        [collaboratorId]: (prev.tempNotes?.[collaboratorId] || []).filter((n) => n.id !== noteId),
      },
    }));
  };

  const bulkSetSkillLevel = (ids: string[], skill: string, level: number) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    updateLocalState((prev) => ({
      ...prev,
      collaborators: prev.collaborators.map((c) =>
        idSet.has(c.id)
          ? {
              ...c,
              skills: { ...(c.skills || {}), [skill]: level },
            }
          : c
      ),
    }));
  };

  const setAbsenceReason = (collaboratorId: string, reason: string) => {
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const dayReport = prev.dailyReports[dateKey] || {};
      return {
        ...prev,
        dailyReports: {
          ...prev.dailyReports,
          [dateKey]: {
            ...dayReport,
            absenceReasons: {
              ...(dayReport.absenceReasons || {}),
              [collaboratorId]: reason,
            },
          },
        },
      };
    });
  };

  const setOccurrence = (collaboratorId: string, text: string) => {
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const dayReport = prev.dailyReports[dateKey] || {};
      return {
        ...prev,
        dailyReports: {
          ...prev.dailyReports,
          [dateKey]: {
            ...dayReport,
            occurrences: {
              ...(dayReport.occurrences || {}),
              [collaboratorId]: text,
            },
          },
        },
      };
    });
  };

  const setGeneralNotes = (notes: string) => {
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const dayReport = prev.dailyReports[dateKey] || {};
      return {
        ...prev,
        dailyReports: {
          ...prev.dailyReports,
          [dateKey]: {
            ...dayReport,
            generalNotes: notes,
          },
        },
      };
    });
  };

  const deleteDailyReport = (dateKey: string) => {
    updateLocalState((prev) => {
      const nextReports = { ...prev.dailyReports };
      delete nextReports[dateKey];
      return {
        ...prev,
        dailyReports: nextReports,
      };
    });
    showNotice(`Relatório de ${formatDateBR(dateKey)} removido.`);
  };

  const saveDailyReport = () => {
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const dayReport = prev.dailyReports[dateKey] || {};
      let totalPresent = 0;
      let totalAbsent = 0;
      let scheduledWorkforce = 0;

      const snapshot = prev.collaborators.map((c) => {
        const st = getCollaboratorStatus(c, dateKey, prev);
        const status = st.status;

        if (status === 'presente' || status === 'atraso') {
          totalPresent++;
        }
        if (status !== 'folga' && status !== 'ferias') {
          scheduledWorkforce++;
          if (status !== 'presente' && status !== 'atraso') {
            totalAbsent++;
          }
        }

        const task = prev.tasks.find((t) => (t.members || []).includes(c.id))?.name || 'Não dimensionado';
        const dayInt = prev.intervals[dateKey] || {};
        const breakSlot = prev.breaks.find((b) => (dayInt[b.id] || []).includes(c.id))?.time || 'Sem intervalo';

        const absenceReason =
          dayReport.absenceReasons?.[c.id] ||
          (st.absenceDetail ? `${st.absenceDetail.type}: ${st.absenceDetail.notes || ''}`.trim() : '') ||
          st.absenceReason ||
          '';

        const occurrence = dayReport.occurrences?.[c.id] || '';

        return {
          id: c.id,
          name: c.name,
          role: c.role || 'Operador',
          shift: c.shift || prev.teamShift || 'T1',
          scale: c.scale || 'A',
          teamLeader: c.teamLeader || prev.defaultTeamLeader || 'Geral',
          status,
          task,
          interval: breakSlot,
          absenceReason,
          occurrence,
        };
      });

      const absenteeismRate =
        scheduledWorkforce > 0
          ? Math.round((totalAbsent / scheduledWorkforce) * 1000) / 10
          : 0;

      return {
        ...prev,
        dailyReports: {
          ...prev.dailyReports,
          [dateKey]: {
            ...dayReport,
            generatedAt: new Date().toLocaleString('pt-BR'),
            snapshot,
            totalPresent,
            totalAbsent,
            totalHeadcount: prev.collaborators.length,
            absenteeismRate,
          },
        },
      };
    });
    showNotice('Relatório diário salvo com sucesso.');
  };

  const saveHistory = () => {
    updateLocalState((prev) => {
      const dateKey = prev.selectedDate;
      const presentCount = prev.collaborators.filter((c) => {
        const hasAbsence = (c.absences || []).some((a) => dateKey >= a.startDate && dateKey <= a.endDate);
        const off = isScaleOff(prev.calendar, dateKey, c.scale);
        const manual = prev.attendance[dateKey]?.[c.id];
        if (hasAbsence || off) return false;
        return manual !== false;
      }).length;

      const vacationCount = prev.collaborators.filter((c) =>
        (c.absences || []).some((a) => dateKey >= a.startDate && dateKey <= a.endDate && a.type === 'ferias')
      ).length;

      const leaveCount = prev.collaborators.filter((c) =>
        (c.absences || []).some((a) => dateKey >= a.startDate && dateKey <= a.endDate && a.type === 'licenca')
      ).length;

      const trainingCount = prev.collaborators.filter((c) =>
        (c.absences || []).some((a) => dateKey >= a.startDate && dateKey <= a.endDate && a.type === 'treinamento')
      ).length;

      const newItem = {
        id: generateId(),
        date: dateKey,
        peoplePresent: presentCount,
        peopleVacation: vacationCount,
        peopleLeave: leaveCount,
        peopleTraining: trainingCount,
        timestamp: new Date().toLocaleString('pt-BR'),
      };

      return {
        ...prev,
        history: [...prev.history, newItem],
      };
    });
    showNotice('Resumo diário gravado no histórico.');
  };

  const importFullStateWithBackup = (
    newStateCandidate: Partial<AppState> | any,
    mode: 'full' | 'config_only' = 'full',
    createSafetyBackup: boolean = true
  ) => {
    if (createSafetyBackup) {
      createAutoBackup(
        `Backup de Segurança Pré-Importação (${mode === 'config_only' ? 'Somente Estrutura' : 'Substituição Completa'})`
      );
    }

    const currentState = stateRef.current || state;
    const normalizedNewState = normalizeAppState(newStateCandidate, currentState);

    const isExampleSpreadsheet =
      normalizedNewState.onlineSpreadsheet?.url?.includes('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');

    const importedSpreadsheet = isExampleSpreadsheet ? null : normalizedNewState.onlineSpreadsheet || null;

    const nowMs = Date.now();
    lastSyncedTimestampMs.current = nowMs;
    try { localStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, String(nowMs)); } catch {}
    lastRemoteCollaboratorCount.current = normalizedNewState.collaborators.length;

    let finalStateToApply: AppState;

    if (mode === 'config_only') {
      finalStateToApply = {
        ...currentState,
        teamName: normalizedNewState.teamName || currentState.teamName,
        location: normalizedNewState.location || currentState.location,
        sector: normalizedNewState.sector || currentState.sector,
        manager: normalizedNewState.manager || currentState.manager,
        teamShift: normalizedNewState.teamShift || currentState.teamShift,
        shifts: normalizedNewState.shifts.length > 0 ? normalizedNewState.shifts : currentState.shifts,
        scaleType: normalizedNewState.scaleType || currentState.scaleType,
        scaleGroups: normalizedNewState.scaleGroups.length > 0 ? normalizedNewState.scaleGroups : currentState.scaleGroups,
        calendar: normalizedNewState.calendar || currentState.calendar,
        setupCompleted: true,
        defaultTeamLeader: normalizedNewState.defaultTeamLeader || currentState.defaultTeamLeader,
        teamLeaders: normalizedNewState.teamLeaders.length > 0 ? normalizedNewState.teamLeaders : currentState.teamLeaders,
        roles: normalizedNewState.roles.length > 0 ? normalizedNewState.roles : currentState.roles,
        categories: normalizedNewState.categories.length > 0 ? normalizedNewState.categories : currentState.categories,
        skills: normalizedNewState.skills.length > 0 ? normalizedNewState.skills : currentState.skills,
        tasks: normalizedNewState.tasks.length > 0 ? normalizedNewState.tasks : currentState.tasks,
        breaks: normalizedNewState.breaks.length > 0 ? normalizedNewState.breaks : currentState.breaks,
        theme: normalizedNewState.theme || currentState.theme,
        briefingConfig: normalizedNewState.briefingConfig || currentState.briefingConfig,
        processKnowledgeList: normalizedNewState.processKnowledgeList.length > 0 ? normalizedNewState.processKnowledgeList : currentState.processKnowledgeList,
        onlineSpreadsheet: importedSpreadsheet || currentState.onlineSpreadsheet,
        updatedAtMs: nowMs,
      };
    } else {
      finalStateToApply = {
        ...normalizedNewState,
        onlineSpreadsheet: importedSpreadsheet || currentState.onlineSpreadsheet,
        isSampleData: false,
        setupCompleted: true,
        updatedAtMs: nowMs,
      };
    }

    stateRef.current = finalStateToApply;
    setState(finalStateToApply);

    if (mode === 'config_only') {
      showNotice(
        'Estrutura e parâmetros importados com sucesso! Seus colaboradores e registros presenciais foram mantidos intactos.'
      );
    } else {
      showNotice(
        `Backup restaurado com sucesso! (${finalStateToApply.collaborators.length} colaboradores, ${finalStateToApply.tasks.length} postos de trabalho).`
      );
    }

    // Se houver planilha online configurada, envia os dados imediatamente
    const targetSpreadsheet = finalStateToApply.onlineSpreadsheet;
    if (targetSpreadsheet && targetSpreadsheet.webhookUrl) {
      setTimeout(() => {
        syncToConfig(targetSpreadsheet, false);
      }, 300);
    }
  };

  const importFullState = (newState: Partial<AppState>) => {
    importFullStateWithBackup(newState, 'full', true);
  };

  const importRosterRows = (rows: any[], options?: { replaceAll?: boolean; formatNames?: boolean }) => {
    let count = 0;
    updateLocalState((prev) => {
      const newCols = options?.replaceAll ? [] : [...prev.collaborators];
      const newRoles = new Set(prev.roles);
      const newCats = new Set(prev.categories);
      const newTLs = new Set(prev.teamLeaders || []);

      rows.forEach((row) => {
        let name = row.name ? String(row.name).trim() : '';
        let registration = row.registration ? String(row.registration).trim() : '';
        let login = row.login ? String(row.login).trim() : '';
        let shift = row.shift ? String(row.shift).trim() : '';
        let scale = row.scale ? String(row.scale).trim() : '';
        let role = row.role ? String(row.role).trim() : '';
        let category = row.category ? String(row.category).trim() : '';
        let teamLeader = row.teamLeader ? String(row.teamLeader).trim() : '';
        let notes = row.notes ? String(row.notes).trim() : '';

        // Fallback key lookup if row is raw unmapped object
        if (!name) {
          const getVal = (...keys: string[]) => {
            const foundKey = Object.keys(row).find((k) => keys.includes(k.trim().toLowerCase()));
            return foundKey ? String(row[foundKey]).trim() : '';
          };
          name = getVal('nome', 'colaborador', 'name');
          if (!name) return;
          registration = getVal('re', 're (matrícula)', 're (matricula)', 'matrícula', 'matricula', 'id', 'reg');
          login = getVal('ldap', 'login', 'login amazon', 'user');
          shift = getVal('turno', 'shift');
          scale = getVal('escala', 'scale');
          role = getVal('cargo', 'função', 'funcao', 'role');
          category = getVal('categoria', 'category');
          teamLeader = getVal('team leader', 'tl', 'time');
          notes = getVal('observação', 'observacao', 'notes');
        }

        if (!name) return;

        if (options?.formatNames !== false) {
          name = formatPersonName(name);
        }

        role = role || 'Operador de Processo';
        category = category || 'Inbound';
        shift = shift || prev.teamShift || 'T2';
        scale = (scale || 'A').toUpperCase() as ShiftGroup;

        if (role) newRoles.add(role);
        if (category) newCats.add(category);
        if (teamLeader && teamLeader !== 'Sem Time' && teamLeader !== 'Geral') newTLs.add(teamLeader);

        const existingIdx = !options?.replaceAll
          ? newCols.findIndex(
              (c) =>
                (registration && c.registration && c.registration.toLowerCase() === registration.toLowerCase()) ||
                (login && c.login && c.login.toLowerCase() === login.toLowerCase())
            )
          : -1;

        if (existingIdx >= 0) {
          newCols[existingIdx] = {
            ...newCols[existingIdx],
            name,
            registration: registration || newCols[existingIdx].registration,
            login: login || newCols[existingIdx].login,
            shift: shift || newCols[existingIdx].shift,
            scale: scale || newCols[existingIdx].scale,
            role: role || newCols[existingIdx].role,
            category: category || newCols[existingIdx].category,
            teamLeader: teamLeader || newCols[existingIdx].teamLeader,
            notes: notes || newCols[existingIdx].notes,
          };
        } else {
          newCols.push({
            id: generateId(),
            name,
            login,
            registration,
            shift,
            scale,
            role,
            category,
            teamLeader,
            skills: {},
            notes,
            absences: [],
          });
        }
        count++;
      });

      const updatedShiftMap = { ...(prev.teamShiftMap || {}) };
      newTLs.forEach((tl) => {
        if (!updatedShiftMap[tl]) {
          const match = tl.match(/\((T[1-9]|Noite|ADM)\)/i);
          updatedShiftMap[tl] = match ? match[1].toUpperCase() : prev.teamShift || 'T1';
        }
      });

      const syncedCols = newCols.map((c) => {
        if (c.teamLeader && updatedShiftMap[c.teamLeader]) {
          return { ...c, shift: updatedShiftMap[c.teamLeader] };
        }
        return c;
      });

      return {
        ...prev,
        collaborators: syncedCols,
        roles: Array.from(newRoles),
        categories: Array.from(newCats),
        teamLeaders: Array.from(newTLs),
        teamShiftMap: updatedShiftMap,
        isSampleData: false,
      };
    });
    showNotice(`${count} colaborador(es) importados com sucesso.`);
    return count;
  };

  const resetAllData = () => {
    // Automatically create a backup snapshot before resetting
    const backupInfo = createAutoBackup('Backup de emergência automático pré-reset');

    getAppStorage().removeItem(STORAGE_KEY);
    updateLocalState(() => ({
      ...initialAppState,
      selectedDate: getTodayISO(),
      isSampleData: false,
    }));

    const timeDetail = backupInfo ? ` (Backup automático gravado às ${backupInfo.formattedDate})` : '';
    showNotice(
      `Dados locais da aplicação limpos com sucesso!${timeDetail}. Seus dados de planilha online foram preservados.`,
      'Restaurar Backup',
      () => restoreFromAutoBackup()
    );
  };

  const clearSampleData = () => {
    createAutoBackup('Backup de segurança antes de limpar todos os dados cadastrados');
    updateLocalState((prev) => ({
      ...prev,
      location: '',
      teamName: '',
      sector: '',
      manager: '',
      teamShift: '',
      shifts: [],
      scaleGroups: [],
      calendar: {},
      shiftConfigs: {},
      collaborators: [],
      deletedCollaborators: [],
      tasks: [],
      breaks: [],
      roles: [],
      rolePermissions: {},
      roleTypes: {},
      editorRoles: [],
      categories: [],
      skills: [],
      teamLeaders: [],
      teams: [],
      teamShiftMap: {},
      defaultTeamLeader: '',
      attendance: {},
      intervals: {},
      history: [],
      dailyReports: {},
      processKnowledgeList: [],
      infoHubLinks: [],
      infoHubQuickFills: [],
      scheduledTasks: [],
      serviceRequests: [],
      isSampleData: false,
      setupCompleted: false,
    }));
    showNotice('Todos os dados cadastrados e exemplos foram removidos! O sistema está pronto e limpo para sua operação.', 'Configurar Agora', () => openSetupWizard());
  };

  const loadSampleBackupData = async () => {
    createAutoBackup('Backup de segurança antes de carregar dados de exemplo');
    let loadedState: any = null;
    try {
      const res = await fetch('/backup_exemplos_dimensio.json');
      if (res.ok) {
        loadedState = await res.json();
      }
    } catch (err) {
      console.warn('Não foi possível carregar via fetch, usando fallback interno:', err);
    }

    const stateToApply = loadedState || SAMPLE_BACKUP_STATE;
    const normalized = normalizeAppState(stateToApply);
    updateLocalState(() => ({
      ...normalized,
      selectedDate: getTodayISO(),
      updatedAtMs: Date.now(),
    }));
    showNotice('Dados de exemplo e testes carregados com sucesso! (Colaboradores, turnos, escalas, cargos, postos e intervalos de exemplo)');
  };

  const downloadSampleBackupFile = async () => {
    try {
      let dataStr = '';
      try {
        const res = await fetch('/backup_exemplos_dimensio.json');
        if (res.ok) {
          const json = await res.json();
          dataStr = JSON.stringify(json, null, 2);
        }
      } catch {
        // Fallback
      }
      if (!dataStr) {
        dataStr = JSON.stringify(SAMPLE_BACKUP_STATE, null, 2);
      }
      const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_exemplos_dimensio_${getTodayISO()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotice('Arquivo de backup com exemplos baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao baixar backup de exemplos:', err);
    }
  };

  const exportTeamRosterSpreadsheet = () => {
    if (!state.collaborators || state.collaborators.length === 0) {
      generateTemplateSpreadsheet();
      return;
    }

    let csv = '\uFEFF';
    csv += 'RE (Matrícula);Nome;LDAP;Setor;Gestor;Turno;Team Leader / Time;Escala;Cargo;Categoria;Observações\n';

    state.collaborators.forEach((col) => {
      const tlName = col.teamLeader || state.defaultTeamLeader || 'Sem Time';
      csv += `"${col.registration || ''}";"${col.name}";"${col.login || ''}";"${state.sector || ''}";"${state.manager || ''}";"${col.shift || state.teamShift || 'Geral'}";"${tlName}";"${col.scale}";"${col.role}";"${col.category}";"${col.notes || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planilha-equipe-${(state.teamName || 'equipe').replace(/\s+/g, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(`Planilha com dados preenchidos de ${state.collaborators.length} colaborador(es) exportada em .CSV!`);
  };

  const exportLocalSpreadsheet = () => {
    const activeDate = state.selectedDate;
    const formattedDate = formatDateBR(activeDate);

    // CSV Header with BOM for Excel UTF-8 Portuguese character support
    let csv = '\uFEFF';
    csv += 'Data (DD/MM/AAAA);RE (Matrícula);Nome do Colaborador;LDAP;Setor;Gestor;Turno;Team Leader / Time;Escala;Cargo;Categoria;Status no Dia;Tarefa Operacional;Horário de Refeição;Habilidades\n';

    state.collaborators.forEach((col) => {
      const st = getCollaboratorStatus(col, activeDate, state);
      const taskName = state.tasks.find((t) => t.members.includes(col.id))?.name || 'Não Dimensionado';
      const dayInt = state.intervals[activeDate] || {};
      const breakSlot = state.breaks.find((b) => (dayInt[b.id] || []).includes(col.id))?.time || 'Sem Intervalo';
      const skillsStr = col.skills && Object.keys(col.skills).length > 0 ? Object.keys(col.skills).join(', ') : 'Nenhuma';
      const tlName = col.teamLeader || state.defaultTeamLeader || 'Geral';

      let statusLabel = 'Presente';
      if (st.status === 'folga') statusLabel = 'Folga (6x2)';
      else if (st.status === 'ferias') statusLabel = 'Férias';
      else if (st.status === 'licenca') statusLabel = 'Licença Médica';
      else if (st.status === 'treinamento') statusLabel = 'Treinamento';
      else if (st.status === 'ausente') statusLabel = 'Ausente (Falta)';

      csv += `"${formattedDate}";"${col.registration || ''}";"${col.name}";"${col.login || ''}";"${state.sector}";"${state.manager}";"${col.shift || state.teamShift}";"${tlName}";"${col.scale}";"${col.role}";"${col.category}";"${statusLabel}";"${taskName}";"${breakSlot}";"${skillsStr}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escala-local-${state.teamName.replace(/\s+/g, '_')}-${formattedDate.replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(`Planilha local baixada com sucesso (${formattedDate}).`);
  };

  const generateTemplateSpreadsheet = () => {
    let csv = '\uFEFF';
    csv += 'RE (Matrícula);Nome;LDAP;Setor;Gestor;Turno;Team Leader / Time;Escala;Cargo;Categoria;Observações\n';
    csv += 'RE-1001;João Silva;joaos;Recebimento;Carlos Santos;T2;Time do TL Bruno;A;Operador de Processo;Inbound;Colaborador T2\n';
    csv += 'RE-1002;Maria Oliveira;mariao;Recebimento;Carlos Santos;T2;Time da TL Mariana;B;Analista de Qualidade;ICQA;Líder de Turno\n';

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template-modelo-banco-de-dados-equipe.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showNotice(`Planilha modelo baixada para criação de banco de dados no Google Sheets.`);
  };

  const setOnlineSpreadsheetConfig = (config: OnlineSpreadsheetConfig | null, forcePull = false) => {
    // If the user connects a DIFFERENT spreadsheet (different URL) than the one
    // we last synced with, reset the "last synced timestamp". Otherwise the
    // fresh/empty spreadsheet is treated as "already synced" and the bootstrap
    // push (local -> spreadsheet) never runs — the app keeps reporting
    // "A planilha está vazia" even when the user has real local data.
    const prevUrl = state.onlineSpreadsheet?.url;
    const prevWebhook = state.onlineSpreadsheet?.webhookUrl;
    const nextUrl = config?.url;
    const nextWebhook = config?.webhookUrl;
    if (
      config &&
      ((nextUrl && prevUrl !== nextUrl) || (nextWebhook && prevWebhook !== nextWebhook))
    ) {
      lastSyncedTimestampMs.current = 0;
      try { localStorage.removeItem(LAST_SYNCED_TIMESTAMP_KEY); } catch {}
    }
    updateLocalState((prev) => ({ ...prev, onlineSpreadsheet: config }));
    if (config) {
      showNotice(
        config.webhookUrl
          ? `Planilha "${config.name}" conectada com sucesso! Sincronizando dados em tempo real...`
          : `Planilha "${config.name}" conectada. Para sincronizar dados em tempo real, configure o Webhook do Apps Script.`
      );
      if (config.webhookUrl) {
        setTimeout(() => {
          fetchFromConfig(config, false, forcePull);
        }, 300);
      }
    } else {
      showNotice('Planilha online desconectada.');
    }
  };

  const updateBriefingConfig = (updates: Partial<BriefingConfig>) => {
    updateLocalState((prev) => ({
      ...prev,
      briefingConfig: {
        ...(prev.briefingConfig || {}),
        ...updates,
      },
    }));
  };

  const updateFeedbackConfig = (updates: Partial<FeedbackConfig>) => {
    updateLocalState((prev) => ({
      ...prev,
      feedbackConfig: {
        ...(prev.feedbackConfig || {}),
        ...updates,
      },
    }));
  };

  const updateExtensionConfig = (updates: Partial<ExtensionConfig>) => {
    updateLocalState((prev) => {
      const merged: ExtensionConfig = {
        ...(prev.extensionConfig || {}),
        ...updates,
      };
      // Notifica a extensão conectada
      try {
        dispatchExtensionConfig(merged);
      } catch {
        // Safe catch
      }
      return {
        ...prev,
        extensionConfig: merged,
      };
    });
  };

  // AUDIT LOG HELPER WITH ROLLBACK SUPPORT
  const addAuditLog = (
    actionType: AuditLogEntry['actionType'],
    description: string,
    dateStr?: string,
    details?: any,
    includeSnapshot: boolean = true
  ) => {
    // Capture state snapshot for restore capability
    const snapshot: Partial<AppState> | undefined = includeSnapshot ? {
      collaborators: state.collaborators,
      tasks: state.tasks,
      breaks: state.breaks,
      attendance: state.attendance,
      intervals: state.intervals,
      roles: state.roles,
      categories: state.categories,
      skills: state.skills,
      teamLeaders: state.teamLeaders,
      calendar: state.calendar,
      selectedDate: state.selectedDate,
      editorRoles: state.editorRoles,
      autoBackupSettings: state.autoBackupSettings,
      teamName: state.teamName,
      location: state.location,
      sector: state.sector,
      manager: state.manager,
      teamShift: state.teamShift,
      shifts: state.shifts,
      scaleType: state.scaleType,
      scaleGroups: state.scaleGroups,
    } : undefined;

    const entry: AuditLogEntry = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      userName: identifiedUser?.name || 'Sistema / Anônimo',
      userId: identifiedUser?.id,
      userRole: identifiedUser?.role,
      actionType,
      action: actionType,
      description,
      dateStr: dateStr || state.selectedDate,
      details,
      snapshot,
    };

    updateLocalState((prev) => {
      const logs = [entry, ...(prev.auditLogs || [])].slice(0, 300); // Keep max 300 entries
      return { ...prev, auditLogs: logs };
    });
  };

  const restoreFromAuditLog = (logId: string): boolean => {
    const entry = (state.auditLogs || []).find((l) => l.id === logId);
    if (!entry) {
      showNotice('Registro de alteração não encontrado.');
      return false;
    }

    if (!entry.snapshot) {
      showNotice('Este registro do histórico não possui um snapshot de estado gravado.');
      return false;
    }

    // Safety backup of current state before rollback
    createAutoBackup(`Ponto de Segurança Pré-Reversão (Histórico: ${entry.description})`);

    const formattedDate = new Date(entry.timestamp).toLocaleString('pt-BR');

    // Apply saved snapshot
    updateLocalState((prev) => ({
      ...prev,
      ...entry.snapshot,
      updatedAtMs: Date.now(),
    }));

    addAuditLog(
      'configuracao',
      `Reverteu o estado do sistema para a versão de ${formattedDate} ("${entry.description}")`,
      undefined,
      undefined,
      false
    );

    showNotice(`Sistema revertido com sucesso para o estado registrado em ${formattedDate}!`);
    return true;
  };

  const clearAuditLogs = () => {
    updateLocalState((prev) => ({ ...prev, auditLogs: [] }));
    showNotice('Histórico de alterações (Audit Log) foi limpo.');
  };

  // IDENTIFICATION & USER PASSWORDS
  const identifyUser = (collaboratorIdOrAdmin: string, passwordInput?: string) => {
    if (collaboratorIdOrAdmin === 'super_admin') {
      const savedPass = state.userPasswords?.['super_admin'];
      if (savedPass && passwordInput !== savedPass) {
        return { success: false, message: 'Senha incorreta para a conta de Administrador Geral.' };
      }
      const superAdminUser: IdentifiedUser = {
        id: 'super_admin',
        name: 'Administrador Geral (Gestor Operacional)',
        role: 'Administrador Geral',
        isEditor: true,
        isAdmin: true,
        isSuperAdmin: true,
        identifiedAt: Date.now(),
      };
      setIdentifiedUser(superAdminUser);
      addAuditLog('configuracao', 'Identificou-se no sistema como Administrador Geral.');
      showNotice(`Identificação bem-sucedida: ${superAdminUser.name}`);
      return { success: true, message: `Bem-vindo, ${superAdminUser.name}!` };
    }

    if (collaboratorIdOrAdmin === 'admin' || collaboratorIdOrAdmin === 'ADMIN') {
      const savedPass = state.userPasswords?.['admin'];
      if (savedPass && passwordInput !== savedPass) {
        return { success: false, message: 'Senha incorreta para a conta de Administrador.' };
      }
      const adminUser: IdentifiedUser = {
        id: 'admin',
        name: 'Administrador (Gestor)',
        role: 'Administrador',
        shift: state.teamShift || 'T2',
        isEditor: true,
        isAdmin: true,
        identifiedAt: Date.now(),
      };
      setIdentifiedUser(adminUser);
      addAuditLog('configuracao', 'Identificou-se no sistema como Administrador (Gestor).');
      showNotice(`Identificação bem-sucedida: ${adminUser.name}`);
      return { success: true, message: `Bem-vindo, ${adminUser.name}!` };
    }

    let col = state.collaborators.find((c) => c.id === collaboratorIdOrAdmin);
    if (!col) {
      // Fallback: match by exact name
      col = state.collaborators.find((c) => c.name.trim().toLowerCase() === collaboratorIdOrAdmin.trim().toLowerCase());
    }

    // If not found in collaborators, check if it is a TL from teamLeaders or defaultTeamLeader
    let tlName: string | undefined;
    if (!col) {
      if (collaboratorIdOrAdmin.startsWith('tl_')) {
        const rawTlKey = collaboratorIdOrAdmin.replace(/^tl_/, '').replace(/_/g, ' ').toLowerCase();
        tlName = (state.teamLeaders || []).find(
          (t) => t.trim().toLowerCase() === rawTlKey
        ) || (state.defaultTeamLeader && state.defaultTeamLeader.trim().toLowerCase() === rawTlKey ? state.defaultTeamLeader : undefined);
      } else {
        tlName = (state.teamLeaders || []).find(
          (t) => t.trim().toLowerCase() === collaboratorIdOrAdmin.trim().toLowerCase()
        ) || (state.defaultTeamLeader && state.defaultTeamLeader.trim().toLowerCase() === collaboratorIdOrAdmin.trim().toLowerCase() ? state.defaultTeamLeader : undefined);
      }
    }

    if (!col && !tlName) {
      return { success: false, message: 'Colaborador ou Líder não encontrado no sistema.' };
    }

    const userId = col ? col.id : `tl_${tlName!.replace(/\s+/g, '_').toLowerCase()}`;
    const userName = col ? col.name : tlName!;
    const userRole = col ? col.role : 'TL';
    const userShift = col?.shift || (tlName ? state.teamShiftMap?.[tlName] : undefined) || state.teamShift || 'T2';
    const userTeamLeader = col?.teamLeader || (tlName ? tlName : undefined);

    const savedPass = state.userPasswords?.[userId] || (col?.id ? state.userPasswords?.[col.id] : undefined);
    
    // Check sector password policy
    if (state.requireUserPassword && !savedPass && !passwordInput) {
      return { success: false, message: 'É obrigatório definir ou informar uma senha para se identificar neste setor.' };
    }

    if (savedPass && passwordInput !== savedPass) {
      return { success: false, message: 'Senha incorreta para o usuário informado.' };
    }

    // Auto-save new password if provided when setting initial password
    if (passwordInput && !savedPass) {
      setUserPassword(userId, passwordInput);
    }

    const userRolePermission = state.rolePermissions?.[userRole];
    let isEditorRole = false;
    let isAdminRole = false;
    let userAccessLevel: RoleAccessLevel = 'portal';

    if (userRolePermission) {
      userAccessLevel = userRolePermission;
      if (userRolePermission === 'admin') {
        isAdminRole = true;
        isEditorRole = true;
      } else if (userRolePermission === 'editor') {
        isEditorRole = true;
      }
    } else {
      const editorRoles = state.editorRoles || ['TL', 'PS'];
      isEditorRole = editorRoles.includes(userRole) || userRole === 'TL' || userRole === 'Admin';
      isAdminRole = userRole === 'TL' || userRole === 'Admin';
      userAccessLevel = isAdminRole ? 'admin' : isEditorRole ? 'editor' : 'portal';
    }

    const userSector = col?.sector || state.sector || 'Operação';
    const userAllowedSectors = col?.allowedSectors || [];
    const userCanCrossSector = col?.canProvideCrossSectorSupport ?? false;

    const user: IdentifiedUser = {
      id: userId,
      name: userName,
      role: userRole,
      shift: userShift,
      sector: userSector,
      allowedSectors: userAllowedSectors,
      canProvideCrossSectorSupport: userCanCrossSector,
      isEditor: isEditorRole,
      isAdmin: isAdminRole,
      accessLevel: userAccessLevel,
      collaboratorId: col ? col.id : userId,
      photoUrl: col?.photoUrl,
      identifiedAt: Date.now(),
    };

    setIdentifiedUser(user);

    // Auto-apply filters for user's shift & team leader upon identification
    if (userShift) {
      setSelectedGlobalFilters({
        shift: userShift,
        teamLeader: userTeamLeader || undefined,
      });
    }

    // Try fetching existing profile asynchronously from Firestore
    getUserProfileFromFirestore(userId).then((existingProf) => {
      if (existingProf) {
        setUserProfile(existingProf);
        setIdentifiedUser((curr) => {
          if (!curr || curr.id !== userId) return curr;
          return {
            ...curr,
            photoUrl: existingProf.photoUrl || curr.photoUrl,
            workStatus: existingProf.workStatus || curr.workStatus,
            sector: existingProf.sector || curr.sector,
            allowedSectors: existingProf.allowedSectors || curr.allowedSectors,
            canProvideCrossSectorSupport: existingProf.canProvideCrossSectorSupport ?? curr.canProvideCrossSectorSupport,
            isSupportAttendant: existingProf.isSupportAttendant ?? curr.isSupportAttendant,
            statusCustomMessage: existingProf.statusCustomMessage || curr.statusCustomMessage,
          };
        });
      } else {
        // Create initial profile in Firestore
        saveUserProfileToFirestore({
          uid: userId,
          displayName: userName,
          role: userRole,
          shift: userShift,
          sector: userSector,
          allowedSectors: userAllowedSectors,
          canProvideCrossSectorSupport: userCanCrossSector,
          collaboratorId: col?.id,
          photoUrl: col?.photoUrl,
          workStatus: 'disponivel',
        }).catch(() => {});
      }
    }).catch(() => {});

    addAuditLog('configuracao', `Usuário "${user.name}" (${user.role} • Setor: ${user.sector || 'Operação'}) identificou-se no sistema.`);
    showNotice(`Identificado como: ${user.name}${userShift ? ` • Turno ${userShift}` : ''}${user.sector ? ` • ${user.sector}` : ''}`);

    return { success: true, message: `Bem-vindo, ${user.name}!` };
  };

  const logoutUser = () => {
    if (identifiedUser) {
      addAuditLog('configuracao', `Usuário "${identifiedUser.name}" encerrou a sessão de identificação.`);
    }
    setIdentifiedUser(null);
    setUserProfile(null);
    showNotice('Sessão de identificação encerrada.');
  };

  const saveUserProfile = async (patch: Partial<UserProfileData>) => {
    const uid = identifiedUser?.firebaseUid || identifiedUser?.id || identifiedUser?.collaboratorId;
    if (!uid) return;

    const updatedProfile: UserProfileData = {
      uid,
      displayName: patch.displayName || identifiedUser?.name || 'Usuário',
      role: patch.role || identifiedUser?.role,
      shift: patch.shift || identifiedUser?.shift,
      sector: patch.sector !== undefined ? patch.sector : userProfile?.sector || identifiedUser?.sector || state.sector,
      allowedSectors: patch.allowedSectors !== undefined ? patch.allowedSectors : userProfile?.allowedSectors || identifiedUser?.allowedSectors,
      canProvideCrossSectorSupport: patch.canProvideCrossSectorSupport !== undefined ? patch.canProvideCrossSectorSupport : userProfile?.canProvideCrossSectorSupport ?? identifiedUser?.canProvideCrossSectorSupport,
      collaboratorId: patch.collaboratorId || identifiedUser?.collaboratorId,
      photoUrl: patch.photoUrl !== undefined ? patch.photoUrl : userProfile?.photoUrl || identifiedUser?.photoUrl,
      workStatus: patch.workStatus !== undefined ? patch.workStatus : userProfile?.workStatus || identifiedUser?.workStatus,
      statusCustomMessage: patch.statusCustomMessage !== undefined ? patch.statusCustomMessage : userProfile?.statusCustomMessage || identifiedUser?.statusCustomMessage,
      isSupportAttendant: patch.isSupportAttendant !== undefined ? patch.isSupportAttendant : userProfile?.isSupportAttendant ?? identifiedUser?.isSupportAttendant,
      preferences: {
        ...(userProfile?.preferences || {}),
        ...(patch.preferences || {}),
      },
      ...patch,
    };

    setUserProfile(updatedProfile);
    setIdentifiedUser((curr) => {
      if (!curr) return null;
      return {
        ...curr,
        name: updatedProfile.displayName,
        photoUrl: updatedProfile.photoUrl,
        workStatus: updatedProfile.workStatus,
        sector: updatedProfile.sector,
        allowedSectors: updatedProfile.allowedSectors,
        canProvideCrossSectorSupport: updatedProfile.canProvideCrossSectorSupport,
        statusCustomMessage: updatedProfile.statusCustomMessage,
        isSupportAttendant: updatedProfile.isSupportAttendant,
        role: updatedProfile.role || curr.role,
        shift: updatedProfile.shift || curr.shift,
      };
    });

    // Also update collaborator data in state if linked
    if (updatedProfile.collaboratorId) {
      updateCollaborator(updatedProfile.collaboratorId, {
        ...(updatedProfile.photoUrl ? { photoUrl: updatedProfile.photoUrl } : {}),
        ...(updatedProfile.sector ? { sector: updatedProfile.sector } : {}),
        ...(updatedProfile.allowedSectors ? { allowedSectors: updatedProfile.allowedSectors } : {}),
        ...(updatedProfile.canProvideCrossSectorSupport !== undefined ? { canProvideCrossSectorSupport: updatedProfile.canProvideCrossSectorSupport } : {}),
      });
    }

    await saveUserProfileToFirestore(updatedProfile);
    showNotice('Perfil e preferências salvos com sucesso!');
  };

  const addRegisteredSector = (sectorName: string) => {
    const clean = sectorName.trim();
    if (!clean) return;
    updateLocalState((prev) => {
      const current = prev.registeredSectors || [];
      if (current.includes(clean)) return prev;
      return {
        ...prev,
        registeredSectors: [...current, clean],
      };
    });
    showNotice(`Setor "${clean}" adicionado aos setores cadastrados.`);
  };

  const removeRegisteredSector = (sectorName: string) => {
    const clean = sectorName.trim();
    if (!clean) return;
    updateLocalState((prev) => {
      const cleanLower = clean.toLowerCase();
      const updatedRegistered = (prev.registeredSectors || []).filter(
        (s) => s.trim().toLowerCase() !== cleanLower
      );
      const updatedDefs = (prev.sectorDefinitions || []).filter(
        (d) => d.name.trim().toLowerCase() !== cleanLower && d.id !== clean
      );
      let newActiveSector = prev.sector;
      let newManager = prev.manager;
      let newDefaultTL = prev.defaultTeamLeader;

      if (prev.sector && prev.sector.trim().toLowerCase() === cleanLower) {
        newActiveSector = updatedDefs[0]?.name || updatedRegistered[0] || '';
        const fallbackDef = updatedDefs.find((d) => d.name.toLowerCase() === newActiveSector.toLowerCase());
        newManager = fallbackDef?.manager || '';
        newDefaultTL = fallbackDef?.defaultTeamLeader || '';
      }

      return {
        ...prev,
        sector: newActiveSector,
        manager: newManager,
        defaultTeamLeader: newDefaultTL,
        registeredSectors: updatedRegistered,
        sectorDefinitions: updatedDefs,
      };
    });
    addAuditLog('configuracao', `Removeu setor: ${clean}`);
    showNotice(`Setor "${clean}" removido.`);
  };

  const addSectorDefinition = (sector: Omit<SectorDefinition, 'id' | 'createdAt'> & { id?: string }) => {
    const cleanName = sector.name.trim();
    if (!cleanName) return;
    const newId = sector.id || `sec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newDef: SectorDefinition = {
      ...sector,
      id: newId,
      name: cleanName,
      createdAt: new Date().toISOString(),
    };
    updateLocalState((prev) => {
      const currentDefs = prev.sectorDefinitions || [];
      const updatedDefs = [...currentDefs.filter((d) => d.id !== newId && d.name.toLowerCase() !== cleanName.toLowerCase()), newDef];
      const registered = prev.registeredSectors || [];
      const updatedRegistered = registered.includes(cleanName) ? registered : [...registered, cleanName];
      return {
        ...prev,
        sectorDefinitions: updatedDefs,
        registeredSectors: updatedRegistered,
      };
    });
    addAuditLog('configuracao', `Cadastrou novo setor: ${cleanName}`);
    showNotice(`Setor "${cleanName}" cadastrado com sucesso.`);
  };

  const updateSectorDefinition = (id: string, updates: Partial<SectorDefinition>) => {
    updateLocalState((prev) => {
      const currentDefs = prev.sectorDefinitions || [];
      const oldDef = currentDefs.find((d) => d.id === id);
      const updatedDefs = currentDefs.map((d) => (d.id === id ? { ...d, ...updates } : d));
      let updatedRegistered = prev.registeredSectors || [];
      let updatedSector = prev.sector;
      if (updates.name && oldDef && updates.name !== oldDef.name) {
        updatedRegistered = updatedRegistered.map((s) => (s === oldDef.name ? updates.name! : s));
        if (updatedSector === oldDef.name) {
          updatedSector = updates.name;
        }
      }
      return {
        ...prev,
        sector: updatedSector,
        sectorDefinitions: updatedDefs,
        registeredSectors: updatedRegistered,
      };
    });
    showNotice('Setor atualizado com sucesso.');
  };

  const deleteSectorDefinition = (idOrName: string) => {
    const clean = idOrName.trim();
    if (!clean) return;
    updateLocalState((prev) => {
      const cleanLower = clean.toLowerCase();
      const currentDefs = prev.sectorDefinitions || [];
      const toDelete = currentDefs.find(
        (d) => d.id === clean || d.name.trim().toLowerCase() === cleanLower
      );
      const targetNameLower = toDelete ? toDelete.name.trim().toLowerCase() : cleanLower;
      const targetDisplayName = toDelete ? toDelete.name : clean;

      const updatedDefs = currentDefs.filter(
        (d) => d.id !== clean && d.name.trim().toLowerCase() !== targetNameLower
      );
      const updatedRegistered = (prev.registeredSectors || []).filter(
        (s) => s.trim().toLowerCase() !== targetNameLower && s !== clean
      );

      let newActiveSector = prev.sector;
      let newManager = prev.manager;
      let newDefaultTL = prev.defaultTeamLeader;

      if (prev.sector && (prev.sector.trim().toLowerCase() === targetNameLower || prev.sector === clean)) {
        newActiveSector = updatedDefs[0]?.name || updatedRegistered[0] || '';
        const fallbackDef = updatedDefs.find((d) => d.name.toLowerCase() === newActiveSector.toLowerCase());
        newManager = fallbackDef?.manager || '';
        newDefaultTL = fallbackDef?.defaultTeamLeader || '';
      }

      return {
        ...prev,
        sector: newActiveSector,
        manager: newManager,
        defaultTeamLeader: newDefaultTL,
        sectorDefinitions: updatedDefs,
        registeredSectors: updatedRegistered,
      };
    });
    addAuditLog('configuracao', `Excluiu setor: ${clean}`);
    showNotice(`Setor "${clean}" removido com sucesso.`);
  };

  const switchActiveSector = (sectorName: string) => {
    const clean = sectorName.trim();
    if (!clean) return;
    updateLocalState((prev) => {
      const matchedDef = (prev.sectorDefinitions || []).find((d) => d.name.toLowerCase() === clean.toLowerCase());
      return {
        ...prev,
        sector: clean,
        manager: matchedDef?.manager || prev.manager,
        defaultTeamLeader: matchedDef?.defaultTeamLeader || prev.defaultTeamLeader,
        registeredSectors: (prev.registeredSectors || []).includes(clean) ? prev.registeredSectors : [...(prev.registeredSectors || []), clean],
      };
    });
    addAuditLog('configuracao', `Alternou setor ativo para: ${clean}`);
    showNotice(`Setor ativo alterado para: ${clean}`);
  };

  const setUserSector = async (sectorName: string) => {
    await saveUserProfile({ sector: sectorName });
  };

  const setCanProvideCrossSectorSupport = async (canProvide: boolean) => {
    await saveUserProfile({ canProvideCrossSectorSupport: canProvide });
  };

  const setAllowedSectors = async (sectors: string[]) => {
    await saveUserProfile({ allowedSectors: sectors });
  };

  const setUserWorkStatus = async (status: UserWorkStatus, customMessage?: string) => {
    const uid = identifiedUser?.firebaseUid || identifiedUser?.id || identifiedUser?.collaboratorId;
    if (!uid) return;

    setIdentifiedUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        workStatus: status,
        statusCustomMessage: customMessage !== undefined ? customMessage : prev.statusCustomMessage,
      };
    });

    setUserProfile((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        workStatus: status,
        statusCustomMessage: customMessage !== undefined ? customMessage : prev.statusCustomMessage,
      };
    });

    await updateUserWorkStatusInFirestore(uid, status, customMessage);
  };

  const saveUserScratchpad = async (text: string) => {
    const uid = identifiedUser?.firebaseUid || identifiedUser?.id || identifiedUser?.collaboratorId;
    if (!uid) return;

    setUserProfile((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        preferences: {
          ...(prev.preferences || {}),
          privateScratchpad: text,
        },
      };
    });

    await saveUserScratchpadToFirestore(uid, text);
  };

  const registerCompanyWorkspace = async (companyName: string, sector?: string, location?: string): Promise<void> => {
    const compName = companyName.trim();
    if (!compName) return;

    // Configura a empresa de forma persistente com Firestore ativo
    updateLocalState((prev) => ({
      ...prev,
      teamName: compName,
      sector: sector || prev.sector || 'Operação',
      location: location || prev.location || '',
      isSetupCompleted: true,
      onlineSpreadsheet: {
        ...(prev.onlineSpreadsheet || DEFAULT_FIRESTORE_CONFIG),
        name: compName,
        databaseProvider: 'firestore',
        firestoreCollection: 'dimensio_workspaces',
        autoSyncEnabled: true,
        syncStatus: 'success',
      },
    }));

    addAuditLog('configuracao', `Empresa/Workspace "${compName}" configurada e ativada no Firestore em Nuvem.`);
    showNotice(`Empresa "${compName}" configurada com sucesso na Nuvem!`, undefined, undefined, 'success');
  };

  const syncUserSessionFromFirebaseAuth = async (
    fbUser: User,
    customCompanyName?: string
  ): Promise<{ success: boolean; message: string }> => {
    const email = fbUser.email || '';
    const displayName = fbUser.displayName || email.split('@')[0] || 'Usuário';
    const photoUrl = fbUser.photoURL || undefined;
    const uid = fbUser.uid;

    setFirebaseUser(fbUser);

    // Try matching collaborator by email prefix, registration or name
    const emailPrefix = email.split('@')[0].toLowerCase();
    const col = state.collaborators.find((c) => {
      return (
        (c.login && c.login.toLowerCase() === emailPrefix) ||
        (c.registration && c.registration.toLowerCase() === emailPrefix) ||
        (c.name && c.name.toLowerCase().trim() === displayName.toLowerCase().trim())
      );
    });

    const isFirstUser = state.collaborators.length === 0;
    const role = col ? col.role : isFirstUser ? 'Admin' : 'Operador';
    const shift = col?.shift || state.teamShift || 'T1';
    const sector = col?.sector || state.sector || 'Operação';
    const allowedSectors = col?.allowedSectors || [];
    const canProvideCrossSectorSupport = col?.canProvideCrossSectorSupport ?? false;
    const isEditorRole = col ? (state.editorRoles || ['TL', 'PS']).includes(role) || role === 'TL' || role === 'Admin' : isFirstUser;
    const isAdminRole = role === 'Admin' || role === 'TL' || isFirstUser;

    const existingProfile = await getUserProfileFromFirestore(uid);

    const userObj: IdentifiedUser = {
      id: uid,
      firebaseUid: uid,
      email,
      name: displayName,
      role: existingProfile?.role || role,
      shift: existingProfile?.shift || shift,
      category: existingProfile?.category || col?.category || 'Geral',
      sector: existingProfile?.sector || sector,
      allowedSectors: existingProfile?.allowedSectors || allowedSectors,
      canProvideCrossSectorSupport: existingProfile?.canProvideCrossSectorSupport ?? canProvideCrossSectorSupport,
      isEditor: isEditorRole,
      isAdmin: isAdminRole,
      accessLevel: isAdminRole ? 'admin' : isEditorRole ? 'editor' : 'portal',
      collaboratorId: col ? col.id : undefined,
      photoUrl: photoUrl || existingProfile?.photoUrl,
      isSupportAttendant: existingProfile?.isSupportAttendant ?? false,
      workStatus: existingProfile?.workStatus || 'disponivel',
      statusCustomMessage: existingProfile?.statusCustomMessage || '',
      identifiedAt: Date.now(),
    };

    setIdentifiedUser(userObj);

    const fullProfile: UserProfileData = {
      uid,
      email,
      displayName,
      photoUrl: userObj.photoUrl,
      collaboratorId: col ? col.id : undefined,
      role: userObj.role,
      shift: userObj.shift,
      category: userObj.category,
      sector: userObj.sector,
      allowedSectors: userObj.allowedSectors,
      canProvideCrossSectorSupport: userObj.canProvideCrossSectorSupport,
      isSupportAttendant: userObj.isSupportAttendant,
      workStatus: userObj.workStatus,
      statusCustomMessage: userObj.statusCustomMessage,
    };

    setUserProfile(fullProfile);
    await saveUserProfileToFirestore(fullProfile);

    // If companyName was provided during sign up or first registration, initialize the enterprise workspace
    if (customCompanyName && customCompanyName.trim()) {
      await registerCompanyWorkspace(customCompanyName.trim(), userObj.sector);
    }

    addAuditLog('configuracao', `Usuário "${displayName}" conectou-se via Firebase Auth (Setor: ${userObj.sector || 'Operação'}).`);
    showNotice(`Autenticado com sucesso: ${displayName}${userObj.sector ? ` • ${userObj.sector}` : ''}`, undefined, undefined, 'success');
    return { success: true, message: `Bem-vindo, ${displayName}!` };
  };

  const signInWithGoogleAuth = async (): Promise<{ success: boolean; message: string }> => {
    try {
      setIsAuthLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      if (!fbUser) return { success: false, message: 'Não foi possível autenticar com o Google.' };
      return await syncUserSessionFromFirebaseAuth(fbUser);
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      return { success: false, message: err?.message || 'Falha ao autenticar com o Google.' };
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signInWithEmailAuth = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    try {
      setIsAuthLoading(true);
      const user = await emailSignIn(email, pass);
      return await syncUserSessionFromFirebaseAuth(user);
    } catch (err: any) {
      console.error('Email sign in error:', err);
      let msg = err?.message || 'Falha ao entrar com e-mail e senha.';
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password') {
        msg = 'E-mail ou senha incorretos.';
      } else if (err?.code === 'auth/user-not-found') {
        msg = 'Usuário não encontrado. Verifique o e-mail digitado ou crie uma conta.';
      } else if (err?.code === 'auth/invalid-email') {
        msg = 'Formato de e-mail inválido.';
      }
      return { success: false, message: msg };
    } finally {
      setIsAuthLoading(false);
    }
  };

  const signUpWithEmailAuth = async (
    email: string,
    pass: string,
    displayName?: string,
    companyName?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      setIsAuthLoading(true);
      const user = await emailSignUp(email, pass, displayName);
      const syncResult = await syncUserSessionFromFirebaseAuth(user, companyName);
      if (syncResult.success) {
        // Trigger welcome onboarding email with company next steps
        fetch('/api/auth/send-welcome-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: email.trim(),
            displayName: displayName || user.displayName || email.split('@')[0],
            companyName: companyName || 'sua empresa',
            userId: user.uid,
          }),
        }).catch((err) => console.warn('Welcome email trigger non-blocking error:', err));
      }
      return syncResult;
    } catch (err: any) {
      console.error('Email sign up error:', err);
      let msg = err?.message || 'Falha ao cadastrar usuário.';
      if (err?.code === 'auth/email-already-in-use') {
        msg = 'Este e-mail já está cadastrado. Faça login ou recupere sua senha.';
      } else if (err?.code === 'auth/weak-password') {
        msg = 'A senha deve ter no mínimo 6 caracteres.';
      }
      return { success: false, message: msg };
    } finally {
      setIsAuthLoading(false);
    }
  };

  const sendPasswordResetEmailAuth = async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      await resetPassword(email);
      return { success: true, message: 'Link para redefinição enviado com sucesso! Verifique sua caixa de entrada.' };
    } catch (err: any) {
      console.error('Password reset error:', err);
      return { success: false, message: err?.message || 'Erro ao enviar redefinição de senha.' };
    }
  };

  const signOutAuth = async (): Promise<void> => {
    try {
      await signOut(auth);
      setFirebaseUser(null);
      logoutUser();
      showNotice('Sessão desconectada com sucesso.');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const isFirestoreActive = Boolean(
    state.onlineSpreadsheet?.databaseProvider === 'firestore' ||
    (state.onlineSpreadsheet?.firestoreCollection && !state.onlineSpreadsheet?.webhookUrl)
  );

  const linkCollaboratorWithAuth = async (collaboratorId: string): Promise<{ success: boolean; message: string }> => {
    const col = state.collaborators.find((c) => c.id === collaboratorId);
    if (!col) return { success: false, message: 'Colaborador não encontrado.' };

    if (identifiedUser) {
      const updatedUser: IdentifiedUser = {
        ...identifiedUser,
        collaboratorId: col.id,
        role: col.role || identifiedUser.role,
        shift: col.shift || identifiedUser.shift,
        category: col.category || identifiedUser.category,
        sector: col.sector || identifiedUser.sector,
        allowedSectors: col.allowedSectors || identifiedUser.allowedSectors,
        canProvideCrossSectorSupport: col.canProvideCrossSectorSupport ?? identifiedUser.canProvideCrossSectorSupport,
      };
      setIdentifiedUser(updatedUser);

      const uid = identifiedUser.firebaseUid || identifiedUser.id;
      if (uid) {
        await saveUserProfileToFirestore({
          uid,
          collaboratorId: col.id,
          role: updatedUser.role,
          shift: updatedUser.shift,
          category: updatedUser.category,
          sector: updatedUser.sector,
          allowedSectors: updatedUser.allowedSectors,
          canProvideCrossSectorSupport: updatedUser.canProvideCrossSectorSupport,
        });
      }

      showNotice(`Perfil vinculado com sucesso ao colaborador ${col.name}!`);
      return { success: true, message: `Perfil vinculado a ${col.name}.` };
    }
    return { success: false, message: 'Nenhum usuário identificado no momento.' };
  };

  const setUserPassword = (collaboratorId: string, passwordInput: string) => {
    updateLocalState((prev) => ({
      ...prev,
      userPasswords: {
        ...(prev.userPasswords || {}),
        [collaboratorId]: passwordInput,
      },
    }));
    const colName = state.collaborators.find((c) => c.id === collaboratorId)?.name || 'Usuário';
    addAuditLog('configuracao', `Nova senha configurada para o usuário "${colName}".`);
    showNotice(`Senha para ${colName} configurada com sucesso.`);
  };

  const setRequireUserPassword = (required: boolean) => {
    updateLocalState((prev) => ({
      ...prev,
      requireUserPassword: required,
    }));
    addAuditLog('configuracao', `Exigência de senha para identificação alterada para ${required ? 'OBRIGATÓRIO' : 'OPCIONAL'}.`);
    showNotice(
      required
        ? 'Exigência de senha ativada: Todos os colaboradores devem utilizar senha ao se identificar.'
        : 'Exigência de senha desativada: Colaboradores sem senha podem se identificar diretamente.'
    );
  };

  const requestPasswordReset = (collaboratorId: string) => {
    const col = state.collaborators.find((c) => c.id === collaboratorId);
    const colName = col ? col.name : 'Colaborador';

    const notif: Omit<SystemNotification, 'id' | 'createdAt' | 'read'> = {
      targetRole: 'admin',
      senderName: colName,
      title: 'Solicitação de Redefinição de Senha',
      message: `O usuário "${colName}" solicitou autorização do TL/Administrador para redefinir sua senha de acesso.`,
      type: 'password_reset',
      data: {
        collaboratorId,
        collaboratorName: colName,
      },
    };

    addNotification(notif);
    addAuditLog('configuracao', `Solicitação de redefinição de senha para "${colName}".`);
    return { success: true, message: 'Solicitação enviada ao Administrador/TL do time para autorização.' };
  };

  const authorizePasswordReset = (notificationId: string) => {
    const notif = state.notifications?.find((n) => n.id === notificationId);
    if (!notif || !notif.data?.collaboratorId) return;

    const colId = notif.data.collaboratorId;
    updateLocalState((prev) => {
      const passes = { ...(prev.userPasswords || {}) };
      delete passes[colId];
      const notifs = (prev.notifications || []).map((n) => (n.id === notificationId ? { ...n, read: true } : n));
      return {
        ...prev,
        userPasswords: passes,
        notifications: notifs,
      };
    });

    addAuditLog('configuracao', `Redefinição de senha do colaborador "${notif.data.collaboratorName}" autorizada pelo Administrador.`);
    showNotice(`Senha do colaborador ${notif.data.collaboratorName} removida com sucesso.`);
  };

  const toggleEditorRole = (roleName: string) => {
    let isNowEditor = false;
    updateLocalState((prev) => {
      const current = prev.editorRoles || ['TL', 'PS'];
      const exists = current.includes(roleName);
      isNowEditor = !exists;
      const updated = exists ? current.filter((r) => r !== roleName) : [...current, roleName];
      return { ...prev, editorRoles: updated };
    });
    addAuditLog('configuracao', `Cargo "${roleName}" ${isNowEditor ? 'marcado como' : 'removido de'} Editor.`);
    showNotice(`Permissão de editor para o cargo "${roleName}" ${isNowEditor ? 'ativada' : 'desativada'}.`);
  };

  // AUTO BACKUP SETTINGS
  const updateAutoBackupSettings = (settings: Partial<AutoBackupSettings>) => {
    updateLocalState((prev) => ({
      ...prev,
      autoBackupSettings: {
        ...(prev.autoBackupSettings || { enabled: true, intervalMinutes: 30, maxRetainSnapshots: 20 }),
        ...settings,
      },
    }));
    addAuditLog('backup', 'Configurações de backup automático salvas.');
    showNotice('Configurações de backup automático salvas.');
  };

  // Auto Backup Interval Checking Effect
  useEffect(() => {
    const backupConfig = state.autoBackupSettings;
    if (!backupConfig || !backupConfig.enabled) return;

    const intervalMs = (backupConfig.intervalMinutes || 30) * 60 * 1000;
    const interval = setInterval(() => {
      const lastTime = lastAutoBackupInfo?.timestamp ? new Date(lastAutoBackupInfo.timestamp).getTime() : 0;
      if (Date.now() - lastTime >= intervalMs) {
        createAutoBackup('Backup Automático Programado');
      }
    }, Math.min(intervalMs, 60000));

    return () => clearInterval(interval);
  }, [state.autoBackupSettings, lastAutoBackupInfo]);

  // NOTIFICATIONS
  const addNotification = (notifData: Omit<SystemNotification, 'id' | 'createdAt' | 'read'>) => {
    const notif: SystemNotification = {
      ...notifData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      read: false,
    };
    seenNotificationIds.current.add(notif.id);
    updateLocalState((prev) => ({
      ...prev,
      notifications: [notif, ...(prev.notifications || [])].slice(0, 100),
    }));

    if (isNotificationForCurrentUser(notif, false)) {
      const portalCfg = state.portalNotificationConfig || {};
      const isBroadcastNotice = notif.type === 'notice' && notif.data?.action === 'broadcast';
      const isSupportStatus = notif.data?.action === 'support_status';
      const soundEnabled = portalCfg.soundAlerts ?? notifSoundEnabled;
      if (soundEnabled) {
        const notifTypeStr = (notif as any).type || '';
        const soundType =
          notifTypeStr === 'request' || notif.data?.action === 'support_request' || notif.data?.requestId
            ? 'request'
            : notifTypeStr === 'break'
            ? 'break'
            : notifTypeStr === 'urgent'
            ? 'urgent'
            : 'notice';
        playNotificationSound(soundType);
      }
      if (portalCfg.vibrationAlerts) {
        triggerDeviceVibration([300, 100, 300]);
      }
      if (notifPopupEnabled) {
        const requestId = notif.data?.requestId;
        if (requestId) {
          showNotice(`🔔 ${notif.title}: ${notif.message}`, 'Ver Pedido', () => {
            navigateTo('requests');
            focusServiceRequest(requestId);
          });
        } else {
          showNotice(`🔔 ${notif.title}: ${notif.message}`);
        }
      }
      const shiftNoticesDisabled = isBroadcastNotice && portalCfg.shiftNotices === false;
      const supportStatusDisabled = isSupportStatus && portalCfg.supportStatusAlerts === false;
      if (!shiftNoticesDisabled && !supportStatusDisabled) {
        showNativeOSNotification(notif.title, { body: notif.message });
      }
    }
  };

  // Notificado em massa: envia um aviso para um turno (ou todos) para que os
  // colaboradores identificados recebam a notificação via sincronização nuvem.
  const broadcastNotice = (opts: {
    title: string;
    message: string;
    targetShift?: string;
    targetShiftAudience?: 'atual' | 'proximo' | 'proximos' | 'todos';
    type?: 'notice' | 'request' | 'system';
  }) => {
    const senderName = identifiedUser?.name || 'Gestor';
    addNotification({
      title: opts.title,
      message: opts.message,
      senderName,
      shift: opts.targetShift,
      targetShiftAudience: opts.targetShiftAudience || 'atual',
      type: opts.type || 'notice',
      data: {
        userId: identifiedUser?.id,
        userName: senderName,
        userShift: identifiedUser?.shift || state.teamShift,
        action: 'broadcast',
      },
    });
  };

  const markNotificationRead = (id: string) => {
    const user = getActiveUserIdentity();
    const userTokens = [user.id, user.collaboratorId, user.login].filter(Boolean);

    updateLocalState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).map((n) => {
        if (n.id === id) {
          const currentReadUsers = Array.isArray(n.readByUserIds) ? n.readByUserIds : [];
          const newReadUsers = Array.from(new Set([...currentReadUsers, ...userTokens]));
          return {
            ...n,
            read: true,
            readByUserIds: newReadUsers,
            data: {
              ...(n.data || {}),
              readByUserIds: newReadUsers,
            },
          };
        }
        return n;
      }),
    }));
  };

  const markAllNotificationsRead = () => {
    const user = getActiveUserIdentity();
    const userTokens = [user.id, user.collaboratorId, user.login].filter(Boolean);

    updateLocalState((prev) => ({
      ...prev,
      notifications: (prev.notifications || []).map((n) => {
        if (isNotificationForCurrentUser(n, true)) {
          const currentReadUsers = Array.isArray(n.readByUserIds) ? n.readByUserIds : [];
          const newReadUsers = Array.from(new Set([...currentReadUsers, ...userTokens]));
          return {
            ...n,
            read: true,
            readByUserIds: newReadUsers,
            data: {
              ...(n.data || {}),
              readByUserIds: newReadUsers,
            },
          };
        }
        return n;
      }),
    }));
    showNotice('Suas notificações foram marcadas como lidas.');
  };

  const deleteNotification = (id: string, scope: 'self' | 'global' = 'self') => {
    const user = getActiveUserIdentity();
    const userId = user.id !== 'unauthenticated' ? user.id : '';
    const collabId = user.collaboratorId || '';

    updateLocalState((prev) => {
      const notifs = prev.notifications || [];
      const targetNotif = notifs.find((n) => n.id === id);
      if (!targetNotif) return prev;

      // When scope is 'self' (the default standard action), clear for the current user ONLY
      if (scope === 'self') {
        const userTokens = [userId, collabId, user.login, user.registration, user.name?.toLowerCase().trim()].filter(Boolean) as string[];
        const updated = notifs.map((n) => {
          if (n.id === id) {
            const currentCleared = Array.isArray(n.clearedByUserIds) ? n.clearedByUserIds : [];
            const newCleared = Array.from(new Set([...currentCleared, ...userTokens]));
            return {
              ...n,
              clearedByUserIds: newCleared,
              data: {
                ...(n.data || {}),
                clearedByUserIds: newCleared,
              },
            };
          }
          return n;
        });

        // Also record in user local storage cache (session-scoped)
        if (userId) {
          try {
            const key = `dimensio_cleared_notifs_${userId}`;
            const cached = JSON.parse(getAppStorage().getItem(key) || '[]');
            getAppStorage().setItem(key, JSON.stringify(Array.from(new Set([...cached, id])).slice(-200)));
          } catch {}
        }

        notificationsRef.current = updated;
        return {
          ...prev,
          notifications: updated,
        };
      }

      // If scope is 'global' (explicit global purge):
      const existingDeleted = Array.isArray(prev.deletedNotificationIds) ? prev.deletedNotificationIds : [];
      const newDeleted = Array.from(new Set([...existingDeleted, id])).slice(-200);
      const updatedNotifs = notifs.filter((n) => n.id !== id);
      notificationsRef.current = updatedNotifs;
      return {
        ...prev,
        deletedNotificationIds: newDeleted,
        notifications: updatedNotifs,
      };
    });

    if (scope === 'global') {
      setTimeout(() => {
        syncToOnlineSpreadsheet(true).catch(() => {});
      }, 250);
    }
  };

  const clearAllNotifications = (filter: 'read_only' | 'all' = 'all', scope: 'self' | 'global' = 'self') => {
    const user = getActiveUserIdentity();
    const userId = user.id !== 'unauthenticated' ? user.id : '';
    const collabId = user.collaboratorId || '';

    updateLocalState((prev) => {
      const current = prev.notifications || [];
      const userTokens = [userId, collabId, user.login, user.registration, user.name?.toLowerCase().trim()].filter(Boolean) as string[];

      // Find notifications applicable to current user
      const applicableNotifs = current.filter((n) => isNotificationForCurrentUser(n, true));
      const targetNotifs =
        filter === 'read_only'
          ? applicableNotifs.filter(
              (n) => n.read || (n.readByUserIds && userTokens.some((tok) => n.readByUserIds!.includes(tok)))
            )
          : applicableNotifs;

      const targetIds = new Set(targetNotifs.map((n) => n.id));

      if (scope === 'self') {
        // Mark as cleared for this user only
        const updated = current.map((n) => {
          if (targetIds.has(n.id)) {
            const currentCleared = Array.isArray(n.clearedByUserIds) ? n.clearedByUserIds : [];
            const newCleared = Array.from(new Set([...currentCleared, ...userTokens]));
            return {
              ...n,
              clearedByUserIds: newCleared,
              data: {
                ...(n.data || {}),
                clearedByUserIds: newCleared,
              },
            };
          }
          return n;
        });

        // Also record in user local storage cache (session-scoped)
        if (userId) {
          try {
            const key = `dimensio_cleared_notifs_${userId}`;
            const cached = JSON.parse(getAppStorage().getItem(key) || '[]');
            getAppStorage().setItem(
              key,
              JSON.stringify(Array.from(new Set([...cached, ...Array.from(targetIds)])).slice(-200))
            );
          } catch {}
        }

        notificationsRef.current = updated;
        return {
          ...prev,
          notifications: updated,
        };
      }

      // If scope is 'global' (explicit global purge):
      const idsToDelete = Array.from(targetIds);
      const existingDeleted = Array.isArray(prev.deletedNotificationIds) ? prev.deletedNotificationIds : [];
      const newDeleted = Array.from(new Set([...existingDeleted, ...idsToDelete])).slice(-200);
      const updated = current.filter((n) => !targetIds.has(n.id));
      notificationsRef.current = updated;
      return {
        ...prev,
        deletedNotificationIds: newDeleted,
        notifications: updated,
      };
    });

    if (scope === 'global') {
      setTimeout(() => {
        syncToOnlineSpreadsheet(true).catch(() => {});
      }, 250);
    }

    showNotice(
      filter === 'read_only'
        ? 'Notificações lidas limpas da sua caixa.'
        : 'Suas notificações foram limpas com sucesso.'
    );
  };

  // PEDIDOS E AVISOS (SERVICE REQUESTS)
  const createServiceRequest = (
    requestData: Omit<ServiceRequest, 'id' | 'createdAt' | 'status' | 'requesterId' | 'requesterName' | 'requesterRole'>
  ) => {
    if (!identifiedUser) {
      return { success: false, message: 'Você precisa estar identificado para enviar pedidos ou avisos no sistema.' };
    }

    const userShift = requestData.shift || identifiedUser.shift || state.teamShift || 'T2';

    const req: ServiceRequest = {
      ...requestData,
      shift: userShift,
      id: generateId(),
      createdAt: new Date().toISOString(),
      requesterId: identifiedUser.id,
      requesterName: identifiedUser.name,
      requesterRole: identifiedUser.role,
      status: 'pendente',
    };

    updateLocalState((prev) => ({
      ...prev,
      serviceRequests: [req, ...(prev.serviceRequests || [])],
    }));

    // Create a notification for the recipient, admins and the editors (PS/TL)
    // of the request's shift, so the right people are alerted in real time.
    addNotification({
      targetRole: req.targetId === 'admin' ? 'editor' : undefined,
      targetUserId: req.targetId !== 'admin' ? req.targetId : undefined,
      shift: req.targetShiftAudience === 'todos' ? undefined : req.shift,
      targetShiftAudience: req.targetShiftAudience,
      senderName: req.requesterName,
      title: req.type === 'aviso' ? `Novo Aviso: ${req.title}` : `Novo Pedido de Ação: ${req.title}`,
      message: `${req.requesterName} enviou um ${req.type === 'aviso' ? 'aviso' : 'pedido de ação sistêmica'}: "${req.title}"`,
      type: 'request',
      data: {
        requestId: req.id,
        userId: identifiedUser.id,
        userName: identifiedUser.name,
        collaboratorId: req.collaboratorId,
        collaboratorName: req.collaboratorName,
        taskId: req.taskId,
        taskName: req.taskName,
        taskExternalUrl: req.taskExternalUrl,
      },
    });

    addAuditLog(
      'pedido',
      `Novo pedido enviado por ${req.requesterName}: "${req.title}" (${req.type === 'aviso' ? 'Aviso' : 'Ação Sistêmica'})`
    );

    showNotice(`Pedido "${req.title}" enviado com sucesso!`);
    return { success: true, message: 'Pedido enviado com sucesso.' };
  };

  const markRequestAsRead = (id: string) => {
    updateLocalState((prev) => ({
      ...prev,
      serviceRequests: (prev.serviceRequests || []).map((r) =>
        r.id === id ? { ...r, status: r.status === 'pendente' ? 'lido' : r.status } : r
      ),
    }));
    showNotice('Pedido marcado como lido.');
  };

  const markRequestAsCompleted = (id: string) => {
    const req = state.serviceRequests?.find((r) => r.id === id);
    if (!req) return;

    const completedByName = identifiedUser?.name || 'Administrador / TL';

    updateLocalState((prev) => ({
      ...prev,
      serviceRequests: (prev.serviceRequests || []).map((r) =>
        r.id === id
          ? {
              ...r,
              status: 'realizado',
              completedAt: new Date().toISOString(),
              completedBy: completedByName,
            }
          : r
      ),
    }));

    // Notify the requester
    addNotification({
      targetUserId: req.requesterId,
      senderName: completedByName,
      title: `Ação Realizada: ${req.title}`,
      message: `Sua solicitação "${req.title}" foi atendida e marcada como AÇÃO REALIZADA por ${completedByName}.`,
      type: 'notice',
      data: { requestId: req.id },
    });

    addAuditLog('pedido', `Solicitação "${req.title}" foi marcada como REALIZADA por ${completedByName}.`);
    showNotice(`Ação "${req.title}" concluída com sucesso!`);
  };

  const updateServiceRequest = (
    id: string,
    updates: Partial<ServiceRequest>
  ): { success: boolean; message: string } => {
    const req = state.serviceRequests?.find((r) => r.id === id);
    if (!req) return { success: false, message: 'Pedido/Aviso não encontrado.' };

    const updatedReq: ServiceRequest = {
      ...req,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: identifiedUser?.name || req.requesterName || 'Usuário',
    };

    updateLocalState((prev) => ({
      ...prev,
      serviceRequests: (prev.serviceRequests || []).map((r) => (r.id === id ? updatedReq : r)),
    }));

    addAuditLog('pedido', `Pedido/Aviso "${updatedReq.title}" foi editado por ${identifiedUser?.name || 'Usuário'}.`);
    showNotice(`Aviso/Pedido "${updatedReq.title}" atualizado com sucesso!`);
    return { success: true, message: 'Aviso/Pedido atualizado com sucesso.' };
  };

  const deleteServiceRequest = (id: string): { success: boolean; message: string } => {
    const req = state.serviceRequests?.find((r) => r.id === id);
    if (!req) return { success: false, message: 'Pedido não encontrado.' };

    updateLocalState((prev) => ({
      ...prev,
      serviceRequests: (prev.serviceRequests || []).filter((r) => r.id !== id),
    }));

    addAuditLog('pedido', `Pedido/Solicitação "${req.title}" (ID: ${id}) foi excluído por ${identifiedUser?.name || 'Usuário'}.`);
    showNotice(`Pedido "${req.title}" excluído com sucesso.`);
    return { success: true, message: 'Pedido excluído com sucesso.' };
  };

  const updateTaskExternalUrl = (taskId: string, url: string) => {
    updateLocalState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, externalUrl: url } : t)),
    }));
    addAuditLog('tarefa', `Link do sistema externo configurado para a tarefa ID ${taskId}.`);
    showNotice('Link da tarefa no sistema da empresa atualizado.');
  };

  // --- Hub de Informações Methods ---
  const addInfoHubReminder = (reminder: Omit<InfoHubReminder, 'id' | 'createdAt'>) => {
    const newRem: InfoHubReminder = {
      ...reminder,
      id: generateId(),
      createdAt: new Date().toISOString(),
      authorId: identifiedUser?.id,
      authorName: reminder.authorName || identifiedUser?.name || 'TL / Operador',
    };
    updateLocalState((prev) => ({
      ...prev,
      infoHubReminders: [newRem, ...(prev.infoHubReminders || [])],
    }));
    addAuditLog('info_hub', `Novo lembrete/aviso cadastrado para o turno ${newRem.shift} por ${newRem.authorName}.`);
    showNotice('Aviso cadastrado no Hub de Informações!');
  };

  const updateInfoHubReminder = (
    id: string,
    updates: Partial<InfoHubReminder>
  ): { success: boolean; message: string } => {
    const rem = state.infoHubReminders?.find((r) => r.id === id);
    if (!rem) return { success: false, message: 'Aviso/Lembrete não encontrado.' };

    const updatedRem: InfoHubReminder = {
      ...rem,
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: identifiedUser?.name || rem.authorName || 'Operador',
    };

    updateLocalState((prev) => ({
      ...prev,
      infoHubReminders: (prev.infoHubReminders || []).map((r) => (r.id === id ? updatedRem : r)),
    }));

    addAuditLog('info_hub', `Aviso/Lembrete ID ${id} editado por ${identifiedUser?.name || 'Usuário'}.`);
    showNotice('Aviso atualizado com sucesso!');
    return { success: true, message: 'Aviso atualizado com sucesso.' };
  };

  const deleteInfoHubReminder = (id: string) => {
    updateLocalState((prev) => ({
      ...prev,
      infoHubReminders: (prev.infoHubReminders || []).filter((r) => r.id !== id),
    }));
    addAuditLog('info_hub', `Aviso/Lembrete ID ${id} foi excluído.`);
    showNotice('Aviso excluído com sucesso!');
  };

  const addInfoHubLink = (link: Omit<InfoHubLink, 'id'>) => {
    const newLink: InfoHubLink = {
      ...link,
      id: generateId(),
    };
    updateLocalState((prev) => ({
      ...prev,
      infoHubLinks: [...(prev.infoHubLinks || []), newLink],
    }));
    addAuditLog('info_hub', `Novo link do setor cadastrado: ${newLink.title}`);
    showNotice('Atalho/Link adicionado ao Hub de Informações!');
  };

  const updateInfoHubLink = (id: string, updates: Partial<InfoHubLink>) => {
    updateLocalState((prev) => ({
      ...prev,
      infoHubLinks: (prev.infoHubLinks || []).map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
    showNotice('Link do setor atualizado.');
  };

  const deleteInfoHubLink = (id: string) => {
    updateLocalState((prev) => ({
      ...prev,
      infoHubLinks: (prev.infoHubLinks || []).filter((l) => l.id !== id),
    }));
    showNotice('Link removido do Hub.');
  };

  const addInfoHubQuickFill = (item: Omit<InfoHubQuickFill, 'id'>) => {
    const newQF: InfoHubQuickFill = {
      ...item,
      id: generateId(),
    };
    updateLocalState((prev) => ({
      ...prev,
      infoHubQuickFills: [...(prev.infoHubQuickFills || []), newQF],
    }));
    addAuditLog('info_hub', `Novo item de preenchimento rápido cadastrado: ${newQF.title}`);
    showNotice('Preenchimento rápido cadastrado com sucesso!');
  };

  const updateInfoHubQuickFill = (id: string, updates: Partial<InfoHubQuickFill>) => {
    updateLocalState((prev) => ({
      ...prev,
      infoHubQuickFills: (prev.infoHubQuickFills || []).map((q) => (q.id === id ? { ...q, ...updates } : q)),
    }));
    showNotice('Item de preenchimento rápido atualizado.');
  };

  const deleteInfoHubQuickFill = (id: string) => {
    updateLocalState((prev) => ({
      ...prev,
      infoHubQuickFills: (prev.infoHubQuickFills || []).filter((q) => q.id !== id),
    }));
    showNotice('Item removido.');
  };

  const addMetricDefinition = (def: Omit<MetricDefinition, 'id' | 'createdAt'>) => {
    const newDef: MetricDefinition = {
      ...def,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    updateLocalState((prev) => ({
      ...prev,
      metricDefinitions: [...(prev.metricDefinitions || []), newDef],
    }));
    addAuditLog('info_hub', `Nova métrica cadastrada: ${newDef.name}`);
    showNotice('Métrica cadastrada!');
  };

  const updateMetricDefinition = (id: string, updates: Partial<MetricDefinition>) => {
    updateLocalState((prev) => ({
      ...prev,
      metricDefinitions: (prev.metricDefinitions || []).map((d) => (d.id === id ? { ...d, ...updates } : d)),
    }));
    showNotice('Métrica atualizada.');
  };

  const deleteMetricDefinition = (id: string) => {
    updateLocalState((prev) => ({
      ...prev,
      metricDefinitions: (prev.metricDefinitions || []).filter((d) => d.id !== id),
      metricReadings: (prev.metricReadings || []).filter((r) => r.metricId !== id),
    }));
    addAuditLog('info_hub', `Métrica ID ${id} foi excluída.`);
    showNotice('Métrica excluída.');
  };

  const addMetricReading = (reading: Omit<MetricReading, 'id' | 'capturedAt'>) => {
    const newReading: MetricReading = {
      ...reading,
      id: generateId(),
      capturedAt: new Date().toISOString(),
    };
    updateLocalState((prev) => ({
      ...prev,
      metricReadings: [...(prev.metricReadings || []), newReading],
    }));
    showNotice('Valores da métrica registrados!');
  };

  const deleteMetricReading = (id: string) => {
    updateLocalState((prev) => ({
      ...prev,
      metricReadings: (prev.metricReadings || []).filter((r) => r.id !== id),
    }));
    showNotice('Registro de coleta removido.');
  };

  // Soma as contagens de tarefas Pendentes / Em processamento por área.
  // O modelo é: um posto (tarefa) atende VÁRIAS áreas. A extensão aplica os
  // filtros (fluxo) e conta as ocorrências de cada nome de área na página
  // (estilo CTRL+F). Os valores das coletas são chaveados pelo nome da área.
  const getTaskAreaCounts = () => {
    const defs = state.metricDefinitions || [];
    const readings = state.metricReadings || [];
    const countDefs = defs.filter((d) => d.targetType === 'tarefa' && d.kind === 'task_counts');
    const byArea = new Map<string, TaskAreaCount>();
    const areaTasks = new Map<string, Set<string>>();
    const countsByMetric = new Map<string, { kind?: string; capturedAt: string; values: Record<string, string> }>();
    for (const r of readings) {
      const def = countDefs.find((d) => d.id === r.metricId);
      if (!def) continue;
      const prev = countsByMetric.get(def.id);
      if (!prev || (r.capturedAt || '') > prev.capturedAt) {
        countsByMetric.set(def.id, {
          kind: def.countKind || 'generic',
          capturedAt: r.capturedAt || '',
          values: r.values || {},
        });
      }
    }
    for (const [metricId, info] of countsByMetric) {
      const def = countDefs.find((d) => d.id === metricId);
      if (!def) continue;
      for (const area of Object.keys(info.values)) {
        const cleanArea = area.trim() || 'Sem área definida';
        const num = parseFloat(String(info.values[area] ?? '').replace(',', '.'));
        const n = isNaN(num) ? 0 : num;
        if (!areaTasks.has(cleanArea)) areaTasks.set(cleanArea, new Set());
        areaTasks.get(cleanArea)!.add(def.targetId);
        const entry = byArea.get(cleanArea) || { area: cleanArea, tasks: 0, pending: 0, processing: 0, total: 0, updatedAt: '' };
        if (info.kind === 'pending') entry.pending += n;
        else if (info.kind === 'processing') entry.processing += n;
        if (!entry.updatedAt || info.capturedAt > entry.updatedAt) entry.updatedAt = info.capturedAt;
        byArea.set(cleanArea, entry);
      }
    }
    for (const [area, taskSet] of areaTasks) {
      const entry = byArea.get(area);
      if (entry) {
        entry.tasks = taskSet.size;
        entry.total = entry.pending + entry.processing;
      }
    }
    return Array.from(byArea.values()).sort((a, b) => a.area.localeCompare(b.area, 'pt-BR'));
  };

  // Cria (se ainda não existir) a métrica de contagem de tarefas de um posto.
  // Cada métrica representa UMA visão filtrada (Pendentes ou Em processamento)
  // e conta, por ocorrência de texto, quantos itens de cada área estão nela.
  const ensureTaskCountMetric = (taskId: string, kind: 'pending' | 'processing' = 'pending') => {
    const defs = state.metricDefinitions || [];
    const existing = defs.find(
      (d) => d.targetType === 'tarefa' && d.targetId === taskId && d.kind === 'task_counts' && d.countKind === kind
    );
    if (existing) return { created: false, metricId: existing.id };
    const task = (state.tasks || []).find((t) => t.id === taskId);
    const metricId = generateId();
    addMetricDefinition({
      name: `${task?.name || 'Tarefa'} — ${kind === 'pending' ? 'Pendentes' : 'Em processamento'}`,
      targetType: 'tarefa',
      targetId: taskId,
      unit: 'un.',
      url: task?.externalUrl,
      kind: 'task_counts',
      countKind: kind,
      countTerms: [],
      countScope: '',
      fields: [],
      schedule: { enabled: false, cadence: 'diaria', times: ['07:00'], daysOfWeek: [1, 2, 3, 4, 5] },
    });
    return { created: true, metricId };
  };

  // Recebe resultados da extensão (coleta automática e seletor "Automa").
  useEffect(() => {
    const onMetricResult = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || !detail.metricId || !detail.values || typeof detail.values !== 'object') return;
      addMetricReading({
        metricId: detail.metricId,
        values: detail.values,
        capturedBy: detail.capturedBy || 'Extensão',
      });
    };

    const onMetricPickResult = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || !detail.metricId || !detail.selector) return;
      updateLocalState((prev) => ({
        ...prev,
        metricDefinitions: (prev.metricDefinitions || []).map((d) => {
          if (d.id !== detail.metricId) return d;
          const fields = d.fields || [];
          if (fields.length === 0) return d;
          const emptyIndex = fields.findIndex((f) => !f.selector || !f.selector.trim());
          const targetIndex = emptyIndex >= 0 ? emptyIndex : 0;
          return {
            ...d,
            fields: fields.map((f, i) =>
              i === targetIndex ? { ...f, selector: String(detail.selector) } : f
            ),
          };
        }),
      }));
      showNotice('Seletor capturado pela extensão e aplicado à métrica.');
    };

    const onMetricFlowResult = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || !detail.metricId || !Array.isArray(detail.flow)) return;
      updateLocalState((prev) => ({
        ...prev,
        metricDefinitions: (prev.metricDefinitions || []).map((d) =>
          d.id === detail.metricId ? { ...d, flow: detail.flow } : d
        ),
      }));
      showNotice(`Fluxo de ${detail.flow.length} passo(s) gravado pela extensão e salvo na métrica.`);
    };

    const onMetricCountConfigResult = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!detail || !detail.metricId) return;
      updateLocalState((prev) => ({
        ...prev,
        metricDefinitions: (prev.metricDefinitions || []).map((d) =>
          d.id === detail.metricId
            ? {
                ...d,
                countTerms: Array.isArray(detail.countTerms) ? detail.countTerms : d.countTerms,
                countScope: typeof detail.countScope === 'string' ? detail.countScope : d.countScope,
              }
            : d
        ),
      }));
      showNotice('Áreas de contagem atualizadas pela extensão.');
    };

    window.addEventListener('dimensio-metric-result', onMetricResult);
    window.addEventListener('dimensio-metric-pick-result', onMetricPickResult);
    window.addEventListener('dimensio-metric-flow-result', onMetricFlowResult);
    window.addEventListener('dimensio-metric-count-config-result', onMetricCountConfigResult);
    return () => {
      window.removeEventListener('dimensio-metric-result', onMetricResult);
      window.removeEventListener('dimensio-metric-pick-result', onMetricPickResult);
      window.removeEventListener('dimensio-metric-flow-result', onMetricFlowResult);
      window.removeEventListener('dimensio-metric-count-config-result', onMetricCountConfigResult);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coleta automática agendada (executa enquanto o app estiver aberto).
  useEffect(() => {
    const fired = new Set<string>();
    const collectDef = (d: MetricDefinition) => {
      if (!d.url) return;
      const isCount = d.kind === 'task_counts';
      const config = {
        requestId: generateId(),
        metricId: d.id,
        name: d.name,
        url: d.url,
        mode: isCount ? 'count' : 'extract',
        fields: isCount
          ? []
          : (d.fields || []).map((f) => ({
              id: f.id,
              label: f.label,
              selector: f.selector,
              mode: f.mode || 'text',
              attribute: f.attribute || '',
            })),
        countTerms: (d.countTerms || []).map((t) => ({ area: t.area, selector: t.selector || '' })),
        countScope: d.countScope || '',
        flow: Array.isArray(d.flow) ? d.flow : [],
      };
      window.postMessage({ source: 'DIMENSIO_APP', type: 'DIMENSIO_COLLECT', collect: config }, '*');
      const bridge = (window as any).__DIMENSIO_BRIDGE__;
      if (bridge && typeof bridge.openSystem === 'function') bridge.openSystem(d.url);
      else window.open(d.url, '_blank', 'noopener');
    };
    const check = () => {
      const now = new Date();
      const timeKey = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dow = now.getDay();
      const defs = stateRef.current?.metricDefinitions || [];
      for (const d of defs) {
        const s = d.schedule;
        if (!s || !s.enabled) continue;
        if (s.cadence === 'semanal' && !(s.daysOfWeek || []).includes(dow)) continue;
        const times = (s.times || []).map((t) => (t || '').trim()).filter(Boolean);
        if (times.includes(timeKey)) {
          const key = d.id + '|' + timeKey;
          if (fired.has(key)) continue;
          fired.add(key);
          collectDef(d);
        }
      }
    };
    const iv = setInterval(check, 30000);
    check();
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto sync quick fills to Chrome Extension
  useEffect(() => {
    if (state.infoHubQuickFills) {
      dispatchQuickFillsToExtension(state.infoHubQuickFills);
    }
  }, [state.infoHubQuickFills]);

  const setSidebarCollapsed = (collapsed: boolean) => {
    setState((prev) => ({ ...prev, isSidebarCollapsed: collapsed }));
  };

  const toggleSidebarCollapsed = () => {
    setState((prev) => ({ ...prev, isSidebarCollapsed: !prev.isSidebarCollapsed }));
  };

  // Merge notifications coming from the cloud with the local ones: dedupe by id,
  // filter out deleted notifications, keep the most-read state, sort newest first and cap at 100 items.
  const mergeNotifications = (
    remote: SystemNotification[],
    local: SystemNotification[],
    deletedIds?: string[] | Set<string>
  ): SystemNotification[] => {
    const deletedSet = deletedIds instanceof Set ? deletedIds : new Set(deletedIds || []);
    const byId = new Map<string, SystemNotification>();
    const add = (n: SystemNotification) => {
      if (!n || !n.id || deletedSet.has(n.id)) return;
      const existing = byId.get(n.id);
      if (!existing) {
        byId.set(n.id, n);
      } else {
        const merged = { ...existing };
        if (n.read && !existing.read) merged.read = true;
        const readUsers = new Set([
          ...(Array.isArray(existing.readByUserIds) ? existing.readByUserIds : []),
          ...(Array.isArray(n.readByUserIds) ? n.readByUserIds : []),
        ]);
        if (readUsers.size > 0) merged.readByUserIds = Array.from(readUsers);
        const clearedUsers = new Set([
          ...(Array.isArray(existing.clearedByUserIds) ? existing.clearedByUserIds : []),
          ...(Array.isArray(n.clearedByUserIds) ? n.clearedByUserIds : []),
        ]);
        if (clearedUsers.size > 0) merged.clearedByUserIds = Array.from(clearedUsers);
        byId.set(n.id, merged);
      }
    };
    remote.forEach(add);
    local.forEach(add);
    return Array.from(byId.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100);
  };

  // Resolves active user identity either from formal login (identifiedUser) or operator selection on Portal (localStorage)
  const getActiveUserIdentity = (overrideUserId?: string) => {
    if (overrideUserId) {
      const col = state.collaborators.find(
        (c) => c.id === overrideUserId || c.login === overrideUserId || c.registration === overrideUserId
      );
      if (col) {
        const role = col.role || 'Operador';
        return {
          id: String(col.id),
          collaboratorId: String(col.id),
          login: String(col.login || ''),
          registration: String(col.registration || ''),
          name: col.name || '',
          role,
          shift: col.shift || state.teamShift || 'T1',
          sector: col.sector || state.sector || 'Operação',
          allowedSectors: col.allowedSectors || [],
          canProvideCrossSectorSupport: col.canProvideCrossSectorSupport ?? false,
          isSupportAttendant: false,
          isAdmin: false,
          isEditor: role === 'TL' || (state.editorRoles || ['TL', 'PS']).includes(role),
          isAuthenticated: true,
        };
      }
    }

    if (identifiedUser) {
      const role = identifiedUser.role || 'Operador';
      return {
        id: String(identifiedUser.id || ''),
        collaboratorId: String(identifiedUser.collaboratorId || identifiedUser.id || ''),
        login: String(identifiedUser.login || ''),
        registration: String(identifiedUser.registration || ''),
        name: identifiedUser.name || '',
        role,
        shift: identifiedUser.shift || state.teamShift || 'T1',
        sector: identifiedUser.sector || userProfile?.sector || state.sector || 'Operação',
        allowedSectors: identifiedUser.allowedSectors || userProfile?.allowedSectors || [],
        canProvideCrossSectorSupport: identifiedUser.canProvideCrossSectorSupport ?? userProfile?.canProvideCrossSectorSupport ?? false,
        isSupportAttendant: identifiedUser.isSupportAttendant ?? userProfile?.isSupportAttendant ?? false,
        isAdmin:
          identifiedUser.isSuperAdmin === true ||
          identifiedUser.isAdmin === true ||
          identifiedUser.id === 'admin' ||
          identifiedUser.id === 'super_admin' ||
          role === 'Admin' ||
          role === 'Administrador' ||
          role === 'admin',
        isEditor:
          identifiedUser.isEditor === true ||
          role === 'TL' ||
          (state.editorRoles || ['TL', 'PS']).includes(role),
        isAuthenticated: true,
      };
    }

    if (typeof window !== 'undefined') {
      try {
        const saved = getAppStorage().getItem('dimensio_portal_operator_id');
        if (saved) {
          let portalId = saved;
          if (saved.startsWith('{')) {
            const parsed = JSON.parse(saved);
            const timestamp = parsed.timestamp || 0;
            if (timestamp && Date.now() - timestamp > 6 * 60 * 60 * 1000) {
              getAppStorage().removeItem('dimensio_portal_operator_id');
              portalId = '';
            } else {
              portalId = parsed.id || '';
            }
          }
          if (portalId) {
            const collab = state.collaborators.find(
              (c) => c.id === portalId || c.login === portalId || c.registration === portalId
            );
            if (collab) {
              const role = collab.role || 'Operador';
              return {
                id: String(collab.id),
                collaboratorId: String(collab.id),
                login: String(collab.login || ''),
                registration: String(collab.registration || ''),
                name: collab.name || '',
                role,
                shift: collab.shift || state.teamShift || 'T1',
                sector: collab.sector || state.sector || 'Operação',
                allowedSectors: collab.allowedSectors || [],
                canProvideCrossSectorSupport: collab.canProvideCrossSectorSupport ?? false,
                isSupportAttendant: false,
                isAdmin: false,
                isEditor: role === 'TL' || (state.editorRoles || ['TL', 'PS']).includes(role),
                isAuthenticated: true,
              };
            }
          }
        }
      } catch {}
    }

    // Default view when nobody is identified/logged in
    return {
      id: 'unauthenticated',
      collaboratorId: '',
      login: '',
      registration: '',
      name: '',
      role: 'Visitante',
      shift: state.teamShift || '',
      sector: state.sector || 'Operação',
      allowedSectors: [],
      canProvideCrossSectorSupport: false,
      isSupportAttendant: false,
      isAdmin: false,
      isEditor: false,
      isAuthenticated: false,
    };
  };

  const isSentByCurrentUser = (n: SystemNotification): boolean => {
    const user = getActiveUserIdentity();
    if (!user.name || !user.isAuthenticated) return false;
    if (n.data?.userId && String(n.data.userId) === user.id) return true;
    if (n.data?.userName && user.name && n.data.userName.trim().toLowerCase() === user.name.trim().toLowerCase()) return true;
    if (n.senderName && user.name && n.senderName.trim().toLowerCase() === user.name.trim().toLowerCase()) {
      return true;
    }
    return false;
  };

  // Decides whether a notification is relevant to the currently identified user
  // (direct target, admin/editor role, sector, cross-sector support, and shift match). Excludes notifications sent by current user unless showOwnSent is true.
  const isNotificationForCurrentUser = (
    n: SystemNotification,
    showOwnSent: boolean = false,
    contextUserId?: string
  ): boolean => {
    const user = getActiveUserIdentity(contextUserId);

    const myUserTokens = [
      user.id,
      user.collaboratorId,
      user.login,
      user.registration,
      user.name ? user.name.toLowerCase().trim() : '',
    ]
      .filter(Boolean)
      .map(String);

    // If user has cleared this notification individually, do not show it
    if (user.id && user.id !== 'unauthenticated') {
      const userTokens = [user.id, user.collaboratorId, user.login, user.registration, user.name?.toLowerCase().trim()].filter(Boolean) as string[];
      if (
        n.clearedByUserIds &&
        n.clearedByUserIds.some((uid) => userTokens.some((tok) => tok.toLowerCase() === String(uid).toLowerCase()))
      ) {
        return false;
      }
      if (
        n.data?.clearedByUserIds &&
        n.data.clearedByUserIds.some((uid) => userTokens.some((tok) => tok.toLowerCase() === String(uid).toLowerCase()))
      ) {
        return false;
      }
      try {
        const localKey = `dimensio_cleared_notifs_${user.id}`;
        const cached = JSON.parse(getAppStorage().getItem(localKey) || '[]');
        if (Array.isArray(cached) && cached.includes(n.id)) return false;
      } catch {}
    }

    // Filter out own sent unless requested
    if (!showOwnSent && isSentByCurrentUser(n)) {
      return false;
    }

    // If nobody is authenticated:
    if (!user.isAuthenticated) {
      // Only allow public general announcements with no private targeting, role requirements or specific shift
      if (n.type === 'password_reset' || n.type === 'request') return false;
      if (
        n.targetUserId ||
        (n.data as any)?.targetUserId ||
        n.data?.collaboratorId ||
        n.targetRole ||
        (n.shift && n.shift !== 'all' && n.shift !== 'todos')
      ) {
        return false;
      }
      return n.type === 'notice' || n.type === 'system';
    }

    // 1. DIRECT USER TARGETING CHECK
    const targetUserTokens = [
      n.targetUserId,
      (n.data as any)?.targetUserId,
      n.data?.targetCollaboratorId,
      n.data?.collaboratorId,
      n.data?.collaboratorName,
      ...(n.targetUsers || []),
      ...(Array.isArray(n.data?.selectedCollaborators) ? n.data!.selectedCollaborators : []),
    ]
      .filter(Boolean)
      .map(String);

    if (targetUserTokens.length > 0) {
      const isTargetedToMe = targetUserTokens.some((tid) => {
        const lowerTid = tid.toLowerCase().trim();
        return myUserTokens.some((tok) => {
          const lowerTok = tok.toLowerCase().trim();
          return lowerTok === lowerTid || (lowerTid.length > 3 && lowerTok.includes(lowerTid)) || (lowerTok.length > 3 && lowerTid.includes(lowerTok));
        });
      });

      if (!isTargetedToMe) {
        // If it's a request or password reset targeted to someone else, only admin/TL reviewing leadership requests can see it
        if ((n.type === 'request' || n.type === 'password_reset') && (user.isAdmin || user.isEditor)) {
          // Leadership review allowed
        } else {
          return false;
        }
      }
    }

    // 2. PASSWORD RESET TYPE CHECK
    if (n.type === 'password_reset') {
      // Only Admin or TL/Editor can see password reset requests
      if (!user.isAdmin && !user.isEditor && user.role !== 'TL' && user.role !== 'Admin') {
        return false;
      }
    }

    // 3. NOTIFICATION TYPE PREFERENCES
    if (n.type && notificationPreferences?.enabledTypes) {
      if (notificationPreferences.enabledTypes[n.type] === false) {
        return false;
      }
    }

    // 4. SECTOR & CROSS-SECTOR SUPPORT CHECK
    const notifSector = n.targetSector || n.data?.targetSector || n.data?.sector;
    const isCrossSectorRequest = n.isCrossSector || n.data?.isCrossSector || n.data?.action === 'new_support_request' || n.data?.action === 'support_request';

    if (notifSector && notifSector !== 'all' && notifSector !== 'todos' && !user.isAdmin) {
      const isMyDirectSector = notifSector.trim().toLowerCase() === (user.sector || '').trim().toLowerCase();
      const canCrossSupportThis =
        user.canProvideCrossSectorSupport &&
        (user.allowedSectors.length === 0 || user.allowedSectors.some((s) => s.trim().toLowerCase() === notifSector.trim().toLowerCase()));

      // If user is a designated Support Attendant, they can receive support requests across all sectors they support
      const isAttendingSupport = user.isSupportAttendant && isCrossSectorRequest;

      if (!isMyDirectSector && !canCrossSupportThis && !isAttendingSupport && !user.isEditor) {
        return false;
      }
    }

    // 5. TARGET ROLE CHECK
    if (n.targetRole) {
      const isOperationalRole =
        user.role === 'REP' ||
        user.role === 'Operador' ||
        user.role === 'Operadora' ||
        user.role === 'Operacional' ||
        user.role === 'Conferente' ||
        user.role === 'Separador' ||
        user.role === 'Auxiliar';

      const roleMatches =
        n.targetRole.toLowerCase() === user.role.toLowerCase() ||
        ((n.targetRole === 'Operador' || n.targetRole === 'Operacional') && isOperationalRole);

      if (n.targetRole === 'admin') {
        if (!user.isAdmin) return false;
      } else if (n.targetRole === 'editor') {
        if (!user.isEditor && !user.isAdmin) return false;
      } else if (n.targetRole === 'TL') {
        if (user.role !== 'TL' && !user.isAdmin) return false;
      } else if (n.targetRole === 'PS') {
        if (user.role !== 'PS' && !user.isAdmin) return false;
      } else if (!user.isAdmin) {
        if (notificationPreferences?.filterByRoleMode === 'my_role_only') {
          if (!roleMatches) return false;
        } else if (notificationPreferences?.filterByRoleMode === 'custom_roles') {
          const allowed = notificationPreferences.enabledRoles || [];
          if (!allowed.includes(n.targetRole) && !roleMatches) return false;
        } else if (!roleMatches) {
          return false;
        }
      }
    }

    // 6. SHIFT CHECK
    const notifShift = n.shift || n.targetShift || n.data?.shift;
    const audience = n.targetShiftAudience || n.data?.targetAudience;

    if (notifShift && notifShift !== 'all' && notifShift !== 'todos' && audience !== 'todos') {
      if (user.shift && user.shift !== notifShift && !user.isAdmin) {
        return false;
      }
    }

    return true;
  };

  // Unread count for the current user, honoring per-user readByUserIds/clearedByUserIds
  const getUnreadNotificationsCount = (contextUserId?: string): number => {
    const user = getActiveUserIdentity(contextUserId);
    const userTokens = [user.id, user.collaboratorId, user.login, user.registration]
      .filter(Boolean)
      .map((t) => String(t).toLowerCase().trim());
    return (state.notifications || []).filter((n) => {
      if (!isNotificationForCurrentUser(n, false, contextUserId)) return false;
      const readUsers = Array.isArray(n.readByUserIds) ? n.readByUserIds.map((r) => String(r).toLowerCase().trim()) : [];
      if (userTokens.length === 0) return !n.read;
      return !n.read && !userTokens.some((tok) => readUsers.includes(tok));
    }).length;
  };

  // Alerts the current user (sound / toast / native OS notification) about
  // notifications that just arrived from the cloud and are meant for them.
  const alertForNewRemoteNotifications = (remoteNotifs: SystemNotification[], localIds: Set<string>) => {
    const freshCutoffMs = Date.now() - 5 * 60 * 1000;
    remoteNotifs.forEach((n) => {
      const alreadySeen = localIds.has(n.id) || seenNotificationIds.current.has(n.id);
      seenNotificationIds.current.add(n.id);
      if (alreadySeen) return;
      const createdAtMs = new Date(n.createdAt).getTime();
      if (Number.isNaN(createdAtMs) || createdAtMs < freshCutoffMs) return;
      if (!isNotificationForCurrentUser(n)) return;
      const portalCfg = state.portalNotificationConfig || {};
      const isBroadcastNotice = n.type === 'notice' && n.data?.action === 'broadcast';
      const isSupportStatus = n.data?.action === 'support_status';
      const soundEnabled = portalCfg.soundAlerts ?? notifSoundEnabled;
      if (soundEnabled) {
        playNotificationSound();
      }
      if (portalCfg.vibrationAlerts) {
        triggerDeviceVibration([300, 100, 300]);
      }
      if (notifPopupEnabled) {
        const requestId = n.data?.requestId;
        if (requestId) {
          showNotice(`🔔 ${n.title}: ${n.message}`, 'Ver Pedido', () => {
            navigateTo('requests');
            focusServiceRequest(requestId);
          });
        } else {
          showNotice(`🔔 ${n.title}: ${n.message}`);
        }
      }
      const shiftNoticesDisabled = isBroadcastNotice && portalCfg.shiftNotices === false;
      const supportStatusDisabled = isSupportStatus && portalCfg.supportStatusAlerts === false;
      if (!shiftNoticesDisabled && !supportStatusDisabled) {
        showNativeOSNotification(n.title, { body: n.message });
      }
    });
  };

  const applyRemoteToLocal = (
    remoteCandidate: any,
    remoteUpdatedAtMs: number,
    opts?: { allowOlder?: boolean; skipSafetyBackup?: boolean }
  ): boolean => {
    const currentState = stateRef.current || state;
    const localUpdatedAtMs = Number(currentState.updatedAtMs) || 0;
    const localHasData = Array.isArray(currentState.collaborators) && currentState.collaborators.length > 0;

    // CRITICAL SAFETY (sessão): a sincronização automática NUNCA pode regredir
    // os dados locais. Um estado remoto só pode substituir o local quando for
    // estritamente mais novo que o local, ou quando o local está vazio (nada a
    // perder). Estados remotos mais antigos OU sem carimbo de tempo confiável
    // são recusados — assim, snapshots de nuvem antigos puxados enquanto a
    // planilha está fora do ar jamais apagam horas de edições locais.
    const remoteAge = remoteUpdatedAtMs || 0;
    if (!opts?.allowOlder && localHasData) {
      if (remoteAge === 0 || remoteAge <= localUpdatedAtMs) {
        return false;
      }
    }

    // Garante um ponto de restauração ANTES de qualquer estado remoto substituir
    // dados locais (usado pela recuperação de backup em nuvem; os caminhos de
    // force/poll já criam o próprio backup antes de chamar).
    if (localHasData && !opts?.skipSafetyBackup) {
      createAutoBackup('Estado Local Antes de Aplicar Dados Remotos', currentState);
    }

    isRemoteOrBroadcastUpdate.current = true;
    lastSyncedTimestampMs.current = remoteUpdatedAtMs;
    try { localStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, String(remoteUpdatedAtMs)); } catch {}

    const normalizedRemote = normalizeAppState(remoteCandidate, currentState);
    lastRemoteCollaboratorCount.current = normalizedRemote.collaborators.length;

    const now = new Date();
    const timestampStr = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;

    const remoteDeletedIds = Array.isArray(normalizedRemote.deletedNotificationIds) ? normalizedRemote.deletedNotificationIds : [];
    const localDeletedIds = Array.isArray(currentState.deletedNotificationIds) ? currentState.deletedNotificationIds : [];
    const mergedDeletedIds = Array.from(new Set([...localDeletedIds, ...remoteDeletedIds])).slice(-200);

    const remoteNotifs: SystemNotification[] = Array.isArray(normalizedRemote.notifications) ? normalizedRemote.notifications : [];
    // Ids seen BEFORE the merge, so newly arrived remote notifications actually
    // trigger the alert (sound / toast / native). Computing them after the merge
    // would mark every remote notification as "already seen" and silence alerts.
    const preMergeLocalNotifIds = new Set<string>((notificationsRef.current || []).map((n: SystemNotification) => n.id));
    const mergedNotifs = mergeNotifications(remoteNotifs, notificationsRef.current, mergedDeletedIds);
    notificationsRef.current = mergedNotifs;

    // auditLogs arrive truncated (cloud keeps only the last 30, without snapshot).
    // Merge them with local (dedupe by id, newest wins) so the audit trail is never
    // shortened or lost when pulling from the cloud.
    const remoteAudits: AuditLogEntry[] = Array.isArray(normalizedRemote.auditLogs) ? normalizedRemote.auditLogs : [];
    const localAudits: AuditLogEntry[] = Array.isArray(currentState.auditLogs) ? currentState.auditLogs : [];
    const auditById = new Map<string, AuditLogEntry>();
    [...remoteAudits, ...localAudits].forEach((l) => {
      if (!l || !l.id) return;
      const existing = auditById.get(l.id);
      if (!existing || String(l.timestamp || '') >= String(existing.timestamp || '')) {
        auditById.set(l.id, l);
      }
    });
    const mergedAuditLogs = Array.from(auditById.values())
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .slice(0, 300);

    setState((prev) => {
      const nextState: AppState = {
        ...normalizedRemote,
        isSidebarCollapsed: prev.isSidebarCollapsed ?? normalizedRemote.isSidebarCollapsed ?? false,
        deletedNotificationIds: mergedDeletedIds,
        notifications: mergedNotifs,
        auditLogs: mergedAuditLogs,
        // Keep the full local backup snapshots (cloud only carries stripped copies).
        autoBackups: prev.autoBackups ?? normalizedRemote.autoBackups ?? [],
        isSampleData: false,
        updatedAtMs: remoteUpdatedAtMs,
        onlineSpreadsheet: prev.onlineSpreadsheet
          ? {
              ...prev.onlineSpreadsheet,
              lastSyncedAt: timestampStr,
              syncStatus: 'success',
              lastError: undefined,
            }
          : null,
      };
      stateRef.current = nextState;
      return nextState;
    });

    const activeRemoteNotifs = remoteNotifs.filter((n) => !mergedDeletedIds.includes(n.id));
    alertForNewRemoteNotifications(activeRemoteNotifs, preMergeLocalNotifIds);
    return true;
  };

  const fetchFromConfig = async (config: OnlineSpreadsheetConfig | null | undefined, isSilent = false, force = false): Promise<boolean> => {
    const currentConfig = config || null;
    if (!currentConfig) return false;

    // --- FIRESTORE PROVIDER PATH ---
    if (currentConfig.databaseProvider === 'firestore') {
      if (isConnectingRef.current || isFetchingRef.current) return false;
      isFetchingRef.current = true;
      try {
        const collectionName = currentConfig.firestoreCollection?.trim() || 'dimensio_workspaces';
        const docId = 'main_roster_state';
        const { state: remoteData, updatedAtMs: remoteUpdatedAtMs } = await fetchStateFromFirestoreOnce(collectionName, docId);
        
        consecutiveFailuresRef.current = 0;
        lastFetchReachedServer.current = true;
        setCloudOnline(true);

        const currentState = stateRef.current || state;
        if (!remoteData) {
          if (force && currentState.collaborators.length > 0) {
            const success = await syncToConfig(currentConfig, false);
            if (success && !isSilent) {
              showNotice('Banco Firestore conectado e inicializado com sucesso!', undefined, undefined, 'sync');
            }
            return success;
          }
          return false;
        }

        const normalizedRemote = normalizeAppState(remoteData, currentState);
        const localUpdatedAtMs = Number(currentState.updatedAtMs) || 0;

        const remoteDeletedIds = Array.isArray(normalizedRemote.deletedNotificationIds) ? normalizedRemote.deletedNotificationIds : [];
        const localDeletedIds = Array.isArray(currentState.deletedNotificationIds) ? currentState.deletedNotificationIds : [];
        const mergedDeletedIds = Array.from(new Set([...localDeletedIds, ...remoteDeletedIds])).slice(-200);

        const remoteNotifs: SystemNotification[] = Array.isArray(normalizedRemote.notifications) ? normalizedRemote.notifications : [];
        if (remoteNotifs.length > 0 || remoteDeletedIds.length > 0) {
          const prevLocalNotifs = notificationsRef.current || [];
          const prevLocalNotifIds = new Set<string>(prevLocalNotifs.map((n) => n.id));
          const mergedNotifs = mergeNotifications(remoteNotifs, prevLocalNotifs, mergedDeletedIds);
          if (mergedNotifs.length !== prevLocalNotifs.length || mergedDeletedIds.length !== localDeletedIds.length) {
            notificationsRef.current = mergedNotifs;
            setState((prev) => ({
              ...prev,
              deletedNotificationIds: mergedDeletedIds,
              notifications: mergedNotifs,
            }));
          }
          const activeRemoteNotifs = remoteNotifs.filter((n) => !mergedDeletedIds.includes(n.id));
          alertForNewRemoteNotifications(activeRemoteNotifs, prevLocalNotifIds);
        }

        if (force || (remoteUpdatedAtMs > 0 && remoteUpdatedAtMs > localUpdatedAtMs)) {
          applyRemoteToLocal(normalizedRemote, remoteUpdatedAtMs, { allowOlder: force });
          lastSyncedTimestampMs.current = remoteUpdatedAtMs;
          if (!isSilent) {
            showNotice('Dados sincronizados com o Firestore!', undefined, undefined, 'sync');
          }
          return true;
        }
        return true;
      } catch (err) {
        console.warn('Erro ao buscar dados do Firestore:', err);
        setCloudOnline(false);
        return false;
      } finally {
        isFetchingRef.current = false;
      }
    }

    // --- GOOGLE SHEETS WEBHOOK PATH ---
    if (!currentConfig.webhookUrl) return false;

    const webhookUrl = currentConfig.webhookUrl.trim();
    if (webhookUrl.includes('docs.google.com/spreadsheets')) return false;

    if (isConnectingRef.current || isFetchingRef.current) return false;
    isFetchingRef.current = true;

    try {
      let res: Response | null = null;
      let lastErr: any = null;
      let getUrl = webhookUrl;
      try {
        const u = new URL(webhookUrl);
        if (currentConfig.url) {
          u.searchParams.set('spreadsheetUrl', currentConfig.url);
          const m = currentConfig.url.match(/\/d\/([a-zA-Z0-9-_]+)/);
          if (m) u.searchParams.set('spreadsheetId', m[1]);
        }
        getUrl = u.toString();
      } catch {
        // Invalid URL
      }

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          res = await fetchWithTimeout(getUrl, { method: 'GET' }, 25000);
          if (res.ok) break;
        } catch (e) {
          lastErr = e;
          if (attempt < 1) await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (!res || !res.ok) throw lastErr || new Error('HTTP Error');
      consecutiveFailuresRef.current = 0;
      lastFetchReachedServer.current = true;
      setCloudOnline(true);
      const data = await res.json();
      const currentState = stateRef.current || state;

      const isDataEmpty = !data || data.status === 'empty' || data.status === 'empty_db_has_tabs';
      const remoteStateCandidate = isDataEmpty ? null : (data.rawState || (data.collaborators ? data : null));

      if (isDataEmpty || !remoteStateCandidate) {
        // Fallback: search cloud snapshots (__BACKUP__ / __BACKUP_DAILY__) for recent data
        const recovered = await fetchLatestCloudBackup(currentConfig, isSilent);
        if (recovered) return true;

        if (force && currentState.collaborators.length > 0) {
          const success = await syncToConfig(currentConfig, false);
          if (success && !isSilent) {
            showNotice('Planilha conectada e inicializada com sucesso com os seus dados locais!', undefined, undefined, 'sync');
          }
          return success;
        }
        if (force && !isSilent) {
          showNotice('A planilha conectada está vazia. Use "Enviar para a Planilha" para publicar seus dados.', undefined, undefined, 'sync');
        }
        return false;
      }

      const normalizedRemote = normalizeAppState(remoteStateCandidate, currentState);
      const remoteUpdatedAtMs = Number(normalizedRemote.updatedAtMs) || 0;
      const localUpdatedAtMs = Number(currentState.updatedAtMs) || 0;

      const remoteDeletedIds = Array.isArray(normalizedRemote.deletedNotificationIds) ? normalizedRemote.deletedNotificationIds : [];
      const localDeletedIds = Array.isArray(currentState.deletedNotificationIds) ? currentState.deletedNotificationIds : [];
      const mergedDeletedIds = Array.from(new Set([...localDeletedIds, ...remoteDeletedIds])).slice(-200);

      // Notifications are additive and safe: deliver NEW remote notifications
      // immediately (sound/toast), even when the full-state apply below is
      // skipped by the timestamp or local-edit guards. This keeps notification
      // latency low even while the user is actively editing.
      const remoteNotifs: SystemNotification[] = Array.isArray(normalizedRemote.notifications) ? normalizedRemote.notifications : [];
      if (remoteNotifs.length > 0 || remoteDeletedIds.length > 0) {
        const prevLocalNotifs = notificationsRef.current || [];
        const prevLocalNotifIds = new Set<string>(prevLocalNotifs.map((n) => n.id));
        const mergedNotifs = mergeNotifications(remoteNotifs, prevLocalNotifs, mergedDeletedIds);
        if (mergedNotifs.length !== prevLocalNotifs.length || mergedDeletedIds.length !== localDeletedIds.length) {
          isRemoteOrBroadcastUpdate.current = true;
          notificationsRef.current = mergedNotifs;
          setState((prev) => ({
            ...prev,
            deletedNotificationIds: mergedDeletedIds,
            notifications: mergedNotifs,
          }));
        }
        const activeRemoteNotifs = remoteNotifs.filter((n) => !mergedDeletedIds.includes(n.id));
        alertForNewRemoteNotifications(activeRemoteNotifs, prevLocalNotifIds);
      }

      // Force pull explicitly requested by user OR on connection
      if (force === true) {
        if (currentState.collaborators.length > 0) {
          createAutoBackup('Backup de Segurança Antes de Puxar da Nuvem');
        }
        applyRemoteToLocal(normalizedRemote, remoteUpdatedAtMs || Date.now(), { allowOlder: true, skipSafetyBackup: true });
        if (!isSilent) {
          showNotice(`Dados da planilha carregados com sucesso! (${normalizedRemote.collaborators.length} colaboradores, ${normalizedRemote.tasks.length} postos)`, undefined, undefined, 'sync');
        }
        return true;
      }

      // Never overwrite local state if remote is older or equal to local
      if (remoteUpdatedAtMs <= localUpdatedAtMs) {
        if (
          !isSilent &&
          !warnedRemoteOlder.current &&
          Array.isArray(currentState.collaborators) &&
          currentState.collaborators.length > 0
        ) {
          warnedRemoteOlder.current = true;
          showNotice(
            'A nuvem não contém dados mais recentes que os locais. Seus dados locais foram preservados (nada foi sobrescrito).',
            undefined,
            undefined,
            'sync'
          );
        }
        return false;
      }

      // Protection against race conditions: if user performed a local edit very recently (< 2.5s),
      // do not let background polling overwrite local state before autoSync push lands.
      const timeSinceLastEdit = Date.now() - lastLocalEditTime.current;
      if (timeSinceLastEdit < 2500) {
        return false;
      }

      // Auto-sync polling: apply if remote is strictly newer than local and last synced
      if (
        remoteUpdatedAtMs > 0 &&
        remoteUpdatedAtMs > localUpdatedAtMs &&
        remoteUpdatedAtMs > lastSyncedTimestampMs.current
      ) {
        if (currentState.collaborators.length > 0) {
          createAutoBackup('Backup de Segurança Antes de Sincronizar da Nuvem');
        }
        applyRemoteToLocal(normalizedRemote, remoteUpdatedAtMs, { skipSafetyBackup: true });
        if (!isSilent) {
          showNotice('Mudança sincronizada em tempo real da planilha!', undefined, undefined, 'sync');
        }
        return true;
      }

      return false;
    } catch (err) {
      if (!isSilent) {
        console.warn('Erro ao buscar dados da planilha compartilhada:', err);
      }
      setCloudOnline(false);
      const recovered = await fetchLatestCloudBackup(currentConfig, isSilent);
      if (recovered) return true;
      return false;
    } finally {
      isFetchingRef.current = false;
    }
  };

  const fetchFromOnlineSpreadsheet = useCallback(async (isSilent = false): Promise<boolean> => {
    return fetchFromOnlineSpreadsheetRef.current(isSilent);
  }, []);
  // Always-latest fetch function so the polling worker effect doesn't need
  // state.updatedAtMs in its deps (which would recreate the worker on every edit).
  const fetchFromOnlineSpreadsheetRef = useRef<(isSilent?: boolean) => Promise<boolean>>((isSilent = false) => {
    return fetchFromConfig(stateRef.current.onlineSpreadsheet, isSilent);
  });
  fetchFromOnlineSpreadsheetRef.current = (isSilent = false) => {
    return fetchFromConfig(stateRef.current.onlineSpreadsheet, isSilent);
  };

  const syncToConfig = async (config: OnlineSpreadsheetConfig | null | undefined, isAutoSync = false): Promise<boolean> => {
    const currentConfig = config || null;
    if (!currentConfig) {
      if (!isAutoSync) showNotice('Nenhum banco de dados ou planilha conectado.');
      return false;
    }

    const currentState = stateRef.current || state;

    // --- FIRESTORE PROVIDER PUSH ---
    if (currentConfig.databaseProvider === 'firestore') {
      const now = new Date();
      const timestampMs = Math.max(currentState.updatedAtMs || 0, Date.now());
      const timestampStr = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;
      const collectionName = currentConfig.firestoreCollection?.trim() || 'dimensio_workspaces';
      const docId = 'main_roster_state';

      try {
        const res = await pushStateToFirestore(currentState, collectionName, docId);
        if (res.success) {
          consecutiveFailuresRef.current = 0;
          setCloudOnline(true);
          lastSyncedTimestampMs.current = timestampMs;

          setState((prev) => ({
            ...prev,
            onlineSpreadsheet: prev.onlineSpreadsheet
              ? {
                  ...prev.onlineSpreadsheet,
                  lastSyncedAt: timestampStr,
                  syncCount: (prev.onlineSpreadsheet.syncCount || 0) + 1,
                  syncStatus: 'success',
                  lastError: undefined,
                }
              : null,
          }));

          if (!isAutoSync) {
            showNotice('Sincronização em nuvem (Firestore) realizada com sucesso!');
          }
          return true;
        } else {
          throw new Error(res.error || 'Erro ao gravar no Firestore');
        }
      } catch (err: any) {
        console.warn('Erro ao sincronizar com o Firestore:', err);
        setCloudOnline(false);
        const errMsg = err?.message || 'Falha ao sincronizar com o Firestore';
        setState((prev) => ({
          ...prev,
          onlineSpreadsheet: prev.onlineSpreadsheet
            ? {
                ...prev.onlineSpreadsheet,
                syncStatus: 'error',
                lastError: errMsg,
              }
            : null,
        }));
        if (!isAutoSync) {
          showNotice(`Erro ao salvar no Firestore: ${errMsg}`);
        }
        return false;
      }
    }

    // --- GOOGLE SHEETS WEBHOOK PUSH ---
    // An explicit push (manual "Enviar para a Planilha") is a user decision.

    // Destructive auto-push protection: never automatically shrink the spreadsheet
    // roster. A local deletion must go through the explicit "Enviar para a Planilha".
    if (isAutoSync && lastRemoteCollaboratorCount.current > 0 && currentState.collaborators.length < lastRemoteCollaboratorCount.current) {
      return false;
    }

    const webhookUrl = currentConfig.webhookUrl?.trim();
    if (!webhookUrl) {
      if (!isAutoSync) {
        showNotice('URL de Webhook (Google Apps Script) não informada. Configure nas opções para sincronizar na nuvem.');
      }
      return false;
    }

    // Check if user pasted standard Google Sheets URL into Webhook URL field
    if (webhookUrl.includes('docs.google.com/spreadsheets')) {
      const errMsg = 'A URL do Webhook deve ser o link do Web App do Google Apps Script (https://script.google.com/macros/s/.../exec), e não o link direto da planilha.';
      setState((prev) => ({
        ...prev,
        onlineSpreadsheet: prev.onlineSpreadsheet
          ? { ...prev.onlineSpreadsheet, syncStatus: 'error', lastError: errMsg }
          : null,
      }));
      if (!isAutoSync) showNotice(`Erro de Configuração: ${errMsg}`);
      return false;
    }

    const now = new Date();
    // Never push with a stale timestamp: a push carrying an older updatedAtMs than
    // the cloud blob would regress the spreadsheet and other devices would not pull it.
    const timestampMs = Math.max(currentState.updatedAtMs || 0, Date.now());
    const timestampStr = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;

    try {
      // Validate URL syntax
      new URL(webhookUrl);

      const dayReport = currentState.dailyReports[currentState.selectedDate] || {};

      // Calculate absenteeism & report metrics
      const totalCols = currentState.collaborators.length;
      let presentCount = 0;
      let absentCount = 0;
      let vacationCount = 0;
      let leaveTrainingCount = 0;
      let offCount = 0;

      const absenceDetailsList: any[] = [];

      currentState.collaborators.forEach((c) => {
        const statusInfo = getCollaboratorStatus(c, currentState.selectedDate, currentState);
        const taskName = currentState.tasks.find((t) => t.members.includes(c.id))?.name || 'Não Dimensionado';
        const reason = dayReport.absenceReasons?.[c.id] || '';
        const occurrence = dayReport.occurrences?.[c.id] || '';

        if (statusInfo.status === 'presente' || statusInfo.status === 'atraso') {
          presentCount++;
        } else if (isAbsenteeismStatus(statusInfo.status)) {
          absentCount++;
        } else if (statusInfo.status === 'ferias') {
          vacationCount++;
        } else if (statusInfo.status === 'licenca' || statusInfo.status === 'treinamento') {
          leaveTrainingCount++;
        } else if (statusInfo.status === 'folga') {
          offCount++;
        }

        if (statusInfo.status !== 'presente' || reason || occurrence) {
          absenceDetailsList.push({
            date: formatDateBR(currentState.selectedDate),
            registration: c.registration,
            name: c.name,
            login: c.login,
            role: c.role,
            category: c.category,
            teamLeader: c.teamLeader || currentState.defaultTeamLeader || 'Sem Líder',
            status: statusInfo.status,
            task: taskName,
            absenceReason: reason || (statusInfo.absenceDetail ? `${statusInfo.absenceDetail.type.toUpperCase()}: ${statusInfo.absenceDetail.notes || ''}` : 'Não informada'),
            occurrence: occurrence || 'Nenhuma',
          });
        }
      });

      const absenteeismRate = totalCols > 0 ? ((absentCount / totalCols) * 100).toFixed(1) + '%' : '0%';

      let spreadsheetId = '';
      if (currentConfig.url) {
        const match = currentConfig.url.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) spreadsheetId = match[1];
      }

      // Team Leader / Time stats with HC count (TL role excluded from HC)
      const leaderStats = (currentState.teamLeaders || []).map((tl) => {
        const teamCols = currentState.collaborators.filter((c) => (c.teamLeader || currentState.defaultTeamLeader || 'Sem Time') === tl);
        const hcCount = teamCols.filter((c) => c.role !== 'TL').length;
        return {
          teamLeader: tl,
          totalCollaborators: teamCols.length,
          teamLeadersInTime: teamCols.filter((c) => c.role === 'TL').length,
          hcCount,
        };
      });

      // Calendar entries are sent as 2D rows [date, group] so Range.setValues in
      // the Apps Script always receives an array of arrays (any script version).
      const calendarRows = Object.entries(currentState.calendar || {}).map(([date, group]) => [formatDateBR(date), group]);

      // Sheets cell limit is 50,000 chars. Audit log snapshots are huge (each
      // carries a full state copy) and only needed locally for rollback — strip
      // them before sending to the cloud to avoid exceeding the cell limit.
      const syncSafeAuditLogs = (currentState.auditLogs || []).slice(0, 30).map((l) => ({
        ...l,
        snapshot: undefined,
      }));
      const syncSafeAutoBackups = (currentState.autoBackups || []).slice(-5).map((b) => ({
        ...b,
        snapshot: undefined,
      }));
      const rawStateSync: any = {
        updatedAtMs: timestampMs,
        updatedAt: timestampStr,
        location: currentState.location,
        shifts: currentState.shifts,
        scaleType: currentState.scaleType,
        scaleGroups: currentState.scaleGroups,
        collaborators: currentState.collaborators,
        deletedCollaborators: currentState.deletedCollaborators,
        tempNotes: currentState.tempNotes,
        tasks: currentState.tasks,
        breaks: currentState.breaks,
        attendance: currentState.attendance,
        intervals: currentState.intervals,
        roles: currentState.roles,
        categories: currentState.categories,
        skills: currentState.skills,
        teamLeaders: currentState.teamLeaders,
        teamShiftMap: currentState.teamShiftMap,
        teams: currentState.teams,
        shiftConfigs: currentState.shiftConfigs,
        dailyReports: currentState.dailyReports,
        teamName: currentState.teamName,
        sector: currentState.sector,
        manager: currentState.manager,
        teamShift: currentState.teamShift,
        calendar: currentState.calendar,
        setupCompleted: currentState.setupCompleted,
        defaultTeamLeader: currentState.defaultTeamLeader,
        serviceRequests: currentState.serviceRequests,
        notifications: currentState.notifications,
        deletedNotificationIds: currentState.deletedNotificationIds || [],
        briefingConfig: currentState.briefingConfig,
        feedbackConfig: currentState.feedbackConfig,
        autoBackupSettings: currentState.autoBackupSettings,
        autoBackups: syncSafeAutoBackups,
        processKnowledgeList: currentState.processKnowledgeList,
        roleTypes: currentState.roleTypes,
        editorRoles: currentState.editorRoles,
        userPasswords: currentState.userPasswords,
        auditLogs: syncSafeAuditLogs,
        infoHubReminders: currentState.infoHubReminders,
        infoHubLinks: currentState.infoHubLinks,
        infoHubQuickFills: currentState.infoHubQuickFills,
        metricDefinitions: currentState.metricDefinitions || [],
        metricReadings: currentState.metricReadings || [],
        absenteeismPeriodDays: currentState.absenteeismPeriodDays,
        rolePermissions: currentState.rolePermissions,
        showBriefingSlide: currentState.showBriefingSlide,
        showEmployeePortal: currentState.showEmployeePortal,
        showOperatorPortal: currentState.showOperatorPortal,
        abbreviatePortalNames: currentState.abbreviatePortalNames,
        showInfoHub: currentState.showInfoHub,
        showRadioModule: currentState.showRadioModule,
        customShortcuts: currentState.customShortcuts,
        sidebarOrder: currentState.sidebarOrder,
        supportMessages: currentState.supportMessages,
        helpdeskConfig: currentState.helpdeskConfig,
        shareCustomConfig: currentState.shareCustomConfig,
        shareFilters: currentState.shareFilters,
        reportExportConfig: currentState.reportExportConfig,
        portalConfig: currentState.portalConfig,
        portalNotificationConfig: currentState.portalNotificationConfig,
        hiddenSidebarItems: currentState.hiddenSidebarItems,
        widgetsConfig: currentState.widgetsConfig,
        theme: currentState.theme,
        requireUserPassword: currentState.requireUserPassword,
        // Dados operacionais que antes ficavam só no dispositivo local e eram
        // zerados ao aplicar um estado remoto (perda irreversível):
        history: currentState.history,
        showWidgetsModule: currentState.showWidgetsModule,
        showRoutinesModule: currentState.showRoutinesModule,
        scheduledTasks: currentState.scheduledTasks,
        scheduledTaskLists: currentState.scheduledTaskLists,
        catalogs: currentState.catalogs,
        autoBackupConfig: currentState.autoBackupConfig,
        extensionConfig: currentState.extensionConfig,
      };
      // Final safety: if payload still exceeds Sheets 50K cell limit, drop auditLogs entirely
      let payloadStr = JSON.stringify({ rawState: rawStateSync });
      if (payloadStr.length > 49000) {
        rawStateSync.auditLogs = [];
        payloadStr = JSON.stringify({ rawState: rawStateSync });
      }

      const payload = {
        spreadsheetUrl: currentConfig.url || '',
        spreadsheetId: spreadsheetId,
        // Auto-sync (background edits) only updates the cloud DB blob for fast
        // inter-device sync. Manual "Enviar para a Planilha" does the full rebuild.
        quickSync: isAutoSync === true,
        rawState: rawStateSync,
        date: formatDateBR(currentState.selectedDate),
        location: currentState.location,
        teamName: currentState.teamName,
        sector: currentState.sector,
        manager: currentState.manager,
        shift: currentState.teamShift,
        shifts: currentState.shifts,
        scaleType: currentState.scaleType,
        scaleGroups: currentState.scaleGroups,
        collaboratorsCount: currentState.collaborators.length,
        // Master CRUD Collaborators List
        collaboratorsMaster: currentState.collaborators.map((c) => ({
          id: c.id,
          registration: c.registration || '',
          name: c.name || '',
          login: c.login || '',
          location: currentState.location || '',
          sector: currentState.sector || '',
          manager: currentState.manager || '',
          shift: c.shift || currentState.teamShift || '',
          teamLeader: c.teamLeader || currentState.defaultTeamLeader || 'Sem Time',
          scale: c.scale || '',
          role: c.role || '',
          category: c.category || '',
          skills: c.skills && typeof c.skills === 'object' && Object.keys(c.skills).length > 0 
            ? Object.entries(c.skills).map(([sk, lv]) => `${sk} (${lv})`).join(', ') 
            : 'Nenhuma',
          status: 'Ativo',
        })),
        data: currentState.collaborators.map((c) => {
          const st = getCollaboratorStatus(c, currentState.selectedDate, currentState);
          const taskName = currentState.tasks.find((t) => t.members.includes(c.id))?.name || 'Não Dimensionado';
          const dayInt = currentState.intervals[currentState.selectedDate] || {};
          const breakSlot = currentState.breaks.find((b) => (dayInt[b.id] || []).includes(c.id))?.time || 'Sem Intervalo';
          return {
            date: formatDateBR(currentState.selectedDate),
            registration: c.registration,
            name: c.name,
            login: c.login,
            location: currentState.location,
            sector: currentState.sector,
            manager: currentState.manager,
            shift: c.shift || currentState.teamShift,
            teamLeader: c.teamLeader || currentState.defaultTeamLeader || 'Sem Time',
            scale: c.scale,
            role: c.role,
            category: c.category,
            status: st.status,
            task: taskName,
            interval: breakSlot,
          };
        }),
        // Structured tables used by the Google Apps Script to build an organized spreadsheet
        tables: {
          shifts: (currentState.shifts || []).map((s) => ({ shift: s })),
          scaleGroups: (currentState.scaleGroups || []).map((g) => ({ scaleGroup: g, type: currentState.scaleType })),
          teamLeaders: leaderStats,
          roles: (currentState.roles || []).map((r) => ({ role: r })),
          categories: (currentState.categories || []).map((c) => ({ category: c })),
          skills: (currentState.skills || []).map((s) => ({ skill: s })),
          tasks: currentState.tasks.map((t) => ({
            id: t.id,
            name: t.name,
            membersCount: t.members.length,
            allowedRoles: (t.allowedRoles || []).join(', ') || 'Todos',
            allowedCategories: (t.allowedCategories || []).join(', ') || 'Todas',
            active: t.active !== false ? 'Sim' : 'Não',
          })),
          breaks: currentState.breaks.map((b) => ({
            time: b.time,
            shift: b.shift || 'Geral',
            capacity: b.capacity || 'Sem limite',
          })),
          calendar: calendarRows,
        },
        reports: {
          date: formatDateBR(currentState.selectedDate),
          location: currentState.location,
          teamName: currentState.teamName,
          sector: currentState.sector,
          manager: currentState.manager,
          totalCollaborators: totalCols,
          presentCount,
          absentCount,
          vacationCount,
          leaveTrainingCount,
          offCount,
          absenteeismRate,
          generalNotes: dayReport.generalNotes || 'Nenhuma observação',
          generatedAt: dayReport.generatedAt || timestampStr,
          absencesAndOccurrences: absenceDetailsList,
        },
        settings: {
          location: currentState.location,
          teamName: currentState.teamName,
          sector: currentState.sector,
          manager: currentState.manager,
          teamShift: currentState.teamShift,
          shifts: currentState.shifts,
          scaleType: currentState.scaleType,
          scaleGroups: currentState.scaleGroups,
          defaultTeamLeader: currentState.defaultTeamLeader || 'Sem Líder Padrão',
          onlineSpreadsheetName: currentConfig.name,
          onlineSpreadsheetUrl: currentConfig.url,
          onlineWebhookUrl: currentConfig.webhookUrl || 'Não configurado',
          autoSyncEnabled: currentConfig.autoSyncEnabled !== false ? 'Sim' : 'Não',
          autoBackupEnabled: (currentState.autoBackupSettings?.enabled ?? true) ? 'Sim' : 'Não',
          autoBackupIntervalMinutes: currentState.autoBackupSettings?.intervalMinutes || 30,
          autoBackupsCount: (currentState.autoBackups || []).length,
          roles: currentState.roles,
          categories: currentState.categories,
          skills: currentState.skills,
          teamLeaders: currentState.teamLeaders,
          tasks: currentState.tasks.map((t) => ({
            id: t.id,
            name: t.name,
            membersCount: t.members.length,
            allowedRoles: t.allowedRoles || [],
            allowedCategories: t.allowedCategories || [],
          })),
          breaks: currentState.breaks.map((b) => ({
            id: b.id,
            time: b.time,
            shift: b.shift || 'Geral',
          })),
          totalCollaborators: currentState.collaborators.length,
          updatedAt: timestampStr,
        },
      };

      // Sheets cell limit is 50,000 chars. If payload exceeds it, drop
      // auditLogs (snapshots are large and only needed locally for rollback).
      let bodyStr = JSON.stringify(payload);
      if (bodyStr.length > 49000) {
        payload.rawState.auditLogs = [];
        bodyStr = JSON.stringify(payload);
      }
      // Last resort: never fail the push silently. Truncate the history list
      // (kept in full locally) so the payload always fits and reaches the cloud.
      if (bodyStr.length > 49000 && Array.isArray(payload.rawState.history)) {
        payload.rawState.history = payload.rawState.history.slice(-10);
        bodyStr = JSON.stringify(payload);
      }

      const postUrl = buildWebhookUrl(webhookUrl, currentConfig);
      const timeoutMs = isAutoSync ? 25000 : 75000;

      let syncRes: Response | null = null;
      let syncErr: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          syncRes = await fetchWithTimeout(postUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: bodyStr,
          }, timeoutMs);
          if (syncRes.ok) break;
        } catch (e) {
          syncErr = e;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        }
      }

      if (!syncRes || !syncRes.ok) throw syncErr || new Error('HTTP Error');

      let syncPayloadStatus: string | null = null;
      let syncPayloadMessage = '';
      try {
        const parsed = await syncRes.json();
        if (parsed && typeof parsed.status === 'string') {
          syncPayloadStatus = parsed.status;
          syncPayloadMessage = parsed.message || '';
        }
      } catch {
        // Non-JSON response
      }
      if (syncPayloadStatus === 'error') {
        throw new Error(syncPayloadMessage || 'Erro interno do Google Apps Script ao atualizar a planilha.');
      }
      // A planilha recusou a gravação (dados de exemplo/vazios tentando
      // substituir dados reais). NÃO marcar como sucesso.
      if (syncPayloadStatus === 'blocked') {
        setState((prev) => ({
          ...prev,
          onlineSpreadsheet: prev.onlineSpreadsheet
            ? {
                ...prev.onlineSpreadsheet,
                syncStatus: isAutoSync ? (prev.onlineSpreadsheet.syncStatus || 'success') : 'error',
                lastSyncedAt: prev.onlineSpreadsheet.lastSyncedAt,
                lastError: syncPayloadMessage || 'A planilha bloqueou a sincronização para proteger dados reais.',
              }
            : null,
        }));
        if (!isAutoSync) {
          showNotice(syncPayloadMessage || 'A planilha bloqueou a sincronização para proteger os dados reais.');
        }
        return false;
      }

      // Only mark as synced AFTER successful POST — prevents poisoning
      // future pulls when the push fails (Bug 3 fix).
      lastSyncedTimestampMs.current = timestampMs;
      try { localStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, String(timestampMs)); } catch {}
      consecutiveFailuresRef.current = 0;
      lastRemoteCollaboratorCount.current = state.collaborators.length;
      setCloudOnline(true);
      setState((prev) => ({
        ...prev,
        onlineSpreadsheet: prev.onlineSpreadsheet
          ? {
              ...prev.onlineSpreadsheet,
              lastSyncedAt: timestampStr,
              syncCount: (prev.onlineSpreadsheet.syncCount || 0) + 1,
              syncStatus: 'success',
              lastError: undefined,
            }
          : null,
      }));

      if (!isAutoSync) {
        showNotice(`Sincronização realizada com sucesso! Planilha "${currentConfig.name}" atualizada.`);
      }
      return true;
    } catch (err) {
      console.warn('Sincronização com Google Sheets não pôde ser concluída:', err);
      consecutiveFailuresRef.current += 1;
      setCloudOnline(false);
      
      const errMsg = err instanceof Error ? err.message : String(err);
      const detailedError = errMsg && /Erro interno do Google Apps Script|Exception:/.test(errMsg)
        ? errMsg
        : 'Falha ao conectar com o Google Apps Script. Verifique se no Apps Script a opção "Quem tem acesso" foi configurada como "Qualquer pessoa" e se o link termina em "/exec".';

      const shouldMarkError = !isAutoSync || consecutiveFailuresRef.current >= 3;

      setState((prev) => ({
        ...prev,
        onlineSpreadsheet: prev.onlineSpreadsheet
          ? {
              ...prev.onlineSpreadsheet,
              syncStatus: shouldMarkError ? 'error' : (prev.onlineSpreadsheet.syncStatus || 'success'),
              lastSyncedAt: prev.onlineSpreadsheet.lastSyncedAt || timestampStr,
              lastError: shouldMarkError ? detailedError : prev.onlineSpreadsheet.lastError,
            }
          : null,
      }));

      if (!isAutoSync) {
        showNotice(detailedError);
      }
      return false;
    }
  };

  const syncToOnlineSpreadsheet = async (isAutoSync = false): Promise<boolean> => {
    return syncToConfig(state.onlineSpreadsheet, isAutoSync);
  };
  // Always-latest ref so effects with stable deps can push the freshest state.
  const syncToOnlineSpreadsheetRef = useRef<(isAutoSync?: boolean) => Promise<boolean>>(syncToOnlineSpreadsheet);
  syncToOnlineSpreadsheetRef.current = syncToOnlineSpreadsheet;

  // Força a RECRIAÇÃO completa da planilha E do banco de dados em nuvem a partir
  // dos dados locais atuais (ex.: logo após importar um backup). Faz uma
  // publicação COMPLETA (quickSync = false) que reconstrói todas as abas visuais
  // e grava o blob __DB_STATE__.
  const forceRecreateCloudSpreadsheet = async (
    customWebhookUrl?: string,
    customSheetUrl?: string,
    customSheetName?: string
  ): Promise<boolean> => {
    const currentState = stateRef.current || state;
    const webhook = (customWebhookUrl || currentState.onlineSpreadsheet?.webhookUrl || '').trim();
    const sheetUrl = (customSheetUrl || currentState.onlineSpreadsheet?.url || '').trim();
    const sheetName = (customSheetName || currentState.onlineSpreadsheet?.name || 'Planilha do Dimensio').trim();

    if (!webhook) {
      showNotice(
        'Nenhuma URL de Webhook fornecida. Preencha o campo de Webhook antes de recriar a planilha.',
        undefined,
        undefined,
        'sync'
      );
      return false;
    }

    const targetConfig: OnlineSpreadsheetConfig = {
      name: sheetName,
      url: sheetUrl,
      webhookUrl: webhook,
      lastSyncedAt: currentState.onlineSpreadsheet?.lastSyncedAt,
      syncCount: currentState.onlineSpreadsheet?.syncCount || 0,
      autoSyncEnabled: currentState.onlineSpreadsheet?.autoSyncEnabled !== false,
      syncStatus: 'testing',
    };

    updateLocalState((prev) => ({ ...prev, onlineSpreadsheet: targetConfig }));

    lastSyncedTimestampMs.current = 0;
    try { localStorage.removeItem(LAST_SYNCED_TIMESTAMP_KEY); } catch {}

    const ok = await syncToConfig(targetConfig, false);
    if (ok) {
      showNotice(
        'Planilha e banco de dados em nuvem recriados com sucesso a partir dos dados locais! Todos os colaboradores e as abas (Painel, Escala, Tarefas etc.) foram reconstruídos.',
        undefined,
        undefined,
        'sync'
      );
      return true;
    }
    showNotice(
      'Não foi possível recriar a planilha. Verifique se a URL do Webhook termina em "/exec" e se foi implantado com acesso "Qualquer pessoa".',
      undefined,
      undefined,
      'sync'
    );
    return false;
  };

  const testWebhookConnection = async (webhookUrlInput?: string): Promise<{ success: boolean; message: string; details?: string }> => {
    const url = (webhookUrlInput || state.onlineSpreadsheet?.webhookUrl || '').trim();
    if (!url) {
      return { success: false, message: 'Nenhuma URL de Webhook fornecida.' };
    }

    if (url.includes('docs.google.com/spreadsheets')) {
      return {
        success: false,
        message: 'A URL informada é do Google Sheets, e não do Webhook do Apps Script.',
        details: 'Cole a URL gerada em Apps Script -> Implantar -> Nova Implantação (começa com https://script.google.com/macros/s/.../exec).'
      };
    }

    if (url.endsWith('/dev')) {
      return {
        success: false,
        message: 'Sua URL termina em "/dev". É necessário usar a versão de produção "/exec".',
        details: 'No Apps Script, clique em Implantar -> Gerenciar Implantações e copie a URL que termina em /exec.'
      };
    }

    if (!url.includes('script.google.com/macros/s/')) {
      return {
        success: false,
        message: 'Formato de URL do Webhook inválido.',
        details: 'A URL do Web App deve ser no formato: https://script.google.com/macros/s/.../exec'
      };
    }

    try {
      // Preliminary GET to diagnose accessibility / CORS / 403 issues
      try {
        const getRes = await fetchWithTimeout(url, { method: 'GET' }, 8000);
        let getBody = '';
        try {
          getBody = await getRes.text();
        } catch {}
        if (!getRes.ok) {
          return {
            success: false,
            message: `A URL respondeu com status HTTP ${getRes.status}.`,
            details: `Resposta GET: HTTP ${getRes.status} ${getRes.statusText}\nCorpo: ${getBody ? getBody.substring(0, 2000) : '<sem corpo>'}`,
          };
        }
      } catch (e: any) {
        // Network or CORS error
        const errStr = e?.message || String(e);
        return {
          success: false,
          message: 'Falha ao acessar o Webhook (GET).',
          details: `Erro de rede/CORS ao acessar a URL: ${errStr}. Verifique se a URL é pública (/exec) e se o Apps Script foi implantado como "Qualquer pessoa".`,
        };
      }

      // If GET works, attempt full POST sync (behavior unchanged)
      const ok = await syncToOnlineSpreadsheet(false);
      if (ok) {
        return {
          success: true,
          message: 'Sincronização e conexão testadas com sucesso!',
          details: 'Os dados foram enviados para o Google Apps Script e as abas da planilha foram atualizadas.'
        };
      } else {
        return {
          success: false,
          message: 'Falha ao sincronizar com a planilha.',
          details: state.onlineSpreadsheet?.lastError || 'Verifique se a opção "Quem tem acesso" no Apps Script está como "Qualquer pessoa" (Anyone).'
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: 'Erro durante o teste de conexão.',
        details: err?.message || 'Erro ao comunicar com o Google Apps Script.'
      };
    }
  };

  // Real-time Auto-Sync Effect when Collaborator, Task, Break or Settings change
  const isFirstRenderForAutoSync = useRef(true);
  const autoSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isFirstRenderForAutoSync.current) {
      isFirstRenderForAutoSync.current = false;
      return;
    }

    if (isRemoteOrBroadcastUpdate.current) {
      isRemoteOrBroadcastUpdate.current = false;
      return;
    }

    // The spreadsheet is the source of truth. Never push local data over it
    // before the first successful pull (lastSyncedTimestampMs === 0) or while
    // a connection flow is still in progress.
    if (lastSyncedTimestampMs.current === 0 || isConnectingRef.current) {
      return;
    }

    lastLocalEditTime.current = Date.now();

    if (
      state.onlineSpreadsheet &&
      (state.onlineSpreadsheet.databaseProvider === 'firestore' || state.onlineSpreadsheet.webhookUrl) &&
      state.onlineSpreadsheet.autoSyncEnabled !== false
    ) {
      if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
      autoSyncTimeoutRef.current = setTimeout(() => {
        syncToOnlineSpreadsheet(true);
      }, 300);
      return () => {
        if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
      };
    }
    // Depend on the whole state: ANY change (collaborators, tasks, breaks,
    // attendance, intervals, tempNotes, processKnowledgeList, shiftConfigs,
    // auditLogs, userPasswords, configs, etc.) is pushed to the cloud — no field
    // is left unsynced and at risk of loss. Debounced (300ms) and guarded above.
  }, [state]);

  // Firestore Real-Time Listener (Instant 0-latency live push notifications and roster changes)
  useEffect(() => {
    const currentConfig = state.onlineSpreadsheet;
    if (!currentConfig || currentConfig.databaseProvider !== 'firestore' || currentConfig.autoSyncEnabled === false) {
      return;
    }

    const collectionName = currentConfig.firestoreCollection?.trim() || 'dimensio_workspaces';
    const docId = 'main_roster_state';

    const unsubscribe = subscribeToFirestoreState(
      (remoteData, remoteUpdatedAtMs) => {
        const currentState = stateRef.current || state;
        const localUpdatedAtMs = Number(currentState.updatedAtMs) || 0;
        const normalizedRemote = normalizeAppState(remoteData, currentState);

        // Immediate notification delivery
        const remoteDeletedIds = Array.isArray(normalizedRemote.deletedNotificationIds) ? normalizedRemote.deletedNotificationIds : [];
        const localDeletedIds = Array.isArray(currentState.deletedNotificationIds) ? currentState.deletedNotificationIds : [];
        const mergedDeletedIds = Array.from(new Set([...localDeletedIds, ...remoteDeletedIds])).slice(-200);
        const remoteNotifs: SystemNotification[] = Array.isArray(normalizedRemote.notifications) ? normalizedRemote.notifications : [];
        if (remoteNotifs.length > 0 || remoteDeletedIds.length > 0) {
          const prevLocalNotifs = notificationsRef.current || [];
          const prevLocalNotifIds = new Set<string>(prevLocalNotifs.map((n) => n.id));
          const mergedNotifs = mergeNotifications(remoteNotifs, prevLocalNotifs, mergedDeletedIds);
          if (mergedNotifs.length !== prevLocalNotifs.length || mergedDeletedIds.length !== localDeletedIds.length) {
            notificationsRef.current = mergedNotifs;
            setState((prev) => ({
              ...prev,
              deletedNotificationIds: mergedDeletedIds,
              notifications: mergedNotifs,
            }));
          }
          const activeRemoteNotifs = remoteNotifs.filter((n) => !mergedDeletedIds.includes(n.id));
          alertForNewRemoteNotifications(activeRemoteNotifs, prevLocalNotifIds);
        }

        // State reconciliation
        const timeSinceLastEdit = Date.now() - lastLocalEditTime.current;
        if (timeSinceLastEdit >= 2000 && remoteUpdatedAtMs > 0 && remoteUpdatedAtMs > localUpdatedAtMs && remoteUpdatedAtMs > lastSyncedTimestampMs.current) {
          applyRemoteToLocal(normalizedRemote, remoteUpdatedAtMs, { skipSafetyBackup: true });
          lastSyncedTimestampMs.current = remoteUpdatedAtMs;
        }
      },
      (err) => {
        console.warn('Erro na escuta em tempo real do Firestore:', err);
      },
      collectionName,
      docId
    );

    return () => {
      unsubscribe();
    };
  }, [state.onlineSpreadsheet?.databaseProvider, state.onlineSpreadsheet?.firestoreCollection, state.onlineSpreadsheet?.autoSyncEnabled]);

  // Background polling effect using Web Worker for Google Sheets fallback
  // Only depends on webhookUrl/autoSyncEnabled — NOT on state.updatedAtMs — so the
  // worker is not torn down and recreated on every single edit (which leaked Blob
  // URLs and reset the poll timer, starving sync during sustained typing).
  useEffect(() => {
    const currentConfig = state.onlineSpreadsheet;
    if (!currentConfig || currentConfig.databaseProvider === 'firestore' || !currentConfig.webhookUrl || currentConfig.autoSyncEnabled === false) {
      return;
    }

    let worker: Worker | null = null;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;
    let workerUrl: string | null = null;

    try {
      const workerBlob = new Blob([`
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(function() {
              self.postMessage('tick');
            }, 1000);
          } else if (e.data === 'stop') {
            if (timer) clearInterval(timer);
            timer = null;
          }
        };
      `], { type: 'application/javascript' });

      workerUrl = URL.createObjectURL(workerBlob);
      worker = new Worker(workerUrl);

      worker.onmessage = (e) => {
        if (e.data === 'tick') {
          const now = Date.now();
          const idleSinceEdits = now - lastLocalEditTime.current > 400;
          const idleCadence = now - lastRemoteFetchAt.current >= 1000;
          // Never starve remote notifications while the user is editing locally:
          // poll at least every 2.5s even during heavy edits, and every ~1s when idle.
          if ((idleSinceEdits && idleCadence) || now - lastRemoteFetchAt.current >= 2500) {
            lastRemoteFetchAt.current = now;
            fetchFromOnlineSpreadsheetRef.current(true);
          }
        }
      };

      worker.postMessage('start');
    } catch {
      fallbackInterval = setInterval(() => {
        const now = Date.now();
        const idleSinceEdits = now - lastLocalEditTime.current > 400;
        const idleCadence = now - lastRemoteFetchAt.current >= 1000;
        if ((idleSinceEdits && idleCadence) || now - lastRemoteFetchAt.current >= 2500) {
          lastRemoteFetchAt.current = now;
          fetchFromOnlineSpreadsheetRef.current(true);
        }
      }, 1000);
    }

    return () => {
      if (worker) {
        worker.postMessage('stop');
        worker.terminate();
      }
      if (workerUrl) {
        URL.revokeObjectURL(workerUrl);
      }
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
      }
    };
  }, [state.onlineSpreadsheet?.webhookUrl, state.onlineSpreadsheet?.autoSyncEnabled]);

  // Automatic reconnection effect when network comes back or user switches back to tab
  useEffect(() => {
    const handleOnline = () => {
      setCloudOnline(true);
      if (state.onlineSpreadsheet?.webhookUrl && state.onlineSpreadsheet.autoSyncEnabled !== false) {
        consecutiveFailuresRef.current = 0;
        fetchFromOnlineSpreadsheet(true);
        setTimeout(() => syncToOnlineSpreadsheet(true), 600);
      }
    };

    const handleOffline = () => {
      setCloudOnline(false);
    };

    const handleVisibility = () => {
      if (
        document.visibilityState === 'visible' &&
        state.onlineSpreadsheet?.webhookUrl &&
        state.onlineSpreadsheet.autoSyncEnabled !== false
      ) {
        fetchFromOnlineSpreadsheet(true);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [state.onlineSpreadsheet?.webhookUrl, state.onlineSpreadsheet?.autoSyncEnabled]);

  // SESSION BOOTSTRAP: ao abrir a página com uma planilha conectada, reconcilia
  // UMA vez no início — primeiro puxa da nuvem (guardado: nunca regride o local)
  // e, se o servidor foi alcançado e o local tem dados, envia o estado local para
  // cima. Antes, o primeiro push era pulado (first-render skip) e edições da
  // sessão anterior ficavam só no navegador, enquanto um snapshot antigo da nuvem
  // podia sobrescrevê-las em seguida. Com o bootstrap, "abrir a página" sincroniza.
  useEffect(() => {
    if (didRunSessionBootstrap.current) return;
    const cfg = stateRef.current?.onlineSpreadsheet;
    if (!cfg || !cfg.webhookUrl || cfg.autoSyncEnabled === false) return;

    const t = setTimeout(async () => {
      if (isConnectingRef.current) return;
      didRunSessionBootstrap.current = true;
      try {
        await fetchFromOnlineSpreadsheetRef.current?.(true);
        const s = stateRef.current;
        const canPush =
          lastSyncedTimestampMs.current > 0 || lastFetchReachedServer.current;
        if (
          canPush &&
          s &&
          Array.isArray(s.collaborators) &&
          s.collaborators.length > 0 &&
          !isConnectingRef.current
        ) {
          await syncToOnlineSpreadsheetRef.current?.(true);
        }
      } catch {
        // Non-fatal: the background polling effect keeps trying.
      }
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  const addSupportMessage = (msg: {
    codeText?: string;
    imageUrl?: string;
    supportType?: string;
    priority?: 'baixa' | 'media' | 'alta' | 'urgente';
    taskId?: string;
    taskName?: string;
    channelId?: string;
    senderOverride?: { id: string; name: string; role?: string; shift?: string; category?: string };
    fields?: Array<{ id: string; label: string; value: string; key?: string }>;
  }) => {
    const cleanCode = msg.codeText ? msg.codeText.trim().slice(0, 80) : undefined;
    if (!cleanCode && !msg.imageUrl && !msg.supportType && (!msg.fields || msg.fields.length === 0)) return;

    const senderId = msg.senderOverride
      ? String(msg.senderOverride.id)
      : identifiedUser
        ? String(identifiedUser.collaboratorId || identifiedUser.id)
        : 'anon';
    const senderName = msg.senderOverride?.name || identifiedUser?.name || 'Operador';
    const senderRole = msg.senderOverride?.role || identifiedUser?.role || 'Operador';

    const collabObj = state.collaborators.find((c) => c.id === senderId);
    const senderShift = msg.senderOverride?.shift || collabObj?.shift || identifiedUser?.shift || state.teamShift || 'T2';
    const senderCategory = msg.senderOverride?.category || collabObj?.category || 'Geral';

    const now = new Date();
    const isoString = now.toISOString();
    const dateStr = getTodayISO();
    const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const newMsg: import('../types').SupportMessage = {
      id: generateId(),
      createdAt: isoString,
      date: dateStr,
      time: timeStr,
      senderId,
      senderName,
      senderRole,
      senderShift,
      senderCategory,
      supportType: msg.supportType || 'Suporte Operacional',
      priority: msg.priority || 'media',
      codeText: cleanCode,
      imageUrl: msg.imageUrl,
      fields: msg.fields && msg.fields.length > 0 ? msg.fields.map((f) => ({ id: f.id, label: f.label, key: f.key, value: String(f.value || '').slice(0, 200) })) : undefined,
      status: 'enviado',
      taskId: msg.taskId,
      taskName: msg.taskName,
      channelId: msg.channelId,
    };

    updateLocalState((prev) => ({
      ...prev,
      supportMessages: [newMsg, ...(prev.supportMessages || [])],
    }));

    // Trigger real-time notification to all attendants / leaders of the shift
    addNotification({
      title: `🛎️ Pedido de Suporte: ${newMsg.supportType}`,
      message: `${newMsg.senderName} (${newMsg.senderShift || 'Turno'} • ${newMsg.taskName || 'Posto'}) solicitou atendimento operacional.`,
      type: 'request',
      senderName: newMsg.senderName || 'Operador',
      shift: newMsg.senderShift,
      targetRole: 'editor',
      data: {
        action: 'support_request',
        supportId: newMsg.id,
        taskId: newMsg.taskId,
        senderId: newMsg.senderId,
      },
    });

    if (state.helpdeskConfig?.notifySound !== false) {
      playNotificationSound();
    }

    showNotice(`Solicitação de suporte (${newMsg.supportType}) enviada para a fila!`);
  };

  const acceptSupportMessage = (id: string, staffUser?: { id: string; name: string; role?: string }) => {
    const assignedId = staffUser?.id || (identifiedUser ? String(identifiedUser.collaboratorId || identifiedUser.id) : 'suporte');
    const assignedName = staffUser?.name || identifiedUser?.name || 'Suporte';
    const assignedRole = staffUser?.role || identifiedUser?.role || 'Suporte';

    const nowIso = new Date().toISOString();
    const targetMsg = state.supportMessages?.find((m) => m.id === id);

    updateLocalState((prev) => ({
      ...prev,
      supportMessages: (prev.supportMessages || []).map((m) =>
        m.id === id
          ? {
              ...m,
              status: 'em_atendimento',
              assignedToId: assignedId,
              assignedToName: assignedName,
              assignedToRole: assignedRole,
              startedAt: m.startedAt || nowIso,
            }
          : m
      ),
    }));

    if (targetMsg && targetMsg.senderId) {
      addNotification({
        targetUserId: targetMsg.senderId,
        senderName: assignedName,
        title: 'Chamado de suporte em atendimento',
        message: `Seu chamado "${targetMsg.supportType || 'Suporte'}" está sendo atendido por ${assignedName}.`,
        type: 'notice',
        data: { action: 'support_status' },
      });
    }

    showNotice(`Atendimento iniciado por ${assignedName}.`);
  };

  const resolveSupportMessage = (id: string, resolutionNotes?: string) => {
    const now = new Date();
    const resolvedIso = now.toISOString();
    const targetMsg = state.supportMessages?.find((m) => m.id === id);

    updateLocalState((prev) => ({
      ...prev,
      supportMessages: (prev.supportMessages || []).map((m) => {
        if (m.id !== id) return m;
        const startMs = m.startedAt ? new Date(m.startedAt).getTime() : new Date(m.createdAt).getTime();
        const durationSec = Math.max(0, Math.round((now.getTime() - startMs) / 1000));

        return {
          ...m,
          status: 'resolvido',
          resolvedAt: resolvedIso,
          resolutionNotes: resolutionNotes || m.resolutionNotes,
          durationSeconds: durationSec,
        };
      }),
    }));

    if (targetMsg && targetMsg.senderId) {
      addNotification({
        targetUserId: targetMsg.senderId,
        senderName: identifiedUser?.name || 'Suporte',
        title: 'Chamado de suporte resolvido',
        message: `Seu chamado "${targetMsg.supportType || 'Suporte'}" foi resolvido.`,
        type: 'notice',
        data: { action: 'support_status' },
      });
    }

    showNotice('Chamado de suporte resolvido com sucesso!');
  };

  const returnSupportMessageToQueue = (id: string) => {
    updateLocalState((prev) => ({
      ...prev,
      supportMessages: (prev.supportMessages || []).map((m) =>
        m.id === id
          ? {
              ...m,
              status: 'enviado',
              assignedToId: undefined,
              assignedToName: undefined,
              assignedToRole: undefined,
              startedAt: undefined,
            }
          : m
      ),
    }));
    showNotice('Chamado devolvido para a fila de espera.');
  };

  const cancelSupportMessage = (id: string, reason?: string) => {
    const nowIso = new Date().toISOString();
    updateLocalState((prev) => ({
      ...prev,
      supportMessages: (prev.supportMessages || []).map((m) =>
        m.id === id
          ? {
              ...m,
              status: 'cancelado',
              resolvedAt: nowIso,
              resolutionNotes: reason || 'Cancelado',
            }
          : m
      ),
    }));
    showNotice('Chamado cancelado.');
  };

  const updateSupportMessageStatus = (id: string, status: 'enviado' | 'em_atendimento' | 'resolvido' | 'cancelado') => {
    updateLocalState((prev) => ({
      ...prev,
      supportMessages: (prev.supportMessages || []).map((m) => (m.id === id ? { ...m, status } : m)),
    }));
  };

  const deleteSupportMessage = (id: string) => {
    updateLocalState((prev) => ({
      ...prev,
      supportMessages: (prev.supportMessages || []).filter((m) => m.id !== id),
    }));
    showNotice('Registro de suporte removido.');
  };

  const updateHelpdeskConfig = (updates: Partial<import('../types').HelpdeskConfig>) => {
    updateLocalState((prev) => ({
      ...prev,
      helpdeskConfig: {
        ...(prev.helpdeskConfig || {}),
        ...updates,
      },
    }));
    showNotice('Configurações de Helpdesk atualizadas.');
  };

  const updatePortalNotificationConfig = (updates: Partial<import('../types').PortalNotificationConfig>) => {
    updateLocalState((prev) => ({
      ...prev,
      portalNotificationConfig: {
        ...(prev.portalNotificationConfig || {}),
        ...updates,
      },
    }));
    showNotice('Configurações de notificações do portal atualizadas.');
  };

  const updateShareCustomConfig = (updates: Partial<import('../types').ShareCustomConfig>) => {
    updateLocalState((prev) => ({
      ...prev,
      shareCustomConfig: {
        ...(prev.shareCustomConfig || {}),
        ...updates,
      },
    }));
  };

  const updateShareFilters = (updates: Partial<import('../types').ShareFilterConfig>) => {
    updateLocalState((prev) => ({
      ...prev,
      shareFilters: {
        ...(prev.shareFilters || {}),
        ...updates,
      },
    }));
  };

  const updateReportExportConfig = (updates: Partial<import('../types').ReportExportConfig>) => {
    updateLocalState((prev) => ({
      ...prev,
      reportExportConfig: {
        ...(prev.reportExportConfig || {}),
        ...updates,
      },
    }));
  };

  const updatePortalConfig = (updates: Partial<import('../types').PortalPresetConfig>) => {
    updateLocalState((prev) => ({
      ...prev,
      portalConfig: {
        ...(prev.portalConfig || {}),
        ...updates,
      },
    }));
    showNotice('Configurações do Portal atualizadas.');
  };

  // Programação e Rotinas de Tarefas
  const addScheduledTask = (taskData: Omit<ScheduledTask, 'id' | 'createdAt'> & { id?: string }): ScheduledTask => {
    const newTask: ScheduledTask = {
      ...taskData,
      id: taskData.id || `stask_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subtasks: taskData.subtasks || [],
      assignedTo: taskData.assignedTo || [],
      priority: taskData.priority || 'media',
      status: taskData.status || 'a_fazer',
      listId: taskData.listId || 'default',
    };

    updateLocalState((prev) => ({
      ...prev,
      scheduledTasks: [newTask, ...(prev.scheduledTasks || [])],
    }));

    // Notify assigned collaborators in real time
    if (newTask.assignedTo && newTask.assignedTo.length > 0) {
      const targetUserIds = newTask.assignedTo;
      addNotification({
        title: `📋 Rotina Atribuída: ${newTask.title}`,
        message: `Você foi escalado para a rotina "${newTask.title}"${newTask.dueTime ? ` prevista para às ${newTask.dueTime}` : ''}.`,
        type: 'notice',
        senderName: identifiedUser?.name || 'Gestão',
        targetUsers: targetUserIds,
        data: {
          taskId: newTask.id,
          action: 'routine_assigned',
          targetCollaboratorIds: targetUserIds,
        },
      });
    }

    addAuditLog('tarefa', `Criou a tarefa/rotina "${newTask.title}"`);
    showNotice(`Tarefa "${newTask.title}" criada com sucesso!`);
    return newTask;
  };

  const updateScheduledTask = (id: string, updates: Partial<ScheduledTask>) => {
    updateLocalState((prev) => ({
      ...prev,
      scheduledTasks: (prev.scheduledTasks || []).map((t) =>
        t.id === id
          ? {
              ...t,
              ...updates,
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    }));
  };

  const deleteScheduledTask = (id: string) => {
    let deletedTitle = '';
    updateLocalState((prev) => {
      const found = (prev.scheduledTasks || []).find((t) => t.id === id);
      if (found) deletedTitle = found.title;
      return {
        ...prev,
        scheduledTasks: (prev.scheduledTasks || []).filter((t) => t.id !== id),
      };
    });

    if (deletedTitle) {
      addAuditLog('tarefa', `Excluiu a tarefa/rotina "${deletedTitle}"`);
      showNotice(`Tarefa "${deletedTitle}" removida.`);
    }
  };

  const toggleScheduledTaskComplete = (id: string, completed?: boolean, performer?: { id?: string; name?: string }) => {
    let taskTitle = '';
    let isNowCompleted = false;
    const performerName = performer?.name || identifiedUser?.name || 'Operador';
    const performerId = performer?.id || identifiedUser?.id || 'operador';
    const now = new Date().toISOString();

    updateLocalState((prev) => ({
      ...prev,
      scheduledTasks: (prev.scheduledTasks || []).map((t) => {
        if (t.id !== id) return t;
        const willBeDone = completed !== undefined ? completed : t.status !== 'concluida';
        taskTitle = t.title;
        isNowCompleted = willBeDone;
        const nextStatus = willBeDone ? 'concluida' : 'a_fazer';
        
        // Also mark all subtasks complete or incomplete if parent changes
        const updatedSubtasks = (t.subtasks || []).map((s) => ({
          ...s,
          completed: willBeDone,
          completedAt: willBeDone ? (s.completedAt || now) : undefined,
          completedBy: willBeDone ? (s.completedBy || performerId) : undefined,
          completedByName: willBeDone ? (s.completedByName || performerName) : undefined,
        }));

        return {
          ...t,
          status: nextStatus,
          completedAt: willBeDone ? now : undefined,
          completedBy: willBeDone ? performerId : undefined,
          completedByName: willBeDone ? performerName : undefined,
          subtasks: updatedSubtasks,
          updatedAt: now,
        };
      }),
    }));

    if (taskTitle) {
      if (isNowCompleted) {
        addNotification({
          senderName: performerName,
          title: 'Rotina / Tarefa Concluída',
          message: `${performerName} concluiu "${taskTitle}".`,
          type: 'notice',
          targetShiftAudience: 'atual',
          shift: identifiedUser?.shift,
          data: {
            taskId: id,
            taskName: taskTitle,
            userName: performerName,
            userId: performerId,
            action: 'task_completed',
          },
        });
        addAuditLog('tarefa', `${performerName} concluiu a tarefa "${taskTitle}"`);
        showNotice(`✓ ${performerName} concluiu "${taskTitle}"`, undefined, undefined, 'success');
      } else {
        addAuditLog('tarefa', `${performerName} reabriu a tarefa "${taskTitle}"`);
        showNotice(`Tarefa "${taskTitle}" reaberta.`);
      }
    }
  };

  const toggleScheduledSubtaskComplete = (taskId: string, subtaskId: string, completed?: boolean, performer?: { id?: string; name?: string }) => {
    let taskTitle = '';
    let subtaskTitle = '';
    let isNowCompleted = false;
    let allSubtasksDone = false;
    const performerName = performer?.name || identifiedUser?.name || 'Operador';
    const performerId = performer?.id || identifiedUser?.id || 'operador';
    const now = new Date().toISOString();

    updateLocalState((prev) => ({
      ...prev,
      scheduledTasks: (prev.scheduledTasks || []).map((t) => {
        if (t.id !== taskId) return t;
        taskTitle = t.title;
        const updatedSubtasks = (t.subtasks || []).map((s) => {
          if (s.id !== subtaskId) return s;
          const nextCompleted = completed !== undefined ? completed : !s.completed;
          subtaskTitle = s.title;
          isNowCompleted = nextCompleted;
          return {
            ...s,
            completed: nextCompleted,
            completedAt: nextCompleted ? now : undefined,
            completedBy: nextCompleted ? performerId : undefined,
            completedByName: nextCompleted ? performerName : undefined,
          };
        });

        // Auto-complete task if all subtasks are done
        const allDone = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.completed);
        const anyPending = updatedSubtasks.some((s) => !s.completed);
        allSubtasksDone = allDone;
        let nextStatus = t.status;
        if (allDone && t.status !== 'concluida') {
          nextStatus = 'concluida';
        } else if (anyPending && t.status === 'concluida') {
          nextStatus = 'em_andamento';
        }

        return {
          ...t,
          subtasks: updatedSubtasks,
          status: nextStatus,
          completedAt: allDone ? now : (nextStatus === 'concluida' ? t.completedAt : undefined),
          completedBy: allDone ? (t.completedBy || performerId) : (nextStatus === 'concluida' ? t.completedBy : undefined),
          completedByName: allDone ? (t.completedByName || performerName) : (nextStatus === 'concluida' ? t.completedByName : undefined),
          updatedAt: now,
        };
      }),
    }));

    if (subtaskTitle) {
      if (isNowCompleted) {
        addNotification({
          senderName: performerName,
          title: 'Etapa / Subtarefa Concluída',
          message: allSubtasksDone
            ? `${performerName} concluiu a última etapa "${subtaskTitle}" e finalizou "${taskTitle}".`
            : `${performerName} concluiu "${subtaskTitle}" em "${taskTitle}".`,
          type: 'notice',
          targetShiftAudience: 'atual',
          shift: identifiedUser?.shift,
          data: {
            taskId,
            taskName: taskTitle,
            userName: performerName,
            userId: performerId,
            action: 'subtask_completed',
          },
        });
        addAuditLog('tarefa', `${performerName} concluiu "${subtaskTitle}" em "${taskTitle}"`);
        showNotice(`✓ ${performerName} concluiu "${subtaskTitle}"`, undefined, undefined, 'success');
      } else {
        showNotice(`Etapa "${subtaskTitle}" reaberta.`);
      }
    }
  };

  const addScheduledTaskList = (listData: Omit<ScheduledTaskList, 'id'> & { id?: string }): ScheduledTaskList => {
    const newList: ScheduledTaskList = {
      ...listData,
      id: listData.id || `list_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };

    updateLocalState((prev) => ({
      ...prev,
      scheduledTaskLists: [...(prev.scheduledTaskLists || []), newList],
    }));

    showNotice(`Lista "${newList.name}" adicionada.`);
    return newList;
  };

  const updateScheduledTaskList = (id: string, updates: Partial<ScheduledTaskList>) => {
    updateLocalState((prev) => ({
      ...prev,
      scheduledTaskLists: (prev.scheduledTaskLists || []).map((l) =>
        l.id === id ? { ...l, ...updates } : l
      ),
    }));
  };

  const deleteScheduledTaskList = (id: string) => {
    if (id === 'default') {
      showNotice('A lista padrão não pode ser excluída.');
      return;
    }
    updateLocalState((prev) => ({
      ...prev,
      scheduledTaskLists: (prev.scheduledTaskLists || []).filter((l) => l.id !== id),
      // Move tasks in deleted list to 'default' list
      scheduledTasks: (prev.scheduledTasks || []).map((t) =>
        t.listId === id ? { ...t, listId: 'default' } : t
      ),
    }));
    showNotice('Lista removida. As tarefas foram movidas para Minhas Tarefas.');
  };

  const reorderScheduledTasks = (newTasks: ScheduledTask[]) => {
    updateLocalState((prev) => ({
      ...prev,
      scheduledTasks: newTasks,
    }));
  };

  const syncTaskToGoogleCalendar = async (
    taskId: string
  ): Promise<{ success: boolean; message: string; eventId?: string }> => {
    const task = (state.scheduledTasks || []).find((t) => t.id === taskId);
    if (!task) {
      return { success: false, message: 'Tarefa não encontrada.' };
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        return {
          success: false,
          message: 'Faça login com sua Conta Google Corporativa para sincronizar com o Google Calendar.',
        };
      }

      const dateStr = task.dueDate || task.startDate || getTodayISO();
      const startTimeStr = task.dueTime || task.startTime || '08:00';
      
      // Calculate end time
      let endTimeStr = task.dueEndTime || task.endTime;
      if (!endTimeStr) {
        const [h, m] = startTimeStr.split(':').map(Number);
        const dur = task.estimatedMinutes || 60;
        const totalMinutes = (h || 8) * 60 + (m || 0) + dur;
        const endH = Math.floor(totalMinutes / 60) % 24;
        const endM = totalMinutes % 60;
        endTimeStr = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
      }

      // Construct ISO strings
      const startDateTime = new Date(`${dateStr}T${startTimeStr}:00`).toISOString();
      const endDateTime = new Date(`${dateStr}T${endTimeStr}:00`).toISOString();

      const event = await createCalendarEvent({
        summary: `[Dimensio] ${task.title}`,
        description: `${task.description || ''}\n\n• Prioridade: ${task.priority}\n• Turno: ${task.assignedShift || 'Geral'}\n• Status: ${task.status}`,
        startDateTime,
        endDateTime,
        location: task.assignedShift ? `Turno ${task.assignedShift}` : 'Operação',
      });

      updateScheduledTask(taskId, {
        googleEventId: event.id,
        syncedToGoogleCalendar: true,
      });

      addAuditLog('tarefa', `Sincronizou a tarefa "${task.title}" com o Google Calendar`);
      showNotice(`📅 Tarefa "${task.title}" adicionada ao seu Google Calendar com sucesso!`);
      return { success: true, message: 'Evento criado no Google Calendar!', eventId: event.id };
    } catch (err: any) {
      const msg = err?.message || 'Erro ao sincronizar com o Google Calendar.';
      showNotice(msg);
      return { success: false, message: msg };
    }
  };

  const syncTaskToGoogleTasks = async (
    taskId: string
  ): Promise<{ success: boolean; message: string; taskId?: string }> => {
    const task = (state.scheduledTasks || []).find((t) => t.id === taskId);
    if (!task) {
      return { success: false, message: 'Tarefa não encontrada.' };
    }

    try {
      const token = await getAccessToken();
      if (!token) {
        return {
          success: false,
          message: 'Faça login com sua Conta Google Corporativa para sincronizar com o Google Tasks.',
        };
      }

      const dateStr = task.dueDate || task.startDate || getTodayISO();
      const dueTimestamp = new Date(`${dateStr}T12:00:00Z`).toISOString();

      const createdGTask = await createGoogleTask('@default', {
        title: task.title,
        notes: `${task.description || ''}\nPrioridade: ${task.priority}\nHorário: ${task.dueTime || 'A definir'}`,
        due: dueTimestamp,
      });

      updateScheduledTask(taskId, {
        googleTaskId: createdGTask.id,
        syncedToGoogleTasks: true,
      });

      addAuditLog('tarefa', `Sincronizou a tarefa "${task.title}" com o Google Tasks`);
      showNotice(`✅ Tarefa "${task.title}" adicionada ao seu Google Tasks com sucesso!`);
      return { success: true, message: 'Tarefa criada no Google Tasks!', taskId: createdGTask.id };
    } catch (err: any) {
      const msg = err?.message || 'Erro ao sincronizar com o Google Tasks.';
      showNotice(msg);
      return { success: false, message: msg };
    }
  };

  const syncTasksToGoogleWorkspace = async (
    taskIds: string[]
  ): Promise<{ success: boolean; message: string; count: number }> => {
    if (!taskIds || taskIds.length === 0) {
      return { success: false, message: 'Nenhuma tarefa selecionada para sincronização.', count: 0 };
    }

    let successCount = 0;
    for (const id of taskIds) {
      try {
        const calRes = await syncTaskToGoogleCalendar(id);
        const taskRes = await syncTaskToGoogleTasks(id);
        if (calRes.success || taskRes.success) {
          successCount++;
        }
      } catch (e) {
        console.warn('Erro ao sincronizar tarefa em lote:', id, e);
      }
    }

    if (successCount > 0) {
      showNotice(`🎉 ${successCount} tarefa(s) sincronizada(s) com o Google Workspace!`);
      return { success: true, message: `${successCount} tarefas sincronizadas.`, count: successCount };
    } else {
      return { success: false, message: 'Não foi possível sincronizar as tarefas.', count: 0 };
    }
  };

  // Motor de Lembrete / Alerta de Rotinas do Turno para o Usuário Ativo
  useEffect(() => {
    const alertedTaskIds = new Set<string>();

    const checkDueTasks = () => {
      if (!identifiedUser) return;
      const todayIso = getTodayISO();
      const myId = identifiedUser.collaboratorId || identifiedUser.id;
      const now = new Date();
      const currentMinutesOfDay = now.getHours() * 60 + now.getMinutes();

      const myTasks = (state.scheduledTasks || []).filter((t) => {
        if (t.status === 'concluida' || t.status === 'cancelada') return false;
        const isAssigned = (t.assignedTo || []).includes(myId) || (t.assignedTo || []).includes(identifiedUser.id);
        if (!isAssigned) return false;
        if (t.dueDate && t.dueDate !== todayIso) return false;
        return true;
      });

      for (const t of myTasks) {
        if (alertedTaskIds.has(t.id)) continue;
        if (t.dueTime) {
          const [h, m] = t.dueTime.split(':').map(Number);
          if (!isNaN(h) && !isNaN(m)) {
            const taskMinutes = h * 60 + m;
            const diff = taskMinutes - currentMinutesOfDay;
            // Notifica se estiver a 30 minutos do horário previsto ou se acabou de vencer
            if (diff <= 30 && diff >= -45) {
              alertedTaskIds.add(t.id);
              showNotice(`⏰ Lembrete de Rotina: "${t.title}" está agendada para às ${t.dueTime}.`, 'Ver Rotinas', () => {
                navigateTo('routines');
              });
              if (notifSoundEnabled) {
                playNotificationSound();
              }
            }
          }
        }
      }
    };

    const interval = setInterval(checkDueTasks, 60000);
    checkDueTasks();
    return () => clearInterval(interval);
  }, [identifiedUser?.id, identifiedUser?.collaboratorId, state.scheduledTasks, notifSoundEnabled]);

  return (
    <AppContext.Provider
      value={{
        state,
        setDate,
        setYear,
        setTeamInfo,
        updateShiftConfig,
        updateTeamShift,
        setSetupCompleted,
        applySuggestedScaleCalendar,
        isSetupWizardOpen,
        openSetupWizard,
        closeSetupWizard,
        setTheme,
        addCollaborator,
        updateCollaborator,
        bulkUpdateCollaborators,
        deleteCollaborator,
        restoreCollaborator,
        permanentlyDeleteCollaborator,
        clearTrashBin,
        addScheduledAbsence,
        removeScheduledAbsence,
        addTask,
        updateTask,
        deleteTask,
        addBreakSlot,
        updateBreakSlot,
        deleteBreakSlot,
        addInterval,
        markDayScale,
        toggleAttendance,
        setAttendanceStatus,
        setStatusReason,
        resetAttendance,
        assignTask,
        unassignTask,
        clearAssignments,
        clearTaskAssignments,
        autoAssign,
        undo,
        canUndo,
        moveBreakInterval,
        generateBreaks,
        generateRotatingBreaks,
        breakRotationMap,
        clearBreaks,
        syncPresenceToApi,
        importExternalPresenceList,
        exportPresenceList,
        fetchPresenceEvents,
        addCatalogItem,
        removeCatalogItem,
        editCatalogItem,
        setRoleType,
        setRolePermission,
        editTeamLeader,
        setSelectedGlobalFilters,
        setAbsenteeismPeriodDays,
        setModuleVisibility,
        setPortalNameAbbreviation,
        setCustomShortcuts,
        setSidebarOrder,
        toggleSidebarItemHidden,
        setHiddenSidebarItems,
        updateWidgetsConfig,
        isWidgetsModalOpen,
        setIsWidgetsModalOpen,
        resetNavigationSettings,
        setSkillLevel,
        bulkSetSkillLevel,
        addCollabNote,
        removeCollabNote,
        setAbsenceReason,
        setOccurrence,
        setGeneralNotes,
        saveDailyReport,
        deleteDailyReport,
        saveHistory,
        importFullState,
        importFullStateWithBackup,
        importRosterRows,
        resetAllData,
        clearSampleData,
        loadSampleBackupData,
        downloadSampleBackupFile,
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
        noticeMessage: noticeState.message,
        noticeType: noticeState.noticeType,
        noticeActionLabel: noticeState.actionLabel,
        onNoticeAction: noticeState.onAction,
        showNotice,
        addTeamLeader,
        removeTeamLeader,
        setOnlineSpreadsheetConfig,
        syncToOnlineSpreadsheet,
        fetchFromOnlineSpreadsheet,
        forceRecreateCloudSpreadsheet,
        testWebhookConnection,
        exportLocalSpreadsheet,
        exportTeamRosterSpreadsheet,
        generateTemplateSpreadsheet,
        addProcessKnowledge,
        updateProcessKnowledge,
        deleteProcessKnowledge,
        updateBriefingConfig,
        updateFeedbackConfig,
        updateExtensionConfig,
        toggleSidebarCollapsed,
        setSidebarCollapsed,
        identifiedUser,
        identifyUser,
        logoutUser,
        setUserPassword,
        setRequireUserPassword,
        requestPasswordReset,
        authorizePasswordReset,
        toggleEditorRole,
        sessionConfig,
        setSessionConfig,
        cloudOnline,
        isConnectionBlocked,
        updateAutoBackupSettings,
        addAuditLog,
        restoreFromAuditLog,
        clearAuditLogs,
        addNotification,
        broadcastNotice,
        markNotificationRead,
        markAllNotificationsRead,
        deleteNotification,
        clearAllNotifications,
        isNotificationForCurrentUser,
        notifSoundEnabled,
        notifPopupEnabled,
        setNotifSoundEnabled,
        setNotifPopupEnabled,
        notificationPreferences,
        setNotificationPreferences,
        getUnreadNotificationsCount,
        createServiceRequest,
        updateServiceRequest,
        markRequestAsRead,
        markRequestAsCompleted,
        deleteServiceRequest,
        updateTaskExternalUrl,
        addInfoHubReminder,
        updateInfoHubReminder,
        deleteInfoHubReminder,
        addInfoHubLink,
        updateInfoHubLink,
        deleteInfoHubLink,
        addInfoHubQuickFill,
        updateInfoHubQuickFill,
        deleteInfoHubQuickFill,
        addMetricDefinition,
        updateMetricDefinition,
        deleteMetricDefinition,
        addMetricReading,
        deleteMetricReading,
        getTaskAreaCounts,
        ensureTaskCountMetric,
        addSupportMessage,
        acceptSupportMessage,
        resolveSupportMessage,
        returnSupportMessageToQueue,
        cancelSupportMessage,
        updateSupportMessageStatus,
        deleteSupportMessage,
        updateHelpdeskConfig,
        updatePortalNotificationConfig,
        updateShareCustomConfig,
        updateShareFilters,
        updateReportExportConfig,
        updatePortalConfig,
        addScheduledTask,
        updateScheduledTask,
        deleteScheduledTask,
        toggleScheduledTaskComplete,
        toggleScheduledSubtaskComplete,
        addScheduledTaskList,
        updateScheduledTaskList,
        deleteScheduledTaskList,
        reorderScheduledTasks,
        syncTaskToGoogleCalendar,
        syncTaskToGoogleTasks,
        syncTasksToGoogleWorkspace,
        showSubtasks,
        setShowSubtasks: setShowSubtasksPersisted,
        userProfile,
        saveUserProfile,
        setUserWorkStatus,
        saveUserScratchpad,
        firebaseUser,
        isAuthLoading,
        signInWithGoogleAuth,
        signInWithEmailAuth,
        signUpWithEmailAuth,
        sendPasswordResetEmailAuth,
        signOutAuth,
        registerCompanyWorkspace,
        isFirestoreActive,
        linkCollaboratorWithAuth,
        addRegisteredSector,
        removeRegisteredSector,
        addSectorDefinition,
        updateSectorDefinition,
        deleteSectorDefinition,
        switchActiveSector,
        setUserSector,
        setCanProvideCrossSectorSupport,
        setAllowedSectors,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
