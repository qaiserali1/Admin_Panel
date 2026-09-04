'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Plus,
  Trash2,
  KeyRound,
  ShieldAlert,
  HelpCircle,
  Copy,
  Check,
  LogOut,
  Pencil,
  Share2,
  Package,
} from 'lucide-react';

interface User {
  id: string;
  username: string;
  role: string;
  status: 'pending' | 'active' | 'blocked';
  deviceId: string | null;
  agencyName?: string | null;
  bookerName?: string | null;
  mobileNumber?: string | null;
  sheetImportLimit?: number;
  dailyImportCount?: number;
  lastImportDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Counts {
  total: number;
  pending: number;
  active: number;
  blocked: number;
}

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, pending: 0, active: 0, blocked: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'blocked'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [agencyName, setAgencyName] = useState('');
  const [bookerName, setBookerName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [sheetImportLimit, setSheetImportLimit] = useState(1);
  const [generatedCredentials, setGeneratedCredentials] = useState<{username: string, password: string} | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit Modal states
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editAgencyName, setEditAgencyName] = useState('');
  const [editBookerName, setEditBookerName] = useState('');
  const [editMobileNumber, setEditMobileNumber] = useState('');
  const [editSheetImportLimit, setEditSheetImportLimit] = useState(1);
  const [resetPassword, setResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  // Test Simulator state
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testUsername, setTestUsername] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testDeviceId, setTestDeviceId] = useState('DEVICE_IMEI_9988771122');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users || []);
      if (data.counts) setCounts(data.counts);
    } catch (err: any) {
      showToast(err.message || 'Error fetching user list', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUpdateStatus = async (id: string, status: 'active' | 'blocked' | 'pending') => {
    try {
      setActionLoadingId(id);
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      showToast(`User status updated to ${status.toUpperCase()}`);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetDevice = async (id: string, username: string) => {
    if (!confirm(`Are you sure you want to unbind device for booker "${username}"? They will be able to bind a new device on next login.`)) {
      return;
    }
    try {
      setActionLoadingId(id);
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resetDevice: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset device');

      showToast(`Device unlinked for ${username}`);
      setEditingUser((prev) => (prev && prev.id === id ? { ...prev, deviceId: null } : prev));
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResetDailyImportCount = async (id: string) => {
    try {
      setActionLoadingId(id);
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, resetDailyImportCount: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset import count');

      showToast("Today's import count reset to 0");
      setEditingUser((prev) => (prev && prev.id === id ? { ...prev, dailyImportCount: 0 } : prev));
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteUser = async (id: string, username: string) => {
    if (!confirm(`Are you sure you want to delete booker "${username}"?`)) return;
    try {
      setActionLoadingId(id);
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');

      showToast(`User ${username} deleted`);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setActionLoadingId(editingUser.id);
      const parsedLimit = parseInt(String(editSheetImportLimit), 10);
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          agencyName: editAgencyName,
          bookerName: editBookerName,
          mobileNumber: editMobileNumber,
          sheetImportLimit: !isNaN(parsedLimit) ? parsedLimit : 1,
          ...(resetPassword && newPassword ? { password: newPassword } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      showToast(`Booker details updated successfully`);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyName,
          bookerName,
          mobileNumber,
          sheetImportLimit: Number(sheetImportLimit) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');

      showToast('New booker account created successfully!');
      setGeneratedCredentials({ username: data.username, password: data.password });
      setAgencyName('');
      setBookerName('');
      setMobileNumber('');
      setSheetImportLimit(1);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSimulateMobileLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestLoading(true);
    setTestResponse(null);
    try {
      const res = await fetch('/api/mobile/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          password: testPassword,
          deviceId: testDeviceId,
        }),
      });
      const data = await res.json();
      setTestResponse({ httpStatus: res.status, data });
      fetchUsers();
    } catch (err: any) {
      setTestResponse({ httpStatus: 500, data: { error: err.message } });
    } finally {
      setTestLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    let copied = false;

    // 1. Try modern Clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (e) {
        console.warn('navigator.clipboard failed, using fallback', e);
      }
    }

    // 2. Mobile-friendly fallback using temporary textarea
    if (!copied && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.top = '0';
        textarea.style.left = '0';
        textarea.style.width = '2em';
        textarea.style.height = '2em';
        textarea.style.padding = '0';
        textarea.style.border = 'none';
        textarea.style.outline = 'none';
        textarea.style.boxShadow = 'none';
        textarea.style.background = 'transparent';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, 99999);

        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (successful) copied = true;
      } catch (e) {
        console.error('execCommand copy failed', e);
      }
    }

    setCopiedId(id);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareCredentials = async (username: string, password?: string) => {
    const textToShare = `*FMCG Order Booker Credentials*\n\n👤 *Username:* ${username}\n🔑 *Password:* ${password || ''}\n\n📱 Please login via the FMCG Order Booker app.`;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'FMCG Booker Credentials',
          text: textToShare,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // Direct WhatsApp share fallback
    const encoded = encodeURIComponent(textToShare);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      window.location.href = '/login';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Smartphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex flex-wrap items-center gap-2">
              Pepsico DMS Panel
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-400">Device Binding & Order Booker Access Governance</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            href="/dashboard/products"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-200 border border-indigo-700/60 rounded-lg transition"
          >
            <Package className="w-4 h-4 text-indigo-400" />
            <span>Products &amp; SKUs</span>
          </Link>

          <button
            onClick={() => setIsTestModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition"
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            Simulate App Login
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-600/20 transition"
          >
            <Plus className="w-4 h-4" />
            Add Booker
          </button>

          <button
            onClick={fetchUsers}
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

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
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
                <ShieldAlert className="w-5 h-5 text-rose-400" />
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Bookers</p>
                <h3 className="text-2xl font-extrabold text-white mt-1">{counts.total}</h3>
              </div>
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
              <span>All registered accounts</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">Pending Approval</p>
                <h3 className="text-2xl font-extrabold text-amber-400 mt-1">{counts.pending}</h3>
              </div>
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-xs text-amber-400/80 flex items-center gap-1 font-medium">
              <span>Requires action</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Active Bookers</p>
                <h3 className="text-2xl font-extrabold text-emerald-400 mt-1">{counts.active}</h3>
              </div>
              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
              <span>Authorized for app order entry</span>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-400">Blocked Access</p>
                <h3 className="text-2xl font-extrabold text-rose-400 mt-1">{counts.blocked}</h3>
              </div>
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
                <UserX className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
              <span>Denied login access</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 w-full md:w-auto">
            {(['all', 'pending', 'active', 'blocked'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                  statusFilter === filter
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {filter}
                {filter === 'pending' && counts.pending > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-full">
                    {counts.pending}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search username or device ID..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4 whitespace-nowrap">Booker / Username</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Role</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Device Binding (Hardware ID)</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-4 whitespace-nowrap">Registered Date</th>
                  <th className="py-3.5 px-4 whitespace-nowrap text-right">Approval Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-normal">
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-500" />
                        <span>Loading order bookers...</span>
                      </div>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-medium text-slate-400">No bookers found</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Try modifying your search or invite a new mobile app booker.
                      </p>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const isProcessing = actionLoadingId === user.id;
                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-slate-800/40 transition group"
                      >
                        {/* Username */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-indigo-400 uppercase">
                              {(user.bookerName || user.username).slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-100">{user.bookerName || 'Unknown Booker'}</p>
                              <div className="flex flex-col text-[11px] text-slate-400 mt-0.5">
                                <span>@{user.username} {user.id.slice(0,6)}</span>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  {(user.agencyName || user.mobileNumber) && (
                                    <span className="text-[10px] text-slate-500 truncate max-w-[200px]">
                                      {user.agencyName && `Agency: ${user.agencyName}`}{user.agencyName && user.mobileNumber && ' | '}{user.mobileNumber && `Mobile: ${user.mobileNumber}`}
                                    </span>
                                  )}
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40 text-[10px] font-medium text-indigo-300">
                                    Limit: {user.dailyImportCount ?? 0}/{user.sheetImportLimit ?? 1} imports
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-[11px] capitalize font-medium">
                            {user.role}
                          </span>
                        </td>

                        {/* Device ID & Binding */}
                        <td className="py-4 px-4">
                          {user.deviceId ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] bg-slate-950 px-2 py-1 rounded border border-slate-800 text-slate-300 max-w-[180px] truncate">
                                {user.deviceId}
                              </span>
                              <button
                                onClick={() => copyToClipboard(user.deviceId!, user.id)}
                                title="Copy Device ID"
                                className="p-1 text-slate-500 hover:text-slate-300 transition"
                              >
                                {copiedId === user.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => handleResetDevice(user.id, user.username)}
                                disabled={isProcessing}
                                title="Unbind / Reset device for this booker"
                                className="px-2 py-0.5 text-[10px] text-indigo-400 hover:bg-indigo-950/60 rounded border border-indigo-800/40 transition"
                              >
                                Reset
                              </button>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-500 italic text-[11px]">
                              <Smartphone className="w-3 h-3 text-slate-600" />
                              Unbound (First device binds on login)
                            </span>
                          )}
                        </td>

                        {/* Status (Color Coded: Yellow for Pending, Green for Active, Red for Blocked) */}
                        <td className="py-4 px-4">
                          {user.status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              Pending Approval
                            </span>
                          )}
                          {user.status === 'active' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Active
                            </span>
                          )}
                          {user.status === 'blocked' && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Blocked
                            </span>
                          )}
                        </td>

                        {/* Registered Date */}
                        <td className="py-4 px-4 text-slate-400 text-[11px]">
                          {new Date(user.createdAt).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Approve Button (Sets status to active) */}
                            {user.status !== 'active' && (
                              <button
                                onClick={() => handleUpdateStatus(user.id, 'active')}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approve
                              </button>
                            )}

                            {/* Block Button (Sets status to blocked) */}
                            {user.status !== 'blocked' && (
                              <button
                                onClick={() => handleUpdateStatus(user.id, 'blocked')}
                                disabled={isProcessing}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600/90 hover:bg-rose-600 text-white shadow-sm transition disabled:opacity-50"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Block
                              </button>
                            )}

                            {/* Edit Button */}
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setEditAgencyName(user.agencyName || '');
                                setEditBookerName(user.bookerName || '');
                                setEditMobileNumber(user.mobileNumber || '');
                                setEditSheetImportLimit(user.sheetImportLimit ?? 1);
                                setResetPassword(false);
                                setNewPassword('');
                              }}
                              disabled={isProcessing}
                              title="Edit details"
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-700/80 hover:bg-slate-700 text-slate-200 shadow-sm transition disabled:opacity-50"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>

                            {/* Delete Button */}
                            <button
                              onClick={() => handleDeleteUser(user.id, user.username)}
                              disabled={isProcessing}
                              title="Delete account"
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Booker Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full sm:max-w-md md:max-w-lg rounded-2xl p-5 md:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Create Booker Account</h3>
              </div>
              <button
                onClick={() => { setIsAddModalOpen(false); setGeneratedCredentials(null); }}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {generatedCredentials ? (
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl relative">
                  <h4 className="flex items-center gap-2 text-emerald-400 font-bold mb-2">
                    <CheckCircle2 className="w-5 h-5" /> Success! Booker Created
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-300 mb-4">
                    Please copy or share these credentials with the booker. They will not be visible again.
                  </p>
                  
                  <div className="bg-slate-950/90 border border-slate-800 p-3.5 rounded-xl font-mono text-sm space-y-3">
                    <div className="flex justify-between items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider block">Username:</span>
                        <span className="text-white text-sm sm:text-base select-all font-semibold block truncate">
                          {generatedCredentials.username}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedCredentials.username, 'gen-user')}
                        className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-300 transition flex items-center gap-1 text-xs"
                        title="Copy Username"
                      >
                        {copiedId === 'gen-user' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-800/80 pt-2.5 gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-slate-500 text-[10px] sm:text-xs uppercase tracking-wider block">Password:</span>
                        <span className="text-white text-sm sm:text-base select-all font-semibold block truncate">
                          {generatedCredentials.password}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(generatedCredentials.password, 'gen-pass')}
                        className="p-2 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 rounded-lg text-slate-300 transition flex items-center gap-1 text-xs"
                        title="Copy Password"
                      >
                        {copiedId === 'gen-pass' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Action buttons: Copy All & Share via WhatsApp */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `Username: ${generatedCredentials.username}\nPassword: ${generatedCredentials.password}`,
                          'gen-all'
                        )
                      }
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
                    >
                      {copiedId === 'gen-all' ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-indigo-400" />
                      )}
                      <span>Copy All Details</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleShareCredentials(
                          generatedCredentials.username,
                          generatedCredentials.password
                        )
                      }
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-600/20 transition"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>Share / WhatsApp</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setIsAddModalOpen(false);
                      setGeneratedCredentials(null);
                    }}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Agency Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Al-Madina Traders"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Order Booker Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ali Khan"
                    value={bookerName}
                    onChange={(e) => setBookerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 03001234567"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Sheet Import Limit (Per Day)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 1"
                    value={sheetImportLimit}
                    onChange={(e) => setSheetImportLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Allowed sheet imports per calendar day (default: 1).</p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
                  >
                    {actionLoadingId === 'create' ? <RefreshCw className="w-4 h-4 animate-spin"/> : null}
                    Generate credentials
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Booker Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full sm:max-w-md md:max-w-lg rounded-2xl p-5 md:p-8 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Edit Booker Details</h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 mb-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                  Username <span className="text-[10px] text-slate-500 normal-case bg-slate-800 px-1.5 py-0.5 rounded ml-1">Read-only</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={editingUser.username}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-sm text-slate-400 focus:outline-none cursor-not-allowed"
                />
              </div>

              {/* Device Binding Lock & Reset Button */}
              <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/80 mb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <label className="block text-xs font-semibold text-slate-300 mb-1 uppercase tracking-wide">
                      Device Binding Status
                    </label>
                    <p className="text-xs font-mono truncate">
                      {editingUser.deviceId ? (
                        <span className="text-emerald-400 font-semibold">Locked: {editingUser.deviceId}</span>
                      ) : (
                        <span className="text-slate-500 italic">No device bound (Unbound)</span>
                      )}
                    </p>
                  </div>
                  {editingUser.deviceId && (
                    <button
                      type="button"
                      onClick={() => handleResetDevice(editingUser.id, editingUser.username)}
                      className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-rose-950/70 hover:bg-rose-900/80 text-rose-300 border border-rose-800/70 rounded-lg transition shadow-sm"
                    >
                      Reset Device Lock
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                  Agency Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Al-Madina Traders"
                  value={editAgencyName}
                  onChange={(e) => setEditAgencyName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                  Order Booker Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ali Khan"
                  value={editBookerName}
                  onChange={(e) => setEditBookerName(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                  Mobile Number
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 03001234567"
                  value={editMobileNumber}
                  onChange={(e) => setEditMobileNumber(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                  Sheet Import Limit (Per Day)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editSheetImportLimit}
                  onChange={(e) => setEditSheetImportLimit(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[11px] text-slate-500">
                    Current today count: <span className="font-semibold text-indigo-400">{editingUser.dailyImportCount ?? 0}</span> / {editSheetImportLimit} used.
                  </p>
                  {(editingUser.dailyImportCount ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => handleResetDailyImportCount(editingUser.id)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 underline font-medium"
                    >
                      Reset count to 0
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer mb-3 w-fit">
                  <input
                    type="checkbox"
                    checked={resetPassword}
                    onChange={(e) => setResetPassword(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950 accent-indigo-600"
                  />
                  <span className="text-sm font-semibold text-slate-300 hover:text-white transition">Reset Credentials</span>
                </label>

                {resetPassword && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wide">
                      New Password
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required={resetPassword}
                        placeholder="Type new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setNewPassword(Math.floor(100000 + Math.random() * 900000).toString())}
                        className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 rounded-xl border border-slate-700 transition"
                      >
                        Auto-Gen
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800/60 mt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-5 py-2.5 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoadingId === editingUser.id}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
                >
                  {actionLoadingId === editingUser.id ? <RefreshCw className="w-4 h-4 animate-spin"/> : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile Login Simulator Modal */}
      {isTestModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full sm:max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-base font-bold text-white">Mobile App Login Simulator</h3>
                  <p className="text-[11px] text-slate-400">Tests <code>POST /api/mobile/login</code> device binding flow</p>
                </div>
              </div>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSimulateMobileLogin} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. booker_ali"
                  value={testUsername}
                  onChange={(e) => setTestUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Password"
                  value={testPassword}
                  onChange={(e) => setTestPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Device Hardware ID (IMEI / UUID)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. DEVICE_ANDROID_12345"
                    value={testDeviceId}
                    onChange={(e) => setTestDeviceId(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setTestDeviceId(`PHONE_${Math.floor(100000 + Math.random() * 900000)}`)}
                    className="px-2.5 py-2 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700"
                  >
                    Randomize
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={testLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center gap-2"
                >
                  {testLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Smartphone className="w-3.5 h-3.5" />}
                  Send Login Request
                </button>
              </div>
            </form>

            {/* Test Response Output */}
            {testResponse && (
              <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-300">API Response:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      testResponse.httpStatus === 200
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : testResponse.httpStatus === 201
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    HTTP {testResponse.httpStatus}
                  </span>
                </div>
                <pre className="p-3 bg-slate-900 rounded-lg border border-slate-800/80 text-[11px] font-mono text-slate-200 overflow-x-auto">
                  {JSON.stringify(testResponse.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
