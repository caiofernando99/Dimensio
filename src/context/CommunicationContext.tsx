import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useApp } from './AppContext';
import type { CommChannel, CommPeerInfo, RemotePeerState, SignalMessage, AudioMode } from '../communication/types';
import type { Task } from '../types';
import { generateId } from '../utils/helpers';
import { playRadioPttChirp, setRadioSfxConfig, getRadioSfxConfig } from '../utils/audioAlert';
import { showNativeOSNotification } from '../utils/notifications';
import { loadRadioStateDB, saveRadioStateDB } from '../utils/radioStoreDB';
import { triggerRadioBackgroundSync } from '../registerSW';
import { mediaKeepalive } from '../utils/mediaKeepalive';
import {
  clearFirestoreQuotaExceeded,
  sendFirestoreRadioSignals,
  subscribeToFirestoreRadioSignals,
  updateRadioCloudPresence,
  removeRadioCloudPresence,
  subscribeToRadioCloudPresence,
} from '../lib/firestoreStorage';

export interface CommContextType {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  volume: number;
  setVolume: (vol: number) => void;
  sfxEnabled: boolean;
  setSfxEnabled: (val: boolean) => void;
  wakeLockActive: boolean;
  relayOnline: boolean;
  identified: boolean;
  channels: CommChannel[];
  subscribedChannels: string[];
  activeChannel: string | null;
  setActiveChannel: (id: string | null) => void;
  toggleChannel: (id: string) => void;
  channelPeers: Record<string, CommPeerInfo[]>;
  remotePeers: Record<string, RemotePeerState[]>;
  mode: AudioMode;
  setMode: (m: AudioMode) => void;
  speaking: boolean;
  remoteTransmitting: boolean;
  activeSpeakerName: string | null;
  startSpeaking: () => void;
  stopSpeaking: () => void;
  transmissionLocked: boolean;
  setTransmissionLocked: (locked: boolean) => void;
  pttKey: string;
  setPttKey: (key: string) => void;
  muted: boolean;
  setMuted: (m: boolean) => void;
  micAvailable: boolean;
  audioBlocked: boolean;
  micLevel: number;
  resumeAllAudio: () => void;
  requestWakeLock: () => void;
  releaseWakeLock: () => void;
  testLoopback: () => void;
  isTestingLoopback: boolean;
  onlineCollabIds: Set<string>;
  directChannels: CommChannel[];
  joinTaskChannel: (taskId: string) => void;
  openDirectChannel: (collabId: string, name: string) => void;
  closeDirectChannel: (collabId: string) => void;
  leaveAll: () => void;
  audioOutputDevices: MediaDeviceInfo[];
  audioOutputDeviceId: string;
  isLoudspeaker: boolean;
  setAudioOutputDevice: (deviceId: string) => Promise<boolean>;
  toggleLoudspeaker: () => Promise<boolean>;
  refreshAudioOutputDevices: () => Promise<void>;
  myAssignedTasks: Task[];
  myCurrentTask: Task | null;
  forceReconnect: () => void;
  getDiagnostics: () => any;
}

const CommContext = createContext<CommContextType | undefined>(undefined);

const DEFAULT_RTC_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.services.mozilla.com' },
];

function buildRtcConfig(customTurn: string | undefined): RTCConfiguration {
  const iceServers: RTCIceServer[] = [...DEFAULT_RTC_SERVERS];
  if (customTurn) {
    customTurn
      .split(/\s*[,;\n]\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((raw) => {
        try {
          const at = raw.indexOf('@');
          if (at > 0) {
            const credentialPart = raw.slice(0, at);
            const url = raw.slice(at + 1);
            const ci = credentialPart.indexOf(':');
            if (ci > 0) {
              iceServers.push({
                urls: url,
                username: credentialPart.slice(0, ci),
                credential: credentialPart.slice(ci + 1),
              });
            } else {
              iceServers.push({ urls: url, username: credentialPart, credential: '' });
            }
          } else {
            iceServers.push({ urls: raw });
          }
        } catch {}
      });
  }
  return { iceServers, iceCandidatePoolSize: 10 };
}

const POLL_MS = 2500;
const HEARTBEAT_MS = 8000;
const PEER_TTL_MS = 55000; // 55s TTL para suportar segundo plano móvel sem desconectar
const SEEN_PRUNE = 4000;
const RETRY_INTERVAL_MS = 4000;
const VOICE_THRESHOLD = 0.015;
const VOICE_HOLD_MS = 4000;
const VOICE_POLL_MS = 250;

interface ConnEntry {
  pc: RTCPeerConnection;
  remoteId: string;
  channelId: string;
  status: 'connecting' | 'connected' | 'disconnected';
  pending: boolean;
  lastOffer?: number;
  polite: boolean;
  makingOffer?: boolean;
  isSettingRemoteAnswer?: boolean;
  pendingCandidates?: RTCIceCandidateInit[];
}

function createSilentWavBlobUrl(): string {
  if (typeof window === 'undefined') return '';
  try {
    const sampleRate = 16000;
    const numSamples = sampleRate * 3; // 3 seconds loop
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);
    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + numSamples * 2, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM format (1)
    view.setUint16(22, 1, true); // Mono (1)
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byteRate = sampleRate * channels * 2
    view.setUint16(32, 2, true); // blockAlign
    view.setUint16(34, 16, true); // 16 bits per sample
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, numSamples * 2, true);

    // 16-bit PCM: Fill with 24Hz sub-audible sine carrier with amplitude 3 out of 32767.
    // Inaudible to human ear on phones, but active to Android Audio HAL preventing power down.
    const i16 = new Int16Array(buffer, 44);
    for (let i = 0; i < numSamples; i++) {
      i16[i] = Math.round(Math.sin((2 * Math.PI * 24 * i) / sampleRate) * 3);
    }
    const blob = new Blob([buffer], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch {
    return 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  }
}

export const CommunicationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { state, identifiedUser, showNotice } = useApp();

  // Limpa travas residuais de cota do Firestore no carregamento
  useEffect(() => {
    clearFirestoreQuotaExceeded();
  }, []);

  const webhookUrl = state.onlineSpreadsheet?.webhookUrl?.trim() || '/api/signal';
  const [enabled, setEnabledState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dimensio_radio_enabled');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return true;
  });

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('dimensio_radio_volume');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return 1.0;
  });

  const [sfxEnabled, setSfxEnabledState] = useState<boolean>(() => {
    return getRadioSfxConfig().enabled;
  });

  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const volumeRef = useRef<number>(volume);
  volumeRef.current = volume;

  const [relayOnline, setRelayOnline] = useState(false);
  const [subscribedChannels, setSubscribedChannels] = useState<string[]>([]);
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [peersMap, setPeersMap] = useState<Record<string, CommPeerInfo[]>>({});
  const [remotePeersMap, setRemotePeersMap] = useState<Record<string, RemotePeerState[]>>({});
  const [directChannels, setDirectChannels] = useState<Record<string, CommChannel>>({});
  const [remoteTransmitting, setRemoteTransmitting] = useState(false);
  const [activeSpeakerName, setActiveSpeakerName] = useState<string | null>(null);
  const [mode, setMode] = useState<AudioMode>('ptt');
  const [speaking, setSpeaking] = useState(false);
  const [transmissionLocked, setTransmissionLockedState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dimensio_radio_transmission_lock');
      if (saved !== null) return JSON.parse(saved);
    } catch {}
    return false;
  });
  const [muted, setMuted] = useState(false);
  const [pttKey, setPttKeyState] = useState<string>(() => {
    try {
      return localStorage.getItem('dimensio_radio_ptt_key') || 'Space';
    } catch {
      return 'Space';
    }
  });
  const [micAvailable, setMicAvailable] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [isTestingLoopback, setIsTestingLoopback] = useState(false);

  // Audio output device & loudspeaker (viva-voz) selection
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDeviceId, setAudioOutputDeviceIdState] = useState<string>(() => {
    try {
      return localStorage.getItem('dimensio_audio_output_id') || 'default';
    } catch {
      return 'default';
    }
  });
  const [isLoudspeaker, setIsLoudspeaker] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dimensio_audio_loudspeaker') !== 'false';
    } catch {
      return true;
    }
  });
  const audioOutputDeviceIdRef = useRef(audioOutputDeviceId);
  const isLoudspeakerRef = useRef(isLoudspeaker);

  const instanceIdRef = useRef<string>((() => {
    try {
      const existing = typeof localStorage !== 'undefined'
        ? localStorage.getItem('dimensio_radio_instance_id')
        : typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem('dimensio_radio_instance_id')
        : null;
      if (existing) return existing;
      const created = Math.random().toString(36).substring(2, 8);
      if (typeof localStorage !== 'undefined') localStorage.setItem('dimensio_radio_instance_id', created);
      return created;
    } catch {
      return Math.random().toString(36).substring(2, 8);
    }
  })());

  // Resolves operator identity either from identifiedUser or Portal localStorage
  const resolveCurrentIdentity = useCallback(() => {
    if (identifiedUser && identifiedUser.id && identifiedUser.id !== 'unauthenticated') {
      return {
        id: String(identifiedUser.collaboratorId || identifiedUser.id),
        name: identifiedUser.name || 'Operador em Turno',
        role: identifiedUser.role || 'Operativo',
      };
    }
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dimensio_portal_operator_id');
        if (saved) {
          let opId = saved;
          if (saved.startsWith('{')) {
            const parsed = JSON.parse(saved);
            opId = parsed?.id || '';
          }
          if (opId) {
            const found = state.collaborators.find(
              (c) => c.id === opId || c.login === opId || c.registration === opId
            );
            if (found) {
              return {
                id: String(found.id),
                name: found.name || 'Operador em Turno',
                role: found.role || 'Operativo',
              };
            }
            return {
              id: String(opId),
              name: `Operador #${opId}`,
              role: 'Operativo',
            };
          }
        }
      } catch {}
    }
    return {
      id: `anon_${instanceIdRef.current}`,
      name: 'Operador Visitante',
      role: 'Convidado',
    };
  }, [identifiedUser, state.collaborators]);

  const initialIdentity = resolveCurrentIdentity();
  const peerIdRef = useRef<string>(`${initialIdentity.id}#${instanceIdRef.current}`);
  const peerNameRef = useRef<string>(initialIdentity.name);
  const peerRoleRef = useRef<string>(initialIdentity.role);

  // Keep identity refs synchronized synchronously
  const currentIdentity = resolveCurrentIdentity();
  peerIdRef.current = `${currentIdentity.id}#${instanceIdRef.current}`;
  peerNameRef.current = currentIdentity.name;
  peerRoleRef.current = currentIdentity.role;

  const subscribedRef = useRef<string[]>([]);
  const connectionsRef = useRef<Map<string, ConnEntry>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const micStreamRef = useRef<MediaStream | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const activeChannelRef = useRef<string | null>(null);
  const seenMidsRef = useRef<Set<string>>(new Set());
  const peersMapRef = useRef<Record<string, CommPeerInfo[]>>({});
  const workerRef = useRef<Worker | null>(null);
  const pendingOutboxRef = useRef<SignalMessage[]>([]);
  const loopbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const remoteTransmittingRef = useRef(false);
  const remoteMonitorRef = useRef<{
    ctx: AudioContext;
    analyser: AnalyserNode;
    sources: MediaStreamAudioSourceNode[];
    interval: number | null;
    lastVoiceAt: number;
  } | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const relayWarnedRef = useRef(false);
  const sendSignalsRef = useRef<(msgs: SignalMessage[]) => void>(() => {});

  // Dismissed Direct Channels Map with close timestamps
  const DISMISSED_DIRECT_KEY = 'dimensio_radio_dismissed_direct_v2';
  const dismissedDirectRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_DIRECT_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          dismissedDirectRef.current = new Map(Object.entries(obj).map(([k, v]) => [k, Number(v)]));
        }
      }
    } catch {}
  }, []);
  const persistDismissedDirect = () => {
    try {
      const obj = Object.fromEntries(dismissedDirectRef.current.entries());
      localStorage.setItem(DISMISSED_DIRECT_KEY, JSON.stringify(obj));
    } catch {}
  };

  const enabledRef = useRef<boolean>(enabled);
  enabledRef.current = enabled;

  // Background Live Broadcast Engine refs
  const liveAudioElRef = useRef<HTMLAudioElement | null>(null);
  const liveStreamCtxRef = useRef<AudioContext | null>(null);
  const liveStreamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const liveStreamSourceRef = useRef<OscillatorNode | null>(null);
  const keepaliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silentWavBlobUrlRef = useRef<string | null>(null);

  const modeRef = useRef<AudioMode>(mode);
  const mutedRef = useRef<boolean>(muted);
  const speakingRef = useRef<boolean>(speaking);
  const transmissionLockedRef = useRef<boolean>(transmissionLocked);
  const pttKeyRef = useRef<string>(pttKey);
  modeRef.current = mode;
  mutedRef.current = muted;
  speakingRef.current = speaking;
  transmissionLockedRef.current = transmissionLocked;
  pttKeyRef.current = pttKey;

  peersMapRef.current = peersMap;

  const turnServersRef = useRef<string | undefined>(state.onlineSpreadsheet?.turnServers);
  turnServersRef.current = state.onlineSpreadsheet?.turnServers;

  // Screen Wake Lock API
  const requestWakeLock = useCallback(async () => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
      setWakeLockActive(false);
      return;
    }
    try {
      if (wakeLockRef.current) return;
      const lock = await navigator.wakeLock.request('screen');
      wakeLockRef.current = lock;
      setWakeLockActive(true);

      lock.addEventListener('release', () => {
        wakeLockRef.current = null;
        setWakeLockActive(false);
      });
    } catch (err) {
      setWakeLockActive(false);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
      setWakeLockActive(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        if (!wakeLockRef.current) requestWakeLock();
        resumeAllAudio();
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        if (peerIdRef.current) {
          updateRadioCloudPresence(
            peerIdRef.current,
            peerNameRef.current,
            peerRoleRef.current,
            subscribedRef.current
          );
        }
        retryConnections(Date.now());
      }
    };

    const handleOnline = () => {
      if (enabled) {
        resumeAllAudio();
        retryConnections(Date.now());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      releaseWakeLock();
    };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  const setVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    volumeRef.current = clamped;
    audioElsRef.current.forEach((el) => {
      el.volume = clamped;
    });
    saveRadioStateDB({ volume: clamped });
  }, []);

  const setSfxEnabled = useCallback((val: boolean) => {
    setSfxEnabledState(val);
    setRadioSfxConfig({ enabled: val });
    saveRadioStateDB({ sfxEnabled: val });
  }, []);

  // Initial load from IndexedDB
  useEffect(() => {
    loadRadioStateDB().then((persisted) => {
      if (persisted) {
        if (persisted.enabled !== undefined) setEnabledState(persisted.enabled);
        if (persisted.volume !== undefined) {
          setVolumeState(persisted.volume);
          volumeRef.current = persisted.volume;
        }
        if (persisted.sfxEnabled !== undefined) {
          setSfxEnabledState(persisted.sfxEnabled);
          setRadioSfxConfig({ enabled: persisted.sfxEnabled });
        }
        if (persisted.mode !== undefined) setMode(persisted.mode);
        if (persisted.muted !== undefined) setMuted(persisted.muted);
        if (persisted.activeChannel !== undefined && persisted.activeChannel !== null) {
          setActiveChannel(persisted.activeChannel);
        }
        if (persisted.subscribedChannels?.length) setSubscribedChannels(persisted.subscribedChannels);
      }
    });
  }, []);

  // Persist state updates
  useEffect(() => {
    saveRadioStateDB({
      enabled,
      volume,
      sfxEnabled,
      mode,
      muted,
      activeChannel,
      subscribedChannels,
    });
    triggerRadioBackgroundSync('radio-state-sync');
  }, [enabled, volume, sfxEnabled, mode, muted, activeChannel, subscribedChannels]);

  const channels = useMemo<CommChannel[]>(() => {
    const base: CommChannel[] = [{ id: 'geral', label: 'Geral', kind: 'geral' }];

    const sectors = state.registeredSectors && state.registeredSectors.length > 0
      ? state.registeredSectors
      : (state.sector ? [state.sector] : []);
    sectors.forEach((sec) => {
      const cleanSec = sec.trim();
      if (!cleanSec) return;
      const secId = `sector:${cleanSec.toLowerCase().replace(/\s+/g, '_')}`;
      if (!base.some((c) => c.id === secId)) {
        base.push({ id: secId, label: `Setor: ${cleanSec}`, kind: 'geral' });
      }
    });

    state.tasks.forEach((t) => {
      base.push({ id: `task:${t.id}`, label: t.name, kind: 'task', taskId: t.id });
    });
    Object.values<CommChannel>(directChannels).forEach((dc) => {
      if (!base.some((c) => c.id === dc.id)) base.push(dc);
    });
    return base;
  }, [state.tasks, state.registeredSectors, state.sector, directChannels]);

  const onlineCollabIds = useMemo(() => {
    const set = new Set<string>();
    Object.values<CommPeerInfo[]>(peersMap).forEach((list) => {
      list.forEach((p) => {
        const base = String(p.id).split('#')[0];
        if (base) set.add(base);
      });
    });
    return set;
  }, [peersMap]);

  useEffect(() => {
    const res = resolveCurrentIdentity();
    const newPeerId = `${res.id}#${instanceIdRef.current}`;
    peerIdRef.current = newPeerId;
    peerNameRef.current = res.name;
    peerRoleRef.current = res.role;

    if (enabledRef.current) {
      updateRadioCloudPresence(
        newPeerId,
        res.name,
        res.role,
        subscribedRef.current
      );
      if (bcRef.current) {
        try {
          bcRef.current.postMessage({
            mid: generateId(),
            kind: 'presence',
            sender: newPeerId,
            senderName: res.name,
            senderRole: res.role,
            channel: activeChannelRef.current || 'geral',
            ts: Date.now(),
          });
        } catch {}
      }
      if (workerRef.current) {
        try {
          workerRef.current.postMessage({
            type: 'peer',
            peerId: newPeerId,
            peerName: res.name,
            peerRole: res.role,
          });
        } catch {}
      }
    }
  }, [resolveCurrentIdentity]);

  // Auto-atribuição dinâmica ao canal da(s) tarefa(s) atribuída(s)
  const myAssignedTasks = useMemo(() => {
    const identity = resolveCurrentIdentity();
    const collabId = identity.id && !identity.id.startsWith('anon_') ? identity.id : '';
    if (!collabId) return [];
    return state.tasks.filter((t) => t.active !== false && t.members.includes(collabId));
  }, [resolveCurrentIdentity, state.tasks]);

  const myCurrentTask = myAssignedTasks.length > 0 ? myAssignedTasks[0] : null;
  const prevMyTaskIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const taskChannelIds = myAssignedTasks.map((t) => `task:${t.id}`);
    const desired = Array.from(new Set(['geral', ...taskChannelIds]));

    // Detecta se a atribuição de tarefas do operador mudou
    const currentTaskIds = myAssignedTasks.map((t) => t.id).sort();
    const prevTaskIds = [...prevMyTaskIdsRef.current].sort();
    const hasChanged =
      currentTaskIds.length !== prevTaskIds.length ||
      currentTaskIds.some((id, idx) => id !== prevTaskIds[idx]);

    if (hasChanged) {
      prevMyTaskIdsRef.current = myAssignedTasks.map((t) => t.id);
      if (myAssignedTasks.length > 0) {
        const primaryTask = myAssignedTasks[0];
        // Sincroniza canal ativo automaticamente para o canal da tarefa
        setActiveChannel(`task:${primaryTask.id}`);
        showNotice(
          `📻 Conectado ao canal da sua tarefa: "${primaryTask.name}". Coordene com seus colegas de tarefa sem ocupar o canal Geral!`,
          'Mudar para Geral',
          () => setActiveChannel('geral'),
          'info'
        );
      } else {
        setActiveChannel('geral');
      }
    }

    setSubscribedChannels((prev) => {
      const directChs = prev.filter((c) => c.startsWith('direct:'));
      const combined = Array.from(new Set([...desired, ...directChs]));
      if (prev.length === combined.length && prev.every((val, index) => val === combined[index])) {
        return prev;
      }
      subscribedRef.current = combined;
      return combined;
    });

    if (!activeChannel) {
      setActiveChannel(myAssignedTasks.length > 0 ? `task:${myAssignedTasks[0].id}` : 'geral');
    }
  }, [myAssignedTasks, activeChannel, showNotice]);

  const setupAudioAnalyzer = useCallback((stream: MediaStream) => {
    try {
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
      }
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      // Roteia o microfone com ganho zero para a saída (destination)
      // Mantém o stream de áudio do Android/Chrome ativo como serviço de voz em segundo plano
      try {
        const silentGain = ctx.createGain();
        silentGain.gain.setValueAtTime(0, ctx.currentTime);
        source.connect(silentGain);
        silentGain.connect(ctx.destination);
      } catch {}

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!micStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicLevel(normalized);
        requestAnimationFrame(checkVolume);
      };
      checkVolume();
    } catch (e) {
      console.warn('Volume analyzer error:', e);
    }
  }, []);

  const monitorIncomingStream = useCallback((stream: MediaStream) => {
    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass || !stream) return;

      if (!remoteMonitorRef.current) {
        const ctx = new AudioContextClass();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.resume().catch(() => {});
        const monitor = { ctx, analyser, sources: [] as MediaStreamAudioSourceNode[], interval: null as number | null, lastVoiceAt: 0 };
        remoteMonitorRef.current = monitor;
        const buffer = new Float32Array(analyser.fftSize);

        monitor.interval = window.setInterval(() => {
          if (!remoteMonitorRef.current || remoteMonitorRef.current.sources.length === 0) return;
          remoteMonitorRef.current.analyser.getFloatTimeDomainData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
          const rms = Math.sqrt(sum / buffer.length);
          const now = Date.now();
          if (rms > VOICE_THRESHOLD) {
            remoteMonitorRef.current.lastVoiceAt = now;
            if (!remoteTransmittingRef.current) {
              remoteTransmittingRef.current = true;
              setRemoteTransmitting(true);
            }
          } else if (remoteTransmittingRef.current && now - remoteMonitorRef.current.lastVoiceAt > VOICE_HOLD_MS) {
            remoteTransmittingRef.current = false;
            setRemoteTransmitting(false);
          }
        }, VOICE_POLL_MS);
      }

      const source = remoteMonitorRef.current.ctx.createMediaStreamSource(stream);
      source.connect(remoteMonitorRef.current.analyser);
      remoteMonitorRef.current.sources.push(source);
    } catch (e) {
      console.warn('Remote voice monitor error:', e);
    }
  }, []);

  const computeMicOn = useCallback(() => {
    const pttActive = speakingRef.current || transmissionLockedRef.current;
    return modeRef.current === 'open' ? !mutedRef.current : pttActive && !mutedRef.current;
  }, []);

  const applyLocalSpeaking = useCallback(() => {
    const on = computeMicOn();
    const currentTargetCh = activeChannelRef.current || 'geral';

    // 1. Ativa ou desativa a trilha física de captura do microfone local
    if (micTrackRef.current) {
      try {
        micTrackRef.current.enabled = on;
      } catch {}
    }
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((t) => {
        try {
          t.enabled = on;
        } catch {}
      });
    }

    // 2. Roteamento nos pares WebRTC:
    // Conectamos a trilha do microfone via replaceTrack para os pares do canal ativo quando falando (on),
    // e limpamos com replaceTrack(null) nos outros canais.
    // NUNCA alteramos s.track.enabled = false aqui, pois s.track é a mesma instância compartilhada!
    connectionsRef.current.forEach((entry) => {
      const isTargetChannel = entry.channelId === currentTargetCh;
      const pc = entry.pc;
      if (pc.connectionState !== 'closed') {
        pc.getSenders().forEach((s) => {
          if (s.track !== undefined) {
            const desiredTrack = (on && isTargetChannel) ? (micTrackRef.current || null) : null;
            if (s.track !== desiredTrack) {
              s.replaceTrack(desiredTrack).catch(() => {});
            }
          }
        });
      }
    });

    // Broadcast speaking status to peers for instantaneous UI indicators
    try {
      sendSignalsRef.current([{
        mid: generateId(),
        kind: 'speaking',
        sender: peerIdRef.current,
        senderName: peerNameRef.current,
        senderRole: peerRoleRef.current,
        channel: currentTargetCh,
        payload: { speaking: on },
        ts: Date.now(),
      }]);
    } catch {}
  }, [computeMicOn]);

  const acquireMic = useCallback(async () => {
    if (micStreamRef.current) {
      const activeTracks = micStreamRef.current.getAudioTracks().filter((t) => t.readyState === 'live');
      if (activeTracks.length > 0) {
        return micStreamRef.current;
      }
      micStreamRef.current = null;
      micTrackRef.current = null;
    }

    if (!window.isSecureContext && location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      showNotice('O microfone exige conexão segura (HTTPS ou localhost) no navegador Desktop.');
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showNotice('Microfone não suportado ou bloqueado por falta de HTTPS no navegador.');
      return null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      micStreamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      micTrackRef.current = track || null;
      // Start muted until PTT is pressed
      if (track) {
        track.enabled = computeMicOn();
      }
      setMicAvailable(true);
      setupAudioAnalyzer(stream);
      return stream;
    } catch (err) {
      console.warn('Falha ao abrir microfone:', err);
      showNotice('Sem permissão de microfone. Verifique as permissões de áudio do navegador.');
      return null;
    }
  }, [showNotice, setupAudioAnalyzer, computeMicOn]);

  useEffect(() => {
    applyLocalSpeaking();
  }, [speaking, muted, mode, transmissionLocked, applyLocalSpeaking, micAvailable]);

  useEffect(() => {
    activeChannelRef.current = activeChannel;
    applyLocalSpeaking();
  }, [activeChannel, applyLocalSpeaking]);

  useEffect(() => {
    if (enabled) {
      acquireMic();
    }
  }, [enabled, acquireMic]);

  const refreshAudioOutputDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');
      setAudioOutputDevices(audioOutputs);
    } catch {}
  }, []);

  const setAudioOutputDevice = useCallback(async (deviceId: string) => {
    audioOutputDeviceIdRef.current = deviceId;
    setAudioOutputDeviceIdState(deviceId);
    try {
      localStorage.setItem('dimensio_audio_output_id', deviceId);
    } catch {}

    const promises: Promise<void>[] = [];
    audioElsRef.current.forEach((el) => {
      if ('setSinkId' in el && typeof (el as any).setSinkId === 'function') {
        promises.push((el as any).setSinkId(deviceId).catch(() => {}));
      }
    });
    if (liveAudioElRef.current && 'setSinkId' in liveAudioElRef.current && typeof (liveAudioElRef.current as any).setSinkId === 'function') {
      promises.push((liveAudioElRef.current as any).setSinkId(deviceId).catch(() => {}));
    }
    await Promise.all(promises);
    return true;
  }, []);

  const toggleLoudspeaker = useCallback(async () => {
    const next = !isLoudspeakerRef.current;
    isLoudspeakerRef.current = next;
    setIsLoudspeaker(next);
    try {
      localStorage.setItem('dimensio_audio_loudspeaker', String(next));
    } catch {}

    if (next && audioOutputDevices.length > 0) {
      const speakerDev = audioOutputDevices.find(
        (d) =>
          d.label.toLowerCase().includes('speaker') ||
          d.label.toLowerCase().includes('alto-falante') ||
          d.label.toLowerCase().includes('viva-voz') ||
          d.label.toLowerCase().includes('loudspeaker')
      );
      if (speakerDev) {
        await setAudioOutputDevice(speakerDev.deviceId);
      } else {
        await setAudioOutputDevice('default');
      }
    }
    const targetVol = next ? 1.0 : 0.65;
    setVolumeState(targetVol);
    volumeRef.current = targetVol;
    audioElsRef.current.forEach((el) => {
      el.volume = targetVol;
    });
    return next;
  }, [audioOutputDevices, setAudioOutputDevice]);

  // Initial audio output devices query
  useEffect(() => {
    refreshAudioOutputDevices();
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshAudioOutputDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshAudioOutputDevices);
      };
    }
  }, [refreshAudioOutputDevices]);

  const ensureAudioEl = useCallback((key: string): HTMLAudioElement => {
    let el = audioElsRef.current.get(key);
    if (!el) {
      el = new Audio();
      el.autoplay = true;
      el.muted = false;
      el.volume = volumeRef.current;
      (el as any).playsInline = true;
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      el.setAttribute('autoplay', 'true');
      el.style.position = 'fixed';
      el.style.width = '0';
      el.style.height = '0';
      el.style.opacity = '0';
      el.style.overflow = 'hidden';
      el.style.pointerEvents = 'none';
      if ('setSinkId' in el && typeof (el as any).setSinkId === 'function' && audioOutputDeviceIdRef.current && audioOutputDeviceIdRef.current !== 'default') {
        (el as any).setSinkId(audioOutputDeviceIdRef.current).catch(() => {});
      }
      document.body.appendChild(el);
      audioElsRef.current.set(key, el);
    }
    return el;
  }, []);

  const resumeAllAudio = useCallback(() => {
    setAudioBlocked(false);
    if (enabledRef.current) {
      mediaKeepalive.start(activeChannelRef.current || 'Geral').catch(() => {});
      mediaKeepalive.ensurePlaying();
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
    if (liveStreamCtxRef.current && liveStreamCtxRef.current.state === 'suspended') {
      liveStreamCtxRef.current.resume().catch(() => {});
    }
    const lEl = liveAudioElRef.current;
    if (lEl && enabledRef.current) {
      if (!lEl.src && silentWavBlobUrlRef.current) {
        lEl.src = silentWavBlobUrlRef.current;
      }
      lEl.play().then(() => {
        setAudioBlocked(false);
      }).catch(() => {
        setAudioBlocked(true);
      });
    }
    audioElsRef.current.forEach((a) => {
      if (a.srcObject && a.paused) {
        a.play().then(() => {
          setAudioBlocked(false);
        }).catch(() => {});
      }
    });
  }, []);

  const clearAudioEls = useCallback(() => {
    audioElsRef.current.forEach((a) => {
      try { a.pause(); } catch {}
      try { a.srcObject = null; } catch {}
      try {
        if (a.parentNode) a.parentNode.removeChild(a);
      } catch {}
    });
    audioElsRef.current.clear();
  }, []);

  const stopLiveBroadcast = useCallback(() => {
    mediaKeepalive.stop();
    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current);
      keepaliveIntervalRef.current = null;
    }
  }, []);

  // Background Live Broadcast Engine unificado com mediaKeepalive
  const startLiveBroadcast = useCallback(() => {
    if (!enabledRef.current) return;
    mediaKeepalive.start(activeChannelRef.current || 'Geral').then((ok) => {
      if (ok) setAudioBlocked(false);
    }).catch(() => {
      setAudioBlocked(true);
    });
    mediaKeepalive.ensurePlaying();
  }, []);

  useEffect(() => {
    const resume = () => {
      resumeAllAudio();
      if (enabled && !wakeLockRef.current) {
        requestWakeLock();
      }
    };
    window.addEventListener('pointerdown', resume, { passive: true });
    window.addEventListener('touchstart', resume, { passive: true });
    window.addEventListener('keydown', resume, { passive: true });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        resumeAllAudio();
        if (enabled && !wakeLockRef.current) {
          requestWakeLock();
        }
      } else {
        // Quando o app é minimizado no Android, garante que o áudio silencioso esteja tocando
        // para manter o processo com prioridade de mídia em segundo plano (evita congelamento do SO).
        startLiveBroadcast();
        const lEl = liveAudioElRef.current;
        if (enabledRef.current && lEl) {
          if (!lEl.src && silentWavBlobUrlRef.current) {
            lEl.src = silentWavBlobUrlRef.current;
          }
          lEl.play().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('touchstart', resume);
      window.removeEventListener('keydown', resume);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [resumeAllAudio, enabled, requestWakeLock, startLiveBroadcast]);

  useEffect(() => {
    if (enabled) {
      startLiveBroadcast();
      mediaKeepalive.start(activeChannel || 'Geral').catch(() => {});
    } else {
      stopLiveBroadcast();
      mediaKeepalive.stop();
    }
  }, [enabled, activeChannel, startLiveBroadcast, stopLiveBroadcast]);

  useEffect(() => () => { stopLiveBroadcast(); }, [stopLiveBroadcast]);

  // Media Session integration
  useEffect(() => {
    if (enabled && 'mediaSession' in navigator) {
      try {
        const chLabel = (channels.find((c) => c.id === activeChannel)?.label) || 'Geral';
        const isSpeakingNow = speaking || transmissionLocked || mode === 'open';
        const isRemoteSpeaking = remoteTransmitting;

        let title = `Dimensio Talk — ${chLabel}`;
        let artist = 'Rádio PTT & Segundo Plano Ativo';
        if (isSpeakingNow) {
          title = `● Transmitindo voz — ${chLabel}`;
          artist = 'Você está falando ao vivo';
        } else if (isRemoteSpeaking) {
          title = `● Recebendo áudio — ${chLabel}`;
          artist = 'Colega falando no rádio';
        }

        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          album: `Canal: ${chLabel} — Dimensio`,
          artwork: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        });
        navigator.mediaSession.playbackState = 'playing';

        navigator.mediaSession.setActionHandler('play', () => {
          setMuted(false);
          startLiveBroadcast();
          resumeAllAudio();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          setMuted(true);
          startLiveBroadcast();
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          setMuted(true);
          startLiveBroadcast();
        });
      } catch {}
    }
  }, [enabled, activeChannel, channels, remoteTransmitting, speaking, mode, transmissionLocked, resumeAllAudio, startLiveBroadcast, setMuted]);

  const testLoopback = useCallback(async () => {
    resumeAllAudio();
    const stream = await acquireMic();
    if (!stream) {
      showNotice('Permissão de microfone negada.');
      return;
    }
    setIsTestingLoopback(true);
    showNotice('Gravando sua voz por 3 segundos... Fale no microfone!');

    stream.getAudioTracks().forEach((t) => { t.enabled = true; });

    try {
      if (typeof MediaRecorder !== 'undefined') {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
          if (blob.size === 0) {
            showNotice('Nenhum áudio captado.');
            setIsTestingLoopback(false);
            applyLocalSpeaking();
            return;
          }
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          audio.volume = 1.0;
          audio.setAttribute('playsinline', 'true');
          audio.setAttribute('autoplay', 'true');
          showNotice('Tocando retorno da sua voz...');

          audio.play().then(() => setAudioBlocked(false)).catch(() => {
            setAudioBlocked(true);
          });

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            setIsTestingLoopback(false);
            applyLocalSpeaking();
            showNotice('Teste de retorno concluído com sucesso!');
          };
        };

        recorder.start();
        setTimeout(() => {
          if (recorder.state !== 'inactive') recorder.stop();
        }, 3000);
        return;
      }
    } catch (e) {
      console.warn('Loopback error:', e);
    }
    setIsTestingLoopback(false);
  }, [acquireMic, applyLocalSpeaking, resumeAllAudio, showNotice]);

  const sanitizeSignalMessage = (msg: SignalMessage): SignalMessage => {
    try {
      return JSON.parse(JSON.stringify(msg));
    } catch {
      return msg;
    }
  };

  const sendSignals = useCallback((messages: SignalMessage[]) => {
    if (messages.length === 0) return;
    const safeMessages = messages.map(sanitizeSignalMessage);
    if (bcRef.current) {
      try {
        bcRef.current.postMessage(safeMessages);
      } catch {}
    }
    // Envio ultrarrápido para o barramento local /api/signal (0 custo de Firestore)
    sendFirestoreRadioSignals(safeMessages);
    if (workerRef.current) {
      try {
        workerRef.current.postMessage({ type: 'outbox', messages: safeMessages });
      } catch (err) {}
    } else {
      pendingOutboxRef.current.push(...safeMessages);
    }
  }, []);
  sendSignalsRef.current = sendSignals;

  const awaitGathered = useCallback((pc: RTCPeerConnection) => {
    return new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 2200);
      const check = () => {
        const sdp = pc.localDescription?.sdp || '';
        const isComplete = (pc.iceGatheringState as string) === 'complete';
        const hasSrflx = sdp.includes('typ srflx') || sdp.includes('typ relay') || isComplete;
        if (hasSrflx || isComplete) {
          clearTimeout(t);
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }, []);

  const sendOffer = useCallback(
    (entry: ConnEntry) => {
      const pc = entry.pc;
      if (entry.makingOffer) return;
      entry.makingOffer = true;
      (async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await awaitGathered(pc);
          entry.lastOffer = Date.now();
          const localDesc = pc.localDescription;
          const sdpObj = localDesc
            ? (typeof localDesc.toJSON === 'function' ? localDesc.toJSON() : { type: localDesc.type, sdp: localDesc.sdp })
            : offer;
          sendSignals([{
            mid: generateId(),
            kind: 'offer',
            sender: peerIdRef.current,
            senderName: peerNameRef.current,
            senderRole: peerRoleRef.current,
            to: entry.remoteId,
            channel: entry.channelId,
            payload: { sdp: sdpObj },
            ts: Date.now(),
          }]);
          setRemotePeersMap((prev) => ({ ...prev }));
        } catch (err) {
          console.warn('Erro ao criar oferta WebRTC:', err);
        } finally {
          entry.makingOffer = false;
        }
      })();
    },
    [sendSignals, awaitGathered]
  );

  // Pre-attach the local mic track to all connections permanently.
  // Instantaneous PTT is achieved by simply setting track.enabled = true/false.
  const attachMicToConnections = useCallback(
    async () => {
      let stream = micStreamRef.current;
      if (!stream) {
        stream = await acquireMic();
      }
      if (!stream) return;
      const track = stream.getAudioTracks()[0];
      if (!track) return;

      connectionsRef.current.forEach((entry) => {
        const pc = entry.pc;
        if (pc.connectionState === 'closed') return;

        const existingSender = pc.getSenders().find((s) => s.track?.kind === 'audio' || !s.track);
        if (existingSender) {
          if (existingSender.track !== track) {
            existingSender.replaceTrack(track).catch(() => {});
          }
        } else {
          try {
            pc.addTrack(track, stream!);
          } catch {}
        }
      });
    },
    [acquireMic]
  );

  useEffect(() => {
    if (micAvailable) {
      attachMicToConnections();
    }
  }, [micAvailable, attachMicToConnections]);

  const createPc = useCallback(
    (remoteId: string, channelId: string, key: string, onNegotiationNeeded: () => void): ConnEntry => {
      const pc = new RTCPeerConnection(buildRtcConfig(turnServersRef.current));

      const stream = micStreamRef.current;
      const track = stream?.getAudioTracks()[0];
      if (stream && track) {
        try {
          pc.addTrack(track, stream);
        } catch {
          try { pc.addTransceiver('audio', { direction: 'sendrecv' }); } catch {}
        }
      } else {
        try {
          pc.addTransceiver('audio', { direction: 'sendrecv' });
        } catch {}
      }

      const entry: ConnEntry = {
        pc,
        remoteId,
        channelId,
        status: 'connecting',
        pending: false,
        polite: remoteId < peerIdRef.current,
      };
      connectionsRef.current.set(key, entry);
      ensureAudioEl(key);

      const updateConnectionStatus = () => {
        const connState = pc.connectionState;
        const iceState = pc.iceConnectionState;
        const isConnected =
          connState === 'connected' || iceState === 'connected' || iceState === 'completed';
        const isDead =
          connState === 'failed' || connState === 'closed' || iceState === 'failed' || iceState === 'closed';

        entry.status = isConnected ? 'connected' : isDead ? 'disconnected' : 'connecting';
        if (isDead) {
          try {
            pc.close();
          } catch {}
          connectionsRef.current.delete(key);
        }
        setRemotePeersMap((prev) => ({ ...prev }));
      };

      pc.onconnectionstatechange = updateConnectionStatus;
      pc.oniceconnectionstatechange = updateConnectionStatus;

      pc.onnegotiationneeded = () => {
        const st = pc.connectionState;
        if (st === 'disconnected' || st === 'failed' || st === 'closed') return;
        if (entry.polite) return;
        onNegotiationNeeded();
        sendOffer(entry);
      };

      pc.ontrack = (ev) => {
        const audio = ensureAudioEl(key);
        const incomingStream =
          ev.streams && ev.streams.length > 0 && ev.streams[0]
            ? ev.streams[0]
            : new MediaStream([ev.track]);

        if (audio.srcObject !== incomingStream) {
          audio.srcObject = incomingStream;
        }
        audio.volume = volumeRef.current;
        audio.muted = false;
        monitorIncomingStream(incomingStream);

        audio.play().then(() => {
          setAudioBlocked(false);
        }).catch(() => {
          setAudioBlocked(true);
        });
      };

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          const candidateObj = typeof ev.candidate.toJSON === 'function'
            ? ev.candidate.toJSON()
            : {
                candidate: ev.candidate.candidate,
                sdpMid: ev.candidate.sdpMid,
                sdpMLineIndex: ev.candidate.sdpMLineIndex,
                usernameFragment: ev.candidate.usernameFragment,
              };
          sendSignals([{
            mid: generateId(),
            kind: 'candidate',
            sender: peerIdRef.current,
            senderName: peerNameRef.current,
            senderRole: peerRoleRef.current,
            to: remoteId,
            channel: channelId,
            payload: { candidate: candidateObj },
            ts: Date.now(),
          }]);
        }
      };
      return entry;
    },
    [ensureAudioEl, sendOffer, sendSignals, monitorIncomingStream]
  );

  const drainCandidates = (conn: ConnEntry) => {
    if (conn.pendingCandidates && conn.pendingCandidates.length > 0) {
      conn.pendingCandidates.forEach((c) => {
        conn.pc.addIceCandidate(c).catch(() => {});
      });
      conn.pendingCandidates = [];
    }
  };

  const ensureConnection = useCallback(
    async (channelId: string, peer: CommPeerInfo) => {
      if (!peerIdRef.current || peer.id === peerIdRef.current) return;
      const key = `${channelId}|${peer.id}`;

      const existing = connectionsRef.current.get(key);
      if (existing && existing.pc.connectionState !== 'failed' && existing.pc.connectionState !== 'closed') return;

      // Garante que o microfone está ativo ANTES de gerar a oferta para incluir a trilha no SDP
      let stream = micStreamRef.current;
      if (!stream) {
        stream = await acquireMic();
      }
      const entry = createPc(peer.id, channelId, key, () => {});
      if (stream) {
        const track = stream.getAudioTracks()[0];
        if (track) {
          const audioSender = entry.pc.getSenders().find((s) => s.track?.kind === 'audio' || !s.track);
          if (audioSender) {
            if (audioSender.track !== track) {
              await audioSender.replaceTrack(track).catch(() => {});
            }
          } else {
            try { entry.pc.addTrack(track, stream); } catch {}
          }
        }
      }
      sendOffer(entry);
    },
    [acquireMic, createPc, sendOffer]
  );

  const ensureConnectionRef = useRef(ensureConnection);
  ensureConnectionRef.current = ensureConnection;

  const autoJoinDirectChannel = useCallback(
    (channelId: string, hints: { senderName?: string }) => {
      if (!channelId.startsWith('direct:')) return;
      const myBase = peerIdRef.current.split('#')[0];
      if (!myBase || myBase === 'anon') return;
      const collabId = channelId.slice('direct:'.length);
      if (!collabId) return;

      setDirectChannels((prev) => {
        if (prev[collabId]) return prev;
        const label = hints.senderName && hints.senderName !== '—' ? `Direto: ${hints.senderName}` : `Direto #${collabId}`;
        return { ...prev, [collabId]: { id: channelId, label, kind: 'direct', collabId } };
      });
      if (!subscribedRef.current.includes(channelId)) {
        setSubscribedChannels((prev) => {
          const next = prev.includes(channelId) ? prev : [...prev, channelId];
          subscribedRef.current = next;
          return next;
        });
      }
      setActiveChannel(channelId);
    },
    []
  );

  const handleSignal = useCallback(
    (msg: SignalMessage) => {
      if (!msg.sender || msg.sender === peerIdRef.current) return;

      if (msg.mid && seenMidsRef.current.has(msg.mid)) return;
      if (msg.mid) {
        seenMidsRef.current.add(msg.mid);
        if (seenMidsRef.current.size > SEEN_PRUNE) {
          const arr = Array.from(seenMidsRef.current).slice(-SEEN_PRUNE);
          seenMidsRef.current = new Set(arr);
        }
      }

      if (msg.kind === 'state_ping') {
        window.dispatchEvent(new CustomEvent('dimensio-remote-state-ping', { detail: msg.payload }));
        return;
      }

      if (msg.kind === 'voice_start') {
        if (msg.channel && subscribedRef.current.includes(msg.channel)) {
          playRadioPttChirp('incoming');
          setRemoteTransmitting(true);
          remoteTransmittingRef.current = true;
          if (remoteMonitorRef.current) {
            remoteMonitorRef.current.lastVoiceAt = Date.now();
          }
          const speakerName = msg.senderName && msg.senderName !== '—'
            ? msg.senderName
            : (msg.sender.startsWith('anon') ? 'Operador Convidado (Guest)' : 'Operador');
          setActiveSpeakerName(speakerName);
          resumeAllAudio();
          // Notifica APENAS em Canais Diretos (DM privado), evitando spam sonoro a cada toque no Geral
          if (msg.channel.startsWith('direct:') && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
            const speaker = speakerName;
            showNativeOSNotification(`📞 Chamada Direta de ${speaker}`, {
              body: `${speaker} está falando com você em canal direto privado.`,
              tag: 'dimensio-radio-direct',
              vibrate: [300, 150, 300, 150, 300],
            });
          }
          setRemotePeersMap((prev) => {
            const list = prev[msg.channel!] || [];
            const exists = list.some((p) => p.id === msg.sender);
            const nextList = exists
              ? list.map((p) => (p.id === msg.sender ? { ...p, speaking: true, name: p.name || speakerName } : p))
              : [...list, {
                  id: msg.sender,
                  name: speakerName,
                  role: msg.senderRole || 'Convidado',
                  status: 'connected' as const,
                  speaking: true,
                }];
            return {
              ...prev,
              [msg.channel!]: nextList,
            };
          });
        }
        return;
      }

      if (msg.kind === 'voice_stop') {
        if (msg.channel) {
          setRemoteTransmitting(false);
          remoteTransmittingRef.current = false;
          setActiveSpeakerName(null);
          setRemotePeersMap((prev) => {
            const list = prev[msg.channel!] || [];
            return {
              ...prev,
              [msg.channel!]: list.map((p) => (p.id === msg.sender ? { ...p, speaking: false } : p)),
            };
          });
        }
        return;
      }

      // Speaking indicator broadcast
      if (msg.kind === 'speaking' && msg.channel) {
        if (msg.sender === peerIdRef.current) return;
        const isSpeaking = Boolean((msg.payload as any)?.speaking);
        const speakerName = msg.senderName && msg.senderName !== '—'
          ? msg.senderName
          : (msg.sender.startsWith('anon') ? 'Operador Convidado (Guest)' : 'Operador');
        setRemotePeersMap((prev) => {
          const list = prev[msg.channel!] || [];
          const exists = list.some((p) => p.id === msg.sender);
          const nextList = exists
            ? list.map((p) => (p.id === msg.sender ? { ...p, speaking: isSpeaking, name: p.name || speakerName } : p))
            : isSpeaking
            ? [...list, {
                id: msg.sender,
                name: speakerName,
                role: msg.senderRole || 'Convidado',
                status: 'connected' as const,
                speaking: true,
              }]
            : list;
          return {
            ...prev,
            [msg.channel!]: nextList,
          };
        });
        setRemoteTransmitting(isSpeaking);
        setActiveSpeakerName(isSpeaking ? speakerName : null);
        return;
      }

      // Presence
      if (msg.kind === 'presence' && msg.channel) {
        if (msg.sender === peerIdRef.current) return;

        const incomingBase = msg.sender.split('#')[0];
        if (incomingBase && !incomingBase.startsWith('anon')) {
          connectionsRef.current.forEach((conn, connKey) => {
            const [cChannel, cRemoteId] = connKey.split('|');
            if (cChannel === msg.channel && cRemoteId !== msg.sender && cRemoteId.split('#')[0] === incomingBase) {
              try { conn.pc.close(); } catch {}
              connectionsRef.current.delete(connKey);
            }
          });
        }

        setPeersMap((prev) => {
          const channelList = prev[msg.channel!] || [];
          const list = channelList.filter(
            (p) => p.id !== msg.sender && (!incomingBase || incomingBase.startsWith('anon') || p.id.split('#')[0] !== incomingBase)
          );
          const name = msg.senderName && msg.senderName !== '—' && msg.senderName !== 'Operador'
            ? msg.senderName
            : (incomingBase.startsWith('anon') ? 'Operador Visitante' : 'Operador');
          const role = msg.senderRole || (incomingBase.startsWith('anon') ? 'Convidado' : 'Operativo');
          list.push({
            id: msg.sender,
            name,
            role,
            lastSeen: Date.now(),
          });
          return { ...prev, [msg.channel!]: list };
        });

        // Direct channels: ONLY join if explicitly opened (directOpen === true) and timestamp is newer than dismissal
        if (msg.channel.startsWith('direct:')) {
          const dcCollabId = msg.channel.slice('direct:'.length);
          const closedAt = dismissedDirectRef.current.get(dcCollabId) || 0;
          if (msg.directOpen && msg.ts > closedAt) {
            dismissedDirectRef.current.delete(dcCollabId);
            persistDismissedDirect();
            autoJoinDirectChannel(msg.channel, { senderName: msg.senderName });
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
              showNativeOSNotification(`📞 Chamada Direta — ${msg.senderName || 'Operador'}`, {
                body: 'Chamando você em canal direto no rádio Dimensio Talk.',
                tag: 'dimensio-radio-direct',
                vibrate: [300, 150, 300, 150, 300],
              });
            }
          }
        }
        return;
      }

      const channelId = msg.channel || '';
      const key = `${channelId}|${msg.sender}`;
      const entry = connectionsRef.current.get(key);

      if (msg.kind === 'candidate') {
        if (msg.to && msg.to !== peerIdRef.current) return;
        const cand = (msg.payload as { candidate?: RTCIceCandidateInit }).candidate || (msg.payload as RTCIceCandidateInit);
        if (!cand) return;
        if (entry) {
          if (entry.pc.remoteDescription && entry.pc.remoteDescription.type) {
            entry.pc.addIceCandidate(cand).catch(() => {});
          } else {
            if (!entry.pendingCandidates) entry.pendingCandidates = [];
            entry.pendingCandidates.push(cand);
          }
        }
        return;
      }

      if (msg.kind === 'offer') {
        if (!channelId) return;
        if (!subscribedRef.current.includes(channelId)) {
          if (channelId.startsWith('direct:')) {
            const dcCollabId = channelId.slice('direct:'.length);
            const closedAt = dismissedDirectRef.current.get(dcCollabId) || 0;
            if (msg.ts <= closedAt) return; // Stale offer for closed DM
            autoJoinDirectChannel(channelId, { senderName: msg.senderName });
          } else {
            return;
          }
        }
        if (msg.to && msg.to !== peerIdRef.current) return;

        (async () => {
          let conn = connectionsRef.current.get(key);
          if ((conn && conn.pc.connectionState === 'failed') || (conn && conn.pc.connectionState === 'closed')) {
            try { conn.pc.close(); } catch {}
            connectionsRef.current.delete(key);
            conn = undefined;
          }

          if (!conn) {
            conn = createPc(msg.sender, channelId, key, () => {});
          }

          // Garante que o microfone local está associado ANTES de gerar a resposta (answer SDP sendrecv)
          let stream = micStreamRef.current;
          if (!stream) {
            stream = await acquireMic();
          }
          if (stream && conn) {
            const track = stream.getAudioTracks()[0];
            if (track) {
              const audioSender = conn.pc.getSenders().find((s) => s.track?.kind === 'audio' || !s.track);
              if (audioSender) {
                if (audioSender.track !== track) {
                  await audioSender.replaceTrack(track).catch(() => {});
                }
              } else {
                try { conn.pc.addTrack(track, stream); } catch {}
              }
            }
          }

          try {
            const rawPayload = msg.payload as any;
            const offerObj = rawPayload?.sdp || rawPayload;
            const offerSdp: RTCSessionDescriptionInit =
              offerObj && typeof offerObj === 'object' && offerObj.sdp
                ? { type: 'offer', sdp: offerObj.sdp }
                : typeof offerObj === 'string'
                ? { type: 'offer', sdp: offerObj }
                : (offerObj as RTCSessionDescriptionInit);

            if (!offerSdp || !offerSdp.sdp) return;

            const currentState = conn.pc.signalingState;
            if (currentState === 'have-remote-offer') return;

            if (currentState === 'have-local-offer') {
              if (conn.polite) {
                await conn.pc.setLocalDescription({ type: 'rollback' });
              } else {
                return;
              }
            }

            if (conn.pc.signalingState === 'stable' || conn.pc.signalingState === 'have-local-pranswer') {
              await conn.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
              drainCandidates(conn);
              const answer = await conn.pc.createAnswer();
              await conn.pc.setLocalDescription(answer);
              await awaitGathered(conn.pc);
              conn.status = 'connecting';
              const answerLocalDesc = conn.pc.localDescription;
              const answerSdpObj = answerLocalDesc
                ? (typeof answerLocalDesc.toJSON === 'function' ? answerLocalDesc.toJSON() : { type: answerLocalDesc.type, sdp: answerLocalDesc.sdp })
                : answer;

              sendSignals([{
                mid: generateId(),
                kind: 'answer',
                sender: peerIdRef.current,
                senderName: peerNameRef.current,
                senderRole: peerRoleRef.current,
                to: msg.sender,
                channel: channelId,
                payload: { sdp: answerSdpObj },
                ts: Date.now(),
              }]);
              setRemotePeersMap((prev) => ({ ...prev }));
            }
          } catch (err: any) {
            if (err?.name !== 'InvalidStateError') {
              console.warn('Offer handling notice:', err);
            }
          }
        })();
        return;
      }

      if (msg.kind === 'answer') {
        if (!entry) return;
        if (msg.to && msg.to !== peerIdRef.current) return;
        // Se já estabilizado ou fechado, ignora respostas duplicadas sem lançar exceção
        if (entry.isSettingRemoteAnswer || entry.pc.signalingState !== 'have-local-offer') {
          return;
        }
        entry.isSettingRemoteAnswer = true;

        (async () => {
          try {
            if (entry.pc.signalingState !== 'have-local-offer') {
              return;
            }
            const rawPayload = msg.payload as any;
            const answerObj = rawPayload?.sdp || rawPayload;
            const desc: RTCSessionDescriptionInit =
              answerObj && typeof answerObj === 'object' && answerObj.sdp
                ? { type: 'answer', sdp: answerObj.sdp }
                : typeof answerObj === 'string'
                ? { type: 'answer', sdp: answerObj }
                : (answerObj as RTCSessionDescriptionInit);

            if (!desc || !desc.sdp) return;
            await entry.pc.setRemoteDescription(new RTCSessionDescription(desc));
            drainCandidates(entry);
            entry.status = 'connected';
            entry.makingOffer = false;
            setRemotePeersMap((prev) => ({ ...prev }));
          } catch (err: any) {
            // Ignora silenciosamente corridas onde o estado já foi estabilizado
            if (err?.name !== 'InvalidStateError') {
              console.warn('Answer handling notice:', err);
            }
          } finally {
            entry.isSettingRemoteAnswer = false;
          }
        })();
        return;
      }

      if (msg.kind === 'bye') {
        const conn = connectionsRef.current.get(key);
        if (conn) {
          try { conn.pc.close(); } catch {}
          connectionsRef.current.delete(key);
        }
        setPeersMap((prev) => {
          const list = (prev[channelId] || []).filter((p) => p.id !== msg.sender);
          return { ...prev, [channelId]: list };
        });
        setRemotePeersMap((prev) => {
          const list = prev[channelId];
          if (!list || !list.some((p) => p.id === msg.sender)) return prev;
          return {
            ...prev,
            [channelId]: list.filter((p) => p.id !== msg.sender),
          };
        });

        // If a direct channel was closed by the other party, clean up locally and return to Geral
        if (channelId.startsWith('direct:')) {
          const directCollabId = channelId.slice('direct:'.length);
          if (directCollabId) {
            dismissedDirectRef.current.set(directCollabId, Date.now());
            persistDismissedDirect();
            setDirectChannels((prev) => {
              const next = { ...prev };
              delete next[directCollabId];
              return next;
            });
            setSubscribedChannels((prev) => {
              const next = prev.filter((c) => c !== channelId);
              subscribedRef.current = next;
              return next;
            });
            setActiveChannel((prev) => (prev === channelId ? 'geral' : prev));
          }
        }
      }
    },
    [acquireMic, ensureAudioEl, awaitGathered, sendSignals, autoJoinDirectChannel, createPc]
  );

  const handleSignalRef = useRef(handleSignal);
  handleSignalRef.current = handleSignal;

  // BroadcastChannel for instant local cross-tab communication
  useEffect(() => {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('dimensio_p2p_signals');
      bc.onmessage = (e) => {
        if (e.data) {
          if (Array.isArray(e.data)) {
            e.data.forEach((m) => handleSignalRef.current(m));
          } else {
            handleSignalRef.current(e.data);
          }
        }
      };
      bcRef.current = bc;
      return () => {
        bc.close();
        bcRef.current = null;
      };
    }
  }, []);

  // Atualizador de presença unificado (chamado por SSE e pelo worker)
  const updatePeersFromList = useCallback((list: any[]) => {
    const now = Date.now();
    const currentPeerId = peerIdRef.current;
    const myBaseId = currentPeerId ? currentPeerId.split('#')[0] : '';
    const validPeers = list.filter(
      (p) => p && p.peerId && p.peerId !== currentPeerId && (p.peerId.split('#')[0] !== myBaseId) && now - (p.lastSeen || 0) < 22000
    );
    setPeersMap((prev) => {
      const next: Record<string, CommPeerInfo[]> = {};
      Object.entries(prev).forEach(([ch, pList]) => {
        next[ch] = pList.filter((p) => p.lastSeen && (now - p.lastSeen < 22000 && p.id.split('#')[0] !== myBaseId));
      });
      validPeers.forEach((p) => {
        const baseId = p.peerId.split('#')[0];
        if (baseId) {
          connectionsRef.current.forEach((conn, key) => {
            const [, cRemoteId] = key.split('|');
            if (cRemoteId !== p.peerId && cRemoteId.split('#')[0] === baseId) {
              try { conn.pc.close(); } catch {}
              connectionsRef.current.delete(key);
            }
          });
        }
        (p.channels || ['geral']).forEach((ch: string) => {
          if (!next[ch]) next[ch] = [];
          next[ch] = next[ch].filter((x) => x.id === p.peerId || x.id.split('#')[0] !== baseId);
          const peerObj: CommPeerInfo = {
            id: p.peerId,
            name: p.peerName || (baseId.startsWith('anon') ? 'Operador Convidado' : 'Operador'),
            role: p.peerRole || (baseId.startsWith('anon') ? 'Convidado' : 'Operativo'),
            lastSeen: p.lastSeen || now,
          };
          const existingIdx = next[ch].findIndex((x) => x.id === p.peerId);
          if (existingIdx >= 0) {
            next[ch][existingIdx] = peerObj;
          } else {
            next[ch].push(peerObj);
          }
        });
      });
      return next;
    });
  }, []);

  const updatePeersFromListRef = useRef(updatePeersFromList);
  updatePeersFromListRef.current = updatePeersFromList;

  // Barramento de Presença e Sinais em Tempo Real (SSE + /api/signal) — 0 COTA DE FIRESTORE
  useEffect(() => {
    if (!enabled) return;
    setRelayOnline(true);
    const myPeerId = peerIdRef.current;
    let sse: EventSource | null = null;

    // 1. Conexão SSE para streaming instantâneo (0ms de latência)
    if (typeof EventSource !== 'undefined') {
      try {
        const sseUrl = `/api/signal/stream?peerId=${encodeURIComponent(myPeerId)}`;
        sse = new EventSource(sseUrl);
        sse.addEventListener('init', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data && Array.isArray(data.peers)) {
              updatePeersFromListRef.current(data.peers);
            }
          } catch {}
        });
        sse.addEventListener('presence', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            if (data && Array.isArray(data.peers)) {
              updatePeersFromListRef.current(data.peers);
            }
          } catch {}
        });
        sse.addEventListener('signal', (e: MessageEvent) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg && msg.sender !== peerIdRef.current) {
              handleSignalRef.current(msg);
            }
          } catch {}
        });
      } catch (err) {
        console.warn('[SSE] EventSource indisponível, utilizando polling:', err);
      }
    }

    // 2. Heartbeat periódico a cada 8 segundos para registrar presença na memória do servidor
    const sendPresence = () => {
      if (!peerIdRef.current) return;
      updateRadioCloudPresence(
        peerIdRef.current,
        peerNameRef.current,
        peerRoleRef.current,
        subscribedRef.current
      );
    };

    sendPresence();
    const presenceTimer = setInterval(sendPresence, 8000);

    const sendByeAndCleanup = () => {
      const myId = peerIdRef.current;
      if (!myId) return;
      try {
        removeRadioCloudPresence(myId);
      } catch {}
      const byeMsgs: SignalMessage[] = subscribedRef.current.map((ch) => ({
        mid: generateId(),
        kind: 'bye',
        sender: myId,
        channel: ch,
        ts: Date.now(),
      }));
      try {
        sendSignals(byeMsgs);
      } catch {}
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const blob = new Blob(
            [JSON.stringify({ mode: 'signal', signal: byeMsgs, spreadsheetUrl: state.onlineSpreadsheet?.url || '' })],
            { type: 'application/json' }
          );
          navigator.sendBeacon('/api/signal', blob);
        } catch {}
      }
    };

    window.addEventListener('beforeunload', sendByeAndCleanup);
    window.addEventListener('pagehide', sendByeAndCleanup);

    return () => {
      if (sse) {
        sse.close();
      }
      clearInterval(presenceTimer);
      window.removeEventListener('beforeunload', sendByeAndCleanup);
      window.removeEventListener('pagehide', sendByeAndCleanup);
      sendByeAndCleanup();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || relayWarnedRef.current) return;
    relayWarnedRef.current = true;
  }, [enabled]);

  // Background Web Worker for non-throttled signaling and presence
  useEffect(() => {
    if (!enabled) return;
    const worker = new Worker(new URL('../workers/signalWorker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    mediaKeepalive.attachWorkerPort(worker);

    worker.onmessage = (e) => {
      const data = e.data as { type: string; [k: string]: unknown };
      if (!data) return;
      if (data.type === 'polled') {
        const msgs = (data.messages as SignalMessage[]) || [];
        msgs.forEach((m) => handleSignalRef.current(m));
        if (data.peers && Array.isArray(data.peers)) {
          updatePeersFromListRef.current(data.peers);
        }
      } else if (data.type === 'relayOnline') {
        setRelayOnline(Boolean(data.ok));
      } else if (data.type === 'tick') {
        const now = typeof data.now === 'number' ? data.now : Date.now();
        prunePeers(now);
        retryConnections(now);
        if (liveStreamCtxRef.current && liveStreamCtxRef.current.state === 'suspended') {
          liveStreamCtxRef.current.resume().catch(() => {});
        }
        if (enabledRef.current && liveAudioElRef.current?.paused) {
          liveAudioElRef.current.play().catch(() => {});
        }
      } else if (data.type === 'keepalive-ping') {
        try {
          mediaKeepalive.pokeFromWorker();
        } catch {}
      }
    };

    worker.postMessage({
      type: 'start',
      config: {
        webhookUrl: webhookUrl || "/api/signal",
        spreadsheetUrl: state.onlineSpreadsheet?.url || '',
        peerId: peerIdRef.current,
        peerName: peerNameRef.current,
        peerRole: peerRoleRef.current,
        channels: subscribedRef.current,
        pollMs: POLL_MS,
        heartbeatMs: HEARTBEAT_MS,
      },
    });

    if (pendingOutboxRef.current.length > 0) {
      worker.postMessage({ type: 'outbox', messages: pendingOutboxRef.current.splice(0) });
    }

    const syncIdentity = () => {
      worker.postMessage({
        type: 'peer',
        peerId: peerIdRef.current,
        peerName: peerNameRef.current,
        peerRole: peerRoleRef.current,
      });
      worker.postMessage({ type: 'channels', channels: subscribedRef.current });
    };
    syncIdentity();

    return () => {
      mediaKeepalive.attachWorkerPort(null);
      worker.postMessage({ type: 'stop' });
      worker.terminate();
      workerRef.current = null;
    };
  }, [enabled, webhookUrl, state.onlineSpreadsheet?.url]);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) return;
    worker.postMessage({
      type: 'peer',
      peerId: peerIdRef.current,
      peerName: peerNameRef.current,
      peerRole: peerRoleRef.current,
    });
    worker.postMessage({ type: 'channels', channels: subscribedRef.current });
  }, [identifiedUser, subscribedChannels]);

  const prunePeers = useCallback((now: number) => {
    setPeersMap((prev) => {
      let changed = false;
      const next: Record<string, CommPeerInfo[]> = {};
      Object.keys(prev).forEach((ch) => {
        const alive = prev[ch].filter((p) => p.lastSeen && now - p.lastSeen < PEER_TTL_MS);
        if (alive.length !== prev[ch].length) changed = true;
        if (alive.length > 0) next[ch] = alive;
      });
      return changed ? next : prev;
    });
  }, []);

  const retryConnections = useCallback(
    (now: number) => {
      connectionsRef.current.forEach((entry, key) => {
        const [ch, remoteId] = key.split('|');
        if (!ch || !remoteId) return;
        const st = entry.pc.connectionState;
        if (st === 'connected') return;
        if (st === 'failed' || st === 'closed') {
          try {
            entry.pc.close();
          } catch {}
          connectionsRef.current.delete(key);
          const peer = (peersMapRef.current[ch] || []).find((p) => p.id === remoteId);
          if (peer) ensureConnectionRef.current(ch, peer);
          return;
        }
        if (now - (entry.lastOffer || 0) < RETRY_INTERVAL_MS) return;
        const prevStatus = entry.status;
        entry.lastOffer = now;
        entry.status = 'connecting';
        sendOffer(entry);
        if (prevStatus !== 'connecting') {
          setRemotePeersMap((prev) => {
            const list = prev[ch] || [];
            return {
              ...prev,
              [ch]: list.map((p) => (p.id === remoteId ? { ...p, active: 'connecting' } : p)),
            };
          });
        }
      });
    },
    [sendOffer]
  );

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      startLiveBroadcast();
      resumeAllAudio();
      attachMicToConnections();
      retryConnections(Date.now());
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [attachMicToConnections, retryConnections, startLiveBroadcast, resumeAllAudio]);

  useEffect(() => {
    if (!enabled) return;
    subscribedChannels.forEach((ch) => {
      (peersMap[ch] || []).forEach((p) => {
        ensureConnectionRef.current(ch, p);
      });
    });
  }, [enabled, subscribedChannels, peersMap]);

  useEffect(() => {
    const next: Record<string, RemotePeerState[]> = {};
    subscribedChannels.forEach((ch) => {
      const peers = peersMap[ch] || [];
      next[ch] = peers.map((p) => {
        const key = `${ch}|${p.id}`;
        const conn = connectionsRef.current.get(key);
        const active = conn ? conn.status : 'disconnected';
        return {
          id: p.id,
          name: p.name,
          role: p.role,
          status: active,
          speaking: false,
        };
      });
    });
    setRemotePeersMap((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length) {
        const isSame = prevKeys.every((key) => {
          const pList = prev[key] || [];
          const nList = next[key] || [];
          if (pList.length !== nList.length) return false;
          return pList.every(
            (p, idx) =>
              p.id === nList[idx].id &&
              p.status === nList[idx].status &&
              p.speaking === nList[idx].speaking &&
              p.name === nList[idx].name
          );
        });
        if (isSame) return prev;
      }
      return next;
    });
  }, [peersMap, subscribedChannels]);

  useEffect(() => {
    if (enabled) return;
    connectionsRef.current.forEach((c) => {
      try { c.pc.close(); } catch {}
    });
    connectionsRef.current.clear();
    clearAudioEls();
    if (micTrackRef.current) {
      try { micTrackRef.current.stop(); } catch {}
      micTrackRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      micStreamRef.current = null;
    }
    setMicAvailable(false);
    if (remoteMonitorRef.current) {
      if (remoteMonitorRef.current.interval) clearInterval(remoteMonitorRef.current.interval);
      try { remoteMonitorRef.current.ctx.close(); } catch {}
      remoteMonitorRef.current = null;
    }
    remoteTransmittingRef.current = false;
    setRemoteTransmitting(false);
  }, [enabled, clearAudioEls]);

  const toggleChannel = useCallback(
    (id: string) => {
      setSubscribedChannels((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((c) => c !== id) : [...prev, id];
        subscribedRef.current = next;
        if (has) {
          sendSignals([{
            mid: generateId(),
            kind: 'bye',
            sender: peerIdRef.current,
            channel: id,
            ts: Date.now(),
          }]);
          connectionsRef.current.forEach((c, key) => {
            if (key.startsWith(`${id}|`)) {
              try { c.pc.close(); } catch {}
              connectionsRef.current.delete(key);
            }
          });
        } else {
          sendSignals([{
            mid: generateId(),
            kind: 'presence',
            sender: peerIdRef.current,
            senderName: peerNameRef.current,
            senderRole: peerRoleRef.current,
            channel: id,
            ts: Date.now(),
          }]);
        }
        return next;
      });
      setActiveChannel((prev) => (prev === id ? null : prev || id));
    },
    [sendSignals]
  );

  const joinTaskChannel = useCallback(
    (taskId: string) => {
      const id = `task:${taskId}`;
      if (!subscribedRef.current.includes(id)) {
        toggleChannel(id);
      }
      setActiveChannel(id);
    },
    [toggleChannel]
  );

  // Open / Call direct channel with a colleague
  const openDirectChannel = useCallback(
    (collabId: string, name: string) => {
      const channel = `direct:${collabId}`;
      dismissedDirectRef.current.delete(collabId);
      persistDismissedDirect();

      setDirectChannels((prev) => {
        if (prev[collabId]) return prev;
        return { ...prev, [collabId]: { id: channel, label: `Direto: ${name}`, kind: 'direct', collabId } };
      });
      if (!subscribedRef.current.includes(channel)) {
        setSubscribedChannels((prev) => {
          const next = prev.includes(channel) ? prev : [...prev, channel];
          subscribedRef.current = next;
          return next;
        });
      }
      setActiveChannel(channel);

      // Send explicit directOpen presence call signal
      sendSignals([
        {
          mid: generateId(),
          kind: 'presence',
          sender: peerIdRef.current,
          senderName: peerNameRef.current,
          senderRole: peerRoleRef.current,
          channel,
          directOpen: true,
          ts: Date.now(),
        },
      ]);

      const known = Object.values<CommPeerInfo[]>(peersMapRef.current)
        .flat()
        .find((p) => p.id.startsWith(`${collabId}#`) && p.id !== peerIdRef.current);
      if (known) {
        ensureConnection(channel, known);
      }
      showNotice(`Chamada direta com ${name} iniciada.`);
    },
    [sendSignals, ensureConnection, showNotice]
  );

  // Close / Hang up direct channel permanently
  const closeDirectChannel = useCallback(
    (collabId: string) => {
      const channel = `direct:${collabId}`;
      const now = Date.now();
      dismissedDirectRef.current.set(collabId, now);
      persistDismissedDirect();

      setDirectChannels((prev) => {
        const next = { ...prev };
        delete next[collabId];
        return next;
      });

      setSubscribedChannels((prev) => {
        const next = prev.filter((c) => c !== channel);
        subscribedRef.current = next;
        return next;
      });

      // Send explicit bye signal
      sendSignals([
        {
          mid: generateId(),
          kind: 'bye',
          sender: peerIdRef.current,
          channel,
          ts: now,
        },
      ]);

      // Tear down connections for this channel
      connectionsRef.current.forEach((c, ckey) => {
        if (ckey.startsWith(`${channel}|`)) {
          try { c.pc.close(); } catch {}
          connectionsRef.current.delete(ckey);
        }
      });

      setActiveChannel((prev) => (prev === channel ? 'geral' : prev));

      // Update cloud presence immediately
      if (peerIdRef.current) {
        updateRadioCloudPresence(
          peerIdRef.current,
          peerNameRef.current,
          peerRoleRef.current,
          subscribedRef.current
        );
      }
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'channels', channels: subscribedRef.current });
      }
    },
    [sendSignals]
  );

  const leaveAll = useCallback(() => {
    if (peerIdRef.current) {
      try {
        removeRadioCloudPresence(peerIdRef.current);
      } catch {}
      const byeMsgs: SignalMessage[] = subscribedRef.current.map((ch) => ({
        mid: generateId(),
        kind: 'bye',
        sender: peerIdRef.current,
        channel: ch,
        ts: Date.now(),
      }));
      try {
        sendSignals(byeMsgs);
      } catch {}
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const blob = new Blob(
            [JSON.stringify({ mode: 'signal', signal: byeMsgs, spreadsheetUrl: state.onlineSpreadsheet?.url || '' })],
            { type: 'application/json' }
          );
          navigator.sendBeacon('/api/signal', blob);
        } catch {}
      }
    }
    setSubscribedChannels([]);
    subscribedRef.current = [];
    connectionsRef.current.forEach((c) => {
      try { c.pc.close(); } catch {}
    });
    connectionsRef.current.clear();
    clearAudioEls();
    mediaKeepalive.stop();
    if (micTrackRef.current) {
      try { micTrackRef.current.stop(); } catch {}
      micTrackRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      micStreamRef.current = null;
    }
    setMicAvailable(false);
    setPeersMap({});
    setRemotePeersMap({});
  }, [clearAudioEls, sendSignals, state.onlineSpreadsheet?.url]);

  const setEnabled = useCallback((val: boolean) => {
    setEnabledState(val);
    enabledRef.current = val;
    try {
      localStorage.setItem('dimensio_radio_enabled', JSON.stringify(val));
    } catch {}
    if (!val) {
      leaveAll();
      stopLiveBroadcast();
      showNotice('Rádio PTT desligado');
    } else {
      setMuted(false);
      startLiveBroadcast();
      resumeAllAudio();
      acquireMic();
      showNotice('Rádio PTT ligado');
    }
  }, [leaveAll, showNotice, startLiveBroadcast, stopLiveBroadcast, acquireMic, resumeAllAudio]);

  const setPttKey = useCallback((key: string) => {
    setPttKeyState(key);
    pttKeyRef.current = key;
    try {
      localStorage.setItem('dimensio_radio_ptt_key', key);
    } catch {}
  }, []);

  // Instantaneous Push-to-Talk (0ms latency): enables hardware track immediately
  const startSpeaking = useCallback(async () => {
    if (mutedRef.current) return;
    setSpeaking(true);
    speakingRef.current = true;
    playRadioPttChirp('start');

    // Instant zero-latency hardware track enable
    applyLocalSpeaking();

    const targetChannel = activeChannelRef.current || 'geral';
    sendSignals([
      {
        mid: generateId(),
        kind: 'voice_start',
        sender: peerIdRef.current,
        senderName: peerNameRef.current,
        senderRole: peerRoleRef.current,
        channel: targetChannel,
        ts: Date.now(),
      },
    ]);

    if (!micStreamRef.current) {
      await acquireMic();
      applyLocalSpeaking();
      await attachMicToConnections();
    }
  }, [acquireMic, attachMicToConnections, applyLocalSpeaking, sendSignals]);

  const stopSpeaking = useCallback(() => {
    setSpeaking(false);
    speakingRef.current = false;
    if (modeRef.current === 'ptt' && !transmissionLockedRef.current) {
      applyLocalSpeaking();
    }
    playRadioPttChirp('stop');

    const targetChannel = activeChannelRef.current || 'geral';
    sendSignals([
      {
        mid: generateId(),
        kind: 'voice_stop',
        sender: peerIdRef.current,
        channel: targetChannel,
        ts: Date.now(),
      },
    ]);
  }, [applyLocalSpeaking, sendSignals]);

  // Push-to-Talk via keyboard
  useEffect(() => {
    const isEditable = () => {
      const el = document.activeElement as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
    };
    const matches = (e: KeyboardEvent) => {
      const k = pttKeyRef.current;
      if (k === 'Space') return e.code === 'Space';
      return e.code === k || e.key === k;
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!enabledRef.current || isEditable() || e.ctrlKey || e.altKey || e.metaKey) return;
      if (matches(e)) {
        e.preventDefault();
        startSpeaking();
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (!enabledRef.current || isEditable()) return;
      if (matches(e)) {
        e.preventDefault();
        stopSpeaking();
      }
    };
    const onBlur = () => {
      if (enabledRef.current) stopSpeaking();
    };
    const onFocusIn = () => {
      if (enabledRef.current && isEditable()) stopSpeaking();
    };

    window.addEventListener('keydown', onDown, true);
    window.addEventListener('keyup', onUp, true);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focusin', onFocusIn);
    };
  }, [startSpeaking, stopSpeaking]);

  const setTransmissionLocked = useCallback(async (locked: boolean) => {
    setTransmissionLockedState(locked);
    transmissionLockedRef.current = locked;
    try {
      localStorage.setItem('dimensio_radio_transmission_lock', JSON.stringify(locked));
    } catch {}

    if (locked) {
      startSpeaking();
    } else {
      stopSpeaking();
    }
  }, [startSpeaking, stopSpeaking]);

  const forceReconnect = useCallback(() => {
    connectionsRef.current.forEach((conn) => {
      try { conn.pc.close(); } catch {}
    });
    connectionsRef.current.clear();
    clearAudioEls();
    acquireMic().catch(() => {});
    resumeAllAudio();
    if (peerIdRef.current) {
      updateRadioCloudPresence(
        peerIdRef.current,
        peerNameRef.current,
        peerRoleRef.current,
        subscribedRef.current
      );
    }
    showNotice('Canais e conexões de voz reinicializados com sucesso.');
  }, [acquireMic, clearAudioEls, resumeAllAudio, showNotice]);

  const getDiagnostics = useCallback(() => {
    const conns: any[] = [];
    connectionsRef.current.forEach((conn, k) => {
      conns.push({
        key: k,
        remoteId: conn.remoteId,
        status: conn.status,
        connectionState: conn.pc.connectionState,
        iceConnectionState: conn.pc.iceConnectionState,
        signalingState: conn.pc.signalingState,
        sendersCount: conn.pc.getSenders().length,
        hasAudioTrack: conn.pc.getSenders().some((s) => s.track && s.track.kind === 'audio'),
      });
    });
    return {
      peerId: peerIdRef.current,
      activeChannel: activeChannelRef.current,
      micAvailable,
      micTrackEnabled: micTrackRef.current?.enabled ?? false,
      micTrackReadyState: micTrackRef.current?.readyState ?? 'none',
      micLevel,
      relayOnline,
      totalPeers: Object.values(peersMapRef.current).reduce((acc, l) => acc + l.length, 0),
      connections: conns,
      mediaKeepalive: mediaKeepalive.getDiagnostics(),
    };
  }, [micAvailable, micLevel, relayOnline]);

  const value: CommContextType = {
    enabled,
    setEnabled,
    forceReconnect,
    getDiagnostics,
    volume,
    setVolume,
    sfxEnabled,
    setSfxEnabled,
    wakeLockActive,
    relayOnline,
    identified: Boolean(identifiedUser || (peerIdRef.current && !peerIdRef.current.startsWith('anon#'))),
    channels,
    subscribedChannels,
    activeChannel,
    setActiveChannel,
    toggleChannel,
    channelPeers: peersMap,
    remotePeers: remotePeersMap,
    mode,
    setMode,
    speaking,
    remoteTransmitting,
    activeSpeakerName,
    startSpeaking,
    stopSpeaking,
    transmissionLocked,
    setTransmissionLocked,
    pttKey,
    setPttKey,
    muted,
    setMuted,
    micAvailable,
    audioBlocked,
    micLevel,
    resumeAllAudio,
    requestWakeLock,
    releaseWakeLock,
    testLoopback,
    isTestingLoopback,
    onlineCollabIds,
    directChannels: Object.values<CommChannel>(directChannels),
    joinTaskChannel,
    openDirectChannel,
    closeDirectChannel,
    leaveAll,
    audioOutputDevices,
    audioOutputDeviceId,
    isLoudspeaker,
    setAudioOutputDevice,
    toggleLoudspeaker,
    refreshAudioOutputDevices,
    myAssignedTasks,
    myCurrentTask,
  };

  return <CommContext.Provider value={value}>{children}</CommContext.Provider>;
};

export const useCommunication = () => {
  const context = useContext(CommContext);
  if (!context) throw new Error('useCommunication must be used within a CommunicationProvider');
  return context;
};
