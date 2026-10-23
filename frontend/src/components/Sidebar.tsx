import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock } from 'lucide-react';

interface NavItem {
  name: string;
  to: string;
  iconName: string;
  allowedRoles?: string[];
}

const navItems: NavItem[] = [
  {
    name: 'Command Center',
    to: '/',
    iconName: 'dashboard',
  },
  {
    name: 'Inspections & Runs',
    to: '/inspections',
    iconName: 'fact_check',
  },
  {
    name: 'Defect Tracker & CAPA',
    to: '/reviews',
    iconName: 'bug_report',
  },
  {
    name: 'Batch Releases & Gates',
    to: '/batch-decisions',
    iconName: 'verified',
    allowedRoles: ['quality_manager', 'supervisor'],
  },
  {
    name: 'Analytics & SPC Yield',
    to: '/analytics',
    iconName: 'query_stats',
  },
  {
    name: 'Ask Inspectra',
    to: '/chatbot',
    iconName: 'forum',
  },
  {
    name: 'Products & Lots',
    to: '/products',
    iconName: 'inventory_2',
  },
  {
    name: 'Audit Event Log',
    to: '/audit',
    iconName: 'history_edu',
    allowedRoles: ['quality_manager'],
  },
];

export const Sidebar: React.FC = () => {
  const { user } = useAuth();

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-64 bg-surface-container-lowest border-r border-surface-container-high z-40 flex flex-col justify-between p-space-md select-none overflow-y-auto">
      <div className="flex flex-col gap-space-xs">
        <div className="px-space-sm py-space-xs mb-space-xs">
          <span className="text-label-sm uppercase tracking-widest text-outline font-mono font-semibold">
            CONSOLE NAVIGATION
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isAllowed = !item.allowedRoles || (user && item.allowedRoles.includes(user.role));

            if (!isAllowed) {
              return (
                <div
                  key={item.to}
                  className="flex items-center justify-between px-space-md py-space-sm rounded-lg text-body-md text-outline/50 cursor-not-allowed"
                  title={`Restricted to ${item.allowedRoles?.join(', ')}`}
                >
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-[18px] opacity-40">
                      {item.iconName}
                    </span>
                    <span>{item.name}</span>
                  </div>
                  <Lock className="w-3.5 h-3.5 opacity-40" />
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between px-space-md py-space-sm rounded-lg text-body-md transition-colors ${
                    isActive
                      ? 'bg-primary-container text-on-primary-container font-semibold border-l-2 border-primary shadow-sm'
                      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-space-sm">
                      <span
                        className={`material-symbols-outlined text-[18px] ${
                          isActive ? 'text-on-primary-container' : 'text-outline'
                        }`}
                      >
                        {item.iconName}
                      </span>
                      <span>{item.name}</span>
                    </div>

                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col gap-space-xs pt-space-md border-t border-surface-container-high">
        {user?.role === 'quality_manager' && (
          <nav className="flex flex-col gap-1 mb-2">
            <NavLink
              to="/users"
              className={({ isActive }) =>
                `flex items-center gap-space-sm px-space-md py-space-sm rounded-lg text-body-md transition-colors ${
                  isActive
                    ? 'bg-primary-container text-on-primary-container font-semibold border-l-2 border-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                }`
              }
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              <span>User & Role Controls</span>
            </NavLink>
          </nav>
        )}

        <div className="px-space-md py-space-xs flex items-center justify-between text-outline">
          <span className="text-label-sm font-mono text-tertiary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
            CALIBRATION: PASS
          </span>
          <span className="text-label-sm font-mono">v4.1.2-QA</span>
        </div>
      </div>
    </aside>
  );
};
