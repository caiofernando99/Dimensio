import { buildZip } from './zip';
import { ExtensionConfig } from '../types';

const TEXT_FILES = ['manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js'];
const BINARY_FILES = ['icons/icon16.png', 'icons/icon48.png', 'icons/icon128.png'];

/**
 * Detecta se a extensão está instalada. Verifica o marcador no DOM
 * (data-dimensio-ext, injetado pelo content script) e, como redundância, a
 * ponte exposta no mundo da página (window.__DIMENSIO_BRIDGE__).
 */
export function isExtensionInstalled(): boolean {
  try {
    if (typeof document === 'undefined' || !document.documentElement) return false;
    if (document.documentElement.hasAttribute('data-dimensio-ext')) return true;
    const bridge = (window as unknown as Record<string, unknown>).__DIMENSIO_BRIDGE__;
    return !!(bridge && (bridge as { installed?: boolean }).installed);
  } catch {
    return false;
  }
}

/**
 * Avisa a extensão (via ponte da página -> postMessage, capturado pelo content
 * script) quais nomes devem ser destacados na tela — como um Ctrl+F persistente.
 * Retorna se a extensão foi detectada.
 */
export function dispatchHighlightToExtension(names: string[], title?: string): boolean {
  const clean = (names || []).map((n) => String(n).trim()).filter(Boolean);
  const installed = isExtensionInstalled();
  try {
  const bridge = (window as unknown as Record<string, unknown>).__DIMENSIO_BRIDGE__ as
    | { dispatch?: (names: string[], title?: string) => void }
    | undefined;
    if (bridge && typeof bridge.dispatch === 'function') {
      bridge.dispatch(clean, title || '');
    } else {
      window.postMessage(
        {
          source: 'DIMENSIO_APP',
          type: 'DIMENSIO_HIGHLIGHT',
          names: clean,
          title: title || '',
        },
        '*'
      );
    }
    document.dispatchEvent(
      new CustomEvent('dimensio-highlight', { detail: { names: clean, title: title || '' } })
    );
  } catch {
    /* redundância de segurança: nunca deve lançar */
  }
  return installed;
}

/**
 * Pede à extensão para abrir o link do sistema em uma janela dedicada: o
 * primeiro pedido cria a janela com uma guia e os próximos entram como novas
 * guias da mesma janela. Retorna se a extensão estava presente.
 */
export function dispatchOpenSystemToExtension(url: string): boolean {
  const installed = isExtensionInstalled();
  if (!url) return installed;
  try {
    const bridge = (window as unknown as Record<string, unknown>).__DIMENSIO_BRIDGE__ as
      | { openSystem?: (url: string) => void }
      | undefined;
    if (bridge && typeof bridge.openSystem === 'function') {
      bridge.openSystem(url);
    } else {
      window.postMessage({ source: 'DIMENSIO_APP', type: 'DIMENSIO_OPEN_SYSTEM', url }, '*');
    }
  } catch {
    /* redundância de segurança */
  }
  return installed;
}

/**
 * Envia a lista de itens de Preenchimento Rápido para a extensão armazenar e disponibilizar no popup.
 */
export function dispatchQuickFillsToExtension(quickFills: any[]): boolean {
  const installed = isExtensionInstalled();
  try {
    const bridge = (window as unknown as Record<string, unknown>).__DIMENSIO_BRIDGE__ as
      | { quickFills?: (items: any[]) => void }
      | undefined;
    if (bridge && typeof bridge.quickFills === 'function') {
      bridge.quickFills(quickFills);
    } else {
      window.postMessage({ source: 'DIMENSIO_APP', type: 'DIMENSIO_QUICK_FILLS', quickFills }, '*');
    }
  } catch {
    /* redundância de segurança */
  }
  return installed;
}

/**
 * Baixa o pacote da extensão (.zip) pronto para instalar em modo desenvolvedor
 * no Chrome/Edge. Os arquivos são servidos da pasta pública da aplicação e o
 * zip é montado 100% no cliente (sem backend).
 */
export async function downloadExtensionZip(): Promise<void> {
  const files: Record<string, string | Uint8Array> = {};

  for (const f of TEXT_FILES) {
    const res = await fetch('/extension/' + f);
    if (!res.ok) throw new Error('Falha ao carregar ' + f);
    files[f] = await res.text();
  }

  for (const f of BINARY_FILES) {
    const res = await fetch('/extension/' + f);
    if (!res.ok) throw new Error('Falha ao carregar ' + f);
    files[f] = new Uint8Array(await res.arrayBuffer());
  }

  const zip = buildZip(files);
  const url = URL.createObjectURL(zip);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dimensio-extensao.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/**
 * Envia as configurações gerais do Dimensio para a extensão (paleta, comportamento de janela, etc.)
 */
export function dispatchExtensionConfig(config: Partial<ExtensionConfig>): boolean {
  const installed = isExtensionInstalled();
  try {
    const bridge = (window as unknown as Record<string, unknown>).__DIMENSIO_BRIDGE__ as
      | { config?: (cfg: any) => void }
      | undefined;
    if (bridge && typeof bridge.config === 'function') {
      bridge.config(config);
    } else {
      window.postMessage({ source: 'DIMENSIO_APP', type: 'DIMENSIO_CONFIG_UPDATE', config }, '*');
    }
    document.dispatchEvent(
      new CustomEvent('dimensio-config-update', { detail: { config } })
    );
  } catch {
    /* redundância de segurança */
  }
  return installed;
}

/**
 * Executa um teste de comunicação (Ping) com a extensão
 */
export async function pingExtensionBridge(): Promise<{ success: boolean; latencyMs: number; mode: string }> {
  const start = performance.now();
  const installed = isExtensionInstalled();
  if (installed) {
    return { success: true, latencyMs: Math.round(performance.now() - start), mode: 'bridge_connected' };
  }
  return { success: false, latencyMs: 0, mode: 'not_detected' };
}

