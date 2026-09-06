import React from 'react';
import { Radio, Mic, Volume2, Users, ArrowUpRight } from 'lucide-react';
import { useCommunication } from '../../context/CommunicationContext';
import { useApp } from '../../context/AppContext';

interface RadioWidgetProps {
  onOpenFull?: () => void;
  className?: string;
}

export const RadioWidget: React.FC<RadioWidgetProps> = ({ onOpenFull, className = '' }) => {
  const {
    enabled,
    setEnabled,
    activeChannel,
    channels,
    speaking,
    remoteTransmitting,
    remotePeers,
  } = useCommunication();
  const { showNotice } = useApp();

  const currentActiveChannel = channels.find((c) => c.id === activeChannel);
  const activePeersCount = activeChannel
    ? (remotePeers[activeChannel] || []).filter((p) => p.status === 'connected').length
    : 0;

  const toggleRadio = () => {
    const next = !enabled;
    setEnabled(next);
    showNotice(next ? '🎙️ Rádio PTT Conectado!' : '📻 Rádio PTT Desconectado.');
  };

  const handleOpenPip = () => {
    window.dispatchEvent(new CustomEvent('dimensio-open-radio-pip'));
  };

  return (
    <div
      id="widget-radio-ptt"
      className={`bg-[var(--paper)] border border-[var(--line)] rounded-xl p-4 shadow-[var(--shadow-card)] flex flex-col justify-between transition-all hover:border-[var(--primary-border)] ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-2 rounded-xl ${enabled ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-500'}`}>
            <Radio className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-wider text-[var(--muted)] truncate">Comunicação por Voz</div>
            <div className="text-sm font-bold text-[var(--ink)] truncate">Dimensio Talk PTT</div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenPip}
          className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--line)]/50 transition-colors cursor-pointer"
          title="Abrir painel flutuante de voz"
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Channel & Status */}
      <div className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3 mb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="text-xs font-bold text-[var(--ink)]">
              {enabled ? `Canal: ${currentActiveChannel?.label || 'Geral'}` : 'Rádio Desconectado'}
            </span>
          </div>

          {enabled && (
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <Users className="w-3 h-3" /> {activePeersCount} online
            </span>
          )}
        </div>

        <div className="text-xs text-[var(--muted)] flex items-center gap-1.5">
          {speaking ? (
            <span className="text-rose-500 font-bold flex items-center gap-1">
              <Mic className="w-3.5 h-3.5 animate-bounce" /> Transmitindo áudio agora...
            </span>
          ) : remoteTransmitting ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 animate-pulse" /> Recebendo áudio ao vivo...
            </span>
          ) : (
            <span>Pressione Barra de Espaço ou botão no dock para falar.</span>
          )}
        </div>
      </div>

      {/* Quick Action Button */}
      <button
        type="button"
        onClick={toggleRadio}
        className={`w-full py-2 px-3 rounded-xl font-bold text-xs cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
          enabled
            ? 'bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/25'
            : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
        }`}
      >
        <Radio className="w-3.5 h-3.5" />
        <span>{enabled ? 'Desconectar Rádio' : 'Ligar Rádio Talk'}</span>
      </button>
    </div>
  );
};
