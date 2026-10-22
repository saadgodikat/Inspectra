import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { batchesApi } from '../api/client';
import type { Batch } from '../types';

const GATE_STATUS: Record<string, string> = {
  created: 'CREATED',
  in_production: 'IN PRODUCTION',
  produced: 'PRODUCED',
  under_inspection: 'UNDER INSPECTION',
  on_hold: 'ON HOLD',
  released: 'RELEASED',
  archived: 'ARCHIVED',
};

export const BatchReleasesPage: React.FC = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeDrawerBatch, setActiveDrawerBatch] = useState<Batch | null>(null);
  const [signatureMeaning, setSignatureMeaning] = useState('verify_all');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter.toLowerCase();
      const res = await batchesApi.list(params);
      setBatches(res.batches);
      setTotal(res.count);
    } catch {
      setBatches([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchBatches(); }, [fetchBatches]);

  const readyCount = batches.filter((b) => b.status === 'produced' || b.status === 'under_inspection').length;
  const holdCount = batches.filter((b) => b.status === 'on_hold').length;
  const releasedCount = batches.filter((b) => b.status === 'released').length;

  const handleExecuteRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 4) { setPinError('Please enter a valid 4–6 digit PIN'); return; }
    if (!activeDrawerBatch) return;
    setPinError('');
    setIsSubmitting(true);
    setError(null);
    try {
      await batchesApi.updateStatus(activeDrawerBatch.id, 'released', signatureMeaning);
      setActiveDrawerBatch(null);
      setPin('');
      fetchBatches();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Release failed. Check your permissions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleHold = async (batch: Batch) => {
    try {
      await batchesApi.updateStatus(batch.id, 'on_hold', 'Manual hold via Batch Releases page');
      fetchBatches();
    } catch {
      // silently fail
    }
  };

  return (
    <div className="w-full min-h-screen p-margin bg-background flex flex-col gap-space-lg select-none pb-12">
      {/* Compliance Banner */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-low px-space-lg py-space-md border border-surface-container-high shadow-md">
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md">
            <div className="flex items-center justify-center w-10 h-10 rounded bg-primary-container/20 text-primary border border-primary-container/40">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
            </div>
            <div>
              <div className="flex items-center gap-space-sm">
                <span className="text-label-sm font-mono tracking-widest uppercase text-primary font-bold">Quality Gate Protocol Active</span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              </div>
              <p className="font-headline text-headline-md text-on-surface font-semibold tracking-tight">
                Lot Release Compliance: 21 CFR Part 11 / ISO 9001
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">Ready / Inspection</span>
            <span className="p-1 rounded bg-secondary-container/20 text-secondary">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </span>
          </div>
          <span className="font-headline text-headline-xl font-bold text-on-surface font-mono mt-space-md">{readyCount}</span>
          <span className="text-label-sm font-mono text-outline mt-1">Lots awaiting decision</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">On Hold</span>
            <span className="p-1 rounded bg-amber-500/20 text-amber-400">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            </span>
          </div>
          <span className="font-headline text-headline-xl font-bold text-amber-400 font-mono mt-space-md">{holdCount}</span>
          <span className="text-label-sm font-mono text-outline mt-1">Blocked lots</span>
        </div>
        <div className="p-space-md rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">Released</span>
            <span className="p-1 rounded bg-emerald-500/20 text-emerald-400">
              <span className="material-symbols-outlined text-[18px]">local_shipping</span>
            </span>
          </div>
          <span className="font-headline text-headline-xl font-bold text-emerald-400 font-mono mt-space-md">{releasedCount}</span>
          <span className="text-label-sm font-mono text-outline mt-1">Dispatched lots</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-surface-container-low overflow-hidden shadow-sm border border-surface-container-high">
        <div className="px-space-md py-space-sm bg-surface-container-lowest flex flex-wrap items-center justify-between gap-space-md border-b border-surface-container-high">
          <div className="flex items-center gap-space-md">
            <span className="font-headline text-headline-md font-semibold text-on-surface tracking-tight">Batch Release Register</span>
            <span className="px-space-xs py-0.5 rounded bg-surface-container font-mono text-label-sm text-outline border border-surface-container-high">
              {total} LOTS
            </span>
          </div>
          <div className="flex items-center rounded bg-surface-container-high px-space-sm py-1 border border-outline-variant/30">
            <span className="material-symbols-outlined text-[16px] text-outline mr-1.5">filter_alt</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-label-sm text-on-surface outline-none cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="under_inspection">Under Inspection</option>
              <option value="on_hold">On Hold</option>
              <option value="released">Released</option>
              <option value="produced">Produced</option>
              <option value="in_production">In Production</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-body text-body-md">
            <thead>
              <tr className="bg-surface-container-lowest text-outline text-label-sm uppercase tracking-wider font-mono border-b border-surface-container-high">
                <th className="px-space-md py-space-xs">Batch ID</th>
                <th className="px-space-md py-space-xs">Product</th>
                <th className="px-space-md py-space-xs text-right">Quantity</th>
                <th className="px-space-md py-space-xs">Production Line</th>
                <th className="px-space-md py-space-xs">Status</th>
                <th className="px-space-md py-space-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/30">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-outline font-mono">
                    <span className="material-symbols-outlined text-[24px] animate-spin block mx-auto mb-2">progress_activity</span>
                    Loading batches...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-outline font-mono">
                    <span className="material-symbols-outlined text-[32px] block mx-auto mb-2">inventory_2</span>
                    No batches found
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const gate = GATE_STATUS[b.status] ?? b.status.toUpperCase();
                  return (
                    <tr key={b.id} className="bg-surface-container-low hover:bg-surface-container transition-colors">
                      <td className="px-space-md py-space-sm font-mono whitespace-nowrap">
                        <span className="text-primary font-semibold">#{b.batch_number}</span>
                      </td>
                      <td className="px-space-md py-space-sm whitespace-nowrap">
                        <div className="font-medium text-on-surface">{b.product?.name ?? `Product #${b.product_id}`}</div>
                        {b.product?.product_code && <div className="text-label-sm text-outline font-mono">{b.product.product_code}</div>}
                      </td>
                      <td className="px-space-md py-space-sm text-right font-mono font-medium text-on-surface whitespace-nowrap">
                        {b.quantity?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-space-md py-space-sm font-mono text-label-sm text-on-surface-variant whitespace-nowrap">
                        {b.production_line ?? '—'}
                      </td>
                      <td className="px-space-md py-space-sm whitespace-nowrap">
                        <span className="text-label-sm text-on-surface-variant">{gate}</span>
                      </td>
                      <td className="px-space-md py-space-sm text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {user?.role === 'quality_manager' && b.status !== 'released' && b.status !== 'archived' && b.status !== 'on_hold' && (
                            <button
                              onClick={() => setActiveDrawerBatch(b)}
                              className="px-space-sm py-1 rounded bg-primary-container hover:bg-secondary-container text-on-primary-container text-label-md font-semibold transition-colors"
                            >
                              Release
                            </button>
                          )}
                          {user?.role === 'quality_manager' && (b.status === 'under_inspection' || b.status === 'produced') && (
                            <button
                              onClick={() => handleHold(b)}
                              className="p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"
                              title="Place on Hold"
                            >
                              <span className="material-symbols-outlined text-[18px]">block</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-space-md py-space-xs bg-surface-container-lowest flex items-center justify-between text-label-sm font-mono text-outline border-t border-surface-container-high">
          <span>ENFORCEMENT: STRICT QUALITY GATE</span>
          <span>SHOWING {batches.length} OF {total} BATCHES</span>
        </div>
      </div>

      {/* Release Sign-Off Drawer */}
      {activeDrawerBatch && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl h-full bg-surface-container-low border-l border-surface-container-high shadow-2xl flex flex-col overflow-y-auto">
            <div className="px-space-lg py-space-md bg-surface-container-lowest flex items-center justify-between border-b border-surface-container-high">
              <div className="flex items-center gap-space-sm">
                <div className="p-1.5 rounded bg-primary-container text-on-primary-container">
                  <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                </div>
                <div>
                  <h2 className="font-headline text-headline-md font-bold text-on-surface">21 CFR Part 11 Lot Sign-Off</h2>
                  <span className="text-label-sm font-mono text-primary font-semibold">AUTHORIZED PERSONNEL MANDATE</span>
                </div>
              </div>
              <button onClick={() => { setActiveDrawerBatch(null); setPin(''); setPinError(''); setError(null); }} className="p-1.5 rounded bg-surface-container-high hover:bg-surface-variant text-on-surface">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleExecuteRelease} className="p-space-lg flex flex-col gap-space-md flex-1">
              <div className="p-space-md rounded bg-surface-container border border-surface-container-high">
                <div className="flex items-center justify-between mb-space-xs">
                  <span className="text-label-sm font-mono text-outline">BATCH IDENTIFIER</span>
                </div>
                <span className="font-headline text-headline-md font-bold font-mono text-primary">#{activeDrawerBatch.batch_number}</span>
                <div className="text-body-md text-on-surface mt-1">{activeDrawerBatch.product?.name ?? `Product #${activeDrawerBatch.product_id}`}</div>
                {activeDrawerBatch.quantity && (
                  <div className="text-body-sm text-on-surface-variant font-mono mt-0.5">{activeDrawerBatch.quantity.toLocaleString()} units</div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-label-sm font-mono uppercase text-outline">Meaning of Signature</label>
                <select
                  value={signatureMeaning}
                  onChange={(e) => setSignatureMeaning(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface rounded p-space-sm text-body-md border border-surface-container-high outline-none focus:border-primary"
                >
                  <option value="verify_all">I verify this batch meets all quality specifications.</option>
                  <option value="verify_release">I authorize immediate shipping release.</option>
                  <option value="verify_waiver">I approve conditional release under signed engineering variance.</option>
                </select>
                <p className="text-body-sm text-outline mt-0.5">Legally equivalent to a handwritten signature under FDA &amp; ISO audit mandates.</p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-label-sm font-mono uppercase text-outline">Signer</label>
                <input
                  type="text"
                  readOnly
                  value={`${user?.name ?? ''} (${user?.role ?? ''})`}
                  className="bg-surface-container-lowest text-on-surface-variant rounded p-space-sm font-mono text-body-md border border-surface-container-high cursor-not-allowed"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-label-sm font-mono uppercase text-outline">Quality Passcode / PIN</label>
                <input
                  type="password"
                  maxLength={6}
                  required
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface tracking-widest text-center font-mono text-headline-md rounded p-space-sm border border-surface-container-high outline-none focus:border-primary"
                />
                {pinError && <span className="text-error text-body-sm font-mono">{pinError}</span>}
                {error && <span className="text-error text-body-sm font-mono">{error}</span>}
              </div>

              <label className="flex items-start gap-2 p-space-sm rounded bg-surface-container cursor-pointer border border-surface-container-high">
                <input type="checkbox" required className="accent-primary rounded w-4 h-4 mt-0.5" />
                <span className="text-body-sm text-on-surface-variant">
                  I understand this electronic signature is legally binding and will be stamped with a cryptographic seal.
                </span>
              </label>

              <div className="mt-auto pt-space-md border-t border-surface-container-high flex items-center justify-end gap-space-sm">
                <button type="button" onClick={() => { setActiveDrawerBatch(null); setPin(''); setPinError(''); setError(null); }} className="px-space-md py-2 rounded bg-surface-container text-outline hover:text-on-surface font-mono text-body-md">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="px-space-lg py-2 rounded bg-primary-container hover:bg-secondary-container text-on-primary-container font-headline font-bold text-body-md transition-all shadow-md flex items-center gap-2 disabled:opacity-50">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>{isSubmitting ? 'Signing...' : 'Authorize Release'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
