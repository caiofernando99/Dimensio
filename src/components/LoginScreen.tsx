import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Search, Lock, ShieldCheck, User, ArrowRight, RefreshCw, PlugZap, Building2, Layers, Globe, Calendar, CheckSquare } from 'lucide-react';

// Tela de login exibida quando o acesso anônimo está desabilitado nas
// configurações. Valida contra as senhas já cadastradas (userPasswords) e
// identifica o usuário da sessão com suporte multissetorial.
const LoginScreen: React.FC<{ onConnectCloud?: () => void }> = ({ onConnectCloud }) => {
  const { state, identifyUser, signInWithGoogleAuth, showNotice } = useApp();
  const [query, setQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);

  const collaborators = state.collaborators || [];

  const hasTeamData = collaborators.length > 0;
  const hasAdminPassword = Boolean(state.userPasswords?.['admin']);
  const hasSuperAdminPassword = Boolean(state.userPasswords?.['super_admin']);

  // List of available sectors
  const availableSectors = useMemo(() => {
    const list = new Set<string>();
    if (state.registeredSectors && state.registeredSectors.length > 0) {
      state.registeredSectors.forEach((s) => list.add(s));
    }
    if (state.sectorDefinitions && state.sectorDefinitions.length > 0) {
      state.sectorDefinitions.forEach((s) => list.add(s.name));
    }
    if (state.sector) {
      list.add(state.sector);
    }
    collaborators.forEach((c) => {
      if (c.sector) list.add(c.sector);
    });
    return Array.from(list);
  }, [state.registeredSectors, state.sectorDefinitions, state.sector, collaborators]);

  const filtered = useMemo(() => {
    let list = collaborators;
    if (selectedSector !== 'all') {
      list = list.filter(
        (c) => (c.sector || state.sector || '').toLowerCase() === selectedSector.toLowerCase()
      );
    }
    const q = query.trim().toLowerCase();
    if (!q) return list.slice(0, 50);
    return list
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.registration || '').toLowerCase().includes(q) ||
          (c.login || '').toLowerCase().includes(q) ||
          (c.sector || '').toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [collaborators, selectedSector, state.sector, query]);

  const selected = selectedId ? collaborators.find((c) => c.id === selectedId) : null;
  const selectedSectorDef = useMemo(() => {
    if (!selected) return null;
    const secName = selected.sector || state.sector;
    return (state.sectorDefinitions || []).find(
      (d) => d.name.toLowerCase() === (secName || '').toLowerCase()
    );
  }, [selected, state.sector, state.sectorDefinitions]);

  const requiresPassword =
    Boolean(selected && state.userPasswords?.[selected.id]) ||
    Boolean(state.requireUserPassword) ||
    Boolean(selectedSectorDef?.requirePassword);

  const doLogin = (id: string, pass: string) => {
    setError(null);
    const result = identifyUser(id, pass || undefined);
    if (!result.success) {
      setError(result.message);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoggingInGoogle(true);
    try {
      const res = await signInWithGoogleAuth();
      if (!res.success) {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao autenticar com a Conta Google.');
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    doLogin(selectedId, password);
  };

  return (
    <div className="min-h-screen h-dvh flex items-center justify-center bg-[var(--bg)] p-4 overflow-hidden">
      <div className="w-full max-w-md">
        <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl shadow-2xs overflow-hidden">
          {/* Cabeçalho da marca */}
          <div className="bg-[var(--primary)] text-white px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-black leading-tight">Dimensio</div>
              <div className="text-[11px] text-white/80 font-semibold">
                Acesso multissetorial — identifique-se para continuar
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Opção de Login com Google Workspace Corporativo */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoggingInGoogle}
                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border-2 border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] text-xs font-black rounded-xl flex items-center justify-center gap-2.5 cursor-pointer shadow-xs hover:shadow-sm transition-all disabled:opacity-50"
              >
                {isLoggingInGoogle ? (
                  <RefreshCw className="w-4 h-4 text-[var(--primary)] animate-spin" />
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                )}
                <span>{isLoggingInGoogle ? 'Conectando ao Google...' : 'Entrar com Conta Google Workspace'}</span>
              </button>
              <div className="flex items-center justify-between text-[10px] text-[var(--muted)] font-semibold px-1">
                <span>📅 Google Calendar</span>
                <span>•</span>
                <span>✅ Google Tasks</span>
                <span>•</span>
                <span>📊 Google Forms</span>
              </div>
            </div>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-[var(--line)]"></div>
              <span className="flex-shrink mx-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                ou identifique-se na escala
              </span>
              <div className="flex-grow border-t border-[var(--line)]"></div>
            </div>

            {!hasTeamData && !hasAdminPassword && !hasSuperAdminPassword ? (
              // Sessão sem dados: primeiro é preciso conectar a nuvem para carregar
              // a equipe e as senhas.
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center">
                  <PlugZap className="w-6 h-6 text-amber-500" />
                </div>
                <p className="text-xs font-bold text-[var(--ink)]">
                  Nenhum dado de equipe carregado nesta sessão
                </p>
                <p className="text-[11px] text-[var(--muted)] font-semibold">
                  Conecte a planilha compartilhada da operação ou entre com o Google Workspace acima.
                </p>
                <button
                  onClick={onConnectCloud}
                  className="mt-1 w-full px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <PlugZap className="w-4 h-4" />
                  Conectar planilha compartilhada
                </button>
              </div>
            ) : (
              <>
                {/* Acesso rápido administrativo */}
                {(hasSuperAdminPassword || hasAdminPassword) && (
                  <div className="grid grid-cols-2 gap-2">
                    {hasSuperAdminPassword && (
                      <button
                        onClick={() => doLogin('super_admin', password)}
                        className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer hover:bg-rose-100 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Admin Geral
                      </button>
                    )}
                    {hasAdminPassword && (
                      <button
                        onClick={() => doLogin('admin', password)}
                        className="px-3 py-2 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer hover:bg-blue-100 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Administrador
                      </button>
                    )}
                  </div>
                )}

                {/* Filtro de Setor */}
                {availableSectors.length > 1 && !selectedId && (
                  <div>
                    <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-wider mb-1.5">
                      Filtrar por Setor
                    </label>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <button
                        type="button"
                        onClick={() => setSelectedSector('all')}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 transition-colors cursor-pointer ${
                          selectedSector === 'all'
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                        }`}
                      >
                        Todos os Setores
                      </button>
                      {availableSectors.map((sec) => (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => setSelectedSector(sec)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 transition-colors cursor-pointer ${
                            selectedSector === sec
                              ? 'bg-[var(--primary)] text-white'
                              : 'bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                          }`}
                        >
                          {sec}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Busca de colaborador */}
                <div>
                  <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-wider mb-1.5">
                    Quem é você?
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setSelectedId(null);
                        setPassword('');
                        setError(null);
                      }}
                      placeholder="Buscar por nome, RE, login ou setor..."
                      autoFocus
                      className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]/70 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition"
                    />
                  </div>
                </div>

                {/* Lista de colaboradores */}
                {!selectedId && (
                  <div className="max-h-56 overflow-y-auto border border-[var(--line)] rounded-xl divide-y divide-[var(--line)]">
                    {filtered.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[var(--muted)] font-semibold">
                        Nenhum colaborador encontrado no setor selecionado.
                      </div>
                    ) : (
                      filtered.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedId(c.id);
                            setPassword('');
                            setError(null);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg)] transition-colors text-left cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center shrink-0">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-[var(--ink)] truncate">{c.name}</div>
                            <div className="text-[10px] text-[var(--muted)] font-semibold truncate flex items-center gap-1.5 flex-wrap">
                              <span>{c.role || 'Operador'}</span>
                              {c.sector ? <span>• {c.sector}</span> : (state.sector ? <span>• {state.sector}</span> : null)}
                              {c.shift ? <span>• Turno {c.shift}</span> : null}
                              {c.registration ? <span>• RE {c.registration}</span> : null}
                            </div>
                          </div>
                          {state.userPasswords?.[c.id] && (
                            <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-auto" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}

                {/* Seleção confirmada */}
                {selectedId && selected && (
                  <form onSubmit={submit} className="space-y-3">
                    <div className="flex items-center justify-between gap-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-black text-[var(--ink)] truncate">{selected.name}</div>
                        <div className="text-[10px] text-[var(--muted)] font-semibold">
                          {selected.role || 'Operador'}
                          {selected.sector ? ` • ${selected.sector}` : (state.sector ? ` • ${state.sector}` : '')}
                          {selected.shift ? ` • Turno ${selected.shift}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(null);
                          setPassword('');
                          setError(null);
                        }}
                        className="text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)] px-2 py-1 cursor-pointer"
                      >
                        Trocar
                      </button>
                    </div>

                    {requiresPassword && (
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={
                          state.userPasswords?.[selected.id]
                            ? 'Digite sua senha'
                            : 'Defina uma senha para seu primeiro acesso'
                        }
                        autoFocus
                        className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)]/70 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20 transition"
                      />
                    )}

                    {error && (
                      <div className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-xl">
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full px-4 py-2.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      Entrar
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}

                <p className="text-[10px] text-[var(--muted)] font-semibold text-center leading-relaxed">
                  A sessão termina ao fechar a aba. Nenhum dado fica gravado neste navegador entre
                  sessões — a próxima pessoa precisará entrar com o próprio usuário.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-3 text-center flex items-center justify-center gap-2 text-[11px] text-[var(--muted)] font-bold">
          <RefreshCw className="w-3.5 h-3.5" />
          Segurança da sessão ativa
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;