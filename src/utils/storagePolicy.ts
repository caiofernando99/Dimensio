// Política de armazenamento da sessão do portal.
//
// Regra de segurança: o portal NÃO pode guardar dados da equipe nem a identidade
// do usuário no navegador. Por padrão tudo vive somente durante a sessão
// (sessionStorage — morre ao fechar a aba). Quem quiser reativar o modo offline
// com persistência local liga a opção "Persistir dados neste navegador" em
// Configurações.
//
// As únicas coisas que sobrevivem entre sessões são as CONFIGURAÇÕES
// OPERACIONAIS do dispositivo (só esses 3 flags pequenos, sem nenhum dado de
// usuário/equipe): sessionOnly, alwaysOnline e allowAnonymousAccess.
// A identidade do usuário logado JAMAIS persiste (sempre sessionStorage),
// impedindo que outra pessoa use a conta de alguém em seguida.

export interface SessionConfig {
  /** true = dados só durante a sessão (sessionStorage). false = localStorage. */
  sessionOnly: boolean;
  /** true = exige conexão com a nuvem; bloqueia edição quando offline. */
  alwaysOnline: boolean;
  /** false = exige tela de login para acessar o portal. */
  allowAnonymousAccess: boolean;
}

export const SESSION_CONFIG_KEY = 'dimensio_session_config_v1';

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  sessionOnly: true,
  alwaysOnline: false,
  allowAnonymousAccess: true,
};

let activeStorage: Storage | null = null;

function detectDefaultStorage(): Storage {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // ignore
  }
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as Storage;
}

export function readSessionConfig(): SessionConfig {
  try {
    const raw = localStorage.getItem(SESSION_CONFIG_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return {
        sessionOnly: p.sessionOnly !== false,
        alwaysOnline: p.alwaysOnline === true,
        allowAnonymousAccess: p.allowAnonymousAccess !== false,
      };
    }
  } catch {
    // fallback ao padrão
  }
  return { ...DEFAULT_SESSION_CONFIG };
}

export function writeSessionConfig(cfg: SessionConfig) {
  try {
    localStorage.setItem(SESSION_CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

/** Aplica a política escolhida para TODAS as leituras/escritas de dados do app. */
export function applySessionStoragePolicy(cfg: SessionConfig) {
  activeStorage = cfg.sessionOnly ? getSessionStorage() : getLocalStorage();
}

/** Armazenamento ativo para os dados do sistema (estado da equipe, backups). */
export function getAppStorage(): Storage {
  if (!activeStorage) {
    const cfg = readSessionConfig();
    activeStorage = cfg.sessionOnly ? getSessionStorage() : getLocalStorage();
  }
  return activeStorage;
}

/** sessionStorage — usado para a identidade do usuário (sempre por sessão). */
export function getSessionStorage(): Storage {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // ignore
  }
  return detectDefaultStorage();
}

/** localStorage — usado só para configurações operacionais do dispositivo. */
export function getLocalStorage(): Storage {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // ignore
  }
  return detectDefaultStorage();
}
