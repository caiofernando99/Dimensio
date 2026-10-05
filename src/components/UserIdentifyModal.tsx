import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { requestNotificationPermission } from '../utils/notifications';
import { matchesCollaboratorSearch, scoreCollaboratorSearch } from '../utils/helpers';
import { Collaborator } from '../types';
import {
  UserCheck,
  Lock,
  Key,
  CheckCircle,
  X,
  Shield,
  UserX,
  Search,
  Users,
  ShieldCheck,
  Sparkles,
  Crown,
  Clock,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';

interface UserIdentifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'identify' | 'password';
}

interface IdentifiableProfile extends Collaborator {
  isSynthesizedTL?: boolean;
  hasPassword?: boolean;
}

export const UserIdentifyModal: React.FC<UserIdentifyModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'identify',
}) => {
  const {
    state,
    identifiedUser,
    identifyUser,
    logoutUser,
    setUserPassword,
    requestPasswordReset,
    showNotice,
    setSelectedGlobalFilters,
    signInWithGoogleAuth,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'identify' | 'password'>(initialTab);
  const [shiftFilter, setShiftFilter] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCollabId, setSelectedCollabId] = useState<string>('');
  const [inputPassword, setInputPassword] = useState<string>('');
  const [resetRequested, setResetRequested] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Initial password setup state (when sector requires password and user has none)
  const [initNewPassword, setInitNewPassword] = useState<string>('');
  const [initConfirmPassword, setInitConfirmPassword] = useState<string>('');

  // Set password tab state
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [passwordSuccess, setPasswordSuccess] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync tab state and reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery('');
      setLoginError(null);
      setResetRequested(false);
      setInputPassword('');
      setInitNewPassword('');
      setInitConfirmPassword('');
      setShiftFilter('todos');
      if (identifiedUser) {
        setSelectedCollabId(identifiedUser.collaboratorId || identifiedUser.id || '');
      } else {
        setSelectedCollabId('');
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialTab, identifiedUser]);

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

  // Build unified list of all identifiable profiles (collaborators + team leaders)
  const allProfiles = useMemo<IdentifiableProfile[]>(() => {
    const list: IdentifiableProfile[] = [];
    const seenNames = new Set<string>();
    const seenIds = new Set<string>();

    // 1. Add all registered collaborators
    (state.collaborators || []).forEach((c) => {
      if (!c || !c.name || !c.name.trim()) return;
      const normalizedName = c.name.trim().toLowerCase();
      seenNames.add(normalizedName);
      seenIds.add(c.id);
      list.push({
        ...c,
        hasPassword: Boolean(state.userPasswords?.[c.id]),
      });
    });

    // 2. Include any Team Leaders from state.teamLeaders (or defaultTeamLeader) that don't have a collaborator entry yet
    const teamLeadersList = Array.isArray(state.teamLeaders) ? state.teamLeaders : [];
    const allTLNames = [...teamLeadersList];
    if (state.defaultTeamLeader && !allTLNames.includes(state.defaultTeamLeader)) {
      allTLNames.push(state.defaultTeamLeader);
    }

    allTLNames.forEach((tlName) => {
      if (!tlName || !tlName.trim()) return;
      const normalizedName = tlName.trim().toLowerCase();
      if (seenNames.has(normalizedName)) return;

      const tlId = `tl_${tlName.trim().replace(/\s+/g, '_').toLowerCase()}`;
      if (seenIds.has(tlId)) return;

      seenNames.add(normalizedName);
      seenIds.add(tlId);

      const shiftAssigned = state.teamShiftMap?.[tlName] || state.teamShift || 'T2';
      list.push({
        id: tlId,
        name: tlName.trim(),
        role: 'TL',
        shift: shiftAssigned,
        scale: 'A',
        teamLeader: tlName.trim(),
        category: 'Liderança',
        skills: { Liderança: 3, 'Gestão Operacional': 3 },
        isSynthesizedTL: true,
        hasPassword: Boolean(state.userPasswords?.[tlId]),
      });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  }, [state.collaborators, state.teamLeaders, state.defaultTeamLeader, state.teamShiftMap, state.teamShift, state.userPasswords]);

  // Super admin secret trigger
  const showSuperAdmin = searchQuery.includes('.');

  // Filter profiles based on search query and shift/role filter
  const filteredProfiles = useMemo(() => {
    const raw = searchQuery.trim();

    const matchesFilter = (p: IdentifiableProfile) => {
      if (shiftFilter === 'todos') return true;
      if (shiftFilter === 'TL') return p.role === 'TL' || p.isSynthesizedTL;
      if (shiftFilter === 'PS') return p.role === 'PS';
      if (shiftFilter === 'REP') return p.role !== 'TL' && p.role !== 'PS';
      return p.shift === shiftFilter;
    };

    // If no search query, strictly filter by tab
    if (!raw) {
      return allProfiles.filter(matchesFilter);
    }

    // When searching: match by query across all profiles
    const searchMatches = allProfiles.filter((p) =>
      matchesCollaboratorSearch(p, raw, { defaultTeamLeader: state.defaultTeamLeader })
    );

    // Relevância primeiro: nome próprio acima de time/líder (ex: "matheus"
    // mostra os Matheus antes dos 60+ liderados por um Matheus).
    const byScore = (a: IdentifiableProfile, b: IdentifiableProfile) =>
      scoreCollaboratorSearch(b, raw, { defaultTeamLeader: state.defaultTeamLeader }) -
      scoreCollaboratorSearch(a, raw, { defaultTeamLeader: state.defaultTeamLeader });

    // If shiftFilter is 'todos', return all search matches
    if (shiftFilter === 'todos') {
      return [...searchMatches].sort(byScore);
    }

    // If user selected a specific filter tab, prioritize items in this filter and append others below
    const inFilterMatches = searchMatches.filter(matchesFilter).sort(byScore);
    const outOfFilterMatches = searchMatches.filter((p) => !matchesFilter(p)).sort(byScore);

    return [...inFilterMatches, ...outOfFilterMatches];
  }, [allProfiles, searchQuery, shiftFilter, state.defaultTeamLeader]);

  const activeProfile = useMemo(() => {
    if (!selectedCollabId) return null;
    return allProfiles.find((p) => p.id === selectedCollabId) || null;
  }, [allProfiles, selectedCollabId]);

  const isPasswordRequired = useMemo(() => {
    if (!selectedCollabId) return false;
    if (selectedCollabId === 'super_admin' || selectedCollabId === 'admin') {
      return true;
    }
    // Check if sector requires password
    if (state.requireUserPassword) {
      return true;
    }
    // Check if collaborator already has a password configured
    return Boolean(activeProfile?.hasPassword);
  }, [selectedCollabId, state.requireUserPassword, activeProfile]);

  const profileNeedsInitialPassword = useMemo(() => {
    if (!selectedCollabId || selectedCollabId === 'super_admin' || selectedCollabId === 'admin') {
      return false;
    }
    return Boolean(state.requireUserPassword && !activeProfile?.hasPassword);
  }, [selectedCollabId, state.requireUserPassword, activeProfile]);

  const handleIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!selectedCollabId) {
      setLoginError('Selecione ou busque o seu nome na lista antes de se identificar.');
      return;
    }

    // If sector requires password and collaborator has no password, validate the initial password form
    if (profileNeedsInitialPassword) {
      if (!initNewPassword || initNewPassword.length < 3) {
        setLoginError('A nova senha deve ter no mínimo 3 caracteres.');
        return;
      }
      if (initNewPassword !== initConfirmPassword) {
        setLoginError('A confirmação de senha não confere.');
        return;
      }
    }

    const passToSubmit = profileNeedsInitialPassword ? initNewPassword : inputPassword;
    const result = identifyUser(selectedCollabId, passToSubmit);

    if (result.success) {
      requestNotificationPermission();
      if (activeProfile && activeProfile.shift) {
        setSelectedGlobalFilters({
          shift: activeProfile.shift,
          teamLeader: activeProfile.teamLeader || undefined,
        });
      }
      setInputPassword('');
      setInitNewPassword('');
      setInitConfirmPassword('');
      onClose();
    } else {
      setLoginError(result.message);
    }
  };

  const handleSetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifiedUser) return;
    if (newPassword !== confirmPassword) {
      showNotice('As senhas não coincidem.');
      return;
    }
    if (newPassword.length < 3) {
      showNotice('A senha deve ter no mínimo 3 caracteres.');
      return;
    }

    const targetId = identifiedUser.collaboratorId || identifiedUser.id;
    setUserPassword(targetId, newPassword);
    setPasswordSuccess(true);
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSuccess(false), 3000);
  };

  const handleForgotPassword = () => {
    if (!selectedCollabId) return;
    if (selectedCollabId === 'admin' || selectedCollabId === 'super_admin') {
      showNotice('A conta Master/Admin pode ser acessada com a senha padrão ou redefinida nas opções avançadas.');
      return;
    }
    const result = requestPasswordReset(selectedCollabId);
    setResetRequested(true);
    showNotice(result.message);
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center sm:items-start justify-center sm:justify-end pt-3 sm:pt-14 px-3 sm:px-6 bg-black/50 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        className="relative w-full max-w-md sm:max-w-xl my-0 rounded-2xl border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-right-8 duration-200"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--bg)] px-4 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[var(--ink)] tracking-tight">
                Identificação de Usuário
              </h3>
              <p className="text-[10px] text-[var(--muted)] font-bold">
                Operadores, Líderes de Equipe (TL) e Especialistas (PS)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)] rounded-xl transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Current Identified User Banner */}
        {identifiedUser && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-xs">
                <span className="font-extrabold text-[var(--ink)]">{identifiedUser.name}</span>
                <span className="text-[var(--muted)] font-medium"> ({identifiedUser.role})</span>
                {identifiedUser.shift && (
                  <span className="ml-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    • Turno {identifiedUser.shift}
                  </span>
                )}
                {identifiedUser.isEditor && (
                  <span className="ml-1.5 bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                    Editor
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={logoutUser}
              className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <UserX className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        )}

        {/* Tabs if logged in */}
        {identifiedUser && (
          <div className="flex border-b border-[var(--line)] bg-[var(--bg)] text-xs font-bold px-3 pt-2 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('identify')}
              className={`px-3 py-1.5 rounded-t-xl border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'identify'
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--paper)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Trocar Perfil
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('password')}
              className={`px-3 py-1.5 rounded-t-xl border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'password'
                  ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--paper)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              Minha Senha
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1">
          {activeTab === 'identify' ? (
            <form onSubmit={handleIdentify} className="space-y-3.5">
              {/* Sector Password Policy Status Badge */}
              <div className="flex items-center justify-between px-3 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[11px]">
                <div className="flex items-center gap-2 font-bold text-[var(--ink)]">
                  {state.requireUserPassword ? (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span>Exigência de Senha no Setor: <strong className="text-amber-600 dark:text-amber-400">Obrigatória</strong></span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <span>Exigência de Senha no Setor: <strong className="text-emerald-600 dark:text-emerald-400">Opcional</strong></span>
                    </>
                  )}
                </div>
                <div className="text-[10px] text-[var(--muted)] font-medium">
                  {allProfiles.length} perfis disponíveis
                </div>
              </div>

              {!identifiedUser && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await signInWithGoogleAuth();
                      if (res.success) {
                        onClose();
                      }
                    }}
                    className="w-full py-2.5 px-3 bg-white dark:bg-slate-900 border-2 border-[var(--line)] hover:border-indigo-500 rounded-xl text-xs font-black text-[var(--ink)] flex items-center justify-center gap-2 cursor-pointer shadow-2xs hover:shadow-xs transition"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                    </svg>
                    <span>Entrar com Conta Google Workspace</span>
                  </button>
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-[var(--line)]"></div>
                    <span className="flex-shrink mx-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                      ou busque na lista de colaboradores
                    </span>
                    <div className="flex-grow border-t border-[var(--line)]"></div>
                  </div>
                </div>
              )}

              {/* Search Box */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold text-[var(--ink)]">
                  Busque o seu nome ou cargo para se identificar:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-3 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSearchQuery(v);
                      if (!v.includes('.') && selectedCollabId === 'super_admin') {
                        setSelectedCollabId('');
                      }
                      setLoginError(null);
                      setResetRequested(false);
                    }}
                    placeholder="Digite nome, TL, turno (T1, T2), cargo ou matrícula..."
                    autoFocus
                    autoComplete="off"
                    className="w-full bg-[var(--bg)] border border-[var(--line)] text-sm font-bold rounded-xl pl-9 pr-8 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)] placeholder:text-[var(--muted)]/70"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setLoginError(null);
                      }}
                      className="absolute right-2.5 top-2.5 text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer text-xs p-1"
                      aria-label="Limpar busca"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Quick Filters */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10.5px] font-bold scrollbar-thin">
                  <span className="text-[var(--muted)] text-[10px] uppercase font-black mr-1 shrink-0">Filtrar:</span>
                  {[
                    { id: 'todos', label: 'Todos' },
                    { id: 'TL', label: 'Líderes (TL)' },
                    { id: 'PS', label: 'PS (Especialistas)' },
                    { id: 'T1', label: 'T1' },
                    { id: 'T2', label: 'T2' },
                    { id: 'T3', label: 'T3' },
                    { id: 'T4', label: 'T4' },
                    { id: 'T5', label: 'T5' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setShiftFilter(f.id)}
                      className={`px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer ${
                        shiftFilter === f.id
                          ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs font-black'
                          : 'bg-[var(--bg)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-[var(--primary)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Profiles Dropdown / List */}
                <div className="max-h-56 overflow-y-auto border border-[var(--line)] rounded-xl bg-[var(--paper)] divide-y divide-[var(--line)] shadow-inner">
                  {showSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCollabId('super_admin');
                        setLoginError(null);
                        setResetRequested(false);
                      }}
                      className={`w-full text-left p-2.5 flex items-center gap-2.5 text-xs cursor-pointer transition-colors ${
                        selectedCollabId === 'super_admin'
                          ? 'bg-amber-500/15 border-l-4 border-amber-500'
                          : 'hover:bg-[var(--bg)]'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 text-xs font-black flex items-center justify-center shrink-0">
                        👑
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-[12px] text-amber-700 dark:text-amber-300 leading-tight">
                          Administrador Geral (Master)
                        </div>
                        <div className="text-[10px] text-[var(--muted)] font-medium">
                          Acesso completo irrestrito a todos os turnos e configurações
                        </div>
                      </div>
                      {selectedCollabId === 'super_admin' && (
                        <CheckCircle className="w-4 h-4 text-amber-600 shrink-0 ml-auto" />
                      )}
                    </button>
                  )}

                  {filteredProfiles.map((p) => {
                    const isSelected = selectedCollabId === p.id;
                    const isTL = p.role === 'TL' || p.isSynthesizedTL;
                    const isPS = p.role === 'PS';

                    const initials = (p.name || '')
                      .split(/\s+/)
                      .map((w) => w[0])
                      .filter(Boolean)
                      .slice(0, 2)
                      .join('')
                      .toUpperCase();

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedCollabId(p.id);
                          setLoginError(null);
                          setResetRequested(false);
                        }}
                        className={`w-full text-left p-2.5 flex items-center gap-2.5 text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[var(--primary)]/15 border-l-4 border-[var(--primary)]'
                            : 'hover:bg-[var(--bg)]'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl text-[11px] font-black flex items-center justify-center shrink-0 ${
                            isTL
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                              : isPS
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                              : 'bg-[var(--primary-soft)] text-[var(--primary)]'
                          }`}
                        >
                          {isTL ? <Crown className="w-3.5 h-3.5" /> : initials}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-extrabold truncate text-[12px] text-[var(--ink)]">
                              {p.name}
                            </span>
                            {/* Role Badge */}
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9.5px] font-black uppercase ${
                                isTL
                                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                                  : isPS
                                  ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                  : 'bg-[var(--line)] text-[var(--muted)]'
                              }`}
                            >
                              {isTL ? 'Líder (TL)' : p.role || 'Operador'}
                            </span>
                            {/* Password Badge */}
                            {p.hasPassword ? (
                              <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" />
                                Com senha
                              </span>
                            ) : state.requireUserPassword ? (
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-0.5">
                                <KeyRound className="w-2.5 h-2.5" />
                                Criará senha
                              </span>
                            ) : null}
                          </div>

                          {/* Distinct Subtitle metadata for namesakes */}
                          <div className="flex items-center gap-2 text-[10px] text-[var(--muted)] font-medium mt-0.5 flex-wrap">
                            {p.sector && (
                              <span className="text-[var(--primary)] font-black">
                                {p.sector}
                              </span>
                            )}
                            {p.canProvideCrossSectorSupport && (
                              <span className="bg-purple-500/15 text-purple-700 dark:text-purple-300 font-extrabold px-1.5 py-0.2 rounded text-[9px]">
                                🌐 Multissetorial
                              </span>
                            )}
                            {p.shift && (
                              <span className="flex items-center gap-0.5 text-[var(--ink)] font-bold">
                                <Clock className="w-2.5 h-2.5 text-[var(--muted)]" />
                                Turno {p.shift}
                              </span>
                            )}
                            {p.teamLeader && p.role !== 'TL' && (
                              <span className="border-l border-[var(--line)] pl-1.5">
                                TL: <strong className="text-[var(--ink)]">{p.teamLeader}</strong>
                              </span>
                            )}
                            {p.registration && (
                              <span className="border-l border-[var(--line)] pl-1.5">
                                Mat: {p.registration}
                              </span>
                            )}
                            {p.login && (
                              <span className="border-l border-[var(--line)] pl-1.5">
                                @{p.login}
                              </span>
                            )}
                            {p.scale && (
                              <span className="border-l border-[var(--line)] pl-1.5">
                                Grupo {p.scale}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-[var(--primary)] shrink-0 ml-auto" />
                        )}
                      </button>
                    );
                  })}

                  {!showSuperAdmin && filteredProfiles.length === 0 && (
                    <div className="p-4 text-xs text-[var(--muted)] text-center space-y-1">
                      <div>Nenhum colaborador ou líder encontrado para "{searchQuery.trim()}".</div>
                      <div className="text-[10.5px]">Verifique a digitação ou selecione "Todos" nos filtros acima.</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Context Summary Badge */}
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold">
                {selectedCollabId === 'super_admin' ? (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span>Acesso Geral: <strong>Administrador Geral (Master)</strong></span>
                  </div>
                ) : activeProfile ? (
                  <div className="flex items-center justify-between text-[var(--ink)]">
                    <div className="flex items-center gap-2 min-w-0">
                      <Users className="w-4 h-4 text-[var(--primary)] shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate font-extrabold">
                          {activeProfile.name} <span className="text-[var(--muted)] font-normal">({activeProfile.role})</span>
                        </div>
                        <div className="text-[10px] text-[var(--muted)] font-medium">
                          Setor: <strong className="text-[var(--primary)]">{activeProfile.sector || state.sector || 'Operação'}</strong> {activeProfile.canProvideCrossSectorSupport ? '• 🌐 Suporte Cross-Setor' : ''} • Turno {activeProfile.shift || 'Geral'} {activeProfile.teamLeader && activeProfile.role !== 'TL' ? `• TL: ${activeProfile.teamLeader}` : ''}
                        </div>
                      </div>
                    </div>
                    {activeProfile.hasPassword && (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0 font-bold">
                        🔒 Protegido com senha
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[var(--muted)] italic">Nenhum colaborador selecionado. Escolha um na lista acima.</span>
                )}
              </div>

              {/* Password Requirement / Input Section */}
              {selectedCollabId ? (
                profileNeedsInitialPassword ? (
                  /* Initial Password Creation Form (Required by Sector Policy) */
                  <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-800 dark:text-amber-300">
                      <KeyRound className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Definição de Senha Obrigatória</span>
                    </div>
                    <p className="text-[11px] text-[var(--muted)] font-medium leading-tight">
                      Este setor exige senha para todos os colaboradores. Crie sua senha pessoal de acesso para <strong className="text-[var(--ink)]">{activeProfile?.name}</strong>:
                    </p>

                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                          Nova Senha de Acesso:
                        </label>
                        <input
                          type="password"
                          value={initNewPassword}
                          onChange={(e) => setInitNewPassword(e.target.value)}
                          placeholder="Mínimo 3 caracteres..."
                          required
                          className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-[var(--ink)] mb-1">
                          Confirmar Nova Senha:
                        </label>
                        <input
                          type="password"
                          value={initConfirmPassword}
                          onChange={(e) => setInitConfirmPassword(e.target.value)}
                          placeholder="Digite a mesma senha..."
                          required
                          className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                        />
                      </div>
                    </div>
                  </div>
                ) : isPasswordRequired ? (
                  /* Regular Password Input Field */
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-extrabold text-[var(--ink)]">
                        Digite sua Senha de Acesso:
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-[11px] font-bold text-[var(--primary)] hover:underline cursor-pointer"
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[var(--muted)] absolute left-3 top-2.5" />
                      <input
                        type="password"
                        value={inputPassword}
                        onChange={(e) => setInputPassword(e.target.value)}
                        placeholder="Digite sua senha..."
                        required
                        autoFocus
                        className="w-full bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                      />
                    </div>
                    {resetRequested && (
                      <div className="mt-1 text-[10.5px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/10 p-2 rounded-lg flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        Solicitação enviada. O Administrador/TL redefinirá sua senha na Central de Avisos.
                      </div>
                    )}
                  </div>
                ) : (
                  /* Direct Entry Note (Password Optional and user has no password) */
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-[var(--muted)] flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Perfil sem senha cadastrada. Entrada direta sem necessidade de senha.</span>
                  </div>
                )
              ) : null}

              {/* Submit Buttons */}
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--muted)] hover:bg-[var(--line)] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedCollabId}
                  className={`px-5 py-2 font-bold rounded-xl text-xs transition-all cursor-pointer shadow-sm flex items-center gap-1.5 ${
                    selectedCollabId
                      ? 'bg-[var(--primary)] text-white hover:opacity-90'
                      : 'bg-[var(--line)] text-[var(--muted)] opacity-60 cursor-not-allowed'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  {profileNeedsInitialPassword ? 'Definir Senha e Entrar' : 'Identificar-se'}
                </button>
              </div>
            </form>
          ) : (
            /* Set/Change Password Form */
            <form onSubmit={handleSetPassword} className="space-y-3.5">
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                <div className="text-xs font-extrabold text-[var(--ink)]">
                  Cadastrar ou Alterar Senha Pessoal
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  Defina uma senha pessoal de acesso para a conta{' '}
                  <strong className="text-[var(--ink)]">{identifiedUser?.name}</strong>.
                </div>
              </div>

              {passwordSuccess && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  Senha pessoal salva com sucesso!
                </div>
              )}

              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-extrabold text-[var(--ink)] mb-1">
                    Nova Senha:
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 3 caracteres..."
                    required
                    className="w-full bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-[var(--ink)] mb-1">
                    Confirmar Nova Senha:
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Digite novamente..."
                    required
                    className="w-full bg-[var(--bg)] border border-[var(--line)] text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--muted)] hover:bg-[var(--line)] cursor-pointer"
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                >
                  <Key className="w-4 h-4" />
                  Salvar Senha
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
