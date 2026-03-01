import { useState, useRef } from 'react';
import NoteCard from './NoteCard';
import { semanticSearch } from '../lib/groq';

export default function Notes({ notes, onAdd, onDelete, onEdit, apiKey }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [highlightIds, setHighlightIds] = useState(new Set());
  const searchTimeout = useRef(null);

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd(title, body);
    setTitle('');
    setBody('');
    setShowForm(false);
  };

  const handleSearch = async (value) => {
    setQuery(value);
    setSearchError('');
    clearTimeout(searchTimeout.current);

    if (!value.trim()) {
      setSearchResults(null);
      setHighlightIds(new Set());
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      if (!apiKey) {
        setSearchError('Set your Groq API key in Settings to enable smart search.');
        setSearchResults(notes.filter(
          (n) =>
            n.title.toLowerCase().includes(value.toLowerCase()) ||
            n.body.toLowerCase().includes(value.toLowerCase())
        ));
        return;
      }
      setSearching(true);
      try {
        const ids = await semanticSearch(value, notes, apiKey);
        const idSet = new Set(ids);
        setHighlightIds(idSet);
        setSearchResults(notes.filter((n) => idSet.has(n.id)));
      } catch (err) {
        setSearchError('Search failed: ' + err.message);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 600);
  };

  const displayedNotes = searchResults !== null ? searchResults : notes;

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="px-4 pt-4 pb-2 space-y-3">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Smart search... (e.g. flight, voucher)"
            className="w-full bg-slate-800 text-white pl-9 pr-4 py-3 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-500 border border-slate-700"
          />
          {searching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {searchError && (
          <p className="text-yellow-400 text-xs px-1">{searchError}</p>
        )}

        {query && searchResults !== null && (
          <p className="text-slate-500 text-xs px-1">
            {searchResults.length === 0
              ? 'No matching notes found'
              : `${searchResults.length} note${searchResults.length !== 1 ? 's' : ''} found`}
          </p>
        )}
      </div>

      {/* Add note form */}
      {showForm ? (
        <div className="px-4 pb-3">
          <div className="bg-slate-800 rounded-2xl p-4 border border-brand-500/50">
            <input
              className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 mb-2 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (required)"
              autoFocus
            />
            <textarea
              className="w-full bg-slate-700 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 resize-none min-h-[90px] placeholder-slate-500"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Save any info... e.g. SpiceJet ₹500 voucher code ABC123"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAdd}
                disabled={!title.trim()}
                className="flex-1 bg-brand-600 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold"
              >
                Save Note
              </button>
              <button
                onClick={() => { setShowForm(false); setTitle(''); setBody(''); }}
                className="flex-1 bg-slate-700 text-slate-300 rounded-xl py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pb-3">
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Note
          </button>
        </div>
      )}

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {displayedNotes.length === 0 && !query && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="w-14 h-14 text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-slate-500 text-sm">No notes yet</p>
            <p className="text-slate-600 text-xs mt-1">Tap &quot;Add Note&quot; to save anything</p>
          </div>
        )}
        {displayedNotes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            onDelete={onDelete}
            onEdit={onEdit}
            highlight={highlightIds.has(note.id)}
          />
        ))}
      </div>
    </div>
  );
}
