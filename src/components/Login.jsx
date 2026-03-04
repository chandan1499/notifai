import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export default function Login() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      }
      // Auth state change in App.jsx will handle the redirect
    } catch (err) {
      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Invalid email or password.');
          break;
        case 'auth/email-already-in-use':
          setError('Account already exists. Try signing in.');
          break;
        case 'auth/weak-password':
          setError('Password must be at least 6 characters.');
          break;
        case 'auth/invalid-email':
          setError('Enter a valid email address.');
          break;
        default:
          setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen bg-slate-950 px-6"
      style={{ minHeight: '100dvh' }}
    >
      <div className="w-full max-w-sm space-y-8">
        {/* Logo / title */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-brand-900/50">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">RemindMe</h1>
          <p className="text-slate-500 text-sm">
            {mode === 'signin' ? 'Sign in to access your notes and reminders' : 'Create an account to get started'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="w-full bg-slate-800 text-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 border border-slate-700 placeholder-slate-600"
            />
          </div>
          <div>
            <label className="text-slate-400 text-xs mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              className="w-full bg-slate-800 text-white rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 border border-slate-700 placeholder-slate-600"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs px-1">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-2xl py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors mt-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : mode === 'signin' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-slate-500 text-sm">
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button
                onClick={() => { setMode('signup'); setError(''); }}
                className="text-brand-400 font-medium"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('signin'); setError(''); }}
                className="text-brand-400 font-medium"
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="text-center text-slate-700 text-xs">
          Your data is stored securely in Firebase and tied to your account.
        </p>
      </div>
    </div>
  );
}
