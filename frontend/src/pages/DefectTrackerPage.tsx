import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface DefectItem {
  id: string;
  ref: string;
  category: string;
  description: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'COSMETIC';
  station: string;
  status: 'Under Invest.' | 'CAPA Initiated' | 'Supplier Adv.' | 'Closed';
  timestamp: string;
  x: number;
  y: number;
  voidVol?: string;
  confidence: number;
  assignee: string;
}

const initialDefects: DefectItem[] = [
  {
    id: 'DEF-9042',
    ref: 'U14-IC',
    category: 'Solder Void (>20%)',
    description: 'Bridge Solder / Void >25%',
    severity: 'CRITICAL',
    station: 'SMT-L2/Opt-03',
    status: 'Under Invest.',
    timestamp: '14:22:08 UTC',
    x: 142.40,
    y: 88.12,
    voidVol: '27.8% (>25% Spec)',
    confidence: 99.1,
    assignee: 'S. Godikat (Lead)',
  },
  {
    id: 'DEF-9041',
    ref: 'C204',
    category: 'Component Misalignment',
    description: 'Misalignment: Rot 4.2°',
    severity: 'MAJOR',
    station: 'SMT-L1/Pick-01',
    status: 'CAPA Initiated',
    timestamp: '14:18:55 UTC',
    x: 82.15,
    y: 114.60,
    voidVol: 'N/A (Geometric)',
    confidence: 97.4,
    assignee: 'M. Richter (SMT Lead)',
  },
  {
    id: 'DEF-9040',
    ref: 'L12-IND',
    category: 'Substrate Delamination',
    description: 'Thermal Stress Delam',
    severity: 'CRITICAL',
    station: 'SMT-L2/Oven-02',
    status: 'Supplier Adv.',
    timestamp: '14:02:11 UTC',
    x: 210.80,
    y: 45.30,
    voidVol: '34.2% delam area',
    confidence: 98.8,
    assignee: 'E. Vance (Quality Arch)',
  },
  {
    id: 'DEF-9039',
    ref: 'R108-SMD',
    category: 'Component Misalignment',
    description: 'Tombstone Phenomenon',
    severity: 'MAJOR',
    station: 'SMT-L4/Opt-01',
    status: 'Closed',
    timestamp: '13:45:19 UTC',
    x: 64.12,
    y: 198.40,
    voidVol: 'N/A',
    confidence: 96.2,
    assignee: 'S. Godikat (Lead)',
  },
  {
    id: 'DEF-9038',
    ref: 'TP-09 GND',
    category: 'Trace Short Circuit',
    description: 'Trace Solder Flake Short',
    severity: 'CRITICAL',
    station: 'SMT-L2/Opt-03',
    status: 'Under Invest.',
    timestamp: '13:12:44 UTC',
    x: 178.50,
    y: 92.10,
    voidVol: '0.12mm bridge width',
    confidence: 99.6,
    assignee: 'M. Richter (SMT Lead)',
  },
  {
    id: 'DEF-9037',
    ref: 'Q02-FET',
    category: 'Surface Contamination',
    description: 'Excess Flux Residue',
    severity: 'COSMETIC',
    station: 'SMT-L1/Wash-01',
    status: 'Closed',
    timestamp: '12:58:02 UTC',
    x: 95.00,
    y: 160.20,
    voidVol: 'Non-conductive',
    confidence: 94.0,
    assignee: 'D. Rao (Inspector)',
  },
];

export const DefectTrackerPage: React.FC = () => {
  const { user } = useAuth();
  const [defects, setDefects] = useState<DefectItem[]>(initialDefects);
  const [selectedDefectId, setSelectedDefectId] = useState<string>('DEF-9042');
  const [query, setQuery] = useState('severity:CRITICAL status:OPEN line:04');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // CAPA Tasks state
  const [capaTasks, setCapaTasks] = useState([
    { id: 1, text: 'Solder paste stencil aperture inspection (SMT-L2)', done: true },
    { id: 2, text: 'Nitrogen reflow peak temp telemetry cross-check (245°C)', done: true },
    { id: 3, text: 'Supplier lot advisory notice: Solder alloy void variance', done: false },
    { id: 4, text: 'Re-calibration pass on optical camera focal plane', done: false },
  ]);

  // New Defect Form State
  const [newDefect, setNewDefect] = useState({
    ref: '',
    category: 'Solder Void (>20%)',
    description: '',
    severity: 'MAJOR' as 'CRITICAL' | 'MAJOR' | 'MINOR' | 'COSMETIC',
    station: 'SMT-L2/Opt-03',
  });

  const selectedDefect = defects.find((d) => d.id === selectedDefectId) || defects[0];

  const toggleTask = (id: number) => {
    setCapaTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  };

  const handleLogDefect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDefect.ref || !newDefect.description) return;
    const newId = `DEF-${Math.floor(1000 + Math.random() * 9000)}`;
    const created: DefectItem = {
      id: newId,
      ref: newDefect.ref,
      category: newDefect.category,
      description: newDefect.description,
      severity: newDefect.severity,
      station: newDefect.station,
      status: 'Under Invest.',
      timestamp: 'Just now',
      x: Number((100 + Math.random() * 150).toFixed(2)),
      y: Number((50 + Math.random() * 120).toFixed(2)),
      voidVol: 'Under measurement',
      confidence: 98.2,
      assignee: user?.name ? `${user.name} (QA)` : 'S. Godikat (Lead)',
    };
    setDefects([created, ...defects]);
    setSelectedDefectId(newId);
    setIsLogModalOpen(false);
    setNewDefect({
      ref: '',
      category: 'Solder Void (>20%)',
      description: '',
      severity: 'MAJOR',
      station: 'SMT-L2/Opt-03',
    });
  };

  const handleResolveDefect = () => {
    setDefects((prev) =>
      prev.map((d) => (d.id === selectedDefectId ? { ...d, status: 'Closed' } : d))
    );
  };

  // Filter defects
  const filteredDefects = defects.filter((d) => {
    if (categoryFilter !== 'All' && d.category !== categoryFilter) return false;
    if (assigneeFilter !== 'All' && !d.assignee.includes(assigneeFilter)) return false;
    if (query) {
      const qLower = query.toLowerCase();
      if (qLower.includes('critical') && d.severity !== 'CRITICAL') return false;
      if (qLower.includes('major') && d.severity !== 'MAJOR') return false;
    }
    return true;
  });

  const criticalCount = defects.filter((d) => d.severity === 'CRITICAL').length;
  const majorCount = defects.filter((d) => d.severity === 'MAJOR').length;
  const minorCount = defects.filter((d) => d.severity === 'MINOR').length;
  const cosmeticCount = defects.filter((d) => d.severity === 'COSMETIC').length;
  const doneTasksCount = capaTasks.filter((t) => t.done).length;

  return (
    <div className="w-full min-h-screen p-margin bg-background flex flex-col gap-space-lg select-none">
      {/* Top Command & Severity Ribbon Bar */}
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-space-md p-space-md bg-surface-container-low rounded-xl border border-surface-container-high shadow-md">
        <div className="flex flex-wrap items-center gap-space-md">
          <div className="flex items-center gap-space-xs">
            <span className="font-headline text-headline-md font-semibold tracking-tight text-on-surface">
              Defect Registry
            </span>
            <span className="text-label-sm font-mono px-2 py-0.5 rounded bg-surface-container-highest text-primary border border-primary-container/30">
              BATCH #LOT-2026-904
            </span>
          </div>

          <div className="h-5 w-px bg-surface-container-high hidden lg:block"></div>

          {/* Severity Pills Ribbon */}
          <div className="flex items-center gap-space-xs flex-wrap">
            <div className="flex items-center gap-1.5 px-space-sm py-1 rounded-full bg-error-container/30 text-error font-mono text-label-sm border border-error/30">
              <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
              <span className="font-bold">CRITICAL: {String(criticalCount).padStart(2, '0')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-space-sm py-1 rounded-full bg-primary-container/25 text-primary font-mono text-label-sm border border-primary/30">
              <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
              <span className="font-bold">MAJOR: {String(majorCount).padStart(2, '0')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-space-sm py-1 rounded-full bg-secondary-container/20 text-secondary font-mono text-label-sm border border-secondary/30">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              <span className="font-semibold">MINOR: {String(minorCount).padStart(2, '0')}</span>
            </div>
            <div className="flex items-center gap-1.5 px-space-sm py-1 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-label-sm border border-outline-variant/30">
              <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
              <span>COSMETIC: {String(cosmeticCount).padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        {/* Quick Stats Telemetry Spark */}
        <div className="flex items-center gap-space-lg self-end xl:self-auto text-on-surface-variant font-mono text-label-sm">
          <div className="flex items-center gap-2">
            <span>YIELD DRIFT:</span>
            <span className="text-error font-semibold">-0.42%</span>
            <svg className="w-16 h-4 text-error" fill="none" viewBox="0 0 64 16">
              <path
                d="M1 4 L14 5 L28 2 L42 9 L54 13 L63 15"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.5"
              />
            </svg>
          </div>
          <div className="h-4 w-px bg-surface-container-high"></div>
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-tertiary">speed</span>
            <span>MTTR: 18.4m</span>
          </div>
        </div>
      </div>

      {/* Industrial Query Builder & Action Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-sm p-space-md bg-surface-container-lowest rounded-xl border border-surface-container-high shadow-sm">
        {/* Monospace Query Builder Input */}
        <div className="lg:col-span-6 flex items-center bg-surface-container-high rounded px-space-sm border border-outline-variant/30">
          <span className="material-symbols-outlined text-outline text-[18px] mr-2">terminal</span>
          <input
            className="w-full bg-transparent font-mono text-body-md text-on-surface focus:outline-none placeholder:text-outline py-1.5"
            id="queryInput"
            placeholder="Query: attr:value AND id:..."
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="px-2 py-0.5 text-label-sm font-mono text-outline hover:text-primary transition-colors"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Category Dropdown Filter */}
        <div className="lg:col-span-2 relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full h-full bg-surface-container-high text-on-surface font-mono text-label-md px-space-sm py-1.5 rounded appearance-none cursor-pointer focus:outline-none border border-outline-variant/30"
          >
            <option value="All">All Categories</option>
            <option value="Solder Void (>20%)">Solder Void (&gt;20%)</option>
            <option value="Component Misalignment">Component Misalignment</option>
            <option value="Surface Contamination">Surface Contamination</option>
            <option value="Substrate Delamination">Substrate Delamination</option>
            <option value="Trace Short Circuit">Trace Short Circuit</option>
          </select>
          <span className="material-symbols-outlined text-outline absolute right-2 top-2 text-[16px] pointer-events-none">
            expand_more
          </span>
        </div>

        {/* Assignee Filter */}
        <div className="lg:col-span-2 relative">
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="w-full h-full bg-surface-container-high text-on-surface font-mono text-label-md px-space-sm py-1.5 rounded appearance-none cursor-pointer focus:outline-none border border-outline-variant/30"
          >
            <option value="All">Assignee: All Leads</option>
            <option value="Godikat">S. Godikat (Station 04)</option>
            <option value="Richter">M. Richter (SMT Lead)</option>
            <option value="Vance">E. Vance (Quality Arch)</option>
          </select>
          <span className="material-symbols-outlined text-outline absolute right-2 top-2 text-[16px] pointer-events-none">
            filter_alt
          </span>
        </div>

        {/* Primary Action Button */}
        <div className="lg:col-span-2 flex items-center">
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="w-full flex items-center justify-center gap-space-xs px-space-md py-1.5 bg-primary-container hover:bg-secondary-container text-on-primary-container font-headline text-label-md font-bold rounded transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>+ LOG NEW DEFECT</span>
          </button>
        </div>
      </div>

      {/* Primary Split-Screen Diagnostic Console */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-space-lg items-start">
        {/* Left Defect Monospace Data Registry (7 cols) */}
        <div className="xl:col-span-7 flex flex-col bg-surface-container-lowest rounded-xl overflow-hidden shadow-md border border-surface-container-high">
          {/* Data Table Controls Bar */}
          <div className="flex items-center justify-between px-space-md py-space-sm bg-surface-container-low border-b border-surface-container-high">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-tertiary text-[18px]">view_timeline</span>
              <span className="font-mono text-label-md font-semibold text-on-surface tracking-wider uppercase">
                TELEMETRY STREAM // RECENT TELEMETRIC LOGS
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-label-sm text-outline">AUTO-REFRESH: 2s</span>
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
            </div>
          </div>

          {/* Monospace Tabular Feed */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-body-sm text-on-surface">
              <thead className="bg-surface-container text-label-sm text-outline uppercase tracking-wider border-b border-surface-container-high">
                <tr>
                  <th className="py-2.5 px-space-sm font-semibold">DEFECT ID</th>
                  <th className="py-2.5 px-space-sm font-semibold">TIMESTAMP</th>
                  <th className="py-2.5 px-space-sm font-semibold">REF // TYPE</th>
                  <th className="py-2.5 px-space-sm font-semibold">SEVERITY</th>
                  <th className="py-2.5 px-space-sm font-semibold">STATION</th>
                  <th className="py-2.5 px-space-sm font-semibold">STATUS</th>
                  <th className="py-2.5 px-space-sm font-semibold text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/30">
                {filteredDefects.map((d) => {
                  const isSelected = d.id === selectedDefectId;
                  return (
                    <tr
                      key={d.id}
                      onClick={() => setSelectedDefectId(d.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-surface-container-high border-l-2 border-primary'
                          : 'hover:bg-surface-container bg-surface-container-lowest'
                      }`}
                    >
                      <td className="py-2 px-space-sm font-bold text-primary flex items-center gap-1.5 whitespace-nowrap">
                        {isSelected ? (
                          <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                        ) : (
                          <span className="w-3.5 inline-block"></span>
                        )}
                        <span>#{d.id}</span>
                      </td>
                      <td className="py-2 px-space-sm text-on-surface-variant whitespace-nowrap">
                        {d.timestamp}
                      </td>
                      <td className="py-2 px-space-sm whitespace-nowrap">
                        <div className="font-bold text-on-surface">{d.ref}</div>
                        <div className="text-[10px] text-outline">{d.description}</div>
                      </td>
                      <td className="py-2 px-space-sm whitespace-nowrap">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            d.severity === 'CRITICAL'
                              ? 'bg-error-container/40 text-error'
                              : d.severity === 'MAJOR'
                              ? 'bg-primary-container/30 text-primary'
                              : d.severity === 'MINOR'
                              ? 'bg-secondary-container/20 text-secondary'
                              : 'bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          {d.severity}
                        </span>
                      </td>
                      <td className="py-2 px-space-sm text-on-surface-variant whitespace-nowrap">
                        {d.station}
                      </td>
                      <td className="py-2 px-space-sm whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            d.status === 'Closed'
                              ? 'bg-surface-container-highest text-on-surface-variant'
                              : d.status === 'CAPA Initiated'
                              ? 'bg-tertiary-container/20 text-tertiary'
                              : 'bg-primary-container/20 text-primary'
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="py-2 px-space-sm text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDefectId(d.id);
                          }}
                          className="px-2 py-0.5 text-[10px] bg-surface-container-highest hover:bg-primary hover:text-on-primary rounded font-semibold text-on-surface transition-colors"
                        >
                          CAPA
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pager / Status Footnote */}
          <div className="flex items-center justify-between px-space-md py-space-xs bg-surface-container-low font-mono text-label-sm text-outline border-t border-surface-container-high">
            <div>
              SHOWING {filteredDefects.length} OF {defects.length} DEFECT ENTRIES (FILTERED)
            </div>
            <div className="flex items-center gap-2">
              <span className="text-primary font-bold">LIVE TELEMETRY STREAM</span>
            </div>
          </div>
        </div>

        {/* Right Root Cause Analysis & Deep Inspection Panel (5 cols) */}
        <div className="xl:col-span-5 flex flex-col gap-space-md bg-surface-container-lowest p-space-md rounded-xl shadow-lg border border-surface-container-high">
          {/* Panel Header with Identification */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-headline text-headline-md font-bold text-on-surface font-mono">
                  #{selectedDefect.id}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-label-sm font-mono font-bold ${
                    selectedDefect.severity === 'CRITICAL'
                      ? 'bg-error-container text-error'
                      : 'bg-primary-container text-on-primary-container'
                  }`}
                >
                  {selectedDefect.severity} SEVERITY
                </span>
              </div>
              <span className="font-mono text-label-sm text-on-surface-variant">
                Ref: IC BGA Pin Array // COMPONENT REF: {selectedDefect.ref}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="p-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
                title="Export Diagnostic Package"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
              <button
                className="p-1.5 rounded bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
                title="Print Trace Label"
              >
                <span className="material-symbols-outlined text-[18px]">print</span>
              </button>
            </div>
          </div>

          {/* Microscopic Visual Inspection Capture & Coordinate Matrix */}
          <div className="relative bg-surface-container-low rounded-lg overflow-hidden group border border-surface-container-high">
            <img
              className="w-full h-52 object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
              alt="High magnification industrial optical micrograph"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCn8RCJcHPl_IHMq56CWdV0UnVnv49vWax7dUBgICpRHy6WgMIN-zRjBEyd0jOMRNJ74kzlURlID9mD3YagPAnLni5gg0h-H8Iyc-zrZbNuRDxFtyAybW6D4erg5nVNF3QWxSz2B_ziFkA1RWeqsI4XD-xbP18YCaBuvg696p3B_plNQy_of0yEBTTpa9qxqVvhW23t7UZHJxBGGBjZVSJS-qypg8Cp_0DZRc5yXTfhUrei9qdesg6DSQ"
            />
            {/* Optical Overlay Grid Reticle HUD */}
            <div className="absolute inset-0 pointer-events-none p-space-sm flex flex-col justify-between">
              <div className="flex items-center justify-between font-mono text-[10px] text-tertiary bg-surface-container-lowest/80 px-2 py-1 rounded backdrop-blur-sm self-start border border-tertiary/20">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-error animate-ping"></span>
                  TARGET RETICLE: {selectedDefect.x}mm / {selectedDefect.y}mm
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="font-mono text-label-sm px-2 py-0.5 rounded bg-surface-container-lowest/80 text-primary flex items-center gap-1 backdrop-blur-sm border border-primary/20">
                  <span className="material-symbols-outlined text-[14px]">psychology</span>
                  <span>AI CONFIDENCE: {selectedDefect.confidence}% (Optical Match)</span>
                </div>
                <div className="font-mono text-[10px] text-outline px-1.5 py-0.5 rounded bg-surface-container-lowest/80 backdrop-blur-sm">
                  FOV: 4.8 x 3.6mm
                </div>
              </div>
            </div>
            {/* Crosshair SVG Marker centered on anomaly */}
            <div className="absolute top-[48%] left-[54%] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div
                className="w-12 h-12 rounded-full border-2 border-dashed border-error animate-spin"
                style={{ animationDuration: '10s' }}
              ></div>
              <div className="w-2 h-2 rounded-full bg-error absolute inset-0 m-auto"></div>
            </div>
          </div>

          {/* Coordinates & Defect Vector Breakdown */}
          <div className="grid grid-cols-3 gap-2 bg-surface-container-low p-space-sm rounded font-mono text-label-sm border border-surface-container-high">
            <div className="flex flex-col">
              <span className="text-outline">X/Y SPATIAL</span>
              <span className="text-on-surface font-semibold">
                {selectedDefect.x}, {selectedDefect.y}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-outline">VOID VOL</span>
              <span className="text-error font-semibold">{selectedDefect.voidVol || '18.4%'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-outline">OPERATOR</span>
              <span className="text-on-surface font-semibold">{selectedDefect.assignee}</span>
            </div>
          </div>

          {/* Root Cause Analysis & CAPA Checklist */}
          <div className="flex flex-col gap-space-xs bg-surface-container-low p-space-sm rounded border border-surface-container-high">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1 font-mono text-label-md font-bold text-on-surface uppercase tracking-wide">
                <span className="material-symbols-outlined text-primary text-[18px]">rule</span>
                <span>CAPA Action Plan (Root Cause Remediation)</span>
              </div>
              <span className="font-mono text-label-sm text-primary font-bold">
                {doneTasksCount}/{capaTasks.length} DONE
              </span>
            </div>

            {/* Interactive Checklist Items */}
            <div className="flex flex-col gap-1.5 font-body-sm text-on-surface">
              {capaTasks.map((t) => (
                <label
                  key={t.id}
                  onClick={() => toggleTask(t.id)}
                  className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                    t.done
                      ? 'bg-surface-container-highest text-outline line-through'
                      : 'bg-surface-container-high text-primary font-semibold hover:bg-surface-container'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => {}}
                    className="accent-primary rounded w-4 h-4 cursor-pointer"
                  />
                  <span className="font-mono">{t.text}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Chronological Audit Trail & Technician Signatures */}
          <div className="flex flex-col gap-space-xs bg-surface-container-low p-space-sm rounded border border-surface-container-high">
            <span className="font-mono text-label-sm font-semibold uppercase tracking-wider text-outline">
              Audit Event Log // Digital Signatures
            </span>
            <div className="flex flex-col gap-2 font-mono text-[11px] text-on-surface-variant">
              <div className="flex items-start gap-2">
                <span className="text-tertiary">14:22:08</span>
                <div className="flex-1">
                  <span className="text-on-surface font-semibold">Automated AOI Station 03</span> triggered #{selectedDefect.id} anomaly threshold.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-tertiary">14:25:31</span>
                <div className="flex-1">
                  <span className="text-on-surface font-semibold">S. Godikat (Lead QA)</span> validated void parameter; escalated to CRITICAL.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-primary">14:38:00</span>
                <div className="flex-1">
                  <span className="text-on-surface font-semibold">CAPA Task Initiated</span> by Systems Engine (Root: Profile Zone 4 soak dwell).
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Control Actions */}
          <div className="grid grid-cols-3 gap-2 pt-space-xs">
            <button
              onClick={() => setQuery(`id:${selectedDefect.id} severity:${selectedDefect.severity}`)}
              className="py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-mono text-label-sm font-bold rounded transition-colors text-center border border-surface-container-high"
            >
              INVESTIGATE
            </button>
            <button
              onClick={() => alert(`CAPA task assigned for defect #${selectedDefect.id}`)}
              className="py-2 bg-surface-container-high hover:bg-surface-container-highest text-primary font-mono text-label-sm font-bold rounded transition-colors text-center border border-primary/20"
            >
              ASSIGN CAPA
            </button>
            <button
              onClick={handleResolveDefect}
              className="py-2 bg-primary-container hover:bg-secondary-container text-on-primary-container font-mono text-label-sm font-bold rounded transition-colors text-center shadow-sm"
            >
              MARK RESOLVED
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Context Row: Factory Floor Defect Density Mini-Visualizer */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md bg-surface-container-lowest p-space-md rounded-xl border border-surface-container-high">
        <div className="flex items-center gap-space-md">
          <div className="p-space-sm bg-surface-container-high rounded text-primary">
            <span className="material-symbols-outlined text-[24px]">precision_manufacturing</span>
          </div>
          <div>
            <div className="font-mono text-label-sm text-outline">STATION RUN RATE</div>
            <div className="font-mono text-body-lg font-bold text-on-surface">324 Units / Hr</div>
            <div className="font-mono text-[10px] text-tertiary">Line 04 Running @ 98.2% Nominal</div>
          </div>
        </div>
        <div className="flex items-center gap-space-md">
          <div className="p-space-sm bg-surface-container-high rounded text-error">
            <span className="material-symbols-outlined text-[24px]">warning</span>
          </div>
          <div>
            <div className="font-mono text-label-sm text-outline">CRITICAL ESCALATION WINDOW</div>
            <div className="font-mono text-body-lg font-bold text-error">&lt; 15 Mins Active</div>
            <div className="font-mono text-[10px] text-outline">Automated halt warning if 2 more fail</div>
          </div>
        </div>
        <div className="flex items-center gap-space-md">
          <div className="p-space-sm bg-surface-container-high rounded text-tertiary">
            <span className="material-symbols-outlined text-[24px]">verified_user</span>
          </div>
          <div>
            <div className="font-mono text-label-sm text-outline">LOT INTEGRITY SCORE</div>
            <div className="font-mono text-body-lg font-bold text-on-surface">97.88% IPC-A-610-H</div>
            <div className="font-mono text-[10px] text-outline">Class 3 High-Reliability Target</div>
          </div>
        </div>
      </div>

      {/* Modal: Log New Defect */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface-container-low border border-surface-container-high rounded-xl p-space-lg shadow-2xl flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">add_alert</span>
                <h3 className="font-headline text-headline-md font-bold text-on-surface">
                  Log Defect Telemetry Anomaly
                </h3>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="p-1 rounded text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleLogDefect} className="flex flex-col gap-space-md font-mono text-body-sm">
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-outline uppercase">Component Reference ID</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. U14-IC, C204, PIN-12"
                  value={newDefect.ref}
                  onChange={(e) => setNewDefect({ ...newDefect, ref: e.target.value })}
                  className="bg-surface-container-lowest text-on-surface px-space-sm py-2 rounded border border-surface-container-high outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-1">
                  <label className="text-label-sm text-outline uppercase">Severity Level</label>
                  <select
                    value={newDefect.severity}
                    onChange={(e) =>
                      setNewDefect({
                        ...newDefect,
                        severity: e.target.value as 'CRITICAL' | 'MAJOR' | 'MINOR' | 'COSMETIC',
                      })
                    }
                    className="bg-surface-container-lowest text-on-surface px-space-sm py-2 rounded border border-surface-container-high outline-none"
                  >
                    <option value="CRITICAL">CRITICAL</option>
                    <option value="MAJOR">MAJOR</option>
                    <option value="MINOR">MINOR</option>
                    <option value="COSMETIC">COSMETIC</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-label-sm text-outline uppercase">Inspection Station</label>
                  <select
                    value={newDefect.station}
                    onChange={(e) => setNewDefect({ ...newDefect, station: e.target.value })}
                    className="bg-surface-container-lowest text-on-surface px-space-sm py-2 rounded border border-surface-container-high outline-none"
                  >
                    <option value="SMT-L2/Opt-03">SMT-L2/Opt-03</option>
                    <option value="SMT-L1/Pick-01">SMT-L1/Pick-01</option>
                    <option value="SMT-L2/Oven-02">SMT-L2/Oven-02</option>
                    <option value="SMT-L4/Opt-01">SMT-L4/Opt-01</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-outline uppercase">Anomaly Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe observed tolerance deviation or optical failure..."
                  value={newDefect.description}
                  onChange={(e) => setNewDefect({ ...newDefect, description: e.target.value })}
                  className="bg-surface-container-lowest text-on-surface px-space-sm py-2 rounded border border-surface-container-high outline-none focus:border-primary"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-space-sm pt-space-xs">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-space-md py-2 rounded bg-surface-container text-outline hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-space-md py-2 rounded bg-primary-container text-on-primary-container font-bold hover:bg-secondary-container"
                >
                  Commit Defect to Registry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
