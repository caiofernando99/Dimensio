import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Camera,
  Send,
  X,
  CheckCircle2,
  Clock,
  Trash2,
  Copy,
  Check,
  Maximize2,
  FileCode,
  Tag,
  AlertCircle,
  Video,
  Headphones,
  Sparkles,
  HelpCircle,
  Layers,
  ChevronRight,
  RotateCcw,
  Lock,
  ExternalLink,
} from 'lucide-react';
import { formatDateBR, compressImageDataUrl } from '../utils/helpers';
import { resolveSupportActionLink, formatSupportFieldsForClipboard } from '../utils/supportActionLink';
import { formatSupportFieldValue, formatSupportFieldValueLive } from '../utils/fieldFormat';
import { ActionLinkVar, SupportTypeField, SupportTypePreset } from '../types';

interface SenderOverride {
  id: string;
  name: string;
  role?: string;
  shift?: string;
  category?: string;
}

interface SupportCodeDispatcherProps {
  taskId?: string;
  taskName?: string;
  channelId?: string;
  compact?: boolean;
  senderOverride?: SenderOverride;
  isPortalView?: boolean;
}

const DEFAULT_SUPPORT_PRESETS: SupportTypePreset[] = [
  { id: 'preset_coletor', name: 'Problema no Coletor / Equipamento', priority: 'alta', description: '📱' },
  { id: 'preset_sistema', name: 'Suporte Técnico / Sistema', priority: 'media', description: '💻' },
  { id: 'preset_tarefa', name: 'Ajuste de Tarefa / Troca', priority: 'media', description: '🔄' },
  { id: 'preset_processo', name: 'Dúvida de Processo / Qualidade', priority: 'baixa', description: '❓' },
  { id: 'preset_tl', name: 'Liberação / Autorização TL', priority: 'alta', description: '🔑' },
  { id: 'preset_etiqueta', name: 'Troca de Etiqueta / Impressora', priority: 'media', description: '🏷️' },
  { id: 'preset_outros', name: 'Outros Assuntos', priority: 'baixa', description: '💬' },
];

export const SupportCodeDispatcher: React.FC<SupportCodeDispatcherProps> = ({
  taskId,
  taskName,
  channelId,
  compact = false,
  senderOverride,
  isPortalView = false,
}) => {
  const {
    state,
    identifiedUser,
    addSupportMessage,
    acceptSupportMessage,
    resolveSupportMessage,
    deleteSupportMessage,
    showNotice,
  } = useApp();

  const presets = state.helpdeskConfig?.supportTypes && state.helpdeskConfig.supportTypes.length > 0
    ? state.helpdeskConfig.supportTypes
    : DEFAULT_SUPPORT_PRESETS;

  const [selectedType, setSelectedType] = useState<string>(presets[0]?.name || 'Problema no Coletor / Equipamento');
  const [codeText, setCodeText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);
  const [copiedAllId, setCopiedAllId] = useState<string | null>(null);

  const selectedPreset = presets.find((p) => p.name === selectedType) || presets[0];
  const activeFields = selectedPreset?.fields || [];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Active user / sender identification
  const currentSenderId = senderOverride?.id || (identifiedUser ? String(identifiedUser.collaboratorId || identifiedUser.id) : '');
  const isSupportStaff = Boolean(
    identifiedUser?.isAdmin ||
    identifiedUser?.isEditor ||
    (state.helpdeskConfig?.supportRoles || ['Suporte', 'TL', 'Admin']).some((r) =>
      identifiedUser?.role?.toLowerCase().includes(r.toLowerCase())
    )
  );

  // Tasks contextualized by the current identification (dimensioned, allowed role or category)
  const myTasks = useMemo(() => {
    if (!currentSenderId) return [];
    return state.tasks.filter((t) => {
      if (t.active === false) return false;
      const byMember = t.members.includes(currentSenderId);
      const byRole = !!identifiedUser?.role && t.allowedRoles?.includes(identifiedUser.role);
      const byCategory = !!identifiedUser?.category && t.allowedCategories?.includes(identifiedUser.category);
      return byMember || byRole || byCategory;
    });
  }, [state.tasks, currentSenderId, identifiedUser?.role, identifiedUser?.category]);

  // Pre-select the dimensioned task (where the user is a member) or the taskId prop
  const dimensionedTask = useMemo(
    () => state.tasks.find((t) => t.active !== false && t.members.includes(currentSenderId)),
    [state.tasks, currentSenderId]
  );

  const [selectedTaskId, setSelectedTaskId] = useState<string>(() => {
    if (taskId) return taskId;
    return dimensionedTask?.id || '';
  });

  useEffect(() => {
    if (taskId) {
      setSelectedTaskId(taskId);
    }
  }, [taskId]);

  const selectedTask = state.tasks.find((t) => t.id === selectedTaskId);

  // Filter messages
  const messages = (state.supportMessages || []).filter((m) => {
    if (taskId) return m.taskId === taskId;
    if (channelId) return m.channelId === channelId;
    if (isPortalView && currentSenderId) {
      // In operator portal, show my requests or requests in my selected task
      return m.senderId === currentSenderId || (selectedTaskId && m.taskId === selectedTaskId);
    }
    return true;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      showNotice('A imagem deve ter no máximo 8MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await compressImageDataUrl(reader.result as string, 640, 0.6);
      setSelectedImage(compressed);
    };
    reader.readAsDataURL(file);
  };

  const startLiveCamera = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        fileInputRef.current?.click();
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Erro ao abrir câmera:', err);
      fileInputRef.current?.click();
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && mediaStreamRef.current) {
      videoRef.current.srcObject = mediaStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  const stopLiveCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhotoFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      compressImageDataUrl(dataUrl, 640, 0.6).then(setSelectedImage);
    }
    stopLiveCamera();
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = codeText.trim().slice(0, 80);

    // Validate required custom fields before sending
    for (const f of activeFields) {
      const value = (fieldValues[f.id] || '').trim();
      if (f.required && !value) {
        showNotice(`Preencha o campo "${f.label}" para enviar o pedido.`);
        return;
      }
    }

    const presetObj = presets.find((p) => p.name === selectedType);
    const priority = (presetObj?.priority as 'baixa' | 'media' | 'alta' | 'urgente') || 'media';

    const fields = activeFields
      .map((f) => ({
        id: f.id,
        label: f.label,
        key: f.key,
        value: formatSupportFieldValue(fieldValues[f.id] || '', f),
      }))
      .filter((f) => f.value.length > 0);

    addSupportMessage({
      codeText: activeFields.length > 0 ? undefined : cleanCode,
      imageUrl: selectedImage || undefined,
      supportType: selectedType,
      priority,
      taskId: selectedTaskId || taskId,
      taskName: selectedTask?.name || taskName,
      channelId,
      senderOverride,
      fields: fields.length > 0 ? fields : undefined,
    });

    setCodeText('');
    setFieldValues({});
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopyCode = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showNotice(`Código copiado para a área de transferência!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyField = async (key: string, value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedFieldId(id);
      setTimeout(() => setCopiedFieldId(null), 2000);
      showNotice('Valor copiado para a área de transferência!');
    } catch {
      showNotice('Erro ao copiar valor.');
    }
  };

  const handleCopyAllFields = async (id: string, fields?: Array<{ id: string; label: string; value: string; key?: string }>) => {
    const text = formatSupportFieldsForClipboard(fields);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAllId(id);
      setTimeout(() => setCopiedAllId(null), 2000);
      showNotice('Todos os campos copiados para a área de transferência!');
    } catch {
      showNotice('Erro ao copiar os campos.');
    }
  };

  const handleOpenActionLink = (msg: { supportType?: string; fields?: Array<{ id: string; label: string; value: string; key?: string }>; senderName?: string; senderShift?: string; senderCategory?: string; codeText?: string }) => {
    const preset = presets.find((p) => p.name === msg.supportType);
    const template = preset?.actionLink;
    const linkVars: ActionLinkVar[] | undefined = preset?.actionLinkVars;
    const textToCopy = formatSupportFieldsForClipboard(msg.fields);
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).catch(() => undefined);
    }
    if (template) {
      const url = resolveSupportActionLink(template, linkVars, {
        fields: msg.fields,
        senderName: msg.senderName,
        senderShift: msg.senderShift,
        senderCategory: msg.senderCategory,
        supportType: msg.supportType,
        codeText: msg.codeText,
      });
      window.open(url, '_blank', 'noopener,noreferrer');
      showNotice('📋 Dados copiados e link aberto no sistema!');
    } else {
      showNotice('Nenhum link de sistema configurado para este tipo de pedido.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Form Card */}
      <form
        onSubmit={handleSend}
        className="bg-[var(--paper)] border border-[var(--line)] p-4 sm:p-5 rounded-2xl shadow-2xs space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Headphones className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
                <span>Solicitar Suporte & Ajuda na Base</span>
              </h3>
              <p className="text-[11px] text-[var(--muted)]">
                Selecione o tipo do pedido, preencha os dados solicitados e envie uma foto da câmera
              </p>
            </div>
          </div>
          {(taskName || (selectedTask && selectedTaskId)) && (
            <span className="px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-[10.5px] font-black text-[var(--primary)] shrink-0">
              {selectedTask?.name || taskName}
            </span>
          )}
        </div>

        {/* Support Type Presets Selector */}
        <div className="space-y-1.5">
          <label className="block text-[10.5px] font-black uppercase tracking-wider text-[var(--muted)]">
            Selecione o Tipo do Pedido:
          </label>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset) => {
              const isSelected = selectedType === preset.name;
              return (
                <button
                  key={preset.id || preset.name}
                  type="button"
                  onClick={() => {
                    setSelectedType(preset.name);
                    setFieldValues({});
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs scale-[1.02]'
                      : 'bg-[var(--bg)] border-[var(--line)] text-[var(--ink)] hover:border-[var(--primary)]'
                  }`}
                >
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Task selector contextualized by identification */}
        {myTasks.length > 0 && (
          <div className="space-y-1.5">
            <label className="block text-[10.5px] font-black uppercase tracking-wider text-[var(--muted)]">
              Tarefa em Execução:
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedTaskId}
                onChange={(e) => setSelectedTaskId(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2.5 text-xs font-bold bg-[var(--bg)] border border-[var(--line)] rounded-xl focus:outline-none focus:border-[var(--primary)] text-[var(--ink)] cursor-pointer"
              >
                <option value="">Nenhuma tarefa selecionada</option>
                {myTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Custom Configurable Fields */}
        {activeFields.length > 0 && (
          <div className="space-y-2">
            {activeFields.map((f) => {
              const maxLen = f.maxLength && f.maxLength > 0 ? f.maxLength : 200;
              const val = fieldValues[f.id] || '';
              return (
                <div key={f.id}>
                  <label className="block text-[10.5px] font-black uppercase tracking-wider text-[var(--muted)] mb-1">
                    {f.label}
                    {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={val}
                      maxLength={maxLen}
                      onChange={(e) => {
                        let v = formatSupportFieldValueLive(e.target.value, f);
                        if (v.length > maxLen) v = v.slice(0, maxLen);
                        setFieldValues((prev) => ({ ...prev, [f.id]: v }));
                      }}
                      placeholder={`Digite ${f.label.toLowerCase()}`}
                      className="w-full px-3.5 py-2.5 pr-14 text-xs font-mono font-bold bg-[var(--bg)] border border-[var(--line)] rounded-xl focus:outline-none focus:border-[var(--primary)] text-[var(--ink)] placeholder:font-sans placeholder:font-medium placeholder:text-[var(--muted)]"
                    />
                    {f.format?.example && (
                      <div className="mt-0.5 text-[9px] text-[var(--muted)]">
                        <span className="font-semibold">Formato: </span>
                        <span className="font-mono font-bold text-[var(--ink)]">{f.format.example}</span>
                        {val && formatSupportFieldValue(val, f) !== val && (
                          <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                            → <span className="font-mono font-bold">{formatSupportFieldValue(val, f)}</span>
                          </span>
                        )}
                      </div>
                    )}
                    <span
                      className={`absolute right-2.5 top-2.5 text-[10px] font-mono font-bold ${
                        val.length >= maxLen - 10 ? 'text-amber-500' : 'text-[var(--muted)]'
                      }`}
                    >
                      {val.length}/{maxLen}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected Image Preview */}
        {selectedImage && (
          <div className="relative inline-block border-2 border-emerald-500 rounded-xl overflow-hidden shadow-md">
            <img src={selectedImage} alt="Foto da câmera" className="h-28 w-auto object-cover" />
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-md cursor-pointer"
              title="Remover imagem"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/70 text-white text-[9px] font-bold rounded">
              Foto pronta para envio
            </div>
          </div>
        )}

        {/* Input & Camera Actions */}
        <div className="space-y-1.5">
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            {/* Short text code input (only when type has no custom fields) */}
            {activeFields.length === 0 && (
              <div className="relative flex-1">
              <input
                type="text"
                maxLength={80}
                value={codeText}
                onChange={(e) => setCodeText(e.target.value)}
                placeholder="Código, nº de coletor, balança ou recado rápido..."
                className="w-full px-3.5 py-2.5 pr-14 text-xs font-mono font-bold bg-[var(--bg)] border border-[var(--line)] rounded-xl focus:outline-none focus:border-[var(--primary)] text-[var(--ink)] placeholder:font-sans placeholder:font-medium placeholder:text-[var(--muted)]"
              />
              <span
                className={`absolute right-2.5 top-2.5 text-[10px] font-mono font-bold ${
                  codeText.length >= 70 ? 'text-amber-500' : 'text-[var(--muted)]'
                }`}
              >
                {codeText.length}/80
              </span>
            </div>
            )}

            {/* Camera & File Upload Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={startLiveCamera}
                className="px-3.5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Abrir Câmera para Tirar Foto"
              >
                <Camera className="w-4 h-4" />
                <span>Câmera</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                type="submit"
                className="px-5 py-2.5 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer transition-all bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white active:scale-98"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Pedir Suporte</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Live Camera Overlay Modal */}
      {isCameraActive && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden max-w-lg w-full p-4 space-y-3 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-black uppercase tracking-wider">Câmera ao Vivo — Suporte</span>
              </div>
              <button
                onClick={stopLiveCamera}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative bg-black rounded-2xl overflow-hidden aspect-video flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={stopLiveCamera}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={capturePhotoFromCamera}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
              >
                <Camera className="w-4 h-4" />
                Tirar Foto Agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Feed & Queue Status */}
      <div className="bg-[var(--paper)] border border-[var(--line)] rounded-2xl shadow-2xs overflow-hidden">
        <div className="px-4 py-3 bg-[var(--bg)] border-b border-[var(--line)] flex items-center justify-between">
          <div className="text-xs font-black uppercase tracking-wider text-[var(--ink)] flex items-center gap-1.5">
            <FileCode className="w-3.5 h-3.5 text-[var(--primary)]" />
            {isPortalView ? 'Meus Chamados de Suporte' : `Fila & Registros de Suporte (${messages.length})`}
          </div>
          <span className="text-[10px] text-[var(--muted)] font-bold">
            {messages.filter((m) => m.status === 'enviado').length} aguardando atendimento
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="p-6 text-center text-[11px] text-[var(--muted)] space-y-1">
            <Tag className="w-6 h-6 mx-auto text-[var(--muted)] opacity-50" />
            <p className="font-bold">Nenhum chamado de suporte registrado ainda.</p>
            <p>Selecione um tipo de pedido acima e envie sua solicitação.</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--line)] max-h-96 overflow-y-auto">
            {messages.map((m) => {
              const formattedDate = m.date ? formatDateBR(m.date) : formatDateBR(m.createdAt.slice(0, 10));
              const formattedTime = m.time || new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

              const isMyMessage =
                (currentSenderId && m.senderId === currentSenderId) ||
                (senderOverride?.name && m.senderName === senderOverride.name) ||
                (identifiedUser && (
                  m.senderId === String(identifiedUser.collaboratorId) ||
                  m.senderId === String(identifiedUser.id) ||
                  m.senderName.trim().toLowerCase() === identifiedUser.name.trim().toLowerCase()
                ));

              const isOwnerInPortal = isPortalView || isMyMessage;

              return (
                <div key={m.id} className="p-3.5 hover:bg-[var(--bg)] transition-colors space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg bg-[var(--primary-soft)] text-[var(--primary)] text-[10.5px] font-black">
                        {m.supportType || 'Suporte Operacional'}
                      </span>
                      <span className="font-black text-xs text-[var(--ink)]">{m.senderName}</span>
                      <span className="text-[10px] text-[var(--muted)]">
                        ({m.senderShift ? `Turno ${m.senderShift}` : m.senderRole || 'Operador'})
                      </span>
                      {m.taskName && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 truncate max-w-[180px]">
                          {m.taskName}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--muted)] font-mono">
                        • {formattedDate} {formattedTime}
                      </span>
                    </div>

                    {/* Status Badges & Allowed Action Controls */}
                    <div className="flex items-center flex-wrap gap-1.5">
                      {m.status === 'enviado' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black border bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Na Fila (Aguardando Suporte)</span>
                        </span>
                      )}

                      {/* CANCEL/DELETE OWN REQUEST (ONLY ALLOWED BEFORE ATENDIMENTO) */}
                      {m.status === 'enviado' && isOwnerInPortal && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Deseja cancelar e excluir seu pedido de suporte da fila?')) {
                              deleteSupportMessage(m.id);
                              showNotice('Seu pedido de suporte foi cancelado com sucesso.');
                            }
                          }}
                          className="px-2.5 py-1 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 text-[10.5px] font-black border border-rose-500/30 flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-2xs"
                          title="Cancelar e excluir minha solicitação antes de ser atendida"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Cancelar Pedido</span>
                        </button>
                      )}

                      {m.status === 'em_atendimento' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black border bg-sky-500/15 border-sky-500/30 text-sky-600 dark:text-sky-300 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                          <span>Em Atendimento {m.assignedToName ? `(${m.assignedToName})` : ''}</span>
                        </span>
                      )}

                      {/* Locked status during atendimento */}
                      {m.status === 'em_atendimento' && isOwnerInPortal && (
                        <span
                          className="px-2 py-0.5 rounded-lg text-[9.5px] font-bold text-sky-700 dark:text-sky-300 bg-sky-500/10 border border-sky-500/20 flex items-center gap-1"
                          title="Em atendimento: Não é possível cancelar ou excluir pois já foi atribuído ao atendente e registrado no histórico."
                        >
                          <Lock className="w-3 h-3 text-sky-500 shrink-0" />
                          <span className="hidden sm:inline">Vinculado ao Suporte</span>
                        </span>
                      )}

                      {m.status === 'resolvido' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black border bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Resolvido {m.assignedToName ? `por ${m.assignedToName}` : ''}</span>
                        </span>
                      )}

                      {/* Locked status after resolution */}
                      {m.status === 'resolvido' && isOwnerInPortal && (
                        <span
                          className="px-2 py-0.5 rounded-lg text-[9.5px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1"
                          title="Chamado concluído: Registrado para o histórico do atendente e no Relatório de Pedidos."
                        >
                          <Lock className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="hidden sm:inline">Salvo no Relatório</span>
                        </span>
                      )}

                      {m.status === 'cancelado' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black border bg-slate-500/15 border-slate-500/30 text-slate-500">
                          Cancelado
                        </span>
                      )}

                      {isSupportStaff && (
                        <button
                          onClick={() => {
                            if (window.confirm('Excluir este chamado de suporte? Esta ação é irreversível.')) {
                              deleteSupportMessage(m.id);
                              showNotice('Chamado de suporte excluído.');
                            }
                          }}
                          className="p-1 rounded hover:bg-rose-500/20 text-[var(--muted)] hover:text-rose-500 cursor-pointer ml-1"
                          title="Excluir chamado (Suporte — a qualquer momento)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Code Text with Copy Action */}
                  {m.codeText && (
                    <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                      <span className="font-mono text-xs font-bold text-[var(--ink)] break-all select-all">
                        {m.codeText}
                      </span>
                      {!isPortalView && (
                        <button
                          onClick={() => handleCopyCode(m.codeText!, m.id)}
                          className="px-2 py-1 rounded-lg bg-[var(--paper)] border border-[var(--line)] text-[10px] font-black hover:border-[var(--primary)] text-[var(--muted)] hover:text-[var(--ink)] flex items-center gap-1 cursor-pointer shrink-0"
                          title="Copiar código"
                        >
                          {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          {copiedId === m.id ? 'Copiado!' : 'Copiar'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Custom configured fields */}
                  {m.fields && m.fields.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {m.fields.map((f) => (
                          <div key={f.id} className="p-2 rounded-xl bg-[var(--bg)] border border-[var(--line)]">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <div className="text-[9px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                                {f.label}
                              </div>
                              {!isPortalView && (
                                <button
                                  onClick={() => handleCopyField(f.id, f.value, `${m.id}_${f.id}`)}
                                  className="p-0.5 text-[var(--muted)] hover:text-[var(--ink)] rounded cursor-pointer transition-colors"
                                  title="Copiar valor deste campo"
                                >
                                  {copiedFieldId === `${m.id}_${f.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                            <div className="font-mono text-[11px] font-bold text-[var(--ink)] break-all select-all">
                              {f.value}
                            </div>
                          </div>
                        ))}
                      </div>
                      {!isPortalView && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => handleCopyAllFields(m.id, m.fields)}
                            className="px-2 py-1 rounded-lg bg-[var(--paper)] border border-[var(--line)] text-[10px] font-black hover:border-[var(--primary)] text-[var(--muted)] hover:text-[var(--ink)] flex items-center gap-1 cursor-pointer transition-colors"
                            title="Copiar todos os campos"
                          >
                            {copiedAllId === m.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                            {copiedAllId === m.id ? 'Copiado!' : 'Copiar todos'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Link (Copiar & Abrir) — independente dos campos personalizados */}
                  {!isPortalView && presets.some((p) => p.name === m.supportType && p.actionLink) && (
                    <button
                      onClick={() => handleOpenActionLink(m)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-[10.5px] font-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                      title="Copiar dados e abrir link de ação no sistema"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Copiar & Abrir
                    </button>
                  )}

                  {/* Image Thumbnail */}
                  {m.imageUrl && (
                    <div className="relative inline-block group">
                      <img
                        src={m.imageUrl}
                        alt="Anexo de Suporte"
                        onClick={() => setExpandedImage(m.imageUrl!)}
                        className="h-20 w-auto rounded-xl border border-[var(--line)] object-cover cursor-pointer group-hover:opacity-90 transition-opacity shadow-2xs"
                      />
                      <button
                        onClick={() => setExpandedImage(m.imageUrl!)}
                        className="absolute bottom-1 right-1 p-1 bg-black/60 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Ampliar imagem"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Support Resolution Notes if present */}
                  {m.resolutionNotes && (
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl">
                      <strong>Parecer do Suporte:</strong> {m.resolutionNotes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded Image Modal */}
      {expandedImage && (
        <div
          onClick={() => setExpandedImage(null)}
          className="fixed inset-0 z-[110] bg-black/85 flex items-center justify-center p-4 cursor-pointer backdrop-blur-xs"
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl bg-black p-2">
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-3 right-3 p-2 bg-rose-600 text-white rounded-full shadow-lg z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={expandedImage} alt="Foto ampliada" className="max-h-[85vh] w-auto object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
};
