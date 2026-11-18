import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { api, post } from '../../services/api';
import { downloadAttachment, Homework, ScheduledClass, StudentChoice } from '../../services/communications';
import { formatDhaka, fromDhakaInput, toDhakaInput } from '../../services/time';

interface Completion { studentId: string; studentName: string; completedAt: string | null }
const fileBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader(); reader.onerror = () => reject(new Error('Could not read attachment.'));
  reader.onload = () => resolve(String(reader.result).split(',')[1] || ''); reader.readAsDataURL(file);
});
export const HomeworkPanel: React.FC<{ revision: number; students: StudentChoice[]; teacherFilter?: string }> = ({ revision, students, teacherFilter = '' }) => {
  const { account } = useAuth();
  const tutor = account?.role === 'TUTOR';
  const [rows, setRows] = useState<Homework[]>([]);
  const [classes, setClasses] = useState<ScheduledClass[]>([]);
  const [completion, setCompletion] = useState<Record<string, Completion[]>>({});
  const [editing, setEditing] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [classId, setClassId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const uploadIds = useRef(new Map<string, string>());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reload = () => api<Homework[]>('/api/homework').then(setRows).catch(e => setError(e.message));
  useEffect(() => { void reload(); if (tutor) void api<ScheduledClass[]>('/api/scheduled-classes').then(setClasses); }, [revision]);
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const edit = async (row: Homework) => {
    const members = await api<Completion[]>(`/api/homework/${row.id}/completion`);
    setEditing(row.id); setTitle(row.title); setDescription(row.description); setSelected(members.map(item => item.studentId));
    setDeadline(row.deadline ? toDhakaInput(row.deadline) : ''); setClassId(row.class_id || ''); setFiles([]);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const result = await api<{id:string}>(editing ? `/api/homework/${editing}` : '/api/homework', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ title, description, studentIds: selected, deadline: deadline ? fromDhakaInput(deadline) : null, classId: classId || null }) });
      setEditing(result.id);
      for (const file of files) {
        if (file.size > 5_000_000 || !['application/pdf','image/png','image/jpeg'].includes(file.type)) throw new Error('Only PDF, PNG, or JPG up to 5 MB is allowed.');
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!uploadIds.current.has(key)) uploadIds.current.set(key, crypto.randomUUID());
        await post(`/api/homework/${result.id}/attachments`, { name: file.name, mime: file.type, base64: await fileBase64(file), clientNonce: uploadIds.current.get(key) });
        setFiles(current => current.filter(item => item !== file));
      }
      uploadIds.current.clear(); setEditing(''); setTitle(''); setDescription(''); setDeadline(''); setClassId(''); setSelected([]); setFiles([]); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save homework.'); await reload(); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('Delete this homework assignment?')) return;
    try { await api(`/api/homework/${id}`, { method: 'DELETE' }); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not delete homework.'); }
  };
  const complete = async (id: string) => {
    try { await post(`/api/homework/${id}/complete`); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not mark homework complete.'); }
  };
  const showCompletion = async (id: string) => {
    try { const members = await api<Completion[]>(`/api/homework/${id}/completion`); setCompletion(current => ({ ...current, [id]: members })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load status.'); }
  };
  return <div className="grid md:grid-cols-[1fr_18rem] gap-4"><div className="space-y-3"><h2 className="font-semibold">Homework</h2>
    {!rows.filter(row => !teacherFilter || row.studentId === teacherFilter).length && <p className="text-sm text-slate-400">No homework assigned yet.</p>}
    {rows.filter(row => !teacherFilter || row.studentId === teacherFilter).map(row => { const overdue = Boolean(row.deadline && Date.parse(row.deadline) < Date.now() && !row.completedAt); return <article key={row.id} className="rounded-2xl bg-slate-800/60 border border-white/10 p-4 space-y-2">
      <div className="flex justify-between gap-2"><h3 className="font-semibold">{row.title}</h3><span className={`text-xs ${overdue ? 'text-amber-300' : 'text-slate-300'}`}>{tutor ? `${row.completedCount}/${row.recipientCount} completed` : row.completedAt ? 'Completed' : overdue ? 'Overdue' : 'Assigned'}</span></div>
      <p className="text-sm whitespace-pre-wrap">{row.description}</p>
      <p className="text-xs text-slate-400">Assigned {formatDhaka(row.created_at)}{row.deadline && ` · Due ${formatDhaka(row.deadline)} (Dhaka)`}{!tutor && row.teacherName && ` · ${row.teacherName}`}</p>
      {!!row.attachments.length && <div className="space-y-1">{row.attachments.map(file => <button key={file.id} className="block text-sm text-blue-300" onClick={() => void downloadAttachment(file.id, file.name).catch(e => setError(e.message))}>Download {file.name}</button>)}</div>}
      {tutor ? <div className="space-x-3"><button className="text-blue-300 text-sm" onClick={() => void showCompletion(row.id)}>View completion</button><button className="text-blue-300 text-sm" onClick={() => void edit(row).catch(e => setError(e.message))}>Edit</button><button className="text-rose-300 text-sm" onClick={() => void remove(row.id)}>Delete</button></div> : !row.completedAt && <button className="text-blue-300 text-sm" onClick={() => void complete(row.id)}>Mark completed</button>}
      {completion[row.id] && <div className="text-xs text-slate-300">{completion[row.id].map(item => <p key={item.studentId}>{item.studentName}: {item.completedAt ? `Completed ${new Date(item.completedAt).toLocaleString()}` : 'Assigned'}</p>)}</div>}
    </article>; })}
  </div>
  {tutor && <form onSubmit={save} className="rounded-2xl bg-slate-800/60 border border-white/10 p-4 space-y-3 h-fit"><h2 className="font-semibold">{editing ? 'Edit homework' : 'Assign homework'}</h2>
    <input className="w-full rounded-xl bg-slate-900 p-3 text-sm" placeholder="Title" maxLength={120} required value={title} onChange={e => setTitle(e.target.value)} />
    <textarea className="w-full rounded-xl bg-slate-900 p-3 text-sm min-h-28" placeholder="Instructions" maxLength={10000} required value={description} onChange={e => setDescription(e.target.value)} />
    <label className="block text-sm">Deadline (Dhaka, optional)<input className="w-full mt-1 rounded-xl bg-slate-900 p-3" type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} /></label>
    <label className="block text-sm">Related class (optional)<select className="w-full mt-1 rounded-xl bg-slate-900 p-3" value={classId} onChange={e => setClassId(e.target.value)}><option value="">None</option>{classes.map(item => <option key={item.id} value={item.id}>{students.find(s => s.id === item.student_id)?.name} · {formatDhaka(item.start_at)}</option>)}</select></label>
    <div><p className="text-sm mb-1">Students</p><button type="button" className="text-xs text-blue-300 mb-2" onClick={() => setSelected(students.map(item => item.id))}>Select all</button><div className="max-h-36 overflow-y-auto space-y-1">{students.map(item => <label key={item.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />{item.name}</label>)}</div></div>
    <label className="block text-sm">Attachments (PDF, PNG, JPG; 5 MB each)<input className="block mt-1 text-xs w-full" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" multiple onChange={e => setFiles(Array.from(e.target.files || []))} /></label>
    <button disabled={busy || !selected.length} className="rounded-xl bg-blue-600 p-3 w-full disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save changes' : 'Assign'}</button>
    {editing && <button type="button" className="text-xs text-slate-300" onClick={() => { setEditing(''); setTitle(''); setDescription(''); setSelected([]); setFiles([]); }}>Cancel edit</button>}
  </form>}
  {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
  </div>;
};
