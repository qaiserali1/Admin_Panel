'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  LogOut,
  Users,
  X,
  Layers,
  ArrowUpDown,
  Tag,
} from 'lucide-react';

interface ProductSKU {
  id: string;
  skuCode: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export default function ProductsPage() {
  const [skus, setSkus] = useState<ProductSKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add SKU Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSkuCode, setNewSkuCode] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit SKU Modal State
  const [editingSku, setEditingSku] = useState<ProductSKU | null>(null);
  const [editSkuCode, setEditSkuCode] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Confirmation Modal State
  const [deletingSku, setDeletingSku] = useState<ProductSKU | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchSkus = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch SKUs');
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.skus || data.products || [];
      setSkus(list);
    } catch (err: any) {
      showToast(err.message || 'Error loading SKU list', 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchSkus();
  }, [fetchSkus]);

  // Handle Create SKU
  const handleCreateSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkuCode.trim() || !newDisplayName.trim()) {
      setAddError('Both SKU Code and Display Name are required');
      return;
    }

    try {
      setAddLoading(true);
      setAddError(null);

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuCode: newSkuCode.trim(),
          displayName: newDisplayName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create SKU');
      }

      showToast(`SKU "${data.sku?.skuCode || newSkuCode}" created successfully`);
      setIsAddModalOpen(false);
      setNewSkuCode('');
      setNewDisplayName('');
      fetchSkus();
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (sku: ProductSKU) => {
    setEditingSku(sku);
    setEditSkuCode(sku.skuCode);
    setEditDisplayName(sku.displayName);
    setEditError(null);
  };

  // Handle Update SKU
  const handleUpdateSku = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSku) return;

    if (!editSkuCode.trim() || !editDisplayName.trim()) {
      setEditError('Both SKU Code and Display Name are required');
      return;
    }

    try {
      setEditLoading(true);
      setEditError(null);

      const res = await fetch('/api/products', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingSku.id,
          skuCode: editSkuCode.trim(),
          displayName: editDisplayName.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update SKU');
      }

      showToast(`SKU "${editSkuCode}" updated successfully`);
      setEditingSku(null);
      fetchSkus();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Handle Delete SKU
  const handleDeleteSku = async () => {
    if (!deletingSku) return;

    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/products?id=${encodeURIComponent(deletingSku.id)}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete SKU');
      }

      showToast(`SKU "${deletingSku.skuCode}" deleted successfully`);
      setDeletingSku(null);
      fetchSkus();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Copy helper
  const copyToClipboard = async (text: string, id: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(id);
      showToast('SKU code copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                PepsiCo DMS Products
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                SKU Master
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-400">
              Dynamic SKU Management & External Mobile App Catalog
            </p>
          </div>
        </div>

        {/* Navigation & Action Links */}
        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition"
          >
            <Users className="w-4 h-4 text-slate-400" />
            Bookers Governance
          </Link>

          <button
            onClick={() => {
              setIsAddModalOpen(true);
              setAddError(null);
              setNewSkuCode('');
              setNewDisplayName('');
            }}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            Add New SKU
          </button>

          <button
            onClick={fetchSkus}
            disabled={loading}
            title="Refresh list"
            className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          <button
            onClick={handleLogout}
            title="Logout"
            className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 text-slate-400 hover:text-rose-400 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">Logout</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Toast Alert */}
        {toastMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between shadow-xl transition animate-in fade-in ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                : 'bg-rose-950/80 border-rose-800 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {toastMessage.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              )}
              <span className="text-sm font-medium">{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Stats & Search Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total SKUs</p>
              <h3 className="text-2xl font-extrabold text-white mt-1">{skus.length}</h3>
            </div>
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>

          <div className="md:col-span-2 bg-slate-900/60 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by SKU Code or Display Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => {
                setIsAddModalOpen(true);
                setAddError(null);
                setNewSkuCode('');
                setNewDisplayName('');
              }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add SKU</span>
            </button>
          </div>
        </div>

        {/* SKUs Table Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-indigo-400" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                Products &amp; SKU Catalog
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              {skus.length} {skus.length === 1 ? 'item' : 'items'} loaded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 sm:px-6">SKU Code</th>
                  <th className="py-3.5 px-4 sm:px-6">Display Name</th>
                  <th className="py-3.5 px-4 sm:px-6 hidden md:table-cell">Created At</th>
                  <th className="py-3.5 px-4 sm:px-6 hidden lg:table-cell">Last Updated</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                        <p className="text-xs">Loading SKU inventory...</p>
                      </div>
                    </td>
                  </tr>
                ) : skus.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
                          <Package className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-200">No Product SKUs Found</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {searchQuery ? 'Try adjusting your search criteria' : 'Get started by creating your first product SKU'}
                          </p>
                        </div>
                        {!searchQuery && (
                          <button
                            onClick={() => {
                              setIsAddModalOpen(true);
                              setAddError(null);
                            }}
                            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition shadow"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add SKU
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  skus.map((sku) => (
                    <tr key={sku.id} className="hover:bg-slate-800/40 transition">
                      {/* SKU Code */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-800/50 px-2.5 py-1 rounded-md text-xs tracking-wider">
                            {sku.skuCode}
                          </span>
                          <button
                            onClick={() => copyToClipboard(sku.skuCode, sku.id)}
                            title="Copy SKU Code"
                            className="p-1 text-slate-500 hover:text-indigo-400 rounded transition"
                          >
                            {copiedId === sku.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Display Name */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="w-3.5 h-3.5 text-indigo-400" />
                          </div>
                          <div>
                            <span className="font-semibold text-slate-100 text-sm">
                              {sku.displayName}
                            </span>
                            <p className="text-[10px] text-slate-500 font-mono">ID: {sku.id}</p>
                          </div>
                        </div>
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 sm:px-6 hidden md:table-cell text-slate-400">
                        {new Date(sku.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        <span className="block text-[10px] text-slate-500">
                          {new Date(sku.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      {/* Updated At */}
                      <td className="py-3.5 px-4 sm:px-6 hidden lg:table-cell text-slate-400">
                        {new Date(sku.updatedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(sku)}
                            title="Edit SKU"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                          >
                            <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-xs font-medium">Edit</span>
                          </button>

                          <button
                            onClick={() => setDeletingSku(sku)}
                            title="Delete SKU"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-800 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span className="text-xs font-medium">Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* MODAL: Add New SKU */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-100 text-base">Add New SKU</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSku} className="p-6 space-y-4">
              {addError && (
                <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  SKU Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PEP-500-CAN, LAY-MAS-50G"
                  value={newSkuCode}
                  onChange={(e) => setNewSkuCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 transition uppercase"
                />
                <p className="text-[11px] text-slate-500 mt-1">Unique identifier used by mobile bookers.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Display Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pepsi 500ml Can, Lay's Masala 50g"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
                <p className="text-[11px] text-slate-500 mt-1">Customer-facing product name displayed in order sheets.</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition"
                >
                  {addLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{addLoading ? 'Saving...' : 'Create SKU'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit SKU */}
      {editingSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <Pencil className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-100 text-base">Edit SKU</h3>
              </div>
              <button
                onClick={() => setEditingSku(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSku} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-rose-950/70 border border-rose-800 text-rose-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  SKU Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editSkuCode}
                  onChange={(e) => setEditSkuCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 transition uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Display Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingSku(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition"
                >
                  {editLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editLoading ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {deletingSku && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Delete Product SKU?</h3>
                <p className="text-xs text-slate-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3 text-xs space-y-1">
              <p className="text-slate-400">
                SKU Code: <span className="font-mono text-indigo-300 font-bold">{deletingSku.skuCode}</span>
              </p>
              <p className="text-slate-400">
                Display Name: <span className="text-slate-200 font-medium">{deletingSku.displayName}</span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSku(null)}
                disabled={deleteLoading}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSku}
                disabled={deleteLoading}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl transition shadow-lg shadow-rose-600/20"
              >
                {deleteLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{deleteLoading ? 'Deleting...' : 'Delete SKU'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
