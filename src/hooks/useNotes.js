import { useState, useCallback } from 'react';

const STORAGE_KEY = 'remindme_notes';

function loadNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function useNotes() {
  const [notes, setNotes] = useState(loadNotes);

  const addNote = useCallback((title, body) => {
    const note = {
      id: crypto.randomUUID(),
      title: title.trim(),
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) => {
      const updated = [note, ...prev];
      saveNotes(updated);
      return updated;
    });
    return note;
  }, []);

  const deleteNote = useCallback((id) => {
    setNotes((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      saveNotes(updated);
      return updated;
    });
  }, []);

  const editNote = useCallback((id, title, body) => {
    setNotes((prev) => {
      const updated = prev.map((n) =>
        n.id === id
          ? { ...n, title: title.trim(), body: body.trim(), updatedAt: new Date().toISOString() }
          : n
      );
      saveNotes(updated);
      return updated;
    });
  }, []);

  const replaceAll = useCallback((newNotes) => {
    saveNotes(newNotes);
    setNotes(newNotes);
  }, []);

  return { notes, addNote, deleteNote, editNote, replaceAll };
}
