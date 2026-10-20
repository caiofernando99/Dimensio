import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { getCollaboratorStatus, type StatusType } from '../utils/helpers';
import { navigateToEditCollaborator } from '../utils/navigation';
import type { Collaborator } from '../types';
import {
  X,
  Sparkles,
  ClipboardList,
  Clock,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  RefreshCw,
  Sun,
  ExternalLink,
  Link2,
  Check,
  Edit2,
} from 'lucide-react';

const STATUS_META: Record<StatusType, { label: string; text: string; bg: string; dot: string }> = {
  presente: { label: 'Presente', text: 'text-emerald-800 dark:text-emerald-200', bg: 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-600' },
  atraso: { label: 'Atraso', text: 'text-amber-800 dark:text-amber-200', bg: 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800', dot: 'bg-amber-600' },
  folga: { label: 'Folga', text: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700', dot: 'bg-slate-500' },
  ferias: { label: 'Férias', text: 'text-purple-800 dark:text-purple-200', bg: 'bg-purple-100 dark:bg-purple-950/70 border-purple-300 dark:border-purple-800', dot: 'bg-purple-600' },
  licenca: { label: 'Licença', text: 'text-amber-800 dark:text-amber-200', bg: 'bg-amber-100 dark:bg-amber-950/70 border-amber-300 dark:border-amber-800', dot: 'bg-amber-600' },
  atestado: { label: 'Atestado', text: 'text-blue-800 dark:text-blue-200', bg: 'bg-blue-100 dark:bg-blue-950/70 border-blue-300 dark:border-blue-800', dot: 'bg-blue-600' },
  banco_horas: { label: 'Banco de Horas', text: 'text-teal-800 dark:text-teal-200', bg: 'bg-teal-100 dark:bg-teal-950/70 border-teal-300 dark:border-teal-800', dot: 'bg-teal-600' },
  falta_injustificada: { label: 'Falta Injustificada', text: 'text-rose-800 dark:text-rose-200', bg: 'bg-rose-100 dark:bg-rose-950/70 border-rose-300 dark:border-rose-800', dot: 'bg-rose-600' },
  treinamento: { label: 'Treinamento', text: 'text-cyan-800 dark:text-cyan-200', bg: 'bg-cyan-100 dark:bg-cyan-950/70 border-cyan-300 dark:border-cyan-800', dot: 'bg-cyan-600' },
  ausente: { label: 'Ausente', text: 'text-red-800 dark:text-red-200', bg: 'bg-red-100 dark:bg-red-950/70 border-red-300 dark:border-red-800', dot: 'bg-red-600' },
};

const STATUS_ORDER: StatusType[] = [
  'presente',
  'folga',
  'ferias',
  'licenca',
  'atestado',
  'treinamento',
  'banco_horas',
  'falta_injustificada',
  'ausente',
];

interface CollabDetailsModalProps {
  collab: Collaborator;
  onClose: () => void;
}

export const CollabDetailsModal: React.FC<CollabDetailsModalProps> = ({ collab, onClose }) => {
  const {
    state,
    updateCollaborator,
    assignTask,
    unassignTask,
    moveBreakInterval,
    setStatusReason,
    identifiedUser,
    showNotice,
  } = useApp();

  const [statusReason, setStatusReasonText] = useState('');
  const [editingProfileUrl, setEditingProfileUrl] = useState(false);
  const [profileUrlInput, setProfileUrlInput] = useState(collab.companyProfileUrl || collab.profileUrl || '');

  // Sync state if collab changes
  const liveCollab = state.collaborators.find((c) => c.id === collab.id) || collab;
  const currentProfileUrl = liveCollab.companyProfileUrl || liveCollab.profileUrl || '';

  const handleSaveProfileUrl = () => {
    const cleanUrl = profileUrlInput.trim();
    updateCollaborator(liveCollab.id, {
      companyProfileUrl: cleanUrl || undefined,
      profileUrl: cleanUrl || undefined,
    });
    setEditingProfileUrl(false);
    showNotice(cleanUrl ? 'Link do sistema da empresa atualizado com sucesso!' : 'Link do perfil da empresa removido.');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const activeDate = state.selectedDate;
  const dayIntervals = state.intervals[activeDate] || {};
  const statusInfo = getCollaboratorStatus(collab, activeDate, state);
  const status = statusInfo.status;
  const meta = STATUS_META[status];

  const currentTask = state.tasks.find((t) => t.active !== false && t.members.includes(collab.id));
  const activeTasks = state.tasks.filter((t) => t.active !== false);
  const currentBreak = state.breaks.find((b) => (dayIntervals[b.id] || []).includes(collab.id));
  const allSkills = Object.entries(collab.skills || {}).filter(([_, lvl]) => Number(lvl) > 0);

  const initials = collab.name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const tl = collab.teamLeader || state.defaultTeamLeader || 'Sem Time';

  const handleAssign = (taskId: string) => {
    if (taskId) {
      assignTask(collab.id, taskId);
    } else {
      unassignTask(collab.id);
    }
  };

  const handleBreak = (breakId: string) => {
    moveBreakInterval(collab.id, currentBreak?.id || null, breakId);
  };

  const handleSetStatus = (st: StatusType) => {
    const isTroca = st === 'presente' && statusInfo.isOffScale && statusInfo.status !== 'presente';
    setStatusReason(collab.id, st, statusReason.trim() || (isTroca ? 'Troca de Folga' : 'Ajuste manual'));
    setStatusReasonText('');
    showNotice(`Status "${STATUS_META[st].label}" aplicado para ${collab.name}${isTroca ? ' (Troca de Folga)' : ''}!`);
  };

  const handleGoToEdit = () => {
    onClose();
    navigateToEditCollaborator(collab.id);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[var(--paper)] border border-[var(--line)] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-[var(--line)] bg-[var(--paper)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 shrink-0 rounded-full bg-[var(--primary-soft)] text-[var(--primary)] flex items-center justify-center text-sm font-black border border-[var(--primary-border)]">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-base font-extrabold text-[var(--ink)] truncate">{collab.name}</div>
              <div className="text-[11px] font-semibold text-[var(--muted)] truncate">
                {collab.login || 'Sem LDAP'}
                {collab.registration ? ` • RE ${collab.registration}` : ''}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleGoToEdit}
              className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-[var(--primary-soft)] text-[var(--primary)] border border-[var(--primary-border)] hover:bg-[var(--primary)] hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              title="Ir para o cadastro deste colaborador na Equipe para editar todos os dados"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Editar Perfil</span>
            </button>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border ${meta.bg} ${meta.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
              {meta.label}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg)] transition-colors cursor-pointer"
              title="Fechar"
              tabIndex={-1}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Dados cadastrais */}
          <section className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3.5">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] mb-2.5 flex items-center gap-1.5">
              <UserRound className="w-3.5 h-3.5" /> Dados cadastrais
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-2.5 text-[11px] font-semibold text-[var(--muted)]">
              <div>
                <div className="text-[9px] font-black uppercase opacity-80">LDAP</div>
                <div className="font-extrabold text-[var(--ink)]">{collab.login || '—'}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase opacity-80">Matrícula</div>
                <div className="font-extrabold text-[var(--ink)]">{collab.registration ? `RE ${collab.registration}` : '—'}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase opacity-80">Turno</div>
                <div className="font-extrabold text-[var(--ink)]">{collab.shift || 'Geral'}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase opacity-80">Escala</div>
                <div className="font-extrabold text-[var(--ink)]">Turma {collab.scale || '—'}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase opacity-80">Time / TL</div>
                <div className="font-extrabold text-[var(--ink)] truncate">{tl}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase opacity-80">Cargo</div>
                <div className="font-extrabold text-[var(--ink)] truncate">{collab.role || '—'}</div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[9px] font-black uppercase opacity-80">Categoria</div>
                <div className="font-extrabold text-[var(--ink)] truncate">{collab.category || '—'}</div>
              </div>
              <div className="col-span-2 sm:col-span-2">
                <div className="text-[9px] font-black uppercase opacity-80">Ocorrência / Anotação do cadastro</div>
                <div className="font-extrabold text-[var(--ink)] truncate">{collab.notes || '—'}</div>
              </div>

              {/* Link no Sistema da Empresa */}
              <div className="col-span-2 sm:col-span-3 pt-2 mt-1 border-t border-[var(--line)]">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Link no Sistema da Empresa (Intranet / RH)</span>
                  </div>
                  {!editingProfileUrl && (
                    <button
                      onClick={() => {
                        setProfileUrlInput(currentProfileUrl);
                        setEditingProfileUrl(true);
                      }}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>{currentProfileUrl ? 'Editar link' : '+ Adicionar link'}</span>
                    </button>
                  )}
                </div>

                {editingProfileUrl ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="url"
                      value={profileUrlInput}
                      onChange={(e) => setProfileUrlInput(e.target.value)}
                      placeholder="https://sistema.empresa.com/colaborador/12345"
                      className="flex-1 px-2.5 py-1.5 bg-[var(--paper)] border border-blue-500 rounded-lg text-xs font-semibold text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveProfileUrl();
                        if (e.key === 'Escape') setEditingProfileUrl(false);
                      }}
                    />
                    <button
                      onClick={handleSaveProfileUrl}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar</span>
                    </button>
                    <button
                      onClick={() => setEditingProfileUrl(false)}
                      className="px-2.5 py-1.5 bg-[var(--paper)] border border-[var(--line)] hover:bg-[var(--bg)] text-[var(--muted)] rounded-lg text-xs font-bold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : currentProfileUrl ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={currentProfileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-xs font-extrabold transition-all group shadow-2xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      <span>Abrir Perfil no Sistema da Empresa</span>
                    </a>
                    <span className="text-[10px] text-[var(--muted)] truncate max-w-xs font-mono opacity-80" title={currentProfileUrl}>
                      {currentProfileUrl}
                    </span>
                  </div>
                ) : (
                  <div className="text-[11px] text-[var(--muted)] italic">
                    Nenhum link associado ao cadastro deste colaborador.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Skills */}
          <section className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3.5">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Skills & Proficiências
            </h4>
            {allSkills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {allSkills.map(([sName, lvlVal]) => (
                  <span
                    key={sName}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-extrabold border ${
                      lvlVal === 3
                        ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-800'
                        : lvlVal === 2
                        ? 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800'
                        : 'bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-800'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 opacity-80" />
                    {sName}
                    <span className="opacity-70">Nv {lvlVal}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs font-semibold text-[var(--muted)] italic">Nenhuma skill cadastrada.</p>
            )}
          </section>

          {/* Dimensionar tarefa */}
          <section className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3.5">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] mb-2.5 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5 text-[var(--primary)]" /> Dimensionar para tarefa
            </h4>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
                <select
                  value={currentTask?.id || ''}
                  onChange={(e) => handleAssign(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-xs font-bold text-[var(--ink)] focus:outline-none focus:border-[var(--primary)] cursor-pointer appearance-none"
                >
                  <option value="">— Sem tarefa —</option>
                  {activeTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {currentTask && (
                <button
                  onClick={() => unassignTask(collab.id)}
                  className="px-2.5 py-1.5 text-[10px] font-black text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-lg bg-rose-100/60 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 transition-colors cursor-pointer"
                >
                  Desvincular
                </button>
              )}
            </div>
            {currentTask && (
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 mt-2">
                Atualmente em: {currentTask.name}
              </p>
            )}
          </section>

          {/* Intervalo */}
          <section className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3.5">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] mb-2.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-500" /> Horário de intervalo
            </h4>
            {state.breaks.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleBreak('none')}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-colors cursor-pointer ${
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
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black border transition-colors cursor-pointer ${
                        active
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-[var(--paper)] text-[var(--muted)] border-[var(--line)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <Clock className="inline w-3 h-3 mr-1 -mt-0.5" />
                      {b.time}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs font-semibold text-[var(--muted)] italic">
                Nenhum horário de intervalo cadastrado.
              </p>
            )}
          </section>

          {/* Status de presença / afastamento */}
          <section className="bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3.5">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)] mb-2.5 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-purple-500" /> Status de presença / afastamento
            </h4>

            {statusInfo.isOffScale && status === 'folga' && (
              <div className="flex items-start gap-2 p-2.5 bg-purple-100 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-800 rounded-xl mb-2.5 text-[11px] font-semibold text-purple-900 dark:text-purple-200">
                <Sun className="w-3.5 h-3.5 mt-0.5 shrink-0 text-purple-600 dark:text-purple-400" />
                <div className="flex-1 min-w-0">
                  <p>
                    <strong>{collab.name}</strong> está de <strong>folga de escala</strong> hoje. Se compareceu por troca,
                    registre a presença como <strong>Troca de Folga</strong>.
                  </p>
                  <button
                    onClick={() => handleSetStatus('presente')}
                    className="mt-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-black rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3 h-3" /> Registrar Troca de Folga
                  </button>
                </div>
              </div>
            )}

            {status === 'presente' && statusInfo.isExtraPresence && (
              <p className="text-[11px] font-bold text-purple-800 dark:text-purple-200 bg-purple-100 dark:bg-purple-950/70 border border-purple-300 dark:border-purple-800 rounded-xl px-2.5 py-2 mb-2.5 inline-flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3" /> Presença registrada como <strong>Troca de Folga</strong> (presença extra em dia de folga).
              </p>
            )}

            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((st) => {
                const isCurrent = status === st;
                return (
                  <button
                    key={st}
                    onClick={() => handleSetStatus(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : STATUS_META[st].bg + ' ' + STATUS_META[st].text + ' hover:opacity-80'
                    }`}
                  >
                    {STATUS_META[st].label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2.5">
              <input
                type="text"
                value={statusReason}
                onChange={(e) => setStatusReasonText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSetStatus(status);
                  }
                }}
                placeholder="Justificativa (opcional, ex: troca de folga combinada)..."
                className="flex-1 px-3 py-1.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[11px] font-semibold text-[var(--ink)] placeholder:text-[var(--muted)]/70 focus:outline-none focus:border-[var(--primary)]"
              />
              <button
                onClick={() => handleSetStatus(status)}
                className="px-3 py-1.5 bg-[var(--paper)] border border-[var(--line)] rounded-lg text-[11px] font-black text-[var(--ink)] hover:bg-[var(--bg)] transition-colors cursor-pointer shrink-0"
              >
                Aplicar com motivo
              </button>
            </div>
          </section>



          <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-[var(--muted)] pt-1">
            <span className="flex items-center gap-1">
              <UserCheck className="w-3 h-3" /> Alterações aplicadas na data {new Date(activeDate + 'T12:00:00').toLocaleDateString('pt-BR')}
            </span>
            <button onClick={onClose} className="px-3 py-1.5 bg-[var(--bg)] border border-[var(--line)] rounded-lg hover:text-[var(--ink)] transition-colors cursor-pointer">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
