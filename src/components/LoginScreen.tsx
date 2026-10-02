import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Search,
  Lock,
  ShieldCheck,
  User,
  ArrowRight,
  RefreshCw,
  PlugZap,
  Building2,
  Mail,
  KeyRound,
  Cloud,
  CheckCircle2,
  FileSpreadsheet,
  ArrowLeft,
  Radio,
  Timer,
  LayoutGrid,
  BarChart3,
  Smartphone,
  Shield,
  Zap,
  Users,
  Check,
} from 'lucide-react';

interface LoginScreenProps {
  onConnectCloud?: () => void;
  onContinueAsGuest?: () => void;
}

type AuthMode = 'signup_company' | 'login' | 'reset_password' | 'roster';

const FEATURES = [
  {
    icon: LayoutGrid,
    title: 'Dimensionamento & Postos de Trabalho',
    description: 'Distribuição visual e ágil da equipe em postos, linhas ou docas com status de presença em tempo real.',
    tag: 'Operacional',
  },
  {
    icon: Radio,
    title: 'Rádio PTT & Comunicação Instantânea',
    description: 'Canal de voz Push-to-Talk em baixa latência com áudio contínuo em segundo plano no celular.',
    tag: 'Voz em Tempo Real',
  },
  {
    icon: Timer,
    title: 'Monitor de Intervalos & Revezamento',
    description: 'Gestão de pausas NR-17, controle de capacidade por horário e rotação automática de postos.',
    tag: 'NR-17 & Ergonomia',
  },
  {
    icon: Smartphone,
    title: 'Portal do Operador Kiosk & Coletor',
    description: 'Interface simplificada para totens, tablets e celulares no posto com consulta rápida por crachá/RE.',
    tag: 'Totem & Mobile',
  },
  {
    icon: Cloud,
    title: 'Nuvem Firestore Sem Servidor',
    description: 'Armazenamento seguro pela Google com sincronização instantânea e gratuita entre todos os aparelhos.',
    tag: '0 Custos de Servidor',
  },
  {
    icon: BarChart3,
    title: 'Fechamento de Turnos & Auditoria',
    description: 'Relatórios consolidados com horas trabalhadas, absenteísmo e histórico completo de movimentações.',
    tag: 'Indicadores',
  },
];

const LoginScreen: React.FC<LoginScreenProps> = ({ onConnectCloud, onContinueAsGuest }) => {
  const {
    state,
    identifyUser,
    signInWithGoogleAuth,
    signInWithEmailAuth,
    signUpWithEmailAuth,
    sendPasswordResetEmailAuth,
    showNotice,
  } = useApp();

  // Mode defaults to signup_company if team has no collaborators, otherwise login
  const [mode, setMode] = useState<AuthMode>(() => {
    return (state.collaborators || []).length > 0 ? 'login' : 'signup_company';
  });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [initialSector, setInitialSector] = useState('');

  // Roster login states
  const [query, setQuery] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rosterPassword, setRosterPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const collaborators = state.collaborators || [];
  const hasTeamData = collaborators.length > 0;
  const hasAdminPassword = Boolean(state.userPasswords?.['admin']);
  const hasSuperAdminPassword = Boolean(state.userPasswords?.['super_admin']);

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

  const filteredCollaborators = useMemo(() => {
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

  const selectedCollab = selectedId ? collaborators.find((c) => c.id === selectedId) : null;
  const selectedSectorDef = useMemo(() => {
    if (!selectedCollab) return null;
    const secName = selectedCollab.sector || state.sector;
    return (state.sectorDefinitions || []).find(
      (d) => d.name.toLowerCase() === (secName || '').toLowerCase()
    );
  }, [selectedCollab, state.sector, state.sectorDefinitions]);

  const requiresRosterPassword =
    Boolean(selectedCollab && state.userPasswords?.[selectedCollab.id]) ||
    Boolean(state.requireUserPassword) ||
    Boolean(selectedSectorDef?.requirePassword);

  const handleGoogleLogin = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      const res = await signInWithGoogleAuth();
      if (!res.success) {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao autenticar com a Conta Google.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Preencha seu e-mail e senha.');
      return;
    }
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      const res = await signInWithEmailAuth(email.trim(), password);
      if (!res.success) {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao autenticar.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanySignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Informe seu e-mail e senha.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (!companyName.trim()) {
      setError('Informe o nome da sua Empresa ou Unidade Operacional.');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);
    try {
      const res = await signUpWithEmailAuth(
        email.trim(),
        password,
        displayName.trim() || undefined,
        companyName.trim()
      );
      if (!res.success) {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao registrar empresa.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Informe o e-mail cadastrado para redefinir sua senha.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await sendPasswordResetEmailAuth(email.trim());
      if (res.success) {
        setSuccessMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar recuperação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRosterLogin = (id: string, pass: string) => {
    setError(null);
    const result = identifyUser(id, pass || undefined);
    if (!result.success) {
      setError(result.message);
    }
  };

  const submitRosterForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    handleRosterLogin(selectedId, rosterPassword);
  };

  const handleGuestAccess = () => {
    if (onContinueAsGuest) {
      onContinueAsGuest();
      return;
    }
    identifyUser('admin', undefined);
    showNotice('Acesso concedido em modo de demonstração.');
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col justify-between overflow-x-hidden">
      {/* Top Navbar */}
      <header className="border-b border-[var(--line)] bg-[var(--paper)]/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center font-black shadow-xs">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-base font-black tracking-tight leading-none text-[var(--ink)]">
              Dimensio
            </div>
            <div className="text-[11px] text-[var(--muted)] font-medium mt-0.5">
              Gestão Operacional, Escalas e Rádio PTT
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onConnectCloud && (
            <button
              type="button"
              onClick={onConnectCloud}
              className="hidden sm:flex px-3 py-1.5 rounded-lg border border-[var(--line)] hover:bg-[var(--bg)] text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)] items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Conectar Planilha</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleGuestAccess}
            className="px-3 py-1.5 rounded-lg bg-[var(--bg)] hover:bg-[var(--line)]/50 text-[11px] font-bold text-[var(--ink)] transition-colors cursor-pointer"
          >
            Explorar Demonstração
          </button>
        </div>
      </header>

      {/* Main Hero & Split Section */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col lg:flex-row items-center lg:items-stretch gap-10 lg:gap-14">
        {/* Left Side: Presentation of App Features */}
        <section className="flex-1 flex flex-col justify-center space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-black">
              <Zap className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Arquitetura em Nuvem com Firestore & Tempo Real</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[var(--ink)] leading-[1.15]">
              Dimensionamento de equipes sem servidores ou planilhas complexas.
            </h1>

            <p className="text-sm sm:text-base text-[var(--muted)] leading-relaxed max-w-2xl">
              O Dimensio unifica a escala de turnos, matriz de postos de trabalho, intervalos NR-17 e rádio PTT em tempo real. Cadastre sua empresa em 30 segundos e opere instantaneamente em qualquer dispositivo.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {FEATURES.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="bg-[var(--paper)] border border-[var(--line)] p-4 rounded-xl shadow-2xs hover:border-[var(--primary)]/40 transition-colors space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold text-[var(--muted)]">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="text-xs font-black text-[var(--ink)] pt-1">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-[var(--muted)] leading-relaxed font-medium">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-[var(--muted)] font-medium">
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold">
              <Check className="w-4 h-4" /> 100% Gratuito no Firebase Spark
            </span>
            <span>·</span>
            <span>Sem necessidade de cartão de crédito</span>
            <span>·</span>
            <span>Multi-dispositivos instantâneo</span>
          </div>
        </section>

        {/* Right Side: Interactive Auth & Company Registration Card */}
        <section className="w-full max-w-md flex flex-col justify-center">
          <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl shadow-xl overflow-hidden">
            {/* Auth Mode Header Tabs */}
            <div className="flex border-b border-[var(--line)] bg-[var(--bg)]/50 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setMode('signup_company');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'signup_company'
                    ? 'bg-[var(--paper)] text-[var(--ink)] shadow-2xs font-black'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Nova Empresa</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className={`flex-1 py-2.5 rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  mode === 'login' || mode === 'reset_password'
                    ? 'bg-[var(--paper)] text-[var(--ink)] shadow-2xs font-black'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
              >
                <Cloud className="w-3.5 h-3.5 text-indigo-500" />
                <span>Entrar</span>
              </button>

              {hasTeamData && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('roster');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    mode === 'roster'
                      ? 'bg-[var(--paper)] text-[var(--ink)] shadow-2xs font-black'
                      : 'text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  <User className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Escala</span>
                </button>
              )}
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-4">
              {/* Feedback Alert */}
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-bold rounded-xl flex items-start gap-2">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>{error}</span>
                </div>
              )}
              {successMessage && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold rounded-xl flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* MODE 1: CADASTRO DE NOVA EMPRESA */}
              {mode === 'signup_company' && (
                <form onSubmit={handleCompanySignUp} className="space-y-3.5">
                  <div className="space-y-1">
                    <h2 className="text-sm font-black text-[var(--ink)]">
                      Cadastre sua Empresa ou Unidade
                    </h2>
                    <p className="text-[11px] text-[var(--muted)] font-medium">
                      O espaço de trabalho e banco de dados no Firestore serão configurados automaticamente.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                      Nome da Empresa / Operação *
                    </label>
                    <div className="relative">
                      <Building2 className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ex: CD Logística Campinas, Hospital São Lucas"
                        required
                        className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--muted)]/60 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                        Seu Nome *
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Ex: Carlos Pereira"
                        required
                        className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--muted)]/60 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                        Setor Principal
                      </label>
                      <input
                        type="text"
                        value={initialSector}
                        onChange={(e) => setInitialSector(e.target.value)}
                        placeholder="Ex: Operações, Logística"
                        className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--muted)]/60 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                      E-mail do Gestor *
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="gestor@empresa.com"
                        required
                        className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--muted)]/60 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                      Senha de Acesso * (mínimo 6 dígitos)
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                        className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--muted)]/60 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full mt-2 px-4 py-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Criar Empresa e Acessar Nuvem</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="text-[11px] text-[var(--muted)] hover:text-[var(--ink)] font-semibold transition-colors cursor-pointer"
                    >
                      Já possui uma conta ou empresa cadastrada? <strong className="text-indigo-600 dark:text-indigo-400">Fazer login</strong>
                    </button>
                  </div>
                </form>
              )}

              {/* MODE 2: LOGIN TRADICIONAL & GOOGLE */}
              {mode === 'login' && (
                <div className="space-y-4">
                  {/* Google Workspace Button */}
                  <div>
                    <button
                      type="button"
                      onClick={handleGoogleLogin}
                      disabled={isLoading}
                      className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border-2 border-[var(--line)] hover:border-indigo-500 text-[var(--ink)] text-xs font-black rounded-xl flex items-center justify-center gap-2.5 cursor-pointer shadow-2xs hover:shadow-xs transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                        </svg>
                      )}
                      <span>{isLoading ? 'Conectando...' : 'Entrar com Conta Google Workspace'}</span>
                    </button>
                    <p className="text-[10px] text-center text-[var(--muted)] font-medium mt-1">
                      Acesso seguro e direto com sua conta Google
                    </p>
                  </div>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-[var(--line)]"></div>
                    <span className="flex-shrink mx-2 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                      ou entre com e-mail corporativo
                    </span>
                    <div className="flex-grow border-t border-[var(--line)]"></div>
                  </div>

                  {/* Email & Password Form */}
                  <form onSubmit={handleEmailLogin} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                        E-mail
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="seu.email@empresa.com"
                          required
                          className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--muted)]/60 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider">
                          Senha
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setMode('reset_password');
                            setError(null);
                          }}
                          className="text-[10.5px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--muted)]/60 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Acessar Plataforma</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Switch to Signup */}
                  <div className="pt-2 border-t border-[var(--line)] text-center">
                    <button
                      type="button"
                      onClick={() => setMode('signup_company')}
                      className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      + Cadastrar Nova Empresa ou Filial
                    </button>
                  </div>
                </div>
              )}

              {/* MODE 3: RECUPERAÇÃO DE SENHA */}
              {mode === 'reset_password' && (
                <form onSubmit={handlePasswordReset} className="space-y-3.5">
                  <div className="flex items-center justify-between pb-1">
                    <div className="text-xs font-black text-[var(--ink)] flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-indigo-500" />
                      Recuperação de Senha
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setError(null);
                      }}
                      className="text-[11px] text-[var(--muted)] hover:text-[var(--ink)] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Voltar
                    </button>
                  </div>

                  <p className="text-[11px] text-[var(--muted)] font-medium leading-relaxed">
                    Informe seu e-mail corporativo. Enviaremos um link seguro para cadastrar uma nova senha.
                  </p>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--ink)] uppercase tracking-wider mb-1">
                      E-mail
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu.email@empresa.com"
                        required
                        className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--muted)]/60 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow transition-all disabled:opacity-50"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <span>Enviar Link de Redefinição</span>
                    )}
                  </button>
                </form>
              )}

              {/* MODE 4: ESCALA LOCAL (COLLABORATOR ROSTER) */}
              {mode === 'roster' && (
                <div className="space-y-4">
                  {!hasTeamData && !hasAdminPassword && !hasSuperAdminPassword ? (
                    <div className="text-center py-4 space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--bg)] border border-[var(--line)] flex items-center justify-center">
                        <PlugZap className="w-6 h-6 text-amber-500" />
                      </div>
                      <p className="text-xs font-bold text-[var(--ink)]">
                        Nenhum colaborador cadastrado na escala local
                      </p>
                      <p className="text-[11px] text-[var(--muted)] font-semibold">
                        Use a aba <strong>Nova Empresa</strong> acima para iniciar seu ambiente em nuvem.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Sector Filter */}
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
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                              }`}
                            >
                              Todos
                            </button>
                            {availableSectors.map((sec) => (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => setSelectedSector(sec)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg shrink-0 transition-colors cursor-pointer ${
                                  selectedSector === sec
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                                }`}
                              >
                                {sec}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Search */}
                      <div>
                        <label className="block text-[10px] font-black text-[var(--muted)] uppercase tracking-wider mb-1.5">
                          Buscar Colaborador
                        </label>
                        <div className="relative">
                          <Search className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            value={query}
                            onChange={(e) => {
                              setQuery(e.target.value);
                              setSelectedId(null);
                              setRosterPassword('');
                              setError(null);
                            }}
                            placeholder="Nome, RE ou login..."
                            className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--muted)]/70 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                          />
                        </div>
                      </div>

                      {/* List */}
                      {!selectedId && (
                        <div className="max-h-48 overflow-y-auto border border-[var(--line)] rounded-xl divide-y divide-[var(--line)]">
                          {filteredCollaborators.length === 0 ? (
                            <div className="p-4 text-center text-xs text-[var(--muted)] font-semibold">
                              Nenhum colaborador encontrado.
                            </div>
                          ) : (
                            filteredCollaborators.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  setSelectedId(c.id);
                                  setRosterPassword('');
                                  setError(null);
                                }}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--bg)] transition-colors text-left cursor-pointer"
                              >
                                <div className="w-7 h-7 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                  <User className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-bold text-[var(--ink)] truncate">{c.name}</div>
                                  <div className="text-[10px] text-[var(--muted)] truncate">
                                    {c.role || 'Operador'} {c.shift ? `• Turno ${c.shift}` : ''}
                                  </div>
                                </div>
                                {state.userPasswords?.[c.id] && (
                                  <Lock className="w-3 h-3 text-amber-500 shrink-0 ml-auto" />
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}

                      {/* Selected */}
                      {selectedId && selectedCollab && (
                        <form onSubmit={submitRosterForm} className="space-y-3">
                          <div className="flex items-center justify-between gap-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl px-3 py-2">
                            <div className="min-w-0">
                              <div className="text-xs font-black text-[var(--ink)] truncate">{selectedCollab.name}</div>
                              <div className="text-[10px] text-[var(--muted)]">
                                {selectedCollab.role || 'Operador'}
                                {selectedCollab.sector ? ` • ${selectedCollab.sector}` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(null);
                                setRosterPassword('');
                                setError(null);
                              }}
                              className="text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)] px-2 py-1 cursor-pointer"
                            >
                              Trocar
                            </button>
                          </div>

                          {requiresRosterPassword && (
                            <input
                              type="password"
                              value={rosterPassword}
                              onChange={(e) => setRosterPassword(e.target.value)}
                              placeholder="Digite sua senha"
                              autoFocus
                              className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs font-medium text-[var(--ink)] placeholder:text-[var(--muted)]/70 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition"
                            />
                          )}

                          <button
                            type="submit"
                            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
                          >
                            Entrar na Escala
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Card Footer */}
            <div className="px-6 py-3 bg-[var(--bg)]/40 border-t border-[var(--line)] flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Nuvem Dimensio Ativa
              </span>
              <button
                type="button"
                onClick={handleGuestAccess}
                className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Acessar sem login →
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--line)] bg-[var(--paper)] py-4 px-4 sm:px-8 text-center text-xs text-[var(--muted)] font-medium">
        Dimensio — Plataforma Integrada de Dimensionamento, Escalas e Comunicação Operacional.
      </footer>
    </div>
  );
};

export default LoginScreen;
