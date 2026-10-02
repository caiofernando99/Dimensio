import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  MapPin,
  Building2,
  Users,
  CalendarDays,
  Timer,
  UserPlus,
  Briefcase,
  ListChecks,
  Plus,
  Clock,
  Sparkles,
  Trash2,
  Shield,
  Check,
} from 'lucide-react';

interface OnboardingSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  { id: 'identification', label: 'Operação', icon: MapPin },
  { id: 'shifts', label: 'Turnos', icon: Timer },
  { id: 'scale', label: 'Escala', icon: CalendarDays },
  { id: 'teams', label: 'Times / TL', icon: Users },
  { id: 'catalogs', label: 'Cargos & Tarefas', icon: Briefcase },
  { id: 'collaborators', label: 'Colaboradores', icon: UserPlus },
];

export const OnboardingSetupWizard: React.FC<OnboardingSetupWizardProps> = ({ isOpen, onClose }) => {
  const { state, setTeamInfo, addTeamLeader, removeTeamLeader, addCatalogItem, removeCatalogItem, addTask, addBreakSlot, addCollaborator, deleteCollaborator, applySuggestedScaleCalendar, setSetupCompleted, showNotice } = useApp();

  const [step, setStep] = useState(0);

  const [location, setLocation] = useState(state.location || '');
  const [sector, setSector] = useState(state.sector || '');
  const [teamName, setTeamName] = useState(state.teamName || '');
  const [manager, setManager] = useState(state.manager || '');

  const [draftShifts, setDraftShifts] = useState<string[]>(state.shifts || []);
  const [shiftInput, setShiftInput] = useState('');

  const [scaleType, setScaleType] = useState<'6x2' | 'custom'>(state.scaleType || '6x2');
  const [scaleGroups, setScaleGroups] = useState<string[]>(state.scaleGroups || []);
  const [groupInput, setGroupInput] = useState('');

  const [tlInput, setTlInput] = useState('');

  const [cargoInput, setCargoInput] = useState('');
  const [categoriaInput, setCategoriaInput] = useState('');
  const [taskInput, setTaskInput] = useState('');
  const [breakInput, setBreakInput] = useState('');

  const [newColName, setNewColName] = useState('');
  const [newColShift, setNewColShift] = useState('');
  const [newColScale, setNewColScale] = useState('');
  const [newColRole, setNewColRole] = useState('');
  const [newColCategory, setNewColCategory] = useState('');
  const [newColTeam, setNewColTeam] = useState('');
  const [newColSkills, setNewColSkills] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setLocation(state.location || '');
      setSector(state.sector || '');
      setTeamName(state.teamName || '');
      setManager(state.manager || '');
      setDraftShifts(state.shifts || []);
      setShiftInput('');
      setScaleType(state.scaleType || '6x2');
      setScaleGroups(state.scaleGroups || []);
      setGroupInput('');
      setTlInput('');
      setCargoInput('');
      setCategoriaInput('');
      setTaskInput('');
      setBreakInput('');
      setNewColName('');
      setNewColShift('');
      setNewColScale('');
      setNewColRole('');
      setNewColCategory('');
      setNewColTeam('');
      setNewColSkills('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const totalSteps = STEPS.length;
  const isLast = step === totalSteps - 1;
  const currentStep = STEPS[step];

  const canProceed = () => {
    if (step === 0) return location.trim().length > 0 && sector.trim().length > 0;
    if (step === 1) return draftShifts.length >= 1;
    if (step === 2) return scaleGroups.length >= 1;
    if (step === 3) return (state.teamLeaders || []).length >= 1;
    return true;
  };

  const handleAddShift = () => {
    const v = shiftInput.trim();
    if (v && !draftShifts.includes(v)) {
      setDraftShifts([...draftShifts, v]);
      setShiftInput('');
    }
  };

  const handleAddGroup = () => {
    const v = groupInput.trim().toUpperCase();
    if (v && !scaleGroups.includes(v)) {
      setScaleGroups([...scaleGroups, v]);
      setGroupInput('');
    }
  };

  const handleAddTl = () => {
    const v = tlInput.trim();
    if (v) {
      addTeamLeader(v);
      setTlInput('');
    }
  };

  const handleAddCargo = () => {
    const v = cargoInput.trim();
    if (v) {
      addCatalogItem('roles', v);
      setCargoInput('');
    }
  };

  const handleAddCategoria = () => {
    const v = categoriaInput.trim();
    if (v) {
      addCatalogItem('categories', v);
      setCategoriaInput('');
    }
  };

  const handleAddTask = () => {
    const v = taskInput.trim();
    if (v) {
      addTask(v);
      setTaskInput('');
    }
  };

  const handleAddBreak = () => {
    const v = breakInput.trim();
    if (v) {
      addBreakSlot(v);
      setBreakInput('');
    }
  };

  const handleAddCollaborator = () => {
    const name = newColName.trim();
    if (!name) {
      showNotice('Informe o nome do colaborador.');
      return;
    }
    const skillsText = newColSkills.trim();
    const skills: Record<string, number> = {};
    if (skillsText) {
      skillsText.split(',').forEach((pair) => {
        const [sk, lvl] = pair.split(':');
        if (sk && sk.trim()) {
          const level = Number.parseInt(lvl, 10);
          skills[sk.trim()] = Number.isFinite(level) ? Math.min(3, Math.max(0, level)) : 1;
        }
      });
    }
    addCollaborator({
      name,
      shift: newColShift || draftShifts[0] || 'Geral',
      scale: newColScale || scaleGroups[0] || 'A',
      teamLeader: newColTeam || state.teamLeaders?.[0] || state.defaultTeamLeader || undefined,
      role: newColRole || state.roles[0] || 'Operador',
      category: newColCategory || state.categories[0] || 'Inbound',
      skills,
    });
    setNewColName('');
    setNewColSkills('');
  };

  const hcCountForTeam = (tl: string) =>
    state.collaborators.filter((c) => (c.teamLeader || 'Sem Time') === tl && c.role !== 'TL').length;

  const handleFinish = () => {
    setTeamInfo({
      location,
      sector,
      teamName,
      manager,
      shifts: draftShifts,
      teamShift: draftShifts[0] || state.teamShift,
      scaleType,
      scaleGroups,
    });
    setSetupCompleted(true);
    showNotice('Configuração da operação concluída com sucesso!');
    onClose();
  };

  const inputCls =
    'flex-1 p-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-semibold text-[var(--ink)]';
  const addBtnCls =
    'px-3 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black rounded-lg flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer';
  const chipCls =
    'inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold border shadow-2xs';

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[var(--muted)]">
              Identifique a sua operação. Essas informações aparecem nos resumos, relatórios e no briefing do dia.
            </p>
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Local / Unidade / CD *
              </label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: CD Santos, Unidade Campinas, Loja Centro..." className={inputCls} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                <Building2 className="w-3 h-3" /> Setor *
              </label>
              <input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ex: Logística, Atendimento, Almoxarifado..." className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">Nome do Time</label>
                <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Ex: Turno 2 Logística" className={inputCls} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">Gestor Responsável</label>
                <input value={manager} onChange={(e) => setManager(e.target.value)} placeholder="Ex: Carlos Pereira" className={inputCls} />
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[var(--muted)]">
              Cadastre os turnos da operação (ex: T1, T2, T3, Manhã, Tarde, Noite). É preciso ter pelo menos um turno.
            </p>
            <div className="flex flex-wrap gap-2">
              {draftShifts.map((sh) => (
                <span key={sh} className={`${chipCls} bg-blue-100 text-blue-950 dark:bg-blue-950 dark:text-blue-100 border-blue-300 dark:border-blue-800`}>
                  Turno {sh}
                  <button onClick={() => setDraftShifts(draftShifts.filter((s) => s !== sh))} className="hover:text-red-600 transition-colors cursor-pointer" title="Remover turno">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input value={shiftInput} onChange={(e) => setShiftInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddShift(); }} placeholder="Ex: T1, Manhã, Noite..." className={inputCls} />
              <button onClick={handleAddShift} className={addBtnCls}>
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-[var(--muted)]">
              Escolha o tipo de escala da operação. A escala define o padrão de folga de cada turma no calendário.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => setScaleType('6x2')}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${scaleType === '6x2' ? 'border-[var(--primary)] bg-[var(--primary-soft)]' : 'border-[var(--line)] bg-[var(--bg)]'}`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${scaleType === '6x2' ? 'text-[var(--primary)]' : 'text-[var(--muted)]'}`} />
                  <span className="text-xs font-black text-[var(--ink)]">Escala 6x2</span>
                </div>
                <p className="text-[11px] text-[var(--muted)] mt-1 leading-relaxed">
                  Ciclo de 6 dias trabalhados e 2 de folga. O aplicativo pode preencher o calendário automaticamente com a escala sugerida.
                </p>
              </button>
              <button
                onClick={() => setScaleType('custom')}
                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${scaleType === 'custom' ? 'border-[var(--primary)] bg-[var(--primary-soft)]' : 'border-[var(--line)] bg-[var(--bg)]'}`}
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className={`w-4 h-4 ${scaleType === 'custom' ? 'text-[var(--primary)]' : 'text-[var(--muted)]'}`} />
                  <span className="text-xs font-black text-[var(--ink)]">Outra Escala</span>
                </div>
                <p className="text-[11px] text-[var(--muted)] mt-1 leading-relaxed">
                  Escalas 5x2, 4x2 ou customizadas. Você deverá preencher ou importar o calendário de folgas manualmente.
                </p>
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">Turmas / Grupos de Escala</label>
              <div className="flex flex-wrap gap-2">
                {scaleGroups.map((g) => (
                  <span key={g} className={`${chipCls} bg-indigo-100 text-indigo-950 dark:bg-indigo-950 dark:text-indigo-100 border-indigo-300 dark:border-indigo-800`}>
                    Turma {g}
                    <button onClick={() => setScaleGroups(scaleGroups.filter((x) => x !== g))} className="hover:text-red-600 transition-colors cursor-pointer" title="Remover turma">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input value={groupInput} onChange={(e) => setGroupInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddGroup(); }} placeholder="Ex: A, B, C..." className={inputCls} />
                <button onClick={handleAddGroup} className={addBtnCls}>
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>
            </div>

            {scaleType === '6x2' ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <p className="text-[11px] text-emerald-900 dark:text-emerald-100 font-semibold flex-1">
                  Ao concluir, o calendário de {state.year} será preenchido automaticamente com a escala 6x2 sugerida.
                </p>
                <button
                  onClick={() => applySuggestedScaleCalendar(state.year)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black rounded-lg cursor-pointer shrink-0"
                >
                  Aplicar agora
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-900 dark:text-amber-100 font-semibold leading-relaxed">
                  Para escalas personalizadas, preencha ou importe o calendário de folgas na tela{' '}
                  <span className="font-black">Calendário</span>. Sem o calendário preenchido, os colaboradores aparecerão como trabalhando todos os dias.
                </p>
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-[var(--muted)]">
              Cadastre os Times e seus Team Leaders (gestores). É preciso ter pelo menos um time. Lembre-se: na sua operação, o TL não conta como HC.
            </p>
            <div className="flex flex-wrap gap-2">
              {(state.teamLeaders || []).map((tl) => (
                <span key={tl} className={`${chipCls} bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100 border-emerald-300 dark:border-emerald-800`}>
                  <Users className="w-3.5 h-3.5" />
                  {tl}
                  <span className="px-1.5 py-0.5 rounded bg-[var(--paper)] text-[10px] font-mono font-bold text-[var(--muted)]">
                    {hcCountForTeam(tl)} HC
                  </span>
                  <button onClick={() => removeTeamLeader(tl)} className="hover:text-red-600 transition-colors cursor-pointer" title="Remover time">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input value={tlInput} onChange={(e) => setTlInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddTl(); }} placeholder="Ex: Time do TL Bruno, Time da TL Ana..." className={inputCls} />
              <button onClick={handleAddTl} className={addBtnCls}>
                <Plus className="w-3.5 h-3.5" /> Adicionar Time
              </button>
            </div>
            <p className="text-[11px] text-[var(--muted)] bg-[var(--bg)] border border-[var(--line)] rounded-lg p-2.5 leading-relaxed">
              O contador <span className="font-black">HC</span> de cada time já exclui o TL. Ao vincular colaboradores ao time, o total é atualizado automaticamente na tela de Equipe.
            </p>
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-[var(--muted)]">
              Cadastre os cargos, categorias, tarefas e horários de intervalo da operação.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">Cargos</label>
                <div className="flex flex-wrap gap-1.5">
                  {(state.roles || []).map((r) => (
                    <span key={r} className={`${chipCls} bg-slate-100 dark:bg-slate-800 text-[var(--ink)] border-[var(--line)]`}>
                      {r}
                      <button onClick={() => removeCatalogItem('roles', r)} className="hover:text-red-600 transition-colors cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input value={cargoInput} onChange={(e) => setCargoInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddCargo(); }} placeholder="Ex: Operador de Processo" className={inputCls} />
                  <button onClick={handleAddCargo} className={addBtnCls}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)]">Categorias</label>
                <div className="flex flex-wrap gap-1.5">
                  {(state.categories || []).map((c) => (
                    <span key={c} className={`${chipCls} bg-fuchsia-100 text-fuchsia-950 dark:bg-fuchsia-950 dark:text-fuchsia-100 border-fuchsia-300 dark:border-fuchsia-800`}>
                      {c}
                      <button onClick={() => removeCatalogItem('categories', c)} className="hover:text-red-600 transition-colors cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input value={categoriaInput} onChange={(e) => setCategoriaInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddCategoria(); }} placeholder="Ex: Inbound, Outbound" className={inputCls} />
                  <button onClick={handleAddCategoria} className={addBtnCls}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                  <ListChecks className="w-3 h-3" /> Tarefas / Postos
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(state.tasks || []).map((t) => (
                    <span key={t.id} className={`${chipCls} bg-teal-100 text-teal-950 dark:bg-teal-950 dark:text-teal-100 border-teal-300 dark:border-teal-800`}>
                      <ListChecks className="w-3 h-3" />
                      {t.name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input value={taskInput} onChange={(e) => setTaskInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); }} placeholder="Ex: Apoio GDM, Caixa, Recepção..." className={inputCls} />
                  <button onClick={handleAddTask} className={addBtnCls}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Horários de Intervalo
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {(state.breaks || []).map((b) => (
                    <span key={b.id} className={`${chipCls} bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100 border-orange-300 dark:border-orange-800`}>
                      {b.time}
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input value={breakInput} onChange={(e) => setBreakInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleAddBreak(); }} placeholder="Ex: 20:00" className={inputCls} />
                  <button onClick={handleAddBreak} className={addBtnCls}>
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-[var(--muted)]">
              Adicione os colaboradores da operação. Você poderá cadastrar o restante depois, na tela de Equipe.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Nome do colaborador" className={inputCls} />
              <select value={newColShift} onChange={(e) => setNewColShift(e.target.value)} className={inputCls}>
                <option value="">Turno: {draftShifts[0] || 'Geral'}</option>
                {draftShifts.map((s) => (
                  <option key={s} value={s}>Turno {s}</option>
                ))}
              </select>
              <select value={newColScale} onChange={(e) => setNewColScale(e.target.value)} className={inputCls}>
                <option value="">Escala: {scaleGroups[0] || 'A'}</option>
                {scaleGroups.map((g) => (
                  <option key={g} value={g}>Turma {g}</option>
                ))}
              </select>
              <select value={newColRole} onChange={(e) => setNewColRole(e.target.value)} className={inputCls}>
                <option value="">Cargo: {(state.roles[0] || 'Operador')}</option>
                {(state.roles || []).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select value={newColCategory} onChange={(e) => setNewColCategory(e.target.value)} className={inputCls}>
                <option value="">Categoria: {(state.categories[0] || 'Inbound')}</option>
                {(state.categories || []).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select value={newColTeam} onChange={(e) => setNewColTeam(e.target.value)} className={inputCls}>
                <option value="">Time: {(state.teamLeaders?.[0] || state.defaultTeamLeader || 'Sem Time')}</option>
                {(state.teamLeaders || []).map((tl) => (
                  <option key={tl} value={tl}>{tl}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input value={newColSkills} onChange={(e) => setNewColSkills(e.target.value)} placeholder="Skills opcionais: ex: Embarque:2, Checkout:1" className={inputCls} />
              <button onClick={handleAddCollaborator} className={addBtnCls}>
                <UserPlus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {state.collaborators.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-[10px] font-black flex items-center justify-center shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-[var(--ink)] truncate">{c.name}</div>
                      <div className="text-[10px] text-[var(--muted)] font-semibold truncate">
                        {c.role} · {c.shift || 'Geral'} · Turma {c.scale} · {c.teamLeader || 'Sem Time'}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => deleteCollaborator(c.id)} className="p-1.5 text-[var(--muted)] hover:text-red-600 rounded-lg transition-colors cursor-pointer shrink-0" title="Remover colaborador">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-5 border-b border-[var(--line)] bg-[var(--bg)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-[var(--primary)] tracking-wider">
                  Configuração da Operação
                </span>
                <h3 className="text-base font-extrabold text-[var(--ink)] leading-snug">Configurar minha escala</h3>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)] rounded-lg transition-colors cursor-pointer" title="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 mt-4">
            {STEPS.map((s, i) => {
              const IconComp = s.icon;
              const active = i === step;
              const done = i < step;
              return (
                <div key={s.id} className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-black transition-all ${active ? 'bg-[var(--primary)] text-white' : done ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'bg-[var(--bg)] text-[var(--muted)]'}`}>
                  {done ? <Check className="w-3 h-3" /> : <IconComp className="w-3 h-3" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1">{renderStep()}</div>

        <div className="p-4 border-t border-[var(--line)] bg-[var(--bg)] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-[11px] font-bold text-[var(--muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
          >
            Fechar e configurar depois
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-3.5 py-2 border border-[var(--line)] text-xs font-black rounded-xl hover:bg-[var(--bg)] text-[var(--ink)] flex items-center gap-1 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Voltar
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-black rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              >
                Avançar <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Concluir Configuração
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
