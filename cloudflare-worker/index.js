/**
 * Cloudflare Worker – Reminder Push Notification Cron
 *
 * Runs every minute via cron trigger.
 * Checks Firestore for due reminders and sends FCM push notifications.
 *
 * Required secrets (set via `wrangler secret put`):
 *   FIREBASE_PROJECT_ID     – e.g. "notifai01"
 *   FIREBASE_CLIENT_EMAIL   – service account email
 *   FIREBASE_PRIVATE_KEY    – service account private key (PEM, with literal \n)
 *   FIREBASE_USER_ID        – your Firebase Auth UID
 */

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env));
  },
};

// ---------------------------------------------------------------------------
// Main logic
// ---------------------------------------------------------------------------

async function run(env) {
  const accessToken = await getGoogleAccessToken(env);
  if (!accessToken) return;

  const { projectId, userId } = { projectId: env.FIREBASE_PROJECT_ID, userId: env.FIREBASE_USER_ID };

  // 1. Get user document (contains fcmToken)
  const userDoc = await firestoreGet(accessToken, projectId, `users/${userId}`);
  const fcmToken = userDoc?.fields?.fcmToken?.stringValue;
  if (!fcmToken) {
    console.log('No FCM token registered for user – skipping.');
    return;
  }

  // 2. Query reminders where notified == false
  const results = await firestoreQuery(accessToken, projectId, userId);

  const now = new Date();
  const due = results.filter((r) => {
    const datetime = r.fields?.datetime?.stringValue;
    return datetime && new Date(datetime) <= now;
  });

  if (due.length === 0) {
    console.log('No due reminders.');
    return;
  }

  // 3. Send FCM push and mark notified
  for (const r of due) {
    const reminderId = r.name.split('/').pop();
    const title = r.fields?.title?.stringValue || 'Reminder';
    const note = r.fields?.note?.stringValue || '';

    await sendFCMPush(accessToken, projectId, fcmToken, title, note, reminderId);
    await markReminderNotified(accessToken, projectId, userId, reminderId);
    console.log(`Notified: ${reminderId} – "${title}"`);
  }
}

// ---------------------------------------------------------------------------
// Google OAuth2 – JWT → access token
// ---------------------------------------------------------------------------

async function getGoogleAccessToken(env) {
  try {
    const jwt = await buildJWT(env);
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    if (!data.access_token) {
      console.error('Failed to get access token:', JSON.stringify(data));
      return null;
    }
    return data.access_token;
  } catch (err) {
    console.error('getGoogleAccessToken error:', err);
    return null;
  }
}

async function buildJWT(env) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/firebase.messaging',
      'https://www.googleapis.com/auth/datastore',
    ].join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const b64Header = toBase64Url(JSON.stringify(header));
  const b64Payload = toBase64Url(JSON.stringify(payload));
  const signingInput = `${b64Header}.${b64Payload}`;

  const privateKey = await importPrivateKey(env.FIREBASE_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const b64Sig = toBase64UrlBytes(new Uint8Array(signature));
  return `${signingInput}.${b64Sig}`;
}

async function importPrivateKey(pem) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\s+/g, '');
  const keyData = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function toBase64Url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function toBase64UrlBytes(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ---------------------------------------------------------------------------
// Firestore REST helpers
// ---------------------------------------------------------------------------

const FS_BASE = 'https://firestore.googleapis.com/v1';

async function firestoreGet(token, projectId, path) {
  const url = `${FS_BASE}/projects/${projectId}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

async function firestoreQuery(token, projectId, userId) {
  const url = `${FS_BASE}/projects/${projectId}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'reminders' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'notified' },
          op: 'EQUAL',
          value: { booleanValue: false },
        },
      },
      parent: `projects/${projectId}/databases/(default)/documents/users/${userId}`,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const results = await res.json();
  // runQuery returns an array; items without `document` are empty results
  return results.filter((r) => r.document).map((r) => r.document);
}

async function markReminderNotified(token, projectId, userId, reminderId) {
  const url =
    `${FS_BASE}/projects/${projectId}/databases/(default)/documents` +
    `/users/${userId}/reminders/${reminderId}?updateMask.fieldPaths=notified`;

  await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: { notified: { booleanValue: true } },
    }),
  });
}

// ---------------------------------------------------------------------------
// FCM HTTP v1 send
// ---------------------------------------------------------------------------

async function sendFCMPush(token, projectId, fcmToken, title, body, tag) {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: { title: `⏰ ${title}`, body },
        webpush: {
          notification: {
            title: `⏰ ${title}`,
            body,
            icon: '/icons/icon-192.png',
            tag,
            requireInteraction: false,
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('FCM send failed:', err);
  }
}
