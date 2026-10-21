import React, { useEffect, useState, useRef } from 'react';
import { inspectionsApi, productsApi, batchesApi } from '../api/client';
import type { Inspection, Product, Batch, SampleType } from '../types';

interface TelemetryRun {
  id: string;
  sku: string;
  lot: string;
  inspector: string;
  avatar: string;
  timestamp: string;
  sampleSize: string;
  defects: string;
  defectCount: number;
  fpy: string;
  status: 'REJECTED / HOLD' | 'PASSED' | 'IN-PROGRESS';
  station: string;
  defectDetails: string;
  image?: string;
  confidence?: string;
  coords?: string;
  backendInspection?: Inspection;
}

const mockTelemetryRuns: TelemetryRun[] = [
  {
    id: 'INS-2026-8841',
    sku: 'PCB-XA90-REV3',
    lot: '#LOT-99201',
    inspector: 'S. Godikat',
    avatar: 'SG',
    timestamp: '14:18:22',
    sampleSize: '120 / 120',
    defects: '2 CRIT',
    defectCount: 2,
    fpy: '96.6%',
    status: 'REJECTED / HOLD',
    station: 'Station Alpha - Optical SMT',
    defectDetails: 'Solder bridging detected pin 14-16',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrbYNHwAW2CHEBoNIvpCnmjwVaf_E4ITB-MpCw-A-zfI0UoOMtmbS2BSo0C-dmW6ODftvNFHi8cXmDsxoyrwrz5isnX0LZALid-2cylQiI_-scnPuALYJ9_oi3T91ORupkNiQJ3Wq0R3DNVCUzmC2zk1AmecWzP7wyQkASADk_OqZamd2Va_nOfYbUcdCKKWZvIiRUNYG6WDXaHSB3RWxdQ7I9GNAy4kJJ4mRpm28PmsEcICrlk-HfFg',
    confidence: '99.4%',
    coords: 'X:142.08 Y:88.41',
  },
  {
    id: 'INS-2026-8840',
    sku: 'PCB-XA90-REV3',
    lot: '#LOT-99201',
    inspector: 'M. Vance',
    avatar: 'MV',
    timestamp: '14:04:10',
    sampleSize: '120 / 120',
    defects: '0',
    defectCount: 0,
    fpy: '100.0%',
    status: 'PASSED',
    station: 'Station Beta - X-Ray BGA',
    defectDetails: 'Voiding within threshold at 1.4%',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC7x7szMYSIX0H4cDY5J-Sb9rQ29_2_7QrHENM9177I5NL_UENW1mGmS38Vogv25lIPQQRcnCzRCvtDC-Jc-ERU_Yd0tO9YyppNtpqD49cZLMgjJTJkN7FB0-14A0wXBgi5e7tWDhJPj81pvHKlpAxb-sgm6cqxYpnNZJCcbOuk7_ol7Nn4sIrPUI5qn668vJW2UKQYbCscIiUWl80iyTi7MtI-zJb9ZZj97MRZx9EyJnY6Afagc7dbnA',
    confidence: '99.8%',
    coords: 'X:98.40 Y:120.10',
  },
  {
    id: 'INS-2026-8839',
    sku: 'PWR-CTRL-MOD',
    lot: '#LOT-98844',
    inspector: 'K. Lindqvist',
    avatar: 'KL',
    timestamp: '13:48:55',
    sampleSize: '85 / 100',
    defects: '--',
    defectCount: 0,
    fpy: '98.8%',
    status: 'IN-PROGRESS',
    station: 'Station Gamma - Final Assembly',
    defectDetails: 'Inspecting harness connector latching',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA4hbR4GX-KeRVQFvjHFGBOeTctOOP1mDuIsGv3JfE34CeSV712q1cHRkOcbqqMwJzt-pj7m2wAhFDUIEy7P6qf2JqyibqfdFytpweOO8cyU2YXIcISWuHLhDIQ0hc8BTVzi0K_HvawDzhItuaQQmqvXlA61Fbkj5LJ6C4eCi8cNwIXEm4f4PvCl89Y__mIB1NpCBa0PwqRTT_aNPTxOC0qNIDDyjQg-s0lDmkynzCKls-5KxzSRsWnFQ',
    confidence: '98.5%',
    coords: 'X:65.12 Y:140.22',
  },
  {
    id: 'INS-2026-8838',
    sku: 'PWR-CTRL-MOD',
    lot: '#LOT-98844',
    inspector: 'S. Godikat',
    avatar: 'SG',
    timestamp: '13:30:12',
    sampleSize: '100 / 100',
    defects: '0',
    defectCount: 0,
    fpy: '100.0%',
    status: 'PASSED',
    station: 'Station Beta - X-Ray BGA',
    defectDetails: 'Voiding 0.8% - clean pass',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCn8RCJcHPl_IHMq56CWdV0UnVnv49vWax7dUBgICpRHy6WgMIN-zRjBEyd0jOMRNJ74kzlURlID9mD3YagPAnLni5gg0h-H8Iyc-zrZbNuRDxFtyAybW6D4erg5nVNF3QWxSz2B_ziFkA1RWeqsI4XD-xbP18YCaBuvg696p3B_plNQy_of0yEBTTpa9qxqVvhW23t7UZHJxBGGBjZVSJS-qypg8Cp_0DZRc5yXTfhUrei9qdesg6DSQ',
    confidence: '99.9%',
    coords: 'X:112.50 Y:90.30',
  },
  {
    id: 'INS-2026-8837',
    sku: 'SENSOR-ARRAY-MK2',
    lot: '#LOT-98602',
    inspector: 'D. Rao',
    avatar: 'DR',
    timestamp: '12:55:04',
    sampleSize: '250 / 250',
    defects: '1 REJ',
    defectCount: 1,
    fpy: '99.2%',
    status: 'REJECTED / HOLD',
    station: 'Station Alpha - Optical SMT',
    defectDetails: 'Solder ball spatters on component Q3',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuApAh-DZjGNOz4lEqlUlQfNSoXQ9F34pnTpUZRYwclFxI-yjicfCPeT-yem-z-Ab1Tt3rtSyZNatmQPL13q2f4GzUNg-h3WJcguJRjqJv04NoGqSl8TMV8O5Z-lomv6MUMqI_Hdh8U4zzUVR_ju4D3mr_0wHWJ5dDG-0ckyRxMUBZE2Nxe50JsozOY3dagYcXG0woauPwVY8t8XWWci-T9Rb5tqXrKYZw1I1NCEYqsLi3cyEY6SxxKUTA',
    confidence: '97.8%',
    coords: 'X:164.20 Y:75.50',
  },
  {
    id: 'INS-2026-8836',
    sku: 'SENSOR-ARRAY-MK2',
    lot: '#LOT-98602',
    inspector: 'D. Rao',
    avatar: 'DR',
    timestamp: '12:14:48',
    sampleSize: '250 / 250',
    defects: '0',
    defectCount: 0,
    fpy: '100.0%',
    status: 'PASSED',
    station: 'Station Alpha - Optical SMT',
    defectDetails: 'Clean run complete',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC7x7szMYSIX0H4cDY5J-Sb9rQ29_2_7QrHENM9177I5NL_UENW1mGmS38Vogv25lIPQQRcnCzRCvtDC-Jc-ERU_Yd0tO9YyppNtpqD49cZLMgjJTJkN7FB0-14A0wXBgi5e7tWDhJPj81pvHKlpAxb-sgm6cqxYpnNZJCcbOuk7_ol7Nn4sIrPUI5qn668vJW2UKQYbCscIiUWl80iyTi7MtI-zJb9ZZj97MRZx9EyJnY6Afagc7dbnA',
    confidence: '100.0%',
    coords: 'X:120.00 Y:80.00',
  },
];

export const InspectionsPage: React.FC = () => {
  // Real backend inspections state
  const [, setInspections] = useState<Inspection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batchesForSelectedProduct, setBatchesForSelectedProduct] = useState<Batch[]>([]);

  // Telemetry Console State
  const [runs, setRuns] = useState<TelemetryRun[]>(mockTelemetryRuns);
  const [selectedRun, setSelectedRun] = useState<TelemetryRun>(mockTelemetryRuns[0]);
  const [activeFilter, setActiveFilter] = useState<'all' | 'progress' | 'flagged' | 'passed'>('all');
  const [stationFilter, setStationFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals & Upload state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<{
    product_id: number;
    batch_id: number;
    sample_reference: string;
    sample_type: SampleType;
    observations: string;
  }>({
    product_id: 0,
    batch_id: 0,
    sample_reference: '',
    sample_type: 'item',
    observations: '',
  });

  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeUploadInspectionId, setActiveUploadInspectionId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch real backend data
  const fetchData = async () => {
    try {
      const [inspRes, prodRes] = await Promise.all([
        inspectionsApi.list(),
        productsApi.list({ status: 'active' }),
      ]);
      setInspections(inspRes.inspections || []);
      setProducts(prodRes.products || []);

      // If backend has inspections, convert them and prepend to runs!
      if (inspRes.inspections && inspRes.inspections.length > 0) {
        const backendRuns: TelemetryRun[] = inspRes.inspections.map((i) => ({
          id: `INS-${i.id.toString().padStart(4, '0')}`,
          sku: i.product?.name || `PROD-${i.product_id}`,
          lot: i.batch?.batch_number ? `#${i.batch.batch_number}` : `#BATCH-${i.batch_id}`,
          inspector: i.inspector?.name || 'Authorized QA',
          avatar: i.inspector?.name ? i.inspector.name.slice(0, 2).toUpperCase() : 'QA',
          timestamp: new Date(i.created_at).toTimeString().split(' ')[0],
          sampleSize: `${i.images?.length || 1} units`,
          defects: i.status === 'reviewed' ? '0' : 'EVAL',
          defectCount: 0,
          fpy: '99.1%',
          status: i.status === 'reviewed' ? 'PASSED' : 'IN-PROGRESS',
          station: 'Station Alpha - Optical SMT',
          defectDetails: i.observations || 'Automated inspection run',
          image: mockTelemetryRuns[0].image,
          confidence: '99.4%',
          coords: 'X:142.08 Y:88.41',
          backendInspection: i,
        }));
        setRuns([...backendRuns, ...mockTelemetryRuns]);
        setSelectedRun(backendRuns[0]);
      }
    } catch {
      // Offline fallback: keep mock telemetry runs active
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update batches when product is selected in create form
  useEffect(() => {
    if (createForm.product_id) {
      batchesApi
        .list({ product_id: createForm.product_id, status: 'all' })
        .then((res) => {
          const activeBatches = res.batches.filter((b) => b.status !== 'archived');
          setBatchesForSelectedProduct(activeBatches);
          if (activeBatches.length > 0) {
            setCreateForm((prev) => ({ ...prev, batch_id: activeBatches[0].id }));
          }
        })
        .catch(() => setBatchesForSelectedProduct([]));
    } else {
      setBatchesForSelectedProduct([]);
    }
  }, [createForm.product_id]);

  // Create Inspection Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await inspectionsApi.create({
        product_id: Number(createForm.product_id),
        batch_id: Number(createForm.batch_id),
        sample_reference: createForm.sample_reference,
        sample_type: createForm.sample_type,
        observations: createForm.observations,
      });

      const newRun: TelemetryRun = {
        id: `INS-${res.inspection.id.toString().padStart(4, '0')}`,
        sku: res.inspection.product?.name || `PROD-${res.inspection.product_id}`,
        lot: res.inspection.batch?.batch_number
          ? `#${res.inspection.batch.batch_number}`
          : `#BATCH-${res.inspection.batch_id}`,
        inspector: res.inspection.inspector?.name || 'Authorized QA',
        avatar: 'QA',
        timestamp: new Date().toTimeString().split(' ')[0],
        sampleSize: '1 / 1',
        defects: '--',
        defectCount: 0,
        fpy: '100%',
        status: 'IN-PROGRESS',
        station: 'Station Alpha - Optical SMT',
        defectDetails: createForm.observations || 'Newly created live inspection run',
        image: mockTelemetryRuns[0].image,
        confidence: '99.2%',
        coords: 'X:130.00 Y:95.00',
        backendInspection: res.inspection,
      };

      setRuns([newRun, ...runs]);
      setSelectedRun(newRun);
      setIsCreateModalOpen(false);

      // Offer image upload immediately
      setActiveUploadInspectionId(res.inspection.id);
    } catch {
      // Fallback local creation if offline
      const newMockId = `INS-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const localRun: TelemetryRun = {
        id: newMockId,
        sku: 'Custom SKU Lot',
        lot: `#LOT-${Math.floor(10000 + Math.random() * 90000)}`,
        inspector: 'S. Godikat',
        avatar: 'SG',
        timestamp: new Date().toTimeString().split(' ')[0],
        sampleSize: '50 / 50',
        defects: '0',
        defectCount: 0,
        fpy: '100%',
        status: 'IN-PROGRESS',
        station: 'Station Alpha - Optical SMT',
        defectDetails: createForm.observations || 'Live station run initiated',
        image: mockTelemetryRuns[0].image,
        confidence: '99.5%',
        coords: 'X:120.00 Y:85.00',
      };
      setRuns([localRun, ...runs]);
      setSelectedRun(localRun);
      setIsCreateModalOpen(false);
    }
  };

  // Upload Images
  const handleUploadImages = async () => {
    if (!activeUploadInspectionId || selectedFiles.length === 0) return;
    setIsUploading(true);
    try {
      await inspectionsApi.uploadImages(activeUploadInspectionId, selectedFiles);
      alert('Inspection images uploaded successfully! Telemetry linked.');
      setActiveUploadInspectionId(null);
      setSelectedFiles([]);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Upload error');
    } finally {
      setIsUploading(false);
    }
  };

  // Filtered runs
  const filteredRuns = runs.filter((r) => {
    if (activeFilter === 'progress' && r.status !== 'IN-PROGRESS') return false;
    if (activeFilter === 'flagged' && r.status !== 'REJECTED / HOLD') return false;
    if (activeFilter === 'passed' && r.status !== 'PASSED') return false;
    if (stationFilter !== 'all' && !r.station.toLowerCase().includes(stationFilter.toLowerCase())) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.lot.toLowerCase().includes(q) ||
        r.inspector.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="w-full min-h-screen p-margin bg-background flex flex-col gap-space-lg select-none pb-12">
      {/* Station Telemetry & Live Feed Ribbon */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md">
        <div className="flex flex-col">
          <div className="flex items-center gap-space-sm text-outline">
            <span className="text-label-sm uppercase tracking-widest font-mono">
              FACILITY // SECTOR-07G
            </span>
            <span className="text-surface-bright">/</span>
            <span className="text-label-sm uppercase tracking-widest font-mono text-tertiary">
              STATION TELEMETRY
            </span>
          </div>
          <div className="flex items-center gap-space-md mt-0.5">
            <span className="font-headline text-headline-lg text-on-surface font-bold">
              Inspection Runs &amp; Telemetry
            </span>
            <span className="px-space-sm py-0.5 rounded-full bg-surface-container-high text-tertiary text-label-sm font-mono flex items-center gap-1 border border-tertiary/20">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span> LIVE FEED
            </span>
          </div>
        </div>

        <div className="flex items-center gap-space-sm flex-wrap">
          <div className="flex items-center bg-surface-container-low px-space-md py-1.5 rounded-lg text-on-surface-variant font-mono text-body-sm border border-surface-container-high">
            <span className="material-symbols-outlined text-[16px] mr-1.5 text-primary">schedule</span>
            <span>SHIFT 02 (DAY) • LIVE STREAM</span>
          </div>
          <button
            onClick={() => alert('Exporting full telemetry run log CSV...')}
            className="bg-surface-container-high hover:bg-surface-bright text-on-surface px-space-md py-1.5 rounded-lg text-label-md transition-colors flex items-center gap-1.5 border border-surface-container-high"
          >
            <span className="material-symbols-outlined text-[16px]">file_download</span>
            Export CSV
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            id="btn-new-run"
            className="bg-primary-container hover:bg-secondary-container text-on-primary-container px-space-md py-1.5 rounded-lg text-label-md font-semibold transition-all flex items-center gap-1.5 shadow-sm active:translate-y-px"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            + New Inspection Run
          </button>
        </div>
      </div>

      {/* 4 KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
        {/* Total Inspected */}
        <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between relative overflow-hidden shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">
              TOTAL INSPECTED (24H)
            </span>
            <span className="material-symbols-outlined text-outline text-[18px]">
              precision_manufacturing
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-headline text-headline-xl text-on-surface font-mono font-bold">
              1,842
            </span>
            <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-tertiary text-label-sm font-mono flex items-center">
              <span className="material-symbols-outlined text-[12px] mr-0.5">trending_up</span>+4.2%
            </span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
            <div className="bg-tertiary h-full rounded-full" style={{ width: '78%' }}></div>
          </div>
          <div className="mt-1 flex justify-between text-outline text-label-sm font-mono">
            <span>Target: 2,360 units</span>
            <span>78%</span>
          </div>
        </div>

        {/* FPY */}
        <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between relative overflow-hidden shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">
              FIRST PASS YIELD (FPY)
            </span>
            <span className="material-symbols-outlined text-outline text-[18px]">verified_user</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-headline text-headline-xl text-on-surface font-mono font-bold">
              98.42%
            </span>
            <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-primary text-label-sm font-mono">
              ≥ 98.00% SPEC
            </span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: '98.42%' }}></div>
          </div>
          <div className="mt-1 flex justify-between text-outline text-label-sm font-mono">
            <span>Tolerance Band: 97.5% - 99.9%</span>
            <span className="text-primary font-bold">PASSING</span>
          </div>
        </div>

        {/* Defects Flagged */}
        <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between relative overflow-hidden shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">
              ACTIVE OPEN DEFECTS
            </span>
            <span className="material-symbols-outlined text-outline text-[18px]">warning</span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline text-headline-xl text-error font-mono font-bold">14</span>
              <span className="text-on-surface-variant text-body-sm">units flagged</span>
            </div>
            <span className="px-space-xs py-0.5 rounded-full bg-error-container/30 text-error text-label-sm font-mono font-bold border border-error/30">
              3 LINES
            </span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
            <div className="bg-error h-full rounded-full" style={{ width: '32%' }}></div>
          </div>
          <div className="mt-1 flex justify-between text-outline text-label-sm font-mono">
            <span>Line 01 (4) • Line 04 (8) • Line 07 (2)</span>
            <span className="text-error font-bold">ACTION REQ</span>
          </div>
        </div>

        {/* Velocity */}
        <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between relative overflow-hidden shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">
              INSPECTION VELOCITY
            </span>
            <span className="material-symbols-outlined text-outline text-[18px]">speed</span>
          </div>
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-space-xs">
              <span className="font-headline text-headline-xl text-secondary font-mono font-bold">142</span>
              <span className="text-on-surface-variant text-body-sm">units / hr</span>
            </div>
            <span className="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-secondary text-label-sm font-mono font-bold">
              NOMINAL
            </span>
          </div>
          <div className="mt-space-sm w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
            <div className="bg-secondary h-full rounded-full" style={{ width: '86%' }}></div>
          </div>
          <div className="mt-1 flex justify-between text-outline text-label-sm font-mono">
            <span>Max Capacity: 165 u/h</span>
            <span>86.0%</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Station Selector Bar */}
      <div className="bg-surface-container-low p-space-sm rounded-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md border border-surface-container-high">
        <div className="flex items-center overflow-x-auto gap-space-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-space-md py-1.5 rounded-lg text-label-md font-semibold whitespace-nowrap transition-colors ${
              activeFilter === 'all'
                ? 'bg-primary-container text-on-primary-container shadow-sm'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            All Lots ({runs.length})
          </button>
          <button
            onClick={() => setActiveFilter('progress')}
            className={`px-space-md py-1.5 rounded-lg text-label-md font-semibold whitespace-nowrap transition-colors ${
              activeFilter === 'progress'
                ? 'bg-primary-container text-on-primary-container shadow-sm'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            In Progress ({runs.filter((r) => r.status === 'IN-PROGRESS').length})
          </button>
          <button
            onClick={() => setActiveFilter('flagged')}
            className={`px-space-md py-1.5 rounded-lg text-label-md font-semibold whitespace-nowrap transition-colors ${
              activeFilter === 'flagged'
                ? 'bg-primary-container text-on-primary-container shadow-sm'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Flagged for Hold ({runs.filter((r) => r.status === 'REJECTED / HOLD').length})
          </button>
          <button
            onClick={() => setActiveFilter('passed')}
            className={`px-space-md py-1.5 rounded-lg text-label-md font-semibold whitespace-nowrap transition-colors ${
              activeFilter === 'passed'
                ? 'bg-primary-container text-on-primary-container shadow-sm'
                : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            }`}
          >
            Passed ({runs.filter((r) => r.status === 'PASSED').length})
          </button>
        </div>

        <div className="flex items-center gap-space-sm flex-wrap">
          <div className="flex items-center bg-surface-container rounded-lg px-space-sm py-1 border border-surface-container-high">
            <span className="material-symbols-outlined text-[16px] text-outline mr-1.5">tune</span>
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="bg-transparent text-on-surface text-body-sm focus:outline-none pr-space-md py-0.5 cursor-pointer"
            >
              <option value="all" className="bg-surface-container-highest text-on-surface">All Stations</option>
              <option value="alpha" className="bg-surface-container-highest text-on-surface">Station Alpha • Optical SMT</option>
              <option value="beta" className="bg-surface-container-highest text-on-surface">Station Beta • X-Ray BGA</option>
              <option value="gamma" className="bg-surface-container-highest text-on-surface">Station Gamma • Final Assembly</option>
            </select>
          </div>

          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-2 text-[16px] text-outline">search</span>
            <input
              type="text"
              placeholder="Search Run, Part, Lot..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-surface-container rounded-lg pl-8 pr-3 py-1 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-high w-44 md:w-56 border border-surface-container-high"
            />
          </div>
        </div>
      </div>

      {/* Primary Split View: Runs Table (Left) + Diagnostic Telemetry Sidecar (Right) */}
      <div className="flex flex-col 2xl:flex-row gap-space-lg items-start w-full">
        {/* Runs Table */}
        <div className="w-full 2xl:flex-1 bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-surface-container-high">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm text-on-surface">
              <thead className="bg-surface-container-low uppercase text-label-sm text-outline tracking-wider font-mono border-b border-surface-container-high">
                <tr>
                  <th className="py-2.5 px-space-md">RUN ID</th>
                  <th className="py-2.5 px-space-md">PART / SKU</th>
                  <th className="py-2.5 px-space-md">BATCH LOT</th>
                  <th className="py-2.5 px-space-md">INSPECTOR</th>
                  <th className="py-2.5 px-space-md">TIMESTAMP</th>
                  <th className="py-2.5 px-space-md text-right">SAMPLE SIZE</th>
                  <th className="py-2.5 px-space-md text-center">DEFECTS</th>
                  <th className="py-2.5 px-space-md text-right">FPY %</th>
                  <th className="py-2.5 px-space-md">STATUS</th>
                  <th className="py-2.5 px-space-md text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high/30">
                {filteredRuns.map((run) => {
                  const isSelected = selectedRun.id === run.id;
                  return (
                    <tr
                      key={run.id}
                      onClick={() => setSelectedRun(run)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-surface-container-high/70 border-l-2 border-primary'
                          : 'hover:bg-surface-container-high/40 bg-surface-container-lowest'
                      }`}
                    >
                      <td className="py-2.5 px-space-md font-mono text-tertiary font-semibold whitespace-nowrap">
                        #{run.id}
                      </td>
                      <td className="py-2.5 px-space-md font-mono text-on-surface whitespace-nowrap">
                        {run.sku}
                      </td>
                      <td className="py-2.5 px-space-md font-mono text-on-surface-variant whitespace-nowrap">
                        {run.lot}
                      </td>
                      <td className="py-2.5 px-space-md whitespace-nowrap flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-mono text-[9px] font-bold">
                          {run.avatar}
                        </span>
                        <span>{run.inspector}</span>
                      </td>
                      <td className="py-2.5 px-space-md font-mono text-outline whitespace-nowrap">
                        {run.timestamp}
                      </td>
                      <td className="py-2.5 px-space-md font-mono text-right whitespace-nowrap">
                        {run.sampleSize}
                      </td>
                      <td className="py-2.5 px-space-md text-center whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                            run.defectCount > 0
                              ? 'bg-error-container text-on-error'
                              : 'bg-surface-container-highest text-tertiary'
                          }`}
                        >
                          {run.defects}
                        </span>
                      </td>
                      <td
                        className={`py-2.5 px-space-md font-mono text-right whitespace-nowrap font-semibold ${
                          run.defectCount > 0 ? 'text-error' : 'text-tertiary'
                        }`}
                      >
                        {run.fpy}
                      </td>
                      <td className="py-2.5 px-space-md whitespace-nowrap">
                        <span
                          className={`px-space-sm py-0.5 rounded-full text-label-sm font-mono flex items-center gap-1.5 w-max ${
                            run.status === 'REJECTED / HOLD'
                              ? 'bg-error-container/20 text-error border border-error/30'
                              : run.status === 'PASSED'
                              ? 'bg-tertiary-container/20 text-tertiary border border-tertiary/30'
                              : 'bg-secondary-container/20 text-secondary border border-secondary/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              run.status === 'REJECTED / HOLD'
                                ? 'bg-error'
                                : run.status === 'PASSED'
                                ? 'bg-tertiary'
                                : 'bg-secondary animate-pulse'
                            }`}
                          ></span>
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-space-md text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRun(run);
                            }}
                            className="p-1 rounded hover:bg-surface-bright text-tertiary"
                            title="View Telemetry"
                          >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                          </button>
                          {run.backendInspection && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveUploadInspectionId(run.backendInspection!.id);
                              }}
                              className="p-1 rounded hover:bg-surface-bright text-primary"
                              title="Upload Inspection Images"
                            >
                              <span className="material-symbols-outlined text-[16px]">upload</span>
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              alert(`Digital sign-off hash for run #${run.id}: SHA-982fa01c`);
                            }}
                            className="p-1 rounded hover:bg-surface-bright text-outline"
                            title="Sign-off Signatures"
                          >
                            <span className="material-symbols-outlined text-[16px]">signature</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-sm text-outline text-label-md border-t border-surface-container-high">
            <div className="flex items-center gap-space-sm font-mono text-body-sm">
              <span>Showing {filteredRuns.length} of {runs.length} operational runs</span>
              <span>•</span>
              <span className="text-tertiary">Telemetry Polling Rate: 250ms</span>
            </div>
            <div className="flex items-center gap-1 font-mono">
              <span className="text-secondary font-bold">ALL STATIONS CALIBRATED</span>
            </div>
          </div>
        </div>

        {/* Diagnostic Telemetry Sidecar */}
        <div className="w-full 2xl:w-96 flex flex-col gap-space-md bg-surface-container-low p-space-md rounded-xl shadow-md border border-surface-container-high">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-label-sm uppercase font-mono text-outline">DIAGNOSTIC TELEMETRY</span>
              <span className="font-headline text-headline-md text-on-surface font-mono font-bold">
                #{selectedRun.id}
              </span>
            </div>
            <span
              className={`px-space-xs py-0.5 rounded font-mono text-label-sm font-semibold ${
                selectedRun.status === 'REJECTED / HOLD'
                  ? 'bg-error-container text-on-error'
                  : selectedRun.status === 'PASSED'
                  ? 'bg-tertiary-container/30 text-tertiary border border-tertiary/30'
                  : 'bg-secondary-container/30 text-secondary border border-secondary/30'
              }`}
            >
              {selectedRun.status}
            </span>
          </div>

          {/* Microscopic Visual Viewport */}
          <div className="relative w-full aspect-video bg-surface-container-lowest rounded-lg overflow-hidden group border border-surface-container-high">
            <img
              className="w-full h-full object-cover opacity-85 group-hover:scale-105 transition-transform duration-500"
              alt="Optical inspection macro capture"
              src={selectedRun.image || mockTelemetryRuns[0].image}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-lowest via-transparent to-transparent"></div>

            {selectedRun.defectCount > 0 && (
              <div className="absolute top-8 left-14 w-32 h-20 rounded bg-error/15 border border-error/40 flex flex-col justify-between p-1 pointer-events-none">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] bg-error text-on-error px-1 rounded-sm font-bold">
                    DEFECT: BRIDGING
                  </span>
                  <span className="font-mono text-[9px] text-error font-bold">
                    {selectedRun.confidence || '99.4%'}
                  </span>
                </div>
                <span className="font-mono text-[9px] text-error self-end">
                  {selectedRun.coords || 'X:142.08 Y:88.41'}
                </span>
              </div>
            )}

            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-on-surface font-mono text-[10px] bg-surface-container-lowest/80 px-2 py-1 rounded backdrop-blur-sm border border-surface-container-high">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px] text-tertiary">videocam</span> CAM-OPTICAL-04
              </span>
              <span className="text-secondary">40X RESOLUTION</span>
              <span>±0.002mm CAL</span>
            </div>
          </div>

          {/* Telemetry Readouts */}
          <div className="flex flex-col gap-space-xs bg-surface-container p-space-sm rounded-lg font-mono text-body-sm border border-surface-container-high">
            <div className="flex justify-between">
              <span className="text-outline">Station:</span>
              <span className="text-on-surface">{selectedRun.station}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-outline">Active SKU:</span>
              <span className="text-on-surface">{selectedRun.sku}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-outline">Observations:</span>
              <span
                className={`font-semibold ${
                  selectedRun.defectCount > 0 ? 'text-error' : 'text-tertiary'
                }`}
              >
                {selectedRun.defectDetails}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-outline">Confidence:</span>
              <span className="text-on-surface">{selectedRun.confidence || '99.4% Optical Match'}</span>
            </div>
          </div>

          {/* Action Protocols */}
          <div className="flex flex-col gap-space-xs">
            <span className="text-label-sm uppercase font-mono text-outline">ACTION PROTOCOLS</span>
            <div className="grid grid-cols-2 gap-space-xs">
              <button
                onClick={() => alert(`Re-scanning unit in run #${selectedRun.id}...`)}
                className="bg-surface-container-high hover:bg-surface-bright text-on-surface py-2 rounded-lg text-label-md flex items-center justify-center gap-1 border border-surface-container-high"
              >
                <span className="material-symbols-outlined text-[16px] text-tertiary">replay</span>
                Re-scan Unit
              </button>
              <button
                onClick={() => alert(`Unit in #${selectedRun.id} confirmed scrap.`)}
                className="bg-error-container hover:bg-error text-on-error py-2 rounded-lg text-label-md font-semibold flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                Confirm Scrap
              </button>
            </div>
            <button
              onClick={() => alert(`CAPA task dispatched for #${selectedRun.id}!`)}
              className="w-full bg-primary-container hover:bg-secondary-container text-on-primary-container py-2 rounded-lg text-label-md font-semibold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
              Dispatch CAPA Task
            </button>
          </div>
        </div>
      </div>

      {/* Modal: New Inspection Run */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface-container-low border border-surface-container-high rounded-xl p-space-lg shadow-2xl flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">add_task</span>
                <h3 className="font-headline text-headline-md font-bold text-on-surface">
                  Initialize Inspection Run
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-space-md font-mono text-body-sm">
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-outline uppercase">Select Target Product</label>
                <select
                  required
                  value={createForm.product_id}
                  onChange={(e) => setCreateForm({ ...createForm, product_id: Number(e.target.value) })}
                  className="bg-surface-container-lowest text-on-surface px-space-sm py-2 rounded border border-surface-container-high outline-none"
                >
                  <option value={0}>-- Select Product Line --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.product_code} - {p.name}
                    </option>
                  ))}
                  {products.length === 0 && (
                    <option value={1}>PCB-XA90-REV3 (Optical SMT Main)</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-space-sm">
                <div className="flex flex-col gap-1">
                  <label className="text-label-sm text-outline uppercase">Target Batch Lot</label>
                  <select
                    value={createForm.batch_id}
                    onChange={(e) => setCreateForm({ ...createForm, batch_id: Number(e.target.value) })}
                    className="bg-surface-container-lowest text-on-surface px-space-sm py-2 rounded border border-surface-container-high outline-none"
                  >
                    <option value={0}>-- Select Lot --</option>
                    {batchesForSelectedProduct.map((b) => (
                      <option key={b.id} value={b.id}>
                        #{b.batch_number} ({b.quantity || 0} units)
                      </option>
                    ))}
                    {batchesForSelectedProduct.length === 0 && (
                      <option value={101}>#LOT-99201 (120 units)</option>
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-label-sm text-outline uppercase">Sample Classification</label>
                  <select
                    value={createForm.sample_type}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, sample_type: e.target.value as SampleType })
                    }
                    className="bg-surface-container-lowest text-on-surface px-space-sm py-2 rounded border border-surface-container-high outline-none"
                  >
                    <option value="item">Individual Item</option>
                    <option value="batch_sample">Batch Sample Set</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-outline uppercase">Sample Reference ID / SN</label>
                <input
                  type="text"
                  placeholder="e.g. SN-8842-PCB-01"
                  value={createForm.sample_reference}
                  onChange={(e) => setCreateForm({ ...createForm, sample_reference: e.target.value })}
                  className="bg-surface-container-lowest text-on-surface px-space-sm py-2 rounded border border-surface-container-high outline-none focus:border-primary"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-outline uppercase">Initial Station Notes</label>
                <textarea
                  rows={2}
                  placeholder="Enter calibration baseline or station observations..."
                  value={createForm.observations}
                  onChange={(e) => setCreateForm({ ...createForm, observations: e.target.value })}
                  className="bg-surface-container-lowest text-on-surface px-space-sm py-2 rounded border border-surface-container-high outline-none focus:border-primary"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-space-sm pt-space-xs">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-space-md py-2 rounded bg-surface-container text-outline hover:text-on-surface"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-space-md py-2 rounded bg-primary-container text-on-primary-container font-bold hover:bg-secondary-container"
                >
                  Initialize Run
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload Inspection Images */}
      {activeUploadInspectionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface-container-low border border-surface-container-high rounded-xl p-space-lg shadow-2xl flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">upload_file</span>
                <h3 className="font-headline text-headline-md font-bold text-on-surface">
                  Upload Optical Inspection Imagery
                </h3>
              </div>
              <button
                onClick={() => {
                  setActiveUploadInspectionId(null);
                  setSelectedFiles([]);
                }}
                className="p-1 rounded text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-surface-container-high hover:border-primary p-space-xl rounded-lg flex flex-col items-center justify-center cursor-pointer bg-surface-container-lowest transition-colors"
            >
              <span className="material-symbols-outlined text-[36px] text-primary mb-2">add_photo_alternate</span>
              <p className="font-mono text-body-sm text-on-surface font-semibold">
                Click to browse or drop high-resolution inspection captures
              </p>
              <p className="font-mono text-label-sm text-outline mt-1">Supports PNG, JPG, WEBP (Max 10MB each)</p>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files) setSelectedFiles(Array.from(e.target.files));
                }}
                className="hidden"
                accept="image/*"
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="flex flex-col gap-1 font-mono text-label-sm bg-surface-container p-2 rounded max-h-32 overflow-y-auto">
                <span className="text-tertiary font-bold">{selectedFiles.length} files selected:</span>
                {selectedFiles.map((f, i) => (
                  <span key={i} className="text-on-surface-variant truncate">
                    • {f.name} ({(f.size / 1024).toFixed(1)} KB)
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-space-sm pt-space-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveUploadInspectionId(null);
                  setSelectedFiles([]);
                }}
                className="px-space-md py-2 rounded bg-surface-container text-outline hover:text-on-surface font-mono"
              >
                Skip / Later
              </button>
              <button
                type="button"
                disabled={selectedFiles.length === 0 || isUploading}
                onClick={handleUploadImages}
                className="px-space-md py-2 rounded bg-primary-container text-on-primary-container font-bold hover:bg-secondary-container font-mono disabled:opacity-50"
              >
                {isUploading ? 'Uploading...' : 'Upload & Run AI Inference'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
