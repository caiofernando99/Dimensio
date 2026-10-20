import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Archive,
  UserPlus,
  Palmtree,
  Trash2,
  RotateCcw,
  Sparkles,
  Pencil,
  Plus,
  X,
  ExternalLink,
  ListChecks,
  Wand2,
  AlertTriangle,
  Clock,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpDown,
  Briefcase,
  Tag,
  Calendar,
  LayoutGrid,
  Table,
  Filter,
  CheckCircle2,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';
import {
  Card,
  Button,
  Badge,
  Tabs,
  Toolbar,
  EmptyState,
  Select,
  Avatar,
} from '../../components/ui';
import { SearchInput } from '../../components/SearchInput';
import { MultiSelectFilter } from '../../components/MultiSelectFilter';
import { useApp } from '../../context/AppContext';
import { Collaborator } from '../../types';
import {
  matchesCollaboratorSearch,
  scoreCollaboratorSearch,
  compareStringsBR,
  formatPersonName,
} from '../../utils/helpers';
import { collabMenuOnContext } from '../../utils/collabContextMenu';

interface TeamCollaboratorsFolderProps {
  onOpenAddCollabModal: () => void;
  onOpenEditCollabModal: (col: Collaborator) => void;
  onOpenAbsenceModal: (collabId?: string) => void;
  onOpenAddSkillModal: (collabId: string) => void;
  onOpenBulkModal: (selectedIds: string[]) => void;
  onConfirmDeletePermanent: (id: string) => void;
  onConfirmClearTrash: () => void;
  initialListMode?: 'active' | 'trash';
}

export const TeamCollaboratorsFolder: React.FC<TeamCollaboratorsFolderProps> = ({
  onOpenAddCollabModal,
  onOpenEditCollabModal,
  onOpenAbsenceModal,
  onOpenAddSkillModal,
  onOpenBulkModal,
  onConfirmDeletePermanent,
  onConfirmClearTrash,
  initialListMode = 'active',
}) => {
  const {
    state,
    updateCollaborator,
    deleteCollaborator,
    restoreCollaborator,
    removeScheduledAbsence,
    setSkillLevel,
  } = useApp();

  const [listMode, setListMode] = useState<'active' | 'trash'>(initialListMode);
  // View mode: 'grouped_scale' displays collaborators grouped by work shift/scale card, 'table' displays the detailed table
  const [viewMode, setViewMode] = useState<'grouped_scale' | 'table'>('grouped_scale');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'role' | 'team' | 'shift' | 'scale'>('asc');

  useEffect(() => {
    if (initialListMode) {
      setListMode(initialListMode);
    }
  }, [initialListMode]);

  // Escala / Turma Filter State
  const [selectedScales, setSelectedScales] = useState<string[]>([]);

  // Turno Filter State
  const [selectedShifts, setSelectedShifts] = useState<string[]>(
    state.selectedShiftFilter && state.selectedShiftFilter !== 'ALL' && state.selectedShiftFilter !== 'todos'
      ? [state.selectedShiftFilter]
      : []
  );

  useEffect(() => {
    const active = state.selectedShiftFilter || state.teamShift;
    if (active && active !== 'ALL' && active !== 'todos') {
      setSelectedShifts([active]);
    } else {
      setSelectedShifts([]);
    }
  }, [state.teamShift, state.selectedShiftFilter]);

  // Time / TL Filter State
  const [selectedTLs, setSelectedTLs] = useState<string[]>(
    state.selectedTLFilter && state.selectedTLFilter !== 'ALL' && state.selectedTLFilter !== 'todos'
      ? [state.selectedTLFilter]
      : []
  );

  useEffect(() => {
    if (state.selectedTLFilter && state.selectedTLFilter !== 'ALL' && state.selectedTLFilter !== 'todos') {
      setSelectedTLs([state.selectedTLFilter]);
    } else {
      setSelectedTLs([]);
    }
  }, [state.selectedTLFilter, state.teamShift]);

  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Available Escalas / Turmas
  const colScales = state.collaborators.map((c) => c.scale).filter(Boolean);
  const availableScales = Array.from(
    new Set([...(state.scaleGroups || []), ...colScales])
  ).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

  const scaleOptions = availableScales.map((s) => ({
    label: isNaN(Number(s)) ? `Escala ${s}` : `Turma ${s}`,
    value: s,
  }));

  // Available Shifts
  const colShifts = state.collaborators.map((c) => c.shift || 'Geral');
  const availableShifts = Array.from(new Set([...(state.shifts || []), ...colShifts])).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true })
  );
  if (!availableShifts.includes('Geral')) availableShifts.unshift('Geral');
  const shiftOptions = availableShifts.map((s) => ({ label: `Turno ${s}`, value: s }));

  // Available Team Leaders
  const availableTLs = Array.from(
    new Set(
      state.collaborators
        .filter((c) => selectedShifts.length === 0 || selectedShifts.includes(c.shift || 'Geral'))
        .map((c) => c.teamLeader || state.defaultTeamLeader || 'Sem Time')
    )
  ).sort(compareStringsBR);
  const tlOptions = availableTLs.map((tl) => ({ label: tl, value: tl }));

  const roleOptions = [...state.roles].sort(compareStringsBR).map((r) => ({ label: r, value: r }));
  const categoryOptions = [...state.categories].sort(compareStringsBR).map((c) => ({ label: c, value: c }));

  // Has any active filters?
  const hasActiveFilters =
    selectedScales.length > 0 ||
    selectedShifts.length > 0 ||
    selectedTLs.length > 0 ||
    selectedRoles.length > 0 ||
    selectedCategories.length > 0 ||
    searchTerm.trim().length > 0;

  const clearAllFilters = () => {
    setSelectedScales([]);
    setSelectedShifts([]);
    setSelectedTLs([]);
    setSelectedRoles([]);
    setSelectedCategories([]);
    setSearchTerm('');
  };

  // Filtered & Sorted active collaborators
  const filteredCollaborators = useMemo(() => {
    return state.collaborators
      .filter((c) => {
        const colTL = c.teamLeader || state.defaultTeamLeader || 'Sem Time';
        const matchesTL = selectedTLs.length === 0 || selectedTLs.includes(colTL);
        const colShift = c.shift || 'Geral';
        const matchesShift = selectedShifts.length === 0 || selectedShifts.includes(colShift);
        const matchesScale = selectedScales.length === 0 || selectedScales.includes(c.scale);
        const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(c.role);
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(c.category);
        const matchesSearchQuery = matchesCollaboratorSearch(c, searchTerm, {
          defaultTeamLeader: state.defaultTeamLeader,
        });

        return matchesTL && matchesShift && matchesScale && matchesRole && matchesCategory && matchesSearchQuery;
      })
      .sort((a, b) => {
        if (searchTerm.trim()) {
          const scoreDiff =
            scoreCollaboratorSearch(b, searchTerm, { defaultTeamLeader: state.defaultTeamLeader }) -
            scoreCollaboratorSearch(a, searchTerm, { defaultTeamLeader: state.defaultTeamLeader });
          if (scoreDiff !== 0) return scoreDiff;
        }
        if (sortOrder === 'desc') {
          return compareStringsBR(b.name, a.name);
        }
        if (sortOrder === 'scale') {
          const sComp = compareStringsBR(a.scale, b.scale);
          if (sComp !== 0) return sComp;
          return compareStringsBR(a.name, b.name);
        }
        if (sortOrder === 'role') {
          const rComp = compareStringsBR(a.role, b.role);
          if (rComp !== 0) return rComp;
          return compareStringsBR(a.name, b.name);
        }
        if (sortOrder === 'team') {
          const tComp = compareStringsBR(
            a.teamLeader || state.defaultTeamLeader,
            b.teamLeader || state.defaultTeamLeader
          );
          if (tComp !== 0) return tComp;
          return compareStringsBR(a.name, b.name);
        }
        if (sortOrder === 'shift') {
          const sComp = compareStringsBR(a.shift, b.shift);
          if (sComp !== 0) return sComp;
          return compareStringsBR(a.name, b.name);
        }
        return compareStringsBR(a.name, b.name);
      });
  }, [
    state.collaborators,
    selectedTLs,
    selectedShifts,
    selectedScales,
    selectedRoles,
    selectedCategories,
    searchTerm,
    sortOrder,
    state.defaultTeamLeader,
  ]);

  // Grouped by scale list for fast grouped visualization
  const groupedByScale = useMemo(() => {
    // Collect all scales present in active selection or state
    const allKnownScales = Array.from(
      new Set([
        ...availableScales,
        ...filteredCollaborators.map((c) => c.scale).filter(Boolean),
      ])
    ).sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));

    // If user filtered by scale, restrict to selected scales
    const targetScales = selectedScales.length > 0
      ? allKnownScales.filter((s) => selectedScales.includes(s))
      : allKnownScales;

    const groups: {
      scaleKey: string;
      scaleName: string;
      collaborators: Collaborator[];
      shiftSummary: Record<string, number>;
      roleSummary: Record<string, number>;
    }[] = [];

    targetScales.forEach((scaleKey) => {
      const members = filteredCollaborators.filter((c) => c.scale === scaleKey);
      if (members.length === 0 && selectedScales.length === 0) return;

      const shiftSummary: Record<string, number> = {};
      const roleSummary: Record<string, number> = {};
      members.forEach((m) => {
        const sh = m.shift || 'Geral';
        shiftSummary[sh] = (shiftSummary[sh] || 0) + 1;
        const rl = m.role || 'Sem Cargo';
        roleSummary[rl] = (roleSummary[rl] || 0) + 1;
      });

      const scaleName = isNaN(Number(scaleKey)) ? `Escala ${scaleKey}` : `Turma ${scaleKey}`;
      groups.push({
        scaleKey,
        scaleName,
        collaborators: members,
        shiftSummary,
        roleSummary,
      });
    });

    // Check for collaborators with empty or undefined scale
    const unscaledMembers = filteredCollaborators.filter((c) => !c.scale || !allKnownScales.includes(c.scale));
    if (unscaledMembers.length > 0 && selectedScales.length === 0) {
      const shiftSummary: Record<string, number> = {};
      const roleSummary: Record<string, number> = {};
      unscaledMembers.forEach((m) => {
        const sh = m.shift || 'Geral';
        shiftSummary[sh] = (shiftSummary[sh] || 0) + 1;
        const rl = m.role || 'Sem Cargo';
        roleSummary[rl] = (roleSummary[rl] || 0) + 1;
      });

      groups.push({
        scaleKey: 'sem_escala',
        scaleName: 'Sem Escala Definida',
        collaborators: unscaledMembers,
        shiftSummary,
        roleSummary,
      });
    }

    return groups;
  }, [availableScales, filteredCollaborators, selectedScales]);

  // Filtered & Sorted deleted collaborators
  const deletedList = state.deletedCollaborators || [];
  const filteredDeletedCollaborators = deletedList
    .filter((d) => {
      const col = d.collaborator;
      const colTL = col.teamLeader || state.defaultTeamLeader || 'Sem Time';
      const matchesTL = selectedTLs.length === 0 || selectedTLs.includes(colTL);
      const matchesSearchQuery = matchesCollaboratorSearch(col, searchTerm, {
        defaultTeamLeader: state.defaultTeamLeader,
      });

      return matchesTL && matchesSearchQuery;
    })
    .sort((a, b) => {
      const nameA = a.collaborator?.name || '';
      const nameB = b.collaborator?.name || '';
      return sortOrder === 'desc' ? compareStringsBR(nameB, nameA) : compareStringsBR(nameA, nameB);
    });

  const isSelected = (id: string) => selectedIds.includes(id);

  const toggleSelect = (id: string, e?: React.SyntheticEvent) => {
    const nativeEvent = e?.nativeEvent as MouseEvent | undefined;
    const isShift = nativeEvent?.shiftKey || (e as React.MouseEvent)?.shiftKey;

    if (isShift && lastSelectedId && filteredCollaborators.some((c) => c.id === lastSelectedId)) {
      const lastIdx = filteredCollaborators.findIndex((c) => c.id === lastSelectedId);
      const currIdx = filteredCollaborators.findIndex((c) => c.id === id);
      if (lastIdx !== -1 && currIdx !== -1) {
        const start = Math.min(lastIdx, currIdx);
        const end = Math.max(lastIdx, currIdx);
        const rangeIds = filteredCollaborators.slice(start, end + 1).map((c) => c.id);
        setSelectedIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
        setLastSelectedId(id);
        return;
      }
    }

    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setLastSelectedId(id);
  };

  const allFilteredSelected =
    filteredCollaborators.length > 0 && filteredCollaborators.every((c) => isSelected(c.id));

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) =>
      allFilteredSelected
        ? prev.filter((id) => !filteredCollaborators.some((c) => c.id === id))
        : Array.from(new Set([...prev, ...filteredCollaborators.map((c) => c.id)]))
    );
  };

  const toggleSelectGroup = (members: Collaborator[]) => {
    const memberIds = members.map((m) => m.id);
    const allInGroupSelected = memberIds.every((id) => selectedIds.includes(id));
    if (allInGroupSelected) {
      setSelectedIds((prev) => prev.filter((id) => !memberIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...memberIds])));
    }
  };

  const getDaysRemaining = (expiresAtStr?: string) => {
    if (!expiresAtStr) return '60 dias restantes';
    try {
      const expires = new Date(expiresAtStr).getTime();
      const now = new Date().getTime();
      const diffMs = expires - now;
      if (diffMs <= 0) return 'Expirando hoje';
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return `${days} dia${days > 1 ? 's' : ''} restante${days > 1 ? 's' : ''}`;
    } catch {
      return '60 dias restantes';
    }
  };

  const formatISOToBR = (isoStr?: string) => {
    if (!isoStr) return 'Recente';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <Card id="collaborators" padded={false} className="overflow-visible scroll-mt-28 animate-in fade-in duration-200">
      <div className="p-3.5 sm:p-4 space-y-3.5">
        {/* Top View Mode Switcher & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <Tabs
            items={[
              {
                value: 'active',
                label: 'Lista de Colaboradores',
                icon: Users,
                badge: state.collaborators.length,
              },
              {
                value: 'trash',
                label: 'Lixeira / Excluídos (60d)',
                icon: Archive,
                badge: deletedList.length > 0 ? deletedList.length : undefined,
              },
            ]}
            value={listMode}
            onChange={(v) => setListMode(v as 'active' | 'trash')}
          />

          <div className="flex flex-wrap items-center gap-2">
            {listMode === 'trash' && deletedList.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                icon={Trash2}
                className="!border-red-300 dark:!border-red-800 !text-red-700 dark:!text-red-300 hover:!bg-red-50 dark:hover:!bg-red-950/60"
                onClick={onConfirmClearTrash}
                title="Limpar todos os colaboradores da lixeira"
              >
                Esvaziar Lixeira
              </Button>
            )}
            <Button
              size="sm"
              icon={Palmtree}
              className="!bg-purple-600 hover:!bg-purple-700"
              onClick={() => onOpenAbsenceModal()}
              title="Cadastrar férias, licenças médicas ou treinamentos para colaboradores"
            >
              Agendar Férias / Licença
            </Button>
            <Button
              size="sm"
              icon={UserPlus}
              onClick={onOpenAddCollabModal}
              title="Cadastrar um novo colaborador na equipe"
            >
              Adicionar Colaborador
            </Button>
          </div>
        </div>

        {/* Search, View Mode Toggle & Filters */}
        <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-3 space-y-2.5">
          {/* Row 1: Search + View Mode Switcher + Clean Filters button */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex-1 min-w-[220px] max-w-md">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Pesquisar por nome, LDAP, RE, cargo, time..."
                className="w-full"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {listMode === 'active' && (
                <div className="inline-flex items-center bg-[var(--paper)] border border-[var(--line)] rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('grouped_scale')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'grouped_scale'
                        ? 'bg-[var(--primary)] text-white shadow-xs'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                    title="Visualizar equipe agrupada por escala / turma"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Agrupado por Escala</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('table')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === 'table'
                        ? 'bg-[var(--primary)] text-white shadow-xs'
                        : 'text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                    title="Visualizar em formato de tabela detalhada com rolagem e ações fixas"
                  >
                    <Table className="w-3.5 h-3.5" />
                    <span>Tabela Detalhada</span>
                  </button>
                </div>
              )}

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 transition-colors cursor-pointer"
                  title="Limpar todos os filtros aplicados"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpar Filtros</span>
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Comprehensive Dropdown Filters */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1 border-t border-[var(--line)]/60">
            {/* 1. Filtro de Escala / Turma */}
            <MultiSelectFilter
              label="Escala / Turma"
              options={scaleOptions}
              selectedValues={selectedScales}
              onChange={setSelectedScales}
              placeholder="Todas as escalas"
              allLabel="Todas as Escalas"
              icon={<Calendar className="w-3 h-3 text-[var(--primary)]" />}
              className="w-full"
            />

            {/* 2. Filtro de Turno */}
            <MultiSelectFilter
              label="Turno"
              options={shiftOptions}
              selectedValues={selectedShifts}
              onChange={setSelectedShifts}
              placeholder="Todos os turnos"
              allLabel="Todos os Turnos"
              icon={<Clock className="w-3 h-3 text-[var(--primary)]" />}
              className="w-full"
            />

            {/* 3. Filtro de Time / TL */}
            <MultiSelectFilter
              label="Time / TL"
              options={tlOptions}
              selectedValues={selectedTLs}
              onChange={setSelectedTLs}
              placeholder="Todos os times"
              allLabel="Todos os Times"
              icon={<Users className="w-3 h-3 text-[var(--primary)]" />}
              className="w-full"
            />

            {/* 4. Filtro de Cargo */}
            <MultiSelectFilter
              label="Cargo"
              options={roleOptions}
              selectedValues={selectedRoles}
              onChange={setSelectedRoles}
              placeholder="Todos os cargos"
              allLabel="Todos os Cargos"
              icon={<Briefcase className="w-3 h-3 text-[var(--primary)]" />}
              className="w-full"
            />

            {/* 5. Filtro de Categoria */}
            <MultiSelectFilter
              label="Categoria"
              options={categoryOptions}
              selectedValues={selectedCategories}
              onChange={setSelectedCategories}
              placeholder="Todas as categorias"
              allLabel="Todas as Categorias"
              icon={<Tag className="w-3 h-3 text-[var(--primary)]" />}
              className="w-full"
            />

            {/* 6. Ordenação */}
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
                <ArrowDownAZ className="w-3 h-3 text-[var(--primary)]" />
                <span>Ordenação</span>
              </label>
              <Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)}>
                <option value="asc">Ordem A-Z (Nome)</option>
                <option value="desc">Ordem Z-A (Nome)</option>
                <option value="scale">Por Escala / Turma</option>
                <option value="role">Por Cargo</option>
                <option value="team">Por Time / TL</option>
                <option value="shift">Por Turno</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Results Counter & Active Criteria */}
        <div className="flex items-center justify-between text-xs font-bold text-[var(--muted)] px-1">
          <span>
            Exibindo <span className="text-[var(--ink)] font-black">{filteredCollaborators.length}</span> de{' '}
            <span className="text-[var(--ink)] font-black">{state.collaborators.length}</span> colaboradores
          </span>
          {selectedScales.length > 0 && (
            <span className="text-[11px] font-bold text-[var(--primary)] bg-[var(--primary-soft)] px-2 py-0.5 rounded-md border border-[var(--primary-border)]">
              Filtro de Escala: {selectedScales.map((s) => (isNaN(Number(s)) ? s : `Turma ${s}`)).join(', ')}
            </span>
          )}
        </div>

        {/* Bulk Selection Bar */}
        {listMode === 'active' && selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--primary-soft)] border border-[var(--primary-border)] rounded-xl px-3.5 py-2.5 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[var(--primary)]">
              <ListChecks className="w-4 h-4" />
              <span>{selectedIds.length} colaborador(es) selecionado(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                Limpar seleção
              </Button>
              <Button size="sm" icon={Wand2} onClick={() => onOpenBulkModal(selectedIds)}>
                Editar em Lote
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ACTIVE COLLABORATORS LIST DISPLAY */}
      {listMode === 'active' ? (
        viewMode === 'grouped_scale' ? (
          /* =========================================================================
             GROUPED BY SCALE VIEW (Responsive, never cuts off options on any screen)
             ========================================================================= */
          <div className="p-3.5 sm:p-4 pt-0 space-y-4">
            {groupedByScale.length > 0 ? (
              groupedByScale.map((group) => {
                const groupSelected =
                  group.collaborators.length > 0 &&
                  group.collaborators.every((m) => selectedIds.includes(m.id));

                return (
                  <div
                    key={group.scaleKey}
                    className="border border-[var(--line)] bg-[var(--surface-1)] rounded-2xl overflow-hidden shadow-2xs transition-all hover:border-[var(--primary-border)]"
                  >
                    {/* Scale Group Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--line)]">
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={groupSelected}
                          onChange={() => toggleSelectGroup(group.collaborators)}
                          title={`Selecionar todos os ${group.collaborators.length} colaboradores de ${group.scaleName}`}
                          className="accent-[var(--primary)] cursor-pointer w-4 h-4"
                        />
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)] flex items-center justify-center font-black text-xs">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-[var(--ink)] flex items-center gap-2">
                              <span>{group.scaleName}</span>
                              <Badge tone="primary" className="!text-[10px]">
                                {group.collaborators.length} colaboradores
                              </Badge>
                            </h3>
                          </div>
                        </div>
                      </div>

                      {/* Shift Breakdown for this Scale */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                        {Object.entries(group.shiftSummary).map(([sh, count]) => (
                          <span
                            key={sh}
                            className="px-2 py-0.5 rounded-lg bg-[var(--paper)] border border-[var(--line)] text-[var(--muted)] flex items-center gap-1"
                          >
                            <span className="font-extrabold text-[var(--ink)]">T{sh}:</span> {count}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Scale Collaborators Grid */}
                    <div className="p-3 sm:p-4">
                      {group.collaborators.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {group.collaborators.map((c) => {
                            const colTL = c.teamLeader || state.defaultTeamLeader || 'Sem Time';
                            const activeAbsences = c.absences || [];
                            const activeSkills = Object.entries(c.skills || {}).filter(
                              ([_, lvl]) => Number(lvl) > 0
                            );

                            return (
                              <div
                                key={c.id}
                                onContextMenu={collabMenuOnContext(c.id)}
                                className={`p-3 rounded-xl border transition-all relative flex flex-col justify-between gap-2.5 ${
                                  isSelected(c.id)
                                    ? 'bg-[var(--primary-soft)] border-[var(--primary)] ring-1 ring-[var(--primary)]'
                                    : 'bg-[var(--paper)] border-[var(--line)] hover:border-[var(--primary-border)] hover:shadow-xs'
                                }`}
                              >
                                {/* Top: Checkbox, Avatar, Name & Quick Context */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={isSelected(c.id)}
                                      onClick={(e) => toggleSelect(c.id, e)}
                                      onChange={() => {}}
                                      className="accent-[var(--primary)] cursor-pointer w-4 h-4 shrink-0"
                                    />
                                    <Avatar name={c.name} photoUrl={c.photoUrl} size="sm" />
                                    <div className="min-w-0">
                                      <h4 className="text-xs font-black text-[var(--ink)] truncate" title={c.name}>
                                        {c.name}
                                      </h4>
                                      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-[var(--muted)]">
                                        {c.login && <span>LDAP: {c.login}</span>}
                                        {c.registration && <span>• RE: {c.registration}</span>}
                                        {c.companyProfileUrl && (
                                          <a
                                            href={c.companyProfileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-700"
                                            title="Abrir no sistema corporativo"
                                          >
                                            <ExternalLink className="w-2.5 h-2.5 inline ml-0.5" />
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Fast Action Buttons - Always Visible */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => onOpenEditCollabModal(c)}
                                      className="p-1 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors cursor-pointer"
                                      title="Editar cadastro completo e skills"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteCollaborator(c.id)}
                                      className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
                                      title="Mover para a lixeira"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Badges: Cargo, Turno, TL & Categoria */}
                                <div className="flex flex-wrap items-center gap-1 text-[10px] font-bold">
                                  <span className="px-2 py-0.5 rounded-md bg-[var(--surface-2)] text-[var(--ink)] border border-[var(--line)]">
                                    {c.role || 'Sem Cargo'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                    Turno {c.shift || 'Geral'}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                    TL: {colTL}
                                  </span>
                                  {c.category && (
                                    <span className="px-1.5 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                      {c.category}
                                    </span>
                                  )}
                                </div>

                                {/* Skills & Absences Summary */}
                                <div className="space-y-1 pt-1 border-t border-[var(--line)]/60 text-[10.5px]">
                                  {activeSkills.length > 0 ? (
                                    <div className="flex flex-wrap items-center gap-1">
                                      <span className="text-[10px] font-bold text-[var(--muted)]">Skills:</span>
                                      {activeSkills.slice(0, 3).map(([sName, lvl]) => (
                                        <span
                                          key={sName}
                                          className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[9.5px] font-extrabold"
                                        >
                                          {sName} (Nv {lvl})
                                        </span>
                                      ))}
                                      {activeSkills.length > 3 && (
                                        <span className="text-[9px] text-[var(--muted)] font-bold">
                                          +{activeSkills.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-[var(--muted)] italic">
                                      Nenhuma skill vinculada
                                    </span>
                                  )}

                                  {activeAbsences.length > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                                      <Palmtree className="w-3 h-3 shrink-0" />
                                      <span className="truncate">
                                        {activeAbsences[0].type}: {activeAbsences[0].startDate} a {activeAbsences[0].endDate}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Bottom actions */}
                                <div className="flex items-center justify-between pt-1 text-[10.5px]">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[9.5px] font-bold text-[var(--muted)] uppercase">Escala:</span>
                                    <select
                                      value={c.scale}
                                      onChange={(e) => updateCollaborator(c.id, { scale: e.target.value })}
                                      className="bg-[var(--surface-2)] border border-[var(--line)] rounded px-1.5 py-0.5 text-[10px] font-black text-[var(--ink)] cursor-pointer focus:border-[var(--primary)]"
                                    >
                                      {(state.scaleGroups || []).map((grp) => (
                                        <option key={grp} value={grp}>
                                          Turma {grp}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => onOpenAbsenceModal(c.id)}
                                    className="text-[10px] font-extrabold text-[var(--primary)] hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Agendar Férias</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-xs font-semibold text-[var(--muted)]">
                          Nenhum colaborador nesta escala corresponde aos filtros ativos.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <EmptyState
                icon={Users}
                title="Nenhum colaborador encontrado"
                description="Nenhum colaborador corresponde aos filtros e pesquisa selecionados."
                actionLabel={hasActiveFilters ? "Limpar Filtros" : undefined}
                onAction={hasActiveFilters ? clearAllFilters : undefined}
              />
            )}
          </div>
        ) : (
          /* =========================================================================
             DETAILED TABLE VIEW (With sticky actions so options are never cut off)
             ========================================================================= */
          <div className="border-t border-[var(--line)] overflow-x-auto relative">
            <table className="w-full text-left text-xs border-collapse min-w-[1020px]">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--muted)] font-bold uppercase bg-[var(--surface-2)]">
                  <th className="p-2 w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      title="Selecionar todos os colaboradores filtrados"
                      className="accent-[var(--primary)] cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-2 cursor-pointer select-none hover:text-[var(--primary)] transition-colors min-w-[200px]"
                    title="Clique para alternar ordenação alfabética"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Nome & Contato</span>
                      {sortOrder === 'asc' && <ArrowDownAZ className="w-3.5 h-3.5 text-[var(--primary)]" />}
                      {sortOrder === 'desc' && <ArrowUpAZ className="w-3.5 h-3.5 text-[var(--primary)]" />}
                      {sortOrder !== 'asc' && sortOrder !== 'desc' && <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th className="p-2 min-w-[100px]">Escala / Turma</th>
                  <th className="p-2 min-w-[160px]">Turno & Time / TL</th>
                  <th className="p-2 min-w-[130px]">Cargo</th>
                  <th className="p-2 min-w-[130px]">Categoria</th>
                  <th className="p-2 min-w-[180px]">Skills & Nível</th>
                  <th className="p-2 min-w-[180px]">Férias / Licenças</th>
                  {/* Sticky Actions Header: pinned to right so it's always accessible without horizontal scrolling */}
                  <th className="p-2 text-right sticky right-0 bg-[var(--surface-2)] shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.08)] z-10 min-w-[90px]">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredCollaborators.length > 0 ? (
                  filteredCollaborators.map((c) => {
                    const activeAbsences = c.absences || [];
                    const colTL = c.teamLeader || state.defaultTeamLeader || 'Sem Time';
                    return (
                      <tr
                        key={c.id}
                        onContextMenu={collabMenuOnContext(c.id)}
                        className={`hover:bg-[var(--bg)] transition-colors ${
                          isSelected(c.id) ? 'bg-[var(--primary-soft)]/50' : ''
                        }`}
                      >
                        {/* Selection */}
                        <td className="p-2 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected(c.id)}
                            onClick={(e) => toggleSelect(c.id, e)}
                            onChange={() => {}}
                            className="accent-[var(--primary)] cursor-pointer w-4 h-4"
                          />
                        </td>

                        {/* Nome & Contato / Link */}
                        <td className="p-2 font-bold text-[var(--ink)] min-w-[200px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Avatar name={c.name} photoUrl={c.photoUrl} size="sm" />
                              <input
                                type="text"
                                value={c.name}
                                onChange={(e) => updateCollaborator(c.id, { name: e.target.value })}
                                onBlur={(e) => {
                                  const formatted = formatPersonName(e.target.value);
                                  if (formatted !== e.target.value) {
                                    updateCollaborator(c.id, { name: formatted });
                                  }
                                }}
                                className="bg-[var(--paper)] border border-[var(--line)] hover:border-[var(--primary-border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] px-2 py-1 flex-1 font-bold text-[var(--ink)] rounded-lg transition-all"
                              />
                            </div>
                            <div className="flex items-center gap-1.5 pl-8">
                              <input
                                type="text"
                                value={c.login || ''}
                                placeholder="LDAP"
                                onChange={(e) => updateCollaborator(c.id, { login: e.target.value })}
                                className="bg-[var(--paper)] border border-[var(--line)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--ink)] rounded w-24"
                              />
                              <input
                                type="text"
                                value={c.registration || ''}
                                placeholder="RE"
                                onChange={(e) => updateCollaborator(c.id, { registration: e.target.value })}
                                className="bg-[var(--paper)] border border-[var(--line)] px-1.5 py-0.5 text-[10.5px] font-medium text-[var(--ink)] rounded w-20"
                              />
                              {(c.companyProfileUrl || c.profileUrl) && (
                                <a
                                  href={c.companyProfileUrl || c.profileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-blue-600 hover:text-blue-800 rounded transition-colors"
                                  title="Abrir no sistema externo"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Escala / Turma */}
                        <td className="p-2 min-w-[100px]">
                          <select
                            value={c.scale}
                            onChange={(e) => updateCollaborator(c.id, { scale: e.target.value })}
                            className="bg-[var(--paper)] border border-[var(--line)] focus:border-[var(--primary)] text-[var(--ink)] rounded-md px-2 py-1 font-black text-xs cursor-pointer w-full"
                          >
                            {(state.scaleGroups || []).map((grp) => (
                              <option key={grp} value={grp}>
                                Turma {grp}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Turno & Time / TL */}
                        <td className="p-2 min-w-[160px]">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-extrabold text-[var(--ink)] shrink-0">Turno:</span>
                              <select
                                value={c.shift || 'Geral'}
                                onChange={(e) => updateCollaborator(c.id, { shift: e.target.value })}
                                className="bg-[var(--paper)] border border-[var(--line)] focus:border-[var(--primary)] rounded px-1.5 py-0.5 text-[11px] font-black text-[var(--ink)] w-full cursor-pointer"
                              >
                                {availableShifts.map((s) => (
                                  <option key={s} value={s}>
                                    Turno {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-extrabold text-[var(--ink)] shrink-0">TL:</span>
                              <select
                                value={colTL}
                                onChange={(e) => updateCollaborator(c.id, { teamLeader: e.target.value })}
                                className="bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-500 rounded px-1.5 py-0.5 font-black text-[11px] text-emerald-950 dark:text-emerald-100 w-full cursor-pointer"
                              >
                                {(state.teamLeaders || []).map((tl) => (
                                  <option key={tl} value={tl}>
                                    {tl}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </td>

                        {/* Cargo */}
                        <td className="p-2 min-w-[130px]">
                          <select
                            value={c.role}
                            onChange={(e) => updateCollaborator(c.id, { role: e.target.value })}
                            className="bg-[var(--paper)] border border-[var(--line)] focus:border-[var(--primary)] text-[var(--ink)] rounded-md px-1.5 py-1 font-bold text-xs w-full cursor-pointer"
                          >
                            <option value="">Selecione Cargo</option>
                            {state.roles.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Categoria */}
                        <td className="p-2 min-w-[130px]">
                          <select
                            value={c.category}
                            onChange={(e) => updateCollaborator(c.id, { category: e.target.value })}
                            className="bg-[var(--paper)] border border-[var(--line)] focus:border-[var(--primary)] text-[var(--ink)] rounded-md px-1.5 py-1 font-bold text-xs w-full cursor-pointer"
                          >
                            <option value="">Selecione Categoria</option>
                            {state.categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Skills & Nível */}
                        <td className="p-2 min-w-[180px]">
                          {(() => {
                            const activeSkills = Object.entries(c.skills || {}).filter(
                              ([_, lvl]) => Number(lvl) > 0
                            );
                            return (
                              <div className="space-y-1">
                                {activeSkills.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 max-w-[240px]">
                                    {activeSkills.map(([sName, lvlVal]) => (
                                      <div
                                        key={sName}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-extrabold bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800"
                                      >
                                        <span className="truncate max-w-[90px]">{sName}</span>
                                        <span className="text-[9px] bg-black/10 dark:bg-white/10 px-1 rounded">
                                          Nv {lvlVal}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-[var(--muted)] italic">Sem skills</div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onOpenAddSkillModal(c.id)}
                                  className="text-[9.5px] font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                  <span>Adicionar Skill</span>
                                </button>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Férias / Licenças */}
                        <td className="p-2 min-w-[180px]">
                          <div className="space-y-1">
                            {activeAbsences.length > 0 ? (
                              activeAbsences.map((abs) => (
                                <div
                                  key={abs.id}
                                  className="flex items-center justify-between p-1 rounded border text-[10.5px] font-semibold bg-purple-50 text-purple-900 border-purple-200 dark:bg-purple-950/60 dark:text-purple-200"
                                >
                                  <span className="truncate">
                                    <strong className="capitalize">{abs.type}:</strong> {abs.startDate} a {abs.endDate}
                                  </span>
                                  <button
                                    onClick={() => removeScheduledAbsence(c.id, abs.id)}
                                    className="p-0.5 hover:text-red-600 ml-1 cursor-pointer"
                                    title="Remover"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ))
                            ) : (
                              <span className="text-[var(--muted)] text-[10.5px] italic">Nenhum</span>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenAbsenceModal(c.id)}
                              className="text-[9.5px] font-bold text-[var(--primary)] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Agendar Período</span>
                            </button>
                          </div>
                        </td>

                        {/* Sticky Right Action Column - NEVER CUT OFF */}
                        <td className="p-2 text-right sticky right-0 bg-[var(--paper)] shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.08)] z-10 min-w-[90px]">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="xs"
                              icon={Pencil}
                              className="!text-blue-600 hover:!text-blue-800 hover:!bg-blue-50 dark:hover:!bg-blue-950/40"
                              onClick={() => onOpenEditCollabModal(c)}
                              title="Editar cadastro completo"
                            />
                            <Button
                              variant="ghost"
                              size="xs"
                              icon={Trash2}
                              className="!text-red-500 hover:!text-red-700 hover:!bg-red-50 dark:hover:!bg-red-950/40"
                              onClick={() => deleteCollaborator(c.id)}
                              title="Mover para a lixeira"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} className="p-6">
                      <EmptyState
                        icon={Users}
                        title="Nenhum colaborador encontrado"
                        description="Nenhum colaborador encontrado com os filtros e termo de pesquisa selecionados."
                        actionLabel={hasActiveFilters ? "Limpar Filtros" : undefined}
                        onAction={hasActiveFilters ? clearAllFilters : undefined}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      ) : (
        /* =========================================================================
           TRASH VIEW (Collaborators in Recycle Bin)
           ========================================================================= */
        <div className="p-3.5 sm:p-4 pt-0 space-y-3.5">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <strong className="font-extrabold block mb-0.5 text-sm">
                Lixeira de Segurança (Retenção de 60 dias)
              </strong>
              Ao excluir um colaborador da lista de colaboradores, os dados são guardados de forma segura nesta lixeira por até 60 dias. Você pode restaurá-lo a qualquer momento ou excluir definitivamente se desejar.
            </div>
          </div>

          <div className="overflow-x-auto relative border border-[var(--line)] rounded-xl">
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--muted)] font-bold uppercase bg-[var(--surface-2)]">
                  <th className="p-2">Nome</th>
                  <th className="p-2">Login / Reg.</th>
                  <th className="p-2">Time / TL</th>
                  <th className="p-2">Cargo & Escala</th>
                  <th className="p-2">Data da Exclusão</th>
                  <th className="p-2">Prazo de Retenção</th>
                  <th className="p-2 text-right sticky right-0 bg-[var(--surface-2)] shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.08)] z-10">
                    Ações de Recuperação
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {filteredDeletedCollaborators.length > 0 ? (
                  filteredDeletedCollaborators.map((item) => {
                    const c = item.collaborator;
                    const colTL = c.teamLeader || state.defaultTeamLeader || 'Sem Time';
                    return (
                      <tr key={item.id} className="hover:bg-[var(--bg)] transition-colors">
                        <td className="p-2 font-bold text-[var(--ink)]">{c.name}</td>
                        <td className="p-2 text-[var(--muted)]">
                          <div>{c.login || '—'}</div>
                          <div className="text-[10px]">{c.registration || '—'}</div>
                        </td>
                        <td className="p-2">
                          <Badge tone="success" className="!rounded-lg">
                            {colTL}
                          </Badge>
                        </td>
                        <td className="p-2">
                          <div className="font-semibold text-[var(--ink)]">{c.role || 'Sem cargo'}</div>
                          <div className="text-[10px] text-[var(--muted)]">
                            Turma {c.scale} ({c.shift || 'T2'})
                          </div>
                        </td>
                        <td className="p-2 text-[var(--muted)] font-mono text-[11px]">
                          {formatISOToBR(item.deletedAt)}
                        </td>
                        <td className="p-2">
                          <Badge tone="warning" className="!text-[11px] !px-2.5 !py-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>{getDaysRemaining(item.expiresAt)}</span>
                          </Badge>
                        </td>
                        {/* Sticky Action Column */}
                        <td className="p-2 text-right sticky right-0 bg-[var(--paper)] shadow-[-6px_0_10px_-2px_rgba(0,0,0,0.08)] z-10">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              icon={RotateCcw}
                              className="!bg-emerald-600 hover:!bg-emerald-700"
                              onClick={() => restoreCollaborator(item.id)}
                              title="Restaurar colaborador de volta para a lista de colaboradores"
                            >
                              Restaurar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={Trash2}
                              className="!border-red-300 dark:!border-red-800 !text-red-700 dark:!text-red-300 hover:!bg-red-50 dark:hover:!bg-red-950/60"
                              onClick={() => onConfirmDeletePermanent(item.id)}
                              title="Excluir permanentemente este colaborador"
                            >
                              Excluir Definitivo
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-6">
                      <EmptyState
                        icon={Archive}
                        title="Nenhum colaborador na lixeira"
                        description="Colaboradores excluídos aparecerão aqui por até 60 dias."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
};
