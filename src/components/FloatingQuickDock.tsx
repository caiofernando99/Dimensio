import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { useCommunication } from '../context/CommunicationContext';
import {
  UserCheck,
  User,
  Bell,
  Volume2,
  VolumeX,
  Search,
  Radio,
  Mic,
  MicOff,
  Power,
  LayoutGrid,
  Users,
  X,
  PhoneCall,
  PhoneOff,
  Send,
  Wifi,
  WifiOff,
  Headphones,
  Keyboard,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
import { UserIdentifyModal } from './UserIdentifyModal';
import { UserNotificationsModal } from './UserNotificationsModal';
import { playNotificationSound } from '../utils/audioAlert';
import { requestNotificationPermission } from '../utils/notifications';

const PTT_KEY_OPTIONS = ['Space', 'F2', 'F3', 'Z', 'X', 'C', 'V', 'B', 'T', 'G'];
const PTT_KEY_LABELS: Record<string, string> = {
  Space: 'Espaço',
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

export const FloatingQuickDock: React.FC = () => {
  const {
    state,
    identifiedUser,
    notifSoundEnabled,
    notifPopupEnabled,
    setNotifSoundEnabled,
    setNotifPopupEnabled,
    getUnreadNotificationsCount,
    setIsWidgetsModalOpen,
    showNotice,
  } = useApp();

  const {
    enabled: radioEnabled,
    setEnabled: setRadioEnabled,
    speaking,
    remoteTransmitting,
    startSpeaking,
    stopSpeaking,
    transmissionLocked,
    setTransmissionLocked,
    mode,
    setMode,
    pttKey,
    setPttKey,
    activeChannel,
    setActiveChannel,
    channels,
    subscribedChannels,
    toggleChannel,
    channelPeers,
    remotePeers,
    muted,
    setMuted,
    volume,
    setVolume,
    sfxEnabled,
    setSfxEnabled,
    audioBlocked,
    resumeAllAudio,
    wakeLockActive,
    relayOnline,
    onlineCollabIds,
    openDirectChannel,
    closeDirectChannel,
    testLoopback,
    isTestingLoopback,
    micLevel,
  } = useCommunication();

  const [isIdentifyOpen, setIsIdentifyOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isRadioPopoverOpen, setIsRadioPopoverOpen] = useState(false);
  const [radioTab, setRadioTab] = useState<'controls' | 'collabs' | 'channels'>('controls');
  const [showCollabPicker, setShowCollabPicker] = useState(false);

  const unreadCount = getUnreadNotificationsCount();

  const currentActiveChannel = channels.find((c) => c.id === activeChannel);
  const activePeersCount = activeChannel
    ? (remotePeers[activeChannel] || []).filter((p) => p.status === 'connected').length
    : 0;

  const showRadio = state.showRadioModule !== false;

  // Listen to open events from external components
  useEffect(() => {
    const handleOpenRadio = () => {
      if (!radioEnabled) setRadioEnabled(true);
      setIsRadioPopoverOpen(true);
    };
    window.addEventListener('dimensio-open-radio-pip', handleOpenRadio);
    window.addEventListener('dimensio-expand-radio-pip', handleOpenRadio);
    window.addEventListener('dimensio-toggle-radio-pip', () => setIsRadioPopoverOpen((p) => !p));
    return () => {
      window.removeEventListener('dimensio-open-radio-pip', handleOpenRadio);
      window.removeEventListener('dimensio-expand-radio-pip', handleOpenRadio);
    };
  }, [radioEnabled, setRadioEnabled]);

  // Colaboradores online no rádio para chamada direta
  const onlineCollabs = useMemo(() => {
    return state.collaborators
      .filter((c) => onlineCollabIds.has(c.id) || onlineCollabIds.has(c.login || '') || onlineCollabIds.has(c.registration || ''))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }, [state.collaborators, onlineCollabIds]);

  const openDirectWith = (collabId: string, name: string) => {
    setShowCollabPicker(false);
    openDirectChannel(collabId, name);
    showNotice(`Iniciando canal de voz direto com ${name}`);
  };

  const endActiveDirectChannel = () => {
    if (!currentActiveChannel || currentActiveChannel.kind !== 'direct') return;
    closeDirectChannel(currentActiveChannel.collabId || '');
    showNotice(`Canal direto com ${(currentActiveChannel.label || '').replace(/^Direto:\s*/i, '')} encerrado.`);
  };

  return (
    <>
      {/* Floating Quick Access Dock */}
      <div className="no-print fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 flex flex-col items-end gap-1.5 sm:gap-2 max-w-[calc(100vw-24px)]">
        {/* Contextual Anchored Complete Radio Menu */}
        <AnimatePresence>
          {showRadio && radioEnabled && isRadioPopoverOpen && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="w-[calc(100vw-28px)] sm:w-96 md:w-[410px] max-h-[calc(100vh-95px)] bg-[var(--paper)]/98 dark:bg-slate-900/98 backdrop-blur-xl border border-[var(--line)] rounded-2xl shadow-2xl flex flex-col text-xs text-[var(--ink)] ring-1 ring-black/10 overflow-hidden"
            >
              {/* Menu Header */}
              <div className="px-3.5 py-2.5 bg-[var(--surface-2)]/80 border-b border-[var(--line)] flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Radio className={`w-4 h-4 ${speaking || remoteTransmitting ? 'animate-pulse' : ''}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-[12px] uppercase tracking-wide truncate text-[var(--ink)]">
                        Dimensio Talk
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    </div>
                    <div className="text-[9.5px] text-[var(--muted)] font-bold flex items-center gap-1.5 truncate">
                      {relayOnline ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <Wifi className="w-2.5 h-2.5" /> WebRTC Ativo
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <WifiOff className="w-2.5 h-2.5" /> Conectando sinal...
                        </span>
                      )}
                      {wakeLockActive && (
                        <span className="text-[8.5px] px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-600 font-extrabold">
                          2º Plano OK
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Direct Call Dropdown Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCollabPicker((v) => !v)}
                      className="px-2 py-1 rounded-lg border border-[var(--line)] bg-[var(--paper)] hover:bg-[var(--line)] text-[var(--ink)] font-extrabold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                      title="Chamar colega em canal direto privado"
                    >
                      <PhoneCall className="w-3 h-3 text-[var(--primary)]" />
                      <span className="hidden sm:inline">Chamar</span>
                    </button>

                    {showCollabPicker && (
                      <div className="absolute right-0 top-full mt-1.5 w-64 max-w-[calc(100vw-40px)] z-30 bg-[var(--paper)] border border-[var(--line)] rounded-xl shadow-2xl overflow-hidden">
                        <div className="px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] text-[10px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <PhoneCall className="w-3 h-3 text-[var(--primary)]" />
                            Falar em canal direto:
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowCollabPicker(false)}
                            className="text-[var(--muted)] hover:text-[var(--ink)]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-[var(--line)]">
                          {onlineCollabs.length === 0 ? (
                            <div className="px-3 py-3 text-[10.5px] text-[var(--muted)] italic text-center">
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
                                  className="w-full px-3 py-2 text-left hover:bg-[var(--bg)] transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 flex items-center gap-2"
                                >
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-extrabold text-[var(--ink)] truncate">{c.name}</div>
                                    <div className="text-[9.5px] text-[var(--muted)] truncate">{c.role || 'Operador'}</div>
                                  </div>
                                  <Send className="w-3 h-3 text-[var(--primary)] shrink-0" />
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Power Off */}
                  <button
                    type="button"
                    onClick={() => {
                      setRadioEnabled(false);
                      setIsRadioPopoverOpen(false);
                      showNotice('Rádio PTT Desligado');
                    }}
                    className="p-1.5 rounded-lg hover:bg-rose-500/15 text-[var(--muted)] hover:text-rose-500 cursor-pointer transition-colors"
                    title="Desligar Rádio PTT"
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>

                  {/* Close Popover */}
                  <button
                    type="button"
                    onClick={() => setIsRadioPopoverOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition-colors"
                    title="Fechar menu"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center border-b border-[var(--line)] bg-[var(--surface-2)]/40 px-2 pt-1.5 gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setRadioTab('controls')}
                  className={`flex-1 py-1.5 px-2 font-black text-[10.5px] uppercase tracking-wider rounded-t-lg transition-all cursor-pointer border-b-2 ${
                    radioTab === 'controls'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-[var(--paper)]'
                      : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Transmissão & Áudio
                </button>
                <button
                  type="button"
                  onClick={() => setRadioTab('collabs')}
                  className={`flex-1 py-1.5 px-2 font-black text-[10.5px] uppercase tracking-wider rounded-t-lg transition-all cursor-pointer border-b-2 flex items-center justify-center gap-1.5 ${
                    radioTab === 'collabs'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-[var(--paper)]'
                      : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span>Colegas ({onlineCollabs.length})</span>
                  {activePeersCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setRadioTab('channels')}
                  className={`flex-1 py-1.5 px-2 font-black text-[10.5px] uppercase tracking-wider rounded-t-lg transition-all cursor-pointer border-b-2 ${
                    radioTab === 'channels'
                      ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-[var(--paper)]'
                      : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Canais ({channels.length})
                </button>
              </div>

              {/* Popover Scrollable Body */}
              <div className="p-3.5 space-y-3 overflow-y-auto max-h-[calc(100vh-210px)] select-none">
                {/* Audio Autoplay Unblock Banner */}
                {audioBlocked && (
                  <button
                    type="button"
                    onClick={resumeAllAudio}
                    className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-[11px] rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer animate-bounce"
                  >
                    <Volume2 className="w-4 h-4 shrink-0" />
                    <span>Clique para Ativar Áudio (Bloqueado pelo Navegador)</span>
                  </button>
                )}

                {/* Device Notification Permission Banner for Android */}
                {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
                  <button
                    type="button"
                    onClick={async () => {
                      const granted = await requestNotificationPermission();
                      if (granted) {
                        showNotice('Notificações no dispositivo ativadas!');
                      }
                    }}
                    className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[11px] rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer"
                  >
                    <Bell className="w-4 h-4 shrink-0" />
                    <span>Habilitar Notificações no Android</span>
                  </button>
                )}

                {/* Direct Channel Active Notification */}
                {currentActiveChannel?.kind === 'direct' && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-700 dark:text-sky-300 font-extrabold text-[11px]">
                    <span className="flex items-center gap-1.5 truncate">
                      <Radio className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                      <span className="truncate">Chamada Direta: {currentActiveChannel.label}</span>
                    </span>
                    <button
                      type="button"
                      onClick={endActiveDirectChannel}
                      className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[9.5px] font-black flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <PhoneOff className="w-3 h-3" />
                      Encerrar
                    </button>
                  </div>
                )}

                {/* TAB 1: CONTROLS & TRANSMISSION */}
                {radioTab === 'controls' && (
                  <div className="space-y-3">
                    {/* Active Channel Selector Bar */}
                    <div className="flex items-center gap-2 bg-[var(--bg)] border border-[var(--line)] px-2.5 py-1.5 rounded-xl">
                      <Users className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] font-black uppercase tracking-wider text-[var(--muted)]">Canal Selecionado</div>
                        <select
                          value={activeChannel || ''}
                          onChange={(e) => {
                            const chId = e.target.value;
                            if (chId) {
                              if (!subscribedChannels.includes(chId)) toggleChannel(chId);
                              setActiveChannel(chId);
                            }
                          }}
                          className="bg-transparent font-extrabold text-[11px] text-[var(--ink)] focus:outline-none w-full truncate cursor-pointer"
                        >
                          {channels.map((ch) => {
                            const count = (channelPeers[ch.id] || []).length;
                            return (
                              <option key={ch.id} value={ch.id} className="bg-[var(--paper)] text-[var(--ink)]">
                                {ch.label} ({count} online)
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    {/* Push-to-Talk Main Button */}
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          if (mode === 'open') {
                            setMuted(!muted);
                          } else if (transmissionLocked) {
                            setTransmissionLocked(!speaking);
                          } else {
                            startSpeaking();
                          }
                        }}
                        onPointerUp={transmissionLocked || mode === 'open' ? undefined : stopSpeaking}
                        onPointerLeave={transmissionLocked || mode === 'open' ? undefined : stopSpeaking}
                        onPointerCancel={transmissionLocked || mode === 'open' ? undefined : stopSpeaking}
                        className={`w-full py-4 px-4 rounded-2xl font-black text-xs uppercase tracking-wider cursor-pointer select-none transition-all duration-150 border flex flex-col items-center justify-center gap-1.5 shadow-lg active:scale-[0.98] ${
                          speaking
                            ? 'bg-rose-600 text-white border-rose-400 ring-4 ring-rose-500/40 animate-pulse shadow-rose-500/30'
                            : remoteTransmitting
                            ? 'bg-emerald-600 text-white border-emerald-400 ring-4 ring-emerald-500/40 animate-pulse'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-600/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-extrabold">
                          {speaking ? (
                            <>
                              <Mic className="w-5 h-5 animate-bounce text-white" />
                              <span>{transmissionLocked ? 'TRANSMITINDO (TRAVADO)' : 'FALANDO AO VIVO...'}</span>
                            </>
                          ) : remoteTransmitting ? (
                            <>
                              <Volume2 className="w-5 h-5 animate-pulse text-white" />
                              <span>RECEBENDO ÁUDIO AO VIVO...</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-5 h-5 text-emerald-200" />
                              <span>SEGURE PARA FALAR (PTT)</span>
                            </>
                          )}
                        </div>

                        {/* Mic Volume Level Waveform */}
                        <div className="w-full max-w-[200px] h-1.5 bg-black/25 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-75 rounded-full ${speaking ? 'bg-white' : 'bg-emerald-300/60'}`}
                            style={{ width: `${Math.min(100, Math.max(speaking ? 40 : 4, (micLevel || 0) * 250))}%` }}
                          />
                        </div>

                        <span className="text-[9.5px] font-bold text-white/80 normal-case">
                          {mode === 'open'
                            ? 'Modo Voz Aberta (Mãos Livres)'
                            : `Atalho do teclado: Segure [${PTT_KEY_LABELS[pttKey] || pttKey}]`}
                        </span>
                      </button>
                    </div>

                    {/* Mode & PTT Key Settings */}
                    <div className="grid grid-cols-2 gap-2 bg-[var(--bg)] border border-[var(--line)] p-2.5 rounded-xl">
                      {/* Mode Selector */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[var(--muted)]">Modo do Rádio</span>
                        <div className="flex rounded-lg bg-[var(--paper)] p-0.5 border border-[var(--line)]">
                          <button
                            type="button"
                            onClick={() => {
                              setMode('ptt');
                              setTransmissionLocked(false);
                            }}
                            className={`flex-1 py-1 text-[10px] font-black rounded-md transition-colors cursor-pointer ${
                              mode === 'ptt' && !transmissionLocked
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-[var(--muted)] hover:text-[var(--ink)]'
                            }`}
                          >
                            PTT
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMode('ptt');
                              setTransmissionLocked(true);
                            }}
                            className={`flex-1 py-1 text-[10px] font-black rounded-md transition-colors cursor-pointer ${
                              transmissionLocked
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-[var(--muted)] hover:text-[var(--ink)]'
                            }`}
                            title="Clique para ligar/desligar microfone sem segurar"
                          >
                            Trava
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMode('open');
                              setTransmissionLocked(false);
                            }}
                            className={`flex-1 py-1 text-[10px] font-black rounded-md transition-colors cursor-pointer ${
                              mode === 'open'
                                ? 'bg-sky-600 text-white shadow-xs'
                                : 'text-[var(--muted)] hover:text-[var(--ink)]'
                            }`}
                            title="Microfone aberto contínuo"
                          >
                            Aberto
                          </button>
                        </div>
                      </div>

                      {/* PTT Key Shortcut */}
                      <div className="space-y-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                          <Keyboard className="w-3 h-3 text-[var(--primary)]" />
                          Tecla PTT
                        </span>
                        <select
                          value={pttKey}
                          onChange={(e) => setPttKey(e.target.value)}
                          className="w-full bg-[var(--paper)] border border-[var(--line)] rounded-lg px-2 py-1 font-extrabold text-[10.5px] text-[var(--ink)] focus:outline-none cursor-pointer"
                        >
                          {PTT_KEY_OPTIONS.map((k) => (
                            <option key={k} value={k}>
                              {PTT_KEY_LABELS[k] || k}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Audio Sliders & Mute */}
                    <div className="space-y-2 bg-[var(--bg)] border border-[var(--line)] p-2.5 rounded-xl">
                      {/* Speaker Volume Slider */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setVolume(volume > 0 ? 0 : 1)}
                          className="text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer shrink-0"
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
                        />
                        <span className="text-[10px] font-mono font-black text-[var(--muted)] w-8 text-right shrink-0">
                          {Math.round(volume * 100)}%
                        </span>
                      </div>

                      {/* Secondary Actions: Mic Mute + SFX Tones + Test Loopback */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-[var(--line)]">
                        <button
                          type="button"
                          onClick={() => {
                            setMuted(!muted);
                            showNotice(muted ? 'Microfone ativado' : 'Microfone silenciado');
                          }}
                          className={`px-2 py-1 rounded-lg border font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
                            muted
                              ? 'bg-rose-500/15 border-rose-500/30 text-rose-500'
                              : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink)] hover:bg-[var(--line)]'
                          }`}
                        >
                          {muted ? <MicOff className="w-3 h-3 text-rose-500" /> : <Mic className="w-3 h-3 text-emerald-500" />}
                          <span>{muted ? 'Mutado' : 'Mic Ativo'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next = !sfxEnabled;
                            setSfxEnabled(next);
                            showNotice(next ? 'Sons e bipes do rádio ativados' : 'Sons e bipes do rádio silenciados');
                          }}
                          className={`px-2 py-1 rounded-lg border font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors ${
                            sfxEnabled
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                              : 'bg-[var(--paper)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                          }`}
                          title="Ligar ou desligar os bipes/ruídos de PTT e início de fala"
                        >
                          <Bell className={`w-3 h-3 ${sfxEnabled ? 'text-emerald-500' : 'text-[var(--muted)]'}`} />
                          <span>{sfxEnabled ? 'Bipes ON' : 'Bipes OFF'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isTestingLoopback}
                          onClick={testLoopback}
                          className="px-2 py-1 rounded-lg border border-[var(--line)] bg-[var(--paper)] hover:bg-[var(--line)] font-bold text-[10px] text-[var(--muted)] hover:text-[var(--ink)] flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                          title="Fale e ouça seu próprio retorno para testar o microfone"
                        >
                          <Headphones className="w-3 h-3 text-[var(--primary)]" />
                          <span>{isTestingLoopback ? 'Testando...' : 'Retorno'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: ONLINE COLLEAGUES */}
                {radioTab === 'collabs' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-black uppercase text-[var(--muted)] px-1">
                      <span>Colegas no Rádio ({onlineCollabs.length})</span>
                      <span>Canal: {currentActiveChannel?.label || 'Geral'}</span>
                    </div>

                    <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-xl bg-[var(--bg)] overflow-hidden max-h-56 overflow-y-auto">
                      {onlineCollabs.length === 0 ? (
                        <div className="p-4 text-center text-xs text-[var(--muted)] italic">
                          Nenhum outro colega online no momento.
                        </div>
                      ) : (
                        onlineCollabs.map((c) => {
                          const isSelf = identifiedUser?.collaboratorId === c.id || identifiedUser?.id === c.id;
                          return (
                            <div key={c.id} className="p-2 flex items-center justify-between gap-2 hover:bg-[var(--paper)] transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                <div className="min-w-0">
                                  <div className="font-extrabold text-[11px] text-[var(--ink)] truncate">
                                    {c.name} {isSelf && <span className="text-[9px] text-[var(--muted)] font-normal">(Você)</span>}
                                  </div>
                                  <div className="text-[9.5px] text-[var(--muted)] truncate">
                                    {c.role || 'Operador'} • Turno {c.shift || '—'}
                                  </div>
                                </div>
                              </div>

                              {!isSelf && (
                                <button
                                  type="button"
                                  onClick={() => openDirectWith(c.id, c.name)}
                                  className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[9.5px] flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                                  title={`Iniciar chamada direta privada com ${c.name}`}
                                >
                                  <PhoneCall className="w-2.5 h-2.5" />
                                  <span>DM</span>
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 3: SECTOR CHANNELS */}
                {radioTab === 'channels' && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase text-[var(--muted)] px-1">
                      Canais e Setores Disponíveis
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto">
                      {channels.map((ch) => {
                        const isCurrent = activeChannel === ch.id;
                        const isSubscribed = subscribedChannels.includes(ch.id);
                        const count = (channelPeers[ch.id] || []).length;
                        return (
                          <div
                            key={ch.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                              isCurrent
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20'
                                : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:bg-[var(--paper)]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <Radio className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-emerald-500' : 'text-[var(--muted)]'}`} />
                                <span className="font-extrabold text-[11px] truncate">{ch.label}</span>
                                {ch.kind === 'direct' && (
                                  <span className="px-1 py-0.2 rounded bg-sky-500 text-white text-[8px] font-black uppercase">
                                    Direto
                                  </span>
                                )}
                              </div>
                              <div className="text-[9.5px] text-[var(--muted)] font-bold pl-5">
                                {count > 0 ? `${count} colega(s) ouvindo` : 'Canal livre'}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (!isSubscribed) toggleChannel(ch.id);
                                setActiveChannel(ch.id);
                                showNotice(`Canal alterado para: ${ch.label}`);
                              }}
                              className={`px-2.5 py-1 rounded-lg font-black text-[10px] cursor-pointer transition-colors ${
                                isCurrent
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--line)] text-[var(--ink)]'
                              }`}
                            >
                              {isCurrent ? 'Ativo' : 'Entrar'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Menu Footer */}
              <div className="px-3.5 py-2 bg-[var(--surface-2)]/60 border-t border-[var(--line)] flex items-center justify-between text-[10px] font-bold text-[var(--muted)] shrink-0">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  {activePeersCount > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                      {activePeersCount} colega(s) conectado(s)
                    </span>
                  ) : (
                    'Rádio pronto para transmitir'
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setIsRadioPopoverOpen(false)}
                  className="text-[var(--primary)] hover:underline cursor-pointer font-extrabold"
                >
                  Ocultar Menu
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
              className="bg-[var(--paper)]/95 dark:bg-slate-900/95 backdrop-blur-md border border-[var(--line)] p-1.5 sm:p-2 rounded-2xl shadow-2xl flex flex-wrap sm:flex-nowrap items-center gap-1.5 sm:gap-2 text-xs font-bold text-[var(--ink)] ring-1 ring-black/5 max-w-full overflow-x-auto"
            >
              {/* Floating User Identification Button */}
              <button
                type="button"
                onClick={() => setIsIdentifyOpen(true)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl border flex items-center gap-1.5 sm:gap-2 cursor-pointer transition-all shadow-xs shrink-0 ${
                  identifiedUser
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-[var(--bg)] hover:bg-[var(--line)] text-[var(--ink)] border-[var(--line)]'
                }`}
                title={identifiedUser ? `Identificado como ${identifiedUser.name}` : 'Clique para se identificar no sistema'}
              >
                <div className="relative flex items-center justify-center">
                  {identifiedUser ? (
                    <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--muted)]" />
                  )}
                  <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${identifiedUser ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                </div>
                <div className="text-left max-w-[85px] sm:max-w-[120px] truncate">
                  <div className="text-[10px] sm:text-[10.5px] font-extrabold truncate">
                    {identifiedUser ? identifiedUser.name : 'Identificar-se'}
                  </div>
                  <div className="text-[8.5px] sm:text-[9px] text-[var(--muted)] font-bold truncate">
                    {identifiedUser ? `${identifiedUser.role}${identifiedUser.sector ? ` • ${identifiedUser.sector}` : ''}` : 'Acesso Padrão'}
                  </div>
                </div>
              </button>

              {/* Integrated Radio PTT Section */}
              {showRadio && (
                <>
                  <div className="hidden sm:block h-6 w-px bg-[var(--line)]" />

                  {!radioEnabled ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRadioEnabled(true);
                        setIsRadioPopoverOpen(true);
                        showNotice('📻 Rádio PTT Ativado (Dimensio Talk)');
                      }}
                      className="px-2 sm:px-2.5 py-1.5 rounded-xl border flex items-center gap-1 sm:gap-1.5 cursor-pointer transition-all bg-[var(--bg)] hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] border-[var(--line)] shadow-xs shrink-0"
                      title="Ligar Rádio PTT (Dimensio Talk)"
                    >
                      <Power className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500" />
                      <span className="text-[10px] sm:text-[10.5px] font-extrabold">Rádio</span>
                      <span className="text-[8.5px] sm:text-[9px] px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-[var(--muted)] font-black">
                        OFF
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Active Radio Status Button / Contextual Complete Menu Trigger */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsRadioPopoverOpen((prev) => !prev);
                        }}
                        className={`px-2 sm:px-2.5 py-1.5 rounded-xl border flex items-center gap-1 sm:gap-1.5 cursor-pointer transition-all shadow-xs ${
                          speaking
                            ? 'bg-rose-600 text-white border-rose-400 ring-2 ring-rose-500/40 animate-pulse'
                            : remoteTransmitting
                            ? 'bg-emerald-600 text-white border-emerald-400 ring-2 ring-emerald-500/40 animate-pulse'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        }`}
                        title={
                          speaking
                            ? 'Transmitindo voz no Rádio PTT • Clique para abrir menu'
                            : remoteTransmitting
                            ? 'Recebendo áudio ao vivo no Rádio PTT • Clique para abrir menu'
                            : `Rádio PTT Ativo (${activePeersCount} online no ${currentActiveChannel?.label || 'canal'}) • Clique para abrir menu completo`
                        }
                      >
                        <div className="relative flex items-center justify-center">
                          {speaking ? (
                            <Mic className="w-3.5 h-3.5 text-white animate-bounce" />
                          ) : remoteTransmitting ? (
                            <Volume2 className="w-3.5 h-3.5 text-white animate-pulse" />
                          ) : (
                            <>
                              <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            </>
                          )}
                        </div>
                        <div className="text-left leading-tight max-w-[70px] sm:max-w-[95px] truncate">
                          <div className="text-[9.5px] sm:text-[10px] font-extrabold truncate">
                            {speaking
                              ? 'FALANDO...'
                              : remoteTransmitting
                              ? 'AO VIVO'
                              : currentActiveChannel?.label || 'Rádio PTT'}
                          </div>
                          <div
                            className={`text-[8px] sm:text-[8.5px] font-bold truncate ${
                              speaking || remoteTransmitting ? 'text-white/80' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {speaking || remoteTransmitting
                              ? currentActiveChannel?.label || 'Canal'
                              : activePeersCount > 0
                              ? `${activePeersCount} on`
                              : 'Ativo'}
                          </div>
                        </div>
                      </button>

                      {/* Direct Call Quick Hangup */}
                      {currentActiveChannel?.kind === 'direct' && (
                        <button
                          type="button"
                          onClick={endActiveDirectChannel}
                          className="p-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 cursor-pointer transition-all shrink-0"
                          title="Desligar Chamada Direta e Voltar ao Canal Geral"
                        >
                          <PhoneOff className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Quick Mute Toggle */}
                      <button
                        type="button"
                        onClick={() => {
                          setMuted(!muted);
                          showNotice(muted ? 'Microfone ativado' : 'Microfone silenciado');
                        }}
                        className={`p-1.5 rounded-xl border cursor-pointer transition-all shrink-0 ${
                          muted
                            ? 'bg-rose-500/15 border-rose-500/40 text-rose-500'
                            : 'bg-[var(--bg)] hover:bg-[var(--line)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                        title={muted ? 'Desmutar Microfone' : 'Silenciar Microfone'}
                      >
                        {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </>
              )}

              <div className="hidden sm:block h-6 w-px bg-[var(--line)]" />

              {/* Floating Widgets Center Button */}
              {state.showWidgetsModule !== false && state.widgetsConfig?.enabled !== false && (
                <button
                  type="button"
                  onClick={() => setIsWidgetsModalOpen(true)}
                  className="p-1.5 sm:p-2 bg-[var(--bg)] hover:bg-[var(--line)] border border-[var(--line)] rounded-xl cursor-pointer transition-all text-[var(--ink)] shrink-0 flex items-center justify-center hover:border-[var(--primary)]"
                  title="Abrir Central de Widgets & Personalização"
                >
                  <LayoutGrid className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500" />
                </button>
              )}

              {/* Floating Global Search Button */}
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('open-global-search'));
                }}
                className="p-1.5 sm:p-2 bg-[var(--bg)] hover:bg-[var(--line)] border border-[var(--line)] rounded-xl cursor-pointer transition-all text-[var(--ink)] shrink-0 flex items-center justify-center hover:border-[var(--primary)]"
                title="Abrir Busca Global (Atalho: Tecla 'S')"
              >
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)]" />
              </button>

              {/* Floating Notifications Bell Button */}
              <button
                type="button"
                onClick={() => setIsNotifOpen(true)}
                className="p-1.5 sm:p-2 bg-[var(--bg)] hover:bg-[var(--line)] border border-[var(--line)] rounded-xl relative cursor-pointer transition-all text-[var(--ink)] shrink-0"
                title="Abrir Central de Notificações"
              >
                <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--primary)]" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-black text-[8.5px] sm:text-[9.5px] px-1.5 py-0.2 rounded-full shadow-xs animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Audio Sound Quick Toggle (hidden on very small screens to prevent crowding) */}
              <button
                type="button"
                onClick={() => {
                  const next = !notifSoundEnabled;
                  setNotifSoundEnabled(next);
                  if (next) {
                    playNotificationSound();
                    showNotice('🔊 Alerta sonoro ativado');
                  } else {
                    showNotice('🔇 Alerta sonoro desativado');
                  }
                }}
                className={`hidden sm:flex p-2 border rounded-xl cursor-pointer transition-all shrink-0 ${
                  notifSoundEnabled
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)]'
                }`}
                title={notifSoundEnabled ? 'Som de notificação Ativado' : 'Som de notificação Desativado'}
              >
                {notifSoundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
              </button>

              {/* Floating Screen Popup Quick Toggle (hidden on very small screens) */}
              <button
                type="button"
                onClick={() => {
                  const next = !notifPopupEnabled;
                  setNotifPopupEnabled(next);
                  showNotice(next ? 'Popups visuais ativados' : 'Popups visuais desativados');
                }}
                className={`hidden sm:flex p-2 border rounded-xl cursor-pointer transition-all shrink-0 ${
                  notifPopupEnabled
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300'
                    : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)]'
                }`}
                title={notifPopupEnabled ? 'Popup Visual na Tela Ativado' : 'Popup Visual na Tela Desativado'}
              >
                <Bell className="w-4 h-4" />
              </button>

              {/* Collapse Dock Button */}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)] cursor-pointer transition-colors"
                title="Minimizar barra rápida"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimized Dock Button */}
        {!isExpanded && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            type="button"
            onClick={() => setIsExpanded(true)}
            className="p-2 sm:p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-full shadow-2xl text-[var(--ink)] hover:border-[var(--primary)] transition-all cursor-pointer relative group flex items-center gap-1.5"
            title="Expandir barra de acesso rápido"
          >
            <div className="relative">
              {showRadio && radioEnabled && speaking ? (
                <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-rose-500 animate-bounce" />
              ) : showRadio && radioEnabled ? (
                <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-500 animate-pulse" />
              ) : (
                <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--primary)]" />
              )}
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white font-black text-[8px] sm:text-[9px] px-1 py-0.2 rounded-full animate-bounce">
                  {unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-extrabold pr-1 hidden sm:inline">Menu Rápido</span>
          </motion.button>
        )}
      </div>

      {/* Identification Modal */}
      <UserIdentifyModal isOpen={isIdentifyOpen} onClose={() => setIsIdentifyOpen(false)} />

      {/* Notifications Modal */}
      <UserNotificationsModal isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
    </>
  );
};
