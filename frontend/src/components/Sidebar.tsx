import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Boxes,
  Camera,
  CheckSquare,
  Wrench,
  Lock,
  History,
  Users,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  name: string;
  to: string;
  icon: React.ElementType;
  phase: string;
  allowedRoles?: string[];
}

const navItems: NavItem[] = [
  {
    name: 'Overview',
    to: '/',
    icon: LayoutDashboard,
    phase: 'Phase 1',
  },
  {
    name: 'Products & Batches',
    to: '/products',
    icon: Boxes,
    phase: 'Phase 2',
  },
  {
    name: 'Inspections & Upload',
    to: '/inspections',
    icon: Camera,
    phase: 'Phase 3',
  },
  {
    name: 'Human Review & Defects',
    to: '/reviews',
    icon: CheckSquare,
    phase: 'Phase 5',
  },
  {
    name: 'Corrective Actions',
    to: '/corrective-actions',
    icon: Wrench,
    phase: 'Phase 5',
    allowedRoles: ['supervisor', 'quality_manager'],
  },
  {
    name: 'Batch Decisions',
    to: '/batch-decisions',
    icon: ShieldCheck,
    phase: 'Phase 6',
    allowedRoles: ['quality_manager'],
  },
  {
    name: 'Audit Trail',
    to: '/audit',
    icon: History,
    phase: 'Phase 2+',
    allowedRoles: ['quality_manager'],
  },
  {
    name: 'User Management',
    to: '/users',
    icon: Users,
    phase: 'Phase 1',
    allowedRoles: ['quality_manager'],
  },
];

export const Sidebar: React.FC = () => {
  const { user } = useAuth();

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-900/40 backdrop-blur-sm flex flex-col flex-shrink-0">
      <div className="p-4 flex-1 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 py-2">
          Navigation
        </div>

        {navItems.map((item) => {
          const isAllowed = !item.allowedRoles || (user && item.allowedRoles.includes(user.role));
          const Icon = item.icon;

          if (!isAllowed) {
            return (
              <div
                key={item.name}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium text-slate-600 cursor-not-allowed opacity-60"
                title={`Requires ${item.allowedRoles?.join(', ')}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-slate-600" />
                  <span>{item.name}</span>
                </div>
                <Lock className="w-3.5 h-3.5 text-slate-600" />
              </div>
            );
          }

          return (
            <NavLink
              key={item.name}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        isActive
                          ? 'bg-indigo-500/20 text-indigo-300'
                          : 'bg-slate-800/80 text-slate-400'
                      }`}
                    >
                      {item.phase}
                    </span>
                    <ChevronRight
                      className={`w-3 h-3 transition-transform ${
                        isActive ? 'text-indigo-400 translate-x-0.5' : 'text-slate-600 opacity-0 group-hover:opacity-100'
                      }`}
                    />
                  </div>
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Role permission info banner */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
        <div className="text-[11px] text-slate-400">
          <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Backend RBAC Active
          </div>
          <p className="text-[10px] leading-relaxed text-slate-400">
            Permissions strictly enforced on API endpoints. UI restrictions mirror backend access matrix.
          </p>
        </div>
      </div>
    </aside>
  );
};
