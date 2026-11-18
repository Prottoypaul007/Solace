import React, { createContext, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CurrentAccount } from '../services/api';
import { getAccount } from '../services/auth';

interface AuthContextValue { account: CurrentAccount | null; setAccount: (value: CurrentAccount | null) => void; refresh: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null);
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Authentication is not available.');
  return value;
};
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<CurrentAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try { setAccount(await getAccount()); } catch { setAccount(null); }
  };
  useEffect(() => {
    void refresh().finally(() => setLoading(false));
    const expired = () => setAccount(null);
    const check = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('solace-auth-expired', expired);
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    return () => { window.removeEventListener('solace-auth-expired', expired); document.removeEventListener('visibilitychange', check); window.clearInterval(timer); };
  }, []);
  if (loading) return <div className="min-h-screen bg-slate-950 text-white grid place-items-center">Checking account…</div>;
  return <AuthContext.Provider value={{ account, setAccount, refresh }}>{children}</AuthContext.Provider>;
};
export const Protected: React.FC<{ role: 'TUTOR' | 'STUDENT'; children: React.ReactNode }> = ({ role, children }) => {
  const { account } = useAuth();
  const location = useLocation();
  if (!account) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (account.role !== role) return <Navigate to={account.role === 'STUDENT' ? '/student-home' : '/'} replace />;
  return <>{children}</>;
};
export const Authenticated: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { account } = useAuth();
  return account ? <>{children}</> : <Navigate to="/login" replace />;
};
