'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { UserRole } from '@/types/auth';
import api from '@/lib/api';

interface Organization {
  id: string;
  name: string;
  region: string;
}

interface Facility {
  id: string;
  name: string;
  organizationId: string;
  organization?: Organization;
  address: string;
  timezone: string;
  _count?: {
    departments: number;
    areas: number;
    lines: number;
  };
}

const timezones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'America/Honolulu',
  'America/Mexico_City',
  'America/Monterrey',
  'America/Tijuana',
  'America/Toronto',
  'America/Vancouver',
];

export default function FacilitiesPage() {
  const { user } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [error, setError] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    organizationId: '',
    address: '',
    timezone: 'America/Chicago',
  });

  const canManageFacilities = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [facilitiesRes, orgsRes] = await Promise.all([
        api.get('/facilities'),
        api.get('/organizations'),
      ]);
      console.log('Organizations response:', orgsRes.data);
      console.log('Facilities response:', facilitiesRes.data);
      
      // Handle both response formats: data.Facility, data.facilities, or data.data (array)
      const facilitiesData = facilitiesRes.data.data?.Facility || facilitiesRes.data.data?.facilities || facilitiesRes.data.data || [];
      // Normalize the data - backend returns Organization (capital O) but frontend expects organization (lowercase)
      const normalizedFacilities = (Array.isArray(facilitiesData) ? facilitiesData : []).map((f: any) => ({
        ...f,
        organization: f.Organization || f.organization,
        _count: f._count ? {
          departments: f._count.Department || f._count.departments || 0,
          areas: f._count.Area || f._count.areas || 0,
          lines: f._count.Line || f._count.lines || 0,
        } : undefined,
      }));
      setFacilities(normalizedFacilities);
      // Handle organizations response - might be { organizations: [...] } or [...]
      const orgsData = orgsRes.data.data?.organizations || orgsRes.data.data || [];
      setOrganizations(Array.isArray(orgsData) ? orgsData : []);
    } catch (err: any) {
      console.error('Load data error:', err);
      const errorMsg = err.response?.data?.error;
      // Handle both string and object error formats
      setError(typeof errorMsg === 'string' ? errorMsg : errorMsg?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingFacility) {
        await api.patch(`/facilities/${editingFacility.id}`, formData);
      } else {
        await api.post('/facilities', formData);
      }
      
      await loadData();
      resetForm();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error;
      setError(typeof errorMsg === 'string' ? errorMsg : errorMsg?.message || 'Failed to save facility');
    }
  };

  const handleEdit = (facility: Facility) => {
    setEditingFacility(facility);
    setFormData({
      name: facility.name,
      organizationId: facility.organizationId,
      address: facility.address,
      timezone: facility.timezone,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, facilityName: string) => {
    // Initial confirmation warning
    const initialConfirm = confirm(
      `⚠️ Warning: Delete Facility\n\n` +
      `Are you sure you want to delete "${facilityName}"?\n\n` +
      `This action may affect related areas, lines, and shifts.\n` +
      `This cannot be undone.`
    );
    
    if (!initialConfirm) {
      return;
    }

    try {
      // First attempt: Check if cascade is needed
      const response = await api.delete(`/facilities/${id}`);
      await loadData();
      setError('');
    } catch (err: any) {
      const errorData = err.response?.data;
      
      // Check if it's a cascade delete scenario
      if (errorData?.canCascade && errorData?.details) {
        const { facility, areas, shifts } = errorData.details;
        
        // Show detailed confirmation dialog
        const confirmMessage = `Delete "${facility}" and all related data?\n\n` +
          `This will permanently delete:\n` +
          `• ${areas} area(s)\n` +
          `• ${shifts} shift(s)\n` +
          `• All lines within those areas\n\n` +
          `This action cannot be undone.`;
        
        if (confirm(confirmMessage)) {
          try {
            // Cascade delete with confirmation
            await api.delete(`/facilities/${id}?cascade=true`);
            await loadData();
            setError('');
          } catch (cascadeErr: any) {
            const errorMsg = cascadeErr.response?.data?.error;
            setError(typeof errorMsg === 'string' ? errorMsg : errorMsg?.message || 'Failed to delete facility');
          }
        }
      } else {
        // Other errors
        const errorMsg = errorData?.error;
        setError(typeof errorMsg === 'string' ? errorMsg : errorMsg?.message || 'Failed to delete facility');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      organizationId: '',
      address: '',
      timezone: 'America/Chicago',
    });
    setEditingFacility(null);
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Facilities</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Manage plants and production sites</p>
          </div>
          {canManageFacilities && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              {showForm ? 'Cancel' : '+ New Facility'}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
            <p className="text-danger-800 dark:text-danger-200">{error}</p>
          </div>
        )}

        {showForm && canManageFacilities && (
          <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {editingFacility ? 'Edit Facility' : 'Create New Facility'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Facility Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Phoenix Manufacturing Plant"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization *
                </label>
                <select
                  value={formData.organizationId}
                  onChange={(e) => setFormData({ ...formData, organizationId: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Select Organization</option>
                  {organizations?.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.region})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Address *
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="123 Main St, City, State, ZIP"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Timezone *
                </label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingFacility ? 'Update' : 'Create'}
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
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Facility
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Timezone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Departments
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Areas
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Lines
                </th>
                {canManageFacilities && (
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {!facilities || facilities.length === 0 ? (
                <tr>
                  <td colSpan={canManageFacilities ? 8 : 7} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                    No facilities found. Create your first facility to get started.
                  </td>
                </tr>
              ) : (
                facilities.map((facility) => (
                  <tr key={facility.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {facility.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {facility.organization?.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {facility.organization?.region}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {facility.address}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-white">
                        {facility.timezone}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-200 rounded">
                        {facility._count?.departments || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded">
                        {facility._count?.areas || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded">
                        {facility._count?.lines || 0}
                      </span>
                    </td>
                    {canManageFacilities && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(facility)}
                          className="text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(facility.id, facility.name)}
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
