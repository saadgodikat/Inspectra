import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { productsApi, batchesApi } from '../api/client';
import type { Product, Batch, BatchStatus } from '../types';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Archive,
  RefreshCw,
  Edit2,
  Calendar,
  Layers,
  Building2,
  AlertCircle,
  X,
  CheckCircle2,
  Tag,
  Hash,
} from 'lucide-react';

export const ProductsBatchesPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'products' | 'batches'>('products');

  // Products state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productStatus, setProductStatus] = useState('all');

  // Batches state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');
  const [batchStatus, setBatchStatus] = useState('all');
  const [selectedProductId, setSelectedProductId] = useState<number | undefined>(undefined);

  // Modals & Form states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState({
    product_code: '',
    name: '',
    category: '',
    description: '',
  });

  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [batchFormData, setBatchFormData] = useState({
    batch_number: '',
    product_id: 0,
    production_date: '',
    quantity: '',
    production_line: '',
    supplier: '',
  });

  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [newBatchStatus, setNewBatchStatus] = useState<BatchStatus>('under_inspection');
  const [statusReason, setStatusReason] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Permissions
  const canManageProducts = user?.role === 'quality_manager';
  const canManageBatches = user?.role === 'supervisor' || user?.role === 'quality_manager';

  // Load products
  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const res = await productsApi.list({
        search: productSearch,
        status: productStatus,
      });
      setProducts(res.products);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to fetch products');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load batches
  const fetchBatches = async () => {
    try {
      setLoadingBatches(true);
      const res = await batchesApi.list({
        search: batchSearch,
        status: batchStatus,
        product_id: selectedProductId,
      });
      setBatches(res.batches);
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to fetch batches');
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [productSearch, productStatus]);

  useEffect(() => {
    fetchBatches();
  }, [batchSearch, batchStatus, selectedProductId]);

  // Product submit
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      if (editingProduct) {
        await productsApi.update(editingProduct.id, {
          name: productFormData.name,
          category: productFormData.category,
          description: productFormData.description,
        });
        setSuccessMessage(`Product '${editingProduct.product_code}' updated successfully`);
      } else {
        await productsApi.create(productFormData);
        setSuccessMessage(`Product '${productFormData.product_code}' registered`);
      }
      setIsProductModalOpen(false);
      setEditingProduct(null);
      setProductFormData({ product_code: '', name: '', category: '', description: '' });
      fetchProducts();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Operation failed');
    }
  };

  // Archive / unarchive product
  const toggleProductArchive = async (prod: Product) => {
    try {
      if (prod.is_active) {
        await productsApi.archive(prod.id);
        setSuccessMessage(`Product '${prod.product_code}' archived`);
      } else {
        await productsApi.unarchive(prod.id);
        setSuccessMessage(`Product '${prod.product_code}' restored`);
      }
      fetchProducts();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Archive operation failed');
    }
  };

  // Batch submit
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
      setSuccessMessage(`Batch '${batchFormData.batch_number}' created successfully`);
      setIsBatchModalOpen(false);
      setBatchFormData({
        batch_number: '',
        product_id: 0,
        production_date: '',
        quantity: '',
        production_line: '',
        supplier: '',
      });
      fetchBatches();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Batch creation failed');
    }
  };

  // Change batch status
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
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to update batch status');
    }
  };

  // Archive batch
  const handleArchiveBatch = async (batch: Batch) => {
    if (!confirm(`Are you sure you want to archive batch '${batch.batch_number}'?`)) return;
    try {
      await batchesApi.archive(batch.id);
      setSuccessMessage(`Batch '${batch.batch_number}' archived`);
      fetchBatches();
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || 'Failed to archive batch');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'created':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-300 border border-slate-700">Created</span>;
      case 'in_production':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/30">In Production</span>;
      case 'produced':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">Produced</span>;
      case 'under_inspection':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">Under Inspection</span>;
      case 'on_hold':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">On Hold</span>;
      case 'released':
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">Released</span>;
      case 'archived':
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800/80 text-slate-400 border border-slate-700/60">Archived</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Notifications */}
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

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Boxes className="w-6 h-6 text-indigo-400" />
            Products & Batches Workspace
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manufacturing catalog, batch traceability, and lifecycle status management.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'products'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Products ({products.length})
            </button>
            <button
              onClick={() => setActiveTab('batches')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'batches'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Batches ({batches.length})
            </button>
          </div>

          {activeTab === 'products' && canManageProducts && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setProductFormData({ product_code: '', name: '', category: '', description: '' });
                setIsProductModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/25"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
            </button>
          )}

          {activeTab === 'batches' && canManageBatches && (
            <button
              onClick={() => {
                const activeProds = products.filter((p) => p.is_active);
                setBatchFormData({
                  batch_number: '',
                  product_id: activeProds.length > 0 ? activeProds[0].id : 0,
                  production_date: new Date().toISOString().split('T')[0],
                  quantity: '',
                  production_line: '',
                  supplier: '',
                });
                setIsBatchModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/25"
            >
              <Plus className="w-4 h-4" />
              <span>Register Batch</span>
            </button>
          )}
        </div>
      </div>

      {/* PRODUCTS TAB */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 backdrop-blur-sm">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search by product code, name, or description..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={productStatus}
                onChange={(e) => setProductStatus(e.target.value)}
                className="bg-slate-950/70 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="archived">Archived Only</option>
              </select>
            </div>
          </div>

          {/* Product Grid */}
          {loadingProducts ? (
            <div className="p-12 text-center text-slate-400 text-xs">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80">
              <Boxes className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-300">No products found</p>
              <p className="text-xs text-slate-500 mt-1">Try adjusting your search criteria or register a new product.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((prod) => (
                <div
                  key={prod.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    prod.is_active
                      ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      : 'bg-slate-950/40 border-slate-800/50 opacity-70'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {prod.product_code}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        prod.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {prod.is_active ? 'Active' : 'Archived'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mb-1">{prod.name}</h3>
                  {prod.category && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                      <Tag className="w-3 h-3 text-slate-500" />
                      <span>{prod.category}</span>
                    </div>
                  )}

                  {prod.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                      {prod.description}
                    </p>
                  )}

                  <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
                    <div>
                      <span className="font-semibold text-white">{prod.batch_count ?? 0}</span> batches registered
                    </div>

                    {canManageProducts && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingProduct(prod);
                            setProductFormData({
                              product_code: prod.product_code,
                              name: prod.name,
                              category: prod.category || '',
                              description: prod.description || '',
                            });
                            setIsProductModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="Edit Product"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleProductArchive(prod)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            prod.is_active
                              ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                              : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                          title={prod.is_active ? 'Archive Product' : 'Restore Product'}
                        >
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
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 backdrop-blur-sm">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={batchSearch}
                onChange={(e) => setBatchSearch(e.target.value)}
                placeholder="Search batch number, line, or supplier..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedProductId || ''}
                onChange={(e) => setSelectedProductId(e.target.value ? Number(e.target.value) : undefined)}
                className="bg-slate-950/70 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product_code} - {p.name}
                  </option>
                ))}
              </select>

              <select
                value={batchStatus}
                onChange={(e) => setBatchStatus(e.target.value)}
                className="bg-slate-950/70 border border-slate-800 text-xs text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
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
          </div>

          {/* Batches Table */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
            {loadingBatches ? (
              <div className="p-12 text-center text-slate-400 text-xs">Loading batches...</div>
            ) : batches.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                No batches found matching the filters.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-950/40">
                    <th className="py-3 px-5 font-semibold">Batch Identifier</th>
                    <th className="py-3 px-5 font-semibold">Product</th>
                    <th className="py-3 px-5 font-semibold">Lifecycle Status</th>
                    <th className="py-3 px-5 font-semibold">Production Details</th>
                    <th className="py-3 px-5 font-semibold">Supplier / Line</th>
                    {canManageBatches && <th className="py-3 px-5 font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-slate-800/25 transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-mono font-bold text-white flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5 text-indigo-400" />
                          {batch.batch_number}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          ID: {batch.id}
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="font-medium text-slate-200">
                          {batch.product?.name || 'Unknown Product'}
                        </div>
                        <div className="text-[11px] text-indigo-400 font-mono">
                          {batch.product?.product_code}
                        </div>
                      </td>

                      <td className="py-3.5 px-5">{getStatusBadge(batch.status)}</td>

                      <td className="py-3.5 px-5 text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{batch.production_date || 'N/A'}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Qty: <span className="font-semibold text-slate-300">{batch.quantity?.toLocaleString() ?? 'N/A'}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-5 text-slate-400">
                        {batch.supplier && (
                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            <span>{batch.supplier}</span>
                          </div>
                        )}
                        {batch.production_line && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                            <Layers className="w-3 h-3 text-slate-500" />
                            <span>{batch.production_line}</span>
                          </div>
                        )}
                        {!batch.supplier && !batch.production_line && <span className="text-slate-600">—</span>}
                      </td>

                      {canManageBatches && (
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedBatch(batch);
                                setNewBatchStatus(batch.status);
                                setIsStatusModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                            >
                              Transition
                            </button>

                            {batch.status !== 'archived' && (
                              <button
                                onClick={() => handleArchiveBatch(batch)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                title="Archive Batch"
                              >
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

      {/* CREATE / EDIT PRODUCT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">
                {editingProduct ? 'Edit Product' : 'Register New Product'}
              </h3>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Product Code
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingProduct}
                  value={productFormData.product_code}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, product_code: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. PRD-AUTO-001"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 uppercase font-mono disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  required
                  value={productFormData.name}
                  onChange={(e) => setProductFormData({ ...productFormData, name: e.target.value })}
                  placeholder="e.g. Precision Transmission Gear"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={productFormData.category}
                  onChange={(e) => setProductFormData({ ...productFormData, category: e.target.value })}
                  placeholder="e.g. Machined Parts, Electronics, Stamping"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={productFormData.description}
                  onChange={(e) => setProductFormData({ ...productFormData, description: e.target.value })}
                  placeholder="Specifications, surface requirements, inspection guidelines..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
                >
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER BATCH MODAL */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-base font-bold text-white">Register Production Batch</h3>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBatchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Batch Number / Identifier
                </label>
                <input
                  type="text"
                  required
                  value={batchFormData.batch_number}
                  onChange={(e) =>
                    setBatchFormData({ ...batchFormData, batch_number: e.target.value.toUpperCase() })
                  }
                  placeholder="e.g. BAT-2026-X1"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 uppercase font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Product
                </label>
                <select
                  required
                  value={batchFormData.product_id}
                  onChange={(e) =>
                    setBatchFormData({ ...batchFormData, product_id: Number(e.target.value) })
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Production Date
                  </label>
                  <input
                    type="date"
                    value={batchFormData.production_date}
                    onChange={(e) =>
                      setBatchFormData({ ...batchFormData, production_date: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={batchFormData.quantity}
                    onChange={(e) =>
                      setBatchFormData({ ...batchFormData, quantity: e.target.value })
                    }
                    placeholder="e.g. 500"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Production Line
                </label>
                <input
                  type="text"
                  value={batchFormData.production_line}
                  onChange={(e) =>
                    setBatchFormData({ ...batchFormData, production_line: e.target.value })
                  }
                  placeholder="e.g. Assembly Line 3"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Supplier / Vendor
                </label>
                <input
                  type="text"
                  value={batchFormData.supplier}
                  onChange={(e) =>
                    setBatchFormData({ ...batchFormData, supplier: e.target.value })
                  }
                  placeholder="e.g. Apex Castings Ltd."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
                >
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CHANGE BATCH STATUS MODAL */}
      {isStatusModalOpen && selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-bold text-white">Transition Batch Status</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedBatch.batch_number}</p>
              </div>
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleStatusChangeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  New Status
                </label>
                <select
                  value={newBatchStatus}
                  onChange={(e) => setNewBatchStatus(e.target.value as BatchStatus)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="created">Created</option>
                  <option value="in_production">In Production</option>
                  <option value="produced">Produced</option>
                  <option value="under_inspection">Under Inspection</option>
                  <option value="archived">Archived</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Note: Official Hold and Release decisions are governed by the dedicated Batch Decision workflow in Phase 6.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                  Reason / Notes for Status Change
                </label>
                <textarea
                  rows={3}
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="e.g. Production complete, moving to inspection station..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsStatusModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30"
                >
                  Apply Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
