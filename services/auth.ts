import { api, CurrentAccount, post } from './api';

export const getAccount = () => api<CurrentAccount>('/api/me');
export async function login(email: string, password: string): Promise<CurrentAccount> {
  await post('/api/auth/sign-in/email', { email, password });
  return getAccount();
}
export const logout = () => post('/api/auth/sign-out');
export const changePassword = (currentPassword: string, newPassword: string) =>
  post('/api/auth/change-password', { currentPassword, newPassword, revokeOtherSessions: true });
