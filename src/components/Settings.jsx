import { useState, useRef } from 'react';
import { resetGroqClient } from '../lib/groq';
import { exportData, readBackupFile, mergeData } from '../lib/backup';

export default function Settings({
  apiKey,
  onSaveApiKey,
  notes,
  reminders,
  onReplaceNotes,
  onReplaceReminders,
  onMergeData,
}) {
  const [keyInput, setKeyInput] = useState(apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState('merge');
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef(null);

  const handleSaveKey = () => {
    resetGroqClient();
    onSaveApiKey(keyInput.trim());
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 2000);
  };

  const handleExport = () => {
    exportData(notes, reminders);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const { notes: backupNotes, reminders: backupReminders } = await readBackupFile(file);
      if (importMode === 'replace') {
        onReplaceNotes(backupNotes);
        onReplaceReminders(backupReminders);
        setImportResult({
          ok: true,
          msg: `Replaced: ${backupNotes.length} notes, ${backupReminders.length} reminders restored.`,
        });
      } else {
        const merged = mergeData(notes, reminders, backupNotes, backupReminders);
        onMergeData(merged.notes, merged.reminders);
        const addedNotes = merged.notes.length - notes.length;
        const addedReminders = merged.reminders.length - reminders.length;
        setImportResult({
          ok: true,
          msg: `Merged: +${addedNotes} notes, +${addedReminders} reminders added.`,
        });
      }
    } catch (err) {
      setImportResult({ ok: false, msg: err.message });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 pt-4 pb-8 space-y-6">
      {/* Groq API Key */}
      <section className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
          <h2 className="font-semibold text-white">Groq API Key</h2>
        </div>
        <p className="text-slate-500 text-xs leading-relaxed">
          Required for smart AI search. Your key is stored only in this device&apos;s local storage and sent only to Groq.
        </p>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="gsk_..."
            className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-500"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
          >
            {showKey ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
        <button
          onClick={handleSaveKey}
          disabled={!keyInput.trim()}
          className="w-full bg-brand-600 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
        >
          {keySaved ? '✓ Saved!' : 'Save API Key'}
        </button>
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-brand-400 text-xs"
        >
          Get a free Groq API key →
        </a>
      </section>

      {/* Export */}
      <section className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <h2 className="font-semibold text-white">Export Backup</h2>
        </div>
        <p className="text-slate-500 text-xs leading-relaxed">
          Download all your notes and reminders as a JSON file. Save it to iCloud Drive or any safe place.
        </p>
        <div className="flex items-center gap-3 text-slate-500 text-xs">
          <span>{notes.length} notes</span>
          <span>·</span>
          <span>{reminders.length} reminders</span>
        </div>
        <button
          onClick={handleExport}
          className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
        >
          Download Backup JSON
        </button>
      </section>

      {/* Import */}
      <section className="bg-slate-800 rounded-2xl p-4 border border-slate-700 space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <h2 className="font-semibold text-white">Import Backup</h2>
        </div>
        <p className="text-slate-500 text-xs leading-relaxed">
          Restore from a previously exported JSON backup file.
        </p>

        {/* Mode selector */}
        <div className="flex rounded-xl overflow-hidden border border-slate-700">
          {['merge', 'replace'].map((mode) => (
            <button
              key={mode}
              onClick={() => setImportMode(mode)}
              className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                importMode === mode
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <p className="text-slate-600 text-xs">
          {importMode === 'merge'
            ? 'Adds items from backup that do not already exist (safe, keeps current data).'
            : 'Replaces ALL current data with the backup file contents.'}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors"
        >
          {importing ? 'Importing...' : 'Choose Backup File'}
        </button>

        {importResult && (
          <p className={`text-xs px-1 ${importResult.ok ? 'text-green-400' : 'text-red-400'}`}>
            {importResult.ok ? '✓ ' : '✗ '}
            {importResult.msg}
          </p>
        )}
      </section>

      {/* App info */}
      <section className="text-center text-slate-700 text-xs space-y-1 pb-4">
        <p>RemindMe</p>
        <p>All data stored locally on your device</p>
      </section>
    </div>
  );
}
