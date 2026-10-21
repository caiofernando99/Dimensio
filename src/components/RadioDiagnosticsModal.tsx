import React, { useState, useEffect } from 'react';
import { useCommunication } from '../context/CommunicationContext';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Mic,
  Volume2,
  Radio,
  Server,
  Users,
  Copy,
  Check,
  X,
} from 'lucide-react';

interface RadioDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RadioDiagnosticsModal: React.FC<RadioDiagnosticsModalProps> = ({ isOpen, onClose }) => {
  const {
    enabled,
    micAvailable,
    micLevel,
    relayOnline,
    activeChannel,
    channelPeers,
    forceReconnect,
    getDiagnostics,
    testLoopback,
    isTestingLoopback,
  } = useCommunication();

  const [diag, setDiag] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [pingMs, setPingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const update = () => {
      try {
        setDiag(getDiagnostics());
      } catch {}
    };
    update();
    const interval = setInterval(update, 1000);

    // Measure server latency
    const t0 = performance.now();
    fetch('/api/signal/presence', { cache: 'no-store' })
      .then((res) => {
        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        if (res.ok && contentType.includes('application/json')) {
          setPingMs(Math.round(performance.now() - t0));
        } else {
          setPingMs(null);
        }
      })
      .catch(() => setPingMs(null));

    return () => clearInterval(interval);
  }, [isOpen, getDiagnostics]);

  if (!isOpen) return null;

  const copyReport = () => {
    if (!diag) return;
    navigator.clipboard.writeText(JSON.stringify(diag, null, 2)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const connections: any[] = diag?.connections || [];
  const totalPeers = diag?.totalPeers || 0;
  const relayMode: string = diag?.relayMode || 'server';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[var(--surface-1)] border border-[var(--line)] rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--surface-2)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)]">Diagnóstico de Comunicação em Tempo Real</h3>
              <p className="text-[11px] text-[var(--muted)]">Status do WebRTC, Microfone, Presença e Servidor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-1)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Microfone</span>
                <Mic className={`w-3.5 h-3.5 ${micAvailable ? 'text-emerald-500' : 'text-red-500'}`} />
              </div>
              <div className="font-bold text-[var(--ink)]">
                {micAvailable ? 'Ativo e Pronto' : 'Bloqueado/Sem Permissão'}
              </div>
              <div className="mt-1.5 w-full bg-[var(--line)] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-75"
                  style={{ width: `${Math.min(100, micLevel * 1.5)}%` }}
                />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Sinalização</span>
                <Server className={`w-3.5 h-3.5 ${relayOnline ? 'text-emerald-500' : 'text-red-500'}`} />
              </div>
              <div className="font-bold text-[var(--ink)]">
                {relayOnline
                  ? relayMode === 'firestore'
                    ? 'Nuvem (Firestore)'
                    : relayMode === 'webhook'
                    ? 'Webhook'
                    : 'SSE Conectado'
                  : 'Desconectado'}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">
                {relayMode === 'firestore'
                  ? 'Fallback em nuvem'
                  : pingMs !== null
                  ? `${pingMs}ms latência`
                  : 'Sem relay local'}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase">Colegas Online</span>
                <Users className="w-3.5 h-3.5 text-indigo-500" />
              </div>
              <div className="font-bold text-[var(--ink)]">
                {totalPeers} {totalPeers === 1 ? 'operador' : 'operadores'}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">Canal: {activeChannel || 'Geral'}</div>
            </div>

            <div className="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[var(--muted)] uppercase">P2P WebRTC</span>
                <Radio className={`w-3.5 h-3.5 ${connections.length > 0 ? 'text-emerald-500' : 'text-amber-500'}`} />
              </div>
              <div className="font-bold text-[var(--ink)]">
                {connections.filter((c) => c.status === 'connected' || c.connectionState === 'connected').length} de {connections.length} ativos
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-0.5">
                {connections.length === 0 ? 'Aguardando pares' : 'Canal direto'}
              </div>
            </div>
          </div>

          {/* Peer Connections Table */}
          <div className="border border-[var(--line)] rounded-xl overflow-hidden bg-[var(--surface-2)]">
            <div className="p-2.5 border-b border-[var(--line)] font-bold text-[11px] text-[var(--ink)] flex items-center justify-between">
              <span>Conexões P2P Diretas ({connections.length})</span>
              <span className="text-[10px] font-normal text-[var(--muted)]">Status ICE e Áudio</span>
            </div>
            {connections.length === 0 ? (
              <div className="p-4 text-center text-[var(--muted)]">
                Nenhum outro operador conectado no momento. Abra outra aba ou aparelho para testar a comunicação direta.
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)] max-h-48 overflow-y-auto">
                {connections.map((c) => {
                  const isConn = c.status === 'connected' || c.connectionState === 'connected';
                  return (
                    <div key={c.key} className="p-2.5 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="font-bold text-[var(--ink)] truncate">{c.remoteId}</div>
                        <div className="text-[10px] text-[var(--muted)]">
                          ICE: <span className="font-mono">{c.iceConnectionState || 'new'}</span> • Senders:{' '}
                          {c.sendersCount} • Trilha: {c.hasAudioTrack ? '✅ Enviando' : '⚠️ Sem trilha'}
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isConn
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {isConn ? <CheckCircle2 className="w-3 h-3" /> : <RefreshCw className="w-3 h-3 animate-spin" />}
                        {c.connectionState || c.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Test & Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              onClick={testLoopback}
              disabled={isTestingLoopback}
              className="flex-1 min-w-[160px] py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <Volume2 className="w-4 h-4" />
              {isTestingLoopback ? 'Gravando e Tocando...' : 'Auto-Teste de Áudio (Loopback 3s)'}
            </button>

            <button
              onClick={forceReconnect}
              className="py-2 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:bg-[var(--surface-3)] text-[var(--ink)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Forçar Reconexão
            </button>

            <button
              onClick={copyReport}
              className="py-2 px-3 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] hover:bg-[var(--surface-3)] text-[var(--ink)] font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar Diagnóstico'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
