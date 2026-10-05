import { AppState, Collaborator, Task, BreakSlot, DailyReport, ScheduledAbsence, ShiftCustomConfig, SupportTypePreset } from '../types';
import { DEFAULT_SUPPORT_TYPES, DEFAULT_FIRESTORE_CONFIG } from './initialData';
import { DEFAULT_SAMPLE_TASKS, DEFAULT_TASK_LISTS } from './routineHelpers';
import { normalizeDeck, defaultDeck } from '../briefing/deck';
import { FILTER_ALL_SENTINELS } from './presenceFilters';

/**
 * Universal initial default state for Dimensio
 */
export const initialAppStateDefaults: AppState = {
  updatedAtMs: Date.now(),
  location: '',
  teamName: '',
  manager: '',
  sector: '',
  registeredSectors: [],
  sectorDefinitions: [],
  teamShift: '',
  shifts: [],
  scaleType: '6x2',
  scaleGroups: [],
  setupCompleted: false,
  isSampleData: false,
  defaultTeamLeader: '',
  teamLeaders: [],
  roles: [],
  categories: [],
  skills: [],
  year: new Date().getFullYear(),
  selectedDate: new Date().toISOString().split('T')[0],
  theme: 'dimensio',
  calendar: {},
  collaborators: [],
  deletedCollaborators: [],
  tempNotes: {},
  tasks: [],
  breaks: [],
  attendance: {},
  intervals: {},
  processKnowledgeList: [],
  history: [],
  dailyReports: {},
  onlineSpreadsheet: DEFAULT_FIRESTORE_CONFIG,
  briefDeck: defaultDeck(),
  isSidebarCollapsed: true,
  showBriefingSlide: true,
  showEmployeePortal: true,
  showOperatorPortal: true,
  abbreviatePortalNames: false,
  showInfoHub: true,
  showRadioModule: true,
  showRoutinesModule: true,
  scheduledTasks: [],
  scheduledTaskLists: DEFAULT_TASK_LISTS,
  selectedShiftFilter: '',
  selectedTLFilter: '',
  absenteeismPeriodDays: 30,
  roleTypes: {},
  rolePermissions: {},
  briefingConfig: {},
  feedbackConfig: {},
  editorRoles: [],
  userPasswords: {},
  requireUserPassword: false,
  autoBackupSettings: {
    enabled: true,
    intervalMinutes: 15,
    maxRetainSnapshots: 20,
  },
  auditLogs: [],
  notifications: [],
  deletedNotificationIds: [],
  serviceRequests: [],
  infoHubReminders: [],
  infoHubLinks: [],
  infoHubQuickFills: [],
  metricDefinitions: [],
  metricReadings: [],
  supportMessages: [],
  helpdeskConfig: {
    enabled: true,
    supportRoles: [],
    supportTypes: [
      { id: 'preset_coletor', name: 'Problema no Coletor / Equipamento', priority: 'alta', description: 'Leitor travado, bateria, teclado ou falha no dispositivo' },
      { id: 'preset_sistema', name: 'Suporte Técnico / Sistema', priority: 'media', description: 'Erro de sistema, tela travada ou lentidão' },
      { id: 'preset_tarefa', name: 'Ajuste de Tarefa / Troca', priority: 'media', description: 'Solicitação de remanejamento ou troca de posto' },
      { id: 'preset_processo', name: 'Dúvida de Processo / Qualidade', priority: 'baixa', description: 'Dúvida sobre bipagem, conferência ou procedimento operacional' },
      { id: 'preset_tl', name: 'Liberação / Autorização TL', priority: 'alta', description: 'Aprovação de divergência ou liberação pelo líder' },
      { id: 'preset_etiqueta', name: 'Troca de Etiqueta / Impressora', priority: 'media', description: 'Falta de fita/ribbon, etiqueta presa ou troca de rolo' },
      { id: 'preset_outros', name: 'Outros Assuntos', priority: 'baixa', description: 'Outro tipo de solicitação operacional' },
    ],
    notifySound: true,
  },
  portalConfig: {},
  portalNotificationConfig: {
    taskRedirectionAlert: true,
    soundAlerts: true,
    vibrationAlerts: true,
    shiftNotices: true,
    supportStatusAlerts: true,
  },
  customShortcuts: {},
  sidebarOrder: [],
  hiddenSidebarItems: [],
  widgetsConfig: {
    showCalendarWidget: true,
    showInfoHubWidget: true,
    showStatsWidget: true,
    showRequestsWidget: true,
    showRadioWidget: true,
    dashboardWidgets: ['calendar', 'info_hub', 'stats', 'requests'],
  },
};

/**
 * Safely parses stringified JSON or returns object
 */
function safeJsonParse(data: any): any {
  if (!data) return null;
  if (typeof data === 'object') return data;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Normalizes ANY candidate state, backup, cloud snapshot, or legacy file
 * into a complete, safe, 100% retro-compatible AppState.
 */
export function normalizeAppState(rawInput: any, baseState?: AppState): AppState {
  if (!rawInput) {
    return baseState ? { ...baseState } : { ...initialAppStateDefaults };
  }

  // 1. Recursively unwrap nested containers (.rawState, .state, .stateRaw, .data, stringified JSON)
  let src: any = rawInput;
  let iterations = 0;
  while (src && iterations < 5) {
    iterations++;
    if (typeof src === 'string') {
      const parsed = safeJsonParse(src);
      if (parsed && typeof parsed === 'object') {
        src = parsed;
        continue;
      }
    }
    if (typeof src === 'object' && !Array.isArray(src)) {
      if (src.rawState) {
        const unwrapped = safeJsonParse(src.rawState) || src.rawState;
        if (unwrapped && typeof unwrapped === 'object') {
          src = unwrapped;
          continue;
        }
      }
      if (src.state) {
        const unwrapped = safeJsonParse(src.state) || src.state;
        if (unwrapped && typeof unwrapped === 'object') {
          src = unwrapped;
          continue;
        }
      }
      if (src.stateRaw) {
        const unwrapped = safeJsonParse(src.stateRaw) || src.stateRaw;
        if (unwrapped && typeof unwrapped === 'object') {
          src = unwrapped;
          continue;
        }
      }
    }
    break;
  }

  if (!src || typeof src !== 'object') {
    return baseState ? { ...baseState } : { ...initialAppStateDefaults };
  }

  const defaults = baseState || initialAppStateDefaults;

  // 2. Extract & sanitize Collaborators (retro-compatible with PT-BR keys and old backups)
  let rawCollabs: any[] = [];
  if (Array.isArray(src.collaborators)) {
    rawCollabs = src.collaborators;
  } else if (Array.isArray(src.collaboratorsMaster)) {
    rawCollabs = src.collaboratorsMaster;
  } else if (Array.isArray(src.equipe)) {
    rawCollabs = src.equipe;
  } else if (Array.isArray(src.data)) {
    rawCollabs = src.data;
  }

  const cleanCollaborators: Collaborator[] = rawCollabs.map((c: any, index: number) => {
    const name = String(c.name || c.nome || c.Name || `Colaborador ${index + 1}`).trim();
    const id = String(c.id || c.ID || `collab_${index}_${Math.random().toString(36).substring(2, 7)}`);
    const reg = String(c.registration || c.matricula || c.re || c.Matricula || '').trim();
    const login = String(c.login || c.Login || '').trim();
    const shift = String(c.shift || c.turno || c.Turno || src.teamShift || defaults.teamShift || 'T1').trim();
    const scale = String(c.scale || c.escala || c.Escala || 'A').trim();
    const teamLeader = String(c.teamLeader || c.lider || c.time || c.Time || defaults.defaultTeamLeader || 'Sem Time').trim();
    const role = String(c.role || c.cargo || c.funcao || c.Cargo || 'Operador').trim();
    const category = String(c.category || c.categoria || c.Categoria || 'Geral').trim();

    const skills = typeof c.skills === 'object' && c.skills ? c.skills : {};
    const notes = String(c.notes || c.observacoes || c.Notas || '').trim();
    const rawAbsences = Array.isArray(c.absences) ? c.absences : [];
    const cleanAbsences: ScheduledAbsence[] = rawAbsences.map((a: any, ai: number) => ({
      id: String(a.id || `abs_${index}_${ai}`),
      type: a.type || 'ferias',
      startDate: String(a.startDate || a.inicio || '').trim(),
      endDate: String(a.endDate || a.fim || '').trim(),
      notes: a.notes ? String(a.notes) : undefined,
    }));

    const profileLink = c.companyProfileUrl || c.profileUrl || c.externalUrl || c.linkPerfil || c.link;
    const cleanCompanyProfileUrl = profileLink ? String(profileLink).trim() : undefined;
    const photoUrl = c.photoUrl || c.avatarUrl || c.fotoUrl || c.foto || c.image;
    const cleanPhotoUrl = photoUrl ? String(photoUrl).trim() : undefined;

    return {
      id,
      name,
      registration: reg,
      login,
      shift,
      scale,
      teamLeader,
      role,
      category,
      skills,
      notes,
      absences: cleanAbsences,
      companyProfileUrl: cleanCompanyProfileUrl,
      profileUrl: cleanCompanyProfileUrl,
      photoUrl: cleanPhotoUrl,
      useCompanyPhoto: Boolean(c.useCompanyPhoto),
      companyPhotoSelector: c.companyPhotoSelector ? String(c.companyPhotoSelector).trim() : undefined,
    };
  });

  // 3. Extract & sanitize Tasks
  let rawTasks: any[] = [];
  if (Array.isArray(src.tasks)) rawTasks = src.tasks;
  else if (Array.isArray(src.tarefas)) rawTasks = src.tarefas;

  const cleanTasks: Task[] = rawTasks.map((t: any, ti: number) => ({
    id: String(t.id || `task_${ti}_${Math.random().toString(36).substring(2, 6)}`),
    name: String(t.name || t.nome || `Posto ${ti + 1}`).trim(),
    members: Array.isArray(t.members) ? t.members.map(String) : Array.isArray(t.membros) ? t.membros.map(String) : [],
    allowedRoles: Array.isArray(t.allowedRoles) ? t.allowedRoles.map(String) : Array.isArray(t.cargos) ? t.cargos.map(String) : undefined,
    allowedCategories: Array.isArray(t.allowedCategories) ? t.allowedCategories.map(String) : Array.isArray(t.categorias) ? t.categorias.map(String) : undefined,
    requiredSkills: Array.isArray(t.requiredSkills) ? t.requiredSkills.map(String) : Array.isArray(t.skills) ? t.skills.map(String) : undefined,
    parentId: t.parentId ? String(t.parentId) : undefined,
    priority: t.priority === 'alta' || t.priority === 'media' || t.priority === 'baixa' ? t.priority : undefined,
    minHeadcount: typeof t.minHeadcount === 'number' ? t.minHeadcount : undefined,
    maxHeadcount: typeof t.maxHeadcount === 'number' ? t.maxHeadcount : undefined,
    description: t.description ? String(t.description) : undefined,
    active: t.active !== false,
    externalUrl: t.externalUrl ? String(t.externalUrl) : undefined,
    shift: t.shift ? String(t.shift) : undefined,
    allowedShifts: Array.isArray(t.allowedShifts) ? t.allowedShifts.map(String) : undefined,
  }));

  // 4. Extract & sanitize Breaks
  let rawBreaks: any[] | null = null;
  if (Array.isArray(src.breaks)) rawBreaks = src.breaks;
  else if (Array.isArray(src.intervalosList)) rawBreaks = src.intervalosList;

  const cleanBreaks: BreakSlot[] = rawBreaks !== null
    ? rawBreaks.map((b: any, bi: number) => ({
        id: String(b.id || `b_${bi}`),
        time: String(b.time || b.horario || '12:00').trim(),
        shift: b.shift ? String(b.shift) : undefined,
        capacity: typeof b.capacity === 'number' ? b.capacity : undefined,
      }))
    : (defaults.breaks || []);

  // 5. Ensure arrays and lists are sanitized and remove 'Geral' pseudo-shift
  const rawShifts = (Array.isArray(src.shifts) ? src.shifts.map(String) : (defaults.shifts || []))
    .filter((s: string) => s && s.toLowerCase() !== 'geral');
  const shifts = rawShifts;

  const scaleGroups = Array.isArray(src.scaleGroups) ? src.scaleGroups.map(String) : (defaults.scaleGroups || []);
  const teamLeaders = Array.isArray(src.teamLeaders) ? src.teamLeaders.map(String) : (defaults.teamLeaders || []);
  const roles = Array.isArray(src.roles) ? src.roles.map(String) : (defaults.roles || []);
  const categories = Array.isArray(src.categories) ? src.categories.map(String) : (defaults.categories || []);
  const skillsList = Array.isArray(src.skills) ? src.skills.map(String) : (defaults.skills || []);

  // Build or sanitize teamShiftMap & teams
  const teamShiftMap: Record<string, string> = typeof src.teamShiftMap === 'object' && src.teamShiftMap ? { ...src.teamShiftMap } : {};
  teamLeaders.forEach((tl) => {
    if (!teamShiftMap[tl]) {
      const match = tl.match(/\((T[1-9]|Noite|ADM)\)/i);
      if (match) {
        teamShiftMap[tl] = match[1].toUpperCase();
      } else {
        teamShiftMap[tl] = shifts[0] || '';
      }
    }
  });

  const teams = Array.isArray(src.teams)
    ? src.teams
    : teamLeaders.map((tl, i) => ({
        id: `team_${i + 1}`,
        name: tl,
        shift: teamShiftMap[tl] || shifts[0] || '',
      }));

  // Fill collaborator shifts ONLY when the collaborator has no explicit shift
  // (or the pseudo-shift 'Geral'). The team map is a fallback, NOT a source of
  // truth: overriding a manually set shift here would silently revert admin
  // edits on every fetch/import/reload ("colaborador volta para o turno errado").
  const sanitizedCollaborators = cleanCollaborators.map((c) => {
    let colShift = c.shift;
    const hasExplicitShift = !!colShift && colShift.toLowerCase() !== 'geral';
    if (!hasExplicitShift) {
      if (c.teamLeader && teamShiftMap[c.teamLeader]) {
        colShift = teamShiftMap[c.teamLeader];
      } else {
        colShift = shifts[0] || '';
      }
    }
    return {
      ...c,
      shift: colShift,
    };
  });

  const rawTeamShift = String(src.teamShift !== undefined ? src.teamShift : (defaults.teamShift || ''));
  const teamShift = rawTeamShift.toLowerCase() === 'geral' ? (shifts[0] || '') : rawTeamShift;

  // 6. Build normalized full AppState
  const rawShiftConfigs = typeof src.shiftConfigs === 'object' && src.shiftConfigs ? src.shiftConfigs : {};
  const sanitizedShiftConfigs: Record<string, ShiftCustomConfig> = {};
  Object.entries(rawShiftConfigs).forEach(([shKey, cfg]: [string, any]) => {
    if (cfg && typeof cfg === 'object') {
      const startTime = cfg.startTime ? String(cfg.startTime).trim() : undefined;
      const endTime = cfg.endTime ? String(cfg.endTime).trim() : undefined;
      const workHours = cfg.workHours ? String(cfg.workHours).trim() : (startTime && endTime ? `${startTime} às ${endTime}` : undefined);
      sanitizedShiftConfigs[shKey] = {
        shift: String(cfg.shift || shKey),
        startTime,
        endTime,
        workHours,
        manager: cfg.manager ? String(cfg.manager).trim() : undefined,
        notes: cfg.notes ? String(cfg.notes).trim() : undefined,
        customRules: cfg.customRules ? String(cfg.customRules).trim() : undefined,
      };
    }
  });

  const normalized: AppState = {
    updatedAtMs: Number(src.updatedAtMs) || (baseState?.updatedAtMs ? Number(baseState.updatedAtMs) : 0),
    location: String(src.location || defaults.location),
    teamName: String(src.teamName || defaults.teamName),
    manager: String(src.manager || defaults.manager),
    sector: String(src.sector !== undefined ? src.sector : (defaults.sector || '')),
    registeredSectors: (() => {
      if (Array.isArray(src.registeredSectors)) {
        return Array.from(new Set(src.registeredSectors.map(String).map((s) => s.trim()).filter(Boolean)));
      }
      const raw = baseState?.registeredSectors || [];
      const set = new Set<string>(raw.map(String).map((s) => s.trim()).filter(Boolean));
      if (src.sector && typeof src.sector === 'string' && src.sector.trim()) {
        set.add(src.sector.trim());
      }
      return Array.from(set);
    })(),
    sectorDefinitions: (() => {
      const rawDefs = Array.isArray(src.sectorDefinitions) ? src.sectorDefinitions : (baseState?.sectorDefinitions || []);
      const defsMap = new Map<string, any>();
      rawDefs.forEach((d: any) => {
        if (d && typeof d === 'object' && d.name) {
          defsMap.set(String(d.name).trim().toLowerCase(), {
            id: d.id ? String(d.id) : `sec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            name: String(d.name).trim(),
            manager: d.manager ? String(d.manager) : undefined,
            description: d.description ? String(d.description) : undefined,
            color: d.color ? String(d.color) : undefined,
            icon: d.icon ? String(d.icon) : undefined,
            activeShifts: Array.isArray(d.activeShifts) ? d.activeShifts.map(String) : undefined,
            defaultTeamLeader: d.defaultTeamLeader ? String(d.defaultTeamLeader) : undefined,
            requirePassword: d.requirePassword !== undefined ? Boolean(d.requirePassword) : undefined,
            createdAt: d.createdAt ? String(d.createdAt) : new Date().toISOString(),
          });
        }
      });
      return Array.from(defsMap.values());
    })(),
    teamShift,
    shifts,
    scaleType: src.scaleType === 'custom' ? 'custom' : '6x2',
    scaleGroups,
    setupCompleted: src.setupCompleted !== undefined ? Boolean(src.setupCompleted) : true,
    isSampleData: Boolean(src.isSampleData),
    defaultTeamLeader: String(src.defaultTeamLeader || defaults.defaultTeamLeader || teamLeaders[0] || ''),
    teamLeaders,
    teams,
    teamShiftMap,
    shiftConfigs: sanitizedShiftConfigs,
    roles,
    categories,
    skills: skillsList,
    year: Number(src.year) || defaults.year,
    selectedDate: String(src.selectedDate || defaults.selectedDate),
    theme: src.theme || defaults.theme,
    calendar: (() => {
      const raw = typeof src.calendar === 'object' && src.calendar ? src.calendar : {};
      const out: Record<string, string | string[] | import('../types').CalendarDay> = {};
      Object.entries(raw).forEach(([k, v]: [string, any]) => {
        if (typeof v === 'string') {
          out[k] = v ? { offGroups: [v] } : { offGroups: [] };
        } else if (Array.isArray(v)) {
          out[k] = { offGroups: v.map(String).filter(Boolean) };
        } else if (v && typeof v === 'object') {
          const off = Array.isArray((v as any).offGroups)
            ? (v as any).offGroups.map(String).filter(Boolean)
            : [];
          out[k] = {
            offGroups: off,
            holidayTitle: typeof (v as any).holidayTitle === 'string' ? (v as any).holidayTitle : undefined,
            isHoliday: Boolean((v as any).isHoliday || (v as any).holidayTitle),
            allowWorkOnHoliday: (v as any).allowWorkOnHoliday !== false,
            notes: typeof (v as any).notes === 'string' ? (v as any).notes : undefined,
          };
        }
      });
      return out;
    })(),
    scaleGroupDefs: Array.isArray(src.scaleGroupDefs)
      ? src.scaleGroupDefs.filter((d: any) => d && d.name).map((d: any) => ({ id: String(d.id || d.name), name: String(d.name), color: d.color ? String(d.color) : undefined }))
      : (Array.isArray(baseState?.scaleGroupDefs) ? baseState.scaleGroupDefs : []),
    calendarEvents: (() => {
      const raw = typeof src.calendarEvents === 'object' && src.calendarEvents ? src.calendarEvents : {};
      const out: Record<string, import('../types').CalendarEventEntry[]> = {};
      Object.entries(raw).forEach(([k, v]: [string, any]) => {
        if (Array.isArray(v)) {
          out[k] = v.filter((e: any) => e && (e.title || e.id)).map((e: any, i: number) => ({
            id: String(e.id || `${k}_${i}`),
            date: String(e.date || k),
            title: String(e.title || 'Evento'),
            type: ['feriado', 'evento', 'folga', 'nota'].includes(e.type) ? e.type : 'evento',
            startTime: e.startTime ? String(e.startTime) : undefined,
            endTime: e.endTime ? String(e.endTime) : undefined,
            notes: e.notes ? String(e.notes) : undefined,
            allowWork: e.allowWork !== false,
          }));
        }
      });
      return out;
    })(),
    collaborators: sanitizedCollaborators,
    deletedCollaborators: Array.isArray(src.deletedCollaborators) ? src.deletedCollaborators : [],
    tempNotes: typeof src.tempNotes === 'object' && src.tempNotes ? src.tempNotes : {},
    tasks: cleanTasks,
    breaks: cleanBreaks,
    attendance: typeof src.attendance === 'object' && src.attendance ? src.attendance : {},
    intervals: typeof src.intervals === 'object' && src.intervals ? src.intervals : {},
    processKnowledgeList: Array.isArray(src.processKnowledgeList) ? src.processKnowledgeList : [],
    history: Array.isArray(src.history) && src.history.length > 0 ? src.history : (baseState?.history || []),
    dailyReports: typeof src.dailyReports === 'object' && src.dailyReports ? src.dailyReports : {},
    onlineSpreadsheet: src.onlineSpreadsheet && typeof src.onlineSpreadsheet === 'object' ? src.onlineSpreadsheet : defaults.onlineSpreadsheet,
    isSidebarCollapsed:
      src.isSidebarCollapsed !== undefined
        ? Boolean(src.isSidebarCollapsed)
        : baseState?.isSidebarCollapsed !== undefined
          ? baseState.isSidebarCollapsed
          : false,
    showBriefingSlide: src.showBriefingSlide !== undefined ? Boolean(src.showBriefingSlide) : (baseState?.showBriefingSlide !== undefined ? baseState.showBriefingSlide : true),
    showEmployeePortal: src.showEmployeePortal !== undefined ? Boolean(src.showEmployeePortal) : (baseState?.showEmployeePortal !== undefined ? baseState.showEmployeePortal : true),
    showOperatorPortal: src.showOperatorPortal !== undefined ? Boolean(src.showOperatorPortal) : (baseState?.showOperatorPortal !== undefined ? baseState.showOperatorPortal : true),
    abbreviatePortalNames: src.abbreviatePortalNames !== undefined ? Boolean(src.abbreviatePortalNames) : Boolean(baseState?.abbreviatePortalNames),
    showInfoHub: src.showInfoHub !== undefined ? Boolean(src.showInfoHub) : (baseState?.showInfoHub !== undefined ? baseState.showInfoHub : true),
    showRadioModule: src.showRadioModule !== undefined ? Boolean(src.showRadioModule) : (baseState?.showRadioModule !== undefined ? baseState.showRadioModule : true),
    selectedShiftFilter: String(src.selectedShiftFilter || (baseState?.selectedShiftFilter || '')),
    selectedTLFilter: String(src.selectedTLFilter || (baseState?.selectedTLFilter || '')),
    absenteeismPeriodDays: Number(src.absenteeismPeriodDays) || 30,
    roleTypes: typeof src.roleTypes === 'object' && src.roleTypes ? src.roleTypes : (baseState?.roleTypes || {}),
    rolePermissions: typeof src.rolePermissions === 'object' && src.rolePermissions ? src.rolePermissions : (baseState?.rolePermissions || {}),
    briefingConfig: (() => {
      const baseBrief = baseState?.briefingConfig || {};
      const srcBrief = (typeof src.briefingConfig === 'object' && src.briefingConfig) ? src.briefingConfig : {};
      
      const mergedFreeSlides = Array.isArray(srcBrief.freeSlides)
        ? srcBrief.freeSlides
        : (Array.isArray(baseBrief.freeSlides) ? baseBrief.freeSlides : []);

      const mergedSimpleSlides = (typeof srcBrief.simpleSlides === 'object' && srcBrief.simpleSlides)
        ? { ...(baseBrief.simpleSlides || {}), ...srcBrief.simpleSlides }
        : (baseBrief.simpleSlides || {});

      const mergedSlideItems = (typeof srcBrief.slideItems === 'object' && srcBrief.slideItems)
        ? { ...(baseBrief.slideItems || {}), ...srcBrief.slideItems }
        : (baseBrief.slideItems || {});

      const mergedSlideOrder = Array.isArray(srcBrief.slideOrder) && srcBrief.slideOrder.length > 0
        ? srcBrief.slideOrder
        : (Array.isArray(baseBrief.slideOrder) && baseBrief.slideOrder.length > 0 ? baseBrief.slideOrder : undefined);

      return {
        ...baseBrief,
        ...srcBrief,
        freeSlides: mergedFreeSlides,
        simpleSlides: mergedSimpleSlides,
        slideItems: mergedSlideItems,
        slideOrder: mergedSlideOrder,
        elementLayout: (typeof srcBrief.elementLayout === 'object' && srcBrief.elementLayout)
          ? { ...(baseBrief.elementLayout || {}), ...srcBrief.elementLayout }
          : (baseBrief.elementLayout || {}),
        slideBgColor: (typeof srcBrief.slideBgColor === 'object' && srcBrief.slideBgColor)
          ? { ...(baseBrief.slideBgColor || {}), ...srcBrief.slideBgColor }
          : (baseBrief.slideBgColor || {}),
        slideTheme: (typeof srcBrief.slideTheme === 'object' && srcBrief.slideTheme)
          ? { ...(baseBrief.slideTheme || {}), ...srcBrief.slideTheme }
          : (baseBrief.slideTheme || {}),
        typography: (typeof srcBrief.typography === 'object' && srcBrief.typography)
          ? { ...(baseBrief.typography || {}), ...srcBrief.typography }
          : (baseBrief.typography || {}),
      };
    })(),
    feedbackConfig: (typeof src.feedbackConfig === 'object' && src.feedbackConfig)
      ? { ...(baseState?.feedbackConfig || {}), ...src.feedbackConfig }
      : (baseState?.feedbackConfig || {}),
    briefDeck: normalizeDeck(src.briefDeck) || normalizeDeck(baseState?.briefDeck) || defaultDeck(),
    editorRoles: Array.isArray(src.editorRoles) && src.editorRoles.length > 0
      ? src.editorRoles.map(String)
      : (baseState?.editorRoles || defaults.editorRoles),
    userPasswords: typeof src.userPasswords === 'object' && src.userPasswords ? src.userPasswords : (baseState?.userPasswords || {}),
    requireUserPassword: src.requireUserPassword !== undefined
      ? Boolean(src.requireUserPassword)
      : baseState?.requireUserPassword !== undefined
        ? Boolean(baseState.requireUserPassword)
        : false,
    autoBackupSettings: typeof src.autoBackupSettings === 'object' && src.autoBackupSettings ? src.autoBackupSettings : (baseState?.autoBackupSettings || defaults.autoBackupSettings),
    auditLogs: Array.isArray(src.auditLogs) ? src.auditLogs : (baseState?.auditLogs || []),
    notifications: Array.isArray(src.notifications) ? src.notifications : [],
    deletedNotificationIds: Array.isArray(src.deletedNotificationIds)
      ? src.deletedNotificationIds.map(String)
      : (Array.isArray(baseState?.deletedNotificationIds) ? baseState.deletedNotificationIds.map(String) : []),
    serviceRequests: Array.isArray(src.serviceRequests) ? src.serviceRequests : [],
    infoHubReminders: Array.isArray(src.infoHubReminders) ? src.infoHubReminders : [],
    infoHubLinks: Array.isArray(src.infoHubLinks) ? src.infoHubLinks : [],
    infoHubQuickFills: Array.isArray(src.infoHubQuickFills) ? src.infoHubQuickFills : [],
    companyManagers: Array.isArray(src.companyManagers)
      ? src.companyManagers
        .filter((m: any) => m && typeof m === 'object' && (m.id || m.name))
        .map((m: any) => ({
          id: String(m.id || `mgr_${Math.random().toString(36).slice(2, 8)}`),
          name: String(m.name || 'Gestor'),
          email: m.email ? String(m.email) : undefined,
          firebaseUid: m.firebaseUid ? String(m.firebaseUid) : undefined,
          collaboratorId: m.collaboratorId ? String(m.collaboratorId) : undefined,
          role: m.role === 'admin' ? 'admin' : 'owner',
          status: m.status === 'revoked' ? 'revoked' : 'active',
          addedByName: m.addedByName ? String(m.addedByName) : undefined,
          createdAt: m.createdAt ? String(m.createdAt) : new Date().toISOString(),
          revokedAt: m.revokedAt ? String(m.revokedAt) : undefined,
          revokedByName: m.revokedByName ? String(m.revokedByName) : undefined,
          notes: m.notes ? String(m.notes) : undefined,
        }))
      : (Array.isArray(baseState?.companyManagers) ? baseState.companyManagers : []),
    metricDefinitions: Array.isArray(src.metricDefinitions)
      ? src.metricDefinitions.filter((d: any) => d && typeof d === 'object' && d.id && d.name)
      : (baseState?.metricDefinitions || []),
    metricReadings: Array.isArray(src.metricReadings)
      ? src.metricReadings.filter((r: any) => r && typeof r === 'object' && r.id && r.metricId)
      : (baseState?.metricReadings || []),
    supportMessages: Array.isArray(src.supportMessages) ? src.supportMessages : [],
    helpdeskConfig: (() => {
      const existing = (typeof src.helpdeskConfig === 'object' && src.helpdeskConfig)
        ? src.helpdeskConfig
        : (baseState?.helpdeskConfig || defaults.helpdeskConfig);

      const defaultSupportTypes = defaults.helpdeskConfig?.supportTypes && defaults.helpdeskConfig.supportTypes.length > 0
        ? defaults.helpdeskConfig.supportTypes
        : DEFAULT_SUPPORT_TYPES;

      const rawSupportTypes = Array.isArray(existing?.supportTypes) && existing.supportTypes.length > 0
        ? existing.supportTypes
        : (Array.isArray(baseState?.helpdeskConfig?.supportTypes) && baseState.helpdeskConfig.supportTypes.length > 0
            ? baseState.helpdeskConfig.supportTypes
            : defaultSupportTypes);

      const normalizedSupportTypes: SupportTypePreset[] = rawSupportTypes.map((p: any, idx: number) => ({
        id: p.id ? String(p.id) : `preset_${idx}_${Date.now()}`,
        name: String(p.name || 'Chamado Geral'),
        category: p.category ? String(p.category) : undefined,
        description: p.description ? String(p.description) : undefined,
        placeholder: p.placeholder ? String(p.placeholder) : undefined,
        priority: ['baixa', 'media', 'alta', 'urgente'].includes(p.priority) ? p.priority : 'media',
        defaultNote: p.defaultNote ? String(p.defaultNote) : undefined,
        actionLink: p.actionLink ? String(p.actionLink) : undefined,
        actionLinkVars: Array.isArray(p.actionLinkVars) ? p.actionLinkVars : undefined,
        fields: Array.isArray(p.fields) ? p.fields.map((f: any, fIdx: number) => ({
          id: f.id ? String(f.id) : `field_${fIdx}`,
          label: String(f.label || 'Campo'),
          key: f.key ? String(f.key) : undefined,
          uppercase: Boolean(f.uppercase),
          maxLength: typeof f.maxLength === 'number' ? f.maxLength : undefined,
          required: Boolean(f.required),
          format: f.format && typeof f.format === 'object' ? f.format : undefined,
        })) : [],
      }));

      return {
        enabled: existing?.enabled !== false,
        supportRoles: Array.isArray(existing?.supportRoles) && existing.supportRoles.length > 0
          ? existing.supportRoles.map(String)
          : (baseState?.helpdeskConfig?.supportRoles || defaults.helpdeskConfig?.supportRoles || ['Suporte', 'TL', 'Admin', 'Analista', 'PS']),
        supportTypes: normalizedSupportTypes,
        notifySound: existing?.notifySound !== false,
        autoAssignCategory: Boolean(existing?.autoAssignCategory),
      };
    })(),
    shareCustomConfig: (typeof src.shareCustomConfig === 'object' && src.shareCustomConfig)
      ? { ...(baseState?.shareCustomConfig || defaults.shareCustomConfig || {}), ...src.shareCustomConfig }
      : (baseState?.shareCustomConfig || defaults.shareCustomConfig || {}),
    shareFilters: (() => {
      // Migração: sentinelas antigas ('Todos'/'Todas') viram lista vazia
      // (sem filtro). Sem isso, filtros salvos zeravam o resumo.
      const clean = (v: unknown): string[] =>
        Array.isArray(v) ? v.map(String).filter((s) => !FILTER_ALL_SENTINELS.includes(s)) : [];
      const base = baseState?.shareFilters || defaults.shareFilters || ({} as any);
      const srcF = (typeof src.shareFilters === 'object' && src.shareFilters ? src.shareFilters : {}) as any;
      return {
        ...base,
        ...srcF,
        selectedShifts: clean(srcF.selectedShifts ?? base.selectedShifts),
        selectedCategories: clean(srcF.selectedCategories ?? base.selectedCategories),
        selectedRoles: clean(srcF.selectedRoles ?? base.selectedRoles),
        selectedTLs: clean(srcF.selectedTLs ?? base.selectedTLs),
        searchTerm: typeof srcF.searchTerm === 'string' ? srcF.searchTerm : base.searchTerm || '',
      };
    })(),
    reportExportConfig: (typeof src.reportExportConfig === 'object' && src.reportExportConfig)
      ? { ...(baseState?.reportExportConfig || defaults.reportExportConfig || {}), ...src.reportExportConfig }
      : (baseState?.reportExportConfig || defaults.reportExportConfig || {}),
    portalConfig: (typeof src.portalConfig === 'object' && src.portalConfig)
      ? { ...(baseState?.portalConfig || defaults.portalConfig || {}), ...src.portalConfig }
      : (baseState?.portalConfig || defaults.portalConfig || {}),
    portalNotificationConfig: (typeof src.portalNotificationConfig === 'object' && src.portalNotificationConfig)
      ? { ...(baseState?.portalNotificationConfig || defaults.portalNotificationConfig || {}), ...src.portalNotificationConfig }
      : (baseState?.portalNotificationConfig || defaults.portalNotificationConfig || {}),
    customShortcuts: typeof src.customShortcuts === 'object' && src.customShortcuts ? src.customShortcuts : {},
    sidebarOrder: Array.isArray(src.sidebarOrder) ? src.sidebarOrder.map(String) : [],
    hiddenSidebarItems: Array.isArray(src.hiddenSidebarItems) ? src.hiddenSidebarItems.map(String) : (Array.isArray(baseState?.hiddenSidebarItems) ? baseState.hiddenSidebarItems.map(String) : []),
    widgetsConfig: typeof src.widgetsConfig === 'object' && src.widgetsConfig ? {
      showCalendarWidget: src.widgetsConfig.showCalendarWidget !== false,
      showInfoHubWidget: src.widgetsConfig.showInfoHubWidget !== false,
      showStatsWidget: src.widgetsConfig.showStatsWidget !== false,
      showRequestsWidget: src.widgetsConfig.showRequestsWidget !== false,
      showRadioWidget: src.widgetsConfig.showRadioWidget !== false,
      dashboardWidgets: Array.isArray(src.widgetsConfig.dashboardWidgets) ? src.widgetsConfig.dashboardWidgets : (baseState?.widgetsConfig?.dashboardWidgets || ['calendar', 'info_hub', 'stats', 'requests']),
    } : (baseState?.widgetsConfig || defaults.widgetsConfig),
    // Fields that must survive normalization even when the remote/backup does not
    // carry them (they were silently dropped before, causing local data loss):
    showWidgetsModule: src.showWidgetsModule ?? baseState?.showWidgetsModule ?? true,
    showRoutinesModule: src.showRoutinesModule !== undefined ? Boolean(src.showRoutinesModule) : (baseState?.showRoutinesModule !== undefined ? baseState.showRoutinesModule : true),
    scheduledTasks: Array.isArray(src.scheduledTasks)
      ? src.scheduledTasks
      : (Array.isArray(baseState?.scheduledTasks) ? baseState.scheduledTasks : defaults.scheduledTasks || []),
    scheduledTaskLists: Array.isArray(src.scheduledTaskLists) && src.scheduledTaskLists.length > 0
      ? src.scheduledTaskLists
      : (Array.isArray(baseState?.scheduledTaskLists) && baseState.scheduledTaskLists.length > 0 ? baseState.scheduledTaskLists : defaults.scheduledTaskLists || []),
    catalogs: src.catalogs ?? baseState?.catalogs,
    autoBackupConfig: src.autoBackupConfig ?? baseState?.autoBackupConfig,
    extensionConfig: (typeof src.extensionConfig === 'object' && src.extensionConfig)
      ? { ...(baseState?.extensionConfig || {}), ...src.extensionConfig }
      : (baseState?.extensionConfig || defaults.extensionConfig),
    // Prefer the full local snapshots over the stripped copies the cloud sends.
    autoBackups: baseState?.autoBackups ?? src.autoBackups ?? [],
  };

  return normalized;
}
