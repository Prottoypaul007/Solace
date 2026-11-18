import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError, CurrentAccount } from '../services/api';
import { getAccount } from '../services/auth';

interface AuthContextValue { account: CurrentAccount | null; setAccount: (value: CurrentAccount | null) => void; refresh: () => Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null);
const cacheKey = 'solace_last_account';
const cachedAccount = (): CurrentAccount | null => {
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    return value && typeof value.id === 'string' && typeof value.email === 'string' &&
      (value.role === 'TUTOR' || value.role === 'STUDENT') && value.status === 'ACTIVE' ? value : null;
  } catch { return null; }
};
export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Authentication is not available.');
  return value;
};
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setCurrentAccount] = useState<CurrentAccount | null>(cachedAccount);
  const [loading, setLoading] = useState(() => !cachedAccount());
  const [connectionProblem, setConnectionProblem] = useState(false);
  const setAccount = useCallback((value: CurrentAccount | null) => {
    setCurrentAccount(value);
    try {
      if (value) localStorage.setItem(cacheKey, JSON.stringify(value));
      else localStorage.removeItem(cacheKey);
    } catch { /* A blocked cache must not interrupt authentication. */ }
  }, []);
  const refresh = useCallback(async () => {
    try {
      setAccount(await getAccount());
      setConnectionProblem(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAccount(null);
        setConnectionProblem(false);
      } else {
        setConnectionProblem(true);
      }
    }
  }, [setAccount]);
  useEffect(() => {
    void refresh().finally(() => setLoading(false));
    const expired = () => { setAccount(null); setConnectionProblem(false); };
    const check = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('solace-auth-expired', expired);
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(() => { void refresh(); }, 60_000);
    return () => { window.removeEventListener('solace-auth-expired', expired); document.removeEventListener('visibilitychange', check); window.clearInterval(timer); };
  }, [refresh, setAccount]);
  if (loading) return <div className="min-h-screen bg-slate-950 text-white grid place-items-center p-6 text-center"><div>Connecting to your account…<p className="mt-2 text-sm text-slate-400">The free server may take a minute to wake up.</p></div></div>;
  return <AuthContext.Provider value={{ account, setAccount, refresh }}>
    {connectionProblem && account && <div role="status" className="fixed inset-x-4 top-3 z-50 mx-auto max-w-sm rounded-xl border border-amber-400/40 bg-slate-900 p-3 text-center text-sm text-amber-100 shadow-lg">Connection is slow. Your sign-in is kept; retry when the server wakes.</div>}
    {children}
  </AuthContext.Provider>;
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
