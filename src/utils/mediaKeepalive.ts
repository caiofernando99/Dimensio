/**
 * Dimensio Media Keepalive Engine
 *
 * Garante que a comunicação e o áudio NÃO sejam suspensos em segundo plano no Android / iOS / Chrome / Coletores.
 *
 * Arquitetura para Android:
 * 1. Utiliza um elemento HTML5 <audio loop playsinline> com um Blob WAV PCM de 55Hz contínuo (-40dB).
 *    Diferente de AudioContext puro (que o Android suspende ao apagar a tela), elementos <audio>
 *    com um arquivo de mídia real acionam o MediaPlayer nativo do Android e o Foreground Service de Mídia.
 * 2. Conecta à MediaSession API do SO (Android Media Notification / Tela de Bloqueio) com status 'playing',
 *    garantindo que o sistema operacional não mate o processo do navegador quando a tela apagar.
 * 3. el.play() é disparado de forma estritamente SÍNCRONA no frame de ativação do usuário,
 *    evitando a rejeição da Autoplay Policy do Android Chrome (NotAllowedError).
 * 4. Integrado ao signalWorker (Web Worker) que envia keepalive-ping periódico mesmo com throttling do main thread.
 */

type MediaKeepaliveListener = (active: boolean) => void;

class MediaKeepaliveManager {
  private audioCtx: AudioContext | null = null;
  private oscNode: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private wakeLock: any = null;
  private isRunning: boolean = false;
  private listeners: Set<MediaKeepaliveListener> = new Set();
  private keepaliveInterval: ReturnType<typeof setInterval> | null = null;
  private fallbackBlobUrl: string | null = null;
  private currentChannelName: string = 'Geral';
  private workerPort: { postMessage: (m: unknown) => void } | null = null;
  private lastPokeMs = 0;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.fallbackBlobUrl = this.createFallbackCarrierWav();
      } catch {}
      this.setupAutoUnlock();
    }
  }

  /**
   * Monitora gestos do usuário na tela para desbloquear o áudio automaticamente.
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
      if (this.isRunning) {
        this.ensurePlaying();
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (this.isRunning) {
        if (!document.hidden) {
          this.requestScreenWakeLock();
        }
        this.ensurePlaying();
      }
    });

    window.addEventListener('pageshow', () => {
      if (this.isRunning) this.ensurePlaying();
    });
    window.addEventListener('focus', () => {
      if (this.isRunning) this.ensurePlaying();
    });
  }

  /**
   * Gera um WAV mono de 8 segundos com onda senoidal pura de 55Hz (-40dB).
   * 55Hz é inaudível no micro-alto-falante do celular, mas gera amplitude mensurável
   * no DSP/HAL do Android AudioFlinger, prevenindo o modo de suspensão de bateria.
   */
  private createFallbackCarrierWav(): string {
    try {
      const sampleRate = 16000;
      const durationSec = 6;
      const numSamples = sampleRate * durationSec;
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
      view.setUint32(28, sampleRate * 2, true); // byteRate
      view.setUint16(32, 2, true); // blockAlign
      view.setUint16(34, 16, true); // 16 bits per sample
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, numSamples * 2, true);

      // Tom de 55Hz com amplitude de 120/32767 (~-48dB).
      for (let i = 0; i < numSamples; i++) {
        const sample = Math.sin((2 * Math.PI * 55 * i) / sampleRate) * 120;
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
    (el as any).playsInline = true;
    el.setAttribute('playsinline', 'true');
    el.setAttribute('webkit-playsinline', 'true');
    el.setAttribute('autoplay', 'true');
    el.setAttribute('loop', 'true');
    el.setAttribute('aria-hidden', 'true');
    el.loop = true;
    el.volume = 1.0;
    el.muted = false;

    // Dimensões visíveis mínimas (10x10px) para que o motor Chromium do Android
    // não considere o elemento como rastreador oculto de 0px
    el.style.cssText = 'position:fixed;bottom:2px;right:2px;width:10px;height:10px;opacity:0.02;pointer-events:none;z-index:-1;';

    document.body.appendChild(el);
    this.audioEl = el;
    return el;
  }

  /**
   * Configura a MediaSession do sistema operacional (Android Notification / Tela de Bloqueio).
   */
  private setupMediaSession(channelName: string = 'Geral') {
    this.currentChannelName = channelName;
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `Dimensio Talk — ${channelName}`,
        artist: 'Modo de Mídia • Ativo em Segundo Plano',
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
        // No Android, se o usuário tocar em pause na barra de notificação,
        // garantimos que o áudio continue tocando para não perder o processo
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
      // Ignora restrições do navegador
    }
  }

  /**
   * Inicia o Modo de Mídia Contínuo.
   * CRÍTICO PARA ANDROID: el.play() é executado imediatamente e de forma síncrona,
   * sem nenhum await prévio, preservando o token de ativação por toque do usuário.
   */
  public async start(channelName: string = 'Geral'): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    this.isRunning = true;
    this.currentChannelName = channelName;

    try {
      const el = this.getOrCreateAudioElement();
      if (!this.fallbackBlobUrl) {
        this.fallbackBlobUrl = this.createFallbackCarrierWav();
      }

      if (!el.src || el.src !== this.fallbackBlobUrl) {
        el.src = this.fallbackBlobUrl;
      }

      el.loop = true;
      el.volume = 1.0;
      el.muted = false;
      (el as any).playsInline = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');

      // DISPARO SÍNCRONO NO FRAME DO TOQUE DO USUÁRIO
      const playPromise = el.play();

      // Configura MediaSession e WakeLock paralelamente
      this.setupMediaSession(channelName);
      this.requestScreenWakeLock();

      // Inicializa WebAudio em paralelo com oscilador inaudível mantendo o áudio HAL ativo
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!this.audioCtx && AudioCtx) {
          this.audioCtx = new AudioCtx({ latencyHint: 'interactive' });
        }
        if (this.audioCtx) {
          if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume().catch(() => {});
          }
          if (!this.oscNode) {
            const osc = this.audioCtx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(55, this.audioCtx.currentTime);
            const gain = this.audioCtx.createGain();
            gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            osc.start();
            this.oscNode = osc;
            this.gainNode = gain;
          }
        }
      } catch {}

      // Intervalo de verificação de integridade da mídia
      if (!this.keepaliveInterval) {
        this.keepaliveInterval = setInterval(() => {
          this.ensurePlaying();
        }, 8000);
      }

      if (playPromise !== undefined) {
        await playPromise;
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

    const el = this.audioEl || this.getOrCreateAudioElement();
    if (el && (el.paused || el.ended)) {
      if (!el.src && this.fallbackBlobUrl) {
        el.src = this.fallbackBlobUrl;
      }
      el.volume = 1.0;
      el.muted = false;
      el.play().then(() => {
        this.notifyListeners(true);
      }).catch(() => {});
    }

    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      if (!this.oscNode) {
        try {
          const osc = this.audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(55, this.audioCtx.currentTime);
          const gain = this.audioCtx.createGain();
          gain.gain.setValueAtTime(0.001, this.audioCtx.currentTime);
          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start();
          this.oscNode = osc;
          this.gainNode = gain;
        } catch {}
      }
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
      channel: this.currentChannelName,
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
        this.audioEl.removeAttribute('src');
        this.audioEl.load();
      } catch {}
    }

    if (this.oscNode) {
      try {
        this.oscNode.stop();
        this.oscNode.disconnect();
      } catch {}
      this.oscNode = null;
    }

    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {}
      this.gainNode = null;
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.suspend().catch(() => {});
      } catch {}
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
