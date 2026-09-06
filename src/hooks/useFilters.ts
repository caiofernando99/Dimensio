import { useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { FILTER_ALL_VALUES } from '../constants';

interface FilterState {
  shifts: string[];
  teamLeaders: string[];
  roles: string[];
  categories: string[];
  skills: string[];
  searchTerm: string;
}

interface FilterActions {
  setShifts: (shifts: string[]) => void;
  setTeamLeaders: (tls: string[]) => void;
  setRoles: (roles: string[]) => void;
  setCategories: (cats: string[]) => void;
  setSkills: (skills: string[]) => void;
  setSearchTerm: (term: string) => void;
  clearAll: () => void;
  isActive: boolean;
}

export function useFilters(
  initialState?: Partial<FilterState>,
  syncWithGlobalFilters?: boolean
): [FilterState, FilterActions] {
  const { state, setSelectedGlobalFilters } = useApp();

  const [filters, setFilters] = useState<FilterState>({
    shifts: initialState?.shifts || (syncWithGlobalFilters && state.selectedShiftFilter && state.selectedShiftFilter !== 'ALL' && state.selectedShiftFilter !== 'todos' ? [state.selectedShiftFilter] : []),
    teamLeaders: initialState?.teamLeaders || (syncWithGlobalFilters && state.selectedTLFilter && state.selectedTLFilter !== 'ALL' && state.selectedTLFilter !== 'todos' ? [state.selectedTLFilter] : []),
    roles: initialState?.roles || [],
    categories: initialState?.categories || [],
    skills: initialState?.skills || [],
    searchTerm: initialState?.searchTerm || '',
  });

  const setShifts = useCallback((shifts: string[]) => {
    setFilters((prev) => ({ ...prev, shifts, teamLeaders: [] }));
    if (syncWithGlobalFilters) {
      const newShift = shifts.length > 0 ? shifts[0] : 'ALL';
      setSelectedGlobalFilters({ shift: newShift, teamLeader: 'ALL' });
    }
  }, [syncWithGlobalFilters, setSelectedGlobalFilters]);

  const setTeamLeaders = useCallback((tls: string[]) => {
    setFilters((prev) => ({ ...prev, teamLeaders: tls }));
    if (syncWithGlobalFilters) {
      const newTL = tls.length > 0 ? tls[0] : 'ALL';
      setSelectedGlobalFilters({ shift: state.selectedShiftFilter || 'ALL', teamLeader: newTL });
    }
  }, [syncWithGlobalFilters, setSelectedGlobalFilters, state.selectedShiftFilter]);

  const setRoles = useCallback((roles: string[]) => setFilters((prev) => ({ ...prev, roles })), []);
  const setCategories = useCallback((categories: string[]) => setFilters((prev) => ({ ...prev, categories })), []);
  const setSkills = useCallback((skills: string[]) => setFilters((prev) => ({ ...prev, skills })), []);

  const setSearchTerm = useCallback((term: string) => setFilters((prev) => ({ ...prev, searchTerm: term })), []);

  const clearAll = useCallback(() => {
    setFilters({
      shifts: [],
      teamLeaders: [],
      roles: [],
      categories: [],
      skills: [],
      searchTerm: '',
    });
    if (syncWithGlobalFilters) {
      setSelectedGlobalFilters({ shift: 'ALL', teamLeader: 'ALL' });
    }
  }, [syncWithGlobalFilters, setSelectedGlobalFilters]);

  const isActive = useMemo(() =>
    filters.shifts.length > 0 ||
    filters.teamLeaders.length > 0 ||
    filters.roles.length > 0 ||
    filters.categories.length > 0 ||
    filters.skills.length > 0 ||
    filters.searchTerm.length > 0,
    [filters]
  );

  return [filters, { setShifts, setTeamLeaders, setRoles, setCategories, setSkills, setSearchTerm, clearAll, isActive }];
}

export function useGlobalFilters() {
  const { state, setSelectedGlobalFilters } = useApp();

  const selectedShift = state.selectedShiftFilter || 'ALL';
  const selectedTL = state.selectedTLFilter || 'ALL';

  const handleShiftChange = useCallback((vals: string[]) => {
    const newShift = vals.length > 0 ? vals[0] : 'ALL';
    setSelectedGlobalFilters({ shift: newShift, teamLeader: 'ALL' });
  }, [setSelectedGlobalFilters]);

  const handleTLChange = useCallback((vals: string[]) => {
    const newTL = vals.length > 0 ? vals[0] : 'ALL';
    setSelectedGlobalFilters({ shift: selectedShift, teamLeader: newTL });
  }, [setSelectedGlobalFilters, selectedShift]);

  const clearGlobalFilters = useCallback(() => {
    setSelectedGlobalFilters({ shift: 'ALL', teamLeader: 'ALL' });
  }, [setSelectedGlobalFilters]);

  return {
    selectedShift,
    selectedTL,
    handleShiftChange,
    handleTLChange,
    clearGlobalFilters,
    isFiltered: selectedShift !== 'ALL' && selectedShift !== 'todos' || selectedTL !== 'ALL' && selectedTL !== 'todos',
  };
}