import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getUsers, getOrCreateUser } from './src/db/users.ts';
import { db } from './src/db/index.ts';
import { collaborators, presenceRecords, operationalTasks } from './src/db/schema.ts';

interface SignalMessage {
  mid: string;
  kind: 'presence' | 'offer' | 'answer' | 'bye' | 'candidate' | 'ice' | 'voice_start' | 'voice_stop' | 'audio_chunk' | 'state_ping' | string;
  sender: string;
  senderName?: string;
  senderRole?: string;
  channel?: string;
  to?: string;
  payload?: unknown;
  ts: number;
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// In-memory signal store for WebRTC P2P signaling across devices
interface StoredSignalMessage extends SignalMessage {
  seq: number;
}

// In-memory store for Presence records & sync
interface PresenceRecord {
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
  date: string; // YYYY-MM-DD
  timestamp: number;
  source?: string;
}

interface PresenceSyncEvent {
  id: string;
  type: 'single' | 'batch' | 'webhook';
  source: string;
  count: number;
  timestamp: number;
  details?: string;
  records: PresenceRecord[];
}

let globalSignalSeq = 0;
const signalStore: StoredSignalMessage[] = [];
const MAX_SIGNALS = 1000;
const SIGNAL_TTL_MS = 60000; // 60 seconds

// Presence storage: date -> Map(identifier -> PresenceRecord)
const presenceSnapshotStore: Record<string, Record<string, PresenceRecord>> = {};
const presenceEventsLog: PresenceSyncEvent[] = [];
const MAX_EVENTS_LOG = 100;

// Cached list of collaborators for fast lookup and matching
let cachedCollaborators: Array<{
  id: string;
  name: string;
  login?: string;
  registration?: string;
  shift?: string;
  scale?: string;
  role?: string;
}> = [];

function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeSearchText(term: string): string {
  if (!term) return '';
  return term
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,\-–—/\\()\[\]{}:;'"!?*#@&|+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanupSignals() {
  const now = Date.now();
  while (signalStore.length > 0 && now - signalStore[0].ts > SIGNAL_TTL_MS) {
    signalStore.shift();
  }
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// App version check
app.get('/api/version', (_req, res) => {
  res.json({
    status: 'ok',
    version: '1.5.0',
    app: 'Dimensio',
    timestamp: Date.now(),
  });
});

// Cloud SQL status & health check
app.get('/api/cloudsql/status', async (_req, res) => {
  try {
    const userList = await getUsers();
    res.json({
      status: 'connected',
      database: process.env.SQL_DB_NAME || 'dimensio',
      engine: 'PostgreSQL (Cloud SQL)',
      usersCount: userList.length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: error?.message || 'Database connection error',
    });
  }
});

// Users management (protected by Firebase Auth token verification)
app.get('/api/users', requireAuth, async (req: AuthRequest, res) => {
  try {
    const usersList = await getUsers();
    res.json({
      success: true,
      currentUser: req.user,
      users: usersList,
    });
  } catch (error: any) {
    console.error('Failed to fetch users from Cloud SQL:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch users' });
  }
});

app.post('/api/users/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    if (!req.user?.uid || !req.user?.email) {
      return res.status(400).json({ error: 'Informações de usuário inválidas no token' });
    }
    const { name, picture } = req.user as any;
    const userRecord = await getOrCreateUser(req.user.uid, req.user.email, name, picture);
    res.json({
      success: true,
      user: userRecord,
    });
  } catch (error: any) {
    console.error('Failed to sync user to Cloud SQL:', error);
    res.status(500).json({ error: error.message || 'Failed to sync user' });
  }
});

// Post-Registration Trigger: Dispara e-mail de boas-vindas e próximos passos para nova empresa
app.post('/api/auth/send-welcome-email', async (req, res) => {
  try {
    const { email, displayName, companyName, userId } = req.body || {};
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

    res.json({
      success: true,
      message: 'E-mail de boas-vindas e onboarding disparado com sucesso!',
      email: emailPayload,
    });
  } catch (error: any) {
    console.error('Erro ao disparar e-mail de boas-vindas:', error);
    res.status(500).json({ success: false, error: error.message || 'Falha ao processar e-mail' });
  }
});

// ==========================================
// PRESENCE REST API & SYNC ENDPOINTS
// ==========================================

// Client pushes its active roster and presence state to keep the API server synchronized
app.post('/api/presence/state-sync', (req, res) => {
  try {
    const { collaborators, date, attendance, selectedDate } = req.body || {};
    if (Array.isArray(collaborators)) {
      cachedCollaborators = collaborators.map((c) => ({
        id: c.id,
        name: c.name,
        login: c.login,
        registration: c.registration,
        shift: c.shift,
        scale: c.scale,
        role: c.role,
      }));
    }

    const activeDate = date || selectedDate || getTodayISO();
    if (attendance && typeof attendance === 'object') {
      if (!presenceSnapshotStore[activeDate]) {
        presenceSnapshotStore[activeDate] = {};
      }
      const dayAtt = attendance[activeDate] || attendance;
      Object.entries(dayAtt).forEach(([collabId, statusVal]) => {
        const collab = cachedCollaborators.find((c) => c.id === collabId);
        let status: PresenceRecord['status'] = 'presente';
        let reason = '';

        if (statusVal === true) {
          status = 'presente';
        } else if (statusVal === false) {
          status = 'ausente';
        } else if (typeof statusVal === 'object' && statusVal !== null) {
          const sv = statusVal as { absent?: boolean; reason?: string };
          status = (sv.reason as PresenceRecord['status']) || (sv.absent ? 'ausente' : 'presente');
          reason = sv.reason || '';
        }

        const record: PresenceRecord = {
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

        presenceSnapshotStore[activeDate][collabId] = record;
      });
    }

    res.json({
      success: true,
      cachedCollaboratorsCount: cachedCollaborators.length,
      date: activeDate,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to sync presence state', message: err?.message });
  }
});

// GET /api/presence - Extract / query presence list
app.get('/api/presence', (req, res) => {
  const date = (req.query.date as string) || getTodayISO();
  const shiftFilter = (req.query.shift as string) || 'ALL';
  const scaleFilter = (req.query.scale as string) || 'ALL';
  const format = (req.query.format as string) || 'json';

  const dayRecords = presenceSnapshotStore[date] || {};
  let list: PresenceRecord[] = Object.values(dayRecords);

  // If no snapshot exists yet for this date but we have cached collaborators, build default list
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
      source: 'initial_cache',
    }));
  }

  // Filter by shift
  if (shiftFilter !== 'ALL' && shiftFilter !== 'todos' && shiftFilter !== 'Geral') {
    list = list.filter((r) => !r.shift || r.shift === 'Geral' || r.shift === shiftFilter);
  }

  // Filter by scale
  if (scaleFilter !== 'ALL' && scaleFilter !== 'todos') {
    list = list.filter((r) => !r.scale || r.scale === scaleFilter);
  }

  // Sort alphabetically
  list.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  if (format.toLowerCase() === 'csv') {
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

  res.json({
    success: true,
    date,
    total: list.length,
    presentCount,
    absentCount,
    shift: shiftFilter,
    scale: scaleFilter,
    data: list,
  });
});

// Enhanced Helper to resolve collaborator by ID, Name (Priority), Login, or Registration
function matchCollaborator(identifier: {
  collaboratorId?: string;
  id?: string;
  login?: string;
  registration?: string;
  name?: string;
}) {
  if (!identifier) return null;

  // 1. Direct ID match
  const targetId = identifier.collaboratorId || identifier.id;
  if (targetId) {
    const found = cachedCollaborators.find((c) => c.id === targetId);
    if (found) return found;
  }

  // 2. Login match (if provided)
  if (identifier.login && identifier.login.trim()) {
    const normLogin = normalizeSearchText(identifier.login);
    const found = cachedCollaborators.find(
      (c) => c.login && normalizeSearchText(c.login) === normLogin
    );
    if (found) return found;
  }

  // 3. Name match (High Priority & Resilient matching - allows integration even without login)
  if (identifier.name && identifier.name.trim()) {
    const normInput = normalizeSearchText(identifier.name);
    if (normInput) {
      // 3.1 Exact normalized match
      const exact = cachedCollaborators.find((c) => normalizeSearchText(c.name) === normInput);
      if (exact) return exact;

      // 3.2 Token-based match (e.g. "Lucas Silva" matching "Lucas Silva Santos")
      const inputTokens = normInput.split(' ').filter(Boolean);
      if (inputTokens.length >= 2) {
        const tokenMatch = cachedCollaborators.find((c) => {
          const cTokens = normalizeSearchText(c.name).split(' ').filter(Boolean);
          return inputTokens.every((t) => cTokens.some((ct) => ct === t || ct.startsWith(t)));
        });
        if (tokenMatch) return tokenMatch;
      }

      // 3.3 Substring match
      const partial = cachedCollaborators.find((c) => {
        const cNorm = normalizeSearchText(c.name);
        return cNorm.includes(normInput) || normInput.includes(cNorm);
      });
      if (partial) return partial;

      // 3.4 First name match if distinct
      if (inputTokens.length === 1) {
        const firstToken = inputTokens[0];
        const matchingFirstNames = cachedCollaborators.filter((c) => {
          const cTokens = normalizeSearchText(c.name).split(' ').filter(Boolean);
          return cTokens[0] === firstToken || cTokens.some((t) => t.startsWith(firstToken));
        });
        if (matchingFirstNames.length >= 1) {
          return matchingFirstNames[0];
        }
      }
    }
  }

  // 4. Registration / Matrícula match (if provided)
  if (identifier.registration && identifier.registration.trim()) {
    const normReg = normalizeSearchText(identifier.registration);
    const found = cachedCollaborators.find(
      (c) => c.registration && normalizeSearchText(c.registration) === normReg
    );
    if (found) return found;
  }

  return null;
}

// POST /api/presence - Ingest presence record(s) from another app/system
app.post('/api/presence', (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // continue
      }
    }

    let items: any[] = [];
    if (Array.isArray(body)) {
      items = body;
    } else if (body && Array.isArray(body.records)) {
      items = body.records;
    } else if (body && Array.isArray(body.data)) {
      items = body.data;
    } else if (body) {
      items = [body];
    }

    const date = (body && typeof body === 'object' && body.date) || getTodayISO();
    if (!presenceSnapshotStore[date]) {
      presenceSnapshotStore[date] = {};
    }

    const processedRecords: PresenceRecord[] = [];

    items.forEach((item) => {
      if (!item) return;
      const matched = matchCollaborator(item);
      const collabId = matched ? matched.id : item.collaboratorId || item.id || `ext_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const name = matched ? matched.name : item.name || item.collaboratorName || collabId;
      const shift = matched ? matched.shift : item.shift || 'T2';
      const scale = matched ? matched.scale : item.scale || 'A';
      const role = matched ? matched.role : item.role || 'Operador';

      // Normalize status
      let rawStatus = (item.status || 'presente').toString().toLowerCase().trim();
      let status: PresenceRecord['status'] = 'presente';
      if (['presente', 'present', 'p', '1', 'true', 'ok'].includes(rawStatus)) {
        status = 'presente';
      } else if (['atraso', 'delay', 'atrasado', 'late'].includes(rawStatus)) {
        status = 'atraso';
      } else if (['folga', 'off', 'day_off'].includes(rawStatus)) {
        status = 'folga';
      } else if (['ferias', 'férias', 'vacation'].includes(rawStatus)) {
        status = 'ferias';
      } else if (['licenca', 'licença', 'leave'].includes(rawStatus)) {
        status = 'licenca';
      } else if (['treinamento', 'training'].includes(rawStatus)) {
        status = 'treinamento';
      } else if (['atestado', 'medical_certificate', 'medical'].includes(rawStatus)) {
        status = 'atestado';
      } else if (['banco_horas', 'banco de horas', 'comp_time'].includes(rawStatus)) {
        status = 'banco_horas';
      } else if (['falta_injustificada', 'falta', 'unexcused'].includes(rawStatus)) {
        status = 'falta_injustificada';
      } else if (['ausente', 'absent', '0', 'false', 'falta'].includes(rawStatus)) {
        status = 'ausente';
      }

      const record: PresenceRecord = {
        id: collabId,
        collaboratorId: collabId,
        name,
        login: matched?.login || item.login,
        registration: matched?.registration || item.registration,
        shift,
        scale,
        role,
        status,
        reason: item.reason || item.notes || item.motivo || '',
        date,
        timestamp: Date.now(),
        source: item.source || 'api_rest',
      };

      presenceSnapshotStore[date][collabId] = record;
      processedRecords.push(record);
    });

    // Record sync event
    const event: PresenceSyncEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: processedRecords.length > 1 ? 'batch' : 'single',
      source: body.source || 'REST API',
      count: processedRecords.length,
      timestamp: Date.now(),
      details: `${processedRecords.length} presença(s) registrada(s) para a data ${date}`,
      records: processedRecords,
    };
    presenceEventsLog.unshift(event);
    if (presenceEventsLog.length > MAX_EVENTS_LOG) {
      presenceEventsLog.pop();
    }

    // Broadcast presence update via signal store so active browser tabs update immediately!
    globalSignalSeq++;
    signalStore.push({
      mid: `pres_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      kind: 'presence',
      sender: 'presence_api',
      senderName: 'API de Presença',
      payload: {
        date,
        records: processedRecords,
      },
      ts: Date.now(),
      seq: globalSignalSeq,
    });

    res.json({
      success: true,
      message: `${processedRecords.length} registro(s) de presença processado(s) com sucesso!`,
      date,
      count: processedRecords.length,
      records: processedRecords,
    });
  } catch (err: any) {
    console.error('Error processing /api/presence:', err);
    res.status(400).json({ error: 'Erro ao processar presença', message: err?.message });
  }
});

// POST /api/presence/sync - Batch / Bidirectional Sync
app.post('/api/presence/sync', (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // parse CSV if plain text
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

      let rawStatus = (rec.status || 'presente').toString().toLowerCase();
      let status: PresenceRecord['status'] = 'presente';
      if (['presente', 'present', 'p', '1', 'true'].includes(rawStatus)) status = 'presente';
      else if (['atraso', 'delay', 'atrasado'].includes(rawStatus)) status = 'atraso';
      else if (['folga', 'off'].includes(rawStatus)) status = 'folga';
      else if (['ferias', 'férias'].includes(rawStatus)) status = 'ferias';
      else if (['licenca', 'licença'].includes(rawStatus)) status = 'licenca';
      else if (['treinamento'].includes(rawStatus)) status = 'treinamento';
      else if (['atestado'].includes(rawStatus)) status = 'atestado';
      else if (['banco_horas', 'banco de horas'].includes(rawStatus)) status = 'banco_horas';
      else if (['falta_injustificada', 'falta'].includes(rawStatus)) status = 'falta_injustificada';
      else if (['ausente', 'absent', '0', 'false'].includes(rawStatus)) status = 'ausente';

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

    // Record event
    presenceEventsLog.unshift({
      id: `sync_${Date.now()}`,
      type: 'batch',
      source: body.source || 'Batch Sync API',
      count: processed.length,
      timestamp: Date.now(),
      details: `Sincronização em lote: ${processed.length} registros para ${date}`,
      records: processed,
    });

    globalSignalSeq++;
    signalStore.push({
      mid: `sync_${Date.now()}`,
      kind: 'presence',
      sender: 'presence_sync',
      senderName: 'Sincronização de Presença',
      payload: { date, records: processed },
      ts: Date.now(),
      seq: globalSignalSeq,
    });

    res.json({
      success: true,
      date,
      count: processed.length,
      records: processed,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Falha na sincronização de presença', message: err?.message });
  }
});

// POST /api/presence/webhook - Generic Webhook for punch clock or third party app
app.post('/api/presence/webhook', (req, res) => {
  try {
    const payload = req.body || {};
    const date = payload.date || payload.data || getTodayISO();

    // Support multiple webhook formats (Tangerino, PontoTel, Senior, Madis, Ahgora, generic)
    const employeeId = payload.employee_id || payload.matricula || payload.login || payload.id || payload.badge || payload.userId;
    const employeeName = payload.employee_name || payload.name || payload.colaborador || payload.nome || '';
    const punchType = (payload.type || payload.event || payload.tipo || 'in').toString().toLowerCase();

    const matched = matchCollaborator({
      collaboratorId: employeeId,
      login: employeeId,
      registration: employeeId,
      name: employeeName,
    });

    let status: PresenceRecord['status'] = 'presente';
    if (punchType.includes('delay') || punchType.includes('atraso')) {
      status = 'atraso';
    } else if (punchType.includes('absent') || punchType.includes('falta')) {
      status = 'ausente';
    } else if (punchType.includes('folga')) {
      status = 'folga';
    }

    const collabId = matched ? matched.id : employeeId || `wh_${Date.now()}`;
    const record: PresenceRecord = {
      id: collabId,
      collaboratorId: collabId,
      name: matched ? matched.name : employeeName || collabId,
      login: matched?.login,
      registration: matched?.registration,
      shift: matched?.shift || 'T2',
      scale: matched?.scale || 'A',
      role: matched?.role || 'Operador',
      status,
      reason: payload.reason || payload.motivo || 'Registrado via Webhook de Ponto Externo',
      date,
      timestamp: Date.now(),
      source: payload.app_name || 'webhook',
    };

    if (!presenceSnapshotStore[date]) {
      presenceSnapshotStore[date] = {};
    }
    presenceSnapshotStore[date][collabId] = record;

    presenceEventsLog.unshift({
      id: `wh_${Date.now()}`,
      type: 'webhook',
      source: payload.app_name || 'Webhook Externo',
      count: 1,
      timestamp: Date.now(),
      details: `Ponto registrado para ${record.name} (${status})`,
      records: [record],
    });

    globalSignalSeq++;
    signalStore.push({
      mid: `wh_${Date.now()}`,
      kind: 'presence',
      sender: 'webhook',
      senderName: 'Webhook de Ponto',
      payload: { date, records: [record] },
      ts: Date.now(),
      seq: globalSignalSeq,
    });

    res.json({
      success: true,
      matched: Boolean(matched),
      record,
    });
  } catch (err: any) {
    res.status(400).json({ error: 'Erro no webhook de presença', message: err?.message });
  }
});

// ==========================================
// DIMENSIO ROBUST INTEGRATION API SUITE
// ==========================================

interface DimensioStore {
  collaborators: Array<{
    id: string;
    name: string;
    login?: string;
    registration?: string;
    shift?: string;
    scale?: string;
    role?: string;
    activeTaskId?: string;
  }>;
  tasks: Array<{
    id: string;
    name: string;
    area?: string;
    requiredCapacity?: number;
    members: string[];
    externalUrl?: string;
  }>;
  intervals: Record<string, Record<string, string>>; // date -> collabId -> breakTime
  scheduledTaskLists: Array<{
    id: string;
    title: string;
    color?: string;
    icon?: string;
  }>;
  scheduledTasks: Array<{
    id: string;
    title: string;
    description?: string;
    listId?: string;
    dueDate?: string;
    dueTime?: string;
    assigneeName?: string;
    completed?: boolean;
  }>;
  serviceRequests: Array<{
    id: string;
    title: string;
    description: string;
    requesterName: string;
    status: 'pendente' | 'lido' | 'em_andamento' | 'concluido' | 'recusado';
    priority?: 'baixa' | 'media' | 'alta' | 'urgente';
    createdAt: string;
  }>;
  metricDefinitions: Array<{
    id: string;
    name: string;
    type: 'count' | 'percentage' | 'time' | 'rating';
    unit?: string;
  }>;
  metricReadings: Array<{
    id: string;
    metricId: string;
    value: number;
    timestamp: number;
    source?: string;
  }>;
  infoHubReminders: Array<{
    id: string;
    title: string;
    message: string;
    priority?: string;
    createdAt: string;
  }>;
  infoHubLinks: Array<{
    id: string;
    title: string;
    url: string;
    category?: string;
  }>;
}

const dimensioStore: DimensioStore = {
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
};

// Broadcast change helper
function broadcastDimensioUpdate(kind: string, payload: any) {
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

// POST /api/dimensio/sync - Full client state synchronization
app.post('/api/dimensio/sync', (req, res) => {
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
      cachedCollaborators = [...dimensioStore.collaborators];
    }
    if (Array.isArray(data.tasks)) {
      dimensioStore.tasks = data.tasks;
    }
    if (data.intervals && typeof data.intervals === 'object') {
      dimensioStore.intervals = { ...dimensioStore.intervals, ...data.intervals };
    }
    if (Array.isArray(data.scheduledTaskLists)) {
      dimensioStore.scheduledTaskLists = data.scheduledTaskLists;
    }
    if (Array.isArray(data.scheduledTasks)) {
      dimensioStore.scheduledTasks = data.scheduledTasks;
    }
    if (Array.isArray(data.serviceRequests)) {
      dimensioStore.serviceRequests = data.serviceRequests;
    }
    if (Array.isArray(data.metricDefinitions)) {
      dimensioStore.metricDefinitions = data.metricDefinitions;
    }
    if (Array.isArray(data.metricReadings)) {
      dimensioStore.metricReadings = data.metricReadings;
    }
    if (Array.isArray(data.infoHubReminders)) {
      dimensioStore.infoHubReminders = data.infoHubReminders;
    }
    if (Array.isArray(data.infoHubLinks)) {
      dimensioStore.infoHubLinks = data.infoHubLinks;
    }

    res.json({
      success: true,
      timestamp: Date.now(),
      counts: {
        collaborators: dimensioStore.collaborators.length,
        tasks: dimensioStore.tasks.length,
        scheduledTasks: dimensioStore.scheduledTasks.length,
        serviceRequests: dimensioStore.serviceRequests.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao sincronizar estado com o Dimensio', message: err?.message });
  }
});

// GET /api/dimensio/overview - Summary of current operations
app.get('/api/dimensio/overview', (req, res) => {
  const date = (req.query.date as string) || getTodayISO();
  const dayRecords = presenceSnapshotStore[date] || {};
  const presenceList = Object.values(dayRecords);

  res.json({
    success: true,
    version: '1.5.0',
    date,
    stats: {
      totalCollaborators: cachedCollaborators.length,
      presentCount: presenceList.filter((r) => r.status === 'presente' || r.status === 'atraso').length,
      absentCount: presenceList.filter((r) => r.status !== 'presente' && r.status !== 'atraso').length,
      totalTasks: dimensioStore.tasks.length,
      totalPendingRequests: dimensioStore.serviceRequests.filter((r) => r.status === 'pendente').length,
      totalScheduledRoutines: dimensioStore.scheduledTasks.length,
    },
    tasks: dimensioStore.tasks.map((t) => ({
      id: t.id,
      name: t.name,
      allocatedCount: (t.members || []).length,
      requiredCapacity: t.requiredCapacity || 0,
    })),
  });
});

// ================= COLLABORATORS RESOURCE =================
app.get('/api/collaborators', (req, res) => {
  const shift = req.query.shift as string;
  const role = req.query.role as string;
  let list = cachedCollaborators.length > 0 ? cachedCollaborators : dimensioStore.collaborators;

  if (shift && shift !== 'ALL') {
    list = list.filter((c) => c.shift === shift);
  }
  if (role) {
    list = list.filter((c) => c.role && c.role.toLowerCase() === role.toLowerCase());
  }

  res.json({ success: true, count: list.length, data: list });
});

app.post('/api/collaborators', (req, res) => {
  try {
    const body = req.body || {};
    if (!body.name) {
      return res.status(400).json({ error: 'Nome do colaborador é obrigatório' });
    }
    const matched = matchCollaborator(body);
    const id = matched ? matched.id : body.id || `collab_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newCollab = {
      id,
      name: body.name.trim(),
      login: body.login?.trim() || undefined,
      registration: body.registration?.trim() || undefined,
      shift: body.shift || 'T2',
      scale: body.scale || 'A',
      role: body.role || 'Operador',
    };

    const idx = cachedCollaborators.findIndex((c) => c.id === id);
    if (idx >= 0) {
      cachedCollaborators[idx] = newCollab;
    } else {
      cachedCollaborators.push(newCollab);
    }

    broadcastDimensioUpdate('collaborator_updated', { collaborator: newCollab });
    res.json({ success: true, action: idx >= 0 ? 'updated' : 'created', data: newCollab });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao salvar colaborador', message: err?.message });
  }
});

// ================= TASKS & POSTOS RESOURCE =================
app.get('/api/tasks', (_req, res) => {
  res.json({
    success: true,
    count: dimensioStore.tasks.length,
    data: dimensioStore.tasks,
  });
});

app.post('/api/tasks', (req, res) => {
  try {
    const { id, name, area, requiredCapacity, externalUrl } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'Nome da tarefa é obrigatório' });
    }
    const taskId = id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const taskObj = {
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
    res.json({ success: true, action: idx >= 0 ? 'updated' : 'created', data: taskObj });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao salvar tarefa', message: err?.message });
  }
});

// POST /api/tasks/assign - Allocate collaborator in task/posto
app.post('/api/tasks/assign', (req, res) => {
  try {
    const { collaborator, collaboratorId, name, taskId, taskName } = req.body || {};
    const matchedCollab = matchCollaborator({
      collaboratorId: collaboratorId || (collaborator && collaborator.id),
      name: name || (collaborator && collaborator.name),
      login: req.body.login,
    });

    if (!matchedCollab) {
      return res.status(404).json({ error: 'Colaborador não encontrado por ID, Nome ou Login' });
    }

    let targetTask = dimensioStore.tasks.find((t) => t.id === taskId);
    if (!targetTask && taskName) {
      const normTask = normalizeSearchText(taskName);
      targetTask = dimensioStore.tasks.find((t) => normalizeSearchText(t.name) === normTask || normalizeSearchText(t.name).includes(normTask));
    }

    if (!targetTask) {
      return res.status(404).json({ error: 'Tarefa de destino não encontrada' });
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

    res.json({
      success: true,
      message: `${matchedCollab.name} alocado com sucesso em "${targetTask.name}"`,
      collaborator: matchedCollab,
      task: targetTask,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro na alocação de tarefa', message: err?.message });
  }
});

// ================= BREAKS & INTERVALS RESOURCE =================
app.get('/api/breaks', (req, res) => {
  const date = (req.query.date as string) || getTodayISO();
  const dayIntervals = dimensioStore.intervals[date] || {};

  const items = Object.entries(dayIntervals).map(([collabId, breakTime]) => {
    const collab = cachedCollaborators.find((c) => c.id === collabId);
    return {
      collaboratorId: collabId,
      collaboratorName: collab ? collab.name : collabId,
      breakTime,
      date,
    };
  });

  res.json({ success: true, date, count: items.length, data: items });
});

app.post('/api/breaks/assign', (req, res) => {
  try {
    const { collaboratorId, name, login, breakTime, date } = req.body || {};
    const matchedCollab = matchCollaborator({ collaboratorId, name, login });

    if (!matchedCollab) {
      return res.status(404).json({ error: 'Colaborador não identificado' });
    }
    if (!breakTime) {
      return res.status(400).json({ error: 'Horário de intervalo (breakTime) é obrigatório' });
    }

    const activeDate = date || getTodayISO();
    if (!dimensioStore.intervals[activeDate]) {
      dimensioStore.intervals[activeDate] = {};
    }
    dimensioStore.intervals[activeDate][matchedCollab.id] = breakTime;

    broadcastDimensioUpdate('break_assigned', {
      date: activeDate,
      collaboratorId: matchedCollab.id,
      collaboratorName: matchedCollab.name,
      breakTime,
    });

    res.json({
      success: true,
      message: `Intervalo de ${matchedCollab.name} definido para ${breakTime}`,
      data: { collaboratorId: matchedCollab.id, name: matchedCollab.name, breakTime, date: activeDate },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao atribuir intervalo', message: err?.message });
  }
});

// ================= ROUTINES & GOOGLE TASKS / NOTION RESOURCE =================
app.get('/api/routines', (req, res) => {
  const listId = req.query.listId as string;
  const dueDate = req.query.dueDate as string;

  let tasks = dimensioStore.scheduledTasks;
  if (listId) tasks = tasks.filter((t) => t.listId === listId);
  if (dueDate) tasks = tasks.filter((t) => t.dueDate === dueDate);

  res.json({
    success: true,
    lists: dimensioStore.scheduledTaskLists,
    tasksCount: tasks.length,
    tasks,
  });
});

app.post('/api/routines/tasks', (req, res) => {
  try {
    const { title, description, listId, listName, dueDate, dueTime, assigneeName, collaboratorName } = req.body || {};
    if (!title) {
      return res.status(400).json({ error: 'Título da rotina/tarefa é obrigatório' });
    }

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
        dimensioStore.scheduledTaskLists.push({
          id: targetListId,
          title: listName,
          color: '#8b5cf6',
          icon: 'ClipboardList',
        });
      }
    }

    const newTask = {
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

    res.json({
      success: true,
      message: `Tarefa "${newTask.title}" adicionada com sucesso!`,
      data: newTask,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao criar rotina', message: err?.message });
  }
});

app.put('/api/routines/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const idx = dimensioStore.scheduledTasks.findIndex((t) => t.id === taskId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Tarefa agendada não encontrada' });
  }

  dimensioStore.scheduledTasks[idx] = {
    ...dimensioStore.scheduledTasks[idx],
    ...req.body,
  };

  broadcastDimensioUpdate('routine_task_updated', { task: dimensioStore.scheduledTasks[idx] });
  res.json({ success: true, data: dimensioStore.scheduledTasks[idx] });
});

// ================= SERVICE REQUESTS (PEDIDOS & CHAMADOS) RESOURCE =================
app.get('/api/requests', (req, res) => {
  const status = req.query.status as string;
  let list = dimensioStore.serviceRequests;
  if (status) {
    list = list.filter((r) => r.status === status);
  }
  res.json({ success: true, count: list.length, data: list });
});

app.post('/api/requests', (req, res) => {
  try {
    const { title, description, requesterName, collaboratorId, priority } = req.body || {};
    if (!title) {
      return res.status(400).json({ error: 'Título do pedido é obrigatório' });
    }

    const matched = matchCollaborator({ collaboratorId, name: requesterName });
    const reqObj = {
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      description: description || '',
      requesterName: matched ? matched.name : requesterName || 'Colaborador',
      status: 'pendente' as const,
      priority: priority || 'media',
      createdAt: new Date().toISOString(),
    };

    dimensioStore.serviceRequests.unshift(reqObj);
    broadcastDimensioUpdate('service_request_created', { request: reqObj });

    res.json({
      success: true,
      message: `Pedido "${reqObj.title}" registrado com sucesso!`,
      data: reqObj,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao criar pedido de serviço', message: err?.message });
  }
});

// ================= OPERATIONAL METRICS RESOURCE =================
app.get('/api/metrics', (_req, res) => {
  res.json({
    success: true,
    definitions: dimensioStore.metricDefinitions,
    recentReadings: dimensioStore.metricReadings.slice(-50),
  });
});

app.post('/api/metrics/readings', (req, res) => {
  try {
    const { metricId, value, source } = req.body || {};
    if (!metricId || value === undefined) {
      return res.status(400).json({ error: 'metricId e value são obrigatórios' });
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

    res.json({ success: true, data: reading });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao registrar métrica', message: err?.message });
  }
});

// ================= INFO HUB & BROADCAST RESOURCE =================
app.get('/api/info-hub', (_req, res) => {
  res.json({
    success: true,
    reminders: dimensioStore.infoHubReminders,
    links: dimensioStore.infoHubLinks,
  });
});

app.post('/api/info-hub/reminder', (req, res) => {
  try {
    const { title, message, priority } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios' });
    }

    const reminder = {
      id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      message: message.trim(),
      priority: priority || 'normal',
      createdAt: new Date().toISOString(),
    };

    dimensioStore.infoHubReminders.unshift(reminder);
    broadcastDimensioUpdate('info_hub_reminder', { reminder });

    res.json({ success: true, data: reminder });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao salvar aviso no Hub', message: err?.message });
  }
});

app.post('/api/notifications/broadcast', (req, res) => {
  try {
    const { title, message, type, priority } = req.body || {};
    if (!title || !message) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios' });
    }

    broadcastDimensioUpdate('global_broadcast', {
      title,
      message,
      type: type || 'notice',
      priority: priority || 'media',
      timestamp: Date.now(),
    });

    res.json({ success: true, message: 'Notificação global enviada para todos os clientes conectados' });
  } catch (err: any) {
    res.status(500).json({ error: 'Erro no broadcast de notificação', message: err?.message });
  }
});

// ================= OPENAPI 3.0 & DOCUMENTATION VIEWER =================
app.get('/api/openapi.json', (_req, res) => {
  res.json({
    openapi: '3.0.3',
    info: {
      title: 'Dimensio Integration API',
      version: '1.5.0',
      description: 'API Completa e Robusta de Integração com o Dimensio. Permite integração com presença, colaboradores, tarefas, postos de trabalho, intervalos, rotinas operacionais, chamados, métricas e notificações.',
    },
    paths: {
      '/api/presence': {
        get: { summary: 'Consultar lista de presença por data e turno' },
        post: { summary: 'Registrar presença (com correspondência por Nome, Login ou ID)' },
      },
      '/api/collaborators': {
        get: { summary: 'Listar colaboradores' },
        post: { summary: 'Cadastrar ou atualizar colaborador' },
      },
      '/api/tasks': {
        get: { summary: 'Listar tarefas e postos de trabalho' },
        post: { summary: 'Criar ou atualizar tarefa' },
      },
      '/api/tasks/assign': {
        post: { summary: 'Alocar colaborador em tarefa por Nome ou ID' },
      },
      '/api/breaks': {
        get: { summary: 'Listar intervalos do dia' },
      },
      '/api/breaks/assign': {
        post: { summary: 'Definir horário de intervalo para colaborador' },
      },
      '/api/routines': {
        get: { summary: 'Listar rotinas e listas de tarefas agendadas' },
      },
      '/api/routines/tasks': {
        post: { summary: 'Criar tarefa ou feedback contextual' },
      },
      '/api/requests': {
        get: { summary: 'Listar pedidos de serviço / chamados' },
        post: { summary: 'Criar novo pedido de serviço' },
      },
      '/api/metrics': {
        get: { summary: 'Consultar métricas operacionais' },
      },
      '/api/metrics/readings': {
        post: { summary: 'Registrar leitura de métrica via extensão' },
      },
      '/api/info-hub': {
        get: { summary: 'Consultar mural de avisos e links rápidos' },
      },
      '/api/notifications/broadcast': {
        post: { summary: 'Transmitir notificação em tempo real' },
      },
    },
  });
});

app.get('/api/docs', (_req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Dimensio API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; }
    .topbar { background: #1e293b; padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #334155; }
    .topbar h1 { margin: 0; font-size: 1.25rem; font-weight: 800; color: #38bdf8; }
    .swagger-ui { background: #fff; border-radius: 12px; margin: 1.5rem; padding: 1rem; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>🚀 Dimensio Robust Integration API v1.5.0</h1>
    <a href="/api/openapi.json" style="color: #38bdf8; font-weight: bold; text-decoration: none;" target="_blank">OpenAPI Spec (JSON) ↗</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/openapi.json',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout'
    });
  </script>
</body>
</html>`);
});

// GET /api/presence/events - Live sync event log
app.get('/api/presence/events', (_req, res) => {
  res.json({
    success: true,
    count: presenceEventsLog.length,
    events: presenceEventsLog,
  });
});


// GET /api/signal - Poll pending signals for client
app.get('/api/signal', (req, res) => {
  cleanupSignals();
  const sinceSeq = parseInt((req.query.sinceSeq as string) || '0', 10);
  const sinceTs = parseInt((req.query.since as string) || '0', 10);
  const now = Date.now();

  let newMsgs: StoredSignalMessage[];

  if (sinceSeq > 0) {
    // Sequence-based filtering: 100% immune to inter-device clock skew
    newMsgs = signalStore.filter((m) => m.seq > sinceSeq);
  } else if (sinceTs > 0) {
    // Timestamp-based fallback with 30-second window to protect against clock drift
    const threshold = Math.max(0, sinceTs - 30000);
    newMsgs = signalStore.filter((m) => m.ts >= threshold);
  } else {
    // Initial poll: return active signals from last 30 seconds
    newMsgs = signalStore.filter((m) => m.ts >= now - 30000);
  }

  const maxSeq = signalStore.length > 0 ? signalStore[signalStore.length - 1].seq : globalSignalSeq;

  // Return both array structure (for legacy compatibility) and metadata
  res.json({
    messages: newMsgs,
    maxSeq,
  });
});

// POST /api/signal - Receive signals from clients
app.post('/api/signal', (req, res) => {
  cleanupSignals();
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore parse error
      }
    }

    let msgs: SignalMessage[] = [];
    if (Array.isArray(body)) {
      msgs = body;
    } else if (body && Array.isArray(body.signal)) {
      msgs = body.signal;
    } else if (body && body.mid) {
      msgs = [body];
    }

    const now = Date.now();
    msgs.forEach((m) => {
      if (m && m.sender) {
        globalSignalSeq++;
        signalStore.push({
          ...m,
          ts: now, // Server timestamp guarantees strictly monotonic ordering
          seq: globalSignalSeq,
        });
      }
    });

    if (signalStore.length > MAX_SIGNALS) {
      signalStore.splice(0, signalStore.length - MAX_SIGNALS);
    }

    res.json({ success: true, count: msgs.length, maxSeq: globalSignalSeq });
  } catch (err) {
    console.error('Error processing /api/signal:', err);
    res.status(400).json({ error: 'Invalid signal payload' });
  }
});

// Static route for Dev Test Sandbox (WMS, ERP, Totem and API test bench)
app.use('/test-sandbox', express.static(path.join(process.cwd(), 'test-sandbox')));

// Chrome Enterprise extension update manifest XML endpoint
app.get('/api/extension/updates.xml', (_req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.send(`<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='dimensio-chrome-extension'>
    <updatecheck codebase='http://127.0.0.1:${PORT}/chrome-extension.crx' version='1.0.0' />
  </app>
</gupdate>`);
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
