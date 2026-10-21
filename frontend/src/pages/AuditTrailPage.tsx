import React, { useState } from 'react';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  entityType: 'INSPECTION' | 'BATCH' | 'DEFECT' | 'DECISION' | 'SECURITY';
  action: string;
  details: string;
  shaHash: string;
  status: 'VERIFIED' | 'TAMPER_SEALED' | 'FLAGGED';
}

const mockAuditLogs: AuditLogEntry[] = [
  {
    id: 'AUD-8849-01',
    timestamp: '2026-10-21 14:38:00 UTC',
    actor: 'Systems Engine (AOI-04)',
    role: 'automated_service',
    entityType: 'DEFECT',
    action: 'CAPA_TASK_INITIATED',
    details: 'Triggered root cause remediation workflow for defect #DEF-9042 on Line 04',
    shaHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'VERIFIED',
  },
  {
    id: 'AUD-8848-12',
    timestamp: '2026-10-21 14:25:31 UTC',
    actor: 'S. Godikat',
    role: 'lead_qa',
    entityType: 'DEFECT',
    action: 'SEVERITY_ESCALATION',
    details: 'Void parameter validated at 27.8%; escalated defect severity to CRITICAL',
    shaHash: '8f12cb89a3f019482910ba77cc0124cbb45601ee0293121045a9018420194812',
    status: 'TAMPER_SEALED',
  },
  {
    id: 'AUD-8847-09',
    timestamp: '2026-10-21 14:18:22 UTC',
    actor: 'Station Alpha Optical SMT',
    role: 'optical_station',
    entityType: 'INSPECTION',
    action: 'INSPECTION_RUN_COMPLETED',
    details: 'Run #INS-2026-8841 evaluated 120/120 units. 2 critical bridging defects detected.',
    shaHash: '3a99de02188401928019ab77de02819034901ee1029480194801928401928401',
    status: 'VERIFIED',
  },
  {
    id: 'AUD-8846-55',
    timestamp: '2026-10-21 13:50:14 UTC',
    actor: 'S. Godikat',
    role: 'quality_manager',
    entityType: 'DECISION',
    action: '21CFR11_ELECTRONIC_SIGNATURE',
    details: 'Authorized shipping release for #BATCH-2026-771 under IPC-A-610 Class 3 spec',
    shaHash: '77cc013ee449019284019ab77de02819034901ee102948019480192840192840',
    status: 'TAMPER_SEALED',
  },
  {
    id: 'AUD-8845-20',
    timestamp: '2026-10-21 13:30:12 UTC',
    actor: 'M. Vance',
    role: 'quality_manager',
    entityType: 'BATCH',
    action: 'BATCH_QUARANTINE_LOCKED',
    details: 'Quarantine order locked for #BATCH-2026-768 following 1.42% defect excursion',
    shaHash: '9d0124cbb456019284019ab77de02819034901ee102948019480192840192840',
    status: 'TAMPER_SEALED',
  },
  {
    id: 'AUD-8844-03',
    timestamp: '2026-10-21 12:44:00 UTC',
    actor: 'Admin Core',
    role: 'system_admin',
    entityType: 'SECURITY',
    action: 'ROLE_PERMISSION_CHECK',
    details: 'RBAC verification passed for Station 04 station operator credentials',
    shaHash: '554336a38c7c2a2a2ad97707ee9800ffb77dffb95f96ccff0297e8ffb4ab9300',
    status: 'VERIFIED',
  },
];

export const AuditTrailPage: React.FC = () => {
  const [logs] = useState<AuditLogEntry[]>(mockAuditLogs);
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const filteredLogs = logs.filter((log) => {
    if (entityFilter !== 'ALL' && log.entityType !== entityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        log.id.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.actor.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.shaHash.toLowerCase().includes(q)
      );
    }
    return true;
  });

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

        <div className="flex items-center gap-space-sm flex-wrap">
          <span className="px-space-sm py-1 rounded bg-surface-container font-mono text-label-sm text-tertiary border border-outline-variant/30">
            HASH: SHA-256 LEDGER VALIDATED
          </span>
          <button
            onClick={() => alert('Exporting signed audit manifest JSON...')}
            className="flex items-center gap-1.5 px-space-md py-1.5 rounded bg-primary-container hover:bg-secondary-container text-on-primary-container font-label-md font-semibold transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            <span>Export Audit Manifest</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md p-space-sm bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-sm">
        <div className="flex items-center gap-space-xs overflow-x-auto w-full sm:w-auto">
          {['ALL', 'INSPECTION', 'BATCH', 'DEFECT', 'DECISION', 'SECURITY'].map((cat) => (
            <button
              key={cat}
              onClick={() => setEntityFilter(cat)}
              className={`px-space-md py-1.5 rounded-lg text-label-md font-mono transition-colors whitespace-nowrap ${
                entityFilter === cat
                  ? 'bg-primary-container text-on-primary-container font-bold shadow-sm'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-[16px] text-outline">
            search
          </span>
          <input
            type="text"
            placeholder="Search action, actor, hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-container rounded-lg pl-8 pr-3 py-1.5 font-mono text-body-sm text-on-surface placeholder:text-outline outline-none border border-surface-container-high focus:border-primary"
          />
        </div>
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
                <th className="py-2.5 px-space-md">Change Details</th>
                <th className="py-2.5 px-space-md">Tamper Status</th>
                <th className="py-2.5 px-space-md text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/30">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="hover:bg-surface-container transition-colors cursor-pointer"
                >
                  <td className="py-2.5 px-space-md font-bold text-primary whitespace-nowrap">
                    #{log.id}
                  </td>
                  <td className="py-2.5 px-space-md text-on-surface-variant whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-space-md whitespace-nowrap">
                    <span className="font-semibold text-on-surface">{log.actor}</span>
                    <span className="text-[10px] text-outline block">({log.role})</span>
                  </td>
                  <td className="py-2.5 px-space-md whitespace-nowrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container-highest text-tertiary border border-outline-variant/30">
                      {log.entityType}
                    </span>
                  </td>
                  <td className="py-2.5 px-space-md font-semibold text-secondary whitespace-nowrap">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-space-md text-on-surface-variant max-w-md truncate">
                    {log.details}
                  </td>
                  <td className="py-2.5 px-space-md whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === 'TAMPER_SEALED'
                          ? 'bg-secondary/15 text-secondary border border-secondary/30'
                          : 'bg-tertiary/15 text-tertiary border border-tertiary/30'
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-space-md text-right whitespace-nowrap">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLog(log);
                      }}
                      className="px-2 py-1 text-label-sm bg-surface-container-high hover:bg-surface-container-highest rounded text-outline hover:text-on-surface transition-colors"
                    >
                      Verify SHA
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail / SHA Verification Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-surface-container-low border border-surface-container-high rounded-xl p-space-lg shadow-2xl flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">verified</span>
                <h3 className="font-headline text-headline-md font-bold text-on-surface">
                  Immutable Audit Certificate
                </h3>
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
                <span className="text-on-surface">{selectedLog.timestamp}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">ACTOR:</span>
                <span className="text-on-surface font-semibold">{selectedLog.actor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">ACTION:</span>
                <span className="text-secondary font-bold">{selectedLog.action}</span>
              </div>
              <div className="flex flex-col gap-1 pt-1 border-t border-surface-container">
                <span className="text-outline">CHANGE DESCRIPTION:</span>
                <p className="text-on-surface">{selectedLog.details}</p>
              </div>
              <div className="flex flex-col gap-1 pt-1 border-t border-surface-container">
                <span className="text-outline">SHA-256 CRYPTOGRAPHIC SIGNATURE:</span>
                <span className="text-tertiary break-all text-[11px] p-2 bg-surface-container rounded select-all">
                  {selectedLog.shaHash}
                </span>
              </div>
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
                Close Certificate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
