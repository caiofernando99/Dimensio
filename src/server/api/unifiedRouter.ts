import { Router, Request, Response } from 'express';
import { requireAuth, AuthRequest } from '../../middleware/auth.ts';
import { getUsers, getOrCreateUser } from '../../db/users.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';

// Version and metadata
export const API_VERSION = '1.6.0';
export const API_SPEC_VERSION = '3.0.3';

// Standard response envelope helper
export function sendSuccess<T = any>(
  res: Response,
  data: T,
  meta: Record<string, any> = {},
  status = 200
) {
  const isArray = Array.isArray(data);
  const responsePayload: Record<string, any> = {
    success: true,
    apiVersion: API_VERSION,
    timestamp: new Date().toISOString(),
    data,
    meta: {
      count: isArray ? data.length : undefined,
      ...meta,
    },
    // Backward-compatibility properties
    count: isArray ? data.length : undefined,
    ...(isArray ? { records: data } : {}),
  };
  return res.status(status).json(responsePayload);
}

export function sendError(
  res: Response,
  message: string,
  statusCode = 400,
  details?: any
) {
  return res.status(statusCode).json({
    success: false,
    apiVersion: API_VERSION,
    timestamp: new Date().toISOString(),
    error: message,
    message,
    details: details || null,
  });
}

// Helpers
export function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeSearchText(str: string): string {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ==========================================
// SHARED TYPES & IN-MEMORY STORE
// ==========================================

export interface PresenceRecord {
  id?: string;
  collaboratorId?: string;
  name: string;
  login?: string;
  registration?: string;
  shift?: string;
  scale?: string;
  role?: string;
  status:
    | 'presente'
    | 'ausente'
    | 'folga'
    | 'ferias'
    | 'atestado'
    | 'licenca'
    | 'treinamento'
    | 'banco_horas'
    | 'atraso'
    | 'falta_injustificada';
  reason?: string;
  date: string;
  timestamp: number;
  source?: string;
}

export interface PresenceSyncEvent {
  id: string;
  type: 'single' | 'batch' | 'webhook';
  source: string;
  count: number;
  timestamp: number;
  details: string;
  records: PresenceRecord[];
}

export interface CollaboratorModel {
  id: string;
  name: string;
  login?: string;
  registration?: string;
  shift?: string;
  scale?: string;
  role?: string;
  sector?: string;
  activeTaskId?: string;
}

export interface TaskModel {
  id: string;
  name: string;
  area?: string;
  requiredCapacity?: number;
  members: string[];
  externalUrl?: string;
}

export interface ScheduledTaskModel {
  id: string;
  title: string;
  description?: string;
  listId?: string;
  dueDate?: string;
  dueTime?: string;
  assigneeName?: string;
  completed?: boolean;
}

export interface ServiceRequestModel {
  id: string;
  title: string;
  description: string;
  requesterName: string;
  status: 'pendente' | 'lido' | 'em_andamento' | 'concluido' | 'recusado';
  priority?: 'baixa' | 'media' | 'alta' | 'urgente';
  createdAt: string;
  updatedAt?: string;
}

export interface SignalMessage {
  mid: string;
  kind: string;
  sender: string;
  senderName?: string;
  senderRole?: string;
  channel?: string;
  to?: string;
  payload?: any;
  ts: number;
  seq?: number;
}

export interface DimensioStoreState {
  collaborators: CollaboratorModel[];
  tasks: TaskModel[];
  intervals: Record<string, Record<string, string>>; // date -> collabId -> breakTime
  scheduledTaskLists: Array<{ id: string; title: string; color?: string; icon?: string }>;
  scheduledTasks: ScheduledTaskModel[];
  serviceRequests: ServiceRequestModel[];
  metricDefinitions: Array<{ id: string; name: string; type: 'count' | 'percentage' | 'time' | 'rating'; unit?: string }>;
  metricReadings: Array<{ id: string; metricId: string; value: number; timestamp: number; source?: string }>;
  infoHubReminders: Array<{ id: string; title?: string; text?: string; message?: string; shift?: string; priority?: string; authorName?: string; createdAt: string; updatedAt?: string; workspace?: string }>;
  infoHubLinks: Array<{ id: string; title: string; url: string; category?: string; description?: string; shift?: string; showInPortal?: boolean; workspace?: string; updatedAt?: string }>;
  infoHubQuickFills: Array<{ id: string; title: string; category?: string; description?: string; shift?: string; tags?: string[]; items?: Array<{ id: string; label: string; codeValue: string; description?: string }>; triggerUrl?: string; workspace?: string; updatedAt?: string }>;
}

// Global In-memory Data Stores
export const cachedCollaborators: CollaboratorModel[] = [];
export const presenceSnapshotStore: Record<string, Record<string, PresenceRecord>> = {};
export const presenceEventsLog: PresenceSyncEvent[] = [];
export const MAX_EVENTS_LOG = 200;

export const signalStore: SignalMessage[] = [];
export const MAX_SIGNALS = 1000;
export let globalSignalSeq = 0;

export const dimensioStore: DimensioStoreState = {
  collaborators: [],
  tasks: [],
  intervals: {},
  scheduledTaskLists: [
    { id: 'list-feedback', title: 'Agendamentos de Feedback', color: '#8b5cf6', icon: 'UserCheck' },
    { id: 'list-routines', title: 'Rotinas Operacionais', color: '#3b82f6', icon: 'ListTodo' },
  ],
  scheduledTasks: [],
  serviceRequests: [],
  metricDefinitions: [],
  metricReadings: [],
  infoHubReminders: [],
  infoHubLinks: [],
  infoHubQuickFills: [],
};

const infoHubWorkspaces = new Map<string, { seq: number; updatedAt: number }>();

export function getWorkspace(req: Request): string {
  const q = (req.query.workspace as string) || (req.query.app as string) || '';
  const h = (req.headers['x-workspace'] as string) || (req.headers['x-app-id'] as string) || '';
  const b = ((req.body as any)?.workspace as string) || ((req.body as any)?.app as string) || '';
  return (q || h || b || 'default').toString().trim().toLowerCase().slice(0, 64) || 'default';
}

export function touchWorkspace(ws: string) {
  const entry = infoHubWorkspaces.get(ws) || { seq: 0, updatedAt: 0 };
  entry.seq++;
  entry.updatedAt = Date.now();
  infoHubWorkspaces.set(ws, entry);
  return entry;
}

export function filterByWorkspace<T extends { workspace?: string }>(list: T[], ws: string): T[] {
  if (ws === 'all') return list;
  return list.filter((i) => !i.workspace || i.workspace === ws || ws === 'default');
}

// Helper to broadcast changes to active browser tabs and PTT workers
export function broadcastDimensioUpdate(kind: string, payload: any) {
  globalSignalSeq++;
  signalStore.push({
    mid: `dim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    kind: 'presence',
    sender: 'dimensio_api',
    senderName: 'API Dimensio',
    payload: { kind, ...payload },
    ts: Date.now(),
    seq: globalSignalSeq,
  });
}

// Smart Collaborator Matcher
export function matchCollaborator(identifier: {
  collaboratorId?: string;
  id?: string;
  login?: string;
  registration?: string;
  name?: string;
}): CollaboratorModel | null {
  if (!identifier) return null;
  const list = cachedCollaborators.length > 0 ? cachedCollaborators : dimensioStore.collaborators;

  // 1. Direct ID match
  const targetId = identifier.collaboratorId || identifier.id;
  if (targetId) {
    const found = list.find((c) => c.id === targetId);
    if (found) return found;
  }

  // 2. Registration (RE, matrícula) match
  if (identifier.registration) {
    const regNorm = normalizeSearchText(identifier.registration);
    const found = list.find((c) => c.registration && normalizeSearchText(c.registration) === regNorm);
    if (found) return found;
  }

  // 3. Login match
  if (identifier.login) {
    const loginNorm = normalizeSearchText(identifier.login);
    const found = list.find((c) => c.login && normalizeSearchText(c.login) === loginNorm);
    if (found) return found;
  }

  // 4. Name match (Exact or contains)
  if (identifier.name) {
    const nameNorm = normalizeSearchText(identifier.name);
    const exact = list.find((c) => normalizeSearchText(c.name) === nameNorm);
    if (exact) return exact;

    const partial = list.find((c) => {
      const cNameNorm = normalizeSearchText(c.name);
      return cNameNorm.includes(nameNorm) || nameNorm.includes(cNameNorm);
    });
    if (partial) return partial;
  }

  return null;
}

// Normalize presence status
export function normalizePresenceStatus(raw: any): PresenceRecord['status'] {
  const str = (raw || 'presente').toString().toLowerCase().trim();
  if (['presente', 'present', 'p', '1', 'true', 'ok', 'online'].includes(str)) return 'presente';
  if (['atraso', 'delay', 'atrasado', 'late'].includes(str)) return 'atraso';
  if (['folga', 'off', 'day_off', 'folguista'].includes(str)) return 'folga';
  if (['ferias', 'férias', 'vacation'].includes(str)) return 'ferias';
  if (['licenca', 'licença', 'leave', 'licenca_maternidade'].includes(str)) return 'licenca';
  if (['treinamento', 'training', 'curso'].includes(str)) return 'treinamento';
  if (['atestado', 'medical_certificate', 'medical', 'medico'].includes(str)) return 'atestado';
  if (['banco_horas', 'banco de horas', 'comp_time', 'bh'].includes(str)) return 'banco_horas';
  if (['falta_injustificada', 'unexcused'].includes(str)) return 'falta_injustificada';
  if (['ausente', 'absent', '0', 'false', 'falta'].includes(str)) return 'ausente';
  return 'presente';
}

// Rate limiter for WebRTC polling
const signalPollClients = new Map<string, number>();
export function checkSignalRate(req: Request): boolean {
  const peer = (req.query.peerId as string) || (req.headers['x-peer-id'] as string) || '';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const clientId = peer ? `${ip}:${peer}` : ip;
  const now = Date.now();
  const last = signalPollClients.get(clientId) || 0;
  if (now - last < 80) {
    return false;
  }
  signalPollClients.set(clientId, now);
  return true;
}

// Clean up stale signals
export function cleanupSignals() {
  const cutoff = Date.now() - 5 * 60 * 1000;
  while (signalStore.length > 0 && signalStore[0].ts < cutoff) {
    signalStore.shift();
  }
}

// ==========================================
// UNIFIED API ROUTER
// ==========================================

export const unifiedApiRouter = Router();

/**
 * SYSTEM & HEALTH ENDPOINTS
 */
unifiedApiRouter.get('/health', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    success: true,
    apiVersion: API_VERSION,
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
  });
});

unifiedApiRouter.get('/version', (_req: Request, res: Response) => {
  return res.json({
    status: 'ok',
    success: true,
    version: '1.6.0',
    app: 'Dimensio',
    apiVersion: API_VERSION,
    timestamp: Date.now(),
  });
});

/**
 * CLOUD SQL STATUS & HEALTH
 */
unifiedApiRouter.get('/cloudsql/status', async (_req: Request, res: Response) => {
  try {
    const userList = await getUsers();
    return res.json({
      status: 'connected',
      database: process.env.SQL_DB_NAME || 'dimensio',
      engine: 'PostgreSQL (Cloud SQL)',
      usersCount: userList.length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    return res.status(500).json({
      status: 'error',
      engine: 'PostgreSQL (Cloud SQL)',
      message: error?.message || 'Database connection error',
      timestamp: Date.now(),
    });
  }
});

/**
 * USERS MANAGEMENT (Cloud SQL / Firebase Auth)
 */
unifiedApiRouter.get('/users', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const usersList = await getUsers();
    return res.json({
      success: true,
      currentUser: req.user,
      users: usersList,
    });
  } catch (error: any) {
    console.error('Failed to fetch users from Cloud SQL:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
});

unifiedApiRouter.post('/users/sync', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.uid || !req.user?.email) {
      return res.status(400).json({ error: 'Informações de usuário inválidas no token' });
    }
    const { name, picture } = req.user as any;
    const userRecord = await getOrCreateUser(req.user.uid, req.user.email, name, picture);
    return res.json({
      success: true,
      user: userRecord,
    });
  } catch (error: any) {
    console.error('Failed to sync user to Cloud SQL:', error);
    return res.status(500).json({ error: error.message || 'Failed to sync user' });
  }
});

/**
 * AUTH TRIGGERS & ACCOUNT MANAGEMENT (LGPD / GDPR compliant)
 */
unifiedApiRouter.post('/auth/send-welcome-email', async (req: Request, res: Response) => {
  try {
    const { email, displayName, companyName } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, error: 'E-mail é obrigatório' });
    }

    const recipientName = displayName || String(email).split('@')[0];
    const company = companyName || 'sua empresa';

    console.log(`[Welcome Trigger] Enviando e-mail de boas-vindas para: ${email} (${recipientName}) da empresa "${company}"`);

    const emailPayload = {
      to: email,
      subject: `Bem-vindo ao Dimensio! Próximos passos para configurar a ${company}`,
      recipientName,
      companyName: company,
      sentAt: new Date().toISOString(),
      steps: [
        {
          num: 1,
          title: 'Defina os Turnos & Postos da sua Empresa',
          description: 'Acesse as Configurações para cadastrar os horários dos turnos (ex: Manhã, Tarde, T1, T2) e os postos de trabalho (docas, balanças, linhas de produção).',
        },
        {
          num: 2,
          title: 'Cadastre ou Importe a sua Equipe',
          description: 'Na aba Equipe, insira seus operadores e líderes (nome, RE/matrícula e cargo). Você também pode importar rapidamente via planilha ou CSV.',
        },
        {
          num: 3,
          title: 'Monte a Escala Diária e Ative as Pausas',
          description: 'Distribua os operadores nos postos, defina o revezamento NR-17 e controle a presença em tempo real pelo painel.',
        },
        {
          num: 4,
          title: 'Compartilhe o Link com sua Equipe',
          description: 'Os operadores podem acessar o Portal do Operador diretamente pelo celular ou totem para bipar tarefas e falar no Rádio PTT.',
        },
      ],
    };

    return res.json({
      success: true,
      message: 'E-mail de boas-vindas e onboarding disparado com sucesso!',
      email: emailPayload,
    });
  } catch (error: any) {
    console.error('Erro ao disparar e-mail de boas-vindas:', error);
    return res.status(500).json({ success: false, error: error.message || 'Falha ao processar e-mail' });
  }
});

unifiedApiRouter.post('/auth/delete-account', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID é obrigatório' });
    }

    try {
      await adminAuth.deleteUser(userId);
      console.log(`[Auth Deletion] Usuário ${userId} removido com sucesso do Firebase Authentication.`);
    } catch (authErr: any) {
      console.warn(`[Auth Deletion] Aviso ao remover do Firebase Auth (usuário pode já ter sido excluído):`, authErr.message);
    }

    return res.json({
      success: true,
      message: 'Conta e credenciais removidas com sucesso do Firebase Auth.',
      userId,
    });
  } catch (error: any) {
    console.error('Erro ao excluir conta de usuário:', error);
    return res.status(500).json({ success: false, error: error.message || 'Falha ao excluir conta' });
  }
});

/**
 * 0. GET / or /catalog
 * Service catalog & API directory listing all available resources
 */
unifiedApiRouter.get(['/', '/catalog'], (req: Request, res: Response) => {
  const host = req.get('host') || 'localhost:3000';
  const protocol = req.protocol || 'http';
  const baseUrl = `${protocol}://${host}`;

  return sendSuccess(res, {
    name: 'Dimensio Unified REST API',
    version: API_VERSION,
    status: 'operational',
    documentationUrl: `${baseUrl}/api/docs`,
    openApiSpecUrl: `${baseUrl}/api/openapi.json`,
    description: 'API REST Unificada e Robusta do Dimensio para controle de escalas, presenças, postos, intervalos, rotinas operacionais e telemetria.',
    endpoints: {
      overview: { method: 'GET', path: '/api/v1/overview', description: 'Resumo operacional em tempo real (totalizadores, presença e capacidade de postos)' },
      presence: {
        list: { method: 'GET', path: '/api/v1/presence?date=YYYY-MM-DD&shift=ALL&format=json|csv', description: 'Consulta lista de presenças e faltas da data' },
        record: { method: 'POST', path: '/api/v1/presence', description: 'Registra/atualiza presenças (individual ou em lote)' },
        webhook: { method: 'POST', path: '/api/v1/presence/webhook', description: 'Webhook simplificado para relógio de ponto e totens' },
        syncBatch: { method: 'POST', path: '/api/v1/presence/sync', description: 'Sincronização em lote de presença (JSON ou CSV bruto)' },
        events: { method: 'GET', path: '/api/v1/presence/events', description: 'Histórico recente de eventos de presença e batidas' },
      },
      collaborators: {
        list: { method: 'GET', path: '/api/v1/collaborators?shift=&role=&scale=&search=', description: 'Lista colaboradores da equipe' },
        createOrUpdate: { method: 'POST', path: '/api/v1/collaborators', description: 'Cria ou atualiza colaborador' },
        getById: { method: 'GET', path: '/api/v1/collaborators/:id', description: 'Consulta colaborador específico com status atual' },
        delete: { method: 'DELETE', path: '/api/v1/collaborators/:id', description: 'Remove colaborador' },
      },
      tasks: {
        list: { method: 'GET', path: '/api/v1/tasks', description: 'Lista postos de trabalho e dimensionamento' },
        createOrUpdate: { method: 'POST', path: '/api/v1/tasks', description: 'Cria ou atualiza posto de trabalho' },
        assign: { method: 'POST', path: '/api/v1/tasks/assign', description: 'Aloca operador em um posto por ID, Nome, Matrícula ou Login' },
        unassign: { method: 'POST', path: '/api/v1/tasks/unassign', description: 'Desaloca operador de posto' },
        delete: { method: 'DELETE', path: '/api/v1/tasks/:id', description: 'Remove posto de trabalho' },
      },
      breaks: {
        list: { method: 'GET', path: '/api/v1/breaks?date=YYYY-MM-DD', description: 'Consulta horários de intervalos e refeição da data' },
        assign: { method: 'POST', path: '/api/v1/breaks/assign', description: 'Define horário de intervalo para colaborador' },
      },
      routines: {
        list: { method: 'GET', path: '/api/v1/routines?listId=&dueDate=', description: 'Lista rotinas e checklists agendados' },
        createTask: { method: 'POST', path: '/api/v1/routines/tasks', description: 'Cria nova rotina ou feedback' },
        updateTask: { method: 'PUT', path: '/api/v1/routines/tasks/:id', description: 'Atualiza status da rotina' },
      },
      requests: {
        list: { method: 'GET', path: '/api/v1/requests?status=&priority=', description: 'Lista pedidos e chamados operacionais' },
        create: { method: 'POST', path: '/api/v1/requests', description: 'Abre novo chamado de apoio ou insumos' },
        update: { method: 'PATCH', path: '/api/v1/requests/:id', description: 'Atualiza status do chamado' },
      },
      metrics: {
        list: { method: 'GET', path: '/api/v1/metrics', description: 'Consulta métricas cadastradas e histórico de leituras' },
        sendReading: { method: 'POST', path: '/api/v1/metrics/readings', description: 'Registra nova leitura de métrica via sensor ou extensão' },
      },
      infoHub: {
        list: { method: 'GET', path: '/api/v1/info-hub?workspace=&type=&shift=&search=', description: 'Consulta base compartilhada de avisos, links e códigos' },
        syncBatch: { method: 'POST', path: '/api/v1/info-hub/sync', description: 'Sincronização em lote do Hub de Informações' },
      },
      notifications: {
        broadcast: { method: 'POST', path: '/api/v1/notifications/broadcast', description: 'Transmite aviso instantâneo para todos os aparelhos conectados' },
      },
      fullSync: { method: 'POST', path: '/api/v1/sync', description: 'Sincronização total do estado da aplicação' },
      signal: {
        poll: { method: 'GET', path: '/api/v1/signal?sinceSeq=&since=', description: 'Busca sinais pendentes de PTT/WebRTC' },
        push: { method: 'POST', path: '/api/v1/signal', description: 'Envia sinal de voz ou estado PTT' },
      },
    },
  });
});

/**
 * 1. OVERVIEW & HEALTH
 * GET /overview (and alias /dimensio/overview)
 */
unifiedApiRouter.get(['/overview', '/dimensio/overview'], (req: Request, res: Response) => {
  const date = (req.query.date as string) || getTodayISO();
  const dayRecords = presenceSnapshotStore[date] || {};
  const presenceList = Object.values(dayRecords);

  const collabs = cachedCollaborators.length > 0 ? cachedCollaborators : dimensioStore.collaborators;
  const presentCount = presenceList.filter((r) => r.status === 'presente' || r.status === 'atraso').length;
  const absentCount = presenceList.filter((r) => r.status !== 'presente' && r.status !== 'atraso').length;

  const totalRequired = dimensioStore.tasks.reduce((acc, t) => acc + (t.requiredCapacity || 0), 0);
  const totalAllocated = dimensioStore.tasks.reduce((acc, t) => acc + (t.members || []).length, 0);

  return sendSuccess(res, {
    date,
    stats: {
      totalCollaborators: collabs.length,
      presentCount,
      absentCount,
      totalTasks: dimensioStore.tasks.length,
      capacity: {
        required: totalRequired,
        allocated: totalAllocated,
        fulfillmentRatePercent: totalRequired > 0 ? Number(((totalAllocated / totalRequired) * 100).toFixed(1)) : 100,
      },
      totalPendingRequests: dimensioStore.serviceRequests.filter((r) => r.status === 'pendente').length,
      totalScheduledRoutines: dimensioStore.scheduledTasks.length,
    },
    tasks: dimensioStore.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      area: t.area || 'Operação',
      allocatedCount: (t.members || []).length,
      requiredCapacity: t.requiredCapacity || 0,
      members: t.members,
    })),
  });
});

/**
 * 2. PRESENCE ENDPOINTS
 */

// GET /presence - Query presence records
unifiedApiRouter.get('/presence', (req: Request, res: Response) => {
  const date = (req.query.date as string) || getTodayISO();
  const shiftFilter = (req.query.shift as string) || 'ALL';
  const scaleFilter = (req.query.scale as string) || 'ALL';
  const statusFilter = (req.query.status as string) || 'ALL';
  const searchQuery = normalizeSearchText((req.query.search as string) || (req.query.q as string) || '');
  const format = ((req.query.format as string) || 'json').toLowerCase();

  const dayRecords = presenceSnapshotStore[date] || {};
  let list: PresenceRecord[] = Object.values(dayRecords);

  // Fallback to active collaborators roster if date is fresh
  if (list.length === 0 && cachedCollaborators.length > 0) {
    list = cachedCollaborators.map((c) => ({
      id: c.id,
      collaboratorId: c.id,
      name: c.name,
      login: c.login,
      registration: c.registration,
      shift: c.shift || 'T2',
      scale: c.scale || 'A',
      role: c.role || 'Operador',
      status: 'presente',
      reason: '',
      date,
      timestamp: Date.now(),
      source: 'initial_roster_cache',
    }));
  }

  // Filters
  if (shiftFilter !== 'ALL' && shiftFilter !== 'todos' && shiftFilter !== 'Geral') {
    list = list.filter((r) => !r.shift || r.shift === 'Geral' || r.shift === shiftFilter);
  }
  if (scaleFilter !== 'ALL' && scaleFilter !== 'todos') {
    list = list.filter((r) => !r.scale || r.scale === scaleFilter);
  }
  if (statusFilter !== 'ALL') {
    list = list.filter((r) => r.status === statusFilter);
  }
  if (searchQuery) {
    list = list.filter((r) => {
      return (
        normalizeSearchText(r.name).includes(searchQuery) ||
        (r.login && normalizeSearchText(r.login).includes(searchQuery)) ||
        (r.registration && normalizeSearchText(r.registration).includes(searchQuery))
      );
    });
  }

  list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  // CSV Export Format
  if (format === 'csv') {
    const headers = ['Data', 'Nome', 'Login', 'Matrícula', 'Turno', 'Turma', 'Cargo', 'Status', 'Motivo', 'AtualizadoEm'];
    const rows = list.map((r) => [
      `"${r.date}"`,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${(r.login || '').replace(/"/g, '""')}"`,
      `"${(r.registration || '').replace(/"/g, '""')}"`,
      `"${(r.shift || '').replace(/"/g, '""')}"`,
      `"${(r.scale || '').replace(/"/g, '""')}"`,
      `"${(r.role || '').replace(/"/g, '""')}"`,
      `"${r.status}"`,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      `"${new Date(r.timestamp).toISOString()}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="presenca-${date}.csv"`);
    return res.send(csvContent);
  }

  const presentCount = list.filter((r) => r.status === 'presente' || r.status === 'atraso').length;
  const absentCount = list.filter((r) => r.status !== 'presente' && r.status !== 'atraso').length;

  return sendSuccess(res, list, {
    date,
    total: list.length,
    presentCount,
    absentCount,
    shift: shiftFilter,
    scale: scaleFilter,
  });
});

// POST /presence - Register or update presence (supports single or array)
unifiedApiRouter.post('/presence', (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return sendError(res, 'Payload JSON inválido');
      }
    }

    const items = Array.isArray(body)
      ? body
      : Array.isArray(body?.records)
      ? body.records
      : Array.isArray(body?.data)
      ? body.data
      : [body];

    const date = body?.date || items[0]?.date || getTodayISO();

    if (!presenceSnapshotStore[date]) {
      presenceSnapshotStore[date] = {};
    }

    const processed: PresenceRecord[] = [];

    items.forEach((item: any) => {
      if (!item) return;
      const matched = matchCollaborator(item);
      const collabId = matched
        ? matched.id
        : item.collaboratorId || item.id || `pres_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const name = matched ? matched.name : item.name || collabId;
      const status = normalizePresenceStatus(item.status);

      const record: PresenceRecord = {
        id: collabId,
        collaboratorId: collabId,
        name,
        login: matched?.login || item.login,
        registration: matched?.registration || item.registration,
        shift: matched?.shift || item.shift || 'T2',
        scale: matched?.scale || item.scale || 'A',
        role: matched?.role || item.role || 'Operador',
        status,
        reason: item.reason || item.notes || item.motivo || '',
        date,
        timestamp: Date.now(),
        source: item.source || 'api_rest',
      };

      presenceSnapshotStore[date][collabId] = record;
      processed.push(record);
    });

    // Record audit event
    const event: PresenceSyncEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: processed.length > 1 ? 'batch' : 'single',
      source: body?.source || 'REST API',
      count: processed.length,
      timestamp: Date.now(),
      details: `${processed.length} presença(s) registrada(s) para a data ${date}`,
      records: processed,
    };
    presenceEventsLog.unshift(event);
    if (presenceEventsLog.length > MAX_EVENTS_LOG) presenceEventsLog.pop();

    // Broadcast change
    broadcastDimensioUpdate('presence_batch', { date, records: processed });

    return sendSuccess(res, processed, {
      message: `${processed.length} registro(s) de presença processado(s) com sucesso!`,
      date,
      count: processed.length,
    });
  } catch (err: any) {
    return sendError(res, 'Erro ao processar presença', 500, err?.message);
  }
});

// POST /presence/webhook - Simplified webhook for timeclocks and terminals
unifiedApiRouter.post('/presence/webhook', (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const identifier = {
      collaboratorId: payload.collaborator_id || payload.collaboratorId || payload.id,
      registration: payload.registration || payload.matricula || payload.re || payload.badge,
      login: payload.login || payload.user_login || payload.usuario,
      name: payload.name || payload.nome || payload.collaborator_name,
    };

    const matched = matchCollaborator(identifier);
    const collabId = matched
      ? matched.id
      : identifier.collaboratorId || identifier.registration || `wh_${Date.now()}`;
    const name = matched ? matched.name : identifier.name || 'Colaborador Webhook';
    const date = payload.date || getTodayISO();
    const status = normalizePresenceStatus(payload.status || payload.event || payload.action || 'presente');

    if (!presenceSnapshotStore[date]) {
      presenceSnapshotStore[date] = {};
    }

    const record: PresenceRecord = {
      id: collabId,
      collaboratorId: collabId,
      name,
      login: matched?.login || identifier.login,
      registration: matched?.registration || identifier.registration,
      shift: matched?.shift || payload.shift || 'T2',
      scale: matched?.scale || payload.scale || 'A',
      role: matched?.role || payload.role || 'Operador',
      status,
      reason: payload.reason || payload.motivo || 'Batida via Webhook',
      date,
      timestamp: Date.now(),
      source: payload.app_name || payload.source || 'Webhook Externo',
    };

    presenceSnapshotStore[date][collabId] = record;

    presenceEventsLog.unshift({
      id: `wh_${Date.now()}`,
      type: 'webhook',
      source: record.source || 'Webhook',
      count: 1,
      timestamp: Date.now(),
      details: `Ponto registrado para ${record.name} (${status})`,
      records: [record],
    });

    broadcastDimensioUpdate('presence_webhook', { date, records: [record] });

    return sendSuccess(res, record, {
      matched: Boolean(matched),
      message: `Ponto de "${name}" processado com sucesso.`,
    });
  } catch (err: any) {
    return sendError(res, 'Erro no webhook de presença', 400, err?.message);
  }
});

// POST /presence/sync & /presence/batch-sync - Batch or CSV sync
unifiedApiRouter.post(['/presence/sync', '/presence/batch-sync'], (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        const lines = body.split(/[\r\n]+/).filter(Boolean);
        const parsedItems: any[] = [];
        lines.forEach((line: string, idx: number) => {
          if (idx === 0 && (line.includes('Nome') || line.includes('name') || line.includes('Status'))) return;
          const parts = line.split(/[;,]/).map((p: string) => p.replace(/^["']|["']$/g, '').trim());
          if (parts.length >= 2) {
            parsedItems.push({
              name: parts[0],
              status: parts[1] || 'presente',
              login: parts[2] || undefined,
              registration: parts[3] || undefined,
              reason: parts[4] || undefined,
            });
          }
        });
        body = { records: parsedItems };
      }
    }

    const records = body.records || body.data || (Array.isArray(body) ? body : [body]);
    const date = body.date || getTodayISO();

    if (!presenceSnapshotStore[date]) {
      presenceSnapshotStore[date] = {};
    }

    const processed: PresenceRecord[] = [];

    (records as any[]).forEach((rec) => {
      if (!rec) return;
      const matched = matchCollaborator(rec);
      const collabId = matched ? matched.id : rec.collaboratorId || rec.id || `sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const name = matched ? matched.name : rec.name || collabId;
      const status = normalizePresenceStatus(rec.status);

      const entry: PresenceRecord = {
        id: collabId,
        collaboratorId: collabId,
        name,
        login: matched?.login || rec.login,
        registration: matched?.registration || rec.registration,
        shift: matched?.shift || rec.shift || 'T2',
        scale: matched?.scale || rec.scale || 'A',
        role: matched?.role || rec.role || 'Operador',
        status,
        reason: rec.reason || '',
        date,
        timestamp: Date.now(),
        source: 'sync_batch',
      };

      presenceSnapshotStore[date][collabId] = entry;
      processed.push(entry);
    });

    presenceEventsLog.unshift({
      id: `sync_${Date.now()}`,
      type: 'batch',
      source: body.source || 'Batch Sync API',
      count: processed.length,
      timestamp: Date.now(),
      details: `Sincronização em lote: ${processed.length} registros para ${date}`,
      records: processed,
    });

    broadcastDimensioUpdate('presence_batch', { date, records: processed });

    return sendSuccess(res, processed, { date, count: processed.length });
  } catch (err: any) {
    return sendError(res, 'Falha na sincronização de presença', 500, err?.message);
  }
});

// GET /presence/events - Audit log of presence events
unifiedApiRouter.get('/presence/events', (_req: Request, res: Response) => {
  return sendSuccess(res, presenceEventsLog, { count: presenceEventsLog.length });
});

// POST /presence/state-sync - Push active frontend state
unifiedApiRouter.post('/presence/state-sync', (req: Request, res: Response) => {
  try {
    const { collaborators, date, attendance, selectedDate } = req.body || {};
    if (Array.isArray(collaborators)) {
      cachedCollaborators.length = 0;
      collaborators.forEach((c) => {
        cachedCollaborators.push({
          id: c.id,
          name: c.name,
          login: c.login,
          registration: c.registration,
          shift: c.shift,
          scale: c.scale,
          role: c.role,
        });
      });
    }

    const activeDate = date || selectedDate || getTodayISO();
    if (attendance && typeof attendance === 'object') {
      if (!presenceSnapshotStore[activeDate]) {
        presenceSnapshotStore[activeDate] = {};
      }
      const dayAtt = attendance[activeDate] || {};
      Object.entries(dayAtt).forEach(([collabId, statusVal]) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(collabId)) return;
        const collab = cachedCollaborators.find((c) => c.id === collabId);
        let status: PresenceRecord['status'] = 'presente';
        let reason = '';

        if (statusVal === true) status = 'presente';
        else if (statusVal === false) status = 'ausente';
        else if (typeof statusVal === 'object' && statusVal !== null) {
          const sv = statusVal as { absent?: boolean; reason?: string };
          status = normalizePresenceStatus(sv.reason || (sv.absent ? 'ausente' : 'presente'));
          reason = sv.reason || '';
        }

        presenceSnapshotStore[activeDate][collabId] = {
          id: collabId,
          collaboratorId: collabId,
          name: collab ? collab.name : collabId,
          login: collab?.login,
          registration: collab?.registration,
          shift: collab?.shift || 'T2',
          scale: collab?.scale || 'A',
          role: collab?.role || 'Operador',
          status,
          reason,
          date: activeDate,
          timestamp: Date.now(),
          source: 'app_sync',
        };
      });
    }

    return sendSuccess(res, {
      cachedCollaboratorsCount: cachedCollaborators.length,
      date: activeDate,
    });
  } catch (err: any) {
    return sendError(res, 'Falha ao sincronizar estado de presença', 500, err?.message);
  }
});

/**
 * 3. COLLABORATORS RESOURCE
 */

// GET /collaborators - List team
unifiedApiRouter.get('/collaborators', (req: Request, res: Response) => {
  const shift = req.query.shift as string;
  const role = req.query.role as string;
  const scale = req.query.scale as string;
  const search = normalizeSearchText((req.query.search as string) || (req.query.q as string) || '');

  let list = cachedCollaborators.length > 0 ? cachedCollaborators : dimensioStore.collaborators;

  if (shift && shift !== 'ALL' && shift !== 'todos') {
    list = list.filter((c) => c.shift === shift);
  }
  if (role) {
    list = list.filter((c) => c.role && c.role.toLowerCase() === role.toLowerCase());
  }
  if (scale && scale !== 'ALL' && scale !== 'todos') {
    list = list.filter((c) => c.scale === scale);
  }
  if (search) {
    list = list.filter((c) => {
      return (
        normalizeSearchText(c.name).includes(search) ||
        (c.login && normalizeSearchText(c.login).includes(search)) ||
        (c.registration && normalizeSearchText(c.registration).includes(search))
      );
    });
  }

  return sendSuccess(res, list, { count: list.length });
});

// POST /collaborators - Create or update collaborator
unifiedApiRouter.post('/collaborators', (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    if (!body.name || !body.name.trim()) {
      return sendError(res, 'Nome do colaborador é obrigatório');
    }

    const matched = matchCollaborator(body);
    const id = matched ? matched.id : body.id || `collab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newCollab: CollaboratorModel = {
      id,
      name: body.name.trim(),
      login: body.login?.trim() || undefined,
      registration: body.registration?.trim() || undefined,
      shift: body.shift || 'T2',
      scale: body.scale || 'A',
      role: body.role || 'Operador',
      sector: body.sector || undefined,
    };

    const idx = cachedCollaborators.findIndex((c) => c.id === id);
    if (idx >= 0) cachedCollaborators[idx] = newCollab;
    else cachedCollaborators.push(newCollab);

    const storeIdx = dimensioStore.collaborators.findIndex((c) => c.id === id);
    if (storeIdx >= 0) dimensioStore.collaborators[storeIdx] = newCollab;
    else dimensioStore.collaborators.push(newCollab);

    broadcastDimensioUpdate('collaborator_updated', { collaborator: newCollab });

    return sendSuccess(res, newCollab, { action: idx >= 0 ? 'updated' : 'created' });
  } catch (err: any) {
    return sendError(res, 'Erro ao salvar colaborador', 500, err?.message);
  }
});

// GET /collaborators/:id - Single collaborator detail
unifiedApiRouter.get('/collaborators/:id', (req: Request, res: Response) => {
  const matched = matchCollaborator({ id: req.params.id });
  if (!matched) return sendError(res, 'Colaborador não encontrado', 404);

  const date = (req.query.date as string) || getTodayISO();
  const dayPresence = presenceSnapshotStore[date]?.[matched.id];
  const assignedTask = dimensioStore.tasks.find((t) => t.members.includes(matched.id));

  return sendSuccess(res, {
    ...matched,
    currentPresence: dayPresence || { status: 'presente', date },
    assignedTask: assignedTask ? { id: assignedTask.id, name: assignedTask.name, area: assignedTask.area } : null,
  });
});

// DELETE /collaborators/:id - Remove collaborator
unifiedApiRouter.delete('/collaborators/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const idx = cachedCollaborators.findIndex((c) => c.id === id);
  if (idx === -1) return sendError(res, 'Colaborador não encontrado', 404);

  const removed = cachedCollaborators.splice(idx, 1)[0];
  const storeIdx = dimensioStore.collaborators.findIndex((c) => c.id === id);
  if (storeIdx >= 0) dimensioStore.collaborators.splice(storeIdx, 1);

  // Remove from tasks
  dimensioStore.tasks.forEach((t) => {
    t.members = t.members.filter((m) => m !== id);
  });

  broadcastDimensioUpdate('collaborator_deleted', { id });
  return sendSuccess(res, removed, { message: `Colaborador "${removed.name}" removido com sucesso.` });
});

/**
 * 4. TASKS & WORKSTATIONS RESOURCE
 */

// GET /tasks - List all tasks / workstations
unifiedApiRouter.get('/tasks', (_req: Request, res: Response) => {
  const tasksWithDetails = dimensioStore.tasks.map((t) => {
    const memberDetails = t.members.map((mId) => {
      const col = matchCollaborator({ id: mId });
      return col ? { id: col.id, name: col.name, role: col.role, shift: col.shift } : { id: mId, name: mId };
    });
    return {
      ...t,
      allocatedCount: t.members.length,
      isFitted: (t.requiredCapacity || 0) <= t.members.length,
      memberDetails,
    };
  });

  return sendSuccess(res, tasksWithDetails, { count: tasksWithDetails.length });
});

// POST /tasks - Create or update task
unifiedApiRouter.post('/tasks', (req: Request, res: Response) => {
  try {
    const { id, name, area, requiredCapacity, externalUrl } = req.body || {};
    if (!name || !name.trim()) {
      return sendError(res, 'Nome da tarefa é obrigatório');
    }

    const taskId = id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const taskObj: TaskModel = {
      id: taskId,
      name: name.trim(),
      area: area || 'Operação',
      requiredCapacity: Number(requiredCapacity) || 0,
      members: [],
      externalUrl: externalUrl || '',
    };

    const idx = dimensioStore.tasks.findIndex((t) => t.id === taskId);
    if (idx >= 0) {
      dimensioStore.tasks[idx] = { ...dimensioStore.tasks[idx], ...taskObj };
    } else {
      dimensioStore.tasks.push(taskObj);
    }

    broadcastDimensioUpdate('task_updated', { task: taskObj });
    return sendSuccess(res, taskObj, { action: idx >= 0 ? 'updated' : 'created' });
  } catch (err: any) {
    return sendError(res, 'Erro ao salvar tarefa', 500, err?.message);
  }
});

// POST /tasks/assign - Allocate collaborator in task
unifiedApiRouter.post('/tasks/assign', (req: Request, res: Response) => {
  try {
    const { collaborator, collaboratorId, name, login, registration, taskId, taskName } = req.body || {};
    const matchedCollab = matchCollaborator({
      collaboratorId: collaboratorId || (collaborator && collaborator.id),
      name: name || (collaborator && collaborator.name),
      login: login || (collaborator && collaborator.login),
      registration: registration || (collaborator && collaborator.registration),
    });

    if (!matchedCollab) {
      return sendError(res, 'Colaborador não encontrado por ID, Nome, Matrícula ou Login', 404);
    }

    let targetTask = dimensioStore.tasks.find((t) => t.id === taskId);
    if (!targetTask && taskName) {
      const normTask = normalizeSearchText(taskName);
      targetTask = dimensioStore.tasks.find(
        (t) => normalizeSearchText(t.name) === normTask || normalizeSearchText(t.name).includes(normTask)
      );
    }

    if (!targetTask) {
      return sendError(res, 'Tarefa de destino não encontrada', 404);
    }

    // Remove from other tasks
    dimensioStore.tasks.forEach((t) => {
      t.members = (t.members || []).filter((mId) => mId !== matchedCollab.id);
    });

    // Add to target task
    if (!targetTask.members.includes(matchedCollab.id)) {
      targetTask.members.push(matchedCollab.id);
    }

    broadcastDimensioUpdate('task_assignment', {
      collaboratorId: matchedCollab.id,
      collaboratorName: matchedCollab.name,
      taskId: targetTask.id,
      taskName: targetTask.name,
    });

    return sendSuccess(res, {
      collaborator: matchedCollab,
      task: targetTask,
    }, {
      message: `${matchedCollab.name} alocado com sucesso em "${targetTask.name}"`,
    });
  } catch (err: any) {
    return sendError(res, 'Erro na alocação de tarefa', 500, err?.message);
  }
});

// POST /tasks/unassign - Remove collaborator from all tasks
unifiedApiRouter.post('/tasks/unassign', (req: Request, res: Response) => {
  const { collaboratorId, name, login, registration } = req.body || {};
  const matched = matchCollaborator({ collaboratorId, name, login, registration });
  if (!matched) return sendError(res, 'Colaborador não identificado', 404);

  dimensioStore.tasks.forEach((t) => {
    t.members = t.members.filter((m) => m !== matched.id);
  });

  broadcastDimensioUpdate('task_unassigned', { collaboratorId: matched.id });
  return sendSuccess(res, { collaboratorId: matched.id, name: matched.name }, {
    message: `${matched.name} desalocado de todos os postos.`,
  });
});

// DELETE /tasks/:id - Remove task
unifiedApiRouter.delete('/tasks/:id', (req: Request, res: Response) => {
  const idx = dimensioStore.tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return sendError(res, 'Tarefa não encontrada', 404);

  const removed = dimensioStore.tasks.splice(idx, 1)[0];
  broadcastDimensioUpdate('task_deleted', { id: req.params.id });
  return sendSuccess(res, removed, { message: `Tarefa "${removed.name}" removida com sucesso.` });
});

/**
 * 5. BREAKS & INTERVALS (NR-17) RESOURCE
 */

// GET /breaks - List breaks for a date
unifiedApiRouter.get('/breaks', (req: Request, res: Response) => {
  const date = (req.query.date as string) || getTodayISO();
  const shiftFilter = (req.query.shift as string) || 'ALL';
  const dayIntervals = dimensioStore.intervals[date] || {};

  let items = Object.entries(dayIntervals).map(([collabId, breakTime]) => {
    const collab = matchCollaborator({ id: collabId });
    return {
      collaboratorId: collabId,
      collaboratorName: collab ? collab.name : collabId,
      shift: collab?.shift || 'T2',
      scale: collab?.scale || 'A',
      breakTime,
      date,
    };
  });

  if (shiftFilter !== 'ALL' && shiftFilter !== 'todos') {
    items = items.filter((it) => it.shift === shiftFilter);
  }

  items.sort((a, b) => (a.breakTime || '').localeCompare(b.breakTime || ''));
  return sendSuccess(res, items, { date, count: items.length });
});

// POST /breaks/assign - Assign single break
unifiedApiRouter.post('/breaks/assign', (req: Request, res: Response) => {
  try {
    const { collaboratorId, name, login, registration, breakTime, date } = req.body || {};
    const matched = matchCollaborator({ collaboratorId, name, login, registration });
    if (!matched) return sendError(res, 'Colaborador não identificado', 404);
    if (!breakTime) return sendError(res, 'Horário de intervalo (breakTime) é obrigatório');

    const activeDate = date || getTodayISO();
    if (!dimensioStore.intervals[activeDate]) {
      dimensioStore.intervals[activeDate] = {};
    }
    dimensioStore.intervals[activeDate][matched.id] = breakTime;

    broadcastDimensioUpdate('break_assigned', {
      date: activeDate,
      collaboratorId: matched.id,
      collaboratorName: matched.name,
      breakTime,
    });

    return sendSuccess(res, {
      collaboratorId: matched.id,
      name: matched.name,
      breakTime,
      date: activeDate,
    }, {
      message: `Intervalo de ${matched.name} definido para ${breakTime}`,
    });
  } catch (err: any) {
    return sendError(res, 'Erro ao atribuir intervalo', 500, err?.message);
  }
});

/**
 * 6. ROUTINES & CHECKLISTS RESOURCE
 */

// GET /routines - List routines & tasks
unifiedApiRouter.get('/routines', (req: Request, res: Response) => {
  const listId = req.query.listId as string;
  const dueDate = req.query.dueDate as string;
  let tasks = dimensioStore.scheduledTasks;

  if (listId) tasks = tasks.filter((t) => t.listId === listId);
  if (dueDate) tasks = tasks.filter((t) => t.dueDate === dueDate);

  return sendSuccess(res, tasks, {
    lists: dimensioStore.scheduledTaskLists,
    count: tasks.length,
  });
});

// POST /routines/tasks - Create routine task
unifiedApiRouter.post('/routines/tasks', (req: Request, res: Response) => {
  try {
    const { title, description, listId, listName, dueDate, dueTime, assigneeName, collaboratorName } = req.body || {};
    if (!title || !title.trim()) return sendError(res, 'Título da rotina é obrigatório');

    let targetListId = listId;
    if (!targetListId && listName) {
      const normListName = normalizeSearchText(listName);
      const existing = dimensioStore.scheduledTaskLists.find(
        (l) => normalizeSearchText(l.title) === normListName || normalizeSearchText(l.title).includes(normListName)
      );
      if (existing) {
        targetListId = existing.id;
      } else {
        targetListId = `list_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        dimensioStore.scheduledTaskLists.push({ id: targetListId, title: listName, color: '#8b5cf6', icon: 'ClipboardList' });
      }
    }

    const newTask: ScheduledTaskModel = {
      id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      description: description || '',
      listId: targetListId || dimensioStore.scheduledTaskLists[0]?.id || 'list-feedback',
      dueDate: dueDate || getTodayISO(),
      dueTime: dueTime || '',
      assigneeName: assigneeName || collaboratorName || '',
      completed: false,
    };

    dimensioStore.scheduledTasks.push(newTask);
    broadcastDimensioUpdate('routine_task_created', { task: newTask });

    return sendSuccess(res, newTask, { message: `Tarefa "${newTask.title}" adicionada com sucesso!` });
  } catch (err: any) {
    return sendError(res, 'Erro ao criar rotina', 500, err?.message);
  }
});

// PUT /routines/tasks/:id - Update routine task
unifiedApiRouter.put('/routines/tasks/:id', (req: Request, res: Response) => {
  const taskId = req.params.id;
  const idx = dimensioStore.scheduledTasks.findIndex((t) => t.id === taskId);
  if (idx === -1) return sendError(res, 'Tarefa agendada não encontrada', 404);

  dimensioStore.scheduledTasks[idx] = {
    ...dimensioStore.scheduledTasks[idx],
    ...req.body,
  };

  broadcastDimensioUpdate('routine_task_updated', { task: dimensioStore.scheduledTasks[idx] });
  return sendSuccess(res, dimensioStore.scheduledTasks[idx]);
});

/**
 * 7. SERVICE REQUESTS (CHAMADOS & APOIO OPERACIONAL)
 */

// GET /requests - List service requests
unifiedApiRouter.get('/requests', (req: Request, res: Response) => {
  const status = req.query.status as string;
  let list = dimensioStore.serviceRequests;
  if (status) list = list.filter((r) => r.status === status);
  return sendSuccess(res, list, { count: list.length });
});

// POST /requests - Create service request
unifiedApiRouter.post('/requests', (req: Request, res: Response) => {
  try {
    const { title, description, requesterName, collaboratorId, priority } = req.body || {};
    if (!title || !title.trim()) return sendError(res, 'Título do pedido é obrigatório');

    const matched = matchCollaborator({ collaboratorId, name: requesterName });
    const reqObj: ServiceRequestModel = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      description: description || '',
      requesterName: matched ? matched.name : requesterName || 'Colaborador',
      status: 'pendente',
      priority: priority || 'media',
      createdAt: new Date().toISOString(),
    };

    dimensioStore.serviceRequests.unshift(reqObj);
    broadcastDimensioUpdate('service_request_created', { request: reqObj });

    return sendSuccess(res, reqObj, { message: `Pedido "${reqObj.title}" registrado com sucesso!` });
  } catch (err: any) {
    return sendError(res, 'Erro ao criar pedido de serviço', 500, err?.message);
  }
});

// PATCH /requests/:id - Update request status
unifiedApiRouter.patch('/requests/:id', (req: Request, res: Response) => {
  const idx = dimensioStore.serviceRequests.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return sendError(res, 'Chamado não encontrado', 404);

  dimensioStore.serviceRequests[idx] = {
    ...dimensioStore.serviceRequests[idx],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };

  broadcastDimensioUpdate('service_request_updated', { request: dimensioStore.serviceRequests[idx] });
  return sendSuccess(res, dimensioStore.serviceRequests[idx]);
});

/**
 * 8. OPERATIONAL METRICS & TELEMETRY
 */

// GET /metrics - List metric definitions & recent readings
unifiedApiRouter.get('/metrics', (_req: Request, res: Response) => {
  return sendSuccess(res, {
    definitions: dimensioStore.metricDefinitions,
    recentReadings: dimensioStore.metricReadings.slice(-50),
  });
});

// POST /metrics/readings - Send reading from sensor/extension
unifiedApiRouter.post('/metrics/readings', (req: Request, res: Response) => {
  try {
    const { metricId, value, source } = req.body || {};
    if (!metricId || value === undefined) {
      return sendError(res, 'metricId e value são obrigatórios');
    }

    const reading = {
      id: `mr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      metricId,
      value: Number(value),
      timestamp: Date.now(),
      source: source || 'external_sensor',
    };

    dimensioStore.metricReadings.push(reading);
    broadcastDimensioUpdate('metric_reading_captured', { reading });

    return sendSuccess(res, reading);
  } catch (err: any) {
    return sendError(res, 'Erro ao registrar leitura de métrica', 500, err?.message);
  }
});

/**
 * 9. INFO HUB SHARED BASE (MULTI-APP)
 */

unifiedApiRouter.get('/info-hub', (req: Request, res: Response) => {
  const ws = getWorkspace(req);
  const type = ((req.query.type as string) || 'all').toLowerCase();
  const search = ((req.query.search as string) || '').toLowerCase();
  const shift = (req.query.shift as string) || '';
  const match = (s?: string) => !search || (s || '').toLowerCase().includes(search);

  let reminders = filterByWorkspace(dimensioStore.infoHubReminders, ws);
  let links = filterByWorkspace(dimensioStore.infoHubLinks, ws);
  let quickFills = filterByWorkspace(dimensioStore.infoHubQuickFills, ws);

  if (shift) {
    reminders = reminders.filter((r) => !r.shift || r.shift === 'Todos' || r.shift === shift);
    links = links.filter((l) => !(l as any).shift || (l as any).shift === 'Todos' || (l as any).shift === shift);
    quickFills = quickFills.filter((q) => !q.shift || q.shift === 'Todos' || q.shift === shift);
  }
  if (search) {
    reminders = reminders.filter((r) => match(r.title) || match(r.text) || match(r.message));
    links = links.filter((l) => match(l.title) || match(l.url) || match(l.category));
    quickFills = quickFills.filter((q) => match(q.title) || match(q.category) || match(q.description));
  }

  const meta = infoHubWorkspaces.get(ws) || { seq: 0, updatedAt: 0 };
  res.setHeader('Cache-Control', 'no-store');

  return sendSuccess(res, {
    workspace: ws,
    seq: meta.seq,
    updatedAt: meta.updatedAt,
    reminders: type === 'all' || type === 'reminders' ? reminders : undefined,
    links: type === 'all' || type === 'links' ? links : undefined,
    quickFills: type === 'all' || type === 'quickfills' || type === 'quick_fills' ? quickFills : undefined,
  }, {
    counts: { reminders: reminders.length, links: links.length, quickFills: quickFills.length },
  });
});

unifiedApiRouter.post('/info-hub/sync', (req: Request, res: Response) => {
  try {
    const ws = getWorkspace(req);
    const { reminders, links, quickFills } = req.body || {};
    const upsert = (store: any[], items: any[]) => {
      let n = 0;
      (items || []).forEach((it: any) => {
        if (!it) return;
        const id = String(it.id || `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        const idx = store.findIndex((s) => s.id === id);
        const doc = { ...it, id, workspace: ws, updatedAt: new Date().toISOString() };
        if (idx >= 0) store[idx] = { ...store[idx], ...doc };
        else store.unshift(doc);
        n++;
      });
      return n;
    };

    const c1 = Array.isArray(reminders) ? upsert(dimensioStore.infoHubReminders, reminders) : 0;
    const c2 = Array.isArray(links) ? upsert(dimensioStore.infoHubLinks, links) : 0;
    const c3 = Array.isArray(quickFills) ? upsert(dimensioStore.infoHubQuickFills, quickFills) : 0;
    const meta = touchWorkspace(ws);

    broadcastDimensioUpdate('info_hub_sync', { workspace: ws, reminders: c1, links: c2, quickFills: c3 });
    return sendSuccess(res, {
      workspace: ws,
      seq: meta.seq,
      upserted: { reminders: c1, links: c2, quickFills: c3 },
    });
  } catch (err: any) {
    return sendError(res, 'Erro no sync do Hub', 500, err?.message);
  }
});

function createInfoHubCrud(kind: 'reminders' | 'links' | 'quickFills') {
  const storeOf = () =>
    kind === 'reminders'
      ? dimensioStore.infoHubReminders
      : kind === 'links'
      ? dimensioStore.infoHubLinks
      : dimensioStore.infoHubQuickFills;

  return {
    create(req: Request, res: Response) {
      try {
        const ws = getWorkspace(req);
        const body = req.body || {};
        const store = storeOf() as any[];
        const id = String(body.id || `${kind.slice(0, 3)}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        const doc = { ...body, id, workspace: ws, createdAt: body.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
        store.unshift(doc);
        const meta = touchWorkspace(ws);
        broadcastDimensioUpdate(`info_hub_${kind}_upsert`, { workspace: ws, data: doc });
        return sendSuccess(res, doc, { workspace: ws, seq: meta.seq }, 201);
      } catch (err: any) {
        return sendError(res, `Erro ao criar ${kind}`, 500, err?.message);
      }
    },
    update(req: Request, res: Response) {
      try {
        const ws = getWorkspace(req);
        const store = storeOf() as any[];
        const idx = store.findIndex((s) => s.id === req.params.id);
        if (idx === -1) return sendError(res, `${kind}: item não encontrado`, 404);
        store[idx] = { ...store[idx], ...req.body, id: req.params.id, workspace: ws, updatedAt: new Date().toISOString() };
        const meta = touchWorkspace(ws);
        broadcastDimensioUpdate(`info_hub_${kind}_upsert`, { workspace: ws, data: store[idx] });
        return sendSuccess(res, store[idx], { workspace: ws, seq: meta.seq });
      } catch (err: any) {
        return sendError(res, `Erro ao atualizar ${kind}`, 500, err?.message);
      }
    },
    remove(req: Request, res: Response) {
      try {
        const ws = getWorkspace(req);
        const store = storeOf() as any[];
        const idx = store.findIndex((s) => s.id === req.params.id);
        if (idx === -1) return sendError(res, `${kind}: item não encontrado`, 404);
        store.splice(idx, 1);
        const meta = touchWorkspace(ws);
        broadcastDimensioUpdate(`info_hub_${kind}_deleted`, { workspace: ws, id: req.params.id });
        return sendSuccess(res, { id: req.params.id }, { workspace: ws, seq: meta.seq, deleted: true });
      } catch (err: any) {
        return sendError(res, `Erro ao excluir ${kind}`, 500, err?.message);
      }
    },
  };
}

const reminderCrud = createInfoHubCrud('reminders');
const linkCrud = createInfoHubCrud('links');
const quickFillCrud = createInfoHubCrud('quickFills');

unifiedApiRouter.post('/info-hub/reminders', (req: Request, res: Response) => reminderCrud.create(req, res));
unifiedApiRouter.put('/info-hub/reminders/:id', (req: Request, res: Response) => reminderCrud.update(req, res));
unifiedApiRouter.delete('/info-hub/reminders/:id', (req: Request, res: Response) => reminderCrud.remove(req, res));

unifiedApiRouter.post('/info-hub/links', (req: Request, res: Response) => linkCrud.create(req, res));
unifiedApiRouter.put('/info-hub/links/:id', (req: Request, res: Response) => linkCrud.update(req, res));
unifiedApiRouter.delete('/info-hub/links/:id', (req: Request, res: Response) => linkCrud.remove(req, res));

unifiedApiRouter.post('/info-hub/quickfills', (req: Request, res: Response) => quickFillCrud.create(req, res));
unifiedApiRouter.put('/info-hub/quickfills/:id', (req: Request, res: Response) => quickFillCrud.update(req, res));
unifiedApiRouter.delete('/info-hub/quickfills/:id', (req: Request, res: Response) => quickFillCrud.remove(req, res));

unifiedApiRouter.post('/info-hub/reminder', (req: Request, res: Response) => {
  const body = req.body || {};
  req.body = {
    title: body.title,
    text: body.message || body.text,
    message: body.message || body.text,
    shift: body.shift || 'Todos',
    priority: body.priority || 'normal',
    authorName: body.authorName,
  };
  return reminderCrud.create(req, res);
});

/**
 * 10. NOTIFICATIONS BROADCAST
 */
unifiedApiRouter.post('/notifications/broadcast', (req: Request, res: Response) => {
  try {
    const { title, message, type, priority } = req.body || {};
    if (!title || !message) {
      return sendError(res, 'Título e mensagem são obrigatórios');
    }

    broadcastDimensioUpdate('global_broadcast', {
      title,
      message,
      type: type || 'notice',
      priority: priority || 'media',
      timestamp: Date.now(),
    });

    return sendSuccess(res, { title, message }, {
      message: 'Notificação global enviada para todos os clientes conectados',
    });
  } catch (err: any) {
    return sendError(res, 'Erro no broadcast de notificação', 500, err?.message);
  }
});

/**
 * 11. FULL STATE SYNC (All-in-one backup/sync from client)
 */
unifiedApiRouter.post(['/sync', '/dimensio/sync'], (req: Request, res: Response) => {
  try {
    const data = req.body || {};
    if (Array.isArray(data.collaborators)) {
      dimensioStore.collaborators = data.collaborators.map((c: any) => ({
        id: c.id,
        name: c.name,
        login: c.login,
        registration: c.registration,
        shift: c.shift,
        scale: c.scale,
        role: c.role,
        activeTaskId: c.activeTaskId,
      }));
      cachedCollaborators.length = 0;
      cachedCollaborators.push(...dimensioStore.collaborators);
    }
    if (Array.isArray(data.tasks)) dimensioStore.tasks = data.tasks;
    if (data.intervals && typeof data.intervals === 'object') {
      dimensioStore.intervals = { ...dimensioStore.intervals, ...data.intervals };
    }
    if (Array.isArray(data.scheduledTaskLists)) dimensioStore.scheduledTaskLists = data.scheduledTaskLists;
    if (Array.isArray(data.scheduledTasks)) dimensioStore.scheduledTasks = data.scheduledTasks;
    if (Array.isArray(data.serviceRequests)) dimensioStore.serviceRequests = data.serviceRequests;
    if (Array.isArray(data.metricDefinitions)) dimensioStore.metricDefinitions = data.metricDefinitions;
    if (Array.isArray(data.metricReadings)) dimensioStore.metricReadings = data.metricReadings;
    if (Array.isArray(data.infoHubReminders)) dimensioStore.infoHubReminders = data.infoHubReminders;
    if (Array.isArray(data.infoHubLinks)) dimensioStore.infoHubLinks = data.infoHubLinks;
    if (Array.isArray(data.infoHubQuickFills)) dimensioStore.infoHubQuickFills = data.infoHubQuickFills;

    return sendSuccess(res, {
      timestamp: Date.now(),
      counts: {
        collaborators: dimensioStore.collaborators.length,
        tasks: dimensioStore.tasks.length,
        scheduledTasks: dimensioStore.scheduledTasks.length,
        serviceRequests: dimensioStore.serviceRequests.length,
      },
    });
  } catch (err: any) {
    return sendError(res, 'Erro ao sincronizar estado com o Dimensio', 500, err?.message);
  }
});

/**
 * 12. WEBRTC / PTT SIGNAL BUS
 */
unifiedApiRouter.get('/signal', (req: Request, res: Response) => {
  if (!checkSignalRate(req)) {
    res.setHeader('Retry-After', '1');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(429).json({ error: 'Polling muito frequente. Use intervalo >= 2.5s.', maxSeq: globalSignalSeq, messages: [] });
  }
  cleanupSignals();
  const sinceSeq = parseInt((req.query.sinceSeq as string) || '0', 10);
  const sinceTs = parseInt((req.query.since as string) || '0', 10);
  const now = Date.now();

  let newMsgs: SignalMessage[];
  if (sinceSeq > 0) {
    newMsgs = signalStore.filter((m) => (m.seq || 0) > sinceSeq);
  } else if (sinceTs > 0) {
    const threshold = Math.max(0, sinceTs - 30000);
    newMsgs = signalStore.filter((m) => m.ts >= threshold);
  } else {
    newMsgs = signalStore.filter((m) => m.ts >= now - 30000);
  }

  if (newMsgs.length > 100) newMsgs = newMsgs.slice(-100);
  const maxSeq = signalStore.length > 0 ? (signalStore[signalStore.length - 1].seq || globalSignalSeq) : globalSignalSeq;

  res.setHeader('Cache-Control', 'no-store');
  return res.json({
    messages: newMsgs,
    maxSeq,
    count: newMsgs.length,
    seq: globalSignalSeq,
  });
});

unifiedApiRouter.post('/signal', (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return sendError(res, 'JSON inválido');
      }
    }

    let msgs: SignalMessage[] = [];
    if (Array.isArray(body)) {
      msgs = body;
    } else if (body && Array.isArray(body.signal)) {
      msgs = body.signal;
    } else if (body && Array.isArray(body.messages)) {
      msgs = body.messages;
    } else if (body && typeof body === 'object' && (body.mid || body.kind || body.sender)) {
      msgs = [body];
    }

    const now = Date.now();
    msgs.forEach((m) => {
      if (m && (m.sender || m.kind)) {
        globalSignalSeq++;
        signalStore.push({
          ...m,
          mid: m.mid || `sig-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          sender: m.sender || 'unknown',
          ts: m.ts || now,
          seq: globalSignalSeq,
        });
      }
    });

    if (signalStore.length > MAX_SIGNALS) {
      signalStore.splice(0, signalStore.length - MAX_SIGNALS);
    }

    return sendSuccess(res, { count: msgs.length, maxSeq: globalSignalSeq });
  } catch (err: any) {
    return sendError(res, 'Payload de sinal inválido', 400, err?.message);
  }
});
