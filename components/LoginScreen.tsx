import React, { useState, useEffect, FormEvent } from 'react';
import { Session } from '../types';
import {
  authenticate,
  isDefaultAdminPasswordActive,
  saveSession,
  seedAdminIfNeeded,
} from '../services/authService';

interface LoginScreenProps {
  onLogin: (session: Session) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDefaultWarning, setShowDefaultWarning] = useState(false);

  useEffect(() => {
    seedAdminIfNeeded().then(() =>
      isDefaultAdminPasswordActive().then(active => setShowDefaultWarning(active))
    );
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setIsLoading(true);
    setError('');

    const session = await authenticate(username.trim(), password);
    setIsLoading(false);

    if (!session) {
      setError('Invalid username or password.');
      return;
    }

    saveSession(session);
    onLogin(session);
  };

  const roleColor: Record<string, string> = {
    annotator: 'text-indigo-400',
    reviewer: 'text-amber-400',
    admin: 'text-red-400',
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/40">
            <span className="font-bold text-2xl text-white">N</span>
          </div>
          <div>
            <h1 className="font-bold text-2xl text-gray-100 tracking-tight">NeuroLabel</h1>
            <p className="text-xs text-gray-500">Studio</p>
          </div>
        </div>

        {/* Default password warning */}
        {showDefaultWarning && (
          <div className="mb-4 flex items-start gap-2 p-3 bg-amber-950/60 border border-amber-700 rounded-lg text-xs text-amber-300">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>
              Default admin password is still active (<span className="font-mono">admin / admin123</span>).
              Change it in User Manager after logging in.
            </span>
          </div>
        )}

        {/* Card */}
        <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-1">Sign in</h2>
          <p className="text-xs text-gray-500 mb-5">Enter your credentials to access the workspace.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="your username"
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              {isLoading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : 'Sign in'
              }
            </button>
          </form>
        </div>

        {/* Role legend */}
        <div className="mt-4 flex justify-center gap-4 text-xs text-gray-600">
          {(['annotator', 'reviewer', 'admin'] as const).map(r => (
            <span key={r} className={`capitalize ${roleColor[r]}`}>{r}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
