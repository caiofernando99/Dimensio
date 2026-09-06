import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Lock,
  CheckCircle2,
  Calendar,
  Clock,
  UserCheck,
  FileSpreadsheet,
  AlertTriangle,
  History,
  Download,
  Trash2,
  Database,
  ArrowRight,
  Sparkles,
  Printer,
  ChevronRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ShiftClosingRecord } from '../types';
import {
  saveShiftClosingToFirestore,
  fetchShiftClosingsFromFirestore,
  deleteShiftClosingFromFirestore,
} from '../lib/firestoreStorage';
import { formatDateBR, getCollaboratorStatus, isAbsenteeismStatus } from '../utils/helpers';
import { Modal, Button, Badge } from './ui';

interface ShiftClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShiftClosingModal: React.FC<ShiftClosingModalProps> = ({ isOpen, onClose }) => {
  const { state, identifiedUser, showNotice, syncToOnlineSpreadsheet } = useApp();
  const [activeTab, setActiveTab] = useState<'close_now' | 'history'>('close_now');
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Historical records
  const [historyList, setHistoryList] = useState<ShiftClosingRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedHistoricalRecord, setSelectedHistoricalRecord] = useState<ShiftClosingRecord | null>(null);

  const activeDate = state.selectedDate;
  const currentShift = state.teamShift || 'Geral';
  const workspaceName = state.onlineSpreadsheet?.firestoreCollection || 'dimensio_workspaces';

  // Compute shift metrics
  const activeCollaborators = useMemo(() => {
    return state.collaborators.filter((c) => {
      if (!currentShift || currentShift === 'ALL' || currentShift === 'Geral' || currentShift === 'Todos') return true;
      return c.shift === currentShift;
    });
  }, [state.collaborators, currentShift]);

  const totalHeadcount = activeCollaborators.length;

  const attendanceStats = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    let vacation = 0;
    let off = 0;
    const absentList: Array<{ name: string; status: string; reason?: string }> = [];

    activeCollaborators.forEach((c) => {
      const dayStatus = getCollaboratorStatus(c, activeDate, state);
      const st = dayStatus.status;
      const isAbsent = isAbsenteeismStatus(st);
      const reason =
        state.dailyReports[activeDate]?.absenceReasons?.[c.id] ||
        (dayStatus.absenceDetail ? `${dayStatus.absenceDetail.type}: ${dayStatus.absenceDetail.notes || ''}`.trim() : '') ||
        (dayStatus.absenceReason || '');

      if (st === 'presente') {
        present++;
      } else if (st === 'atraso') {
        late++;
        present++;
      } else if (st === 'ferias') {
        vacation++;
      } else if (st === 'folga') {
        off++;
      } else if (isAbsent) {
        absent++;
        absentList.push({ name: c.name, status: String(st), reason });
      }
    });

    const attendanceRate = totalHeadcount > 0 ? Math.round((present / totalHeadcount) * 100) : 0;

    return { present, late, absent, vacation, off, attendanceRate, absentList };
  }, [activeCollaborators, activeDate, state, totalHeadcount]);

  const tasksSummary = useMemo(() => {
    return (state.tasks || []).map((t) => {
      const memberCount = (t.members || []).length;
      return { taskName: t.name, count: memberCount };
    }).filter((t) => t.count > 0);
  }, [state.tasks]);

  const occurrences = useMemo(() => {
    const list: Array<{ collaboratorName: string; text: string }> = [];
    const occMap = state.dailyReports[activeDate]?.occurrences || {};
    Object.entries(occMap).forEach(([cId, text]) => {
      if (text && text.trim()) {
        const c = state.collaborators.find((col) => col.id === cId);
        list.push({ collaboratorName: c ? c.name : 'Colaborador', text: text.trim() });
      }
    });
    return list;
  }, [activeDate, state.dailyReports, state.collaborators]);

  const routinesSummary = useMemo(() => {
    const routines = state.scheduledTasks || [];
    const total = routines.length;
    const completed = routines.filter((r) => r.status === 'concluida' || Boolean(r.completedAt)).length;
    return { total, completed };
  }, [state.scheduledTasks]);

  const metricsSnapshot = useMemo(() => {
    return (state.metricDefinitions || []).map((def) => {
      const latestReading = (state.metricReadings || [])
        .filter((r) => r.metricId === def.id && r.capturedAt && r.capturedAt.startsWith(activeDate))
        .slice(-1)[0];
      
      const firstValStr = latestReading && latestReading.values ? Object.values(latestReading.values)[0] : '0';
      const numVal = parseFloat(firstValStr) || 0;

      return {
        name: def.name,
        value: numVal,
        unit: def.unit || '',
      };
    });
  }, [state.metricDefinitions, state.metricReadings, activeDate]);

  // Load history when tab changes
  useEffect(() => {
    if (isOpen && activeTab === 'history') {
      loadHistory();
    }
  }, [isOpen, activeTab]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const list = await fetchShiftClosingsFromFirestore(50);
      setHistoryList(list);
    } catch (err) {
      console.warn('Erro ao carregar histórico:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleSaveShiftClosing = async () => {
    if (isSaving) return;
    setIsSaving(true);

    const leaderName = identifiedUser?.name || state.defaultTeamLeader || 'Líder de Turno';
    const leaderRole = identifiedUser?.role || 'Supervisor';
    const closingId = `closing_${activeDate}_${currentShift.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`;

    const record: ShiftClosingRecord = {
      id: closingId,
      date: activeDate,
      shift: currentShift,
      closedAt: new Date().toISOString(),
      closedBy: leaderName,
      leaderRole,
      workspace: workspaceName,
      totalHeadcount,
      presentCount: attendanceStats.present,
      absenceCount: attendanceStats.absent,
      attendanceRate: attendanceStats.attendanceRate,
      tasksSummary,
      absentList: attendanceStats.absentList,
      occurrences,
      completedRoutinesCount: routinesSummary.completed,
      totalRoutinesCount: routinesSummary.total,
      metricsSnapshot,
      supervisorNotes: supervisorNotes.trim() || undefined,
      fullStateSnapshotJson: JSON.stringify({
        collaborators: activeCollaborators,
        tasks: state.tasks,
        dailyReports: state.dailyReports[activeDate] || {},
      }),
    };

    const res = await saveShiftClosingToFirestore(record);
    setIsSaving(false);

    if (res.success) {
      setSaveSuccess(true);
      showNotice('Fechamento de turno salvo com sucesso no Firebase Firestore!', undefined, undefined, 'sync');
      setTimeout(() => {
        setSaveSuccess(false);
        setActiveTab('history');
        loadHistory();
      }, 1200);
    } else {
      showNotice(`Erro ao salvar no Firestore: ${res.error}`);
    }
  };

  const handleDeleteRecord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir este registro histórico?')) return;
    const ok = await deleteShiftClosingFromFirestore(id);
    if (ok) {
      setHistoryList((prev) => prev.filter((r) => r.id !== id));
      if (selectedHistoricalRecord?.id === id) {
        setSelectedHistoricalRecord(null);
      }
      showNotice('Registro removido com sucesso.');
    }
  };

  const handlePrintOrExport = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-[var(--paper)] border border-[var(--line)] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-[var(--ink)]"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--line)] bg-[var(--surface-1)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-[var(--ink)]">
                  Fechamento de Turno & Histórico em Nuvem
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase">
                  Firestore Vault
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] font-medium">
                Gere um snapshot imutável da escala, métricas, rotinas e ocorrências do turno.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-[var(--line)] bg-[var(--bg)] px-5 gap-4">
          <button
            type="button"
            onClick={() => {
              setActiveTab('close_now');
              setSelectedHistoricalRecord(null);
            }}
            className={`py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'close_now'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Fechamento Atual ({formatDateBR(activeDate)} - {currentShift})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 text-xs font-extrabold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Histórico de Turnos Fechados</span>
            {historyList.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--surface-3)] text-[10px] font-black text-[var(--ink)]">
                {historyList.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'close_now' ? (
            <>
              {/* Context Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl">
                  <span className="text-[11px] font-bold text-[var(--muted)] block">Data & Turno</span>
                  <div className="text-sm font-black text-[var(--ink)] flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-500" />
                    <span>{formatDateBR(activeDate)}</span>
                    <span className="text-xs text-amber-600 dark:text-amber-400">({currentShift})</span>
                  </div>
                </div>

                <div className="p-3 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl">
                  <span className="text-[11px] font-bold text-[var(--muted)] block">Taxa de Presença</span>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-0.5">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>{attendanceStats.attendanceRate}% ({attendanceStats.present}/{totalHeadcount})</span>
                  </div>
                </div>

                <div className="p-3 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl">
                  <span className="text-[11px] font-bold text-[var(--muted)] block">Rotinas Operacionais</span>
                  <div className="text-sm font-black text-[var(--ink)] flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>{routinesSummary.completed} de {routinesSummary.total} ({routinesSummary.total > 0 ? Math.round((routinesSummary.completed / routinesSummary.total) * 100) : 0}%)</span>
                  </div>
                </div>

                <div className="p-3 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl">
                  <span className="text-[11px] font-bold text-[var(--muted)] block">Líder Responsável</span>
                  <div className="text-sm font-black text-[var(--ink)] truncate mt-0.5" title={identifiedUser?.name || state.defaultTeamLeader || 'Não identificado'}>
                    {identifiedUser?.name || state.defaultTeamLeader || 'Líder do Turno'}
                  </div>
                </div>
              </div>

              {/* Tasks Breakdown & Absentees */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tasks Distribution */}
                <div className="p-4 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl space-y-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-amber-500" />
                    <span>Distribuição de Postos no Turno</span>
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {tasksSummary.length === 0 ? (
                      <p className="text-xs text-[var(--muted)] italic">Nenhum posto registrado.</p>
                    ) : (
                      tasksSummary.map((t, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-[var(--line)]/50 last:border-0">
                          <span className="font-semibold text-[var(--ink)] truncate">{t.taskName}</span>
                          <span className="font-black px-2 py-0.5 bg-[var(--surface-2)] rounded-md text-[11px]">
                            {t.count} op.
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Absentees & Occurrences */}
                <div className="p-4 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl space-y-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <span>Ausências & Ocorrências ({attendanceStats.absentList.length + occurrences.length})</span>
                  </h4>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {attendanceStats.absentList.length === 0 && occurrences.length === 0 ? (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> 100% de conformidade, sem faltas ou ocorrências registradas.
                      </p>
                    ) : (
                      <>
                        {attendanceStats.absentList.map((a, idx) => (
                          <div key={`abs_${idx}`} className="flex items-center justify-between py-1 border-b border-[var(--line)]/50">
                            <span className="font-bold text-[var(--ink)]">{a.name}</span>
                            <span className="text-red-600 dark:text-red-400 font-semibold text-[11px]">
                              {a.status} {a.reason ? `(${a.reason})` : ''}
                            </span>
                          </div>
                        ))}
                        {occurrences.map((o, idx) => (
                          <div key={`occ_${idx}`} className="py-1 border-b border-[var(--line)]/50">
                            <span className="font-bold text-[var(--ink)]">{o.collaboratorName}:</span>
                            <span className="text-[var(--muted)] ml-1 text-[11px]">{o.text}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Handover & Supervisor Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-[var(--ink)] flex items-center justify-between">
                  <span>Passagem de Turno & Observações da Supervisão</span>
                  <span className="text-[10px] font-normal text-[var(--muted)]">Salvo permanentemente no relatório</span>
                </label>
                <textarea
                  value={supervisorNotes}
                  onChange={(e) => setSupervisorNotes(e.target.value)}
                  rows={3}
                  placeholder="Descreva as pendências, destaques da produção, manutenção ou recados para o próximo turno..."
                  className="w-full bg-[var(--bg)] border border-[var(--line)] rounded-xl p-3 text-xs font-medium text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </>
          ) : (
            /* HISTORY TAB */
            <div className="space-y-4">
              {isLoadingHistory ? (
                <div className="py-12 text-center text-xs font-bold text-[var(--muted)] animate-pulse">
                  Consultando registros históricos no Firebase Firestore...
                </div>
              ) : historyList.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <History className="w-10 h-10 text-[var(--muted)] mx-auto opacity-50" />
                  <p className="text-sm font-bold text-[var(--ink)]">Nenhum fechamento de turno registrado ainda.</p>
                  <p className="text-xs text-[var(--muted)]">
                    Quando você finalizar um turno na primeira aba, o snapshot ficará disponível aqui.
                  </p>
                </div>
              ) : selectedHistoricalRecord ? (
                /* Selected Single Record View */
                <div className="space-y-4 bg-[var(--surface-1)] border border-[var(--line)] rounded-2xl p-5">
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                    <button
                      onClick={() => setSelectedHistoricalRecord(null)}
                      className="text-xs font-black text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      ← Voltar à lista de fechamentos
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePrintOrExport}
                        className="px-3 py-1 bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Imprimir</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-[var(--paper)] rounded-xl border border-[var(--line)]">
                      <span className="text-[10px] text-[var(--muted)] font-bold">Data & Turno</span>
                      <p className="text-sm font-black mt-0.5">{formatDateBR(selectedHistoricalRecord.date)} ({selectedHistoricalRecord.shift})</p>
                    </div>
                    <div className="p-3 bg-[var(--paper)] rounded-xl border border-[var(--line)]">
                      <span className="text-[10px] text-[var(--muted)] font-bold">Fechado Por</span>
                      <p className="text-sm font-black mt-0.5 truncate">{selectedHistoricalRecord.closedBy}</p>
                    </div>
                    <div className="p-3 bg-[var(--paper)] rounded-xl border border-[var(--line)]">
                      <span className="text-[10px] text-[var(--muted)] font-bold">Presença Efetiva</span>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {selectedHistoricalRecord.attendanceRate}% ({selectedHistoricalRecord.presentCount}/{selectedHistoricalRecord.totalHeadcount})
                      </p>
                    </div>
                    <div className="p-3 bg-[var(--paper)] rounded-xl border border-[var(--line)]">
                      <span className="text-[10px] text-[var(--muted)] font-bold">Rotinas</span>
                      <p className="text-sm font-black mt-0.5">
                        {selectedHistoricalRecord.completedRoutinesCount} de {selectedHistoricalRecord.totalRoutinesCount}
                      </p>
                    </div>
                  </div>

                  {selectedHistoricalRecord.supervisorNotes && (
                    <div className="p-3.5 bg-[var(--paper)] rounded-xl border border-[var(--line)]">
                      <span className="text-xs font-black text-[var(--ink)] block mb-1">Observações do Supervisor / Passagem:</span>
                      <p className="text-xs text-[var(--muted)] font-medium whitespace-pre-wrap">{selectedHistoricalRecord.supervisorNotes}</p>
                    </div>
                  )}

                  {/* Tasks in this historical record */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-black uppercase text-[var(--muted)]">Postos Operacionais</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedHistoricalRecord.tasksSummary.map((ts, idx) => (
                        <div key={idx} className="p-2 bg-[var(--paper)] rounded-lg border border-[var(--line)] flex items-center justify-between text-xs">
                          <span className="font-semibold truncate">{ts.taskName}</span>
                          <span className="font-black text-[11px] ml-1">{ts.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* History Table List */
                <div className="space-y-2">
                  {historyList.map((rec) => (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedHistoricalRecord(rec)}
                      className="p-3.5 bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--line)] rounded-xl flex items-center justify-between transition-all cursor-pointer group shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                          {rec.shift}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-[var(--ink)]">{formatDateBR(rec.date)}</span>
                            <span className="text-[10px] text-[var(--muted)] font-bold">Turno {rec.shift}</span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black">
                              • {rec.attendanceRate}% Presença
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--muted)]">
                            Fechado por <strong className="text-[var(--ink)]">{rec.closedBy}</strong> em {new Date(rec.closedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRecord(rec.id, e)}
                          className="p-1.5 text-[var(--muted)] hover:text-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                          title="Excluir Registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-[var(--muted)] group-hover:text-[var(--ink)] transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 border-t border-[var(--line)] bg-[var(--surface-1)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <Database className="w-3.5 h-3.5 text-amber-500" />
            <span>Coleção: <code className="font-mono font-bold text-[var(--ink)]">{workspaceName}</code></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--ink)] rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            {activeTab === 'close_now' && (
              <button
                type="button"
                onClick={handleSaveShiftClosing}
                disabled={isSaving}
                className={`px-4 py-2 text-xs font-black rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black'
                }`}
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Fechamento Gravado!</span>
                  </>
                ) : isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Gravando no Firestore...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Fechar Turno & Gravar Snapshot</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
