import { useState, useEffect, useCallback } from 'react';
import { getDocs, query, orderBy } from 'firebase/firestore';
import {
  getRemindersRef,
  fsAddReminder,
  fsUpdateReminder,
  fsDeleteReminder,
  fsReplaceAllReminders,
} from '../lib/firestore';

export function useReminders(userId) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch once on mount (and when userId changes)
  useEffect(() => {
    if (!userId) {
      setReminders([]);
      setLoading(false);
      return;
    }

    const q = query(getRemindersRef(userId), orderBy('datetime', 'asc'));
    getDocs(q)
      .then((snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setReminders(data);
      })
      .catch((err) => console.error('Failed to fetch reminders:', err))
      .finally(() => setLoading(false));
  }, [userId]);

  const addReminder = useCallback(
    async (title, datetime, note = '') => {
      const reminder = {
        id: crypto.randomUUID(),
        title: title.trim(),
        datetime,
        note: note.trim(),
        notified: false,
        createdAt: new Date().toISOString(),
      };
      // Insert into local state sorted by datetime, then persist
      setReminders((prev) =>
        [...prev, reminder].sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
      );
      await fsAddReminder(userId, reminder);
      return reminder;
    },
    [userId]
  );

  const deleteReminder = useCallback(
    async (id) => {
      setReminders((prev) => prev.filter((r) => r.id !== id));
      await fsDeleteReminder(userId, id);
    },
    [userId]
  );

  const markNotified = useCallback(
    async (id) => {
      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, notified: true } : r))
      );
      await fsUpdateReminder(userId, id, { notified: true });
    },
    [userId]
  );

  const replaceAll = useCallback(
    async (newReminders) => {
      setReminders(newReminders);
      await fsReplaceAllReminders(userId, newReminders);
    },
    [userId]
  );

  const overdueReminders = reminders.filter(
    (r) => !r.notified && new Date(r.datetime) < new Date()
  );

  const upcomingReminders = reminders.filter(
    (r) => !r.notified && new Date(r.datetime) >= new Date()
  );

  const doneReminders = reminders.filter((r) => r.notified);

  return {
    reminders,
    loading,
    overdueReminders,
    upcomingReminders,
    doneReminders,
    addReminder,
    deleteReminder,
    markNotified,
    replaceAll,
  };
}
