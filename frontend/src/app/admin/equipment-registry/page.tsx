'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { UserRole } from '@/types/auth';
import api from '@/lib/api';
import ImageCropModal from '@/components/ui/ImageCropModal';
import PhotoLightbox from '@/components/ui/PhotoLightbox';
import ComponentDetailModal from '@/components/ui/ComponentDetailModal';
import ComponentEditModal from '@/components/ui/ComponentEditModal';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Facility {
  id: string;
  name: string;
}

interface Department {
  id: string;
  name: string;
  Facility?: Facility;
  facility?: Facility;
}

interface Area {
  id: string;
  name: string;
  Department?: Department;
  department?: Department;
}

interface LineItem {
  id: string;
  name: string;
  lineNumber?: string;
  Area?: Area;
  area?: Area;
}

interface EquipmentComponent {
  id: string;
  name: string;
  description?: string;
  partNumber?: string;
  manufacturer?: string;
  photos?: { url: string; name: string }[];
  isCritical: boolean;
  status: string;
  equipmentId: string;
  createdAt: string;
}

interface Equipment {
  id: string;
  name: string;
  description?: string;
  assetTag?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  status: string;
  photos?: { url: string; name: string }[];
  lineId: string;
  createdAt: string;
  updatedAt: string;
  Line?: {
    id: string;
    name: string;
    lineNumber?: string;
    Area?: {
      id: string;
      name: string;
      Department?: {
        id: string;
        name: string;
        Facility?: Facility;
      };
    };
  };
  _count?: { Components: number };
  Components?: EquipmentComponent[];
}

type EquipmentStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'RETIRED';

const STATUS_OPTIONS: { value: EquipmentStatus; label: string; color: string; bg: string }[] = [
  { value: 'ACTIVE', label: 'Active', color: 'text-green-800 dark:text-green-300', bg: 'bg-green-100 dark:bg-green-900/30' },
  { value: 'INACTIVE', label: 'Inactive', color: 'text-gray-800 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-700' },
  { value: 'MAINTENANCE', label: 'Maintenance', color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  { value: 'RETIRED', label: 'Retired', color: 'text-red-800 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/30' },
];

const getStatusStyle = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];

// ─── Page Component ─────────────────────────────────────────────────────────────

export default function EquipmentRegistryPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN';

  // ─── Data state ───────────────────────────────────────────────────────────────
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ─── Filters ──────────────────────────────────────────────────────────────────
  const [filterFacility, setFilterFacility] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterLine, setFilterLine] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [showFilterPicker, setShowFilterPicker] = useState(false);

  const ALL_FILTER_TYPES = [
    { key: 'facility', label: 'Facility' },
    { key: 'department', label: 'Department' },
    { key: 'area', label: 'Area' },
    { key: 'line', label: 'Line' },
    { key: 'status', label: 'Status' },
    { key: 'search', label: 'Search' },
  ] as const;

  const availableFilters = ALL_FILTER_TYPES.filter((f) => !activeFilters.includes(f.key));

  const addFilter = (key: string) => {
    setActiveFilters((prev) => [...prev, key]);
    setShowFilterPicker(false);
  };

  const removeFilter = (key: string) => {
    setActiveFilters((prev) => prev.filter((k) => k !== key));
    // Clear the filter value when removed
    if (key === 'facility') { setFilterFacility(''); setFilterDepartment(''); setFilterArea(''); setFilterLine(''); setActiveFilters((prev) => prev.filter((k) => !['department', 'area', 'line'].includes(k) && k !== 'facility')); return; }
    if (key === 'department') { setFilterDepartment(''); setFilterArea(''); setFilterLine(''); setActiveFilters((prev) => prev.filter((k) => !['area', 'line'].includes(k) && k !== 'department')); return; }
    if (key === 'area') { setFilterArea(''); setFilterLine(''); setActiveFilters((prev) => prev.filter((k) => k !== 'line' && k !== 'area')); return; }
    if (key === 'line') setFilterLine('');
    if (key === 'status') setFilterStatus('');
    if (key === 'search') { setSearchQuery(''); setDebouncedSearchQuery(''); }
  };

  const activeFilterCount = [filterFacility, filterDepartment, filterArea, filterLine, filterStatus, debouncedSearchQuery].filter(Boolean).length;

  // ─── Equipment form state ─────────────────────────────────────────────────────
  const [showEquipmentForm, setShowEquipmentForm] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [eqForm, setEqForm] = useState({
    name: '',
    description: '',
    assetTag: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    facilityId: '',
    departmentId: '',
    areaId: '',
    lineId: '',
  });

  // ─── Component panel state ────────────────────────────────────────────────────
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [components, setComponents] = useState<EquipmentComponent[]>([]);
  const [componentsLoading, setComponentsLoading] = useState(false);
  const [showComponentForm, setShowComponentForm] = useState(false);
  const [editingComponent, setEditingComponent] = useState<EquipmentComponent | null>(null);
  const [compForm, setCompForm] = useState({
    name: '',
    description: '',
    partNumber: '',
    manufacturer: '',
    isCritical: false,
  });

  // ─── Photo upload state ─────────────────────────────────────────────────────
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  // ─── Component photo state ────────────────────────────────────────────────────
  const [compPendingPhotos, setCompPendingPhotos] = useState<File[]>([]);
  const [compPhotoPreviews, setCompPhotoPreviews] = useState<string[]>([]);
  const [compUploadingPhotos, setCompUploadingPhotos] = useState(false);

  // ─── Crop modal state ─────────────────────────────────────────────────────────
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropQueueIndex, setCropQueueIndex] = useState(0);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [cropTarget, setCropTarget] = useState<'equipment' | 'component'>('equipment');

  // ─── Photo Lightbox state ─────────────────────────────────────────────────────
  const [lightboxPhotos, setLightboxPhotos] = useState<{ url: string; name: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // ─── Photo rename state ───────────────────────────────────────────────────────
  const [renamingPhotoUrl, setRenamingPhotoUrl] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // ─── Component detail modal state ─────────────────────────────────────────────
  const [detailComponent, setDetailComponent] = useState<EquipmentComponent | null>(null);

  // ─── Derived filter lists ─────────────────────────────────────────────────────
  const filteredDepartments = departments.filter((d) => {
    return !filterFacility || (d as any).facilityId === filterFacility;
  });

  const filteredAreas = areas.filter((a) => {
    return !filterDepartment || (a as any).departmentId === filterDepartment;
  });

  const filteredLines = lines.filter((l) => {
    return !filterArea || (l as any).areaId === filterArea;
  });

  // Form-specific filtered lists
  const formDepartments = departments.filter((d) => !eqForm.facilityId || (d as any).facilityId === eqForm.facilityId);
  const formAreas = areas.filter((a) => !eqForm.departmentId || (a as any).departmentId === eqForm.departmentId);
  const formLines = lines.filter((l) => !eqForm.areaId || (l as any).areaId === eqForm.areaId);

  // ─── Debounce search query ────────────────────────────────────────────────────
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  // ─── Data loading ─────────────────────────────────────────────────────────────
  const loadEquipment = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (filterLine) params.lineId = filterLine;
      if (filterStatus) params.status = filterStatus;
      if (debouncedSearchQuery) params.search = debouncedSearchQuery;

      const res = await api.get('/equipment', { params });
      const results = res.data.data?.equipment || [];
      setEquipment(results);

      // Auto-open component panel if search matches a component name
      if (debouncedSearchQuery && results.length > 0) {
        const searchLower = debouncedSearchQuery.toLowerCase();
        const eqWithMatchingComp = results.find((eq: Equipment) =>
          eq.Components?.some((c: EquipmentComponent) => c.name.toLowerCase().includes(searchLower))
        );
        if (eqWithMatchingComp) {
          setSelectedEquipment(eqWithMatchingComp);
          setComponents(eqWithMatchingComp.Components || []);
        }
      } else if (!debouncedSearchQuery) {
        // Clear auto-opened panel when search is cleared
        setSelectedEquipment((prev) => {
          if (prev && !results.find((eq: Equipment) => eq.id === prev.id)) return null;
          return prev;
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load machines');
    }
  }, [filterLine, filterStatus, debouncedSearchQuery]);

  const loadLocationData = useCallback(async () => {
    try {
      const [facRes, deptRes, areaRes, lineRes] = await Promise.all([
        api.get('/facilities'),
        api.get('/facilities/departments'),
        api.get('/facilities/areas'),
        api.get('/facilities/lines'),
      ]);

      setFacilities(facRes.data.data?.Facility || facRes.data.data?.facilities || []);

      const rawDepts = deptRes.data.data?.departments || [];
      setDepartments(rawDepts);

      const rawAreas = areaRes.data.data?.areas || [];
      setAreas(rawAreas);

      const rawLines = lineRes.data.data?.lines || [];
      setLines(rawLines);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load location data');
    }
  }, []);

  // Initial load — runs only once on mount
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    const init = async () => {
      setLoading(true);
      await loadLocationData();
      await loadEquipment();
      setLoading(false);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload equipment when filters change (no loading spinner)
  useEffect(() => {
    if (loading) return;
    loadEquipment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterLine, filterStatus, debouncedSearchQuery]);

  // ─── Equipment CRUD handlers ──────────────────────────────────────────────────
  const resetEquipmentForm = () => {
    setEqForm({ name: '', description: '', assetTag: '', manufacturer: '', model: '', serialNumber: '', facilityId: '', departmentId: '', areaId: '', lineId: '' });
    setEditingEquipment(null);
    setShowEquipmentForm(false);
    // Clean up photo previews
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setPendingPhotos([]);
    setPhotoPreviews([]);
  };

  const handleEquipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!eqForm.name.trim() || !eqForm.lineId) {
      setError('Machine name and production line are required.');
      return;
    }

    try {
      const payload = {
        name: eqForm.name,
        description: eqForm.description || undefined,
        assetTag: eqForm.assetTag || undefined,
        manufacturer: eqForm.manufacturer || undefined,
        model: eqForm.model || undefined,
        serialNumber: eqForm.serialNumber || undefined,
        lineId: eqForm.lineId,
      };

      let equipmentId = editingEquipment?.id;

      if (editingEquipment) {
        await api.patch(`/equipment/${editingEquipment.id}`, payload);
        setSuccess('Machine updated successfully');
      } else {
        const res = await api.post('/equipment', payload);
        equipmentId = res.data.data?.id;
        setSuccess('Machine created successfully');
      }

      // Upload pending photos if any
      if (pendingPhotos.length > 0 && equipmentId) {
        setUploadingPhotos(true);
        try {
          const formData = new FormData();
          pendingPhotos.forEach((file) => formData.append('photos', file));
          await api.post(`/equipment/${equipmentId}/photos`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          setError('Machine saved but photo upload failed. You can add photos later by editing.');
        } finally {
          setUploadingPhotos(false);
        }
      }

      resetEquipmentForm();
      await loadEquipment();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save machine');
    }
  };

  const handleEditEquipment = (eq: Equipment) => {
    const area = eq.Line?.Area;
    const dept = area?.Department;
    const fac = dept?.Facility;

    setEditingEquipment(eq);
    setEqForm({
      name: eq.name,
      description: eq.description || '',
      assetTag: eq.assetTag || '',
      manufacturer: eq.manufacturer || '',
      model: eq.model || '',
      serialNumber: eq.serialNumber || '',
      facilityId: fac?.id || '',
      departmentId: dept?.id || '',
      areaId: area?.id || '',
      lineId: eq.lineId,
    });
    setShowEquipmentForm(true);
  };

  const handleArchiveEquipment = async (id: string) => {
    if (!confirm('Archive this machine? It will be marked as Retired.')) return;
    try {
      await api.delete(`/equipment/${id}?archive=true`);
      setSuccess('Machine archived');
      await loadEquipment();
      if (selectedEquipment?.id === id) setSelectedEquipment(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to archive machine');
    }
  };

  const handleDeleteEquipment = async (id: string) => {
    if (!confirm('Permanently delete this machine and all its components? This cannot be undone.')) return;
    try {
      await api.delete(`/equipment/${id}`);
      setSuccess('Machine deleted');
      await loadEquipment();
      if (selectedEquipment?.id === id) setSelectedEquipment(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete machine');
    }
  };

  // ─── Component CRUD handlers ──────────────────────────────────────────────────
  const loadComponents = async (equipmentId: string) => {
    setComponentsLoading(true);
    try {
      const res = await api.get(`/equipment/${equipmentId}/components`);
      setComponents(res.data.data?.components || []);
    } catch {
      setComponents([]);
    } finally {
      setComponentsLoading(false);
    }
  };

  const openComponentPanel = async (eq: Equipment) => {
    setSelectedEquipment(eq);
    await loadComponents(eq.id);
  };

  const resetComponentForm = () => {
    setCompForm({ name: '', description: '', partNumber: '', manufacturer: '', isCritical: false });
    setEditingComponent(null);
    setShowComponentForm(false);
    compPhotoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setCompPendingPhotos([]);
    setCompPhotoPreviews([]);
  };

  const handleComponentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEquipment || !compForm.name.trim()) return;

    try {
      let componentId = editingComponent?.id;

      if (editingComponent) {
        await api.patch(`/equipment/${selectedEquipment.id}/components/${editingComponent.id}`, compForm);
        setSuccess('Component updated');
      } else {
        const res = await api.post(`/equipment/${selectedEquipment.id}/components`, compForm);
        componentId = res.data.data?.id;
        setSuccess('Component added');
      }

      // Upload pending component photos
      if (compPendingPhotos.length > 0 && componentId) {
        setCompUploadingPhotos(true);
        try {
          const formData = new FormData();
          compPendingPhotos.forEach((file) => formData.append('photos', file));
          await api.post(`/equipment/${selectedEquipment.id}/components/${componentId}/photos`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch {
          setError('Component saved but photo upload failed.');
        } finally {
          setCompUploadingPhotos(false);
        }
      }

      resetComponentForm();
      await loadComponents(selectedEquipment.id);
      await loadEquipment();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save component');
    }
  };

  const handleEditComponent = (comp: EquipmentComponent) => {
    setEditingComponent(comp);
    setCompForm({
      name: comp.name,
      description: comp.description || '',
      partNumber: comp.partNumber || '',
      manufacturer: comp.manufacturer || '',
      isCritical: comp.isCritical,
    });
    setShowComponentForm(true);
  };

  const handleDeleteComponent = async (compId: string) => {
    if (!selectedEquipment || !confirm('Delete this component?')) return;
    try {
      await api.delete(`/equipment/${selectedEquipment.id}/components/${compId}`);
      setSuccess('Component deleted');
      await loadComponents(selectedEquipment.id);
      await loadEquipment();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete component');
    }
  };

  // ─── Crop queue processing ─────────────────────────────────────────────────
  const startCropQueue = (files: File[], target: 'equipment' | 'component') => {
    if (files.length === 0) return;
    setCropQueue(files);
    setCropQueueIndex(0);
    setCropTarget(target);
    const src = URL.createObjectURL(files[0]);
    setCropImageSrc(src);
  };

  const advanceCropQueue = () => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    const nextIndex = cropQueueIndex + 1;
    if (nextIndex < cropQueue.length) {
      setCropQueueIndex(nextIndex);
      const src = URL.createObjectURL(cropQueue[nextIndex]);
      setCropImageSrc(src);
    } else {
      setCropQueue([]);
      setCropQueueIndex(0);
      setCropImageSrc('');
    }
  };

  const handleCropComplete = (blob: Blob) => {
    const originalFile = cropQueue[cropQueueIndex];
    const croppedFile = new File([blob], originalFile.name, { type: 'image/jpeg' });
    const preview = URL.createObjectURL(croppedFile);

    if (cropTarget === 'equipment') {
      setPendingPhotos((prev) => [...prev, croppedFile]);
      setPhotoPreviews((prev) => [...prev, preview]);
    } else {
      setCompPendingPhotos((prev) => [...prev, croppedFile]);
      setCompPhotoPreviews((prev) => [...prev, preview]);
    }
    advanceCropQueue();
  };

  const handleCropUseOriginal = () => {
    const originalFile = cropQueue[cropQueueIndex];
    const preview = URL.createObjectURL(originalFile);

    if (cropTarget === 'equipment') {
      setPendingPhotos((prev) => [...prev, originalFile]);
      setPhotoPreviews((prev) => [...prev, preview]);
    } else {
      setCompPendingPhotos((prev) => [...prev, originalFile]);
      setCompPhotoPreviews((prev) => [...prev, preview]);
    }
    advanceCropQueue();
  };

  const handleCropSkip = () => {
    advanceCropQueue();
  };

  // ─── Photo rename handler ─────────────────────────────────────────────────────
  const handleRenamePhoto = async (photoUrl: string, newName: string, target: 'equipment' | 'component') => {
    try {
      if (target === 'equipment' && editingEquipment) {
        await api.patch(`/equipment/${editingEquipment.id}/photos/rename`, { url: photoUrl, name: newName });
        setEditingEquipment({
          ...editingEquipment,
          photos: editingEquipment.photos?.map((p) => p.url === photoUrl ? { ...p, name: newName } : p),
        });
      } else if (target === 'component' && editingComponent && selectedEquipment) {
        await api.patch(`/equipment/${selectedEquipment.id}/components/${editingComponent.id}/photos/rename`, { url: photoUrl, name: newName });
        setEditingComponent({
          ...editingComponent,
          photos: editingComponent.photos?.map((p) => p.url === photoUrl ? { ...p, name: newName } : p),
        });
      }
      setRenamingPhotoUrl(null);
      setRenameValue('');
      setSuccess('Photo renamed');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('Failed to rename photo');
    }
  };

  // ─── Client-side filtering for Facility/Department/Area (before line) ─────────
  const displayedEquipment = equipment.filter((eq) => {
    const area = eq.Line?.Area;
    const dept = area?.Department;
    const fac = dept?.Facility;

    if (filterFacility && fac?.id !== filterFacility) return false;
    if (filterDepartment && dept?.id !== filterDepartment) return false;
    if (filterArea && area?.id !== filterArea) return false;
    return true;
  });

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ProtectedRoute minRole={UserRole.ADMIN}>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">Loading Machine Registry...</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute minRole={UserRole.ADMIN}>
      <div className="w-full h-screen flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 px-4 sm:px-8 pt-2 sm:pt-3 pb-2 bg-gradient-to-r from-primary-50 via-white to-primary-50/60 dark:from-slate-800 dark:via-slate-800/80 dark:to-primary-900/20 border-b border-primary-100 dark:border-slate-700/60 z-20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                ⚙️ Machine Registry
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-xs">
                Manage machine catalog by Facility → Department → Area → Line
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => {
                  resetEquipmentForm();
                  setShowEquipmentForm(!showEquipmentForm);
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm shadow-sm"
              >
                {showEquipmentForm ? '✕ Cancel' : '+ New Machine'}
              </button>
            )}
          </div>
        </div>

        {/* Content area with padding */}
        <div className="flex-1 flex flex-col min-h-0 px-4 sm:px-8 pt-2 pb-2">

        {/* Search Bar */}
        <div className="flex-shrink-0 flex items-center justify-center mb-3">
          <div className="flex items-center w-full max-w-2xl bg-white dark:bg-slate-800 rounded-full shadow-sm border-2 border-gray-500 dark:border-slate-500 focus-within:ring-2 focus-within:ring-[#3aa8e8] focus-within:border-[#3aa8e8] transition-all">
            <span className="pl-4 pr-2 text-sm font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap select-none">Search</span>
            <div className="w-px h-5 bg-gray-300 dark:bg-slate-600 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Machines, components, asset tags..."
              className="flex-1 px-3 py-2 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none rounded-r-full"
              title="Search machines and components"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="pr-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                title="Clear search"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
            {!searchQuery && (
              <div className="pr-3 text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg flex items-center justify-between">
            <p className="text-sm text-danger-800 dark:text-danger-200">{error}</p>
            <button onClick={() => setError('')} className="text-danger-600 dark:text-danger-400 hover:text-danger-800 text-lg leading-none">&times;</button>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
          </div>
        )}

        {/* ─── Equipment Form Modal ───────────────────────────────────────── */}
        {showEquipmentForm && canManage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={resetEquipmentForm} />
            {/* Modal */}
            <div className="relative w-full max-w-3xl mx-4 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-[#3aa8e8] dark:bg-[#2d8abf] border-b border-[#3aa8e8]/20 rounded-t-xl">
                <h2 className="text-lg font-semibold text-white">
                  {editingEquipment ? 'Edit Machine' : 'Register New Machine'}
                </h2>
                <button
                  onClick={resetEquipmentForm}
                  className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/15 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleEquipmentSubmit} className="p-6 space-y-4">
                {/* Location cascade: Facility → Department → Area → Line */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Facility *</label>
                    <select
                      value={eqForm.facilityId}
                      onChange={(e) => setEqForm({ ...eqForm, facilityId: e.target.value, departmentId: '', areaId: '', lineId: '' })}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Select Facility</option>
                      {facilities.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Department *</label>
                    <select
                      value={eqForm.departmentId}
                      onChange={(e) => setEqForm({ ...eqForm, departmentId: e.target.value, areaId: '', lineId: '' })}
                      required
                      disabled={!eqForm.facilityId}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      <option value="">Select Department</option>
                      {formDepartments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Area *</label>
                    <select
                      value={eqForm.areaId}
                      onChange={(e) => setEqForm({ ...eqForm, areaId: e.target.value, lineId: '' })}
                      required
                      disabled={!eqForm.departmentId}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      <option value="">Select Area</option>
                      {formAreas.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Production Line *</label>
                    <select
                      value={eqForm.lineId}
                      onChange={(e) => setEqForm({ ...eqForm, lineId: e.target.value })}
                      required
                      disabled={!eqForm.areaId}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                    >
                      <option value="">Select Line</option>
                      {formLines.map((l) => (
                        <option key={l.id} value={l.id}>{l.lineNumber ? `${l.lineNumber} — ` : ''}{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Equipment details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Machine Name *</label>
                    <input
                      type="text"
                      value={eqForm.name}
                      onChange={(e) => setEqForm({ ...eqForm, name: e.target.value })}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., Wrapper Machine #1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Asset Tag</label>
                    <input
                      type="text"
                      value={eqForm.assetTag}
                      onChange={(e) => setEqForm({ ...eqForm, assetTag: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., EQ-10042"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Manufacturer</label>
                    <input
                      type="text"
                      value={eqForm.manufacturer}
                      onChange={(e) => setEqForm({ ...eqForm, manufacturer: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., Bosch, Siemens"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Model</label>
                    <input
                      type="text"
                      value={eqForm.model}
                      onChange={(e) => setEqForm({ ...eqForm, model: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., XR-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Serial Number</label>
                    <input
                      type="text"
                      value={eqForm.serialNumber}
                      onChange={(e) => setEqForm({ ...eqForm, serialNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., SN-2024-00123"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
                    <textarea
                      value={eqForm.description}
                      onChange={(e) => setEqForm({ ...eqForm, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 resize-none"
                      placeholder="Optional description"
                    />
                  </div>
                </div>

                {/* Photo Upload Section */}
                <div className="border border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Photos (optional)</label>
                  <div className="flex items-center gap-3 mb-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-slate-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      Choose Photos
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          startCropQueue(files, 'equipment');
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {pendingPhotos.length > 0 ? `${pendingPhotos.length} photo(s) selected` : 'JPG, PNG, WebP up to 50MB each'}
                    </span>
                  </div>
                  {photoPreviews.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {photoPreviews.map((src, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={src}
                            alt={pendingPhotos[idx]?.name || `Preview ${idx + 1}`}
                            className="w-24 h-24 object-contain rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 cursor-pointer"
                            onClick={() => {
                              setLightboxPhotos([{ url: src, name: pendingPhotos[idx]?.name || `Photo ${idx + 1}` }]);
                              setLightboxIndex(0);
                            }}
                          />
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-[96px] truncate">{pendingPhotos[idx]?.name}</p>
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(src);
                              setPendingPhotos((prev) => prev.filter((_, i) => i !== idx));
                              setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Show existing photos when editing */}
                  {editingEquipment && editingEquipment.photos && editingEquipment.photos.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Existing photos:</p>
                      <div className="flex flex-wrap gap-3">
                        {editingEquipment.photos.map((photo, idx) => (
                          <div key={idx} className="relative group">
                            <img
                              src={photo.url}
                              alt={photo.name || `Photo ${idx + 1}`}
                              className="w-24 h-24 object-contain rounded-lg border border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900 cursor-pointer"
                              onClick={() => {
                                setLightboxPhotos(editingEquipment.photos || []);
                                setLightboxIndex(idx);
                              }}
                            />
                            {renamingPhotoUrl === photo.url ? (
                              <form
                                className="mt-0.5"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  handleRenamePhoto(photo.url, renameValue, 'equipment');
                                }}
                              >
                                <input
                                  type="text"
                                  value={renameValue}
                                  onChange={(e) => setRenameValue(e.target.value)}
                                  autoFocus
                                  className="w-24 text-sm px-1 py-0.5 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                                  onBlur={() => { setRenamingPhotoUrl(null); setRenameValue(''); }}
                                  onKeyDown={(e) => { if (e.key === 'Escape') { setRenamingPhotoUrl(null); setRenameValue(''); } }}
                                />
                              </form>
                            ) : (
                              <p
                                className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 max-w-[96px] truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                                title="Click to rename"
                                onClick={() => { setRenamingPhotoUrl(photo.url); setRenameValue(photo.name || ''); }}
                              >
                                {photo.name || 'Unnamed'}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await api.delete(`/equipment/${editingEquipment.id}/photos`, { data: { url: photo.url } });
                                  setEditingEquipment({ ...editingEquipment, photos: editingEquipment.photos!.filter((p) => p.url !== photo.url) });
                                  setSuccess('Photo removed');
                                  setTimeout(() => setSuccess(''), 2000);
                                } catch { setError('Failed to remove photo'); }
                              }}
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={uploadingPhotos}
                    className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    {uploadingPhotos ? 'Uploading Photos...' : editingEquipment ? 'Update Machine' : 'Register Machine'}
                  </button>
                  <button
                    type="button"
                    onClick={resetEquipmentForm}
                    className="px-5 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ─── Main Content ────────────────────────────────────────────────── */}
        <div className="flex gap-1 flex-1 min-h-0">

          {/* ─── Slide-out Filter Panel ──────────────────────────────────── */}
          <div
            className={`flex-shrink-0 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
              showFilterPanel ? 'w-[280px] opacity-100' : 'w-0 opacity-0'
            }`}
          >
            <div className="w-[280px] h-full bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden">
              {/* Filter Panel Header */}
              <div className="px-4 py-2.5 bg-[#3aa8e8] dark:bg-[#2d8abf] border-b border-[#3aa8e8]/20 flex items-center justify-between flex-shrink-0 rounded-t-xl">
                <span className="text-sm font-semibold text-white uppercase tracking-wider">Filters</span>
                <button
                  onClick={() => setShowFilterPanel(false)}
                  className="p-1 text-white/70 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
                  title="Close filters"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Active Filters */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {activeFilters.map((key) => {
                  const filterDef = ALL_FILTER_TYPES.find((f) => f.key === key);
                  if (!filterDef) return null;
                  return (
                    <div key={key} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{filterDef.label}</label>
                        <button
                          onClick={() => removeFilter(key)}
                          className="p-0.5 text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title={`Remove ${filterDef.label} filter`}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      {key === 'facility' && (
                        <select
                          value={filterFacility}
                          onChange={(e) => { setFilterFacility(e.target.value); setFilterDepartment(''); setFilterArea(''); setFilterLine(''); }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                          title="Facility filter"
                        >
                          <option value="">All Facilities</option>
                          {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      )}
                      {key === 'department' && (
                        <select
                          value={filterDepartment}
                          onChange={(e) => { setFilterDepartment(e.target.value); setFilterArea(''); setFilterLine(''); }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                          title="Department filter"
                        >
                          <option value="">All Departments</option>
                          {filteredDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      )}
                      {key === 'area' && (
                        <select
                          value={filterArea}
                          onChange={(e) => { setFilterArea(e.target.value); setFilterLine(''); }}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                          title="Area filter"
                        >
                          <option value="">All Areas</option>
                          {filteredAreas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      )}
                      {key === 'line' && (
                        <select
                          value={filterLine}
                          onChange={(e) => setFilterLine(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                          title="Line filter"
                        >
                          <option value="">All Lines</option>
                          {filteredLines.map((l) => <option key={l.id} value={l.id}>{l.lineNumber ? `${l.lineNumber} — ` : ''}{l.name}</option>)}
                        </select>
                      )}
                      {key === 'status' && (
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                          title="Status filter"
                        >
                          <option value="">All Statuses</option>
                          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      )}
                      {key === 'search' && (
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Name, asset tag..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500"
                          title="Search filter"
                        />
                      )}
                    </div>
                  );
                })}

                {activeFilters.length === 0 && (
                  <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                    <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                    <p className="text-sm">No filters added</p>
                    <p className="text-xs mt-0.5">Click + to add a filter</p>
                  </div>
                )}
              </div>

              {/* Add Filter Button */}
              {availableFilters.length > 0 && (
                <div className="px-3 py-3 border-t border-gray-200 dark:border-slate-700 flex-shrink-0 relative">
                  <button
                    onClick={() => setShowFilterPicker(!showFilterPicker)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-lg transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Add Filter
                  </button>

                  {/* Filter Picker Dropdown */}
                  {showFilterPicker && (
                    <div className="absolute bottom-full left-3 right-3 mb-1 bg-white dark:bg-slate-700 rounded-lg shadow-xl border border-gray-200 dark:border-slate-600 py-1 z-20 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      {availableFilters.map((f) => (
                        <button
                          key={f.key}
                          onClick={() => addFilter(f.key)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Equipment Table */}
          <div className={`flex-1 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col ${selectedEquipment ? 'hidden lg:block lg:flex' : ''}`}>
            <div className="px-4 py-2.5 bg-[#3aa8e8] dark:bg-[#2d8abf] border-b border-[#3aa8e8]/20 flex items-center justify-between rounded-t-xl">
              <span className="text-sm font-semibold text-white uppercase tracking-wider">
                Machines ({displayedEquipment.length})
              </span>
              <button
                onClick={() => { setShowFilterPanel(!showFilterPanel); setShowFilterPicker(false); }}
                className={`relative p-1.5 rounded-lg transition-colors ${
                  showFilterPanel
                    ? 'bg-white/25 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/15'
                }`}
                title="Toggle filters"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-white text-[#3aa8e8] text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-slate-800 dark:to-slate-900 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Machine</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                    <th className="px-4 py-2.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Manufacturer</th>
                    <th className="px-4 py-2.5 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Components</th>
                    <th className="px-4 py-2.5 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    {canManage && (
                      <th className="px-4 py-2.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300 dark:divide-slate-600">
                  {displayedEquipment.length === 0 ? (
                    <tr>
                      <td colSpan={canManage ? 6 : 5} className="px-6 py-12 text-center">
                        <div className="text-gray-400 dark:text-gray-500">
                          <p className="text-3xl mb-2">⚙️</p>
                          <p className="font-medium text-sm">No machines found</p>
                          <p className="text-sm mt-1">Register your first machine to get started.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedEquipment.map((eq) => {
                      const area = eq.Line?.Area;
                      const dept = area?.Department;
                      const fac = dept?.Facility;
                      const statusStyle = getStatusStyle(eq.status);
                      const isSelected = selectedEquipment?.id === eq.id;

                      return (
                        <tr
                          key={eq.id}
                          className={`cursor-pointer transition-all duration-200 ease-in-out hover:bg-primary-50/60 dark:hover:bg-primary-900/15 hover:shadow-[inset_3px_0_0_0_theme(colors.primary.500)] ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20 shadow-[inset_3px_0_0_0_theme(colors.primary.500)]' : ''}`}
                          onClick={() => openComponentPanel(eq)}
                        >
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{eq.name}</div>
                            {eq.assetTag && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-0.5">{eq.assetTag}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700 dark:text-gray-300">{fac?.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {dept?.name} → {area?.name} → {eq.Line?.lineNumber || eq.Line?.name}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-700 dark:text-gray-300">{eq.manufacturer || '—'}</div>
                            {eq.model && <div className="text-sm text-gray-500 dark:text-gray-400">{eq.model}</div>}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-slate-700 text-sm font-bold text-gray-700 dark:text-gray-300">
                              {eq._count?.Components || 0}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-sm font-semibold ${statusStyle.color} ${statusStyle.bg}`}>
                              {statusStyle.label}
                            </span>
                          </td>
                          {canManage && (
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openComponentPanel(eq)}
                                  className="px-2 py-1 text-sm font-medium text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                                >
                                  Components
                                </button>
                                <button
                                  onClick={() => handleEditEquipment(eq)}
                                  className="px-2 py-1 text-sm font-medium text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleArchiveEquipment(eq.id)}
                                  className="px-2 py-1 text-sm font-medium text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
                                >
                                  Archive
                                </button>
                                <button
                                  onClick={() => handleDeleteEquipment(eq.id)}
                                  className="px-2 py-1 text-sm font-medium text-danger-600 hover:text-danger-800 dark:text-danger-400 dark:hover:text-danger-300 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ─── Components Side Panel ─────────────────────────────────────── */}
          {selectedEquipment && (
            <div className="w-full lg:w-[420px] flex-shrink-0 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col">
              {/* Panel Header */}
              <div className="px-4 py-2.5 bg-[#3aa8e8] dark:bg-[#2d8abf] border-b border-[#3aa8e8]/20 text-white flex items-center justify-between flex-shrink-0 rounded-t-xl">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate">{selectedEquipment.name}</h3>
                  <p className="text-xs text-white/75 truncate">
                    Components & Parts
                  </p>
                </div>
                <button
                  onClick={() => { setSelectedEquipment(null); resetComponentForm(); }}
                  className="p-1.5 text-white/70 hover:text-white hover:bg-white/15 rounded-lg transition-colors flex-shrink-0 ml-2"
                >
                  ✕
                </button>
              </div>

              {/* Add Component Button */}
              {canManage && (
                <div className="px-4 py-2 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
                  <button
                    onClick={() => {
                      resetComponentForm();
                      setShowComponentForm(true);
                    }}
                    className="w-full px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-lg text-sm font-semibold hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors border border-primary-200 dark:border-primary-800"
                  >
                    + Add Component
                  </button>
                </div>
              )}

              {/* Components List */}
              <div className="flex-1 overflow-y-auto">
                {componentsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600" />
                  </div>
                ) : components.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                    <p className="text-2xl mb-1">🔩</p>
                    <p className="text-sm font-medium">No components yet</p>
                    <p className="text-sm mt-0.5">Add parts and components for this machine.</p>
                  </div>
                ) : (
                  <div>
                    {(() => {
                      const searchLower = debouncedSearchQuery?.toLowerCase() || '';
                      const filteredComps = searchLower
                        ? components.filter((c) => c.name.toLowerCase().includes(searchLower))
                        : components;
                      const nonMatchingComps = searchLower
                        ? components.filter((c) => !c.name.toLowerCase().includes(searchLower))
                        : [];

                      if (filteredComps.length === 0 && searchLower) {
                        return (
                          <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                            <p className="text-sm">No components match &ldquo;{debouncedSearchQuery}&rdquo;</p>
                          </div>
                        );
                      }

                      return (
                        <>
                          {searchLower && filteredComps.length > 0 && (
                            <div className="px-4 py-1.5 bg-[#3aa8e8]/10 border-b border-[#3aa8e8]/20">
                              <p className="text-xs font-medium text-[#3aa8e8]">
                                {filteredComps.length} matching component{filteredComps.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                          )}
                          {filteredComps.map((comp) => {
                            const compStatus = getStatusStyle(comp.status);
                            const isActive = detailComponent?.id === comp.id;
                            return (
                              <div
                                key={comp.id}
                                className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors border-b border-gray-900/10 dark:border-white/10 ${searchLower ? 'bg-yellow-50/60 dark:bg-yellow-900/10' : ''} ${isActive ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                                onClick={() => setDetailComponent(comp)}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{comp.name}</span>
                                  {comp.isCritical && (
                                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" title="Critical" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${compStatus.color} ${compStatus.bg}`}>
                                    {compStatus.label}
                                  </span>
                                  {canManage && (
                                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => handleEditComponent(comp)}
                                        className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded transition-colors"
                                        title="Edit"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteComponent(comp.id)}
                                        className="p-1 text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 rounded transition-colors"
                                        title="Delete"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {nonMatchingComps.length > 0 && (
                            <>
                              <div className="px-4 py-1.5 bg-gray-50 dark:bg-slate-700/30 border-b border-gray-200 dark:border-slate-600">
                                <p className="text-xs font-medium text-gray-400 dark:text-gray-500">Other components</p>
                              </div>
                              {nonMatchingComps.map((comp) => {
                                const compStatus = getStatusStyle(comp.status);
                                const isActive = detailComponent?.id === comp.id;
                                return (
                                  <div
                                    key={comp.id}
                                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors border-b border-gray-900/10 dark:border-white/10 opacity-50 ${isActive ? 'bg-primary-50 dark:bg-primary-900/20 opacity-100' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 hover:opacity-75'}`}
                                    onClick={() => setDetailComponent(comp)}
                                  >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{comp.name}</span>
                                      {comp.isCritical && (
                                        <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" title="Critical" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${compStatus.color} ${compStatus.bg}`}>
                                        {compStatus.label}
                                      </span>
                                      {canManage && (
                                        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            onClick={() => handleEditComponent(comp)}
                                            className="p-1 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 rounded transition-colors"
                                            title="Edit"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                          </button>
                                          <button
                                            onClick={() => handleDeleteComponent(comp.id)}
                                            className="p-1 text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 rounded transition-colors"
                                            title="Delete"
                                          >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Component Detail Modal ────────────────────────────────────── */}
        {detailComponent && selectedEquipment && (
          <ComponentDetailModal
            component={detailComponent}
            machine={selectedEquipment}
            onClose={() => setDetailComponent(null)}
            onPhotoClick={(photos, index) => {
              setLightboxPhotos(photos);
              setLightboxIndex(index);
            }}
          />
        )}

        {/* ─── Component Edit Modal ──────────────────────────────────────── */}
        <ComponentEditModal
          isOpen={showComponentForm && canManage}
          isEditing={!!editingComponent}
          compForm={compForm}
          setCompForm={setCompForm}
          onSubmit={handleComponentSubmit}
          onCancel={resetComponentForm}
          uploading={compUploadingPhotos}
          compPhotoPreviews={compPhotoPreviews}
          compPendingPhotos={compPendingPhotos}
          onAddPhotos={(files) => startCropQueue(files, 'component')}
          onRemovePreview={(idx) => {
            URL.revokeObjectURL(compPhotoPreviews[idx]);
            setCompPendingPhotos((prev) => prev.filter((_, i) => i !== idx));
            setCompPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
          }}
          existingPhotos={editingComponent?.photos || []}
          onDeleteExistingPhoto={async (url) => {
            if (!selectedEquipment || !editingComponent) return;
            try {
              await api.delete(`/equipment/${selectedEquipment.id}/components/${editingComponent.id}/photos`, { data: { url } });
              setEditingComponent({ ...editingComponent, photos: editingComponent.photos!.filter((p) => p.url !== url) });
              setSuccess('Photo removed');
              setTimeout(() => setSuccess(''), 2000);
            } catch { setError('Failed to remove photo'); }
          }}
          onPhotoClick={(photos, index) => {
            setLightboxPhotos(photos);
            setLightboxIndex(index);
          }}
          renamingPhotoUrl={renamingPhotoUrl}
          renameValue={renameValue}
          setRenamingPhotoUrl={setRenamingPhotoUrl}
          setRenameValue={setRenameValue}
          onRenamePhoto={(url, name) => handleRenamePhoto(url, name, 'component')}
        />

        {/* ─── Crop Modal ────────────────────────────────────────────────── */}
        {cropQueue.length > 0 && cropImageSrc && (
          <ImageCropModal
            imageSrc={cropImageSrc}
            fileName={`${cropQueue[cropQueueIndex]?.name} (${cropQueueIndex + 1}/${cropQueue.length})`}
            onCropComplete={handleCropComplete}
            onUseOriginal={handleCropUseOriginal}
            onCancel={handleCropSkip}
          />
        )}

        {/* ─── Photo Lightbox ────────────────────────────────────────────── */}
        {lightboxPhotos.length > 0 && (
          <PhotoLightbox
            photos={lightboxPhotos}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxPhotos([])}
            onNavigate={setLightboxIndex}
          />
        )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
