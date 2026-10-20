// Polyfill protetivo para ambientes corporativos com localStorage/sessionStorage bloqueados por GPO/política
(() => {
  if (typeof window === 'undefined') return;

  function createMemoryStore(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (key: string) => map.get(String(key)) ?? null,
      setItem: (key: string, val: string) => { map.set(String(key), String(val)); },
      removeItem: (key: string) => { map.delete(String(key)); },
      clear: () => { map.clear(); },
      key: (idx: number) => Array.from(map.keys())[idx] ?? null,
      get length() { return map.size; },
    };
  }

  // Verifica se localStorage é acessível sem estourar DOMException/SecurityError
  try {
    const test = '__dimensio_probe__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
  } catch {
    try {
      const memoryStorage = createMemoryStore();
      Object.defineProperty(window, 'localStorage', {
        value: memoryStorage,
        configurable: true,
        writable: true,
      });
      console.warn('[Dimensio] Modo corporativo seguro ativado: localStorage em memória.');
    } catch {}
  }

  // Verifica se sessionStorage é acessível
  try {
    const test = '__dimensio_probe__';
    window.sessionStorage.setItem(test, '1');
    window.sessionStorage.removeItem(test);
  } catch {
    try {
      const memoryStorage = createMemoryStore();
      Object.defineProperty(window, 'sessionStorage', {
        value: memoryStorage,
        configurable: true,
        writable: true,
      });
      console.warn('[Dimensio] Modo corporativo seguro ativado: sessionStorage em memória.');
    } catch {}
  }
})();

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from './registerSW.ts';
import { I18nProvider } from './i18n';

// Registra o Service Worker para suporte a PWA e Background Sync
registerSW();

// Marcador visível para a extensão "Dimensio — Destacar Colaboradores":
// permite ao content script identificar esta página como o app (mesmo
// domínio, mundos isolados) e abrir a Busca Global sob demanda.
document.documentElement.setAttribute('data-dimensio-app', '1');

// Safety net for stale PWA caches: after a redeploy the old bundle may try to
// lazy-load chunks that no longer exist (404 -> "Failed to fetch dynamically
// imported module"). Guard with sessionStorage so it never loops infinitely.
window.addEventListener('unhandledrejection', (e) => {
  const desc = (e.reason as Error)?.message || String(e.reason);
  if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(desc)) {
    const lastReload = Number(sessionStorage.getItem('dimensio_last_chunk_reload') || 0);
    if (Date.now() - lastReload > 30000) {
      sessionStorage.setItem('dimensio_last_chunk_reload', String(Date.now()));
      window.location.reload();
    } else {
      console.warn('[Dimensio] Dynamic import failed, reload prevented to avoid infinite loop:', desc);
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
