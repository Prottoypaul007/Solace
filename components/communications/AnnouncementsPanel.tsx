import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { api, post } from '../../services/api';
import { Announcement, StudentChoice } from '../../services/communications';

interface Reader { studentId: string; studentName: string; readAt: string | null }
export const AnnouncementsPanel: React.FC<{ revision: number; students: StudentChoice[]; teacherFilter?: string }> = ({ revision, students, teacherFilter = '' }) => {
  const { account } = useAuth();
  const tutor = account?.role === 'TUTOR';
  const [rows, setRows] = useState<Announcement[]>([]);
  const [open, setOpen] = useState('');
  const [readers, setReaders] = useState<Reader[]>([]);
  const [editing, setEditing] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = () => api<Announcement[]>('/api/announcements').then(setRows).catch(e => setError(e.message));
  useEffect(() => { void reload(); }, [revision]);
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const show = async (row: Announcement) => {
    setOpen(current => current === row.id ? '' : row.id);
    if (tutor) setReaders(await api<Reader[]>(`/api/announcements/${row.id}/readership`));
    else if (!row.readAt) { await post(`/api/announcements/${row.id}/read`); await reload(); }
  };
  const edit = async (row: Announcement) => {
    const current = await api<Reader[]>(`/api/announcements/${row.id}/readership`);
    setEditing(row.id); setTitle(row.title); setBody(row.body); setSelected(current.map(item => item.studentId));
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const path = editing ? `/api/announcements/${editing}` : '/api/announcements';
      await api(path, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ title, body, studentIds: selected }) });
      setEditing(''); setTitle(''); setBody(''); setSelected([]); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save announcement.'); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Delete this announcement?')) return;
    try { await api(`/api/announcements/${id}`, { method: 'DELETE' }); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete announcement.'); }
  };
  return <div className="grid md:grid-cols-[1fr_18rem] gap-4">
    <div className="space-y-3"><h2 className="font-semibold">Announcements</h2>
      {!rows.filter(row => !teacherFilter || row.studentId === teacherFilter).length && <p className="text-sm text-slate-400">No announcements yet.</p>}
      {rows.filter(row => !teacherFilter || row.studentId === teacherFilter).map(row => <article key={row.id} className="rounded-2xl border border-white/10 bg-slate-800/60 p-4">
        <button className="text-left w-full" onClick={() => void show(row).catch(e => setError(e.message))}><span className="font-semibold">{row.title}</span>{!tutor && !row.readAt && <span className="ml-2 text-xs text-blue-300">Unread</span>}<time className="block text-xs text-slate-400 mt-1">{new Date(row.created_at).toLocaleString()}{!tutor && row.teacherName && ` · ${row.teacherName}`}</time></button>
        {open === row.id && <div className="mt-3 space-y-3"><p className="text-sm whitespace-pre-wrap">{row.body}</p>{tutor && <><p className="text-xs text-slate-300">Read by {row.readCount}/{row.recipientCount}</p><div className="text-xs text-slate-300">{readers.map(item => <p key={item.studentId}>{item.studentName}: {item.readAt ? `Read ${new Date(item.readAt).toLocaleString()}` : 'Unread'}</p>)}</div><div className="flex gap-3"><button className="text-blue-300 text-sm" onClick={() => void edit(row).catch(e => setError(e.message))}>Edit</button><button className="text-rose-300 text-sm" onClick={() => void remove(row.id)}>Delete</button></div></>}</div>}
      </article>)}
    </div>
    {tutor && <form onSubmit={save} className="rounded-2xl border border-white/10 bg-slate-800/60 p-4 space-y-3 h-fit"><h2 className="font-semibold">{editing ? 'Edit announcement' : 'New announcement'}</h2>
      <input className="w-full rounded-xl bg-slate-900 p-3 text-sm" placeholder="Title" maxLength={120} required value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className="w-full rounded-xl bg-slate-900 p-3 text-sm min-h-28" placeholder="Description" maxLength={5000} required value={body} onChange={e => setBody(e.target.value)} />
      <div><p className="text-sm mb-1">Recipients</p><button type="button" className="text-xs text-blue-300 mb-2" onClick={() => setSelected(students.map(item => item.id))}>Select all</button><div className="max-h-36 overflow-y-auto space-y-1">{students.map(item => <label key={item.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />{item.name}</label>)}</div></div>
      <button disabled={busy || !selected.length} className="rounded-xl bg-blue-600 p-3 w-full disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save changes' : 'Publish'}</button>
      {editing && <button type="button" className="text-xs text-slate-300" onClick={() => { setEditing(''); setTitle(''); setBody(''); setSelected([]); }}>Cancel edit</button>}
    </form>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
  </div>;
};
