import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useCommunication } from '../context/CommunicationContext';
import { getCollaboratorStatus } from '../utils/helpers';
import { navigateTo, focusServiceRequest } from '../utils/navigation';
import { onCollabContextMenu } from '../utils/collabContextMenu';
import { CollabDetailsModal } from './CollabDetailsModal';
import type { Collaborator } from '../types';
import {
  UserRound,
  ClipboardList,
  Clock,
  History,
  RadioTower,
  ChevronRight,
  Check,
  Radio,
  MessageSquareText,
} from 'lucide-react';

const MENU_WIDTH = 268;

type OpenSection = 'task' | 'break' | 'requests' | null;

const CollabContextMenu: React.FC = () => {
  const { state, identifiedUser, assignTask, unassignTask, moveBreakInterval, showNotice } = useApp();
  const { enabled, identified, onlineCollabIds, openDirectChannel } = useCommunication();

  const [menu, setMenu] = useState<{ collabId: string; x: number; y: number } | null>(null);
  const [section, setSection] = useState<OpenSection>(null);
  const [profileCollabId, setProfileCollabId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return onCollabContextMenu((payload) => {
      setProfileCollabId(null);
      setSection(null);
      setMenu(payload);
    });
  }, []);

  const close = useCallback(() => {
    setMenu(null);
    setSection(null);
  }, []);

  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onScroll = () => close();
    const onBlur = () => close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('blur', onBlur);
    };
  }, [menu, close]);

  const collab: Collaborator | undefined = useMemo(
    () => (menu ? state.collaborators.find((c) => c.id === menu.collabId) : undefined),
    [menu, state.collaborators]
  );

  const activeDate = state.selectedDate;
  const statusInfo = collab ? getCollaboratorStatus(collab, activeDate, state) : null;
  const currentTask = collab ? state.tasks.find((t) => t.active !== false && t.members.includes(collab.id)) : undefined;
  const activeTasks = state.tasks.filter((t) => t.active !== false);
  const currentBreak = collab
    ? state.breaks.find((b) => ((state.intervals[activeDate] || {})[b.id] || []).includes(collab.id))
    : undefined;
  const collabOnline = collab ? onlineCollabIds.has(collab.id) : false;
  const isSelf = collab ? identifiedUser?.collaboratorId === collab.id || identifiedUser?.id === collab.id : false;

  const recentRequests = useMemo(
    () =>
      collab
        ? [
            ...(state.serviceRequests || [])
              .filter(
                (r) =>
                  r.collaboratorId === collab.id ||
                  (r.collaboratorName && r.collaboratorName === collab.name) ||
                  (r.selectedCollaborators || []).includes(collab.name)
              )
              .map((r) => ({
                id: r.id,
                kind: 'systemic' as const,
                title: r.title,
                status: r.status,
                createdAt: r.createdAt,
                tag: r.type === 'aviso' ? 'Aviso' : 'Pedido',
              })),
            ...(state.supportMessages || [])
              .filter(
                (m) => m.senderId === collab.id || (m.senderName && m.senderName === collab.name)
              )
              .map((m) => ({
                id: m.id,
                kind: 'support' as const,
                title: m.supportType || m.codeText || 'Chamado de suporte',
                status: m.status,
                createdAt: m.createdAt,
                tag: 'Suporte',
              })),
          ]
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
            .slice(0, 4)
        : [],
    [collab, state.serviceRequests, state.supportMessages]
  );

  // Perfil completo é um estado separado: renderiza o modal mesmo com o menu fechado.
  if (profileCollabId) {
    const profileCollab = state.collaborators.find((c) => c.id === profileCollabId);
    return profileCollab ? <CollabDetailsModal collab={profileCollab} onClose={() => setProfileCollabId(null)} /> : null;
  }

  if (!menu || !collab) return null;

  const initials = collab.name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const posX = Math.max(8, Math.min(menu.x, window.innerWidth - MENU_WIDTH - 8));
  const posY = Math.max(8, Math.min(menu.y, Math.max(14, window.innerHeight - 220)));

  const radioDisabledReason = !identified
    ? 'Identifique-se para falar no rádio'
    : !enabled
    ? 'Ligue o rádio primeiro'
    : !collabOnline
    ? `${collab.name} está offline no rádio`
    : isSelf
    ? 'É você mesmo'
    : null;

  const handleOpenDirect = () => {
    if (!collab || radioDisabledReason) return;
    openDirectChannel(collab.id, collab.name);
  };

  const handleViewRequest = (id: string) => {
    close();
    navigateTo('requests');
    focusServiceRequest(id);
  };

  const handleAssign = (taskId: string) => {
    if (taskId) assignTask(collab.id, taskId);
    else unassignTask(collab.id);
    showNotice(taskId ? `${collab.name} dimensionado para a tarefa.` : `${collab.name} desvinculado da tarefa.`);
    setSection(null);
  };

  const handleBreak = (breakId: string) => {
    moveBreakInterval(collab.id, currentBreak?.id || null, breakId);
    showNotice(breakId === 'none' ? `${collab.name} sem intervalo.` : `${collab.name} movido para ${breakId}.`);
    setSection(null);
  };

  const statusLabelMap: Record<string, string> = {
    presente: 'Presente',
    atraso: 'Atraso',
    folga: 'Folga',
    ferias: 'Férias',
    licenca: 'Licença',
    atestado: 'Atestado',
    banco_horas: 'Banco de horas',
    falta_injustificada: 'Falta injust.',
    treinamento: 'Treinamento',
    ausente: 'Ausente',
  };
  const statusLabel = statusInfo ? statusLabelMap[statusInfo.status] || statusInfo.status : '—';

  return (
    <>
      <div
        ref={menuRef}
        role="menu"
        className="fixed z-[70] w-[268px] max-h-[min(560px,calc(100dvh-1rem))] overflow-y-auto bg-[var(--paper)] border border-[var(--line)] rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-100"
        style={{ left: posX, top: posY }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Cabeçalho com info básica */}
        <div className="flex items-center gap-2.5 px-3 pt-3 pb-2.5 border-b border-[var(--line)]">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-xs font-black border border-[var(--primary-border)]">
              {initials}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-[var(--paper)] ${
                collabOnline ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
              title={collabOnline ? 'Online no rádio' : 'Offline no rádio'}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-extrabold text-[var(--ink)] truncate">{collab.name}</div>
            <div className="text-[10px] font-semibold text-[var(--muted)] truncate">
              {collab.role || 'Operador'} • {collab.shift || 'Geral'}
            </div>
          </div>
          <span className="shrink-0 text-[9px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)]">
            {statusLabel}
          </span>
        </div>

        {/* Ver perfil */}
        <button
          role="menuitem"
          onClick={() => {
            setProfileCollabId(collab.id);
            setMenu(null);
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-left text-[var(--ink)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
        >
          <UserRound className="w-4 h-4 text-[var(--primary)] shrink-0" /> Ver perfil completo
          <ChevronRight className="w-3.5 h-3.5 ml-auto text-[var(--muted)]" />
        </button>

        {/* Dimensionar tarefa */}
        <div>
          <button
            role="menuitem"
            onClick={() => setSection(section === 'task' ? null : 'task')}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-left text-[var(--ink)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
          >
            <ClipboardList className="w-4 h-4 text-indigo-500 shrink-0" /> Dimensionar tarefa
            <span className="ml-auto text-[9px] font-black uppercase text-[var(--muted)]">
              {currentTask ? 'Tarefa' : '—'}
            </span>
          </button>
          {section === 'task' && (
            <div className="px-3 pb-2.5 space-y-1.5">
              <select
                value={currentTask?.id || ''}
                onChange={(e) => handleAssign(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[11px] font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] cursor-pointer"
              >
                <option value="">— Sem tarefa —</option>
                {activeTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {currentTask && (
                <button
                  onClick={() => handleAssign('')}
                  className="w-full px-2.5 py-1.5 text-[10px] font-black text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-lg bg-rose-100/60 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors cursor-pointer"
                >
                  Desvincular de {currentTask.name}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Intervalo */}
        <div>
          <button
            role="menuitem"
            onClick={() => setSection(section === 'break' ? null : 'break')}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-left text-[var(--ink)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
          >
            <Clock className="w-4 h-4 text-emerald-500 shrink-0" /> Intervalo
            <span className="ml-auto text-[9px] font-black uppercase text-[var(--muted)]">
              {currentBreak ? currentBreak.time : '—'}
            </span>
          </button>
          {section === 'break' && (
            <div className="px-3 pb-2.5 flex flex-wrap gap-1.5">
              <button
                onClick={() => handleBreak('none')}
                className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-colors cursor-pointer ${
                  !currentBreak
                    ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                    : 'bg-[var(--paper)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'
                }`}
              >
                Sem intervalo
              </button>
              {state.breaks.map((b) => {
                const active = currentBreak?.id === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => handleBreak(b.id)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-[var(--paper)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {b.time}
                    {active && <Check className="inline w-3 h-3 ml-1 -mt-0.5" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Últimos pedidos */}
        <div>
          <button
            role="menuitem"
            onClick={() => setSection(section === 'requests' ? null : 'requests')}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-left text-[var(--ink)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
          >
            <MessageSquareText className="w-4 h-4 text-amber-500 shrink-0" /> Últimos pedidos
            <span className="ml-auto text-[9px] font-black uppercase text-[var(--muted)]">{recentRequests.length}</span>
          </button>
          {section === 'requests' && (
            <div className="px-3 pb-2.5 space-y-1.5">
              {recentRequests.length === 0 ? (
                <p className="text-[10px] font-semibold text-[var(--muted)] italic">Nenhum pedido vinculado a este colaborador.</p>
              ) : (
                recentRequests.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => handleViewRequest(r.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-left hover:border-[var(--primary)] transition-colors cursor-pointer"
                    title="Abrir no suporte"
                  >
                    <History className="w-3.5 h-3.5 text-[var(--muted)] shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-extrabold text-[var(--ink)] truncate">{r.title}</span>
                      <span className="block text-[9px] font-semibold text-[var(--muted)] uppercase">
                        {r.tag} • {r.status} • {new Date(r.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Falar no rádio (DM) */}
        <div className="border-t border-[var(--line)] p-1.5">
          <button
            role="menuitem"
            onClick={handleOpenDirect}
            disabled={!!radioDisabledReason}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-black transition-colors cursor-pointer disabled:cursor-not-allowed ${
              radioDisabledReason
                ? 'bg-[var(--bg)] text-[var(--muted)] opacity-70'
                : 'bg-[var(--primary)] text-white hover:brightness-110'
            }`}
          >
            <RadioTower className="w-4 h-4 shrink-0" />
            <span className="flex-1">{radioDisabledReason || (isSelf ? 'Você está neste canal' : 'Falar no rádio')}</span>
            {collabOnline && !radioDisabledReason && <Radio className="w-3.5 h-3.5 opacity-80" />}
          </button>
        </div>
      </div>
    </>
  );
};

export default CollabContextMenu;