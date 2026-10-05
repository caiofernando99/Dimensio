import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { AppState, OnlineSpreadsheetConfig, AutoBackupInfo, BackupSnapshot, DailyReport } from '../types';
import { generateId, formatDateBR, getCollaboratorStatus, isAbsenteeismStatus } from '../utils/helpers';
import { encodeConnectionParams } from '../utils/urlConnection';

const AUTO_BACKUP_KEY = 'escalapro_auto_backup_v1';
const BACKUP_SNAPSHOTS_KEY = 'escalapro_backup_history_v2';
const LAST_SYNCED_TIMESTAMP_KEY = 'escalapro_last_synced_timestamp_v1';

interface SyncContextType {
  onlineSpreadsheet: OnlineSpreadsheetConfig | null;
  backupHistory: BackupSnapshot[];
  lastAutoBackupInfo: AutoBackupInfo | null;
  dailyReports: Record<string, DailyReport>;
  history: AppState['history'];
  setOnlineSpreadsheetConfig: (config: OnlineSpreadsheetConfig | null) => void;
  syncToOnlineSpreadsheet: (isAutoSync?: boolean) => Promise<boolean>;
  fetchFromOnlineSpreadsheet: (isSilent?: boolean) => Promise<boolean>;
  testWebhookConnection: (url?: string) => Promise<{ success: boolean; message: string; details?: string }>;
  disconnectOnlineSpreadsheet: () => void;
  generateShareableConnectionLink: () => string;
  createAutoBackup: (reason?: string, targetState?: AppState) => AutoBackupInfo | null;
  restoreFromAutoBackup: () => boolean;
  restoreBackupById: (backupId: string) => boolean;
  deleteBackupById: (backupId: string) => void;
  clearBackupHistory: () => void;
  exportBackupToFile: (snapshot?: BackupSnapshot) => void;
  exportLocalSpreadsheet: () => void;
  exportTeamRosterSpreadsheet: () => void;
  generateTemplateSpreadsheet: () => void;
  importFullState: (newState: Partial<AppState>) => void;
  importFullStateWithBackup: (newState: Partial<AppState>, mode?: 'full' | 'config_only', createSafetyBackup?: boolean) => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode; appState: AppState; setAppState: React.Dispatch<React.SetStateAction<AppState>> }> = ({ 
  children, 
  appState, 
  setAppState 
}) => {
  const [backupHistory, setBackupHistory] = useState<BackupSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem(BACKUP_SNAPSHOTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // Fallback
    }
    return [];
  });

  const [lastAutoBackupInfo, setLastAutoBackupInfo] = useState<AutoBackupInfo | null>(() => {
    try {
      const raw = localStorage.getItem(AUTO_BACKUP_KEY);
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
  const isFirstRenderForAutoSync = useRef(true);

  const setOnlineSpreadsheetConfig = (config: OnlineSpreadsheetConfig | null) => {
    setAppState((prev) => ({ ...prev, onlineSpreadsheet: config }));
    if (config) {
      if (config.webhookUrl) {
        setTimeout(() => {
          fetchFromOnlineSpreadsheet(false);
        }, 300);
      }
    }
  };

  const disconnectOnlineSpreadsheet = () => {
    setAppState((prev) => ({ ...prev, onlineSpreadsheet: null }));
  };

  const generateShareableConnectionLink = (): string => {
    const currentConfig = appState.onlineSpreadsheet;
    const baseUrl = `${window.location.origin}${window.location.pathname}`;

    const params = new URLSearchParams();
    params.set('view', 'share_connection');
    params.set('teamName', appState.teamName || 'Equipe Operacional');
    params.set('sector', appState.sector || '');
    params.set('shift', appState.teamShift || 'T2');

    if (currentConfig?.url || currentConfig?.webhookUrl) {
      const cx = encodeConnectionParams({
        sheetUrl: currentConfig.url,
        webhookUrl: currentConfig.webhookUrl,
        sheetName: currentConfig.name,
        teamName: appState.teamName,
      });
      if (cx) {
        params.set('cx', cx);
      }
    }

    return `${baseUrl}?${params.toString()}`;
  };

  const createAutoBackup = (reason: string = 'Backup de Segurança', targetState?: AppState): AutoBackupInfo | null => {
    try {
      const now = new Date();
      const formattedDate = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
      const snapshotState = targetState || appState;
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
        localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(newSnapshot));
      } catch (e) {
        console.warn('Storage full for single backup:', e);
      }

      setBackupHistory((prev) => {
        const updated = [newSnapshot, ...prev.filter((s) => s.id !== newSnapshot.id)].slice(0, 15);
        try {
          localStorage.setItem(BACKUP_SNAPSHOTS_KEY, JSON.stringify(updated));
        } catch (err) {
          console.warn('Could not save full history to localStorage:', err);
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
      const raw = localStorage.getItem(AUTO_BACKUP_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.state) {
        createAutoBackup('Backup de Segurança Antes de Restaurar');
        setAppState(parsed.state);
        return true;
      }
    } catch (e) {
      console.error('Erro ao restaurar do backup automático:', e);
    }
    return false;
  };

  const restoreBackupById = (backupId: string): boolean => {
    try {
      const target = backupHistory.find((b) => b.id === backupId);
      if (!target || !target.state) return false;

      createAutoBackup(`Backup de Segurança Pré-Restauração de ${target.formattedDate}`);
      setAppState({ ...target.state, updatedAtMs: Date.now() });
      return true;
    } catch (e) {
      console.error('Erro ao restaurar do histórico de backup:', e);
    }
    return false;
  };

  const deleteBackupById = (backupId: string) => {
    setBackupHistory((prev) => {
      const updated = prev.filter((b) => b.id !== backupId);
      try {
        localStorage.setItem(BACKUP_SNAPSHOTS_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const clearBackupHistory = () => {
    setBackupHistory([]);
    try {
      localStorage.removeItem(BACKUP_SNAPSHOTS_KEY);
    } catch {
      // ignore
    }
  };

  const exportBackupToFile = (snapshot?: BackupSnapshot) => {
    const exportData = snapshot ? snapshot.state : appState;
    const teamSlug = (exportData.teamName || 'equipe').replace(/\s+/g, '_').toLowerCase();
    const fileName = `dimensio-backup-${teamSlug}-${formatDateBR(new Date().toISOString().split('T')[0])}.json`;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportLocalSpreadsheet = () => {
    const activeDate = appState.selectedDate;
    const formattedDate = formatDateBR(activeDate);

    let csv = '\uFEFF';
    csv += 'Data (DD/MM/AAAA);RE (Matrícula);Nome do Colaborador;LDAP;Setor;Gestor;Turno;Team Leader / Time;Escala;Cargo;Categoria;Status no Dia;Tarefa Operacional;Horário de Refeição;Habilidades\n';

    appState.collaborators.forEach((col) => {
      const st = getCollaboratorStatus(col, activeDate, appState);
      const taskName = appState.tasks.find((t) => t.members.includes(col.id))?.name || 'Não Dimensionado';
      const dayInt = appState.intervals[activeDate] || {};
      const breakSlot = appState.breaks.find((b) => (dayInt[b.id] || []).includes(col.id))?.time || 'Sem Intervalo';
      const skillsStr = col.skills && Object.keys(col.skills).length > 0 ? Object.keys(col.skills).join(', ') : 'Nenhuma';
      const tlName = col.teamLeader || appState.defaultTeamLeader || 'Geral';

      let statusLabel = 'Presente';
      if (st.status === 'folga') statusLabel = 'Folga (escala)';
      else if (st.status === 'ferias') statusLabel = 'Férias';
      else if (st.status === 'licenca') statusLabel = 'Licença Médica';
      else if (st.status === 'treinamento') statusLabel = 'Treinamento';
      else if (st.status === 'ausente') statusLabel = 'Ausente (Falta)';

      csv += `"${formattedDate}";"${col.registration || ''}";"${col.name}";"${col.login || ''}";"${appState.sector}";"${appState.manager}";"${col.shift || appState.teamShift}";"${tlName}";"${col.scale}";"${col.role}";"${col.category}";"${statusLabel}";"${taskName}";"${breakSlot}";"${skillsStr}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escala-local-${appState.teamName.replace(/\s+/g, '_')}-${formattedDate.replace(/\//g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportTeamRosterSpreadsheet = () => {
    if (!appState.collaborators || appState.collaborators.length === 0) {
      generateTemplateSpreadsheet();
      return;
    }

    let csv = '\uFEFF';
    csv += 'RE (Matrícula);Nome;LDAP;Setor;Gestor;Turno;Team Leader / Time;Escala;Cargo;Categoria;Observações\n';

    appState.collaborators.forEach((col) => {
      const tlName = col.teamLeader || appState.defaultTeamLeader || 'Sem Time';
      csv += `"${col.registration || ''}";"${col.name}";"${col.login || ''}";"${appState.sector || ''}";"${appState.manager || ''}";"${col.shift || appState.teamShift || 'Geral'}";"${tlName}";"${col.scale}";"${col.role}";"${col.category}";"${col.notes || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planilha-equipe-${(appState.teamName || 'equipe').replace(/\s+/g, '_').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
  };

  const importFullStateWithBackup = (
    newState: Partial<AppState>,
    mode: 'full' | 'config_only' = 'full',
    createSafetyBackup: boolean = true
  ) => {
    if (createSafetyBackup) {
      createAutoBackup(`Backup de Segurança Pré-Importação (${mode === 'config_only' ? 'Somente Estrutura' : 'Substituição Completa'})`);
    }

    const isExampleSpreadsheet =
      newState.onlineSpreadsheet?.url?.includes('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');

    const importedSpreadsheet = isExampleSpreadsheet ? null : newState.onlineSpreadsheet || null;

    setAppState((prev) => {
      if (mode === 'config_only') {
        return {
          ...prev,
          teamName: newState.teamName || prev.teamName,
          sector: newState.sector || prev.sector,
          manager: newState.manager || prev.manager,
          teamShift: newState.teamShift || prev.teamShift,
          defaultTeamLeader: newState.defaultTeamLeader || prev.defaultTeamLeader,
          teamLeaders: newState.teamLeaders || prev.teamLeaders,
          roles: newState.roles || prev.roles,
          categories: newState.categories || prev.categories,
          skills: newState.skills || prev.skills,
          tasks: newState.tasks || prev.tasks,
          breaks: newState.breaks || prev.breaks,
          theme: newState.theme || prev.theme,
          briefingConfig: newState.briefingConfig || prev.briefingConfig,
          processKnowledgeList: newState.processKnowledgeList || prev.processKnowledgeList,
          onlineSpreadsheet: importedSpreadsheet || prev.onlineSpreadsheet,
        };
      } else {
        return {
          ...prev,
          ...newState,
          onlineSpreadsheet: importedSpreadsheet,
          theme: newState.theme || prev.theme || 'dimensio',
        };
      }
    });
  };

  const importFullState = (newState: Partial<AppState>) => {
    importFullStateWithBackup(newState, 'full', true);
  };

  const fetchFromOnlineSpreadsheet = async (isSilent = false): Promise<boolean> => {
    const currentConfig = appState.onlineSpreadsheet;
    if (!currentConfig || !currentConfig.webhookUrl) return false;

    const webhookUrl = currentConfig.webhookUrl.trim();
    if (webhookUrl.includes('docs.google.com/spreadsheets')) return false;

    try {
      const res = await fetch(webhookUrl, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();

      if (!data || data.status === 'empty') {
        const localHasRealDataOnEmpty = appState.collaborators.length > 0;
        if (localHasRealDataOnEmpty) {
          return await syncToOnlineSpreadsheet(false);
        }
        return false;
      }

      const remoteState = data.rawState || (data.collaborators ? data : null);
      if (!remoteState || !Array.isArray(remoteState.collaborators)) return false;

      const remoteUpdatedAtMs = Number(remoteState.updatedAtMs) || 0;
      const localUpdatedAtMs = Number(appState.updatedAtMs) || 0;
      const localHasRealNow = appState.collaborators.length > 0;

      if (remoteUpdatedAtMs <= localUpdatedAtMs || remoteUpdatedAtMs <= lastSyncedTimestampMs.current) {
        return false;
      }

      isRemoteOrBroadcastUpdate.current = true;
      lastSyncedTimestampMs.current = remoteUpdatedAtMs;
      try { localStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, String(remoteUpdatedAtMs)); } catch {}
      const now = new Date();
      const timestampStr = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;

      setAppState((prev) => ({
        ...prev,
        collaborators: remoteState.collaborators || prev.collaborators,
        deletedCollaborators: Array.isArray(remoteState.deletedCollaborators) ? remoteState.deletedCollaborators : prev.deletedCollaborators,
        tempNotes: remoteState.tempNotes || prev.tempNotes,
        tasks: remoteState.tasks || prev.tasks,
        breaks: remoteState.breaks || prev.breaks,
        attendance: remoteState.attendance || prev.attendance,
        intervals: remoteState.intervals || prev.intervals,
        roles: remoteState.roles || prev.roles,
        categories: remoteState.categories || prev.categories,
        skills: remoteState.skills || prev.skills,
        teamLeaders: remoteState.teamLeaders || prev.teamLeaders,
        dailyReports: remoteState.dailyReports || prev.dailyReports,
        teamName: remoteState.teamName || prev.teamName,
        sector: remoteState.sector || prev.sector,
        manager: remoteState.manager || prev.manager,
        teamShift: remoteState.teamShift || prev.teamShift,
        defaultTeamLeader: remoteState.defaultTeamLeader || prev.defaultTeamLeader,
        infoHubQuickFills: Array.isArray(remoteState.infoHubQuickFills) ? remoteState.infoHubQuickFills : prev.infoHubQuickFills,
        infoHubLinks: Array.isArray(remoteState.infoHubLinks) ? remoteState.infoHubLinks : prev.infoHubLinks,
        infoHubReminders: Array.isArray(remoteState.infoHubReminders) ? remoteState.infoHubReminders : prev.infoHubReminders,
        serviceRequests: Array.isArray(remoteState.serviceRequests) ? remoteState.serviceRequests : prev.serviceRequests,
        notifications: Array.isArray(remoteState.notifications) ? remoteState.notifications : prev.notifications,
        deletedNotificationIds: Array.isArray(remoteState.deletedNotificationIds) ? remoteState.deletedNotificationIds : prev.deletedNotificationIds,
        auditLogs: Array.isArray(remoteState.auditLogs) ? remoteState.auditLogs : prev.auditLogs,
        processKnowledgeList: Array.isArray(remoteState.processKnowledgeList) ? remoteState.processKnowledgeList : prev.processKnowledgeList,
        roleTypes: remoteState.roleTypes || prev.roleTypes,
        editorRoles: Array.isArray(remoteState.editorRoles) ? remoteState.editorRoles : prev.editorRoles,
        userPasswords: remoteState.userPasswords || prev.userPasswords,
        updatedAtMs: remoteUpdatedAtMs,
        onlineSpreadsheet: prev.onlineSpreadsheet
          ? {
              ...prev.onlineSpreadsheet,
              lastSyncedAt: timestampStr,
              syncStatus: 'success',
              lastError: undefined,
            }
          : null,
      }));

      return true;
    } catch (err) {
      if (!isSilent) {
        console.warn('Erro ao buscar dados da planilha compartilhada:', err);
      }
      return false;
    }
  };

  const syncToOnlineSpreadsheet = async (isAutoSync = false): Promise<boolean> => {
    const currentConfig = appState.onlineSpreadsheet;
    if (!currentConfig) {
      if (!isAutoSync) return false;
      return false;
    }

    const webhookUrl = currentConfig.webhookUrl?.trim();
    if (!webhookUrl) {
      if (!isAutoSync) return false;
      return false;
    }

    if (webhookUrl.includes('docs.google.com/spreadsheets')) {
      if (!isAutoSync) return false;
      return false;
    }

    const now = new Date();
    const timestampMs = appState.updatedAtMs || Date.now();
    lastSyncedTimestampMs.current = timestampMs;
    try { localStorage.setItem(LAST_SYNCED_TIMESTAMP_KEY, String(timestampMs)); } catch {}
    const timestampStr = `${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR')}`;

    try {
      new URL(webhookUrl);

      const dayReport = appState.dailyReports[appState.selectedDate] || {};

      const totalCols = appState.collaborators.length;
      let presentCount = 0;
      let absentCount = 0;
      let vacationCount = 0;
      let leaveTrainingCount = 0;
      let offCount = 0;

      const absenceDetailsList: any[] = [];

      appState.collaborators.forEach((c) => {
        const statusInfo = getCollaboratorStatus(c, appState.selectedDate, appState);
        const taskName = appState.tasks.find((t) => t.members.includes(c.id))?.name || 'Não Dimensionado';
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
            date: formatDateBR(appState.selectedDate),
            registration: c.registration,
            name: c.name,
            login: c.login,
            role: c.role,
            category: c.category,
            teamLeader: c.teamLeader || appState.defaultTeamLeader || 'Sem Líder',
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

      const payload = {
        spreadsheetUrl: currentConfig.url || '',
        spreadsheetId,
        rawState: {
          updatedAtMs: timestampMs,
          updatedAt: timestampStr,
          collaborators: appState.collaborators,
          deletedCollaborators: appState.deletedCollaborators,
          tempNotes: appState.tempNotes,
          tasks: appState.tasks,
          breaks: appState.breaks,
          attendance: appState.attendance,
          intervals: appState.intervals,
          calendar: appState.calendar,
          shifts: appState.shifts,
          scaleType: appState.scaleType,
          scaleGroups: appState.scaleGroups,
          shiftConfigs: appState.shiftConfigs,
          teams: appState.teams,
          teamShiftMap: appState.teamShiftMap,
          roles: appState.roles,
          categories: appState.categories,
          skills: appState.skills,
          teamLeaders: appState.teamLeaders,
          dailyReports: appState.dailyReports,
          teamName: appState.teamName,
          sector: appState.sector,
          manager: appState.manager,
          teamShift: appState.teamShift,
          defaultTeamLeader: appState.defaultTeamLeader,
          briefingConfig: appState.briefingConfig,
          feedbackConfig: appState.feedbackConfig,
          autoBackupSettings: appState.autoBackupSettings,
          processKnowledgeList: appState.processKnowledgeList,
          roleTypes: appState.roleTypes,
          rolePermissions: appState.rolePermissions,
          editorRoles: appState.editorRoles,
          userPasswords: appState.userPasswords,
          auditLogs: appState.auditLogs,
          notifications: appState.notifications,
          deletedNotificationIds: appState.deletedNotificationIds,
          serviceRequests: appState.serviceRequests,
          infoHubReminders: appState.infoHubReminders,
          infoHubLinks: appState.infoHubLinks,
          infoHubQuickFills: appState.infoHubQuickFills,
          metricDefinitions: appState.metricDefinitions || [],
          metricReadings: appState.metricReadings || [],
          supportMessages: appState.supportMessages,
          helpdeskConfig: appState.helpdeskConfig,
          shareCustomConfig: appState.shareCustomConfig,
          shareFilters: appState.shareFilters,
          reportExportConfig: appState.reportExportConfig,
          portalConfig: appState.portalConfig,
          portalNotificationConfig: appState.portalNotificationConfig,
          hiddenSidebarItems: appState.hiddenSidebarItems,
          widgetsConfig: appState.widgetsConfig,
          theme: appState.theme,
          requireUserPassword: appState.requireUserPassword,
          history: appState.history,
          showWidgetsModule: appState.showWidgetsModule,
          catalogs: appState.catalogs,
          autoBackupConfig: appState.autoBackupConfig,
          showBriefingSlide: appState.showBriefingSlide,
          showEmployeePortal: appState.showEmployeePortal,
          showOperatorPortal: appState.showOperatorPortal,
          abbreviatePortalNames: appState.abbreviatePortalNames,
          showInfoHub: appState.showInfoHub,
          showRadioModule: appState.showRadioModule,
          customShortcuts: appState.customShortcuts,
          sidebarOrder: appState.sidebarOrder,
          absenteeismPeriodDays: appState.absenteeismPeriodDays,
        },
        date: formatDateBR(appState.selectedDate),
        teamName: appState.teamName,
        sector: appState.sector,
        manager: appState.manager,
        shift: appState.teamShift,
        collaboratorsCount: appState.collaborators.length,
        collaboratorsMaster: appState.collaborators.map((c) => ({
          id: c.id,
          registration: c.registration || '',
          name: c.name || '',
          login: c.login || '',
          sector: appState.sector || '',
          manager: appState.manager || '',
          shift: c.shift || appState.teamShift || '',
          teamLeader: c.teamLeader || appState.defaultTeamLeader || 'Sem Time',
          scale: c.scale || '',
          role: c.role || '',
          category: c.category || '',
          skills: c.skills && typeof c.skills === 'object' && Object.keys(c.skills).length > 0
            ? Object.entries(c.skills).map(([sk, lv]) => `${sk} (${lv})`).join(', ')
            : 'Nenhuma',
          status: 'Ativo',
        })),
        data: appState.collaborators.map((c) => {
          const st = getCollaboratorStatus(c, appState.selectedDate, appState);
          const taskName = appState.tasks.find((t) => t.members.includes(c.id))?.name || 'Não Dimensionado';
          const dayInt = appState.intervals[appState.selectedDate] || {};
          const breakSlot = appState.breaks.find((b) => (dayInt[b.id] || []).includes(c.id))?.time || 'Sem Intervalo';
          return {
            date: formatDateBR(appState.selectedDate),
            registration: c.registration,
            name: c.name,
            login: c.login,
            sector: appState.sector,
            manager: appState.manager,
            shift: c.shift || appState.teamShift,
            teamLeader: c.teamLeader || appState.defaultTeamLeader || 'Sem Time',
            scale: c.scale,
            role: c.role,
            category: c.category,
            status: st.status,
            task: taskName,
            interval: breakSlot,
          };
        }),
        reports: {
          date: formatDateBR(appState.selectedDate),
          teamName: appState.teamName,
          sector: appState.sector,
          manager: appState.manager,
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
        tables: {
          teamLeaders: (appState.teamLeaders || []).map((tl) => {
            const teamCols = appState.collaborators.filter((c) => (c.teamLeader || appState.defaultTeamLeader) === tl);
            const tlsCount = teamCols.filter((c) => c.role && (c.role.toLowerCase().includes('líder') || c.role.toLowerCase().includes('leader'))).length;
            const hc = Math.max(0, teamCols.length - tlsCount);
            return {
              teamLeader: tl,
              totalCollaborators: teamCols.length,
              teamLeadersInTime: tlsCount,
              hcCount: hc,
            };
          }),
          tasks: appState.tasks.map((t) => ({
            id: t.id,
            name: t.name,
            membersCount: t.members.length,
            allowedRoles: t.allowedRoles || [],
            allowedCategories: t.allowedCategories || [],
            active: true,
          })),
          breaks: appState.breaks.map((b) => ({
            id: b.id,
            time: b.time,
            shift: b.shift || 'Geral',
            capacity: 'Sem limite',
          })),
          calendar: Object.entries(appState.calendar || {}).map(([date, group]) => [date, group]),
        },
        settings: {
          teamName: appState.teamName,
          sector: appState.sector,
          manager: appState.manager,
          teamShift: appState.teamShift,
          defaultTeamLeader: appState.defaultTeamLeader || 'Sem Líder Padrão',
          onlineSpreadsheetName: currentConfig.name,
          onlineSpreadsheetUrl: currentConfig.url,
          onlineWebhookUrl: currentConfig.webhookUrl || 'Não configurado',
          autoSyncEnabled: currentConfig.autoSyncEnabled !== false ? 'Sim' : 'Não',
          roles: appState.roles,
          categories: appState.categories,
          teamLeaders: appState.teamLeaders,
          tasks: appState.tasks.map((t) => ({
            id: t.id,
            name: t.name,
            membersCount: t.members.length,
            allowedRoles: t.allowedRoles || [],
            allowedCategories: t.allowedCategories || [],
          })),
          breaks: appState.breaks.map((b) => ({
            id: b.id,
            time: b.time,
            shift: b.shift || 'Geral',
          })),
          totalCollaborators: appState.collaborators.length,
          updatedAt: timestampStr,
        },
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });

      let resData: any = null;
      try {
        resData = await response.json();
      } catch {
        // Fallback for non-json response
      }

      if (resData && resData.status === 'error') {
        throw new Error(resData.message || 'Erro reportado pelo Google Apps Script.');
      }

      setAppState((prev) => ({
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
        return true;
      }
      return true;
    } catch (err: any) {
      console.warn('Sincronização com Google Sheets não pôde ser concluída:', err);
      
      const detailedError = err?.message || 'Falha ao conectar com o Google Apps Script. Verifique se no Apps Script a opção "Quem tem acesso" foi configurada como "Qualquer pessoa" e se o link termina em "/exec".';

      setAppState((prev) => ({
        ...prev,
        onlineSpreadsheet: prev.onlineSpreadsheet
          ? {
              ...prev.onlineSpreadsheet,
              syncStatus: isAutoSync ? (prev.onlineSpreadsheet.syncStatus || 'success') : 'error',
              lastSyncedAt: prev.onlineSpreadsheet.lastSyncedAt,
              lastError: detailedError,
            }
          : null,
      }));

      if (!isAutoSync) {
        return false;
      }
      return false;
    }
  };

  const testWebhookConnection = async (webhookUrlInput?: string): Promise<{ success: boolean; message: string; details?: string }> => {
    const url = (webhookUrlInput || appState.onlineSpreadsheet?.webhookUrl || '').trim();
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
          details: appState.onlineSpreadsheet?.lastError || 'Verifique se a opção "Quem tem acesso" no Apps Script está como "Qualquer pessoa" (Anyone).'
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
  useEffect(() => {
    if (isFirstRenderForAutoSync.current) {
      isFirstRenderForAutoSync.current = false;
      return;
    }

    if (isRemoteOrBroadcastUpdate.current) {
      isRemoteOrBroadcastUpdate.current = false;
      return;
    }

    lastLocalEditTime.current = Date.now();

    if (
      appState.onlineSpreadsheet &&
      appState.onlineSpreadsheet.webhookUrl &&
      appState.onlineSpreadsheet.autoSyncEnabled !== false
    ) {
      const timer = setTimeout(() => {
        syncToOnlineSpreadsheet(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [
    appState.collaborators,
    appState.tasks,
    appState.breaks,
    appState.attendance,
    appState.intervals,
    appState.teamName,
    appState.sector,
    appState.manager,
    appState.teamShift,
    appState.roles,
    appState.categories,
    appState.teamLeaders,
    appState.selectedDate,
    appState.dailyReports,
    appState.updatedAtMs,
  ]);

  // Background polling effect to receive changes from other team members using the same spreadsheet
  useEffect(() => {
    const currentConfig = appState.onlineSpreadsheet;
    if (!currentConfig || !currentConfig.webhookUrl || currentConfig.autoSyncEnabled === false) {
      return;
    }

    const interval = setInterval(() => {
      if (Date.now() - lastLocalEditTime.current > 1200) {
        fetchFromOnlineSpreadsheet(true);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [appState.onlineSpreadsheet?.webhookUrl, appState.onlineSpreadsheet?.autoSyncEnabled, appState.updatedAtMs]);

  return (
    <SyncContext.Provider
      value={{
        onlineSpreadsheet: appState.onlineSpreadsheet,
        backupHistory,
        lastAutoBackupInfo,
        dailyReports: appState.dailyReports,
        history: appState.history,
        setOnlineSpreadsheetConfig,
        syncToOnlineSpreadsheet,
        fetchFromOnlineSpreadsheet,
        testWebhookConnection,
        disconnectOnlineSpreadsheet,
        generateShareableConnectionLink,
        createAutoBackup,
        restoreFromAutoBackup,
        restoreBackupById,
        deleteBackupById,
        clearBackupHistory,
        exportBackupToFile,
        exportLocalSpreadsheet,
        exportTeamRosterSpreadsheet,
        generateTemplateSpreadsheet,
        importFullState,
        importFullStateWithBackup,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) throw new Error('useSync must be used within a SyncProvider');
  return context;
};