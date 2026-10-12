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
