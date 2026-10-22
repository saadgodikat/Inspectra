import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { productsApi, batchesApi } from '../api/client';
import type { Product, Batch, BatchStatus } from '../types';
import {
  Boxes, Plus, Search, Filter, Archive, RefreshCw, Edit2,
  Calendar, Layers, Building2, AlertCircle, X, CheckCircle2, Tag, Hash,
} from 'lucide-react';

export const ProductsBatchesPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'batches'>('products');

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productStatus, setProductStatus] = useState('all');

  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchStatus, setBatchStatus] = useState('all');
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>(undefined);

  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState({ product_code: '', name: '', category: '', description: '' });

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchFormData, setBatchFormData] = useState({ batch_number: '', product_id: 0, production_date: '', quantity: '', production_line: '', supplier: '' });

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [newBatchStatus, setNewBatchStatus] = useState<BatchStatus>('under_inspection');
  const [statusReason, setStatusReason] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canManageProducts = user?.role === 'quality_manager';
  const canManageBatches = user?.role === 'supervisor' || user?.role === 'quality_manager';

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await productsApi.list({ search: productSearch, status: productStatus });
      setProducts(res.products);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to fetch products');
    } finally { setLoadingProducts(false); }
  };

  const fetchBatches = async () => {
    try {
      setLoadingBatches(true);
      const res = await batchesApi.list({ search: batchSearch, status: batchStatus, product_id: selectedProductId });
      setBatches(res.batches);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to fetch batches');
    } finally { setLoadingBatches(false); }
  };

  useEffect(() => { fetchProducts(); }, [productSearch, productStatus]);
  useEffect(() => { fetchBatches(); }, [batchSearch, batchStatus, selectedProductId]);

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      if (editingProduct) {
        await productsApi.update(editingProduct.id, { name: productFormData.name, category: productFormData.category, description: productFormData.description });
        setSuccessMessage(`Product '${editingProduct.product_code}' updated`);
      } else {
        await productsApi.create(productFormData);
        setSuccessMessage(`Product '${productFormData.product_code}' registered`);
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setProductFormData({ product_code: '', name: '', category: '', description: '' });
      fetchProducts();
    } catch (err: any) { setErrorMessage(err.response?.data?.error || 'Operation failed'); }
  };

  const toggleProductArchive = async (prod: Product) => {
    try {
      if (prod.is_active) { await productsApi.archive(prod.id); setSuccessMessage(`Product '${prod.product_code}' archived`); }
      else { await productsApi.unarchive(prod.id); setSuccessMessage(`Product '${prod.product_code}' restored`); }
      fetchProducts();
    } catch (err: any) { setErrorMessage(err.response?.data?.error || 'Archive operation failed'); }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await batchesApi.create({
        batch_number: batchFormData.batch_number,
        product_id: Number(batchFormData.product_id),
        production_date: batchFormData.production_date || undefined,
        quantity: batchFormData.quantity ? Number(batchFormData.quantity) : undefined,
        production_line: batchFormData.production_line || undefined,
        supplier: batchFormData.supplier || undefined,
      });
      setSuccessMessage(`Batch '${batchFormData.batch_number}' created`);
      setIsBatchModalOpen(false);
      setBatchFormData({ batch_number: '', product_id: 0, production_date: '', quantity: '', production_line: '', supplier: '' });
      fetchBatches();
    } catch (err: any) { setErrorMessage(err.response?.data?.error || 'Batch creation failed'); }
  };

  const handleStatusChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    try {
      await batchesApi.updateStatus(selectedBatch.id, newBatchStatus, statusReason);
      setSuccessMessage(`Batch '${selectedBatch.batch_number}' transitioned to ${newBatchStatus}`);
      setIsStatusModalOpen(false);
      setSelectedBatch(null);
      setStatusReason('');
      fetchBatches();
    } catch (err: any) { setErrorMessage(err.response?.data?.error || 'Failed to update batch status'); }
  };

  const handleArchiveBatch = async (batch: Batch) => {
    if (!confirm(`Archive batch '${batch.batch_number}'?`)) return;
    try {
      await batchesApi.archive(batch.id);
      setSuccessMessage(`Batch '${batch.batch_number}' archived`);
      fetchBatches();
    } catch (err: any) { setErrorMessage(err.response?.data?.error || 'Failed to archive batch'); }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, string> = {
      created: 'bg-surface-container text-on-surface-variant border-surface-container-high',
      in_production: 'bg-tertiary/10 text-tertiary border-tertiary/30',
      produced: 'bg-primary/10 text-primary border-primary/30',
      under_inspection: 'bg-tertiary/15 text-tertiary border-tertiary/30',
      on_hold: 'bg-primary/15 text-primary border-primary/30',
      released: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      archived: 'bg-surface-container text-outline border-surface-container-high',
    };
    const cls = map[status] ?? map.archived;
    return <span className={`px-2 py-0.5 rounded text-label-sm font-mono border ${cls}`}>{status.replace(/_/g, ' ').toUpperCase()}</span>;
  };

  const inputCls = 'w-full px-3 py-2 bg-surface-container-lowest border border-surface-container-high rounded-lg text-body-md text-on-surface placeholder-outline focus:outline-none focus:border-primary';
  const selectCls = 'bg-surface-container-lowest border border-surface-container-high text-body-md text-on-surface rounded-lg px-3 py-2 focus:outline-none focus:border-primary';
  const labelCls = 'block text-label-sm text-outline font-mono uppercase mb-1';

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-error-container/20 border border-error/30 text-error text-body-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{errorMessage}</span></div>
          <button onClick={() => setErrorMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-body-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 flex-shrink-0" /><span>{successMessage}</span></div>
          <button onClick={() => setSuccessMessage(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Page Header */}
      <div className="relative rounded-2xl overflow-hidden bg-surface-container-lowest border border-surface-container-high p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded bg-primary/15 border border-primary/30 text-primary text-label-sm font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Boxes className="w-3 h-3" /> CATALOG
              </span>
            </div>
            <h1 className="text-headline-lg font-headline text-on-surface font-bold">Products &amp; Batches Workspace</h1>
            <p className="text-body-md text-on-surface-variant mt-1">Manufacturing catalog, batch traceability, and lifecycle status management.</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Tab switcher */}
            <div className="flex bg-surface-container border border-surface-container-high rounded-xl p-1">
              {(['products', 'batches'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-label-sm font-mono uppercase tracking-wider transition-all ${
                    activeTab === tab
                      ? 'bg-primary text-on-primary shadow-md'
                      : 'text-outline hover:text-on-surface'
                  }`}
                >
                  {tab === 'products' ? `Products (${products.length})` : `Batches (${batches.length})`}
                </button>
              ))}
            </div>

            {activeTab === 'products' && canManageProducts && (
              <button
                onClick={() => { setEditingProduct(null); setProductFormData({ product_code: '', name: '', category: '', description: '' }); setIsProductModalOpen(true); }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-label-sm font-semibold transition-all shadow-md"
              >
                <Plus className="w-4 h-4" /> Add Product
              </button>
            )}
            {activeTab === 'batches' && canManageBatches && (
              <button
                onClick={() => { const ap = products.filter(p => p.is_active); setBatchFormData({ batch_number: '', product_id: ap[0]?.id ?? 0, production_date: new Date().toISOString().split('T')[0], quantity: '', production_line: '', supplier: '' }); setIsBatchModalOpen(true); }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary text-label-sm font-semibold transition-all shadow-md"
              >
                <Plus className="w-4 h-4" /> Register Batch
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-surface-container-lowest border border-surface-container-high p-3 rounded-xl">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
              <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search by product code, name..." className={`${inputCls} pl-9`} />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-outline" />
              <select value={productStatus} onChange={e => setProductStatus(e.target.value)} className={selectCls}>
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="archived">Archived Only</option>
              </select>
            </div>
          </div>

          {/* Product Grid */}
          {loadingProducts ? (
            <div className="p-12 text-center">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <span className="text-body-sm text-outline font-mono">Loading products…</span>
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center bg-surface-container-lowest border border-surface-container-high rounded-xl">
              <Boxes className="w-10 h-10 text-outline mx-auto mb-2" />
              <p className="text-body-lg font-semibold text-on-surface">No products found</p>
              <p className="text-body-sm text-outline mt-1">Adjust your search or register a new product.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(prod => (
                <div key={prod.id} className={`p-5 rounded-xl border transition-all ${prod.is_active ? 'bg-surface-container-lowest border-surface-container-high hover:border-outline-variant/40' : 'bg-surface-container border-surface-container-high opacity-60'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-label-sm font-mono font-bold bg-primary/10 text-primary border border-primary/20">{prod.product_code}</span>
                    <span className={`px-2 py-0.5 rounded-full text-label-sm font-mono ${prod.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-surface-container text-outline border-surface-container-high'}`}>
                      {prod.is_active ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  <h3 className="text-body-lg font-bold text-on-surface mb-1">{prod.name}</h3>
                  {prod.category && (
                    <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant mb-2">
                      <Tag className="w-3 h-3 text-outline" /><span>{prod.category}</span>
                    </div>
                  )}
                  {prod.description && <p className="text-body-sm text-outline line-clamp-2 mb-4 leading-relaxed">{prod.description}</p>}
                  <div className="pt-3 border-t border-surface-container-high flex items-center justify-between text-body-sm text-outline">
                    <span><span className="font-semibold text-on-surface">{prod.batch_count ?? 0}</span> batches</span>
                    {canManageProducts && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingProduct(prod); setProductFormData({ product_code: prod.product_code, name: prod.name, category: prod.category || '', description: prod.description || '' }); setIsProductModalOpen(true); }} className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => toggleProductArchive(prod)} className={`p-1.5 rounded-lg transition-colors ${prod.is_active ? 'text-outline hover:text-error hover:bg-error-container/20' : 'text-outline hover:text-emerald-400 hover:bg-emerald-500/10'}`} title={prod.is_active ? 'Archive' : 'Restore'}>
                          {prod.is_active ? <Archive className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* BATCHES TAB */}
      {activeTab === 'batches' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-surface-container-lowest border border-surface-container-high p-3 rounded-xl">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
              <input type="text" value={batchSearch} onChange={e => setBatchSearch(e.target.value)} placeholder="Search batch number, line, supplier..." className={`${inputCls} pl-9`} />
            </div>
            <select value={selectedProductId || ''} onChange={e => setSelectedProductId(e.target.value ? Number(e.target.value) : undefined)} className={selectCls}>
              <option value="">All Products</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.product_code} — {p.name}</option>)}
            </select>
            <select value={batchStatus} onChange={e => setBatchStatus(e.target.value)} className={selectCls}>
              <option value="all">All Statuses</option>
              <option value="created">Created</option>
              <option value="in_production">In Production</option>
              <option value="produced">Produced</option>
              <option value="under_inspection">Under Inspection</option>
              <option value="on_hold">On Hold</option>
              <option value="released">Released</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Batches Table */}
          <div className="bg-surface-container-lowest border border-surface-container-high rounded-xl overflow-hidden">
            {loadingBatches ? (
              <div className="p-12 text-center">
                <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-3" />
                <span className="text-body-sm text-outline font-mono">Loading batches…</span>
              </div>
            ) : batches.length === 0 ? (
              <div className="p-12 text-center text-outline text-body-sm font-mono">No batches found matching the filters.</div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-surface-container-high bg-surface-container/40">
                    <th className="py-3 px-5 text-label-sm font-mono text-outline uppercase tracking-wider">Batch ID</th>
                    <th className="py-3 px-5 text-label-sm font-mono text-outline uppercase tracking-wider">Product</th>
                    <th className="py-3 px-5 text-label-sm font-mono text-outline uppercase tracking-wider">Status</th>
                    <th className="py-3 px-5 text-label-sm font-mono text-outline uppercase tracking-wider">Production</th>
                    <th className="py-3 px-5 text-label-sm font-mono text-outline uppercase tracking-wider">Supplier / Line</th>
                    {canManageBatches && <th className="py-3 px-5 text-label-sm font-mono text-outline uppercase tracking-wider text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/60">
                  {batches.map(batch => (
                    <tr key={batch.id} className="hover:bg-surface-container/30 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-mono font-bold text-on-surface flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 text-primary" />{batch.batch_number}</div>
                        <div className="text-label-sm text-outline font-mono mt-0.5">ID: {batch.id}</div>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="text-body-md text-on-surface">{batch.product?.name || 'Unknown'}</div>
                        <div className="text-label-sm text-primary font-mono">{batch.product?.product_code}</div>
                      </td>
                      <td className="py-3.5 px-5">{getStatusBadge(batch.status)}</td>
                      <td className="py-3.5 px-5 text-on-surface-variant">
                        <div className="flex items-center gap-1.5 text-body-sm"><Calendar className="w-3 h-3 text-outline" />{batch.production_date || 'N/A'}</div>
                        <div className="text-label-sm text-outline mt-0.5">Qty: <span className="text-on-surface-variant font-semibold">{batch.quantity?.toLocaleString() ?? 'N/A'}</span></div>
                      </td>
                      <td className="py-3.5 px-5 text-on-surface-variant">
                        {batch.supplier && <div className="flex items-center gap-1.5 text-body-sm"><Building2 className="w-3 h-3 text-outline" />{batch.supplier}</div>}
                        {batch.production_line && <div className="flex items-center gap-1.5 text-label-sm text-outline mt-0.5"><Layers className="w-3 h-3" />{batch.production_line}</div>}
                        {!batch.supplier && !batch.production_line && <span className="text-outline">—</span>}
                      </td>
                      {canManageBatches && (
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => { setSelectedBatch(batch); setNewBatchStatus(batch.status); setIsStatusModalOpen(true); }} className="px-2.5 py-1 rounded-lg text-label-sm font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface border border-surface-container-high transition-all">
                              Transition
                            </button>
                            {batch.status !== 'archived' && (
                              <button onClick={() => handleArchiveBatch(batch)} className="p-1.5 rounded-lg text-outline hover:text-error hover:bg-error-container/20 transition-colors" title="Archive">
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-surface-container-high rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high mb-4">
              <h3 className="text-body-lg font-bold text-on-surface">{editingProduct ? 'Edit Product' : 'Register New Product'}</h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-outline hover:text-on-surface"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Product Code</label>
                <input type="text" required disabled={!!editingProduct} value={productFormData.product_code} onChange={e => setProductFormData({ ...productFormData, product_code: e.target.value.toUpperCase() })} placeholder="e.g. PRD-AUTO-001" className={`${inputCls} font-mono uppercase disabled:opacity-50`} />
              </div>
              <div>
                <label className={labelCls}>Product Name</label>
                <input type="text" required value={productFormData.name} onChange={e => setProductFormData({ ...productFormData, name: e.target.value })} placeholder="e.g. Precision Transmission Gear" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <input type="text" value={productFormData.category} onChange={e => setProductFormData({ ...productFormData, category: e.target.value })} placeholder="e.g. Machined Parts" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Description</label>
                <textarea rows={3} value={productFormData.description} onChange={e => setProductFormData({ ...productFormData, description: e.target.value })} placeholder="Specifications, surface requirements..." className={inputCls} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="px-4 py-2 rounded-xl text-body-sm text-outline hover:bg-surface-container-high transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl text-body-sm font-semibold bg-primary hover:bg-primary/90 text-on-primary shadow-md transition-all">{editingProduct ? 'Save Changes' : 'Create Product'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BATCH MODAL */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-surface-container-high rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high mb-4">
              <h3 className="text-body-lg font-bold text-on-surface">Register Production Batch</h3>
              <button onClick={() => setIsBatchModalOpen(false)} className="text-outline hover:text-on-surface"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleBatchSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Batch Number</label>
                <input type="text" required value={batchFormData.batch_number} onChange={e => setBatchFormData({ ...batchFormData, batch_number: e.target.value.toUpperCase() })} placeholder="e.g. BAT-2026-X1" className={`${inputCls} font-mono uppercase`} />
              </div>
              <div>
                <label className={labelCls}>Product</label>
                <select required value={batchFormData.product_id} onChange={e => setBatchFormData({ ...batchFormData, product_id: Number(e.target.value) })} className={`${selectCls} w-full`}>
                  {products.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.product_code} — {p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Production Date</label>
                  <input type="date" value={batchFormData.production_date} onChange={e => setBatchFormData({ ...batchFormData, production_date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Quantity</label>
                  <input type="number" min="1" value={batchFormData.quantity} onChange={e => setBatchFormData({ ...batchFormData, quantity: e.target.value })} placeholder="e.g. 500" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Production Line</label>
                <input type="text" value={batchFormData.production_line} onChange={e => setBatchFormData({ ...batchFormData, production_line: e.target.value })} placeholder="e.g. Assembly Line 3" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Supplier / Vendor</label>
                <input type="text" value={batchFormData.supplier} onChange={e => setBatchFormData({ ...batchFormData, supplier: e.target.value })} placeholder="e.g. Apex Castings Ltd." className={inputCls} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsBatchModalOpen(false)} className="px-4 py-2 rounded-xl text-body-sm text-outline hover:bg-surface-container-high transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl text-body-sm font-semibold bg-primary hover:bg-primary/90 text-on-primary shadow-md transition-all">Create Batch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STATUS MODAL */}
      {isStatusModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-surface-container-low border border-surface-container-high rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high mb-4">
              <div>
                <h3 className="text-body-lg font-bold text-on-surface">Transition Batch Status</h3>
                <p className="text-label-sm text-outline font-mono mt-0.5">{selectedBatch.batch_number}</p>
              </div>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-outline hover:text-on-surface"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleStatusChangeSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>New Status</label>
                <select value={newBatchStatus} onChange={e => setNewBatchStatus(e.target.value as BatchStatus)} className={`${selectCls} w-full`}>
                  <option value="created">Created</option>
                  <option value="in_production">In Production</option>
                  <option value="produced">Produced</option>
                  <option value="under_inspection">Under Inspection</option>
                  <option value="archived">Archived</option>
                </select>
                <p className="text-label-sm text-outline mt-1 font-mono">Hold / Release decisions are managed in the Batch Decisions workflow.</p>
              </div>
              <div>
                <label className={labelCls}>Reason / Notes</label>
                <textarea rows={3} value={statusReason} onChange={e => setStatusReason(e.target.value)} placeholder="e.g. Production complete, moving to inspection..." className={inputCls} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsStatusModalOpen(false)} className="px-4 py-2 rounded-xl text-body-sm text-outline hover:bg-surface-container-high transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl text-body-sm font-semibold bg-primary hover:bg-primary/90 text-on-primary shadow-md transition-all">Apply Status</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
