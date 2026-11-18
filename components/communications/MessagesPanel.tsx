import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { api, post } from '../../services/api';
import { ChatMessage, Conversation } from '../../services/communications';

export const MessagesPanel: React.FC<{ revision: number; focusStudent: string }> = ({ revision, focusStudent }) => {
  const { account } = useAuth();
  const [list, setList] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nonce = useRef<{ body: string; value: string } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const refreshList = () => api<Conversation[]>('/api/conversations').then(rows => {
    setList(rows); setSelected(current => current || rows[0]?.studentId || '');
  }).catch(e => setError(e.message));
  const refreshMessages = async (studentId: string) => {
    const result = await api<{messages:ChatMessage[];nextCursor:string|null}>(`/api/conversations/${encodeURIComponent(studentId)}/messages`);
    setMessages(result.messages); setCursor(result.nextCursor);
    if (result.messages.some(item => item.senderAccountId !== account?.id && !item.readAt)) {
      await post(`/api/conversations/${encodeURIComponent(studentId)}/read`);
      void refreshList();
    }
  };
  useEffect(() => { void refreshList(); }, [revision]);
  useEffect(() => { if (focusStudent) setSelected(focusStudent); }, [focusStudent]);
  useEffect(() => { if (selected) void refreshMessages(selected).catch(e => setError(e.message)); }, [selected, revision]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length, selected]);
  const older = async () => {
    if (!cursor || !selected) return;
    try {
      const result = await api<{messages:ChatMessage[];nextCursor:string|null}>(`/api/conversations/${encodeURIComponent(selected)}/messages?before=${encodeURIComponent(cursor)}`);
      setMessages(current => [...result.messages, ...current]); setCursor(result.nextCursor);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load messages.'); }
  };
  const send = async (event: React.FormEvent) => {
    event.preventDefault(); if (!selected || !draft.trim() || busy) return;
    const body = draft.trim();
    if (!nonce.current || nonce.current.body !== body) nonce.current = { body, value: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      await post(`/api/conversations/${encodeURIComponent(selected)}/messages`, { body, clientNonce: nonce.current.value });
      nonce.current = null; setDraft(''); await refreshMessages(selected); await refreshList();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Message was not sent. Try again.'); }
    finally { setBusy(false); }
  };
  const active = list.find(item => item.studentId === selected);
  return <div className="grid md:grid-cols-[15rem_1fr] gap-4 min-h-[30rem]">
    <aside className="rounded-2xl bg-slate-800/60 p-2 max-h-[34rem] overflow-y-auto"><h2 className="font-semibold px-2 py-1">Conversations</h2>
      {list.length ? list.map(item => <button key={item.studentId} onClick={() => setSelected(item.studentId)} className={`w-full rounded-xl p-3 text-left ${selected === item.studentId ? 'bg-blue-600/30' : 'hover:bg-white/5'}`}>
        <span className="flex justify-between gap-2 text-sm font-medium"><span>{item.studentName}</span>{item.unreadCount > 0 && <span className="rounded-full bg-blue-500 px-2 text-xs">{item.unreadCount}</span>}</span>
        <span className="block text-xs text-slate-300 truncate mt-1">{item.latestMessage || 'No messages yet'}</span>
        {item.latestAt && <time className="text-[11px] text-slate-400">{new Date(item.latestAt).toLocaleString()}</time>}
      </button>) : <p className="p-3 text-sm text-slate-400">No students available.</p>}
    </aside>
    <section className="rounded-2xl bg-slate-800/40 border border-white/10 flex flex-col min-h-[30rem] max-h-[34rem]">
      <h2 className="p-3 border-b border-white/10 font-semibold">{active?.studentName || 'Select a conversation'}</h2>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cursor && <button onClick={older} className="text-sm text-blue-300 w-full">Load older messages</button>}
        {selected && !messages.length && <p className="text-sm text-slate-400 text-center py-8">Start the conversation.</p>}
        {messages.map(item => <div key={item.id} className={`flex ${item.senderAccountId === account?.id ? 'justify-end' : 'justify-start'}`}>
          <div className={`rounded-2xl px-3 py-2 max-w-[85%] ${item.senderAccountId === account?.id ? 'bg-blue-600' : 'bg-slate-700'}`}>
            <p className="text-xs opacity-75">{item.senderAccountId === account?.id ? 'You' : account?.role === 'TUTOR' ? active?.studentName : 'Tutor'}</p>
            <p className="text-sm whitespace-pre-wrap break-words">{item.body}</p>
            <p className="text-[11px] opacity-75 mt-1">{new Date(item.createdAt).toLocaleString()} {item.senderAccountId === account?.id && (item.readAt ? '· Read' : '· Sent')}</p>
          </div>
        </div>)}<div ref={bottom} />
      </div>
      <form onSubmit={send} className="p-3 border-t border-white/10 flex gap-2"><input className="flex-1 min-w-0 rounded-xl bg-slate-900 p-3 text-sm" aria-label="Message" placeholder="Write a message" maxLength={2000} disabled={!selected || busy} value={draft} onChange={e => setDraft(e.target.value)} /><button disabled={!selected || busy || !draft.trim()} className="rounded-xl bg-blue-600 px-4 disabled:opacity-50">Send</button></form>
      {error && <p role="alert" className="px-3 pb-2 text-xs text-rose-300">{error}</p>}
    </section>
  </div>;
};
