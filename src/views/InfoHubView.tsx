import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Info,
  Link as LinkIcon,
  Bell,
  Zap,
  Plus,
  Search,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Edit2,
  Clock,
  Layers,
  Megaphone,
  FolderPlus,
  Folder,
  Folders,
  Grid,
  Pencil,
  Smartphone,
  Globe,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  PageHeader,
  Card,
  CardHeader,
  Button,
  Badge,
  StatCard,
  Tabs,
  Toolbar,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  Modal,
  Toggle,
} from '../components/ui';
import { InfoHubLink, InfoHubQuickFill, InfoHubReminder, QuickFillSubItem } from '../types';
import { dispatchQuickFillsToExtension } from '../utils/extensionInstaller';
import { MarkdownContent } from '../components/MarkdownContent';

// Helper to normalize items from legacy or grouped QuickFills
const getQuickFillItems = (qf: InfoHubQuickFill): QuickFillSubItem[] => {
  if (qf.items && qf.items.length > 0) return qf.items;
  if (qf.codeValue) {
    return [{ id: `${qf.id}_legacy`, label: qf.title, codeValue: qf.codeValue, description: qf.description }];
  }
  return [];
};

export const InfoHubView: React.FC = () => {
  const {
    state,
    identifiedUser,
    showNotice,
    addInfoHubReminder,
    updateInfoHubReminder,
    deleteInfoHubReminder,
    addInfoHubLink,
    updateInfoHubLink,
    deleteInfoHubLink,
    addInfoHubQuickFill,
    updateInfoHubQuickFill,
    deleteInfoHubQuickFill,
  } = useApp();

  // Primary Tab state - Default to 'visao_geral' (Tudo Mesclado)
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'quick_fill' | 'links' | 'reminders'>('visao_geral');

  // Search & Filter States
  const [globalSearch, setGlobalSearch] = useState('');
  const [quickFillSearch, setQuickFillSearch] = useState('');
  const [quickFillCategory, setQuickFillCategory] = useState<string>('todos');

  const [linkSearch, setLinkSearch] = useState('');
  const [linkCategory, setLinkCategory] = useState<string>('todos');

  const [reminderShiftFilter, setReminderShiftFilter] = useState<string>('todos');
  const [reminderAuthorFilter, setReminderAuthorFilter] = useState<'todos' | 'meus'>('todos');

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Group Management Modals & States
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState<{ type: 'link' | 'quick_fill' } | null>(null);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');
  const [renamingCategory, setRenamingCategory] = useState<{
    type: 'link' | 'quick_fill';
    oldName: string;
    newName: string;
  } | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<{
    type: 'link' | 'quick_fill';
    name: string;
  } | null>(null);

  // View Mode: 'grouped' vs 'grid'
  const [linkViewMode, setLinkViewMode] = useState<'grouped' | 'grid'>('grouped');
  const [quickFillViewMode, setQuickFillViewMode] = useState<'grouped' | 'grid'>('grouped');

  // Modals
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<InfoHubReminder | null>(null);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<InfoHubLink | null>(null);

  const [isQuickFillModalOpen, setIsQuickFillModalOpen] = useState(false);
  const [editingQuickFill, setEditingQuickFill] = useState<InfoHubQuickFill | null>(null);

  // Form States - Reminder
  const [remText, setRemText] = useState('');
  const [remShift, setRemShift] = useState(identifiedUser?.shift || state.teamShift || 'T2');
  const [remPriority, setRemPriority] = useState<'normal' | 'alta' | 'urgente'>('normal');

  // Helpers for identified user ownership
  const isMyNotice = (rem: InfoHubReminder) => {
    if (!identifiedUser) return false;
    if (rem.authorId && String(rem.authorId) === String(identifiedUser.id)) return true;
    if (
      rem.authorName &&
      identifiedUser.name &&
      rem.authorName.trim().toLowerCase() === identifiedUser.name.trim().toLowerCase()
    )
      return true;
    return false;
  };

  const canEditNotice = (_rem?: InfoHubReminder) => {
    return true;
  };

  // Form States - Link
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkCat, setLinkCat] = useState('Sistemas Operacionais');
  const [linkDesc, setLinkDesc] = useState('');
  const [linkShift, setLinkShift] = useState('Todos');
  const [linkShowInPortal, setLinkShowInPortal] = useState<boolean>(true);
  const [isCustomLinkCat, setIsCustomLinkCat] = useState(false);

  // Form States - QuickFill Group
  const [qfTitle, setQfTitle] = useState('');
  const [qfCat, setQfCat] = useState('Impressoras');
  const [qfDesc, setQfDesc] = useState('');
  const [qfTriggerUrl, setQfTriggerUrl] = useState('');
  const [qfShift, setQfShift] = useState('Todos');
  const [qfTags, setQfTags] = useState('');
  const [isCustomQfCat, setIsCustomQfCat] = useState(false);
  const [qfItems, setQfItems] = useState<Array<{ id: string; label: string; codeValue: string; description?: string }>>([
    { id: 'sub_1', label: '', codeValue: '', description: '' },
  ]);

  // Sync extension when quickFills change
  useEffect(() => {
    if (state.infoHubQuickFills && state.infoHubQuickFills.length > 0) {
      // Envia os grupos completos (com items e triggerUrl) para a extensão —
      // o painel de preenchimento rápido com gatilho de URL usa a estrutura do grupo.
      const fullGroupsForExt = state.infoHubQuickFills.map((qf) => ({
        ...qf,
        items: (getQuickFillItems(qf) || []).map((i) => ({ ...i })),
        codeValue: qf.codeValue,
      }));
      dispatchQuickFillsToExtension(fullGroupsForExt);
    }
  }, [state.infoHubQuickFills]);

  // Copy handler
  const handleCopyCode = async (id: string, text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      showNotice(label ? `Código de "${label}" copiado!` : `Código "${text}" copiado!`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showNotice('Não foi possível copiar automaticamente.');
    }
  };

  const activeShift = state.selectedShiftFilter || state.teamShift || 'ALL';

  // Filtered Lists
  const reminders = useMemo(() => {
    const list = state.infoHubReminders || [];
    return list.filter((r) => {
      if (reminderAuthorFilter === 'meus' && !isMyNotice(r)) return false;
      if (reminderShiftFilter !== 'todos' && r.shift !== reminderShiftFilter && r.shift !== 'Todos') return false;
      if (activeShift !== 'ALL' && activeShift !== 'todos' && activeShift !== 'Geral') {
        const itemShift = r.shift || 'Todos';
        if (itemShift !== 'Todos' && itemShift !== 'Geral' && itemShift !== activeShift) {
          return false;
        }
      }
      return true;
    });
  }, [state.infoHubReminders, reminderShiftFilter, reminderAuthorFilter, activeShift, identifiedUser]);

  // Urgent/High Priority Notices for Top Banner
  const featuredNotices = useMemo(() => {
    const urgent = reminders.filter((r) => r.priority === 'urgente' || r.priority === 'alta');
    if (urgent.length > 0) return urgent;
    return reminders.slice(0, 3);
  }, [reminders]);

  const links = useMemo(() => {
    const list = state.infoHubLinks || [];
    const q = (activeTab === 'visao_geral' ? globalSearch : linkSearch).toLowerCase().trim();
    return list.filter((l) => {
      if (linkCategory !== 'todos' && l.category !== linkCategory) return false;
      if (activeShift !== 'ALL' && activeShift !== 'todos' && activeShift !== 'Geral') {
        const itemShift = l.shift || 'Todos';
        if (itemShift !== 'Todos' && itemShift !== 'Geral' && itemShift !== activeShift) {
          return false;
        }
      }
      if (!q) return true;
      return (
        l.title.toLowerCase().includes(q) ||
        l.url.toLowerCase().includes(q) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        (l.category && l.category.toLowerCase().includes(q)) ||
        (l.shift && l.shift.toLowerCase().includes(q))
      );
    });
  }, [state.infoHubLinks, activeTab, globalSearch, linkSearch, linkCategory, activeShift]);

  const quickFills = useMemo(() => {
    const list = state.infoHubQuickFills || [];
    const q = (activeTab === 'visao_geral' ? globalSearch : quickFillSearch).toLowerCase().trim();
    return list.filter((item) => {
      if (quickFillCategory !== 'todos' && item.category !== quickFillCategory) return false;
      if (activeShift !== 'ALL' && activeShift !== 'todos' && activeShift !== 'Geral') {
        const itemShift = item.shift || 'Todos';
        if (itemShift !== 'Todos' && itemShift !== 'Geral' && itemShift !== activeShift) {
          return false;
        }
      }
      if (!q) return true;
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchCat = (item.category || '').toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      const matchShift = (item.shift || '').toLowerCase().includes(q);
      const matchTags = (item.tags || []).some((t) => t.toLowerCase().includes(q));
      
      const subItems = getQuickFillItems(item);
      const matchSubItems = subItems.some(
        (sub) =>
          sub.label.toLowerCase().includes(q) ||
          sub.codeValue.toLowerCase().includes(q) ||
          (sub.description && sub.description.toLowerCase().includes(q))
      );

      return matchTitle || matchCat || matchDesc || matchShift || matchTags || matchSubItems;
    });
  }, [state.infoHubQuickFills, activeTab, globalSearch, quickFillSearch, quickFillCategory, activeShift]);

  // Categories (alphabetically sorted)
  const linkCategories = useMemo(() => {
    const set = new Set<string>();
    (state.infoHubLinks || []).forEach((l) => {
      const cat = l.category?.trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [state.infoHubLinks]);

  const quickFillCategories = useMemo(() => {
    const set = new Set<string>();
    (state.infoHubQuickFills || []).forEach((q) => {
      const cat = q.category?.trim();
      if (cat) set.add(cat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [state.infoHubQuickFills]);

  // Grouped items by category for structural display
  const groupedLinks = useMemo(() => {
    const groups: Record<string, InfoHubLink[]> = {};
    links.forEach((link) => {
      const cat = link.category?.trim() || 'Geral';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(link);
    });
    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((cat) => ({
        category: cat,
        items: groups[cat].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
      }));
  }, [links]);

  const groupedQuickFills = useMemo(() => {
    const groups: Record<string, InfoHubQuickFill[]> = {};
    quickFills.forEach((qf) => {
      const cat = qf.category?.trim() || 'Geral';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(qf);
    });
    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((cat) => ({
        category: cat,
        items: groups[cat].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR')),
      }));
  }, [quickFills]);

  // Group Management Actions
  const handleOpenCreateGroup = (type: 'link' | 'quick_fill') => {
    setNewGroupNameInput('');
    setIsNewGroupModalOpen({ type });
  };

  const handleConfirmCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupNameInput.trim() || !isNewGroupModalOpen) return;
    const groupName = newGroupNameInput.trim();
    const type = isNewGroupModalOpen.type;
    setIsNewGroupModalOpen(null);

    if (type === 'link') {
      handleOpenLinkModal(undefined, groupName);
      showNotice(`Grupo de atalhos "${groupName}" pronto! Preencha o primeiro atalho deste grupo.`);
    } else {
      handleOpenQuickFillModal(undefined, groupName);
      showNotice(`Grupo de códigos "${groupName}" pronto! Preencha os primeiros códigos deste grupo.`);
    }
  };

  const handleConfirmRenameCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingCategory || !renamingCategory.newName.trim()) return;
    const { type, oldName, newName } = renamingCategory;
    const trimmedNew = newName.trim();

    if (type === 'link') {
      const itemsToUpdate = (state.infoHubLinks || []).filter(
        (l) => (l.category?.trim() || 'Geral') === oldName
      );
      itemsToUpdate.forEach((l) => {
        updateInfoHubLink(l.id, { category: trimmedNew });
      });
      showNotice(`Grupo de atalhos renomeado para "${trimmedNew}" (${itemsToUpdate.length} links atualizados)!`);
    } else {
      const itemsToUpdate = (state.infoHubQuickFills || []).filter(
        (q) => (q.category?.trim() || 'Geral') === oldName
      );
      itemsToUpdate.forEach((q) => {
        updateInfoHubQuickFill(q.id, { category: trimmedNew });
      });
      showNotice(`Categoria de preenchimento renomeada para "${trimmedNew}" (${itemsToUpdate.length} grupos atualizados)!`);
    }
    setRenamingCategory(null);
  };

  const handleConfirmDeleteCategory = () => {
    if (!deletingCategory) return;
    const { type, name } = deletingCategory;

    if (type === 'link') {
      const itemsToDelete = (state.infoHubLinks || []).filter(
        (l) => (l.category?.trim() || 'Geral') === name
      );
      itemsToDelete.forEach((l) => deleteInfoHubLink(l.id));
      showNotice(`Grupo de links "${name}" e seus ${itemsToDelete.length} atalho(s) foram excluídos!`);
    } else {
      const itemsToDelete = (state.infoHubQuickFills || []).filter(
        (q) => (q.category?.trim() || 'Geral') === name
      );
      itemsToDelete.forEach((q) => deleteInfoHubQuickFill(q.id));
      showNotice(`Categoria "${name}" e seus ${itemsToDelete.length} grupo(s) de códigos foram excluídos!`);
    }
    setDeletingCategory(null);
  };

  // Submit Handlers
  const handleOpenReminderModal = (reminder?: InfoHubReminder) => {
    if (reminder) {
      setEditingReminder(reminder);
      setRemText(reminder.text);
      setRemShift(reminder.shift || 'Todos');
      setRemPriority(reminder.priority || 'normal');
    } else {
      setEditingReminder(null);
      setRemText('');
      setRemShift(identifiedUser?.shift || state.teamShift || 'T2');
      setRemPriority('normal');
    }
    setIsReminderModalOpen(true);
  };

  const handleSaveReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remText.trim()) return;
    if (editingReminder) {
      updateInfoHubReminder(editingReminder.id, {
        shift: remShift,
        text: remText.trim(),
        priority: remPriority,
      });
      showNotice('Aviso atualizado com sucesso!');
    } else {
      addInfoHubReminder({
        shift: remShift,
        text: remText.trim(),
        priority: remPriority,
        authorName: identifiedUser?.name || 'Operador',
      });
      showNotice('Aviso publicado com sucesso!');
    }
    setEditingReminder(null);
    setRemText('');
    setIsReminderModalOpen(false);
  };

  const handleOpenLinkModal = (link?: InfoHubLink, defaultCategory?: string) => {
    if (link) {
      setEditingLink(link);
      setLinkTitle(link.title);
      setLinkUrl(link.url);
      setLinkCat(link.category || 'Sistemas Operacionais');
      setLinkDesc(link.description || '');
      setLinkShift(link.shift || 'Todos');
      setLinkShowInPortal(link.showInPortal ?? false);
      setIsCustomLinkCat(false);
    } else {
      setEditingLink(null);
      setLinkTitle('');
      setLinkUrl('');
      setLinkCat(defaultCategory || linkCategories[0] || 'Sistemas Operacionais');
      setLinkDesc('');
      setLinkShift('Todos');
      setLinkShowInPortal(true);
      setIsCustomLinkCat(!!defaultCategory && !linkCategories.includes(defaultCategory));
    }
    setIsLinkModalOpen(true);
  };

  const handleSaveLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    const finalCat = linkCat.trim() || 'Geral';
    if (editingLink) {
      updateInfoHubLink(editingLink.id, {
        title: linkTitle.trim(),
        url: linkUrl.trim(),
        category: finalCat,
        description: linkDesc.trim(),
        shift: linkShift,
        showInPortal: linkShowInPortal,
      });
      showNotice(`Atalho "${linkTitle}" atualizado!`);
    } else {
      addInfoHubLink({
        title: linkTitle.trim(),
        url: linkUrl.trim(),
        category: finalCat,
        description: linkDesc.trim(),
        shift: linkShift,
        showInPortal: linkShowInPortal,
      });
      showNotice(`Atalho "${linkTitle}" cadastrado no grupo "${finalCat}"!`);
    }
    setIsLinkModalOpen(false);
  };

  const handleToggleLinkInPortal = (link: InfoHubLink) => {
    const nextVal = !link.showInPortal;
    updateInfoHubLink(link.id, { showInPortal: nextVal });
    showNotice(
      nextVal
        ? `Atalho "${link.title}" habilitado no Portal do Operador!`
        : `Atalho "${link.title}" desabilitado do Portal do Operador.`
    );
  };

  // QuickFill Modal Handlers
  const handleOpenQuickFillModal = (qf?: InfoHubQuickFill, defaultCategory?: string) => {
    if (qf) {
      setEditingQuickFill(qf);
      setQfTitle(qf.title);
      setQfCat(qf.category || 'Impressoras');
      setQfDesc(qf.description || '');
      setQfTriggerUrl(qf.triggerUrl || '');
      setQfShift(qf.shift || 'Todos');
      setQfTags(qf.tags ? qf.tags.join(', ') : '');
      setIsCustomQfCat(false);
      const existingItems = getQuickFillItems(qf);
      setQfItems(
        existingItems.length > 0
          ? existingItems.map((i) => ({ ...i }))
          : [{ id: `sub_${Date.now()}`, label: '', codeValue: '', description: '' }]
      );
    } else {
      setEditingQuickFill(null);
      setQfTitle('');
      setQfCat(defaultCategory || quickFillCategories[0] || 'Impressoras');
      setQfDesc('');
      setQfTriggerUrl('');
      setQfShift('Todos');
      setQfTags('');
      setIsCustomQfCat(!!defaultCategory && !quickFillCategories.includes(defaultCategory));
      setQfItems([
        { id: `sub_${Date.now()}_1`, label: '', codeValue: '', description: '' },
        { id: `sub_${Date.now()}_2`, label: '', codeValue: '', description: '' },
      ]);
    }
    setIsQuickFillModalOpen(true);
  };

  const handleAddQfSubItem = () => {
    setQfItems((prev) => [
      ...prev,
      { id: `sub_${Date.now()}_${prev.length + 1}`, label: '', codeValue: '', description: '' },
    ]);
  };

  const handleRemoveQfSubItem = (index: number) => {
    if (qfItems.length <= 1) {
      showNotice('O cadastro deve possuir ao menos 1 código/item.');
      return;
    }
    setQfItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQfSubItemChange = (index: number, field: 'label' | 'codeValue' | 'description', val: string) => {
    setQfItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleSaveQuickFillGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qfTitle.trim()) return;

    // Filter valid sub items
    const validItems: QuickFillSubItem[] = qfItems
      .filter((item) => item.label.trim() || item.codeValue.trim())
      .map((item, idx) => ({
        id: item.id || `sub_${Date.now()}_${idx}`,
        label: item.label.trim() || `Código ${idx + 1}`,
        codeValue: item.codeValue.trim(),
        description: item.description?.trim(),
      }));

    if (validItems.length === 0) {
      showNotice('Adicione pelo menos um código válido na lista.');
      return;
    }

    const tagArray = qfTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (editingQuickFill) {
      updateInfoHubQuickFill(editingQuickFill.id, {
        title: qfTitle.trim(),
        category: qfCat,
        description: qfDesc.trim(),
        triggerUrl: qfTriggerUrl.trim() || undefined,
        shift: qfShift,
        tags: tagArray,
        items: validItems,
      });
      showNotice(`Grupo "${qfTitle}" atualizado com sucesso!`);
    } else {
      addInfoHubQuickFill({
        title: qfTitle.trim(),
        category: qfCat,
        description: qfDesc.trim(),
        triggerUrl: qfTriggerUrl.trim() || undefined,
        shift: qfShift,
        tags: tagArray,
        items: validItems,
      });
      showNotice(`Grupo de códigos "${qfTitle}" criado com ${validItems.length} código(s)!`);
    }
    setIsQuickFillModalOpen(false);
  };

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-200">
      <PageHeader
        icon={Info}
        title="Hub e Central de Informações"
        subtitle="Central de conhecimento, atalhos e comunicados da operação."
        actions={
          <>
            <Button size="sm" icon={Plus} onClick={() => handleOpenQuickFillModal()}>
              Grupo de Códigos
            </Button>
            <Button size="sm" variant="outline" icon={Plus} onClick={() => handleOpenLinkModal()}>
              Novo Atalho
            </Button>
            <Button size="sm" variant="secondary" icon={Megaphone} onClick={() => setIsReminderModalOpen(true)}>
              Novo Aviso
            </Button>
          </>
        }
      />

      <Toolbar className="justify-between">
        <Tabs
          items={[
            { value: 'visao_geral', label: 'Geral (Tudo)', icon: Layers },
            { value: 'quick_fill', label: 'Preenchimento Rápido', icon: Zap, badge: state.infoHubQuickFills?.length || 0 },
            { value: 'links', label: 'Atalhos & Links', icon: LinkIcon, badge: state.infoHubLinks?.length || 0 },
            { value: 'reminders', label: 'Avisos & Lembretes', icon: Bell, badge: state.infoHubReminders?.length || 0 },
          ]}
          value={activeTab}
          onChange={(v) => setActiveTab(v as typeof activeTab)}
          className="max-w-full overflow-x-auto no-scrollbar"
        />
        {activeTab === 'visao_geral' && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="Buscar em tudo..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full pl-8.5 pr-3 h-9 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)] font-semibold focus:outline-none focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--primary)_18%,transparent)]"
            />
          </div>
        )}
      </Toolbar>

      {/* ========================================================================= */}
      {/* ABA 1: VISÃO GERAL (TUDO MESCLADO COM AVISOS EM DESTAQUE NO TOPO)         */}
      {/* ========================================================================= */}
      {activeTab === 'visao_geral' && (
        <div className="space-y-5">
          {/* Indicadores */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Atalhos & Links" value={links.length} icon={LinkIcon} tone="info" />
            <StatCard label="Grupos de Códigos" value={quickFills.length} icon={Zap} tone="success" />
            <StatCard label="Avisos & Lembretes" value={reminders.length} icon={Bell} tone="warning" />
            <StatCard label="Em Destaque" value={featuredNotices.length} icon={Megaphone} tone="danger" />
          </div>

          {/* TOPO: BANNER DE AVISOS EM DESTAQUE */}
          <div className="bg-amber-500/5 dark:bg-amber-950/30 border border-amber-500/30 dark:border-amber-500/20 rounded-xl shadow-[var(--shadow-card)] p-4 sm:p-5 space-y-4">
            <CardHeader
              icon={<Megaphone className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400 animate-pulse" />}
              title="Avisos e Comunicados em Destaque"
              subtitle="Mural de orientações prioritárias e comunicados urgentes para a operação do turno."
              actions={
                <Button size="sm" variant="secondary" icon={Plus} onClick={() => handleOpenReminderModal()}>
                  Adicionar Aviso
                </Button>
              }
            />

            {featuredNotices.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title="Nenhum aviso registrado até o momento."
                description="Publique um aviso para compartilhar orientações prioritárias com o turno."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {featuredNotices.map((notice) => {
                  const isMine = isMyNotice(notice);
                  const canEdit = canEditNotice(notice);

                  return (
                    <div
                      key={notice.id}
                      className={`p-3.5 rounded-xl border bg-[var(--surface)] flex flex-col justify-between space-y-2 shadow-[var(--shadow-card)] ${
                        notice.priority === 'urgente'
                          ? 'border-rose-500/50 text-rose-950 dark:text-rose-100'
                          : notice.priority === 'alta'
                          ? 'border-amber-500/50 text-amber-950 dark:text-amber-100'
                          : 'border-[var(--line)] text-[var(--ink)]'
                      } ${isMine ? 'ring-1.5 ring-amber-500/40' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            tone={notice.priority === 'urgente' ? 'danger' : notice.priority === 'alta' ? 'warning' : 'neutral'}
                            className="uppercase"
                          >
                            {notice.priority || 'Normal'}
                          </Badge>
                          {isMine && <Badge tone="warning">Feito por você</Badge>}
                        </div>
                        <Badge tone="neutral">Turno: {notice.shift}</Badge>
                      </div>

                      <div className="min-h-0">
                        <MarkdownContent content={notice.text} sizeClass="text-xs font-bold leading-relaxed" />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-[var(--muted)] pt-2 border-t border-[var(--line)]/50">
                        <span>Por: {isMine ? 'Você' : notice.authorName || 'Operação'}</span>
                        <div className="flex items-center gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenReminderModal(notice)}
                              className="text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-500/10 px-1.5 py-0.5 rounded-md cursor-pointer flex items-center gap-1 font-bold text-[10.5px]"
                              title="Editar este aviso"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => deleteInfoHubReminder(notice.id)}
                              className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 p-1 rounded-md cursor-pointer"
                              title="Excluir aviso"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* GRID PRINCIPAL DE 3 COLUNAS ESPALHADAS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* COLUNA ESQUERDA: ATALHOS & LINKS */}
            <Card>
              <CardHeader
                icon={<LinkIcon className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />}
                title={`Atalhos & Links (${links.length})`}
                actions={
                  <Button variant="ghost" size="xs" icon={Plus} onClick={() => handleOpenLinkModal()} title="Novo Atalho">
                    Novo
                  </Button>
                }
              />

              {links.length === 0 ? (
                <EmptyState icon={LinkIcon} title="Nenhum atalho encontrado." className="mt-4" />
              ) : (
                <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto pr-1 no-scrollbar">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="p-3 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl hover:border-blue-500/40 transition-all flex flex-col justify-between gap-2 group"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge tone="info" className="uppercase">
                              {link.category || 'Atalho'}
                            </Badge>
                            {link.showInPortal ? (
                              <Badge tone="success" className="text-[9px] font-bold">
                                No Portal
                              </Badge>
                            ) : (
                              <Badge tone="neutral" className="text-[9px] opacity-70">
                                Oculto do Portal
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleLinkInPortal(link)}
                              className={`p-1 rounded cursor-pointer transition-colors ${
                                link.showInPortal
                                  ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                                  : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)]'
                              }`}
                              title={link.showInPortal ? 'Desativar do Portal do Operador' : 'Exibir no Portal do Operador (Mobile)'}
                            >
                              <Smartphone className={`w-3.5 h-3.5 ${link.showInPortal ? 'text-emerald-600 dark:text-emerald-400 fill-emerald-500/20' : 'opacity-50'}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenLinkModal(link)}
                              className="p-1 text-[var(--muted)] hover:text-blue-500 rounded cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteInfoHubLink(link.id)}
                              className="p-1 text-[var(--muted)] hover:text-rose-500 rounded cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-xs font-extrabold text-[var(--ink)] mt-1.5">{link.title}</h4>
                        {link.description && (
                          <p className="text-[11px] text-[var(--muted)] line-clamp-2 mt-0.5">{link.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-[var(--line)]/50">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 h-7 inline-flex items-center justify-center gap-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-all"
                        >
                          <span>Acessar</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(link.id, link.url, link.title)}
                          className="h-7 w-7 inline-flex items-center justify-center bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] rounded-lg transition-all cursor-pointer"
                          title="Copiar Link"
                        >
                          {copiedId === link.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* COLUNA CENTRO: LEMBRETES & ROTINAS DO TURNO */}
            <Card>
              <CardHeader
                icon={<Clock className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />}
                title={`Lembretes do Turno (${reminders.length})`}
                actions={
                  <Button variant="ghost" size="xs" icon={Plus} onClick={() => handleOpenReminderModal()} title="Novo Lembrete">
                    Novo
                  </Button>
                }
              />

              {/* Filtro Rápido de Turno e Autor */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                  {['todos', 'T1', 'T2', 'T3', 'ADM'].map((shift) => (
                    <button
                      key={shift}
                      type="button"
                      onClick={() => setReminderShiftFilter(shift)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                        reminderShiftFilter === shift
                          ? 'bg-amber-500 text-white'
                          : 'bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {shift === 'todos' ? 'Todos' : shift}
                    </button>
                  ))}
                </div>
                {identifiedUser && (
                  <div className="flex items-center gap-1 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setReminderAuthorFilter('todos')}
                      className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold cursor-pointer transition-all ${
                        reminderAuthorFilter === 'todos'
                          ? 'bg-[var(--line)] text-[var(--ink)]'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      Todos os Autores
                    </button>
                    <button
                      type="button"
                      onClick={() => setReminderAuthorFilter('meus')}
                      className={`px-2 py-0.5 rounded-md text-[9.5px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                        reminderAuthorFilter === 'meus'
                          ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-extrabold'
                          : 'text-[var(--muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <span>Feitos por Mim</span>
                    </button>
                  </div>
                )}
              </div>

              {reminders.length === 0 ? (
                <EmptyState icon={Bell} title="Nenhum lembrete para este filtro." className="mt-4" />
              ) : (
                <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto pr-1 no-scrollbar">
                  {reminders.map((rem) => {
                    const isMine = isMyNotice(rem);
                    const canEdit = canEditNotice(rem);

                    return (
                      <div
                        key={rem.id}
                        className={`p-3.5 bg-[var(--surface-2)] border rounded-xl flex flex-col justify-between gap-2 ${
                          isMine ? 'border-amber-500/40 bg-amber-500/5' : 'border-[var(--line)]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1 flex-wrap">
                            <Badge tone="warning">Turno {rem.shift}</Badge>
                            {isMine && <Badge tone="warning">Meu Aviso</Badge>}
                          </div>
                          <div className="flex items-center gap-1">
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleOpenReminderModal(rem)}
                                className="text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-500/10 p-1 rounded-md cursor-pointer"
                                title="Editar Aviso"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => deleteInfoHubReminder(rem.id)}
                                className="text-[var(--muted)] hover:text-rose-500 p-1 rounded-md cursor-pointer"
                                title="Excluir Lembrete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <MarkdownContent content={rem.text} sizeClass="text-xs font-semibold leading-relaxed" />

                        <div className="text-[10px] text-[var(--muted)] flex items-center justify-between pt-1 border-t border-[var(--line)]/40">
                          <span>Por: {isMine ? 'Você' : rem.authorName || 'Operador'}</span>
                          <span>{new Date(rem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            {/* COLUNA DIREITA: PREENCHIMENTO RÁPIDO (GRUPOS E CÓDIGOS) */}
            <Card>
              <CardHeader
                icon={<Zap className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />}
                title={`Preenchimento Rápido (${quickFills.length})`}
                actions={
                  <Button variant="ghost" size="xs" icon={Plus} onClick={() => handleOpenQuickFillModal()} title="Novo Grupo">
                    Novo
                  </Button>
                }
              />

              {quickFills.length === 0 ? (
                <EmptyState icon={Zap} title="Nenhum grupo de códigos cadastrado." className="mt-4" />
              ) : (
                <div className="mt-4 space-y-4 max-h-[600px] overflow-y-auto pr-1 no-scrollbar">
                  {quickFills.map((qf) => {
                    const subItems = getQuickFillItems(qf);
                    return (
                      <div
                        key={qf.id}
                        className="p-3.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl space-y-3 group"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-[var(--line)]/50 pb-2">
                          <div>
                            <Badge tone="success" className="uppercase">
                              {qf.category || 'Geral'}
                            </Badge>
                            <h4 className="text-xs font-extrabold text-[var(--ink)] mt-1">{qf.title}</h4>
                            {qf.description && (
                              <p className="text-[11px] text-[var(--muted)] line-clamp-2 mt-0.5">{qf.description}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleOpenQuickFillModal(qf)}
                              className="p-1 text-[var(--muted)] hover:text-indigo-500 cursor-pointer"
                              title="Editar Grupo"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteInfoHubQuickFill(qf.id)}
                              className="p-1 text-[var(--muted)] hover:text-rose-500 cursor-pointer"
                              title="Excluir Grupo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* LISTA DE CÓDIGOS INTERNOS */}
                        <div className="space-y-2">
                          {subItems.map((sub) => (
                            <div
                              key={sub.id}
                              className="p-2.5 bg-[var(--paper)] border border-[var(--line)]/80 rounded-lg flex items-center justify-between gap-2 hover:border-emerald-500/40 transition-all"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-bold text-[var(--ink)] truncate">{sub.label}</div>
                                <div className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 px-1.5 py-0.5 rounded mt-0.5 truncate border border-emerald-500/10">
                                  {sub.codeValue}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleCopyCode(sub.id, sub.codeValue, sub.label)}
                                className="h-7 px-2.5 inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-all shadow-xs shrink-0"
                              >
                                {copiedId === sub.id ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>Copiado!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copiar</span>
                                  </>
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: PREENCHIMENTO RÁPIDO (CADASTRAR E EDITAR GRUPOS COM LISTA DE CÓDIGOS)*/}
      {/* ========================================================================= */}
      {activeTab === 'quick_fill' && (
        <div className="space-y-5">
          <Card>
            <CardHeader
              icon={<Zap className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />}
              title="Gestão de Grupos & Códigos Rápidos"
              subtitle="Organize seus blocos de preenchimento rápido em grupos e categorias estruturadas."
              actions={
                <>
                  <Button size="sm" icon={FolderPlus} onClick={() => handleOpenCreateGroup('quick_fill')}>
                    Novo Grupo / Categoria
                  </Button>
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => handleOpenQuickFillModal()}>
                    Item com Códigos
                  </Button>
                </>
              }
            />
          </Card>

          {/* Filtros, Categorias e Modo de Visualização */}
          <Toolbar>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Pesquisar por grupo, código, etiqueta ou texto..."
                value={quickFillSearch}
                onChange={(e) => setQuickFillSearch(e.target.value)}
                className="w-full pl-9 pr-3 h-9 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)] font-semibold focus:outline-none focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--primary)_18%,transparent)]"
              />
            </div>

            <Select
              value={quickFillCategory}
              onChange={(e) => setQuickFillCategory(e.target.value)}
              className="w-full sm:w-48"
            >
              <option value="todos">Todos os Grupos ({quickFills.length})</option>
              {quickFillCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <div className="flex items-center gap-1 bg-[var(--paper)] border border-[var(--line)] p-1 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setQuickFillViewMode('grouped')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  quickFillViewMode === 'grouped'
                    ? 'bg-emerald-600 text-white'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                title="Visualização agrupada por categorias"
              >
                <Folders className="w-4 h-4" />
                <span className="hidden md:inline">Por Grupos</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickFillViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  quickFillViewMode === 'grid'
                    ? 'bg-emerald-600 text-white'
                    : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                title="Visualização em grade direta"
              >
                <Grid className="w-4 h-4" />
                <span className="hidden md:inline">Grade</span>
              </button>
            </div>
          </Toolbar>

          {/* Quick Categories Filter Pills */}
          {quickFillCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setQuickFillCategory('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  quickFillCategory === 'todos'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                Todos ({state.infoHubQuickFills?.length || 0})
              </button>
              {quickFillCategories.map((cat) => {
                const count = (state.infoHubQuickFills || []).filter((q) => (q.category?.trim() || 'Geral') === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setQuickFillCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      quickFillCategory === cat
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Conteúdo de Preenchimento Rápido */}
          {quickFills.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="Nenhum grupo de preenchimento rápido encontrado."
              description="Clique em Novo Grupo / Categoria ou Item com Códigos para começar."
              actionLabel="Criar Grupo de Códigos"
              onAction={() => handleOpenQuickFillModal()}
            />
          ) : quickFillViewMode === 'grouped' ? (
            <div className="space-y-5">
              {groupedQuickFills.map((group) => (
                <Card key={group.category}>
                  <CardHeader
                    icon={<Folder className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />}
                    title={group.category}
                    actions={
                      <>
                        <Badge tone="success">
                          {group.items.length} {group.items.length === 1 ? 'item' : 'itens'}
                        </Badge>
                        <Button size="sm" variant="secondary" icon={Plus} onClick={() => handleOpenQuickFillModal(undefined, group.category)}>
                          Adicionar Item
                        </Button>
                        <button
                          type="button"
                          onClick={() =>
                            setRenamingCategory({
                              type: 'quick_fill',
                              oldName: group.category,
                              newName: group.category,
                            })
                          }
                          className="p-1.5 text-[var(--muted)] hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Renomear Grupo"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCategory({ type: 'quick_fill', name: group.category })}
                          className="p-1.5 text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Excluir Grupo e Itens"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    }
                  />

                  {/* Cards inside Group */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {group.items.map((qf) => {
                      const subItems = getQuickFillItems(qf);
                      return (
                        <div
                          key={qf.id}
                          className="p-4 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl hover:border-emerald-500/40 transition-all space-y-3 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 border-b border-[var(--line)]/50 pb-2">
                              <h4 className="text-xs font-black text-[var(--ink)] leading-snug">{qf.title}</h4>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickFillModal(qf)}
                                  className="p-1 text-[var(--muted)] hover:text-indigo-500 hover:bg-indigo-500/10 rounded-md transition-colors cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => deleteInfoHubQuickFill(qf.id)}
                                  className="p-1 text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {qf.description && (
                              <p className="text-[11px] text-[var(--muted)] mt-1.5 line-clamp-2">{qf.description}</p>
                            )}

                            {/* Sub items list */}
                            <div className="mt-3 space-y-2">
                              {subItems.map((sub) => (
                                <div
                                  key={sub.id}
                                  className="p-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-bold text-[var(--ink)] truncate">{sub.label}</div>
                                    <div className="text-xs font-mono text-emerald-700 dark:text-emerald-300 truncate mt-0.5">
                                      {sub.codeValue}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCode(sub.id, sub.codeValue, sub.label)}
                                    className="h-7 px-2.5 inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-xs shrink-0"
                                  >
                                    {copiedId === sub.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    <span>{copiedId === sub.id ? 'Copiado' : 'Copiar'}</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>

                          {qf.tags && qf.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-2 border-t border-[var(--line)]/50">
                              {qf.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[9px] font-semibold text-[var(--muted)] bg-[var(--paper)] px-2 py-0.5 rounded"
                                >
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {quickFills.map((qf) => {
                const subItems = getQuickFillItems(qf);
                return (
                  <div
                    key={qf.id}
                    className="p-5 bg-[var(--paper)] border border-[var(--line)] rounded-xl hover:border-emerald-500/40 transition-all space-y-4 flex flex-col justify-between group shadow-[var(--shadow-card)]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 border-b border-[var(--line)]/50 pb-3">
                        <div>
                          <Badge tone="success" className="uppercase">
                            {qf.category || 'Geral'}
                          </Badge>
                          <h3 className="text-sm font-black text-[var(--ink)] mt-1.5">{qf.title}</h3>
                          {qf.description && (
                            <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{qf.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenQuickFillModal(qf)}
                            className="p-1.5 text-[var(--muted)] hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteInfoHubQuickFill(qf.id)}
                            className="p-1.5 text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* LISTA DE CÓDIGOS DO GRUPO */}
                      <div className="mt-3 space-y-2">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)] mb-1">
                          Códigos Cadastrados ({subItems.length})
                        </div>

                        {subItems.map((sub) => (
                          <div
                            key={sub.id}
                            className="p-2.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-[var(--ink)] truncate">{sub.label}</div>
                              <div className="text-xs font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded mt-1 truncate border border-emerald-500/20">
                                {sub.codeValue}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleCopyCode(sub.id, sub.codeValue, sub.label)}
                              className="h-8 px-3 inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs shrink-0"
                            >
                              {copiedId === sub.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {qf.tags && qf.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2 border-t border-[var(--line)]/50">
                        {qf.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[9px] font-semibold text-[var(--muted)] bg-[var(--surface-2)] px-2 py-0.5 rounded-md"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 3: ATALHOS & LINKS                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'links' && (
        <div className="space-y-5">
          <Card>
            <CardHeader
              icon={<LinkIcon className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />}
              title="Gestão de Atalhos & Links do Setor"
              subtitle="Crie grupos de atalhos e organize sistemas, portais e planilhas por departamento ou rotina."
              actions={
                <>
                  <Button size="sm" icon={FolderPlus} onClick={() => handleOpenCreateGroup('link')}>
                    Novo Grupo de Atalhos
                  </Button>
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => handleOpenLinkModal()}>
                    Novo Atalho
                  </Button>
                </>
              }
            />
          </Card>

          {/* Filtros, Busca e Alternador de Visão */}
          <Toolbar>
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="text"
                placeholder="Pesquisar por título, URL ou descrição..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                className="w-full pl-9 pr-3 h-9 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs text-[var(--ink)] font-semibold focus:outline-none focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--primary)_18%,transparent)]"
              />
            </div>

            <Select
              value={linkCategory}
              onChange={(e) => setLinkCategory(e.target.value)}
              className="w-full sm:w-48"
            >
              <option value="todos">Todos os Grupos ({links.length})</option>
              {linkCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>

            <div className="flex items-center gap-1 bg-[var(--paper)] border border-[var(--line)] p-1 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setLinkViewMode('grouped')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  linkViewMode === 'grouped' ? 'bg-blue-600 text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                title="Visualização agrupada por grupos/categorias"
              >
                <Folders className="w-4 h-4" />
                <span className="hidden md:inline">Por Grupos</span>
              </button>
              <button
                type="button"
                onClick={() => setLinkViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  linkViewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'
                }`}
                title="Visualização em grade direta"
              >
                <Grid className="w-4 h-4" />
                <span className="hidden md:inline">Grade</span>
              </button>
            </div>
          </Toolbar>

          {/* Quick Categories Filter Pills */}
          {linkCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setLinkCategory('todos')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  linkCategory === 'todos'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
                }`}
              >
                Todos ({state.infoHubLinks?.length || 0})
              </button>
              {linkCategories.map((cat) => {
                const count = (state.infoHubLinks || []).filter((l) => (l.category?.trim() || 'Geral') === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setLinkCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      linkCategory === cat
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-[var(--paper)] text-[var(--muted)] hover:text-[var(--ink)] border border-[var(--line)]'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10 dark:bg-white/10">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {links.length === 0 ? (
            <EmptyState
              icon={LinkIcon}
              title="Nenhum atalho encontrado."
              description="Crie um novo grupo de links ou adicione atalhos para os sistemas da empresa."
              actionLabel="Novo Atalho"
              onAction={() => handleOpenLinkModal()}
            />
          ) : linkViewMode === 'grouped' ? (
            <div className="space-y-5">
              {groupedLinks.map((group) => (
                <Card key={group.category}>
                  <CardHeader
                    icon={<Folder className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />}
                    title={group.category}
                    actions={
                      <>
                        <Badge tone="info">
                          {group.items.length} {group.items.length === 1 ? 'atalho' : 'atalhos'}
                        </Badge>
                        <Button size="sm" variant="secondary" icon={Plus} onClick={() => handleOpenLinkModal(undefined, group.category)}>
                          Adicionar Atalho
                        </Button>
                        <button
                          type="button"
                          onClick={() =>
                            setRenamingCategory({
                              type: 'link',
                              oldName: group.category,
                              newName: group.category,
                            })
                          }
                          className="p-1.5 text-[var(--muted)] hover:text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Renomear Grupo"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingCategory({ type: 'link', name: group.category })}
                          className="p-1.5 text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Excluir Grupo e Atalhos"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    }
                  />

                  {/* Cards Grid inside Group */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {group.items.map((link) => (
                      <div
                        key={link.id}
                        className="p-4 bg-[var(--surface-2)] border border-[var(--line)] rounded-xl hover:border-blue-500/40 transition-all space-y-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 border-b border-[var(--line)]/50 pb-2">
                            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                              <h4 className="text-xs font-black text-[var(--ink)] leading-snug truncate">{link.title}</h4>
                              {link.showInPortal ? (
                                <Badge tone="success" className="text-[9px] font-bold">
                                  No Portal
                                </Badge>
                              ) : (
                                <Badge tone="neutral" className="text-[9px] opacity-70">
                                  Oculto do Portal
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleLinkInPortal(link)}
                                className={`p-1 rounded-md transition-colors cursor-pointer ${
                                  link.showInPortal
                                    ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                                    : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)]'
                                }`}
                                title={link.showInPortal ? 'Desativar do Portal do Operador' : 'Exibir no Portal do Operador (Mobile)'}
                              >
                                <Smartphone className={`w-3.5 h-3.5 ${link.showInPortal ? 'text-emerald-600 dark:text-emerald-400 fill-emerald-500/20' : 'opacity-50'}`} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenLinkModal(link)}
                                className="p-1 text-[var(--muted)] hover:text-blue-500 hover:bg-blue-500/10 rounded-md transition-colors cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteInfoHubLink(link.id)}
                                className="p-1 text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {link.description && (
                            <p className="text-[11px] text-[var(--muted)] mt-1.5 line-clamp-2">{link.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-[var(--line)]/50">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 h-8 inline-flex items-center justify-center gap-1.5 px-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                          >
                            <span>Abrir Sistema</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyCode(link.id, link.url, link.title)}
                            className="h-8 w-8 inline-flex items-center justify-center bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] rounded-lg transition-all cursor-pointer"
                            title="Copiar URL"
                          >
                            {copiedId === link.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="p-5 bg-[var(--paper)] border border-[var(--line)] rounded-xl hover:border-blue-500/40 transition-all space-y-3 flex flex-col justify-between shadow-[var(--shadow-card)]"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 border-b border-[var(--line)]/50 pb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge tone="info" className="uppercase">
                          {link.category || 'Atalho'}
                        </Badge>
                        {link.showInPortal ? (
                          <Badge tone="success" className="text-[9px] font-bold">
                            No Portal
                          </Badge>
                        ) : (
                          <Badge tone="neutral" className="text-[9px] opacity-70">
                            Oculto do Portal
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleToggleLinkInPortal(link)}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                            link.showInPortal
                              ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10'
                              : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--line)]'
                          }`}
                          title={link.showInPortal ? 'Desativar do Portal do Operador' : 'Exibir no Portal do Operador (Mobile)'}
                        >
                          <Smartphone className={`w-4 h-4 ${link.showInPortal ? 'text-emerald-600 dark:text-emerald-400 fill-emerald-500/20' : 'opacity-50'}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenLinkModal(link)}
                          className="p-1.5 text-[var(--muted)] hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteInfoHubLink(link.id)}
                          className="p-1.5 text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <h3 className="text-sm font-black text-[var(--ink)] mt-2">{link.title}</h3>
                    {link.description && <p className="text-xs text-[var(--muted)] mt-1">{link.description}</p>}
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-[var(--line)]/50">
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 h-9 inline-flex items-center justify-center gap-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      <span>Abrir Sistema</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyCode(link.id, link.url, link.title)}
                      className="h-9 w-9 inline-flex items-center justify-center bg-[var(--surface-2)] border border-[var(--line)] hover:bg-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] rounded-lg transition-all cursor-pointer"
                      title="Copiar URL"
                    >
                      {copiedId === link.id ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 4: AVISOS & LEMBRETES                                                 */}
      {/* ========================================================================= */}
      {activeTab === 'reminders' && (
        <div className="space-y-5">
          <Card>
            <CardHeader
              icon={<Bell className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />}
              title="Gestão de Avisos & Lembretes"
              subtitle="Mural de avisos urgentes, comunicados da gestão e instruções para troca de turno."
              actions={
                <Button size="sm" variant="secondary" icon={Plus} onClick={() => handleOpenReminderModal()}>
                  Novo Aviso
                </Button>
              }
            />
          </Card>

          {reminders.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Nenhum aviso registrado."
              description="Crie um aviso para compartilhar orientações e comunicados com o turno."
              actionLabel="Novo Aviso"
              onAction={() => handleOpenReminderModal()}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="p-5 bg-[var(--paper)] border border-[var(--line)] rounded-xl flex flex-col justify-between space-y-3 shadow-[var(--shadow-card)]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      tone={rem.priority === 'urgente' ? 'danger' : rem.priority === 'alta' ? 'warning' : 'neutral'}
                      className="uppercase"
                    >
                      {rem.priority || 'Normal'}
                    </Badge>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenReminderModal(rem)}
                        className="p-1 text-[var(--muted)] hover:text-amber-500 hover:bg-amber-500/10 rounded-lg cursor-pointer transition-colors"
                        title="Editar Aviso"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          deleteInfoHubReminder(rem.id);
                          showNotice('Aviso excluído com sucesso!');
                        }}
                        className="p-1 text-[var(--muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
                        title="Excluir Aviso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <MarkdownContent content={rem.text} sizeClass="text-xs font-semibold leading-relaxed" />

                  <div className="flex items-center justify-between text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--line)]/50">
                    <span>Turno: {rem.shift}</span>
                    <span>Por: {rem.authorName || 'Operador'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR LEMBRETE OU AVISO                                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        title={editingReminder ? 'Editar Aviso / Lembrete de Turno' : 'Novo Aviso / Lembrete de Turno'}
        icon={<Megaphone className="w-4.5 h-4.5 text-amber-500" />}
        size="sm"
      >
        <form onSubmit={handleSaveReminder} className="space-y-4">
          <Field label={<>Conteúdo do Aviso <span className="text-rose-500">*</span></>}>
            <Textarea
              required
              rows={3}
              value={remText}
              onChange={(e) => setRemText(e.target.value)}
              placeholder="Ex: Balança 04 em manutenção preventiva até 14h. Usar Doca 02."
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Turno Destino">
              <Select value={remShift} onChange={(e) => setRemShift(e.target.value)}>
                <option value="Todos">Todos os Turnos</option>
                <option value="T1">Turno T1</option>
                <option value="T2">Turno T2</option>
                <option value="T3">Turno T3</option>
                <option value="ADM">Administrativo</option>
              </Select>
            </Field>

            <Field label="Prioridade">
              <Select
                value={remPriority}
                onChange={(e) => setRemPriority(e.target.value as 'normal' | 'alta' | 'urgente')}
              >
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente (Destaque)</option>
              </Select>
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
            <Button variant="outline" onClick={() => setIsReminderModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingReminder ? 'Atualizar Aviso' : 'Publicar Aviso'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR ATALHO LINK                                         */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title={editingLink ? 'Editar Atalho' : 'Novo Atalho / Link'}
        icon={<LinkIcon className="w-4.5 h-4.5 text-blue-500" />}
        size="sm"
      >
        <form onSubmit={handleSaveLink} className="space-y-4">
          <Field label={<>Título do Sistema / Atalho <span className="text-rose-500">*</span></>}>
            <Input
              type="text"
              required
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="Ex: WMS Gestão de Estoque"
            />
          </Field>

          <Field label={<>URL Completa <span className="text-rose-500">*</span></>}>
            <Input
              type="url"
              required
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://sistema.empresa.com.br"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Grupo / Categoria">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  {isCustomLinkCat ? (
                    <Input
                      type="text"
                      required
                      value={linkCat}
                      onChange={(e) => setLinkCat(e.target.value)}
                      placeholder="Nome do Novo Grupo"
                    />
                  ) : (
                    <Select value={linkCat} onChange={(e) => setLinkCat(e.target.value)}>
                      {linkCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {!linkCategories.includes('Sistemas Operacionais') && (
                        <option value="Sistemas Operacionais">Sistemas Operacionais</option>
                      )}
                      {!linkCategories.includes('Portais RH') && <option value="Portais RH">Portais RH</option>}
                      {!linkCategories.includes('Planilhas do Setor') && (
                        <option value="Planilhas do Setor">Planilhas do Setor</option>
                      )}
                    </Select>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsCustomLinkCat(!isCustomLinkCat)}
                  className="shrink-0"
                >
                  {isCustomLinkCat ? 'Selecionar' : '+ Novo'}
                </Button>
              </div>
            </Field>

            <Field label="Turno">
              <Select value={linkShift} onChange={(e) => setLinkShift(e.target.value)}>
                <option value="Todos">Todos</option>
                <option value="T1">T1</option>
                <option value="T2">T2</option>
                <option value="T3">T3</option>
                <option value="ADM">ADM</option>
              </Select>
            </Field>
          </div>

          <Field label="Descrição Curta">
            <Textarea
              rows={2}
              value={linkDesc}
              onChange={(e) => setLinkDesc(e.target.value)}
              placeholder="Instruções breves sobre para que serve este link..."
            />
          </Field>

          {/* Opção de Exibição no Portal do Operador */}
          <div className="p-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-black text-xs text-[var(--ink)]">
                    Exibir no Portal do Operador
                  </div>
                  <div className="text-[11px] text-[var(--muted)] leading-tight">
                    Quando ativado, este link fica acessível para os operadores na aba de Links do Portal.
                  </div>
                </div>
              </div>
              <Toggle
                checked={linkShowInPortal}
                onChange={(val) => setLinkShowInPortal(val)}
                className="shrink-0"
              />
            </div>
            {linkShowInPortal ? (
              <div className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5 shrink-0 fill-emerald-500/20" />
                <span>Atalho visível no Portal do Operador (Mobile).</span>
              </div>
            ) : (
              <div className="text-[10.5px] font-medium text-[var(--muted)] bg-[var(--paper)] px-2.5 py-1.5 rounded-lg flex items-center gap-2 border border-[var(--line)]/60">
                <Smartphone className="w-3.5 h-3.5 shrink-0 opacity-40" />
                <span>Atalho visível apenas aqui no Hub de Informações (Gestão).</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
            <Button variant="outline" onClick={() => setIsLinkModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingLink ? 'Atualizar' : 'Salvar Atalho'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR GRUPO DE PREENCHIMENTO RÁPIDO (COM LISTA DE CÓDIGOS)*/}
      {/* ========================================================================= */}
      <Modal
        isOpen={isQuickFillModalOpen}
        onClose={() => setIsQuickFillModalOpen(false)}
        title={editingQuickFill ? 'Editar Grupo de Códigos' : 'Novo Grupo de Preenchimento Rápido'}
        icon={<Zap className="w-4.5 h-4.5 text-emerald-500" />}
        size="lg"
      >
        <form onSubmit={handleSaveQuickFillGroup} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label={<>Título do Grupo <span className="text-rose-500">*</span></>}>
              <Input
                type="text"
                required
                value={qfTitle}
                onChange={(e) => setQfTitle(e.target.value)}
                placeholder="Ex: Impressoras da Expedição"
              />
            </Field>

            <Field label="Categoria / Agrupamento">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  {isCustomQfCat ? (
                    <Input
                      type="text"
                      required
                      value={qfCat}
                      onChange={(e) => setQfCat(e.target.value)}
                      placeholder="Nome da Nova Categoria"
                    />
                  ) : (
                    <Select value={qfCat} onChange={(e) => setQfCat(e.target.value)}>
                      {quickFillCategories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                      {!quickFillCategories.includes('Impressoras') && <option value="Impressoras">Impressoras</option>}
                      {!quickFillCategories.includes('Respostas Padrão') && (
                        <option value="Respostas Padrão">Respostas Padrão</option>
                      )}
                      {!quickFillCategories.includes('Códigos de Doca') && (
                        <option value="Códigos de Doca">Códigos de Doca</option>
                      )}
                    </Select>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsCustomQfCat(!isCustomQfCat)}
                  className="shrink-0"
                >
                  {isCustomQfCat ? 'Selecionar' : '+ Nova'}
                </Button>
              </div>
            </Field>
          </div>

          <Field label="Descrição do Grupo">
            <Input
              type="text"
              value={qfDesc}
              onChange={(e) => setQfDesc(e.target.value)}
              placeholder="Ex: Lista de impressoras e balanças ativas no setor para emissão de etiquetas"
            />
          </Field>

          <Field
            label="Gatilho de URL (abrir automaticamente)"
            hint="Quando a extensão Dimensio abrir uma página do sistema cujo endereço contém este trecho, este grupo de códigos aparece sozinho para cópia rápida. Ex: impressao (abre ao acessar a página de impressão)."
          >
            <Input
              type="text"
              value={qfTriggerUrl}
              onChange={(e) => setQfTriggerUrl(e.target.value)}
              placeholder="Ex: impressao, etiqueta, expedicao"
            />
          </Field>

          {/* LISTA DE CÓDIGOS / SUB-ITENS DO GRUPO */}
          <div className="space-y-3 pt-2 border-t border-[var(--line)]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)]">
                Códigos do Grupo ({qfItems.length})
              </span>

              <button
                type="button"
                onClick={handleAddQfSubItem}
                className="h-7 px-2.5 inline-flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Outro Código</span>
              </button>
            </div>

            <div className="space-y-3">
              {qfItems.map((item, index) => (
                <div
                  key={item.id || index}
                  className="p-3 bg-[var(--surface-2)] border border-[var(--line)] rounded-lg space-y-2 relative group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-[var(--muted)]">Item #{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveQfSubItem(index)}
                      className="text-rose-500 hover:text-rose-600 p-1 cursor-pointer"
                      title="Remover Código"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      type="text"
                      placeholder="Nome / Identificação (Ex: Balança 04)"
                      value={item.label}
                      onChange={(e) => handleQfSubItemChange(index, 'label', e.target.value)}
                    />
                    <Input
                      type="text"
                      placeholder="Código / Texto para copiar (Ex: PRT-EXP-004)"
                      value={item.codeValue}
                      onChange={(e) => handleQfSubItemChange(index, 'codeValue', e.target.value)}
                      className="font-mono text-emerald-700 dark:text-emerald-300"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--line)]">
            <Field label="Turno Contexto">
              <Select value={qfShift} onChange={(e) => setQfShift(e.target.value)}>
                <option value="Todos">Todos</option>
                <option value="T1">T1</option>
                <option value="T2">T2</option>
                <option value="T3">T3</option>
                <option value="ADM">ADM</option>
              </Select>
            </Field>

            <Field label="Tags (separadas por vírgula)">
              <Input
                type="text"
                value={qfTags}
                onChange={(e) => setQfTags(e.target.value)}
                placeholder="zebra, balança, etiqueta"
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
            <Button variant="outline" onClick={() => setIsQuickFillModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              {editingQuickFill ? 'Atualizar Grupo' : 'Salvar Grupo com Códigos'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: CRIAR NOVO GRUPO OU CATEGORIA                                      */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!isNewGroupModalOpen}
        onClose={() => setIsNewGroupModalOpen(null)}
        title={isNewGroupModalOpen?.type === 'link' ? 'Novo Grupo de Atalhos & Links' : 'Novo Grupo de Preenchimento Rápido'}
        icon={
          <FolderPlus
            className={`w-4.5 h-4.5 ${isNewGroupModalOpen?.type === 'link' ? 'text-blue-500' : 'text-emerald-500'}`}
          />
        }
        size="sm"
      >
        <form onSubmit={handleConfirmCreateGroup} className="space-y-4">
          <Field
            label={<>Nome do Grupo / Categoria <span className="text-rose-500">*</span></>}
            hint="Ao criar o grupo, você poderá imediatamente cadastrar os primeiros itens vinculados a ele."
          >
            <Input
              type="text"
              required
              autoFocus
              value={newGroupNameInput}
              onChange={(e) => setNewGroupNameInput(e.target.value)}
              placeholder={
                isNewGroupModalOpen?.type === 'link'
                  ? 'Ex: Portais de Logística, Sistemas RH, Planilhas de Turno'
                  : 'Ex: Impressoras Zebra, Respostas de SAC, Códigos SAP'
              }
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
            <Button variant="outline" onClick={() => setIsNewGroupModalOpen(null)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Criar Grupo
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: RENOMEAR GRUPO                                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!renamingCategory}
        onClose={() => setRenamingCategory(null)}
        title="Renomear Grupo"
        icon={<Pencil className="w-4.5 h-4.5 text-indigo-500" />}
        size="sm"
      >
        <form onSubmit={handleConfirmRenameCategory} className="space-y-4">
          <Field
            label="Novo Nome do Grupo"
            hint={`Todos os itens pertencentes ao grupo antigo "${renamingCategory?.oldName}" serão atualizados automaticamente.`}
          >
            <Input
              type="text"
              required
              autoFocus
              value={renamingCategory?.newName ?? ''}
              onChange={(e) =>
                setRenamingCategory(
                  renamingCategory ? { ...renamingCategory, newName: e.target.value } : renamingCategory
                )
              }
            />
          </Field>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--line)]">
            <Button variant="outline" onClick={() => setRenamingCategory(null)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit">
              Salvar Alteração
            </Button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: EXCLUIR GRUPO                                                      */}
      {/* ========================================================================= */}
      <Modal
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        title="Excluir Grupo"
        icon={<Trash2 className="w-4.5 h-4.5 text-rose-500" />}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeletingCategory(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleConfirmDeleteCategory}>
              Sim, Excluir Grupo
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-xs font-bold text-[var(--ink)]">
            Tem certeza que deseja excluir o grupo "{deletingCategory?.name}"?
          </p>
          <p className="text-xs text-[var(--muted)]">
            Esta ação removerá todos os atalhos ou itens de preenchimento vinculados a este grupo.
          </p>
        </div>
      </Modal>
    </div>
  );
};
