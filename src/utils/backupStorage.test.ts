import { describe, expect, it } from 'vitest';
import {
  MAX_BACKUP_HISTORY_COUNT,
  isQuotaExceededError,
  persistBackupHistory,
  trimSnapshotsToBudget,
} from './backupStorage';

class QuotaStorage implements Storage {
  private items = new Map<string, string>();

  constructor(private readonly maxBytes: number) {}

  get length() {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.items.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    if (new TextEncoder().encode(value).length > this.maxBytes) {
      throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
    }
    this.items.set(key, value);
  }
}

describe('backupStorage', () => {
  it('recognizes quota errors', () => {
    expect(isQuotaExceededError(Object.assign(new Error('quota'), { name: 'QuotaExceededError' }))).toBe(true);
    expect(isQuotaExceededError(Object.assign(new Error('full'), { code: 22 }))).toBe(true);
    expect(isQuotaExceededError(new Error('network'))).toBe(false);
  });

  it('keeps the newest snapshots within count and byte budgets', () => {
    const snapshots = Array.from({ length: 10 }, (_, i) => ({ id: i, payload: 'x'.repeat(60) }));
    const trimmed = trimSnapshotsToBudget(snapshots, 150, 5);
    expect(trimmed.length).toBeLessThanOrEqual(2);
    expect(trimmed[0].id).toBe(0);
  });

  it('prunes old snapshots instead of throwing when storage quota is exceeded', () => {
    const storage = new QuotaStorage(220);
    const snapshots = Array.from({ length: 8 }, (_, i) => ({ id: i, payload: 'x'.repeat(60) }));

    const result = persistBackupHistory(storage, 'backup-history', snapshots);

    expect(result.persisted).toBe(true);
    expect(result.snapshots.length).toBeGreaterThan(0);
    expect(result.snapshots.length).toBeLessThanOrEqual(MAX_BACKUP_HISTORY_COUNT);
    expect(JSON.parse(storage.getItem('backup-history') || '[]')).toEqual(result.snapshots);
  });
});
