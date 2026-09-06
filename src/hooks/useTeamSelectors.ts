import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { getCollaboratorStatus, matchesSearch } from '../utils/helpers';
import { Collaborator, ShiftGroup, AppState } from '../types';

export function useTeamSelectors() {
  const { state } = useApp();

  const filteredCollaborators = useMemo(() => {
    const shift = state.selectedShiftFilter || 'ALL';
    const tl = state.selectedTLFilter || 'ALL';

    return state.collaborators.filter((c) => {
      const colShift = c.shift || 'Geral';
      const colTL = c.teamLeader || state.defaultTeamLeader || 'Sem Time';
      const matchesShift = shift === 'ALL' || shift === 'todos' || colShift === shift;
      const matchesTL = tl === 'ALL' || tl === 'todos' || colTL === tl;
      return matchesShift && matchesTL;
    });
  }, [state.collaborators, state.selectedShiftFilter, state.selectedTLFilter, state.defaultTeamLeader]);

  const presentPeople = useMemo(() => {
    const activeDate = state.selectedDate;
    return filteredCollaborators.filter((c) => {
      const status = getCollaboratorStatus(c, activeDate, state);
      return status.status === 'presente' || status.status === 'atraso';
    });
  }, [filteredCollaborators, state.selectedDate, state]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      presente: 0,
      ferias: 0,
      licenca: 0,
      treinamento: 0,
      ausente: 0,
      atestado: 0,
      banco_horas: 0,
      falta_injustificada: 0,
      folga: 0,
    };

    filteredCollaborators.forEach((c) => {
      const status = getCollaboratorStatus(c, state.selectedDate, state);
      counts[status.status] = (counts[status.status] || 0) + 1;
    });

    return counts;
  }, [filteredCollaborators, state.selectedDate, state]);

  const availableShifts = useMemo(() => {
    const colShifts = state.collaborators.map((c) => c.shift || 'Geral');
    return Array.from(new Set(['Geral', 'T1', 'T2', 'T3', 'T4', 'T5', ...colShifts]));
  }, [state.collaborators]);

  const availableTLs = useMemo(() => {
    return Array.from(
      new Set(
        state.collaborators
          .filter((c) => !state.selectedShiftFilter || state.selectedShiftFilter === 'ALL' || state.selectedShiftFilter === 'todos' || (c.shift || 'Geral') === state.selectedShiftFilter)
          .map((c) => c.teamLeader || state.defaultTeamLeader || 'Sem Time')
      )
    );
  }, [state.collaborators, state.selectedShiftFilter, state.defaultTeamLeader]);

  const availableRoles = useMemo(() => Array.from(new Set(state.collaborators.map((c) => c.role).filter(Boolean))), [state.collaborators]);
  const availableCategories = useMemo(() => Array.from(new Set(state.collaborators.map((c) => c.category).filter(Boolean))), [state.collaborators]);
  const availableSkills = useMemo(() => state.skills || [], [state.skills]);

  return {
    filteredCollaborators,
    presentPeople,
    statusCounts,
    availableShifts,
    availableTLs,
    availableRoles,
    availableCategories,
    availableSkills,
  };
}

export function useFilteredCollaborators(
  baseCollaborators: Collaborator[],
  filters: {
    searchTerm?: string;
    selectedShifts?: string[];
    selectedTLs?: string[];
    selectedRoles?: string[];
    selectedCategories?: string[];
    selectedSkills?: string[];
    activeDate?: string;
    state?: AppState;
    includeAbsent?: boolean;
  }
) {
  const { state } = useApp();
  const activeDate = filters.activeDate || state.selectedDate;

  return useMemo(() => {
    return baseCollaborators.filter((c) => {
      const colShift = c.shift || 'Geral';
      const colTL = c.teamLeader || state.defaultTeamLeader || 'Sem Time';

      if (filters.selectedShifts?.length && !filters.selectedShifts.includes(colShift)) return false;
      if (filters.selectedTLs?.length && !filters.selectedTLs.includes(colTL)) return false;
      if (filters.selectedRoles?.length && !filters.selectedRoles.includes(c.role)) return false;
      if (filters.selectedCategories?.length && !filters.selectedCategories.includes(c.category)) return false;
      if (filters.selectedSkills?.length && !filters.selectedSkills.some((s) => Number(c.skills?.[s]) > 0)) return false;
      if (filters.searchTerm && !matchesSearch(c.name, filters.searchTerm)) return false;

      if (!filters.includeAbsent) {
        const status = getCollaboratorStatus(c, activeDate, state);
        if (status.status !== 'presente') return false;
      }

      return true;
    });
  }, [
    baseCollaborators,
    filters.searchTerm,
    filters.selectedShifts?.join(','),
    filters.selectedTLs?.join(','),
    filters.selectedRoles?.join(','),
    filters.selectedCategories?.join(','),
    filters.selectedSkills?.join(','),
    activeDate,
    filters.includeAbsent,
    state,
  ]);
}