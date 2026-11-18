import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Student } from '../types';
import { api, post } from '../services/api';
import { retrySync } from '../services/sync';
import { isRecoveredStudent } from '../services/recoveredStudents';

interface LinkedAccount { id: string; studentId: string; email: string; status: 'PENDING' | 'ACTIVE' | 'DISABLED'; studentName: string }
interface TutorData { data: { students: Student[] } }
export const StudentAccounts: React.FC = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const focusedStudent = params.get('student');
  const [students, setStudents] = useState<Student[]>([]);
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = async () => {
    await retrySync();
    const [records, linked] = await Promise.all([api<TutorData>('/api/tutor/data'), api<LinkedAccount[]>('/api/tutor/accounts')]);
    setStudents(records.data.students.filter(student => !isRecoveredStudent(student))); setAccounts(linked);
  };
  useEffect(() => { void reload().catch(e => setError(e.message)); }, []);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.'); }
    finally { setBusy(false); }
  };
  const invite = (student: Student) => run(async () => {
    const email = (emails[student.id] || accounts.find(a => a.studentId === student.id)?.email || '').trim();
    const result = await post<{activationLink: string}>(`/api/tutor/students/${encodeURIComponent(student.id)}/invite`, { email });
    setLinks(prev => ({ ...prev, [student.id]: result.activationLink }));
    setNotice(`Invitation created for ${student.name}. Copy and share the link privately.`);
  });
  const action = (account: LinkedAccount, value: 'disable' | 'reactivate') => run(async () => {
    await post(`/api/tutor/accounts/${encodeURIComponent(account.id)}/${value}`);
    setNotice(value === 'disable' ? 'Account disabled and sessions revoked.' : 'Account reactivated.');
  });
  return <Layout title="Student accounts"><div className="space-y-4 pb-4">
    <p className="text-sm text-slate-300">Enable login for an existing student, then share their invitation link privately.</p>
    {students.filter(student => !focusedStudent || student.id === focusedStudent).map(student => { const account = accounts.find(item => item.studentId === student.id); return <section key={student.id} className="rounded-2xl border border-white/10 bg-slate-800/60 p-4 space-y-3">
      <div><h2 className="font-semibold">{student.name}</h2><p className="text-xs text-slate-300">{account ? `${account.email} · ${account.status.toLowerCase()}` : 'Login not enabled'}</p></div>
      {!account?.status || account.status === 'PENDING' ? <><input className="w-full bg-slate-900 rounded-xl p-3 text-sm" type="email" placeholder="Student email" value={emails[student.id] ?? account?.email ?? ''} onChange={e => setEmails(prev => ({ ...prev, [student.id]: e.target.value }))} />
      <button disabled={busy} className="rounded-xl bg-blue-600 px-4 py-2 text-sm disabled:opacity-50" onClick={() => invite(student)}>{account ? 'Resend invitation' : 'Enable student login'}</button></> : null}
      {account?.status === 'ACTIVE' && <button disabled={busy} className="rounded-xl border border-rose-400/50 px-4 py-2 text-sm" onClick={() => action(account, 'disable')}>Disable account</button>}
      {account?.status === 'DISABLED' && <button disabled={busy} className="rounded-xl border border-blue-400/50 px-4 py-2 text-sm" onClick={() => action(account, 'reactivate')}>Reactivate account</button>}
      {account && account.status !== 'PENDING' && <div className="space-y-2"><input className="w-full bg-slate-900 rounded-xl p-3 text-sm" type="email" aria-label={`Email for ${student.name}`} value={emails[student.id] ?? account.email} onChange={e => setEmails(prev => ({ ...prev, [student.id]: e.target.value }))} /><button disabled={busy || (emails[student.id] ?? account.email) === account.email} className="text-blue-300 text-sm disabled:opacity-40" onClick={() => run(async () => { await api(`/api/tutor/accounts/${encodeURIComponent(account.id)}`, { method: 'PATCH', body: JSON.stringify({ email: emails[student.id] }) }); setNotice('Email updated. Existing sessions were revoked.'); })}>Update email</button></div>}
      {links[student.id] && <div className="space-y-2"><input readOnly aria-label="Activation link" className="w-full bg-slate-900 rounded-xl p-2 text-xs" value={links[student.id]} /><button className="text-blue-300 text-sm" onClick={() => void navigator.clipboard.writeText(links[student.id]).then(() => setNotice('Link copied.'))}>Copy link</button></div>}
    </section>; })}
    {error && <div role="alert" className="space-y-2"><p className="text-sm text-rose-300">{error}</p>{error.includes('missing student reference') && <button className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold" onClick={() => navigate('/settings')}>Repair imported records in Settings</button>}</div>}{notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
  </div></Layout>;
};
