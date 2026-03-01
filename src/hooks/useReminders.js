import { useState, useCallback } from 'react';

const STORAGE_KEY = 'remindme_reminders';

function loadReminders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveReminders(reminders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

export function useReminders() {
  const [reminders, setReminders] = useState(loadReminders);

  const addReminder = useCallback((title, datetime, note = '') => {
    const reminder = {
      id: crypto.randomUUID(),
      title: title.trim(),
      datetime,
      note: note.trim(),
      notified: false,
      createdAt: new Date().toISOString(),
    };
    setReminders((prev) => {
      const updated = [reminder, ...prev].sort(
        (a, b) => new Date(a.datetime) - new Date(b.datetime)
      );
      saveReminders(updated);
      return updated;
    });
    return reminder;
  }, []);

  const deleteReminder = useCallback((id) => {
    setReminders((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      saveReminders(updated);
      return updated;
    });
  }, []);

  const markNotified = useCallback((id) => {
    setReminders((prev) => {
      const updated = prev.map((r) => (r.id === id ? { ...r, notified: true } : r));
      saveReminders(updated);
      return updated;
    });
  }, []);

  const replaceAll = useCallback((newReminders) => {
    saveReminders(newReminders);
    setReminders(newReminders);
  }, []);

  const overdueReminders = reminders.filter(
    (r) => !r.notified && new Date(r.datetime) < new Date()
  );

  const upcomingReminders = reminders.filter(
    (r) => !r.notified && new Date(r.datetime) >= new Date()
  );

  const doneReminders = reminders.filter((r) => r.notified);

  return {
    reminders,
    overdueReminders,
    upcomingReminders,
    doneReminders,
    addReminder,
    deleteReminder,
    markNotified,
    replaceAll,
  };
}
