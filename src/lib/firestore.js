import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

export function getNotesRef(userId) {
  return collection(db, 'users', userId, 'notes');
}

export function getRemindersRef(userId) {
  return collection(db, 'users', userId, 'reminders');
}

// Notes
export async function fsAddNote(userId, note) {
  const ref = doc(getNotesRef(userId), note.id);
  await setDoc(ref, note);
}

export async function fsUpdateNote(userId, id, fields) {
  const ref = doc(getNotesRef(userId), id);
  await updateDoc(ref, fields);
}

export async function fsDeleteNote(userId, id) {
  await deleteDoc(doc(getNotesRef(userId), id));
}

// Reminders
export async function fsAddReminder(userId, reminder) {
  const ref = doc(getRemindersRef(userId), reminder.id);
  await setDoc(ref, reminder);
}

export async function fsUpdateReminder(userId, id, fields) {
  const ref = doc(getRemindersRef(userId), id);
  await updateDoc(ref, fields);
}

export async function fsDeleteReminder(userId, id) {
  await deleteDoc(doc(getRemindersRef(userId), id));
}

// Save FCM token (Chrome/Android) to users/{userId} document
export async function saveFcmToken(userId, token) {
  const ref = doc(db, 'users', userId);
  await setDoc(ref, { fcmToken: token, updatedAt: new Date().toISOString() }, { merge: true });
}

// Save Web Push subscription (iOS Safari) to users/{userId} document
export async function saveWebPushSubscription(userId, subscription) {
  const ref = doc(db, 'users', userId);
  await setDoc(
    ref,
    { webPushSub: JSON.stringify(subscription), updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

// Batch replace all (used by import)
export async function fsReplaceAllNotes(userId, notes) {
  const batch = writeBatch(db);
  const ref = getNotesRef(userId);
  // Delete existing handled by caller clearing state; just write new
  notes.forEach((note) => {
    batch.set(doc(ref, note.id), note);
  });
  await batch.commit();
}

export async function fsReplaceAllReminders(userId, reminders) {
  const batch = writeBatch(db);
  const ref = getRemindersRef(userId);
  reminders.forEach((reminder) => {
    batch.set(doc(ref, reminder.id), reminder);
  });
  await batch.commit();
}
