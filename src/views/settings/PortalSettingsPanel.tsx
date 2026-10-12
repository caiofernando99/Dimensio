import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SupportTypeField, ActionLinkVar } from '../../types';
import { encodeConnectionParams } from '../../utils/urlConnection';
import { SupportTypeFieldsEditor, SupportActionLinkEditor } from './SupportTypeEditors';
import {
  BellRing,
  ExternalLink,
  Headphones,
  Link as LinkIcon,
  Pencil,
  Plus,
  Radio,
  Shuffle,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Vibrate,
  Volume2,
} from 'lucide-react';

interface PortalSettingsPanelProps {
  checkPermissionOrAlert: (requireAdmin?: boolean) => boolean;
}

export const PortalSettingsPanel: React.FC<PortalSettingsPanelProps> = ({
  checkPermissionOrAlert,
}) => {
  const {
    state,
    showNotice,
    updateHelpdeskConfig,
    updatePortalNotificationConfig,
    setPortalNameAbbreviation,
    setOnlineSpreadsheetConfig,
    setModuleVisibility,
    syncToOnlineSpreadsheet,
  } = useApp();

  const [portalPresetShift, setPortalPresetShift] = useState<string>('all');
  const [employeePresetShift, setEmployeePresetShift] = useState<string>('all');
  const [portalPresetRoles, setPortalPresetRoles] = useState<string[]>([]);
  const [portalPresetCategories, setPortalPresetCategories] = useState<string[]>([]);
  const [portalPresetOnlyMine, setPortalPresetOnlyMine] = useState<boolean>(false);

  // Helpdesk & Support Type Management State in Settings
  const [newSupportTypeName, setNewSupportTypeName] = useState('');
  const [newSupportTypePriority, setNewSupportTypePriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [newSupportTypePlaceholder, setNewSupportTypePlaceholder] = useState('');
  const [newSupportTypeActionLink, setNewSupportTypeActionLink] = useState('');
  const [newSupportTypeActionLinkVars, setNewSupportTypeActionLinkVars] = useState<ActionLinkVar[]>([]);
  const [editingSupportTypeId, setEditingSupportTypeId] = useState<string | null>(null);
  const [editingSupportTypeName, setEditingSupportTypeName] = useState('');
  const [editingSupportTypePriority, setEditingSupportTypePriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>('media');
  const [editingSupportTypeFields, setEditingSupportTypeFields] = useState<SupportTypeField[]>([]);
  const [editingSupportTypeActionLink, setEditingSupportTypeActionLink] = useState('');
  const [editingSupportTypeActionLinkVars, setEditingSupportTypeActionLinkVars] = useState<ActionLinkVar[]>([]);
  const [newSupportTypeFields, setNewSupportTypeFields] = useState<SupportTypeField[]>([]);

  return (
        <div className="space-y-4">
          {/* Header Card */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-2 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-[var(--ink)]">
                  Painel & Portal da Base Operacional
                </h2>
                <p className="text-xs text-[var(--muted)] font-medium">
                  Central de links dedicados, acessos rápidos para dispositivos móveis, filtros pré-configurados e gerenciamento da Central de Atendimento.
                </p>
              </div>
            </div>
          </div>

          {/* 1. SEÇÃO CENTRAL DE ATENDIMENTO & SUPORTE */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-400 flex items-center justify-center font-black">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
                    Fluxo de Suporte & Central de Atendimento Operacional
                  </h3>
                  <p className="text-[10.5px] text-[var(--muted)]">
                    Configure as regras de atendimento, alertas sonoros, tipos de chamado e cargos autorizados para atender
                  </p>
                </div>
              </div>

              <span className={`px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider ${
                state.helpdeskConfig?.enabled !== false
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-600 border border-rose-500/30'
              }`}>
                {state.helpdeskConfig?.enabled !== false ? 'Atendimento Ativo' : 'Desativado'}
              </span>
            </div>

            {/* Configurações Globais de Atendimento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.helpdeskConfig?.enabled !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold">Habilitar Chamados de Suporte</div>
                  <div className="text-[10px] font-medium opacity-80">Permitir que operadores e painéis enviem pedidos de ajuda</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.helpdeskConfig?.enabled !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateHelpdeskConfig({ enabled: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.helpdeskConfig?.notifySound !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold">Alerta Sonoro de Novos Chamados</div>
                  <div className="text-[10px] font-medium opacity-80">Tocar sinal sonoro quando um novo chamado de suporte entrar na fila</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.helpdeskConfig?.notifySound !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateHelpdeskConfig({ notifySound: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>
            </div>

            {/* Cargos Autorizados para Atendimento */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-extrabold text-[var(--ink)] uppercase tracking-wider">
                  Cargos com Permissão para Atender a Fila (Equipe de Suporte do Turno):
                </div>
                <span className="text-[10px] font-bold text-[var(--primary)]">
                  {(state.helpdeskConfig?.supportRoles || []).length} cargo(s) selecionado(s)
                </span>
              </div>
              <p className="text-[10px] text-[var(--muted)]">
                Usuários identificados com estes cargos terão acesso ao botão "Atender", contador de TMA e resolução dos chamados.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {state.roles.map((r) => {
                  const currentSupportRoles = state.helpdeskConfig?.supportRoles || ['Suporte', 'TL', 'Supervisor', 'Analista', 'Administrador'];
                  const isSupportRole = currentSupportRoles.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        if (!checkPermissionOrAlert()) return;
                        const newRoles = isSupportRole
                          ? currentSupportRoles.filter((item) => item !== r)
                          : [...currentSupportRoles, r];
                        updateHelpdeskConfig({ supportRoles: newRoles });
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSupportRole
                          ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                          : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink)] hover:border-violet-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSupportRole}
                        readOnly
                        className="w-3 h-3 rounded pointer-events-none"
                      />
                      <span>{r}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Gestão de Tipos de Pedido / Presets */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-[11px] font-extrabold text-[var(--ink)] uppercase tracking-wider">
                  Tipos de Chamado Pré-configurados (Opções para o Colaborador):
                </div>
                <div className="flex items-center gap-2">
                  {(state.helpdeskConfig?.supportTypes || []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!checkPermissionOrAlert()) return;
                        if (!confirm('Deseja realmente remover todos os tipos de chamado cadastrados?')) return;
                        updateHelpdeskConfig({ supportTypes: [] });
                        showNotice('Todos os tipos de chamados foram removidos.');
                      }}
                      className="px-2.5 py-1 bg-[var(--paper)] border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                      title="Limpar todos os tipos cadastrados"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Limpar Todos</span>
                    </button>
                  )}
                  <span className="text-[10px] font-bold text-[var(--muted)]">
                    {(state.helpdeskConfig?.supportTypes || []).length} tipo(s) cadastrado(s)
                  </span>
                </div>
              </div>

              {/* Lista de Tipos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(state.helpdeskConfig?.supportTypes || []).map((preset) => {
                  const priorityColors = {
                    baixa: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-400/30',
                    media: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-400/30',
                    alta: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/30',
                    urgente: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-400/30',
                  };

                  return (
                    <div
                      key={preset.id}
                      className="p-2.5 bg-[var(--paper)] border border-[var(--line)] rounded-xl flex items-center justify-between gap-2 shadow-2xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--ink)] truncate">{preset.name}</span>
                          <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-black uppercase border ${priorityColors[preset.priority] || priorityColors.media}`}>
                            {preset.priority}
                          </span>
                        </div>
                        {preset.placeholder && (
                          <div className="text-[10px] text-[var(--muted)] truncate opacity-80">{preset.placeholder}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSupportTypeId(preset.id);
                            setEditingSupportTypeName(preset.name);
                            setEditingSupportTypePriority(preset.priority);
                            setEditingSupportTypeFields(preset.fields || []);
                            setEditingSupportTypeActionLink(preset.actionLink || '');
                            setEditingSupportTypeActionLinkVars(preset.actionLinkVars || []);
                          }}
                          className="p-1.5 text-[var(--muted)] hover:text-[var(--primary)] hover:bg-[var(--bg)] rounded-lg transition-colors cursor-pointer"
                          title="Editar tipo"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!checkPermissionOrAlert()) return;
                            const updated = (state.helpdeskConfig?.supportTypes || []).filter((p) => p.id !== preset.id);
                            updateHelpdeskConfig({ supportTypes: updated });
                            showNotice(`Tipo "${preset.name}" removido.`);
                          }}
                          className="p-1.5 text-[var(--muted)] hover:text-rose-600 hover:bg-[var(--bg)] rounded-lg transition-colors cursor-pointer"
                          title="Excluir tipo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Modal / Edição Inline */}
              {editingSupportTypeId && (
                <div className="p-3 bg-[var(--paper)] border-2 border-violet-500 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-[var(--ink)]">Editar Tipo de Chamado</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editingSupportTypeName}
                      onChange={(e) => setEditingSupportTypeName(e.target.value)}
                      placeholder="Nome do tipo"
                      className="sm:col-span-2 px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--ink)] focus:outline-none focus:border-violet-500 font-bold"
                    />
                    <select
                      value={editingSupportTypePriority}
                      onChange={(e) => setEditingSupportTypePriority(e.target.value as any)}
                      className="px-2.5 py-1.5 text-xs bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[var(--ink)] font-bold focus:outline-none"
                    >
                      <option value="baixa">Baixa</option>
                      <option value="media">Média</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente</option>
                    </select>
                  </div>
                  <SupportTypeFieldsEditor fields={editingSupportTypeFields} onChange={setEditingSupportTypeFields} />
                  <SupportActionLinkEditor
                    value={editingSupportTypeActionLink}
                    vars={editingSupportTypeActionLinkVars}
                    fields={editingSupportTypeFields}
                    onValueChange={setEditingSupportTypeActionLink}
                    onVarsChange={setEditingSupportTypeActionLinkVars}
                  />
                  <div className="flex justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setEditingSupportTypeId(null)}
                      className="px-2.5 py-1 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!editingSupportTypeName.trim()) return;
                        const updated = (state.helpdeskConfig?.supportTypes || []).map((t) =>
                          t.id === editingSupportTypeId
                            ? {
                                ...t,
                                name: editingSupportTypeName.trim(),
                                priority: editingSupportTypePriority,
                                fields: editingSupportTypeFields,
                                actionLink: editingSupportTypeActionLink.trim() || undefined,
                                actionLinkVars:
                                  editingSupportTypeActionLinkVars.length > 0
                                    ? editingSupportTypeActionLinkVars
                                    : undefined,
                              }
                            : t
                        );
                        updateHelpdeskConfig({ supportTypes: updated });
                        setEditingSupportTypeId(null);
                        showNotice('Tipo de chamado atualizado!');
                      }}
                      className="px-3 py-1 bg-violet-600 text-white text-xs font-bold rounded-lg hover:bg-violet-700"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </div>
              )}

              {/* Form para adicionar novo tipo */}
              <div className="pt-2 border-t border-[var(--line)]">
                <div className="text-[10.5px] font-bold text-[var(--ink)] mb-1.5 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5 text-violet-600" />
                  <span>Adicionar Novo Tipo de Chamado:</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={newSupportTypeName}
                    onChange={(e) => setNewSupportTypeName(e.target.value)}
                    placeholder="Ex.: Troca de Coletor / Bateria"
                    className="sm:col-span-2 px-3 py-1.5 text-xs bg-[var(--paper)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none focus:border-violet-500 font-bold"
                  />
                  <select
                    value={newSupportTypePriority}
                    onChange={(e) => setNewSupportTypePriority(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs bg-[var(--paper)] border border-[var(--line)] rounded-xl text-[var(--ink)] font-bold focus:outline-none"
                  >
                    <option value="baixa">Prioridade: Baixa</option>
                    <option value="media">Prioridade: Média</option>
                    <option value="alta">Prioridade: Alta</option>
                    <option value="urgente">Prioridade: Urgente</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!checkPermissionOrAlert()) return;
                      if (!newSupportTypeName.trim()) {
                        showNotice('Digite o nome do tipo de chamado.');
                        return;
                      }
                      const newId = `type_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
                      const newType = {
                        id: newId,
                        name: newSupportTypeName.trim(),
                        priority: newSupportTypePriority,
                        ...(newSupportTypePlaceholder.trim() ? { placeholder: newSupportTypePlaceholder.trim() } : {}),
                        ...(newSupportTypeFields.length > 0 ? { fields: newSupportTypeFields } : {}),
                        ...(newSupportTypeActionLink.trim() ? { actionLink: newSupportTypeActionLink.trim() } : {}),
                        ...(newSupportTypeActionLinkVars.length > 0 ? { actionLinkVars: newSupportTypeActionLinkVars } : {}),
                      };
                      const currentTypes = state.helpdeskConfig?.supportTypes || [];
                      updateHelpdeskConfig({ supportTypes: [...currentTypes, newType] });
                      setNewSupportTypeName('');
                      setNewSupportTypePlaceholder('');
                      setNewSupportTypeFields([]);
                      setNewSupportTypeActionLink('');
                      setNewSupportTypeActionLinkVars([]);
                      showNotice(`Tipo "${newType.name}" cadastrado com sucesso!`);
                    }}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar</span>
                  </button>
                </div>
                <div className="mt-3">
                  <SupportTypeFieldsEditor fields={newSupportTypeFields} onChange={setNewSupportTypeFields} />
                </div>
                <div className="mt-2">
                  <SupportActionLinkEditor
                    value={newSupportTypeActionLink}
                    vars={newSupportTypeActionLinkVars}
                    fields={newSupportTypeFields}
                    onValueChange={setNewSupportTypeActionLink}
                    onVarsChange={setNewSupportTypeActionLinkVars}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 1.5 SEÇÃO NOTIFICAÇÕES DO PORTAL */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
                    Notificações do Portal
                  </h3>
                  <p className="text-[10.5px] text-[var(--muted)]">
                    Configure quais alertas os operadores recebem no Portal da Base (som, vibração, redirecionamentos, avisos de turno e status de suporte)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.portalNotificationConfig?.soundAlerts !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <Volume2 className="w-3.5 h-3.5" />
                    Alerta Sonoro
                  </div>
                  <div className="text-[10px] font-medium opacity-80">Tocar sinal sonoro nas notificações e alertas do portal</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.portalNotificationConfig?.soundAlerts !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updatePortalNotificationConfig({ soundAlerts: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.portalNotificationConfig?.vibrationAlerts === true
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <Vibrate className="w-3.5 h-3.5" />
                    Vibração do Dispositivo
                  </div>
                  <div className="text-[10px] font-medium opacity-80">Vibrar o coletor/dispositivo quando houver novos alertas</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.portalNotificationConfig?.vibrationAlerts === true}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updatePortalNotificationConfig({ vibrationAlerts: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.portalNotificationConfig?.taskRedirectionAlert !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5" />
                    Redirecionamento de Tarefa
                  </div>
                  <div className="text-[10px] font-medium opacity-80">Alertar o operador quando for redirecionado para uma nova tarefa</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.portalNotificationConfig?.taskRedirectionAlert !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updatePortalNotificationConfig({ taskRedirectionAlert: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.portalNotificationConfig?.shiftNotices !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" />
                    Avisos de Turno
                  </div>
                  <div className="text-[10px] font-medium opacity-80">Exibir avisos direcionados ao turno do operador (troca de turno e comunicados)</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.portalNotificationConfig?.shiftNotices !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updatePortalNotificationConfig({ shiftNotices: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              <label className={`p-3.5 rounded-xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                state.portalNotificationConfig?.supportStatusAlerts !== false
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--ink)]'
                  : 'border-[var(--line)] bg-[var(--bg)] text-[var(--muted)]'
              }`}>
                <div>
                  <div className="text-xs font-extrabold flex items-center gap-1.5">
                    <Headphones className="w-3.5 h-3.5" />
                    Status de Suporte
                  </div>
                  <div className="text-[10px] font-medium opacity-80">Notificar o solicitante quando o chamado de suporte for atendido, resolvido ou cancelado</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.portalNotificationConfig?.supportStatusAlerts !== false}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updatePortalNotificationConfig({ supportStatusAlerts: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 2. SEÇÃO MEU PAINEL (PAINEL DO COLABORADOR POR TURNO) */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-xs font-mono">
                  M
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
                    Meu Painel — Gerador de Link do Colaborador por Turno
                  </h3>
                  <p className="text-[10.5px] text-[var(--muted)]">
                    Gere um link exclusivo para cada turno (T1, T2, T3, etc.) para que seus colaboradores recebam as informações, avisos e solicitem suporte
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.showEmployeePortal !== false}
                    onChange={(e) => {
                      if (!checkPermissionOrAlert()) return;
                      setModuleVisibility({ showEmployeePortal: e.target.checked });
                    }}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-[var(--ink)]">Ativo no App</span>
                </label>
              </div>
            </div>

            {/* SELEÇÃO DO TURNO DO LINK */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-3.5 rounded-2xl space-y-3">
              <div className="text-[11px] font-extrabold text-[var(--ink)] flex items-center gap-1.5 uppercase tracking-wider">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>Selecione o Turno do Link do Colaborador:</span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setEmployeePresetShift('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    employeePresetShift === 'all'
                      ? 'bg-[var(--primary)] text-white shadow-2xs'
                      : 'bg-[var(--paper)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  Todos os Turnos
                </button>
                {(state.shifts || ['T1', 'T2', 'T3', 'T4', 'ADM']).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEmployeePresetShift(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      employeePresetShift === s
                        ? 'bg-[var(--primary)] text-white shadow-2xs'
                        : 'bg-[var(--paper)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    Turno {s}
                  </button>
                ))}
              </div>
            </div>

            {/* DYNAMIC EMPLOYEE LINK URL FIELD */}
            {(() => {
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
              const params = new URLSearchParams();
              params.set('view', 'employee');
              if (employeePresetShift !== 'all') params.set('shift', employeePresetShift);

              if (state.onlineSpreadsheet?.url || state.onlineSpreadsheet?.webhookUrl) {
                const cx = encodeConnectionParams({
                  sheetUrl: state.onlineSpreadsheet.url,
                  webhookUrl: state.onlineSpreadsheet.webhookUrl,
                  sheetName: state.onlineSpreadsheet.name,
                  teamName: state.teamName,
                });
                if (cx) {
                  params.set('cx', cx);
                }
              }

              const generatedEmpUrl = `${origin}${pathname}?${params.toString()}`;

              return (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--ink)] block">
                    Link Gerado para o Painel do Colaborador ({employeePresetShift === 'all' ? 'Geral' : `Turno ${employeePresetShift}`}):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedEmpUrl}
                      className="flex-1 px-3 py-2 text-xs font-mono bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedEmpUrl);
                        showNotice(`Link do Painel do Colaborador (${employeePresetShift === 'all' ? 'Todos os turnos' : `Turno ${employeePresetShift}`}) copiado!`);
                      }}
                      className="px-3.5 py-2 bg-[var(--primary)] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-[var(--primary-dark)] cursor-pointer transition-colors shadow-2xs shrink-0"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Copiar Link</span>
                    </button>
                    <a
                      href={generatedEmpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Testar Link</span>
                    </a>
                  </div>
                  <p className="text-[10px] text-[var(--muted)] font-medium leading-relaxed pt-1">
                    💡 <strong>Como usar:</strong> Envie este link para os colaboradores do <strong>{employeePresetShift === 'all' ? 'seu time' : `Turno ${employeePresetShift}`}</strong> via WhatsApp ou atalho. Ao abrir no celular, o painel se conectará automaticamente com as informações sincronizadas do turno.
                  </p>
                </div>
              );
            })()}
          </div>

          {/* 3. SEÇÃO PORTAL DA BASE OPERACIONAL (INTERFACE DE COLETORES) */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs font-mono">
                  P
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink)]">
                    Portal da Base — Gerador de Link para Dispositivos Móveis e Coletores
                  </h3>
                  <p className="text-[10.5px] text-[var(--muted)]">
                    Configure os filtros padrão desejados para enviar o link pré-filtrado para coletores Honeywell RFID, tablets ou WhatsApp da equipe
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.showOperatorPortal !== false}
                    onChange={(e) => {
                      if (!checkPermissionOrAlert()) return;
                      setModuleVisibility({ showOperatorPortal: e.target.checked });
                    }}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-[var(--ink)]">Ativo no App</span>
                </label>
              </div>
            </div>

            {/* CONTROLES DE FILTRO PRÉ-CONFIGURADO DO LINK */}
            <div className="bg-[var(--bg)] border border-[var(--line)] p-3.5 rounded-2xl space-y-3">
              <div className="text-[11px] font-extrabold text-[var(--ink)] flex items-center gap-1.5 uppercase tracking-wider">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--primary)]" />
                <span>Configurar Filtros Padrão do Link do Portal:</span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Turno */}
                <div>
                  <label className="block text-[10px] font-bold text-[var(--muted)] mb-1 uppercase">
                    Turno Padrão:
                  </label>
                  <select
                    value={portalPresetShift}
                    onChange={(e) => setPortalPresetShift(e.target.value)}
                    className="w-full max-w-xs px-2.5 py-1.5 text-xs bg-[var(--paper)] border border-[var(--line)] rounded-xl font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--primary)]"
                  >
                    <option value="all">Todos os Turnos</option>
                    {(state.shifts || ['T1', 'T2', 'T3', 'T4', 'T5']).map((s) => (
                      <option key={s} value={s}>
                        Turno {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cargos (Multisseleção) */}
                <div className="space-y-1.5 border-t border-[var(--line)] pt-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase">
                      Filtro de Cargo(s) (Multisseleção):
                    </label>
                    <span className="text-[10px] font-bold text-[var(--primary)]">
                      {portalPresetRoles.length === 0 ? 'Todos os Cargos' : `${portalPresetRoles.length} selecionado(s)`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {state.roles.map((r) => {
                      const checked = portalPresetRoles.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => {
                            if (checked) {
                              setPortalPresetRoles(portalPresetRoles.filter((item) => item !== r));
                            } else {
                              setPortalPresetRoles([...portalPresetRoles, r]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            checked
                              ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs'
                              : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            className="w-3 h-3 rounded pointer-events-none"
                          />
                          <span>{r}</span>
                        </button>
                      );
                    })}
                    {portalPresetRoles.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPortalPresetRoles([])}
                        className="px-2 py-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 underline cursor-pointer"
                      >
                        Limpar Cargos
                      </button>
                    )}
                  </div>
                </div>

                {/* Categorias (Multisseleção) */}
                <div className="space-y-1.5 border-t border-[var(--line)] pt-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-[var(--muted)] uppercase">
                      Filtro de Categoria(s) (Multisseleção):
                    </label>
                    <span className="text-[10px] font-bold text-[var(--primary)]">
                      {portalPresetCategories.length === 0 ? 'Todas as Categorias' : `${portalPresetCategories.length} selecionada(s)`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {state.categories.map((cat) => {
                      const checked = portalPresetCategories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            if (checked) {
                              setPortalPresetCategories(portalPresetCategories.filter((item) => item !== cat));
                            } else {
                              setPortalPresetCategories([...portalPresetCategories, cat]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            checked
                              ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs'
                              : 'bg-[var(--paper)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            readOnly
                            className="w-3 h-3 rounded pointer-events-none"
                          />
                          <span>{cat}</span>
                        </button>
                      );
                    })}
                    {portalPresetCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPortalPresetCategories([])}
                        className="px-2 py-1 text-[10px] font-bold text-rose-500 hover:text-rose-600 underline cursor-pointer"
                      >
                        Limpar Categorias
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Exibição: Apenas tarefas do operador x Todas */}
              <div className="pt-2 border-t border-[var(--line)] flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={portalPresetOnlyMine}
                    onChange={(e) => setPortalPresetOnlyMine(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-[var(--ink)]">
                    Abrir diretamente em "Minhas Tarefas" (filtrado pelo operador logado)
                  </span>
                </label>

                {(portalPresetShift !== 'all' || portalPresetRoles.length > 0 || portalPresetCategories.length > 0 || portalPresetOnlyMine) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPortalPresetShift('all');
                      setPortalPresetRoles([]);
                      setPortalPresetCategories([]);
                      setPortalPresetOnlyMine(false);
                    }}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                  >
                    Resetar Filtros
                  </button>
                )}
              </div>

              {/* Abreviar nomes dos colaboradores no Portal */}
              <label className="pt-2 border-t border-[var(--line)] flex items-center justify-between gap-3 cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={state.abbreviatePortalNames === true}
                    onChange={(e) => {
                      if (!checkPermissionOrAlert()) return;
                      setPortalNameAbbreviation(e.target.checked);
                    }}
                    className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-[var(--ink)]">
                    Abreviar nomes dos colaboradores no Portal
                  </span>
                </div>
                <span className="text-[10px] text-[var(--muted)] font-medium text-right max-w-[220px]">
                  Ex.: "Maria Silva Souza" → "Maria S."
                </span>
              </label>
            </div>

            {/* DYNAMIC URL FIELD */}
            {(() => {
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
              const params = new URLSearchParams();
              params.set('view', 'portal');
              if (portalPresetShift !== 'all') params.set('shift', portalPresetShift);
              if (portalPresetRoles.length > 0) params.set('roles', portalPresetRoles.join(','));
              if (portalPresetCategories.length > 0) params.set('categories', portalPresetCategories.join(','));
              if (portalPresetOnlyMine) params.set('onlyMine', 'true');
              if (state.abbreviatePortalNames === true) params.set('abbrev', 'true');

              // Attach masked connection data so the link connects automatically without exposing raw spreadsheet/webhook URLs
              if (state.onlineSpreadsheet?.url || state.onlineSpreadsheet?.webhookUrl) {
                const cx = encodeConnectionParams({
                  sheetUrl: state.onlineSpreadsheet.url,
                  webhookUrl: state.onlineSpreadsheet.webhookUrl,
                  sheetName: state.onlineSpreadsheet.name,
                  teamName: state.teamName,
                });
                if (cx) {
                  params.set('cx', cx);
                }
              }

              const generatedUrl = `${origin}${pathname}?${params.toString()}`;

              return (
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-[var(--ink)] block">
                    Link do Portal com Filtros Aplicados:
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedUrl}
                      className="flex-1 px-3 py-2 text-xs font-mono bg-[var(--bg)] border border-[var(--line)] rounded-xl text-[var(--ink)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedUrl);
                        showNotice('Link do Portal com filtros copiado com sucesso!');
                      }}
                      className="px-3.5 py-2 bg-[var(--primary)] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 hover:bg-[var(--primary-dark)] cursor-pointer transition-colors shadow-2xs shrink-0"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      <span>Copiar Link</span>
                    </button>
                    <a
                      href={generatedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-[var(--bg)] border border-[var(--line)] hover:border-[var(--primary)] text-[var(--ink)] text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[var(--primary)]" />
                      <span>Testar Link</span>
                    </a>
                  </div>
                  <p className="text-[10px] text-[var(--muted)] font-medium leading-relaxed pt-1">
                    💡 <strong>Como usar:</strong> Cole este link nos coletores da equipe ou distribua o link para a operação. Ao ser aberto, o Portal inicializará automaticamente com os filtros configurados e a interface isolada para a base operacional.
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
  );
};
