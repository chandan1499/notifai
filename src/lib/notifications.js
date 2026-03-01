const scheduledTimers = new Map();

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result;
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function showNotification(title, body, tag) {
  if (Notification.permission !== 'granted') return;
  // Use service worker registration for persistent notifications (works backgrounded on iOS PWA)
  if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        body,
        tag,
        icon: '/icons/icon-192.png',
        vibrate: [200, 100, 200],
      });
    }).catch(() => {
      new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
    });
  } else {
    new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
  }
}

/**
 * Schedule a notification for a future datetime.
 * Returns a cancel function.
 */
export function scheduleNotification(id, title, datetime) {
  cancelScheduledNotification(id);

  const delay = new Date(datetime).getTime() - Date.now();
  if (delay <= 0) return;

  const timerId = setTimeout(() => {
    showNotification(title, `Reminder: ${title}`, id);
    scheduledTimers.delete(id);
  }, delay);

  scheduledTimers.set(id, timerId);
}

export function cancelScheduledNotification(id) {
  if (scheduledTimers.has(id)) {
    clearTimeout(scheduledTimers.get(id));
    scheduledTimers.delete(id);
  }
}

export function cancelAllScheduledNotifications() {
  scheduledTimers.forEach((timerId) => clearTimeout(timerId));
  scheduledTimers.clear();
}
