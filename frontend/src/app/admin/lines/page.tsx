'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { UserRole } from '@/types/auth';
import api from '@/lib/api';

interface Area {
  id: string;
  name: string;
  department?: {
    id: string;
    name: string;
    facility?: {
      id: string;
      name: string;
    };
  };
}

interface Line {
  id: string;
  name: string;
  lineNumber: string;
  areaId: string;
  area?: Area;
  _count?: {
    shifts: number;
  };
}

export default function LinesPage() {
  const { user } = useAuth();
  const [lines, setLines] = useState<Line[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLine, setEditingLine] = useState<Line | null>(null);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    lineNumber: '',
    areaId: '',
  });

  const canManageLines = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [linesRes, areasRes] = await Promise.all([
        api.get('/facilities/lines'),
        api.get('/facilities/areas'),
      ]);
      
      // Normalize lines data - backend returns Area/Department/Facility (PascalCase)
      const linesData = linesRes.data.data.lines || [];
      const normalizedLines = linesData.map((l: any) => ({
        ...l,
        area: l.Area ? {
          ...l.Area,
          department: l.Area.Department ? {
            ...l.Area.Department,
            facility: l.Area.Department.Facility || l.Area.Department.facility,
          } : l.Area.department,
        } : l.area,
        _count: l._count ? {
          shifts: l._count.ShiftLine || l._count.shifts || 0,
        } : undefined,
      }));
      setLines(normalizedLines);
      
      // Normalize areas data
      const areasData = areasRes.data.data.areas || [];
      const normalizedAreas = areasData.map((a: any) => ({
        ...a,
        department: a.Department ? {
          ...a.Department,
          facility: a.Department.Facility || a.Department.facility,
        } : a.department,
      }));
      setAreas(normalizedAreas);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingLine) {
        await api.patch(`/facilities/lines/${editingLine.id}`, formData);
      } else {
        await api.post('/facilities/lines', formData);
      }
      
      await loadData();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save line');
    }
  };

  const handleEdit = (line: Line) => {
    setEditingLine(line);
    setFormData({
      name: line.name,
      lineNumber: line.lineNumber,
      areaId: line.areaId,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this production line? This will also delete all shifts.')) return;

    try {
      await api.delete(`/facilities/lines/${id}`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete line');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      lineNumber: '',
      areaId: '',
    });
    setEditingLine(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <ProtectedRoute minRole={UserRole.ADMIN}>
        <div className="p-8">
          <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute minRole={UserRole.ADMIN}>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Production Lines</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage production lines within areas</p>
          </div>
          {canManageLines && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {showForm ? 'Cancel' : '+ New Line'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
            <p className="text-danger-800 dark:text-danger-200">{error}</p>
          </div>
        )}

        {showForm && canManageLines && (
          <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {editingLine ? 'Edit Production Line' : 'Create New Production Line'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Area *
                </label>
                <select
                  value={formData.areaId}
                  onChange={(e) => setFormData({ ...formData, areaId: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Area</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name} ({area.department?.facility?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Line Number *
                </label>
                <input
                  type="text"
                  value={formData.lineNumber}
                  onChange={(e) => setFormData({ ...formData, lineNumber: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., L1, L2, Line-01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Line Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Primary Packaging Line, Assembly Line A"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingLine ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700">
          <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
          <table className="w-full min-w-[700px]">
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Line Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Line Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Area
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Facility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Department
                </th>
                {canManageLines && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={canManageLines ? 6 : 5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No production lines found. Create your first line to get started.
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-bold bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-200 rounded">
                        {line.lineNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {line.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {line.area?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {line.area?.department?.facility?.name || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {line.area?.department?.name || '-'}
                      </div>
                    </td>
                    {canManageLines && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(line)}
                          className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(line.id)}
                          className="text-danger-600 hover:text-danger-900 dark:text-danger-400 dark:hover:text-danger-300"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
