import React, { useEffect, useState } from 'react';
import { api, post } from '../../services/api';
import { Notice, ScheduledClass } from '../../services/communications';
import { formatDhaka } from '../../services/time';

type Tab = 'Messages' | 'Announcements' | 'Homework' | 'Classes' | 'Notifications';
export const NotificationsPanel: React.FC<{ revision: number; selectTab: (value: Tab) => void; focusConversation: (studentId: string) => void; teacherFilter?: string }> = ({ revision, selectTab, focusConversation, teacherFilter = '' }) => {
  const [rows, setRows] = useState<Notice[]>([]);
  const [classes, setClasses] = useState<ScheduledClass[]>([]);
  const [error, setError] = useState('');
  const reload = () => Promise.all([api<Notice[]>('/api/notifications'), api<ScheduledClass[]>('/api/scheduled-classes')]).then(([notices, schedule]) => { setRows(notices); setClasses(schedule); }).catch(e => setError(e.message));
  useEffect(() => { void reload(); }, [revision]);
  const open = async (row: Notice) => {
    try {
      await post(`/api/notifications/${row.id}/read`);
      if (row.type === 'MESSAGE') { focusConversation(row.resourceId); selectTab('Messages'); }
      else selectTab(row.type === 'ANNOUNCEMENT' ? 'Announcements' : row.type === 'HOMEWORK' ? 'Homework' : 'Classes');
      await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open notification.'); }
  };
  return <div className="space-y-3"><h2 className="font-semibold">Notifications</h2>
    {!rows.filter(row => !teacherFilter || row.studentId === teacherFilter).length && <p className="text-sm text-slate-400">No notifications yet.</p>}
    {rows.filter(row => !teacherFilter || row.studentId === teacherFilter).map(row => { const scheduled = classes.find(item => item.id === row.resourceId); return <button key={row.id} onClick={() => void open(row)} className={`block w-full text-left rounded-2xl border p-4 ${row.readAt ? 'bg-slate-800/40 border-white/10' : 'bg-blue-600/15 border-blue-400/40'}`}>
      <span className="font-medium text-sm">{row.type === 'MESSAGE' ? 'New message' : row.type === 'ANNOUNCEMENT' ? 'New announcement' : row.type === 'HOMEWORK' ? 'New homework' : 'Class reminder'}</span>
      {row.type === 'CLASS_REMINDER' && scheduled && <span className="block text-sm text-slate-300 mt-1">{scheduled.studentName}: {scheduled.subject} starts {formatDhaka(scheduled.start_at)} (Dhaka)</span>}
      <time className="block text-xs text-slate-400 mt-1">{new Date(row.createdAt).toLocaleString()}{row.teacherName && ` · ${row.teacherName}`}</time>
    </button>; })}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
  </div>;
};
