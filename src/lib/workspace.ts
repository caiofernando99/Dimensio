import { getAccessToken } from './firebase';

// Integrações Google Workspace mantidas: Calendar e Tasks.
// Slides, Sheets e Forms foram removidos (ver WorkspaceHubPanel).

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

// ----------------------------------------------------------------------
// GOOGLE CALENDAR
// ----------------------------------------------------------------------
export async function fetchCalendarEvents(timeMin?: string): Promise<CalendarEventItem[]> {
  const token = await getAccessToken();
  if (!token) throw new Error('Nǜo autenticado com o Google Workspace');

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
  if (!token) throw new Error('Nǜo autenticado com o Google Workspace');

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
  if (!token) throw new Error('Nǜo autenticado com o Google Workspace');

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
  if (!token) throw new Error('Nǜo autenticado com o Google Workspace');

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
  if (!token) throw new Error('Nǜo autenticado com o Google Workspace');

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
  if (!token) throw new Error('Nǜo autenticado com o Google Workspace');

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
  if (!token) throw new Error('Nǜo autenticado com o Google Workspace');

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
