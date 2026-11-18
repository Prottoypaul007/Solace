import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, MessageCircle, Plus, Users, Wallet } from 'lucide-react';
import { Layout } from '../components/Layout';
import { getClasses, getPayments, getStudentBalance, getStudents, sortStudentsByRecentClass } from '../services/storage';
import { getUnsentTestResults } from '../services/communication';

const money = (amount: number) => `৳${amount.toLocaleString('en-BD')}`;

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const students = getStudents();
  const classes = getClasses();
  const payments = getPayments();
  const recent = sortStudentsByRecentClass(students, classes).slice(0, 3);
  const received = payments.reduce((sum, item) => sum + item.amount, 0);
  const due = students.reduce((sum, item) => sum + Math.max(0, getStudentBalance(item.id)), 0);
  const unsent = getUnsentTestResults().length;
  const stats = [
    { label: 'Students', value: students.length.toLocaleString(), icon: Users, tone: 'text-blue-300 bg-blue-500/15' },
    { label: 'Classes logged', value: classes.length.toLocaleString(), icon: BookOpen, tone: 'text-violet-300 bg-violet-500/15' },
    { label: 'Received', value: money(received), icon: Wallet, tone: 'text-emerald-300 bg-emerald-500/15' },
    { label: 'To collect', value: money(due), icon: Wallet, tone: 'text-amber-300 bg-amber-500/15' },
  ];

  return <Layout title="Home">
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-600 to-indigo-800 p-5 shadow-xl shadow-blue-950/30">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/80">Your workspace</p>
        <h2 className="mt-2 text-2xl font-bold leading-tight">Everything for today,<br />in one place.</h2>
        <p className="mt-2 text-sm leading-5 text-blue-100/85">Open a student to log a class, record a payment, or review progress.</p>
        <button onClick={() => navigate('/students')} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-blue-800 active:scale-[0.98]">Open students <ArrowRight size={17} /></button>
      </section>

      <section aria-label="Overview statistics" className="grid grid-cols-2 gap-3">
        {stats.map(stat => <div key={stat.label} className="min-w-0 rounded-2xl border border-white/10 bg-slate-900 p-4">
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.tone}`}><stat.icon size={19} /></div>
          <p className="mt-4 truncate text-xl font-bold tracking-tight">{stat.value}</p>
          <p className="mt-1 text-sm text-slate-400">{stat.label}</p>
        </div>)}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Quick actions</h2></div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/add-student')} className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 text-left text-sm font-semibold active:bg-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><Plus size={19} /></span>Add student</button>
          <button onClick={() => navigate('/connect')} className="flex min-h-16 items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 p-4 text-left text-sm font-semibold active:bg-slate-800"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300"><MessageCircle size={19} /></span>Messages</button>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-bold">Recent students</h2><button className="text-sm font-semibold text-blue-300" onClick={() => navigate('/students')}>See all</button></div>
        {recent.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 bg-slate-900/50 p-5 text-sm text-slate-400">No students yet. Add your first student to get started.</div>
          : <div className="space-y-2">{recent.map(student => <button key={student.id} onClick={() => navigate(`/student/${student.id}`)} className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 p-3 text-left active:bg-slate-800">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-sm font-bold text-blue-200">{student.name.trim().slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{student.name}</span><span className="block truncate text-xs text-slate-400">{student.subject}</span></span>
            <ArrowRight size={17} className="shrink-0 text-slate-500" />
          </button>)}</div>}
      </section>

      {unsent > 0 && <button onClick={() => navigate('/students')} className="w-full rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-left text-sm text-amber-100"><span className="font-semibold">{unsent} test result{unsent === 1 ? '' : 's'} waiting to be shared.</span><span className="mt-1 block text-xs text-amber-200/75">Open a student to review them.</span></button>}
    </div>
  </Layout>;
};
