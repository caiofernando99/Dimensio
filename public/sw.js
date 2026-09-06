// Service Worker com suporte a Background Sync para o Rádio PTT Dimensio Talk
const CACHE_NAME = 'dimensio-radio-v1';
const DB_NAME = 'DimensioRadioDB';
const STORE_NAME = 'radioState';
const CONFIG_KEY = 'radio_config';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Helper para ler estado do IndexedDB no Service Worker
async function getPersistedRadioState() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          resolve(null);
          return;
        }
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(CONFIG_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Handler da API Background Sync
self.addEventListener('sync', (event) => {
  if (
    event.tag === 'radio-sync-pending' ||
    event.tag === 'radio-state-sync' ||
    event.tag === 'radio-background-sync'
  ) {
    event.waitUntil(
      (async () => {
        console.log('[SW Background Sync] Sincronização em segundo plano ativada para:', event.tag);

        // 1. Notifica clientes ativos para ressincronizar áudio e sinalização PTT
        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of allClients) {
          client.postMessage({
            type: 'DIMENSIO_RADIO_BACKGROUND_SYNC',
            tag: event.tag,
            timestamp: Date.now(),
          });
        }

        // 2. Se houver requisições pendentes gravadas no IndexedDB, realiza heartbeat na API
        const state = await getPersistedRadioState();
        if (state && state.enabled) {
          try {
            await fetch('/api/signal', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'ping',
                peerId: 'sw-sync-keepalive',
                channel: state.activeChannel || 'geral',
                timestamp: Date.now(),
              }),
            });
          } catch (err) {
            console.warn('[SW Background Sync] Tentativa de ping falhou (sem rede):', err);
          }
        }
      })()
    );
  }
});

// Permite comunicação bidirecional com a aplicação principal
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PING_SW') {
    event.ports[0]?.postMessage({ status: 'active', bgSyncSupported: 'sync' in self.registration });
  }
});
