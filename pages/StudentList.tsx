import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock3, Plus, Search, Users, Wallet } from 'lucide-react';
import { Layout } from '../components/Layout';
import { getClasses, getStudentBalance, getStudents, sortStudentsByRecentClass } from '../services/storage';
import { getCommunications, getParentContacts, getTestResults } from '../services/communication';
import { inferredRecoveredName, isRecoveredStudent } from '../services/recoveredStudents';

type View = 'all' | 'due' | 'imported';
const money = (value: number) => `৳${value.toLocaleString('en-BD')}`;
const shortDate = (value: number) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short' }).format(value);

export const StudentList: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('all');
  const allStudents = getStudents();
  const active = allStudents.filter(student => !isRecoveredStudent(student));
  const imported = allStudents.filter(isRecoveredStudent);
  const classes = getClasses();
  const messages = getCommunications();
  const contacts = getParentContacts();
  const tests = getTestResults();
  const classCount = new Map<string, number>();
  const latestClass = new Map<string, number>();
  for (const item of classes) {
    classCount.set(item.studentId, (classCount.get(item.studentId) || 0) + 1);
    latestClass.set(item.studentId, Math.max(latestClass.get(item.studentId) || 0, Date.parse(item.date) || 0));
  }
  const balances = new Map(active.map(student => [student.id, getStudentBalance(student.id)]));
  const totalDue = active.reduce((sum, student) => sum + Math.max(0, balances.get(student.id) || 0), 0);
  const classesLogged = active.reduce((sum, student) => sum + (classCount.get(student.id) || 0), 0);
  const dueCount = active.filter(student => (balances.get(student.id) || 0) > 0).length;
  const selected = view === 'imported' ? imported : view === 'due' ? active.filter(student => (balances.get(student.id) || 0) > 0) : active;
  const term = search.trim().toLowerCase();
  const filtered = sortStudentsByRecentClass(selected, classes).filter(student =>
    !term || [student.name, student.subject, student.phone, inferredRecoveredName(student, messages) || '']
      .some(value => value.toLowerCase().includes(term)));

  return <Layout title="Students" wide>
    <div className="space-y-6">
      <section className="rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-500/20 via-slate-900 to-indigo-500/10 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">Your students</p><h2 className="mt-2 text-2xl font-bold tracking-tight">Learning at a glance</h2><p className="mt-2 max-w-md text-sm leading-5 text-slate-300">Open a student to log a class, record a payment, or see progress.</p></div>
          <button onClick={() => navigate('/add-student')} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 text-sm font-bold text-white shadow-lg shadow-blue-500/20 active:bg-blue-600"><Plus size={19} /> Add student</button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"><Users size={18} className="text-blue-300" /><p className="mt-2 text-2xl font-bold">{active.length}</p><p className="text-xs text-slate-400">Active students</p></div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4"><Wallet size={18} className="text-amber-300" /><p className="mt-2 break-words text-xl font-bold text-amber-100">{money(totalDue)}</p><p className="text-xs text-slate-400">Payments due</p></div>
          <div className="col-span-2 flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:col-span-1 sm:block"><div><BookOpen size={18} className="text-violet-300" /><p className="mt-2 text-2xl font-bold">{classesLogged}</p><p className="text-xs text-slate-400">Classes logged</p></div><span className="text-xs text-slate-400 sm:hidden">Across active students</span></div>
        </div>
      </section>

      <section aria-label="Find and filter students" className="space-y-3">
        <div className="relative"><Search size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Search students" type="search" placeholder="Search name, subject or phone" value={search} onChange={event => setSearch(event.target.value)} className="min-h-12 w-full rounded-2xl border border-white/10 bg-slate-900 pl-12 pr-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/25" /></div>
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Student filters">
          {([['all', `All ${active.length}`], ['due', `Due ${dueCount}`], ...(imported.length ? [['imported', `Imported ${imported.length}`]] : [])] as [View, string][]).map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-colors ${view === key ? 'bg-blue-500 text-white' : 'border border-white/10 bg-slate-900 text-slate-300 active:bg-slate-800'}`}>{label}</button>)}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="text-lg font-bold">{view === 'imported' ? 'Imported records' : view === 'due' ? 'Payments due' : 'Student list'}</h2><p className="text-xs text-slate-400">{filtered.length} shown · Recent first</p></div>
        {view === 'imported' && <p className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-5 text-amber-100">These records are preserved. Open an entry to correct its details, or add a student with a uniquely matching name to link it automatically.</p>}
        {filtered.length === 0 ? <div className="rounded-3xl border border-dashed border-white/15 bg-slate-900/50 p-8 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300"><Users size={27} /></span><h3 className="mt-4 text-lg font-semibold">{term ? 'No matching students' : view === 'due' ? 'No payments due' : view === 'imported' ? 'No imported records' : 'Add your first student'}</h3><p className="mt-2 text-sm text-slate-400">{term ? 'Try another name, subject, or phone number.' : view === 'due' ? 'Everyone is up to date.' : view === 'imported' ? 'Unmatched backup records will appear here.' : 'Add a student to start logging classes and payments.'}</p></div>
          : <div className="grid gap-3 md:grid-cols-2">{filtered.map((student, index) => {
            const count = classCount.get(student.id) || 0;
            const balance = balances.get(student.id) || 0;
            const last = latestClass.get(student.id);
            const importedView = view === 'imported';
            const testCount = tests.filter(item => item.studentId === student.id).length;
            const contactCount = contacts.filter(item => item.studentId === student.id).length;
            const messageCount = messages.filter(item => item.studentId === student.id).length;
            return <button key={student.id} onClick={() => navigate(`/student/${student.id}`)} aria-label={`Open ${student.name}`} className="group w-full rounded-2xl border border-white/10 bg-slate-900 p-4 text-left transition-colors hover:border-blue-400/30 hover:bg-slate-800/80 active:bg-slate-800">
              <div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-base font-bold text-blue-200">{student.name.trim().slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h3 className="truncate text-base font-bold">{student.name}</h3>{index === 0 && !term && !importedView && count > 0 && <span className="shrink-0 rounded-lg bg-blue-500/15 px-2 py-1 text-[11px] font-bold text-blue-300">Recent</span>}</div><p className="mt-0.5 truncate text-sm text-slate-400">{importedView ? `Possible name: ${inferredRecoveredName(student, messages) || 'Unknown'}` : student.subject}</p></div><ArrowRight size={18} className="mt-3 shrink-0 text-slate-500 group-hover:text-blue-300" /></div>
              {importedView ? <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3 text-xs text-slate-300"><span>{testCount} tests</span><span>·</span><span>{contactCount} contacts</span><span>·</span><span>{messageCount} messages</span><span className="ml-auto font-semibold text-blue-300">Review & edit</span></div>
                : <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-white/10 pt-3 text-xs text-slate-400"><span className="inline-flex items-center gap-1.5"><BookOpen size={14} />{count} {count === 1 ? 'class' : 'classes'}</span><span className="inline-flex items-center gap-1.5"><Clock3 size={14} />{last ? `Last ${shortDate(last)}` : 'No classes yet'}</span><span className={`ml-auto rounded-lg px-2.5 py-1.5 font-bold ${balance > 0 ? 'bg-amber-500/15 text-amber-200' : balance < 0 ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800 text-slate-300'}`}>{balance > 0 ? `Due ${money(balance)}` : balance < 0 ? `Advance ${money(Math.abs(balance))}` : 'No due'}</span></div>}
            </button>;
          })}</div>}
      </section>
    </div>
  </Layout>;
};
