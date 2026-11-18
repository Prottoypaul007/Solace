import { apiBase } from './api';

export interface Conversation { studentId: string; studentName: string; teacherName?: string; conversationId: string | null; latestMessage: string | null; latestAt: string | null; unreadCount: number }
export interface ChatMessage { id: string; senderAccountId: string; body: string; createdAt: string; readAt: string | null }
export interface Announcement { id: string; title: string; body: string; studentId?: string; teacherName?: string; created_at: string; updated_at: string; readAt?: string | null; recipientCount?: number; readCount?: number }
export interface Homework { id: string; title: string; description: string; studentId?: string; teacherName?: string; class_id: string | null; deadline: string | null; created_at: string; completedAt?: string | null; recipientCount?: number; completedCount?: number; attachments: Attachment[] }
export interface Attachment { id: string; name: string; mime: string; size: number }
export interface ScheduledClass { id: string; student_id: string; studentName: string; teacherName?: string; start_at: string; subject: string; reminder_minutes: number }
export interface Notice { id: string; type: 'MESSAGE' | 'ANNOUNCEMENT' | 'HOMEWORK' | 'CLASS_REMINDER'; resourceId: string; studentId?: string; teacherName?: string; createdAt: string; readAt: string | null }
export interface StudentChoice { id: string; name: string; subject: string }

export const liveEvents = (onEvent: (value: {type: string; studentId?: string}) => void) => {
  const source = new EventSource(`${apiBase}/api/events`, { withCredentials: true });
  source.onmessage = event => { try { onEvent(JSON.parse(event.data)); } catch { /* Ignore malformed event. */ } };
  return () => source.close();
};

export async function downloadAttachment(id: string, name: string): Promise<void> {
  const response = await fetch(`${apiBase}/api/homework/attachments/${encodeURIComponent(id)}`, { credentials: 'include' });
  if (!response.ok) throw new Error('Could not download this attachment.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
