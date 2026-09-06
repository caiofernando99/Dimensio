import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../context/AppContext';
import { SearchInput } from '../components/SearchInput';
import { MultiSelectFilter } from '../components/MultiSelectFilter';
import {
  CheckCircle2,
  XCircle,
  Palmtree,
  Stethoscope,
  BookOpen,
  Sun,
  RotateCcw,
  AlertCircle,
  Users,
  Tag,
  Briefcase,
  X,
  Clock,
  FileText,
  PiggyBank,
  ShieldAlert,
  Plus,
} from 'lucide-react';
import { getCollaboratorStatus, matchesCollaboratorSearch, formatDateBR, compareStringsBR } from '../utils/helpers';
import { collabMenuOnContext } from '../utils/collabContextMenu';
import { PageHeader, Card, CardHeader, StatCard, Badge, Button, Tabs, EmptyState, Toolbar } from '../components/ui';

export const PresenceView: React.FC = () => {
  const { state, toggleAttendance, resetAttendance, setAbsenceReason, setAttendanceStatus, showNotice } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTLs, setSelectedTLs] = useState<string[]>(
    state.selectedTLFilter && state.selectedTLFilter !== 'ALL' && state.selectedTLFilter !== 'todos'
      ? [state.selectedTLFilter]
      : []
  );

  React.useEffect(() => {
    if (state.selectedTLFilter && state.selectedTLFilter !== 'ALL' && state.selectedTLFilter !== 'todos') {
      setSelectedTLs([state.selectedTLFilter]);
    } else {
      setSelectedTLs([]);
    }
  }, [state.selectedTLFilter, state.teamShift]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'cargo_categoria' | 'cargo' | 'categoria' | 'geral'>('cargo_categoria');

  const activeDate = state.selectedDate;
  const activeShift = state.selectedShiftFilter || state.teamShift || 'ALL';

  const teamLeaders = useMemo(() => [...(state.teamLeaders || [])].sort(compareStringsBR), [state.teamLeaders]);
  const tlOptions = useMemo(() => teamLeaders.map((tl) => ({ label: tl, value: tl })), [teamLeaders]);

  const allRoles = useMemo(() => Array.from(new Set(state.collaborators.map((c) => c.role).filter(Boolean))).sort(compareStringsBR), [state.collaborators]);
  const roleOptions = useMemo(() => allRoles.map((r) => ({ label: r, value: r })), [allRoles]);

  const allCategories = useMemo(() => Array.from(new Set(state.collaborators.map((c) => c.category).filter(Boolean))).sort(compareStringsBR), [state.collaborators]);
  const categoryOptions = useMemo(() => allCategories.map((cat) => ({ label: cat, value: cat })), [allCategories]);

  const classified = useMemo(() => {
    return state.collaborators
      .filter((col) => {
        const colShift = col.shift || 'Geral';
        const matchesShift = activeShift === 'ALL' || activeShift === 'todos' || colShift === activeShift;
        const colTL = col.teamLeader || state.defaultTeamLeader || 'Sem Time';
        const matchesTL = selectedTLs.length === 0 || selectedTLs.includes(colTL);
        const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(col.role);
        const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(col.category);
        return matchesShift && matchesTL && matchesRole && matchesCategory;
      })
      .map((col) => {
        const statusInfo = getCollaboratorStatus(col, activeDate, state);
        return {
          collaborator: col,
          ...statusInfo,
        };
      })
      .sort((a, b) => compareStringsBR(a.collaborator.name, b.collaborator.name));
  }, [state.collaborators, activeShift, selectedTLs, selectedRoles, selectedCategories, state.defaultTeamLeader, activeDate, state]);

  const presentList = useMemo(() => classified.filter((c) => c.status === 'presente' || c.status === 'atraso'), [classified]);
  const filteredPresent = useMemo(() => presentList.filter((c) =>
    matchesCollaboratorSearch(c.collaborator, searchTerm, { defaultTeamLeader: state.defaultTeamLeader })
  ), [presentList, searchTerm, state.defaultTeamLeader]);
  const vacationList = useMemo(() => classified.filter((c) => c.status === 'ferias'), [classified]);
  const leaveList = useMemo(() => classified.filter((c) => c.status === 'licenca'), [classified]);
  const trainingList = useMemo(() => classified.filter((c) => c.status === 'treinamento'), [classified]);
  const absentList = useMemo(() => classified.filter((c) =>
    ['ausente', 'atestado', 'banco_horas', 'falta_injustificada'].includes(c.status)
  ), [classified]);
  const scaleOffList = useMemo(() => classified.filter((c) => c.status === 'folga'), [classified]);

  const filteredVacation = useMemo(() => vacationList.filter((c) =>
    matchesCollaboratorSearch(c.collaborator, searchTerm, { defaultTeamLeader: state.defaultTeamLeader })
  ), [vacationList, searchTerm, state.defaultTeamLeader]);
  const filteredLeaveTraining = useMemo(() => [...leaveList, ...trainingList].filter((c) =>
    matchesCollaboratorSearch(c.collaborator, searchTerm, { defaultTeamLeader: state.defaultTeamLeader })
  ), [leaveList, trainingList, searchTerm, state.defaultTeamLeader]);
  const filteredAbsent = useMemo(() => absentList.filter((c) =>
    matchesCollaboratorSearch(c.collaborator, searchTerm, { defaultTeamLeader: state.defaultTeamLeader })
  ), [absentList, searchTerm, state.defaultTeamLeader]);
  const filteredScaleOff = useMemo(() => scaleOffList.filter((c) =>
    matchesCollaboratorSearch(c.collaborator, searchTerm, { defaultTeamLeader: state.defaultTeamLeader })
  ), [scaleOffList, searchTerm, state.defaultTeamLeader]);

  const groupedByRoleCategory = useMemo(() => {
    const map: Record<string, typeof presentList> = {};
    filteredPresent.forEach((item) => {
      const role = item.collaborator.role || 'Sem Cargo';
      const category = item.collaborator.category || 'Sem Categoria';
      const key = `${role} • ${category}`;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [filteredPresent]);

  const groupedByRole = useMemo(() => {
    const map: Record<string, typeof presentList> = {};
    filteredPresent.forEach((item) => {
      const key = item.collaborator.role || 'Sem Cargo Definido';
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [filteredPresent]);

  const groupedByCategory = useMemo(() => {
    const map: Record<string, typeof presentList> = {};
    filteredPresent.forEach((item) => {
      const key = item.collaborator.category || 'Sem Categoria Definida';
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [filteredPresent]);

  const dayReport = state.dailyReports[activeDate] || {};

  const absenceOptions = [
    { value: 'atraso', label: 'Atraso (Início de Turno)', icon: Clock, color: 'text-amber-600' },
    { value: 'falta_injustificada', label: 'Falta Injustificada', icon: ShieldAlert, color: 'text-rose-600' },
    { value: 'atestado', label: 'Atestado Médico', icon: FileText, color: 'text-blue-600' },
    { value: 'banco_horas', label: 'Banco de Horas', icon: PiggyBank, color: 'text-emerald-600' },
  ] as const;

  const [absenceDropdown, setAbsenceDropdown] = useState<{
    collaboratorId: string;
    x: number;
    y: number;
  } | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbsenceDropdown(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenAbsenceDropdown = (collaboratorId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const rect = event.currentTarget.getBoundingClientRect();
    setAbsenceDropdown({
      collaboratorId,
      x: rect.left,
      y: rect.bottom + 4,
    });
  };

  const handleCancelAbsence = () => {
    setAbsenceDropdown(null);
  };

  const handleToggleAtraso = (collaboratorId: string) => {
    const collab = state.collaborators.find((c) => c.id === collaboratorId);
    const statusInfo = collab ? getCollaboratorStatus(collab, activeDate, state) : null;
    if (statusInfo?.status === 'atraso') {
      setAttendanceStatus(collaboratorId, 'presente');
      showNotice(`${collab?.name || 'Colaborador'}: Atraso removido.`);
    } else {
      setAttendanceStatus(collaboratorId, 'atraso');
      showNotice(`${collab?.name || 'Colaborador'}: Atraso registrado.`);
    }
  };

  const handleAbsenceSelect = (collaboratorId: string, reason: 'atraso' | 'atestado' | 'banco_horas' | 'falta_injustificada') => {
    const collab = state.collaborators.find((c) => c.id === collaboratorId);
    const statusInfo = collab ? getCollaboratorStatus(collab, activeDate, state) : null;

    if (reason === 'atraso' && statusInfo?.status === 'atraso') {
      setAttendanceStatus(collaboratorId, 'presente');
      showNotice(`${collab?.name || 'Colaborador'}: Atraso removido.`);
    } else {
      setAttendanceStatus(collaboratorId, reason);
      const reasonLabel = absenceOptions.find((o) => o.value === reason)?.label || reason;
      showNotice(`${collab?.name || 'Colaborador'}: ${reasonLabel} registrado.`);
    }
    setAbsenceDropdown(null);
  };

  const hasActiveFilters = searchTerm || selectedTLs.length > 0 || selectedRoles.length > 0 || selectedCategories.length > 0;

  const renderPresentItem = (
    item: { collaborator: (typeof state.collaborators)[number]; isExtraPresence?: boolean; status?: string },
    detailed = false
  ) => {
    const { collaborator, isExtraPresence, status } = item;
    return (
      <motion.div
        key={collaborator.id}
        onContextMenu={collabMenuOnContext(collaborator.id)}
        layout
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
        className={`flex items-center justify-between gap-2 ${detailed ? 'bg-[var(--surface-2)] border border-[var(--line)] rounded-lg px-2.5 py-2 hover:border-[var(--primary-border)] transition-colors' : 'py-1.5 px-1'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <input
            type="checkbox"
            checked={absenceDropdown?.collaboratorId !== collaborator.id}
            onChange={(e) => handleOpenAbsenceDropdown(collaborator.id, e)}
            className="w-4 h-4 text-[var(--primary)] rounded accent-[var(--primary)] cursor-pointer shrink-0"
          />
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--ink)] truncate flex items-center gap-1.5">
              <span className="truncate">{collaborator.name}</span>
              {isExtraPresence && (
                <span className="text-[8.5px] font-black bg-purple-100 dark:bg-purple-950 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-800 px-1.5 py-0.5 rounded-md shrink-0">
                  TROCA
                </span>
              )}
            </div>
            {detailed ? (
              <div className="text-[10px] text-[var(--muted)] flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-[var(--primary)]">{collaborator.role}</span>
                <span>•</span>
                <span className="font-bold text-purple-600 dark:text-purple-400">{collaborator.category}</span>
                <span>•</span>
                <span className="font-semibold">Turma {collaborator.scale}</span>
              </div>
            ) : (
              <div className="text-[9.5px] text-[var(--muted)] flex items-center gap-1 truncate">
                <span>Turma {collaborator.scale}</span>
                {collaborator.teamLeader && (
                  <>
                    <span>•</span>
                    <span className="truncate">TL: {collaborator.teamLeader}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        {status === 'atraso' ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleAtraso(collaborator.id);
            }}
            title="Clique para remover atraso"
            className="text-[9.5px] font-extrabold px-2 py-0.5 rounded-full shrink-0 bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
            <span>Atraso</span>
            <X className="w-2.5 h-2.5 opacity-70 hover:opacity-100" />
          </button>
        ) : (
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
            isExtraPresence
              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          }`}>
            {isExtraPresence ? 'Extra' : detailed ? 'Confirmado' : 'Presente'}
          </span>
        )}
      </motion.div>
    );
  };

  const renderGroupColumn = (
    title: string,
    subtitle: React.ReactNode,
    list: typeof presentList,
    accent?: 'primary' | 'purple',
    keyProp?: string
  ) => {
    return (
      <div
        key={keyProp || title}
        className="bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-2.5 space-y-2 shadow-2xs hover:border-[var(--primary-border)] transition-all break-inside-avoid inline-block w-full"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-1.5">
          <div className="flex items-center gap-1.5 min-w-0 pr-1">
            {subtitle}
            <h5 className="text-xs font-black text-[var(--ink)] uppercase tracking-wide truncate">{title}</h5>
          </div>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${
            accent === 'purple'
              ? 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border-purple-300'
              : 'bg-[var(--primary-soft)] text-[var(--primary)] border-[var(--primary-border)]'
          }`}>
            {list.length} {list.length === 1 ? 'Presente' : 'Presentes'}
          </span>
        </div>

        <div className="divide-y divide-[var(--line)] max-h-64 overflow-y-auto pr-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {list.map((item) => renderPresentItem(item))}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const groupTabs = [
    { value: 'cargo_categoria', label: 'Cargo + Categoria' },
    { value: 'cargo', label: 'Por Cargo' },
    { value: 'categoria', label: 'Por Categoria' },
    { value: 'geral', label: 'Lista Geral' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={CheckCircle2}
        title="Presença de Hoje"
        subtitle={`Controle de presença e frequência em tempo real • ${formatDateBR(activeDate)}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={RotateCcw}
            onClick={() => {
              resetAttendance();
              showNotice('Escala e presenças restauradas para o padrão do dia!');
            }}
          >
            Restaurar Padrão
          </Button>
        }
      />

      {/* Filtros */}
      <Card>
        <CardHeader
          icon={<Users className="w-4.5 h-4.5" />}
          title="Filtros da Lista"
          subtitle="Combine time, cargo e categoria para refinar a visualização."
          actions={
            hasActiveFilters ? (
              <Button
                variant="ghost"
                size="sm"
                icon={X}
                onClick={() => {
                  setSearchTerm('');
                  setSelectedTLs([]);
                  setSelectedRoles([]);
                  setSelectedCategories([]);
                }}
              >
                Limpar Filtros
              </Button>
            ) : undefined
          }
        />
        <div className="mt-3.5">
          <Toolbar>
            <MultiSelectFilter
              label="Time / Líder (TL)"
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

            <div className="flex-1 min-w-[200px] max-w-xs">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Pesquisar colaborador..."
                className="w-full"
              />
            </div>
          </Toolbar>
        </div>
      </Card>

      {/* Overview Status Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Presentes" value={presentList.length} icon={CheckCircle2} tone="success" />
        <StatCard label="Férias" value={vacationList.length} icon={Palmtree} tone="purple" />
        <StatCard label="Licenças" value={leaveList.length} icon={Stethoscope} tone="warning" />
        <StatCard label="Treinamentos" value={trainingList.length} icon={BookOpen} tone="info" />
        <StatCard label="Ausentes" value={absentList.length} icon={XCircle} tone="danger" />
        <StatCard label="Folga Escala" value={scaleOffList.length} icon={Sun} tone="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Lista de Presentes */}
        <Card className="lg:col-span-2" padded={false}>
          <div className="p-4 sm:p-5 border-b border-[var(--line)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600" />
                <h4 className="text-sm font-extrabold text-[var(--ink)]">
                  Colaboradores Presentes ({presentList.length})
                </h4>
              </div>
              <Tabs items={groupTabs} value={groupBy} onChange={(v) => setGroupBy(v as typeof groupBy)} className="max-w-full overflow-x-auto" />
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {groupBy === 'cargo_categoria' && (
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-2.5 space-y-2.5">
                {Object.keys(groupedByRoleCategory).length > 0 ? (
                  Object.entries(groupedByRoleCategory).map(([groupKey, rawList]) => {
                    const list = rawList as typeof presentList;
                    const [rName, cName] = groupKey.split(' • ');
                    return renderGroupColumn(
                      `${rName} / ${cName}`,
                      <Users className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />,
                      list,
                      undefined,
                      groupKey
                    );
                  })
                ) : (
                  <EmptyState
                    icon={Users}
                    title="Nenhum colaborador presente"
                    description="Ajuste os filtros ou registre presenças para começar."
                    className="col-span-full"
                  />
                )}
              </div>
            )}

            {groupBy === 'cargo' && (
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-2.5 space-y-2.5">
                {Object.keys(groupedByRole).length > 0 ? (
                  Object.entries(groupedByRole).map(([roleName, rawList]) => {
                    const list = rawList as typeof presentList;
                    return renderGroupColumn(
                      roleName,
                      <Users className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />,
                      list,
                      undefined,
                      roleName
                    );
                  })
                ) : (
                  <EmptyState
                    icon={Users}
                    title="Nenhum colaborador presente"
                    description="Ajuste os filtros ou registre presenças para começar."
                    className="col-span-full"
                  />
                )}
              </div>
            )}

            {groupBy === 'categoria' && (
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-2.5 space-y-2.5">
                {Object.keys(groupedByCategory).length > 0 ? (
                  Object.entries(groupedByCategory).map(([categoryName, rawList]) => {
                    const list = rawList as typeof presentList;
                    return renderGroupColumn(
                      categoryName,
                      <Tag className="w-3.5 h-3.5 text-purple-600 shrink-0" />,
                      list,
                      'purple',
                      categoryName
                    );
                  })
                ) : (
                  <EmptyState
                    icon={Users}
                    title="Nenhum colaborador presente"
                    description="Ajuste os filtros ou registre presenças para começar."
                    className="col-span-full"
                  />
                )}
              </div>
            )}

            {groupBy === 'geral' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 w-full items-start max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {filteredPresent.length > 0 ? (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {filteredPresent.map((item) => renderPresentItem(item, true))}
                  </AnimatePresence>
                ) : (
                  <EmptyState
                    icon={Users}
                    title="Nenhum colaborador presente"
                    description="Ajuste os filtros ou registre presenças para começar."
                    className="col-span-full"
                  />
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Painel lateral */}
        <div className="space-y-5">
          {/* Afastamentos programados */}
          <Card padded={false}>
            <div className="p-4 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <Palmtree className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">Afastamentos Programados Hoje</h4>
              </div>
            </div>
            <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
              {filteredVacation.length > 0 || filteredLeaveTraining.length > 0 ? (
                <>
                  {filteredVacation.map(({ collaborator, absenceDetail }) => (
                    <div
                      key={`${collaborator.id}-vacation`}
                      onContextMenu={collabMenuOnContext(collaborator.id)}
                      className="p-2.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 rounded-lg text-xs"
                    >
                      <div className="font-black text-[var(--ink)]">{collaborator.name}</div>
                      <div className="flex items-center justify-between text-[10px] text-purple-900 dark:text-purple-200 font-bold mt-1">
                        <span className="font-black uppercase tracking-wider">Férias</span>
                        <span className="font-semibold">
                          {formatDateBR(absenceDetail?.startDate)} até {formatDateBR(absenceDetail?.endDate)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {filteredLeaveTraining.map(({ collaborator, absenceDetail, status }) => (
                    <div
                      key={`${collaborator.id}-${status}`}
                      onContextMenu={collabMenuOnContext(collaborator.id)}
                      className={`p-2.5 rounded-lg border text-xs ${
                        status === 'licenca'
                          ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-100'
                          : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-100'
                      }`}
                    >
                      <div className="font-black text-[var(--ink)]">{collaborator.name}</div>
                      <div className="flex items-center justify-between text-[10px] mt-1 font-bold">
                        <span className="font-black uppercase tracking-wider">{status}</span>
                        <span className="font-semibold">
                          {formatDateBR(absenceDetail?.startDate)} até {formatDateBR(absenceDetail?.endDate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-xs text-[var(--muted)] italic p-2">Nenhum colaborador em férias ou licença hoje.</p>
              )}
            </div>
          </Card>

          {/* Ausências */}
          <Card padded={false}>
            <div className="p-4 border-b border-[var(--line)]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-600">Ausências ({filteredAbsent.length})</h4>
              </div>
            </div>
            <div className="p-4 space-y-3 max-h-72 overflow-y-auto">
              {filteredAbsent.length > 0 ? (
                <AnimatePresence mode="popLayout" initial={false}>
                  {filteredAbsent.map(({ collaborator, status }) => {
                    const currentReason = dayReport.absenceReasons?.[collaborator.id] || '';
                    const absenceInfo = {
                      atestado: { label: 'Atestado', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', btn: 'text-blue-700 dark:text-blue-400', badge: 'bg-blue-600 text-white' },
                      banco_horas: { label: 'Banco de Horas', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', btn: 'text-emerald-700 dark:text-emerald-400', badge: 'bg-emerald-600 text-white' },
                      falta_injustificada: { label: 'Falta Injustificada', bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', btn: 'text-rose-700 dark:text-rose-400', badge: 'bg-rose-600 text-white' },
                      ausente: { label: 'Ausente', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', btn: 'text-red-700 dark:text-red-400', badge: 'bg-red-600 text-white' },
                    }[status] || { label: 'Ausente', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', btn: 'text-red-700 dark:text-red-400', badge: 'bg-red-600 text-white' };

                    return (
                      <motion.div
                        key={collaborator.id}
                        onContextMenu={collabMenuOnContext(collaborator.id)}
                        layout
                        initial={{ opacity: 0, x: 24, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 24, scale: 0.9, transition: { duration: 0.15 } }}
                        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                        className={`p-3 ${absenceInfo.bg} ${absenceInfo.border} rounded-lg space-y-2`}
                      >
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="font-black text-[var(--ink)]">{collaborator.name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide shrink-0 shadow-2xs ${absenceInfo.badge}`}>
                            {absenceInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              toggleAttendance(collaborator.id, true);
                              showNotice(`Presença adicionada para ${collaborator.name}!`);
                            }}
                            className={`text-[10px] font-bold ${absenceInfo.btn} hover:underline cursor-pointer`}
                          >
                            Marcar Presente
                          </button>
                          <input
                            type="text"
                            value={currentReason}
                            onChange={(e) => setAbsenceReason(collaborator.id, e.target.value)}
                            placeholder={`Motivo da ausência (ex: ${absenceInfo.label.toLowerCase()})...`}
                            className="flex-1 p-1.5 bg-[var(--paper)] border border-[var(--line)] rounded text-xs text-[var(--ink)]"
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              ) : (
                <p className="text-xs text-[var(--muted)] italic p-2">Nenhuma ausência registrada.</p>
              )}
            </div>
          </Card>

          {/* Folga de Escala */}
          <Card padded={false}>
            <div className="p-4 border-b border-[var(--line)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">Folga de Escala ({filteredScaleOff.length})</h4>
                </div>
                <Badge tone="purple">Troca de Folga</Badge>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-normal mt-1.5">
                Colaboradores de folga hoje. Se algum trabalhou em dia de folga (troca/extra), adicione uma presença extra.
              </p>
            </div>
            <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
              {filteredScaleOff.length > 0 ? (
                filteredScaleOff.map(({ collaborator }) => (
                  <div
                    key={collaborator.id}
                    onContextMenu={collabMenuOnContext(collaborator.id)}
                    className="p-2.5 bg-[var(--surface-2)] border border-[var(--line)] hover:border-purple-300 rounded-xl flex items-center justify-between text-xs transition-colors gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold text-[var(--ink)] truncate">{collaborator.name}</div>
                      <div className="text-[10px] text-[var(--muted)] font-medium truncate">
                        Turma {collaborator.scale} • {collaborator.role}
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="xs"
                      icon={Plus}
                      onClick={() => {
                        toggleAttendance(collaborator.id, true);
                        showNotice(`Presença extra adicionada para ${collaborator.name}!`);
                      }}
                    >
                      Presença Extra
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[var(--muted)] italic p-2">Nenhum colaborador de folga programada hoje.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {absenceDropdown && (() => {
        const activeDropdownCollab = state.collaborators.find((c) => c.id === absenceDropdown.collaboratorId);
        const activeDropdownStatus = activeDropdownCollab
          ? getCollaboratorStatus(activeDropdownCollab, activeDate, state).status
          : null;

        const posX = Math.max(8, Math.min(absenceDropdown.x, (typeof window !== 'undefined' ? window.innerWidth : 400) - 230));
        const posY = Math.max(8, Math.min(absenceDropdown.y, (typeof window !== 'undefined' ? window.innerHeight : 600) - 230));

        return (
          <div
            className="fixed z-50"
            style={{ left: `${posX}px`, top: `${posY}px` }}
          >
            <div
              className="bg-[var(--paper)] border border-[var(--line)] rounded-xl shadow-[var(--shadow-pop)] p-1.5 min-w-[210px] animate-in fade-in-0 zoom-in-95 duration-100 relative"
              role="menu"
            >
              {absenceOptions.map((opt) => {
                const isCurrentAtraso = opt.value === 'atraso' && activeDropdownStatus === 'atraso';
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleAbsenceSelect(absenceDropdown.collaboratorId, opt.value)}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                      isCurrentAtraso
                        ? 'bg-amber-100/80 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                        : 'hover:bg-[var(--bg)]'
                    }`}
                    role="menuitem"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <opt.icon className={`w-4 h-4 ${isCurrentAtraso ? 'text-amber-600 dark:text-amber-400' : opt.color} shrink-0`} />
                      <span className={isCurrentAtraso ? 'text-amber-900 dark:text-amber-200 font-extrabold truncate' : opt.color}>
                        {isCurrentAtraso ? 'Remover Atraso' : opt.label}
                      </span>
                    </div>
                    {isCurrentAtraso && (
                      <span className="text-[9.5px] font-black uppercase bg-amber-200 dark:bg-amber-900/90 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded shrink-0">
                        Desfazer
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="border-t border-[var(--line)] my-1"></div>
              <button
                onClick={handleCancelAbsence}
                className="w-full px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                role="menuitem"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancelar</span>
              </button>
            </div>
            <div
              className="fixed inset-0 -z-10"
              onClick={handleCancelAbsence}
              aria-hidden="true"
            />
          </div>
        );
      })()}
    </div>
  );
};