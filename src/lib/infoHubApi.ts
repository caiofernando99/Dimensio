/**
 * Cliente da Base Compartilhada do Hub de Informações (multi-app).
 *
 * Permite que o Dimensio e outras aplicações leiam/escrevam avisos, links e
 * grupos de códigos no mesmo workspace via REST:
 *   GET  /api/info-hub?workspace=X&type=all&search=&shift=
 *   POST /api/info-hub/sync { reminders, links, quickFills }
 *   POST /api/info-hub/reminders | /links | /quickfills
 *   PUT/DELETE /api/info-hub/<recurso>/:id
 *
 * O workspace isola bases (ex: ?workspace=logistica, totem, rh). Use
 * workspace=all para agregar tudo. Header X-Workspace também é aceito.
 */

export interface SharedInfoHubSnapshot {
  workspace: string;
  seq: number;
  updatedAt: number;
  counts: { reminders: number; links: number; quickFills: number };
  reminders?: any[];
  links?: any[];
  quickFills?: any[];
}

function workspaceHeaders(workspace: string): Record<string, string> {
  return workspace && workspace !== 'default' ? { 'X-Workspace': workspace } : {};
}

export async function fetchSharedInfoHub(
  workspace = 'default',
  opts: { type?: string; search?: string; shift?: string } = {}
): Promise<SharedInfoHubSnapshot> {
  const params = new URLSearchParams({ workspace });
  if (opts.type) params.set('type', opts.type);
  if (opts.search) params.set('search', opts.search);
  if (opts.shift) params.set('shift', opts.shift);
  const res = await fetch(`/api/info-hub?${params.toString()}`, {
    headers: { ...workspaceHeaders(workspace) },
  });
  if (!res.ok) throw new Error(`Falha ao ler base compartilhada (${res.status})`);
  return res.json();
}

export async function pushSharedInfoHub(
  workspace = 'default',
  payload: { reminders?: any[]; links?: any[]; quickFills?: any[] }
): Promise<{ seq: number; upserted: Record<string, number> }> {
  const res = await fetch('/api/info-hub/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...workspaceHeaders(workspace) },
    body: JSON.stringify({ workspace, ...payload }),
  });
  if (!res.ok) throw new Error(`Falha ao enviar base compartilhada (${res.status})`);
  return res.json();
}

export async function createSharedItem(
  kind: 'reminders' | 'links' | 'quickfills',
  workspace = 'default',
  doc: Record<string, unknown>
): Promise<any> {
  const res = await fetch(`/api/info-hub/${kind}?workspace=${encodeURIComponent(workspace)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...workspaceHeaders(workspace) },
    body: JSON.stringify({ workspace, ...doc }),
  });
  if (!res.ok) throw new Error(`Falha ao criar ${kind} (${res.status})`);
  return res.json();
}

export async function updateSharedItem(
  kind: 'reminders' | 'links' | 'quickfills',
  workspace = 'default',
  id: string,
  patch: Record<string, unknown>
): Promise<any> {
  const res = await fetch(`/api/info-hub/${kind}/${encodeURIComponent(id)}?workspace=${encodeURIComponent(workspace)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...workspaceHeaders(workspace) },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Falha ao atualizar ${kind}/${id} (${res.status})`);
  return res.json();
}

export async function deleteSharedItem(
  kind: 'reminders' | 'links' | 'quickfills',
  workspace = 'default',
  id: string
): Promise<void> {
  const res = await fetch(`/api/info-hub/${kind}/${encodeURIComponent(id)}?workspace=${encodeURIComponent(workspace)}`, {
    method: 'DELETE',
    headers: { ...workspaceHeaders(workspace) },
  });
  if (!res.ok) throw new Error(`Falha ao remover ${kind}/${id} (${res.status})`);
}
