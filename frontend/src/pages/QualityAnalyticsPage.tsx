import React, { useState, useEffect } from 'react';

interface DefectTelemetryRow {
  timestamp: string;
  station: string;
  defect: string;
  coord: string;
  severity: string;
  action: string;
}

const initialTelemetryFeed: DefectTelemetryRow[] = [
  {
    timestamp: '13:48:02.120',
    station: 'LINE-04 // AOI-02',
    defect: 'Solder Bridging (QFP-64 P3-4)',
    coord: 'X: 142.34 Y: 89.12',
    severity: 'CRITICAL REJECT',
    action: 'ROBOTIC REWORK QUEUED',
  },
  {
    timestamp: '13:46:19.880',
    station: 'LINE-01 // SPI-01',
    defect: 'Paste Height Drift (-12µm)',
    coord: 'X: 84.10 Y: 112.44',
    severity: 'TOLERANCE WARN',
    action: 'AUTOCORRECT STENCIL',
  },
  {
    timestamp: '13:42:55.040',
    station: 'LINE-04 // AOI-03',
    defect: 'Missing Passive Cap 0402',
    coord: 'X: 198.02 Y: 43.18',
    severity: 'MAJOR DEFECT',
    action: 'DISPATCH FEEDER CHECK',
  },
  {
    timestamp: '13:38:11.490',
    station: 'LINE-02 // XRAY-01',
    defect: 'BGA Voiding Ratio 16.4%',
    coord: 'X: 112.50 Y: 78.90',
    severity: 'ACCEPTABLE MARGIN',
    action: 'LOGGED TO TRACE',
  },
];

export const QualityAnalyticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'30 SHIFTS' | '7 DAYS' | '24 HOURS'>('30 SHIFTS');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [telemetryFeed, setTelemetryFeed] = useState<DefectTelemetryRow[]>(initialTelemetryFeed);
  const [isMicroscopyOpen, setIsMicroscopyOpen] = useState(false);

  // Auto-streaming feed simulation (updates every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
        .getMinutes()
        .toString()
        .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${Math.floor(
        Math.random() * 900 + 100
      )}`;
      const defectsPool = [
        { d: 'Component Rotation Drift (+1.2°)', s: 'LINE-01 // AOI-01', sev: 'TOLERANCE WARN', a: 'FEEDER NOZZLE CLEAN' },
        { d: 'Solder Ball Anomaly (Q3)', s: 'LINE-04 // AOI-02', sev: 'CRITICAL REJECT', a: 'ROBOTIC REWORK QUEUED' },
        { d: 'Flux Residue Margins', s: 'LINE-02 // WASH-01', sev: 'ACCEPTABLE MARGIN', a: 'LOGGED TO TRACE' },
      ];
      const pick = defectsPool[Math.floor(Math.random() * defectsPool.length)];
      const newRow: DefectTelemetryRow = {
        timestamp: timeStr,
        station: pick.s,
        defect: pick.d,
        coord: `X: ${(100 + Math.random() * 120).toFixed(2)} Y: ${(40 + Math.random() * 80).toFixed(2)}`,
        severity: pick.sev,
        action: pick.a,
      };
      setTelemetryFeed((prev) => [newRow, ...prev.slice(0, 5)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full min-h-screen p-margin bg-background flex flex-col gap-space-lg select-none pb-12">
      {/* Page Header Sub-bar & Time Context */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-md">
        <div className="flex flex-col gap-space-xs">
          <div className="flex items-center gap-space-sm text-outline">
            <span className="text-label-sm uppercase tracking-widest font-mono text-primary font-bold">
              TELEMETRY // SPC NODE
            </span>
            <span className="text-surface-container-high">•</span>
            <span className="text-label-sm font-mono text-on-surface-variant">SMT-MODULE-A9</span>
            <span className="text-surface-container-high">•</span>
            <span className="text-label-sm font-mono text-tertiary">CALIBRATION ISO/IEC 17025</span>
          </div>
          <div className="flex items-baseline gap-space-md">
            <h1 className="font-headline text-headline-lg text-on-surface tracking-tight font-bold">
              Quality Analytics &amp; SPC Telemetry
            </h1>
            <span className="text-label-sm text-on-surface-variant font-mono bg-surface-container px-space-sm py-0.5 rounded border border-surface-container-high">
              SHIFT B • 06:00-14:00
            </span>
          </div>
        </div>

        {/* Quick Action Control Bar */}
        <div className="flex items-center gap-space-sm flex-wrap">
          <div className="flex items-center bg-surface-container-low p-1 rounded-lg gap-1 border border-surface-container-high">
            {(['30 SHIFTS', '7 DAYS', '24 HOURS'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-space-md py-1 rounded text-label-md font-mono transition-colors ${
                  timeRange === range
                    ? 'bg-surface-container-high text-primary shadow-sm font-bold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-space-xs px-space-md py-1.5 rounded bg-primary-container text-on-primary-container text-label-md font-semibold hover:bg-secondary-container transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            <span>EXPORT / AUDIT</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        {/* Metric 1: OEY */}
        <div className="flex flex-col justify-between p-space-md bg-surface-container-low rounded-xl relative overflow-hidden border border-surface-container-high shadow-sm group">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-mono uppercase text-outline">OEY (First-Pass Yield)</span>
            <span className="material-symbols-outlined text-primary text-[18px]">verified</span>
          </div>
          <div className="my-space-sm flex items-baseline gap-space-sm">
            <span className="font-headline text-headline-xl text-on-surface font-mono tracking-tight font-semibold">
              98.6%
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-label-sm font-mono text-tertiary bg-tertiary/10 border border-tertiary/20">
              <span className="material-symbols-outlined text-[12px]">trending_up</span>+0.3%
            </span>
          </div>
          <div className="flex items-center justify-between text-body-sm font-body text-on-surface-variant">
            <span>Target: 98.0%</span>
            <span className="font-mono text-tertiary">Δ +6,200 PPM</span>
          </div>
          <div className="mt-space-sm w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-primary-container rounded-full" style={{ width: '98.6%' }}></div>
          </div>
        </div>

        {/* Metric 2: DPMO */}
        <div className="flex flex-col justify-between p-space-md bg-surface-container-low rounded-xl relative overflow-hidden border border-surface-container-high shadow-sm group">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-mono uppercase text-outline">Defect Density (DPMO)</span>
            <span className="material-symbols-outlined text-secondary text-[18px]">query_stats</span>
          </div>
          <div className="my-space-sm flex items-baseline gap-space-sm">
            <span className="font-headline text-headline-xl text-on-surface font-mono tracking-tight font-semibold">
              42.1
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-label-sm font-mono text-tertiary bg-tertiary/10 border border-tertiary/20">
              <span className="material-symbols-outlined text-[12px]">arrow_downward</span>-5.4
            </span>
          </div>
          <div className="flex items-center justify-between text-body-sm font-body text-on-surface-variant">
            <span>Norm: &lt; 50.0</span>
            <span className="font-mono text-on-surface">6-Sigma Grade</span>
          </div>
          <div className="mt-space-sm w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-secondary rounded-full" style={{ width: '42%' }}></div>
          </div>
        </div>

        {/* Metric 3: CPK */}
        <div className="flex flex-col justify-between p-space-md bg-surface-container-low rounded-xl relative overflow-hidden border border-surface-container-high shadow-sm group">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-mono uppercase text-outline">Capability Index (CPK)</span>
            <span className="material-symbols-outlined text-tertiary text-[18px]">analytics</span>
          </div>
          <div className="my-space-sm flex items-baseline gap-space-sm">
            <span className="font-headline text-headline-xl text-on-surface font-mono tracking-tight font-semibold">
              1.67
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-label-sm font-mono text-primary bg-primary/10 border border-primary/20">
              STABLE
            </span>
          </div>
          <div className="flex items-center justify-between text-body-sm font-body text-on-surface-variant">
            <span>Threshold: ≥ 1.33</span>
            <span className="font-mono text-tertiary">High Capable</span>
          </div>
          <div className="mt-space-sm w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-tertiary rounded-full" style={{ width: '83%' }}></div>
          </div>
        </div>

        {/* Metric 4: Latency */}
        <div className="flex flex-col justify-between p-space-md bg-surface-container-low rounded-xl relative overflow-hidden border border-surface-container-high shadow-sm group">
          <div className="flex items-center justify-between">
            <span className="text-label-sm font-mono uppercase text-outline">Mean Detection Latency</span>
            <span className="material-symbols-outlined text-primary text-[18px]">speed</span>
          </div>
          <div className="my-space-sm flex items-baseline gap-space-sm">
            <span className="font-headline text-headline-xl text-on-surface font-mono tracking-tight font-semibold">
              4.2<span className="text-headline-md font-mono ml-1">sec</span>
            </span>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-label-sm font-mono text-tertiary bg-tertiary/10 border border-tertiary/20">
              <span className="material-symbols-outlined text-[12px]">bolt</span>AI OPTICAL
            </span>
          </div>
          <div className="flex items-center justify-between text-body-sm font-body text-on-surface-variant">
            <span>SLA: &lt; 10.0s</span>
            <span className="font-mono text-outline">94.8 FPS AOI</span>
          </div>
          <div className="mt-space-sm w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div className="h-full bg-primary-container rounded-full" style={{ width: '42%' }}></div>
          </div>
        </div>
      </div>

      {/* Primary Engineering Analytics Grid: SPC & Pareto (2 Columns) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* SPC / X-bar R Chart (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col p-space-lg bg-surface-container-low rounded-xl gap-space-md border border-surface-container-high shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-sm">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></div>
              <span className="font-headline text-headline-md text-on-surface font-semibold tracking-tight">
                Statistical Process Control (SPC)
              </span>
            </div>
            <div className="flex items-center gap-space-xs font-mono text-label-sm">
              <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant border border-surface-container-high">
                Solder Paste Thickness (µm)
              </span>
              <span className="px-2 py-0.5 rounded bg-tertiary/15 text-tertiary border border-tertiary/30">
                X̄-BAR STABLE
              </span>
            </div>
          </div>

          {/* SPC Legend / Parameters HUD */}
          <div className="grid grid-cols-3 gap-space-sm py-2 px-space-md bg-surface-container rounded-lg border border-surface-container-high">
            <div className="flex flex-col">
              <span className="text-label-sm font-mono text-error uppercase">UCL (+3σ)</span>
              <span className="text-body-md font-mono text-on-surface font-semibold">155.0 µm</span>
            </div>
            <div className="flex flex-col">
              <span className="text-label-sm font-mono text-tertiary uppercase">Target (Mean X̄)</span>
              <span className="text-body-md font-mono text-on-surface font-semibold">120.0 µm</span>
            </div>
            <div className="flex flex-col">
              <span className="text-label-sm font-mono text-error uppercase">LCL (-3σ)</span>
              <span className="text-body-md font-mono text-on-surface font-semibold">85.0 µm</span>
            </div>
          </div>

          {/* SPC Interactive Vector Chart */}
          <div className="relative w-full h-64 bg-surface-container-lowest rounded-lg p-2 overflow-hidden flex flex-col justify-between border border-surface-container-high">
            <svg
              className="w-full h-full"
              fill="none"
              preserveAspectRatio="none"
              viewBox="0 0 600 220"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Background Grid Ticks */}
              <line stroke="#353534" strokeDasharray="3 3" strokeWidth="1" x1="40" x2="580" y1="20" y2="20"></line>
              <line stroke="#2a2a2a" strokeWidth="1" x1="40" x2="580" y1="70" y2="70"></line>
              <line stroke="#0297e8" strokeDasharray="4 2" strokeOpacity="0.8" strokeWidth="1.5" x1="40" x2="580" y1="120" y2="120"></line>
              <line stroke="#2a2a2a" strokeWidth="1" x1="40" x2="580" y1="170" y2="170"></line>
              <line stroke="#353534" strokeDasharray="3 3" strokeWidth="1" x1="40" x2="580" y1="200" y2="200"></line>

              {/* Normal Distribution Bell curve watermark */}
              <path
                d="M 440 200 C 470 200 490 120 520 120 C 550 120 570 200 590 200"
                fill="none"
                stroke="#ffb77d"
                strokeOpacity="0.15"
                strokeWidth="2"
              ></path>
              <path
                d="M 440 200 C 470 200 490 120 520 120 C 550 120 570 200 590 200 Z"
                fill="#ffb77d"
                fillOpacity="0.03"
              ></path>

              {/* Tolerance Zone Shading */}
              <rect fill="#96ccff" fillOpacity="0.03" height="130" width="540" x="40" y="50"></rect>

              {/* Historical Run Line */}
              <polyline
                fill="none"
                points="50,115 80,118 110,122 140,112 170,126 200,121 230,132 260,119 290,116 320,124 350,128 380,114 410,122 440,118 470,125 500,121 530,117 560,120"
                stroke="#ffb77d"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              ></polyline>

              {/* Limits Text */}
              <text fill="#ffb4ab" fontFamily="IBM Plex Mono" fontSize="9" x="42" y="16">UCL: 155µm</text>
              <text fill="#96ccff" fontFamily="IBM Plex Mono" fontSize="9" x="42" y="116">X̄: 120µm</text>
              <text fill="#ffb4ab" fontFamily="IBM Plex Mono" fontSize="9" x="42" y="196">LCL: 85µm</text>

              {/* Telemetry Coordinate Dots */}
              <circle cx="80" cy="118" fill="#ffb77d" r="3.5"></circle>
              <circle cx="140" cy="112" fill="#ffb77d" r="3.5"></circle>
              <circle cx="200" cy="121" fill="#ffb77d" r="3.5"></circle>
              <circle className="animate-pulse" cx="230" cy="132" fill="#ee9800" r="4"></circle>
              <circle cx="290" cy="116" fill="#ffb77d" r="3.5"></circle>
              <circle cx="350" cy="128" fill="#ffb77d" r="3.5"></circle>
              <circle cx="440" cy="118" fill="#ffb77d" r="3.5"></circle>
              <circle cx="500" cy="121" fill="#ffb77d" r="3.5"></circle>
              <circle cx="560" cy="120" fill="#d97707" r="4.5" stroke="#ffffff" strokeWidth="1.5"></circle>
            </svg>

            {/* Dynamic Real-time Reading Callout in Chart */}
            <div className="absolute bottom-2 right-4 flex items-center gap-2 bg-surface-container-high/90 px-space-sm py-1 rounded text-label-sm font-mono backdrop-blur-sm border border-surface-container-high">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
              <span className="text-on-surface">Subgroup N=25</span>
              <span className="text-primary font-bold">Curr: 120.4 µm</span>
            </div>
          </div>

          {/* Real-time Run Rules Indicator List */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm font-mono text-label-sm pt-space-xs">
            <div className="p-2 bg-surface-container rounded flex items-center justify-between border border-surface-container-high">
              <span className="text-on-surface-variant">Rule 1 (1 pt &gt; 3σ)</span>
              <span className="text-tertiary font-bold">PASS</span>
            </div>
            <div className="p-2 bg-surface-container rounded flex items-center justify-between border border-surface-container-high">
              <span className="text-on-surface-variant">Rule 2 (9 pts same side)</span>
              <span className="text-tertiary font-bold">PASS</span>
            </div>
            <div className="p-2 bg-surface-container rounded flex items-center justify-between border border-surface-container-high">
              <span className="text-on-surface-variant">Rule 3 (6 pts trend)</span>
              <span className="text-tertiary font-bold">PASS</span>
            </div>
            <div className="p-2 bg-surface-container rounded flex items-center justify-between border border-surface-container-high">
              <span className="text-on-surface-variant">Rule 4 (14 pts alternating)</span>
              <span className="text-tertiary font-bold">PASS</span>
            </div>
          </div>
        </div>

        {/* Pareto Analysis Chart (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col p-space-lg bg-surface-container-low rounded-xl gap-space-md justify-between border border-surface-container-high shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">bar_chart</span>
              <span className="font-headline text-headline-md text-on-surface font-semibold tracking-tight">
                Pareto Failure Modes
              </span>
            </div>
            <span className="text-label-sm font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded border border-surface-container-high">
              80/20 RULE
            </span>
          </div>

          {/* Pareto Chart Graphic Area */}
          <div className="relative w-full h-48 bg-surface-container-lowest rounded-lg p-3 border border-surface-container-high">
            <svg className="w-full h-full" fill="none" viewBox="0 0 380 160" xmlns="http://www.w3.org/2000/svg">
              {/* 80% Horizontal Cutoff */}
              <line stroke="#ffb4ab" strokeDasharray="2 2" strokeOpacity="0.6" strokeWidth="1" x1="20" x2="360" y1="44" y2="44"></line>
              <text fill="#ffb4ab" fontFamily="IBM Plex Mono" fontSize="8" x="325" y="40">80% Cutoff</text>

              {/* Bars */}
              <rect fill="#d97707" height="95" rx="1" width="38" x="35" y="47"></rect>
              <rect fill="#ee9800" height="47" rx="1" width="38" x="105" y="95"></rect>
              <rect fill="#ffb77d" height="39" rx="1" width="38" x="175" y="103"></rect>
              <rect fill="#ffddb8" fillOpacity="0.6" height="22" rx="1" width="38" x="245" y="120"></rect>
              <rect fill="#554336" height="13" rx="1" width="38" x="315" y="129"></rect>

              {/* Cumulative Curve: 44% -> 66% -> 84% -> 94% -> 100% */}
              <polyline fill="none" points="54,88 124,56 194,36 264,22 334,14" stroke="#96ccff" strokeLinecap="round" strokeWidth="2"></polyline>
              <circle cx="54" cy="88" fill="#96ccff" r="3"></circle>
              <circle cx="124" cy="56" fill="#96ccff" r="3"></circle>
              <circle cx="194" cy="36" fill="#96ccff" r="3"></circle>
              <circle cx="264" cy="22" fill="#96ccff" r="3"></circle>
              <circle cx="334" cy="14" fill="#96ccff" r="3"></circle>

              <line stroke="#2a2a2a" strokeWidth="1" x1="20" x2="360" y1="142" y2="142"></line>
            </svg>
          </div>

          {/* Pareto Breakdown List */}
          <div className="flex flex-col gap-1.5 font-mono text-label-sm">
            <div className="flex items-center justify-between p-1.5 rounded bg-surface-container border border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded bg-primary-container"></span>
                <span className="text-on-surface font-body text-body-sm">Solder Bridging</span>
              </div>
              <div className="flex items-center gap-space-md">
                <span className="text-primary font-bold">44.0%</span>
                <span className="text-outline text-body-sm">Cum: 44%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded bg-surface-container border border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded bg-secondary"></span>
                <span className="text-on-surface font-body text-body-sm">Tombstoning</span>
              </div>
              <div className="flex items-center gap-space-md">
                <span className="text-secondary font-bold">22.0%</span>
                <span className="text-outline text-body-sm">Cum: 66%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded bg-surface-container border border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded bg-primary"></span>
                <span className="text-on-surface font-body text-body-sm">Missing Passive</span>
              </div>
              <div className="flex items-center gap-space-md">
                <span className="text-on-surface font-bold">18.0%</span>
                <span className="text-outline text-body-sm">Cum: 84%</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-1.5 rounded bg-surface-container border border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded bg-secondary-fixed"></span>
                <span className="text-on-surface font-body text-body-sm">Insufficient Solder</span>
              </div>
              <div className="flex items-center gap-space-md">
                <span className="text-on-surface font-bold">10.0%</span>
                <span className="text-outline text-body-sm">Cum: 94%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Visual Module: Yield Trend across Lines 01-04 + Machine Vision */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md">
        {/* Yield Multi-Line Trend Chart (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col p-space-lg bg-surface-container-low rounded-xl gap-space-md border border-surface-container-high shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">stacked_line_chart</span>
              <span className="font-headline text-headline-md text-on-surface font-semibold tracking-tight">
                Yield Trend by Production Line ({timeRange})
              </span>
            </div>
            {/* Legend Pill Filter */}
            <div className="flex items-center gap-2 font-mono text-label-sm">
              <span className="inline-flex items-center gap-1 text-primary">
                <span className="w-2 h-2 rounded-full bg-primary-container"></span>Line 01
              </span>
              <span className="inline-flex items-center gap-1 text-tertiary">
                <span className="w-2 h-2 rounded-full bg-tertiary"></span>Line 02
              </span>
              <span className="inline-flex items-center gap-1 text-secondary">
                <span className="w-2 h-2 rounded-full bg-secondary"></span>Line 03
              </span>
              <span className="inline-flex items-center gap-1 text-on-surface">
                <span className="w-2 h-2 rounded-full bg-on-surface"></span>Line 04
              </span>
            </div>
          </div>

          {/* Trend Graph Rendering */}
          <div className="w-full h-56 bg-surface-container-lowest rounded-lg p-3 relative flex items-center justify-center border border-surface-container-high">
            <svg className="w-full h-full" fill="none" viewBox="0 0 700 180" xmlns="http://www.w3.org/2000/svg">
              <line stroke="#2a2a2a" strokeWidth="1" x1="30" x2="680" y1="20" y2="20"></line>
              <text fill="#a38c7c" fontFamily="IBM Plex Mono" fontSize="9" x="35" y="16">99.5%</text>

              <line stroke="#2a2a2a" strokeWidth="1" x1="30" x2="680" y1="65" y2="65"></line>
              <text fill="#a38c7c" fontFamily="IBM Plex Mono" fontSize="9" x="35" y="61">98.5% (TGT)</text>

              <line stroke="#2a2a2a" strokeWidth="1" x1="30" x2="680" y1="110" y2="110"></line>
              <text fill="#a38c7c" fontFamily="IBM Plex Mono" fontSize="9" x="35" y="106">97.5%</text>

              <line stroke="#2a2a2a" strokeWidth="1" x1="30" x2="680" y1="155" y2="155"></line>
              <text fill="#a38c7c" fontFamily="IBM Plex Mono" fontSize="9" x="35" y="151">96.0%</text>

              {/* Line 01 */}
              <path d="M 50 60 Q 150 40 250 55 T 450 35 T 670 30" fill="none" stroke="#d97707" strokeWidth="2.5"></path>
              {/* Line 02 */}
              <path d="M 50 80 Q 160 90 270 70 T 470 60 T 670 50" fill="none" stroke="#96ccff" strokeDasharray="2 1" strokeWidth="2"></path>
              {/* Line 03 */}
              <path d="M 50 100 Q 180 115 300 95 T 500 80 T 670 75" fill="none" stroke="#ffb95f" strokeWidth="1.8"></path>
              {/* Line 04 with excursion */}
              <path d="M 50 65 Q 160 60 250 140 T 420 70 T 670 40" fill="none" stroke="#e5e2e1" strokeOpacity="0.8" strokeWidth="1.5"></path>

              <circle cx="268" cy="135" fill="#ffb4ab" r="4"></circle>
              <text fill="#ffb4ab" fontFamily="IBM Plex Mono" fontSize="9" x="280" y="138">Excursion Shift-14 [Resolved]</text>
            </svg>

            <div className="absolute top-3 right-3 flex items-center gap-3 bg-surface-container/90 px-3 py-1.5 rounded font-mono text-label-sm border border-surface-container-high">
              <span className="text-outline">Active Shift 30 Mean:</span>
              <span className="text-tertiary font-bold">99.12%</span>
            </div>
          </div>

          {/* Line Metrics Summary Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm pt-1">
            <div className="p-space-sm bg-surface-container rounded flex flex-col border border-surface-container-high">
              <span className="text-label-sm font-mono text-primary font-semibold">LINE 01 • SMT-MAIN</span>
              <span className="font-headline text-headline-md font-mono text-on-surface">99.2%</span>
              <span className="text-body-sm text-tertiary font-mono">0 excursion / 30 shifts</span>
            </div>
            <div className="p-space-sm bg-surface-container rounded flex flex-col border border-surface-container-high">
              <span className="text-label-sm font-mono text-tertiary font-semibold">LINE 02 • COMPACT</span>
              <span className="font-headline text-headline-md font-mono text-on-surface">98.8%</span>
              <span className="text-body-sm text-outline font-mono">1 minor nozzle check</span>
            </div>
            <div className="p-space-sm bg-surface-container rounded flex flex-col border border-surface-container-high">
              <span className="text-label-sm font-mono text-secondary font-semibold">LINE 03 • PROTOTYPE</span>
              <span className="font-headline text-headline-md font-mono text-on-surface">97.9%</span>
              <span className="text-body-sm text-outline font-mono">Low lot volume</span>
            </div>
            <div className="p-space-sm bg-surface-container rounded flex flex-col border border-surface-container-high">
              <span className="text-label-sm font-mono text-on-surface font-semibold">LINE 04 • HIGH-VOLUME</span>
              <span className="font-headline text-headline-md font-mono text-on-surface">98.5%</span>
              <span className="text-body-sm text-tertiary font-mono">Recalibrated +0.8%</span>
            </div>
          </div>
        </div>

        {/* Machine Vision Optical Capture Microscopy Card (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col p-space-lg bg-surface-container-low rounded-xl gap-space-md justify-between border border-surface-container-high shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-space-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">center_focus_strong</span>
              <span className="font-headline text-headline-md text-on-surface font-semibold tracking-tight">
                AOI Optical Capture
              </span>
            </div>
            <span className="px-2 py-0.5 rounded font-mono text-label-sm text-primary bg-primary/10 border border-primary/20">
              MICROSCOPY
            </span>
          </div>

          <div className="relative w-full h-44 rounded-lg overflow-hidden bg-surface-container-lowest group border border-surface-container-high">
            <img
              className="w-full h-full object-cover grayscale contrast-125 opacity-80 group-hover:scale-105 transition-transform duration-700"
              alt="Industrial electron microscope inspection"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuApAh-DZjGNOz4lEqlUlQfNSoXQ9F34pnTpUZRYwclFxI-yjicfCPeT-yem-z-Ab1Tt3rtSyZNatmQPL13q2f4GzUNg-h3WJcguJRjqJv04NoGqSl8TMV8O5Z-lomv6MUMqI_Hdh8U4zzUVR_ju4D3mr_0wHWJ5dDG-0ckyRxMUBZE2Nxe50JsozOY3dagYcXG0woauPwVY8t8XWWci-T9Rb5tqXrKYZw1I1NCEYqsLi3cyEY6SxxKUTA"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent pointer-events-none"></div>
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container-lowest/80 text-label-sm font-mono text-tertiary backdrop-blur-sm border border-tertiary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-ping"></span>
              <span>LOT: #B994-SMT</span>
            </div>
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between font-mono text-label-sm text-on-surface px-2 py-1 bg-surface-container-low/90 rounded backdrop-blur-sm border border-surface-container-high">
              <span>PAD-082 SOLDER FLUX</span>
              <span className="text-tertiary font-semibold">TOLERANCE 99.8%</span>
            </div>
          </div>

          {/* Quick Defect Inspection Feed Info */}
          <div className="flex flex-col gap-space-xs text-body-sm font-body">
            <div className="flex justify-between text-on-surface-variant font-mono">
              <span>Target Component:</span>
              <span className="text-on-surface">BGA-356 FlipChip</span>
            </div>
            <div className="flex justify-between text-on-surface-variant font-mono">
              <span>Optical Resolution:</span>
              <span className="text-on-surface">0.85 µm/px</span>
            </div>
            <div className="flex justify-between text-on-surface-variant font-mono">
              <span>AI Inference Confidence:</span>
              <span className="text-tertiary font-semibold">99.74%</span>
            </div>
          </div>

          <button
            onClick={() => setIsMicroscopyOpen(true)}
            className="w-full flex items-center justify-center gap-space-xs py-2 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface text-label-md font-mono transition-colors border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span>
            <span>LAUNCH MICROSCOPY VIEWER</span>
          </button>
        </div>
      </div>

      {/* Real-time Defect Occurrence Table */}
      <div className="flex flex-col bg-surface-container-low rounded-xl overflow-hidden border border-surface-container-high shadow-sm">
        <div className="p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-surface-container-low border-b border-surface-container-high">
          <div className="flex items-center gap-space-sm">
            <span className="material-symbols-outlined text-primary text-[20px]">troubleshoot</span>
            <span className="font-headline text-headline-md text-on-surface font-semibold tracking-tight">
              Active Defect Telemetry Feed
            </span>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="text-label-sm font-mono text-outline">AUTO-STREAMING 1000ms</span>
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left font-mono text-body-sm border-collapse">
            <thead className="bg-surface-container text-outline uppercase text-label-sm border-b border-surface-container-high">
              <tr>
                <th className="py-2.5 px-space-md">Timestamp</th>
                <th className="py-2.5 px-space-md">Station / Line</th>
                <th className="py-2.5 px-space-md">Defect Classification</th>
                <th className="py-2.5 px-space-md">Coordinate (X, Y)</th>
                <th className="py-2.5 px-space-md">Severity</th>
                <th className="py-2.5 px-space-md text-right">Action State</th>
              </tr>
            </thead>
            <tbody className="text-on-surface divide-y divide-surface-container-high/30">
              {telemetryFeed.map((row, idx) => (
                <tr key={idx} className="hover:bg-surface-container transition-colors">
                  <td className="py-2.5 px-space-md text-on-surface-variant font-mono whitespace-nowrap">
                    {row.timestamp}
                  </td>
                  <td className="py-2.5 px-space-md font-semibold text-primary whitespace-nowrap">
                    {row.station}
                  </td>
                  <td className="py-2.5 px-space-md whitespace-nowrap">{row.defect}</td>
                  <td className="py-2.5 px-space-md text-on-surface-variant whitespace-nowrap">
                    {row.coord}
                  </td>
                  <td className="py-2.5 px-space-md whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-label-sm font-bold ${
                        row.severity.includes('CRITICAL')
                          ? 'bg-error/20 text-error'
                          : row.severity.includes('MAJOR')
                          ? 'bg-primary-container/25 text-primary'
                          : 'bg-tertiary/15 text-tertiary'
                      }`}
                    >
                      {row.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-space-md text-right whitespace-nowrap">
                    <span className="text-label-sm text-tertiary font-semibold">{row.action}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Export / Audit Report Drawer/Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface-container-low border border-surface-container-high rounded-xl p-space-lg shadow-2xl flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">file_download</span>
                <h3 className="font-headline text-headline-md font-bold text-on-surface">
                  SPC Quality &amp; Telemetry Export
                </h3>
              </div>
              <button onClick={() => setIsExportModalOpen(false)} className="p-1 rounded text-outline hover:text-on-surface">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-body-md text-on-surface-variant">
              Generate a cryptographic ISO 9001:2015 compliant Statistical Process Control report bundle including raw coordinate matrices and Pareto charts.
            </p>

            <div className="flex flex-col gap-2 font-mono text-body-sm">
              <label className="flex items-center gap-2 p-2 rounded bg-surface-container border border-surface-container-high">
                <input type="checkbox" defaultChecked className="accent-primary rounded" />
                <span>Include X̄-bar &amp; R Raw Telemetry Coordinates</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded bg-surface-container border border-surface-container-high">
                <input type="checkbox" defaultChecked className="accent-primary rounded" />
                <span>Include Defect Density Pareto Classifications</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded bg-surface-container border border-surface-container-high">
                <input type="checkbox" defaultChecked className="accent-primary rounded" />
                <span>Attach 21 CFR Part 11 Digital Signatures</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-space-sm pt-space-xs">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-space-md py-2 rounded bg-surface-container text-outline hover:text-on-surface font-mono"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('SPC Telemetry audit package generated: INSPECTRA-SPC-REPORT-2026.csv');
                  setIsExportModalOpen(false);
                }}
                className="px-space-md py-2 rounded bg-primary-container text-on-primary-container font-bold hover:bg-secondary-container"
              >
                Download Audit Package
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-Resolution Microscopy Viewer Modal */}
      {isMicroscopyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="w-full max-w-4xl bg-surface-container-low border border-surface-container-high rounded-xl p-space-lg shadow-2xl flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-xs border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[24px]">biotech</span>
                <h3 className="font-headline text-headline-md font-bold text-on-surface">
                  Optical Microscopy High-Magnification Station // CAM-04X
                </h3>
              </div>
              <button onClick={() => setIsMicroscopyOpen(false)} className="p-1 rounded text-outline hover:text-on-surface">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="relative w-full h-96 rounded-lg overflow-hidden bg-black flex items-center justify-center border border-surface-container-high">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuApAh-DZjGNOz4lEqlUlQfNSoXQ9F34pnTpUZRYwclFxI-yjicfCPeT-yem-z-Ab1Tt3rtSyZNatmQPL13q2f4GzUNg-h3WJcguJRjqJv04NoGqSl8TMV8O5Z-lomv6MUMqI_Hdh8U4zzUVR_ju4D3mr_0wHWJ5dDG-0ckyRxMUBZE2Nxe50JsozOY3dagYcXG0woauPwVY8t8XWWci-T9Rb5tqXrKYZw1I1NCEYqsLi3cyEY6SxxKUTA"
                alt="High magnification inspection view"
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-black/80 backdrop-blur-sm p-3 rounded font-mono text-label-sm border border-surface-container-high">
                <div className="flex items-center gap-3">
                  <span className="text-primary font-bold">PAD: BGA-356 PIN 14-16</span>
                  <span className="text-on-surface">RES: 0.85 µm/px</span>
                  <span className="text-tertiary">CONF: 99.74%</span>
                </div>
                <span className="text-secondary font-semibold">TOLERANCE NOMINAL</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
