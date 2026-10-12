import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { AppState, ShiftClosingRecord, FirestoreBackupRecord } from '../types';
import { SignalMessage, CommPeerInfo } from '../communication/types';
import { normalizeAppState } from '../utils/stateNormalizer';
import { getTodayISO } from '../utils/helpers';

const DEFAULT_COLLECTION = 'dimensio_workspaces';
const DEFAULT_DOC_ID = 'main_roster_state';
const HISTORY_COLLECTION = 'dimensio_shift_history';
const PRESENCE_COLLECTION = 'dimensio_presence';
const BACKUPS_COLLECTION = 'dimensio_backups';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

const QUOTA_STORAGE_KEY = 'dimensio_firestore_quota_exceeded_until';

export function isQuotaExceededError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  const code = String((err as any)?.code || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    msg.includes('quota limit exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('resource-exhausted') ||
    msg.includes('free daily read units') ||
    msg.includes('free tier database')
  );
}

export function isFirestoreQuotaExceeded(): boolean {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(QUOTA_STORAGE_KEY) : null;
    if (!raw) return false;
    const until = Number(raw);
    if (isNaN(until) || Date.now() >= until) {
      if (typeof window !== 'undefined') localStorage.removeItem(QUOTA_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function markFirestoreQuotaExceeded(cooldownMs = 30 * 60 * 1000): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(QUOTA_STORAGE_KEY, String(Date.now() + cooldownMs));
    }
  } catch {
    // Ignore storage issues
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const isQuota = isQuotaExceededError(error);
  if (isQuota) {
    markFirestoreQuotaExceeded();
  }

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map((p) => ({
        providerId: p.providerId,
        email: p.email,
      })) || [],
    },
    operationType,
    path,
  };

  if (isQuota) {
    console.warn('Firestore Quota Notice: Limite de leitura diária do plano gratuito atingido. Operando em modo offline.', JSON.stringify(errInfo));
  } else {
    console.warn('Firestore Warning: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

export interface FirestoreSyncStatus {
  connected: boolean;
  lastSyncedAt?: string;
  error?: string;
}

export interface CloudPresenceUser {
  id: string;
  name: string;
  role: string;
  shift?: string;
  lastSeenMs: number;
  isOnline: boolean;
}

/**
 * Pushes the full application state to Firestore in real-time.
 */
export async function pushStateToFirestore(
  state: AppState,
  collectionName = DEFAULT_COLLECTION,
  docId = DEFAULT_DOC_ID
): Promise<{ success: boolean; error?: string; quotaExceeded?: boolean }> {
  if (isFirestoreQuotaExceeded()) {
    return { success: false, error: 'Limite diário gratuito do Firestore atingido', quotaExceeded: true };
  }

  try {
    const docRef = doc(db, collectionName, docId);
    
    // Prepare lightweight sanitized payload
    const payload = {
      updatedAtMs: state.updatedAtMs || Date.now(),
      selectedDate: state.selectedDate,
      location: state.location || '',
      teamName: state.teamName || '',
      manager: state.manager || '',
      sector: state.sector || '',
      registeredSectors: state.registeredSectors || [],
      teamShift: state.teamShift || '',
      shifts: state.shifts || [],
      scaleType: state.scaleType || '5x2',
      scaleGroups: state.scaleGroups || [],
      collaborators: state.collaborators || [],
      tasks: state.tasks || [],
      breaks: state.breaks || [],
      dailyReports: state.dailyReports || {},
      calendar: state.calendar || {},
      attendance: state.attendance || {},
      intervals: state.intervals || {},
      tempNotes: state.tempNotes || {},
      processKnowledgeList: state.processKnowledgeList || [],
      deletedCollaborators: state.deletedCollaborators || [],
      teamLeaders: state.teamLeaders || [],
      defaultTeamLeader: state.defaultTeamLeader || '',
      shiftConfigs: state.shiftConfigs || {},
      scheduledTasks: state.scheduledTasks || [],
      scheduledTaskLists: state.scheduledTaskLists || [],
      showRoutinesModule: state.showRoutinesModule !== false,
      catalogs: state.catalogs || {},
      serviceRequests: (state.serviceRequests || []).slice(0, 100),
      infoHubLinks: state.infoHubLinks || [],
      infoHubReminders: state.infoHubReminders || [],
      infoHubQuickFills: state.infoHubQuickFills || [],
      metricDefinitions: state.metricDefinitions || [],
      metricReadings: state.metricReadings || [],
      supportMessages: (state.supportMessages || []).slice(0, 100),
      helpdeskConfig: state.helpdeskConfig || {},
      portalConfig: state.portalConfig || {},
      portalNotificationConfig: state.portalNotificationConfig || {},
      shareCustomConfig: state.shareCustomConfig || {},
      shareFilters: state.shareFilters || {},
      widgetsConfig: state.widgetsConfig || {},
      calendarEvents: state.calendarEvents || {},
      roles: state.roles || [],
      categories: state.categories || [],
      skills: state.skills || [],
      rolePermissions: state.rolePermissions || {},
      theme: state.theme || 'dimensio',
      extensionConfig: state.extensionConfig || {},
      autoBackupSettings: state.autoBackupSettings || {},
      // Stringified safety snapshot
      stateJson: JSON.stringify({
        collaborators: state.collaborators,
        tasks: state.tasks,
        breaks: state.breaks,
        dailyReports: state.dailyReports,
        scheduledTasks: state.scheduledTasks,
        helpdeskConfig: state.helpdeskConfig,
      }),
      syncedAt: new Date().toISOString(),
    };

    // Remove any undefined properties across nested objects before calling setDoc
    const cleanPayload = JSON.parse(JSON.stringify(payload));
    await setDoc(docRef, cleanPayload, { merge: true });
    return { success: true };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      console.warn('Aviso de cota ao sincronizar estado com Firestore:', err?.message || err);
      return { success: false, error: 'Limite diário gratuito do Firestore atingido', quotaExceeded: true };
    }
    console.warn('Falha ao sincronizar estado com o Firestore:', err);
    return { success: false, error: err?.message || 'Erro ao sincronizar com o Firestore' };
  }
}

/**
 * Listens for real-time changes to the Firestore document and invokes onUpdate with normalized state.
 */
export function subscribeToFirestoreState(
  onUpdate: (remoteState: Partial<AppState>, updatedAtMs: number) => void,
  onError: (err: any) => void,
  collectionName = DEFAULT_COLLECTION,
  docId = DEFAULT_DOC_ID
): Unsubscribe {
  if (isFirestoreQuotaExceeded()) {
    console.warn('[Firestore] Cota diária gratuita do Firestore atingida. Operando em modo local offline.');
    onError({ code: 'resource-exhausted', message: 'Quota limit exceeded' });
    return () => {};
  }

  const docRef = doc(db, collectionName, docId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        return;
      }
      const data = snapshot.data();
      if (!data) return;

      const remoteUpdatedAtMs = Number(data.updatedAtMs) || 0;
      onUpdate(data as Partial<AppState>, remoteUpdatedAtMs);
    },
    (err) => {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
        console.warn('Firestore real-time subscription notice (limite diário gratuito atingido):', err?.message || err);
      } else {
        console.warn('Firestore real-time subscription notice:', err?.message || err);
      }
      onError(err);
    }
  );
}

/**
 * Fetches state from Firestore once.
 */
export async function fetchStateFromFirestoreOnce(
  collectionName = DEFAULT_COLLECTION,
  docId = DEFAULT_DOC_ID
): Promise<{ state: Partial<AppState> | null; updatedAtMs: number; quotaExceeded?: boolean }> {
  if (isFirestoreQuotaExceeded()) {
    console.warn('[Firestore] Cota diária gratuita do Firestore atingida. Pulando leitura e mantendo estado local.');
    return { state: null, updatedAtMs: 0, quotaExceeded: true };
  }

  try {
    const docRef = doc(db, collectionName, docId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { state: null, updatedAtMs: 0 };
    }
    const data = snap.data();
    return {
      state: data as Partial<AppState>,
      updatedAtMs: Number(data?.updatedAtMs) || 0,
    };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      console.warn('Aviso de cota ao buscar estado do Firestore (limite diário atingido):', err?.message || err);
      return { state: null, updatedAtMs: 0, quotaExceeded: true };
    }
    console.warn('Falha ao buscar estado do Firestore:', err?.message || err);
    return { state: null, updatedAtMs: 0 };
  }
}

/**
 * Saves an immutable historical shift closing record to Firestore.
 */
export async function saveShiftClosingToFirestore(
  record: ShiftClosingRecord
): Promise<{ success: boolean; error?: string }> {
  if (isFirestoreQuotaExceeded()) {
    return { success: false, error: 'Limite diário gratuito do Firestore atingido' };
  }

  try {
    const docRef = doc(db, HISTORY_COLLECTION, record.id);
    await setDoc(docRef, record);
    return { success: true };
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      console.warn('Aviso de cota ao salvar fechamento de turno no Firestore:', err?.message || err);
    } else {
      console.warn('Falha ao salvar fechamento de turno no Firestore:', err);
    }
    return { success: false, error: err?.message || 'Erro ao gravar fechamento de turno no Firestore' };
  }
}

/**
 * Fetches all recent historical shift closings from Firestore.
 */
export async function fetchShiftClosingsFromFirestore(
  maxRecords = 50
): Promise<ShiftClosingRecord[]> {
  if (isFirestoreQuotaExceeded()) {
    return [];
  }

  try {
    const colRef = collection(db, HISTORY_COLLECTION);
    const q = query(colRef, orderBy('closedAt', 'desc'), limit(maxRecords));
    const snapshot = await getDocs(q);
    const records: ShiftClosingRecord[] = [];
    snapshot.forEach((d) => {
      const data = d.data() as ShiftClosingRecord;
      if (data && data.id) {
        records.push(data);
      }
    });
    return records;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      console.warn('Aviso de cota ao buscar fechamentos de turno:', err?.message || err);
    } else {
      console.warn('Failed to query shift closings from Firestore:', err);
    }
    return [];
  }
}

/**
 * Deletes a shift closing record from Firestore.
 */
export async function deleteShiftClosingFromFirestore(id: string): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) {
    return false;
  }

  try {
    const docRef = doc(db, HISTORY_COLLECTION, id);
    await deleteDoc(docRef);
    return true;
  } catch (err: any) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
      console.warn('Aviso de cota ao excluir fechamento de turno:', err?.message || err);
    } else {
      console.warn('Failed to delete shift closing:', err);
    }
    return false;
  }
}

/**
 * Broadcasts heartbeat presence of an active user to the cloud workspace.
 */
export async function updateCloudPresence(
  workspaceName: string,
  user: { id: string; name: string; role: string; shift?: string }
): Promise<void> {
  try {
    if (!user.id || !user.name) return;
    const safeWs = workspaceName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, `${PRESENCE_COLLECTION}_${safeWs}`, user.id);
    await setDoc(
      docRef,
      {
        id: user.id,
        name: user.name,
        role: user.role,
        shift: user.shift || '',
        lastSeenMs: Date.now(),
        isOnline: true,
      },
      { merge: true }
    );
  } catch (err) {
    // Non-critical, ignore silence
  }
}

/**
 * Subscribes to real-time online presence in a workspace.
 */
export function subscribeToCloudPresence(
  workspaceName: string,
  onUpdate: (activeUsers: CloudPresenceUser[]) => void
): Unsubscribe {
  if (isFirestoreQuotaExceeded()) {
    return () => {};
  }
  const safeWs = workspaceName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const colRef = collection(db, `${PRESENCE_COLLECTION}_${safeWs}`);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const now = Date.now();
      const users: CloudPresenceUser[] = [];
      snapshot.forEach((d) => {
        const u = d.data() as CloudPresenceUser;
        // User is considered online if seen within last 45 seconds
        if (u && now - (u.lastSeenMs || 0) < 45000) {
          users.push(u);
        }
      });
      onUpdate(users);
    },
    (err) => {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      } else {
        console.warn('Cloud presence subscription notice:', err);
      }
    }
  );
}

const RADIO_SIGNALS_COLLECTION = 'dimensio_radio_signals';
const RADIO_PRESENCE_COLLECTION = 'dimensio_radio_presence';

export interface RadioCloudPresence {
  peerId: string;
  peerName: string;
  peerRole: string;
  channels: string[];
  lastSeen: number;
}

/**
 * Pushes WebRTC / PTT signaling messages directly to Firestore in real-time.
 * Filtra candidatos ICE para não consumir cota do Firestore.
 */
export async function sendFirestoreRadioSignals(messages: SignalMessage[]): Promise<void> {
  if (!messages || messages.length === 0 || isFirestoreQuotaExceeded()) return;
  // Permitir sinais essenciais e candidatos ICE direcionados para viabilizar WebRTC entre dispositivos
  const essentialSignals = messages.filter(
    (m) =>
      m.kind !== 'speaking' &&
      m.kind !== 'audio_chunk' &&
      m.kind !== 'state_ping' &&
      (m.kind !== 'candidate' || Boolean(m.to))
  );
  if (essentialSignals.length === 0) return;

  try {
    const promises = essentialSignals.map((msg) => {
      const docRef = doc(db, RADIO_SIGNALS_COLLECTION, msg.mid);
      const cleanPayload: Record<string, any> = {
        mid: msg.mid,
        kind: msg.kind,
        sender: msg.sender,
        senderName: msg.senderName || '',
        senderRole: msg.senderRole || '',
        to: msg.to || null,
        channel: msg.channel || 'geral',
        ts: msg.ts || Date.now(),
        directOpen: Boolean(msg.directOpen),
      };
      if (msg.payload !== undefined) {
        cleanPayload.payload = JSON.stringify(msg.payload);
      }
      return setDoc(docRef, cleanPayload);
    });
    await Promise.all(promises);
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
  }
}

/**
 * Subscribes to real-time incoming WebRTC / PTT signals via Firestore onSnapshot.
 */
export function subscribeToFirestoreRadioSignals(
  myPeerId: string,
  onSignal: (msg: SignalMessage) => void
): Unsubscribe {
  if (isFirestoreQuotaExceeded()) {
    return () => {};
  }
  const colRef = collection(db, RADIO_SIGNALS_COLLECTION);
  const q = query(colRef, orderBy('ts', 'desc'), limit(60));

  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const d = change.doc.data();
          if (!d || d.sender === myPeerId) return;
          // Ignore signals older than 30s
          if (d.ts && now - d.ts > 30000) return;
          if (d.to && d.to !== myPeerId) return;

          let parsedPayload = undefined;
          if (d.payload) {
            try {
              parsedPayload = JSON.parse(d.payload);
            } catch {
              parsedPayload = d.payload;
            }
          }

          const msg: SignalMessage = {
            mid: d.mid || change.doc.id,
            kind: d.kind,
            sender: d.sender,
            senderName: d.senderName,
            senderRole: d.senderRole,
            to: d.to || undefined,
            channel: d.channel,
            ts: d.ts || now,
            payload: parsedPayload,
            directOpen: Boolean(d.directOpen),
          };

          onSignal(msg);
        }
      });
    },
    (err) => {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      }
    }
  );
}

/**
 * Updates peer heartbeat in Firestore for Radio PTT Presence.
 */
export async function updateRadioCloudPresence(
  peerId: string,
  peerName: string,
  peerRole: string,
  channels: string[]
): Promise<void> {
  if (!peerId || isFirestoreQuotaExceeded()) return;
  try {
    const docId = peerId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, RADIO_PRESENCE_COLLECTION, docId);
    await setDoc(
      docRef,
      {
        peerId,
        peerName,
        peerRole,
        channels,
        lastSeen: Date.now(),
      },
      { merge: true }
    );
  } catch (err) {
    if (isQuotaExceededError(err)) {
      markFirestoreQuotaExceeded();
    }
  }
}

/**
 * Removes peer presence from Firestore when radio turns off.
 */
export async function removeRadioCloudPresence(peerId: string): Promise<void> {
  if (!peerId || isFirestoreQuotaExceeded()) return;
  try {
    const docId = peerId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, RADIO_PRESENCE_COLLECTION, docId);
    await deleteDoc(docRef);
  } catch {}
}

/**
 * Subscribes to real-time Radio Presence across all subscribed channels.
 */
export function subscribeToRadioCloudPresence(
  onUpdate: (peersList: RadioCloudPresence[]) => void
): Unsubscribe {
  if (isFirestoreQuotaExceeded()) {
    return () => {};
  }
  const colRef = collection(db, RADIO_PRESENCE_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const now = Date.now();
      const list: RadioCloudPresence[] = [];
      snapshot.forEach((d) => {
        const p = d.data() as RadioCloudPresence;
        // Presença ativa se visto nos últimos 18 segundos (evita colaboradores fantasmas)
        const age = now - (p?.lastSeen || 0);
        if (p && p.peerId && age < 18000) {
          list.push(p);
        } else if (p && p.peerId && age > 30000) {
          // Limpeza proativa de fantasmas obsoletos no Firestore
          try {
            deleteDoc(doc(db, RADIO_PRESENCE_COLLECTION, d.id)).catch(() => {});
          } catch {}
        }
      });
      onUpdate(list);
    },
    (err) => {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      }
    }
  );
}

const USER_PROFILES_COLLECTION = 'dimensio_user_profiles';

/**
 * Saves or updates a user profile and personal preferences in Firestore.
 */
export async function saveUserProfileToFirestore(
  profile: Partial<import('../types').UserProfileData> & { uid: string }
): Promise<void> {
  if (!profile.uid) return;
  try {
    const docId = profile.uid.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, USER_PROFILES_COLLECTION, docId);
    await setDoc(
      docRef,
      {
        ...profile,
        lastSeenMs: Date.now(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore User Profile] Erro ao salvar perfil:', err);
  }
}

/**
 * Fetches a user profile from Firestore once.
 */
export async function getUserProfileFromFirestore(
  uid: string
): Promise<import('../types').UserProfileData | null> {
  if (!uid) return null;
  try {
    const docId = uid.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, USER_PROFILES_COLLECTION, docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as import('../types').UserProfileData;
    }
    return null;
  } catch (err) {
    console.warn('[Firestore User Profile] Erro ao buscar perfil:', err);
    return null;
  }
}

/**
 * Permanently deletes a user profile document from Firestore.
 */
export async function deleteUserProfileFromFirestore(uid: string): Promise<void> {
  if (!uid) return;
  try {
    const docId = uid.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, USER_PROFILES_COLLECTION, docId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('[Firestore User Profile] Erro ao remover perfil:', err);
  }
}

/**
 * Subscribes to real-time updates of a user profile in Firestore.
 */
export function subscribeToUserProfile(
  uid: string,
  onUpdate: (profile: import('../types').UserProfileData | null) => void
): Unsubscribe {
  if (!uid || isFirestoreQuotaExceeded()) {
    return () => {};
  }
  const docId = uid.replace(/[^a-zA-Z0-9_-]/g, '_');
  const docRef = doc(db, USER_PROFILES_COLLECTION, docId);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as import('../types').UserProfileData);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      if (isQuotaExceededError(err)) {
        markFirestoreQuotaExceeded();
      } else {
        console.warn('[Firestore User Profile] Erro na subscrição de perfil:', err);
      }
    }
  );
}

/**
 * Updates user scratchpad (private cloud notes) in Firestore.
 */
export async function saveUserScratchpad(uid: string, text: string): Promise<void> {
  if (!uid) return;
  try {
    const docId = uid.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, USER_PROFILES_COLLECTION, docId);
    await setDoc(
      docRef,
      {
        uid,
        privateScratchpad: text,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore User Profile] Erro ao salvar bloco de notas:', err);
  }
}

/**
 * Updates user working status in Firestore.
 */
export async function updateUserWorkStatus(
  uid: string,
  workStatus: import('../types').UserWorkStatus,
  statusCustomMessage?: string
): Promise<void> {
  if (!uid) return;
  try {
    const docId = uid.replace(/[^a-zA-Z0-9_-]/g, '_');
    const docRef = doc(db, USER_PROFILES_COLLECTION, docId);
    await setDoc(
      docRef,
      {
        uid,
        workStatus,
        statusCustomMessage: statusCustomMessage || '',
        lastSeenMs: Date.now(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore User Profile] Erro ao atualizar status:', err);
  }
}

/**
 * Saves a periodic, daily, or manual backup snapshot to Firestore.
 */
export async function saveBackupToFirestore(
  state: AppState,
  reason: string,
  cadenceType: 'daily' | 'interval' | 'manual' | 'safety' | 'recovery' = 'daily',
  authorName?: string,
  maxRetain = 30
): Promise<{ success: boolean; backup?: FirestoreBackupRecord; error?: string }> {
  try {
    const now = new Date();
    const createdDate = getTodayISO();
    const createdTime = now.toLocaleTimeString('pt-BR');
    const teamName = state.teamName || 'Equipe Dimensio';
    const workspaceId = (state.onlineSpreadsheet?.firestoreCollection || 'main_workspace')
      .replace(/[^a-zA-Z0-9_-]/g, '_');

    const id = cadenceType === 'daily'
      ? `daily_${workspaceId}_${createdDate}`
      : `bkp_${workspaceId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Prepare full state serialization
    const stateJson = JSON.stringify(state);

    const record: FirestoreBackupRecord = {
      id,
      workspaceId,
      teamName,
      createdAt: now.toISOString(),
      createdDate,
      createdTime,
      cadenceType,
      reason,
      collaboratorCount: (state.collaborators || []).length,
      taskCount: (state.tasks || []).length,
      breakCount: (state.breaks || []).length,
      shiftCount: (state.shifts || []).length,
      authorName: authorName || 'Sistema Automático',
      stateJson,
      metadata: {
        sector: state.sector || '',
        manager: state.manager || '',
        shifts: state.shifts || [],
        scaleType: state.scaleType || '5x2',
        appVersion: '1.5.0',
        spreadsheetUrl: state.onlineSpreadsheet?.url || '',
      },
    };

    const docRef = doc(db, BACKUPS_COLLECTION, id);
    await setDoc(docRef, record);

    // Prune older backups in the background to avoid quota waste
    pruneOldFirestoreBackups(workspaceId, maxRetain).catch((err) => {
      console.warn('Falha na limpeza de backups antigos do Firestore:', err);
    });

    return { success: true, backup: record };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markFirestoreQuotaExceeded();
      console.warn('Aviso de cota ao salvar backup no Firestore:', error);
    } else {
      console.warn('Erro ao salvar backup no Firestore:', error);
    }
    try {
      handleFirestoreError(error, OperationType.WRITE, BACKUPS_COLLECTION);
    } catch (e: any) {
      return { success: false, error: e?.message || 'Falha ao salvar backup no Firestore' };
    }
  }
}

/**
 * Lists backups stored in Firestore for this workspace.
 */
export async function listFirestoreBackups(
  workspaceName?: string,
  maxRecords = 40
): Promise<FirestoreBackupRecord[]> {
  if (isFirestoreQuotaExceeded()) {
    return [];
  }

  try {
    const colRef = collection(db, BACKUPS_COLLECTION);
    let q;
    if (workspaceName) {
      const safeWs = workspaceName.replace(/[^a-zA-Z0-9_-]/g, '_');
      q = query(
        colRef,
        where('workspaceId', '==', safeWs),
        orderBy('createdAt', 'desc'),
        limit(maxRecords)
      );
    } else {
      q = query(colRef, orderBy('createdAt', 'desc'), limit(maxRecords));
    }

    const snap = await getDocs(q);
    const records: FirestoreBackupRecord[] = [];
    snap.forEach((d) => {
      const data = d.data() as FirestoreBackupRecord;
      if (data && data.id) {
        records.push(data);
      }
    });
    return records;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markFirestoreQuotaExceeded();
      console.warn('Aviso de cota ao consultar backups do Firestore:', error);
    } else {
      console.warn('Erro ao consultar backups do Firestore:', error);
    }
    // Fallback without composite index if index is building
    try {
      const colRef = collection(db, BACKUPS_COLLECTION);
      const snap = await getDocs(query(colRef, limit(maxRecords)));
      const records: FirestoreBackupRecord[] = [];
      snap.forEach((d) => {
        const data = d.data() as FirestoreBackupRecord;
        if (data && data.id) {
          records.push(data);
        }
      });
      records.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      return records;
    } catch (err) {
      return [];
    }
  }
}

/**
 * Restores application state from a Firestore backup record.
 */
export async function restoreFirestoreBackup(
  backupId: string
): Promise<{ success: boolean; state?: Partial<AppState>; error?: string }> {
  if (isFirestoreQuotaExceeded()) {
    return { success: false, error: 'Limite diário gratuito do Firestore atingido.' };
  }

  try {
    const docRef = doc(db, BACKUPS_COLLECTION, backupId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      return { success: false, error: 'Backup não encontrado no Firestore.' };
    }

    const data = snap.data() as FirestoreBackupRecord;
    if (!data.stateJson) {
      return { success: false, error: 'Arquivo de backup corrompido no Firestore (sem dados de estado).' };
    }

    const parsedState = JSON.parse(data.stateJson);
    return { success: true, state: parsedState };
  } catch (error: any) {
    if (isQuotaExceededError(error)) {
      markFirestoreQuotaExceeded();
      console.warn('Aviso de cota ao restaurar backup do Firestore:', error?.message || error);
    } else {
      console.warn('Erro ao restaurar backup do Firestore:', error);
    }
    return { success: false, error: error?.message || 'Falha ao processar backup do Firestore.' };
  }
}

/**
 * Deletes a backup from Firestore.
 */
export async function deleteFirestoreBackup(backupId: string): Promise<boolean> {
  if (isFirestoreQuotaExceeded()) {
    return false;
  }

  try {
    const docRef = doc(db, BACKUPS_COLLECTION, backupId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      markFirestoreQuotaExceeded();
      console.warn('Aviso de cota ao excluir backup do Firestore:', error);
    } else {
      console.warn('Erro ao excluir backup do Firestore:', error);
    }
    return false;
  }
}

/**
 * Prunes backups older than maxRetain for the given workspace.
 */
async function pruneOldFirestoreBackups(workspaceId: string, maxRetain: number): Promise<void> {
  if (maxRetain <= 0) return;
  try {
    const colRef = collection(db, BACKUPS_COLLECTION);
    const q = query(colRef, where('workspaceId', '==', workspaceId), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    const docs = snap.docs;
    if (docs.length > maxRetain) {
      const toDelete = docs.slice(maxRetain);
      for (const d of toDelete) {
        await deleteDoc(d.ref).catch(() => {});
      }
    }
  } catch {
    // Non-critical, ignore
  }
}



