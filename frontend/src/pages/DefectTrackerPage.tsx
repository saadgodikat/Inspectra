import React, { useEffect, useState, useCallback, useRef } from 'react';
import { defectsApi, correctiveActionsApi, usersApi, inspectionsApi, reviewsApi } from '../api/client';
import type { Defect, DefectStatus, DefectSeverity, CorrectiveAction, CorrectiveActionEvidence, User, ReviewDecision } from '../types';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

// ── Style helpers ─────────────────────────────────────────────────────────────
const SEV_CLASS: Record<string, string> = {
  critical: 'bg-red-900/30 text-red-400 border border-red-500/40',
  major: 'bg-orange-900/20 text-orange-400 border border-orange-500/30',
  minor: 'bg-yellow-900/20 text-yellow-400 border border-yellow-500/30',
  cosmetic: 'bg-surface-container-high text-on-surface-variant border border-surface-container-high',
  high: 'bg-red-900/20 text-red-400 border border-red-500/30',
  medium: 'bg-orange-900/20 text-orange-400 border border-orange-500/30',
  low: 'bg-yellow-900/20 text-yellow-400 border border-yellow-500/30',
};
const STATUS_CLASS: Record<string, string> = {
  open: 'bg-primary/10 text-primary border border-primary/30',
  in_progress: 'bg-tertiary/10 text-tertiary border border-tertiary/30',
  resolved: 'bg-green-900/20 text-green-400 border border-green-500/30',
  closed: 'bg-surface-container-high text-on-surface-variant border border-surface-container',
  reopened: 'bg-orange-900/20 text-orange-400 border border-orange-500/30',
};
const ACTION_STATUS_CLASS: Record<string, string> = {
  open: 'bg-primary/10 text-primary border border-primary/30',
  in_progress: 'bg-tertiary/10 text-tertiary border border-tertiary/30',
  completed: 'bg-green-900/20 text-green-400 border border-green-500/30',
  closed: 'bg-surface-container-high text-on-surface-variant border border-surface-container',
  reopened: 'bg-orange-900/20 text-orange-400 border border-orange-500/30',
};
const DECISION_COLORS: Record<string, string> = {
  confirm: 'text-error',
  correct: 'text-orange-400',
  no_defect: 'text-green-400',
  needs_more_evidence: 'text-yellow-400',
};
const DECISION_LABELS: Record<string, string> = {
  confirm: 'Confirmed Defect',
  correct: 'Corrected (Human Override)',
  no_defect: 'No Defect Found',
  needs_more_evidence: 'Needs More Evidence',
};

function getErr(e: unknown): string {
  if (axios.isAxiosError<{ error?: string }>(e)) return e.response?.data?.error || e.message;
  return e instanceof Error ? e.message : 'Unknown error';
}

const Badge: React.FC<{ label: string; cls: string }> = ({ label, cls }) => (
  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${cls}`}>
    {label.replace(/_/g, ' ').toUpperCase()}
  </span>
);

// ── Main component ────────────────────────────────────────────────────────────
export const DefectTrackerPage: React.FC = () => {
  const { user } = useAuth();
  const canManageCapa = user?.role === 'supervisor' || user?.role === 'quality_manager';

  // List state
  const [defects, setDefects] = useState<Defect[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selection & detail
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [defectDetail, setDefectDetail] = useState<Defect | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // CAPA state
  const [capas, setCapas] = useState<(CorrectiveAction & { evidence: CorrectiveActionEvidence[] })[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);

  // Panel: create CAPA
  const [showCapa, setShowCapa] = useState(false);
  const [capaForm, setCapaForm] = useState({ owner_id: 0, target_date: '', notes: '' });
  const [capaSubmitting, setCapaSubmitting] = useState(false);
  const [capaError, setCapaError] = useState<string | null>(null);

  // Panel: upload evidence (per CAPA)
  const [evidenceActionId, setEvidenceActionId] = useState<number | null>(null);
  const [evidenceForm, setEvidenceForm] = useState({ description: '', notes: '', file: null as File | null });
  const [evidenceSubmitting, setEvidenceSubmitting] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const evidenceFileRef = useRef<HTMLInputElement>(null);

  // Panel: update defect status
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Review panel
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewForm, setReviewForm] = useState<{
    decision: ReviewDecision;
    defect_category: string;
    defect_severity: string;
    defect_description: string;
    confirmed_class: string;
    comments: string;
  }>({
    decision: 'confirm',
    defect_category: '',
    defect_severity: 'major',
    defect_description: '',
    confirmed_class: '',
    comments: '',
  });
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const fetchDefects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page, per_page: 20 };
      if (severityFilter !== 'all') params.severity = severityFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await defectsApi.list(params as Parameters<typeof defectsApi.list>[0]);
      setDefects(res.defects);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      if (res.defects.length > 0 && selectedId === null) {
        setSelectedId(res.defects[0].id);
      }
    } catch (e) {
      setError(getErr(e));
      setDefects([]);
    } finally {
      setLoading(false);
    }
  }, [page, severityFilter, statusFilter]);

  const loadDetail = useCallback(async (id: number) => {
    setDetailLoading(true);
    setCapas([]);
    setShowCapa(false);
    setEvidenceActionId(null);
    setShowReviewPanel(false);
    try {
      const [defRes, capaRes, usersRes] = await Promise.all([
        defectsApi.get(id),
        correctiveActionsApi.list({ defect_id: id }),
        usersApi.listAssignable(),
      ]);
      setDefectDetail(defRes.defect);
      const fullCapas = await Promise.all(
        capaRes.corrective_actions.map((ca) =>
          correctiveActionsApi.get(ca.id).then((r) => r.corrective_action)
        )
      );
      setCapas(fullCapas);
      setAssignableUsers(usersRes.users);
      if (usersRes.users.length > 0) {
        setCapaForm((f) => ({ ...f, owner_id: usersRes.users[0].id }));
      }
    } catch (e) {
      setError(getErr(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { fetchDefects(); }, [fetchDefects]);
  useEffect(() => { setPage(1); }, [severityFilter, statusFilter]);
  useEffect(() => {
    if (selectedId !== null) loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  const handleDefectStatusChange = async (newStatus: DefectStatus) => {
    if (!defectDetail) return;
    setUpdatingStatus(true);
    setError(null);
    try {
      const res = await defectsApi.update(defectDetail.id, { status: newStatus });
      setDefectDetail(res.defect);
      setDefects((prev) => prev.map((d) => d.id === res.defect.id ? { ...d, status: res.defect.status } : d));
    } catch (e) { setError(getErr(e)); }
    finally { setUpdatingStatus(false); }
  };

  const handleCreateCapa = async () => {
    if (!defectDetail) return;
    setCapaSubmitting(true);
    setCapaError(null);
    try {
      const res = await correctiveActionsApi.create({
        defect_id: defectDetail.id,
        owner_id: capaForm.owner_id || undefined,
        target_date: capaForm.target_date || undefined,
        notes: capaForm.notes || undefined,
      });
      const full = await correctiveActionsApi.get(res.corrective_action.id);
      setCapas((prev) => [full.corrective_action, ...prev]);
      setShowCapa(false);
      setCapaForm((f) => ({ ...f, target_date: '', notes: '' }));
    } catch (e) { setCapaError(getErr(e)); }
    finally { setCapaSubmitting(false); }
  };

  const handleCapaStatusChange = async (capaId: number, newStatus: string) => {
    setError(null);
    try {
      await correctiveActionsApi.update(capaId, { status: newStatus as any });
      const full = await correctiveActionsApi.get(capaId);
      setCapas((prev) => prev.map((c) => c.id === capaId ? full.corrective_action : c));
    } catch (e) { setError(getErr(e)); }
  };

  const handleSubmitEvidence = async () => {
    if (evidenceActionId === null) return;
    setEvidenceSubmitting(true);
    setEvidenceError(null);
    try {
      await correctiveActionsApi.submitEvidence(evidenceActionId, {
        description: evidenceForm.description,
        notes: evidenceForm.notes,
        file: evidenceForm.file || undefined,
      });
      const full = await correctiveActionsApi.get(evidenceActionId);
      setCapas((prev) => prev.map((c) => c.id === evidenceActionId ? full.corrective_action : c));
      setEvidenceActionId(null);
      setEvidenceForm({ description: '', notes: '', file: null });
      if (evidenceFileRef.current) evidenceFileRef.current.value = '';
    } catch (e) { setEvidenceError(getErr(e)); }
    finally { setEvidenceSubmitting(false); }
  };

  const handleSubmitReview = async () => {
    if (!defectDetail) return;
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const payload: Parameters<typeof reviewsApi.create>[0] = {
        inspection_id: defectDetail.inspection_id,
        decision: reviewForm.decision,
        comments: reviewForm.comments || undefined,
      };
      if (reviewForm.decision === 'confirm' || reviewForm.decision === 'correct') {
        payload.defect_category = reviewForm.defect_category || defectDetail.defect_category;
        payload.defect_severity = reviewForm.defect_severity as DefectSeverity;
        payload.defect_description = reviewForm.defect_description || undefined;
        if (reviewForm.decision === 'correct') {
          payload.confirmed_class = reviewForm.confirmed_class;
        }
      }
      await reviewsApi.create(payload);
      setShowReviewPanel(false);
      await loadDetail(defectDetail.id);
      fetchDefects();
    } catch (e) { setReviewError(getErr(e)); }
    finally { setReviewSubmitting(false); }
  };

  const handleStartReinspection = async () => {
    if (!defectDetail) return;
    try {
      const res = await inspectionsApi.create({ reinspection_of_id: defectDetail.inspection_id, quantity: 1 });
      alert(`Reinspection created: INS-${String(res.inspection.id).padStart(4, '0')}. Go to Inspections to upload evidence.`);
    } catch (e) { setError(getErr(e)); }
  };

  return (
    <div className="w-full min-h-screen p-margin bg-background flex flex-col gap-space-lg select-none pb-12">
      {/* Header */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-space-md p-space-md bg-surface-container-low rounded-xl border border-surface-container-high shadow-md">
        <div>
          <span className="font-headline text-headline-md font-semibold tracking-tight text-on-surface">
            Defect Registry &amp; CAPA
          </span>
          <p className="text-label-sm font-mono text-outline mt-0.5">
            Human review decisions · Corrective actions · Repair evidence · Reinspections
          </p>
        </div>
        <span className="font-mono text-label-sm text-outline">{total} total defects</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-space-md py-2 bg-error/10 border border-error/30 rounded-lg text-error font-mono text-body-sm">
          <span className="material-symbols-outlined text-[16px]">warning</span>
          {error}
          <button className="ml-auto" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-space-sm p-space-sm bg-surface-container-lowest rounded-xl border border-surface-container-high">
        {[
          { label: 'Severity', val: severityFilter, set: setSeverityFilter, opts: ['all', 'critical', 'major', 'minor', 'cosmetic', 'high', 'medium', 'low'] },
          { label: 'Status', val: statusFilter, set: setStatusFilter, opts: ['all', 'open', 'in_progress', 'resolved', 'closed', 'reopened'] },
        ].map(({ label, val, set, opts }) => (
          <div key={label} className="flex items-center gap-space-xs">
            <span className="font-mono text-label-sm text-outline uppercase">{label}:</span>
            <div className="flex items-center bg-surface-container rounded-lg px-space-sm py-1 border border-surface-container-high">
              <select
                value={val}
                onChange={(e) => set(e.target.value)}
                aria-label={`Filter defects by ${label}`}
                className="bg-transparent text-label-md font-mono text-on-surface outline-none cursor-pointer"
              >
                {opts.map((o) => (
                  <option key={o} value={o} className="bg-surface-container-highest text-on-surface">
                    {o === 'all' ? 'All' : o.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Left: Defect table */}
        <div className="xl:col-span-5 flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-md border border-surface-container-high">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-body-sm text-on-surface">
              <thead className="bg-surface-container text-label-sm text-outline uppercase tracking-wider border-b border-surface-container-high">
                <tr>
                  <th className="py-2.5 px-3">DEFECT</th>
                  <th className="py-2.5 px-3">TYPE</th>
                  <th className="py-2.5 px-3">SEV</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/30">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-outline">
                      <span className="material-symbols-outlined text-[24px] animate-spin block mx-auto mb-2">progress_activity</span>
                      Loading...
                    </td>
                  </tr>
                ) : defects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-outline">
                      <span className="material-symbols-outlined text-[32px] block mx-auto mb-2">check_circle</span>
                      No defects found
                    </td>
                  </tr>
                ) : (
                  defects.map((d) => {
                    const isSelected = d.id === selectedId;
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedId(d.id)}
                        className={`cursor-pointer transition-all duration-150 ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-surface-container/50'}`}
                      >
                        <td className="py-2 px-3 whitespace-nowrap">
                          <div className="font-bold text-primary text-[11px]">{d.item_tag ?? `Item #${d.id}`}</div>
                          <div className="text-[9px] text-outline">{d.defect_code ?? `DEF-${String(d.id).padStart(4, '0')}`}</div>
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap text-[11px]">
                          <div className="font-semibold text-on-surface truncate max-w-[110px]">{d.defect_type}</div>
                          <div className="text-outline text-[9px]">INS-{String(d.inspection_id).padStart(4, '0')}</div>
                        </td>
                        <td className="py-2 px-3"><Badge label={d.severity} cls={SEV_CLASS[d.severity] ?? ''} /></td>
                        <td className="py-2 px-3"><Badge label={d.status} cls={STATUS_CLASS[d.status] ?? ''} /></td>
                        <td className="py-2 px-3 text-outline text-[10px] whitespace-nowrap">{new Date(d.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-space-md bg-surface-container-low flex items-center justify-between border-t border-surface-container-high font-mono text-body-sm text-outline">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-[11px]">← Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-[11px]">Next →</button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        <div className="xl:col-span-7 flex flex-col gap-space-md">
          {detailLoading ? (
            <div className="flex flex-col items-center justify-center h-64 bg-surface-container-lowest rounded-xl border border-surface-container-high text-outline gap-2">
              <span className="material-symbols-outlined text-[28px] animate-spin">progress_activity</span>
              <span className="font-mono text-label-sm">Loading defect details...</span>
            </div>
          ) : !defectDetail ? (
            <div className="flex flex-col items-center justify-center h-64 bg-surface-container-lowest rounded-xl border border-surface-container-high text-outline gap-2">
              <span className="material-symbols-outlined text-[32px]">radar</span>
              <span className="font-mono text-label-sm">Select a defect to inspect</span>
            </div>
          ) : (
            <>
              {/* Defect header card */}
              <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-md p-space-md">
                <div className="flex items-start justify-between gap-space-md">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-headline text-headline-sm font-bold text-on-surface font-mono">
                        {defectDetail.item_tag ? `Item ${defectDetail.item_tag}` : defectDetail.defect_code || `#${defectDetail.id}`}
                      </span>
                      <Badge label={defectDetail.severity} cls={SEV_CLASS[defectDetail.severity] ?? ''} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="font-mono text-label-sm text-outline">{defectDetail.defect_code ?? `DEF-${String(defectDetail.id).padStart(4, '0')}`}</span>
                      <span className="text-outline">·</span>
                      <span className="font-mono text-label-sm text-on-surface-variant">{defectDetail.defect_type}</span>
                      {defectDetail.inspection?.product?.name && <><span className="text-outline">·</span><span className="font-mono text-label-sm text-on-surface-variant">{defectDetail.inspection.product.name}</span></>}
                      {defectDetail.inspection?.batch?.batch_number && <><span className="text-outline">·</span><span className="font-mono text-label-sm text-outline">Lot {defectDetail.inspection.batch.batch_number}</span></>}
                    </div>
                  </div>
                  <Badge label={defectDetail.status} cls={STATUS_CLASS[defectDetail.status] ?? ''} />
                </div>

                {defectDetail.description && (
                  <p className="mt-2 text-body-sm text-on-surface-variant font-mono">{defectDetail.description}</p>
                )}

                {/* Review decision */}
                {defectDetail.review && (
                  <div className="mt-3 flex items-center gap-2 bg-surface-container/50 rounded-lg px-3 py-2 border border-surface-container-high flex-wrap">
                    <span className="material-symbols-outlined text-[14px] text-outline">person_check</span>
                    <span className="font-mono text-label-sm text-outline">Review:</span>
                    <span className={`font-mono text-label-sm font-bold ${DECISION_COLORS[defectDetail.review.decision] ?? 'text-on-surface'}`}>
                      {DECISION_LABELS[defectDetail.review.decision] ?? defectDetail.review.decision}
                    </span>
                    {defectDetail.review.reviewer?.name && (
                      <span className="font-mono text-label-sm text-outline">by {defectDetail.review.reviewer.name}</span>
                    )}
                    {defectDetail.review.comments && (
                      <span className="font-mono text-[10px] text-outline italic">"{defectDetail.review.comments}"</span>
                    )}
                    <span className="font-mono text-[10px] text-outline ml-auto">
                      {new Date(defectDetail.review.review_timestamp).toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Created by */}
                {defectDetail.created_by && (
                  <div className="mt-1 font-mono text-[10px] text-outline">
                    Logged by {defectDetail.created_by.name} ({defectDetail.created_by.role}) · {new Date(defectDetail.created_at).toLocaleString()}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-space-sm flex flex-wrap items-center gap-2 pt-2 border-t border-surface-container-high/50">
                  {canManageCapa && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono text-[10px] text-outline">Defect:</span>
                      {(['in_progress', 'resolved', 'closed', 'reopened'] as DefectStatus[])
                        .filter((s) => s !== defectDetail.status)
                        .map((s) => (
                          <button
                            key={s}
                            onClick={() => handleDefectStatusChange(s)}
                            disabled={updatingStatus}
                            className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-surface-container hover:bg-surface-container-high border border-surface-container-high text-on-surface-variant disabled:opacity-40 transition-colors"
                          >
                            → {s.replace(/_/g, ' ')}
                          </button>
                        ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      onClick={() => setShowReviewPanel(!showReviewPanel)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high border border-surface-container-high font-mono text-label-sm text-on-surface-variant transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">rate_review</span>
                      {showReviewPanel ? 'Close' : 'Add Review'}
                    </button>
                    {canManageCapa && (
                      <button
                        onClick={() => setShowCapa(!showCapa)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 font-mono text-label-sm text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined text-[14px]">add_task</span>
                        {showCapa ? 'Cancel' : 'Create CAPA'}
                      </button>
                    )}
                    <button
                      onClick={handleStartReinspection}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-tertiary/10 hover:bg-tertiary/20 border border-tertiary/30 font-mono text-label-sm text-tertiary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[14px]">refresh</span>
                      Reinspect
                    </button>
                  </div>
                </div>
              </div>

              {/* Review form */}
              {showReviewPanel && (
                <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-space-md flex flex-col gap-space-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-[16px]">rate_review</span>
                    <span className="font-mono text-label-sm font-bold text-on-surface uppercase tracking-wider">Submit Review</span>
                    <span className="font-mono text-[10px] text-outline">INS-{String(defectDetail.inspection_id).padStart(4, '0')}</span>
                    <p className="font-mono text-[10px] text-outline ml-2">Decisions are kept separate from ML predictions</p>
                  </div>
                  <div className="grid grid-cols-2 gap-space-sm">
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-label-sm text-outline">Decision *</label>
                      <select
                        value={reviewForm.decision}
                        onChange={(e) => setReviewForm((f) => ({ ...f, decision: e.target.value as ReviewDecision }))}
                        className="bg-surface-container text-on-surface px-3 py-1.5 rounded-lg border border-surface-container-high outline-none font-mono text-body-sm"
                      >
                        <option value="confirm">Confirm Defect</option>
                        <option value="correct">Correct ML (Human Override)</option>
                        <option value="no_defect">No Defect Found</option>
                        <option value="needs_more_evidence">Needs More Evidence</option>
                      </select>
                    </div>
                    {(reviewForm.decision === 'confirm' || reviewForm.decision === 'correct') && (
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-label-sm text-outline">Severity</label>
                        <select
                          value={reviewForm.defect_severity}
                          onChange={(e) => setReviewForm((f) => ({ ...f, defect_severity: e.target.value }))}
                          className="bg-surface-container text-on-surface px-3 py-1.5 rounded-lg border border-surface-container-high outline-none font-mono text-body-sm"
                        >
                          {['critical', 'major', 'minor', 'cosmetic', 'high', 'medium', 'low'].map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  {(reviewForm.decision === 'confirm' || reviewForm.decision === 'correct') && (
                    <div className="grid grid-cols-2 gap-space-sm">
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-label-sm text-outline">Defect Category</label>
                        <input
                          type="text"
                          value={reviewForm.defect_category}
                          placeholder={defectDetail.defect_category}
                          onChange={(e) => setReviewForm((f) => ({ ...f, defect_category: e.target.value }))}
                          className="bg-surface-container text-on-surface px-3 py-1.5 rounded-lg border border-surface-container-high outline-none font-mono text-body-sm"
                        />
                      </div>
                      {reviewForm.decision === 'correct' && (
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-label-sm text-outline">Confirmed Class *</label>
                          <input
                            type="text"
                            value={reviewForm.confirmed_class}
                            placeholder="e.g. dimensional_warp"
                            onChange={(e) => setReviewForm((f) => ({ ...f, confirmed_class: e.target.value }))}
                            className="bg-surface-container text-on-surface px-3 py-1.5 rounded-lg border border-surface-container-high outline-none font-mono text-body-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                  {(reviewForm.decision === 'confirm' || reviewForm.decision === 'correct') && (
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-label-sm text-outline">Defect Description</label>
                      <textarea
                        value={reviewForm.defect_description}
                        onChange={(e) => setReviewForm((f) => ({ ...f, defect_description: e.target.value }))}
                        rows={2}
                        className="bg-surface-container text-on-surface px-3 py-1.5 rounded-lg border border-surface-container-high outline-none font-mono text-body-sm resize-none"
                        placeholder="Describe the defect observed..."
                      />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-label-sm text-outline">Review Comments</label>
                    <textarea
                      value={reviewForm.comments}
                      onChange={(e) => setReviewForm((f) => ({ ...f, comments: e.target.value }))}
                      rows={2}
                      className="bg-surface-container text-on-surface px-3 py-1.5 rounded-lg border border-surface-container-high outline-none font-mono text-body-sm resize-none"
                      placeholder="Reviewer notes, conditions, observations..."
                    />
                  </div>
                  {reviewError && <p role="alert" className="text-error font-mono text-label-sm">{reviewError}</p>}
                  <div className="flex justify-end">
                    <button
                      onClick={handleSubmitReview}
                      disabled={reviewSubmitting}
                      className="px-4 py-1.5 rounded-lg bg-primary text-on-primary font-mono text-label-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                    </button>
                  </div>
                </div>
              )}

              {/* Create CAPA form */}
              {showCapa && canManageCapa && (
                <div className="bg-surface-container-lowest rounded-xl border border-primary/20 p-space-md flex flex-col gap-space-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-[16px]">add_task</span>
                    <span className="font-mono text-label-sm font-bold text-primary uppercase tracking-wider">Create Corrective Action (CAPA)</span>
                  </div>
                  <div className="grid grid-cols-2 gap-space-sm">
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-label-sm text-outline">Assign Owner</label>
                      <select
                        value={capaForm.owner_id}
                        onChange={(e) => setCapaForm((f) => ({ ...f, owner_id: Number(e.target.value) }))}
                        className="bg-surface-container text-on-surface px-3 py-1.5 rounded-lg border border-surface-container-high outline-none font-mono text-body-sm"
                      >
                        {assignableUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-label-sm text-outline">Target Date</label>
                      <input
                        type="date"
                        value={capaForm.target_date}
                        onChange={(e) => setCapaForm((f) => ({ ...f, target_date: e.target.value }))}
                        className="bg-surface-container text-on-surface px-3 py-1.5 rounded-lg border border-surface-container-high outline-none font-mono text-body-sm"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-mono text-label-sm text-outline">Action Plan / Notes</label>
                    <textarea
                      value={capaForm.notes}
                      onChange={(e) => setCapaForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={3}
                      className="bg-surface-container text-on-surface px-3 py-1.5 rounded-lg border border-surface-container-high outline-none font-mono text-body-sm resize-none"
                      placeholder="Describe the corrective action, root cause analysis, resources needed..."
                    />
                  </div>
                  {capaError && <p role="alert" className="text-error font-mono text-label-sm">{capaError}</p>}
                  <div className="flex justify-end">
                    <button
                      onClick={handleCreateCapa}
                      disabled={capaSubmitting}
                      className="px-4 py-1.5 rounded-lg bg-primary text-on-primary font-mono text-label-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      {capaSubmitting ? 'Creating...' : 'Create CAPA'}
                    </button>
                  </div>
                </div>
              )}

              {/* CAPAs list */}
              <div className="flex flex-col gap-space-sm">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-outline">task_alt</span>
                  <span className="font-mono text-label-sm text-outline uppercase font-semibold tracking-wider">
                    Corrective Actions ({capas.length})
                  </span>
                </div>

                {capas.length === 0 ? (
                  <div className="flex items-center gap-2 bg-surface-container-lowest rounded-xl border border-surface-container-high px-space-md py-space-md text-outline font-mono text-body-sm">
                    <span className="material-symbols-outlined text-[18px]">info</span>
                    No corrective actions assigned yet.
                    {canManageCapa && <span className="ml-1">Use "Create CAPA" above.</span>}
                  </div>
                ) : (
                  capas.map((capa) => (
                    <div key={capa.id} className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-space-md flex flex-col gap-space-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-label-sm font-bold text-on-surface">CAPA-{String(capa.id).padStart(4, '0')}</span>
                            <Badge label={capa.status} cls={ACTION_STATUS_CLASS[capa.status] ?? ''} />
                            {capa.owner && <span className="font-mono text-[10px] text-outline">→ {capa.owner.name}</span>}
                            {capa.target_date && <span className="font-mono text-[10px] text-outline">Due: {new Date(capa.target_date).toLocaleDateString()}</span>}
                            <span className="font-mono text-[10px] text-outline ml-auto">{(capa as any).evidence_count ?? capa.evidence?.length ?? 0} evidence file(s)</span>
                          </div>
                          {capa.notes && <p className="text-[11px] text-on-surface-variant font-mono mt-1">{capa.notes}</p>}
                        </div>
                        {canManageCapa && (
                          <div className="flex gap-1 flex-wrap">
                            {(['in_progress', 'completed', 'closed', 'reopened'] as const)
                              .filter((s) => s !== capa.status)
                              .map((s) => (
                                <button
                                  key={s}
                                  onClick={() => handleCapaStatusChange(capa.id, s)}
                                  className="px-2 py-0.5 rounded text-[9px] font-bold font-mono bg-surface-container hover:bg-surface-container-high border border-surface-container-high text-on-surface-variant transition-colors"
                                >
                                  → {s.replace(/_/g, ' ')}
                                </button>
                              ))}
                          </div>
                        )}
                      </div>

                      {/* Evidence list */}
                      {(capa.evidence?.length ?? 0) > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-[10px] text-outline uppercase tracking-wider">Repair Evidence</span>
                          {capa.evidence?.map((ev) => (
                            <div key={ev.id} className="flex items-center gap-2 bg-surface-container/50 rounded-lg px-3 py-1.5 border border-surface-container-high font-mono text-[11px]">
                              <span className="material-symbols-outlined text-[13px] text-outline">{ev.has_file ? 'image' : 'description'}</span>
                              <span className="text-on-surface-variant flex-1 truncate">{ev.description || ev.original_filename || 'Evidence record'}</span>
                              {ev.submitted_by?.name && <span className="text-outline">by {ev.submitted_by.name}</span>}
                              <span className="text-outline">{new Date(ev.submitted_at).toLocaleDateString()}</span>
                              {ev.has_file && (
                                <button
                                  className="text-primary hover:underline"
                                  onClick={() => correctiveActionsApi.getEvidenceBlobUrl(capa.id, ev.id).then((url) => window.open(url, '_blank'))}
                                >
                                  View
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Submit evidence */}
                      {canManageCapa && (
                        evidenceActionId === capa.id ? (
                          <div className="flex flex-col gap-space-sm bg-surface-container/50 rounded-lg border border-surface-container-high p-space-sm">
                            <input
                              type="text"
                              value={evidenceForm.description}
                              onChange={(e) => setEvidenceForm((f) => ({ ...f, description: e.target.value }))}
                              placeholder="Description of repair done..."
                              className="bg-surface-container text-on-surface px-3 py-1.5 rounded-lg border border-surface-container-high outline-none font-mono text-[11px]"
                            />
                            <input
                              type="file"
                              ref={evidenceFileRef}
                              accept="image/*"
                              onChange={(e) => setEvidenceForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
                              className="font-mono text-[11px] text-on-surface-variant"
                            />
                            {evidenceError && <p className="text-error font-mono text-[11px]">{evidenceError}</p>}
                            <div className="flex gap-2">
                              <button onClick={handleSubmitEvidence} disabled={evidenceSubmitting} className="px-3 py-1 rounded-lg bg-primary text-on-primary font-mono text-[11px] font-bold hover:opacity-90 disabled:opacity-40">
                                {evidenceSubmitting ? 'Uploading...' : 'Submit Evidence'}
                              </button>
                              <button onClick={() => { setEvidenceActionId(null); setEvidenceError(null); }} className="px-3 py-1 rounded-lg bg-surface-container font-mono text-[11px] hover:bg-surface-container-high">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEvidenceActionId(capa.id)}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg border border-dashed border-surface-container-high font-mono text-[11px] text-outline hover:text-on-surface hover:border-primary/40 transition-colors w-fit"
                          >
                            <span className="material-symbols-outlined text-[13px]">add_photo_alternate</span>
                            Add Repair Evidence
                          </button>
                        )
                      )}

                      {capa.completion_notes && (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono text-[10px] text-outline uppercase">Completion Notes</span>
                          <p className="text-[11px] text-on-surface-variant font-mono">{capa.completion_notes}</p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Lineage */}
              <div className="bg-surface-container-lowest rounded-xl border border-surface-container-high p-space-md flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-outline">account_tree</span>
                  <span className="font-mono text-label-sm text-outline uppercase font-semibold tracking-wider">Inspection Lineage</span>
                </div>
                <div className="flex flex-col gap-1 font-mono text-[11px]">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[13px] text-outline">link</span>
                    <span className="text-outline">Source Inspection:</span>
                    <span className="font-bold text-primary">INS-{String(defectDetail.inspection_id).padStart(4, '0')}</span>
                    {defectDetail.inspection?.product?.name && <span className="text-outline">· {defectDetail.inspection.product.name}</span>}
                    {defectDetail.inspection?.batch?.batch_number && <span className="text-outline">· Lot {defectDetail.inspection.batch.batch_number}</span>}
                  </div>
                  <p className="text-[10px] text-outline mt-0.5">
                    Use "Reinspect" to start a follow-up inspection linked to this inspection. The original record and all decisions are preserved.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
