import { z } from 'zod';

const ShiftGroupSchema = z.enum(['A', 'B', 'C', 'D']);
const ThemeOptionSchema = z.enum([
  'dimensio',
  'aurora',
  'ocean',
  'sunset',
  'crimson',
  'midnight',
  'graphite',
  'material-emerald',
  'material-blue',
  'material-purple',
  'material-terracotta',
  'material-dark',
]);
const AbsenceTypeSchema = z.enum(['ferias', 'licenca', 'treinamento', 'atestado', 'banco_horas', 'falta_injustificada']);
const StatusTypeSchema = z.enum(['presente', 'ausente', 'folga', 'ferias', 'licenca', 'treinamento', 'atestado', 'banco_horas', 'falta_injustificada']);
const ProcessTypeSchema = z.enum(['caracteristica', 'curiosidade', 'explicacao', 'procedimento', 'seguranca', 'qualidade']);

export const ScheduledAbsenceSchema = z.object({
  id: z.string(),
  type: AbsenceTypeSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().optional(),
});

export const CollaboratorSchema = z.object({
  id: z.string(),
  name: z.string(),
  login: z.string().optional(),
  registration: z.string().optional(),
  shift: z.string(),
  scale: z.string(),
  teamLeader: z.string().optional(),
  role: z.string(),
  category: z.string(),
  skills: z.record(z.string(), z.number()).optional(),
  notes: z.string().optional(),
  absences: z.array(ScheduledAbsenceSchema).optional(),
  companyProfileUrl: z.string().optional(),
  profileUrl: z.string().optional(),
  photoUrl: z.string().optional(),
  useCompanyPhoto: z.boolean().optional(),
  companyPhotoSelector: z.string().optional(),
});

export const ShiftCustomConfigSchema = z.object({
  shift: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  manager: z.string().optional(),
  workHours: z.string().optional(),
  notes: z.string().optional(),
  customRules: z.string().optional(),
});

export const SupportFieldFormatSchema = z.object({
  example: z.string().optional(),
  inputSeparators: z.string().optional(),
  outputSeparator: z.string().optional(),
});

export const SupportTypeFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  key: z.string().optional(),
  uppercase: z.boolean().optional(),
  maxLength: z.number().optional(),
  required: z.boolean().optional(),
  format: SupportFieldFormatSchema.optional(),
});

export const ActionLinkVarSchema = z.object({
  token: z.string(),
  source: z.enum(['field', 'nome', 'turno', 'categoria', 'tipo', 'codigo']),
  fieldId: z.string().optional(),
  fieldKey: z.string().optional(),
  label: z.string().optional(),
});

export const SupportTypePresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
  defaultNote: z.string().optional(),
  fields: z.array(SupportTypeFieldSchema).optional(),
  actionLink: z.string().optional(),
  actionLinkVars: z.array(ActionLinkVarSchema).optional(),
});

export const HelpdeskConfigSchema = z.object({
  enabled: z.boolean().optional(),
  supportRoles: z.array(z.string()).optional(),
  supportTypes: z.array(SupportTypePresetSchema).optional(),
  notifySound: z.boolean().optional(),
  autoAssignCategory: z.boolean().optional(),
});

export const SupportMessageSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  date: z.string().optional(),
  time: z.string().optional(),
  senderId: z.string(),
  senderName: z.string(),
  senderRole: z.string().optional(),
  senderShift: z.string().optional(),
  senderCategory: z.string().optional(),
  supportType: z.string().optional(),
  codeText: z.string().optional(),
  imageUrl: z.string().optional(),
  fields: z.array(z.object({ id: z.string(), label: z.string(), value: z.string(), key: z.string().optional() })).optional(),
  status: z.enum(['enviado', 'em_atendimento', 'resolvido', 'cancelado']),
  taskId: z.string().optional(),
  taskName: z.string().optional(),
  channelId: z.string().optional(),
  assignedToId: z.string().optional(),
  assignedToName: z.string().optional(),
  assignedToRole: z.string().optional(),
  startedAt: z.string().optional(),
  resolvedAt: z.string().optional(),
  resolutionNotes: z.string().optional(),
  durationSeconds: z.number().optional(),
  priority: z.enum(['baixa', 'media', 'alta', 'urgente']).optional(),
});

export const TaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  members: z.array(z.string()),
  allowedRoles: z.array(z.string()).optional(),
  allowedCategories: z.array(z.string()).optional(),
  requiredSkills: z.array(z.string()).optional(),
  parentId: z.string().optional(),
  priority: z.enum(['alta', 'media', 'baixa']).optional(),
  minHeadcount: z.number().optional(),
  maxHeadcount: z.number().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
  externalUrl: z.string().optional(),
  shift: z.string().optional(),
  allowedShifts: z.array(z.string()).optional(),
});

export const BreakSlotSchema = z.object({
  id: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  shift: z.string().optional(),
  capacity: z.number().optional(),
});

const SyncStatusSchema = z.enum(['success', 'error', 'testing']);

const SlideItemSchema = z.object({
  id: z.string(),
  type: z.enum(['text', 'image', 'shape']),
  content: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  z: z.number(),
  fontSize: z.number().optional(),
  fontWeight: z.number().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  fontFamily: z.string().optional(),
  color: z.string().optional(),
  bgColor: z.string().optional(),
  borderRadius: z.number().optional(),
  objectFit: z.enum(['contain', 'cover']).optional(),
});

const SlideElementLayoutSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  hidden: z.boolean().optional(),
});

const FreeSlideConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  bgUrl: z.string().optional(),
  bgColor: z.string().optional(),
});

const SimpleSlideConfigSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  items: z.array(z.string()).optional(),
  accent: z.string().optional(),
  bgUrl: z.string().optional(),
  bgColor: z.string().optional(),
});

export const OnlineSpreadsheetConfigSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  webhookUrl: z.string().url().optional(),
  autoSyncEnabled: z.boolean().optional(),
  lastSyncedAt: z.string().optional(),
  syncCount: z.number().optional(),
  syncStatus: SyncStatusSchema.optional(),
  lastError: z.string().optional(),
  turnServers: z.string().optional(),
});

export const DailyReportSchema = z.object({
  generatedAt: z.string().optional(),
  absenceReasons: z.record(z.string(), z.string()).optional(),
  occurrences: z.record(z.string(), z.string()).optional(),
  generalNotes: z.string().optional(),
  snapshot: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: StatusTypeSchema,
    task: z.string(),
    interval: z.string(),
    absenceReason: z.string().optional(),
    occurrence: z.string().optional(),
  })).optional(),
});

export const AppStateSchema = z.object({
  updatedAtMs: z.number().optional(),
  location: z.string(),
  teamName: z.string(),
  manager: z.string(),
  sector: z.string(),
  teamShift: z.string(),
  shifts: z.array(z.string()),
  scaleType: z.enum(['6x2', 'custom']),
  scaleGroups: z.array(z.string()),
  setupCompleted: z.boolean().optional(),
  isSampleData: z.boolean().optional(),
  defaultTeamLeader: z.string().optional(),
  teamLeaders: z.array(z.string()),
  shiftConfigs: z.record(z.string(), ShiftCustomConfigSchema).optional(),
  roles: z.array(z.string()),
  categories: z.array(z.string()),
  skills: z.array(z.string()),
  year: z.number(),
  selectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  theme: ThemeOptionSchema,
  calendar: z.record(z.string(), z.string()),
  collaborators: z.array(CollaboratorSchema),
  deletedCollaborators: z.array(z.object({
    id: z.string(),
    collaborator: CollaboratorSchema,
    deletedAt: z.string(),
    expiresAt: z.string(),
  })).optional(),
  tasks: z.array(TaskSchema),
  breaks: z.array(BreakSlotSchema),
  attendance: z.record(z.string(), z.record(z.string(), z.union([z.boolean(), z.object({ absent: z.boolean(), reason: z.string() })]))),
  intervals: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
  processKnowledgeList: z.array(z.object({
    id: z.string(),
    title: z.string(),
    category: z.string(),
    type: ProcessTypeSchema,
    description: z.string(),
    keyTakeaways: z.array(z.string()).optional(),
    imageUrl: z.string().optional(),
    iconName: z.string().optional(),
    active: z.boolean().optional(),
  })).optional(),
  history: z.array(z.object({
    id: z.string(),
    date: z.string(),
    peoplePresent: z.number(),
    peopleVacation: z.number(),
    peopleLeave: z.number(),
    peopleTraining: z.number(),
    timestamp: z.string(),
  })),
  dailyReports: z.record(z.string(), DailyReportSchema),
  onlineSpreadsheet: OnlineSpreadsheetConfigSchema.nullable().optional(),
  isSidebarCollapsed: z.boolean().optional(),
  showBriefingSlide: z.boolean().optional(),
  showEmployeePortal: z.boolean().optional(),
  showOperatorPortal: z.boolean().optional(),
  showInfoHub: z.boolean().optional(),
  showRadioModule: z.boolean().optional(),
  selectedShiftFilter: z.string().optional(),
  selectedTLFilter: z.string().optional(),
  absenteeismPeriodDays: z.number().optional(),
  briefingConfig: z.object({
    coverBgUrl: z.string().optional(),
    coverTitle: z.string().optional(),
    coverSubtitle: z.string().optional(),
    coverTeamName: z.string().optional(),
    motivationalQuote: z.string().optional(),
    showQuote: z.boolean().optional(),
    pdfUrl: z.string().optional(),
    pdfPageNumber: z.number().optional(),
    pdfDirectImageUrl: z.string().optional(),
    qaQuestions: z.array(z.string()).optional(),
    qaTitle: z.string().optional(),
    qaSubtitle: z.string().optional(),
    qaDescription: z.string().optional(),
    qaBgUrl: z.string().optional(),
    qaDirectImageUrl: z.string().optional(),
    qaSafetyText: z.string().optional(),
    qaQualityText: z.string().optional(),
    qaSupportText: z.string().optional(),
    scaleTitle: z.string().optional(),
    scaleSubtitle: z.string().optional(),
    scaleFooterText: z.string().optional(),
    scaleTitleSize: z.number().optional(),
    scaleSubtitleSize: z.number().optional(),
    scaleFooterSize: z.number().optional(),
    scaleTaskNameSize: z.number().optional(),
    scaleCollaboratorNameSize: z.number().optional(),
    scaleCardPadding: z.enum(['compact', 'normal', 'spacious']).optional(),
    scaleGridCols: z.union([z.literal('auto'), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
    scaleHeaderStyle: z.enum(['banner', 'subtle', 'minimal']).optional(),
    scaleHeaderBgColor: z.string().optional(),
    scaleTaskOrderIds: z.array(z.string()).optional(),
    scaleIncludeDailyReport: z.boolean().optional(),
    slideOrder: z.array(z.object({
      id: z.string(),
      enabled: z.boolean(),
      title: z.string().optional(),
    })).optional(),
    slideItems: z.record(z.string(), z.array(SlideItemSchema)).optional(),
    freeSlides: z.array(FreeSlideConfigSchema).optional(),
    simpleSlides: z.record(z.string(), SimpleSlideConfigSchema).optional(),
    elementLayout: z.record(z.string(), z.record(z.string(), SlideElementLayoutSchema)).optional(),
    slideBgColor: z.record(z.string(), z.string()).optional(),
    slideTheme: z.record(z.string(), z.object({ accent: z.string().optional() })).optional(),
    typography: z.record(z.string(), z.object({
      fontFamily: z.string().optional(),
      titleSize: z.number().optional(),
      bodySize: z.number().optional(),
      footerSize: z.number().optional(),
    })).optional(),
  }).optional(),
  deletedNotificationIds: z.array(z.string()).optional(),
  userPasswords: z.record(z.string(), z.string()).optional(),
  requireUserPassword: z.boolean().optional(),
  supportMessages: z.array(SupportMessageSchema).optional(),
  helpdeskConfig: HelpdeskConfigSchema.optional(),
});

export const BackupSnapshotSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  formattedDate: z.string(),
  reason: z.string(),
  collaboratorCount: z.number(),
  taskCount: z.number(),
  teamName: z.string(),
  state: AppStateSchema,
});

export function validateImportData(data: unknown): { success: boolean; data?: z.infer<typeof AppStateSchema>; error?: string } {
  const result = AppStateSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
    };
  }
  return { success: true, data: result.data };
}

export function validateBackupSnapshot(data: unknown): { success: boolean; data?: z.infer<typeof BackupSnapshotSchema>; error?: string } {
  const result = BackupSnapshotSchema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
    };
  }
  return { success: true, data: result.data };
}