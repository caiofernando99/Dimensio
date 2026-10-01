import React, { useState, useEffect } from 'react';
import { Smartphone, Bell, Check, X, ShieldCheck, Volume2, Wifi } from 'lucide-react';
import { requestNotificationPermission, isNotificationSupportedAndGranted } from '../utils/notifications';
import { useCommunication } from '../context/CommunicationContext';
import { useApp } from '../context/AppContext';

const DISMISSED_KEY = 'dimensio_android_bg_banner_dismissed_v1';

export const AndroidBackgroundKeepaliveBanner: React.FC = () => {
  const { showNotice } = useApp();
  const { audioBlocked, resumeAllAudio, requestWakeLock } = useCommunication();
  const [isVisible, setIsVisible] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    // Check if dismissed in this session
    try {
      if (sessionStorage.getItem(DISMISSED_KEY) === 'true') {
        return;
      }
    } catch {}

    const isMobileOrAndroid =
      typeof navigator !== 'undefined' &&
      (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0));

    const needsNotifications = !isNotificationSupportedAndGranted();
    const needsAudioUnlock = audioBlocked;

    // Show if mobile/Android and either notifications or audio unblock is needed
    if (isMobileOrAndroid && (needsNotifications || needsAudioUnlock)) {
      setIsVisible(true);
    }
  }, [audioBlocked]);

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      // 1. Request OS Notification permission (must be user gesture)
      const granted = await requestNotificationPermission();

      // 2. Unlock HTML5 Audio via direct user tap
      resumeAllAudio();

      // 3. Request WakeLock
      requestWakeLock();

      showNotice(
        granted
          ? '✅ Segundo plano e notificações ativados! Você continuará ouvindo o rádio e recebendo alertas com o app minimizado.'
          : '✅ Áudio em segundo plano ativado! Ative as notificações nas configurações do navegador para alertas visuais.',
        undefined,
        undefined,
        'success'
      );
      setIsVisible(false);
      try {
        sessionStorage.setItem(DISMISSED_KEY, 'true');
      } catch {}
    } catch (err) {
      console.warn('Erro ao ativar segundo plano:', err);
    } finally {
      setIsActivating(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      sessionStorage.setItem(DISMISSED_KEY, 'true');
    } catch {}
  };

  if (!isVisible) return null;

  return (
    <div className="no-print fixed top-3 left-1/2 -translate-x-1/2 z-[10001] w-[calc(100vw-1.5rem)] max-w-lg animate-in fade-in slide-in-from-top-3 duration-300">
      <div className="p-3.5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-2 border-indigo-500/60 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col gap-2.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center shrink-0 text-indigo-400">
              <Smartphone className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wide text-white uppercase">
                  Modo Segundo Plano (Android)
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-indigo-500 text-white rounded-md">
                  Recomendado
                </span>
              </div>
              <p className="text-[11px] text-indigo-200 leading-snug mt-0.5">
                Mantenha a voz do rádio e as notificações de tarefas ativas mesmo com o app minimizado ou tela bloqueada.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-indigo-500/20">
          <button
            type="button"
            onClick={handleDismiss}
            className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-white cursor-pointer"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={handleActivate}
            disabled={isActivating}
            className="px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>{isActivating ? 'Ativando...' : 'Ativar Notificações e Áudio'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
