import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import type { HealthStatus } from '../types';
import {
  CheckCircle,
  Database,
  KeyRound,
  ShieldCheck,
  Server,
  Layers,
  Sparkles,
  ArrowRight,
  Boxes,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    authApi.getHealth().then(setHealth).catch(() => {
      setHealth({ status: 'error', database: 'disconnected' });
    });
  }, []);

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-slate-900 border border-indigo-500/20 p-8 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Phase 1 Foundation Verified
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Welcome back, {user?.name}
          </h1>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            You are signed in as an authorized{' '}
            <span className="font-semibold text-indigo-400 uppercase">{user?.role}</span>.
            The foundation, database schemas, RBAC permission middleware, and secure authentication
            pipeline are fully initialized and operating.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/products')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/30"
            >
              <span>Explore Products & Batches (Phase 2 Preview)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {user?.role === 'quality_manager' && (
              <button
                onClick={() => navigate('/users')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
              >
                <span>Manage Users & Roles</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              API Server
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            {health?.status === 'healthy' ? 'Operational' : 'Connecting...'}
          </div>
          <p className="text-xs text-slate-400 mt-1">Python Flask REST API on port 5000</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Relational Database
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-white flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            {health?.database === 'connected' ? 'Connected' : 'Syncing'}
          </div>
          <p className="text-xs text-slate-400 mt-1">12 Models Migrated (Alembic)</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Session & Security
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <KeyRound className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            JWT RBAC Active
          </div>
          <p className="text-xs text-slate-400 mt-1">Bcrypt hash + Server-side permissions</p>
        </div>
      </div>

      {/* Role Permission Matrix Card */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Domain Model & Role Permission Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Enforced server-side for every endpoint. Backend never relies on frontend checks.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="pb-3 font-semibold">Workflow Domain</th>
                <th className="pb-3 font-semibold text-cyan-400">Inspector / Operator</th>
                <th className="pb-3 font-semibold text-amber-400">Production Supervisor</th>
                <th className="pb-3 font-semibold text-emerald-400">Quality Manager</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="py-3 font-medium text-white flex items-center gap-2">
                  <Boxes className="w-3.5 h-3.5 text-indigo-400" />
                  Products & Batches
                </td>
                <td className="py-3 text-slate-400">View Products & Batches</td>
                <td className="py-3 text-slate-300">Create & Edit Batches</td>
                <td className="py-3 text-emerald-300 font-medium">Full CRUD & Archival</td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-white flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  Inspections & Evidence
                </td>
                <td className="py-3 text-cyan-300 font-medium">Create, Upload & Inspect</td>
                <td className="py-3 text-slate-300">Create & Review</td>
                <td className="py-3 text-slate-300">Full Access</td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-white flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />
                  Review & Defect Actions
                </td>
                <td className="py-3 text-slate-400">Confirm/Correct ML Suggestion</td>
                <td className="py-3 text-amber-300 font-medium">Assign & Submit Fix Evidence</td>
                <td className="py-3 text-emerald-300 font-medium">Close / Reopen Actions</td>
              </tr>
              <tr>
                <td className="py-3 font-medium text-white flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  Batch Decisions
                </td>
                <td className="py-3 text-slate-600 font-mono">Restricted</td>
                <td className="py-3 text-slate-600 font-mono">Restricted</td>
                <td className="py-3 text-emerald-300 font-medium">Exclusive Hold/Release</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
