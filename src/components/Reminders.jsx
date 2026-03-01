import { useState } from 'react';
import ReminderCard from './ReminderCard';

function toLocalDatetimeValue(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function Reminders({
  overdueReminders,
  upcomingReminders,
  doneReminders,
  onAdd,
  onDelete,
  onMarkDone,
  notifPermission,
  onRequestPermission,
}) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [datetime, setDatetime] = useState(toLocalDatetimeValue());
  const [note, setNote] = useState('');
  const [showDone, setShowDone] = useState(false);

  const handleAdd = () => {
    if (!title.trim() || !datetime) return;
    onAdd(title, new Date(datetime).toISOString(), note);
    setTitle('');
    setDatetime(toLocalDatetimeValue());
    setNote('');
    setShowForm(false);
  };

  const allActive = [...overdueReminders, ...upcomingReminders];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2 space-y-3">
        {/* Notification permission banner */}
        {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
          <button
            onClick={onRequestPermission}
            className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl px-4 py-3 text-sm flex items-center gap-3"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="text-left">
              Enable notifications to get alerts at reminder time.{' '}
              <span className="font-semibold underline">Tap to enable</span>
            </span>
          </button>
        )}

        {/* Overdue banner */}
        {overdueReminders.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl px-4 py-3">
            <p className="text-red-400 text-sm font-semibold">
              {overdueReminders.length} overdue reminder{overdueReminders.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}

        {/* Add button */}
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-brand-600 hover:bg-brand-700 active:bg-brand-800 text-white rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Reminder
          </button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="px-4 pb-3">
          <div className="bg-slate-800 rounded-2xl p-4 border border-brand-500/50 space-y-2">
            <input
              className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-500"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Reminder title (required)"
              autoFocus
            />
            <input
              type="datetime-local"
              className="w-full bg-slate-700 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              value={datetime}
              onChange={(e) => setDatetime(e.target.value)}
            />
            <textarea
              className="w-full bg-slate-700 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 resize-none min-h-[60px] placeholder-slate-500"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note..."
            />
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleAdd}
                disabled={!title.trim() || !datetime}
                className="flex-1 bg-brand-600 disabled:opacity-40 text-white rounded-xl py-2.5 text-sm font-semibold"
              >
                Set Reminder
              </button>
              <button
                onClick={() => { setShowForm(false); setTitle(''); setNote(''); }}
                className="flex-1 bg-slate-700 text-slate-300 rounded-xl py-2.5 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reminders list */}
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-4">
        {allActive.length === 0 && doneReminders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <svg className="w-14 h-14 text-slate-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-slate-500 text-sm">No reminders yet</p>
            <p className="text-slate-600 text-xs mt-1">Tap &quot;Add Reminder&quot; to get started</p>
          </div>
        )}

        {/* Overdue first */}
        {overdueReminders.map((r) => (
          <ReminderCard key={r.id} reminder={r} onDelete={onDelete} onMarkDone={onMarkDone} />
        ))}

        {/* Upcoming */}
        {upcomingReminders.map((r) => (
          <ReminderCard key={r.id} reminder={r} onDelete={onDelete} onMarkDone={onMarkDone} />
        ))}

        {/* Done section */}
        {doneReminders.length > 0 && (
          <div>
            <button
              onClick={() => setShowDone((v) => !v)}
              className="flex items-center gap-2 text-slate-500 text-sm py-2"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showDone ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {doneReminders.length} completed
            </button>
            {showDone &&
              doneReminders.map((r) => (
                <div key={r.id} className="mt-2">
                  <ReminderCard reminder={r} onDelete={onDelete} onMarkDone={onMarkDone} />
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
