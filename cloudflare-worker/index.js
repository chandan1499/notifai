/**
 * Cloudflare Worker – Reminder Push Notification Cron
 *
 * Runs every minute. Checks Firestore for due reminders and sends:
 *   - FCM push for Chrome/Android (via Firebase Cloud Messaging)
 *   - Web Push for iOS Safari PWA (directly via Apple's Web Push servers)
 *
 * Required Cloudflare secrets (`wrangler secret put <NAME>`):
 *   FIREBASE_PROJECT_ID      – e.g. "notifai01"
 *   FIREBASE_CLIENT_EMAIL    – service account email
 *   FIREBASE_PRIVATE_KEY     – service account RSA private key (PEM with literal \n)
 *   FIREBASE_USER_ID         – your Firebase Auth UID
 *   VAPID_PUBLIC_KEY         – your own VAPID public key (base64url, 65 bytes)
 *   VAPID_PRIVATE_KEY        – your own VAPID private key (base64url, 32 bytes)
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

  const { projectId, userId } = {
    projectId: env.FIREBASE_PROJECT_ID,
    userId: env.FIREBASE_USER_ID,
  };

  // Get user document (contains fcmToken and/or webPushSub)
  const userDoc = await firestoreGet(accessToken, projectId, `users/${userId}`);
  const fcmToken = userDoc?.fields?.fcmToken?.stringValue || null;
  const webPushSubRaw = userDoc?.fields?.webPushSub?.stringValue || null;
  const webPushSub = webPushSubRaw ? JSON.parse(webPushSubRaw) : null;

  if (!fcmToken && !webPushSub) {
    console.log('No push subscription registered for user – skipping.');
    return;
  }

  // Query reminders where notified == false
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

  for (const r of due) {
    const reminderId = r.name.split('/').pop();
    const title = r.fields?.title?.stringValue || 'Reminder';
    const note = r.fields?.note?.stringValue || '';

    // iOS Safari Web Push
    if (webPushSub) {
      await sendWebPush(env, webPushSub, title, note, reminderId);
    }

    // Chrome / Android FCM
    if (fcmToken) {
      await sendFCMPush(accessToken, projectId, fcmToken, title, note, reminderId);
    }

    await markReminderNotified(accessToken, projectId, userId, reminderId);
    console.log(`Notified: ${reminderId} – "${title}"`);
  }
}

// ---------------------------------------------------------------------------
// Google OAuth2 for Firebase Admin (service account → access token)
// ---------------------------------------------------------------------------

async function getGoogleAccessToken(env) {
  try {
    const jwt = await buildServiceAccountJWT(env);
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

async function buildServiceAccountJWT(env) {
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

  const privateKey = await importRSAPrivateKey(env.FIREBASE_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${toBase64UrlBytes(new Uint8Array(signature))}`;
}

async function importRSAPrivateKey(pem) {
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
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const results = await res.json();
  return results.filter((r) => r.document).map((r) => r.document);
}

async function markReminderNotified(token, projectId, userId, reminderId) {
  const url =
    `${FS_BASE}/projects/${projectId}/databases/(default)/documents` +
    `/users/${userId}/reminders/${reminderId}?updateMask.fieldPaths=notified`;

  await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { notified: { booleanValue: true } } }),
  });
}

// ---------------------------------------------------------------------------
// FCM HTTP v1 – Chrome / Android
// ---------------------------------------------------------------------------

async function sendFCMPush(token, projectId, fcmToken, title, body, tag) {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
            },
          },
        },
      }),
    }
  );

  if (!res.ok) console.error('FCM send failed:', await res.text());
}

// ---------------------------------------------------------------------------
// Web Push (RFC 8291 + RFC 8292) – iOS Safari PWA
// ---------------------------------------------------------------------------

async function sendWebPush(env, subscription, title, body, tag) {
  const { endpoint, keys } = subscription;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    console.error('Invalid Web Push subscription object.');
    return;
  }

  const payload = new TextEncoder().encode(
    JSON.stringify({
      title: `⏰ ${title}`,
      body: body || '',
      icon: '/icons/icon-192.png',
      tag,
    })
  );

  const { encrypted, salt, serverPublicKey } = await encryptWebPushPayload(
    payload,
    base64urlToBytes(keys.p256dh),
    base64urlToBytes(keys.auth)
  );

  // Build RFC 8291 content body: salt(16) + rs(4) + idlen(1) + serverPublicKey(65) + ciphertext
  const serverPubBytes = new Uint8Array(serverPublicKey);
  const rs = 4096;
  const contentBody = new Uint8Array(21 + serverPubBytes.length + encrypted.byteLength);
  contentBody.set(salt, 0);
  new DataView(contentBody.buffer).setUint32(16, rs, false);
  contentBody[20] = serverPubBytes.length;
  contentBody.set(serverPubBytes, 21);
  contentBody.set(new Uint8Array(encrypted), 21 + serverPubBytes.length);

  const origin = new URL(endpoint).origin;
  const vapidAuth = await buildVapidAuthorization(env, origin);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: vapidAuth,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
      Urgency: 'high',
    },
    body: contentBody,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Web Push send failed:', res.status, text);
  }
}

/**
 * Encrypt a Web Push payload using RFC 8291 (aes128gcm content encoding).
 */
async function encryptWebPushPayload(plaintext, uaPub, authSecret) {
  // Generate ephemeral ECDH key pair for the application server
  const ephemeral = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Export ephemeral public key as raw uncompressed point (65 bytes)
  const serverPublicKey = await crypto.subtle.exportKey('raw', ephemeral.publicKey);

  // Import UA's public key
  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPub,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: uaPublicKey },
    ephemeral.privateKey,
    256
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // PRK_key = HKDF-SHA-256(salt=authSecret, IKM=sharedSecret,
  //                         info="WebPush: info\0" || uaPub || serverPub, L=32)
  const prkInfo = buildConcatBytes(
    new TextEncoder().encode('WebPush: info\0'),
    uaPub,
    new Uint8Array(serverPublicKey)
  );
  const prk = await hkdf(authSecret, sharedSecret, prkInfo, 32);

  // Random 16-byte salt for content encryption
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // CEK = HKDF-SHA-256(salt, IKM=prk, info="Content-Encoding: aes128gcm\0", L=16)
  const cek = await hkdf(
    salt,
    prk,
    new TextEncoder().encode('Content-Encoding: aes128gcm\0'),
    16
  );

  // Nonce = HKDF-SHA-256(salt, IKM=prk, info="Content-Encoding: nonce\0", L=12)
  const nonce = await hkdf(
    salt,
    prk,
    new TextEncoder().encode('Content-Encoding: nonce\0'),
    12
  );

  // Pad plaintext: content || 0x02 (last-record delimiter per RFC 8291)
  const padded = new Uint8Array(plaintext.length + 1);
  padded.set(plaintext);
  padded[plaintext.length] = 0x02;

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, tagLength: 128 },
    aesKey,
    padded
  );

  return { encrypted, salt, serverPublicKey };
}

/**
 * Build the VAPID Authorization header value for iOS Web Push (RFC 8292).
 * Format: "vapid t=<JWT>,k=<publicKey>"
 */
async function buildVapidAuthorization(env, audience) {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'ES256' };
  const jwtPayload = {
    aud: audience,
    exp: now + 43200, // 12 hours
    sub: 'mailto:admin@remindme.app',
  };

  const b64Header = toBase64Url(JSON.stringify(header));
  const b64Payload = toBase64Url(JSON.stringify(jwtPayload));
  const signingInput = `${b64Header}.${b64Payload}`;

  const privateKey = await importVapidPrivateKey(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${toBase64UrlBytes(new Uint8Array(signature))}`;
  return `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`;
}

/**
 * Import VAPID private key from base64url-encoded 32-byte scalar.
 * Reconstructs JWK from the public key (x, y) and private key (d) components.
 */
async function importVapidPrivateKey(publicKeyB64url, privateKeyB64url) {
  const pubBytes = base64urlToBytes(publicKeyB64url); // 65-byte uncompressed P-256 point
  const x = toBase64UrlBytes(pubBytes.slice(1, 33));
  const y = toBase64UrlBytes(pubBytes.slice(33, 65));
  const jwk = { kty: 'EC', crv: 'P-256', d: privateKeyB64url, x, y };
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

// ---------------------------------------------------------------------------
// Crypto utilities
// ---------------------------------------------------------------------------

async function hkdf(salt, ikm, info, length) {
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    ikmKey,
    length * 8
  );
  return new Uint8Array(bits);
}

function buildConcatBytes(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function base64urlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
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
