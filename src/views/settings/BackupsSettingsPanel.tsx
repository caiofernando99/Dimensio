import { ConfirmModal } from '../../components/ConfirmModal';
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Check,
  Clock,
  Cloud,
  CloudDownload,
  CloudOff,
  Copy,
  Database,
  Download,
  HardDriveDownload,
  History,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';

interface BackupsSettingsPanelProps {
  checkPermissionOrAlert: (requireAdmin?: boolean) => boolean;
  copiedShareLink?: boolean;
  onCopyShareConnectionLink?: () => void;
}

export const BackupsSettingsPanel: React.FC<BackupsSettingsPanelProps> = ({
  checkPermissionOrAlert,
  copiedShareLink = false,
  onCopyShareConnectionLink,
}) => {
  const {
    state,
    showNotice,
    lastAutoBackupInfo,
    backupHistory,
    createAutoBackup,
    restoreFromAutoBackup,
    restoreBackupById,
    deleteBackupById,
    clearBackupHistory,
    exportBackupToFile,
    generateShareableConnectionLink,
    setAbsenteeismPeriodDays,
    openSetupWizard,
    updateAutoBackupSettings,
    firestoreBackups,
    isLoadingFirestoreBackups,
    refreshFirestoreBackups,
    createFirestoreBackup,
    restoreFromFirestoreBackup,
    deleteFirestoreBackupById,
    syncToOnlineSpreadsheet,
    importFullStateWithBackup,
    clearSampleData,
  } = useApp();

  const [cloudBackups, setCloudBackups] = useState<
    Array<{
      id: string;
      index: number;
      type: string;
      timestamp: string;
      formattedDate: string;
      reason: string;
      collaboratorCount: number;
      teamName: string;
    }>
  >([]);
  const [cloudBackupsLoading, setCloudBackupsLoading] = useState(false);
  const [cloudBackupsError, setCloudBackupsError] = useState('');
  const [confirmCloudRestoreId, setConfirmCloudRestoreId] = useState<string | null>(null);
  const [restoringCloud, setRestoringCloud] = useState(false);
  const [pendingCloudRestorePublish, setPendingCloudRestorePublish] = useState(false);

  // Firestore Backups State & Handlers
  const [confirmFirestoreRestoreId, setConfirmFirestoreRestoreId] = useState<string | null>(null);
  const [restoringFirestore, setRestoringFirestore] = useState(false);
  const [isCreatingFirestoreBackup, setIsCreatingFirestoreBackup] = useState(false);
  const [firestoreFilterCadence, setFirestoreFilterCadence] = useState<'all' | 'daily' | 'interval' | 'manual' | 'recovery'>('all');

  const handleRestoreFromFirestoreBackup = async () => {
    if (!confirmFirestoreRestoreId) return;
    setRestoringFirestore(true);
    try {
      await restoreFromFirestoreBackup(confirmFirestoreRestoreId);
      setConfirmFirestoreRestoreId(null);
    } catch {
      // Handled inside restoreFromFirestoreBackup
    } finally {
      setRestoringFirestore(false);
    }
  };

  const handleCreateFirestoreBackupNow = async () => {
    if (!checkPermissionOrAlert()) return;
    setIsCreatingFirestoreBackup(true);
    try {
      const res = await createFirestoreBackup('Ponto de Backup Manual nas Configurações', 'manual');
      if (res.success) {
        showNotice('Backup gravado no Firestore com sucesso!', undefined, undefined, 'success');
      } else {
        showNotice(res.error || 'Erro ao gravar backup no Firestore.');
      }
    } finally {
      setIsCreatingFirestoreBackup(false);
    }
  };

  const loadCloudBackups = async () => {
    const url = state.onlineSpreadsheet?.webhookUrl?.trim();
    if (!url) {
      showNotice('Conecte uma planilha com o Apps Script atualizado primeiro.');
      return;
    }
    setCloudBackupsLoading(true);
    setCloudBackupsError('');
    try {
      const res = await fetch(`${url}?mode=backups`);
      const data = await res.json();
      const ok = data && (data.ok === true || data.status === 'success');
      if (ok && Array.isArray(data.backups)) {
        setCloudBackups(
          data.backups.map((b: Record<string, unknown>) => ({
            id: String(b.id || (b.type === 'DAILY' ? 'DAILY:' : 'SYNC:') + (b.index ?? b.i)),
            index: Number(b.index ?? b.i) || 0,
            type: String(b.type || ''),
            timestamp: String(b.timestamp || ''),
            formattedDate: String(b.formattedDate || b.timestamp || ''),
            reason: String(b.reason || 'Backup automático de sincronização'),
            collaboratorCount: Number(b.collaboratorCount ?? b.collaborators) || 0,
            teamName: String(b.teamName || ''),
          }))
        );
        if (data.backups.length === 0) {
          showNotice('Nenhum backup encontrado na planilha ainda. Eles são criados automaticamente a cada sincronização.');
        }
      } else {
        setCloudBackups([]);
        setCloudBackupsError(
          data?.error ||
            'Não foi possível listar backups. Atualize o Apps Script na planilha para a versão mais recente (que mantém backups automáticos na própria planilha).'
        );
      }
    } catch {
      setCloudBackups([]);
      setCloudBackupsError('Erro de rede ao consultar os backups da planilha.');
    } finally {
      setCloudBackupsLoading(false);
    }
  };

  const handleRestoreFromCloudBackup = async () => {
    if (!confirmCloudRestoreId) return;
    const url = state.onlineSpreadsheet?.webhookUrl?.trim();
    if (!url) return;
    setRestoringCloud(true);
    try {
      const res = await fetch(`${url}?mode=backup&id=${encodeURIComponent(confirmCloudRestoreId)}`);
      const data = await res.json();
      const ok = data && (data.ok === true || data.status === 'success');
      let restoredState = data && (data.state || data.stateRaw);
      if (typeof restoredState === 'string') {
        try {
          restoredState = JSON.parse(restoredState);
        } catch {
          restoredState = null;
        }
      }
      if (ok && restoredState) {
        importFullStateWithBackup(restoredState, 'full', true);
        setPendingCloudRestorePublish(true);
        showNotice(
          'Backup restaurado no aplicativo. Publicando os dados na planilha...',
          undefined,
          undefined,
          'sync'
        );
      } else {
        showNotice(data?.error || data?.message || 'Falha ao ler o backup da planilha.');
      }
    } catch {
      showNotice('Erro de rede ao restaurar o backup da planilha.');
    } finally {
      setRestoringCloud(false);
      setConfirmCloudRestoreId(null);
    }
  };

  // After a cloud restore, publish the restored state back to the spreadsheet so
  // that fresh connections (shared links) receive the real team data.
  useEffect(() => {
    if (!pendingCloudRestorePublish) return;
    const t = setTimeout(async () => {
      setPendingCloudRestorePublish(false);
      try {
        const ok = await syncToOnlineSpreadsheet(false);
        if (ok) {
          showNotice(
            'Dados restaurados e republicados na planilha com sucesso! Quem abrir o link compartilhado agora receberá os dados reais da equipe.',
            undefined,
            undefined,
            'sync'
          );
        } else {
          showNotice(
            'Restauração local concluída, mas não foi possível republicar na planilha automaticamente. Use "Enviar para a Planilha" para publicar os dados restaurados.',
            'Enviar para a Planilha',
            () => {
              syncToOnlineSpreadsheet(false);
            },
            'sync'
          );
        }
      } catch {
        showNotice('Erro ao republicar os dados na planilha. Tente "Enviar para a Planilha" manualmente.');
      }
    }, 900);
    const handleCopyShareConnectionLink = () => {
    if (onCopyShareConnectionLink) {
      onCopyShareConnectionLink();
      return;
    }
    const link = generateShareableConnectionLink();
    if (!state.onlineSpreadsheet?.url) {
      showNotice(
        'Ainda não há planilha online configurada. Primeiro conecte uma planilha compartilhada (Configurações > Conectar Planilha Online) e depois gere o link.'
      );
      return;
    }
    navigator.clipboard.writeText(link);
    showNotice('Link direto de conexão em nuvem copiado com sucesso! Compartilhe com os colegas de turno.');
  };

  return () => clearTimeout(t);
  }, [pendingCloudRestorePublish, syncToOnlineSpreadsheet, showNotice]);


  const handleCopyShareConnectionLink = () => {
    if (onCopyShareConnectionLink) {
      onCopyShareConnectionLink();
      return;
    }
    const link = generateShareableConnectionLink();
    if (!state.onlineSpreadsheet?.url) {
      showNotice(
        'Ainda não há planilha online configurada. Primeiro conecte uma planilha compartilhada (Configurações > Conectar Planilha Online) e depois gere o link.'
      );
      return;
    }
    navigator.clipboard.writeText(link);
    showNotice('Link direto de conexão em nuvem copiado com sucesso! Compartilhe com os colegas de turno.');
  };

  return (
    <>
      <div className="space-y-4">
          {/* Header Banner */}
          <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-[var(--ink)]">
                  Central de Segurança, Diagnósticos e Gestão de Backups
                </h3>
                <p className="text-xs text-[var(--muted)] font-semibold">
                  Proteja sua operação contra perdas acidentais de dados durante importações e trocas de turno.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (!checkPermissionOrAlert()) return;
                const info = createAutoBackup('Backup de Emergência Manual');
                if (info) showNotice('Novo ponto de restauração criado com sucesso!');
              }}
              className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Ponto de Restauração Manual Agora</span>
            </button>
          </div>

          {/* Configuração de Backup Automático & Agendamento no Firestore */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Agendamento de Backups Automáticos & Nuvem Firestore</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  (state.autoBackupSettings?.enabled ?? true) ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                }`}>
                  {(state.autoBackupSettings?.enabled ?? true) ? 'Backup Ativo' : 'Desativado'}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  (state.autoBackupSettings?.saveToFirestore ?? true) ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                }`}>
                  {(state.autoBackupSettings?.saveToFirestore ?? true) ? 'Nuvem Firestore Ativa' : 'Apenas Local'}
                </span>
              </div>
            </div>

            {/* Banner de Proteção contra Falhas de Conexão e Corrupção de Planilha */}
            <div className="p-3.5 bg-gradient-to-r from-blue-500/10 via-emerald-500/5 to-transparent border border-blue-500/20 rounded-xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="font-extrabold text-[var(--ink)] flex items-center gap-2">
                  <span>Proteção Contínua contra Corrupção de Planilha & Quedas de Rede</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-black uppercase bg-emerald-500 text-white rounded">Garantia Ativa</span>
                </div>
                <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                  Os backups agendados são gravados de forma isolada no banco de dados Firestore. Caso a planilha Google Sheets fique inacessível, tenha fórmulas corrompidas ou sofra perda acidental de linhas, você pode recuperar todo o dimensionamento, presença e postos instantaneamente com um clique.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Ativar Backup Geral */}
              <label className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-extrabold text-[var(--ink)]">Backup Automático</div>
                  <div className="text-[10px] text-[var(--muted)] font-medium">Habilita agendamentos periódicos</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.autoBackupSettings?.enabled ?? true}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateAutoBackupSettings({ enabled: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-[var(--primary)] focus:ring-0 cursor-pointer"
                />
              </label>

              {/* Salvar no Firestore */}
              <label className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-extrabold text-[var(--ink)]">Salvar no Firestore</div>
                  <div className="text-[10px] text-[var(--muted)] font-medium">Grava cópias seguras na nuvem</div>
                </div>
                <input
                  type="checkbox"
                  checked={state.autoBackupSettings?.saveToFirestore ?? true}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateAutoBackupSettings({ saveToFirestore: e.target.checked });
                  }}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
              </label>

              {/* Cadência do Agendamento */}
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                <label className="block text-[10px] font-black uppercase text-[var(--muted)]">Cadência do Agendamento</label>
                <select
                  value={state.autoBackupSettings?.scheduleCadence || 'daily'}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateAutoBackupSettings({
                      scheduleCadence: e.target.value as 'daily' | 'hourly' | 'interval' | 'manual',
                    });
                  }}
                  className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                >
                  <option value="daily">📅 Diário (horário fixo diário)</option>
                  <option value="interval">⏱️ Periódico (intervalo de minutos)</option>
                  <option value="hourly">⏰ A cada 1 hora (de hora em hora)</option>
                  <option value="manual">👤 Apenas sob demanda (manual)</option>
                </select>
              </div>

              {/* Horário do Backup Diário */}
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-black uppercase text-[var(--muted)]">Horário do Backup Diário</label>
                  <span className="text-[9px] text-blue-600 dark:text-blue-400 font-bold">Todo dia</span>
                </div>
                <input
                  type="time"
                  value={state.autoBackupSettings?.dailyBackupTime || '06:00'}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateAutoBackupSettings({ dailyBackupTime: e.target.value || '06:00' });
                  }}
                  className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-black rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
              {/* Intervalo Periódico */}
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                <label className="block text-[10px] font-black uppercase text-[var(--muted)]">Intervalo Periódico Local</label>
                <select
                  value={state.autoBackupSettings?.intervalMinutes ?? 30}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateAutoBackupSettings({ intervalMinutes: Number(e.target.value) });
                  }}
                  className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                >
                  <option value={15}>A cada 15 minutos</option>
                  <option value={30}>A cada 30 minutos (recomendado)</option>
                  <option value={60}>A cada 1 hora</option>
                  <option value={120}>A cada 2 horas</option>
                  <option value={360}>A cada 6 horas</option>
                  <option value={1440}>A cada 24 horas (Diário)</option>
                </select>
              </div>

              {/* Retenção no Firestore */}
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                <label className="block text-[10px] font-black uppercase text-[var(--muted)]">Retenção de Backups no Firestore</label>
                <select
                  value={state.autoBackupSettings?.maxRetainFirestoreBackups ?? 30}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateAutoBackupSettings({ maxRetainFirestoreBackups: Number(e.target.value) });
                  }}
                  className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                >
                  <option value={7}>Manter 7 dias de histórico</option>
                  <option value={14}>Manter 14 dias de histórico</option>
                  <option value={30}>Manter 30 dias de histórico (recomendado)</option>
                  <option value={60}>Manter 60 dias de histórico completo</option>
                </select>
              </div>

              {/* Retenção Local */}
              <div className="p-3 bg-[var(--bg)] border border-[var(--line)] rounded-xl space-y-1">
                <label className="block text-[10px] font-black uppercase text-[var(--muted)]">Retenção de Snapshots Locais</label>
                <select
                  value={state.autoBackupSettings?.maxRetainSnapshots ?? 20}
                  onChange={(e) => {
                    if (!checkPermissionOrAlert()) return;
                    updateAutoBackupSettings({ maxRetainSnapshots: Number(e.target.value) });
                  }}
                  className="w-full bg-[var(--paper)] border border-[var(--line)] text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-[var(--ink)]"
                >
                  <option value={5}>Manter 5 últimos pontos</option>
                  <option value={10}>Manter 10 últimos pontos</option>
                  <option value={20}>Manter 20 últimos pontos</option>
                  <option value={50}>Manter 50 últimos pontos</option>
                </select>
              </div>
            </div>

            {/* Status do Último Backup do Firestore & Local */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="text-[11px] text-[var(--muted)] font-medium bg-[var(--bg)] p-3 rounded-xl border border-[var(--line)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-500 shrink-0" />
                  <div>
                    <span className="font-extrabold text-[var(--ink)] block">Último Backup no Firestore:</span>
                    <span>
                      {state.autoBackupSettings?.lastFirestoreBackupAt
                        ? new Date(state.autoBackupSettings.lastFirestoreBackupAt).toLocaleString('pt-BR')
                        : 'Nenhum backup em nuvem registrado nesta sessão'}
                    </span>
                  </div>
                </div>
                {state.autoBackupSettings?.lastFirestoreBackupStatus === 'success' && (
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black rounded-md">
                    Gravado OK
                  </span>
                )}
              </div>

              <div className="text-[11px] text-[var(--muted)] font-medium bg-[var(--bg)] p-3 rounded-xl border border-[var(--line)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-extrabold text-[var(--ink)] block">Último Snapshot Local:</span>
                    <span>
                      {lastAutoBackupInfo?.formattedDate
                        ? lastAutoBackupInfo.formattedDate
                        : 'Nenhum snapshot local recente'}
                    </span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-[var(--muted)]">
                  {backupHistory.length} pontos salvos
                </span>
              </div>
            </div>
          </div>

          {/* Lista de Backups Salvos no Firestore (Recuperação de Desastres) */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 text-[var(--ink)] font-extrabold text-sm">
                <Database className="w-4 h-4 text-blue-600" />
                <span>Backups Automáticos & Diários no Firestore (Recuperação em Nuvem)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  {firestoreBackups.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => refreshFirestoreBackups()}
                  disabled={isLoadingFirestoreBackups}
                  className="px-3 py-1.5 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--paper)] text-[var(--ink)] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Atualizar lista de backups da nuvem Firestore"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFirestoreBackups ? 'animate-spin' : ''}`} />
                  <span>{isLoadingFirestoreBackups ? 'Atualizando...' : 'Atualizar Lista'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCreateFirestoreBackupNow}
                  disabled={isCreatingFirestoreBackup}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isCreatingFirestoreBackup ? 'Gravando...' : 'Criar Ponto no Firestore Agora'}</span>
                </button>
              </div>
            </div>

            {/* Filtros de Cadência */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-[10px] font-black uppercase text-[var(--muted)] mr-1">Filtrar:</span>
              {[
                { id: 'all', label: 'Todos os Backups' },
                { id: 'daily', label: '📅 Diários Agendados' },
                { id: 'interval', label: '⏱️ Periódicos' },
                { id: 'manual', label: '👤 Manuais' },
                { id: 'recovery', label: '🛡️ Segurança / Emergência' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFirestoreFilterCadence(f.id as any)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    firestoreFilterCadence === f.id
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'bg-[var(--bg)] border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Tabela de Backups do Firestore */}
            {firestoreBackups.length === 0 ? (
              <div className="p-8 text-center text-[var(--muted)] text-xs space-y-2 bg-[var(--bg)] rounded-xl border border-[var(--line)]">
                <Database className="w-8 h-8 mx-auto text-blue-500 opacity-60" />
                <p className="font-bold text-[var(--ink)]">Nenhum backup encontrado no Firestore ainda.</p>
                <p className="text-[11px] max-w-md mx-auto">
                  Os backups são gravados periodicamente e no horário diário agendado (padrão: 06:00). Você também pode clicar em "Criar Ponto no Firestore Agora" para salvar o estado atual.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleCreateFirestoreBackupNow}
                    disabled={isCreatingFirestoreBackup}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Criar Primeiro Backup na Nuvem</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] uppercase font-black text-[10px]">
                      <th className="p-3">Data e Hora</th>
                      <th className="p-3">Cadência</th>
                      <th className="p-3">Motivo / Identificador</th>
                      <th className="p-3">Dados Preservados</th>
                      <th className="p-3">Origem</th>
                      <th className="p-3 text-right">Ações de Recuperação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {firestoreBackups
                      .filter((b) => {
                        if (firestoreFilterCadence === 'all') return true;
                        if (firestoreFilterCadence === 'daily') return b.cadenceType === 'daily';
                        if (firestoreFilterCadence === 'interval') return b.cadenceType === 'interval';
                        if (firestoreFilterCadence === 'manual') return b.cadenceType === 'manual';
                        if (firestoreFilterCadence === 'recovery') return b.cadenceType === 'safety' || b.cadenceType === 'recovery';
                        return true;
                      })
                      .map((fb) => (
                        <tr key={fb.id} className="hover:bg-[var(--bg)]/50 transition-colors">
                          <td className="p-3 font-bold text-[var(--ink)] whitespace-nowrap">
                            {new Date(fb.createdAt).toLocaleDateString('pt-BR')} às {fb.createdTime || new Date(fb.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase tracking-wider ${
                              fb.cadenceType === 'daily'
                                ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20'
                                : fb.cadenceType === 'interval'
                                ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                                : fb.cadenceType === 'manual'
                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                            }`}>
                              {fb.cadenceType === 'daily'
                                ? '📅 Diário'
                                : fb.cadenceType === 'interval'
                                ? '⏱️ Periódico'
                                : fb.cadenceType === 'manual'
                                ? '👤 Manual'
                                : '🛡️ Segurança'}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-[var(--ink)]">
                            <span className="font-mono text-[11px] text-[var(--ink)]">
                              {fb.reason}
                            </span>
                          </td>
                          <td className="p-3 text-[var(--muted)] whitespace-nowrap">
                            <span className="font-extrabold text-[var(--ink)]">{fb.collaboratorCount || 0}</span> colabs ·{' '}
                            <span className="font-extrabold text-[var(--ink)]">{fb.taskCount || 0}</span> postos ·{' '}
                            <span className="font-extrabold text-[var(--ink)]">{fb.breakCount || 0}</span> pausas
                          </td>
                          <td className="p-3 text-[var(--muted)] text-[11px] whitespace-nowrap">
                            {fb.authorName || 'Sistema'}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setConfirmFirestoreRestoreId(fb.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                title="Restaurar a equipe e a operação a partir deste ponto no Firestore"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Restaurar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  try {
                                    const parsed = JSON.parse(fb.stateJson);
                                    const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `dimensio-firestore-backup-${fb.createdDate}-${fb.id.slice(0, 8)}.json`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    showNotice('Backup JSON baixado com sucesso!');
                                  } catch {
                                    showNotice('Erro ao gerar download do backup.');
                                  }
                                }}
                                className="p-1.5 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--paper)] text-[var(--ink)] rounded-lg text-[11px] cursor-pointer"
                                title="Baixar arquivo JSON deste backup"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm('Tem certeza de que deseja excluir este backup do Firestore?')) {
                                    deleteFirestoreBackupById(fb.id);
                                  }
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg cursor-pointer"
                                title="Excluir backup do Firestore"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dados da Operação (Opções Avançadas) */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 text-[var(--primary)] font-extrabold text-sm">
                <SlidersHorizontal className="w-4 h-4" />
                <h3 className="text-sm font-black text-[var(--ink)]">Dados da Operação</h3>
              </div>
              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${state.setupCompleted ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                {state.setupCompleted ? 'Configurado' : 'Configuração pendente'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Local / Unidade</div>
                <div className="text-xs font-extrabold text-[var(--ink)]">{state.location || '—'}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Setor</div>
                <div className="text-xs font-extrabold text-[var(--ink)]">{state.sector || '—'}</div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Tipo de Escala</div>
                <div className="text-xs font-extrabold text-[var(--ink)]">
                  {state.scaleType === 'custom' ? 'Personalizada' : 'Por turmas'}
                  <span className="ml-1.5 text-[10px] text-[var(--muted)] font-mono">
                    Turmas {(state.scaleGroups || []).join(', ') || '—'}
                  </span>
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Turnos</div>
                <div className="text-xs font-extrabold text-[var(--ink)]">
                  {(state.shifts || []).map((s) => `Turno ${s}`).join(' · ') || '—'}
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--muted)]">Período Absenteísmo</div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={state.absenteeismPeriodDays || 30}
                    onChange={(e) => setAbsenteeismPeriodDays(Number(e.target.value))}
                    title="Período padrão de cálculo do absenteísmo da operação"
                    className="px-2 py-1 bg-[var(--bg)] border border-[var(--line)] rounded-lg text-[10px] font-black text-[var(--ink)] cursor-pointer focus:outline-none focus:border-rose-500"
                  >
                    {[7, 15, 30, 45, 60, 90].map((d) => (
                      <option key={d} value={d}>{d} dias</option>
                    ))}
                  </select>
                  <span className="text-[10px] text-[var(--muted)] font-bold">padrão</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2 border-t border-[var(--line)]">
              <p className="text-xs text-[var(--muted)] leading-relaxed max-w-xl">
                Refaça o assistente guiado para ajustar local, turnos, tipo de escala, times/TL, cargos, tarefas e horários da operação.
              </p>
              <button
                onClick={openSetupWizard}
                className="px-4 py-2 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-xs font-black rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Reconfigurar Operação</span>
              </button>
            </div>
          </div>

          {/* Backup History Table */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 text-[var(--ink)] font-extrabold text-sm">
                <History className="w-4 h-4 text-amber-600" />
                <span>Histórico de Pontos de Restauração Salvos (Local & Nuvem)</span>
              </div>
              {backupHistory.length > 0 && (
                <button
                  onClick={clearBackupHistory}
                  className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Limpar Histórico de Backups
                </button>
              )}
            </div>

            {backupHistory.length === 0 ? (
              <div className="p-8 text-center text-[var(--muted)] text-xs space-y-2 bg-[var(--bg)] rounded-xl border border-[var(--line)]">
                <ShieldCheck className="w-8 h-8 mx-auto text-amber-500 opacity-60" />
                <p className="font-bold text-[var(--ink)]">Nenhum ponto de restauração manual criado ainda.</p>
                <p className="text-[11px]">
                  O sistema gera pontos de restauração automaticamente antes de limpezas ou importações.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] uppercase font-black text-[10px]">
                      <th className="p-3">Data e Hora</th>
                      <th className="p-3">Motivo / Origem</th>
                      <th className="p-3">Equipe / Qtd Colaboradores</th>
                      <th className="p-3 text-right">Ações de Segurança</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {backupHistory.map((snap) => (
                      <tr key={snap.id} className="hover:bg-[var(--bg)]/50 transition-colors">
                        <td className="p-3 font-bold text-[var(--ink)] whitespace-nowrap">
                          {snap.formattedDate}
                        </td>
                        <td className="p-3 font-semibold text-[var(--ink)]">
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20 rounded-md font-mono text-[11px]">
                            {snap.reason}
                          </span>
                        </td>
                        <td className="p-3 text-[var(--muted)]">
                          <strong className="text-[var(--ink)]">{snap.teamName || 'Equipe'}</strong> ({snap.collaboratorCount} colaboradores)
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => restoreBackupById(snap.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                              title="Restaurar este ponto de backup"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restaurar</span>
                            </button>
                            <button
                              onClick={() => exportBackupToFile(snap)}
                              className="p-1.5 bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--paper)] text-[var(--ink)] rounded-lg text-[11px] cursor-pointer"
                              title="Baixar JSON deste ponto"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteBackupById(snap.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg cursor-pointer"
                              title="Excluir do histórico"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Cloud Backups Stored Inside the Spreadsheet */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 text-[var(--ink)] font-extrabold text-sm">
                <Cloud className="w-4 h-4 text-sky-600" />
                <span>Backups na Nuvem (Guardados Dentro da Planilha)</span>
              </div>
              <button
                onClick={loadCloudBackups}
                disabled={cloudBackupsLoading || !state.onlineSpreadsheet?.webhookUrl}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-[11px] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cloudBackupsLoading ? 'animate-spin' : ''}`} />
                <span>{cloudBackupsLoading ? 'Carregando...' : 'Carregar Backups'}</span>
              </button>
            </div>

            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Antes de cada sincronização completa, o Apps Script guarda uma cópia automática de segurança da escala
              dentro da própria planilha (aba <code className="font-mono">__BACKUP__</code>). Se a planilha for
              sobrescrita por acidente com dados de exemplo, você pode restaurar um destes pontos diretamente da nuvem.
            </p>

            {!state.onlineSpreadsheet?.webhookUrl ? (
              <div className="p-6 text-center text-[var(--muted)] text-xs bg-[var(--bg)] rounded-xl border border-[var(--line)]">
                <CloudOff className="w-7 h-7 mx-auto text-slate-400 opacity-60 mb-2" />
                <p className="font-bold text-[var(--ink)]">Nenhuma planilha conectada.</p>
                <p className="text-[11px]">Conecte a planilha (com o Apps Script atualizado) para usar os backups da nuvem.</p>
              </div>
            ) : cloudBackupsError ? (
              <div className="p-6 text-center text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="font-bold text-red-700 dark:text-red-200">Não foi possível listar backups na planilha.</p>
                <p className="text-[11px] text-red-600 dark:text-red-300 mt-1">{cloudBackupsError}</p>
              </div>
            ) : cloudBackups.length === 0 ? (
              <div className="p-6 text-center text-[var(--muted)] text-xs bg-[var(--bg)] rounded-xl border border-[var(--line)]">
                <HardDriveDownload className="w-7 h-7 mx-auto text-sky-500 opacity-60 mb-2" />
                <p className="font-bold text-[var(--ink)]">Nenhum backup na nuvem ainda.</p>
                <p className="text-[11px]">
                  Clique em "Carregar Backups" para consultar. Os backups são criados automaticamente sempre que a
                  escala é sincronizada com a planilha.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--line)] bg-[var(--bg)] text-[var(--muted)] uppercase font-black text-[10px]">
                      <th className="p-3">Data e Hora</th>
                      <th className="p-3">Motivo / Origem</th>
                      <th className="p-3">Equipe / Qtd Colaboradores</th>
                      <th className="p-3 text-right">Ações de Segurança</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {cloudBackups.map((cb) => (
                      <tr key={cb.id || cb.index} className="hover:bg-[var(--bg)]/50 transition-colors">
                        <td className="p-3 font-bold text-[var(--ink)] whitespace-nowrap">{cb.formattedDate}</td>
                        <td className="p-3 font-semibold text-[var(--ink)]">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] border ${
                            cb.type === 'DAILY'
                              ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border-amber-500/20'
                              : 'bg-sky-500/10 text-sky-800 dark:text-sky-200 border-sky-500/20'
                          }`}>
                            {cb.reason}
                          </span>
                        </td>
                        <td className="p-3 text-[var(--muted)]">
                          <strong className="text-[var(--ink)]">{cb.teamName || 'Equipe'}</strong> ({cb.collaboratorCount} colaboradores)
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => setConfirmCloudRestoreId(cb.id)}
                            disabled={restoringCloud}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                            title="Baixar este backup da nuvem e restaurar no aplicativo"
                          >
                            <CloudDownload className="w-3.5 h-3.5" />
                            <span>Restaurar da Nuvem</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Share Connection Link */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-3 shadow-2xs">
            <div className="flex items-center gap-2 text-[var(--ink)] font-black text-sm border-b border-[var(--line)] pb-3">
              <Share2 className="w-4 h-4 text-emerald-600" />
              <span>Link Direto de Compartilhamento de Equipe (Evita Sobrescrever Dados)</span>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Em vez de enviar arquivos JSON de backup por e-mail, compartilhe o link direto abaixo com outros gestores. Ao abrir, o colega conecta o aplicativo à mesma planilha do Google Sheets de forma limpa e sem risco de perda de registros!
            </p>
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                readOnly
                value={generateShareableConnectionLink()}
                className="flex-1 bg-[var(--bg)] border border-[var(--line)] px-3 py-2 rounded-xl font-mono text-xs text-[var(--ink)] select-all"
              />
              <button
                onClick={handleCopyShareConnectionLink}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
              >
                {copiedShareLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedShareLink ? 'Copiado!' : 'Copiar Link'}</span>
              </button>
            </div>
          </div>

          {/* Limpeza de Estado & Reset para Operação */}
          <div className="bg-[var(--paper)] border border-[var(--line)] p-5 rounded-2xl space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-black shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[var(--ink)]">
                    Gerenciamento & Limpeza de Dados da Operação
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    Permite resetar o ambiente para um estado 100% limpo quando for necessário reiniciar a configuração.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  if (!checkPermissionOrAlert(true)) return;
                  if (window.confirm('Tem certeza de que deseja remover todos os colaboradores, cargos, turnos e postos? Um ponto de restauração de segurança será criado antes da limpeza.')) {
                    clearSampleData();
                  }
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 rounded-xl flex items-center justify-center gap-2 text-xs font-black transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Limpar e Resetar Todos os Dados da Operação</span>
              </button>
            </div>
          </div>
        </div>

      <ConfirmModal
        isOpen={confirmCloudRestoreId !== null}
        onClose={() => setConfirmCloudRestoreId(null)}
        onConfirm={handleRestoreFromCloudBackup}
        title="Restaurar Backup da Nuvem"
        description="O estado atual deste navegador será substituído pelos dados deste backup da planilha. Um backup de segurança local será criado automaticamente antes da restauração. Após restaurar, use 'Enviar para a Planilha' para republicar os dados na planilha, se desejar."
        confirmText="Restaurar Backup"
      />

      <ConfirmModal
        isOpen={confirmFirestoreRestoreId !== null}
        onClose={() => setConfirmFirestoreRestoreId(null)}
        onConfirm={handleRestoreFromFirestoreBackup}
        title="Restaurar Dados do Firestore (Nuvem)"
        description="O estado da aplicação será restaurado a partir deste ponto seguro gravado no Firestore. Um backup de segurança local será gerado automaticamente antes de aplicar as mudanças para total proteção contra perdas. Deseja continuar?"
        confirmText="Restaurar do Firestore"
      />
    </>
  );
};
