import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { useAuth } from '../components/AuthProvider';
import { liveEvents, StudentChoice } from '../services/communications';
import { api } from '../services/api';
import { MessagesPanel } from '../components/communications/MessagesPanel';
import { AnnouncementsPanel } from '../components/communications/AnnouncementsPanel';
import { HomeworkPanel } from '../components/communications/HomeworkPanel';
import { SchedulePanel } from '../components/communications/SchedulePanel';
import { NotificationsPanel } from '../components/communications/NotificationsPanel';

type Tab = 'Messages' | 'Announcements' | 'Homework' | 'Classes' | 'Notifications';
export const Connect: React.FC = () => {
  const { account } = useAuth();
  const [params] = useSearchParams();
  const requested = params.get('tab');
  const [tab, setTab] = useState<Tab>((['Messages','Announcements','Homework','Classes','Notifications'] as string[]).includes(requested || '') ? requested as Tab : 'Messages');
  const [revision, setRevision] = useState(0);
  const [focusStudent, setFocusStudent] = useState(params.get('student') || '');
  const [students, setStudents] = useState<StudentChoice[]>([]);
  const [error, setError] = useState('');
  useEffect(() => liveEvents(() => setRevision(value => value + 1)), []);
  useEffect(() => {
    if (account?.role !== 'TUTOR') return;
    api<{data:{students:StudentChoice[]}}>('/api/tutor/data').then(result => setStudents(result.data.students)).catch(e => setError(e.message));
  }, [account?.role]);
  return <Layout title="Connect" studentMode={account?.role === 'STUDENT'} wide><div className="space-y-4">
    <div role="tablist" aria-label="Communication sections" className="flex gap-2 overflow-x-auto pb-1">
      {(['Messages','Announcements','Homework','Classes','Notifications'] as Tab[]).map(item => <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`min-h-11 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${tab === item ? 'bg-blue-600' : 'bg-slate-800 text-slate-300'}`}>{item}</button>)}
    </div>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {tab === 'Messages' && <MessagesPanel revision={revision} focusStudent={focusStudent} />}
    {tab === 'Announcements' && <AnnouncementsPanel revision={revision} students={students} />}
    {tab === 'Homework' && <HomeworkPanel revision={revision} students={students} />}
    {tab === 'Classes' && <SchedulePanel revision={revision} students={students} />}
    {tab === 'Notifications' && <NotificationsPanel revision={revision} selectTab={setTab} focusConversation={setFocusStudent} />}
  </div></Layout>;
};
