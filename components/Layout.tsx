import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, MessageCircle, Settings, Users } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  studentMode?: boolean;
  wide?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack = false, onBack, studentMode = false, wide = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const items = studentMode
    ? [
        { label: 'Home', path: '/student-home', icon: Home, active: location.pathname === '/student-home' },
        { label: 'Connect', path: '/connect', icon: MessageCircle, active: location.pathname === '/connect' },
        { label: 'Account', path: '/student-account', icon: Settings, active: location.pathname === '/student-account' },
      ]
    : [
        { label: 'Home', path: '/', icon: Home, active: location.pathname === '/' },
        { label: 'Students', path: '/students', icon: Users, active: location.pathname === '/students' || location.pathname.startsWith('/student/') || location.pathname === '/add-student' },
        { label: 'Connect', path: '/connect', icon: MessageCircle, active: location.pathname === '/connect' },
        { label: 'Settings', path: '/settings', icon: Settings, active: location.pathname === '/settings' || location.pathname === '/account' || location.pathname === '/student-accounts' },
      ];

  return <div className="min-h-screen bg-slate-950 text-slate-50">
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl">
      <div className={`mx-auto flex items-center gap-3 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>
        {showBack ? <button type="button" aria-label="Go back" onClick={() => onBack ? onBack() : navigate(-1)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-slate-800 text-slate-100 active:bg-slate-700"><ArrowLeft size={20} /></button>
          : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500 text-lg font-bold text-white shadow-lg shadow-blue-500/20">S</div>}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">Solace</p>
          <h1 className="truncate text-xl font-bold leading-tight tracking-tight">{title || (studentMode ? 'My learning' : 'Home')}</h1>
        </div>
      </div>
    </header>

    <main className={`mx-auto w-full px-4 pb-[calc(env(safe-area-inset-bottom)+7.5rem)] pt-5 ${wide ? 'max-w-5xl' : 'max-w-xl'}`}>{children}</main>

    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/95 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] shadow-[0_-12px_32px_rgba(2,6,23,0.6)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-xl justify-around gap-1">
        {items.map(item => {
          const Icon = item.icon;
          return <button key={item.path} type="button" aria-current={item.active ? 'page' : undefined} onClick={() => navigate(item.path)} className={`flex min-h-14 min-w-16 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-semibold transition-colors active:scale-[0.97] ${item.active ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>
            <Icon size={21} strokeWidth={item.active ? 2.5 : 2} />
            <span>{item.label}</span>
          </button>;
        })}
      </div>
    </nav>
  </div>;
};
