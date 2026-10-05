import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X,
  UserPlus,
  User,
  Sparkles,
  Briefcase,
  Tag,
  Clock,
  Calendar,
  Link2,
  FileText,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Award,
  Camera,
  Image as ImageIcon,
  Scan,
} from 'lucide-react';
import { Collaborator, ShiftGroup } from '../types';
import { Avatar } from './ui/Avatar';

interface CollaboratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (collabData: Partial<Collaborator> & { name: string }) => void;
  collabToEdit?: Collaborator | null;
  availableShifts: string[];
  availableTeamLeaders: string[];
  availableRoles: string[];
  availableCategories: string[];
  availableSkills: string[];
  availableScaleGroups?: string[];
  availableSectors?: string[];
  teamShiftMap?: Record<string, string>;
  defaultShift?: string;
  defaultTeamLeader?: string;
  onAddCustomSkill?: (skillName: string) => void;
  onAddCustomRole?: (roleName: string) => void;
  onAddCustomCategory?: (catName: string) => void;
}

export const CollaboratorModal: React.FC<CollaboratorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  collabToEdit,
  availableShifts,
  availableTeamLeaders,
  availableRoles,
  availableCategories,
  availableSkills,
  availableScaleGroups,
  availableSectors = [],
  teamShiftMap,
  defaultShift,
  defaultTeamLeader,
  onAddCustomSkill,
  onAddCustomRole,
  onAddCustomCategory,
}) => {
  const isEditing = Boolean(collabToEdit);

  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [registration, setRegistration] = useState('');
  const [shift, setShift] = useState('T1');
  const [scale, setScale] = useState<string>('A');
  const [teamLeader, setTeamLeader] = useState('');
  const [role, setRole] = useState('');
  const [category, setCategory] = useState('');
  const [sector, setSector] = useState('');
  const [canProvideCrossSectorSupport, setCanProvideCrossSectorSupport] = useState(false);
  const [allowedSectors, setAllowedSectors] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [companyProfileUrl, setCompanyProfileUrl] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [useCompanyPhoto, setUseCompanyPhoto] = useState(false);
  const [companyPhotoSelector, setCompanyPhotoSelector] = useState('');

  // Skills state: skillName -> level (1: Iniciante, 2: Autônomo, 3: Multiplicador)
  const [skills, setSkills] = useState<Record<string, number>>({});
  const [selectedSkillToAdd, setSelectedSkillToAdd] = useState('');
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<number>(1);
  const [customSkillInput, setCustomSkillInput] = useState('');

  const [activeTab, setActiveTab] = useState<'geral' | 'skills' | 'outros'>('geral');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize or reset form state strictly when modal opens or target collaborator ID changes
  useEffect(() => {
    if (!isOpen) return;

    if (collabToEdit) {
      setName(collabToEdit.name || '');
      setLogin(collabToEdit.login || '');
      setRegistration(collabToEdit.registration || '');
      setShift(collabToEdit.shift || (teamShiftMap?.[collabToEdit.teamLeader || ''] ) || defaultShift || availableShifts[0] || 'Geral');
      setScale(collabToEdit.scale || (availableScaleGroups && availableScaleGroups.length > 0 ? availableScaleGroups[0] : 'A'));
      setTeamLeader(collabToEdit.teamLeader || availableTeamLeaders[0] || defaultTeamLeader || 'Sem Time');
      setRole(collabToEdit.role || availableRoles[0] || 'Operador de Processo');
      setCategory(collabToEdit.category || availableCategories[0] || 'Inbound');
      setSector(collabToEdit.sector || availableSectors[0] || 'Operação');
      setCanProvideCrossSectorSupport(Boolean(collabToEdit.canProvideCrossSectorSupport));
      setAllowedSectors(collabToEdit.allowedSectors || []);
      setNotes(collabToEdit.notes || '');
      setCompanyProfileUrl(collabToEdit.companyProfileUrl || collabToEdit.profileUrl || '');
      setPhotoUrl(collabToEdit.photoUrl || '');
      setUseCompanyPhoto(Boolean(collabToEdit.useCompanyPhoto));
      setCompanyPhotoSelector(collabToEdit.companyPhotoSelector || '');
      setSkills(collabToEdit.skills ? { ...collabToEdit.skills } : {});
    } else {
      setName('');
      setLogin('');
      setRegistration('');
      setShift(defaultShift || availableShifts[0] || 'Geral');
      setScale(availableScaleGroups && availableScaleGroups.length > 0 ? availableScaleGroups[0] : 'A');
      setTeamLeader(defaultTeamLeader || availableTeamLeaders[0] || 'Sem Time');
      setRole(availableRoles[0] || 'Operador de Processo');
      setCategory(availableCategories[0] || 'Inbound');
      setSector(availableSectors[0] || 'Operação');
      setCanProvideCrossSectorSupport(false);
      setAllowedSectors([]);
      setNotes('');
      setCompanyProfileUrl('');
      setPhotoUrl('');
      setUseCompanyPhoto(false);
      setCompanyPhotoSelector('');
      setSkills({});
    }

    setSelectedSkillToAdd('');
    setSelectedSkillLevel(1);
    setCustomSkillInput('');
    setErrorMsg(null);
    setActiveTab('geral');
  }, [isOpen, collabToEdit?.id]);

  if (!isOpen) return null;

  // Sorted catalogs for alphabetical display
  const sortedShifts = [...availableShifts].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const sortedScaleGroups = [...(availableScaleGroups || [])].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  const sortedTeamLeaders = [...availableTeamLeaders].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const sortedRoles = [...availableRoles].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const sortedCategories = [...availableCategories].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const sortedSkills = [...availableSkills].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const handleAddSkill = () => {
    const finalSkillName = customSkillInput.trim() || selectedSkillToAdd.trim();
    if (!finalSkillName) {
      setErrorMsg('Selecione ou digite o nome de uma skill para adicionar.');
      return;
    }

    if (customSkillInput.trim() && onAddCustomSkill && !availableSkills.includes(customSkillInput.trim())) {
      onAddCustomSkill(customSkillInput.trim());
    }

    setSkills({
      ...skills,
      [finalSkillName]: selectedSkillLevel,
    });

    setSelectedSkillToAdd('');
    setCustomSkillInput('');
    setSelectedSkillLevel(1);
    setErrorMsg(null);
  };

  const handleRemoveSkill = (skillName: string) => {
    const updated = { ...skills };
    delete updated[skillName];
    setSkills(updated);
  };

  const handleSetSkillLevel = (skillName: string, level: number) => {
    setSkills({
      ...skills,
      [skillName]: level,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome do colaborador.');
      setActiveTab('geral');
      return;
    }

    onSave({
      name: name.trim(),
      login: login.trim() || undefined,
      registration: registration.trim() || undefined,
      shift: shift || 'Geral',
      scale: scale || '',
      teamLeader: teamLeader || 'Sem Time',
      role: role || (availableRoles[0] || 'Operador de Processo'),
      category: category || (availableCategories[0] || 'Inbound'),
      sector: sector.trim() || undefined,
      canProvideCrossSectorSupport,
      allowedSectors: allowedSectors.length > 0 ? allowedSectors : undefined,
      notes: notes.trim() || undefined,
      companyProfileUrl: companyProfileUrl.trim() || undefined,
      profileUrl: companyProfileUrl.trim() || undefined,
      photoUrl: photoUrl.trim() || undefined,
      useCompanyPhoto: useCompanyPhoto || undefined,
      companyPhotoSelector: companyPhotoSelector.trim() || undefined,
      skills: Object.keys(skills).length > 0 ? skills : undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[var(--paper)] border border-[var(--line)] rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-[var(--ink)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] bg-[var(--bg)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-black shadow-md shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                {isEditing ? `Editar Colaborador: ${collabToEdit?.name}` : 'Cadastrar Novo Colaborador'}
              </h3>
              <p className="text-xs text-[var(--muted)] font-medium">
                Gerencie dados pessoais, turno, escala, cargo e matriz de habilidades
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--line)] rounded-xl text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-[var(--line)] bg-[var(--paper)] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('geral')}
            className={`px-3 py-2 text-xs font-black rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'geral'
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-soft)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Dados Principais</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('skills')}
            className={`px-3 py-2 text-xs font-black rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'skills'
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-soft)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>Matriz de Skills</span>
            {Object.keys(skills).length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-purple-600 text-white text-[10px] rounded-full">
                {Object.keys(skills).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('outros')}
            className={`px-3 py-2 text-xs font-black rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'outros'
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-soft)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Perfil & Observações</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: DADOS PRINCIPAIS */}
          {activeTab === 'geral' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do colaborador..."
                  className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)] focus:ring-2 focus:ring-[var(--primary)]"
                  autoFocus
                />
              </div>

              {/* Login & Matrícula */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider">
                    Login / Usuário
                  </label>
                  <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="Ex: joao.silva"
                    className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider">
                    Matrícula / ID RH
                  </label>
                  <input
                    type="text"
                    value={registration}
                    onChange={(e) => setRegistration(e.target.value)}
                    placeholder="Ex: 123456"
                    className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  />
                </div>
              </div>

              {/* Turno, Escala & Líder (TL) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Turno</span>
                  </label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  >
                    {sortedShifts.map((s) => (
                      <option key={s} value={s}>
                        Turno {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Turma</span>
                  </label>
                  <select
                    value={scale}
                    onChange={(e) => setScale(e.target.value)}
                    className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  >
                    <option value="">Selecione a turma{sortedScaleGroups.length === 0 ? ' (cadastre turmas no Calendário)' : ''}</option>
                    {sortedScaleGroups.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider">
                    Time / Team Leader
                  </label>
                  <select
                    value={teamLeader}
                    onChange={(e) => setTeamLeader(e.target.value)}
                    className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  >
                    <option value="Sem Time">Sem Time / Geral</option>
                    {sortedTeamLeaders.map((tl) => (
                      <option key={tl} value={tl}>
                        {tl}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Cargo & Categoria */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Cargo</span>
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  >
                    {sortedRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-amber-500" />
                    <span>Categoria</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  >
                    {sortedCategories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Setor & Suporte Multissetorial */}
              <div className="p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-2xl space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                    <span>Setor de Origem / Lotação</span>
                  </label>
                  <input
                    type="text"
                    list="collaborator-sectors-list"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder="Ex: Inbound, Outbound, ICQA, Expedição..."
                    className="w-full p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  />
                  <datalist id="collaborator-sectors-list">
                    {availableSectors.map((sec) => (
                      <option key={sec} value={sec} />
                    ))}
                  </datalist>
                </div>

                <div className="pt-2 border-t border-[var(--line)] space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={canProvideCrossSectorSupport}
                      onChange={(e) => setCanProvideCrossSectorSupport(e.target.checked)}
                      className="rounded border-[var(--line)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="text-xs font-black text-[var(--ink)]">
                      Habilitar Suporte Multissetorial / Cross-Setor
                    </span>
                  </label>
                  <p className="text-[10px] text-[var(--muted)] pl-6">
                    Permite que este colaborador receba e envie pedidos de apoio ou chamados para outros setores além do seu setor principal.
                  </p>

                  {canProvideCrossSectorSupport && (
                    <div className="pl-6 pt-1 space-y-1.5">
                      <label className="block text-[10px] font-black uppercase text-[var(--muted)]">
                        Setores Autorizados para Apoio (vazio = todos):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {availableSectors.map((sec) => {
                          const isSelected = allowedSectors.includes(sec);
                          return (
                            <button
                              key={sec}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setAllowedSectors(allowedSectors.filter((s) => s !== sec));
                                } else {
                                  setAllowedSectors([...allowedSectors, sec]);
                                }
                              }}
                              className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-[var(--primary)] text-white shadow-2xs'
                                  : 'bg-[var(--paper)] text-[var(--muted)] border border-[var(--line)] hover:border-[var(--primary)]'
                              }`}
                            >
                              {sec} {isSelected && '✓'}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MATRIZ DE SKILLS */}
          {activeTab === 'skills' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="bg-purple-500/5 dark:bg-purple-950/20 p-4 rounded-2xl border border-purple-500/20 space-y-3">
                <div>
                  <h4 className="text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span>Habilidades & Proficiência do Colaborador</span>
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    Defina as competências técnicas e operacionais para que o auto dimensionamento posicione este
                    colaborador nas tarefas certas.
                  </p>
                </div>

                {/* Add Skill Control */}
                <div className="bg-[var(--paper)] p-3 rounded-xl border border-[var(--line)] space-y-2">
                  <span className="text-[10px] font-black uppercase text-[var(--muted)] block">Adicionar Habilidade:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-6">
                      <select
                        value={selectedSkillToAdd}
                        onChange={(e) => {
                          setSelectedSkillToAdd(e.target.value);
                          setCustomSkillInput('');
                        }}
                        className="w-full p-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                      >
                        <option value="">-- Escolher do Catálogo --</option>
                        {sortedSkills.map((sk) => (
                          <option key={sk} value={sk}>
                            {sk} {skills[sk] ? `(Atual: Nv ${skills[sk]})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <select
                        value={selectedSkillLevel}
                        onChange={(e) => setSelectedSkillLevel(parseInt(e.target.value, 10))}
                        className="w-full p-2 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                      >
                        <option value={1}>Nv 1 - Básico / Iniciante</option>
                        <option value={2}>Nv 2 - Intermediário / Autônomo</option>
                        <option value={3}>Nv 3 - Avançado / Multiplicador</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddSkill}
                        className="w-full h-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {/* Ou digitar nova skill */}
                  <div className="pt-1 flex items-center gap-2">
                    <span className="text-[10px] text-[var(--muted)] shrink-0">Ou criar nova:</span>
                    <input
                      type="text"
                      value={customSkillInput}
                      onChange={(e) => {
                        setCustomSkillInput(e.target.value);
                        setSelectedSkillToAdd('');
                      }}
                      placeholder="Nome da nova skill (ex: Empilhadeira Elétrica, ICQA Master)..."
                      className="flex-1 p-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-bold text-[var(--ink)]"
                    />
                  </div>
                </div>

                {/* Lista de Skills Já Atribuídas */}
                <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase text-[var(--muted)] block">
                    Skills Atribuídas ({Object.keys(skills).length}):
                  </span>

                  {Object.keys(skills).length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {Object.entries(skills).map(([skillName, level]) => (
                        <div
                          key={skillName}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--paper)] border border-[var(--line)] text-xs shadow-2xs"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="font-extrabold text-[var(--ink)] block truncate">{skillName}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              {[1, 2, 3].map((lvl) => (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => handleSetSkillLevel(skillName, lvl)}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer transition-all ${
                                    Number(level) >= lvl
                                      ? 'bg-purple-600 text-white'
                                      : 'bg-[var(--bg)] text-[var(--muted)] hover:bg-purple-100'
                                  }`}
                                  title={`Definir Nível ${lvl}`}
                                >
                                  N{lvl}
                                </button>
                              ))}
                              <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold ml-1">
                                {level === 3 ? 'Avançado' : level === 2 ? 'Autônomo' : 'Iniciante'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveSkill(skillName)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                            title="Remover Skill"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 bg-[var(--paper)] rounded-xl border border-[var(--line)] text-center text-xs text-[var(--muted)] italic">
                      Nenhuma skill associada a este colaborador ainda.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OUTROS / PERFIL */}
          {activeTab === 'outros' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Photo & Avatar Section */}
              <div className="p-4 rounded-2xl bg-[var(--bg)] border border-[var(--line)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-[var(--primary)]" />
                    <span>Foto de Perfil & Identificação Visual</span>
                  </span>
                  <Avatar name={name || 'Colaborador'} src={photoUrl} size="md" />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-extrabold text-[var(--ink)]">
                    URL Direta da Imagem / Foto
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={photoUrl}
                      onChange={(e) => setPhotoUrl(e.target.value)}
                      placeholder="https://exemplo.com/foto-perfil.jpg"
                      className="flex-1 p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                    />
                    {photoUrl && (
                      <button
                        type="button"
                        onClick={() => setPhotoUrl('')}
                        className="p-2.5 text-xs text-[var(--muted)] hover:text-red-500 bg-[var(--paper)] border border-[var(--line)] rounded-xl font-bold transition-colors"
                        title="Limpar foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--muted)]">
                    Cole o link direto da imagem JPEG/PNG. Se vazio, o sistema exibe as iniciais automaticamente.
                  </p>
                </div>

                {/* Company System Photo Option */}
                <div className="pt-2 border-t border-[var(--line)] space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCompanyPhoto}
                      onChange={(e) => setUseCompanyPhoto(e.target.checked)}
                      className="rounded border-[var(--line)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    <span className="text-xs font-black text-[var(--ink)]">
                      Usar foto do sistema / intranet da empresa
                    </span>
                  </label>

                  {useCompanyPhoto && (
                    <div className="p-3 bg-[var(--paper)] border border-[var(--line)] rounded-xl space-y-2.5 animate-in fade-in-50 duration-150">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-[var(--muted)]">
                          Link da Página do Colaborador no Sistema da Empresa:
                        </label>
                        <input
                          type="url"
                          value={companyProfileUrl}
                          onChange={(e) => setCompanyProfileUrl(e.target.value)}
                          placeholder="https://intranet.empresa.com/colaborador/123"
                          className="w-full p-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-bold text-[var(--ink)]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-[10px] font-black uppercase text-[var(--muted)] flex items-center gap-1">
                          <Scan className="w-3 h-3 text-[var(--primary)]" />
                          <span>Seletor CSS da Imagem na Página (Opcional para Extensão):</span>
                        </label>
                        <input
                          type="text"
                          value={companyPhotoSelector}
                          onChange={(e) => setCompanyPhotoSelector(e.target.value)}
                          placeholder="Ex: .avatar-image img ou #profile-photo"
                          className="w-full p-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-xs font-mono font-bold text-[var(--ink)]"
                        />
                        <span className="text-[10px] text-[var(--muted)] block">
                          A extensão do Dimensio no navegador pode capturar automaticamente a imagem do sistema usando este link e seletor.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {!useCompanyPhoto && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Link de Perfil no Sistema / Intranet / RH</span>
                  </label>
                  <input
                    type="url"
                    value={companyProfileUrl}
                    onChange={(e) => setCompanyProfileUrl(e.target.value)}
                    placeholder="https://rh.empresa.com/colaborador/123"
                    className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Observações & Anotações Internas</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Restrições operacionais, preferências de posto, observações de integração..."
                  className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)] resize-none"
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end pt-4 border-t border-[var(--line)] shrink-0 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[var(--bg)] hover:bg-[var(--line)] text-[var(--ink)] rounded-xl text-xs font-black cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white rounded-xl text-xs font-black cursor-pointer shadow-md transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar Colaborador'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
