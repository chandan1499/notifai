const NOTES_KEY = 'remindme_notes';
const REMINDERS_KEY = 'remindme_reminders';

export function exportData(notes, reminders) {
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    notes,
    reminders,
  };

  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `remindme-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Reads a JSON backup file and returns { notes, reminders }.
 * Throws if file is invalid.
 */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data.notes) || !Array.isArray(data.reminders)) {
          reject(new Error('Invalid backup file format'));
          return;
        }
        resolve({ notes: data.notes, reminders: data.reminders });
      } catch {
        reject(new Error('Could not parse backup file'));
      }
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsText(file);
  });
}

/**
 * Merge: add notes/reminders from backup that don't already exist (by id).
 */
export function mergeData(existingNotes, existingReminders, backupNotes, backupReminders) {
  const existingNoteIds = new Set(existingNotes.map((n) => n.id));
  const existingReminderIds = new Set(existingReminders.map((r) => r.id));

  const newNotes = backupNotes.filter((n) => !existingNoteIds.has(n.id));
  const newReminders = backupReminders.filter((r) => !existingReminderIds.has(r.id));

  return {
    notes: [...existingNotes, ...newNotes],
    reminders: [...existingReminders, ...newReminders],
  };
}
