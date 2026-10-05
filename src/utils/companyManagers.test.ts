import { describe, it, expect } from 'vitest';
import type { CompanyManager } from '../types';
import {
  activeManagers,
  activeOwners,
  matchActiveManager,
  matchAnyManager,
  canManageManagers,
  canRevokeManager,
  canChangeManagerRole,
  buildManagerRecord,
} from './companyManagers';

const owner = (id: string, extra: Partial<CompanyManager> = {}): CompanyManager => ({
  id,
  name: `Owner ${id}`,
  email: `${id}@empresa.com`,
  role: 'owner',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

const admin = (id: string, extra: Partial<CompanyManager> = {}): CompanyManager => ({
  id,
  name: `Admin ${id}`,
  email: `${id}@empresa.com`,
  role: 'admin',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...extra,
});

describe('companyManagers invariants', () => {
  it('counts active managers and owners', () => {
    const list = [owner('o1'), admin('a1'), owner('o2', { status: 'revoked' })];
    expect(activeManagers(list)).toHaveLength(2);
    expect(activeOwners(list)).toHaveLength(1);
  });

  it('matches by email (case-insensitive), uid and collaboratorId', () => {
    const list = [owner('o1', { firebaseUid: 'uid-1', collaboratorId: 'c1' })];
    expect(matchActiveManager(list, { email: 'O1@EMPRESA.COM' })?.id).toBe('o1');
    expect(matchActiveManager(list, { firebaseUid: 'uid-1' })?.id).toBe('o1');
    expect(matchActiveManager(list, { collaboratorId: 'c1' })?.id).toBe('o1');
    expect(matchActiveManager(list, { email: 'ghost@x.com' })).toBeNull();
  });

  it('does not match revoked managers as active, but finds them via matchAny', () => {
    const list = [owner('o1', { status: 'revoked' })];
    expect(matchActiveManager(list, { email: 'o1@empresa.com' })).toBeNull();
    expect(matchAnyManager(list, { email: 'o1@empresa.com' })?.id).toBe('o1');
  });

  it('only owners (or master) manage managers', () => {
    const o = owner('o1');
    const a = admin('a1');
    expect(canManageManagers({ id: 'x', name: 'X', role: 'x', isEditor: true, isAdmin: true } as any, o).ok).toBe(true);
    expect(canManageManagers({ id: 'x', name: 'X', role: 'x', isEditor: true, isAdmin: true } as any, a).ok).toBe(false);
    expect(canManageManagers({ id: 'super_admin', name: 'S', role: 'x', isEditor: true, isAdmin: true, isSuperAdmin: true } as any, null).ok).toBe(true);
    expect(canManageManagers(null, null).ok).toBe(false);
  });

  it('blocks revoking the last active owner', () => {
    const list = [owner('o1'), admin('a1')];
    const r = canRevokeManager(list, 'o1', 'o1');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/último dono/i);
  });

  it('allows owner to revoke another owner when two exist, and to revoke admins', () => {
    const list = [owner('o1'), owner('o2'), admin('a1')];
    expect(canRevokeManager(list, 'o1', 'o2').ok).toBe(true);
    expect(canRevokeManager(list, 'o1', 'a1').ok).toBe(true);
  });

  it('blocks non-owners from revoking', () => {
    const list = [owner('o1'), admin('a1')];
    expect(canRevokeManager(list, 'a1', 'a1').ok).toBe(false);
  });

  it('blocks demoting the last active owner', () => {
    const list = [owner('o1')];
    const r = canChangeManagerRole(list, 'o1', 'o1', 'admin');
    expect(r.ok).toBe(false);
  });

  it('allows promoting admin to owner and demoting when another owner exists', () => {
    const list = [owner('o1'), admin('a1')];
    expect(canChangeManagerRole(list, 'o1', 'a1', 'owner').ok).toBe(true);
    const two = [owner('o1'), owner('o2')];
    expect(canChangeManagerRole(two, 'o1', 'o2', 'admin').ok).toBe(true);
  });

  it('builds a valid manager record', () => {
    const m = buildManagerRecord({ name: '  Ana  ', email: 'ana@empresa.com', role: 'admin', addedByName: 'Dono' });
    expect(m.id.startsWith('mgr_')).toBe(true);
    expect(m.name).toBe('Ana');
    expect(m.status).toBe('active');
    expect(m.createdAt).toBeTruthy();
  });
});
