import React, { useState } from 'react';
import { Layout } from '../components/Layout';
import { post } from '../services/api';

export const TeacherInvites: React.FC = () => {
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const invite = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const result = await post<{activationLink: string}>('/api/tutor/teachers/invite', { email: email.trim().toLowerCase() });
      setLink(result.activationLink);
      setNotice('Invitation ready. Share this link privately with the teacher.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create invitation.'); }
    finally { setBusy(false); }
  };
  return <Layout title="Invite teacher"><div className="space-y-5">
    <section className="rounded-3xl border border-white/10 bg-slate-900 p-5">
      <h2 className="text-lg font-bold">Add another teacher</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">Each teacher manages their own students and records. A student can accept invitations from more than one teacher using one login.</p>
      <form onSubmit={invite} className="mt-5 space-y-3">
        <label className="block text-sm font-semibold">Teacher email<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl bg-slate-800 px-3 text-white" /></label>
        <button disabled={busy} className="min-h-12 w-full rounded-xl bg-blue-600 font-semibold disabled:opacity-50">{busy ? 'Creating invitation…' : 'Create invitation'}</button>
      </form>
    </section>
    {link && <section className="rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4 space-y-3"><p className="text-sm font-semibold">Private invitation link</p><input aria-label="Teacher invitation link" className="w-full rounded-xl bg-slate-900 p-3 text-xs" readOnly value={link} /><button className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold" onClick={() => void navigator.clipboard.writeText(link).then(() => setNotice('Link copied.')).catch(() => setError('Copy failed. Select the link and copy it manually.'))}>Copy link</button></section>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
  </div></Layout>;
};
