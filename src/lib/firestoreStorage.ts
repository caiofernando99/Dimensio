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
import { db } from './firebase';
import { AppState, ShiftClosingRecord } from '../types';
import { SignalMessage, CommPeerInfo } from '../communication/types';
import { normalizeAppState } from '../utils/stateNormalizer';

const DEFAULT_COLLECTION = 'dimensio_workspaces';
const DEFAULT_DOC_ID = 'main_roster_state';
const HISTORY_COLLECTION = 'dimensio_shift_history';
const PRESENCE_COLLECTION = 'dimensio_presence';

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
): Promise<{ success: boolean; error?: string }> {
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
      extensionConfig: state.extensionConfig || {},
      autoBackupSettings: state.autoBackupSettings || {},
      // Stringified safety snapshot
      stateJson: JSON.stringify({
        collaborators: state.collaborators,
        tasks: state.tasks,
        breaks: state.breaks,
        dailyReports: state.dailyReports,
        scheduledTasks: state.scheduledTasks,
      }),
      syncedAt: new Date().toISOString(),
    };

    await setDoc(docRef, payload, { merge: true });
    return { success: true };
  } catch (err: any) {
    console.error('Failed to push state to Firestore:', err);
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
      console.error('Firestore real-time subscription error:', err);
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
): Promise<{ state: Partial<AppState> | null; updatedAtMs: number }> {
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
  } catch (err) {
    console.error('Failed to fetch state from Firestore:', err);
    return { state: null, updatedAtMs: 0 };
  }
}

/**
 * Saves an immutable historical shift closing record to Firestore.
 */
export async function saveShiftClosingToFirestore(
  record: ShiftClosingRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = doc(db, HISTORY_COLLECTION, record.id);
    await setDoc(docRef, record);
    return { success: true };
  } catch (err: any) {
    console.error('Failed to save shift closing to Firestore:', err);
    return { success: false, error: err?.message || 'Erro ao gravar fechamento de turno no Firestore' };
  }
}

/**
 * Fetches all recent historical shift closings from Firestore.
 */
export async function fetchShiftClosingsFromFirestore(
  maxRecords = 50
): Promise<ShiftClosingRecord[]> {
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
  } catch (err) {
    console.warn('Failed to query shift closings from Firestore:', err);
    return [];
  }
}

/**
 * Deletes a shift closing record from Firestore.
 */
export async function deleteShiftClosingFromFirestore(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, HISTORY_COLLECTION, id);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('Failed to delete shift closing:', err);
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
      console.warn('Cloud presence subscription notice:', err);
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
 */
export async function sendFirestoreRadioSignals(messages: SignalMessage[]): Promise<void> {
  if (!messages || messages.length === 0) return;
  try {
    const promises = messages.map((msg) => {
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
    console.warn('[Firestore Radio Signaling] Erro ao enviar sinais:', err);
  }
}

/**
 * Subscribes to real-time incoming WebRTC / PTT signals via Firestore onSnapshot.
 */
export function subscribeToFirestoreRadioSignals(
  myPeerId: string,
  onSignal: (msg: SignalMessage) => void
): Unsubscribe {
  const colRef = collection(db, RADIO_SIGNALS_COLLECTION);
  const q = query(colRef, orderBy('ts', 'desc'), limit(40));

  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const d = change.doc.data();
          if (!d || d.sender === myPeerId) return;
          // Ignore signals older than 45s
          if (d.ts && now - d.ts > 45000) return;
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
      console.warn('[Firestore Radio Signals] Erro na subscrição em tempo real:', err);
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
  if (!peerId) return;
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
  } catch {
    // Silent presence failure tolerance
  }
}

/**
 * Removes peer presence from Firestore when radio turns off.
 */
export async function removeRadioCloudPresence(peerId: string): Promise<void> {
  if (!peerId) return;
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
  const colRef = collection(db, RADIO_PRESENCE_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const now = Date.now();
      const list: RadioCloudPresence[] = [];
      snapshot.forEach((d) => {
        const p = d.data() as RadioCloudPresence;
        // Alive if seen within last 12 seconds
        if (p && p.peerId && now - (p.lastSeen || 0) < 12000) {
          list.push(p);
        }
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('[Firestore Radio Presence] Erro no listener:', err);
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
 * Subscribes to real-time updates of a user profile in Firestore.
 */
export function subscribeToUserProfile(
  uid: string,
  onUpdate: (profile: import('../types').UserProfileData | null) => void
): Unsubscribe {
  if (!uid) {
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
      console.warn('[Firestore User Profile] Erro na subscrição de perfil:', err);
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


