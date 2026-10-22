import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { UserRole } from '../types';
import { ChevronDown } from 'lucide-react';

const ROLES: { value: UserRole; label: string; sub: string }[] = [
  { value: 'inspector', label: 'Lead QA', sub: 'Inspector // Station 04' },
  { value: 'supervisor', label: 'Production Supervisor', sub: 'Supervisor // Line 04' },
  { value: 'quality_manager', label: 'Quality Manager', sub: 'Sector Lead' },
];

export const Navbar: React.FC = () => {
  const { user, switchRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentRole = ROLES.find((r) => r.value === user?.role) ?? ROLES[0];
  const otherRoles = ROLES.filter((r) => r.value !== user?.role);

  const handleSwitch = async (role: UserRole) => {
    setSwitching(true);
    setOpen(false);
    try {
      await switchRole(role);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-surface-container-low border-b border-surface-container-high z-50 flex items-center justify-between px-margin select-none">
      {/* Brand + Role Switcher */}
      <div className="flex items-center gap-space-lg">
        <div className="flex items-center gap-space-sm cursor-pointer">
          <div className="w-8 h-8 rounded bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-300 flex items-center justify-center font-bold text-black font-mono shadow-sm">
            <span className="material-symbols-outlined text-[20px] text-black">analytics</span>
          </div>
          <span className="font-headline text-headline-md tracking-wider text-on-surface uppercase font-bold">
            INSPECTRA
          </span>
        </div>

      </div>

      {/* Clock, Role Switcher & User */}
      <div className="flex items-center gap-space-md">
        {/* Role Switcher Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            disabled={switching}
            className="flex items-center gap-2 px-space-sm py-1 rounded border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-high transition-colors"
          >
            <div className="flex flex-col text-left">
              <span className="text-label-md text-on-surface font-semibold leading-tight">
                {switching ? 'Switching…' : currentRole.label}
              </span>
              <span className="text-label-sm text-on-surface-variant font-mono leading-tight">
                {currentRole.sub}
              </span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-outline transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-surface-container-low border border-surface-container-high rounded shadow-lg z-50 overflow-hidden">
              {otherRoles.map((r) => (
                <button
                  key={r.value}
                  onClick={() => handleSwitch(r.value)}
                  className="w-full flex flex-col text-left px-space-sm py-2 hover:bg-surface-container-high transition-colors"
                >
                  <span className="text-label-md text-on-surface font-semibold">{r.label}</span>
                  <span className="text-label-sm text-on-surface-variant font-mono">{r.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden md:block text-right">
              <span className="text-label-md text-on-surface font-semibold">{user.name}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-mono font-bold text-on-primary text-xs shadow-sm">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-1.5 rounded hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
