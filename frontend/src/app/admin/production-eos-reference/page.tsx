'use client';

import { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import {
  AlertCircle,
  CheckCircle,
  Database,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';

interface RateReferenceRow {
  id: string;
  sourceRowNumber?: number | null;
  itemNo: string;
  description: string;
  totalAssemblyHeadcount?: string | number | null;
  totalPackHeadcount?: string | number | null;
  temporaryAssemblyHeadcount?: string | number | null;
  temporaryPackHeadcount?: string | number | null;
  weightPerCaseLb?: string | number | null;
  isActive: boolean;
  updatedAt: string;
}

type NoticeType = 'success' | 'error' | 'info';

const emptyDraft = {
  sourceRowNumber: '',
  itemNo: '',
  description: '',
  totalAssemblyHeadcount: '',
  totalPackHeadcount: '',
  temporaryAssemblyHeadcount: '',
  temporaryPackHeadcount: '',
  weightPerCaseLb: '',
  isActive: true,
};

function fieldValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function formatNumber(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export default function ProductionEosReferencePage() {
  const [rows, setRows] = useState<RateReferenceRow[]>([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('true');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null);

  const showNotice = (type: NoticeType, message: string) => {
    setNotice({ type, message });
    window.setTimeout(() => setNotice(null), 4500);
  };

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const rowsRes = await api.get('/production-eos/admin/reference-data', {
        params: {
          query: query || undefined,
          active,
        },
      });
      setRows(rowsRes.data.referenceData || []);
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || 'Could not load Production EOS Rates data.');
    } finally {
      setLoading(false);
    }
  }, [active, query]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const startEdit = (row: RateReferenceRow) => {
    setEditingId(row.id);
    setDraft({
      sourceRowNumber: fieldValue(row.sourceRowNumber),
      itemNo: row.itemNo || '',
      description: row.description || '',
      totalAssemblyHeadcount: fieldValue(row.totalAssemblyHeadcount),
      totalPackHeadcount: fieldValue(row.totalPackHeadcount),
      temporaryAssemblyHeadcount: fieldValue(row.temporaryAssemblyHeadcount),
      temporaryPackHeadcount: fieldValue(row.temporaryPackHeadcount),
      weightPerCaseLb: fieldValue(row.weightPerCaseLb),
      isActive: row.isActive,
    });
  };

  const resetDraft = () => {
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const saveDraft = async () => {
    if (!draft.itemNo.trim() || !draft.description.trim()) {
      showNotice('error', 'Item number and description are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        sourceRowNumber: draft.sourceRowNumber,
        itemNo: draft.itemNo.trim(),
        description: draft.description.trim(),
        totalAssemblyHeadcount: draft.totalAssemblyHeadcount,
        totalPackHeadcount: draft.totalPackHeadcount,
        temporaryAssemblyHeadcount: draft.temporaryAssemblyHeadcount,
        temporaryPackHeadcount: draft.temporaryPackHeadcount,
        weightPerCaseLb: draft.weightPerCaseLb,
        isActive: draft.isActive,
      };
      if (editingId) {
        await api.patch(`/production-eos/admin/reference-data/${editingId}`, payload);
        showNotice('success', 'Rates reference updated.');
      } else {
        await api.post('/production-eos/admin/reference-data', payload);
        showNotice('success', 'Rates reference added.');
      }
      resetDraft();
      loadRows();
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || error.message || 'Could not save Rates reference.');
    } finally {
      setSaving(false);
    }
  };

  const deleteRow = async (row: RateReferenceRow) => {
    const confirmed = window.confirm(`Delete Rates reference item ${row.itemNo}? This can affect future Production EOS calculations.`);
    if (!confirmed) return;
    try {
      await api.delete(`/production-eos/admin/reference-data/${row.id}`);
      showNotice('success', 'Rates reference deleted.');
      loadRows();
    } catch (error: any) {
      showNotice('error', error.response?.data?.error || 'Could not delete Rates reference.');
    }
  };

  const inputClass = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'SYSTEM_ADMIN']}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {notice && (
          <div className="fixed right-4 top-20 z-50 max-w-md rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-start gap-2">
              {notice.type === 'success' ? <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600" /> : notice.type === 'error' ? <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" /> : <Database className="mt-0.5 h-5 w-5 text-blue-600" />}
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{notice.message}</p>
            </div>
          </div>
        )}

        <div className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          <div className="px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
                  <Database className="h-6 w-6 text-blue-600" />
                  Production EOS Rates
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Admin-maintained Rates data used by Production EOS calculations: item, description, assembly HC, pack HC, temporary Line 5 HC, and weight per case.
                </p>
              </div>
              <button
                type="button"
                onClick={loadRows}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_220px]">
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Search Rates</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className={`${inputClass} pl-9`} placeholder="Item number or description" />
                </div>
              </label>
              <label>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Status</span>
                <select value={active} onChange={(event) => setActive(event.target.value)} className={inputClass}>
                  <option value="true">Active only</option>
                  <option value="false">Inactive only</option>
                  <option value="all">All rows</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <main className="grid gap-5 px-4 py-5 lg:grid-cols-[380px_1fr] sm:px-6 lg:px-8">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                {editingId ? <Edit3 className="h-5 w-5 text-blue-600" /> : <Plus className="h-5 w-5 text-blue-600" />}
                {editingId ? 'Edit Rates Item' : 'Add Rates Item'}
              </h2>
              {editingId && (
                <button onClick={resetDraft} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Cancel edit">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Item number</span>
                <input value={draft.itemNo} onChange={(event) => setDraft((prev) => ({ ...prev, itemNo: event.target.value.replace(/\D/g, '') }))} inputMode="numeric" className={inputClass} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Description</span>
                <input value={draft.description} onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))} className={inputClass} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Total Assembly HC</span>
                  <input value={draft.totalAssemblyHeadcount} onChange={(event) => setDraft((prev) => ({ ...prev, totalAssemblyHeadcount: event.target.value }))} inputMode="decimal" className={inputClass} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Total Pack HC</span>
                  <input value={draft.totalPackHeadcount} onChange={(event) => setDraft((prev) => ({ ...prev, totalPackHeadcount: event.target.value }))} inputMode="decimal" className={inputClass} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">75% Temp Assembly HC</span>
                  <input value={draft.temporaryAssemblyHeadcount} onChange={(event) => setDraft((prev) => ({ ...prev, temporaryAssemblyHeadcount: event.target.value }))} inputMode="decimal" className={inputClass} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">75% Temp Pack HC</span>
                  <input value={draft.temporaryPackHeadcount} onChange={(event) => setDraft((prev) => ({ ...prev, temporaryPackHeadcount: event.target.value }))} inputMode="decimal" className={inputClass} />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Wt/Case (lb)</span>
                  <input value={draft.weightPerCaseLb} onChange={(event) => setDraft((prev) => ({ ...prev, weightPerCaseLb: event.target.value }))} inputMode="decimal" className={inputClass} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">Source row</span>
                <input value={draft.sourceRowNumber} onChange={(event) => setDraft((prev) => ({ ...prev, sourceRowNumber: event.target.value.replace(/\D/g, '') }))} inputMode="numeric" className={inputClass} />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <input type="checkbox" checked={draft.isActive} onChange={(event) => setDraft((prev) => ({ ...prev, isActive: event.target.checked }))} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                Active Rates reference
              </label>
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingId ? 'Save Changes' : 'Add Rates Item'}
              </button>
            </div>
          </section>

          <section className="min-w-0 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Rates References</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">{rows.length} rows loaded from the typed Rates reference table</p>
              </div>
            </div>
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center text-gray-600 dark:text-gray-300">
                <Loader2 className="mr-2 h-5 w-5 animate-spin text-blue-600" />
                Loading Rates data...
              </div>
            ) : (
              <div className="max-h-[calc(100vh-260px)] overflow-auto">
                <table className="min-w-[1260px] w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100 text-xs uppercase tracking-wide text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    <tr>
                      <th className="px-3 py-3 text-left">Item</th>
                      <th className="px-3 py-3 text-left">Description</th>
                      <th className="px-3 py-3 text-right">Assembly HC</th>
                      <th className="px-3 py-3 text-right">Pack HC</th>
                      <th className="px-3 py-3 text-right">75% Temp Assembly</th>
                      <th className="px-3 py-3 text-right">75% Temp Pack</th>
                      <th className="px-3 py-3 text-right">Wt/Case (lb)</th>
                      <th className="px-3 py-3 text-right">Source Row</th>
                      <th className="px-3 py-3 text-left">Status</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-3 font-semibold text-gray-900 dark:text-gray-100">{row.itemNo}</td>
                        <td className="max-w-[360px] truncate px-3 py-3 text-gray-700 dark:text-gray-300">{row.description}</td>
                        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatNumber(row.totalAssemblyHeadcount)}</td>
                        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatNumber(row.totalPackHeadcount)}</td>
                        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatNumber(row.temporaryAssemblyHeadcount)}</td>
                        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatNumber(row.temporaryPackHeadcount)}</td>
                        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{formatNumber(row.weightPerCaseLb)}</td>
                        <td className="px-3 py-3 text-right text-gray-700 dark:text-gray-300">{row.sourceRowNumber || ''}</td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`}>
                            {row.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => startEdit(row)} className="rounded-md border border-gray-300 p-2 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800" aria-label="Edit row">
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button onClick={() => deleteRow(row)} className="rounded-md border border-red-200 p-2 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40" aria-label="Delete row">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!rows.length && (
                  <div className="px-4 py-10 text-center text-sm text-gray-600 dark:text-gray-400">
                    No Rates references found. Run the Production EOS workbook import or add a Rates item manually.
                  </div>
                )}
              </div>
            )}
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
