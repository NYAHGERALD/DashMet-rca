'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { UserRole } from '@/types/auth';
import api from '@/lib/api';
import SmartTextarea from '@/components/ui/SmartTextarea';

interface Facility {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
  facilityId: string;
  facility?: Facility;
  _count?: {
    areas: number;
  };
}

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    facilityId: '',
  });

  const canManageDepartments = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [departmentsRes, facilitiesRes] = await Promise.all([
        api.get('/facilities/departments'),
        api.get('/facilities'),
      ]);
      
      // Normalize departments data - backend returns Facility (capital F) but frontend expects facility (lowercase)
      const departmentsData = departmentsRes.data.data.departments || [];
      const normalizedDepartments = departmentsData.map((d: any) => ({
        ...d,
        facility: d.Facility || d.facility,
        _count: d._count ? {
          areas: d._count.Area || d._count.areas || 0,
        } : undefined,
      }));
      setDepartments(normalizedDepartments);
      
      // API returns: { success: true, data: { Facility } } - note capital F
      const facilitiesData = facilitiesRes.data.data?.Facility || facilitiesRes.data.data?.facilities || [];
      setFacilities(Array.isArray(facilitiesData) ? facilitiesData : []);
    } catch (err: any) {
      console.error('Load data error:', err);
      setError(err.response?.data?.error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingDepartment) {
        await api.patch(`/facilities/departments/${editingDepartment.id}`, formData);
      } else {
        await api.post('/facilities/departments', formData);
      }
      
      await loadData();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save department');
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
      facilityId: department.facilityId,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      // First attempt: Check if cascade is needed
      const response = await api.delete(`/facilities/departments/${id}`);
      await loadData();
      setError('');
    } catch (err: any) {
      const errorData = err.response?.data;
      
      // Check if it's a cascade delete scenario
      if (errorData?.canCascade && errorData?.details) {
        const { department, areas } = errorData.details;
        
        // Show detailed confirmation dialog
        const confirmMessage = `Delete "${department}" and all related data?\n\n` +
          `This will permanently delete:\n` +
          `• ${areas} area(s)\n` +
          `• All lines within those areas\n\n` +
          `This action cannot be undone.`;
        
        if (confirm(confirmMessage)) {
          try {
            // Cascade delete with confirmation
            await api.delete(`/facilities/departments/${id}?cascade=true`);
            await loadData();
            setError('');
          } catch (cascadeErr: any) {
            setError(cascadeErr.response?.data?.error || 'Failed to delete department');
          }
        }
      } else {
        // Other errors
        setError(errorData?.error || 'Failed to delete department');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      facilityId: '',
    });
    setEditingDepartment(null);
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
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mb-4"
          >
            ← Back to Dashboard
          </Link>
        </div>
        
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Departments</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage departments within facilities</p>
          </div>
          {canManageDepartments && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {showForm ? 'Cancel' : '+ New Department'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
            <p className="text-danger-800 dark:text-danger-200">{error}</p>
          </div>
        )}

        {showForm && canManageDepartments && (
          <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {editingDepartment ? 'Edit Department' : 'Create New Department'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Facility *
                </label>
                <select
                  value={formData.facilityId}
                  onChange={(e) => setFormData({ ...formData, facilityId: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Facility</option>
                  {Array.isArray(facilities) && facilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Department Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Production, Quality Control, Packaging"
                />
              </div>

              <div>
                <SmartTextarea
                  label="Description"
                  value={formData.description}
                  onChange={(value) => setFormData({ ...formData, description: value })}
                  rows={3}
                  placeholder="Enter department description..."
                  context="department description for manufacturing facility"
                  enableGrammarCheck={true}
                  enableEnhance={true}
                  showMetrics={true}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingDepartment ? 'Update' : 'Create'} Department
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
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Facility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Areas
                </th>
                {canManageDepartments && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No departments found. Create your first department to get started.
                  </td>
                </tr>
              ) : (
                departments.map((department) => (
                  <tr key={department.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                      {department.name}
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {department.facility?.name}
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {department.description || '—'}
                    </td>
                    <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                      {department._count?.areas || 0}
                    </td>
                    {canManageDepartments && (
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(department)}
                            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(department.id)}
                            className="text-danger-600 dark:text-danger-400 hover:text-danger-700 dark:hover:text-danger-300 font-medium"
                          >
                            Delete
                          </button>
                        </div>
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
