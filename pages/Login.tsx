import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../components/AuthProvider';
import { login } from '../services/auth';

export const Login: React.FC = () => {
  const { account, setAccount } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (account) return <Navigate to={account.role === 'TUTOR' ? '/' : '/student-home'} replace />;
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const next = await login(email.trim().toLowerCase(), password);
      setAccount(next);
      navigate(next.role === 'TUTOR' ? '/' : '/student-home', { replace: true });
    } catch (cause) { setError(cause instanceof TypeError ? 'Cannot reach the account server. Check your connection.' : 'Could not sign in. Check your email and password.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-5">
    <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-slate-900 p-6 space-y-4 border border-white/10">
      <h1 className="text-2xl font-semibold">Sign in to Solace</h1>
      <label className="block text-sm">Email<input className="mt-1 w-full rounded-xl bg-slate-800 p-3" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label className="block text-sm">Password<div className="flex mt-1 rounded-xl bg-slate-800"><input className="min-w-0 flex-1 bg-transparent p-3" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /><button type="button" className="px-3 text-blue-300" onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></div></label>
      {error && <p role="alert" className="text-rose-300 text-sm">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-blue-600 p-3 font-semibold disabled:opacity-50">{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </main>;
};
