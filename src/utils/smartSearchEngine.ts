import { AppState, Collaborator, ScheduledTask, ScheduledTaskList, Task, BreakSlot } from '../types';
import { normalizeSearchText, formatDateBR, getTodayISO } from './helpers';

export type SmartActionType =
  | 'scheduled_task_feedback'
  | 'scheduled_task_custom'
  | 'allocate_task'
  | 'unassign_task'
  | 'assign_break'
  | 'rotate_breaks'
  | 'set_absence'
  | 'set_presence'
  | 'create_request'
  | 'create_notice'
  | 'auto_assign';

export interface SmartActionContext {
  state: AppState;
  identifiedUser?: Collaborator | { id: string; name: string; role?: string; shift?: string; category?: string } | null;
}

export interface ParsedSmartAction {
  isCommand: boolean;
  actionType: SmartActionType;
  rawInput: string;
  badgeLabel: string;
  badgeTone: 'primary' | 'success' | 'warning' | 'purple' | 'info';
  title: string;
  description: string;
  explanation: string;
  contextType: 'existing_list' | 'new_list' | 'direct_execution';
  params: {
    collaborator?: Collaborator;
    collaboratorName?: string;
    targetDate?: string;
    formattedDate?: string;
    listId?: string;
    listName?: string;
    taskTitle?: string;
    task?: Task;
    taskName?: string;
    breakSlot?: BreakSlot;
    slotTime?: string;
    absenceReason?: string;
    absenceType?: string;
    requestTitle?: string;
    noticeText?: string;
    shift?: string;
  };
  execute: (actions: any) => { success: boolean; message: string };
}

/**
 * Intelligent helper to parse natural dates in pt-BR:
 * - "16/09", "16/09/2026", "16-09"
 * - "hoje", "amanha", "amanhã", "depois de amanha"
 * - "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingo"
 */
export function parseNaturalDateBR(dateStr: string, baseYear = new Date().getFullYear()): { isoDate: string; formattedBR: string } | null {
  if (!dateStr) return null;
  const norm = normalizeSearchText(dateStr);

  const today = new Date();
  const currentYear = baseYear || today.getFullYear();

  // "hoje"
  if (norm === 'hoje') {
    const iso = getTodayISO();
    return { isoDate: iso, formattedBR: formatDateBR(iso) };
  }

  // "amanha"
  if (norm === 'amanha') {
    const tm = new Date();
    tm.setDate(tm.getDate() + 1);
    const y = tm.getFullYear();
    const m = String(tm.getMonth() + 1).padStart(2, '0');
    const d = String(tm.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    return { isoDate: iso, formattedBR: formatDateBR(iso) };
  }

  // "depois de amanha"
  if (norm.includes('depois de amanha')) {
    const tm = new Date();
    tm.setDate(tm.getDate() + 2);
    const y = tm.getFullYear();
    const m = String(tm.getMonth() + 1).padStart(2, '0');
    const d = String(tm.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}`;
    return { isoDate: iso, formattedBR: formatDateBR(iso) };
  }

  // Explicit DD/MM or DD/MM/YYYY
  const dateMatch = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : currentYear;
    if (year < 100) year += 2000;

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { isoDate: iso, formattedBR: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` };
    }
  }

  return null;
}

/**
 * Intelligent Collaborator Finder with Fuzzy and Partial Matching
 */
export function findBestMatchingCollaborator(nameOrTerm: string, collaborators: Collaborator[]): Collaborator | null {
  if (!nameOrTerm || !collaborators.length) return null;
  const termNorm = normalizeSearchText(nameOrTerm);
  if (!termNorm) return null;

  // 1. Exact match on normalized name
  const exact = collaborators.find((c) => normalizeSearchText(c.name) === termNorm);
  if (exact) return exact;

  // 2. Exact match on Login or Registration
  const exactLogin = collaborators.find(
    (c) => (c.login && normalizeSearchText(c.login) === termNorm) || (c.registration && normalizeSearchText(c.registration) === termNorm)
  );
  if (exactLogin) return exactLogin;

  // 3. Name starts with term or term starts with name
  const startsWith = collaborators.find((c) => {
    const cNorm = normalizeSearchText(c.name);
    return cNorm.startsWith(termNorm) || termNorm.startsWith(cNorm);
  });
  if (startsWith) return startsWith;

  // 4. Token-level match (e.g. "Lucas" matches "Lucas Silva", "Silva" matches "Lucas Silva")
  const tokens = termNorm.split(' ').filter((t) => t.length >= 3);
  if (tokens.length > 0) {
    const tokenMatch = collaborators.find((c) => {
      const cNorm = normalizeSearchText(c.name);
      return tokens.every((tok) => cNorm.includes(tok));
    });
    if (tokenMatch) return tokenMatch;
  }

  // 5. Partial contains match
  const partial = collaborators.find((c) => {
    const cNorm = normalizeSearchText(c.name);
    return cNorm.includes(termNorm) || termNorm.includes(cNorm);
  });
  return partial || null;
}

/**
 * Intelligent Task Finder
 */
export function findBestMatchingTask(taskTerm: string, tasks: Task[]): Task | null {
  if (!taskTerm || !tasks.length) return null;
  const termNorm = normalizeSearchText(taskTerm);
  if (!termNorm) return null;

  // 1. Exact name match
  const exact = tasks.find((t) => normalizeSearchText(t.name) === termNorm);
  if (exact) return exact;

  // 2. Starts with / includes
  const contains = tasks.find((t) => {
    const tNorm = normalizeSearchText(t.name);
    return tNorm.includes(termNorm) || termNorm.includes(tNorm);
  });
  return contains || null;
}

/**
 * Parses user input in Global Search and returns an intelligent executable smart action if applicable.
 */
export function parseSmartSearchAction(rawInput: string, ctx: SmartActionContext): ParsedSmartAction | null {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length < 3) return null;

  const { state, identifiedUser } = ctx;
  const collaborators = state.collaborators || [];
  const tasks = state.tasks || [];
  const breaks = state.breaks || [];
  const scheduledLists = state.scheduledTaskLists || [];
  const scheduledTasks = state.scheduledTasks || [];

  const isExplicitCommand = trimmed.startsWith('/');
  const cleanInput = trimmed.replace(/^\//, '').trim();
  const norm = normalizeSearchText(cleanInput);

  // =========================================================================
  // SCENARIO 1: TASK / FEEDBACK / AGENDAMENTO COMMANDS
  // E.g.:
  // - "/nova tarefa: adicionar "nome" na lista de feedback do dia 16/09"
  // - "adicionar lucas na lista de feedback do dia 16/09"
  // - "/tarefa feedback com João Silva 16/09"
  // - "/feedback Mariana 20/09"
  // =========================================================================
  const isFeedbackOrTaskRegex =
    /^(?:nova\s+tarefa|tarefa|adicionar|agendar|feedback|novo\s+feedback|rotina)\b/i.test(cleanInput) ||
    norm.includes('lista de feedback') ||
    norm.includes('agendamento') ||
    norm.includes('na lista');

  if (isFeedbackOrTaskRegex) {
    // 1. Extract quoted name or inferred name
    let extractedCollabName = '';
    const quoteMatch = cleanInput.match(/["'“]([^"'”]+)["'”]/);
    if (quoteMatch) {
      extractedCollabName = quoteMatch[1].trim();
    }

    // 2. Extract date
    let dateExtracted = parseNaturalDateBR(cleanInput);
    if (!dateExtracted) {
      const dateInTextMatch = cleanInput.match(/(?:dia|data|em|para)\s+(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?|hoje|amanh[aã])/i);
      if (dateInTextMatch) {
        dateExtracted = parseNaturalDateBR(dateInTextMatch[1]);
      }
    }
    const targetDate = dateExtracted?.isoDate || state.selectedDate || getTodayISO();
    const formattedDate = dateExtracted?.formattedBR || formatDateBR(targetDate);

    // 3. Extract list context / keyword
    const isFeedbackContext =
      norm.includes('feedback') ||
      norm.includes('feedbacks') ||
      norm.includes('desempenho') ||
      norm.includes('1on1') ||
      norm.includes('one on one');

    // If no quoted name, try to match collaborator name from text tokens
    let matchedCollab = extractedCollabName ? findBestMatchingCollaborator(extractedCollabName, collaborators) : null;

    if (!matchedCollab) {
      // Look for collaborator names present in the input text
      for (const c of collaborators) {
        const cNorm = normalizeSearchText(c.name);
        if (cNorm && norm.includes(cNorm)) {
          matchedCollab = c;
          extractedCollabName = c.name;
          break;
        }
      }
      if (!matchedCollab) {
        // Match first name or tokens
        for (const c of collaborators) {
          const firstName = normalizeSearchText(c.name.split(' ')[0]);
          if (firstName && firstName.length >= 3 && new RegExp(`\\b${firstName}\\b`, 'i').test(norm)) {
            matchedCollab = c;
            extractedCollabName = c.name;
            break;
          }
        }
      }
    }

    const effectiveCollabName = matchedCollab ? matchedCollab.name : extractedCollabName || 'Colaborador';

    // 4. Check if there's an existing feedback list or scheduled task list
    const existingFeedbackList = scheduledLists.find((l) => {
      const lNorm = normalizeSearchText(l.name);
      return lNorm.includes('feedback') || lNorm.includes('agendamento') || lNorm.includes('1on1');
    });

    // Check if there is an existing task with feedback on that date or list
    const existingFeedbackTask = scheduledTasks.find((t) => {
      const tNorm = normalizeSearchText(t.title);
      return (tNorm.includes('feedback') || t.listId === existingFeedbackList?.id) && (!t.dueDate || t.dueDate === targetDate);
    });

    if (isFeedbackContext || existingFeedbackList) {
      const listName = existingFeedbackList ? existingFeedbackList.name : 'Agendamentos de Feedback';
      const isExisting = Boolean(existingFeedbackList);

      return {
        isCommand: true,
        actionType: 'scheduled_task_feedback',
        rawInput,
        badgeLabel: isExisting ? 'Adicionar à Lista Existente' : 'Criar Nova Lista & Agendamento',
        badgeTone: isExisting ? 'success' : 'purple',
        title: isExisting
          ? `Adicionar "${effectiveCollabName}" na lista "${listName}" (${formattedDate})`
          : `Criar lista "${listName}" e agendar feedback de "${effectiveCollabName}" (${formattedDate})`,
        description: isExisting
          ? `O sistema detectou a lista existente "${listName}". Um item de feedback com ${effectiveCollabName} será agendado para o dia ${formattedDate}.`
          : `Não foi encontrada uma lista de feedback prévia. Uma nova lista chamada "${listName}" será criada automaticamente com o feedback de ${effectiveCollabName} para ${formattedDate}.`,
        explanation: `Ação inteligente: ${isExisting ? 'Vincular à lista existente' : 'Criar lista & tarefa'} • Data: ${formattedDate} • Colaborador: ${effectiveCollabName}`,
        contextType: isExisting ? 'existing_list' : 'new_list',
        params: {
          collaborator: matchedCollab || undefined,
          collaboratorName: effectiveCollabName,
          targetDate,
          formattedDate,
          listId: existingFeedbackList?.id,
          listName,
          taskTitle: `Feedback individual: ${effectiveCollabName}`,
        },
        execute: (actions) => {
          let listIdToUse = existingFeedbackList?.id;
          if (!listIdToUse) {
            const newList = actions.addScheduledTaskList({
              name: listName,
              color: '#8b5cf6',
              icon: 'message-square',
            });
            listIdToUse = newList.id;
          }

          // If there is an existing parent feedback task for that date, add as subtask; otherwise create scheduled task
          if (existingFeedbackTask && existingFeedbackTask.listId === listIdToUse) {
            const updatedSubtasks = [
              ...(existingFeedbackTask.subtasks || []),
              {
                id: `sub_${Date.now()}`,
                title: `Feedback com ${effectiveCollabName}`,
                completed: false,
                assignedTo: matchedCollab ? matchedCollab.id : undefined,
              },
            ];
            actions.updateScheduledTask(existingFeedbackTask.id, {
              subtasks: updatedSubtasks,
            });
            return {
              success: true,
              message: `Feedback com ${effectiveCollabName} adicionado à tarefa "${existingFeedbackTask.title}" para ${formattedDate}!`,
            };
          } else {
            actions.addScheduledTask({
              title: `Feedback: ${effectiveCollabName}`,
              description: `Sessão de feedback e alinhamento operacional agendada para ${formattedDate}.`,
              listId: listIdToUse,
              dueDate: targetDate,
              priority: 'media',
              assignedTo: matchedCollab ? [matchedCollab.id] : [],
              subtasks: [
                { id: `sub_1_${Date.now()}`, title: 'Preparar pontos fortes e oportunidades', completed: false },
                { id: `sub_2_${Date.now()}`, title: 'Realizar conversa individual de 15 min', completed: false },
                { id: `sub_3_${Date.now()}`, title: 'Registrar alinhamentos e combinados', completed: false },
              ],
            });
            return {
              success: true,
              message: `Feedback com ${effectiveCollabName} agendado com sucesso na lista "${listName}" para ${formattedDate}!`,
            };
          }
        },
      };
    } else {
      // General scheduled task
      const cleanTitle = cleanInput
        .replace(/^(?:nova\s+tarefa|tarefa|adicionar)\s*[:\-]?\s*/i, '')
        .trim();

      return {
        isCommand: true,
        actionType: 'scheduled_task_custom',
        rawInput,
        badgeLabel: 'Criar Rotina / Tarefa',
        badgeTone: 'primary',
        title: `Criar tarefa "${cleanTitle || 'Nova Tarefa'}" para ${formattedDate}`,
        description: `Adiciona uma nova tarefa/checklist agendada com data limite para ${formattedDate}${matchedCollab ? ` atribuída a ${matchedCollab.name}` : ''}.`,
        explanation: `Agendamento direto • Data: ${formattedDate}`,
        contextType: 'direct_execution',
        params: {
          collaborator: matchedCollab || undefined,
          collaboratorName: effectiveCollabName,
          targetDate,
          formattedDate,
          taskTitle: cleanTitle || 'Nova Tarefa Operacional',
        },
        execute: (actions) => {
          actions.addScheduledTask({
            title: cleanTitle || 'Nova Tarefa Operacional',
            dueDate: targetDate,
            priority: 'media',
            assignedTo: matchedCollab ? [matchedCollab.id] : [],
            subtasks: [],
          });
          return {
            success: true,
            message: `Tarefa "${cleanTitle || 'Nova Tarefa'}" criada para ${formattedDate}!`,
          };
        },
      };
    }
  }

  // =========================================================================
  // SCENARIO 2: ALLOCATE COLLABORATOR TO TASK / STATION
  // E.g.:
  // - "/alocar Carlos em Recebimento"
  // - "alocar Ana Silva no Posto 01"
  // - "/posto Mariana no Picking"
  // =========================================================================
  const isAllocateRegex = /^(?:alocar|aloca|posto|escalar|tarefa|atribuir)\s+/i.test(cleanInput);
  if (isAllocateRegex || (isExplicitCommand && (cleanInput.startsWith('alocar') || cleanInput.startsWith('posto')))) {
    const afterVerb = cleanInput.replace(/^(?:alocar|aloca|posto|escalar|tarefa|atribuir)\s+/i, '').trim();

    // Try to split by "em", "no", "na", "para", "ao"
    const parts = afterVerb.split(/\s+(?:em|no|na|para|ao|à|no\s+posto|na\s+tarefa)\s+/i);
    let personQuery = parts[0]?.replace(/["']/g, '').trim();
    let taskQuery = parts[1]?.replace(/["']/g, '').trim();

    if (!taskQuery && parts.length === 1) {
      // Try to find if any task name exists in text
      for (const t of tasks) {
        const tNorm = normalizeSearchText(t.name);
        if (norm.includes(tNorm)) {
          taskQuery = t.name;
          personQuery = cleanInput.replace(new RegExp(t.name, 'i'), '').replace(/^(?:alocar|aloca|posto|escalar)\s+/i, '').trim();
          break;
        }
      }
    }

    const matchedPerson = findBestMatchingCollaborator(personQuery, collaborators);
    const matchedTask = findBestMatchingTask(taskQuery, tasks);

    if (matchedPerson && matchedTask) {
      return {
        isCommand: true,
        actionType: 'allocate_task',
        rawInput,
        badgeLabel: 'Alocação em Posto',
        badgeTone: 'primary',
        title: `Alocar "${matchedPerson.name}" na tarefa "${matchedTask.name}"`,
        description: `Posiciona ${matchedPerson.name} no posto de trabalho "${matchedTask.name}".`,
        explanation: `Dimensionamento rápido • Posto: ${matchedTask.name}`,
        contextType: 'direct_execution',
        params: {
          collaborator: matchedPerson,
          collaboratorName: matchedPerson.name,
          task: matchedTask,
          taskName: matchedTask.name,
        },
        execute: (actions) => {
          actions.assignTask(matchedPerson.id, matchedTask.id);
          return {
            success: true,
            message: `${matchedPerson.name} foi alocado(a) em "${matchedTask.name}"!`,
          };
        },
      };
    }
  }

  // =========================================================================
  // SCENARIO 3: BREAK INTERVAL ALLOCATION / ROTATION
  // E.g.:
  // - "/intervalo Mariana para 14:15"
  // - "trocar intervalo de Pedro para 15:00"
  // - "/rotacionar intervalos"
  // =========================================================================
  if (norm.includes('rotacionar intervalo') || norm.includes('rodizio de intervalo') || norm.includes('girar intervalo')) {
    return {
      isCommand: true,
      actionType: 'rotate_breaks',
      rawInput,
      badgeLabel: 'Rotação de Intervalos',
      badgeTone: 'warning',
      title: 'Executar Rotação Diária de Intervalos (+1 Slot)',
      description: 'Avança todos os colaboradores presentes em 1 horário de pausa em relação ao histórico anterior, mantendo a operação balanceada.',
      explanation: 'Algoritmo de rotação contínua e justa',
      contextType: 'direct_execution',
      params: {},
      execute: (actions) => {
        const res = actions.generateRotatingBreaks();
        return {
          success: true,
          message: res?.totalRotated
            ? `${res.totalRotated} colaboradores rotacionados com sucesso!`
            : 'Escala de intervalos rotacionada!',
        };
      },
    };
  }

  const isBreakRegex = /^(?:intervalo|pausa|almoco|almoço)\b/i.test(cleanInput) || norm.includes('intervalo para') || norm.includes('pausa para');
  if (isBreakRegex) {
    const timeMatch = cleanInput.match(/(\d{1,2}:\d{2})/);
    const targetTime = timeMatch ? timeMatch[1] : '';

    let personTerm = cleanInput
      .replace(/^(?:intervalo|pausa|trocar\s+intervalo|mudar\s+intervalo)\s*(?:de|para|do|da)?\s*/i, '')
      .replace(/(?:para|as|às|no\s+horario)?\s*\d{1,2}:\d{2}/i, '')
      .replace(/["']/g, '')
      .trim();

    const matchedPerson = findBestMatchingCollaborator(personTerm, collaborators);
    let matchedBreak = breaks.find((b) => b.time === targetTime);

    if (matchedPerson && targetTime) {
      return {
        isCommand: true,
        actionType: 'assign_break',
        rawInput,
        badgeLabel: 'Ajuste de Intervalo',
        badgeTone: 'warning',
        title: `Mover intervalo de "${matchedPerson.name}" para ${targetTime}`,
        description: `Define o horário de pausa de ${matchedPerson.name} para o slot das ${targetTime}.`,
        explanation: `Horário de pausa: ${targetTime}`,
        contextType: 'direct_execution',
        params: {
          collaborator: matchedPerson,
          collaboratorName: matchedPerson.name,
          slotTime: targetTime,
          breakSlot: matchedBreak,
        },
        execute: (actions) => {
          let breakId = matchedBreak?.id;
          if (!breakId) {
            // Create the break slot if it doesn't exist
            const newSlot = actions.addBreakSlot({ time: targetTime, maxCapacity: 10 });
            breakId = newSlot.id;
          }
          actions.moveBreakInterval(matchedPerson.id, null, breakId);
          return {
            success: true,
            message: `Intervalo de ${matchedPerson.name} definido para ${targetTime}!`,
          };
        },
      };
    }
  }

  // =========================================================================
  // SCENARIO 4: ABSENCE / MEDICAL CERTIFICATE / FOLGA / PRESENCE
  // E.g.:
  // - "/ausencia Carlos atestado 18/09 consulta medica"
  // - "/folga Roberto 22/09"
  // - "/presenca Mariana presente"
  // =========================================================================
  const isAbsenceRegex = /^(?:ausencia|ausência|falta|atestado|licenca|licença|ferias|férias|folga)\b/i.test(cleanInput);
  if (isAbsenceRegex) {
    let absenceType = 'atestado';
    if (norm.includes('folga')) absenceType = 'folga';
    else if (norm.includes('ferias') || norm.includes('férias')) absenceType = 'ferias';
    else if (norm.includes('licenca') || norm.includes('licença')) absenceType = 'licenca';
    else if (norm.includes('falta')) absenceType = 'falta_injustificada';

    const dateExtracted = parseNaturalDateBR(cleanInput);
    const targetDate = dateExtracted?.isoDate || state.selectedDate || getTodayISO();
    const formattedDate = dateExtracted?.formattedBR || formatDateBR(targetDate);

    // Extract reason text
    let cleanText = cleanInput
      .replace(/^(?:ausencia|ausência|falta|atestado|licenca|licença|ferias|férias|folga)\s*/i, '')
      .replace(/\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?/g, '')
      .replace(/\b(?:em|para|dia|data|hoje|amanha|amanhã)\b/gi, '')
      .trim();

    let matchedPerson = findBestMatchingCollaborator(cleanText, collaborators);
    if (!matchedPerson) {
      for (const c of collaborators) {
        if (norm.includes(normalizeSearchText(c.name))) {
          matchedPerson = c;
          break;
        }
      }
    }

    if (matchedPerson) {
      const typeLabels: Record<string, string> = {
        atestado: 'Atestado Médico',
        folga: 'Folga',
        ferias: 'Férias',
        licenca: 'Licença',
        falta_injustificada: 'Falta Injustificada',
      };
      const label = typeLabels[absenceType] || 'Ausência';

      return {
        isCommand: true,
        actionType: 'set_absence',
        rawInput,
        badgeLabel: `Registrar ${label}`,
        badgeTone: absenceType === 'atestado' ? 'info' : 'warning',
        title: `Registrar ${label} para "${matchedPerson.name}" (${formattedDate})`,
        description: `Registra a ausência programada/status de ${label.toLowerCase()} no dia ${formattedDate}.`,
        explanation: `Status: ${label} • Data: ${formattedDate}`,
        contextType: 'direct_execution',
        params: {
          collaborator: matchedPerson,
          collaboratorName: matchedPerson.name,
          absenceType,
          targetDate,
          formattedDate,
        },
        execute: (actions) => {
          actions.addScheduledAbsence({
            collaboratorId: matchedPerson!.id,
            startDate: targetDate,
            endDate: targetDate,
            reason: label,
            type: absenceType as any,
          });
          return {
            success: true,
            message: `${label} registrado(a) para ${matchedPerson!.name} no dia ${formattedDate}!`,
          };
        },
      };
    }
  }

  // =========================================================================
  // SCENARIO 5: SERVICE REQUEST / HELPDESK
  // E.g.:
  // - "/pedido Troca de fita na impressora 02"
  // - "/chamado Leitor parou de funcionar no posto 3"
  // =========================================================================
  const isRequestRegex = /^(?:pedido|chamado|solicitar|suporte)\s*[:\-]?\s*/i.test(cleanInput);
  if (isRequestRegex) {
    const reqText = cleanInput.replace(/^(?:pedido|chamado|solicitar|suporte)\s*[:\-]?\s*/i, '').trim();
    if (reqText.length >= 3) {
      return {
        isCommand: true,
        actionType: 'create_request',
        rawInput,
        badgeLabel: 'Abrir Pedido de Serviço',
        badgeTone: 'info',
        title: `Abrir chamado: "${reqText}"`,
        description: `Envia uma solicitação de serviço/ajuda operacional imediata para a liderança e equipe de apoio do turno ${state.teamShift || 'T2'}.`,
        explanation: `Chamado operacional rápido`,
        contextType: 'direct_execution',
        params: {
          requestTitle: reqText,
        },
        execute: (actions) => {
          actions.createServiceRequest({
            title: reqText,
            description: `Solicitado via busca global inteligente por ${identifiedUser?.name || 'Operador'}.`,
            priority: 'media',
            category: 'Geral',
            shift: state.teamShift || 'T2',
          });
          return {
            success: true,
            message: `Chamado "${reqText}" enviado com sucesso!`,
          };
        },
      };
    }
  }

  // =========================================================================
  // SCENARIO 6: INFO HUB NOTICE / COMUNICADO
  // E.g.:
  // - "/aviso Reunião de alinhamento às 16h no auditório"
  // - "/comunicado Usar óculos de proteção na linha 4"
  // =========================================================================
  const isNoticeRegex = /^(?:aviso|comunicado|mural|alerta)\s*[:\-]?\s*/i.test(cleanInput);
  if (isNoticeRegex) {
    const noticeText = cleanInput.replace(/^(?:aviso|comunicado|mural|alerta)\s*[:\-]?\s*/i, '').trim();
    if (noticeText.length >= 3) {
      return {
        isCommand: true,
        actionType: 'create_notice',
        rawInput,
        badgeLabel: 'Publicar Aviso no Mural',
        badgeTone: 'warning',
        title: `Publicar no Hub de Informações: "${noticeText}"`,
        description: `Adiciona um lembrete/comunicado no mural oficial do turno ${state.teamShift || 'T2'}.`,
        explanation: `Mural de Avisos Operacionais`,
        contextType: 'direct_execution',
        params: {
          noticeText,
        },
        execute: (actions) => {
          actions.addInfoHubReminder({
            title: noticeText.length > 50 ? `${noticeText.substring(0, 50)}...` : noticeText,
            content: noticeText,
            priority: 'alta',
            shift: state.teamShift || 'T2',
            tags: ['Aviso Rápido'],
          });
          return {
            success: true,
            message: 'Aviso publicado no Hub de Informações!',
          };
        },
      };
    }
  }

  return null;
}
