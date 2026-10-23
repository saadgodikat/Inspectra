import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { batchesApi, batchDecisionsApi } from '../api/client';
import type { Batch, BatchDecision, BatchDecisionContext } from '../types';
import axios from 'axios';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getErr(e: unknown): string {
  if (axios.isAxiosError<{ error?: string; details?: Record<string, string> }>(e)) {
    const d = e.response?.data;
    if (d?.details) return Object.values(d.details).join(' · ');
    return d?.error || e.message;
  }
  return e instanceof Error ? e.message : 'Unknown error';
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  created:          { label: 'Created',          cls: 'bg-surface-container-high text-on-surface-variant' },
  in_production:    { label: 'In Production',    cls: 'bg-blue-900/20 text-blue-400 border border-blue-500/30' },
  produced:         { label: 'Produced',         cls: 'bg-secondary/10 text-secondary border border-secondary/30' },
  under_inspection: { label: 'Under Inspection', cls: 'bg-tertiary/10 text-tertiary border border-tertiary/30' },
  on_hold:          { label: 'On Hold',          cls: 'bg-amber-900/20 text-amber-400 border border-amber-500/30' },
  released:         { label: 'Released',         cls: 'bg-green-900/20 text-green-400 border border-green-500/30' },
  archived:         { label: 'Archived',         cls: 'bg-surface-container text-outline' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, cls: 'bg-surface-container text-outline' };
  return (
    <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${s.cls}`}>
      {s.label.toUpperCase()}
    </span>
  );
}

// ── Advisory banner ───────────────────────────────────────────────────────────
function AdvisoryBanner({ ctx }: { ctx: BatchDecisionContext }) {
  if (ctx.advisories.length === 0) {
    return (
      <div className="flex items-start gap-2 p-space-sm rounded-lg bg-green-900/10 border border-green-500/20 text-green-400 font-mono text-[11px]">
        <span className="material-symbols-outlined text-[16px] mt-0.5">check_circle</span>
        <div>
          <p className="font-bold">No advisory conditions.</p>
          <p className="text-green-400/70 mt-0.5">All inspections reviewed, no open defects or actions.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {ctx.advisories.map((a) => (
        <div key={a.code} className="flex items-start gap-2 p-space-sm rounded-lg bg-amber-900/10 border border-amber-500/20 text-amber-900 font-mono text-[11px]">
          <span className="material-symbols-outlined text-[15px] mt-0.5">warning</span>
          <span>{a.message}</span>
        </div>
      ))}
      <p className="text-[10px] font-mono text-outline mt-0.5">
        These are advisory conditions. A Quality Manager may proceed with a documented reason.
      </p>
    </div>
  );
}

// ── Evidence snapshot card ────────────────────────────────────────────────────
function EvidenceSnapshot({ ctx }: { ctx: BatchDecisionContext }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[11px]">
      {[
        { label: 'Inspections', value: ctx.total_inspected, sub: `${ctx.total_reviewed} reviewed`, warn: ctx.unreviewed_inspections > 0 },
        { label: 'Items Analyzed', value: ctx.analyzed_items, sub: `of ${ctx.total_items} allocated`, warn: ctx.analyzed_items < ctx.total_items },
        { label: 'Items Pending', value: ctx.pending_upload_items + ctx.uploaded_items, sub: `${ctx.pending_upload_items} no image · ${ctx.uploaded_items} not analyzed`, warn: ctx.pending_upload_items + ctx.uploaded_items > 0 },
        { label: 'Defects', value: ctx.total_confirmed_defects, sub: `${ctx.open_defects} open`, warn: ctx.open_defects > 0 },
        { label: 'Open Actions', value: ctx.total_open_actions, sub: 'corrective', warn: ctx.total_open_actions > 0 },
      ].map((s) => (
        <div key={s.label} className={`flex flex-col p-2 rounded-lg border ${s.warn ? 'border-amber-500/30 bg-amber-900/10' : 'border-surface-container-high bg-surface-container/50'}`}>
          <span className="text-[9px] text-outline uppercase tracking-wider">{s.label}</span>
          <span className={`text-headline-sm font-bold mt-0.5 ${s.warn && s.value > 0 ? 'text-amber-900' : 'text-on-surface'}`}>{s.value}</span>
          <span className="text-[9px] text-outline">{s.sub}</span>
        </div>
      ))}
    </div>
  );
}

// ── Decision history card ─────────────────────────────────────────────────────
function DecisionHistoryRow({ d }: { d: BatchDecision }) {
  return (
    <div className={`flex flex-col gap-1 px-3 py-2 rounded-lg border font-mono text-[11px] ${d.decision === 'release' ? 'bg-green-900/10 border-green-500/20' : 'bg-amber-900/10 border-amber-500/20'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`font-bold ${d.decision === 'release' ? 'text-green-400' : 'text-amber-400'}`}>
          {d.decision === 'release' ? '✓ RELEASED' : '⏸ HOLD'}
        </span>
        <span className="text-outline">by {d.decided_by?.name ?? `User #${d.decided_by_id}`}</span>
        <span className="text-outline">({d.decided_by?.role})</span>
        <span className="text-outline ml-auto">{new Date(d.decision_timestamp).toLocaleString()}</span>
      </div>
      <p className="text-on-surface-variant italic">"{d.reason}"</p>
      {(d.total_inspected != null) && (
        <div className="flex gap-3 text-[10px] text-outline mt-0.5">
          <span>Inspections: {d.total_inspected}</span>
          <span>Reviewed: {d.total_reviewed}</span>
          <span>Defects: {d.total_confirmed_defects}</span>
          <span>Open actions: {d.total_open_actions}</span>
        </div>
      )}
      {d.decision === 'release' && d.evidence_snapshot && (
        <p className="text-[10px] text-outline">
          {d.evidence_snapshot?.advisories.length
            ? `Advisories ${d.advisories_acknowledged ? 'were acknowledged' : 'were not acknowledged'} at decision time.`
            : 'No advisory conditions were present at decision time.'}
        </p>
      )}
      {!!d.evidence_snapshot?.advisories.length && (
        <ul className="list-disc pl-4 text-[10px] text-amber-300">
          {d.evidence_snapshot.advisories.map((advisory) => (
            <li key={advisory.code}>{advisory.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export const BatchReleasesPage: React.FC = () => {
  const { user } = useAuth();
  const isQM = user?.role === 'quality_manager';
  const canHold = user?.role === 'quality_manager' || user?.role === 'supervisor';

  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  // Decision drawer state
  const [drawerBatch, setDrawerBatch] = useState<Batch | null>(null);
  const [drawerContext, setDrawerContext] = useState<BatchDecisionContext | null>(null);
  const [drawerHistory, setDrawerHistory] = useState<BatchDecision[]>([]);
  const [contextLoading, setContextLoading] = useState(false);

  // Decision form
  const [decisionType, setDecisionType] = useState<'hold' | 'release'>('release');
  const [reason, setReason] = useState('');
  const [acknowledgeAdvisories, setAcknowledgeAdvisories] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastDecision, setLastDecision] = useState<BatchDecision | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter.toLowerCase();
      const res = await batchesApi.list(params);
      setBatches(res.batches);
      setTotal(res.count);
    } catch (e) {
      setError(getErr(e));
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const openDrawer = useCallback(async (batch: Batch, defaultDecision: 'hold' | 'release') => {
    setDrawerBatch(batch);
    setDrawerContext(null);
    setDrawerHistory([]);
    setDecisionType(defaultDecision);
    setReason('');
    setAcknowledgeAdvisories(false);
    setSubmitError(null);
    setLastDecision(null);
    setContextLoading(true);
    try {
      const [ctxRes, histRes] = await Promise.all([
        batchDecisionsApi.getContext(batch.id),
        batchDecisionsApi.list({ batch_id: batch.id, per_page: 10 }),
      ]);
      setDrawerContext(ctxRes.context);
      setDrawerHistory(histRes.batch_decisions);
    } catch (e) {
      setSubmitError(getErr(e));
    } finally {
      setContextLoading(false);
    }
  }, []);

  const handleSubmitDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerBatch || !reason.trim() || reason.trim().length < 5) {
      setSubmitError('Please provide a reason (minimum 5 characters).');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await batchDecisionsApi.create({
        batch_id: drawerBatch.id,
        decision: decisionType,
        reason: reason.trim(),
        acknowledge_advisories: acknowledgeAdvisories,
      });
      setLastDecision(res.batch_decision);
      setDrawerContext(res.context);
      setDrawerHistory((prev) => [res.batch_decision, ...prev]);
      // Update batch in list
      setBatches((prev) => prev.map((b) => b.id === res.batch.id ? res.batch : b));
      setDrawerBatch(res.batch);
      setReason('');
    } catch (e) {
      setSubmitError(getErr(e));
      try {
        const ctxRes = await batchDecisionsApi.getContext(drawerBatch.id);
        setDrawerContext(ctxRes.context);
        setAcknowledgeAdvisories(false);
      } catch (contextError) {
        setSubmitError(`${getErr(e)} Evidence could not be refreshed: ${getErr(contextError)}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const readyCount = batches.filter((b) => b.status === 'produced' || b.status === 'under_inspection').length;
  const holdCount = batches.filter((b) => b.status === 'on_hold').length;
  const releasedCount = batches.filter((b) => b.status === 'released').length;

  return (
    <div className="w-full min-h-screen p-margin bg-background flex flex-col gap-space-lg select-none pb-12">
      {/* Header */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-space-md p-space-md bg-surface-container-low rounded-xl border border-surface-container-high shadow-md">
        <div>
          <span className="font-headline text-headline-md font-semibold tracking-tight text-on-surface">
            Batch Hold / Release
          </span>
          <p className="text-label-sm font-mono text-outline mt-0.5">
            Quality Manager decisions · Evidence snapshot · Traceable audit trail
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-outline">
          <span className="material-symbols-outlined text-[14px]">info</span>
          Decisions are recorded with a live evidence snapshot and require a documented reason.
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-space-md py-2 bg-error/10 border border-error/30 rounded-lg text-error font-mono text-body-sm">
          <span className="material-symbols-outlined text-[16px]">warning</span>
          {error}
          <button className="ml-auto" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        {[
          { label: 'Awaiting Decision', value: readyCount, icon: 'verified', cls: 'text-secondary', bg: 'bg-secondary/10 border-secondary/20' },
          { label: 'On Hold',           value: holdCount,  icon: 'pending_actions', cls: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
          { label: 'Released',          value: releasedCount, icon: 'local_shipping', cls: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
        ].map((k) => (
          <div key={k.label} className={`p-space-md rounded-xl border flex flex-col justify-between shadow-sm ${k.bg}`}>
            <div className="flex items-start justify-between">
              <span className="text-label-sm uppercase tracking-wider text-outline font-mono">{k.label}</span>
              <span className={`material-symbols-outlined text-[20px] ${k.cls}`}>{k.icon}</span>
            </div>
            <span className={`font-headline text-headline-xl font-bold font-mono mt-space-md ${k.cls}`}>{k.value}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl bg-surface-container-low overflow-hidden shadow-sm border border-surface-container-high">
        <div className="px-space-md py-space-sm bg-surface-container-lowest flex flex-wrap items-center justify-between gap-space-md border-b border-surface-container-high">
          <div className="flex items-center gap-space-md">
            <span className="font-headline text-headline-md font-semibold text-on-surface tracking-tight">Batch Release Register</span>
            <span className="px-space-xs py-0.5 rounded bg-surface-container font-mono text-label-sm text-outline border border-surface-container-high">{total} LOTS</span>
          </div>
          <div className="flex items-center rounded bg-surface-container-high px-space-sm py-1 border border-outline-variant/30 gap-1">
            <span className="material-symbols-outlined text-[16px] text-outline">filter_alt</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-label-sm text-on-surface outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="produced">Produced</option>
              <option value="under_inspection">Under Inspection</option>
              <option value="on_hold">On Hold</option>
              <option value="released">Released</option>
              <option value="in_production">In Production</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-body-sm text-on-surface">
            <thead className="bg-surface-container-lowest text-outline text-label-sm uppercase tracking-wider border-b border-surface-container-high">
              <tr>
                <th className="px-space-md py-space-xs">Batch</th>
                <th className="px-space-md py-space-xs">Product</th>
                <th className="px-space-md py-space-xs text-right">Qty</th>
                <th className="px-space-md py-space-xs">Line</th>
                <th className="px-space-md py-space-xs">Prod. Date</th>
                <th className="px-space-md py-space-xs">Status</th>
                <th className="px-space-md py-space-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/30">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-outline">
                    <span className="material-symbols-outlined text-[24px] animate-spin block mx-auto mb-2">progress_activity</span>
                    Loading batches...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-outline">
                    <span className="material-symbols-outlined text-[32px] block mx-auto mb-2">inventory_2</span>
                    No batches found
                  </td>
                </tr>
              ) : (
                batches.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-container/50 transition-colors">
                    <td className="px-space-md py-space-sm whitespace-nowrap">
                      <span className="font-bold text-primary">#{b.batch_number}</span>
                    </td>
                    <td className="px-space-md py-space-sm whitespace-nowrap">
                      <div className="font-medium text-on-surface">{b.product?.name ?? `Product #${b.product_id}`}</div>
                      {b.product?.product_code && <div className="text-label-sm text-outline">{b.product.product_code}</div>}
                    </td>
                    <td className="px-space-md py-space-sm text-right text-on-surface-variant whitespace-nowrap">
                      {b.quantity?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-space-md py-space-sm text-on-surface-variant whitespace-nowrap">
                      {b.production_line ?? '—'}
                    </td>
                    <td className="px-space-md py-space-sm text-outline text-[11px] whitespace-nowrap">
                      {b.production_date ? new Date(b.production_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-space-md py-space-sm whitespace-nowrap">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-space-md py-space-sm text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View decision panel for any actionable batch */}
                        {b.status !== 'archived' && (
                          <button
                            onClick={() => openDrawer(b, b.status === 'on_hold' ? 'release' : 'hold')}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-surface-container hover:bg-surface-container-high border border-surface-container-high font-mono text-[10px] text-on-surface-variant transition-colors"
                            title="View quality evidence and make a decision"
                          >
                            <span className="material-symbols-outlined text-[13px]">fact_check</span>
                            Review
                          </button>
                        )}
                        {/* Quick hold button for supervisors/QMs */}
                        {canHold && (b.status === 'in_production' || b.status === 'produced' || b.status === 'under_inspection') && (
                          <button
                            onClick={() => openDrawer(b, 'hold')}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-amber-900/20 hover:bg-amber-900/30 border border-amber-500/30 font-mono text-[10px] text-amber-400 transition-colors"
                            title="Place on hold"
                          >
                            <span className="material-symbols-outlined text-[13px]">pause_circle</span>
                            Hold
                          </button>
                        )}
                        {/* Release button for QMs */}
                        {isQM && (b.status === 'on_hold' || b.status === 'under_inspection' || b.status === 'produced') && (
                          <button
                            onClick={() => openDrawer(b, 'release')}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-green-900/20 hover:bg-green-900/30 border border-green-500/30 font-mono text-[10px] text-green-400 transition-colors"
                            title="Release batch"
                          >
                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                            Release
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-space-md py-space-xs bg-surface-container-lowest flex items-center justify-between text-label-sm font-mono text-outline border-t border-surface-container-high">
          <span>All decisions are recorded with actor, reason, timestamp, and evidence snapshot</span>
          <span>{batches.length} / {total} batches shown</span>
        </div>
      </div>

      {/* Decision Drawer */}
      {drawerBatch && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setDrawerBatch(null); }}>
          <div className="w-full max-w-xl h-full bg-surface-container-low border-l border-surface-container-high shadow-2xl flex flex-col overflow-y-auto">

            {/* Drawer header */}
            <div className="px-space-lg py-space-md bg-surface-container-lowest flex items-center justify-between border-b border-surface-container-high sticky top-0 z-10">
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-primary text-[22px]">fact_check</span>
                <div>
                  <h2 className="font-headline text-headline-md font-bold text-on-surface">
                    Quality Decision Panel
                  </h2>
                  <span className="font-mono text-label-sm text-outline">
                    Batch #{drawerBatch.batch_number} · {drawerBatch.product?.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setDrawerBatch(null)}
                className="p-1.5 rounded bg-surface-container-high hover:bg-surface-variant text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-space-lg flex flex-col gap-space-md flex-1">
              {/* Batch metadata */}
              <div className="flex flex-wrap gap-3 font-mono text-[11px] text-outline bg-surface-container/50 rounded-lg p-space-sm border border-surface-container-high">
                <span><strong className="text-on-surface">Status:</strong> <StatusBadge status={drawerBatch.status} /></span>
                {drawerBatch.quantity && <span><strong className="text-on-surface">Qty:</strong> {drawerBatch.quantity.toLocaleString()} units</span>}
                {drawerBatch.production_line && <span><strong className="text-on-surface">Line:</strong> {drawerBatch.production_line}</span>}
                {drawerBatch.production_date && <span><strong className="text-on-surface">Produced:</strong> {new Date(drawerBatch.production_date).toLocaleDateString()}</span>}
              </div>

              {/* Live evidence snapshot */}
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-outline">analytics</span>
                  <span className="font-mono text-label-sm text-outline uppercase font-semibold tracking-wider">Quality Evidence Snapshot</span>
                  {contextLoading && <span className="material-symbols-outlined text-[14px] text-outline animate-spin ml-1">progress_activity</span>}
                </div>
                {drawerContext ? (
                  <>
                    <EvidenceSnapshot ctx={drawerContext} />
                    <AdvisoryBanner ctx={drawerContext} />
                  </>
                ) : contextLoading ? (
                  <div className="h-24 flex items-center justify-center text-outline font-mono text-[11px]">Loading evidence...</div>
                ) : null}
              </div>

              {submitError && !(
                drawerBatch.status !== 'released' && drawerBatch.status !== 'archived'
              ) && (
                <p role="alert" className="text-error font-mono text-[11px]">{submitError}</p>
              )}

              {/* Success banner after decision */}
              {lastDecision && (
                <div className={`flex items-start gap-2 p-space-sm rounded-lg border font-mono text-[11px] ${lastDecision.decision === 'release' ? 'bg-green-900/10 border-green-500/30 text-green-400' : 'bg-amber-900/10 border-amber-500/30 text-amber-400'}`}>
                  <span className="material-symbols-outlined text-[16px] mt-0.5">{lastDecision.decision === 'release' ? 'check_circle' : 'pause_circle'}</span>
                  <div>
                    <p className="font-bold">Decision recorded: {lastDecision.decision === 'release' ? 'RELEASED' : 'HOLD'}</p>
                    <p className="text-inherit/70 mt-0.5">Reason: "{lastDecision.reason}"</p>
                    <p className="mt-0.5 opacity-70">Recorded at {new Date(lastDecision.decision_timestamp).toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Decision form */}
              {drawerBatch.status !== 'released' && drawerBatch.status !== 'archived' && (
                <form onSubmit={handleSubmitDecision} className="flex flex-col gap-space-sm bg-surface-container-lowest rounded-xl border border-surface-container-high p-space-md">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-[16px]">gavel</span>
                    <span className="font-mono text-label-sm font-bold text-on-surface uppercase tracking-wider">Record Decision</span>
                  </div>

                  {/* Decision type */}
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-label-sm text-outline">Decision Type</label>
                    <div className="flex gap-2">
                      {(['hold', 'release'] as const).map((d) => {
                        const disabled = d === 'release' && !isQM;
                        return (
                          <button
                            key={d}
                            type="button"
                            disabled={disabled}
                            onClick={() => setDecisionType(d)}
                            className={`flex-1 py-2 rounded-lg border font-mono text-[11px] font-bold transition-colors ${
                              decisionType === d
                                ? d === 'release'
                                  ? 'bg-green-900/30 border-green-500/50 text-green-400'
                                  : 'bg-amber-900/30 border-amber-500/50 text-amber-950'
                                : 'bg-surface-container border-surface-container-high text-on-surface-variant hover:bg-surface-container-high'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            <span className="material-symbols-outlined text-[14px] align-middle mr-1">
                              {d === 'release' ? 'check_circle' : 'pause_circle'}
                            </span>
                            {d === 'hold' ? 'Place on Hold' : 'Release Batch'}
                            {disabled && <span className="block text-[9px] opacity-60 mt-0.5">Quality Manager only</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Decision reason */}
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-label-sm text-outline">
                      Decision Reason *
                      <span className="ml-2 text-[10px] text-outline/70">Required · will be stored in audit log</span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows={3}
                      placeholder={
                        decisionType === 'release'
                          ? 'e.g. All inspections reviewed, no open defects, CAPAs resolved...'
                          : 'e.g. Critical defect found in sample, pending corrective action...'
                      }
                      className="bg-surface-container text-on-surface px-3 py-2 rounded-lg border border-surface-container-high outline-none font-mono text-[11px] resize-none focus:border-primary/50 transition-colors"
                    />
                  </div>

                  {decisionType === 'release' && drawerContext?.advisories.length ? (
                    <label className="flex items-start gap-2 p-space-sm rounded-lg bg-amber-900/10 border border-amber-500/30 font-mono text-[10px] text-amber-900 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledgeAdvisories}
                        onChange={(e) => setAcknowledgeAdvisories(e.target.checked)}
                        className="mt-0.5 accent-amber-500"
                      />
                      <span>
                        I reviewed each advisory above and documented why release is appropriate despite these conditions.
                      </span>
                    </label>
                  ) : null}

                  {/* Signer identity */}
                  <div className="flex items-center gap-2 font-mono text-[10px] text-outline bg-surface-container/50 rounded p-2 border border-surface-container-high">
                    <span className="material-symbols-outlined text-[13px]">badge</span>
                    <span>Decision will be attributed to:</span>
                    <span className="font-bold text-on-surface">{user?.name}</span>
                    <span>({user?.role?.replace('_', ' ')})</span>
                    <span className="ml-auto">Authenticated session</span>
                  </div>

                  {submitError && (
                    <p role="alert" className="text-error font-mono text-[11px]">{submitError}</p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      submitting ||
                      contextLoading ||
                      !drawerContext ||
                      (!isQM && decisionType === 'release') ||
                      (decisionType === 'release' &&
                        !!drawerContext.advisories.length &&
                        !acknowledgeAdvisories)
                    }
                    className={`py-2 rounded-lg font-mono text-label-sm font-bold transition-colors disabled:opacity-40 ${
                      decisionType === 'release'
                        ? 'bg-green-700 hover:bg-green-600 text-white'
                        : 'bg-amber-700 hover:bg-amber-600 text-white'
                    }`}
                  >
                    {submitting
                      ? 'Recording decision...'
                      : decisionType === 'release'
                        ? '✓ Record Release Decision'
                        : '⏸ Record Hold Decision'}
                  </button>
                </form>
              )}

              {drawerBatch.status === 'released' && (
                <div className="flex items-center gap-2 p-space-sm rounded-lg bg-green-900/10 border border-green-500/30 font-mono text-[11px] text-green-400">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  This batch has been released. No further hold/release decisions can be made.
                </div>
              )}

              {/* Decision history */}
              {drawerHistory.length > 0 && (
                <div className="flex flex-col gap-space-sm">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-outline">history</span>
                    <span className="font-mono text-label-sm text-outline uppercase font-semibold tracking-wider">
                      Decision History ({drawerHistory.length})
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {drawerHistory.map((d) => (
                      <DecisionHistoryRow key={d.id} d={d} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
