import { describe, it, expect } from 'vitest';
import { calculateRotatingBreaks } from '../utils/helpers';
import { AppState, BreakSlot, Collaborator } from '../types';
import { initialAppStateDefaults } from '../utils/stateNormalizer';

describe('calculateRotatingBreaks', () => {
  const sampleBreaks: BreakSlot[] = [
    { id: 'b1', time: '11:00' },
    { id: 'b2', time: '11:30' },
    { id: 'b3', time: '12:00' },
    { id: 'b4', time: '12:30' },
  ];

  const sampleCollaborators: Collaborator[] = [
    { id: 'c1', name: 'Ana Silva', shift: 'T1', scale: 'A', role: 'Operador', category: 'Geral' },
    { id: 'c2', name: 'Bruno Costa', shift: 'T1', scale: 'A', role: 'Operador', category: 'Geral' },
    { id: 'c3', name: 'Carla Dias', shift: 'T1', scale: 'A', role: 'Operador', category: 'Geral' },
  ];

  it('rotates slots cyclically based on previous day intervals', () => {
    const state: AppState = {
      ...initialAppStateDefaults,
      selectedDate: '2026-08-23',
      breaks: sampleBreaks,
      collaborators: sampleCollaborators,
      calendar: {}, // todos presentes
      attendance: {},
      intervals: {
        '2026-08-22': {
          b1: ['c1'], // Ana was at 11:00 (index 0)
          b2: ['c2'], // Bruno was at 11:30 (index 1)
          b3: ['c3'], // Carla was at 12:00 (index 2)
          b4: [],
        },
      },
    };

    const result = calculateRotatingBreaks(state, { referenceDate: '2026-08-22' });

    // Ana (b1 -> next should be b2: 11:30)
    expect(result.intervals['b2']).toContain('c1');
    // Bruno (b2 -> next should be b3: 12:00)
    expect(result.intervals['b3']).toContain('c2');
    // Carla (b3 -> next should be b4: 12:30)
    expect(result.intervals['b4']).toContain('c3');

    expect(result.totalRotated).toBe(3);
  });

  it('wraps around to the first slot when at the last slot index', () => {
    const state: AppState = {
      ...initialAppStateDefaults,
      selectedDate: '2026-08-23',
      breaks: sampleBreaks,
      collaborators: [{ id: 'c1', name: 'Ana Silva', shift: 'T1', scale: 'A', role: 'Operador', category: 'Geral' }],
      calendar: {},
      attendance: {},
      intervals: {
        '2026-08-22': {
          b1: [],
          b2: [],
          b3: [],
          b4: ['c1'], // Ana was at last slot b4 (index 3)
        },
      },
    };

    const result = calculateRotatingBreaks(state, { referenceDate: '2026-08-22' });
    // Ana wraps from index 3 -> index 0 (b1)
    expect(result.intervals['b1']).toContain('c1');
  });

  it('distributes new or previously absent collaborators evenly', () => {
    const state: AppState = {
      ...initialAppStateDefaults,
      selectedDate: '2026-08-23',
      breaks: sampleBreaks,
      collaborators: sampleCollaborators,
      calendar: {},
      attendance: {},
      intervals: {}, // No previous data
    };

    const result = calculateRotatingBreaks(state);
    expect(result.totalNew).toBe(3);
    const totalAssigned = Object.values(result.intervals).reduce((acc, arr) => acc + arr.length, 0);
    expect(totalAssigned).toBe(3);
  });
});
