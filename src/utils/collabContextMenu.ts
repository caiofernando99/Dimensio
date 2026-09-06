import type { MouseEvent as ReactMouseEvent } from 'react';

export interface CollabContextMenuEvent {
  collabId: string;
  x: number;
  y: number;
}

const CONTEXT_MENU_EVENT = 'dimensio:collabContextMenu';

export const openCollabContextMenu = (collabId: string, clientX: number, clientY: number) => {
  window.dispatchEvent(
    new CustomEvent<CollabContextMenuEvent>(CONTEXT_MENU_EVENT, {
      detail: { collabId, x: clientX, y: clientY },
    })
  );
};

// Handler pronto para colar em elementos de colaborador: previne o menu padrão
// do navegador e abre o menu Dimensio ancorado no cursor.
export const collabMenuOnContext = (collabId: string) => (e: ReactMouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  openCollabContextMenu(collabId, e.clientX, e.clientY);
};

export const onCollabContextMenu = (handler: (payload: CollabContextMenuEvent) => void) => {
  const listener = (e: Event) => handler((e as CustomEvent<CollabContextMenuEvent>).detail);
  window.addEventListener(CONTEXT_MENU_EVENT, listener);
  return () => window.removeEventListener(CONTEXT_MENU_EVENT, listener);
};