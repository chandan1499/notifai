import { useState, useEffect, useRef, useCallback } from 'react';
import { parseNaturalInput } from '../lib/groq';

function toLocalDatetimeValue(isoString) {
  const date = isoString ? new Date(isoString) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export default function QuickAdd({ onAddNote, onAddReminder, apiKey }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [stage, setStage] = useState('input'); // 'input' | 'loading' | 'preview'
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Preview edit state
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewBody, setPreviewBody] = useState('');
  const [previewDatetime, setPreviewDatetime] = useState('');
  const [previewNote, setPreviewNote] = useState('');

  // Voice
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);

  const supportsVoice = Boolean(SpeechRecognitionAPI);

  const resetAll = useCallback(() => {
    setText('');
    setStage('input');
    setParsed(null);
    setError('');
    setSaved(false);
    setRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    resetAll();
  }, [resetAll]);

  // Auto-focus textarea when sheet opens
  useEffect(() => {
    if (open && stage === 'input') {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open, stage]);

  // Stop recording if sheet closes
  useEffect(() => {
    if (!open && recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setRecording(false);
    }
  }, [open]);

  const toggleRecording = useCallback(() => {
    if (!SpeechRecognitionAPI) return;

    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = text;

    recognition.onresult = (event) => {
      let interim = '';
      let newFinal = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          newFinal += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (newFinal) {
        finalTranscript = (finalTranscript ? finalTranscript + ' ' : '') + newFinal;
      }
      setText(finalTranscript + (interim ? ' ' + interim : ''));
    };

    recognition.onend = () => {
      setRecording(false);
      setText(finalTranscript.trim());
      recognitionRef.current = null;
    };

    recognition.onerror = (e) => {
      if (e.error !== 'aborted') {
        setError('Microphone error: ' + e.error);
      }
      setRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
    setError('');
  }, [recording, text]);

  const handleSendToAI = useCallback(async () => {
    if (!text.trim()) return;
    if (!apiKey) {
      setError('Add your Groq API key in Settings first.');
      return;
    }
    setStage('loading');
    setError('');
    try {
      const result = await parseNaturalInput(text.trim(), apiKey);
      setParsed(result);
      setPreviewTitle(result.title || '');
      if (result.type === 'note') {
        setPreviewBody(result.body || '');
      } else {
        setPreviewDatetime(toLocalDatetimeValue(result.datetime));
        setPreviewNote(result.note || '');
      }
      setStage('preview');
    } catch (err) {
      setError('AI parsing failed: ' + err.message);
      setStage('input');
    }
  }, [text, apiKey]);

  const handleConfirm = useCallback(() => {
    if (!parsed) return;
    if (!previewTitle.trim()) return;

    if (parsed.type === 'note') {
      onAddNote(previewTitle, previewBody);
    } else {
      const isoDatetime = previewDatetime
        ? new Date(previewDatetime).toISOString()
        : new Date().toISOString();
      onAddReminder(previewTitle, isoDatetime, previewNote);
    }

    setSaved(true);
    setTimeout(() => {
      handleClose();
    }, 900);
  }, [parsed, previewTitle, previewBody, previewDatetime, previewNote, onAddNote, onAddReminder, handleClose]);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-4 z-40 w-14 h-14 bg-brand-600 hover:bg-brand-500 active:scale-95 text-white rounded-full shadow-lg shadow-brand-900/50 flex items-center justify-center transition-all"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4.5rem)' }}
        aria-label="Quick add"
      >
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Backdrop + Bottom sheet */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={handleBackdropClick}
        >
          {/* Dim backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Sheet */}
          <div
            className="relative bg-slate-900 rounded-t-3xl border-t border-slate-700 w-full max-w-md mx-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="font-bold text-white text-base">
                {stage === 'preview'
                  ? saved
                    ? '✓ Saved!'
                    : `Saving as ${parsed?.type === 'reminder' ? 'Reminder' : 'Note'}`
                  : 'Quick Add'}
              </h2>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-white p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 pb-2 space-y-3">
              {/* ── INPUT STAGE ── */}
              {stage === 'input' && (
                <>
                  <p className="text-slate-500 text-xs">
                    Type or speak anything — AI will decide if it&apos;s a note or reminder.
                  </p>

                  <div className="relative">
                    <textarea
                      ref={textareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={
                        'e.g. "remind me to call doctor tomorrow 3pm"\nor "SpiceJet ₹500 voucher code ABC123"'
                      }
                      rows={4}
                      className="w-full bg-slate-800 text-white rounded-2xl px-4 py-3 pr-12 text-sm outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-600 resize-none border border-slate-700"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSendToAI();
                      }}
                    />
                    {/* Mic button inside textarea area */}
                    {supportsVoice && (
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={toggleRecording}
                        className={`absolute bottom-3 right-3 p-2 rounded-xl transition-all ${
                          recording
                            ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/40'
                            : 'bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600'
                        }`}
                        aria-label={recording ? 'Stop recording' : 'Start voice input'}
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {recording && (
                    <p className="text-red-400 text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse inline-block" />
                      Listening... tap mic to stop
                    </p>
                  )}

                  {error && <p className="text-red-400 text-xs">{error}</p>}

                  <button
                    onClick={handleSendToAI}
                    disabled={!text.trim()}
                    className="w-full bg-brand-600 disabled:opacity-40 hover:bg-brand-700 text-white rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Send to AI
                  </button>
                </>
              )}

              {/* ── LOADING STAGE ── */}
              {stage === 'loading' && (
                <div className="flex flex-col items-center py-10 gap-4">
                  <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400 text-sm">AI is reading your input...</p>
                </div>
              )}

              {/* ── PREVIEW STAGE ── */}
              {stage === 'preview' && parsed && !saved && (
                <>
                  {/* Type badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        parsed.type === 'reminder'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-brand-500/20 text-brand-400'
                      }`}
                    >
                      {parsed.type === 'reminder' ? 'Reminder' : 'Note'}
                    </span>
                    <span className="text-slate-600 text-xs">Edit before saving</span>
                  </div>

                  {/* Editable title */}
                  <div>
                    <label className="text-slate-500 text-xs mb-1 block">Title</label>
                    <input
                      className="w-full bg-slate-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 border border-slate-700"
                      value={previewTitle}
                      onChange={(e) => setPreviewTitle(e.target.value)}
                      placeholder="Title"
                    />
                  </div>

                  {parsed.type === 'note' && (
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block">Content</label>
                      <textarea
                        rows={3}
                        className="w-full bg-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 resize-none border border-slate-700"
                        value={previewBody}
                        onChange={(e) => setPreviewBody(e.target.value)}
                        placeholder="Note content..."
                      />
                    </div>
                  )}

                  {parsed.type === 'reminder' && (
                    <>
                      <div>
                        <label className="text-slate-500 text-xs mb-1 block">Date &amp; Time</label>
                        <input
                          type="datetime-local"
                          className="w-full bg-slate-800 text-white rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 border border-slate-700"
                          value={previewDatetime}
                          onChange={(e) => setPreviewDatetime(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-slate-500 text-xs mb-1 block">Note (optional)</label>
                        <input
                          className="w-full bg-slate-800 text-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 border border-slate-700"
                          value={previewNote}
                          onChange={(e) => setPreviewNote(e.target.value)}
                          placeholder="Extra details..."
                        />
                      </div>
                    </>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleConfirm}
                      disabled={!previewTitle.trim()}
                      className="flex-1 bg-brand-600 disabled:opacity-40 text-white rounded-2xl py-3 text-sm font-semibold"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setStage('input'); setParsed(null); }}
                      className="flex-1 bg-slate-800 text-slate-300 rounded-2xl py-3 text-sm font-medium border border-slate-700"
                    >
                      Edit input
                    </button>
                  </div>
                </>
              )}

              {/* Saved confirmation */}
              {saved && (
                <div className="flex flex-col items-center py-8 gap-3">
                  <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-green-400 text-sm font-medium">
                    {parsed?.type === 'reminder' ? 'Reminder set!' : 'Note saved!'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
