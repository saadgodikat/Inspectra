import React, { useEffect, useState, useRef } from 'react';
import { inspectionsApi, productsApi, batchesApi } from '../api/client';
import type { Inspection, InspectionImage, Product, Batch, SampleType, InspectionStatus } from '../types';
import {
  Camera,
  Plus,
  Search,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowLeft,
  FileText,
  Hash,
  Eye,
  RefreshCw,
  Shield,
  Copy,
  Check,
} from 'lucide-react';

export const InspectionsPage: React.FC = () => {

  // State
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sampleTypeFilter, setSampleTypeFilter] = useState('all');
  const [productIdFilter, setProductIdFilter] = useState<number | undefined>(undefined);

  // Products and Batches for dropdowns
  const [products, setProducts] = useState<Product[]>([]);
  const [batchesForSelectedProduct, setBatchesForSelectedProduct] = useState<Batch[]>([]);

  // Create Modal State
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

  // Draft Edit State
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [draftObservations, setDraftObservations] = useState('');
  const [draftSampleRef, setDraftSampleRef] = useState('');

  // Image Upload State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{
    succeeded: InspectionImage[];
    failed: Array<{ filename: string; error: string }>;
  } | null>(null);

  // Secure Image Blob Cache for display
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({});
  const [previewingImage, setPreviewingImage] = useState<InspectionImage | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  // Notifications
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Inspections
  const fetchInspections = async () => {
    try {
      setLoading(true);
      const res = await inspectionsApi.list({
        search,
        status: statusFilter,
        sample_type: sampleTypeFilter,
        product_id: productIdFilter,
      });
      setInspections(res.inspections);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to load inspections');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Products
  const fetchProducts = async () => {
    try {
      const res = await productsApi.list({ status: 'active' });
      setProducts(res.products);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchInspections();
  }, [search, statusFilter, sampleTypeFilter, productIdFilter]);

  // Handle cascading batches when product is selected in create form
  useEffect(() => {
    if (createForm.product_id) {
      batchesApi
        .list({ product_id: createForm.product_id, status: 'all' })
        .then((res) => {
          const activeBatches = res.batches.filter((b) => b.status !== 'archived');
          setBatchesForSelectedProduct(activeBatches);
          if (activeBatches.length > 0) {
            setCreateForm((prev) => ({ ...prev, batch_id: activeBatches[0].id }));
          } else {
            setCreateForm((prev) => ({ ...prev, batch_id: 0 }));
          }
        })
        .catch(() => setBatchesForSelectedProduct([]));
    } else {
      setBatchesForSelectedProduct([]);
    }
  }, [createForm.product_id]);

  // Load blobs for inspection images securely
  useEffect(() => {
    if (!selectedInspection?.images) return;
    selectedInspection.images.forEach((img) => {
      if (!imageUrls[img.id]) {
        inspectionsApi
          .getImageBlobUrl(selectedInspection.id, img.id)
          .then((url) => {
            setImageUrls((prev) => ({ ...prev, [img.id]: url }));
          })
          .catch(() => {
            // Error loading image blob
          });
      }
    });
  }, [selectedInspection]);

  // Create Inspection Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      const res = await inspectionsApi.create({
        product_id: Number(createForm.product_id),
        batch_id: Number(createForm.batch_id),
        sample_reference: createForm.sample_reference,
        sample_type: createForm.sample_type,
        observations: createForm.observations,
      });
      setSuccessMessage(`Inspection #${res.inspection.id} created successfully`);
      setIsCreateModalOpen(false);
      fetchInspections();
      // Directly open the created inspection so inspector can upload images
      handleSelectInspection(res.inspection);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to create inspection');
    }
  };

  // Select Inspection for Detail View
  const handleSelectInspection = async (insp: Inspection) => {
    try {
      const res = await inspectionsApi.get(insp.id);
      setSelectedInspection(res.inspection);
      setDraftObservations(res.inspection.observations || '');
      setDraftSampleRef(res.inspection.sample_reference || '');
      setIsEditingDraft(false);
      setSelectedFiles([]);
      setUploadResults(null);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to load inspection details');
    }
  };

  // Save Draft Corrections
  const handleSaveDraft = async () => {
    if (!selectedInspection) return;
    try {
      const res = await inspectionsApi.updateDraft(selectedInspection.id, {
        observations: draftObservations,
        sample_reference: draftSampleRef,
      });
      setSelectedInspection(res.inspection);
      setIsEditingDraft(false);
      setSuccessMessage('Draft corrections saved successfully');
      fetchInspections();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to save draft');
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Upload Images Submit
  const handleUploadImages = async () => {
    if (!selectedInspection || selectedFiles.length === 0) return;
    setIsUploading(true);
    setErrorMessage(null);
    try {
      const res = await inspectionsApi.uploadImages(selectedInspection.id, selectedFiles);
      setUploadResults({
        succeeded: res.succeeded,
        failed: res.failed,
      });
      setSelectedFiles([]);
      setSuccessMessage(
        `Uploaded ${res.total_uploaded} image(s). Status: ${res.inspection.status}`
      );
      // Reload inspection details to show new gallery
      const updated = await inspectionsApi.get(selectedInspection.id);
      setSelectedInspection(updated.inspection);
      fetchInspections();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getStatusBadge = (status: InspectionStatus | string) => {
    switch (status) {
      case 'pending_upload':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            Pending Upload
          </span>
        );
      case 'processing':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
            Processing
          </span>
        );
      case 'pending_review':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            Pending Review
          </span>
        );
      case 'reviewed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Reviewed
          </span>
        );
      case 'needs_more_evidence':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Needs Evidence
          </span>
        );
      case 'processing_failed':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            Failed
          </span>
        );
    }
  };

  const getSampleTypeBadge = (type: string) => {
    switch (type) {
      case 'surface':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">Surface</span>;
      case 'batch_sample':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">Batch Sample</span>;
      case 'item':
      default:
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Single Item</span>;
    }
  };

  // Compute metrics
  const totalCount = inspections.length;
  const pendingUploadCount = inspections.filter((i) => i.status === 'pending_upload').length;
  const pendingReviewCount = inspections.filter((i) => i.status === 'pending_review').length;
  const reviewedCount = inspections.filter((i) => i.status === 'reviewed').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Alert Banners */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* DETAIL VIEW */}
      {selectedInspection ? (
        <div className="space-y-6 animate-fadeIn">
          {/* Detail Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedInspection(null)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                title="Back to Inspection List"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Camera className="w-5 h-5 text-indigo-400" />
                    Inspection #{selectedInspection.id}
                  </h2>
                  {getStatusBadge(selectedInspection.status)}
                  {getSampleTypeBadge(selectedInspection.sample_type)}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Recorded at {new Date(selectedInspection.inspection_timestamp).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSelectInspection(selectedInspection)}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                title="Refresh Inspection"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inspection Metadata Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">
                Product Details
              </div>
              <div className="font-bold text-white text-sm">
                {selectedInspection.product?.name || 'Unknown Product'}
              </div>
              <div className="text-xs font-mono text-indigo-400 mt-0.5">
                {selectedInspection.product?.product_code}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Category: {selectedInspection.product?.category || 'Standard'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">
                Batch & Production
              </div>
              <div className="font-bold text-white text-sm flex items-center gap-1.5 font-mono">
                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                {selectedInspection.batch?.batch_number || 'Unknown Batch'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Line: {selectedInspection.batch?.production_line || 'Standard Line'}
              </div>
              <div className="text-xs text-slate-400">
                Supplier: {selectedInspection.batch?.supplier || 'In-House'}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">
                Inspector & Evidence Status
              </div>
              <div className="font-bold text-white text-sm">
                {selectedInspection.inspector?.name || 'Inspector'}
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                {selectedInspection.inspector?.email}
              </div>
              <div className="text-xs text-cyan-400 mt-1 font-medium">
                {selectedInspection.image_count} photographic evidence file(s)
              </div>
            </div>
          </div>

          {/* Observations & Draft Corrections */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Observations & Sample Reference</h3>
              </div>
              {['pending_upload', 'needs_more_evidence', 'processing_failed'].includes(
                selectedInspection.status
              ) && !isEditingDraft && (
                <button
                  onClick={() => setIsEditingDraft(true)}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                >
                  Edit Draft
                </button>
              )}
            </div>

            {isEditingDraft ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Sample Reference Identifier
                  </label>
                  <input
                    type="text"
                    value={draftSampleRef}
                    onChange={(e) => setDraftSampleRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Visual Observations
                  </label>
                  <textarea
                    rows={3}
                    value={draftObservations}
                    onChange={(e) => setDraftObservations(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsEditingDraft(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveDraft}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    Save Draft Corrections
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Sample Reference:</span>{' '}
                  <span className="text-slate-200 font-mono font-medium">
                    {selectedInspection.sample_reference || 'N/A (Standard Item Sample)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Sample Type:</span>{' '}
                  <span className="text-slate-200 capitalize font-medium">
                    {selectedInspection.sample_type.replace('_', ' ')}
                  </span>
                </div>
                <div className="md:col-span-2 pt-2 border-t border-slate-800/40">
                  <span className="text-slate-500 block mb-1">Visual Observations:</span>
                  <p className="text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
                    {selectedInspection.observations || 'No additional observations recorded.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Evidence Upload & Gallery Section */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm space-y-6">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  Photographic Evidence Gallery ({selectedInspection.images?.length || 0})
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                SHA-256 Verified & Securely Stored
              </span>
            </div>

            {/* Upload Zone */}
            <div className="p-6 rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-950/40 text-center transition-all">
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />
              <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-white">
                Drag and drop photographic evidence here, or{' '}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-indigo-400 hover:text-indigo-300 underline"
                >
                  browse files
                </button>
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Supports genuine JPEG, PNG, and WebP (up to 16 MB per image). Validated with Pillow.
              </p>

              {/* Staged files for upload */}
              {selectedFiles.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-800/80 max-w-xl mx-auto space-y-2 text-left">
                  <div className="text-xs font-semibold text-slate-300 mb-2">
                    Staged for Upload ({selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}):
                  </div>
                  {selectedFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="text-slate-200 truncate">{f.name}</span>
                        <span className="text-slate-500 text-[10px]">({formatFileSize(f.size)})</span>
                      </div>
                      <button
                        onClick={() => removeSelectedFile(i)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={handleUploadImages}
                      disabled={isUploading}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isUploading ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Uploading & Verifying...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Submit Photographic Evidence</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Upload Breakdown Indicators */}
            {uploadResults && (
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300">Last Upload Summary:</div>
                {uploadResults.succeeded.map((s) => (
                  <div key={s.id} className="text-xs text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {s.original_filename} ({formatFileSize(s.file_size)}) — SHA-256: {s.file_hash.slice(0, 12)}...
                    </span>
                  </div>
                ))}
                {uploadResults.failed.map((f, i) => (
                  <div key={i} className="text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>
                      {f.filename} — {f.error}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Gallery Grid */}
            {!selectedInspection.images || selectedInspection.images.length === 0 ? (
              <div className="p-12 text-center bg-slate-950/30 rounded-2xl border border-slate-800/60">
                <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">No photographic evidence uploaded yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Upload component photos above. Images are stored securely and prepared for Phase 4 ML feature extraction.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {selectedInspection.images.map((img) => (
                  <div
                    key={img.id}
                    className="group bg-slate-950/60 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/40 transition-all flex flex-col"
                  >
                    {/* Thumbnail */}
                    <div
                      onClick={() => setPreviewingImage(img)}
                      className="h-48 bg-slate-900/90 relative overflow-hidden flex items-center justify-center cursor-pointer"
                    >
                      {imageUrls[img.id] ? (
                        <img
                          src={imageUrls[img.id]}
                          alt={img.original_filename}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-500">
                          <Camera className="w-8 h-8 animate-pulse text-indigo-400" />
                          <span className="text-[10px]">Loading secure stream...</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                          <Eye className="w-3.5 h-3.5" /> Inspect Evidence
                        </span>
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="p-3.5 space-y-1.5 text-xs flex-1 flex flex-col justify-between">
                      <div>
                        <div className="font-semibold text-slate-200 truncate" title={img.original_filename}>
                          {img.original_filename}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center justify-between mt-1">
                          <span>{formatFileSize(img.file_size)}</span>
                          <span className="font-mono text-slate-500">{img.content_type}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                        <span className="font-mono" title={`SHA-256: ${img.file_hash}`}>
                          SHA: {img.file_hash.slice(0, 10)}...
                        </span>
                        <span>{new Date(img.upload_timestamp).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-6">
          {/* Header & New Inspection Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
                <Camera className="w-6 h-6 text-indigo-400" />
                Quality Inspections & Evidence Capture
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Visual inspection intake pipeline with photographic evidence hashing and tracking.
              </p>
            </div>

            <button
              onClick={() => {
                const activeProds = products.filter((p) => p.is_active);
                setCreateForm({
                  product_id: activeProds.length > 0 ? activeProds[0].id : 0,
                  batch_id: 0,
                  sample_reference: '',
                  sample_type: 'item',
                  observations: '',
                });
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>New Inspection</span>
            </button>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Total Inspections
              </div>
              <div className="text-2xl font-bold text-white mt-1">{totalCount}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Pending Upload
              </div>
              <div className="text-2xl font-bold text-slate-300 mt-1">{pendingUploadCount}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Pending Review
              </div>
              <div className="text-2xl font-bold text-cyan-400 mt-1">{pendingReviewCount}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Reviewed
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{reviewedCount}</div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 backdrop-blur-sm">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reference or observations..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={productIdFilter || ''}
                onChange={(e) =>
                  setProductIdFilter(e.target.value ? Number(e.target.value) : undefined)
                }
                className="bg-slate-950/70 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product_code} — {p.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950/70 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending_upload">Pending Upload</option>
                <option value="pending_review">Pending Review</option>
                <option value="reviewed">Reviewed</option>
                <option value="needs_more_evidence">Needs Evidence</option>
                <option value="processing_failed">Processing Failed</option>
              </select>

              <select
                value={sampleTypeFilter}
                onChange={(e) => setSampleTypeFilter(e.target.value)}
                className="bg-slate-950/70 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Sample Types</option>
                <option value="item">Single Item</option>
                <option value="surface">Surface</option>
                <option value="batch_sample">Batch Sample</option>
              </select>
            </div>
          </div>

          {/* Inspections Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
            {loading ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading inspections...</div>
            ) : inspections.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/40 rounded-2xl">
                <Camera className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-300">No inspections found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Create an inspection above to begin recording photographic quality evidence.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                    <th className="py-3 px-5 font-semibold">Inspection</th>
                    <th className="py-3 px-5 font-semibold">Product & Batch</th>
                    <th className="py-3 px-5 font-semibold">Sample</th>
                    <th className="py-3 px-5 font-semibold">Inspector</th>
                    <th className="py-3 px-5 font-semibold">Status</th>
                    <th className="py-3 px-5 font-semibold">Evidence</th>
                    <th className="py-3 px-5 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {inspections.map((insp) => (
                    <tr key={insp.id} className="hover:bg-slate-800/25 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-mono font-bold text-white flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-indigo-400" />
                          INSP-{insp.id}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(insp.inspection_timestamp).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="font-medium text-slate-200">
                          {insp.product?.name || 'Unknown'}
                        </div>
                        <div className="text-[11px] text-indigo-400 font-mono">
                          {insp.batch?.batch_number || 'Batch'}
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-2">
                          {getSampleTypeBadge(insp.sample_type)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-1">
                          {insp.sample_reference || 'Ref: Standard'}
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="text-slate-200 font-medium">{insp.inspector?.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{insp.inspector?.email}</div>
                      </td>

                      <td className="py-3.5 px-5">{getStatusBadge(insp.status)}</td>

                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 text-slate-300 font-medium text-xs border border-slate-700">
                          <Camera className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{insp.image_count}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => handleSelectInspection(insp)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/15 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition-all shadow-sm"
                        >
                          View / Upload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* CREATE INSPECTION MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" />
                Create New Quality Inspection
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Product Under Inspection
                </label>
                <select
                  required
                  value={createForm.product_id}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, product_id: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  {products
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.product_code} — {p.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Associated Production Batch
                </label>
                <select
                  required
                  value={createForm.batch_id}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, batch_id: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  {batchesForSelectedProduct.length === 0 ? (
                    <option value={0}>No batches available for selected product</option>
                  ) : (
                    batchesForSelectedProduct.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.batch_number} [{b.status}]
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Sample Type
                  </label>
                  <select
                    value={createForm.sample_type}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, sample_type: e.target.value as SampleType })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="item">Single Item</option>
                    <option value="surface">Surface</option>
                    <option value="batch_sample">Batch Sample</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Sample Reference
                  </label>
                  <input
                    type="text"
                    value={createForm.sample_reference}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, sample_reference: e.target.value })
                    }
                    placeholder="e.g. SN-4921-A"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono placeholder-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Initial Visual Observations
                </label>
                <textarea
                  rows={3}
                  value={createForm.observations}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, observations: e.target.value })
                  }
                  placeholder="Record lighting condition, component orientation, or pre-inspection notes..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createForm.batch_id === 0}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 disabled:opacity-50"
                >
                  Create & Proceed to Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IMAGE DETAIL / LIGHTBOX MODAL */}
      {previewingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl relative flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold text-white text-sm">
                  {previewingImage.original_filename}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  ({formatFileSize(previewingImage.file_size)})
                </span>
              </div>
              <button
                onClick={() => setPreviewingImage(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-950/80 flex items-center justify-center max-h-[60vh] overflow-hidden">
              {imageUrls[previewingImage.id] ? (
                <img
                  src={imageUrls[previewingImage.id]}
                  alt={previewingImage.original_filename}
                  className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-lg"
                />
              ) : (
                <div className="text-slate-500 text-xs">Loading image...</div>
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-slate-300">Cryptographic Integrity:</span>
                  <span className="font-mono text-[11px] text-slate-400 truncate max-w-md">
                    {previewingImage.file_hash}
                  </span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(previewingImage.file_hash);
                    setCopiedHash(true);
                    setTimeout(() => setCopiedHash(false), 2000);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] flex items-center gap-1"
                >
                  {copiedHash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedHash ? 'Copied' : 'Copy Hash'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>MIME: {previewingImage.content_type}</span>
                <span>Uploaded: {new Date(previewingImage.upload_timestamp).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
