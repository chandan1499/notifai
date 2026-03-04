import { useState, useEffect, useCallback } from 'react';
import { useSwipeable } from 'react-swipeable';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
import Notes from './components/Notes';
import Reminders from './components/Reminders';
import Settings from './components/Settings';
import QuickAdd from './components/QuickAdd';
import Login from './components/Login';
import { useNotes } from './hooks/useNotes';
import { useReminders } from './hooks/useReminders';
import {
  requestNotificationPermission,
  getNotificationPermission,
  scheduleNotification,
  cancelScheduledNotification,
} from './lib/notifications';
import { initFCM, listenForegroundMessages } from './lib/fcm';

const API_KEY_STORAGE = 'remindme_groq_api_key';

function loadApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

const TABS = [
  {
    id: 'notes',
    label: 'Notes',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'reminders',
    label: 'Reminders',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const TAB_IDS = TABS.map((t) => t.id);

function MainApp({ userId }) {
  const [activeTab, setActiveTab] = useState('notes');
  const [swipeDir, setSwipeDir] = useState(null); // 'left' | 'right' | null
  const [apiKey, setApiKey] = useState(loadApiKey);
  const [notifPermission, setNotifPermission] = useState(getNotificationPermission);

  const navigateTab = useCallback((newTab) => {
    const curIdx = TAB_IDS.indexOf(activeTab);
    const newIdx = TAB_IDS.indexOf(newTab);
    setSwipeDir(newIdx > curIdx ? 'right' : 'left');
    setActiveTab(newTab);
  }, [activeTab]);

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const idx = TAB_IDS.indexOf(activeTab);
      if (idx < TAB_IDS.length - 1) navigateTab(TAB_IDS[idx + 1]);
    },
    onSwipedRight: () => {
      const idx = TAB_IDS.indexOf(activeTab);
      if (idx > 0) navigateTab(TAB_IDS[idx - 1]);
    },
    preventScrollOnSwipe: false,
    trackTouch: true,
    delta: 50,
  });

  const { notes, addNote, deleteNote, editNote, replaceAll: replaceAllNotes } = useNotes(userId);
  const {
    reminders,
    overdueReminders,
    upcomingReminders,
    doneReminders,
    addReminder,
    deleteReminder,
    markNotified,
    replaceAll: replaceAllReminders,
  } = useReminders(userId);

  useEffect(() => {
    if (notifPermission !== 'granted') return;
    upcomingReminders.forEach((r) => {
      scheduleNotification(r.id, r.title, r.datetime);
    });
  }, [upcomingReminders, notifPermission]);

  const handleAddReminder = useCallback(
    async (title, datetime, note) => {
      const reminder = await addReminder(title, datetime, note);
      if (notifPermission === 'granted' && reminder) {
        scheduleNotification(reminder.id, reminder.title, reminder.datetime);
      }
    },
    [addReminder, notifPermission]
  );

  const handleDeleteReminder = useCallback(
    (id) => {
      cancelScheduledNotification(id);
      deleteReminder(id);
    },
    [deleteReminder]
  );

  const handleMarkDone = useCallback(
    (id) => {
      cancelScheduledNotification(id);
      markNotified(id);
    },
    [markNotified]
  );

  const handleSaveApiKey = useCallback((key) => {
    localStorage.setItem(API_KEY_STORAGE, key);
    setApiKey(key);
  }, []);

  const handleRequestPermission = useCallback(async () => {
    const result = await requestNotificationPermission();
    setNotifPermission(result);
    if (result === 'granted' && userId) {
      initFCM(userId);
    }
  }, [userId]);

  // Init FCM on mount if permission already granted
  useEffect(() => {
    if (notifPermission === 'granted' && userId) {
      initFCM(userId);
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show foreground notification when app is open and FCM message arrives
  useEffect(() => {
    const unsubscribe = listenForegroundMessages((payload) => {
      const n = payload.notification || {};
      if (n.title) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(n.title, {
            body: n.body || '',
            icon: '/icons/icon-192.png',
            tag: payload.webpush?.notification?.tag || 'reminder',
          });
        });
      }
    });
    return unsubscribe;
  }, []);

  const handleMergeData = useCallback(
    async (mergedNotes, mergedReminders) => {
      await replaceAllNotes(mergedNotes);
      await replaceAllReminders(mergedReminders);
    },
    [replaceAllNotes, replaceAllReminders]
  );

  const overdueCount = overdueReminders.length;
  const showApiKeyBanner = !apiKey && activeTab === 'notes';

  return (
    <div className="flex flex-col max-w-md mx-auto bg-slate-950" style={{ height: '100dvh' }}>
      <header className="px-5 pb-3 flex items-center justify-between shrink-0" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">RemindMe</h1>
          <p className="text-slate-500 text-xs capitalize">{activeTab}</p>
        </div>
        {activeTab === 'notes' && (
          <div className="bg-slate-800 rounded-xl px-3 py-1.5 text-slate-400 text-xs">
            {notes.length} note{notes.length !== 1 ? 's' : ''}
          </div>
        )}
        {activeTab === 'reminders' && overdueCount > 0 && (
          <div className="bg-red-500/20 rounded-xl px-3 py-1.5 text-red-400 text-xs font-medium">
            {overdueCount} overdue
          </div>
        )}
      </header>

      {showApiKeyBanner && (
        <div className="mx-4 mb-2 bg-brand-500/10 border border-brand-500/30 rounded-2xl px-4 py-3 flex items-center gap-3">
          <svg className="w-4 h-4 text-brand-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-brand-300 text-xs flex-1">
            Add your Groq API key in{' '}
            <button onClick={() => setActiveTab('settings')} className="underline font-semibold">
              Settings
            </button>{' '}
            to enable smart search.
          </p>
        </div>
      )}

      <main
        className="flex-1 overflow-hidden"
        {...swipeHandlers}
      >
        <div
          key={activeTab}
          className={`h-full ${swipeDir === 'right' ? 'animate-slide-in-right' : swipeDir === 'left' ? 'animate-slide-in-left' : ''}`}
        >
          {activeTab === 'notes' && (
            <Notes notes={notes} onAdd={addNote} onDelete={deleteNote} onEdit={editNote} apiKey={apiKey} />
          )}
          {activeTab === 'reminders' && (
            <Reminders
              overdueReminders={overdueReminders}
              upcomingReminders={upcomingReminders}
              doneReminders={doneReminders}
              onAdd={handleAddReminder}
              onDelete={handleDeleteReminder}
              onMarkDone={handleMarkDone}
              notifPermission={notifPermission}
              onRequestPermission={handleRequestPermission}
            />
          )}
          {activeTab === 'settings' && (
            <Settings
              apiKey={apiKey}
              onSaveApiKey={handleSaveApiKey}
              notes={notes}
              reminders={reminders}
              onReplaceNotes={replaceAllNotes}
              onReplaceReminders={replaceAllReminders}
              onMergeData={handleMergeData}
            />
          )}
        </div>
      </main>

      <QuickAdd onAddNote={addNote} onAddReminder={handleAddReminder} apiKey={apiKey} />

      <nav
        className="shrink-0 bg-slate-900 border-t border-slate-800 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const badge = tab.id === 'reminders' && overdueCount > 0 ? overdueCount : null;
          return (
            <button
              key={tab.id}
              onClick={() => navigateTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors relative ${
                isActive ? 'text-brand-400' : 'text-slate-500'
              }`}
            >
              <span className="relative">
                {tab.icon}
                {badge && (
                  <span className="absolute -top-1 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  const [authState, setAuthState] = useState('loading'); // 'loading' | 'authenticated' | 'unauthenticated'
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        setAuthState('authenticated');
      } else {
        setUserId(null);
        setAuthState('unauthenticated');
      }
    });
    return () => unsubscribe();
  }, []);

  if (authState === 'loading') {
    return (
      <div className="flex items-center justify-center bg-slate-950" style={{ height: '100dvh' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (authState === 'unauthenticated') {
    return <Login />;
  }

  return <MainApp userId={userId} />;
}
