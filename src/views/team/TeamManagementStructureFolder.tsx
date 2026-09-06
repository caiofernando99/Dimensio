import React, { useState } from 'react';
import {
  Building2,
  Briefcase,
  Clock,
  Tag,
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ListChecks,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  SectionHeader,
  Button,
  Badge,
  Field,
  Input,
  Select,
  Tabs,
  EmptyState,
} from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { compareStringsBR } from '../../utils/helpers';

interface TeamManagementStructureFolderProps {
  activeSubSection?: string;
}

export const TeamManagementStructureFolder: React.FC<TeamManagementStructureFolderProps> = () => {
  const {
    state,
    setTeamInfo,
    updateShiftConfig,
    addCatalogItem,
    removeCatalogItem,
    editCatalogItem,
    setRoleType,
    addTeamLeader,
    removeTeamLeader,
    editTeamLeader,
    addRegisteredSector,
    removeRegisteredSector,
    addBreakSlot,
    updateBreakSlot,
    deleteBreakSlot,
    showNotice,
  } = useApp();

  // Sector management input
  const [newSectorInput, setNewSectorInput] = useState('');

  // TL Management inputs
  const [newTLInput, setNewTLInput] = useState('');
  const [newTLShift, setNewTLShift] = useState('T1');
  const [editingTLShift, setEditingTLShift] = useState('');

  // Shift Management inputs
  const [newShiftInput, setNewShiftInput] = useState('');
  const [newShiftStartTime, setNewShiftStartTime] = useState('');
  const [newShiftEndTime, setNewShiftEndTime] = useState('');
  const [editingShiftTime, setEditingShiftTime] = useState<{
    shift: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Catalog inline editing
  const [editingCatalogItem, setEditingCatalogItem] = useState<{
    key: 'roles' | 'categories' | 'skills' | 'leaders';
    oldVal: string;
    newVal: string;
  } | null>(null);

  // Catalog inputs
  const [newRole, setNewRole] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newSkill, setNewSkill] = useState('');

  // Breaks Management
  const [newBreakTime, setNewBreakTime] = useState('12:00');
  const [newBreakShift, setNewBreakShift] = useState('all');
  const [newBreakCapacity, setNewBreakCapacity] = useState('');
  const [breakShiftFilterTab, setBreakShiftFilterTab] = useState('all');
  const [editingBreakSlot, setEditingBreakSlot] = useState<{
    id: string;
    time: string;
    capacity?: number;
    shift?: string;
  } | null>(null);

  const colShifts = state.collaborators.map((c) => c.shift || 'Geral');
  const availableShifts = Array.from(new Set([...(state.shifts || []), ...colShifts])).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true })
  );
  if (!availableShifts.includes('Geral')) availableShifts.unshift('Geral');

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. Identificação da Gestão, Turno e Times (TLs) */}
      <Card id="team-setup" className="scroll-mt-28">
        <CardHeader
          icon={<Building2 className="w-4.5 h-4.5" />}
          title="Identificação da Gestão, Turno e Team Leaders (Times)"
          subtitle="Configure os dados principais da operação e divida as equipes por líderes (TLs) em cada turno."
        />

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Local / Unidade (CD, Planta, Filial)">
            <Input
              type="text"
              value={state.location || ''}
              onChange={(e) => setTeamInfo({ location: e.target.value })}
              placeholder="Ex.: CD Campinas, Unidade SP, Filial RJ"
            />
          </Field>
          <Field label="Nome da Operação / Equipe">
            <Input
              type="text"
              value={state.teamName}
              onChange={(e) => setTeamInfo({ teamName: e.target.value })}
              placeholder="Ex.: Operação Logística"
            />
          </Field>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Setor / Departamento">
            <Input
              type="text"
              value={state.sector}
              onChange={(e) => setTeamInfo({ sector: e.target.value })}
              placeholder="Ex.: Recebimento & Expedição"
            />
          </Field>
          <Field label="Gestor(a) Responsável">
            <Input
              type="text"
              value={state.manager}
              onChange={(e) => setTeamInfo({ manager: e.target.value })}
              placeholder="Ex.: Carlos Santos"
            />
          </Field>
          <Field label="Turno Padrão da Operação">
            <Select
              value={state.teamShift}
              onChange={(e) => setTeamInfo({ teamShift: e.target.value })}
            >
              <option value="">Selecione o turno</option>
              {(state.shifts || []).map((sh) => (
                <option key={sh} value={sh}>
                  {sh}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo de Escala">
            <div className="flex items-center gap-2 px-3 h-9 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[13px] font-bold text-[var(--ink)]">
              <span>{state.scaleType === '6x2' ? '6x2' : 'Personalizada'}</span>
              {state.scaleType === '6x2' && (
                <Badge tone="primary">{(state.scaleGroups || []).join(' / ')}</Badge>
              )}
            </div>
          </Field>
        </div>

        {/* Team Leaders (Times) Management */}
        <div className="mt-5 pt-4 border-t border-[var(--line)]">
          <SectionHeader
            icon={<Briefcase className="w-4 h-4" />}
            title="Times e Lideranças (TLs) por Turno"
            right={<Badge tone="neutral">{(state.teamLeaders || []).length} Times Cadastrados</Badge>}
          />

          <div className="flex flex-wrap items-center gap-2">
            {(state.teamLeaders || []).map((tl) => {
              const teamShift = state.teamShiftMap?.[tl] || 'T1';
              const isEditing = editingCatalogItem?.key === 'leaders' && editingCatalogItem.oldVal === tl;
              if (isEditing) {
                return (
                  <div
                    key={tl}
                    className="inline-flex items-center gap-1.5 bg-emerald-50 border border-emerald-500 rounded-lg p-1"
                  >
                    <input
                      type="text"
                      value={editingCatalogItem.newVal}
                      onChange={(e) => setEditingCatalogItem({ ...editingCatalogItem, newVal: e.target.value })}
                      className="text-xs font-bold px-1.5 py-0.5 rounded border border-emerald-400 bg-white text-slate-900 w-28"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (editingCatalogItem.newVal.trim()) {
                            editTeamLeader(
                              editingCatalogItem.oldVal,
                              editingCatalogItem.newVal.trim(),
                              editingTLShift || teamShift
                            );
                          }
                          setEditingCatalogItem(null);
                        }
                      }}
                    />
                    <select
                      value={editingTLShift || teamShift}
                      onChange={(e) => setEditingTLShift(e.target.value)}
                      className="text-xs font-extrabold px-1.5 py-0.5 rounded border border-emerald-400 bg-white text-slate-900 cursor-pointer"
                    >
                      {availableShifts.map((s) => (
                        <option key={s} value={s}>
                          Turno {s}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (editingCatalogItem.newVal.trim()) {
                          editTeamLeader(
                            editingCatalogItem.oldVal,
                            editingCatalogItem.newVal.trim(),
                            editingTLShift || teamShift
                          );
                        }
                        setEditingCatalogItem(null);
                      }}
                      className="p-1 bg-emerald-600 text-white rounded cursor-pointer hover:bg-emerald-700"
                      title="Salvar alteração"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setEditingCatalogItem(null)}
                      className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              }

              const tlCols = state.collaborators.filter(
                (c) => (c.teamLeader || state.defaultTeamLeader || 'Sem Time') === tl
              );
              const hcCount = tlCols.filter((c) => c.role !== 'TL').length;

              return (
                <Badge key={tl} tone="success" className="!px-3 !py-1 !text-xs !gap-2 !rounded-lg">
                  <span>{tl}</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-100 text-[10px] font-black">
                    Turno {teamShift}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                      hcCount > 0
                        ? 'bg-emerald-600 text-white'
                        : 'bg-emerald-300 dark:bg-emerald-800 text-emerald-950 dark:text-emerald-100'
                    }`}
                    title={`${hcCount} HC (colaboradores) de ${tlCols.length} membros no time`}
                  >
                    {hcCount} HC
                  </span>
                  <button
                    onClick={() => {
                      setEditingCatalogItem({ key: 'leaders', oldVal: tl, newVal: tl });
                      setEditingTLShift(teamShift);
                    }}
                    className="hover:text-blue-600 transition-colors p-0.5 cursor-pointer"
                    title="Editar nome e turno do Time/TL"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => removeTeamLeader(tl)}
                    className="hover:text-red-600 transition-colors p-0.5 cursor-pointer"
                    title="Remover este Time / TL"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </Badge>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 max-w-lg mt-2">
            <Input
              type="text"
              value={newTLInput}
              onChange={(e) => setNewTLInput(e.target.value)}
              placeholder="Ex: Time do TL Bruno, Time da TL Ana..."
              className="flex-1 min-w-[180px]"
            />
            <Select
              value={newTLShift}
              onChange={(e) => setNewTLShift(e.target.value)}
              className="!w-auto !h-8 !text-xs"
            >
              {availableShifts.map((s) => (
                <option key={s} value={s}>
                  Turno {s}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              icon={Plus}
              className="!bg-emerald-600 hover:!bg-emerald-700"
              onClick={() => {
                if (newTLInput.trim()) {
                  addTeamLeader(newTLInput.trim(), newTLShift);
                  setNewTLInput('');
                }
              }}
            >
              Adicionar Time
            </Button>
          </div>
        </div>

        {/* 2. Turnos Cadastrados & Horários */}
        <div id="shifts" className="mt-5 pt-4 border-t border-[var(--line)] scroll-mt-28">
          <SectionHeader
            icon={<Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
            title="Turnos Cadastrados na Operação & Horários"
            right={<Badge tone="neutral">{(state.shifts || []).length} turno(s)</Badge>}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {(state.shifts || []).map((sh) => {
              const cfg = state.shiftConfigs?.[sh];
              const hasHours = Boolean(cfg?.startTime && cfg?.endTime) || Boolean(cfg?.workHours);
              const isEditing = editingShiftTime?.shift === sh;

              return (
                <div
                  key={sh}
                  className="p-2.5 bg-[var(--paper)] border border-[var(--line)] hover:border-blue-300 dark:hover:border-blue-800 rounded-xl flex flex-col justify-between gap-2 shadow-[var(--shadow-card)] transition-all"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge tone="info">Turno {sh}</Badge>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          if (isEditing) {
                            setEditingShiftTime(null);
                          } else {
                            setEditingShiftTime({
                              shift: sh,
                              startTime: cfg?.startTime || '',
                              endTime: cfg?.endTime || '',
                            });
                          }
                        }}
                        className="p-1 rounded-md text-[var(--muted)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                        title="Configurar horário de início e fim deste turno"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          const newShifts = (state.shifts || []).filter((s) => s !== sh);
                          const newConfigs = { ...state.shiftConfigs };
                          delete newConfigs[sh];
                          setTeamInfo({ shifts: newShifts, shiftConfigs: newConfigs });
                        }}
                        className="p-1 rounded-md text-[var(--muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors cursor-pointer"
                        title="Remover este turno"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="pt-2 border-t border-[var(--line)] space-y-2 animate-in fade-in duration-150">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[10px] font-black text-[var(--muted)] mb-0.5">Início</label>
                          <input
                            type="time"
                            value={editingShiftTime.startTime}
                            onChange={(e) =>
                              setEditingShiftTime({ ...editingShiftTime, startTime: e.target.value })
                            }
                            className="w-full px-1.5 py-1 bg-[var(--bg)] border border-[var(--line)] rounded-md text-xs font-bold text-[var(--ink)]"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-[var(--muted)] mb-0.5">Fim</label>
                          <input
                            type="time"
                            value={editingShiftTime.endTime}
                            onChange={(e) =>
                              setEditingShiftTime({ ...editingShiftTime, endTime: e.target.value })
                            }
                            className="w-full px-1.5 py-1 bg-[var(--bg)] border border-[var(--line)] rounded-md text-xs font-bold text-[var(--ink)]"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1 pt-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            updateShiftConfig(sh, { startTime: undefined, endTime: undefined, workHours: undefined });
                            setEditingShiftTime(null);
                            showNotice(`Horários do Turno ${sh} removidos.`);
                          }}
                        >
                          Limpar
                        </Button>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="xs" onClick={() => setEditingShiftTime(null)}>
                            Cancelar
                          </Button>
                          <Button
                            size="xs"
                            icon={Check}
                            className="!bg-blue-600 hover:!bg-blue-700"
                            onClick={() => {
                              const s = editingShiftTime.startTime.trim();
                              const e = editingShiftTime.endTime.trim();
                              updateShiftConfig(sh, {
                                startTime: s || undefined,
                                endTime: e || undefined,
                                workHours: s && e ? `${s} às ${e}` : s || e ? `${s || ''} - ${e || ''}` : undefined,
                              });
                              setEditingShiftTime(null);
                              showNotice(`Horário do Turno ${sh} salvo com sucesso!`);
                            }}
                          >
                            Salvar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Clock className="w-3 h-3 text-[var(--muted)] shrink-0" />
                      {hasHours ? (
                        <span className="font-extrabold text-[var(--ink)]">
                          {cfg?.startTime && cfg?.endTime
                            ? `${cfg.startTime} às ${cfg.endTime}`
                            : cfg?.workHours}
                        </span>
                      ) : (
                        <span className="text-[var(--muted)] italic text-[10px]">
                          Sem horário definido (opcional)
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Shift Bar */}
          <div className="mt-3 p-3 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar Novo Turno
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="text"
                value={newShiftInput}
                onChange={(e) => setNewShiftInput(e.target.value)}
                placeholder="Nome do Turno (Ex: T1, Manhã, Noturno...)"
                className="flex-1 min-w-[160px]"
              />
              <div className="flex items-center gap-1 bg-[var(--paper)] border border-[var(--line)] rounded-lg px-2 h-8">
                <span className="text-[10px] font-bold text-[var(--muted)]">Início:</span>
                <input
                  type="time"
                  value={newShiftStartTime}
                  onChange={(e) => setNewShiftStartTime(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[var(--ink)] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1 bg-[var(--paper)] border border-[var(--line)] rounded-lg px-2 h-8">
                <span className="text-[10px] font-bold text-[var(--muted)]">Fim:</span>
                <input
                  type="time"
                  value={newShiftEndTime}
                  onChange={(e) => setNewShiftEndTime(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-[var(--ink)] focus:outline-none"
                />
              </div>
              <Button
                size="sm"
                icon={Plus}
                className="!bg-blue-600 hover:!bg-blue-700 shrink-0"
                onClick={() => {
                  const v = newShiftInput.trim();
                  if (v) {
                    const shifts = state.shifts || [];
                    const shiftConfigs = { ...(state.shiftConfigs || {}) };
                    if (!shifts.includes(v)) {
                      shifts.push(v);
                    }
                    if (newShiftStartTime || newShiftEndTime) {
                      shiftConfigs[v] = {
                        startTime: newShiftStartTime || undefined,
                        endTime: newShiftEndTime || undefined,
                        workHours:
                          newShiftStartTime && newShiftEndTime
                            ? `${newShiftStartTime} às ${newShiftEndTime}`
                            : undefined,
                      };
                    }
                    setTeamInfo({ shifts, shiftConfigs });
                    setNewShiftInput('');
                    setNewShiftStartTime('');
                    setNewShiftEndTime('');
                    showNotice(`Turno ${v} cadastrado com sucesso!`);
                  }
                }}
              >
                Adicionar Turno
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Catalogs Grid: Cargos, Categorias, Skills & Intervalos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Cargos Cadastrados */}
        <Card id="roles" className="scroll-mt-28 flex flex-col justify-between">
          <div>
            <SectionHeader
              icon={<Briefcase className="w-3.5 h-3.5 text-blue-500" />}
              title="Cargos Cadastrados"
              right={<Badge tone="neutral">{state.roles.length}</Badge>}
            />
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-[var(--muted)] font-bold px-0.5 pb-2">
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Operacional (Conta no HC)</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <span>Administrativo (Sem HC)</span>
              </span>
            </div>
            <div className="flex gap-2 mb-3">
              <Input
                type="text"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="Novo cargo..."
              />
              <Button
                size="sm"
                variant="secondary"
                icon={Plus}
                className="shrink-0 !px-2.5"
                onClick={() => {
                  if (newRole.trim()) {
                    addCatalogItem('roles', newRole.trim());
                    setNewRole('');
                  }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
              {[...state.roles].sort(compareStringsBR).map((r) => {
                const isEditing = editingCatalogItem?.key === 'roles' && editingCatalogItem.oldVal === r;
                if (isEditing) {
                  return (
                    <div
                      key={r}
                      className="inline-flex items-center gap-1 bg-[var(--primary-soft)] border border-[var(--primary)] rounded-md p-0.5"
                    >
                      <input
                        type="text"
                        value={editingCatalogItem.newVal}
                        onChange={(e) => setEditingCatalogItem({ ...editingCatalogItem, newVal: e.target.value })}
                        className="text-xs font-bold px-1 py-0.5 rounded border border-[var(--primary)] bg-white text-slate-900 w-24"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingCatalogItem.newVal.trim()) {
                              editCatalogItem('roles', editingCatalogItem.oldVal, editingCatalogItem.newVal.trim());
                            }
                            setEditingCatalogItem(null);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (editingCatalogItem.newVal.trim()) {
                            editCatalogItem('roles', editingCatalogItem.oldVal, editingCatalogItem.newVal.trim());
                          }
                          setEditingCatalogItem(null);
                        }}
                        className="p-1 bg-emerald-600 text-white rounded cursor-pointer hover:bg-emerald-700"
                        title="Salvar"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                const currentType = state.roleTypes?.[r] || (r === 'TL' ? 'administrativo' : 'operacional');
                const isOp = currentType === 'operacional';

                return (
                  <span
                    key={r}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[var(--primary-soft)] text-[var(--primary)] rounded-lg text-xs font-bold border border-[var(--primary-border)]"
                  >
                    <span>{r}</span>
                    <button
                      onClick={() => setRoleType(r, isOp ? 'administrativo' : 'operacional')}
                      className={`text-[9.5px] px-1.5 py-0.2 rounded font-black border transition-all cursor-pointer ${
                        isOp
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300'
                      }`}
                      title={
                        isOp
                          ? 'Cargo Operacional (conta no Headcount HC). Clique para alterar para Administrativo.'
                          : 'Cargo Administrativo (NÃO conta no Headcount HC). Clique para alterar para Operacional.'
                      }
                    >
                      {isOp ? 'Operacional' : 'Administrativo'}
                    </button>
                    <button
                      onClick={() => setEditingCatalogItem({ key: 'roles', oldVal: r, newVal: r })}
                      className="hover:text-blue-700 transition-colors cursor-pointer ml-0.5"
                      title="Editar cargo"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeCatalogItem('roles', r)}
                      className="hover:text-red-600 transition-colors cursor-pointer"
                      title="Remover cargo"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Categorias Cadastradas */}
        <Card id="categories" className="scroll-mt-28 flex flex-col justify-between">
          <div>
            <SectionHeader
              icon={<Tag className="w-3.5 h-3.5 text-amber-500" />}
              title="Categorias Cadastradas"
              right={<Badge tone="neutral">{state.categories.length}</Badge>}
            />
            <div className="flex gap-2 mb-3">
              <Input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nova categoria..."
              />
              <Button
                size="sm"
                variant="secondary"
                icon={Plus}
                className="shrink-0 !px-2.5"
                onClick={() => {
                  if (newCategory.trim()) {
                    addCatalogItem('categories', newCategory.trim());
                    setNewCategory('');
                  }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
              {[...state.categories].sort(compareStringsBR).map((cat) => {
                const isEditing = editingCatalogItem?.key === 'categories' && editingCatalogItem.oldVal === cat;
                if (isEditing) {
                  return (
                    <div
                      key={cat}
                      className="inline-flex items-center gap-1 bg-amber-50 border border-amber-500 rounded-md p-0.5"
                    >
                      <input
                        type="text"
                        value={editingCatalogItem.newVal}
                        onChange={(e) => setEditingCatalogItem({ ...editingCatalogItem, newVal: e.target.value })}
                        className="text-xs font-bold px-1 py-0.5 rounded border border-amber-400 bg-white text-slate-900 w-24"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingCatalogItem.newVal.trim()) {
                              editCatalogItem('categories', editingCatalogItem.oldVal, editingCatalogItem.newVal.trim());
                            }
                            setEditingCatalogItem(null);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (editingCatalogItem.newVal.trim()) {
                            editCatalogItem('categories', editingCatalogItem.oldVal, editingCatalogItem.newVal.trim());
                          }
                          setEditingCatalogItem(null);
                        }}
                        className="p-1 bg-emerald-600 text-white rounded cursor-pointer hover:bg-emerald-700"
                        title="Salvar"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                return (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100 border border-amber-300 dark:border-amber-800 rounded-lg text-xs font-bold"
                  >
                    <span>{cat}</span>
                    <button
                      onClick={() => setEditingCatalogItem({ key: 'categories', oldVal: cat, newVal: cat })}
                      className="hover:text-amber-800 transition-colors cursor-pointer"
                      title="Editar categoria"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeCatalogItem('categories', cat)}
                      className="hover:text-red-600 transition-colors cursor-pointer"
                      title="Remover categoria"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Skills & Proficiências */}
        <Card id="skills" className="scroll-mt-28 flex flex-col justify-between">
          <div>
            <SectionHeader
              icon={<Sparkles className="w-3.5 h-3.5 text-purple-500" />}
              title="Skills & Proficiências"
              right={<Badge tone="neutral">{state.skills.length}</Badge>}
            />
            <div className="flex gap-2 mb-3">
              <Input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Nova skill..."
              />
              <Button
                size="sm"
                variant="secondary"
                icon={Plus}
                className="shrink-0 !px-2.5"
                onClick={() => {
                  if (newSkill.trim()) {
                    addCatalogItem('skills', newSkill.trim());
                    setNewSkill('');
                  }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
              {[...state.skills].sort(compareStringsBR).map((s) => {
                const isEditing = editingCatalogItem?.key === 'skills' && editingCatalogItem.oldVal === s;
                if (isEditing) {
                  return (
                    <div
                      key={s}
                      className="inline-flex items-center gap-1 bg-purple-50 border border-purple-500 rounded-md p-0.5"
                    >
                      <input
                        type="text"
                        value={editingCatalogItem.newVal}
                        onChange={(e) => setEditingCatalogItem({ ...editingCatalogItem, newVal: e.target.value })}
                        className="text-xs font-bold px-1 py-0.5 rounded border border-purple-400 bg-white text-slate-900 w-24"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingCatalogItem.newVal.trim()) {
                              editCatalogItem('skills', editingCatalogItem.oldVal, editingCatalogItem.newVal.trim());
                            }
                            setEditingCatalogItem(null);
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (editingCatalogItem.newVal.trim()) {
                            editCatalogItem('skills', editingCatalogItem.oldVal, editingCatalogItem.newVal.trim());
                          }
                          setEditingCatalogItem(null);
                        }}
                        className="p-1 bg-emerald-600 text-white rounded cursor-pointer hover:bg-emerald-700"
                        title="Salvar"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  );
                }

                return (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-950 dark:bg-purple-950 dark:text-purple-100 border border-purple-300 dark:border-purple-800 rounded-lg text-xs font-bold"
                  >
                    <span>{s}</span>
                    <button
                      onClick={() => setEditingCatalogItem({ key: 'skills', oldVal: s, newVal: s })}
                      className="hover:text-purple-800 transition-colors cursor-pointer"
                      title="Editar skill"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => removeCatalogItem('skills', s)}
                      className="hover:text-red-600 transition-colors cursor-pointer"
                      title="Remover skill"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Setores Cadastrados & Conectividade Multissetorial */}
        <Card id="sectors" className="scroll-mt-28 flex flex-col justify-between">
          <div>
            <SectionHeader
              icon={<Building2 className="w-3.5 h-3.5 text-indigo-500" />}
              title="Setores da Operação (Multissetorial)"
              right={<Badge tone="neutral">{(state.registeredSectors || []).length} Setor(es)</Badge>}
            />
            <p className="text-[11px] text-[var(--muted)] pb-2">
              Permite que os colaboradores de diferentes setores se apoiem mutuamente com chamados e avisos integrados.
            </p>
            <div className="flex gap-2 mb-3">
              <Input
                type="text"
                value={newSectorInput}
                onChange={(e) => setNewSectorInput(e.target.value)}
                placeholder="Ex: Inbound, ICQA, Expedição..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newSectorInput.trim()) {
                    addRegisteredSector(newSectorInput.trim());
                    setNewSectorInput('');
                  }
                }}
              />
              <Button
                size="sm"
                variant="secondary"
                icon={Plus}
                className="shrink-0 !px-2.5"
                onClick={() => {
                  if (newSectorInput.trim()) {
                    addRegisteredSector(newSectorInput.trim());
                    setNewSectorInput('');
                  }
                }}
              />
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
              {(state.registeredSectors || []).map((sec) => (
                <span
                  key={sec}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-950 dark:bg-indigo-950 dark:text-indigo-100 border border-indigo-300 dark:border-indigo-800 rounded-lg text-xs font-bold"
                >
                  <span>{sec}</span>
                  <button
                    onClick={() => removeRegisteredSector(sec)}
                    className="hover:text-red-600 transition-colors cursor-pointer"
                    title="Remover setor"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* Horários de Intervalo de Refeição */}
        <Card id="breaks" className="scroll-mt-28 flex flex-col justify-between">
          <div>
            <SectionHeader
              icon={<Clock className="w-3.5 h-3.5 text-emerald-500" />}
              title="Horários de Intervalo de Refeição"
              right={<Badge tone="neutral">{state.breaks.length} horário(s)</Badge>}
            />

            <Tabs
              items={[
                { value: 'all', label: 'Todos', badge: state.breaks.length },
                { value: 'general', label: 'Geral', badge: state.breaks.filter((b) => !b.shift).length },
                ...(state.shifts || []).map((sh) => ({
                  value: sh,
                  label: `Turno ${sh}`,
                  badge: state.breaks.filter((b) => b.shift === sh).length,
                })),
              ]}
              value={breakShiftFilterTab}
              onChange={setBreakShiftFilterTab}
              className="max-w-full overflow-x-auto mb-2"
            />

            <div className="bg-[var(--surface-2)] p-2.5 rounded-xl border border-[var(--line)] space-y-2 mb-3">
              <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                <Plus className="w-3 h-3" /> Cadastrar Horário de Intervalo
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Field label="Horário">
                  <Input
                    type="time"
                    value={newBreakTime}
                    onChange={(e) => setNewBreakTime(e.target.value)}
                  />
                </Field>
                <Field label="Vincular a Turno">
                  <Select
                    value={newBreakShift}
                    onChange={(e) => setNewBreakShift(e.target.value)}
                  >
                    <option value="all">Todos os Turnos (Geral)</option>
                    {(state.shifts || []).map((sh) => (
                      <option key={sh} value={sh}>
                        Turno {sh}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Limite (Opcional)">
                  <Input
                    type="number"
                    min="0"
                    value={newBreakCapacity}
                    onChange={(e) => setNewBreakCapacity(e.target.value)}
                    placeholder="Sem limite"
                  />
                </Field>
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    if (newBreakTime.trim()) {
                      const cap = parseInt(newBreakCapacity, 10);
                      const shiftVal = newBreakShift === 'all' ? undefined : newBreakShift;
                      addBreakSlot(newBreakTime.trim(), isNaN(cap) || cap <= 0 ? undefined : cap, shiftVal);
                      setNewBreakCapacity('');
                      showNotice(`Horário ${newBreakTime} adicionado${shiftVal ? ` para o Turno ${shiftVal}` : ''}!`);
                    }
                  }}
                >
                  Cadastrar Horário
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {state.breaks
                .filter((b) => {
                  if (breakShiftFilterTab === 'all') return true;
                  if (breakShiftFilterTab === 'general') return !b.shift;
                  return b.shift === breakShiftFilterTab;
                })
                .map((b) => {
                  const isEditing = editingBreakSlot?.id === b.id;
                  if (isEditing) {
                    return (
                      <div
                        key={b.id}
                        className="bg-[var(--surface-2)] border border-[var(--primary)] p-2.5 rounded-xl space-y-2 col-span-1 sm:col-span-2"
                      >
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[9.5px] font-black text-[var(--muted)] mb-0.5">Horário</label>
                            <input
                              type="time"
                              value={editingBreakSlot.time}
                              onChange={(e) => setEditingBreakSlot({ ...editingBreakSlot, time: e.target.value })}
                              className="w-full p-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-bold text-[var(--ink)]"
                            />
                          </div>
                          <div>
                            <label className="block text-[9.5px] font-black text-[var(--muted)] mb-0.5">Turno</label>
                            <select
                              value={editingBreakSlot.shift || 'all'}
                              onChange={(e) =>
                                setEditingBreakSlot({
                                  ...editingBreakSlot,
                                  shift: e.target.value === 'all' ? undefined : e.target.value,
                                })
                              }
                              className="w-full p-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-bold text-[var(--ink)]"
                            >
                              <option value="all">Todos os Turnos (Geral)</option>
                              {(state.shifts || []).map((sh) => (
                                <option key={sh} value={sh}>
                                  Turno {sh}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[9.5px] font-black text-[var(--muted)] mb-0.5">Capacidade</label>
                            <input
                              type="number"
                              min="0"
                              value={editingBreakSlot.capacity || ''}
                              onChange={(e) =>
                                setEditingBreakSlot({
                                  ...editingBreakSlot,
                                  capacity: parseInt(e.target.value, 10) || undefined,
                                })
                              }
                              placeholder="Sem limite"
                              className="w-full p-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md text-xs font-bold text-[var(--ink)]"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 pt-1">
                          <Button variant="outline" size="xs" onClick={() => setEditingBreakSlot(null)}>
                            Cancelar
                          </Button>
                          <Button
                            size="xs"
                            icon={Check}
                            className="!bg-emerald-600 hover:!bg-emerald-700"
                            onClick={() => {
                              updateBreakSlot(b.id, {
                                time: editingBreakSlot.time,
                                capacity: editingBreakSlot.capacity || undefined,
                                shift: editingBreakSlot.shift || undefined,
                              });
                              setEditingBreakSlot(null);
                              showNotice('Horário de intervalo atualizado!');
                            }}
                          >
                            Salvar
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={b.id}
                      className="bg-[var(--surface-2)] border border-[var(--line)] hover:border-[var(--primary-border)] p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all shadow-2xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-[var(--ink)]">{b.time}</span>
                          {b.shift ? <Badge tone="info">Turno {b.shift}</Badge> : <Badge tone="neutral">Geral</Badge>}
                        </div>
                        <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-extrabold">
                          {b.capacity ? `Máx: ${b.capacity} pessoas` : 'Sem limite'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() =>
                            setEditingBreakSlot({
                              id: b.id,
                              time: b.time,
                              capacity: b.capacity,
                              shift: b.shift,
                            })
                          }
                          className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition-colors cursor-pointer"
                          title="Editar horário / turno / capacidade"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteBreakSlot(b.id)}
                          className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                          title="Excluir Horário"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              {state.breaks.filter((b) => {
                if (breakShiftFilterTab === 'all') return true;
                if (breakShiftFilterTab === 'general') return !b.shift;
                return b.shift === breakShiftFilterTab;
              }).length === 0 && (
                <EmptyState
                  icon={Clock}
                  title="Nenhum horário de intervalo"
                  description="Nenhum horário cadastrado para este filtro."
                  className="col-span-1 sm:col-span-2"
                />
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
