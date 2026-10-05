/**
 * Dimensio Media Keepalive Engine
 *
 * Garante que o aplicativo NÃO seja suspenso em segundo plano no Android / iOS / Chrome / Honeywell.
 *
 * Como funciona:
 * 1. Cria um AudioContext ativo com saída contínua via MediaStreamAudioDestinationNode.
 * 2. Injeta uma microportadora de 32Hz com ganho -60dB (completamente inaudível para o ouvido humano
 *    e fisicamente incapaz de ser reproduzida pelo alto-falante do celular, mas com amplitude estritamente
 *    diferente de zero na camada DSP/HAL do Android AudioFlinger).
 * 3. Alimenta um elemento HTML5 <audio playsinline autoplay> via MediaStream ao vivo (sem looping, sem fim).
 * 4. Conecta à MediaSession API do sistema operacional (Android Media Notification / Lockscreen)
 *    com status 'playing', conferindo ao navegador a prioridade de Foreground Media Service no SO.
 * 5. Gerencia automaticamente eventos de visibilidade, bloqueio de tela e retomada de áudio.
 */

type MediaKeepaliveListener = (active: boolean) => void;

class MediaKeepaliveManager {
  private audioCtx: AudioContext | null = null;
  private destNode: MediaStreamAudioDestinationNode | null = null;
  private oscNode: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private wakeLock: any = null;
  private isRunning: boolean = false;
  private listeners: Set<MediaKeepaliveListener> = new Set();
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null;
  private fallbackBlobUrl: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.setupAutoUnlock();
    }
  }

  /**
   * Monitora gestos do usuário na tela para desbloquear o áudio automaticamente.
   */
    private workerPort: { postMessage: (m: unknown) => void } | null = null;
    private lastPokeMs = 0;

  /**
   * Permite que o signalWorker (Web Worker, menos sujeito a throttling em
   * segundo plano) mantenha o pipeline de mídia vivo: a cada tick do worker
   * o app chama pokeFromWorker(). Sem isso, o setInterval do main thread é
   * estrangulado para 1/min com a tela desligada e o SO suspende o app.
   */
  public attachWorkerPort(port: { postMessage: (m: unknown) => void } | null) {
    this.workerPort = port;
  }

  public pokeFromWorker() {
    this.lastPokeMs = Date.now();
    this.ensurePlaying();
  }

    private setupAutoUnlock() {
    const unlock = () => {
      if (this.isRunning && this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      if (this.isRunning && this.audioEl && this.audioEl.paused) {
        this.audioEl.play().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (this.isRunning) {
        // WakeLock de tela é revogado automaticamente ao ocultar; tenta
        // recuperar imediatamente ao voltar a ficar visível.
        if (!document.hidden) {
          this.requestScreenWakeLock();
        }
        this.ensurePlaying();
      }
    });

    // iOS/Safari: retoma o contexto ao voltar do background.
    window.addEventListener('pageshow', () => {
      if (this.isRunning) this.ensurePlaying();
    });
    window.addEventListener('focus', () => {
      if (this.isRunning) this.ensurePlaying();
    });
  }

  /**
   * Gera um WAV estéreo de 10 segundos com microdither imperceptível
   * para navegadores que não suportam srcObject em elementos de áudio.
   */
  private createFallbackCarrierWav(): string {
    try {
      const sampleRate = 8000;
      const numSamples = sampleRate * 10;
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      const view = new DataView(buffer);

      // Header RIFF/WAVE
      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, 36 + numSamples * 2, true);
      view.setUint32(8, 0x57415645, false); // "WAVE"
      view.setUint32(12, 0x666d7420, false); // "fmt "
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, numSamples * 2, true);

      // Injeta tom de 55Hz com amplitude 48/32767 (~-57dB): inaudível na
      // prática no alto-falante do celular, mas bem acima do limiar de
      // detecção de silêncio do Android AudioFlinger. Amplitudes menores
      // (ex: 12) eram classificadas como silêncio e o SO suspendia o app.
      for (let i = 0; i < numSamples; i++) {
        const sample = Math.sin((2 * Math.PI * 55 * i) / sampleRate) * 48;
        view.setInt16(44 + i * 2, Math.round(sample), true);
      }

      const blob = new Blob([buffer], { type: 'audio/wav' });
      return URL.createObjectURL(blob);
    } catch {
      return '';
    }
  }

  /**
   * Inicializa o elemento de áudio DOM.
   */
  private getOrCreateAudioElement(): HTMLAudioElement {
    if (this.audioEl && document.body.contains(this.audioEl)) {
      return this.audioEl;
    }

    const existing = document.getElementById('dimensio-media-keepalive') as HTMLAudioElement | null;
    if (existing) {
      this.audioEl = existing;
      return existing;
    }

    const el = document.createElement('audio');
    el.id = 'dimensio-media-keepalive';
    el.setAttribute('playsinline', 'true');
    el.setAttribute('autoplay', 'true');
    el.setAttribute('loop', 'true');
    el.setAttribute('aria-hidden', 'true');

    // Estilo que mantém presença no DOM para o navegador não considerar elemento morto
    el.style.position = 'fixed';
    el.style.bottom = '0';
    el.style.right = '0';
    el.style.width = '2px';
    el.style.height = '2px';
    el.style.opacity = '0.01';
    el.style.zIndex = '-9999';
    el.style.pointerEvents = 'none';

    document.body.appendChild(el);
    this.audioEl = el;
    return el;
  }

  /**
   * Configura a MediaSession do sistema operacional (Android Notification / Tela de Bloqueio).
   */
  private setupMediaSession(channelName: string = 'Geral') {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Dimensio Talk — ${channelName}`,
        artist: 'Modo de Mídia • Operação Ativa em Segundo Plano',
        album: 'Dimensio Workforce Management',
        artwork: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      });

      navigator.mediaSession.playbackState = 'playing';

      navigator.mediaSession.setActionHandler('play', () => {
        this.ensurePlaying();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        // Quando o usuário toca pause na notificação do Android:
        // Mantemos o stream vivo para não perder o processo no SO, mas podemos silenciar.
        this.ensurePlaying();
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        this.ensurePlaying();
      });
    } catch (err) {
      console.warn('[MediaKeepalive] Erro ao configurar MediaSession:', err);
    }
  }

  /**
   * Solicita WakeLock de tela quando suportado.
   */
  private async requestScreenWakeLock() {
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        if (!this.wakeLock || this.wakeLock.released) {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      }
    } catch {
      // Ignora restrições de permissão do WakeLock
    }
  }

  /**
   * Inicia o Modo de Mídia Contínuo.
   */
  public async start(channelName: string = 'Geral'): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    this.isRunning = true;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx && AudioCtx) {
        this.audioCtx = new AudioCtx({ latencyHint: 'interactive' });
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const el = this.getOrCreateAudioElement();

      // 1. Tenta usar Web Audio MediaStreamDestination (live stream sem fim)
      if (this.audioCtx && typeof this.audioCtx.createMediaStreamDestination === 'function') {
        if (!this.destNode) {
          this.destNode = this.audioCtx.createMediaStreamDestination();

          // CORREÇÃO CRÍTICA: 55Hz com ganho 0.02 (~-34dB no grafo) +
          // el.volume = 1.0. Antes usávamos 32Hz @ -54dB com volume 0.05,
          // o que o AudioFlinger classificava como silêncio digital e
          // liberava o app para suspensão em ~30-60s de tela desligada.
          // 55Hz está abaixo da resposta útil do micro-alto-falante (portanto
          // inaudível), mas gera energia mensurável no HAL/DSP.
          const osc = this.audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(55, this.audioCtx.currentTime);

          const gain = this.audioCtx.createGain();
          gain.gain.setValueAtTime(0.02, this.audioCtx.currentTime);

          osc.connect(gain);
          gain.connect(this.destNode);
          osc.start();

          this.oscNode = osc;
          this.gainNode = gain;
        }

        if (this.destNode.stream) {
          try {
            el.srcObject = this.destNode.stream;
          } catch {
            // fallback para src se srcObject falhar
          }
        }
      }

      // 2. Se srcObject não foi atribuído ou falhou, usa o WAV carrier blob
      if (!el.srcObject && !el.src) {
        if (!this.fallbackBlobUrl) {
          this.fallbackBlobUrl = this.createFallbackCarrierWav();
        }
        el.src = this.fallbackBlobUrl;
      }

      // NUNCA usar volume baixo aqui: o Android marca streams com
      // volume < ~0.2 como "silent" e remove a prioridade de foreground.
      // O silêncio percebido vem do ganho baixo dentro do grafo, não do volume.
      el.volume = 1.0;
      el.muted = false;
      // @ts-ignore - preserva pitch em alguns WebViews Honeywell/Zebra
      if ('preservesPitch' in el) (el as any).preservesPitch = false;

      await el.play();

      this.setupMediaSession(channelName);
      this.requestScreenWakeLock();

      // Inicia verificação periódica de saúde da mídia. 10s em vez de 3s:
      // o intervalo do main thread é estrangulado em background; o heartbeat
      // real em 2º plano vem do signalWorker via pokeFromWorker().
      if (!this.keepaliveInterval) {
        this.keepaliveInterval = setInterval(() => {
          this.ensurePlaying();
        }, 10000);
      }

      this.notifyListeners(true);
      return true;
    } catch (err) {
      console.warn('[MediaKeepalive] Inicialização adiada até próximo toque do usuário:', err);
      this.notifyListeners(false);
      return false;
    }
  }

  /**
   * Garante que o stream de áudio esteja rodando.
   */
  public ensurePlaying() {
    if (!this.isRunning) return;

    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    // Se o oscilador morreu (GC do contexto), recria sob demanda.
    if (this.isRunning && this.audioCtx && !this.oscNode) {
      try {
        this.destNode = this.audioCtx.createMediaStreamDestination();
        const osc = this.audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, this.audioCtx.currentTime);
        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.02, this.audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(this.destNode);
        osc.start();
        this.oscNode = osc;
        this.gainNode = gain;
        if (this.audioEl && this.destNode.stream) {
          try {
            this.audioEl.srcObject = this.destNode.stream;
          } catch {}
        }
      } catch {}
    }

    if (this.audioEl && (this.audioEl.paused || this.audioEl.ended)) {
      this.audioEl.volume = 1.0;
      this.audioEl.muted = false;
      this.audioEl.play().catch(() => {});
    }

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'playing';
      } catch {}
    }

    this.requestScreenWakeLock();
  }

  public getDiagnostics() {
    return {
      running: this.isRunning,
      ctxState: this.audioCtx ? this.audioCtx.state : 'none',
      elPaused: this.audioEl ? this.audioEl.paused : null,
      elVolume: this.audioEl ? this.audioEl.volume : null,
      hasStream: Boolean(this.destNode?.stream),
      lastWorkerPokeMs: this.lastPokeMs,
    };
  }

  /**
   * Interrompe o Modo de Mídia.
   */
  public stop() {
    this.isRunning = false;

    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }

    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.srcObject = null;
        this.audioEl.removeAttribute('src');
        this.audioEl.load();
      } catch {}
    }
    if (this.fallbackBlobUrl) {
      try {
        URL.revokeObjectURL(this.fallbackBlobUrl);
      } catch {}
      this.fallbackBlobUrl = null;
    }

    if (this.oscNode) {
      try {
        this.oscNode.stop();
        this.oscNode.disconnect();
      } catch {}
      this.oscNode = null;
    }

    if (this.destNode) {
      try {
        this.destNode.disconnect();
      } catch {}
      this.destNode = null;
    }

    if (this.wakeLock) {
      try {
        this.wakeLock.release().catch(() => {});
      } catch {}
      this.wakeLock = null;
    }

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
      } catch {}
    }

    this.notifyListeners(false);
  }

  public isActive(): boolean {
    return this.isRunning && (this.audioEl ? !this.audioEl.paused : false);
  }

  public updateChannelName(channelName: string) {
    if (this.isRunning) {
      this.setupMediaSession(channelName);
    }
  }

  /**
   * Toca um teste sonoro claro de 2 tons para confirmação humana imediata
   * de que o hardware de áudio está ativo e respondendo.
   */
  public playTestChime(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = this.audioCtx || new AudioCtx();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;
        const notes = [
          { freq: 523.25, time: 0, dur: 0.15 }, // C5
          { freq: 659.25, time: 0.12, dur: 0.25 }, // E5
        ];

        notes.forEach(({ freq, time, dur }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + time);
          gain.gain.setValueAtTime(0.4, now + time);
          gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + time);
          osc.stop(now + time + dur);
        });

        setTimeout(resolve, 400);
      } catch {
        resolve();
      }
    });
  }

  public subscribe(listener: MediaKeepaliveListener): () => void {
    this.listeners.add(listener);
    listener(this.isActive());
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(active: boolean) {
    this.listeners.forEach((fn) => {
      try {
        fn(active);
      } catch {}
    });
  }
}

export const mediaKeepalive = new MediaKeepaliveManager();
