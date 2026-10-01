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
    vibrate?: number[];
    onClick?: () => void;
  }
): Promise<void> {
  if (!('Notification' in window)) return;

  if (Notification.permission !== 'granted') {
    return;
  }

  const iconUrl = options?.icon || '/icons/icon-192.png';
  const badgeUrl = options?.badge || '/icons/badge-96.png';
  const notificationTag = options?.tag || 'dimensio-bg-alert';
  const vibratePattern = options?.vibrate || [250, 100, 250];

  // 1. Try Service Worker showNotification (Official way for background on Android)
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, {
          body: options?.body || '',
          icon: iconUrl,
          badge: badgeUrl,
          tag: notificationTag,
          vibrate: vibratePattern,
          renotify: true,
          data: { url: options?.url || '/' },
        } as NotificationOptions);
        return;
      }
    } catch {
      // Fallback
    }
  }

  // 2. Try Service Worker message post if registration is active
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_NOTIFICATION',
        payload: {
          title,
          body: options?.body || '',
          icon: iconUrl,
          badge: badgeUrl,
          tag: notificationTag,
          vibrate: vibratePattern,
          url: options?.url || '/',
        },
      });
      return;
    } catch {}
  }

  // 3. Fallback to classic window Notification API
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


