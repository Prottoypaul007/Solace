import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, BookOpen, CalendarDays, ClipboardList, Megaphone, RefreshCw, Trophy } from 'lucide-react';
import { Layout } from '../components/Layout';
import { Student, ClassSession, TestResult } from '../types';
import { api } from '../services/api';
import { Announcement, Homework, Notice, ScheduledClass, liveEvents } from '../services/communications';
import { formatDhaka } from '../services/time';

interface TeacherLink { studentId: string; teacherId: string; teacherName: string; profile: Student }
interface DashboardData { profile: Student; enrollments: TeacherLink[]; completedClasses: (ClassSession & {teacherName: string})[]; testResults: (TestResult & {teacherName: string})[] }
const shortDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Dhaka', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
};

export const StudentHome: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [schedule, setSchedule] = useState<ScheduledClass[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const navigate = useNavigate();
  const load = async () => {
    try {
      const dashboard = await api<DashboardData>('/api/student/dashboard');
      setData(dashboard);
      setError('');
      const results = await Promise.allSettled([
        api<ScheduledClass[]>('/api/scheduled-classes'),
        api<Announcement[]>('/api/announcements'),
        api<Homework[]>('/api/homework'),
        api<Notice[]>('/api/notifications'),
      ]);
      if (results[0].status === 'fulfilled') setSchedule(results[0].value);
      if (results[1].status === 'fulfilled') setAnnouncements(results[1].value);
      if (results[2].status === 'fulfilled') setHomework(results[2].value);
      if (results[3].status === 'fulfilled') setNotices(results[3].value);
      if (results.some(result => result.status === 'rejected')) setError('Some updates could not be loaded. Tap Retry to refresh.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your dashboard.');
    }
  };
  useEffect(() => { void load(); return liveEvents(() => { void load(); }); }, []);
  useEffect(() => { if (data && selectedTeacher && !data.enrollments.some(link => link.studentId === selectedTeacher)) setSelectedTeacher(''); }, [data, selectedTeacher]);
  const matches = (studentId: string) => !selectedTeacher || studentId === selectedTeacher;
  const upcoming = schedule.filter(item => matches(item.student_id) && Date.parse(item.start_at) > Date.now()).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const completed = data?.completedClasses.filter(item => matches(item.studentId)).sort((a, b) => b.date.localeCompare(a.date)) || [];
  const results = data?.testResults.filter(item => matches(item.studentId)).sort((a, b) => b.date.localeCompare(a.date)) || [];
  const pendingHomework = homework.filter(item => matches(item.studentId || '') && !item.completedAt).length;
  const unreadAnnouncements = announcements.filter(item => matches(item.studentId || '') && !item.readAt).length;
  const unreadNotices = notices.filter(item => matches(item.studentId || '') && !item.readAt).length;
  const average = results.length ? Math.round(results.reduce((sum, item) => sum + (item.maxMarks > 0 ? item.obtainedMarks / item.maxMarks * 100 : 0), 0) / results.length) : null;
  const shownProfile = data?.enrollments.find(link => link.studentId === selectedTeacher)?.profile || data?.profile;

  return <Layout title="My learning" studentMode wide><div className="space-y-6">
    {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-100"><span>{error}</span><button type="button" onClick={() => void load()} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-amber-400/15 px-3 font-semibold"><RefreshCw size={15} /> Retry</button></div>}
    {!data && !error && <p className="rounded-2xl bg-slate-900 p-5 text-sm text-slate-300">Loading your learning…</p>}
    {data && <>
      {data.enrollments.length > 1 && <section aria-label="Choose teacher" className="flex gap-2 overflow-x-auto pb-1"><button aria-pressed={!selectedTeacher} onClick={() => setSelectedTeacher('')} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold ${!selectedTeacher ? 'bg-blue-600' : 'bg-slate-800'}`}>All teachers</button>{data.enrollments.map(link => <button key={link.studentId} aria-pressed={selectedTeacher === link.studentId} onClick={() => setSelectedTeacher(link.studentId)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold ${selectedTeacher === link.studentId ? 'bg-blue-600' : 'bg-slate-800'}`}>{link.teacherName}</button>)}</section>}
      <section className="rounded-3xl border border-blue-400/20 bg-gradient-to-br from-blue-500/20 via-slate-900 to-indigo-500/10 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">Welcome back</p>
        <h2 className="mt-2 break-words text-2xl font-bold tracking-tight">{shownProfile?.name}</h2>
        <p className="mt-1 text-sm text-slate-300">{selectedTeacher ? data.enrollments.find(link => link.studentId === selectedTeacher)?.profile.subject : data.enrollments.map(link => link.profile.subject).filter(Boolean).join(' · ') || 'Your learning space'}</p>
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/45 p-4"><CalendarDays size={20} className="mt-0.5 shrink-0 text-blue-300" /><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next class</p><p className="mt-1 font-semibold">{upcoming[0] ? upcoming[0].subject : 'Nothing scheduled yet'}</p><p className="mt-1 text-sm text-slate-300">{upcoming[0] ? `${formatDhaka(upcoming[0].start_at)} (Dhaka) · ${upcoming[0].teacherName}` : 'Check back for a new class time.'}</p></div></div>
      </section>
      <section aria-label="Learning summary" className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-900 p-3 sm:p-4"><BookOpen size={18} className="text-blue-300" /><p className="mt-2 text-xl font-bold sm:text-2xl">{completed.length}</p><p className="text-xs leading-4 text-slate-400">Classes done</p></div>
        <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-900 p-3 sm:p-4"><Trophy size={18} className="text-violet-300" /><p className="mt-2 text-xl font-bold sm:text-2xl">{average === null ? '—' : `${average}%`}</p><p className="text-xs leading-4 text-slate-400">Test average</p></div>
        <div className="min-w-0 rounded-2xl border border-white/10 bg-slate-900 p-3 sm:p-4"><ClipboardList size={18} className="text-amber-300" /><p className="mt-2 text-xl font-bold sm:text-2xl">{pendingHomework}</p><p className="text-xs leading-4 text-slate-400">Homework due</p></div>
      </section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-slate-900 p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Upcoming classes</h2><CalendarDays size={19} className="text-blue-300" /></div><div className="mt-3 divide-y divide-white/10">{upcoming.length ? upcoming.slice(0, 3).map(item => <div key={item.id} className="py-3"><p className="font-semibold">{item.subject}</p><p className="mt-1 text-sm text-slate-400">{formatDhaka(item.start_at)} (Dhaka) · {item.teacherName}</p></div>) : <p className="py-4 text-sm text-slate-400">No upcoming classes scheduled.</p>}</div><button onClick={() => navigate(`/connect?tab=Classes${selectedTeacher ? `&teacher=${encodeURIComponent(selectedTeacher)}` : ''}`)} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-300">View schedule <ArrowRight size={16} /></button></section>
        <section className="rounded-3xl border border-white/10 bg-slate-900 p-4 sm:p-5"><h2 className="text-lg font-bold">Keep in touch</h2><div className="mt-3 divide-y divide-white/10">{[{ label: 'Announcements', count: unreadAnnouncements, detail: 'unread', icon: Megaphone, tab: 'Announcements' }, { label: 'Homework', count: pendingHomework, detail: 'to complete', icon: ClipboardList, tab: 'Homework' }, { label: 'Notifications', count: unreadNotices, detail: 'unread', icon: Bell, tab: 'Notifications' }].map(item => { const Icon = item.icon; return <button key={item.label} onClick={() => navigate(`/connect?tab=${item.tab}${selectedTeacher ? `&teacher=${encodeURIComponent(selectedTeacher)}` : ''}`)} className="flex min-h-16 w-full items-center gap-3 py-2 text-left"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300"><Icon size={19} /></span><span className="flex-1 font-semibold">{item.label}</span><span className="text-xs text-slate-400">{item.count} {item.detail}</span><ArrowRight size={16} className="text-slate-500" /></button>; })}</div></section>
        <section className="rounded-3xl border border-white/10 bg-slate-900 p-4 sm:p-5"><h2 className="text-lg font-bold">Recent classes</h2><div className="mt-3 divide-y divide-white/10">{completed.length ? completed.slice(0, 5).map(item => <div key={item.id} className="flex items-start justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate font-medium">{item.topic || 'Completed class'}</p><p className="mt-1 text-xs text-slate-400">{shortDate(item.date)} · {item.teacherName}</p></div><span className="shrink-0 rounded-lg bg-slate-800 px-2 py-1 text-xs text-slate-300">{item.durationMinutes} min</span></div>) : <p className="py-4 text-sm text-slate-400">Your completed classes will appear here.</p>}</div></section>
        <section className="rounded-3xl border border-white/10 bg-slate-900 p-4 sm:p-5"><h2 className="text-lg font-bold">Test results</h2><div className="mt-3 divide-y divide-white/10">{results.length ? results.slice(0, 5).map(item => <div key={item.id} className="py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-medium">{item.testName}</p><p className="mt-1 text-xs text-slate-400">{shortDate(item.date)} · {item.teacherName}</p></div><span className="shrink-0 font-bold text-violet-200">{item.obtainedMarks}/{item.maxMarks}</span></div><div role="meter" aria-label={`${item.testName} score`} aria-valuenow={item.obtainedMarks} aria-valuemin={0} aria-valuemax={Math.max(item.maxMarks, 1)} className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-400" style={{ width: `${Math.max(0, Math.min(100, item.maxMarks > 0 ? item.obtainedMarks / item.maxMarks * 100 : 0))}%` }} /></div></div>) : <p className="py-4 text-sm text-slate-400">Your test results will appear here.</p>}</div></section>
      </div>
      <button className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-300" onClick={() => navigate('/student-account')}>Account settings <ArrowRight size={16} /></button>
    </>}
  </div></Layout>;
};
