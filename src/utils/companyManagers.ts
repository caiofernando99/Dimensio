import type { CompanyManager, CompanyManagerRole, IdentifiedUser } from '../types';
import { generateId } from './helpers';

/**
 * Regras do quadro de gestores da empresa (funções puras — sem efeitos).
 *
 * Invariantes garantidas:
 * 1. Sempre existe ao menos 1 owner (`dono`) ativo.
 * 2. Só owners ativos (ou a chave mestra `super_admin`) gerenciam gestores.
 * 3. Revogação é lógica (`revoked`) — dados operacionais nunca são apagados.
 */

export function activeManagers(list: CompanyManager[] | undefined): CompanyManager[] {
  return (list || []).filter((m) => m && m.status === 'active');
}

export function activeOwners(list: CompanyManager[] | undefined): CompanyManager[] {
  return activeManagers(list).filter((m) => m.role === 'owner');
}

export function revokedManagers(list: CompanyManager[] | undefined): CompanyManager[] {
  return (list || []).filter((m) => m && m.status === 'revoked');
}

function normEmail(email?: string): string {
  return (email || '').trim().toLowerCase();
}

/** Encontra o gestor ATIVO correspondente a uma identidade de sessão. */
export function matchActiveManager(
  list: CompanyManager[] | undefined,
  identity: { email?: string; firebaseUid?: string; collaboratorId?: string; id?: string }
): CompanyManager | null {
  const email = normEmail(identity.email);
  const found =
    activeManagers(list).find((m) => {
      if (identity.id && (m.id === identity.id || m.firebaseUid === identity.id)) return true;
      if (identity.firebaseUid && m.firebaseUid && m.firebaseUid === identity.firebaseUid) return true;
      if (email && normEmail(m.email) === email) return true;
      if (identity.collaboratorId && m.collaboratorId && m.collaboratorId === identity.collaboratorId) return true;
      return false;
    }) || null;
  return found;
}

/** Encontra QUALQUER gestor (ativo ou revogado) pela identidade — para detectar revogados. */
export function matchAnyManager(
  list: CompanyManager[] | undefined,
  identity: { email?: string; firebaseUid?: string; collaboratorId?: string }
): CompanyManager | null {
  const email = normEmail(identity.email);
  return (
    (list || []).find((m) => {
      if (!m) return false;
      if (identity.firebaseUid && m.firebaseUid && m.firebaseUid === identity.firebaseUid) return true;
      if (email && normEmail(m.email) === email) return true;
      if (identity.collaboratorId && m.collaboratorId && m.collaboratorId === identity.collaboratorId) return true;
      return false;
    }) || null
  );
}

export interface ManagerCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Quem pode gerenciar gestores? Owner ativo ou chave mestra.
 * `actor` é o usuário da sessão; `actorManager` seu registro (se houver).
 */
export function canManageManagers(
  actor: IdentifiedUser | null,
  actorManager: CompanyManager | null
): ManagerCheck {
  if (!actor) return { ok: false, reason: 'Identifique-se como gestor para gerenciar acessos.' };
  if (actor.isSuperAdmin || actor.id === 'super_admin') return { ok: true };
  if (actorManager && actorManager.status === 'active' && actorManager.role === 'owner') return { ok: true };
  if (actor.isCompanyOwner) return { ok: true };
  return { ok: false, reason: 'Apenas donos (owners) da empresa podem gerenciar gestores.' };
}

export function canRevokeManager(
  list: CompanyManager[] | undefined,
  actorManagerId: string | null,
  targetId: string,
  actorIsMaster = false
): ManagerCheck {
  const target = (list || []).find((m) => m.id === targetId);
  if (!target) return { ok: false, reason: 'Gestor não encontrado.' };
  if (target.status !== 'active') return { ok: false, reason: 'Gestor já está revogado.' };
  if (!actorIsMaster) {
    const actor = (list || []).find((m) => m.id === actorManagerId);
    if (!actor || actor.status !== 'active' || actor.role !== 'owner') {
      return { ok: false, reason: 'Apenas donos (owners) da empresa podem revogar gestores.' };
    }
  }
  if (target.role === 'owner' && activeOwners(list).length <= 1) {
    return { ok: false, reason: 'Não é possível revogar o último dono ativo. Transfira a titularidade primeiro.' };
  }
  return { ok: true };
}

export function canChangeManagerRole(
  list: CompanyManager[] | undefined,
  actorManagerId: string | null,
  targetId: string,
  nextRole: CompanyManagerRole,
  actorIsMaster = false
): ManagerCheck {
  const target = (list || []).find((m) => m.id === targetId);
  if (!target) return { ok: false, reason: 'Gestor não encontrado.' };
  if (target.status !== 'active') return { ok: false, reason: 'Gestor revogado não pode ter o papel alterado. Reative-o primeiro.' };
  if (target.role === nextRole) return { ok: false, reason: 'Gestor já possui este papel.' };
  if (!actorIsMaster) {
    const actor = (list || []).find((m) => m.id === actorManagerId);
    if (!actor || actor.status !== 'active' || actor.role !== 'owner') {
      return { ok: false, reason: 'Apenas donos (owners) da empresa podem alterar papéis.' };
    }
  }
  if (target.role === 'owner' && nextRole !== 'owner' && activeOwners(list).length <= 1) {
    return { ok: false, reason: 'Não é possível rebaixar o último dono ativo. Transfira a titularidade primeiro.' };
  }
  return { ok: true };
}

export function buildManagerRecord(input: {
  name: string;
  email?: string;
  firebaseUid?: string;
  collaboratorId?: string;
  role: CompanyManagerRole;
  addedByName?: string;
  notes?: string;
}): CompanyManager {
  const now = new Date().toISOString();
  return {
    id: `mgr_${Date.now()}_${generateId().slice(0, 6)}`,
    name: input.name.trim(),
    email: input.email?.trim() ? input.email.trim() : undefined,
    firebaseUid: input.firebaseUid || undefined,
    collaboratorId: input.collaboratorId || undefined,
    role: input.role,
    status: 'active',
    addedByName: input.addedByName,
    createdAt: now,
    notes: input.notes?.trim() || undefined,
  };
}
