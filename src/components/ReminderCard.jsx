import { useState } from 'react';

function formatDateTime(iso) {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTimeStatus(datetime, notified) {
  if (notified) return { label: 'Done', color: 'text-slate-500' };
  const diff = new Date(datetime) - new Date();
  if (diff < 0) return { label: 'Overdue', color: 'text-red-400' };
  const hours = diff / 1000 / 60 / 60;
  if (hours < 1) return { label: `${Math.ceil(diff / 1000 / 60)}m left`, color: 'text-yellow-400' };
  if (hours < 24) return { label: `${Math.ceil(hours)}h left`, color: 'text-brand-400' };
  const days = Math.ceil(hours / 24);
  return { label: `${days}d left`, color: 'text-slate-400' };
}

export default function ReminderCard({ reminder, onDelete, onMarkDone }) {
  const [showDelete, setShowDelete] = useState(false);
  const status = getTimeStatus(reminder.datetime, reminder.notified);

  return (
    <div
      className={`bg-slate-800 rounded-2xl p-4 border transition-all ${
        !reminder.notified && new Date(reminder.datetime) < new Date()
          ? 'border-red-500/50 shadow-lg shadow-red-500/10'
          : 'border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className={`font-semibold text-base leading-snug ${
                reminder.notified ? 'text-slate-500 line-through' : 'text-white'
              }`}
            >
              {reminder.title}
            </h3>
            <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{formatDateTime(reminder.datetime)}</p>
          {reminder.note && (
            <p className="text-slate-400 text-sm mt-1 leading-relaxed break-all">{reminder.note}</p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {!reminder.notified && (
            <button
              onClick={() => onMarkDone(reminder.id)}
              className="p-2 text-slate-400 hover:text-green-400 rounded-lg transition-colors"
              aria-label="Mark done"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowDelete(true)}
            className="p-2 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
            aria-label="Delete reminder"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {showDelete && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onDelete(reminder.id)}
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
