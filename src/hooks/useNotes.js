import { useState, useEffect, useCallback } from 'react';
import { getDocs, query, orderBy } from 'firebase/firestore';
import {
  getNotesRef,
  fsAddNote,
  fsUpdateNote,
  fsDeleteNote,
  fsReplaceAllNotes,
} from '../lib/firestore';

export function useNotes(userId) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch once on mount (and when userId changes)
  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setLoading(false);
      return;
    }

    const q = query(getNotesRef(userId), orderBy('createdAt', 'desc'));
    getDocs(q)
      .then((snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setNotes(data);
      })
      .catch((err) => console.error('Failed to fetch notes:', err))
      .finally(() => setLoading(false));
  }, [userId]);

  const addNote = useCallback(
    async (title, body) => {
      const note = {
        id: crypto.randomUUID(),
        title: title.trim(),
        body: body.trim(),
        createdAt: new Date().toISOString(),
      };
      // Update local state immediately, then persist
      setNotes((prev) => [note, ...prev]);
      await fsAddNote(userId, note);
      return note;
    },
    [userId]
  );

  const deleteNote = useCallback(
    async (id) => {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      await fsDeleteNote(userId, id);
    },
    [userId]
  );

  const editNote = useCallback(
    async (id, title, body) => {
      const updatedAt = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, title: title.trim(), body: body.trim(), updatedAt } : n
        )
      );
      await fsUpdateNote(userId, id, { title: title.trim(), body: body.trim(), updatedAt });
    },
    [userId]
  );

  const replaceAll = useCallback(
    async (newNotes) => {
      setNotes(newNotes);
      await fsReplaceAllNotes(userId, newNotes);
    },
    [userId]
  );

  return { notes, loading, addNote, deleteNote, editNote, replaceAll };
}
