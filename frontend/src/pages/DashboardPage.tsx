import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi, inspectionsApi, productsApi, batchesApi } from '../api/client';
import type { HealthStatus, Inspection, Product, Batch } from '../types';
import { useNavigate } from 'react-router-dom';

/* ── Shift helper ── */
const SHIFT_LABELS: Record<number, string> = { 0: 'NIGHT', 1: 'DAY', 2: 'SWING' };

const getShift = () => {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 1;
  if (h >= 14 && h < 22) return 2;
  return 0;
};

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [utcTime, setUtcTime] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [healthRes, inspRes, prodRes, batchRes] = await Promise.allSettled([
        authApi.getHealth(),
        inspectionsApi.list({ per_page: 50 }),
        productsApi.list(),
        batchesApi.list(),
      ]);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
      if (inspRes.status === 'fulfilled') setInspections(inspRes.value.inspections);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.products);
      if (batchRes.status === 'fulfilled') setBatches(batchRes.value.batches);
    } catch {
      /* graceful degrade */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const tick = () => setUtcTime(new Date().toISOString().slice(11, 19) + ' UTC');
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  /* ── Computed KPIs ── */
  const totalInspections = inspections.length;
  const pendingReview = inspections.filter((i) => i.status === 'pending_review').length;
  const processingCount = inspections.filter((i) => i.status === 'processing').length;
  const reviewedCount = inspections.filter((i) => i.status === 'reviewed').length;
  const failedCount = inspections.filter((i) => i.status === 'processing_failed').length;
  const fpy = totalInspections > 0 ? ((reviewedCount / totalInspections) * 100).toFixed(1) : '—';

  const activeBatches = batches.filter((b) => !['archived', 'released'].includes(b.status)).length;
  const releasedBatches = batches.filter((b) => b.status === 'released').length;
  const onHoldBatches = batches.filter((b) => b.status === 'on_hold').length;
  const activeProducts = products.filter((p) => p.is_active).length;

  const shift = getShift();
  const shiftLabel = SHIFT_LABELS[shift];

  const recentInspections = [...inspections]
    .sort((a, b) => new Date(b.inspection_timestamp).getTime() - new Date(a.inspection_timestamp).getTime())
    .slice(0, 8);

  const statusColor = (s: string) => {
    switch (s) {
      case 'pending_upload': return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      case 'processing': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'pending_review': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'reviewed': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'processing_failed': return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  const batchStatusColor = (s: string) => {
    switch (s) {
      case 'created': return 'bg-slate-800 text-slate-300 border-slate-700';
      case 'in_production': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'produced': return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      case 'under_inspection': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'on_hold': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'released': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-800/80 text-slate-400 border-slate-700/60';
    }
  };

  return (
    <div className="space-y-6 max-w-[1440px] mx-auto">
      {/* ── Header Banner ── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-surface-container-lowest via-surface-container-low to-surface-container border border-surface-container-high p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-40 bg-gradient-to-tr from-tertiary/5 to-transparent pointer-events-none rounded-tr-full" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2.5 py-0.5 rounded bg-primary/15 border border-primary/30 text-primary text-label-sm font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                SHIFT {String(shift).padStart(2, '0')} ({shiftLabel})
              </span>
              <span className="px-2.5 py-0.5 rounded bg-tertiary/10 border border-tertiary/25 text-tertiary text-label-sm font-mono uppercase tracking-wider">
                {utcTime}
              </span>
            </div>
            <h1 className="text-headline-lg font-headline text-on-surface tracking-tight font-bold">
              Command Center
            </h1>
            <p className="mt-1 text-body-md text-on-surface-variant leading-relaxed max-w-xl">
              Welcome back, <span className="font-semibold text-primary">{user?.name}</span>.
              Real-time overview of quality operations across all active production lines.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/inspections')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-body-sm font-semibold transition-all shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-[18px]">fact_check</span>
              <span>Open Inspections</span>
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant text-body-sm font-semibold transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">query_stats</span>
              <span>View SPC Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Ribbon ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {[
          { label: 'Total Inspections', value: totalInspections, icon: 'fact_check', accent: 'text-on-surface' },
          { label: 'Pending Review', value: pendingReview, icon: 'pending_actions', accent: 'text-cyan-400' },
          { label: 'Processing', value: processingCount, icon: 'hourglass_top', accent: 'text-amber-400' },
          { label: 'Reviewed / Pass', value: reviewedCount, icon: 'check_circle', accent: 'text-emerald-400' },
          { label: 'Failed', value: failedCount, icon: 'error', accent: 'text-rose-400' },
          { label: 'Active Batches', value: activeBatches, icon: 'inventory_2', accent: 'text-blue-400' },
          { label: 'Released', value: releasedBatches, icon: 'verified', accent: 'text-emerald-400' },
          { label: 'On Hold', value: onHoldBatches, icon: 'block', accent: 'text-amber-400' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container-high hover:border-outline-variant/40 transition-colors group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-label-sm text-outline font-mono uppercase tracking-wider truncate">{kpi.label}</span>
              <span className={`material-symbols-outlined text-[16px] ${kpi.accent} opacity-60 group-hover:opacity-100 transition-opacity`}>
                {kpi.icon}
              </span>
            </div>
            <div className={`text-xl font-bold font-mono ${kpi.accent}`}>
              {loading ? '—' : kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Grid: 2 columns ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left: System Health + Recent Inspections ── */}
        <div className="xl:col-span-2 space-y-6">

          {/* System Health Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high">
              <div className="flex items-center justify-between mb-2">
                <span className="text-label-sm text-outline font-mono uppercase tracking-wider">API Server</span>
                <span className="material-symbols-outlined text-[18px] text-emerald-400">dns</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-body-md font-semibold text-on-surface">
                  {health?.status === 'healthy' ? 'Operational' : 'Connecting…'}
                </span>
              </div>
              <p className="text-label-sm text-outline mt-1 font-mono">REST API</p>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high">
              <div className="flex items-center justify-between mb-2">
                <span className="text-label-sm text-outline font-mono uppercase tracking-wider">Database</span>
                <span className="material-symbols-outlined text-[18px] text-blue-400">database</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-emerald-400">check_circle</span>
                <span className="text-body-md font-semibold text-on-surface">
                  {health?.database === 'connected' ? 'Connected' : 'Syncing'}
                </span>
              </div>
              <p className="text-label-sm text-outline mt-1 font-mono">ORM + Migrations</p>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high">
              <div className="flex items-center justify-between mb-2">
                <span className="text-label-sm text-outline font-mono uppercase tracking-wider">Catalog</span>
                <span className="material-symbols-outlined text-[18px] text-primary">inventory</span>
              </div>
              <div className="text-body-md font-semibold text-on-surface">
                {activeProducts} Products
              </div>
              <p className="text-label-sm text-outline mt-1 font-mono">{batches.length} total batches</p>
            </div>
          </div>

          {/* Recent Inspections Table */}
          <div className="rounded-2xl bg-surface-container-lowest border border-surface-container-high overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[18px] text-primary">history</span>
                <h3 className="text-body-lg font-headline font-semibold text-on-surface">Recent Inspections</h3>
                <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/25 text-primary text-label-sm font-mono">
                  {totalInspections}
                </span>
              </div>
              <button
                onClick={() => navigate('/inspections')}
                className="text-label-sm text-primary hover:text-primary/80 font-semibold font-mono uppercase tracking-wider transition-colors flex items-center gap-1"
              >
                View All
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </button>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                <span className="text-body-sm text-outline font-mono">Loading inspection data…</span>
              </div>
            ) : recentInspections.length === 0 ? (
              <div className="p-12 text-center">
                <span className="material-symbols-outlined text-[32px] text-outline/40 mb-2 block">inbox</span>
                <p className="text-body-md text-on-surface-variant font-semibold">No inspections recorded</p>
                <p className="text-body-sm text-outline mt-1">Create your first inspection to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-surface-container-high text-outline bg-surface-container-low/40">
                      <th className="py-2.5 px-5 text-label-sm font-mono font-semibold uppercase tracking-wider">ID</th>
                      <th className="py-2.5 px-5 text-label-sm font-mono font-semibold uppercase tracking-wider">Product</th>
                      <th className="py-2.5 px-5 text-label-sm font-mono font-semibold uppercase tracking-wider">Batch</th>
                      <th className="py-2.5 px-5 text-label-sm font-mono font-semibold uppercase tracking-wider">Status</th>
                      <th className="py-2.5 px-5 text-label-sm font-mono font-semibold uppercase tracking-wider">Images</th>
                      <th className="py-2.5 px-5 text-label-sm font-mono font-semibold uppercase tracking-wider">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high/60">
                    {recentInspections.map((insp) => (
                      <tr
                        key={insp.id}
                        className="hover:bg-surface-container/30 transition-colors cursor-pointer"
                        onClick={() => navigate('/inspections')}
                      >
                        <td className="py-3 px-5 text-body-sm font-mono text-primary font-semibold">
                          INS-{String(insp.id).padStart(4, '0')}
                        </td>
                        <td className="py-3 px-5 text-body-sm text-on-surface">
                          {insp.product?.name || insp.product?.product_code || `#${insp.product_id}`}
                        </td>
                        <td className="py-3 px-5 text-body-sm text-on-surface-variant font-mono">
                          {insp.batch?.batch_number || `#${insp.batch_id}`}
                        </td>
                        <td className="py-3 px-5">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${statusColor(insp.status)}`}>
                            {insp.status.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-body-sm text-on-surface-variant font-mono">
                          {insp.image_count}
                        </td>
                        <td className="py-3 px-5 text-body-sm text-outline font-mono">
                          {new Date(insp.inspection_timestamp).toLocaleString(undefined, {
                            month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div className="space-y-6">

          {/* FPY Gauge */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high">
            <div className="flex items-center justify-between mb-4">
              <span className="text-label-sm text-outline font-mono uppercase tracking-wider">First Pass Yield</span>
              <span className="material-symbols-outlined text-[18px] text-emerald-400">speed</span>
            </div>
            <div className="text-center py-4">
              <div className="text-4xl font-bold font-mono text-emerald-400">
                {fpy === '—' ? '—' : `${fpy}%`}
              </div>
              <p className="text-label-sm text-outline mt-2 font-mono">
                {reviewedCount} / {totalInspections} inspections passed
              </p>
            </div>
            <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700"
                style={{ width: fpy === '—' ? '0%' : `${Math.min(parseFloat(fpy), 100)}%` }}
              />
            </div>
          </div>

          {/* Inspection Status Summary */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high">
            <div className="flex items-center justify-between mb-4">
              <span className="text-label-sm text-outline font-mono uppercase tracking-wider">Inspection Pipeline</span>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Pending Upload',   key: 'pending_upload',   color: 'bg-slate-400' },
                { label: 'Processing',       key: 'processing',       color: 'bg-amber-400' },
                { label: 'Pending Review',   key: 'pending_review',   color: 'bg-cyan-400' },
                { label: 'Reviewed',         key: 'reviewed',         color: 'bg-emerald-400' },
                { label: 'Failed',           key: 'processing_failed',color: 'bg-rose-400' },
              ].map(({ label, key, color }) => {
                const count = inspections.filter((i) => i.status === key).length;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-body-sm font-mono text-on-surface flex-1">{label}</span>
                    <span className="text-label-sm font-mono text-on-surface-variant">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Batch Pipeline */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high">
            <div className="flex items-center justify-between mb-4">
              <span className="text-label-sm text-outline font-mono uppercase tracking-wider">Batch Pipeline</span>
              <button
                onClick={() => navigate('/products')}
                className="text-label-sm text-primary font-mono hover:underline"
              >
                View →
              </button>
            </div>
            {batches.length === 0 ? (
              <p className="text-body-sm text-outline text-center py-4 font-mono">No batches registered</p>
            ) : (
              <div className="space-y-2">
                {batches.slice(0, 6).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-container/30 transition-colors cursor-pointer"
                    onClick={() => navigate('/products')}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="material-symbols-outlined text-[14px] text-outline">package_2</span>
                      <span className="text-body-sm font-mono text-on-surface truncate">{b.batch_number}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border whitespace-nowrap ${batchStatusColor(b.status)}`}>
                      {b.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Role Permission Quick Card */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px] text-primary">admin_panel_settings</span>
              <span className="text-label-sm text-outline font-mono uppercase tracking-wider">Your Permissions</span>
            </div>
            <div className="space-y-2">
              {[
                { domain: 'Inspections', inspector: 'Create & Upload', supervisor: 'Create & Review', quality_manager: 'Full Access' },
                { domain: 'Defect Actions', inspector: 'Confirm ML', supervisor: 'Fix Evidence', quality_manager: 'Close / Reopen' },
                { domain: 'Batch Decisions', inspector: '—', supervisor: '—', quality_manager: 'Hold / Release' },
                { domain: 'Audit Trail', inspector: '—', supervisor: '—', quality_manager: 'Full Read' },
              ].map((row) => {
                const perm = user?.role ? row[user.role as keyof typeof row] : '—';
                return (
                  <div key={row.domain} className="flex items-center justify-between py-1.5">
                    <span className="text-body-sm text-on-surface-variant">{row.domain}</span>
                    <span className={`text-label-sm font-mono ${perm === '—' ? 'text-outline/40' : 'text-primary'}`}>
                      {perm}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
