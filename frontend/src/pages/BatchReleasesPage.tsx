import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface BatchReleaseItem {
  id: string;
  productName: string;
  revision: string;
  units: number;
  aqlSpec: string;
  defectRate: number;
  maxDefectSpec: number;
  qaSignOff: string;
  qaSignOffHash: string;
  engApproval: 'APPROVED' | 'PENDING' | 'REJECTED';
  gateStatus: 'READY TO SHIP' | 'HOLD FOR REVIEW' | 'QUARANTINE' | 'RELEASED';
}

const initialBatches: BatchReleaseItem[] = [
  {
    id: 'BATCH-2026-771',
    productName: 'Industrial IoT Gateway v2',
    revision: 'Rev C4 / IPC-A-610 Class 3',
    units: 2500,
    aqlSpec: '0.65 Normal II',
    defectRate: 0.04,
    maxDefectSpec: 0.65,
    qaSignOff: 'S. Godikat',
    qaSignOffHash: 'SHA-8f12cb89a',
    engApproval: 'APPROVED',
    gateStatus: 'READY TO SHIP',
  },
  {
    id: 'BATCH-2026-772',
    productName: 'Edge Compute Module X9',
    revision: 'Rev B1 / Automotive Rigor',
    units: 1200,
    aqlSpec: '0.40 Tightened III',
    defectRate: 0.17,
    maxDefectSpec: 0.40,
    qaSignOff: 'S. Godikat',
    qaSignOffHash: 'SHA-3a99de021',
    engApproval: 'PENDING',
    gateStatus: 'HOLD FOR REVIEW',
  },
  {
    id: 'BATCH-2026-768',
    productName: 'Optical Fiber Transceiver Q4',
    revision: 'Rev A8 / Telco Grade',
    units: 5000,
    aqlSpec: '0.25 Zero-Defect',
    defectRate: 1.42,
    maxDefectSpec: 0.25,
    qaSignOff: 'REJECTED (M. Vance)',
    qaSignOffHash: 'SHA-77cc013ee',
    engApproval: 'REJECTED',
    gateStatus: 'QUARANTINE',
  },
  {
    id: 'BATCH-2026-774',
    productName: 'Subsea Sensor Interface',
    revision: 'Rev G0 / Mil-Spec 883',
    units: 850,
    aqlSpec: '0.65 Normal II',
    defectRate: 0.00,
    maxDefectSpec: 0.65,
    qaSignOff: 'S. Godikat',
    qaSignOffHash: 'SHA-9d0124cbb',
    engApproval: 'APPROVED',
    gateStatus: 'READY TO SHIP',
  },
];

export const BatchReleasesPage: React.FC = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<BatchReleaseItem[]>(initialBatches);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Sign-Off Drawer Modal state
  const [activeDrawerBatch, setActiveDrawerBatch] = useState<BatchReleaseItem | null>(null);
  const [signatureMeaning, setSignatureMeaning] = useState('verify_all');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);

  // Certificate Modal state
  const [certificateBatch, setCertificateBatch] = useState<BatchReleaseItem | null>(null);

  const filteredBatches = batches.filter((b) => {
    if (statusFilter === 'READY') return b.gateStatus === 'READY TO SHIP' || b.gateStatus === 'RELEASED';
    if (statusFilter === 'HOLD') return b.gateStatus === 'HOLD FOR REVIEW';
    if (statusFilter === 'QUARANTINE') return b.gateStatus === 'QUARANTINE';
    return true;
  });

  const handleExecuteRelease = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 4) {
      setPinError('Please enter a valid 4-6 digit PIN');
      return;
    }
    setPinError('');
    setIsSubmittingSignature(true);

    setTimeout(() => {
      if (activeDrawerBatch) {
        setBatches((prev) =>
          prev.map((b) =>
            b.id === activeDrawerBatch.id
              ? {
                  ...b,
                  gateStatus: 'RELEASED',
                  qaSignOff: user?.name || 'S. Godikat',
                  qaSignOffHash: `SHA-${Math.random().toString(36).substring(2, 11)}`,
                }
              : b
          )
        );
      }
      setIsSubmittingSignature(false);
      setActiveDrawerBatch(null);
      setPin('');
    }, 600);
  };

  const handleQuarantine = (batchId: string) => {
    setBatches((prev) =>
      prev.map((b) => (b.id === batchId ? { ...b, gateStatus: 'QUARANTINE', engApproval: 'REJECTED' } : b))
    );
  };

  const readyCount = batches.filter((b) => b.gateStatus === 'READY TO SHIP' || b.gateStatus === 'RELEASED').length;
  const holdCount = batches.filter((b) => b.gateStatus === 'HOLD FOR REVIEW').length;
  const quarantineCount = batches.filter((b) => b.gateStatus === 'QUARANTINE').length;

  return (
    <div className="w-full min-h-screen p-margin bg-background flex flex-col gap-space-lg select-none">
      {/* Compliance Banner */}
      <div className="relative overflow-hidden rounded-xl bg-surface-container-low px-space-lg py-space-md border border-surface-container-high shadow-md">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-container/10 via-transparent to-tertiary-container/5 pointer-events-none"></div>
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md">
            <div className="flex items-center justify-center w-10 h-10 rounded bg-primary-container/20 text-primary border border-primary-container/40">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
            </div>
            <div>
              <div className="flex items-center gap-space-sm">
                <span className="text-label-sm font-mono tracking-widest uppercase text-primary font-bold">
                  Quality Gate Protocol Active
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              </div>
              <p className="font-headline text-headline-md text-on-surface font-semibold tracking-tight">
                Lot Release Compliance: ISO 9001 / IPC-A-610 Class 3 Standards Active
              </p>
            </div>
          </div>

          <div className="flex items-center gap-space-sm flex-wrap">
            <div className="flex items-center gap-space-xs px-space-md py-space-xs rounded bg-surface-container font-mono text-label-sm text-on-surface-variant border border-surface-container-high">
              <span className="text-tertiary font-bold">21 CFR PART 11</span>
              <span className="text-outline">/</span>
              <span>TAMPER-SEALED LOG</span>
            </div>
            <button
              onClick={() => setActiveDrawerBatch(batches[0])}
              className="flex items-center gap-space-xs px-space-md py-space-sm rounded bg-primary-container hover:bg-secondary-container text-on-primary-container text-label-md uppercase tracking-wider font-semibold transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">draw</span>
              <span>Quick Sign Lot</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Mosaic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Stat 1 */}
        <div className="relative p-space-md rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">Batches Ready</span>
            <span className="p-1 rounded bg-secondary-container/20 text-secondary">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-headline-xl font-bold text-on-surface font-mono">{readyCount}</span>
              <span className="text-label-sm font-mono text-secondary">LOTS</span>
            </div>
            <span className="text-label-sm text-on-surface-variant font-mono">AQL 0.65 Confirmed</span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
            <div className="bg-secondary h-full rounded-full" style={{ width: '71%' }}></div>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="relative p-space-md rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">Pending Review</span>
            <span className="p-1 rounded bg-tertiary-container/20 text-tertiary">
              <span className="material-symbols-outlined text-[18px]">pending_actions</span>
            </span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-headline-xl font-bold text-on-surface font-mono">{holdCount}</span>
              <span className="text-label-sm font-mono text-tertiary">ENG HOLD</span>
            </div>
            <span className="text-label-sm text-on-surface-variant font-mono">Thermal Drift Flag</span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
            <div className="bg-tertiary h-full rounded-full" style={{ width: '28%' }}></div>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="relative p-space-md rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">Quarantined</span>
            <span className="p-1 rounded bg-error-container/20 text-error">
              <span className="material-symbols-outlined text-[18px]">gpp_bad</span>
            </span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-headline-xl font-bold text-error font-mono">{quarantineCount}</span>
              <span className="text-label-sm font-mono text-error">CRITICAL</span>
            </div>
            <span className="text-label-sm text-error/80 font-mono">Solder Bridging #04</span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
            <div className="bg-error h-full rounded-full" style={{ width: '14%' }}></div>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="relative p-space-md rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between shadow-sm">
          <div className="flex items-start justify-between">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">Released This Wk</span>
            <span className="p-1 rounded bg-primary-container/20 text-primary">
              <span className="material-symbols-outlined text-[18px]">local_shipping</span>
            </span>
          </div>
          <div className="mt-space-md flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-headline text-headline-xl font-bold text-on-surface font-mono">48</span>
              <span className="text-label-sm font-mono text-primary">DISPATCHED</span>
            </div>
            <span className="text-label-sm text-on-surface-variant font-mono">99.96% First Pass</span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
            <div className="bg-primary-container h-full rounded-full" style={{ width: '96%' }}></div>
          </div>
        </div>
      </div>

      {/* Operational Telemetry / Visual Inspection Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Visual Proof Imagery Card */}
        <div className="lg:col-span-8 rounded-xl bg-surface-container-low p-space-md flex flex-col justify-between shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-[18px]">biotech</span>
              <span className="font-headline text-headline-md font-semibold text-on-surface">
                Automated Optical Inspection (AOI) Verification Stream
              </span>
            </div>
            <div className="flex items-center gap-space-sm font-mono text-label-sm text-outline">
              <span>LINE-04 HIGH MAG</span>
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md my-space-xs py-2">
            <div className="relative rounded-lg overflow-hidden bg-surface-container-lowest h-48 flex flex-col justify-end p-space-sm border border-surface-container-high">
              <img
                className="absolute inset-0 w-full h-full object-cover opacity-60"
                alt="Optical inspection macro capture"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC7x7szMYSIX0H4cDY5J-Sb9rQ29_2_7QrHENM9177I5NL_UENW1mGmS38Vogv25lIPQQRcnCzRCvtDC-Jc-ERU_Yd0tO9YyppNtpqD49cZLMgjJTJkN7FB0-14A0wXBgi5e7tWDhJPj81pvHKlpAxb-sgm6cqxYpnNZJCcbOuk7_ol7Nn4sIrPUI5qn668vJW2UKQYbCscIiUWl80iyTi7MtI-zJb9ZZj97MRZx9EyJnY6Afagc7dbnA"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/40 to-transparent"></div>
              <div className="relative flex items-center justify-between text-label-sm font-mono">
                <span className="bg-surface-container-lowest/90 px-space-xs py-0.5 rounded text-tertiary">
                  AOI-CAM-01: BGA ARRAY
                </span>
                <span className="text-secondary font-semibold">COPLANARITY PASS</span>
              </div>
            </div>

            <div className="relative rounded-lg overflow-hidden bg-surface-container-lowest h-48 flex flex-col justify-end p-space-sm border border-surface-container-high">
              <img
                className="absolute inset-0 w-full h-full object-cover opacity-60"
                alt="Pick and place telemetry"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA4hbR4GX-KeRVQFvjHFGBOeTctOOP1mDuIsGv3JfE34CeSV712q1cHRkOcbqqMwJzt-pj7m2wAhFDUIEy7P6qf2JqyibqfdFytpweOO8cyU2YXIcISWuHLhDIQ0hc8BTVzi0K_HvawDzhItuaQQmqvXlA61Fbkj5LJ6C4eCi8cNwIXEm4f4PvCl89Y__mIB1NpCBa0PwqRTT_aNPTxOC0qNIDDyjQg-s0lDmkynzCKls-5KxzSRsWnFQ"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-surface-container-lowest/40 to-transparent"></div>
              <div className="relative flex items-center justify-between text-label-sm font-mono">
                <span className="bg-surface-container-lowest/90 px-space-xs py-0.5 rounded text-primary">
                  AOI-CAM-02: QFN-48 POLARITY
                </span>
                <span className="text-primary font-semibold">ALIGN 0.002mm OK</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between pt-space-xs text-label-sm font-mono text-on-surface-variant border-t border-surface-container-high">
            <span>Optical Yield Tolerance: ±0.015mm</span>
            <span>Spectrometric Radiance: 99.4% NOM</span>
            <span className="text-tertiary">Authority: INSPECTRA-CRYPTO-NODE-7</span>
          </div>
        </div>

        {/* Yield Distribution Sparkline SVG Card */}
        <div className="lg:col-span-4 rounded-xl bg-surface-container-low p-space-md flex flex-col justify-between shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">
              AQL Defect Density Curve
            </span>
            <span className="text-label-sm text-secondary font-mono">0.04% TARGET ≤ 0.65%</span>
          </div>

          <div className="h-32 flex items-center justify-center my-space-sm">
            <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 300 100">
              <defs>
                <linearGradient id="curveGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#ffb77d" stopOpacity="0.3"></stop>
                  <stop offset="100%" stopColor="#ffb77d" stopOpacity="0.0"></stop>
                </linearGradient>
              </defs>
              <line stroke="#2a2a2a" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="300" y1="20" y2="20"></line>
              <line stroke="#2a2a2a" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="300" y1="50" y2="50"></line>
              <line stroke="#2a2a2a" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="300" y1="80" y2="80"></line>
              <path d="M 0,85 Q 40,82 80,75 T 160,40 T 220,25 T 300,18 L 300,95 L 0,95 Z" fill="url(#curveGradient)"></path>
              <path d="M 0,85 Q 40,82 80,75 T 160,40 T 220,25 T 300,18" fill="none" stroke="#ffb77d" strokeWidth="2.5"></path>
              <circle cx="220" cy="25" fill="#d97707" r="4"></circle>
              <circle cx="220" cy="25" fill="none" opacity="0.6" r="7" stroke="#ffb77d" strokeWidth="1"></circle>
            </svg>
          </div>

          <div className="p-space-xs rounded bg-surface-container flex items-center justify-between text-label-sm font-mono border border-surface-container-high">
            <span className="text-on-surface-variant">Lot Normal Spec: Level II</span>
            <span className="text-tertiary font-bold">P99 Cpk: 1.84</span>
          </div>
        </div>
      </div>

      {/* Primary Table Section */}
      <div className="rounded-xl bg-surface-container-low overflow-hidden shadow-sm border border-surface-container-high">
        {/* Table Header Toolbar */}
        <div className="px-space-md py-space-sm bg-surface-container-lowest flex flex-wrap items-center justify-between gap-space-md border-b border-surface-container-high">
          <div className="flex items-center gap-space-md">
            <span className="font-headline text-headline-md font-semibold text-on-surface tracking-tight">
              Active Batch Release Register
            </span>
            <span className="px-space-xs py-0.5 rounded bg-surface-container font-mono text-label-sm text-outline border border-surface-container-high">
              {filteredBatches.length} LOTS EVALUATED
            </span>
          </div>

          <div className="flex items-center gap-space-sm">
            <div className="flex items-center rounded bg-surface-container-high px-space-sm py-1 border border-outline-variant/30">
              <span className="material-symbols-outlined text-[16px] text-outline mr-1.5">filter_alt</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-label-sm text-on-surface outline-none cursor-pointer"
              >
                <option value="ALL" className="bg-surface-container-high">Filter: All Statuses</option>
                <option value="READY" className="bg-surface-container-high">Ready to Ship / Released</option>
                <option value="HOLD" className="bg-surface-container-high">Hold for Review</option>
                <option value="QUARANTINE" className="bg-surface-container-high">Quarantined</option>
              </select>
            </div>
            <button
              onClick={() => alert('Exporting 21 CFR Part 11 compliant audit manifest...')}
              className="flex items-center gap-1 px-space-md py-1 rounded bg-surface-container-high hover:bg-surface-variant text-on-surface text-label-md transition-colors border border-surface-container-high"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>Export Audit Log</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left font-body text-body-md">
            <thead>
              <tr className="bg-surface-container-lowest text-outline text-label-sm uppercase tracking-wider font-mono border-b border-surface-container-high">
                <th className="px-space-md py-space-xs">Batch ID</th>
                <th className="px-space-md py-space-xs">Product Line</th>
                <th className="px-space-md py-space-xs text-right">Units</th>
                <th className="px-space-md py-space-xs">Sampling AQL</th>
                <th className="px-space-md py-space-xs text-right">Defect Rate</th>
                <th className="px-space-md py-space-xs">QA Sign-Off</th>
                <th className="px-space-md py-space-xs">Eng Approval</th>
                <th className="px-space-md py-space-xs">Gate Status</th>
                <th className="px-space-md py-space-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high/30">
              {filteredBatches.map((b) => (
                <tr key={b.id} className="bg-surface-container-low hover:bg-surface-container transition-colors">
                  <td className="px-space-md py-space-sm font-mono text-on-surface font-medium whitespace-nowrap">
                    <span className="text-primary font-semibold">#{b.id}</span>
                  </td>
                  <td className="px-space-md py-space-sm whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">{b.productName}</span>
                      <span className="text-label-sm text-outline font-mono">{b.revision}</span>
                    </div>
                  </td>
                  <td className="px-space-md py-space-sm text-right font-mono font-medium text-on-surface whitespace-nowrap">
                    {b.units.toLocaleString()}
                  </td>
                  <td className="px-space-md py-space-sm font-mono text-label-sm text-on-surface-variant whitespace-nowrap">
                    {b.aqlSpec}
                  </td>
                  <td className="px-space-md py-space-sm text-right whitespace-nowrap">
                    <span
                      className={`font-mono text-label-md font-semibold ${
                        b.defectRate <= b.maxDefectSpec ? 'text-secondary' : 'text-error'
                      }`}
                    >
                      {b.defectRate.toFixed(2)}%
                    </span>
                    <span className="text-label-sm text-outline font-mono block">
                      {b.defectRate <= b.maxDefectSpec ? 'PASS' : 'FAIL'} (Max {b.maxDefectSpec}%)
                    </span>
                  </td>
                  <td className="px-space-md py-space-sm whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-label-md text-on-surface font-medium">{b.qaSignOff}</span>
                      <span className="text-label-sm text-tertiary font-mono">{b.qaSignOffHash}</span>
                    </div>
                  </td>
                  <td className="px-space-md py-space-sm whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-space-xs py-0.5 rounded-full text-label-sm font-mono ${
                        b.engApproval === 'APPROVED'
                          ? 'bg-secondary/15 text-secondary'
                          : b.engApproval === 'PENDING'
                          ? 'bg-secondary-container/20 text-secondary'
                          : 'bg-error/15 text-error'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">
                        {b.engApproval === 'APPROVED'
                          ? 'check_circle'
                          : b.engApproval === 'PENDING'
                          ? 'hourglass_empty'
                          : 'cancel'}
                      </span>
                      {b.engApproval}
                    </span>
                  </td>
                  <td className="px-space-md py-space-sm whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full text-label-sm font-semibold tracking-wide uppercase ${
                        b.gateStatus === 'READY TO SHIP' || b.gateStatus === 'RELEASED'
                          ? 'bg-secondary/15 text-secondary'
                          : b.gateStatus === 'HOLD FOR REVIEW'
                          ? 'bg-secondary-container/20 text-secondary'
                          : 'bg-error/20 text-error'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          b.gateStatus === 'QUARANTINE' ? 'bg-error' : 'bg-secondary'
                        }`}
                      ></span>
                      {b.gateStatus}
                    </span>
                  </td>
                  <td className="px-space-md py-space-sm text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {b.gateStatus !== 'QUARANTINE' && b.gateStatus !== 'RELEASED' && (
                        <button
                          onClick={() => setActiveDrawerBatch(b)}
                          className="px-space-sm py-1 rounded bg-primary-container hover:bg-secondary-container text-on-primary-container text-label-md font-semibold transition-colors"
                        >
                          Execute Release
                        </button>
                      )}
                      {b.gateStatus === 'HOLD FOR REVIEW' && (
                        <button
                          onClick={() => handleQuarantine(b.id)}
                          className="p-1 rounded bg-error/10 hover:bg-error/20 text-error"
                          title="Quarantine Lot"
                        >
                          <span className="material-symbols-outlined text-[18px]">block</span>
                        </button>
                      )}
                      <button
                        onClick={() => setCertificateBatch(b)}
                        className="p-1 rounded bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface"
                        title="Generate Certificate of Conformance"
                      >
                        <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Footer Meta */}
        <div className="px-space-md py-space-xs bg-surface-container-lowest flex items-center justify-between text-label-sm font-mono text-outline border-t border-surface-container-high">
          <div className="flex items-center gap-space-md">
            <span>ENFORCEMENT: STRICT QUALITY GATE</span>
            <span>AUTOMATED BLOCK ON &gt;0.65% DEFECT</span>
          </div>
          <div>SHOWING {filteredBatches.length} QUEUED BATCHES</div>
        </div>
      </div>

      {/* Sign-Off Drawer Modal (21 CFR Part 11 Electronic Signature) */}
      {activeDrawerBatch && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-xl h-full bg-surface-container-low border-l border-surface-container-high shadow-2xl flex flex-col justify-between overflow-y-auto">
            {/* Drawer Header */}
            <div className="px-space-lg py-space-md bg-surface-container-lowest flex items-center justify-between border-b border-surface-container-high">
              <div className="flex items-center gap-space-sm">
                <div className="p-1.5 rounded bg-primary-container text-on-primary-container">
                  <span className="material-symbols-outlined text-[20px]">fingerprint</span>
                </div>
                <div>
                  <h2 className="font-headline text-headline-md font-bold text-on-surface">
                    21 CFR Part 11 Lot Sign-Off
                  </h2>
                  <span className="text-label-sm font-mono text-primary font-semibold">
                    AUTHORIZED PERSONNEL MANDATE
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveDrawerBatch(null)}
                className="p-1.5 rounded bg-surface-container-high hover:bg-surface-variant text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Drawer Content */}
            <form onSubmit={handleExecuteRelease} className="p-space-lg flex flex-col gap-space-md flex-1">
              {/* Target Lot Summary */}
              <div className="p-space-md rounded bg-surface-container border border-surface-container-high">
                <div className="flex items-center justify-between mb-space-xs">
                  <span className="text-label-sm font-mono text-outline">BATCH IDENTIFIER</span>
                  <span className="text-label-sm font-mono px-2 py-0.5 rounded bg-secondary/15 text-secondary">
                    AQL VERIFIED
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-headline text-headline-md font-bold font-mono text-primary">
                    #{activeDrawerBatch.id}
                  </span>
                  <span className="font-mono text-body-md text-on-surface-variant">
                    {activeDrawerBatch.units.toLocaleString()} units
                  </span>
                </div>
                <div className="text-body-md text-on-surface mt-1">{activeDrawerBatch.productName}</div>
              </div>

              {/* Meaning of Signature Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-label-sm font-mono uppercase text-outline">
                  Meaning of Signature (Mandatory Selection)
                </label>
                <select
                  value={signatureMeaning}
                  onChange={(e) => setSignatureMeaning(e.target.value)}
                  className="w-full bg-surface-container-lowest text-on-surface rounded p-space-sm text-body-md border border-surface-container-high outline-none focus:border-primary"
                >
                  <option value="verify_all">
                    I verify this batch meets all quality specifications and IPC-A-610 Class 3 requirements.
                  </option>
                  <option value="verify_release">
                    I authorize immediate manufacturing line departure and shipping release.
                  </option>
                  <option value="verify_waiver">
                    I approve conditional release under signed engineering variance #ENG-VR-90.
                  </option>
                </select>
                <p className="text-body-sm text-outline mt-0.5">
                  Legally equivalent to a handwritten signature under FDA &amp; ISO audit mandates.
                </p>
              </div>

              {/* Electronic Identity Verification */}
              <div className="grid grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-1">
                  <label className="text-label-sm font-mono uppercase text-outline">Signer Credential</label>
                  <input
                    type="text"
                    readOnly
                    value={`${user?.name || 'S. Godikat'} (${user?.role || 'Lead QA'})`}
                    className="bg-surface-container-lowest text-on-surface-variant rounded p-space-sm font-mono text-body-md border border-surface-container-high cursor-not-allowed"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-label-sm font-mono uppercase text-outline">Station / Terminal</label>
                  <input
                    type="text"
                    readOnly
                    value="STATION-04 // CAM-A"
                    className="bg-surface-container-lowest text-on-surface-variant rounded p-space-sm font-mono text-body-md border border-surface-container-high cursor-not-allowed"
                  />
                </div>
              </div>

              {/* PIN Entry */}
              <div className="flex flex-col gap-1">
                <label className="text-label-sm font-mono uppercase text-outline">
                  Quality Passcode / 6-Digit PIN
                </label>
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
              </div>

              {/* Checkbox confirmation */}
              <label className="flex items-start gap-2 p-space-sm rounded bg-surface-container cursor-pointer border border-surface-container-high">
                <input type="checkbox" required className="accent-primary rounded w-4 h-4 mt-0.5" />
                <span className="text-body-sm text-on-surface-variant">
                  I understand this electronic signature is legally binding, immutable, and will be stamped with a cryptographic SHA-256 seal.
                </span>
              </label>

              {/* Footer Buttons */}
              <div className="mt-auto pt-space-md border-t border-surface-container-high flex items-center justify-end gap-space-sm">
                <button
                  type="button"
                  onClick={() => setActiveDrawerBatch(null)}
                  className="px-space-md py-2 rounded bg-surface-container text-outline hover:text-on-surface font-mono text-body-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSignature}
                  className="px-space-lg py-2 rounded bg-primary-container hover:bg-secondary-container text-on-primary-container font-headline font-bold text-body-md transition-all shadow-md flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>{isSubmittingSignature ? 'Signing Hash...' : 'Authorize Electronic Release'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Certificate of Conformance Modal */}
      {certificateBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-surface-container-low border border-surface-container-high rounded-xl p-space-xl shadow-2xl flex flex-col gap-space-lg">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">workspace_premium</span>
                <h3 className="font-headline text-headline-lg font-bold text-on-surface">
                  Certificate of Quality Conformance
                </h3>
              </div>
              <button
                onClick={() => setCertificateBatch(null)}
                className="p-1 rounded text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="bg-surface-container-lowest p-space-lg rounded border border-surface-container-high flex flex-col gap-space-md font-mono text-body-sm">
              <div className="flex justify-between border-b border-surface-container pb-2">
                <span className="text-outline">CERTIFICATE SERIAL:</span>
                <span className="text-primary font-bold">CERT-2026-QA-{certificateBatch.id.replace('BATCH-', '')}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-outline block text-[10px]">PRODUCT SPECIFICATION:</span>
                  <span className="text-on-surface font-semibold">{certificateBatch.productName}</span>
                </div>
                <div>
                  <span className="text-outline block text-[10px]">LOT QUANTITY:</span>
                  <span className="text-on-surface font-semibold">{certificateBatch.units.toLocaleString()} UNITS</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-outline block text-[10px]">STANDARDS COMPLIANCE:</span>
                  <span className="text-secondary font-semibold">IPC-A-610 Class 3 / ISO 9001:2015</span>
                </div>
                <div>
                  <span className="text-outline block text-[10px]">AQL DEFECT DENSITY:</span>
                  <span className="text-secondary font-semibold">{certificateBatch.defectRate}% (SPEC ≤ {certificateBatch.maxDefectSpec}%)</span>
                </div>
              </div>
              <div className="p-2 bg-surface-container rounded text-label-sm border border-outline-variant/30 text-on-surface-variant">
                DIGITAL AUDIT STAMP: {certificateBatch.qaSignOffHash} // SIGNER: {certificateBatch.qaSignOff}
              </div>
            </div>

            <div className="flex items-center justify-end gap-space-sm">
              <button
                onClick={() => setCertificateBatch(null)}
                className="px-space-md py-2 rounded bg-surface-container text-outline hover:text-on-surface"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-space-md py-2 rounded bg-primary-container text-on-primary-container font-bold hover:bg-secondary-container flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                <span>Print Certificate</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
