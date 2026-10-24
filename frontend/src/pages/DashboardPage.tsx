import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { dashboardApi, type DashboardStats } from '../api/client';
import { useNavigate } from 'react-router-dom';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setDashboardStats(await dashboardApi.get());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const inspectionCounts = dashboardStats?.inspections.by_status ?? {};
  const batchCounts = dashboardStats?.batches.by_status ?? {};
  const totalInspections = dashboardStats?.inspections.total ?? 0;
  const pendingReview = inspectionCounts.pending_review ?? 0;
  const reviewedCount = dashboardStats?.fpy_metric?.reviewed ?? inspectionCounts.reviewed ?? 0;
  const passedCount = dashboardStats?.fpy_metric?.passed ?? 0;
  const unreviewedAiFlags = dashboardStats?.ai_flags?.unreviewed_suggestions ?? 0;
  const confirmedDefectsCount = dashboardStats?.defects.total ?? 0;
  const totalBatches = dashboardStats?.batches.total ?? 0;
  const releasedBatches = batchCounts.released ?? 0;
  const onHoldBatches = batchCounts.on_hold ?? 0;
  const activeBatches = totalBatches - releasedBatches - (batchCounts.archived ?? 0);
  const activeProducts = dashboardStats?.active_products ?? 0;
  const recentInspections = (dashboardStats?.recent_inspections ?? []).slice(0, 8);

  const batchStatusColor = (s: string) => {
    switch (s) {
      case 'created': return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      case 'in_production': return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'produced': return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'under_inspection': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      case 'on_hold': return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      case 'released': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'archived': return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
      default: return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
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
            <h1 className="text-headline-lg font-headline text-on-surface tracking-tight font-bold">
              Command Center
            </h1>
            <p className="mt-1 text-body-md text-on-surface-variant leading-relaxed max-w-xl">
              Welcome back, <span className="font-semibold text-primary">{user?.name}</span>.
              Persisted overview of inspection and batch quality records.
            </p>
          </div>

          {loadError && (
            <div role="alert" className="rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-body-sm text-error">
              Dashboard metrics could not be loaded: {loadError}
            </div>
          )}

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
          { label: 'Total Inspections', value: totalInspections, sub: 'All runs', icon: 'fact_check', accent: 'text-on-surface' },
          { label: 'Pending Review', value: pendingReview, sub: 'Needs human signoff', icon: 'pending_actions', accent: 'text-cyan-400' },
          { label: 'Passed Inspections', value: passedCount, sub: `${reviewedCount > 0 ? ((passedCount / reviewedCount) * 100).toFixed(0) : 0}% of reviewed`, icon: 'check_circle', accent: 'text-emerald-400' },
          { label: 'AI Flags (Unreviewed)', value: unreviewedAiFlags, sub: 'Model suggestion only', icon: 'smart_toy', accent: 'text-amber-400' },
          { label: 'Confirmed Defects', value: confirmedDefectsCount, sub: 'Human verified', icon: 'warning', accent: 'text-rose-400' },
          { label: 'Active Batches', value: activeBatches, sub: `${releasedBatches} released`, icon: 'inventory_2', accent: 'text-blue-400' },
          { label: 'Batches On Hold', value: onHoldBatches, sub: 'Quality quarantine', icon: 'block', accent: 'text-amber-400' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high hover:border-outline-variant/40 transition-colors group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-outline font-mono uppercase tracking-wider truncate">{kpi.label}</span>
                <span className={`material-symbols-outlined text-[16px] ${kpi.accent} opacity-60 group-hover:opacity-100 transition-opacity`}>
                  {kpi.icon}
                </span>
              </div>
              <div className={`text-xl font-bold font-mono ${kpi.accent}`}>
                {loading ? '—' : kpi.value}
              </div>
            </div>
            <div className="text-[10px] text-outline/70 font-mono mt-1 truncate">
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Grid: 2 columns ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Left: Catalog + Recent Inspections ── */}
        <div className="xl:col-span-2 space-y-6">

          {/* Catalog Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-surface-container-lowest border border-surface-container-high">
              <div className="flex items-center justify-between mb-2">
                <span className="text-label-sm text-outline font-mono uppercase tracking-wider">Catalog</span>
                <span className="material-symbols-outlined text-[18px] text-primary">inventory</span>
              </div>
              <div className="text-body-md font-semibold text-on-surface">
                {activeProducts} Products
              </div>
              <p className="text-label-sm text-outline mt-1 font-mono">{totalBatches} total batches</p>
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
                      <th className="py-2.5 px-5 text-label-sm font-mono font-semibold uppercase tracking-wider">Batch Status</th>
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
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${batchStatusColor(insp.batch?.status ?? 'unknown')}`}>
                            {insp.batch?.status
                              ? insp.batch.status.replace(/_/g, ' ').toUpperCase()
                              : 'STATUS UNAVAILABLE'}
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

          {/* Inspection Status Summary */}
          <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container-high">
            <div className="flex items-center justify-between mb-4">
              <span className="text-label-sm text-outline font-mono uppercase tracking-wider">Inspection Pipeline</span>
            </div>
            <div className="space-y-2.5">
              {[
                { label: 'Pending Upload', key: 'pending_upload', color: 'bg-slate-400' },
                { label: 'Processing', key: 'processing', color: 'bg-amber-400' },
                { label: 'Pending Review', key: 'pending_review', color: 'bg-cyan-400' },
                { label: 'Reviewed', key: 'reviewed', color: 'bg-emerald-400' },
                { label: 'Needs More Evidence', key: 'needs_more_evidence', color: 'bg-orange-400' },
                { label: 'Failed', key: 'processing_failed', color: 'bg-rose-400' },
              ].map(({ label, key, color }) => {
                const count = inspectionCounts[key] ?? 0;
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
