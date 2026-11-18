import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, post } from '../services/api';
import { useAuth } from '../components/AuthProvider';
import { login } from '../services/auth';

interface InvitationInfo { kind: 'new-student' | 'existing-student'; studentName: string; teacherName?: string; email: string; expiresAt: string }
export const Activate: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { account, setAccount } = useAuth();
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<InvitationInfo>(`/api/public/invitations/${encodeURIComponent(token)}`).then(setInfo).catch(() => setError('Invitation is invalid or expired.')); }, [token]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try { await post('/api/public/activate', { token, password }); navigate('/login', { replace: true }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Activation failed.'); }
    finally { setBusy(false); }
  };
  const acceptLink = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      if (account?.email.toLowerCase() !== info?.email.toLowerCase() || account?.role !== 'STUDENT') {
        const next = await login(info?.email || '', password);
        if (next.role !== 'STUDENT') throw new Error('Sign in with the invited student account.');
        setAccount(next);
      }
      await post(`/api/student/invitations/${encodeURIComponent(token)}/accept`);
      navigate('/student-home', { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not link this teacher.'); }
    finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-slate-950 text-white grid place-items-center p-5"><div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-4">
    <h1 className="text-xl font-semibold">{info?.kind === 'existing-student' ? 'Add your teacher' : 'Activate student account'}</h1>
    {info && <><p className="text-sm">{info.studentName}<br /><span className="text-slate-300">{info.email}</span></p>{info.teacherName && <p className="text-sm text-blue-200">Teacher: {info.teacherName}</p>}<p className="text-xs text-slate-400">Invitation expires {new Date(info.expiresAt).toLocaleString()}</p>
      {info.kind === 'existing-student' ? <form onSubmit={acceptLink} className="space-y-4">
        {account?.email.toLowerCase() !== info.email.toLowerCase() || account?.role !== 'STUDENT' ? <label className="block text-sm">Your existing password<input className="mt-1 w-full bg-slate-800 rounded-xl p-3" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label> : <p className="text-sm text-slate-300">Signed in as {account.email}</p>}
        <button disabled={busy} className="w-full bg-blue-600 rounded-xl p-3 disabled:opacity-50">{busy ? 'Linking…' : 'Accept teacher invitation'}</button>
      </form> :
      <form onSubmit={submit} className="space-y-4"><label className="block text-sm">New password<input className="mt-1 w-full bg-slate-800 rounded-xl p-3" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label className="block text-sm">Confirm password<input className="mt-1 w-full bg-slate-800 rounded-xl p-3" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
      <button className="w-full bg-blue-600 rounded-xl p-3 disabled:opacity-50" disabled={busy}>{busy ? 'Activating…' : 'Activate account'}</button></form>}</>}
    {error && <p role="alert" className="text-rose-300 text-sm">{error}</p>}
    <Link className="text-blue-300 text-sm" to="/login">Back to sign in</Link>
  </div></main>;
};
