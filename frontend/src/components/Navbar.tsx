import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import type { HealthStatus } from '../types';
import { LogOut, Radio } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toTimeString().split(' ')[0] + ' UTC');
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const getRoleDisplayName = (role?: string) => {
    switch (role) {
      case 'quality_manager':
        return 'Quality Manager // Sector Lead';
      case 'supervisor':
        return 'Production Supervisor // Line 04';
      case 'inspector':
      default:
        return 'Lead QA // Station 04';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-surface-container-low border-b border-surface-container-high z-50 flex items-center justify-between px-margin select-none">
      {/* Brand & Line Operational Telemetry */}
      <div className="flex items-center gap-space-lg">
        <div className="flex items-center gap-space-sm cursor-pointer">
          <div className="w-8 h-8 rounded bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-300 flex items-center justify-center font-bold text-black font-mono shadow-sm">
            <span className="material-symbols-outlined text-[20px] text-black">analytics</span>
          </div>
          <span className="font-headline text-headline-md tracking-wider text-on-surface uppercase font-bold">
            INSPECTRA
          </span>
        </div>

        <div className="h-4 w-px bg-surface-container-high hidden sm:block"></div>

        <div className="hidden sm:flex items-center gap-space-sm">
          <span className="px-space-sm py-0.5 rounded-full bg-surface-container border border-outline-variant/30 text-label-sm font-label-sm text-tertiary font-mono uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
            OPERATIONAL
          </span>
          <span className="px-space-sm py-0.5 rounded bg-surface-container-lowest border border-primary-container/40 text-label-sm font-label-sm text-primary font-mono uppercase tracking-wider flex items-center gap-1">
            <Radio className="w-3 h-3 text-primary animate-pulse" />
            LINE-04 ACTIVE
          </span>
          {health?.status === 'healthy' && (
            <span className="hidden lg:inline-flex px-space-sm py-0.5 rounded bg-surface-container-lowest border border-outline-variant/30 text-label-sm font-mono text-outline uppercase">
              API // SYNCED
            </span>
          )}
        </div>
      </div>

      {/* Clock & User Profile */}
      <div className="flex items-center gap-space-md">
        <div className="hidden md:flex items-center bg-surface-container-lowest border border-surface-container-high px-space-sm py-1 rounded text-on-surface-variant font-mono text-body-sm">
          <span className="material-symbols-outlined text-[15px] mr-1.5 text-primary">schedule</span>
          <span>SHIFT 02 (DAY) • {utcTime || '14:32:09 UTC'}</span>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-label-md text-on-surface font-semibold">{user.name}</span>
              <span className="text-label-sm text-on-surface-variant font-mono">
                {getRoleDisplayName(user.role)}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-mono font-bold text-on-primary text-xs shadow-sm">
              {user.name.slice(0, 2).toUpperCase()}
            </div>

            <button
              onClick={logout}
              title="Sign Out"
              className="p-1.5 rounded hover:bg-surface-container-high text-outline hover:text-error transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
