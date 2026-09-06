import React, { useState, useEffect } from 'react';
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
import { Collaborator, ShiftGroup } from '../../types';
import {
  matchesCollaboratorSearch,
  compareStringsBR,
  formatPersonName,
} from '../../utils/helpers';
import { collabMenuOnContext } from '../../utils/collabContextMenu';

const SHIFT_GROUPS: ShiftGroup[] = ['A', 'B', 'C', 'D'];

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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'role' | 'team' | 'shift'>('asc');

  useEffect(() => {
    if (initialListMode) {
      setListMode(initialListMode);
    }
  }, [initialListMode]);

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

  const colShifts = state.collaborators.map((c) => c.shift || 'Geral');
  const availableShifts = Array.from(new Set([...(state.shifts || []), ...colShifts])).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true })
  );
  if (!availableShifts.includes('Geral')) availableShifts.unshift('Geral');
  const shiftOptions = availableShifts.map((s) => ({ label: `Turno ${s}`, value: s }));

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

  // Filtered & Sorted active collaborators
  const filteredCollaborators = state.collaborators
    .filter((c) => {
      const colTL = c.teamLeader || state.defaultTeamLeader || 'Sem Time';
      const matchesTL = selectedTLs.length === 0 || selectedTLs.includes(colTL);
      const colShift = c.shift || 'Geral';
      const matchesShift = selectedShifts.length === 0 || selectedShifts.includes(colShift);
      const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(c.role);
      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(c.category);
      const matchesSearchQuery = matchesCollaboratorSearch(c, searchTerm, {
        defaultTeamLeader: state.defaultTeamLeader,
      });

      return matchesTL && matchesShift && matchesRole && matchesCategory && matchesSearchQuery;
    })
    .sort((a, b) => {
      if (sortOrder === 'desc') {
        return compareStringsBR(b.name, a.name);
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
    <Card id="collaborators" padded={false} className="overflow-hidden scroll-mt-28 animate-in fade-in duration-200">
      <div className="p-4 sm:p-5 space-y-4">
        {/* Top View Mode Switcher & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            items={[
              {
                value: 'active',
                label: 'Colaboradores Ativos',
                icon: Users,
                badge: state.collaborators.length,
              },
              {
                value: 'trash',
                label: 'Lixeira / Excluídos (Guardados 60d)',
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

        {/* Toolbar & Filters */}
        <Toolbar>
          <MultiSelectFilter
            label="Turno"
            options={shiftOptions}
            selectedValues={selectedShifts}
            onChange={setSelectedShifts}
            placeholder="Todos os turnos"
            allLabel="Todos os Turnos"
            className="flex-1 min-w-[170px]"
          />

          <MultiSelectFilter
            label="Time / TL"
            options={tlOptions}
            selectedValues={selectedTLs}
            onChange={setSelectedTLs}
            placeholder="Todos os times"
            allLabel="Todos os Times"
            icon={<Users className="w-3 h-3 text-[var(--primary)]" />}
            className="flex-1 min-w-[170px]"
          />

          <MultiSelectFilter
            label="Cargo"
            options={roleOptions}
            selectedValues={selectedRoles}
            onChange={setSelectedRoles}
            placeholder="Todos os cargos"
            allLabel="Todos os Cargos"
            icon={<Briefcase className="w-3 h-3 text-[var(--primary)]" />}
            className="flex-1 min-w-[170px]"
          />

          <MultiSelectFilter
            label="Categoria"
            options={categoryOptions}
            selectedValues={selectedCategories}
            onChange={setSelectedCategories}
            placeholder="Todas as categorias"
            allLabel="Todas as Categorias"
            icon={<Tag className="w-3 h-3 text-[var(--primary)]" />}
            className="flex-1 min-w-[170px]"
          />

          <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
            <label className="text-[10px] font-black text-[var(--muted)] uppercase tracking-wider flex items-center gap-1">
              <ArrowDownAZ className="w-3 h-3 text-[var(--primary)]" />
              <span>Ordenação</span>
            </label>
            <Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as any)}>
              <option value="asc">Ordem A-Z (Padrão)</option>
              <option value="desc">Ordem Z-A</option>
              <option value="role">Por Cargo</option>
              <option value="team">Por Time / TL</option>
              <option value="shift">Por Turno</option>
            </Select>
          </div>

          <div className="flex-1 min-w-[200px] max-w-xs">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Pesquisar colaborador, LDAP, RE..."
              className="w-full"
            />
          </div>
        </Toolbar>

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

      {/* Active Collaborators Table */}
      {listMode === 'active' ? (
        <div className="border-t border-[var(--line)] overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1040px]">
            <thead>
              <tr className="border-b border-[var(--line)] text-[var(--muted)] font-bold uppercase">
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
                  className="p-2 cursor-pointer select-none hover:text-[var(--primary)] transition-colors"
                  title="Clique para alternar ordenação alfabética A-Z / Z-A"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Nome</span>
                    {sortOrder === 'asc' && <ArrowDownAZ className="w-3.5 h-3.5 text-[var(--primary)]" />}
                    {sortOrder === 'desc' && <ArrowUpAZ className="w-3.5 h-3.5 text-[var(--primary)]" />}
                    {sortOrder !== 'asc' && sortOrder !== 'desc' && <ArrowUpDown className="w-3 h-3 opacity-40" />}
                  </div>
                </th>
                <th className="p-2">LDAP / RE / Link Empresa</th>
                <th className="p-2">Turno & Time / TL</th>
                <th className="p-2">Escala</th>
                <th className="p-2">Cargo</th>
                <th className="p-2">Categoria</th>
                <th className="p-2">Skills & Nível</th>
                <th className="p-2">Férias / Licenças / Treinamentos</th>
                <th className="p-2 text-right">Ação</th>
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
                      className="hover:bg-[var(--bg)] transition-colors"
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

                      {/* Nome */}
                      <td className="p-2 font-bold text-[var(--ink)] min-w-[200px]">
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
                      </td>

                      {/* LDAP & RE / Link Empresa */}
                      <td className="p-2 min-w-[150px]">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={c.login || ''}
                            placeholder="LDAP"
                            onChange={(e) => updateCollaborator(c.id, { login: e.target.value })}
                            className="bg-[var(--paper)] border border-[var(--line)] hover:border-[var(--primary-border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] px-2 py-0.5 w-full text-[11px] font-semibold text-[var(--ink)] rounded-md transition-all"
                          />
                          <input
                            type="text"
                            value={c.registration || ''}
                            placeholder="RE (Matrícula)"
                            onChange={(e) => updateCollaborator(c.id, { registration: e.target.value })}
                            className="bg-[var(--paper)] border border-[var(--line)] hover:border-[var(--primary-border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] px-2 py-0.5 w-full text-[11px] font-semibold text-[var(--ink)] rounded-md transition-all"
                          />
                          <div className="flex items-center gap-1 pt-0.5">
                            <input
                              type="url"
                              value={c.companyProfileUrl || c.profileUrl || ''}
                              placeholder="Link Sistema Empresa"
                              onChange={(e) =>
                                updateCollaborator(c.id, {
                                  companyProfileUrl: e.target.value || undefined,
                                  profileUrl: e.target.value || undefined,
                                })
                              }
                              className="bg-[var(--paper)] border border-[var(--line)] hover:border-blue-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 px-1.5 py-0.5 w-full text-[10px] font-medium text-[var(--ink)] rounded transition-all"
                            />
                            {(c.companyProfileUrl || c.profileUrl) && (
                              <a
                                href={c.companyProfileUrl || c.profileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded shrink-0 transition-colors cursor-pointer"
                                title={`Abrir perfil no sistema da empresa: ${c.companyProfileUrl || c.profileUrl}`}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Turno & Time / TL */}
                      <td className="p-2 min-w-[170px]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-extrabold text-[var(--ink)] shrink-0">Turno:</span>
                            <select
                              value={c.shift || 'Geral'}
                              onChange={(e) => updateCollaborator(c.id, { shift: e.target.value })}
                              className="bg-[var(--paper)] border border-[var(--line)] focus:border-[var(--primary)] rounded-md px-1.5 py-0.5 text-[11px] font-black text-[var(--ink)] w-full cursor-pointer"
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
                              className="bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-500 rounded-md px-1.5 py-0.5 font-black text-[11px] text-emerald-950 dark:text-emerald-100 w-full cursor-pointer"
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

                      {/* Escala 6x2 */}
                      <td className="p-2 min-w-[70px]">
                        <select
                          value={c.scale}
                          onChange={(e) => updateCollaborator(c.id, { scale: e.target.value })}
                          className="bg-[var(--paper)] border border-[var(--line)] focus:border-[var(--primary)] text-[var(--ink)] rounded-md p-1 font-black text-xs cursor-pointer"
                        >
                          {(state.scaleGroups && state.scaleGroups.length ? state.scaleGroups : SHIFT_GROUPS).map(
                            (grp) => (
                              <option key={grp} value={grp}>
                                Turma {grp}
                              </option>
                            )
                          )}
                        </select>
                      </td>

                      {/* Cargo */}
                      <td className="p-2 min-w-[130px]">
                        <select
                          value={c.role}
                          onChange={(e) => updateCollaborator(c.id, { role: e.target.value })}
                          className="bg-[var(--paper)] border border-[var(--line)] focus:border-[var(--primary)] text-[var(--ink)] rounded-md p-1 font-bold text-xs w-full cursor-pointer"
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
                          className="bg-[var(--paper)] border border-[var(--line)] focus:border-[var(--primary)] text-[var(--ink)] rounded-md p-1 font-bold text-xs w-full cursor-pointer"
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
                      <td className="p-2 min-w-[200px]">
                        {(() => {
                          const activeSkills = Object.entries(c.skills || {}).filter(([_, lvl]) => Number(lvl) > 0);
                          return (
                            <div className="space-y-1.5">
                              {activeSkills.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 max-w-[260px]">
                                  {activeSkills.map(([sName, lvlVal]) => {
                                    const lvl = Number(lvlVal);
                                    const badgeColor =
                                      lvl === 1
                                        ? 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800'
                                        : lvl === 2
                                        ? 'bg-indigo-50 text-indigo-900 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800'
                                        : 'bg-purple-50 text-purple-900 border-purple-200 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-800';

                                    return (
                                      <div
                                        key={sName}
                                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-extrabold ${badgeColor}`}
                                      >
                                        <Sparkles className="w-3 h-3 shrink-0 opacity-80" />
                                        <span className="truncate max-w-[100px]">{sName}</span>
                                        <select
                                          value={lvl}
                                          onChange={(e) => setSkillLevel(c.id, sName, Number(e.target.value))}
                                          className="bg-black/10 dark:bg-white/10 text-inherit border-none rounded px-1 py-0 text-[10px] font-black cursor-pointer focus:outline-none"
                                          title="Mudar nível da skill"
                                        >
                                          <option value={1}>Nv 1 (Básico)</option>
                                          <option value={2}>Nv 2 (Médio)</option>
                                          <option value={3}>Nv 3 (Sênior)</option>
                                        </select>
                                        <button
                                          onClick={() => setSkillLevel(c.id, sName, 0)}
                                          className="p-0.5 hover:text-red-600 transition-colors rounded ml-0.5 cursor-pointer"
                                          title="Remover skill"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-[11px] text-[var(--muted)] italic">Nenhuma skill vinculada</div>
                              )}

                              <button
                                onClick={() => onOpenAddSkillModal(c.id)}
                                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[var(--primary)] hover:bg-[var(--primary-soft)] px-2.5 py-1 rounded-md border border-dashed border-[var(--primary-border)] transition-colors cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                <span>+ Adicionar Skill</span>
                              </button>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Férias / Licenças / Treinamentos */}
                      <td className="p-2 min-w-[200px]">
                        <div className="space-y-1.5">
                          {activeAbsences.length > 0 ? (
                            activeAbsences.map((abs) => {
                              const badgeColor =
                                abs.type === 'ferias'
                                  ? 'bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200'
                                  : abs.type === 'licenca'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                                  : 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200';

                              return (
                                <div
                                  key={abs.id}
                                  className={`flex items-center justify-between p-1.5 rounded border text-[11px] font-semibold ${badgeColor}`}
                                >
                                  <div>
                                    <span className="capitalize font-bold">{abs.type}:</span>{' '}
                                    <span>
                                      {abs.startDate} até {abs.endDate}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => removeScheduledAbsence(c.id, abs.id)}
                                    className="p-0.5 hover:text-red-600 ml-1 cursor-pointer"
                                    title="Remover afastamento"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            })
                          ) : (
                            <span className="text-[var(--muted)] text-[11px] italic">Nenhum agendamento</span>
                          )}
                          <button
                            onClick={() => onOpenAbsenceModal(c.id)}
                            className="text-[10px] font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Agendar Período</span>
                          </button>
                        </div>
                      </td>

                      {/* Edit & Delete Actions */}
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            icon={Pencil}
                            className="!text-blue-600 hover:!text-blue-800 hover:!bg-blue-50 dark:hover:!bg-blue-950/40"
                            onClick={() => onOpenEditCollabModal(c)}
                            title="Editar cadastro completo e skills do colaborador"
                          />
                          <Button
                            variant="ghost"
                            size="xs"
                            icon={Trash2}
                            className="!text-red-500 hover:!text-red-700 hover:!bg-red-50 dark:hover:!bg-red-950/40"
                            onClick={() => deleteCollaborator(c.id)}
                            title="Excluir colaborador (mover para a lixeira)"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-4">
                    <EmptyState
                      icon={Users}
                      title="Nenhum colaborador ativo encontrado"
                      description="Nenhum colaborador ativo encontrado com os filtros e termo de pesquisa selecionados."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Trash Bin Table View */
        <div className="border-t border-[var(--line)] p-4 sm:p-5 space-y-4">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-900 dark:text-amber-200 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <strong className="font-extrabold block mb-0.5 text-sm">
                Lixeira de Segurança (Retenção de 60 dias)
              </strong>
              Ao excluir um colaborador da lista de ativos, os dados são guardados de forma segura nesta lixeira por até 60 dias. Você pode restaurá-lo a qualquer momento ou excluir definitivamente se desejar.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[950px]">
              <thead>
                <tr className="border-b border-[var(--line)] text-[var(--muted)] font-bold uppercase">
                  <th className="p-2">Nome</th>
                  <th className="p-2">Login / Reg.</th>
                  <th className="p-2">Time / TL</th>
                  <th className="p-2">Cargo & Escala</th>
                  <th className="p-2">Data da Exclusão</th>
                  <th className="p-2">Prazo para Exclusão Permanente</th>
                  <th className="p-2 text-right">Ações de Recuperação</th>
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
                            Escala {c.scale} ({c.shift || 'T2'})
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
                        <td className="p-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              icon={RotateCcw}
                              className="!bg-emerald-600 hover:!bg-emerald-700"
                              onClick={() => restoreCollaborator(item.id)}
                              title="Restaurar colaborador de volta para a equipe ativa"
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
                    <td colSpan={7} className="p-4">
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
