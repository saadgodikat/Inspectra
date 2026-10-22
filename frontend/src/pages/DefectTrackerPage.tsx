import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';

interface Defect {
  id: number;
  inspection_id: number;
  defect_type: string;
  severity: 'critical' | 'major' | 'minor' | 'cosmetic';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  description: string | null;
  location_x: number | null;
  location_y: number | null;
  confidence_score: number | null;
  created_at: string;
  inspection?: { id: number; product?: { name: string } | null; batch?: { batch_number: string } | null };
}

interface DefectsResponse {
  defects: Defect[];
  total: number;
  page: number;
  total_pages: number;
}

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-error-container/40 text-error',
  major: 'bg-primary-container/30 text-primary',
  minor: 'bg-secondary-container/20 text-secondary',
  cosmetic: 'bg-surface-container-high text-on-surface-variant',
};

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-primary-container/20 text-primary',
  in_progress: 'bg-tertiary-container/20 text-tertiary',
  resolved: 'bg-secondary/15 text-secondary',
  closed: 'bg-surface-container-highest text-on-surface-variant',
};

export const DefectTrackerPage: React.FC = () => {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchDefects = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, per_page: 20 };
      if (severityFilter !== 'all') params.severity = severityFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get<DefectsResponse>('/defects', { params });
      setDefects(res.data.defects);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
      if (res.data.defects.length > 0 && selectedId === null) {
        setSelectedId(res.data.defects[0].id);
      }
    } catch {
      setDefects([]);
    } finally {
      setLoading(false);
    }
  }, [page, severityFilter, statusFilter]);

  useEffect(() => { fetchDefects(); }, [fetchDefects]);
  useEffect(() => { setPage(1); }, [severityFilter, statusFilter]);

  const selectedDefect = defects.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="w-full min-h-screen p-margin bg-background flex flex-col gap-space-lg select-none pb-12">
      {/* Header */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-space-md p-space-md bg-surface-container-low rounded-xl border border-surface-container-high shadow-md">
        <span className="font-headline text-headline-md font-semibold tracking-tight text-on-surface">
          Defect Registry
        </span>
        <span className="font-mono text-label-sm text-outline">{total} total defects</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-space-sm p-space-sm bg-surface-container-lowest rounded-xl border border-surface-container-high">
        <div className="flex items-center gap-space-xs">
          <span className="font-mono text-label-sm text-outline uppercase">Severity:</span>
          <div className="flex items-center bg-surface-container rounded-lg px-space-sm py-1 border border-surface-container-high">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              aria-label="Filter defects by severity"
              className="bg-transparent text-label-md font-mono text-on-surface outline-none cursor-pointer"
            >
              <option value="all" className="bg-surface-container-highest text-on-surface">All</option>
              <option value="critical" className="bg-surface-container-highest text-on-surface">Critical</option>
              <option value="major" className="bg-surface-container-highest text-on-surface">Major</option>
              <option value="minor" className="bg-surface-container-highest text-on-surface">Minor</option>
              <option value="cosmetic" className="bg-surface-container-highest text-on-surface">Cosmetic</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-space-xs">
          <span className="font-mono text-label-sm text-outline uppercase">Status:</span>
          <div className="flex items-center bg-surface-container rounded-lg px-space-sm py-1 border border-surface-container-high">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter defects by status"
              className="bg-transparent text-label-md font-mono text-on-surface outline-none cursor-pointer"
            >
              <option value="all" className="bg-surface-container-highest text-on-surface">All</option>
              <option value="open" className="bg-surface-container-highest text-on-surface">Open</option>
              <option value="in_progress" className="bg-surface-container-highest text-on-surface">In Progress</option>
              <option value="resolved" className="bg-surface-container-highest text-on-surface">Resolved</option>
              <option value="closed" className="bg-surface-container-highest text-on-surface">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Split View */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Table */}
        <div className="xl:col-span-7 flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-md border border-surface-container-high">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-body-sm text-on-surface">
              <thead className="bg-surface-container text-label-sm text-outline uppercase tracking-wider border-b border-surface-container-high">
                <tr>
                  <th className="py-2.5 px-space-sm">DEFECT ID</th>
                  <th className="py-2.5 px-space-sm">TYPE</th>
                  <th className="py-2.5 px-space-sm">SEVERITY</th>
                  <th className="py-2.5 px-space-sm">STATUS</th>
                  <th className="py-2.5 px-space-sm">INSPECTION</th>
                  <th className="py-2.5 px-space-sm">CREATED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/30">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-outline">
                      <span className="material-symbols-outlined text-[24px] animate-spin block mx-auto mb-2">progress_activity</span>
                      Loading defects...
                    </td>
                  </tr>
                ) : defects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-outline">
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
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-surface-container-high border-l-2 border-primary'
                            : 'hover:bg-surface-container bg-surface-container-lowest'
                        }`}
                      >
                        <td className="py-2 px-space-sm font-bold text-primary whitespace-nowrap">#{d.id}</td>
                        <td className="py-2 px-space-sm whitespace-nowrap">
                          <div className="font-semibold text-on-surface">{d.defect_type}</div>
                          {d.description && <div className="text-[10px] text-outline truncate max-w-[160px]">{d.description}</div>}
                        </td>
                        <td className="py-2 px-space-sm whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${SEVERITY_STYLE[d.severity] ?? ''}`}>
                            {d.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-space-sm whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLE[d.status] ?? ''}`}>
                            {d.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 px-space-sm text-on-surface-variant whitespace-nowrap">
                          INS-{String(d.inspection_id).padStart(4, '0')}
                        </td>
                        <td className="py-2 px-space-sm text-outline whitespace-nowrap">
                          {new Date(d.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="p-space-md bg-surface-container-low flex items-center justify-between border-t border-surface-container-high font-mono text-body-sm text-outline">
              <span>Page {page} of {totalPages} ({total} defects)</span>
              <div className="flex items-center gap-space-xs">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-space-sm py-1 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40">← Prev</button>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-space-sm py-1 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="xl:col-span-5 flex flex-col gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-lg border border-surface-container-high">
          {!selectedDefect ? (
            <div className="flex flex-col items-center justify-center h-48 text-outline font-mono text-body-sm gap-2">
              <span className="material-symbols-outlined text-[32px]">radar</span>
              <span>Select a defect to inspect</span>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-headline text-headline-md font-bold text-on-surface font-mono">#{selectedDefect.id}</span>
                    <span className={`px-2 py-0.5 rounded text-label-sm font-mono font-bold ${SEVERITY_STYLE[selectedDefect.severity] ?? ''}`}>
                      {selectedDefect.severity.toUpperCase()}
                    </span>
                  </div>
                  <span className="font-mono text-label-sm text-on-surface-variant">{selectedDefect.defect_type}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-label-sm font-mono ${STATUS_STYLE[selectedDefect.status] ?? ''}`}>
                  {selectedDefect.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>

              <div className="flex flex-col gap-space-xs bg-surface-container-low p-space-sm rounded-lg font-mono text-body-sm border border-surface-container-high">
                <div className="flex justify-between">
                  <span className="text-outline">Inspection:</span>
                  <span className="text-on-surface">INS-{String(selectedDefect.inspection_id).padStart(4, '0')}</span>
                </div>
                {selectedDefect.inspection?.product?.name && (
                  <div className="flex justify-between">
                    <span className="text-outline">Product:</span>
                    <span className="text-on-surface">{selectedDefect.inspection.product.name}</span>
                  </div>
                )}
                {selectedDefect.inspection?.batch?.batch_number && (
                  <div className="flex justify-between">
                    <span className="text-outline">Batch:</span>
                    <span className="text-on-surface">{selectedDefect.inspection.batch.batch_number}</span>
                  </div>
                )}
                {selectedDefect.confidence_score !== null && (
                  <div className="flex justify-between">
                    <span className="text-outline">AI Confidence:</span>
                    <span className="text-primary font-semibold">{(selectedDefect.confidence_score * 100).toFixed(1)}%</span>
                  </div>
                )}
                {(selectedDefect.location_x !== null || selectedDefect.location_y !== null) && (
                  <div className="flex justify-between">
                    <span className="text-outline">Coordinates:</span>
                    <span className="text-on-surface">X:{selectedDefect.location_x} Y:{selectedDefect.location_y}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-outline">Logged:</span>
                  <span className="text-on-surface">{new Date(selectedDefect.created_at).toLocaleString()}</span>
                </div>
                {selectedDefect.description && (
                  <div className="flex flex-col gap-1 pt-1 border-t border-surface-container">
                    <span className="text-outline">Description:</span>
                    <p className="text-on-surface">{selectedDefect.description}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
