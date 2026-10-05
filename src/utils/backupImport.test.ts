import { describe, it, expect } from 'vitest';
import { unwrapBackupJson, isCalendarOnlyExport, classifyBackupFile } from './backupImport';

const fullState = {
  teamName: 'Equipe X',
  collaborators: [{ id: 'c1', name: 'Ana' }],
  tasks: [],
};

describe('backupImport router', () => {
  it('unwraps BackupSnapshot {state}', () => {
    expect(unwrapBackupJson({ id: 's1', state: fullState })).toEqual(fullState);
  });

  it('unwraps stringified inner state', () => {
    expect(unwrapBackupJson({ state: JSON.stringify(fullState) })).toEqual(fullState);
  });

  it('detects calendar-only exports', () => {
    const cal = { type: 'people-scheduler-calendar', version: 4, year: 2026, calendar: {} };
    expect(isCalendarOnlyExport(cal)).toBe(true);
    expect(isCalendarOnlyExport({ calendar: {}, calendarEvents: {} })).toBe(true);
    expect(isCalendarOnlyExport(fullState)).toBe(false);
    expect(isCalendarOnlyExport({})).toBe(false);
  });

  it('classifies full-state files', () => {
    expect(classifyBackupFile(fullState).kind).toBe('full-state');
    expect(classifyBackupFile({ state: fullState }).kind).toBe('full-state');
    expect(classifyBackupFile({ type: 'people-scheduler-calendar', calendar: {} }).kind).toBe('calendar');
    expect(classifyBackupFile({ random: 1 }).kind).toBe('unknown');
  });
});
