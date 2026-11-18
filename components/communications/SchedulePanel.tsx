import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { api } from '../../services/api';
import { ScheduledClass, StudentChoice } from '../../services/communications';
import { formatDhaka, fromDhakaInput, toDhakaInput } from '../../services/time';

export const SchedulePanel: React.FC<{ revision: number; students: StudentChoice[]; teacherFilter?: string }> = ({ revision, students, teacherFilter = '' }) => {
  const { account } = useAuth();
  const tutor = account?.role === 'TUTOR';
  const [rows, setRows] = useState<ScheduledClass[]>([]);
  const [editing, setEditing] = useState('');
  const [studentId, setStudentId] = useState('');
  const [subject, setSubject] = useState('');
  const [start, setStart] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reload = () => api<ScheduledClass[]>('/api/scheduled-classes').then(setRows).catch(e => setError(e.message));
  useEffect(() => { void reload(); }, [revision]);
  const edit = (row: ScheduledClass) => { setEditing(row.id); setStudentId(row.student_id); setSubject(row.subject); setStart(toDhakaInput(row.start_at)); setMinutes(String(row.reminder_minutes)); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api(editing ? `/api/scheduled-classes/${editing}` : '/api/scheduled-classes', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ studentId, subject, startAt: fromDhakaInput(start), reminderMinutes: Number(minutes) }) });
      setEditing(''); setStudentId(''); setSubject(''); setStart(''); setMinutes('30'); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save class.'); }
    finally { setBusy(false); }
  };
  const cancel = async (id: string) => {
    if (!window.confirm('Cancel this scheduled class?')) return;
    try { await api(`/api/scheduled-classes/${id}`, { method: 'DELETE' }); await reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not cancel class.'); }
  };
  return <div className="grid md:grid-cols-[1fr_18rem] gap-4"><div className="space-y-3"><h2 className="font-semibold">Upcoming classes</h2>
    {!rows.filter(row => (!teacherFilter || row.student_id === teacherFilter) && Date.parse(row.start_at) > Date.now()).length && <p className="text-sm text-slate-400">No upcoming classes scheduled.</p>}
    {rows.filter(row => (!teacherFilter || row.student_id === teacherFilter) && Date.parse(row.start_at) > Date.now()).map(row => <article key={row.id} className="rounded-2xl bg-slate-800/60 border border-white/10 p-4"><h3 className="font-semibold">{row.subject}</h3><p className="text-sm text-slate-300">{tutor && `${students.find(item => item.id === row.student_id)?.name || 'Student'} · `}{formatDhaka(row.start_at)} (Dhaka){!tutor && row.teacherName && ` · ${row.teacherName}`}</p><p className="text-xs text-slate-400">Reminder {row.reminder_minutes} minutes before</p>{tutor && <div className="space-x-3 mt-2"><button className="text-blue-300 text-sm" onClick={() => edit(row)}>Reschedule</button><button className="text-rose-300 text-sm" onClick={() => void cancel(row.id)}>Cancel</button></div>}</article>)}
  </div>
  {tutor && <form onSubmit={save} className="rounded-2xl bg-slate-800/60 border border-white/10 p-4 space-y-3 h-fit"><h2 className="font-semibold">{editing ? 'Reschedule class' : 'Schedule class'}</h2>
    {!editing && <select className="w-full rounded-xl bg-slate-900 p-3 text-sm" required value={studentId} onChange={e => { setStudentId(e.target.value); setSubject(students.find(item => item.id === e.target.value)?.subject || ''); }}><option value="">Choose student</option>{students.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
    <input className="w-full rounded-xl bg-slate-900 p-3 text-sm" placeholder="Subject" required maxLength={120} value={subject} onChange={e => setSubject(e.target.value)} />
    <label className="block text-sm">Date and time (Dhaka)<input className="mt-1 w-full rounded-xl bg-slate-900 p-3" type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label>
    <label className="block text-sm">Remind minutes before<input className="mt-1 w-full rounded-xl bg-slate-900 p-3" type="number" min={1} max={1440} required value={minutes} onChange={e => setMinutes(e.target.value)} /></label>
    <button disabled={busy} className="rounded-xl bg-blue-600 p-3 w-full disabled:opacity-50">{busy ? 'Saving…' : editing ? 'Save class' : 'Schedule'}</button>
    {editing && <button type="button" className="text-xs text-slate-300" onClick={() => { setEditing(''); setStudentId(''); setSubject(''); setStart(''); }}>Cancel edit</button>}
  </form>}
  {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
  </div>;
};
