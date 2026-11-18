import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { Student, ClassSession, TestResult } from '../types';
import { api } from '../services/api';
import { Announcement, Homework, Notice, ScheduledClass, liveEvents } from '../services/communications';
import { formatDhaka } from '../services/time';

interface DashboardData { profile: Student; completedClasses: ClassSession[]; testResults: TestResult[] }
export const StudentHome: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [schedule, setSchedule] = useState<ScheduledClass[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [homework, setHomework] = useState<Homework[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const navigate = useNavigate();
  const load = () => Promise.all([
    api<DashboardData>('/api/student/dashboard'), api<ScheduledClass[]>('/api/scheduled-classes'),
    api<Announcement[]>('/api/announcements'), api<Homework[]>('/api/homework'), api<Notice[]>('/api/notifications'),
  ]).then(([dashboard, classes, news, work, notifications]) => { setData(dashboard); setSchedule(classes); setAnnouncements(news); setHomework(work); setNotices(notifications); }).catch(e => setError(e.message));
  useEffect(() => { void load(); return liveEvents(() => { void load(); }); }, []);
  return <Layout title="My dashboard" studentMode><div className="space-y-5">
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {!data && !error && <p>Loading…</p>}
    {data && <>
      <section className="rounded-2xl bg-blue-500/10 border border-blue-400/30 p-4"><h2 className="text-lg font-semibold">{data.profile.name}</h2><p className="text-sm text-slate-300">{data.profile.subject}</p></section>
      <section><h2 className="font-semibold mb-2">Upcoming classes</h2>{schedule.filter(item => Date.parse(item.start_at) > Date.now()).slice(0, 5).map(item => <p key={item.id} className="text-sm border-b border-white/10 py-2">{item.subject} · {formatDhaka(item.start_at)} (Dhaka)</p>)}{!schedule.some(item => Date.parse(item.start_at) > Date.now()) && <p className="text-sm text-slate-400">No upcoming class scheduled.</p>}<button className="text-xs text-blue-300 mt-2" onClick={() => navigate('/connect?tab=Classes')}>View schedule</button></section>
      <section><h2 className="font-semibold mb-2">Completed classes</h2>{data.completedClasses.length ? data.completedClasses.slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0,10).map(item => <div key={item.id} className="border-b border-white/10 py-2 text-sm"><span>{new Date(item.date).toLocaleDateString()}</span><span className="float-right text-slate-300">{item.topic || `${item.durationMinutes} minutes`}</span></div>) : <p className="text-sm text-slate-400">No class history yet.</p>}</section>
      <section><h2 className="font-semibold mb-2">Test results</h2>{data.testResults.length ? data.testResults.slice().sort((a,b) => b.date.localeCompare(a.date)).slice(0,10).map(item => <div key={item.id} className="border-b border-white/10 py-2 text-sm">{item.testName}<span className="float-right">{item.obtainedMarks}/{item.maxMarks}</span></div>) : <p className="text-sm text-slate-400">No test results yet.</p>}</section>
      <section><h2 className="font-semibold">Announcements</h2><p className="text-sm text-slate-300">{announcements.filter(item => !item.readAt).length} unread</p><button className="text-xs text-blue-300" onClick={() => navigate('/connect?tab=Announcements')}>Open announcements</button></section>
      <section><h2 className="font-semibold">Homework</h2><p className="text-sm text-slate-300">{homework.filter(item => !item.completedAt).length} to complete</p><button className="text-xs text-blue-300" onClick={() => navigate('/connect?tab=Homework')}>Open homework</button></section>
      <section><h2 className="font-semibold">Notifications</h2><p className="text-sm text-slate-300">{notices.filter(item => !item.readAt).length} unread</p><button className="text-xs text-blue-300" onClick={() => navigate('/connect?tab=Notifications')}>Open notifications</button></section>
    </>}
    <button className="text-sm text-blue-300" onClick={() => navigate('/student-account')}>Account settings</button>
  </div></Layout>;
};
