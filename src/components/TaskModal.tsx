import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Layers,
  Sparkles,
  Briefcase,
  Tag,
  Target,
  AlertCircle,
  Check,
  Plus,
  GitBranch,
  Shield,
  Link2,
  FileText,
  Clock,
  Trash2,
} from 'lucide-react';
import { Task, TaskPriority } from '../types';
import { getValidParentOptions, getTaskPath } from '../utils/taskTreeHelpers';
import { ConfirmModal } from './ConfirmModal';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<Task> & { name: string }) => void;
  onDelete?: (taskId: string) => void;
  taskToEdit?: Task | null;
  parentTaskId?: string; // Pre-seleciona a tarefa pai ao criar subtarefa
  allTasks: Task[];
  availableRoles: string[];
  availableCategories: string[];
  availableSkills: string[];
  availableShifts: string[];
  onAddCustomSkill?: (skillName: string) => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  taskToEdit,
  parentTaskId,
  allTasks,
  availableRoles,
  availableCategories,
  availableSkills,
  availableShifts,
  onAddCustomSkill,
}) => {
  const isEditing = Boolean(taskToEdit);

  const [name, setName] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority | undefined>(undefined);
  const [minHeadcount, setMinHeadcount] = useState<string>('');
  const [maxHeadcount, setMaxHeadcount] = useState<string>('');
  const [allowedRoles, setAllowedRoles] = useState<string[]>([]);
  const [allowedCategories, setAllowedCategories] = useState<string[]>([]);
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');
  const [shift, setShift] = useState<string>('all');
  const [externalUrl, setExternalUrl] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);

  const [activeTab, setActiveTab] = useState<'geral' | 'skills_cargos' | 'dimensionamento'>('geral');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Inicializar estado ao abrir modal
  useEffect(() => {
    if (!isOpen) return;

    if (taskToEdit) {
      setName(taskToEdit.name || '');
      setParentId(taskToEdit.parentId || '');
      setPriority(taskToEdit.priority || undefined);
      setMinHeadcount(taskToEdit.minHeadcount !== undefined ? String(taskToEdit.minHeadcount) : '');
      setMaxHeadcount(taskToEdit.maxHeadcount !== undefined ? String(taskToEdit.maxHeadcount) : '');
      setAllowedRoles(taskToEdit.allowedRoles || []);
      setAllowedCategories(taskToEdit.allowedCategories || []);
      setRequiredSkills(taskToEdit.requiredSkills || []);
      setShift(taskToEdit.shift || 'all');
      setExternalUrl(taskToEdit.externalUrl || '');
      setDescription(taskToEdit.description || '');
      setActive(taskToEdit.active !== false);
    } else {
      setName('');
      setParentId(parentTaskId || '');
      setPriority(undefined);
      setMinHeadcount('');
      setMaxHeadcount('');
      setAllowedRoles([]);
      setAllowedCategories([]);
      setRequiredSkills([]);
      setShift('all');
      setExternalUrl('');
      setDescription('');
      setActive(true);
    }
    setErrorMsg(null);
    setActiveTab('geral');
  }, [isOpen, taskToEdit, parentTaskId]);

  if (!isOpen) return null;

  const validParentOptions = getValidParentOptions(allTasks, taskToEdit?.id);

  const handleToggleRole = (role: string) => {
    if (allowedRoles.includes(role)) {
      setAllowedRoles(allowedRoles.filter((r) => r !== role));
    } else {
      setAllowedRoles([...allowedRoles, role]);
    }
  };

  const handleToggleCategory = (cat: string) => {
    if (allowedCategories.includes(cat)) {
      setAllowedCategories(allowedCategories.filter((c) => c !== cat));
    } else {
      setAllowedCategories([...allowedCategories, cat]);
    }
  };

  const handleToggleSkill = (skill: string) => {
    if (requiredSkills.includes(skill)) {
      setRequiredSkills(requiredSkills.filter((s) => s !== skill));
    } else {
      setRequiredSkills([...requiredSkills, skill]);
    }
  };

  const handleAddNewSkill = () => {
    const trimmed = newSkillInput.trim();
    if (!trimmed) return;
    if (!requiredSkills.includes(trimmed)) {
      setRequiredSkills([...requiredSkills, trimmed]);
    }
    if (onAddCustomSkill && !availableSkills.includes(trimmed)) {
      onAddCustomSkill(trimmed);
    }
    setNewSkillInput('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Por favor, informe o nome da tarefa.');
      setActiveTab('geral');
      return;
    }

    const minNum = minHeadcount.trim() !== '' ? parseInt(minHeadcount, 10) : undefined;
    const maxNum = maxHeadcount.trim() !== '' ? parseInt(maxHeadcount, 10) : undefined;

    if (minNum !== undefined && (isNaN(minNum) || minNum < 0)) {
      setErrorMsg('A meta mínima de pessoas deve ser um número maior ou igual a 0.');
      setActiveTab('dimensionamento');
      return;
    }

    if (maxNum !== undefined && isNaN(maxNum)) {
      setErrorMsg('A capacidade máxima deve ser um número válido.');
      setActiveTab('dimensionamento');
      return;
    }

    if (minNum !== undefined && maxNum !== undefined && maxNum < minNum) {
      setErrorMsg('A meta máxima não pode ser menor do que a meta mínima de pessoas.');
      setActiveTab('dimensionamento');
      return;
    }

    onSave({
      name: name.trim(),
      parentId: parentId ? parentId : undefined,
      priority: priority || undefined,
      minHeadcount: minNum,
      maxHeadcount: maxNum,
      allowedRoles: allowedRoles.length > 0 ? allowedRoles : undefined,
      allowedCategories: allowedCategories.length > 0 ? allowedCategories : undefined,
      requiredSkills: requiredSkills.length > 0 ? requiredSkills : undefined,
      shift: shift !== 'all' ? shift : undefined,
      externalUrl: externalUrl.trim() || undefined,
      description: description.trim() || undefined,
      active,
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
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--line)] bg-[var(--bg)] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--primary)] text-white flex items-center justify-center font-black shadow-md shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                {isEditing ? 'Editar Tarefa / Posto' : parentTaskId ? 'Adicionar Subtarefa' : 'Cadastrar Nova Tarefa'}
              </h3>
              <p className="text-xs text-[var(--muted)] font-medium">
                {isEditing
                  ? 'Atualize hierarquia, skills requeridas, cargos e dimensionamento'
                  : 'Defina a estrutura hierárquica, requisitos de skills e capacidade'}
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

        {/* Modal Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-[var(--line)] bg-[var(--paper)] shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('geral')}
            className={`px-3 py-2 text-xs font-black rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'geral'
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-soft)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Geral & Hierarquia</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('skills_cargos')}
            className={`px-3 py-2 text-xs font-black rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'skills_cargos'
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-soft)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Skills & Requisitos</span>
            {requiredSkills.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-[var(--primary)] text-white text-[10px] rounded-full">
                {requiredSkills.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dimensionamento')}
            className={`px-3 py-2 text-xs font-black rounded-t-xl border-b-2 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              activeTab === 'dimensionamento'
                ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary-soft)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Target className="w-3.5 h-3.5" />
            <span>Dimensionamento & Meta</span>
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: GERAL & HIERARQUIA */}
          {activeTab === 'geral' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Task Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider">
                  Nome da Tarefa / Posto <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Recebimento, Separação, Conferência, Bipagem..."
                  className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)] focus:ring-2 focus:ring-[var(--primary)]"
                  autoFocus
                />
              </div>

              {/* Parent Task (Hierarchical Branching) */}
              <div className="space-y-1.5 bg-[var(--bg)] p-3.5 rounded-2xl border border-[var(--line)]">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-[var(--primary)]" />
                  <label className="block text-xs font-black text-[var(--ink)]">
                    Estrutura Hierárquica / Ramificação (Tarefa Pai)
                  </label>
                </div>
                <p className="text-[11px] text-[var(--muted)] font-medium">
                  Associe esta tarefa dentro de outra para criar ramificações (ex: <i>Recebimento ➔ Conferência</i>).
                </p>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)] focus:ring-2 focus:ring-[var(--primary)]"
                >
                  <option value="">-- Nenhuma (Tarefa Principal / Top-level) --</option>
                  {validParentOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      📁 {getTaskPath(allTasks, t.id)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority & Turno */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Operational Priority */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Prioridade Operacional</span>
                    </label>
                    <span className="text-[10px] text-[var(--muted)] font-bold">Opcional</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      type="button"
                      onClick={() => setPriority(undefined)}
                      className={`py-2 px-1 rounded-xl text-[11px] font-bold border text-center transition-all cursor-pointer ${
                        priority === undefined
                          ? 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-900 border-slate-800 shadow-2xs font-black'
                          : 'bg-[var(--bg)] text-[var(--muted)] border-[var(--line)] hover:bg-[var(--line)]'
                      }`}
                    >
                      Nenhuma
                    </button>
                    {(['baixa', 'media', 'alta'] as TaskPriority[]).map((p) => {
                      const isSelected = priority === p;
                      const colorMap = {
                        alta: isSelected
                          ? 'bg-rose-500 text-white border-rose-600 shadow-2xs font-black'
                          : 'bg-[var(--bg)] text-rose-700 dark:text-rose-300 border-[var(--line)] hover:bg-rose-50',
                        media: isSelected
                          ? 'bg-amber-500 text-white border-amber-600 shadow-2xs font-black'
                          : 'bg-[var(--bg)] text-amber-700 dark:text-amber-300 border-[var(--line)] hover:bg-amber-50',
                        baixa: isSelected
                          ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs font-black'
                          : 'bg-[var(--bg)] text-emerald-700 dark:text-emerald-300 border-[var(--line)] hover:bg-emerald-50',
                      };
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(isSelected ? undefined : p)}
                          className={`py-2 px-1 rounded-xl text-[11px] capitalize border text-center transition-all cursor-pointer ${colorMap[p]}`}
                        >
                          {p === 'alta' ? '🔴 Alta' : p === 'media' ? '🟡 Média' : '🟢 Baixa'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Turno da Tarefa */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Turno Específico</span>
                  </label>
                  <select
                    value={shift}
                    onChange={(e) => setShift(e.target.value)}
                    className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  >
                    <option value="all">Todos os Turnos (Geral)</option>
                    {availableShifts.map((s) => (
                      <option key={s} value={s}>
                        Turno {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description & External URL */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Instruções / Descrição do Posto</span>
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Instruções operacionais, procedimentos padrão ou detalhes do posto..."
                    className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)] resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[var(--primary)]" />
                    <span>Link no Sistema Externo (Opcional)</span>
                  </label>
                  <input
                    type="url"
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    placeholder="https://sistema.empresa.com/tarefas/123"
                    className="w-full p-2.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  />
                </div>
              </div>

              {/* Status Toggle (Ativa / Inativa) */}
              <div className="flex items-center justify-between p-3 bg-[var(--bg)] rounded-xl border border-[var(--line)]">
                <div>
                  <span className="text-xs font-extrabold text-[var(--ink)] block">Status do Posto</span>
                  <span className="text-[11px] text-[var(--muted)]">
                    {active ? 'Tarefa ativa e visível no dimensionamento' : 'Tarefa inativa / oculta'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: SKILLS & CARGOS / CATEGORIAS */}
          {activeTab === 'skills_cargos' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Skills Requeridas para a Tarefa */}
              <div className="bg-purple-500/5 dark:bg-purple-950/20 p-4 rounded-2xl border border-purple-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    <span className="text-xs font-black text-[var(--ink)] uppercase tracking-wider">
                      Skills Necessárias para Execução
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded-full">
                    {requiredSkills.length} selecionada(s)
                  </span>
                </div>
                <p className="text-[11px] text-[var(--muted)]">
                  O <strong>dimensionamento automático</strong> utilizará estas skills para selecionar e posicionar os
                  colaboradores capacitados neste posto.
                </p>

                {/* Input para adicionar nova skill rápida */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSkillInput}
                    onChange={(e) => setNewSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewSkill();
                      }
                    }}
                    placeholder="Adicionar skill personalizada ou buscar..."
                    className="flex-1 p-2 bg-[var(--paper)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewSkill}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>

                {/* Lista de Skills do Catálogo */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-black uppercase text-[var(--muted)]">
                    Selecione do Catálogo de Skills:
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-[var(--paper)] rounded-xl border border-[var(--line)]">
                    {availableSkills.length > 0 ? (
                      availableSkills.map((sk) => {
                        const isSelected = requiredSkills.includes(sk);
                        return (
                          <button
                            key={sk}
                            type="button"
                            onClick={() => handleToggleSkill(sk)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                                : 'bg-[var(--bg)] text-[var(--ink)] border-[var(--line)] hover:border-purple-300'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                            <span>{sk}</span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-xs text-[var(--muted)] italic p-1">Nenhuma skill cadastrada ainda.</span>
                    )}
                  </div>
                </div>

                {/* Chips selecionados */}
                {requiredSkills.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1">
                    <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-300 w-full">
                      Skills Exigidas:
                    </span>
                    {requiredSkills.map((sk) => (
                      <span
                        key={sk}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-800 rounded-lg text-[11px] font-black"
                      >
                        <span>{sk}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleSkill(sk)}
                          className="hover:text-rose-500 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Cargos Permitidos */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Cargos Permitidos (Opcional)</span>
                </label>
                <p className="text-[11px] text-[var(--muted)]">
                  Selecione quais cargos podem assumir esta tarefa. Se nenhum for selecionado, todos serão aceitos.
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--line)]">
                  {availableRoles.map((r) => {
                    const isSelected = allowedRoles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => handleToggleRole(r)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-[var(--primary)] text-white border-[var(--primary-hover)] shadow-2xs'
                            : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-[var(--primary)]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{r}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Categorias Permitidas */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-500" />
                  <span>Categorias Permitidas (Opcional)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 bg-[var(--bg)] rounded-xl border border-[var(--line)]">
                  {availableCategories.map((c) => {
                    const isSelected = allowedCategories.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleToggleCategory(c)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                            : 'bg-[var(--paper)] text-[var(--ink)] border-[var(--line)] hover:border-amber-400'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        <span>{c}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIMENSIONAMENTO & CAPACIDADE */}
          {activeTab === 'dimensionamento' && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="bg-[var(--bg)] p-4 rounded-2xl border border-[var(--line)] space-y-4">
                <div>
                  <h4 className="text-xs font-black text-[var(--ink)] uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-[var(--primary)]" />
                    <span>Metas de Headcount & Balanceamento</span>
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] mt-1">
                    Esses valores orientam o algoritmo de auto-dimensionamento a balancear a quantidade correta de
                    colaboradores por posto, evitando postos desprovidos ou superlotados.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Meta Mínima / Planejada */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-black text-[var(--ink)]">
                        Meta Mínima / Alvo de Colaboradores
                      </label>
                      <span className="text-[10px] text-[var(--muted)] font-bold">Opcional</span>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={minHeadcount}
                      onChange={(e) => setMinHeadcount(e.target.value)}
                      placeholder="Sem meta definida (opcional)"
                      className="w-full p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                    />
                    <span className="text-[10px] text-[var(--muted)] block">
                      Mínimo de pessoas necessárias (deixe em branco se não houver meta rígida)
                    </span>
                  </div>

                  {/* Limite Máximo de Vagas */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-[var(--ink)]">
                      Limite Máximo de Vagas (Opcional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={maxHeadcount}
                      onChange={(e) => setMaxHeadcount(e.target.value)}
                      placeholder="Sem limite"
                      className="w-full p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl text-xs font-bold text-[var(--ink)]"
                    />
                    <span className="text-[10px] text-[var(--muted)] block">
                      Capacidade máxima do posto físico/estação de trabalho
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer / Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[var(--line)] shrink-0 gap-2">
            <div>
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Tarefa</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
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
                <span>{isEditing ? 'Salvar Alterações' : 'Criar Tarefa'}</span>
              </button>
            </div>
          </div>
        </form>
      </motion.div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          if (taskToEdit) {
            onDelete?.(taskToEdit.id);
            onClose();
          }
        }}
        title="Excluir Tarefa"
        description={`Tem certeza que deseja excluir a tarefa "${taskToEdit?.name || ''}"? As subtarefas vinculadas se tornarão tarefas principais.`}
        confirmText="Excluir"
      />
    </div>
  );
};
