import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SpreadsheetMappingModal } from '../components/SpreadsheetMappingModal';
import { TaskModal } from '../components/TaskModal';
import { CollaboratorModal } from '../components/CollaboratorModal';
import {
  UserPlus,
  Upload,
  Calendar,
  Plus,
  Trash2,
  Palmtree,
  Briefcase,
  Tag,
  Clock,
  Sparkles,
  Users,
  AlertTriangle,
  Archive,
  Download,
  FileSpreadsheet,
  ListChecks,
  Wand2,
  FolderTree,
  Building2,
  TrendingUp,
  SlidersHorizontal,
} from 'lucide-react';
import {
  PageHeader,
  Button,
  Badge,
  Field,
  Input,
  Select,
  Modal,
} from '../components/ui';
import { ShiftGroup, AbsenceType, Task, Collaborator } from '../types';
import { TeamManagementStructureFolder } from './team/TeamManagementStructureFolder';
import { TeamTasksAndMetricsFolder } from './team/TeamTasksAndMetricsFolder';
import { TeamCollaboratorsFolder } from './team/TeamCollaboratorsFolder';

const SHIFT_GROUPS: ShiftGroup[] = ['A', 'B', 'C', 'D'];

export type TeamFolderType = 'structure' | 'tasks' | 'collaborators';

export const TeamView: React.FC = () => {
  const {
    state,
    addCollaborator,
    updateCollaborator,
    permanentlyDeleteCollaborator,
    clearTrashBin,
    addScheduledAbsence,
    addTask,
    updateTask,
    deleteTask,
    addCatalogItem,
    setSkillLevel,
    bulkUpdateCollaborators,
    bulkSetSkillLevel,
    importRosterRows,
    showNotice,
    exportTeamRosterSpreadsheet,
    generateTemplateSpreadsheet,
  } = useApp();

  // Active Main Folder ('structure' | 'tasks' | 'collaborators')
  const [activeFolder, setActiveFolder] = useState<TeamFolderType>('structure');
  const [activeSubSection, setActiveSubSection] = useState<string>('team-setup');

  // Collaborator List Mode (Active vs Trash)
  const [collabListMode, setCollabListMode] = useState<'active' | 'trash'>('active');

  // Bulk edit selection & modal
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkField, setBulkField] = useState<
    'shift' | 'teamLeader' | 'scale' | 'role' | 'category' | 'skill' | 'skillRemove'
  >('shift');
  const [bulkShift, setBulkShift] = useState('');
  const [bulkTL, setBulkTL] = useState('');
  const [bulkScale, setBulkScale] = useState('');
  const [bulkRole, setBulkRole] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkSkill, setBulkSkill] = useState('');
  const [bulkSkillLevel, setBulkSkillLevel] = useState(1);
  const [bulkSkillIsCustom, setBulkSkillIsCustom] = useState(false);
  const [bulkCustomSkillName, setBulkCustomSkillName] = useState('');

  // Absence registration modal state
  const [absenceModalOpen, setAbsenceModalOpen] = useState(false);
  const [absenceColId, setAbsenceColId] = useState<string>('');
  const [absenceType, setAbsenceType] = useState<AbsenceType>('ferias');
  const [absenceStartDate, setAbsenceStartDate] = useState(state.selectedDate);
  const [absenceEndDate, setAbsenceEndDate] = useState(state.selectedDate);
  const [absenceNotes, setAbsenceNotes] = useState('');

  // Skill assignment modal state
  const [addSkillModalCollabId, setAddSkillModalCollabId] = useState<string | null>(null);
  const [selectedSkillName, setSelectedSkillName] = useState<string>('');
  const [isCustomSkill, setIsCustomSkill] = useState<boolean>(false);
  const [customSkillName, setCustomSkillName] = useState<string>('');
  const [selectedSkillLevel, setSelectedSkillLevel] = useState<number>(1);

  // Trash modals
  const [confirmDeletePermanentId, setConfirmDeletePermanentId] = useState<string | null>(null);
  const [confirmClearTrash, setConfirmClearTrash] = useState(false);

  // Spreadsheet mapping modal
  const [importMappingModalOpen, setImportMappingModalOpen] = useState(false);
  const [importSpreadsheetFile, setImportSpreadsheetFile] = useState<File | null>(null);

  // Task modal
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [parentTaskIdForNew, setParentTaskIdForNew] = useState<string | undefined>(undefined);

  // Collaborator modal
  const [collabModalOpen, setCollabModalOpen] = useState(false);
  const [collabToEdit, setCollabToEdit] = useState<Collaborator | null>(null);

  const colShifts = state.collaborators.map((c) => c.shift || 'Geral');
  const availableShifts = Array.from(new Set([...(state.shifts || []), ...colShifts])).sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { numeric: true })
  );
  if (!availableShifts.includes('Geral')) availableShifts.unshift('Geral');

  const handleNavigateToSection = (folder: TeamFolderType, subId: string) => {
    setActiveFolder(folder);
    setActiveSubSection(subId);

    if (subId === 'trash') {
      setCollabListMode('trash');
    } else if (subId === 'collaborators') {
      setCollabListMode('active');
    }

    // Scroll into view if rendered in the DOM
    setTimeout(() => {
      const el = document.getElementById(subId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportSpreadsheetFile(file);
    setImportMappingModalOpen(true);
    e.target.value = '';
  };

  const handleOpenCreateRootTask = () => {
    setTaskToEdit(null);
    setParentTaskIdForNew(undefined);
    setTaskModalOpen(true);
  };

  const handleOpenCreateSubtask = (parentTaskId: string) => {
    setTaskToEdit(null);
    setParentTaskIdForNew(parentTaskId);
    setTaskModalOpen(true);
  };

  const handleOpenEditTask = (task: Task) => {
    setTaskToEdit(task);
    setParentTaskIdForNew(undefined);
    setTaskModalOpen(true);
  };

  const handleSaveTaskFromModal = (taskData: Partial<Task> & { name: string }) => {
    if (taskToEdit) {
      updateTask(taskToEdit.id, taskData);
    } else {
      addTask(taskData);
    }
  };

  const handleOpenAddCollabModal = () => {
    setCollabToEdit(null);
    setCollabModalOpen(true);
  };

  const handleOpenEditCollabModal = (col: Collaborator) => {
    setCollabToEdit(col);
    setCollabModalOpen(true);
  };

  const handleSaveCollabFromModal = (collabData: Partial<Collaborator> & { name: string }) => {
    if (collabToEdit) {
      updateCollaborator(collabToEdit.id, collabData);
    } else {
      addCollaborator(collabData);
    }
  };

  const handleOpenAbsenceModal = (collabId?: string) => {
    setAbsenceColId(collabId || state.collaborators[0]?.id || '');
    setAbsenceType('ferias');
    setAbsenceStartDate(state.selectedDate);
    setAbsenceEndDate(state.selectedDate);
    setAbsenceNotes('');
    setAbsenceModalOpen(true);
  };

  const handleSaveAbsence = () => {
    if (!absenceColId) {
      showNotice('Selecione um colaborador.');
      return;
    }
    if (!absenceStartDate || !absenceEndDate) {
      showNotice('Selecione as datas de início e término.');
      return;
    }
    if (absenceEndDate < absenceStartDate) {
      showNotice('A data de término deve ser igual ou posterior à data de início.');
      return;
    }

    addScheduledAbsence(absenceColId, {
      type: absenceType,
      startDate: absenceStartDate,
      endDate: absenceEndDate,
      notes: absenceNotes,
    });

    setAbsenceModalOpen(false);
    setAbsenceNotes('');
  };

  const handleOpenAddSkillModal = (collabId: string) => {
    setAddSkillModalCollabId(collabId);
    const col = state.collaborators.find((c) => c.id === collabId);
    const unassigned = state.skills.find((s) => !(col?.skills?.[s] && col.skills[s] > 0));
    setSelectedSkillName(unassigned || state.skills[0] || '');
    setIsCustomSkill(false);
    setCustomSkillName('');
    setSelectedSkillLevel(1);
  };

  const handleAddSkillToCollab = () => {
    if (!addSkillModalCollabId) return;
    const finalSkillName = isCustomSkill ? customSkillName.trim() : selectedSkillName.trim();
    if (!finalSkillName) {
      showNotice('Por favor, informe ou selecione uma skill.');
      return;
    }

    if (isCustomSkill) {
      addCatalogItem('skills', finalSkillName);
    }

    setSkillLevel(addSkillModalCollabId, finalSkillName, selectedSkillLevel);
    setAddSkillModalCollabId(null);
    setSelectedSkillName('');
    setCustomSkillName('');
    setIsCustomSkill(false);
    setSelectedSkillLevel(1);
    showNotice(`Skill "${finalSkillName}" (Nível ${selectedSkillLevel}) vinculada.`);
  };

  const handleOpenBulkModal = (ids: string[]) => {
    setSelectedIds(ids);
    setBulkField('shift');
    setBulkShift(availableShifts[0] || 'Geral');
    setBulkTL(state.teamLeaders?.[0] || '');
    setBulkScale(state.scaleGroups?.[0] || SHIFT_GROUPS[0]);
    setBulkRole(state.roles[0] || '');
    setBulkCategory(state.categories[0] || '');
    setBulkSkill(state.skills[0] || '');
    setBulkSkillLevel(1);
    setBulkSkillIsCustom(false);
    setBulkCustomSkillName('');
    setBulkModalOpen(true);
  };

  const handleApplyBulk = () => {
    if (selectedIds.length === 0) {
      showNotice('Nenhum colaborador selecionado.');
      return;
    }
    const targetIds = selectedIds.filter((id) => state.collaborators.some((c) => c.id === id));
    if (targetIds.length === 0) {
      showNotice('Nenhum colaborador selecionado está ativo.');
      return;
    }

    switch (bulkField) {
      case 'shift':
        if (!bulkShift) return showNotice('Selecione o turno.');
        bulkUpdateCollaborators(targetIds, { shift: bulkShift });
        break;
      case 'teamLeader':
        if (!bulkTL) return showNotice('Selecione o Time / TL.');
        bulkUpdateCollaborators(targetIds, { teamLeader: bulkTL });
        break;
      case 'scale':
        if (!bulkScale) return showNotice('Selecione a Escala / Turma.');
        bulkUpdateCollaborators(targetIds, { scale: bulkScale });
        break;
      case 'role':
        if (!bulkRole) return showNotice('Selecione o Cargo.');
        bulkUpdateCollaborators(targetIds, { role: bulkRole });
        break;
      case 'category':
        if (!bulkCategory) return showNotice('Selecione a Categoria.');
        bulkUpdateCollaborators(targetIds, { category: bulkCategory });
        break;
      case 'skill': {
        const finalSkill = bulkSkillIsCustom ? bulkCustomSkillName.trim() : bulkSkill.trim();
        if (!finalSkill) return showNotice('Informe ou selecione a skill.');
        if (bulkSkillIsCustom) addCatalogItem('skills', finalSkill);
        bulkSetSkillLevel(targetIds, finalSkill, bulkSkillLevel);
        break;
      }
      case 'skillRemove': {
        const finalSkill = bulkSkill.trim();
        if (!finalSkill) return showNotice('Selecione a skill a remover.');
        bulkSetSkillLevel(targetIds, finalSkill, 0);
        break;
      }
    }

    setBulkModalOpen(false);
    setSelectedIds([]);
    showNotice(`Atualização em lote aplicada a ${targetIds.length} colaborador(es).`);
  };

  const deletedList = state.deletedCollaborators || [];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Page Header */}
      <PageHeader
        icon={Users}
        title="Gestão de Equipe, Estrutura e Cadastros"
        subtitle="Configurações Operacionais da Operação"
        actions={
          <>
            {state.collaborators.length > 0 ? (
              <Button
                size="sm"
                icon={Download}
                className="!bg-emerald-600 hover:!bg-emerald-700"
                onClick={exportTeamRosterSpreadsheet}
                title="Exportar dados da equipe para planilha CSV"
              >
                Gerar Planilha ({state.collaborators.length} .CSV)
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                icon={FileSpreadsheet}
                className="!border-emerald-500 !text-emerald-700 hover:!bg-emerald-50 dark:!text-emerald-300 dark:hover:!bg-emerald-950/40"
                onClick={generateTemplateSpreadsheet}
                title="Baixar planilha modelo (.CSV)"
              >
                Baixar Modelo (.CSV)
              </Button>
            )}
            <label className="inline-flex items-center justify-center h-8 px-3 text-xs gap-1.5 rounded-lg font-bold select-none cursor-pointer transition-all duration-150 active:scale-[0.98] bg-[var(--paper)] text-[var(--ink)] border border-[var(--line)] hover:bg-[var(--bg)]">
              <Upload className="w-3.5 h-3.5 text-[var(--muted)]" />
              <span>Importar Planilha</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </>
        }
      />

      {/* Main Content Area with Side Folder Sub-Menu */}
      <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start lg:gap-5">
        {/* Menu lateral contextual por Pastas */}
        <aside className="lg:sticky lg:top-[4.5rem]">
          <div className="bg-[var(--paper)] border border-[var(--line)] rounded-xl p-2 shadow-[var(--shadow-card)] flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
            {/* Pasta 1 Items */}
            <div className="hidden lg:flex items-center justify-between px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              <span>1. Gestão & Estrutura</span>
              {activeFolder === 'structure' && <Badge tone="primary" className="!text-[9px]">Ativa</Badge>}
            </div>
            <button
              type="button"
              onClick={() => handleNavigateToSection('structure', 'team-setup')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeFolder === 'structure' && activeSubSection === 'team-setup'
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Identificação & Times</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToSection('structure', 'shifts')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeFolder === 'structure' && activeSubSection === 'shifts'
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>Turnos & Horários</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToSection('structure', 'roles')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeFolder === 'structure' && activeSubSection === 'roles'
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              <Briefcase className="w-4 h-4 shrink-0" />
              <span>Cargos Cadastrados</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToSection('structure', 'categories')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeFolder === 'structure' && activeSubSection === 'categories'
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              <Tag className="w-4 h-4 shrink-0" />
              <span>Categorias</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToSection('structure', 'skills')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeFolder === 'structure' && activeSubSection === 'skills'
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Skills & Proficiências</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToSection('structure', 'breaks')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeFolder === 'structure' && activeSubSection === 'breaks'
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              <ListChecks className="w-4 h-4 shrink-0" />
              <span>Intervalos de Refeição</span>
            </button>

            {/* Pasta 2 Items */}
            <div className="hidden lg:flex items-center justify-between px-3 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              <span>2. Tarefas & Métricas</span>
              {activeFolder === 'tasks' && <Badge tone="primary" className="!text-[9px]">Ativa</Badge>}
            </div>
            <button
              type="button"
              onClick={() => handleNavigateToSection('tasks', 'tasks')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeFolder === 'tasks' && activeSubSection === 'tasks'
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              <FolderTree className="w-4 h-4 shrink-0" />
              <span>Postos & Tarefas</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToSection('tasks', 'metrics')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeFolder === 'tasks' && activeSubSection === 'metrics'
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              <TrendingUp className="w-4 h-4 shrink-0" />
              <span>Métricas do Setor</span>
            </button>

            {/* Pasta 3 Items */}
            <div className="hidden lg:flex items-center justify-between px-3 pt-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              <span>3. Colaboradores</span>
              {activeFolder === 'collaborators' && <Badge tone="primary" className="!text-[9px]">Ativa</Badge>}
            </div>
            <button
              type="button"
              onClick={() => handleNavigateToSection('collaborators', 'collaborators')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeFolder === 'collaborators' && collabListMode === 'active'
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Lista Ativa ({state.collaborators.length})</span>
            </button>
            <button
              type="button"
              onClick={() => handleNavigateToSection('collaborators', 'trash')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeFolder === 'collaborators' && collabListMode === 'trash'
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]'
              }`}
            >
              <Archive className="w-4 h-4 shrink-0" />
              <span>Lixeira ({deletedList.length})</span>
            </button>
          </div>
        </aside>

        {/* FOLDER DISPLAY: Render the chosen folder cleanly */}
        <div className="min-w-0">
          {activeFolder === 'structure' && (
            <TeamManagementStructureFolder activeSubSection={activeSubSection} />
          )}

          {activeFolder === 'tasks' && (
            <TeamTasksAndMetricsFolder
              onOpenCreateRootTask={handleOpenCreateRootTask}
              onOpenCreateSubtask={handleOpenCreateSubtask}
              onOpenEditTask={handleOpenEditTask}
              onDeleteTask={deleteTask}
            />
          )}

          {activeFolder === 'collaborators' && (
            <TeamCollaboratorsFolder
              onOpenAddCollabModal={handleOpenAddCollabModal}
              onOpenEditCollabModal={handleOpenEditCollabModal}
              onOpenAbsenceModal={handleOpenAbsenceModal}
              onOpenAddSkillModal={handleOpenAddSkillModal}
              onOpenBulkModal={handleOpenBulkModal}
              onConfirmDeletePermanent={(id) => setConfirmDeletePermanentId(id)}
              onConfirmClearTrash={() => setConfirmClearTrash(true)}
              initialListMode={collabListMode}
            />
          )}
        </div>
      </div>

      {/* Modal: Confirm Permanent Delete */}
      <Modal
        isOpen={!!confirmDeletePermanentId}
        onClose={() => setConfirmDeletePermanentId(null)}
        size="sm"
        icon={
          <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        }
        title="Excluir Permanentemente?"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmDeletePermanentId(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirmDeletePermanentId) {
                  permanentlyDeleteCollaborator(confirmDeletePermanentId);
                  setConfirmDeletePermanentId(null);
                }
              }}
            >
              Sim, Excluir Definitivamente
            </Button>
          </>
        }
      >
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Esta ação removerá o colaborador definitivamente do sistema e não poderá ser desfeita. Tem certeza?
        </p>
      </Modal>

      {/* Modal: Confirm Clear Trash */}
      <Modal
        isOpen={confirmClearTrash}
        onClose={() => setConfirmClearTrash(false)}
        size="sm"
        icon={
          <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        }
        title="Esvaziar Lixeira Inteira?"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setConfirmClearTrash(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                clearTrashBin();
                setConfirmClearTrash(false);
              }}
            >
              Esvaziar Lixeira Agora
            </Button>
          </>
        }
      >
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Todos os colaboradores mantidos na lixeira serão apagados permanentemente. Esta ação é irreversível.
        </p>
      </Modal>

      {/* Modal: Agendar Afastamento / Férias */}
      <Modal
        isOpen={absenceModalOpen}
        onClose={() => setAbsenceModalOpen(false)}
        size="md"
        icon={
          <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center">
            <Palmtree className="w-5 h-5" />
          </div>
        }
        title="Agendar Afastamento / Férias / Licença"
        subtitle="O sistema automaticamente desconsiderará a presença e alocação do colaborador no período selecionado."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setAbsenceModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" icon={Palmtree} onClick={handleSaveAbsence}>
              Salvar Agendamento
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Colaborador:">
            <Select value={absenceColId} onChange={(e) => setAbsenceColId(e.target.value)}>
              <option value="">Selecione um colaborador</option>
              {state.collaborators.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.role || 'Sem cargo'}) - Turno {c.shift || 'Geral'}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Tipo de Afastamento:">
            <Select value={absenceType} onChange={(e) => setAbsenceType(e.target.value as AbsenceType)}>
              <option value="ferias">Férias</option>
              <option value="licenca">Licença Médica / Outras</option>
              <option value="treinamento">Treinamento / Externo</option>
              <option value="outro">Outro Motivo</option>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de Início:">
              <Input
                type="date"
                value={absenceStartDate}
                onChange={(e) => setAbsenceStartDate(e.target.value)}
              />
            </Field>
            <Field label="Data de Término:">
              <Input
                type="date"
                value={absenceEndDate}
                onChange={(e) => setAbsenceEndDate(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Observações (Opcional):">
            <Input
              type="text"
              value={absenceNotes}
              onChange={(e) => setAbsenceNotes(e.target.value)}
              placeholder="Ex: Férias programadas 15 dias"
            />
          </Field>
        </div>
      </Modal>

      {/* Modal: Adicionar Skill ao Colaborador */}
      <Modal
        isOpen={!!addSkillModalCollabId}
        onClose={() => {
          setAddSkillModalCollabId(null);
          setSelectedSkillName('');
          setCustomSkillName('');
          setIsCustomSkill(false);
        }}
        size="md"
        icon={
          <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
        }
        title="Adicionar Skill ao Colaborador"
        subtitle={
          <>
            Colaborador:{' '}
            <strong className="text-[var(--ink)]">
              {state.collaborators.find((c) => c.id === addSkillModalCollabId)?.name}
            </strong>
          </>
        }
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAddSkillModalCollabId(null);
                setSelectedSkillName('');
                setCustomSkillName('');
                setIsCustomSkill(false);
              }}
            >
              Cancelar
            </Button>
            <Button size="sm" icon={Sparkles} onClick={handleAddSkillToCollab}>
              Vincular Skill
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Selecione a Skill / Habilidade:">
            <Select
              value={isCustomSkill ? '__custom__' : selectedSkillName}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setIsCustomSkill(true);
                  setSelectedSkillName('');
                } else {
                  setIsCustomSkill(false);
                  setSelectedSkillName(e.target.value);
                }
              }}
            >
              <option value="">-- Selecione uma Skill do Catálogo --</option>
              {state.skills.map((s) => {
                const collab = state.collaborators.find((c) => c.id === addSkillModalCollabId);
                const currentLvl = collab?.skills?.[s];
                return (
                  <option key={s} value={s}>
                    {s} {currentLvl && currentLvl > 0 ? `(Já possui: Nv ${currentLvl})` : ''}
                  </option>
                );
              })}
              <option value="__custom__">+ Outra skill (Criar nova skill)...</option>
            </Select>
          </Field>

          {isCustomSkill && (
            <Field label="Nome da Nova Skill:">
              <Input
                type="text"
                value={customSkillName}
                onChange={(e) => setCustomSkillName(e.target.value)}
                placeholder="Ex: Operador de Trator, Coletor de Dados..."
              />
            </Field>
          )}

          <Field label="Nível de Proficiência / Experiência:">
            <div className="grid grid-cols-3 gap-2">
              {[
                { level: 1, title: 'Nv 1 - Básico', desc: 'Iniciante / Treinamento' },
                { level: 2, title: 'Nv 2 - Médio', desc: 'Pleno / Autônomo' },
                { level: 3, title: 'Nv 3 - Avançado', desc: 'Especialista / Sênior' },
              ].map((item) => (
                <button
                  key={item.level}
                  type="button"
                  onClick={() => setSelectedSkillLevel(item.level)}
                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedSkillLevel === item.level
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] font-black shadow-xs'
                      : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-semibold hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold">{item.title}</div>
                  <div className="text-[10px] opacity-80 font-normal mt-0.5">{item.desc}</div>
                </button>
              ))}
            </div>
          </Field>
        </div>
      </Modal>

      {/* Modal: Bulk Edit Collaborators */}
      <Modal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        size="md"
        icon={
          <div className="w-9 h-9 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center">
            <Wand2 className="w-5 h-5" />
          </div>
        }
        title="Edição em Lote"
        subtitle={`${selectedIds.length} colaborador(es) selecionado(s)`}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setBulkModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" icon={Wand2} onClick={handleApplyBulk}>
              Aplicar em {selectedIds.length} colaborador(es)
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Informação que deseja alterar:">
            <Select
              value={bulkField}
              onChange={(e) => setBulkField(e.target.value as typeof bulkField)}
            >
              <option value="shift">Turno</option>
              <option value="teamLeader">Time / Team Leader (TL)</option>
              <option value="scale">Escala / Turma</option>
              <option value="role">Cargo</option>
              <option value="category">Categoria</option>
              <option value="skill">Adicionar Skill (com nível)</option>
              <option value="skillRemove">Remover Skill</option>
            </Select>
          </Field>

          {bulkField === 'shift' && (
            <Field label="Turno a aplicar:">
              <Select value={bulkShift} onChange={(e) => setBulkShift(e.target.value)}>
                {availableShifts.map((s) => (
                  <option key={s} value={s}>
                    Turno {s}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {bulkField === 'teamLeader' && (
            <Field label="Time / TL a aplicar:">
              <Select value={bulkTL} onChange={(e) => setBulkTL(e.target.value)}>
                {(state.teamLeaders || []).map((tl) => (
                  <option key={tl} value={tl}>
                    {tl}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {bulkField === 'scale' && (
            <Field label="Escala / Turma a aplicar:">
              <Select value={bulkScale} onChange={(e) => setBulkScale(e.target.value)}>
                {(state.scaleGroups && state.scaleGroups.length ? state.scaleGroups : SHIFT_GROUPS).map(
                  (grp) => (
                    <option key={grp} value={grp}>
                      Turma {grp}
                    </option>
                  )
                )}
              </Select>
            </Field>
          )}

          {bulkField === 'role' && (
            <Field label="Cargo a aplicar:">
              <Select value={bulkRole} onChange={(e) => setBulkRole(e.target.value)}>
                <option value="">Selecione Cargo</option>
                {state.roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {bulkField === 'category' && (
            <Field label="Categoria a aplicar:">
              <Select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
                <option value="">Selecione Categoria</option>
                {state.categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          {bulkField === 'skill' && (
            <div className="space-y-3">
              <Field label="Skill a adicionar:">
                <Select
                  value={bulkSkillIsCustom ? '__custom__' : bulkSkill}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setBulkSkillIsCustom(true);
                      setBulkSkill('');
                    } else {
                      setBulkSkillIsCustom(false);
                      setBulkSkill(e.target.value);
                    }
                  }}
                >
                  <option value="">-- Selecione uma Skill do Catálogo --</option>
                  {state.skills.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="__custom__">+ Outra skill (Criar nova)...</option>
                </Select>
              </Field>
              {bulkSkillIsCustom && (
                <Field label="Nome da nova skill:">
                  <Input
                    type="text"
                    value={bulkCustomSkillName}
                    onChange={(e) => setBulkCustomSkillName(e.target.value)}
                    placeholder="Ex: Operador de Trator, Coletor de Dados..."
                  />
                </Field>
              )}
              <Field label="Nível de Proficiência:">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { level: 1, title: 'Nv 1 - Básico', desc: 'Iniciante / Treinamento' },
                    { level: 2, title: 'Nv 2 - Médio', desc: 'Pleno / Autônomo' },
                    { level: 3, title: 'Nv 3 - Avançado', desc: 'Especialista / Sênior' },
                  ].map((item) => (
                    <button
                      key={item.level}
                      type="button"
                      onClick={() => setBulkSkillLevel(item.level)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        bulkSkillLevel === item.level
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)] font-black shadow-xs'
                          : 'border-[var(--line)] bg-[var(--bg)] text-[var(--ink)] font-semibold hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold">{item.title}</div>
                      <div className="text-[10px] opacity-80 font-normal mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {bulkField === 'skillRemove' && (
            <Field label="Skill a remover:">
              <Select value={bulkSkill} onChange={(e) => setBulkSkill(e.target.value)}>
                <option value="">-- Selecione uma Skill --</option>
                {state.skills.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <p className="text-[11px] text-[var(--muted)] bg-[var(--surface-2)] border border-[var(--line)] rounded-lg p-2.5 leading-relaxed">
            A alteração será aplicada a{' '}
            <strong className="text-[var(--ink)]">{selectedIds.length} colaborador(es)</strong> de uma só
            vez. É possível desfazer com <strong className="text-[var(--ink)]">Ctrl+Z</strong>.
          </p>
        </div>
      </Modal>

      {/* Spreadsheet Mapping Modal */}
      <SpreadsheetMappingModal
        isOpen={importMappingModalOpen}
        file={importSpreadsheetFile}
        onClose={() => {
          setImportMappingModalOpen(false);
          setImportSpreadsheetFile(null);
        }}
        onConfirmImport={(rows, options) => {
          importRosterRows(rows, options);
        }}
        defaultShift={state.teamShift || 'T2'}
        defaultTeamLeader={state.defaultTeamLeader || 'Sem Time'}
        availableShifts={state.shifts || ['T1', 'T2', 'T3', 'T4', 'ADM']}
        availableRoles={state.roles}
        availableCategories={state.categories}
      />

      {/* Task Management Modal */}
      <TaskModal
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setTaskToEdit(null);
          setParentTaskIdForNew(undefined);
        }}
        onSave={handleSaveTaskFromModal}
        taskToEdit={taskToEdit || undefined}
        onDelete={deleteTask}
        parentTaskId={parentTaskIdForNew}
        allTasks={state.tasks}
        availableRoles={state.roles}
        availableCategories={state.categories}
        availableSkills={state.skills}
        availableShifts={availableShifts}
      />

      {/* Full Collaborator Management Modal with Skill Matrix */}
      <CollaboratorModal
        isOpen={collabModalOpen}
        onClose={() => {
          setCollabModalOpen(false);
          setCollabToEdit(null);
        }}
        onSave={handleSaveCollabFromModal}
        collabToEdit={collabToEdit || undefined}
        availableShifts={availableShifts}
        availableScaleGroups={
          state.scaleGroups && state.scaleGroups.length ? state.scaleGroups : SHIFT_GROUPS
        }
        availableTeamLeaders={state.teamLeaders || []}
        availableRoles={state.roles}
        availableCategories={state.categories}
        availableSkills={state.skills}
        availableSectors={state.registeredSectors || [state.sector || 'Operação', 'Inbound', 'Outbound', 'ICQA', 'Expedição', 'Qualidade']}
        teamShiftMap={state.teamShiftMap}
        defaultShift={state.teamShift || availableShifts[0] || 'Geral'}
        defaultTeamLeader={state.defaultTeamLeader || state.teamLeaders?.[0] || 'Sem Time'}
      />
    </div>
  );
};
