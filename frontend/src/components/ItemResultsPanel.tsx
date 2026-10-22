import React, { useState } from 'react';
import { inspectionsApi } from '../api/client';
import type { InspectionItem, ItemsSummary } from '../types';

interface Props {
  inspectionId: number;
  summary: ItemsSummary;
  items: InspectionItem[];
  canOverride: boolean;
  onRefresh: () => void | Promise<unknown>;
}

export const ItemResultsPanel: React.FC<Props> = ({ inspectionId, summary, items, canOverride, onRefresh }) => {
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const [overrideState, setOverrideState] = useState<Record<number, { decision: string; comment: string }>>({});
  const [submitting, setSubmitting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadImage = async (item: InspectionItem) => {
    if (!item.image_id || imageUrls[item.item_number]) return;
    try {
      const url = await inspectionsApi.getImageBlobUrl(inspectionId, item.image_id);
      setImageUrls((prev) => ({ ...prev, [item.item_number]: url }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load item image.');
    }
  };

  const toggleExpand = (item: InspectionItem) => {
    if (expandedItem === item.item_number) {
      setExpandedItem(null);
    } else {
      setExpandedItem(item.item_number);
      loadImage(item);
    }
  };

  const handleOverride = async (item: InspectionItem) => {
    const state = overrideState[item.item_number];
    if (!state?.decision) return;
    setSubmitting(item.item_number);
    setError(null);
    try {
      await inspectionsApi.overrideItem(
        inspectionId,
        item.item_number,
        state.decision as 'good' | 'defective',
        state.comment || undefined
      );
      await onRefresh();
    } catch (overrideError) {
      setError(overrideError instanceof Error ? overrideError.message : 'Failed to apply item override.');
    } finally {
      setSubmitting(null);
    }
  };

  const fpy = summary.total > 0
    ? (((summary.total - summary.defective) / summary.total) * 100).toFixed(1)
    : '—';

  return (
    <div className="flex flex-col gap-space-md">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-space-sm font-mono text-label-sm">
        {[
          { label: 'TOTAL', value: summary.total, color: 'text-on-surface' },
          { label: 'GOOD', value: summary.good, color: 'text-tertiary' },
          { label: 'DEFECTIVE', value: summary.defective, color: 'text-error' },
          { label: 'PENDING', value: summary.pending_upload, color: 'text-secondary' },
          { label: 'FPY', value: `${fpy}%`, color: summary.defective > 0 ? 'text-error' : 'text-tertiary' },
        ].map((s) => (
          <div key={s.label} className="bg-surface-container p-space-sm rounded-lg border border-surface-container-high flex flex-col gap-0.5">
            <span className="text-outline uppercase tracking-wider text-[10px]">{s.label}</span>
            <span className={`font-bold text-headline-md ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {summary.pending_upload > 0 && (
        <div className="flex items-center gap-2 bg-secondary-container/20 border border-secondary/30 rounded-lg px-space-sm py-2 font-mono text-label-sm text-secondary">
          <span className="material-symbols-outlined text-[16px]">info</span>
          {summary.pending_upload} item(s) have no image uploaded yet and were not analyzed.
        </div>
      )}
      {error && <p role="alert" className="text-body-sm text-error">{error}</p>}

      {/* Items Table */}
      <div className="bg-surface-container-lowest rounded-xl overflow-hidden border border-surface-container-high">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm text-on-surface">
            <thead className="bg-surface-container-low uppercase text-label-sm text-outline tracking-wider font-mono border-b border-surface-container-high">
              <tr>
                <th className="py-2 px-space-md">ITEM #</th>
                <th className="py-2 px-space-md">STATUS</th>
                <th className="py-2 px-space-md">ML RESULT</th>
                <th className="py-2 px-space-md">CONFIDENCE</th>
                <th className="py-2 px-space-md">OVERRIDE</th>
                <th className="py-2 px-space-md">FINAL</th>
                <th className="py-2 px-space-md"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/30">
              {items.map((item) => {
                const isExpanded = expandedItem === item.item_number;
                const mlClass = item.ml_result?.predicted_class;
                const defectiveScore = item.ml_result?.raw_scores?.defective;
                const confidence = defectiveScore !== undefined
                  ? `${(Math.max(defectiveScore, 1 - defectiveScore) * 100).toFixed(1)}%`
                  : '—';
                const final = item.effective_decision;
                const isDefective = final === 'defective';

                return (
                  <React.Fragment key={item.item_number}>
                    <tr className={`transition-colors ${isExpanded ? 'bg-surface-container-high/40' : 'hover:bg-surface-container-high/20'}`}>
                      <td className="py-2 px-space-md font-mono text-tertiary font-semibold">
                        #{String(item.item_number).padStart(3, '0')}
                      </td>
                      <td className="py-2 px-space-md">
                        <span className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                          item.status === 'analyzed' ? 'bg-tertiary-container/30 text-tertiary border border-tertiary/30'
                          : item.status === 'uploaded' ? 'bg-secondary-container/30 text-secondary border border-secondary/30'
                          : 'bg-surface-container-high text-outline border border-surface-container-high'
                        }`}>
                          {item.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 px-space-md font-mono">
                        {mlClass ? (
                          <span className={mlClass === 'defective' ? 'text-error font-semibold' : 'text-tertiary'}>
                            {mlClass.toUpperCase()}
                          </span>
                        ) : <span className="text-outline">—</span>}
                      </td>
                      <td className="py-2 px-space-md font-mono text-on-surface-variant">{confidence}</td>
                      <td className="py-2 px-space-md font-mono">
                        {item.override_decision ? (
                          <span className={`text-[10px] font-bold ${item.override_decision === 'defective' ? 'text-error' : 'text-tertiary'}`}>
                            {item.override_decision.toUpperCase()} ✓
                          </span>
                        ) : <span className="text-outline">—</span>}
                      </td>
                      <td className="py-2 px-space-md">
                        {final ? (
                          <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            isDefective ? 'bg-error-container/30 text-error border border-error/30'
                            : 'bg-tertiary-container/20 text-tertiary border border-tertiary/30'
                          }`}>
                            {final.toUpperCase()}
                          </span>
                        ) : <span className="text-outline font-mono text-[10px]">—</span>}
                      </td>
                      <td className="py-2 px-space-md text-right">
                        {item.image_id !== null && (
                          <button
                            onClick={() => toggleExpand(item)}
                            className="p-1 rounded hover:bg-surface-container-high text-outline hover:text-on-surface"
                            title="Expand"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-surface-container/50">
                        <td colSpan={7} className="px-space-md py-space-md">
                          <div className="flex flex-col md:flex-row gap-space-md">
                            {/* Image */}
                            <div className="w-full md:w-48 flex-shrink-0">
                              {imageUrls[item.item_number] ? (
                                <img
                                  src={imageUrls[item.item_number]}
                                  alt={`Item ${item.item_number}`}
                                  className="w-full rounded-lg border border-surface-container-high object-cover"
                                />
                              ) : (
                                <div className="w-full h-32 rounded-lg border border-surface-container-high bg-surface-container flex items-center justify-center font-mono text-outline text-label-sm">
                                  <span className="material-symbols-outlined text-[24px]">image</span>
                                </div>
                              )}
                            </div>

                            {/* ML Detail + Override */}
                            <div className="flex flex-col gap-space-sm flex-1 font-mono text-body-sm">
                              {item.ml_result && (
                                <div className="flex flex-col gap-1 bg-surface-container p-space-sm rounded-lg border border-surface-container-high">
                                  <span className="text-outline text-label-sm uppercase">ML Result</span>
                                  <div className="flex justify-between">
                                    <span className="text-outline">Model:</span>
                                    <span className="text-on-surface">{item.ml_result.model_name} v{item.ml_result.model_version}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-outline">Good score:</span>
                                    <span className="text-tertiary">{((item.ml_result.raw_scores?.good ?? 0) * 100).toFixed(2)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-outline">Defective score:</span>
                                    <span className="text-error">{((item.ml_result.raw_scores?.defective ?? 0) * 100).toFixed(2)}%</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-outline">Duration:</span>
                                    <span className="text-on-surface-variant">{item.ml_result.processing_duration_ms}ms</span>
                                  </div>
                                </div>
                              )}
                              {!item.ml_result && (
                                <p className="text-outline">
                                  This image has not been analyzed yet.
                                </p>
                              )}

                              {/* Override */}
                              {canOverride && item.ml_result && (
                              <div className="flex flex-col gap-space-xs bg-surface-container p-space-sm rounded-lg border border-surface-container-high">
                                <span className="text-outline text-label-sm uppercase">Override ML Decision</span>
                                <div className="flex gap-space-sm">
                                  <select
                                    value={overrideState[item.item_number]?.decision ?? ''}
                                    onChange={(e) => setOverrideState((prev) => ({
                                      ...prev,
                                      [item.item_number]: { ...prev[item.item_number], decision: e.target.value }
                                    }))}
                                    className="bg-surface-container-lowest text-on-surface px-space-sm py-1 rounded border border-surface-container-high outline-none text-body-sm flex-1"
                                  >
                                    <option value="">-- Select --</option>
                                    <option value="good">Good</option>
                                    <option value="defective">Defective</option>
                                  </select>
                                  <input
                                    type="text"
                                    placeholder="Comment (optional)"
                                    value={overrideState[item.item_number]?.comment ?? ''}
                                    onChange={(e) => setOverrideState((prev) => ({
                                      ...prev,
                                      [item.item_number]: { ...prev[item.item_number], comment: e.target.value }
                                    }))}
                                    className="bg-surface-container-lowest text-on-surface px-space-sm py-1 rounded border border-surface-container-high outline-none text-body-sm flex-1"
                                  />
                                  <button
                                    disabled={!overrideState[item.item_number]?.decision || submitting === item.item_number}
                                    onClick={() => handleOverride(item)}
                                    className="px-space-md py-1 rounded bg-primary-container text-on-primary-container font-bold text-label-sm disabled:opacity-40 hover:bg-secondary-container"
                                  >
                                    {submitting === item.item_number ? '...' : 'Apply'}
                                  </button>
                                </div>
                                {item.override_decision && (
                                  <span className="text-outline text-label-sm">
                                    Current override: <span className={item.override_decision === 'defective' ? 'text-error' : 'text-tertiary'}>{item.override_decision}</span>
                                    {item.override_comment && ` — "${item.override_comment}"`}
                                  </span>
                                )}
                              </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
