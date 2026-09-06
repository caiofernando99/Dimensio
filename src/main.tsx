import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from './registerSW.ts';

// Registra o Service Worker para suporte a PWA e Background Sync
registerSW();

// Marcador visível para a extensão "Dimensio — Destacar Colaboradores":
// permite ao content script identificar esta página como o app (mesmo
// domínio, mundos isolados) e abrir a Busca Global sob demanda.
document.documentElement.setAttribute('data-dimensio-app', '1');

// Safety net for stale PWA caches: after a redeploy the old bundle may try to
// lazy-load chunks that no longer exist (404 -> "Failed to fetch dynamically
// imported module"), which crashes the app. Reload once to pick up the new build.
let reloadedOnChunkError = false;
window.addEventListener('unhandledrejection', (e) => {
  const desc = (e.reason as Error)?.message || String(e.reason);
  if (/Failed to fetch dynamically imported module|Importing a module script failed/i.test(desc)) {
    if (!reloadedOnChunkError) {
      reloadedOnChunkError = true;
      window.location.reload();
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
