// Native OS Notification & Background Service Worker Alert Helper

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export function isNotificationSupportedAndGranted(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Display a notification using Service Worker registration if available,
 * which persists and shows even when the browser tab/page is in background or closed.
 */
export async function showNativeOSNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    tag?: string;
    badge?: string;
    url?: string;
    onClick?: () => void;
  }
): Promise<void> {
  if (!('Notification' in window)) return;

  if (Notification.permission !== 'granted') {
    const granted = await requestNotificationPermission();
    if (!granted) return;
  }

  const iconUrl = options?.icon || '/favicon.svg';
  const badgeUrl = options?.badge || '/favicon.svg';
  const notificationTag = options?.tag || 'dimensio-bg-alert';

  // 1. Try Service Worker showNotification (Works in background even when page tab is closed)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, {
          body: options?.body || '',
          icon: iconUrl,
          badge: badgeUrl,
          tag: notificationTag,
          data: { url: options?.url || '/' },
        } as NotificationOptions);
        return;
      }
    } catch {
      // Fallback to standard window Notification if Service Worker fails
    }
  }

  // 2. Fallback to classic window Notification API
  try {
    const notification = new Notification(title, {
      body: options?.body,
      icon: iconUrl,
      badge: badgeUrl,
      tag: notificationTag,
    } as NotificationOptions);

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };
    }
  } catch {
    // Silent catch if OS restricts
  }
}

/**
 * Schedule a delayed background notification (e.g. for break alert, test, shift start).
 * Runs via Service Worker or setTimeout timer.
 */
export function scheduleDelayedNotification(
  title: string,
  body: string,
  delayMs: number = 5000
): void {
  setTimeout(() => {
    showNativeOSNotification(title, {
      body,
      tag: 'dimensio-scheduled-alert',
    });
  }, delayMs);
}


