'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { UserRole } from '@/types/auth';
import api from '@/lib/api';

interface Department {
  id: string;
  name: string;
  facility?: {
    id: string;
    name: string;
  };
}

interface Area {
  id: string;
  name: string;
  departmentId?: string;
  department?: Department;
  _count?: {
    lines: number;
  };
}

export default function AreasPage() {
  const { user } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    departmentId: '',
  });

  const canManageAreas = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN';

  useEffect(() => {
    console.log('AreasPage mounted, calling loadData');
    loadData();
  }, []);

  const loadData = async () => {
    console.log('loadData called');
    try {
      setLoading(true);
      console.log('Fetching areas and departments...');
      const [areasRes, departmentsRes] = await Promise.all([
        api.get('/facilities/areas'),
        api.get('/facilities/departments'),
      ]);
      console.log('API responses received:', {
        areas: areasRes.data,
        departments: departmentsRes.data
      });
      // Normalize areas data - backend returns Department/Facility (PascalCase)
      const areasData = areasRes.data.data.areas || [];
      const normalizedAreas = areasData.map((a: any) => ({
        ...a,
        department: a.Department ? {
          ...a.Department,
          facility: a.Department.Facility || a.Department.facility,
        } : a.department,
        _count: a._count ? {
          lines: a._count.Line || a._count.lines || 0,
        } : undefined,
      }));
      setAreas(normalizedAreas);
      
      // Handle departments response - normalize Facility to facility
      const departmentsData = departmentsRes.data.data?.departments || departmentsRes.data.departments || [];
      const normalizedDepartments = (Array.isArray(departmentsData) ? departmentsData : []).map((d: any) => ({
        ...d,
        facility: d.Facility || d.facility,
      }));
      setDepartments(normalizedDepartments);
    } catch (err: any) {
      console.error('Load data error:', err);
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      console.log('loadData finished, setting loading to false');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingArea) {
        await api.patch(`/facilities/areas/${editingArea.id}`, formData);
      } else {
        await api.post('/facilities/areas', formData);
      }
      
      await loadData();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save area');
    }
  };

  const handleEdit = (area: Area) => {
    setEditingArea(area);
    setFormData({
      name: area.name,
      departmentId: area.departmentId || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this area? This will also delete all lines and shifts.')) return;

    try {
      await api.delete(`/facilities/areas/${id}`);
      await loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete area');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      departmentId: '',
    });
    setEditingArea(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={['ADMIN', 'SYSTEM_ADMIN']}>
        <div className="p-8">
          <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['ADMIN', 'SYSTEM_ADMIN']}>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Areas</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage production areas within facilities</p>
          </div>
          {canManageAreas && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {showForm ? 'Cancel' : '+ New Area'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
            <p className="text-danger-800 dark:text-danger-200">{error}</p>
          </div>
        )}

        {showForm && canManageAreas && (
          <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {editingArea ? 'Edit Area' : 'Create New Area'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Department *
                </label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Department</option>
                  {Array.isArray(departments) && departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name} ({department.facility?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Area Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Packaging Area, Assembly Zone"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingArea ? 'Update' : 'Create'}
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
          <table className="w-full min-w-[600px]">
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Area Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Facility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Production Lines
                </th>
                {canManageAreas && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {areas.length === 0 ? (
                <tr>
                  <td colSpan={canManageAreas ? 4 : 3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No areas found. Create your first area to get started.
                  </td>
                </tr>
              ) : (
                areas.map((area) => (
                  <tr key={area.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {area.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {area.department?.name || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {area.department?.facility?.name || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                        {area._count?.lines || 0} lines
                      </span>
                    </td>
                    {canManageAreas && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(area)}
                          className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(area.id)}
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
