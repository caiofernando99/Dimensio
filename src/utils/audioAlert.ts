// Web Audio API notification sound generator (no external audio files required)

export type NotificationSoundType = 'default' | 'request' | 'order' | 'notice' | 'system' | 'break' | 'urgent';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

// Auto-unlock audio context on user interaction
if (typeof window !== 'undefined') {
  const handleUserGesture = () => {
    unlockAudioContext();
  };
  window.addEventListener('pointerdown', handleUserGesture, { passive: true, once: true });
  window.addEventListener('touchstart', handleUserGesture, { passive: true, once: true });
  window.addEventListener('keydown', handleUserGesture, { passive: true, once: true });
}

export function triggerDeviceVibration(pattern: number | number[] = [200, 100, 200, 100, 300]) {
  try {
    if (typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore if vibration is not supported
  }
}

/**
 * Toca sons diferenciados de acordo com o tipo de notificação:
 * - 'request' / 'order': Toque melódico cristalino de 4 notas ascendentes (F5 -> A5 -> C6 -> E6), muito perceptível para pedidos/chamados.
 * - 'notice' / 'default' / 'system': Toque suave e agradável de 2 notas (C5 -> E5).
 * - 'break': Sinal de intervalo suave em 3 notas (E5 -> G5 -> C6).
 * - 'urgent': Alerta duplo com pulso enérgico.
 */
export function playNotificationSound(type: NotificationSoundType = 'default') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === 'request' || type === 'order') {
      // Vibrate pattern for requests (distinctive quick burst)
      triggerDeviceVibration([150, 80, 150, 80, 250]);

      // 4-tone energetic crystal chime arpeggio: F5 (698.46 Hz) -> A5 (880.00 Hz) -> C6 (1046.50 Hz) -> E6 (1318.51 Hz)
      const notes = [
        { freq: 698.46, time: 0, dur: 0.22, vol: 0.55 },
        { freq: 880.00, time: 0.09, dur: 0.24, vol: 0.65 },
        { freq: 1046.50, time: 0.18, dur: 0.28, vol: 0.75 },
        { freq: 1318.51, time: 0.28, dur: 0.45, vol: 0.85 },
      ];

      notes.forEach(({ freq, time, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle'; // triangle gives a warm, crystal bell tone
        osc.frequency.setValueAtTime(freq, now + time);
        gain.gain.setValueAtTime(vol, now + time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + time);
        osc.stop(now + time + dur);
      });
    } else if (type === 'break') {
      // Vibrate pattern for break notification
      triggerDeviceVibration([200, 100, 200]);

      // 3-tone gentle bell: E5 (659.25 Hz) -> G5 (783.99 Hz) -> C6 (1046.50 Hz)
      const notes = [
        { freq: 659.25, time: 0, dur: 0.35, vol: 0.6 },
        { freq: 783.99, time: 0.14, dur: 0.40, vol: 0.65 },
        { freq: 1046.50, time: 0.28, dur: 0.60, vol: 0.7 },
      ];

      notes.forEach(({ freq, time, dur, vol }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + time);
        gain.gain.setValueAtTime(vol, now + time);
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + time);
        osc.stop(now + time + dur);
      });
    } else if (type === 'urgent') {
      // Urgent double high pulse
      triggerDeviceVibration([300, 100, 300]);

      [0, 0.18].forEach((timeOffset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(987.77, now + timeOffset); // B5
        gain.gain.setValueAtTime(0.5, now + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.15);
      });
    } else {
      // Default / notice 2-tone pleasant sine chime
      triggerDeviceVibration([200, 100, 200]);

      // Tone 1: C5 (523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.65, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2: E5 (659.25 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.12);
      gain2.gain.setValueAtTime(0.75, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.50);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.50);
    }
  } catch {
    // Ignore audio autoplay policy restrictions
  }
}

export const playRequestSound = () => playNotificationSound('request');
export const playNoticeSound = () => playNotificationSound('notice');
export const playBreakSound = () => playNotificationSound('break');
export const playUrgentSound = () => playNotificationSound('urgent');

let radioSfxEnabledGlobal = false;
let radioSfxVolumeGlobal = 0.2;

export function setRadioSfxConfig(config: { enabled?: boolean; volume?: number }) {
  if (config.enabled !== undefined) {
    radioSfxEnabledGlobal = config.enabled;
    try {
      localStorage.setItem('dimensio_radio_sfx_enabled', JSON.stringify(config.enabled));
    } catch {}
  }
  if (config.volume !== undefined) {
    radioSfxVolumeGlobal = Math.max(0, Math.min(1, config.volume));
    try {
      localStorage.setItem('dimensio_radio_sfx_volume', JSON.stringify(radioSfxVolumeGlobal));
    } catch {}
  }
}

export function getRadioSfxConfig(): { enabled: boolean; volume: number } {
  try {
    const savedEnabled = localStorage.getItem('dimensio_radio_sfx_enabled');
    if (savedEnabled !== null) {
      radioSfxEnabledGlobal = JSON.parse(savedEnabled);
    }
    const savedVol = localStorage.getItem('dimensio_radio_sfx_volume');
    if (savedVol !== null) {
      radioSfxVolumeGlobal = JSON.parse(savedVol);
    }
  } catch {}
  return { enabled: radioSfxEnabledGlobal, volume: radioSfxVolumeGlobal };
}

// Initialize config from storage
if (typeof window !== 'undefined') {
  getRadioSfxConfig();
}

/**
 * Sons táteis de Rádio PTT:
 * - 'start': Micro-tom suave de início (apenas se SFX estiver ativado)
 * - 'stop': Roger Beep suave de encerramento (apenas se SFX estiver ativado)
 * - 'incoming': Micro-clique inaudível/suave de voz recebida (apenas se SFX estiver ativado)
 */
export function playRadioPttChirp(type: 'start' | 'stop' | 'incoming') {
  if (!radioSfxEnabledGlobal) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const vol = radioSfxVolumeGlobal;

    if (type === 'start') {
      // Suave tom ascendente discreto (600Hz -> 900Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.05);
      gain.gain.setValueAtTime(vol * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'stop') {
      // Roger Beep suave e discreto (800Hz -> 600Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.setValueAtTime(650, now + 0.03);
      gain.gain.setValueAtTime(vol * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (type === 'incoming') {
      // Micro-clique suave
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(700, now);
      gain.gain.setValueAtTime(vol * 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    }
  } catch {
    // Ignore audio restrictions
  }
}



