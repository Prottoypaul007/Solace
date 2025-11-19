import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Users, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  title,
  showBack = false,
  onBack,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navButtonClasses = (active: boolean) =>
    `flex flex-col items-center justify-center gap-0.5 text-[11px] ${
      active ? 'text-blue-400' : 'text-slate-400'
    }`;

  const iconWrapperClasses = (active: boolean) =>
    `h-9 w-9 flex items-center justify-center rounded-2xl border transition-all ${
      active
        ? 'bg-blue-500/15 border-blue-400/70 shadow-lg shadow-blue-500/30'
        : 'bg-white/5 border-white/10'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      {/* Header */}
      <header className="pt-10 pb-4 px-5 bg-gradient-to-b from-slate-950/95 to-slate-900/95 shadow-lg shadow-black/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {showBack ? (
              <button
                onClick={() => (onBack ? onBack() : navigate(-1))}
                className="h-9 w-9 rounded-full flex items-center justify-center bg-white/5 border border-white/20"
              >
                <span className="text-lg leading-none">&larr;</span>
              </button>
            ) : (
              <div className="h-9 w-9 rounded-2xl bg-blue-500/20 border border-blue-400/50 flex items-center justify-center text-xs font-semibold tracking-tight">
                TT
              </div>
            )}

            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                {title ?? 'Solace'}
              </h1>
              <p className="text-[11px] text-slate-300">
                Track students, classes & payments in one place
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-5 pb-24 -mt-3">
        <div className="bg-slate-900/80 border border-white/10 rounded-3xl shadow-2xl shadow-black/50 p-4 backdrop-blur-md max-w-md mx-auto h-[calc(100vh-7.5rem)] overflow-y-auto no-scrollbar">
          {children}
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed left-0 right-0 bottom-0 z-20">
        <div className="mx-auto max-w-md mb-4 px-4">
          <div className="bg-slate-950/95 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 px-6 py-2 flex items-center justify-between backdrop-blur-lg">
            {/* Home */}
            <button
              onClick={() => navigate('/')}
              className={navButtonClasses(isActive('/'))}
            >
              <div className={iconWrapperClasses(isActive('/'))}>
                <Home size={20} strokeWidth={isActive('/') ? 2.5 : 2} />
              </div>
              <span className="font-medium">Home</span>
            </button>

            {/* Students */}
            <button
              onClick={() => navigate('/students')}
              className={navButtonClasses(isActive('/students') || location.pathname.startsWith('/student'))}
            >
              <div
                className={iconWrapperClasses(
                  isActive('/students') || location.pathname.startsWith('/student')
                )}
              >
                <Users
                  size={20}
                  strokeWidth={
                    isActive('/students') ||
                    location.pathname.startsWith('/student')
                      ? 2.5
                      : 2
                  }
                />
              </div>
              <span className="font-medium">Students</span>
            </button>

            {/* Settings placeholder */}
            <button
              className="flex flex-col items-center justify-center gap-0.5 text-[11px] text-slate-500 cursor-not-allowed"
            >
              <div className="h-9 w-9 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10">
                <Settings size={20} />
              </div>
              <span className="font-medium">Soon</span>
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
};
