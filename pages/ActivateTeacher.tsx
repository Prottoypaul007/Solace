import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, post } from '../services/api';

export const ActivateTeacher: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [info, setInfo] = useState<{email: string; expiresAt: string} | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<{email: string; expiresAt: string}>(`/api/public/teacher-invitations/${encodeURIComponent(token)}`).then(setInfo).catch(() => setError('Invitation is invalid or expired.')); }, [token]);
  const activate = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try { await post('/api/public/activate-teacher', { token, name: name.trim(), password }); navigate('/login', { replace: true }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not activate account.'); }
    finally { setBusy(false); }
  };
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-5 text-white"><div className="w-full max-w-sm space-y-4 rounded-3xl border border-white/10 bg-slate-900 p-6">
    <h1 className="text-xl font-bold">Create teacher account</h1>
    {info && <><p className="text-sm text-slate-300">{info.email}</p><p className="text-xs text-slate-400">Invitation expires {new Date(info.expiresAt).toLocaleString()}</p><form onSubmit={activate} className="space-y-3">
      <label className="block text-sm">Your name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 px-3" /></label>
      <label className="block text-sm">Password<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 px-3" /></label>
      <label className="block text-sm">Confirm password<input required type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl bg-slate-800 px-3" /></label>
      <button disabled={busy} className="min-h-12 w-full rounded-xl bg-blue-600 font-semibold disabled:opacity-50">{busy ? 'Creating account…' : 'Create account'}</button>
    </form></>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    <Link to="/login" className="block text-sm text-blue-300">Back to sign in</Link>
  </div></main>;
};
