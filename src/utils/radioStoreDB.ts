export interface RadioPersistedState {
  enabled: boolean;
  volume: number;
  sfxEnabled?: boolean;
  activeChannel: string | null;
  mode: 'ptt' | 'open';
  muted: boolean;
  subscribedChannels: string[];
  floatingPosition: { x: number; y: number } | null;
  updatedAt: number;
}

const DB_NAME = 'DimensioRadioDB';
const STORE_NAME = 'radioState';
const CONFIG_KEY = 'radio_config';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

/**
 * Saves radio state to IndexedDB asynchronously with localStorage backup.
 */
export async function saveRadioStateDB(state: Partial<RadioPersistedState>): Promise<void> {
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const getReq = store.get(CONFIG_KEY);
    getReq.onsuccess = () => {
      const existing = getReq.result || { id: CONFIG_KEY };
      const updated = {
        ...existing,
        ...state,
        id: CONFIG_KEY,
        updatedAt: Date.now(),
      };
      store.put(updated);
    };
  } catch (err) {
    console.warn('[RadioStoreDB] Failed to save state to IndexedDB:', err);
  } finally {
    // Synchronous fallback / mirror in localStorage for instantaneous startup read
    try {
      if (state.enabled !== undefined) localStorage.setItem('dimensio_radio_enabled', JSON.stringify(state.enabled));
      if (state.volume !== undefined) localStorage.setItem('dimensio_radio_volume', JSON.stringify(state.volume));
      if (state.mode !== undefined) localStorage.setItem('dimensio_radio_mode', JSON.stringify(state.mode));
      if (state.muted !== undefined) localStorage.setItem('dimensio_radio_muted', JSON.stringify(state.muted));
      if (state.activeChannel !== undefined) localStorage.setItem('dimensio_radio_active_ch', JSON.stringify(state.activeChannel));
    } catch {}
  }
}

/**
 * Loads persisted radio state from IndexedDB (or fallback localStorage).
 */
export async function loadRadioStateDB(): Promise<Partial<RadioPersistedState> | null> {
  try {
    const db = await getDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CONFIG_KEY);
      req.onsuccess = () => {
        if (req.result) {
          const { id, ...data } = req.result;
          resolve(data as Partial<RadioPersistedState>);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('[RadioStoreDB] IDB read failed, checking localStorage fallback:', err);
    try {
      const enabled = localStorage.getItem('dimensio_radio_enabled');
      const volume = localStorage.getItem('dimensio_radio_volume');
      const mode = localStorage.getItem('dimensio_radio_mode');
      const muted = localStorage.getItem('dimensio_radio_muted');
      const activeChannel = localStorage.getItem('dimensio_radio_active_ch');

      if (enabled !== null || volume !== null || mode !== null) {
        return {
          enabled: enabled !== null ? JSON.parse(enabled) : true,
          volume: volume !== null ? JSON.parse(volume) : 1.0,
          mode: mode !== null ? JSON.parse(mode) : 'ptt',
          muted: muted !== null ? JSON.parse(muted) : false,
          activeChannel: activeChannel !== null ? JSON.parse(activeChannel) : null,
        };
      }
    } catch {}
    return null;
  }
}
