import React from 'react';
import { useApp } from '../context/AppContext';
import { WifiOff, RefreshCw, LogOut } from 'lucide-react';

// Bloqueio de tela do "modo sempre conectado": quando a conexão com a nuvem cai
// (ou ainda não há planilha conectada), o portal entra em somente leitura até
// reconectar. Isso impede edição offline que divergiria do online e causaria
// sobrescritas.
const AlwaysOnlineOverlay: React.FC<{ onConnectCloud?: () => void }> = ({ onConnectCloud }) => {
  const { state, cloudOnline, logoutUser, identifiedUser, syncToOnlineSpreadsheet, showNotice } = useApp();
  const hasConnection = Boolean(state.onlineSpreadsheet?.webhookUrl);

  const tryReconnect = async () => {
    if (!hasConnection) {
      onConnectCloud?.();
      return;
    }
    const ok = await syncToOnlineSpreadsheet(false).catch(() => false);
    if (ok) {
      showNotice('Conexão restabelecida! O portal está online novamente.', undefined, undefined, 'sync');
    } else {
      showNotice('Ainda sem conexão. Tentando novamente automaticamente...', undefined, undefined, 'sync');
    }
  };

  return (
    <div className="min-h-screen h-dvh flex items-center justify-center bg-[var(--bg)] p-4 overflow-hidden">
      <div className="w-full max-w-sm text-center space-y-5">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
          <WifiOff className="w-10 h-10 text-amber-500" />
        </div>

        <div>
          <h1 className="text-lg font-black text-[var(--ink)]">Modo sempre conectado</h1>
          <p className="mt-1 text-xs text-[var(--muted)] font-semibold leading-relaxed">
            {hasConnection
              ? 'A conexão com a nuvem está indisponível no momento. Para evitar divergência e sobrescrita de dados, o portal está em somente leitura até reconectar.'
              : 'Nenhuma planilha compartilhada conectada nesta sessão. Conecte a planilha para o portal voltar a operar online.'}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={tryReconnect}
            className="px-4 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            {hasConnection ? 'Tentar reconectar agora' : 'Conectar planilha compartilhada'}
          </button>
          {identifiedUser && (
            <button
              onClick={logoutUser}
              className="px-4 py-2.5 bg-[var(--bg)] border border-[var(--line)] text-[var(--ink)] text-xs font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:bg-[var(--paper)] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Encerrar sessão de {identifiedUser.name}
            </button>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] text-[var(--muted)] font-bold">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          {cloudOnline ? 'Conectando...' : 'Offline — aguardando conexão'}
        </div>
      </div>
    </div>
  );
};

export default AlwaysOnlineOverlay;