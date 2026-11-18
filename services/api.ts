export const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3005').replace(/\/$/, '');

export interface CurrentAccount {
  id: string;
  role: 'TUTOR' | 'STUDENT';
  status: 'ACTIVE';
  studentId: string | null;
  name: string;
  email: string;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401 && !path.startsWith('/api/auth/') && !path.startsWith('/api/public/')) {
    window.dispatchEvent(new Event('solace-auth-expired'));
  }
  if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Request failed. Please try again.');
  return body as T;
}

export const post = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
