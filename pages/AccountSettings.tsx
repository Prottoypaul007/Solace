import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../components/AuthProvider';
import { changePassword, logout } from '../services/auth';
import { clearTutorCache, hasPendingChanges, retrySync } from '../services/sync';

export const AccountSettings: React.FC = () => {
  const { account, setAccount } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const change = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await changePassword(oldPassword, newPassword); setOldPassword(''); setNewPassword(''); setNotice('Password changed.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not change password.'); }
    finally { setBusy(false); }
  };
  const signOut = async () => {
    setError('');
    try {
      if (account?.role === 'TUTOR' && hasPendingChanges()) await retrySync();
      await logout();
      if (account?.role === 'TUTOR') await clearTutorCache();
      setAccount(null); navigate('/login', { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign out.'); }
  };
  return <Layout title="Account" studentMode={account?.role === 'STUDENT'}><div className="space-y-5">
    <div className="rounded-2xl bg-slate-800 p-4"><p className="font-semibold">{account?.name}</p><p className="text-sm text-slate-300">{account?.email}</p><p className="text-xs text-blue-300 mt-2">{account?.role === 'TUTOR' ? 'Tutor' : 'Student'}</p></div>
    <form className="space-y-3" onSubmit={change}><h2 className="font-semibold">Change password</h2>
      <input className="w-full rounded-xl p-3 bg-slate-800" type="password" autoComplete="current-password" placeholder="Current password" required value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
      <input className="w-full rounded-xl p-3 bg-slate-800" type="password" autoComplete="new-password" placeholder="New password (12 characters minimum)" minLength={12} required value={newPassword} onChange={e => setNewPassword(e.target.value)} />
      <button disabled={busy} className="rounded-xl bg-blue-600 p-3 disabled:opacity-50">Save password</button>
    </form>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    <button className="rounded-xl border border-white/20 p-3 w-full" onClick={signOut}>Sign out</button>
  </div></Layout>;
};
