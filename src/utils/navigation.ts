export type AppView =
  | 'home'
  | 'calendar'
  | 'team'
  | 'presence'
  | 'assignment'
  | 'breaks'
  | 'requests'
  | 'briefing'
  | 'share'
  | 'report'
  | 'settings'
  | 'help'
  | 'employee'
  | 'routines'
  | 'info_hub'
  | 'portal'
  | 'operator_portal';

const NAVIGATE_EVENT = 'dimensio:navigate';
const FOCUS_REQUEST_EVENT = 'dimensio:focusRequest';

let pendingServiceRequestId: string | null = null;

export const navigateTo = (view: AppView) => {
  window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: view }));
};

export const onNavigateRequested = (handler: (view: AppView) => void) => {
  const listener = (e: Event) => handler((e as CustomEvent).detail as AppView);
  window.addEventListener(NAVIGATE_EVENT, listener);
  return () => window.removeEventListener(NAVIGATE_EVENT, listener);
};

export const focusServiceRequest = (requestId: string) => {
  pendingServiceRequestId = requestId;
  window.dispatchEvent(new CustomEvent(FOCUS_REQUEST_EVENT, { detail: requestId }));
};

export const onFocusServiceRequest = (handler: (requestId: string) => void) => {
  const listener = (e: Event) => handler((e as CustomEvent).detail as string);
  window.addEventListener(FOCUS_REQUEST_EVENT, listener);
  return () => window.removeEventListener(FOCUS_REQUEST_EVENT, listener);
};

export const consumePendingServiceRequestId = (): string | null => {
  const id = pendingServiceRequestId;
  pendingServiceRequestId = null;
  return id;
};