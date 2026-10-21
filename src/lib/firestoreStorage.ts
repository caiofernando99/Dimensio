import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
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

export function clearFirestoreQuotaExceeded(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(QUOTA_STORAGE_KEY);
    }
  } catch {}
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
const RADIO_SIGNAL_WINDOW_MS = 15000;
const RADIO_SIGNAL_RETENTION_MS = 120000;
const RADIO_PRESENCE_TTL_MS = 60000;

export interface RadioCloudPresence {
  peerId: string;
  peerName: string;
  peerRole: string;
  channels: string[];
  lastSeen: number;
}

function radioCollectionName(base: string, workspaceName?: string): string {
  const safeWs = (workspaceName || 'default')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);
  return `${base}_${safeWs || 'default'}`;
}

function isHtmlResponse(res: Response): boolean {
  const contentType = res.headers.get('content-type') || '';
  return contentType.toLowerCase().includes('text/html');
}

/**
 * Pushes WebRTC / PTT signaling messages to the local Express relay.
 * Returns false when the endpoint is missing (e.g. static hosting serving index.html).
 */
export async function sendFirestoreRadioSignals(messages: SignalMessage[]): Promise<boolean> {
  if (!messages || messages.length === 0) return true;
  try {
    const res = await fetch('/api/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal: messages }),
    });
    return res.ok && !isHtmlResponse(res);
  } catch {
    return false;
  }
}

/**
 * Subscribes to real-time incoming WebRTC / PTT signals.
 * O streaming é provido por SSE (/api/signal/stream) e polling no CommunicationContext.
 */
export function subscribeToFirestoreRadioSignals(
  _myPeerId: string,
  _onSignal: (msg: SignalMessage) => void
): Unsubscribe {
  return () => {};
}

/**
 * Updates peer heartbeat in in-memory server presence store (0 Firestore reads/writes).
 */
export async function updateRadioCloudPresence(
  peerId: string,
  peerName: string,
  peerRole: string,
  channels: string[]
): Promise<void> {
  if (!peerId) return;
  try {
    await fetch('/api/signal/presence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peerId, peerName, peerRole, channels }),
    });
  } catch {}
}

/**
 * Removes peer presence when radio turns off.
 */
export async function removeRadioCloudPresence(peerId: string): Promise<void> {
  if (!peerId) return;
  try {
    await fetch('/api/signal/presence', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peerId }),
    });
  } catch {}
}

/**
 * Subscribes to real-time Radio Presence.
 * Fornecido em tempo real via SSE e polling do servidor.
 */
export function subscribeToRadioCloudPresence(
  _onUpdate: (peersList: RadioCloudPresence[]) => void
): Unsubscribe {
  return () => {};
}

/**
 * Firestore fallback for environments where /api/signal is not reachable
 * (Firebase Hosting / static preview). Used only when the local relay is absent.
 */
export async function sendRadioSignalsToFirestore(
  messages: SignalMessage[],
  workspaceName?: string
): Promise<boolean> {
  if (!messages || messages.length === 0) return true;
  if (isFirestoreQuotaExceeded()) return false;
  try {
    const colRef = collection(db, radioCollectionName(RADIO_SIGNALS_COLLECTION, workspaceName));
    await Promise.all(
      messages.map((message) =>
        addDoc(colRef, stripUndefinedDeep({ ...message, ts: message.ts || Date.now() }))
      )
    );
    return true;
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      console.warn('Radio signaling via Firestore failed:', err);
    }
    return false;
  }
}

async function cleanupOldRadioSignals(colRef: ReturnType<typeof collection>): Promise<void> {
  try {
    const cutoff = Date.now() - RADIO_SIGNAL_RETENTION_MS;
    const oldSignals = await getDocs(
      query(colRef, where('ts', '<', cutoff), orderBy('ts', 'asc'), limit(75))
    );
    await Promise.all(oldSignals.docs.map((entry) => deleteDoc(entry.ref)));
  } catch {}
}

export function subscribeToRadioSignalsFromFirestore(
  workspaceName: string | undefined,
  onSignal: (msg: SignalMessage) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (isFirestoreQuotaExceeded()) return () => {};
  const colRef = collection(db, radioCollectionName(RADIO_SIGNALS_COLLECTION, workspaceName));
  void cleanupOldRadioSignals(colRef);
  const seen = new Set<string>();
  const since = Date.now() - RADIO_SIGNAL_WINDOW_MS;
  return onSnapshot(
    query(colRef, where('ts', '>', since), orderBy('ts', 'asc'), limit(200)),
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const data = change.doc.data() as SignalMessage;
        if (!data || !data.mid || !data.sender || seen.has(data.mid)) return;
        seen.add(data.mid);
        onSignal(data);
      });
      if (seen.size > 1000) seen.clear();
    },
    (err) => {
      if (!isQuotaExceededError(err)) {
        console.warn('Radio signaling subscription failed:', err);
      }
      onError?.(err);
    }
  );
}

export async function updateRadioPresenceInFirestore(
  peerId: string,
  peerName: string,
  peerRole: string,
  channels: string[],
  workspaceName?: string
): Promise<boolean> {
  if (!peerId) return false;
  if (isFirestoreQuotaExceeded()) return false;
  try {
    const docRef = doc(
      db,
      radioCollectionName(RADIO_PRESENCE_COLLECTION, workspaceName),
      peerId.replace(/\//g, '_')
    );
    await setDoc(docRef, {
      peerId,
      peerName,
      peerRole,
      channels,
      lastSeen: Date.now(),
    });
    return true;
  } catch (err) {
    if (!isQuotaExceededError(err)) {
      console.warn('Radio presence via Firestore failed:', err);
    }
    return false;
  }
}

export async function removeRadioPresenceFromFirestore(
  peerId: string,
  workspaceName?: string
): Promise<void> {
  if (!peerId) return;
  try {
    await deleteDoc(
      doc(
        db,
        radioCollectionName(RADIO_PRESENCE_COLLECTION, workspaceName),
        peerId.replace(/\//g, '_')
      )
    );
  } catch {}
}

export function subscribeToRadioPresenceFromFirestore(
  workspaceName: string | undefined,
  onUpdate: (peersList: RadioCloudPresence[]) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  if (isFirestoreQuotaExceeded()) return () => {};
  const colRef = collection(db, radioCollectionName(RADIO_PRESENCE_COLLECTION, workspaceName));
  return onSnapshot(
    query(colRef, orderBy('lastSeen', 'desc'), limit(100)),
    (snapshot) => {
      const now = Date.now();
      const peers: RadioCloudPresence[] = [];
      snapshot.forEach((entry) => {
        const peer = entry.data() as RadioCloudPresence;
        if (!peer || !peer.peerId) return;
        if (now - (peer.lastSeen || 0) >= RADIO_PRESENCE_TTL_MS) return;
        peers.push({ ...peer, lastSeen: now });
      });
      onUpdate(peers);
    },
    (err) => {
      if (!isQuotaExceededError(err)) {
        console.warn('Radio presence subscription failed:', err);
      }
      onError?.(err);
    }
  );
}

const USER_PROFILES_COLLECTION = 'dimensio_user_profiles';

/**
 * Firestore rejects documents containing `undefined`. Remove essas chaves
 * recursivamente antes de gravar (ex.: collaboratorId ausente para um gestor).
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item === undefined) continue;
      result[key] = stripUndefinedDeep(item);
    }
    return result as T;
  }
  return value;
}

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
      stripUndefinedDeep({
        ...profile,
        lastSeenMs: Date.now(),
        updatedAt: new Date().toISOString(),
      }),
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



