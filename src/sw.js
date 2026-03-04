import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Handle FCM push notifications delivered by Firebase Cloud Messaging
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { notification: { title: 'Reminder', body: event.data.text() } };
  }

  const notification = payload.notification || {};
  const webpush = payload.webpush?.notification || {};

  const title = webpush.title || notification.title || '⏰ Reminder';
  const options = {
    body: webpush.body || notification.body || '',
    icon: webpush.icon || notification.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: webpush.tag || notification.tag || 'reminder',
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
  );
});
