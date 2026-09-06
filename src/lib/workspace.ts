import { getAccessToken } from './firebase';

export interface CalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: 'needsAction' | 'completed';
  updated?: string;
}

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
}

export interface GoogleSlidePresentation {
  presentationId: string;
  title: string;
  slides?: Array<{
    objectId: string;
    pageElements?: Array<{
      objectId: string;
      shape?: { text?: { textElements?: Array<{ textRun?: { content: string } }> } };
    }>;
  }>;
}

export interface GoogleSheetInfo {
  spreadsheetId: string;
  properties: { title: string };
  sheets: Array<{
    properties: { sheetId: number; title: string; index: number };
  }>;
}

// ----------------------------------------------------------------------
// GOOGLE FORMS
// ----------------------------------------------------------------------
export interface GoogleFormItem {
  itemId?: string;
  title?: string;
  description?: string;
  questionItem?: {
    question?: {
      questionId?: string;
      required?: boolean;
      textQuestion?: { paragraph?: boolean };
      choiceQuestion?: {
        type: 'RADIO' | 'CHECKBOX' | 'DROP_DOWN';
        options: Array<{ value: string }>;
        shuffle?: boolean;
      };
      scaleQuestion?: {
        low: number;
        high: number;
        lowLabel?: string;
        highLabel?: string;
      };
    };
  };
  questionGroupItem?: {
    questions?: Array<{
      questionId?: string;
      required?: boolean;
      rowQuestion?: { title: string };
    }>;
  };
  pageBreakItem?: Record<string, unknown>;
  textItem?: Record<string, unknown>;
}

export interface GoogleForm {
  formId: string;
  info: {
    title: string;
    description?: string;
    documentTitle?: string;
  };
  settings?: {
    quizSettings?: { isQuiz?: boolean };
  };
  items?: GoogleFormItem[];
  revisionId?: string;
  responderUri?: string;
}

export interface GoogleFormAnswer {
  questionId: string;
  textAnswers?: {
    answers: Array<{ value: string }>;
  };
}

export interface GoogleFormResponseItem {
  responseId: string;
  createTime: string;
  lastSubmittedTime: string;
  respondentEmail?: string;
  answers?: Record<string, GoogleFormAnswer>;
}

export interface GoogleFormsListResponse {
  forms: Array<{
    id: string;
    name: string;
    modifiedTime?: string;
    webViewLink?: string;
  }>;
}

// Search / list Google Forms in user's Drive
export async function fetchUserGoogleForms(): Promise<Array<{ id: string; name: string; modifiedTime?: string; webViewLink?: string }>> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const query = encodeURIComponent("mimeType='application/vnd.google-apps.form' and trashed=false");
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&pageSize=30&orderBy=modifiedTime desc`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao listar formulários do Google Drive: ${res.statusText}`);
  }

  const data = await res.json();
  return data.files || [];
}

// Get Form metadata & questions structure
export async function fetchGoogleForm(formId: string): Promise<GoogleForm> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao carregar detalhes do formulário: ${res.statusText}`);
  }

  return await res.json();
}

// Get Form Responses / Submissions
export async function fetchGoogleFormResponses(formId: string): Promise<GoogleFormResponseItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}/responses`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao carregar respostas do formulário: ${res.statusText}`);
  }

  const data = await res.json();
  return data.responses || [];
}

// Create a new Google Form with initial items
export async function createGoogleForm(
  title: string,
  description?: string,
  initialQuestions?: Array<{
    title: string;
    type: 'RADIO' | 'CHECKBOX' | 'TEXT' | 'PARAGRAPH';
    options?: string[];
    required?: boolean;
  }>
): Promise<GoogleForm> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  // Step 1: Create the form
  const createRes = await fetch('https://forms.googleapis.com/v1/forms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title,
        documentTitle: title,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao criar Google Form: ${createRes.statusText}`);
  }

  let form: GoogleForm = await createRes.json();

  // Step 2: If description or questions are specified, apply batchUpdate
  const requests: any[] = [];

  if (description) {
    requests.push({
      updateFormInfo: {
        info: {
          description,
        },
        updateMask: 'description',
      },
    });
  }

  if (initialQuestions && initialQuestions.length > 0) {
    initialQuestions.forEach((q, idx) => {
      let questionData: any = {
        required: q.required ?? true,
      };

      if (q.type === 'TEXT') {
        questionData.textQuestion = { paragraph: false };
      } else if (q.type === 'PARAGRAPH') {
        questionData.textQuestion = { paragraph: true };
      } else if (q.type === 'RADIO' || q.type === 'CHECKBOX') {
        questionData.choiceQuestion = {
          type: q.type,
          options: (q.options || ['Opção 1', 'Opção 2']).map((opt) => ({ value: opt })),
          shuffle: false,
        };
      }

      requests.push({
        createItem: {
          item: {
            title: q.title,
            questionItem: {
              question: questionData,
            },
          },
          location: { index: idx },
        },
      });
    });
  }

  if (requests.length > 0) {
    const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(form.formId)}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests,
      }),
    });

    if (updateRes.ok) {
      // Re-fetch updated form
      form = await fetchGoogleForm(form.formId);
    }
  }

  return form;
}

// ----------------------------------------------------------------------
// GOOGLE CALENDAR
// ----------------------------------------------------------------------
export async function fetchCalendarEvents(timeMin?: string): Promise<CalendarEventItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const min = timeMin || new Date(Date.now() - 7 * 86400000).toISOString();
  const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(min)}&singleEvents=true&orderBy=startTime&maxResults=50`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao buscar eventos do Google Calendar: ${res.statusText}`);
  }

  const data = await res.json();
  return data.items || [];
}

export async function createCalendarEvent(event: {
  summary: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
}): Promise<CalendarEventItem> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const body = {
    summary: event.summary,
    description: event.description || '',
    location: event.location || '',
    start: { dateTime: event.startDateTime },
    end: { dateTime: event.endDateTime },
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao criar evento no Calendar: ${res.statusText}`);
  }

  return await res.json();
}

export async function deleteCalendarEvent(eventId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao excluir evento do Calendar: ${res.statusText}`);
  }

  return true;
}

// ----------------------------------------------------------------------
// GOOGLE TASKS
// ----------------------------------------------------------------------
export async function fetchTaskLists(): Promise<GoogleTaskList[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao listar tarefas do Google Tasks: ${res.statusText}`);
  }

  const data = await res.json();
  return data.items || [];
}

export async function fetchTasks(taskListId: string = '@default'): Promise<GoogleTaskItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks?showCompleted=true&maxResults=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao carregar itens do Google Tasks: ${res.statusText}`);
  }

  const data = await res.json();
  return data.items || [];
}

export async function createGoogleTask(
  taskListId: string = '@default',
  task: { title: string; notes?: string; due?: string }
): Promise<GoogleTaskItem> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(task),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao criar item no Google Tasks: ${res.statusText}`);
  }

  return await res.json();
}

export async function updateGoogleTaskStatus(
  taskListId: string,
  taskId: string,
  completed: boolean
): Promise<GoogleTaskItem> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: completed ? 'completed' : 'needsAction' }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao atualizar status da tarefa: ${res.statusText}`);
  }

  return await res.json();
}

// ----------------------------------------------------------------------
// GOOGLE SLIDES
// ----------------------------------------------------------------------
export async function fetchPresentation(presentationId: string): Promise<GoogleSlidePresentation> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch(`https://slides.googleapis.com/v1/presentations/${encodeURIComponent(presentationId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao carregar apresentação do Google Slides: ${res.statusText}`);
  }

  return await res.json();
}

export async function createPresentation(title: string): Promise<GoogleSlidePresentation> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch('https://slides.googleapis.com/v1/presentations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao criar apresentação no Google Slides: ${res.statusText}`);
  }

  return await res.json();
}

// ----------------------------------------------------------------------
// GOOGLE SHEETS
// ----------------------------------------------------------------------
export async function fetchSpreadsheet(spreadsheetId: string): Promise<GoogleSheetInfo> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao carregar planilha do Google Sheets: ${res.statusText}`);
  }

  return await res.json();
}

export async function fetchSheetValues(spreadsheetId: string, range: string): Promise<any[][]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao buscar dados da planilha: ${res.statusText}`);
  }

  const data = await res.json();
  return data.values || [];
}

export async function appendSheetValues(
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<{ updatedRows: number }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado com o Google Workspace');

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Erro ao adicionar dados à planilha: ${res.statusText}`);
  }

  const data = await res.json();
  return { updatedRows: data.updates?.updatedRows || values.length };
}
