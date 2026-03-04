import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from './firebase';
import { saveFcmToken } from './firestore';

let messaging = null;

function getMessagingInstance() {
  if (!messaging) {
    messaging = getMessaging(app);
  }
  return messaging;
}

/**
 * Request FCM token and save it to Firestore under users/{userId}.
 * Should be called after notification permission is granted.
 */
export async function initFCM(userId) {
  try {
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
  } catch (err) {
    console.error('FCM init failed:', err);
    return null;
  }
}

/**
 * Listen for foreground FCM messages (app is open).
 * Calls onReceive(payload) when a message arrives.
 */
export function listenForegroundMessages(onReceive) {
  try {
    const msg = getMessagingInstance();
    return onMessage(msg, onReceive);
  } catch (err) {
    console.error('FCM foreground listener failed:', err);
    return () => {};
  }
}
