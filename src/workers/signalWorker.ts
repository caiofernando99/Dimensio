/**
 * Dimensio Talk — signaling worker.
 *
 * Keeps the relay loop (heartbeat + poll + outbox) running even when the app
 * tab is hidden, because browsers throttle/freeze main-thread timers in the
 * background but NOT network activity from a Web Worker.
 */

import type { SignalMessage } from '../communication/types';

// ALÍVIO DE CARGA (2026): polling de 1s/3s por cliente derrubava o backend
// com 20+ coletores. Novos padrões: poll 2.5s + heartbeat 8s. O handshake
// PTT continua rápido pois o primeiro tick é imediato (ver start()).
const HEARTBEAT_MS_DEFAULT = 8000;
const POLL_MS_DEFAULT = 2500;

const workerSelf = self as unknown as {
  postMessage(message: unknown): void;
  onmessage: ((ev: MessageEvent) => void) | null;
};

interface WorkerConfig {
  webhookUrl: string;
  spreadsheetUrl: string;
  peerId: string;
  peerName: string;
  peerRole: string;
  channels: string[];
  pollMs: number;
  heartbeatMs: number;
}

type WorkerInput =
  | { type: 'start'; config: WorkerConfig }
  | { type: 'stop' }
  | { type: 'channels'; channels: string[] }
  | { type: 'peer'; peerId: string; peerName: string; peerRole: string }
  | { type: 'outbox'; messages: SignalMessage[] };

let cfg: WorkerConfig | null = null;
let outbox: SignalMessage[] = [];
let lastHeartbeat = 0;
let lastPoll = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function tryPost(targetUrl: string, messages: SignalMessage[]): Promise<boolean> {
  if (!cfg) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resolvedUrl =
      targetUrl.startsWith('http://') || targetUrl.startsWith('https://')
        ? targetUrl
        : new URL(targetUrl, self.location.origin).toString();

    const res = await fetch(resolvedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        mode: 'signal',
        signal: messages,
        spreadsheetUrl: cfg.spreadsheetUrl,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

async function postBatch(messages: SignalMessage[]): Promise<boolean> {
  if (!cfg) return false;
  // Always post to local /api/signal server endpoint first for instant real-time WebRTC signaling
  let ok = await tryPost('/api/signal', messages);
  if (!ok && cfg.webhookUrl && cfg.webhookUrl !== '/api/signal' && !cfg.webhookUrl.endsWith('/api/signal')) {
    ok = await tryPost(cfg.webhookUrl, messages);
  }
  return ok;
}

let lastPollTs = 0;
let lastSeq = 0;

async function tryPoll(targetUrl: string): Promise<{ messages: SignalMessage[]; ok: boolean }> {
  if (!cfg) return { messages: [], ok: false };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    let u: URL;
    if (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) {
      u = new URL(targetUrl);
    } else {
      u = new URL(targetUrl, self.location.origin);
    }

    u.searchParams.set('mode', 'signal');
    if (lastSeq > 0) {
      u.searchParams.set('sinceSeq', String(lastSeq));
    }
    u.searchParams.set('since', String(lastPollTs));

    if (cfg.spreadsheetUrl) {
      u.searchParams.set('spreadsheetUrl', cfg.spreadsheetUrl);
      const m = cfg.spreadsheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (m) u.searchParams.set('spreadsheetId', m[1]);
    }

    const res = await fetch(u.toString(), { method: 'GET', signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return { messages: [], ok: false };

    const data = await res.json();
    lastPollTs = Math.max(0, Date.now() - 1500);

    let messages: SignalMessage[] = [];
    if (Array.isArray(data)) {
      messages = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.messages)) {
        messages = data.messages;
      } else if (Array.isArray(data.signal)) {
        messages = data.signal;
      }
      if (typeof data.maxSeq === 'number' && data.maxSeq > 0) {
        lastSeq = data.maxSeq;
      }
    }

    return { messages, ok: true };
  } catch {
    return { messages: [], ok: false };
  }
}

async function poll(): Promise<{ messages: SignalMessage[]; ok: boolean }> {
  if (!cfg) return { messages: [], ok: false };
  // Always query /api/signal first for zero-latency WebRTC P2P handshake
  let result = await tryPoll('/api/signal');
  if ((!result.ok || result.messages.length === 0) && cfg.webhookUrl && cfg.webhookUrl !== '/api/signal' && !cfg.webhookUrl.endsWith('/api/signal')) {
    const fallbackResult = await tryPoll(cfg.webhookUrl);
    if (fallbackResult.ok && fallbackResult.messages.length > 0) {
      result = fallbackResult;
    }
  }
  return result;
}

function buildPresence() {
  if (!cfg) return;
  const now = Date.now();
  cfg.channels.forEach((ch) => {
    outbox.push({
      mid: genId(),
      kind: 'presence',
      sender: cfg!.peerId,
      senderName: cfg!.peerName,
      senderRole: cfg!.peerRole,
      channel: ch,
      ts: now,
    });
  });
}

async function tick() {
  if (!cfg) return;
  const now = Date.now();

  if (now - lastHeartbeat >= cfg.heartbeatMs) {
    lastHeartbeat = now;
    buildPresence();
  }

  let postOk = true;
  if (outbox.length > 0) {
    const batch = outbox.splice(0, 20);
    postOk = await postBatch(batch);
  }

  let pollOk = true;
  if (now - lastPoll >= cfg.pollMs - 300) {
    lastPoll = now;
    const { messages, ok } = await poll();
    pollOk = ok;
    if (messages.length > 0) {
      workerSelf.postMessage({ type: 'polled', messages });
    }
  }

  workerSelf.postMessage({ type: 'relayOnline', ok: postOk && pollOk });
  workerSelf.postMessage({ type: 'tick', now });
  // Mantém o Modo de Mídia vivo em 2º plano: o main thread chama
  // mediaKeepalive.pokeFromWorker() a cada tick recebido.
  workerSelf.postMessage({ type: 'keepalive-ping', now });
}

function start() {
  stop();
  // Send presence + poll on the very first tick instead of waiting a full
  // heartbeat cycle, so peers see this device immediately after the radio
  // is toggled on (fast handshake).
  lastHeartbeat = Date.now() - (cfg ? cfg.heartbeatMs : HEARTBEAT_MS_DEFAULT);
  lastPoll = 0;
  void tick();
  timer = setInterval(() => {
    void tick();
  }, cfg ? cfg.pollMs : POLL_MS_DEFAULT);
}

function stop() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

workerSelf.onmessage = (e: MessageEvent) => {
  const msg = e.data as WorkerInput;
  if (!msg) return;
  switch (msg.type) {
    case 'start':
      cfg = msg.config;
      start();
      break;
    case 'stop':
      stop();
      cfg = null;
      outbox = [];
      break;
    case 'channels':
      if (cfg) cfg.channels = msg.channels;
      break;
    case 'peer':
      if (cfg) {
        cfg.peerId = msg.peerId;
        cfg.peerName = msg.peerName;
        cfg.peerRole = msg.peerRole;
      }
      break;
    case 'outbox':
      if (Array.isArray(msg.messages)) {
        outbox.push(...msg.messages);
      }
      break;
  }
};
