import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from './firebase';
import { saveFcmToken, saveWebPushSubscription } from './firestore';

let messaging = null;

function getMessagingInstance() {
  if (!messaging) {
    messaging = getMessaging(app);
  }
  return messaging;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * iOS Safari PWA: subscribe via native PushManager and save the subscription to Firestore.
 */
async function initIOSWebPush(userId) {
  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.warn('FCM: VITE_VAPID_PUBLIC_KEY not set – skipping iOS push init.');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;

  // Check if already subscribed
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  if (subscription && userId) {
    await saveWebPushSubscription(userId, subscription.toJSON());
    console.log('Web Push subscription saved (iOS).');
  }

  return subscription;
}

/**
 * Chrome/Android: get FCM token and save to Firestore.
 */
async function initFCMToken(userId) {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn('FCM: VITE_FIREBASE_VAPID_KEY not set – skipping FCM init.');
    return null;
  }

  const msg = getMessagingInstance();
  const registration = await navigator.serviceWorker.ready;

  const token = await getToken(msg, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });

  if (token) {
    await saveFcmToken(userId, token);
    console.log('FCM token saved.');
  }

  return token;
}

/**
 * Main entry point — called from App.jsx after notification permission is granted.
 * Automatically picks the right path based on the device.
 */
export async function initFCM(userId) {
  try {
    if (isIOS()) {
      return await initIOSWebPush(userId);
    }
    return await initFCMToken(userId);
  } catch (err) {
    console.error('Push init failed:', err);
    return null;
  }
}

/**
 * Listen for foreground FCM messages (Chrome/Android only — app is open).
 */
export function listenForegroundMessages(onReceive) {
  if (isIOS()) return () => {};
  try {
    const msg = getMessagingInstance();
    return onMessage(msg, onReceive);
  } catch (err) {
    console.error('FCM foreground listener failed:', err);
    return () => {};
  }
}
