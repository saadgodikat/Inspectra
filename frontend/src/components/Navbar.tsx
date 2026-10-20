import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import type { HealthStatus } from '../types';
import { LogOut, Activity, ShieldCheck, CheckCircle2, Layers } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      try {
        const res = await authApi.getHealth();
        if (isMounted) setHealth(res);
      } catch {
        if (isMounted) setHealth({ status: 'error', database: 'disconnected' });
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'quality_manager':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> Quality Manager
          </span>
        );
      case 'supervisor':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <Activity className="w-3 h-3" /> Production Supervisor
          </span>
        );
      case 'inspector':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Inspector / Operator
          </span>
        );
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-lg tracking-wider">
            QI
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              QITS
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono font-medium border border-indigo-500/30">
                Phase 1 MVP
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 leading-none">Inspection & Defect Tracking</p>
          </div>
        </div>

        {/* Phase progress badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs text-slate-300">
          <Layers className="w-3.5 h-3.5 text-indigo-400" />
          <span className="font-medium text-slate-400">Foundation:</span>
          <span className="text-emerald-400 font-semibold">Active & Tested</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Backend Health indicator */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/60 text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              health?.status === 'healthy'
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                : 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]'
            }`}
          />
          <span className="text-slate-300 font-medium">
            API: {health?.status === 'healthy' ? 'Online' : 'Degraded'}
          </span>
          {health?.database && (
            <span className="text-[10px] text-slate-400 border-l border-slate-700 pl-2">
              DB: {health.database}
            </span>
          )}
        </div>

        {/* User Profile */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-slate-200">{user.name}</div>
              <div className="text-[11px] text-slate-400 font-mono">{user.email}</div>
            </div>

            {getRoleBadge(user.role)}

            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
