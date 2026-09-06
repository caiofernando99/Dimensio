import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Users,
  Shield,
  Clock,
  Sparkles,
  Search,
  Building2,
  Radio,
  FileSpreadsheet,
  AlertCircle,
  HelpCircle,
  KeyRound,
  ArrowRightLeft,
  X,
  Check,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SectorDefinition, Collaborator } from '../types';
import { generateId } from '../utils/helpers';

const PRESET_SECTORS = [
  { name: 'Recebimento', desc: 'Conferência de carga, docas de entrada e triagem de mercadorias', color: '#3b82f6' },
  { name: 'Expedição', desc: 'Separação final, docas de saída, carregamento e romaneio', color: '#10b981' },
  { name: 'Picking', desc: 'Coleta fracionada, separação de pedidos e abastecimento de esteiras', color: '#8b5cf6' },
  { name: 'Inventário / ICQA', desc: 'Contagem cíclica, auditoria de qualidade e acuracidade de estoque', color: '#f59e0b' },
  { name: 'SAC & Suporte', desc: 'Atendimento ao cliente, ocorrências de rota e pós-venda', color: '#ec4899' },
  { name: 'Manutenção & Facilities', desc: 'Preventiva, corretiva, conservação predial e equipamentos', color: '#64748b' },
  { name: 'TI & Sistemas', desc: 'Suporte a coletores, impressoras térmicas, rede e software', color: '#06b6d4' },
  { name: 'Cross-Docking', desc: 'Transferência rápida sem estocagem intermediária', color: '#f97316' },
];

const SECTOR_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#64748b', // slate
  '#14b8a6', // teal
  '#ef4444', // red
];

export const SectorsSettingsPanel: React.FC = () => {
  const {
    state,
    addSectorDefinition,
    updateSectorDefinition,
    deleteSectorDefinition,
    switchActiveSector,
    addRegisteredSector,
    removeRegisteredSector,
    updateHelpdeskConfig,
    bulkUpdateCollaborators,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<SectorDefinition | null>(null);
  const [selectedSectorForCollabs, setSelectedSectorForCollabs] = useState<string | null>(null);
  const [sectorToDelete, setSectorToDelete] = useState<SectorDefinition | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [manager, setManager] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(SECTOR_COLORS[0]);
  const [activeShifts, setActiveShifts] = useState<string[]>(['T1', 'T2', 'T3']);
  const [defaultTeamLeader, setDefaultTeamLeader] = useState('');
  const [requirePassword, setRequirePassword] = useState(false);

  // Combine sectorDefinitions and registeredSectors into a normalized list
  const sectorsList = useMemo<SectorDefinition[]>(() => {
    const map = new Map<string, SectorDefinition>();

    // Add existing sector definitions
    (state.sectorDefinitions || []).forEach((def) => {
      if (def && def.name) {
        map.set(def.name.trim().toLowerCase(), def);
      }
    });

    // Add any registered sector strings that don't have a rich definition yet
    (state.registeredSectors || []).forEach((secName, idx) => {
      const clean = secName.trim();
      if (clean && !map.has(clean.toLowerCase())) {
        map.set(clean.toLowerCase(), {
          id: `sec_reg_${idx}_${clean.toLowerCase().replace(/\s+/g, '_')}`,
          name: clean,
          manager: clean === state.sector ? state.manager : undefined,
          color: SECTOR_COLORS[idx % SECTOR_COLORS.length],
          activeShifts: state.shifts || ['T1', 'T2', 'T3'],
          defaultTeamLeader: clean === state.sector ? state.defaultTeamLeader : undefined,
        });
      }
    });

    // Ensure active sector is also included
    if (state.sector && state.sector.trim() && !map.has(state.sector.trim().toLowerCase())) {
      const activeClean = state.sector.trim();
      map.set(activeClean.toLowerCase(), {
        id: `sec_active_${Date.now()}`,
        name: activeClean,
        manager: state.manager,
        color: '#3b82f6',
        activeShifts: state.shifts || ['T1', 'T2', 'T3'],
        defaultTeamLeader: state.defaultTeamLeader,
      });
    }

    return Array.from(map.values());
  }, [state.sectorDefinitions, state.registeredSectors, state.sector, state.manager, state.shifts, state.defaultTeamLeader]);

  // Filtered sectors
  const filteredSectors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sectorsList;
    return sectorsList.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.manager && s.manager.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [sectorsList, searchTerm]);

  // Sector statistics
  const sectorStats = useMemo(() => {
    const stats: Record<string, { count: number; activeShiftCounts: Record<string, number> }> = {};
    sectorsList.forEach((s) => {
      stats[s.name.toLowerCase()] = { count: 0, activeShiftCounts: {} };
    });

    (state.collaborators || []).forEach((c) => {
      const sec = (c.sector || state.sector || 'Geral').trim().toLowerCase();
      if (!stats[sec]) {
        stats[sec] = { count: 0, activeShiftCounts: {} };
      }
      stats[sec].count += 1;
      const sh = c.shift || 'T2';
      stats[sec].activeShiftCounts[sh] = (stats[sec].activeShiftCounts[sh] || 0) + 1;
    });

    return stats;
  }, [sectorsList, state.collaborators, state.sector]);

  // Open modal for new sector
  const handleOpenCreateModal = () => {
    setEditingSector(null);
    setName('');
    setManager('');
    setDescription('');
    setColor(SECTOR_COLORS[sectorsList.length % SECTOR_COLORS.length]);
    setActiveShifts(state.shifts?.length ? [...state.shifts] : ['T1', 'T2', 'T3']);
    setDefaultTeamLeader(state.defaultTeamLeader || '');
    setRequirePassword(Boolean(state.requireUserPassword));
    setIsModalOpen(true);
  };

  // Open modal for editing existing sector
  const handleOpenEditModal = (sec: SectorDefinition) => {
    setEditingSector(sec);
    setName(sec.name);
    setManager(sec.manager || '');
    setDescription(sec.description || '');
    setColor(sec.color || SECTOR_COLORS[0]);
    setActiveShifts(sec.activeShifts || state.shifts || ['T1', 'T2', 'T3']);
    setDefaultTeamLeader(sec.defaultTeamLeader || '');
    setRequirePassword(Boolean(sec.requirePassword));
    setIsModalOpen(true);
  };

  const handleSaveSector = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) return;

    if (editingSector) {
      updateSectorDefinition(editingSector.id, {
        name: cleanName,
        manager: manager.trim() || undefined,
        description: description.trim() || undefined,
        color,
        activeShifts,
        defaultTeamLeader: defaultTeamLeader.trim() || undefined,
        requirePassword,
      });
    } else {
      addSectorDefinition({
        name: cleanName,
        manager: manager.trim() || undefined,
        description: description.trim() || undefined,
        color,
        activeShifts,
        defaultTeamLeader: defaultTeamLeader.trim() || undefined,
        requirePassword,
      });
    }

    setIsModalOpen(false);
  };

  const handleDeleteSector = (sec: SectorDefinition) => {
    setSectorToDelete(sec);
  };

  const handleConfirmDeleteSector = () => {
    if (!sectorToDelete) return;
    const target = sectorToDelete;
    deleteSectorDefinition(target.id);
    deleteSectorDefinition(target.name);
    removeRegisteredSector(target.name);
    setSectorToDelete(null);
  };

  const toggleShift = (shiftName: string) => {
    if (activeShifts.includes(shiftName)) {
      if (activeShifts.length === 1) return; // keep at least 1
      setActiveShifts(activeShifts.filter((s) => s !== shiftName));
    } else {
      setActiveShifts([...activeShifts, shiftName]);
    }
  };

  const collabsOfSelectedSector = useMemo(() => {
    if (!selectedSectorForCollabs) return [];
    return (state.collaborators || []).filter(
      (c) => (c.sector || state.sector || '').toLowerCase() === selectedSectorForCollabs.toLowerCase()
    );
  }, [selectedSectorForCollabs, state.collaborators, state.sector]);

  return (
    <div id="sectors-settings-panel" className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-200/50 dark:border-blue-900/40 rounded-2xl">
        <div className="flex items-start gap-3.5">
          <div className="p-3 bg-blue-600 text-white rounded-xl shadow-md shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-[var(--foreground)]">Gestão Multissetorial & Setores</h2>
              <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 rounded-full">
                Multi-Tenant
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
              Configure múltiplos setores para sua operação (ex: Recebimento, Expedição, Picking, SAC). Alterne o setor
              ativo, defina políticas de autenticação por setor e habilite suporte intersetorial.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            id="btn-add-new-sector"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Novo Setor</span>
          </button>
        </div>
      </div>

      {/* Active Sector Quick Switcher Bar */}
      <div className="p-4 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Setor Ativo no Workspace Atual
            </div>
            <div className="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
              <span>{state.sector || 'Setor Padrão'}</span>
              {state.manager && (
                <span className="text-xs font-normal text-[var(--muted)]">
                  • Gestor: <strong className="text-[var(--foreground)]">{state.manager}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="active-sector-select" className="text-xs font-medium text-[var(--muted)] shrink-0">
            Alternar Setor:
          </label>
          <select
            id="active-sector-select"
            value={state.sector || ''}
            onChange={(e) => switchActiveSector(e.target.value)}
            className="px-3 py-1.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-lg text-xs font-semibold text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            {sectorsList.map((sec) => (
              <option key={sec.id} value={sec.name}>
                {sec.name} {sec.name === state.sector ? '(Ativo)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Cross-Sector Helpdesk & Communication Feature Box */}
      <div className="p-4 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg shrink-0 mt-0.5">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-[var(--foreground)]">Suporte & Chamados Intersetoriais</div>
            <div className="text-xs text-[var(--muted)] mt-0.5">
              Permite que operadores de um setor (ex: Expedição) enviem chamados de suporte técnico para outros setores (ex: Manutenção, TI ou Liderança).
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={state.helpdeskConfig?.allowCrossSectorSupport !== false}
            onChange={(e) => updateHelpdeskConfig({ allowCrossSectorSupport: e.target.checked })}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-[var(--line)]"
          />
          <span className="text-xs font-semibold text-[var(--foreground)]">
            Habilitar Suporte Intersetorial
          </span>
        </label>
      </div>

      {/* Search Bar & List Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar setores por nome, gestor ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl text-xs text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="text-xs text-[var(--muted)] font-medium">
          {filteredSectors.length} {filteredSectors.length === 1 ? 'setor cadastrado' : 'setores cadastrados'}
        </div>
      </div>

      {/* Sectors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredSectors.map((sec) => {
          const isActive = sec.name.toLowerCase() === (state.sector || '').toLowerCase();
          const stats = sectorStats[sec.name.toLowerCase()] || { count: 0, activeShiftCounts: {} };
          const secColor = sec.color || '#3b82f6';

          return (
            <div
              key={sec.id}
              id={`sector-card-${sec.id}`}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                isActive
                  ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-400 dark:border-blue-700 shadow-xs ring-1 ring-blue-400/30'
                  : 'bg-[var(--surface-1)] border-[var(--line)] hover:border-blue-300 dark:hover:border-blue-800'
              }`}
            >
              <div>
                {/* Card Top */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                      style={{ backgroundColor: secColor }}
                    />
                    <div>
                      <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-1.5">
                        <span>{sec.name}</span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-600 text-white rounded-md">
                            Ativo
                          </span>
                        )}
                      </h3>
                      {sec.manager && (
                        <div className="text-[11px] text-[var(--muted)] flex items-center gap-1 mt-0.5">
                          <UserCheck className="w-3 h-3" />
                          <span>Gestor: <strong>{sec.manager}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Editar Setor"
                      onClick={() => handleOpenEditModal(sec)}
                      className="p-1.5 text-[var(--muted)] hover:text-blue-600 hover:bg-[var(--surface-2)] rounded-lg transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Excluir Setor"
                      onClick={() => handleDeleteSector(sec)}
                      className="p-1.5 text-[var(--muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Description */}
                {sec.description && (
                  <p className="text-xs text-[var(--muted)] line-clamp-2 mb-3 bg-[var(--surface-2)]/60 p-2 rounded-lg border border-[var(--line)]/50">
                    {sec.description}
                  </p>
                )}

                {/* Badges Info */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div
                    onClick={() => setSelectedSectorForCollabs(sec.name)}
                    className="p-2 bg-[var(--surface-2)] rounded-lg flex items-center justify-between cursor-pointer hover:bg-[var(--surface-3)] transition-colors"
                  >
                    <span className="text-[var(--muted)] flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>Equipe</span>
                    </span>
                    <strong className="text-[var(--foreground)] font-bold">{stats.count} colab.</strong>
                  </div>

                  <div className="p-2 bg-[var(--surface-2)] rounded-lg flex items-center justify-between">
                    <span className="text-[var(--muted)] flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Senha</span>
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        sec.requirePassword ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--muted)]'
                      }`}
                    >
                      {sec.requirePassword ? 'Obrigatória' : 'Livre'}
                    </span>
                  </div>
                </div>

                {/* Shifts Pills */}
                {sec.activeShifts && sec.activeShifts.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mb-3">
                    <span className="text-[10px] text-[var(--muted)] mr-1">Turnos:</span>
                    {sec.activeShifts.map((sh) => (
                      <span
                        key={sh}
                        className="px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--surface-2)] border border-[var(--line)] text-[var(--foreground)] rounded-md"
                      >
                        {sh}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-2 mt-2">
                {!isActive ? (
                  <button
                    type="button"
                    onClick={() => switchActiveSector(sec.name)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tornar Setor Ativo</span>
                  </button>
                ) : (
                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Setor Selecionado</span>
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedSectorForCollabs(sec.name)}
                  className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] font-medium flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Ver equipe</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Preset Suggestions If No Custom Sectors */}
      {sectorsList.length <= 2 && (
        <div className="p-4 bg-[var(--surface-2)] border border-dashed border-[var(--line)] rounded-xl">
          <div className="text-xs font-bold text-[var(--foreground)] mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Sugestões Rápidas de Setores Operacionais</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_SECTORS.filter((p) => !sectorsList.some((s) => s.name.toLowerCase() === p.name.toLowerCase())).map(
              (p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => {
                    addSectorDefinition({
                      name: p.name,
                      description: p.desc,
                      color: p.color,
                      activeShifts: ['T1', 'T2', 'T3'],
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-1)] hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-[var(--line)] hover:border-blue-300 text-xs font-medium text-[var(--foreground)] rounded-lg transition-all cursor-pointer text-left"
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span>+ {p.name}</span>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Sector */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-1)] border border-[var(--line)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--foreground)]">
                    {editingSector ? 'Editar Setor' : 'Cadastrar Novo Setor'}
                  </h3>
                  <p className="text-xs text-[var(--muted)]">Definição estrutural e política de acesso do setor</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--surface-2)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSector} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Nome do Setor *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Recebimento, Expedição, Picking..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl text-sm text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                    Gestor / Coordenador
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Silva"
                    value={manager}
                    onChange={(e) => setManager(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl text-xs text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                    Líder de Equipe (TL) Padrão
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Mariana Costa"
                    value={defaultTeamLeader}
                    onChange={(e) => setDefaultTeamLeader(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl text-xs text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1">
                  Descrição Operacional / Área
                </label>
                <textarea
                  rows={2}
                  placeholder="Finalidade operacional, área física ou atribuições deste setor..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl text-xs text-[var(--foreground)] focus:ring-2 focus:ring-blue-500 focus:outline-hidden resize-none"
                />
              </div>

              {/* Color Tag */}
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
                  Cor de Identificação
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {SECTOR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        color === c ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Active Shifts */}
              <div>
                <label className="block text-xs font-semibold text-[var(--foreground)] mb-1.5">
                  Turnos Ativos no Setor
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {(state.shifts?.length ? state.shifts : ['T1', 'T2', 'T3', 'T4', 'ADM']).map((sh) => {
                    const isChecked = activeShifts.includes(sh);
                    return (
                      <button
                        key={sh}
                        type="button"
                        onClick={() => toggleShift(sh)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          isChecked
                            ? 'bg-blue-600 text-white'
                            : 'bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--line)]'
                        }`}
                      >
                        {sh}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Require Password Toggle */}
              <div className="p-3 bg-[var(--surface-2)] rounded-xl flex items-center justify-between border border-[var(--line)]">
                <div>
                  <div className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    <span>Exigir Senha Obrigatória no Login</span>
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">
                    Quando ativado, colaboradores deste setor deverão digitar senha para se identificar.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={requirePassword}
                  onChange={(e) => setRequirePassword(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-[var(--line)] cursor-pointer"
                />
              </div>

              <div className="pt-3 border-t border-[var(--line)] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {editingSector ? 'Salvar Alterações' : 'Cadastrar Setor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Collaborators of Sector Drawer */}
      {selectedSectorForCollabs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-1)] border border-[var(--line)] rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--foreground)]">
                    Equipe do Setor: {selectedSectorForCollabs}
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    {collabsOfSelectedSector.length} colaboradores vinculados a este setor
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSectorForCollabs(null)}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--surface-2)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {collabsOfSelectedSector.length === 0 ? (
                <div className="text-center py-8 text-xs text-[var(--muted)]">
                  Nenhum colaborador atribuído a este setor no momento. Você pode editar o setor dos colaboradores na aba
                  de escala ou equipe.
                </div>
              ) : (
                collabsOfSelectedSector.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-[var(--surface-2)] rounded-xl flex items-center justify-between border border-[var(--line)]/50"
                  >
                    <div>
                      <div className="text-xs font-bold text-[var(--foreground)]">{c.name}</div>
                      <div className="text-[11px] text-[var(--muted)] flex items-center gap-2 mt-0.5">
                        <span>Cargo: {c.role || 'Operador'}</span>
                        <span>•</span>
                        <span>Turno: {c.shift || 'T2'}</span>
                        {c.teamLeader && (
                          <>
                            <span>•</span>
                            <span>TL: {c.teamLeader}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 rounded-full">
                      {selectedSectorForCollabs}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--surface-2)]/50 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSectorForCollabs(null)}
                className="px-4 py-2 text-xs font-semibold bg-[var(--surface-1)] border border-[var(--line)] text-[var(--foreground)] rounded-xl hover:bg-[var(--surface-3)] transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Sector */}
      {sectorToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-[var(--surface-1)] border border-red-200 dark:border-red-900/60 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-lg">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--foreground)]">Excluir Setor</h3>
                  <p className="text-xs text-[var(--muted)]">Confirmação de exclusão</p>
                </div>
              </div>
              <button
                onClick={() => setSectorToDelete(null)}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--surface-2)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-[var(--foreground)] leading-relaxed">
                Tem certeza que deseja excluir o setor{' '}
                <strong className="text-red-600 dark:text-red-400 font-bold">"{sectorToDelete.name}"</strong>?
              </p>

              {(() => {
                const count = (state.collaborators || []).filter(
                  (c) => (c.sector || state.sector || '').toLowerCase() === sectorToDelete.name.toLowerCase()
                ).length;
                if (count > 0) {
                  return (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300">
                      <strong>Aviso:</strong> Existem {count} colaborador(es) associados a este setor. Eles serão
                      mantidos no sistema e poderão ser reatribuídos para outros setores.
                    </div>
                  );
                }
                return null;
              })()}

              {sectorToDelete.name.toLowerCase() === (state.sector || '').toLowerCase() && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-blue-800 dark:text-blue-300">
                  Este é o setor atualmente ativo na operação. Ao excluí-lo, o sistema alternará automaticamente para o
                  próximo setor disponível.
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-[var(--line)] bg-[var(--surface-2)]/50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSectorToDelete(null)}
                className="px-4 py-2 text-xs font-semibold bg-[var(--surface-1)] border border-[var(--line)] text-[var(--foreground)] rounded-xl hover:bg-[var(--surface-3)] transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSector}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Setor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
