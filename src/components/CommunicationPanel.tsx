import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useCommunication } from '../context/CommunicationContext';
import { useApp } from '../context/AppContext';
import { collabMenuOnContext } from '../utils/collabContextMenu';
import {
  Radio,
  Mic,
  MicOff,
  Users,
  X,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Headphones,
  ChevronUp,
  ChevronDown,
  LogOut,
  GripVertical,
  Maximize2,
  Minimize2,
  Sparkles,
  Power,
  Keyboard,
  PhoneCall,
  PhoneOff,
  Send,
} from 'lucide-react';

const FLOATING_POS_KEY = 'dimensio_ptt_floating_pos_v1';

const PTT_KEY_OPTIONS = ['Space', 'F2', 'F3', 'Z', 'X', 'C', 'V', 'B', 'T', 'G'];
const PTT_KEY_LABELS: Record<string, string> = {
  Space: 'Espaço',
  Shift: 'Shift',
  Control: 'Ctrl',
  Alt: 'Alt',
  F2: 'F2',
  F3: 'F3',
  Z: 'Z',
  X: 'X',
  C: 'C',
  V: 'V',
  B: 'B',
  T: 'T',
  G: 'G',
};

interface CommunicationPanelProps {
  isFloating?: boolean;
}

export const CommunicationPanel: React.FC<CommunicationPanelProps> = ({ isFloating = true }) => {
  const {
    enabled,
    setEnabled,
    volume,
    setVolume,
    wakeLockActive,
    relayOnline,
    identified,
    channels,
    subscribedChannels,
    activeChannel,
    setActiveChannel,
    toggleChannel,
    channelPeers,
    remotePeers,
    mode,
    setMode,
    speaking,
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
    testLoopback,
    isTestingLoopback,
    leaveAll,
    onlineCollabIds,
    directChannels,
    openDirectChannel,
    closeDirectChannel,
  } = useCommunication();
  const { state, showNotice, identifiedUser } = useApp();

  // Colaboradores online no rádio, prontos para um canal direto.
  const onlineCollabs = useMemo(() => {
    return state.collaborators
      .filter((c) => onlineCollabIds.has(c.id) || onlineCollabIds.has(c.login || '') || onlineCollabIds.has(c.registration || ''))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }, [state.collaborators, onlineCollabIds]);

  const [showCollabPicker, setShowCollabPicker] = useState(false);

  if (state.showRadioModule === false || isFloating) return null;

  const webhookConfigured = !!state.onlineSpreadsheet?.webhookUrl;

  // Widget display modes: 'floating' (compact YouTube PiP style bar), 'expanded' (full panel), 'docked' (icon badge only in dock)
  const [viewMode, setViewMode] = useState<'floating' | 'expanded' | 'docked'>('docked');

  // Listen to custom window events from FloatingQuickDock and other controls
  useEffect(() => {
    const handleToggle = () => {
      setViewMode((prev) => (prev === 'docked' ? 'floating' : 'docked'));
    };
    const handleOpen = () => setViewMode('floating');
    const handleExpand = () => setViewMode('expanded');
    const handleClose = () => setViewMode('docked');

    window.addEventListener('dimensio-toggle-radio-pip', handleToggle);
    window.addEventListener('dimensio-open-radio-pip', handleOpen);
    window.addEventListener('dimensio-expand-radio-pip', handleExpand);
    window.addEventListener('dimensio-close-radio-pip', handleClose);

    return () => {
      window.removeEventListener('dimensio-toggle-radio-pip', handleToggle);
      window.removeEventListener('dimensio-open-radio-pip', handleOpen);
      window.removeEventListener('dimensio-expand-radio-pip', handleExpand);
      window.removeEventListener('dimensio-close-radio-pip', handleClose);
    };
  }, []);

  // Dragging state for floating PiP overlay
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const maxX = typeof window !== 'undefined' ? Math.max(12, window.innerWidth - 300) : 300;
    const maxY = typeof window !== 'undefined' ? Math.max(80, window.innerHeight - 300) : 300;
    try {
      const saved = localStorage.getItem(FLOATING_POS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
          return {
            x: Math.max(12, Math.min(maxX, parsed.x)),
            y: Math.max(12, Math.min(maxY, parsed.y)),
          };
        }
      }
    } catch {}
    // Default: Middle-Right, clear above bottom dock
    return { x: maxX, y: maxY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({
    startX: 0,
    startY: 0,
    posX: 0,
    posY: 0,
  });

  // Keep position bounded within window viewport
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => ({
        x: Math.max(12, Math.min(window.innerWidth - 320, prev.x)),
        y: Math.max(12, Math.min(window.innerHeight - 220, prev.y)),
      }));
    };
    handleResize(); // Constrain on mount in case window size changed
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save floating position
  useEffect(() => {
    try {
      localStorage.setItem(FLOATING_POS_KEY, JSON.stringify(position));
    } catch {}
  }, [position]);

  // Global pointerup to release PTT and end drag
  useEffect(() => {
    const up = () => {
      if (mode === 'ptt') stopSpeaking();
      setIsDragging(false);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [mode, stopSpeaking]);

  // Drag handlers
  const handleDragStart = (e: React.PointerEvent) => {
    // Only drag when clicking the handle or header
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const newX = Math.max(12, Math.min(window.innerWidth - 320, dragStartRef.current.posX + dx));
    const newY = Math.max(12, Math.min(window.innerHeight - 180, dragStartRef.current.posY + dy));
    setPosition({ x: newX, y: newY });
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  const onlineCount = (chId: string) => (channelPeers[chId] || []).length + (subscribedChannels.includes(chId) ? 1 : 0);
  const currentActiveChannelObj = channels.find((c) => c.id === activeChannel);
  const activePeersCount = activeChannel ? (remotePeers[activeChannel] || []).filter((p) => p.status === 'connected').length : 0;
  // Contagem de quem está realmente no rádio: você + colegas conectados.
  const activeTotalCount = activeChannel && subscribedChannels.includes(activeChannel) ? activePeersCount + 1 : activePeersCount;

  // Abre um canal direto com um colega a partir do próprio rádio.
  const openDirectWith = (collabId: string, name: string) => {
    setShowCollabPicker(false);
    openDirectChannel(collabId, name);
  };

  // Encerra o canal direto ativo (quem iniciou OU quem foi acionado).
  const endActiveDirectChannel = () => {
    const ch = currentActiveChannelObj;
    if (!ch || ch.kind !== 'direct') return;
    closeDirectChannel(ch.collabId || '');
    showNotice(`Canal direto com ${(ch.label || '').replace(/^Direto:\s*/i, '')} encerrado.`);
  };

  // Resolve o colaborador associado a um peer do rádio (id `collabId#instância`).
  const collabForPeer = (peerId: string) => {
    const base = String(peerId).split('#')[0];
    if (!base || base === 'anon') return undefined;
    return state.collaborators.find((c) => c.id === base || c.login === base || c.registration === base);
  };

  // Seletor de colegas para iniciar um canal direto pelo rádio.
  const renderCollabPicker = () => {
    if (!showCollabPicker) return null;
    return (
      <div className="absolute right-0 top-full mt-1.5 w-64 max-w-[calc(100vw-2rem)] z-30 bg-[var(--paper)] border border-[var(--line)] rounded-xl shadow-2xl overflow-hidden">
        <div className="px-3 py-2 bg-[var(--bg)] border-b border-[var(--line)] text-[10px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
          <PhoneCall className="w-3 h-3 text-[var(--primary)]" />
          Falar em canal direto com:
        </div>
        <div className="max-h-44 overflow-y-auto divide-y divide-[var(--line)]">
          {onlineCollabs.length === 0 ? (
            <div className="px-3 py-3 text-[10px] text-[var(--muted)] italic text-center">
              Nenhum colega online no rádio agora.
            </div>
          ) : (
            onlineCollabs.map((c) => {
              const isSelf = identifiedUser?.collaboratorId === c.id || identifiedUser?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={isSelf}
                  onClick={() => openDirectWith(c.id, c.name)}
                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg)] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-black text-[var(--ink)]">{c.name}</span>
                    <span className="block text-[9.5px] font-mono text-[var(--muted)]">
                      {c.role || 'Op'} • Turno {c.shift || '—'}
                    </span>
                  </span>
                  <Send className="w-3 h-3 text-[var(--primary)] shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Faixa que indica claramente em qual canal o rádio está falando agora.
  const renderActiveChannelIndicator = () => {
    if (!currentActiveChannelObj) return null;
    return (
      <div
        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-[11px] font-black uppercase tracking-wide ${
          currentActiveChannelObj.kind === 'direct'
            ? 'bg-sky-500/10 border-sky-500/40 text-sky-700 dark:text-sky-300'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
        }`}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <Radio className={`w-3.5 h-3.5 shrink-0 ${speaking ? 'animate-pulse' : ''}`} />
          <span className="truncate">
            Transmitindo no canal: <strong>{currentActiveChannelObj.label}</strong>
          </span>
          {currentActiveChannelObj.kind === 'direct' && (
            <span className="px-1.5 py-0.5 rounded bg-sky-600 text-white text-[9px] font-black uppercase shrink-0">
              Direto
            </span>
          )}
        </span>
        {currentActiveChannelObj.kind === 'direct' && (
          <button
            type="button"
            onClick={endActiveDirectChannel}
            className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[9.5px] font-black flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
            title="Encerrar este canal direto"
          >
            <PhoneOff className="w-3 h-3" />
            Encerrar
          </button>
        )}
      </div>
    );
  };

  // Dedicated full-featured embedded renderer for portal and in-page communication cards
  if (!isFloating) {
    if (!enabled) {
      return (
        <div className="p-4 sm:p-5 bg-[var(--paper)] border border-[var(--line)] rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <Power className="w-5 h-5" />
            </div>
            <div>
              <div className="font-black text-sm uppercase tracking-wide text-[var(--ink)]">Rádio PTT Desligado</div>
              <div className="text-xs text-[var(--muted)]">Ative o rádio para comunicar-se por voz em tempo real com sua equipe</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEnabled(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs cursor-pointer transition-all shadow-xs flex items-center gap-2"
          >
            <Power className="w-4 h-4" />
            Ligar Rádio PTT
          </button>
        </div>
      );
    }

    return (
      <div className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-2xl shadow-xs overflow-hidden select-none">
        {/* Embedded Header */}
        <div className="px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--line)] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-xs sm:text-sm uppercase tracking-wide text-[var(--ink)] truncate">
                  Dimensio Talk
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-ping" />
              </div>
              <div className="text-[10px] text-[var(--muted)] font-medium flex items-center gap-2 flex-wrap">
                {relayOnline ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-emerald-500" /> WebRTC Sinal Ativo
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                    <WifiOff className="w-3 h-3 text-amber-500" /> Sem servidor de sinal
                  </span>
                )}
                {wakeLockActive && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[9px] flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Segundo Plano Ativo
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCollabPicker((v) => !v)}
                className="px-2.5 py-1.5 rounded-xl border border-[var(--line)] bg-[var(--paper)] hover:bg-[var(--line)] text-[var(--ink)] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Iniciar um canal direto com um colega online"
              >
                <PhoneCall className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span className="hidden sm:inline">Falar com...</span>
              </button>
              {renderCollabPicker()}
            </div>
            <button
              type="button"
              onClick={() => setEnabled(false)}
              className="px-2.5 py-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Desligar Rádio PTT"
            >
              <Power className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Desligar Rádio</span>
            </button>
          </div>
        </div>

        {/* Embedded Body */}
        <div className="p-4 sm:p-5 space-y-4">
          {/* Autoplay blocked banner */}
          {audioBlocked && (
            <button
              type="button"
              onClick={resumeAllAudio}
              className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer animate-bounce"
            >
              <Volume2 className="w-4 h-4 shrink-0" />
              <span>Clique aqui para ativar o som do áudio (Bloqueado pelo navegador)</span>
            </button>
          )}

          {/* Controls Bar: Channel Select, Mode, Mute, Volume */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Channel Selector */}
            <div className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--line)] px-3 py-2 rounded-xl">
              <Users className="w-4 h-4 text-[var(--primary)] shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-black uppercase tracking-wider text-[var(--muted)]">Canal Ativo</div>
                <select
                  value={activeChannel || ''}
                  onChange={(e) => {
                    const chId = e.target.value;
                    if (chId) {
                      if (!subscribedChannels.includes(chId)) toggleChannel(chId);
                      setActiveChannel(chId);
                    }
                  }}
                  className="bg-transparent font-black text-xs text-[var(--ink)] focus:outline-none w-full truncate cursor-pointer"
                >
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id} className="bg-[var(--paper)] text-[var(--ink)]">
                      {ch.label} ({onlineCount(ch.id)} online)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Audio Mode (PTT / Aberto) */}
            <div className="flex items-center justify-between gap-1.5 bg-[var(--surface-2)] border border-[var(--line)] p-1.5 rounded-xl">
              <div className="flex items-center gap-1 w-full">
                <button
                  type="button"
                  onClick={() => setMode('ptt')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer text-center ${
                    mode === 'ptt'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  PTT (Segurar)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('open')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer text-center ${
                    mode === 'open'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Aberto (Voz)
                </button>
              </div>
            </div>

            {/* Continuous Lock & Mute */}
            <div className="flex items-center gap-1.5">
              {mode === 'ptt' && (
                <button
                  type="button"
                  onClick={() => {
                    setTransmissionLocked(!transmissionLocked);
                    showNotice(
                      transmissionLocked
                        ? 'Transmissão contínua desativada'
                        : 'Transmissão contínua ativada (permanece falando sem segurar)'
                    );
                  }}
                  className={`flex-1 py-2 px-2.5 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                    transmissionLocked
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                      : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                  title={
                    transmissionLocked
                      ? 'Trava contínua ligada (clique para desligar)'
                      : 'Ativar trava de transmissão contínua'
                  }
                >
                  <Radio className={`w-3.5 h-3.5 ${transmissionLocked ? 'animate-pulse' : ''}`} />
                  <span className="truncate">{transmissionLocked ? 'Trava PTT: ON' : 'Travar PTT'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMuted(!muted);
                  showNotice(muted ? 'Microfone ativado' : 'Microfone silenciado');
                }}
                className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                  muted
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                    : 'bg-[var(--surface-2)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                title={muted ? 'Desmutar microfone' : 'Mutar microfone'}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span className="hidden sm:inline">{muted ? 'Mutado' : 'Mutar'}</span>
              </button>
            </div>

            {/* Volume Control */}
            <div className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--line)] px-3 py-1.5 rounded-xl">
              <button
                type="button"
                onClick={() => setVolume(volume > 0 ? 0 : 1)}
                className="text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                title={volume === 0 ? 'Desmutar alto-falante' : 'Mutar alto-falante'}
              >
                {volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-500" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[var(--primary)]" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[var(--line)] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                title={`Volume do Rádio: ${Math.round(volume * 100)}%`}
              />
              <span className="text-[10px] font-mono font-bold text-[var(--muted)] w-8 text-right shrink-0">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>

          {/* Active Channel Indicator + Direct Channel Control */}
          {renderActiveChannelIndicator()}

          {/* MAIN PTT HOLD-TO-TALK BUTTON (LARGE TOUCH-FRIENDLY BUTTON) */}
          {mode === 'ptt' ? (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                if (transmissionLocked) {
                  setTransmissionLocked(!speaking);
                } else {
                  startSpeaking();
                }
              }}
              onPointerUp={transmissionLocked ? undefined : stopSpeaking}
              onPointerLeave={transmissionLocked ? undefined : stopSpeaking}
              onPointerCancel={transmissionLocked ? undefined : stopSpeaking}
              className={`w-full py-6 sm:py-7 px-4 rounded-2xl font-black text-sm sm:text-base uppercase tracking-wider cursor-pointer select-none transition-all duration-100 border flex flex-col sm:flex-row items-center justify-center gap-2.5 shadow-lg active:scale-[0.98] ${
                speaking
                  ? 'bg-rose-600 text-white border-rose-400 ring-8 ring-rose-500/30 animate-pulse scale-[1.01]'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 hover:shadow-emerald-500/25'
              }`}
            >
              {speaking ? (
                <>
                  <Mic className="w-6 h-6 animate-bounce text-white" />
                  <span className="text-base sm:text-lg font-black tracking-widest">
                    {transmissionLocked ? '● TRANSMITINDO (MODO CONTÍNUO)' : '● TRANSMITINDO VOZ...'}
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-6 h-6 text-emerald-200" />
                  <span className="font-extrabold">
                    {transmissionLocked
                      ? 'TOQUE PARA INICIAR TRANSMISSÃO'
                      : 'SEGURE PARA FALAR (APERTE E FALE)'}
                  </span>
                </>
              )}
            </button>
          ) : (
            <div
              className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-wide border text-center transition-colors ${
                muted
                  ? 'bg-slate-100 dark:bg-slate-800 text-[var(--muted)] border-[var(--line)]'
                  : 'bg-sky-600 text-white border-sky-500 shadow-md'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 animate-pulse" />}
                <span>{muted ? 'Microfone Silenciado (Mute)' : 'Microfone Aberto — Transmitindo Som Continuamente'}</span>
              </div>
            </div>
          )}

          {/* VU Meter & Microfone Test */}
          <div className="flex items-center justify-between gap-3 p-3 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl text-xs">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Mic className={`w-4 h-4 ${micLevel > 5 ? 'text-emerald-500' : 'text-[var(--muted)]'}`} />
              <div className="flex-1 bg-[var(--line)] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-75"
                  style={{ width: `${Math.max(4, micLevel)}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-[var(--muted)] w-8 text-right shrink-0">
                {micLevel}%
              </span>
            </div>

            <button
              type="button"
              onClick={testLoopback}
              disabled={isTestingLoopback}
              className="px-3 py-1.5 bg-[var(--paper)] hover:bg-[var(--line)] border border-[var(--line)] rounded-lg text-[11px] font-bold text-[var(--ink)] cursor-pointer shrink-0 transition-colors disabled:opacity-50"
            >
              {isTestingLoopback ? 'Testando Voz...' : 'Testar Microfone'}
            </button>
          </div>

          {/* Active Peers in Channel */}
          {activeChannel && (
            <div className="border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface-2)]">
              <div className="px-3 py-2 bg-[var(--bg)] font-black text-[11px] uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)] flex items-center justify-between">
                <span>Pessoas no Canal: {currentActiveChannelObj?.label || 'Canal'}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                  ● {activeTotalCount} online{activePeersCount > 0 ? ` (você + ${activePeersCount})` : ''}
                </span>
              </div>
              <div className="p-3">
                {activePeersCount > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {remotePeers[activeChannel]?.map((p) => {
                      const peerCollab = collabForPeer(p.id);
                      return (
                        <div
                          key={p.id}
                          onContextMenu={peerCollab ? collabMenuOnContext(peerCollab.id) : undefined}
                          className="px-2.5 py-1 rounded-lg bg-[var(--paper)] border border-[var(--line)] flex items-center gap-2 text-xs cursor-default"
                          title={peerCollab ? 'Clique com o botão direito para opções do colaborador' : undefined}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              p.status === 'connected'
                                ? 'bg-emerald-500'
                                : p.status === 'connecting'
                                ? 'bg-amber-400 animate-pulse'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span className="font-black text-[var(--ink)]">{p.name}</span>
                          <span className="text-[10px] text-[var(--muted)] font-mono">({p.role || 'Op'})</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-2 text-xs text-[var(--muted)] italic">
                    Apenas você está neste canal no momento.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If floating and turned off or docked into bottom quick dock, do not render floating obstacle on desktop
  if (isFloating && (!enabled || viewMode === 'docked')) {
    return null;
  }

  return (
    <div
      style={
        isFloating
          ? {
              position: 'fixed',
              left: `${position.x}px`,
              top: `${position.y}px`,
            }
          : undefined
      }
      className={
        isFloating
          ? 'no-print z-[9999] select-none transition-shadow duration-200'
          : 'w-full select-none'
      }
    >
      {/* ================= FLOATING PIP CARD (COMPACT YOUTUBE MINI PLAYER STYLE) ================= */}
      {viewMode === 'floating' && (
        <div
          className={`${
            isFloating ? 'w-[270px]' : 'w-full'
          } bg-[var(--paper)] dark:bg-slate-900/95 backdrop-blur-md border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden transition-all duration-150 ${
            speaking ? 'ring-2 ring-rose-500 shadow-rose-500/20' : ''
          } ${isDragging ? 'opacity-90 shadow-2xl scale-[1.01]' : ''}`}
        >
          {/* Draggable Header */}
          <div
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            className="flex items-center justify-between px-2.5 py-1.5 bg-[var(--bg)] border-b border-[var(--line)] cursor-grab active:cursor-grabbing hover:bg-[var(--primary-soft)] transition-colors"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <GripVertical className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
              <Radio className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
              <div className="truncate font-black text-[10.5px] uppercase tracking-wide text-[var(--ink)]">
                Dimensio Talk
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            </div>

            {/* Header controls */}
            <div className="flex items-center gap-0.5 relative" onPointerDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowCollabPicker((v) => !v)}
                className="p-1 rounded-lg hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                title={showCollabPicker ? 'Fechar seletor de canal direto' : 'Falar em canal direto com um colega'}
              >
                <PhoneCall className="w-3 h-3" />
              </button>
              {renderCollabPicker()}
              <button
                onClick={() => setViewMode('expanded')}
                className="p-1 rounded-lg hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                title="Expandir painel completo de canais"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setViewMode('docked')}
                className="p-1 rounded-lg hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                title="Minimizar para barra flutuante"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => setEnabled(false)}
                className="p-1 rounded-lg hover:bg-rose-500/15 text-[var(--muted)] hover:text-rose-500 cursor-pointer transition-colors"
                title="Desligar Rádio PTT"
              >
                <Power className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Body content */}
          <div className="p-2.5 space-y-2">
            {/* Audio Autoplay Unblock Banner */}
            {audioBlocked && (
              <button
                onClick={resumeAllAudio}
                className="w-full py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[10px] rounded-xl flex items-center justify-center gap-1.5 shadow-md cursor-pointer animate-bounce"
                title="Clique para habilitar reprodução de áudio"
              >
                <Volume2 className="w-3.5 h-3.5 shrink-0" />
                <span>Clique para Ativar Som</span>
              </button>
            )}

            {/* Active Channel Selector + Mute */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 flex-1 min-w-0 bg-[var(--bg)] border border-[var(--line)] px-2 py-1 rounded-xl">
                <Users className="w-3 h-3 text-[var(--primary)] shrink-0" />
                <select
                  value={activeChannel || ''}
                  onChange={(e) => {
                    const chId = e.target.value;
                    if (chId) {
                      if (!subscribedChannels.includes(chId)) toggleChannel(chId);
                      setActiveChannel(chId);
                    }
                  }}
                  className="bg-transparent font-bold text-[10.5px] text-[var(--ink)] focus:outline-none w-full truncate cursor-pointer"
                >
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id} className="bg-[var(--paper)] text-[var(--ink)]">
                      {ch.label} ({onlineCount(ch.id)} on)
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Mute Toggle */}
              <button
                onClick={() => {
                  setMuted(!muted);
                  showNotice(muted ? 'Microfone ativado' : 'Microfone silenciado');
                }}
                className={`p-1.5 rounded-xl border cursor-pointer transition-colors shrink-0 ${
                  muted
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                title={muted ? 'Desmutar Microfone' : 'Silenciar Microfone'}
              >
                {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Volume Control Bar */}
            <div className="flex items-center gap-1.5 bg-[var(--bg)] border border-[var(--line)] px-2 py-0.5 rounded-xl">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 1)}
                className="text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                title={volume === 0 ? 'Desmutar alto-falante' : 'Mutar alto-falante'}
              >
                {volume === 0 ? <VolumeX className="w-3 h-3 text-rose-500" /> : <Volume2 className="w-3 h-3 text-[var(--primary)]" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-[var(--line)] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                title={`Volume do Rádio: ${Math.round(volume * 100)}%`}
              />
              <span className="text-[9.5px] font-mono font-bold text-[var(--muted)] w-7 text-right">
                {Math.round(volume * 100)}%
              </span>
            </div>

            {/* Active channel indicator (floating) */}
            {renderActiveChannelIndicator()}

            {/* PTT HOLD-TO-TALK BUTTON (COMPACT STREAMLINED STYLE) */}
            <button
              onPointerDown={(e) => {
                e.preventDefault();
                if (transmissionLocked) {
                  setTransmissionLocked(!speaking);
                } else {
                  startSpeaking();
                }
              }}
              onPointerUp={transmissionLocked ? undefined : stopSpeaking}
              onPointerLeave={transmissionLocked ? undefined : stopSpeaking}
              onPointerCancel={transmissionLocked ? undefined : stopSpeaking}
              className={`w-full py-3 px-2 rounded-xl font-black text-[11px] uppercase tracking-wider cursor-pointer select-none transition-all duration-100 border flex items-center justify-center gap-2 shadow-md active:scale-[0.97] ${
                speaking
                  ? 'bg-rose-600 text-white border-rose-400 ring-4 ring-rose-500/30 animate-pulse scale-[1.02]'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 hover:shadow-emerald-500/20'
              }`}
              title={
                transmissionLocked
                  ? speaking
                    ? 'Transmissão contínua ativa. Toque para interromper.'
                    : 'Transmissão contínua: toque para começar a transmitir sem segurar'
                  : 'Segure este botão para falar em tempo real'
              }
            >
              {speaking ? (
                <>
                  <Mic className="w-4 h-4 animate-bounce text-white" />
                  <span className="text-xs font-black tracking-wider">
                    {transmissionLocked ? 'TRANSMITINDO (CONTÍNUO)' : 'TRANSMITINDO...'}
                  </span>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4 text-emerald-200" />
                  <span className="text-[11px] font-black">
                    {transmissionLocked ? 'TOQUE P/ TRANSMITIR' : 'APERTE PARA FALAR'}
                  </span>
                </>
              )}
            </button>

            {/* Audio Wave Meter / Peer Status */}
            <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-[var(--line)] text-[9.5px]">
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Mic className={`w-2.5 h-2.5 ${micLevel > 5 ? 'text-emerald-500' : 'text-[var(--muted)]'}`} />
                <div className="flex-1 bg-[var(--line)] h-1 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-75"
                    style={{ width: `${Math.max(4, micLevel)}%` }}
                  />
                </div>
              </div>

              <span className="font-bold text-[var(--muted)] text-[9.5px] truncate">
                {activeTotalCount > 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                    ● {activeTotalCount} online
                  </span>
                ) : (
                  'Aguardando'
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ================= EXPANDED FULL PANEL MODE ================= */}
      {viewMode === 'expanded' && (
        <div className="w-80 max-w-[calc(100vw-2rem)] bg-[var(--paper)] dark:bg-slate-900/95 border border-[var(--line)] rounded-2xl shadow-2xl overflow-hidden text-xs">
          {/* Draggable Header */}
          <div
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--line)] bg-[var(--bg)] cursor-grab active:cursor-grabbing hover:bg-[var(--primary-soft)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-[var(--muted)]" />
              <Headphones className="w-4 h-4 text-[var(--primary)]" />
              <div>
                <div className="font-black text-[var(--ink)] uppercase tracking-wide">Dimensio Talk</div>
                <div className="text-[10px] text-[var(--muted)] font-bold flex items-center gap-1.5 flex-wrap">
                  {relayOnline ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <Wifi className="w-3 h-3 text-emerald-500" /> Canal ativo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <WifiOff className="w-3 h-3 text-amber-500" /> Sem canal de sinal
                    </span>
                  )}
                  {wakeLockActive && (
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[9px] flex items-center gap-1" title="Screen Wake Lock ativo: O sistema operacional não suspenderá a aplicação">
                      <Sparkles className="w-2.5 h-2.5" /> Sem Hibernação
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => setViewMode('floating')}
                className="p-1.5 rounded-lg hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                title="Minimizar para botão flutuante"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEnabled(false)}
                className="p-1.5 rounded-lg hover:bg-rose-500/15 text-[var(--muted)] hover:text-rose-500 cursor-pointer transition-colors"
                title="Desligar Rádio PTT"
              >
                <Power className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('docked')}
                className="p-1.5 rounded-lg hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                title="Minimizar para ícone"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-2.5 space-y-2.5">
            {!identified && (
              <div className="px-2.5 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[10px] text-sky-700 dark:text-sky-300 font-bold flex items-center justify-between gap-2">
                <span>Rádio Ativo como <strong>Operador Visitante</strong></span>
              </div>
            )}

            {/* Relay unavailable — the most common reason the radio "won't connect" across devices */}
            {enabled && !relayOnline && (
              <div className="px-2.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] font-bold text-amber-700 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5">
                  <WifiOff className="w-3.5 h-3.5 shrink-0" />
                  <span>Sem canal de sinal — o rádio entre celulares não conecta.</span>
                </div>
                <div className="text-amber-600/90 dark:text-amber-400/90 font-semibold leading-snug">
                  {webhookConfigured
                    ? 'O webhook não está respondendo. Verifique a implantação do Apps Script (URL /exec) e a conexão com a planilha online.'
                    : 'Configure o Webhook do Google Apps Script em Configurações → Planilha Online para habilitar o rádio entre dispositivos.'}
                </div>
              </div>
            )}

            {/* Audio Autoplay Unblock Banner */}
            {audioBlocked && (
              <button
                onClick={resumeAllAudio}
                className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer animate-bounce"
                title="Clique para habilitar reprodução de áudio"
              >
                <Volume2 className="w-4 h-4 shrink-0" />
                <span>Clique para Ativar Som do Rádio</span>
              </button>
            )}

            {/* Mode + mute row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-0.5 bg-[var(--bg)] border border-[var(--line)] p-0.5 rounded-xl">
                <button
                  onClick={() => setMode('ptt')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-colors ${
                    mode === 'ptt'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  PTT
                </button>
                <button
                  onClick={() => setMode('open')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer transition-colors ${
                    mode === 'open'
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Aberto
                </button>
              </div>
              {mode === 'ptt' && (
                <button
                  onClick={() => {
                    setTransmissionLocked(!transmissionLocked);
                    showNotice(transmissionLocked ? 'Transmissão contínua desativada' : 'Transmissão contínua ativada (modo de transmissão)');
                  }}
                  className={`p-1.5 rounded-lg border cursor-pointer transition-colors flex items-center gap-1.5 ${
                    transmissionLocked
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                      : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)]'
                  }`}
                  title={transmissionLocked ? 'Desativar transmissão contínua (modo de transmissão)' : 'Ativar transmissão contínua: permanece transmitindo em segundo plano'}
                >
                  <Radio className={`w-4 h-4 ${transmissionLocked ? 'animate-pulse' : ''}`} />
                </button>
              )}
              <button
                onClick={() => {
                  setMuted(!muted);
                  showNotice(muted ? 'Microfone ativado' : 'Microfone silenciado');
                }}
                className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                  muted
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)]'
                }`}
                title={muted ? 'Desmutar' : 'Mutar'}
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <button
                onClick={leaveAll}
                className="p-1.5 rounded-lg border border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] hover:text-rose-500 cursor-pointer transition-colors"
                title="Sair de todos os canais"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* PTT keyboard shortcut (desktop): hold to talk */}
            <div className="flex items-center justify-between gap-2 bg-[var(--bg)] border border-[var(--line)] px-2.5 py-1.5 rounded-xl">
              <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                <Keyboard className="w-3.5 h-3.5" />
                Falar (segure)
              </span>
              <select
                value={pttKey}
                onChange={(e) => {
                  setPttKey(e.target.value);
                  showNotice(`PTT: segure ${PTT_KEY_LABELS[e.target.value] || e.target.value} para falar`);
                }}
                className="bg-[var(--paper)] border border-[var(--line)] rounded-lg px-2 py-1 text-[10px] font-black text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[var(--primary)]"
                title="Atalho de segurar-para-falar no desktop"
              >
                {PTT_KEY_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {PTT_KEY_LABELS[k] || k}
                  </option>
                ))}
              </select>
            </div>

            {/* Volume Control Bar */}
            <div className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--line)] px-2.5 py-1.5 rounded-xl">
              <button
                onClick={() => setVolume(volume > 0 ? 0 : 1)}
                className="text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
                title={volume === 0 ? 'Desmutar alto-falante' : 'Mutar alto-falante'}
              >
                {volume === 0 ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-[var(--primary)]" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[var(--line)] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                title={`Volume do Rádio: ${Math.round(volume * 100)}%`}
              />
              <span className="text-[10px] font-mono font-bold text-[var(--muted)] w-8 text-right">
                {Math.round(volume * 100)}%
              </span>
            </div>

            {/* Channel direct picker */}
            <div className="relative flex items-center justify-between gap-2">
              <span className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-[var(--primary)]" />
                Canal Direto
              </span>
              <button
                onClick={() => setShowCollabPicker((v) => !v)}
                className={`px-2.5 py-1 rounded-lg border text-[10px] font-black cursor-pointer transition-colors flex items-center gap-1 ${
                  showCollabPicker
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                }`}
              >
                {showCollabPicker ? <X className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                {showCollabPicker ? 'Fechar' : 'Falar com...'}
              </button>
              {renderCollabPicker()}
            </div>

            {/* Channels List */}
            <div className="border border-[var(--line)] rounded-xl overflow-hidden">
              <div className="px-2.5 py-1.5 bg-[var(--bg)] font-black text-[10px] uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5 border-b border-[var(--line)]">
                <Users className="w-3 h-3 text-[var(--primary)]" />
                Canais de Áudio
              </div>
              <div className="max-h-44 overflow-y-auto divide-y divide-[var(--line)]">
                {channels.map((ch) => {
                  const joined = subscribedChannels.includes(ch.id);
                  const count = onlineCount(ch.id);
                  const isActive = activeChannel === ch.id;
                  const isDirect = ch.kind === 'direct';
                  return (
                    <div
                      key={ch.id}
                      onClick={() => setActiveChannel(joined ? ch.id : null)}
                      className={`flex items-center justify-between gap-2 px-2.5 py-2 cursor-pointer transition-colors ${
                        isActive ? 'bg-[var(--primary-soft)]' : 'hover:bg-[var(--bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            joined ? (isDirect ? 'bg-sky-500' : 'bg-emerald-500') : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        />
                        <span className="truncate font-bold text-[var(--ink)]">{ch.label}</span>
                        <span className="text-[10px] text-[var(--muted)] shrink-0">
                          {ch.kind === 'task' ? 'Tarefa' : ch.kind === 'direct' ? 'Direto' : 'Geral'}
                        </span>
                      </div>
                      {isDirect && joined ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeDirectChannel(ch.collabId || '');
                            showNotice(`Canal direto com ${(ch.label || '').replace(/^Direto:\s*/i, '')} encerrado.`);
                          }}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition-colors border bg-rose-500/15 border-rose-500/40 text-rose-600 dark:text-rose-400 flex items-center gap-1"
                          title="Encerrar este canal direto"
                        >
                          <PhoneOff className="w-3 h-3" />
                          Encerrar
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleChannel(ch.id);
                          }}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black cursor-pointer transition-colors border ${
                            joined
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                              : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                          }`}
                          title={joined ? 'Sair do canal' : 'Entrar no canal'}
                        >
                          {joined ? `${count} online` : 'Entrar'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active channel users */}
            {activeChannel && (
              <div className="border border-[var(--line)] rounded-xl overflow-hidden">
                <div className="px-2.5 py-1.5 bg-[var(--bg)] font-black text-[10px] uppercase tracking-wider text-[var(--muted)] border-b border-[var(--line)]">
                  {currentActiveChannelObj?.label || 'Canal'} — {activeTotalCount} online
                  {activePeersCount > 0 ? ` (você + ${activePeersCount})` : ''}
                </div>
                {activePeersCount ? (
                  <div className="divide-y divide-[var(--line)] max-h-32 overflow-y-auto">
                    {remotePeers[activeChannel]?.map((p) => {
                      const peerCollab = collabForPeer(p.id);
                      return (
                        <div
                          key={p.id}
                          onContextMenu={peerCollab ? collabMenuOnContext(peerCollab.id) : undefined}
                          className="flex items-center justify-between px-2.5 py-1.5 cursor-default"
                          title={peerCollab ? 'Clique com o botão direito para opções do colaborador' : undefined}
                        >
                          <div className="min-w-0">
                            <div className="truncate font-bold text-[var(--ink)]">{p.name}</div>
                            <div className="text-[10px] text-[var(--muted)]">{p.role || 'Colaborador'}</div>
                          </div>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              p.status === 'connected'
                                ? 'bg-emerald-500'
                                : p.status === 'connecting'
                                ? 'bg-amber-400 animate-pulse'
                                : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                            title={
                              p.status === 'connected'
                                ? 'Conectado'
                                : p.status === 'connecting'
                                ? 'Conectando...'
                                : 'Sem conexão'
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-2.5 py-3 text-center text-[11px] text-[var(--muted)]">
                    {micAvailable && mode === 'open'
                      ? 'Aguardando colegas entrarem no canal...'
                      : 'Apenas você neste canal ainda.'}
                  </div>
                )}
              </div>
            )}

            {/* Active channel indicator + Direct Channel control */}
            {renderActiveChannelIndicator()}

            {/* PTT Main Action Button */}
            {mode === 'ptt' ? (
              <button
                onPointerDown={(e) => {
                  e.preventDefault();
                  if (transmissionLocked) {
                    setTransmissionLocked(!speaking);
                  } else {
                    startSpeaking();
                  }
                }}
                onPointerUp={transmissionLocked ? undefined : stopSpeaking}
                onPointerLeave={transmissionLocked ? undefined : stopSpeaking}
                onPointerCancel={transmissionLocked ? undefined : stopSpeaking}
                className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wide cursor-pointer select-none transition-all active:scale-[0.98] border ${
                  speaking
                    ? 'bg-rose-600 text-white border-rose-400 shadow-lg animate-pulse'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-2xs'
                }`}
                title={transmissionLocked ? 'Transmissão contínua ativa' : 'Segure para falar'}
              >
                <span className="flex items-center justify-center gap-2">
                  {speaking ? <Mic className="w-4 h-4 animate-bounce" /> : <MicOff className="w-4 h-4" />}
                  {speaking
                    ? 'Transmitindo Voz...'
                    : transmissionLocked
                    ? 'Toque para Transmitir'
                    : 'Segure para Falar (PTT)'}
                </span>
              </button>
            ) : (
              <div
                className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wide border text-center transition-colors ${
                  muted
                    ? 'bg-slate-100 dark:bg-slate-800 text-[var(--muted)] border-[var(--line)]'
                    : 'bg-sky-600 text-white border-sky-500'
                }`}
                title={muted ? 'Microfone silenciado' : 'Microfone aberto'}
              >
                <span className="flex items-center justify-center gap-2">
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  {muted ? 'Microfone silenciado' : 'Microfone aberto (Open Mic)'}
                </span>
              </div>
            )}

            {/* Volume Indicator & Loopback Test */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--line)]">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Mic className={`w-3.5 h-3.5 ${micLevel > 5 ? 'text-emerald-500' : 'text-[var(--muted)]'}`} />
                <div className="flex-1 bg-[var(--line)] h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-75"
                    style={{ width: `${Math.max(4, micLevel)}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono font-bold text-[var(--muted)] w-7 text-right">
                  {micLevel}%
                </span>
              </div>

              <button
                onClick={testLoopback}
                disabled={isTestingLoopback}
                className="px-2 py-1 bg-[var(--bg)] hover:bg-[var(--line)] border border-[var(--line)] rounded-lg text-[10px] font-bold text-[var(--ink)] cursor-pointer shrink-0 transition-colors disabled:opacity-50"
                title="Testar se o microfone está captando seu som"
              >
                {isTestingLoopback ? 'Testando...' : 'Testar Voz'}
              </button>
            </div>

            {/* Desligar Rádio PTT button */}
            <button
              onClick={() => setEnabled(false)}
              className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-extrabold text-[11px] rounded-xl flex items-center justify-center gap-2 border border-rose-500/25 cursor-pointer transition-all active:scale-[0.98]"
              title="Desligar o Rádio PTT e suspender transmissões"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Desligar Rádio PTT</span>
            </button>

            <p className="text-[9.5px] leading-relaxed text-[var(--muted)] text-center">
              Equipe: {state.teamName || '—'} • Setor: {state.sector || '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

