import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { inspectionsApi, productsApi, batchesApi } from '../api/client';
import type { Inspection, Product, Batch, SampleType, ItemsResponse, BulkUploadResult, AnalysisResult } from '../types';
import { ItemResultsPanel } from '../components/ItemResultsPanel';
import { useAuth } from '../context/AuthContext';

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
  backendInspection?: Inspection;
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError<{ error?: string; details?: Record<string, string> }>(error)) {
    return error.response?.data?.error || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

const extractItemNumber = (filename: string): number | null => {
  const stem = filename.replace(/\.[^.]+$/, '');
  const numbers = stem.match(/\d+/g);
  return numbers ? Number(numbers[numbers.length - 1]) : null;
};

export const InspectionsPage: React.FC = () => {
  const { user } = useAuth();
  const userCanOverride = user?.role === 'supervisor' || user?.role === 'quality_manager';
  // Real backend inspections state
  const [, setInspections] = useState<Inspection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batchesForSelectedProduct, setBatchesForSelectedProduct] = useState<Batch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);

  // Telemetry Console State
  const [runs, setRuns] = useState<TelemetryRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<TelemetryRun | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'progress' | 'flagged' | 'passed'>('all');
  const [stationFilter, setStationFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals & Upload state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreatingRun, setIsCreatingRun] = useState(false);
  const [createForm, setCreateForm] = useState<{
    product_id: number;
    batch_id: number;
    quantity: number;
    sample_reference: string;
    sample_type: SampleType;
    observations: string;
  }>({
    product_id: 0,
    batch_id: 0,
    quantity: 1,
    sample_reference: '',
    sample_type: 'item',
    observations: '',
  });

  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeUploadInspectionId, setActiveUploadInspectionId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Items / analysis state
  const [itemsData, setItemsData] = useState<ItemsResponse | null>(null);
  const [itemsInspectionId, setItemsInspectionId] = useState<number | null>(null);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkUploadResult | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const itemsRequestIdRef = useRef(0);

  const refreshItems = React.useCallback(async (inspectionId: number) => {
    const requestId = ++itemsRequestIdRef.current;
    setItemsLoading(true);
    setItemsError(null);
    try {
      const data = await inspectionsApi.getItems(inspectionId);
      if (requestId === itemsRequestIdRef.current) {
        setItemsData(data);
        setItemsInspectionId(inspectionId);
      }
      return data;
    } catch (error) {
      if (requestId === itemsRequestIdRef.current) {
        setItemsData(null);
        setItemsInspectionId(inspectionId);
        setItemsError(getApiErrorMessage(error, 'Failed to load inspection items.'));
      }
      return null;
    } finally {
      if (requestId === itemsRequestIdRef.current) setItemsLoading(false);
    }
  }, []);

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
          backendInspection: i,
        }));
        setRuns(backendRuns);
        if (backendRuns.length > 0) {
          setSelectedRun((current) =>
            backendRuns.find(
              (run) => run.backendInspection?.id === current?.backendInspection?.id
            ) ?? backendRuns[0]
          );
        }
      }
    } catch {
      // keep empty state
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update batches when product is selected in create form
  useEffect(() => {
    if (!createForm.product_id) {
      setBatchesForSelectedProduct([]);
      setIsLoadingBatches(false);
      setCreateForm((prev) => ({ ...prev, batch_id: 0, quantity: 1 }));
      return;
    }

    let isCurrent = true;
    setIsLoadingBatches(true);
    setBatchesForSelectedProduct([]);
    setCreateForm((prev) => ({ ...prev, batch_id: 0, quantity: 1 }));
    batchesApi
      .list({ product_id: createForm.product_id, status: 'all' })
      .then((res) => {
        if (!isCurrent) return;
        const activeBatches = res.batches.filter((b) => b.status !== 'archived');
        setBatchesForSelectedProduct(activeBatches);
        const firstBatch = activeBatches[0];
        if (firstBatch) {
          setCreateForm((prev) => ({
            ...prev,
            batch_id: firstBatch.id,
            quantity: firstBatch.quantity ?? 1,
          }));
        }
      })
      .catch(() => {
        if (isCurrent) setBatchesForSelectedProduct([]);
      })
      .finally(() => {
        if (isCurrent) setIsLoadingBatches(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [createForm.product_id]);

  useEffect(() => {
    const inspectionId = selectedRun?.backendInspection?.id;
    if (inspectionId) {
      setItemsData(null);
      setItemsInspectionId(inspectionId);
      setAnalysisResult(null);
      refreshItems(inspectionId);
    } else {
      itemsRequestIdRef.current += 1;
      setItemsData(null);
      setItemsInspectionId(null);
      setItemsLoading(false);
    }
  }, [selectedRun?.backendInspection?.id, refreshItems]);

  // Create Inspection Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsCreatingRun(true);
    let res: Awaited<ReturnType<typeof inspectionsApi.create>>;
    try {
      res = await inspectionsApi.create({
        product_id: Number(createForm.product_id),
        batch_id: Number(createForm.batch_id),
        quantity: Number(createForm.quantity),
        sample_reference: createForm.sample_reference,
        sample_type: createForm.sample_type,
        observations: createForm.observations,
      });
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Failed to create inspection run.'));
      return;
    } finally {
      setIsCreatingRun(false);
    }
    const newRun: TelemetryRun = {
      id: `INS-${res.inspection.id.toString().padStart(4, '0')}`,
      sku: res.inspection.product?.name || `PROD-${res.inspection.product_id}`,
      lot: res.inspection.batch?.batch_number
        ? `#${res.inspection.batch.batch_number}`
        : `#BATCH-${res.inspection.batch_id}`,
      inspector: res.inspection.inspector?.name || 'Authorized QA',
      avatar: res.inspection.inspector?.name ? res.inspection.inspector.name.slice(0, 2).toUpperCase() : 'QA',
      timestamp: new Date().toTimeString().split(' ')[0],
      sampleSize: `${createForm.quantity} items`,
      defects: '--',
      defectCount: 0,
      fpy: '—',
      status: 'IN-PROGRESS',
      station: 'Station Alpha - Optical SMT',
      backendInspection: res.inspection,
    };
    setRuns([newRun, ...runs]);
    setSelectedRun(newRun);
    setIsCreateModalOpen(false);
    setActiveUploadInspectionId(res.inspection.id);
    setSelectedFiles([]);
    setBulkResult(null);
    setUploadError(null);
    fetchData();
  };

  const openBulkUpload = (inspectionId: number) => {
    setActiveUploadInspectionId(inspectionId);
    setSelectedFiles([]);
    setBulkResult(null);
    setUploadError(null);
  };

  const handleBulkUpload = async () => {
    if (!activeUploadInspectionId || selectedFiles.length === 0) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const result = await inspectionsApi.bulkUpload(activeUploadInspectionId, selectedFiles);
      setBulkResult(result);
      setSelectedFiles([]);
      await refreshItems(activeUploadInspectionId);
      fetchData();
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response?.data &&
        Array.isArray((error.response.data as BulkUploadResult).errors)
      ) {
        setBulkResult(error.response.data as BulkUploadResult);
      } else {
        setUploadError(getApiErrorMessage(error, 'Image upload failed.'));
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleRunAnalysis = async (inspectionId: number) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setItemsError(null);
    try {
      const result = await inspectionsApi.runAnalysis(inspectionId);
      setAnalysisResult(result);
      await refreshItems(inspectionId);
      fetchData();
    } catch (error) {
      setItemsError(getApiErrorMessage(error, 'Analysis failed.'));
    } finally {
      setIsAnalyzing(false);
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
            onClick={() => setIsCreateModalOpen(true)}
            id="btn-new-run"
            className="bg-primary-container hover:bg-secondary-container text-on-primary-container px-space-md py-1.5 rounded-lg text-label-md font-semibold transition-all flex items-center gap-1.5 shadow-sm active:translate-y-px"
          >
            <span className="material-symbols-outlined text-[16px]">add_circle</span>
            + New Inspection Run
          </button>
        </div>
      </div>

      {/* KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
        <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">TOTAL RUNS</span>
            <span className="material-symbols-outlined text-outline text-[18px]">precision_manufacturing</span>
          </div>
          <span className="font-headline text-headline-xl text-on-surface font-mono font-bold">{runs.length}</span>
          <span className="mt-1 text-outline text-label-sm font-mono">All time inspections</span>
        </div>
        <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">IN PROGRESS</span>
            <span className="material-symbols-outlined text-outline text-[18px]">pending</span>
          </div>
          <span className="font-headline text-headline-xl text-secondary font-mono font-bold">
            {runs.filter((r) => r.status === 'IN-PROGRESS').length}
          </span>
          <span className="mt-1 text-outline text-label-sm font-mono">Active runs</span>
        </div>
        <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col justify-between shadow-sm border border-surface-container-high">
          <div className="flex items-center justify-between mb-space-sm">
            <span className="text-label-sm uppercase tracking-wider text-outline font-mono">FLAGGED / HOLD</span>
            <span className="material-symbols-outlined text-outline text-[18px]">warning</span>
          </div>
          <span className="font-headline text-headline-xl text-error font-mono font-bold">
            {runs.filter((r) => r.status === 'REJECTED / HOLD').length}
          </span>
          <span className="mt-1 text-outline text-label-sm font-mono">Require action</span>
        </div>
      </div>

      {/* Filter Tabs & Station Selector Bar */}
      <div className="bg-surface-container-low p-space-sm rounded-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-space-md border border-surface-container-high">
        <div className="flex items-center gap-space-sm bg-surface-container rounded-lg px-space-sm py-1 border border-surface-container-high w-fit">
          <span className="material-symbols-outlined text-[16px] text-outline">filter_list</span>
          <select
            aria-label="Filter inspections by status"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as typeof activeFilter)}
            className="bg-transparent text-on-surface text-body-sm focus:outline-none pr-space-md py-0.5 cursor-pointer"
          >
            <option value="all" className="bg-surface-container-highest text-on-surface">All Lots ({runs.length})</option>
            <option value="progress" className="bg-surface-container-highest text-on-surface">
              In Progress ({runs.filter((r) => r.status === 'IN-PROGRESS').length})
            </option>
            <option value="flagged" className="bg-surface-container-highest text-on-surface">
              Flagged for Hold ({runs.filter((r) => r.status === 'REJECTED / HOLD').length})
            </option>
            <option value="passed" className="bg-surface-container-highest text-on-surface">
              Passed ({runs.filter((r) => r.status === 'PASSED').length})
            </option>
          </select>
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

      {/* Inspection Runs Table */}
      <div className="w-full bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-surface-container-high">
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
                  const isSelected = selectedRun?.id === run.id;
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
                          {run.backendInspection && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRun(run);
                                openBulkUpload(run.backendInspection.id);
                              }}
                              className="p-1 rounded hover:bg-surface-bright text-primary"
                              title="Bulk upload item images"
                            >
                              <span className="material-symbols-outlined text-[16px]">upload</span>
                            </button>
                          )}

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

      {selectedRun?.backendInspection && (
        <section className="flex flex-col gap-space-md bg-surface-container-low p-space-md rounded-xl border border-surface-container-high">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
            <div>
              <h2 className="font-headline text-headline-md text-on-surface font-semibold">
                Item Analysis Results
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                Inspection {selectedRun.id}: upload one image per item, then run analysis.
              </p>
            </div>
            <div className="flex items-center gap-space-sm">
              <button
                onClick={() => openBulkUpload(selectedRun.backendInspection!.id)}
                className="px-space-md py-2 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface text-label-md font-semibold"
              >
                Bulk Upload Images
              </button>
              <button
                onClick={() => handleRunAnalysis(selectedRun.backendInspection!.id)}
                disabled={isAnalyzing || !itemsData?.items.some((item) => item.status === 'uploaded')}
                className="px-space-md py-2 rounded bg-primary-container hover:bg-secondary-container text-on-primary-container text-label-md font-bold disabled:opacity-50"
              >
                {isAnalyzing ? 'Analyzing…' : 'Run Analysis'}
              </button>
            </div>
          </div>

          {analysisResult && (
            <p role="status" className="text-body-sm text-tertiary">
              Analysis complete: {analysisResult.analyzed} analyzed — {analysisResult.good} good —{' '}
              {analysisResult.defective} defective — {analysisResult.pending_upload} pending upload
              {analysisResult.failed > 0 ? ` — ${analysisResult.failed} failed in this run` : ''}.
            </p>
          )}
          {itemsLoading && (
            <p className="text-body-sm text-outline" role="status">Loading item results…</p>
          )}
          {itemsError && (
            <p className="text-body-sm text-error" role="alert">{itemsError}</p>
          )}
          {itemsData && itemsInspectionId === selectedRun.backendInspection.id && (
            itemsData.items.length > 0 ? (
              <ItemResultsPanel
                inspectionId={selectedRun.backendInspection.id}
                summary={itemsData.summary}
                items={itemsData.items}
                canOverride={userCanOverride}
                onRefresh={() => refreshItems(selectedRun.backendInspection!.id)}
              />
            ) : (
              <p className="text-body-sm text-outline">
                No item slots were allocated. Register a batch quantity before creating the inspection.
              </p>
            )
          )}
        </section>
      )}

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
              {formError && <p role="alert" className="text-error">{formError}</p>}
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-sm">
                <div className="flex flex-col gap-1">
                  <label className="text-label-sm text-outline uppercase">Target Batch Lot</label>
                  <select
                    value={createForm.batch_id}
                    onChange={(e) => {
                      const batchId = Number(e.target.value);
                      const selectedBatch = batchesForSelectedProduct.find((batch) => batch.id === batchId);
                      setCreateForm({
                        ...createForm,
                        batch_id: batchId,
                        quantity: selectedBatch?.quantity ?? 1,
                      });
                    }}
                    className="bg-surface-container-lowest text-on-surface px-space-sm py-2 rounded border border-surface-container-high outline-none"
                  >
                    <option value={0}>{isLoadingBatches ? 'Loading batches…' : '-- Select Lot --'}</option>
                    {batchesForSelectedProduct.map((b) => (
                      <option key={b.id} value={b.id}>
                        #{b.batch_number} ({b.quantity ?? 'quantity not set'})
                      </option>
                    ))}
                    {!isLoadingBatches && batchesForSelectedProduct.length === 0 && (
                      <option value={0} disabled>No batches available</option>
                    )}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-label-sm text-outline uppercase">Inspection Quantity</label>
                  <input
                    type="number"
                    min={1}
                    max={batchesForSelectedProduct.find((b) => b.id === createForm.batch_id)?.quantity ?? undefined}
                    required
                    value={createForm.quantity}
                    onChange={(e) => setCreateForm({ ...createForm, quantity: Number(e.target.value) })}
                    className="bg-surface-container-lowest text-on-surface px-space-sm py-2 rounded border border-surface-container-high outline-none"
                  />
                  <span className="text-label-sm text-outline">Number of item slots to inspect.</span>
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
                  disabled={isCreatingRun || isLoadingBatches || !createForm.batch_id}
                  className="px-space-md py-2 rounded bg-primary-container text-on-primary-container font-bold hover:bg-secondary-container"
                >
                  {isCreatingRun ? 'Initializing…' : 'Initialize Run'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload Inspection Images */}
      {activeUploadInspectionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-container-low border border-surface-container-high rounded-xl p-space-lg shadow-2xl flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-sm border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">upload_file</span>
                <h3 className="font-headline text-headline-md font-bold text-on-surface">
                  Bulk Upload Item Images
                </h3>
              </div>
              <button
                onClick={() => {
                  setActiveUploadInspectionId(null);
                  setSelectedFiles([]);
                  setBulkResult(null);
                  setUploadError(null);
                }}
                className="p-1 rounded text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <p className="text-body-sm text-on-surface-variant">
              Choose a folder or multiple images. Each filename must contain its item number, such as
              <span className="font-mono text-on-surface"> 059.jpg</span> or
              <span className="font-mono text-on-surface"> casting_059.png</span>.
            </p>
            <div className="flex flex-wrap gap-space-sm">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-space-md py-2 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface text-label-md">
                Choose images
              </button>
              <button type="button" onClick={() => folderInputRef.current?.click()} className="px-space-md py-2 rounded bg-surface-container-high hover:bg-surface-bright text-on-surface text-label-md">
                Choose folder
              </button>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files) setSelectedFiles(Array.from(e.target.files));
                  setBulkResult(null);
                  setUploadError(null);
                }}
                className="hidden"
                accept="image/*"
              />
              <input
                type="file"
                multiple
                ref={(node) => {
                  folderInputRef.current = node;
                  node?.setAttribute('webkitdirectory', '');
                }}
                onChange={(e) => {
                  if (e.target.files) setSelectedFiles(Array.from(e.target.files));
                  setBulkResult(null);
                  setUploadError(null);
                }}
                className="hidden"
                accept="image/*"
              />
            </div>

            {selectedFiles.length > 0 && (
              <div className="flex flex-col gap-1 font-mono text-label-sm bg-surface-container p-space-sm rounded max-h-48 overflow-y-auto">
                <span className="text-on-surface font-bold">{selectedFiles.length} files selected:</span>
                {selectedFiles.map((file, index) => {
                  const itemNumber = extractItemNumber(file.name);
                  const isChecking = itemsLoading || itemsInspectionId !== activeUploadInspectionId || !itemsData;
                  const allocated = !isChecking && itemsData.items.some((item) => item.item_number === itemNumber);
                  const duplicate = itemNumber !== null &&
                    selectedFiles.slice(0, index).some((prior) => extractItemNumber(prior.name) === itemNumber);
                  const matched = itemNumber !== null && allocated && !duplicate;
                  const checking = itemNumber !== null && isChecking;
                  const message = itemNumber === null
                    ? 'Rename to match item number.'
                    : duplicate
                    ? `Duplicate image for item ${itemNumber}.`
                    : checking
                    ? `Checking allocation for item ${itemNumber}…`
                    : allocated
                    ? `Matched to item ${itemNumber}.`
                    : `Item ${itemNumber} is not allocated. Rename to match item number.`;
                  return (
                    <div key={`${file.name}-${index}`} className={`flex items-start gap-2 ${checking ? 'text-outline' : matched ? 'text-tertiary' : 'text-error'}`}>
                      <span aria-hidden="true">{checking ? '…' : matched ? '✓' : '✕'}</span>
                      <span className="min-w-0 break-all">{file.name} — {message}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {itemsLoading && <p className="text-label-sm text-outline">Loading allocated item numbers…</p>}
            {uploadError && <p role="alert" className="text-body-sm text-error">{uploadError}</p>}
            {bulkResult && (
              <div role="status" className="flex flex-col gap-1 text-body-sm">
                <span className="text-tertiary">{bulkResult.total_uploaded} image(s) uploaded.</span>
                {bulkResult.errors.map((result, index) => (
                  <span key={`${result.filename}-${index}`} className="text-error">
                    {result.filename}: {result.error}
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
                  setBulkResult(null);
                  setUploadError(null);
                }}
                className="px-space-md py-2 rounded bg-surface-container text-outline hover:text-on-surface font-mono"
              >
                Skip / Later
              </button>
              <button
                type="button"
                disabled={selectedFiles.length === 0 || isUploading}
                onClick={handleBulkUpload}
                className="px-space-md py-2 rounded bg-primary-container text-on-primary-container font-bold hover:bg-secondary-container font-mono disabled:opacity-50"
              >
                {isUploading ? 'Uploading…' : 'Upload Images'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
