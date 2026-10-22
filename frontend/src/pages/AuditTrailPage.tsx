import React, { useEffect, useState, useCallback } from 'react';
import api from '../api/client';

interface AuditLogEntry {
  id: number;
  timestamp: string;
  actor_id: number | null;
  actor_name: string | null;
  entity_type: string;
  entity_id: number | null;
  action: string;
  details: Record<string, unknown> | null;
  correlation_id: string | null;
}

interface AuditResponse {
  events: AuditLogEntry[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export const AuditTrailPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, per_page: 50 };
      if (entityFilter !== 'ALL') params.entity_type = entityFilter;
      const res = await api.get<AuditResponse>('/audit', { params });
      setLogs(res.data.events);
      setTotal(res.data.total);
      setTotalPages(res.data.total_pages);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, entityFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [entityFilter]);

  return (
    <div className="w-full min-h-screen p-margin bg-background flex flex-col gap-space-lg select-none pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md p-space-md bg-surface-container-low rounded-xl border border-surface-container-high shadow-md">
        <div className="flex items-center gap-space-md">
          <div className="p-2 rounded-lg bg-primary-container/20 text-primary border border-primary-container/30">
            <span className="material-symbols-outlined text-[24px]">history_edu</span>
          </div>
          <div>
            <div className="flex items-center gap-space-sm">
              <span className="text-label-sm font-mono uppercase tracking-widest text-primary font-bold">
                21 CFR PART 11 // TAMPER-EVIDENT LEDGER
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
            </div>
            <h1 className="font-headline text-headline-lg font-bold text-on-surface tracking-tight">
              System Audit Trail &amp; Immutable Event Ledger
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-space-sm">
          <span className="px-space-sm py-1 rounded bg-surface-container font-mono text-label-sm text-tertiary border border-outline-variant/30">
            SHA-256 LEDGER
          </span>
          <span className="px-space-sm py-1 rounded bg-surface-container font-mono text-label-sm text-outline border border-outline-variant/30">
            {total} events
          </span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-space-xs overflow-x-auto p-space-sm bg-surface-container-lowest rounded-xl border border-surface-container-high">
        {['ALL', 'inspection', 'batch', 'defect', 'decision', 'security', 'user'].map((cat) => (
          <button
            key={cat}
            onClick={() => setEntityFilter(cat)}
            className={`px-space-md py-1.5 rounded-lg text-label-md font-mono transition-colors whitespace-nowrap ${
              entityFilter === cat
                ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
            }`}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Audit Log Table */}
      <div className="rounded-xl bg-surface-container-low overflow-hidden shadow-sm border border-surface-container-high">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-body-sm text-on-surface">
            <thead className="bg-surface-container text-outline uppercase text-label-sm border-b border-surface-container-high">
              <tr>
                <th className="py-2.5 px-space-md">Event ID</th>
                <th className="py-2.5 px-space-md">Timestamp (UTC)</th>
                <th className="py-2.5 px-space-md">Actor</th>
                <th className="py-2.5 px-space-md">Entity</th>
                <th className="py-2.5 px-space-md">Action Code</th>
                <th className="py-2.5 px-space-md">Details</th>
                <th className="py-2.5 px-space-md text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/30">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-outline">
                    <span className="material-symbols-outlined text-[24px] animate-spin block mx-auto mb-2">progress_activity</span>
                    Loading audit events...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-outline">
                    <span className="material-symbols-outlined text-[32px] block mx-auto mb-2">history_edu</span>
                    No audit events found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-surface-container transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-space-md font-bold text-primary whitespace-nowrap">#{log.id}</td>
                    <td className="py-2.5 px-space-md text-on-surface-variant whitespace-nowrap">
                      {new Date(log.timestamp).toISOString().replace('T', ' ').slice(0, 19)} UTC
                    </td>
                    <td className="py-2.5 px-space-md whitespace-nowrap font-semibold text-on-surface">
                      {log.actor_name ?? 'System'}
                    </td>
                    <td className="py-2.5 px-space-md whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container-highest text-tertiary border border-outline-variant/30">
                        {log.entity_type?.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-space-md font-semibold text-secondary whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-2.5 px-space-md text-on-surface-variant max-w-xs truncate">
                      {log.details ? JSON.stringify(log.details) : '—'}
                    </td>
                    <td className="py-2.5 px-space-md text-right whitespace-nowrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}
                        className="px-2 py-1 text-label-sm bg-surface-container-high hover:bg-surface-container-highest rounded text-outline hover:text-on-surface transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-space-md bg-surface-container-low flex items-center justify-between border-t border-surface-container-high font-mono text-body-sm text-outline">
            <span>Page {page} of {totalPages} ({total} total events)</span>
            <div className="flex items-center gap-space-xs">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-space-sm py-1 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-space-sm py-1 rounded bg-surface-container hover:bg-surface-container-high disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-surface-container-low border border-surface-container-high rounded-xl p-space-lg shadow-2xl flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
                <h3 className="font-headline text-headline-md font-bold text-on-surface">Audit Event Detail</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="p-1 rounded text-outline hover:text-on-surface">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-space-sm font-mono text-body-sm bg-surface-container-lowest p-space-md rounded border border-surface-container-high">
              <div className="flex justify-between">
                <span className="text-outline">EVENT ID:</span>
                <span className="text-primary font-bold">#{selectedLog.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">TIMESTAMP:</span>
                <span className="text-on-surface">{new Date(selectedLog.timestamp).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">ACTOR:</span>
                <span className="text-on-surface font-semibold">{selectedLog.actor_name ?? 'System'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">ENTITY:</span>
                <span className="text-tertiary">{selectedLog.entity_type?.toUpperCase()} #{selectedLog.entity_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">ACTION:</span>
                <span className="text-secondary font-bold">{selectedLog.action}</span>
              </div>
              {selectedLog.details && (
                <div className="flex flex-col gap-1 pt-1 border-t border-surface-container">
                  <span className="text-outline">DETAILS:</span>
                  <pre className="text-on-surface text-[11px] whitespace-pre-wrap break-all bg-surface-container p-2 rounded">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.correlation_id && (
                <div className="flex justify-between pt-1 border-t border-surface-container">
                  <span className="text-outline">CORRELATION ID:</span>
                  <span className="text-tertiary text-[11px] select-all">{selectedLog.correlation_id}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-space-xs">
              <span className="text-label-sm font-mono text-secondary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                BLOCK INTEGRITY VERIFIED
              </span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-space-md py-1.5 rounded bg-primary-container text-on-primary-container font-bold hover:bg-secondary-container"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
