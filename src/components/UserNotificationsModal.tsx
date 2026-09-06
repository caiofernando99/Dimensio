import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import {
  Bell,
  Key,
  X,
  Volume2,
  VolumeX,
  MessageSquare,
  Sparkles,
  CheckCheck,
  ArrowRight,
  ClipboardList,
  User,
  Info,
  Sliders,
  Filter,
  CheckSquare,
  Square,
  Shield,
  Layers,
  Trash2,
  Trash,
} from 'lucide-react';
import { playNotificationSound } from '../utils/audioAlert';
import { requestNotificationPermission, showNativeOSNotification } from '../utils/notifications';
import { navigateTo, focusServiceRequest } from '../utils/navigation';
import type { SystemNotification } from '../types';
import { MarkdownContent } from './MarkdownContent';

interface UserNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isPortalMode?: boolean;
  targetShift?: string;
  collaboratorId?: string;
  collaboratorName?: string;
}

export const UserNotificationsModal: React.FC<UserNotificationsModalProps> = ({
  isOpen,
  onClose,
  isPortalMode = false,
  targetShift,
  collaboratorId,
  collaboratorName,
}) => {
  const {
    state,
    identifiedUser,
    authorizePasswordReset,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
    isNotificationForCurrentUser,
    getUnreadNotificationsCount,
    showNotice,
    notifSoundEnabled,
    notifPopupEnabled,
    setNotifSoundEnabled,
    setNotifPopupEnabled,
    notificationPreferences,
    setNotificationPreferences,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'notifs' | 'preferences'>('notifs');
  const [notificationFilter, setNotificationFilter] = useState<'received' | 'all_my_shift' | 'all_system'>('received');
  const containerRef = useRef<HTMLDivElement>(null);

  const goToNotification = (n: SystemNotification) => {
    const requestId = n.data?.requestId;
    if (!requestId) return;
    onClose();
    navigateTo('requests');
    focusServiceRequest(requestId);
  };

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const notifications = state.notifications || [];

  const isSentByMe = (n: SystemNotification) => {
    if (!identifiedUser) return false;
    if (n.data?.userId && String(n.data.userId) === String(identifiedUser.id)) return true;
    if (n.data?.userName && n.data.userName.trim().toLowerCase() === identifiedUser.name.trim().toLowerCase()) return true;
    if (n.senderName && identifiedUser.name && n.senderName.trim().toLowerCase() === identifiedUser.name.trim().toLowerCase()) return true;
    return false;
  };

  // In Portal Mode: show only notifications contextualized for this collaborator
  const portalNotifications = notifications.filter((n) => {
    return isNotificationForCurrentUser(n, true, collaboratorId);
  });

  const effectiveNotifications = isPortalMode ? portalNotifications : notifications;
  const unreadCount = getUnreadNotificationsCount(collaboratorId);

  const filteredNotifications = isPortalMode
    ? portalNotifications
    : notifications.filter((n) => {
        if (notificationFilter === 'received') {
          // Excludes notifications sent by the current user by default
          return isNotificationForCurrentUser(n, false, collaboratorId);
        }
        if (notificationFilter === 'all_my_shift') {
          // Includes notifications sent by the current user for their shift/team
          return isNotificationForCurrentUser(n, true, collaboratorId);
        }
        // 'all_system': Show all notifications across system
        return true;
      });

  // Relative time helper (agora / há X min / há X h / há X dias / data)
  const formatRelativeTime = (iso: string): string => {
    const diffMs = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) return 'agora';
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'há 1 dia';
    if (days < 7) return `há ${days} dias`;
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Day bucket used to group the list (Hoje / Ontem / dd/mm/yyyy)
  const dayBucketKey = (iso: string): string => {
    const d = new Date(iso);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfToday - startOfDay) / 86400000);
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const groupedNotifications = filteredNotifications.reduce<Record<string, SystemNotification[]>>((acc, n) => {
    const key = dayBucketKey(n.createdAt);
    (acc[key] = acc[key] || []).push(n);
    return acc;
  }, {});

  // Unique list of roles from catalog + default system roles
  const catalogRoles = state.catalogs?.roles || ['Operacional', 'TL', 'PS', 'Supervisor', 'Coordenador', 'Analista', 'Administrador'];
  const availableRoles = Array.from(new Set([...catalogRoles, 'TL', 'PS', 'Admin', 'Operador']));

  const toggleTypePref = (typeKey: keyof typeof notificationPreferences.enabledTypes) => {
    setNotificationPreferences((prev) => ({
      ...prev,
      enabledTypes: {
        ...prev.enabledTypes,
        [typeKey]: !prev.enabledTypes[typeKey],
      },
    }));
  };

  const toggleRolePref = (role: string) => {
    setNotificationPreferences((prev) => {
      const current = prev.enabledRoles || [];
      const updated = current.includes(role)
        ? current.filter((r) => r !== role)
        : [...current, role];
      return {
        ...prev,
        enabledRoles: updated,
      };
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-end pt-12 sm:pt-16 px-3 sm:px-6 bg-black/40 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-md sm:max-w-lg my-0 rounded-2xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg)] px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-[var(--ink)] tracking-tight">
                  {isPortalMode ? 'Notificações do Turno' : 'Central de Notificações'}
                </h3>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white font-black text-[9.5px] px-1.5 py-0.2 rounded-full shadow-2xs">
                    {unreadCount} {unreadCount === 1 ? 'nova' : 'novas'}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[var(--muted)] font-bold">
                {isPortalMode
                  ? targetShift
                    ? `Avisos operacionais do Turno ${targetShift} e direcionados a você`
                    : 'Avisos e tarefas operacionais direcionadas a você'
                  : 'Alertas de equipe, pedidos de serviço e preferências'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)] rounded-lg transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Notificações vs Preferências (Only outside portal mode) */}
        {!isPortalMode && (
          <div className="flex border-b border-[var(--line)] bg-[var(--bg)] px-3 pt-1.5 shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('notifs')}
              className={`px-3 py-1.5 text-xs font-black rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'notifs'
                  ? 'bg-[var(--paper)] text-[var(--primary)] border-t-2 border-x border-[var(--line)] border-t-[var(--primary)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Notificações</span>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white font-black text-[9px] px-1.5 py-0.1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('preferences')}
              className={`px-3 py-1.5 text-xs font-black rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preferences'
                  ? 'bg-[var(--paper)] text-[var(--primary)] border-t-2 border-x border-[var(--line)] border-t-[var(--primary)] shadow-2xs'
                  : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Preferências</span>
            </button>
          </div>
        )}

        {!isPortalMode && activeTab === 'preferences' ? (
          /* PREFERENCES TAB */
          <div className="p-4 overflow-y-auto space-y-4 flex-1 scrollbar-thin text-xs">
            {/* Audio & OS Toast Settings */}
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2.5">
              <h4 className="font-extrabold text-[var(--ink)] text-xs flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Alertas Sonoros & Pop-ups
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg cursor-pointer hover:border-emerald-500/50 transition-all">
                  <input
                    type="checkbox"
                    checked={notifSoundEnabled}
                    onChange={(e) => setNotifSoundEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-[var(--ink)] block">Sinal Sonoro</span>
                    <span className="text-[10px] text-[var(--muted)]">Tocar áudio ao receber</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg cursor-pointer hover:border-blue-500/50 transition-all">
                  <input
                    type="checkbox"
                    checked={notifPopupEnabled}
                    onChange={(e) => setNotifPopupEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-[var(--ink)] block">Toast Pop-up</span>
                    <span className="text-[10px] text-[var(--muted)]">Exibir aviso flutuante</span>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const granted = await requestNotificationPermission();
                    if (granted) {
                      showNativeOSNotification('Notificações Nativas Ativas', {
                        body: 'Você receberá avisos no sistema operacional.',
                      });
                      showNotice('✅ Notificações do SO ativadas!');
                    } else {
                      showNotice('⚠️ Não foi possível ativar as notificações no SO.');
                    }
                  }}
                  className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-extrabold rounded-lg border border-blue-500/30 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                >
                  <Bell className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  <span>Permissão no Sistema Operacional</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playNotificationSound();
                    showNotice('🎵 Som de teste executado!');
                  }}
                  className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold rounded-lg border border-amber-500/30 flex items-center gap-1.5 cursor-pointer text-[10.5px]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>Testar Som</span>
                </button>
              </div>
            </div>

            {/* Notification Types Filter */}
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2.5">
              <div>
                <h4 className="font-extrabold text-[var(--ink)] text-xs flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-[var(--primary)]" />
                  Tipos de Notificação Desejados
                </h4>
                <p className="text-[10.5px] text-[var(--muted)]">
                  Selecione quais categorias de notificações devem emitir alertas para você:
                </p>
              </div>

              <div className="space-y-1.5 pt-1">
                <label className="flex items-center justify-between p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg cursor-pointer hover:bg-[var(--line)]/30 transition-all">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-bold text-[var(--ink)] block">Pedidos de Ação & Serviço</span>
                      <span className="text-[10px] text-[var(--muted)]">Solicitações feitas por líderes e equipe</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPreferences?.enabledTypes?.request !== false}
                    onChange={() => toggleTypePref('request')}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg cursor-pointer hover:bg-[var(--line)]/30 transition-all">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                    <div>
                      <span className="font-bold text-[var(--ink)] block">Avisos Operacionais</span>
                      <span className="text-[10px] text-[var(--muted)]">Comunicados gerais do turno ou equipe</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPreferences?.enabledTypes?.notice !== false}
                    onChange={() => toggleTypePref('notice')}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg cursor-pointer hover:bg-[var(--line)]/30 transition-all">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-rose-500 shrink-0" />
                    <div>
                      <span className="font-bold text-[var(--ink)] block">Redefinições de Senha</span>
                      <span className="text-[10px] text-[var(--muted)]">Solicitações de senha de usuários</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPreferences?.enabledTypes?.password_reset !== false}
                    onChange={() => toggleTypePref('password_reset')}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg cursor-pointer hover:bg-[var(--line)]/30 transition-all">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-sky-500 shrink-0" />
                    <div>
                      <span className="font-bold text-[var(--ink)] block">Notificações do Sistema</span>
                      <span className="text-[10px] text-[var(--muted)]">Sincronizações, backups e relatórios</span>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPreferences?.enabledTypes?.system !== false}
                    onChange={() => toggleTypePref('system')}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Role Target Audience Filter */}
            <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-2.5">
              <div>
                <h4 className="font-extrabold text-[var(--ink)] text-xs flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Filtro por Cargo e Função
                </h4>
                <p className="text-[10.5px] text-[var(--muted)]">
                  A maioria dos pedidos é direcionada a funções específicas. Escolha como filtrar:
                </p>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-start gap-2.5 p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg cursor-pointer hover:bg-[var(--line)]/30 transition-all">
                  <input
                    type="radio"
                    name="roleFilterMode"
                    checked={notificationPreferences?.filterByRoleMode === 'my_role_only' || !notificationPreferences?.filterByRoleMode}
                    onChange={() => setNotificationPreferences((p) => ({ ...p, filterByRoleMode: 'my_role_only' }))}
                    className="mt-0.5 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-[var(--ink)] block">🎯 Apenas Meu Cargo / Função ({identifiedUser?.role || 'Não identificado'})</span>
                    <span className="text-[10px] text-[var(--muted)]">Filtra automaticamente apenas pedidos para o seu cargo e turno. Recomendado.</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg cursor-pointer hover:bg-[var(--line)]/30 transition-all">
                  <input
                    type="radio"
                    name="roleFilterMode"
                    checked={notificationPreferences?.filterByRoleMode === 'all'}
                    onChange={() => setNotificationPreferences((p) => ({ ...p, filterByRoleMode: 'all' }))}
                    className="mt-0.5 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-[var(--ink)] block">🌐 Todos os Cargos</span>
                    <span className="text-[10px] text-[var(--muted)]">Receber notificações enviadas para qualquer cargo ou liderança.</span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg cursor-pointer hover:bg-[var(--line)]/30 transition-all">
                  <input
                    type="radio"
                    name="roleFilterMode"
                    checked={notificationPreferences?.filterByRoleMode === 'custom_roles'}
                    onChange={() => setNotificationPreferences((p) => ({ ...p, filterByRoleMode: 'custom_roles' }))}
                    className="mt-0.5 text-[var(--primary)] focus:ring-[var(--primary)] cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-[var(--ink)] block">🛠️ Cargos Personalizados</span>
                    <span className="text-[10px] text-[var(--muted)]">Marque individualmente de quais cargos deseja receber avisos.</span>
                  </div>
                </label>

                {notificationPreferences?.filterByRoleMode === 'custom_roles' && (
                  <div className="mt-2 p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg space-y-1.5 animate-in fade-in duration-150">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] block">
                      Marque os cargos desejados:
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      {availableRoles.map((role) => {
                        const isChecked = (notificationPreferences.enabledRoles || []).includes(role);
                        return (
                          <label
                            key={role}
                            className={`flex items-center gap-2 p-1.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                                : 'bg-[var(--bg)] text-[var(--muted)] border-[var(--line)]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleRolePref(role)}
                              className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                            <span className="truncate">{role}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* NOTIFICATIONS LIST TAB */
          <>
            {/* Filter Pills & Actions */}
            <div className="px-3.5 py-2 bg-[var(--paper)] border-b border-[var(--line)] flex flex-wrap items-center justify-between text-xs shrink-0 gap-2">
              {!isPortalMode ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setNotificationFilter('received')}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold cursor-pointer transition-all ${
                      notificationFilter === 'received'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
                    }`}
                  >
                    Recebidas (Meu Turno)
                  </button>

                  <button
                    type="button"
                    onClick={() => setNotificationFilter('all_my_shift')}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold cursor-pointer transition-all ${
                      notificationFilter === 'all_my_shift'
                        ? 'bg-[var(--primary)] text-white shadow-xs'
                        : 'bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
                    }`}
                    title="Exibir todas as notificações do seu turno, incluindo as enviadas por você"
                  >
                    Exibir Todas (Meu Turno)
                  </button>

                  <button
                    type="button"
                    onClick={() => setNotificationFilter('all_system')}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold cursor-pointer transition-all ${
                      notificationFilter === 'all_system'
                        ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-xs'
                        : 'bg-[var(--bg)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
                    }`}
                  >
                    Todos os Turnos
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[var(--muted)]">
                    {targetShift ? `Avisos do Turno ${targetShift} e direcionados` : 'Avisos e tarefas direcionadas'}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="text-[10.5px] font-extrabold text-[var(--primary)] hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Marcar lidas
                  </button>
                )}

                {effectiveNotifications.some((n) => n.read || (n.readByUserIds && [collaboratorId, identifiedUser?.id, identifiedUser?.collaboratorId].filter(Boolean).some(id => n.readByUserIds!.includes(id!)))) && (
                  <button
                    type="button"
                    onClick={() => clearAllNotifications('read_only', 'self')}
                    className="text-[10.5px] font-extrabold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                    title="Remover da sua caixa apenas as notificações que já foram lidas"
                  >
                    <Trash className="w-3 h-3" />
                    Limpar lidas
                  </button>
                )}

                {effectiveNotifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Deseja limpar as notificações da sua caixa pessoal? (Esta ação não afeta os outros colaboradores)')) {
                        clearAllNotifications('all', 'self');
                      }
                    }}
                    className="text-[10.5px] font-extrabold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
                    title="Limpar notificações da sua caixa pessoal"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpar minhas notificações
                  </button>
                )}

                {identifiedUser?.isAdmin && !isPortalMode && notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('⚠️ ATENÇÃO: Esta ação apagará todas as notificações do sistema para TODOS os colaboradores. Deseja prosseguir com a exclusão global?')) {
                        clearAllNotifications('all', 'global');
                      }
                    }}
                    className="text-[10px] font-semibold text-[var(--muted)] hover:text-rose-600 hover:underline cursor-pointer flex items-center gap-1 ml-auto"
                    title="Excluir notificações do sistema globalmente (Apenas Administrador)"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                    Excluir global (Gestor)
                  </button>
                )}
              </div>
            </div>

            {/* Main Notifications List */}
            <div className="p-3.5 overflow-y-auto space-y-3 flex-1 scrollbar-thin">
              {filteredNotifications.length === 0 ? (
                <div className="p-10 text-center text-xs text-[var(--muted)] bg-[var(--bg)] border border-[var(--line)] rounded-2xl space-y-2">
                  <Bell className="w-8 h-8 mx-auto text-[var(--muted)] opacity-50" />
                  <div className="font-bold text-[var(--ink)]">Nenhuma notificação encontrada</div>
                  <p className="text-[11px] opacity-80 max-w-xs mx-auto">
                    {isPortalMode
                      ? 'Você não possui avisos do turno ou tarefas pendentes no momento.'
                      : notificationFilter === 'received'
                      ? 'Você não possui notificações recebidas pendentes no momento (as enviadas por você estão ocultas aqui).'
                      : 'Nenhuma notificação registrada para o filtro selecionado.'}
                  </p>
                </div>
              ) : (
                Object.entries(groupedNotifications).map(([bucket, items]) => (
                  <div key={bucket}>
                    <div className="flex items-center gap-2 pt-1 pb-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] bg-[var(--surface-2)] border border-[var(--line)] px-2 py-0.5 rounded-md">
                        {bucket}
                      </span>
                      <div className="flex-1 h-px bg-[var(--line)]" />
                      <span className="text-[10px] font-bold text-[var(--muted)]">{items.length}</span>
                    </div>
                    <div className="space-y-3">
                      {items.map((n) => {
                  const isRequest = n.type === 'request';
                  const isReset = n.type === 'password_reset';
                  const isNotice = n.type === 'notice';
                  const ownSent = isSentByMe(n);

                  return (
                    <div
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id);
                        if (n.data?.requestId) goToNotification(n);
                      }}
                      className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isRequest
                          ? 'border-2 border-amber-500/80 dark:border-amber-400 bg-amber-500/10 dark:bg-amber-950/20 shadow-md ring-1 ring-amber-500/30'
                          : isReset
                            ? 'border-l-4 border-l-rose-500 border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20 shadow-xs'
                            : isNotice
                              ? 'border-l-4 border-l-emerald-500 border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-xs'
                              : 'border-l-4 border-l-sky-500 border-sky-500/30 bg-sky-500/5 dark:bg-sky-950/20 shadow-xs'
                      } ${!n.read ? 'ring-2 ring-emerald-500/40' : 'opacity-85 hover:opacity-100'}`}
                    >
                      {/* Top Bar with Badge Type & Date */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isRequest ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-1 shadow-xs animate-pulse">
                              <ClipboardList className="w-3.5 h-3.5" />
                              PEDIDO DE SERVIÇO
                            </span>
                          ) : isReset ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 flex items-center gap-1">
                              <Key className="w-3.5 h-3.5 text-rose-500" />
                              REDEFINIÇÃO DE SENHA
                            </span>
                          ) : isNotice ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                              AVISO OPERACIONAL
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 text-sky-500" />
                              SISTEMA
                            </span>
                          )}

                          {!n.read && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" title="Não lida" />
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className="text-[10px] text-[var(--muted)] font-extrabold whitespace-nowrap"
                            title={new Date(n.createdAt).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          >
                            {formatRelativeTime(n.createdAt)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(n.id);
                            }}
                            className="p-1 text-[var(--muted)] hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Apagar esta notificação"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title & Message Body */}
                      <h4 className={`text-xs font-black tracking-tight ${isRequest ? 'text-amber-900 dark:text-amber-300 text-[13px]' : 'text-[var(--ink)]'}`}>
                        {n.title}
                      </h4>

                      <div className="mt-1 text-[var(--muted)] font-medium text-[11.5px] leading-relaxed">
                        <MarkdownContent content={n.message} sizeClass="text-[11.5px] font-medium leading-relaxed" />
                      </div>

                      {/* Footer metadata: Sender & Shift */}
                      <div className="mt-2.5 pt-2 border-t border-[var(--line)]/60 flex flex-wrap items-center justify-between text-[10px] font-bold text-[var(--muted)] gap-2">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-[var(--muted)]" />
                          <span>Enviado por: <strong className="text-[var(--ink)]">{n.senderName || 'Sistema'}</strong></span>
                          {ownSent && (
                            <span className="ml-1 text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                              (Enviado por você)
                            </span>
                          )}
                        </div>

                        {n.shift && (
                          <span className="px-1.5 py-0.2 rounded bg-[var(--bg)] border border-[var(--line)] font-black text-[9.5px]">
                            Turno: {n.shift}
                          </span>
                        )}
                      </div>

                      {/* Highlighted Request Button */}
                      {n.data?.requestId && (
                        <div className="mt-2.5 flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              markNotificationRead(n.id);
                              goToNotification(n);
                            }}
                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-xl shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>Visualizar / Tratar Pedido</span>
                          </button>
                        </div>
                      )}

                      {/* Password Reset Authorization Action */}
                      {isReset &&
                        (identifiedUser?.isSuperAdmin ||
                          identifiedUser?.isAdmin ||
                          identifiedUser?.role === 'TL' ||
                          identifiedUser?.id === 'admin' ||
                          identifiedUser?.id === 'super_admin') && (
                          <div className="mt-2.5 pt-2 border-t border-rose-500/20 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                              Autorizar remoção de senha para este usuário?
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                authorizePasswordReset(n.id);
                              }}
                              className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg text-[11px] hover:bg-rose-700 cursor-pointer transition-colors shadow-2xs flex items-center gap-1"
                            >
                              <Key className="w-3.5 h-3.5" />
                              Autorizar Redefinição
                            </button>
                          </div>
                        )}
                    </div>
                  );
                      })}
                    </div>
                  </div>
                )))}
            </div>
          </>
        )}

        {isPortalMode && (
          <div className="px-4 py-2.5 bg-[var(--bg)] border-t border-[var(--line)] text-[10px] text-[var(--muted)] font-medium flex items-center justify-between shrink-0">
            <span>⚙️ Os alertas de som, vibração e regras são administrados nas Configurações do Portal (menu Configurações → Painel & Portal).</span>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
