export * from './types/interactions';

export type ShiftGroup = 'A' | 'B' | 'C' | 'D';

export type ScaleType = '6x2' | 'custom';

export type AbsenceType = 'atraso' | 'ferias' | 'licenca' | 'treinamento' | 'atestado' | 'banco_horas' | 'falta_injustificada';

export interface ScheduledAbsence {
  id: string;
  type: AbsenceType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  notes?: string;
}

export interface Collaborator {
  id: string;
  name: string;
  login?: string;
  registration?: string;
  shift: string; // T1, T2, T3, T4, T5, Noite, etc.
  scale: string; // A, B, C, D (6x2) or custom scale group
  teamLeader?: string; // e.g. "Time do TL Bruno"
  sector?: string; // Setor do colaborador (ex: "Logística", "Expedição", "Recebimento", "SAC / Suporte", "TI")
  allowedSectors?: string[]; // Setores autorizados para prestação de suporte / apoio cross-setor
  canProvideCrossSectorSupport?: boolean; // Se pode prestar suporte / atuar em outros setores
  role: string;
  category: string;
  skills?: Record<string, number>; // skillName -> level (0-3)
  notes?: string;
  absences?: ScheduledAbsence[]; // Scheduled vacations, leaves, trainings
  companyProfileUrl?: string; // Link para perfil no sistema / intranet / RH da empresa
  profileUrl?: string; // alias alternativo
  photoUrl?: string; // URL da foto de perfil
  useCompanyPhoto?: boolean; // Se deve usar a foto sincronizada do sistema da empresa
  companyPhotoSelector?: string; // Seletor customizado para extensão extrair a foto
}

export interface TeamDefinition {
  id: string;
  name: string;
  shift: string;
  leaderName?: string;
}

export interface ShiftCustomConfig {
  shift?: string;
  startTime?: string; // Horário de início do turno (ex: 06:00)
  endTime?: string; // Horário de término do turno (ex: 14:20)
  manager?: string;
  workHours?: string;
  notes?: string;
  customRules?: string;
}

export type TaskPriority = 'alta' | 'media' | 'baixa';

export interface Task {
  id: string;
  name: string;
  members: string[]; // Collaborator IDs
  allowedRoles?: string[]; // Cargo(s) vinculados
  allowedCategories?: string[]; // Categoria(s) vinculadas
  requiredSkills?: string[]; // Skills necessárias para executar a tarefa
  parentId?: string; // ID da tarefa pai para ramificação hierárquica
  priority?: TaskPriority; // Prioridade operacional da tarefa
  minHeadcount?: number; // Quantidade mínima / meta planejada de colaboradores
  maxHeadcount?: number; // Limite máximo de colaboradores
  description?: string; // Descrição ou instruções do posto de trabalho
  active?: boolean; // Se a tarefa está ativa ou oculta
  externalUrl?: string; // Link direto para a tarefa no sistema externo da empresa
  shift?: string; // Turno específico da tarefa (se indefinido = tarefa padrão do setor / todos os turnos)
  allowedShifts?: string[]; // Lista de turnos permitidos
}

export type AutoAssignStrategy = 'balanced' | 'skills' | 'priority' | 'rotation';

export interface AutoAssignOptions {
  strategy?: AutoAssignStrategy;
  considerSkills?: boolean;
  considerRoles?: boolean;
  considerCategories?: boolean;
  considerPriorities?: boolean;
  respectMinHeadcount?: boolean;
  respectMaxHeadcount?: boolean;
  balanceDistribution?: boolean;
  targetTaskIds?: string[];
}

export interface CollabNote {
  id: string;
  text: string;
  createdAt: string; // ISO date string
}

export interface BreakSlot {
  id: string;
  name?: string;
  time: string; // HH:mm
  shift?: string;
  capacity?: number; // Opcional - sem limite de capacidade
}

export type ScheduledTaskPriority = 'baixa' | 'media' | 'alta' | 'urgente';

export type ScheduledTaskStatus = 'a_fazer' | 'em_andamento' | 'aguardando' | 'concluida' | 'cancelada';

export type RoutineRecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'custom_days' | 'shift_scale';

export interface RoutineRecurrence {
  type: RoutineRecurrenceType;
  interval?: number; // A cada N dias/semanas/meses
  daysOfWeek?: number[]; // [0..6] (0 = Domingo, 1 = Segunda, ... 6 = Sábado)
  dayOfMonth?: number; // 1..31
  time?: string; // HH:mm
  endTime?: string; // HH:mm
  shifts?: string[]; // Turnos associados (ex: ['T1', 'T2'])
  scaleGroups?: string[]; // Grupos de escala associados (ex: ['A', 'B'])
  endDate?: string; // YYYY-MM-DD
}

export interface ScheduledTaskSubtask {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  completedByName?: string;
}

export interface ScheduledTaskNote {
  id: string;
  text: string;
  createdAt: string;
  authorName: string;
  authorId?: string;
}

export interface ScheduledTask {
  id: string;
  title: string;
  description?: string;
  listId: string; // ID da lista/grupo (ex: 'default', 'rotinas_turno', 'auditorias')
  category?: string; // Categoria (ex: "Rotina de Turno", "Auditoria 5S", "Manutenção", "Qualidade", "Segurança", "Operação", "Checklist")
  priority: ScheduledTaskPriority;
  status: ScheduledTaskStatus;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm (horário de início / previsto)
  dueEndTime?: string; // HH:mm (horário de término previsto)
  startDate?: string; // YYYY-MM-DD
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  estimatedMinutes?: number;
  assignedTo: string[]; // IDs dos colaboradores atribuídos
  assignedRole?: string; // Atribuído ao cargo como um todo (opcional)
  assignedShift?: string; // Atribuído ao turno como um todo (opcional)
  subtasks: ScheduledTaskSubtask[];
  recurrence?: RoutineRecurrence;
  tags?: string[];
  color?: string;
  externalUrl?: string; // Link direto para sistema externo / documentação
  googleEventId?: string; // ID do evento sincronizado no Google Calendar
  googleTaskId?: string; // ID da tarefa sincronizada no Google Tasks
  syncedToGoogleCalendar?: boolean;
  syncedToGoogleTasks?: boolean;
  completedAt?: string;
  completedBy?: string;
  completedByName?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  notes?: ScheduledTaskNote[];
}

export interface ScheduledTaskList {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  isDefault?: boolean;
  order?: number;
  shift?: string;
}

export interface AutoBackupInfo {
  id?: string;
  timestamp: string;
  formattedDate: string;
  reason: string;
  collaboratorCount: number;
  taskCount: number;
  teamName?: string;
}

export interface BackupSnapshot {
  id: string;
  timestamp: string;
  formattedDate: string;
  reason: string;
  collaboratorCount: number;
  taskCount: number;
  teamName: string;
  state: AppState;
}

export interface DailyReport {
  generatedAt?: string;
  absenceReasons?: Record<string, string>; // collaboratorId -> reason
  occurrences?: Record<string, string>; // collaboratorId -> text
  generalNotes?: string;
  snapshot?: Array<{
    id: string;
    name: string;
    status: 'presente' | 'atraso' | 'ausente' | 'folga' | 'ferias' | 'licenca' | 'treinamento' | 'atestado' | 'banco_horas' | 'falta_injustificada';
    task: string;
    interval: string;
    absenceReason?: string;
    occurrence?: string;
  }>;
}

export interface ShiftClosingRecord {
  id: string;
  date: string;
  shift: string;
  closedAt: string;
  closedBy: string;
  leaderRole?: string;
  workspace: string;
  totalHeadcount: number;
  presentCount: number;
  absenceCount: number;
  attendanceRate: number;
  tasksSummary: Array<{ taskName: string; count: number }>;
  absentList: Array<{ name: string; status: string; reason?: string }>;
  occurrences: Array<{ collaboratorName: string; text: string }>;
  completedRoutinesCount: number;
  totalRoutinesCount: number;
  metricsSnapshot: Array<{ name: string; value: number; unit: string; target?: number }>;
  supervisorNotes?: string;
  fullStateSnapshotJson?: string;
}

export type ThemeOption =
  | 'dimensio'
  | 'aurora'
  | 'ocean'
  | 'sunset'
  | 'crimson'
  | 'midnight'
  | 'graphite'
  | 'material-emerald'
  | 'material-blue'
  | 'material-purple'
  | 'material-terracotta'
  | 'material-dark';

export interface OnlineSpreadsheetConfig {
  name: string; // e.g. "Planilha Oficial de Turnos - Logística T2"
  url: string; // e.g. "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit"
  webhookUrl?: string; // Optional Google Apps Script Web App / Webhook URL
  databaseProvider?: 'sheets' | 'firestore'; // Storage backend engine: Google Sheets or Firebase Firestore
  firestoreCollection?: string; // Custom collection / room name (default: 'dimensio_state')
  autoSyncEnabled?: boolean; // Real-time auto sync on edit
  lastSyncedAt?: string; // e.g. "25/07/2026 12:30:00"
  syncCount?: number;
  syncStatus?: 'success' | 'error' | 'testing';
  lastError?: string;
  /** TURN servers for P2P voice, one per line. Format: url, user:pass@url, or user:pass@url */
  turnServers?: string;
}

export interface ExtensionCustomSelector {
  id: string;
  name: string;
  urlPattern: string;
  selector: string;
  attribute?: string;
  description?: string;
  enabled?: boolean;
}

export interface ExtensionConfig {
  enabled?: boolean;
  highlightEnabled?: boolean;
  highlightCaseSensitive?: boolean;
  highlightIgnoreAccents?: boolean;
  highlightPalette?: string[];
  openSystemMode?: 'dedicated_window' | 'new_tab' | 'current_tab';
  quickFillsAutoSync?: boolean;
  quickFillsFloatingButton?: boolean;
  autoMetricsEnabled?: boolean;
  metricsCollectInterval?: number; // minutos (ex: 5, 10, 15, 30, 60)
  customSelectors?: ExtensionCustomSelector[];
  lastPingAt?: string;
}

export interface DeletedCollaborator {
  id: string;
  collaborator: Collaborator;
  deletedAt: string; // ISO date string
  expiresAt: string; // ISO date string (60 days later)
}

export type ProcessType = 'caracteristica' | 'curiosidade' | 'explicacao' | 'procedimento' | 'seguranca' | 'qualidade';

export type SlideId = 'cover' | 'operational_pdf' | 'process' | 'scale' | 'qa' | (string & {});

export interface SlideElementLayout {
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  hidden?: boolean;
}

export interface FreeSlideConfig {
  id: string;
  title: string;
  bgUrl?: string;
  bgColor?: string;
}

export interface SimpleSlideConfig {
  title?: string;
  subtitle?: string;
  items?: string[];
  accent?: string;
  bgUrl?: string;
  bgColor?: string;
}

export interface SlideTypography {
  fontFamily?: string;
  titleSize?: number;
  bodySize?: number;
  footerSize?: number;
}

export interface SlideConfigItem {
  id: SlideId;
  enabled: boolean;
  title?: string;
}

export interface SlideItem {
  id: string;
  type: 'text' | 'image' | 'shape';
  content: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  fontSize?: number;
  fontWeight?: number;
  align?: 'left' | 'center' | 'right';
  fontFamily?: string;
  color?: string;
  bgColor?: string;
  borderRadius?: number;
  objectFit?: 'contain' | 'cover';
  shape?: 'rect' | 'circle' | 'line';
  rotation?: number;
  opacity?: number;
  lineWidth?: number;
  borderColor?: string;
}

export interface ProcessKnowledge {
  id: string;
  title: string;
  category: string;
  type: ProcessType;
  description: string;
  keyTakeaways?: string[];
  imageUrl?: string;
  iconName?: string;
  active?: boolean;
  shift?: string;
}

export interface BriefingConfig {
  coverBgUrl?: string;
  coverBgColor?: string;
  coverBgOverlayOpacity?: number;
  coverTitle?: string;
  coverSubtitle?: string;
  coverTeamName?: string;
  coverSectorShiftText?: string;
  coverDateText?: string;
  coverFooterCustomText?: string;
  motivationalQuote?: string;
  showQuote?: boolean;
  coverHideHeader?: boolean;
  coverHideLogo?: boolean;
  coverHideTeamName?: boolean;
  coverHideSectorShift?: boolean;
  coverHideDateBadge?: boolean;
  coverHideCategoryBadge?: boolean;
  coverHideMainTitle?: boolean;
  coverHideQuote?: boolean;
  coverHideFooter?: boolean;
  coverHidePresentStats?: boolean;
  coverHideManagerStat?: boolean;
  pdfUrl?: string;
  pdfPageNumber?: number;
  pdfDirectImageUrl?: string;
  pdfFitMode?: 'contain' | 'width' | 'cover';
  pdfZoom?: number;
  pdfPanX?: number;
  pdfPanY?: number;
  qaQuestions?: string[];
  qaTitle?: string;
  qaSubtitle?: string;
  qaDescription?: string;
  qaBgUrl?: string;
  qaDirectImageUrl?: string;
  qaSafetyText?: string;
  qaQualityText?: string;
  qaSupportText?: string;
  scaleTitle?: string;
  scaleSubtitle?: string;
  scaleFooterText?: string;
  scaleTitleSize?: number;
  scaleSubtitleSize?: number;
  scaleFooterSize?: number;
  scaleTaskNameSize?: number;
  scaleCollaboratorNameSize?: number;
  scaleCardPadding?: 'compact' | 'normal' | 'spacious';
  scaleGridCols?: 'auto' | 2 | 3 | 4 | 5;
  scaleHeaderStyle?: 'banner' | 'subtle' | 'minimal';
  scaleHeaderBgColor?: string;
  scaleTaskOrderIds?: string[];
  scaleIncludeDailyReport?: boolean;
  slideOrder?: SlideConfigItem[];
  slideItems?: Record<string, SlideItem[]>;
  freeSlides?: FreeSlideConfig[];
  simpleSlides?: Record<string, SimpleSlideConfig>;
  elementLayout?: Record<string, Record<string, SlideElementLayout>>;
  slideBgColor?: Record<string, string>;
  slideTheme?: Record<string, { accent?: string }>;
  typography?: Record<string, SlideTypography>;
}

export type RoleAccessLevel = 'portal' | 'viewer' | 'editor' | 'admin';

export interface FeedbackConfig {
  formUrl?: string;
  entryMessage?: string;
  entryName?: string;
  entryCategory?: string;
}

export type UserWorkStatus = 'disponivel' | 'em_atendimento' | 'focado_rotina' | 'pausa' | 'offline';

export interface UserPersonalPreferences {
  soundEnabled?: boolean;
  popupEnabled?: boolean;
  notifyAssignedRoutines?: boolean;
  notifySupportRequests?: boolean;
  notifyMyRequestUpdates?: boolean;
  notifyShiftNotices?: boolean;
  theme?: ThemeOption;
  pinnedTaskIds?: string[];
  favoriteQuickFillIds?: string[];
  customShortcuts?: Record<string, string>;
  privateScratchpad?: string;
}

export interface UserProfileData {
  uid: string; // Firebase UID or collaboratorId
  email?: string;
  displayName: string;
  photoUrl?: string;
  collaboratorId?: string; // Linked collaborator in state.collaborators
  role?: string;
  shift?: string;
  sector?: string; // Setor do usuário (ex: "Logística", "Expedição", "Recebimento", "SAC / Suporte", "TI / Sistemas")
  allowedSectors?: string[]; // Setores adicionais permitidos para visualização / prestação de suporte
  canProvideCrossSectorSupport?: boolean; // Se pode prestar suporte intersetorial
  teamLeader?: string;
  category?: string;
  isSupportAttendant?: boolean; // Se atua ativamente no suporte / helpdesk
  workStatus?: UserWorkStatus;
  statusCustomMessage?: string;
  preferences?: UserPersonalPreferences;
  lastSeenMs?: number;
  updatedAt?: string;
}

export interface IdentifiedUser {
  id: string; // collaboratorId or 'admin' or 'super_admin' or firebaseUid
  name: string;
  login?: string;
  registration?: string;
  role: string;
  shift?: string; // e.g. 'T1', 'T2', 'T3'
  sector?: string; // Setor de atuação do colaborador
  allowedSectors?: string[];
  canProvideCrossSectorSupport?: boolean;
  category?: string;
  isEditor: boolean;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  accessLevel?: RoleAccessLevel;
  collaboratorId?: string;
  firebaseUid?: string;
  email?: string;
  photoUrl?: string;
  isSupportAttendant?: boolean;
  workStatus?: UserWorkStatus;
  statusCustomMessage?: string;
  identifiedAt?: number; // Timestamp in ms when session started (expires in 6 hours)
}

export interface AutoBackupSettings {
  enabled: boolean;
  intervalMinutes: number; // e.g. 15, 30, 60, 360, 1440
  maxRetainSnapshots: number; // e.g. 10, 20, 50
  lastAutoBackupAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string; // ISO or formatted date string
  userName: string; // Name of identified user or 'Sistema / Anônimo'
  userId?: string;
  userRole?: string;
  actionType: 'alocacao' | 'presenca' | 'intervalo' | 'colaborador' | 'tarefa' | 'configuracao' | 'pedido' | 'backup' | 'info_hub' | 'outro';
  action?: string; // alias for actionType filtering
  description: string;
  dateStr?: string; // Date of scale context if relevant (YYYY-MM-DD)
  details?: Record<string, any> | string;
  snapshot?: Partial<AppState>; // State snapshot recorded at change time for rollback
}

export interface NotificationPreferences {
  enabledTypes: {
    request: boolean;        // Pedidos de Ação & Serviço
    notice: boolean;         // Avisos Operacionais
    password_reset: boolean; // Redefinições de Senha
    system: boolean;         // Informações do Sistema
  };
  filterByRoleMode: 'all' | 'my_role_only' | 'custom_roles';
  enabledRoles: string[];    // Selected roles when custom_roles is active
}

export interface SystemNotification {
  id: string;
  createdAt: string; // ISO
  targetUserId?: string; // Specific user or undefined if for all
  targetUsers?: string[];
  targetRole?: string; // e.g. 'admin' or 'editor'
  shift?: string; // e.g. 'T1', 'T2', 'T3' — undefined means all shifts
  targetShift?: string;
  targetShiftAudience?: string; // 'atual' | 'proximo' | 'proximos' | 'todos'
  targetSector?: string; // Setor alvo da notificação
  isCrossSector?: boolean;
  senderName: string;
  title: string;
  message: string;
  type: 'password_reset' | 'request' | 'notice' | 'system';
  read: boolean;
  clearedByUserIds?: string[];
  readByUserIds?: string[];
  data?: {
    requestId?: string;
    supportId?: string;
    collaboratorId?: string;
    targetCollaboratorId?: string;
    targetCollaboratorIds?: string[];
    collaboratorName?: string;
    selectedCollaborators?: string[];
    taskId?: string;
    taskName?: string;
    taskExternalUrl?: string;
    targetSector?: string;
    sector?: string;
    isCrossSector?: boolean;
    userId?: string;
    userName?: string;
    userShift?: string;
    senderId?: string;
    senderName?: string;
    action?: string;
    shift?: string;
    targetAudience?: string;
    clearedByUserIds?: string[];
    readByUserIds?: string[];
  };
}

export interface ServiceRequest {
  id: string;
  createdAt: string; // ISO
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  requesterSector?: string; // Setor de origem do solicitante
  targetSector?: string; // Setor de destino do pedido (ex: "TI", "Manutenção", "Liderança", "Expedição")
  isCrossSector?: boolean; // Se o pedido é intersetorial
  targetId?: string; // 'admin' or specific TL/user ID
  targetName?: string;
  type: 'aviso' | 'acao_sistemica';
  subtype?: 'geral' | 'problema_tarefa';
  title: string;
  description: string;
  priority?: 'baixa' | 'normal' | 'media' | 'alta' | 'urgente';
  status: 'pendente' | 'lido' | 'realizado';
  collaboratorId?: string;
  collaboratorName?: string;
  selectedCollaborators?: string[];
  taskId?: string;
  taskName?: string;
  taskExternalUrl?: string;
  completedAt?: string;
  completedBy?: string;

  // Shift & Target Audience properties
  shift?: string; // e.g. 'T2', 'T1', 'T3', 'ADM'
  targetShiftAudience?: 'atual' | 'proximo' | 'proximos' | 'todos' | string;
  visibleUntilShift?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface InfoHubReminder {
  id: string;
  shift: string; // 'T1' | 'T2' | 'T3' | 'ADM' | 'Todos'
  text: string;
  createdAt: string;
  authorId?: string;
  authorName?: string;
  priority?: 'normal' | 'alta' | 'urgente';
  updatedAt?: string;
  updatedBy?: string;
}

export interface InfoHubLink {
  id: string;
  title: string;
  url: string;
  category?: string; // e.g. "Sistemas Operacionais", "RH & Benefícios", "Impressão", "Documentação"
  description?: string;
  iconName?: string;
  shift?: string;
  showInPortal?: boolean; // Habilitado para exibição no Portal do Operador (configurado no Hub)
}

export interface QuickFillSubItem {
  id: string;
  label: string; // e.g. "Balança 04 - Expedição T2" or "Impressora Doca 02"
  codeValue: string; // e.g. "PRT-EXP-004-9982"
  description?: string;
}

export interface InfoHubQuickFill {
  id: string;
  title: string; // e.g. "Impressoras de Etiqueta" or "Respostas Padrão SAC"
  codeValue?: string; // Legado (para retrocompatibilidade)
  category?: string; // e.g. "Impressoras", "Sistemas", "Respostas Padrão", "Códigos"
  description?: string; // e.g. "Lista de impressoras operacionais ativas no setor"
  shift?: string;
  tags?: string[];
  items?: QuickFillSubItem[]; // Lista de códigos cadastrados dentro deste grupo
  triggerUrl?: string; // Padrão de URL do sistema: a extensão abre este grupo de preenchimento rápido automaticamente
}

// ─── Fluxo de automação (sequência de cliques para selecionar filtros etc.) ─
export type MetricFlowStepType = 'open_url' | 'click' | 'input' | 'select_option' | 'wait' | 'wait_selector';

export interface MetricFlowStep {
  type: MetricFlowStepType;
  selector?: string; // click | input | select_option | wait_selector
  url?: string; // open_url
  value?: string; // input | select_option (texto ou valor da opção)
  ms?: number; // wait (tempo em ms)
}

// ─── Métricas (coleta via extensão com "poderes Automa") ───────────────────
export type MetricTargetType = 'setor' | 'time' | 'tarefa';

export type MetricExtractMode = 'text' | 'attribute' | 'value';

export interface MetricFieldConfig {
  id: string;
  label: string; // Nome amigável do valor (ex: "Produção acumulada")
  selector: string; // Seletor CSS que localiza o elemento na página
  mode?: MetricExtractMode; // 'text' (padrão) | 'attribute' | 'value' (campo de formulário)
  attribute?: string; // Nome do atributo quando mode = 'attribute'
  key?: string; // Chave semântica do campo (ex: 'pending' | 'processing' para contagens de tarefas)
}

// Termo de contagem estilo "CTRL+F": um posto não é dividido por área — a
// mesma tarefa pode atender várias áreas. Para saber quantos itens pendentes
// cada área tem, a extensão aplica os filtros (fluxo) e conta as ocorrências
// de cada nome de área na página (como procurar e contar no navegador).
export interface MetricCountTerm {
  id: string;
  area: string; // Nome da área (ex: "Expedição", "Andar 2") procurado na página
  selector?: string; // Seletor CSS opcional restringindo onde essa área é contada
}

export interface MetricDefinition {
  id: string;
  name: string; // ex: "Produção do dia"
  targetType: MetricTargetType;
  targetId: string; // setor → state.sector | time → team.id | tarefa → task.id
  unit?: string; // ex: "caixas/hora", "%", "un."
  url?: string; // Link do sistema onde o valor é lido (fonte da coleta)
  fields: MetricFieldConfig[];
  schedule?: MetricSchedule; // Coleta automática recorrente
  flow?: MetricFlowStep[]; // Sequência de passos executada antes da coleta (ex: aplicar filtros do sistema)
  kind?: 'generic' | 'task_counts'; // 'task_counts' = contagem de tarefas Pendentes/Em processamento de um posto
  countTerms?: MetricCountTerm[]; // Nomes de áreas a contar por ocorrência de texto (kind = task_counts)
  countScope?: string; // Seletor CSS do contêiner onde contar (padrão: página toda)
  countKind?: 'pending' | 'processing' | 'generic'; // Visão filtrada que esta contagem representa
  createdAt?: string;
  createdBy?: string;
}

export interface TaskAreaCount {
  area: string;
  tasks: number; // total de tarefas da área com coleta registrada
  pending: number; // soma das Pendentes
  processing: number; // soma das Em processamento
  total: number; // pendentes + processando
  updatedAt?: string; // momento da coleta mais recente considerada
}

export interface MetricReading {
  id: string;
  metricId: string;
  capturedAt: string; // ISO timestamp
  capturedBy?: string; // Identificação de quem coletou (ou "extensão")
  values: Record<string, string>; // fieldId -> valor extraído/digitado
}

export interface MetricSchedule {
  enabled?: boolean;
  cadence?: 'diaria' | 'turnos' | 'semanal';
  times?: string[]; // HH:MM em que a coleta deve rodar automaticamente
  daysOfWeek?: number[]; // 0 (domingo) a 6 (sábado) — usado quando cadence = 'semanal'
}

export interface SupportTypeField {
  id: string;
  label: string; // Ex: "Código da Impressora"
  key?: string; // Chave (variável) usada em links de ação: {key}
  uppercase?: boolean; // Forçar caracteres em caixa alta
  maxLength?: number; // Limite de caracteres para evitar erro de digitação
  required?: boolean; // Campo obrigatório
  format?: SupportFieldFormat; // Formatação automática aplicada ao enviar
}

// Formatação automática do valor do campo (ex: "ps 1 104 136 2 1" -> "PS-1-104-136-02-01")
export interface SupportFieldFormat {
  // Exemplo do formato final esperado. A partir dele são inferidos:
  // separador de saída, nº de segmentos e largura/case de cada segmento.
  example?: string;
  // Separadores aceitos na digitação (ex: " .-"). Vazio = automático (espaço, hífen, ponto, barra, vírgula, sublinhado).
  inputSeparators?: string;
  // Separador de saída (vazio = inferido do exemplo).
  outputSeparator?: string;
}

// Vinculação entre um token {var} no link de ação e a origem do valor
export interface ActionLinkVar {
  token: string; // Ex: "codigo_impressora" (sem chaves)
  source: 'field' | 'nome' | 'turno' | 'categoria' | 'tipo' | 'codigo';
  fieldId?: string; // quando source === 'field'
  fieldKey?: string; // chave do campo quando source === 'field'
  label?: string; // rótulo de exibição
}

export interface SupportTypePreset {
  id: string;
  name: string;
  category?: string; // Optional default category association
  description?: string;
  placeholder?: string;
  priority?: 'baixa' | 'media' | 'alta' | 'urgente';
  defaultNote?: string;
  fields?: SupportTypeField[]; // Campos de texto configuráveis do chamado
  actionLink?: string; // Link com variáveis {chave} para abrir o sistema com dados preenchidos
  actionLinkVars?: ActionLinkVar[]; // Mapeamento de variáveis do link de ação
}

export interface ShareCustomConfig {
  cardHeaderStyle?: 'banner' | 'subtle' | 'minimal';
  breakDisplay?: 'grouped' | 'badge' | 'none';
  abbreviateNamesToggle?: boolean;
  hideEmptyTasks?: boolean;
  includeDailyReport?: boolean;
  footerNote?: string;
  showRoles?: boolean;
  showHeadcounts?: boolean;
  groupSubtasks?: boolean;
  headerAlignment?: 'left' | 'center' | 'right';
  quickConfig?: Record<string, any>;
}

export interface ShareFilterConfig {
  selectedShifts?: string[];
  selectedCategories?: string[];
  selectedRoles?: string[];
  selectedTLs?: string[];
  searchTerm?: string;
}

export interface ReportExportConfig {
  presenceExportKeys?: string[];
  customExportLabels?: Record<string, string>;
  mergedFields?: Array<{ id: string; label: string; sourceKeys: string[] }>;
  taskOrderIds?: string[];
  hiddenExportKeys?: string[];
  hiddenTaskExportIds?: string[];
}

export interface PortalPresetConfig {
  preConfiguredShift?: string;
  preConfiguredScale?: string;
  preConfiguredCategory?: string;
}

export interface HelpdeskConfig {
  enabled?: boolean;
  supportRoles?: string[]; // Cargos autorizados para atender suporte (ex: ['Suporte', 'TL', 'Admin', 'Analista'])
  supportTypes?: SupportTypePreset[]; // Tipos pré-configurados de chamado
  notifySound?: boolean;
  autoAssignCategory?: boolean;
  registeredSectors?: string[]; // Setores disponíveis no Helpdesk
  allowCrossSectorSupport?: boolean; // Permite chamados intersetoriais
}

export interface PortalNotificationConfig {
  taskRedirectionAlert?: boolean;
  soundAlerts?: boolean;
  vibrationAlerts?: boolean;
  shiftNotices?: boolean;
  supportStatusAlerts?: boolean;
}

export interface SupportMessage {
  id: string;
  createdAt: string; // ISO date
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm:ss
  senderId: string;
  senderName: string;
  senderRole?: string;
  senderShift?: string;
  senderCategory?: string;
  senderSector?: string; // Setor do solicitante (ex: "Logística - Inbound")
  targetSector?: string; // Setor de destino do chamado (ex: "TI / Sistemas", "Manutenção", "Liderança")
  isCrossSector?: boolean; // Se o chamado é intersetorial
  supportType?: string; // Preset support type (ex: "Problema no Coletor", "Ajuste de Tarefa", etc.)
  codeText?: string; // Max 40 chars text information / code / note
  imageUrl?: string; // Camera image / uploaded photo
  fields?: Array<{ id: string; label: string; value: string; key?: string }>; // Valores dos campos configuráveis do tipo de chamado
  status: 'enviado' | 'em_atendimento' | 'resolvido' | 'cancelado';
  taskId?: string;
  taskName?: string;
  channelId?: string;

  // Routing & Queue Handling
  assignedToId?: string;
  assignedToName?: string;
  assignedToRole?: string;
  assignedToSector?: string;
  startedAt?: string; // ISO date when support accepted
  resolvedAt?: string; // ISO date when resolved
  resolutionNotes?: string;
  durationSeconds?: number; // Total seconds taken in atendimento
  priority?: 'baixa' | 'media' | 'alta' | 'urgente';
}

export interface SectorDefinition {
  id: string;
  name: string;
  manager?: string;
  description?: string;
  color?: string;
  icon?: string;
  activeShifts?: string[];
  defaultTeamLeader?: string;
  requirePassword?: boolean;
  createdAt?: string;
}

export interface AppState {
  updatedAtMs?: number;
  location: string;
  teamName: string;
  manager: string;
  sector: string;
  registeredSectors?: string[]; // Lista de setores registrados no app
  sectorDefinitions?: SectorDefinition[]; // Definições completas e ricas dos setores cadastrados
  teamShift: string;
  shifts: string[];
  scaleType: ScaleType;
  scaleGroups: string[];
  setupCompleted?: boolean;
  isSampleData?: boolean;
  defaultTeamLeader?: string;
  teamLeaders: string[];
  teams?: TeamDefinition[];
  teamShiftMap?: Record<string, string>; // teamName -> shift
  shiftConfigs?: Record<string, ShiftCustomConfig>; // shift -> custom rules/overrides
  roles: string[];
  categories: string[];
  skills: string[];
  year: number;
  selectedDate: string; // YYYY-MM-DD
  theme: ThemeOption;
  calendar: Record<string, string>; // YYYY-MM-DD -> scale group on OFF
  collaborators: Collaborator[];
  deletedCollaborators?: DeletedCollaborator[];
  tempNotes?: Record<string, CollabNote[]>; // colaboradorId -> lembretes/observações temporárias
  tasks: Task[];
  breaks: BreakSlot[];
  attendance: Record<string, Record<string, boolean | { absent: true; reason: string }>>; // date -> collaboratorId -> isPresent (manual override) or absence object
  intervals: Record<string, Record<string, string[]>>; // date -> breakId -> collaboratorId[]
  processKnowledgeList?: ProcessKnowledge[];
  history: Array<{
    id: string;
    date: string;
    peoplePresent: number;
    peopleVacation: number;
    peopleLeave: number;
    peopleTraining: number;
    timestamp: string;
  }>;
  dailyReports: Record<string, DailyReport>;
  onlineSpreadsheet?: OnlineSpreadsheetConfig | null;
  isSidebarCollapsed?: boolean;
  showBriefingSlide?: boolean;
  showEmployeePortal?: boolean;
  showOperatorPortal?: boolean;
  abbreviatePortalNames?: boolean;
  showInfoHub?: boolean;
  showRadioModule?: boolean;
  showWidgetsModule?: boolean;
  showRoutinesModule?: boolean;
  scheduledTasks?: ScheduledTask[];
  scheduledTaskLists?: ScheduledTaskList[];
  selectedShiftFilter?: string;
  selectedTLFilter?: string;
  absenteeismPeriodDays?: number;
  roleTypes?: Record<string, 'operacional' | 'administrativo'>;
  rolePermissions?: Record<string, RoleAccessLevel>; // Cargo -> Nível de acesso ('portal' | 'viewer' | 'editor' | 'admin')
  briefingConfig?: BriefingConfig;
  feedbackConfig?: FeedbackConfig;

  // New features:
  editorRoles?: string[]; // Cargo(s) com permissão de Editor
  userPasswords?: Record<string, string>; // collaboratorId/login -> hashed password or string
  requireUserPassword?: boolean; // Configuração do setor: se exige senha obrigatória para todos os colaboradores (opcional vs obrigatório)
  autoBackupSettings?: AutoBackupSettings;
  autoBackupConfig?: any;
  autoBackups?: any[];
  catalogs?: any;
  auditLogs?: AuditLogEntry[];
  notifications?: SystemNotification[];
  deletedNotificationIds?: string[];
  serviceRequests?: ServiceRequest[];
  infoHubReminders?: InfoHubReminder[];
  infoHubLinks?: InfoHubLink[];
  infoHubQuickFills?: InfoHubQuickFill[];
  metricDefinitions?: MetricDefinition[];
  metricReadings?: MetricReading[];
  supportMessages?: SupportMessage[];
  helpdeskConfig?: HelpdeskConfig;
  shareCustomConfig?: ShareCustomConfig;
  shareFilters?: ShareFilterConfig;
  reportExportConfig?: ReportExportConfig;
  portalConfig?: PortalPresetConfig;
  portalNotificationConfig?: PortalNotificationConfig;
  customShortcuts?: Record<string, string>;
  sidebarOrder?: string[];
  hiddenSidebarItems?: string[];
  widgetsConfig?: AppWidgetsConfig;
  extensionConfig?: ExtensionConfig;
}

export interface AppWidgetsConfig {
  enabled?: boolean;
  showCalendarWidget?: boolean;
  showInfoHubWidget?: boolean;
  showStatsWidget?: boolean;
  showRequestsWidget?: boolean;
  showRadioWidget?: boolean;
  showBreaksMonitorWidget?: boolean;
  showSmartCommandWidget?: boolean;
  showRoutinesWidget?: boolean;
  showMetricsWidget?: boolean;
  dashboardWidgets?: string[]; // IDs dos widgets ativos no painel inicial: 'stats', 'breaks_monitor', 'routines', 'metrics', 'requests', 'info_hub', 'calendar', 'smart_command', 'radio'
}

export interface PresenceSyncRecord {
  id?: string;
  collaboratorId?: string;
  name: string;
  login?: string;
  registration?: string;
  shift?: string;
  scale?: string;
  role?: string;
  status: 'presente' | 'atraso' | 'ausente' | 'folga' | 'ferias' | 'licenca' | 'treinamento' | 'atestado' | 'banco_horas' | 'falta_injustificada';
  reason?: string;
  date: string;
  timestamp?: number;
  source?: string;
}

export interface PresenceSyncEvent {
  id: string;
  type: 'single' | 'batch' | 'webhook';
  source: string;
  count: number;
  timestamp: number;
  details?: string;
  records: PresenceSyncRecord[];
}

export type BreakGenerationMode = 'parent' | 'subtasks' | 'rotation';

export interface BreakRotationInfo {
  collaboratorId: string;
  collaboratorName: string;
  prevDate?: string;
  prevSlotId?: string;
  prevSlotTime?: string;
  prevIndex?: number;
  currentSlotId: string;
  currentSlotTime: string;
  currentIndex: number;
  rotationDelta: number; // +1
  wasNewOrAbsent?: boolean;
}
