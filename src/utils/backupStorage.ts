// Persistência local de backups com orçamento de espaço.
//
// O estado completo da aplicação pode ter vários megabytes (fotos, histórico,
// comunicados). Guardar 15 cópias integrais no localStorage estoura a cota do
// navegador e, pior, impede que o estado principal seja salvo. Estas funções
// mantêm apenas os snapshots mais recentes que cabem em um orçamento e, se a
// escrita ainda falhar, descartam os mais antigos em vez de propagar o erro.

export const MAX_BACKUP_HISTORY_BYTES = 2 * 1024 * 1024;
export const MAX_BACKUP_HISTORY_COUNT = 8;
export const MAX_SINGLE_BACKUP_BYTES = 3 * 1024 * 1024;

export function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  const name = String((error as any)?.name || '');
  const code = (error as any)?.code;
  const message = String((error as any)?.message || error);
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014 ||
    /quota/i.test(message) ||
    /exceeded the quota/i.test(message)
  );
}

function byteLength(value: string): number {
  if (typeof value !== 'string') return 0;
  // TextEncoder mede bytes UTF-8 reais; fallback aproximado para ambientes de teste.
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  return value.length * 2;
}

/**
 * Mantém os snapshots mais novos respeitando um orçamento em bytes e um limite
 * de quantidade. O snapshot mais recente é sempre preservado, mesmo que sozinho
 * ultrapasse o orçamento (nesse caso a escrita pode falhar e será tratada pelo
 * chamador).
 */
export function trimSnapshotsToBudget<T>(
  snapshots: T[],
  maxBytes = MAX_BACKUP_HISTORY_BYTES,
  maxCount = MAX_BACKUP_HISTORY_COUNT
): T[] {
  if (!Array.isArray(snapshots) || snapshots.length === 0) return [];
  const limited = snapshots.slice(0, Math.max(1, maxCount));
  const kept: T[] = [];
  let total = 0;

  for (const snapshot of limited) {
    let size = 0;
    try {
      size = byteLength(JSON.stringify(snapshot));
    } catch {
      size = 0;
    }
    if (kept.length > 0 && total + size > maxBytes) break;
    kept.push(snapshot);
    total += size;
  }

  return kept;
}

export interface PersistHistoryResult<T> {
  snapshots: T[];
  persisted: boolean;
}

/**
 * Grava o histórico já aparado. Se o navegador recusar por cota, remove os
 * snapshots mais antigos (um a um) até caber. Nunca lança para o chamador.
 */
export function persistBackupHistory<T>(
  storage: Storage,
  key: string,
  snapshots: T[],
  options: { maxBytes?: number; maxCount?: number } = {}
): PersistHistoryResult<T> {
  let candidate = trimSnapshotsToBudget(
    snapshots,
    options.maxBytes ?? MAX_BACKUP_HISTORY_BYTES,
    options.maxCount ?? MAX_BACKUP_HISTORY_COUNT
  );

  while (candidate.length > 0) {
    try {
      storage.setItem(key, JSON.stringify(candidate));
      return { snapshots: candidate, persisted: true };
    } catch (error) {
      if (!isQuotaExceededError(error)) {
        console.warn('Não foi possível salvar o histórico de backups:', error);
        return { snapshots: candidate, persisted: false };
      }
      if (candidate.length === 1) {
        try {
          storage.removeItem(key);
        } catch {
          // ignore
        }
        console.warn('Backup individual maior que a cota disponível; histórico não persistido.');
        return { snapshots: candidate, persisted: false };
      }
      candidate = candidate.slice(0, -1);
    }
  }

  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
  return { snapshots: [], persisted: false };
}

/**
 * Grava um backup único. Em caso de cota, libera as chaves informadas
 * (normalmente o histórico) e tenta novamente.
 */
export function persistSingleBackup(
  storage: Storage,
  key: string,
  snapshot: unknown,
  pruneKeys: string[] = []
): boolean {
  let json: string;
  try {
    json = JSON.stringify(snapshot);
  } catch (error) {
    console.warn('Backup não serializável:', error);
    return false;
  }

  if (byteLength(json) > MAX_SINGLE_BACKUP_BYTES) {
    console.warn('Backup maior que o limite local seguro; não será persistido.');
    return false;
  }

  try {
    storage.setItem(key, json);
    return true;
  } catch (error) {
    if (!isQuotaExceededError(error)) {
      console.warn('Falha ao salvar backup local:', error);
      return false;
    }
  }

  // Libera espaço descartável e tenta novamente.
  for (const pruneKey of pruneKeys) {
    if (!pruneKey || pruneKey === key) continue;
    try {
      storage.removeItem(pruneKey);
    } catch {
      // ignore
    }
  }

  try {
    storage.setItem(key, json);
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn('Cota de armazenamento esgotada; backup único não persistido.');
    } else {
      console.warn('Falha ao salvar backup local:', error);
    }
    return false;
  }
}
