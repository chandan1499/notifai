import { useState } from 'react';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function NoteCard({ note, onDelete, onEdit, highlight }) {
  const [showFull, setShowFull] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editBody, setEditBody] = useState(note.body);
  const [showDelete, setShowDelete] = useState(false);

  const handleSave = () => {
    if (!editTitle.trim()) return;
    onEdit(note.id, editTitle, editBody);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
        <input
          className="w-full bg-slate-700 text-white rounded-xl px-3 py-2 mb-2 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          placeholder="Title"
        />
        <textarea
          className="w-full bg-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 resize-none min-h-[80px]"
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          placeholder="Note content..."
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleSave}
            className="flex-1 bg-brand-600 text-white rounded-xl py-2 text-sm font-medium"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex-1 bg-slate-700 text-slate-300 rounded-xl py-2 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-slate-800 rounded-2xl p-4 border transition-all ${
        highlight ? 'border-brand-500 shadow-lg shadow-brand-500/20' : 'border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-base leading-snug truncate">
            {note.title}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{formatDate(note.createdAt)}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-2 text-slate-400 hover:text-brand-400 rounded-lg transition-colors"
            aria-label="Edit note"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => setShowDelete(true)}
            className="p-2 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
            aria-label="Delete note"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {note.body && (
        <div className="mt-2">
          <p
            className={`text-slate-300 text-sm leading-relaxed whitespace-pre-wrap ${
              !showFull && note.body.length > 120 ? 'line-clamp-3' : ''
            }`}
          >
            {note.body}
          </p>
          {note.body.length > 120 && (
            <button
              onClick={() => setShowFull((v) => !v)}
              className="text-brand-400 text-xs mt-1"
            >
              {showFull ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {showDelete && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onDelete(note.id)}
            className="flex-1 bg-red-600 text-white rounded-xl py-2 text-sm font-medium"
          >
            Delete
          </button>
          <button
            onClick={() => setShowDelete(false)}
            className="flex-1 bg-slate-700 text-slate-300 rounded-xl py-2 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
