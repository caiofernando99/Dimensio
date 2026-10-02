import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Calendar as CalendarIcon, Menu, Cloud, UserCheck, Bell, User, Clock, Globe, BookOpen, Database } from 'lucide-react';
import { GlobalSearch } from './GlobalSearch';
import { UserIdentifyModal } from './UserIdentifyModal';
import { UserNotificationsModal } from './UserNotificationsModal';
import { SwDiagnosticIndicator } from './SwDiagnosticIndicator';
import { updateCloudPresence, subscribeToCloudPresence, CloudPresenceUser } from '../lib/firestoreStorage';

interface HeaderProps {
  pageTitle: string;
  onOpenGuide?: () => void;
  onToggleMobileMenu?: () => void;
  onOpenShiftModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ pageTitle, onOpenGuide, onToggleMobileMenu, onOpenShiftModal }) => {
  const { state, setDate, identifiedUser, getUnreadNotificationsCount } = useApp();
  const [isIdentifyModalOpen, setIsIdentifyModalOpen] = useState(false);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [onlineLeaders, setOnlineLeaders] = useState<CloudPresenceUser[]>([]);

  const unreadCount = getUnreadNotificationsCount();
  const activeDate = state.selectedDate;

  const isAllShift =
    !state.teamShift || state.teamShift === 'ALL' || state.teamShift === 'Geral' || state.teamShift === 'Todos';

  const isFirestore = state.onlineSpreadsheet?.databaseProvider === 'firestore';
  const syncError = state.onlineSpreadsheet?.syncStatus === 'error';
  const hasCloud = Boolean(isFirestore || state.onlineSpreadsheet?.webhookUrl);
  const workspaceName = state.onlineSpreadsheet?.firestoreCollection || 'dimensio_workspaces';

  // Heartbeat cloud presence
  useEffect(() => {
    if (!isFirestore || !identifiedUser) return;

    const ping = () => {
      updateCloudPresence(workspaceName, {
        id: identifiedUser.id,
        name: identifiedUser.name,
        role: identifiedUser.role,
        shift: identifiedUser.shift,
      });
    };

    ping();
    const interval = setInterval(ping, 20000);
    return () => clearInterval(interval);
  }, [isFirestore, identifiedUser, workspaceName]);

  // Subscribe to cloud presence
  useEffect(() => {
    if (!isFirestore) return;
    const unsub = subscribeToCloudPresence(workspaceName, (users) => {
      setOnlineLeaders(users);
    });
    return () => unsub();
  }, [isFirestore, workspaceName]);

  return (
    <header className="no-print sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur-sm px-3 sm:px-4 py-2 shadow-xs">
      <div className="flex items-center gap-2.5">
        {/* Left: Menu + Title + Team/Shift */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {onToggleMobileMenu && (
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="md:hidden p-1.5 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--surface-3)] text-[var(--ink)] rounded-lg flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="Abrir Menu de Navegação"
              title="Abrir Menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <h2 className="font-extrabold text-[var(--primary)] tracking-tight truncate text-sm sm:text-base">
            {pageTitle}
          </h2>

          <div className="hidden lg:flex items-center gap-2 min-w-0 shrink-0">
            <span className="text-[11px] font-bold text-[var(--muted)] truncate max-w-[140px]">
              {state.teamName || 'Equipe'}
              {state.sector ? ` (${state.sector})` : ''}
            </span>
            <button
              type="button"
              onClick={onOpenShiftModal}
              className={`px-2 py-1 rounded-full text-[10px] font-black border transition-colors cursor-pointer flex items-center gap-1 shrink-0 ${
                isAllShift
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border)] hover:bg-[var(--primary)] hover:text-white'
              }`}
              title="Clique para alterar o turno de trabalho desta sessão"
            >
              {isAllShift ? <Globe className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
              <span>{isAllShift ? 'Setor Completo' : `Turno ${state.teamShift}`}</span>
            </button>

            {/* Online Leaders Cloud Indicator */}
            {isFirestore && onlineLeaders.length > 0 && (
              <span
                className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black"
                title={`Usuários online no Firestore: ${onlineLeaders.map((u) => u.name).join(', ')}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                <span>{onlineLeaders.length} online</span>
              </span>
            )}
          </div>
        </div>

        {/* Center: Search */}
        <div className="hidden sm:block flex-1 max-w-md">
          <GlobalSearch />
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Date Picker */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-[var(--bg)] border border-[var(--line)] px-1.5 sm:px-2 py-1 rounded-lg">
            <CalendarIcon className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
            <input
              type="date"
              value={activeDate}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-[10px] sm:text-[11px] font-bold text-[var(--ink)] focus:outline-none cursor-pointer w-[86px] sm:max-w-[104px]"
              aria-label="Data da Operação"
            />
          </div>

          {/* Cloud Sync Status */}
          <span
            className={`flex items-center gap-1 bg-[var(--bg)] border px-1.5 py-1 rounded-lg shrink-0 ${
              syncError ? 'border-amber-400/60' : hasCloud ? 'border-emerald-500/40' : 'border-[var(--line)]'
            }`}
            title={
              syncError
                ? 'Falha de sincronização com o banco'
                : isFirestore
                  ? `Firebase Firestore Conectado (${workspaceName})`
                  : hasCloud
                    ? 'Google Sheets Conectado'
                    : 'Armazenamento Local'
            }
          >
            {isFirestore ? (
              <Database className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Cloud
                className={`w-3.5 h-3.5 ${
                  syncError ? 'text-amber-500' : hasCloud ? 'text-emerald-500 animate-pulse' : 'text-[var(--muted)]'
                }`}
              />
            )}
          </span>

          {/* Service Worker Background Sync Diagnostic Indicator */}
          <SwDiagnosticIndicator />

          {/* User Identify */}
          <button
            type="button"
            onClick={() => setIsIdentifyModalOpen(true)}
            className={`hidden sm:flex px-2 py-1 rounded-lg text-[10.5px] font-extrabold items-center gap-1.5 transition-colors cursor-pointer border shrink-0 ${
              identifiedUser
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-[var(--bg)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'
            }`}
            title={identifiedUser ? `Identificado como ${identifiedUser.name}` : 'Identificar-se'}
          >
            {identifiedUser ? (
              <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <User className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="max-w-[70px] truncate">{identifiedUser ? identifiedUser.name : 'Identificar'}</span>
          </button>

          {/* Notifications */}
          <button
            type="button"
            onClick={() => setIsNotifModalOpen(true)}
            className="p-1.5 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--surface-3)] text-[var(--ink)] rounded-lg relative transition-colors cursor-pointer shrink-0"
            title="Notificações do sistema"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black rounded-full px-1 py-px animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Ajuda */}
          {onOpenGuide && (
            <button
              onClick={onOpenGuide}
              className="hidden sm:flex px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10.5px] font-black transition-colors items-center gap-1 cursor-pointer shrink-0"
              title="Abrir Central de Ajuda"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Ajuda</span>
            </button>
          )}
        </div>
      </div>

      <UserIdentifyModal isOpen={isIdentifyModalOpen} onClose={() => setIsIdentifyModalOpen(false)} />
      <UserNotificationsModal isOpen={isNotifModalOpen} onClose={() => setIsNotifModalOpen(false)} />
    </header>
  );
};