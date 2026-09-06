import { describe, it, expect } from 'vitest';
import { normalizeAppState, initialAppStateDefaults } from '../utils/stateNormalizer';
import { AppState } from '../types';

describe('stateNormalizer', () => {
  it('normalizes empty or null input to valid initial state', () => {
    const normalized = normalizeAppState(null);
    expect(normalized).toBeDefined();
    expect(Array.isArray(normalized.collaborators)).toBe(true);
    expect(Array.isArray(normalized.tasks)).toBe(true);
    expect(Array.isArray(normalized.breaks)).toBe(true);
    expect(normalized.year).toBeGreaterThanOrEqual(2026);
  });

  it('preserves registeredSectors and sectorDefinitions without resurrecting deleted sectors', () => {
    const base: AppState = {
      ...initialAppStateDefaults,
      sector: 'Setor B',
      registeredSectors: ['Setor A', 'Setor B'],
      sectorDefinitions: [
        { id: 'sec_1', name: 'Setor A' },
        { id: 'sec_2', name: 'Setor B' },
      ],
    };

    // Simulate sector exclusion in raw incoming data
    const rawData = {
      sector: 'Setor B',
      registeredSectors: ['Setor B'], // Setor A was removed
      sectorDefinitions: [{ id: 'sec_2', name: 'Setor B' }],
    };

    const result = normalizeAppState(rawData, base);
    expect(result.registeredSectors).toEqual(['Setor B']);
    expect(result.sectorDefinitions.map((s) => s.name)).toEqual(['Setor B']);
  });

  it('unwraps nested state snapshots (.rawState or JSON string)', () => {
    const payload = JSON.stringify({
      rawState: JSON.stringify({
        teamName: 'Logística SP',
        sector: 'Inbound',
        collaborators: [{ name: 'Carlos Santos', cargo: 'Operador', turno: 'T2' }],
      }),
    });

    const result = normalizeAppState(payload);
    expect(result.teamName).toBe('Logística SP');
    expect(result.sector).toBe('Inbound');
    expect(result.collaborators.length).toBe(1);
    expect(result.collaborators[0].name).toBe('Carlos Santos');
    expect(result.collaborators[0].role).toBe('Operador');
    expect(result.collaborators[0].shift).toBe('T2');
  });

  it('ensures helpdeskConfig and supportTypes are always present and safe', () => {
    const result = normalizeAppState({});
    expect(result.helpdeskConfig).toBeDefined();
    expect(result.helpdeskConfig.enabled).toBe(true);
    expect(Array.isArray(result.helpdeskConfig.supportTypes)).toBe(true);
    expect(result.helpdeskConfig.supportTypes!.length).toBeGreaterThan(0);
  });
});
