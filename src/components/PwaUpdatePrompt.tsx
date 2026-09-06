import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, X, ArrowUpCircle } from 'lucide-react';
import { checkForAppUpdates } from '../registerSW';

/**
 * Banner e modal de aviso quando uma nova versão do app é detectada ou instalada.
 * Permite recarregar instantaneamente para obter os novos recursos e correções.
 */
export const PwaUpdatePrompt: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handle = () => {
      setUpdateAvailable(true);
      setIsDismissed(false);
    };

    window.addEventListener('dimensio-update-available', handle);

    // Checa versão ao montar
    checkForAppUpdates();

    return () => window.removeEventListener('dimensio-update-available', handle);
  }, []);

  if (!updateAvailable || isDismissed) return null;

  const handleUpdate = () => {
    window.location.reload();
  };

  return (
    <div className="no-print fixed bottom-5 left-1/2 -translate-x-1/2 z-[10002] w-[calc(100vw-2rem)] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="p-3.5 bg-gray-900/95 dark:bg-gray-900/95 text-white border border-emerald-500/40 rounded-2xl shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
            <ArrowUpCircle className="w-5 h-5 animate-bounce" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white tracking-wide">Nova Versão Disponível</span>
              <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-emerald-500 text-gray-950 rounded-md">Update</span>
            </div>
            <p className="text-[11px] text-gray-300 truncate">
              Recarregue para aplicar as melhorias e correções recentes.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleUpdate}
            className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-gray-950 text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Atualizar Dimensio Agora"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Lembrar depois"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
