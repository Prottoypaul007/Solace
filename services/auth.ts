import { api, CurrentAccount, post } from './api';

export async function getAccount(): Promise<CurrentAccount> {
  const account = await api<CurrentAccount>('/api/me');
  if (!account || typeof account.id !== 'string' || typeof account.email !== 'string' ||
      (account.role !== 'TUTOR' && account.role !== 'STUDENT') || account.status !== 'ACTIVE') {
    throw new Error('The account server returned an incomplete response.');
  }
  return account;
}
export async function login(email: string, password: string): Promise<CurrentAccount> {
  await post('/api/auth/sign-in/email', { email, password });
  return getAccount();
}
export const logout = () => post('/api/auth/sign-out');
export const changePassword = (currentPassword: string, newPassword: string) =>
  post('/api/auth/change-password', { currentPassword, newPassword, revokeOtherSessions: true });
