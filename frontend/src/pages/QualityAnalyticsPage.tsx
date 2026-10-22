import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';

interface DashboardStats {
  inspections: {
    total: number;
    by_status: Record<string, number>;
  };
  defects: {
    total: number;
    by_severity: Record<string, number>;
  };
  batches: {
    total: number;
    by_status: Record<string, number>;
  };
  fpy: number | null;
}

export const QualityAnalyticsPage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<DashboardStats>('/dashboard');
      setStats(res.data);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const fpy = stats?.fpy != null ? stats.fpy.toFixed(1) : null;
  const totalInspections = stats?.inspections.total ?? 0;
  const totalDefects = stats?.defects.total ?? 0;
  const defectsBySeverity = stats?.defects.by_severity ?? {};
  const inspectionsByStatus = stats?.inspections.by_status ?? {};
  const batchesByStatus = stats?.batches.by_status ?? {};

  const paretoEntries = Object.entries(defectsBySeverity)
    .sort(([, a], [, b]) => b - a)
    .filter(([, v]) => v > 0);
  const paretoTotal = paretoEntries.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="w-full min-h-screen p-margin bg-background flex flex-col gap-space-lg select-none pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="flex flex-col gap-space-xs">
          <span className="text-label-sm uppercase tracking-widest font-mono text-primary font-bold">TELEMETRY // SPC NODE</span>
          <h1 className="font-headline text-headline-lg text-on-surface tracking-tight font-bold">
            Quality Analytics &amp; SPC Telemetry
          </h1>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-space-xs px-space-md py-1.5 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface text-label-md font-mono transition-colors border border-surface-container-high"
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <div className="flex flex-col justify-between p-space-md bg-surface-container-low rounded-xl border border-surface-container-high shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-mono uppercase text-outline">First Pass Yield</span>
            <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
          </div>
          <span className="font-headline text-headline-xl text-on-surface font-mono font-semibold my-space-sm">
            {loading ? '—' : fpy != null ? `${fpy}%` : '—'}
          </span>
          <span className="text-body-sm text-on-surface-variant font-mono">
            {loading ? '' : `${inspectionsByStatus['reviewed'] ?? 0} / ${totalInspections} reviewed`}
          </span>
        </div>

        <div className="flex flex-col justify-between p-space-md bg-surface-container-low rounded-xl border border-surface-container-high shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-mono uppercase text-outline">Total Defects</span>
            <span className="material-symbols-outlined text-error text-[18px]">warning</span>
          </div>
          <span className="font-headline text-headline-xl text-on-surface font-mono font-semibold my-space-sm">
            {loading ? '—' : totalDefects}
          </span>
          <span className="text-body-sm text-on-surface-variant font-mono">
            {loading ? '' : `${defectsBySeverity['critical'] ?? 0} critical`}
          </span>
        </div>

        <div className="flex flex-col justify-between p-space-md bg-surface-container-low rounded-xl border border-surface-container-high shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-mono uppercase text-outline">Total Inspections</span>
            <span className="material-symbols-outlined text-tertiary text-[18px]">fact_check</span>
          </div>
          <span className="font-headline text-headline-xl text-on-surface font-mono font-semibold my-space-sm">
            {loading ? '—' : totalInspections}
          </span>
          <span className="text-body-sm text-on-surface-variant font-mono">
            {loading ? '' : `${inspectionsByStatus['pending_review'] ?? 0} pending review`}
          </span>
        </div>

        <div className="flex flex-col justify-between p-space-md bg-surface-container-low rounded-xl border border-surface-container-high shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-mono uppercase text-outline">Batches On Hold</span>
            <span className="material-symbols-outlined text-[18px]" style={{ color: '#f59e0b' }}>block</span>
          </div>
          <span className="font-headline text-headline-xl font-mono font-semibold my-space-sm" style={{ color: '#f59e0b' }}>
            {loading ? '—' : batchesByStatus['on_hold'] ?? 0}
          </span>
          <span className="text-body-sm text-on-surface-variant font-mono">
            {loading ? '' : `${batchesByStatus['released'] ?? 0} released`}
          </span>
        </div>
      </div>

      {/* Defect Breakdown + Inspection Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-space-md">
        {/* Defect Severity Breakdown */}
        <div className="flex flex-col p-space-lg bg-surface-container-low rounded-xl gap-space-md border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-primary text-[20px]">bar_chart</span>
            <span className="font-headline text-headline-md text-on-surface font-semibold">Defect Severity Breakdown</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-outline font-mono text-body-sm">Loading...</div>
          ) : paretoEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-outline font-mono text-body-sm gap-2">
              <span className="material-symbols-outlined text-[32px]">check_circle</span>
              <span>No defects recorded</span>
            </div>
          ) : (
            <div className="flex flex-col gap-space-sm">
              {paretoEntries.map(([severity, count]) => {
                const pct = paretoTotal > 0 ? (count / paretoTotal) * 100 : 0;
                const barColor =
                  severity === 'critical' ? 'bg-error' :
                  severity === 'major' ? 'bg-primary' :
                  severity === 'minor' ? 'bg-secondary' : 'bg-outline';
                return (
                  <div key={severity} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between font-mono text-label-sm">
                      <span className="text-on-surface font-semibold uppercase">{severity}</span>
                      <div className="flex items-center gap-space-md">
                        <span className="text-on-surface font-bold">{count}</span>
                        <span className="text-outline">{pct.toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Inspection Status Distribution */}
        <div className="flex flex-col p-space-lg bg-surface-container-low rounded-xl gap-space-md border border-surface-container-high shadow-sm">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-tertiary text-[20px]">stacked_line_chart</span>
            <span className="font-headline text-headline-md text-on-surface font-semibold">Inspection Status Distribution</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-32 text-outline font-mono text-body-sm">Loading...</div>
          ) : totalInspections === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-outline font-mono text-body-sm gap-2">
              <span className="material-symbols-outlined text-[32px]">inbox</span>
              <span>No inspections recorded</span>
            </div>
          ) : (
            <div className="flex flex-col gap-space-sm">
              {Object.entries(inspectionsByStatus)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => {
                  const pct = totalInspections > 0 ? (count / totalInspections) * 100 : 0;
                  const barColor =
                    status === 'reviewed' ? 'bg-emerald-500' :
                    status === 'pending_review' ? 'bg-cyan-500' :
                    status === 'processing' ? 'bg-amber-500' :
                    status === 'processing_failed' ? 'bg-rose-500' : 'bg-outline';
                  return (
                    <div key={status} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between font-mono text-label-sm">
                        <span className="text-on-surface font-semibold uppercase">{status.replace(/_/g, ' ')}</span>
                        <div className="flex items-center gap-space-md">
                          <span className="text-on-surface font-bold">{count}</span>
                          <span className="text-outline">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Batch Pipeline Status */}
      <div className="flex flex-col p-space-lg bg-surface-container-low rounded-xl gap-space-md border border-surface-container-high shadow-sm">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-secondary text-[20px]">inventory_2</span>
          <span className="font-headline text-headline-md text-on-surface font-semibold">Batch Pipeline Status</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-16 text-outline font-mono text-body-sm">Loading...</div>
        ) : (stats?.batches.total ?? 0) === 0 ? (
          <div className="flex items-center justify-center h-16 text-outline font-mono text-body-sm">No batches registered</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-space-sm">
            {Object.entries(batchesByStatus).map(([status, count]) => (
              <div key={status} className="flex flex-col p-space-sm bg-surface-container rounded-lg border border-surface-container-high">
                <span className="text-label-sm font-mono text-outline uppercase">{status.replace(/_/g, ' ')}</span>
                <span className="font-headline text-headline-md font-mono text-on-surface font-bold mt-1">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
