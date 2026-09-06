import { describe, it, expect, vi } from 'vitest';
import { formatPersonName, abbreviateName, getTodayISO, formatDateBR, formatDateLongBR, isScaleOff, generateId, escapeSearchTerm, matchesSearch, matchesCollaboratorSearch, isSampleDataState, shuffleArray } from '../utils/helpers';

describe('helpers', () => {
  describe('formatPersonName', () => {
    it('capitalizes first letter of each word', () => {
      expect(formatPersonName('joão silva')).toBe('João Silva');
    });

    it('handles prepositions correctly', () => {
      expect(formatPersonName('maria da silva')).toBe('Maria da Silva');
      expect(formatPersonName('josé de souza')).toBe('José de Souza');
      expect(formatPersonName('pedro dos santos')).toBe('Pedro dos Santos');
    });

    it('preserves trailing spaces', () => {
      expect(formatPersonName('ana ')).toBe('Ana ');
    });

    it('handles uppercase input', () => {
      expect(formatPersonName('CARLOS EDUARDO')).toBe('Carlos Eduardo');
    });
  });

  describe('abbreviateName', () => {
    it('abbreviates middle names', () => {
      expect(abbreviateName('Ana Paula Silva')).toBe('ANA S.');
    });

    it('handles single name', () => {
      expect(abbreviateName('João')).toBe('JOÃO');
    });

    it('respects uppercase option', () => {
      expect(abbreviateName('Ana Paula Silva', true)).toBe('ANA S.');
      expect(abbreviateName('Ana Paula Silva', false)).toBe('Ana S.');
    });

    it('handles prepositions', () => {
      expect(abbreviateName('Maria da Silva')).toBe('MARIA S.');
    });
  });

  describe('getTodayISO', () => {
    it('returns today in YYYY-MM-DD format', () => {
      const result = getTodayISO();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('formatDateBR', () => {
    it('converts YYYY-MM-DD to DD/MM/YYYY', () => {
      expect(formatDateBR('2026-07-30')).toBe('30/07/2026');
    });

    it('handles invalid input', () => {
      expect(formatDateBR('invalid')).toBe('invalid');
    });
  });

  describe('formatDateLongBR', () => {
    it('formats date in long Brazilian format', () => {
      const result = formatDateLongBR('2026-07-30');
      expect(result).toContain('30');
      expect(result).toContain('julho');
      expect(result).toContain('2026');
    });
  });

  describe('isScaleOff', () => {
    it('returns true when calendar date matches scale', () => {
      const calendar = { '2026-07-30': 'A' as const };
      expect(isScaleOff(calendar, '2026-07-30', 'A')).toBe(true);
    });

    it('returns false when calendar date does not match scale', () => {
      const calendar = { '2026-07-30': 'B' as const };
      expect(isScaleOff(calendar, '2026-07-30', 'A')).toBe(false);
    });

    it('returns false when date not in calendar', () => {
      const calendar = { '2026-07-30': 'A' as const };
      expect(isScaleOff(calendar, '2026-07-31', 'A')).toBe(false);
    });
  });

  describe('generateId', () => {
    it('generates unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('returns string', () => {
      expect(typeof generateId()).toBe('string');
    });
  });

  describe('escapeSearchTerm', () => {
    it('removes accents', () => {
      expect(escapeSearchTerm('café')).toBe('cafe');
    });

    it('lowercases', () => {
      expect(escapeSearchTerm('TESTE')).toBe('teste');
    });

    it('trims whitespace', () => {
      expect(escapeSearchTerm('  teste  ')).toBe('teste');
    });
  });

  describe('matchesSearch', () => {
    it('returns true for empty search', () => {
      expect(matchesSearch('anything', '')).toBe(true);
    });

    it('returns false for undefined text', () => {
      expect(matchesSearch(undefined, 'test')).toBe(false);
    });

    it('matches case-insensitive', () => {
      expect(matchesSearch('João Silva', 'joão')).toBe(true);
    });

    it('ignores accents', () => {
      expect(matchesSearch('café', 'cafe')).toBe(true);
    });

    it('matches multi-word queries even with words in between', () => {
      expect(matchesSearch('Carlos Fernando da Silva Costa', 'Carlos Costa')).toBe(true);
      expect(matchesSearch('Ana Paula Ferreira', 'ana ferreira')).toBe(true);
    });
  });

  describe('matchesCollaboratorSearch', () => {
    const col1 = {
      id: 'c1',
      name: 'Carlos Fernando Santos',
      role: 'TL',
      shift: 'T1',
      teamLeader: 'Time 01',
      registration: '1045',
      login: 'carloss',
      category: 'Logística',
      scale: 'A',
    } as any;

    const col2 = {
      id: 'c2',
      name: 'Carlos Eduardo Oliveira',
      role: 'PS',
      shift: 'T2',
      teamLeader: 'Time do TL Bruno Silva (T1)',
      registration: '2080',
      login: 'carloso',
      category: 'Geral',
      scale: 'B',
    } as any;

    const col3 = {
      id: 'c3',
      name: 'Carlos Alberto Silva',
      role: 'Operador',
      shift: 'T3',
      teamLeader: 'Time 03',
      registration: '3099',
      login: 'carlosal',
      category: 'Qualidade',
      scale: 'C',
    } as any;

    it('matches by first and last name', () => {
      expect(matchesCollaboratorSearch(col1, 'Carlos Santos')).toBe(true);
      expect(matchesCollaboratorSearch(col2, 'Carlos Oliveira')).toBe(true);
      expect(matchesCollaboratorSearch(col3, 'Carlos Silva')).toBe(true);
    });

    it('matches TL role and shift', () => {
      expect(matchesCollaboratorSearch(col1, 'Carlos TL')).toBe(true);
      expect(matchesCollaboratorSearch(col1, 'TL T1')).toBe(true);
      expect(matchesCollaboratorSearch(col2, 'Carlos T2')).toBe(true);
      expect(matchesCollaboratorSearch(col3, 'Operador T3')).toBe(true);
    });

    it('matches by registration or login', () => {
      expect(matchesCollaboratorSearch(col1, '1045')).toBe(true);
      expect(matchesCollaboratorSearch(col2, 'carloso')).toBe(true);
    });
  });

  describe('isSampleDataState (legacy detector removed in v4.5)', () => {
    const pristine = [
      { id: 'col_1', name: 'Ana Beatris Silva' },
      { id: 'col_2', name: 'Bruno Henrique Oliveira' },
      { id: 'col_3', name: 'Camila Rodrigues Lima' },
    ] as any;

    it('always returns false so sync is never blocked (any roster is real data)', () => {
      expect(isSampleDataState(pristine)).toBe(false);
      expect(isSampleDataState({ collaborators: pristine, isSampleData: true })).toBe(false);
      expect(isSampleDataState({ collaborators: pristine, isSampleData: false })).toBe(false);
      expect(isSampleDataState([])).toBe(false);
    });
  });

  describe('shuffleArray', () => {
    it('returns an array with the same elements and length', () => {
      const original = ['A', 'B', 'C', 'D', 'E'];
      const shuffled = shuffleArray(original);
      expect(shuffled).toHaveLength(original.length);
      expect(shuffled.sort()).toEqual(original.sort());
    });

    it('does not mutate the original array', () => {
      const original = [1, 2, 3, 4, 5];
      const copy = [...original];
      shuffleArray(original);
      expect(original).toEqual(copy);
    });

    it('handles empty and single-element arrays', () => {
      expect(shuffleArray([])).toEqual([]);
      expect(shuffleArray([42])).toEqual([42]);
    });
  });
});