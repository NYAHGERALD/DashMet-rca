'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { UserRole } from '@/types/auth';
import api from '@/lib/api';
import DropdownOptionsManager from './DropdownOptionsManager';

interface Category {
  id: string;
  type: 'FOOD_SAFETY' | 'MACHINE_EQUIPMENT' | 'WORKPLACE_SAFETY' | 'OPERATIONS';
  name: string;
  parentId: string | null;
  allowCustomTitle: boolean;
  organizationId: string;
  sortOrder: number;
  isActive: boolean;
  parent?: {
    id: string;
    name: string;
  };
  children?: {
    id: string;
    name: string;
    allowCustomTitle: boolean;
  }[];
  _count?: {
    incidents: number;
  };
}

export default function CategoriesPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'FOOD_SAFETY' | 'MACHINE_EQUIPMENT' | 'WORKPLACE_SAFETY' | 'OPERATIONS'>('FOOD_SAFETY');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [creatingMainCategory, setCreatingMainCategory] = useState(false);
  
  // Workplace Safety sub-view: 'categories' or 'dropdowns'
  const [workplaceSafetyView, setWorkplaceSafetyView] = useState<'categories' | 'dropdowns'>('categories');
  
  // Form state for single category/subcategory
  const [formData, setFormData] = useState({
    name: '',
    type: 'FOOD_SAFETY' as 'FOOD_SAFETY' | 'MACHINE_EQUIPMENT' | 'WORKPLACE_SAFETY' | 'OPERATIONS',
    parentId: '',
    allowCustomTitle: false,
    sortOrder: 0,
  });

  // Form state for main category with subcategories
  const [mainCategoryForm, setMainCategoryForm] = useState({
    name: '',
    sortOrder: 0,
    subcategories: [] as Array<{ name: string; allowCustomTitle: boolean; sortOrder: number }>,
  });

  // State for populate data
  const [isPopulating, setIsPopulating] = useState(false);
  const [populateSuccess, setPopulateSuccess] = useState<string | null>(null);
  
  // State for Field Configuration modal
  const [showFieldConfigModal, setShowFieldConfigModal] = useState(false);

  const canManageCategories = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN';

  useEffect(() => {
    if (user?.organizationId) {
      loadData();
    }
  }, [user, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/categories?organizationId=${user?.organizationId}&type=${activeTab}`);
      setCategories(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const handleMainCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Create main category first
      const mainCategoryPayload = {
        name: mainCategoryForm.name,
        type: activeTab,
        organizationId: user?.organizationId,
        parentId: null,
        allowCustomTitle: false,
        sortOrder: mainCategoryForm.sortOrder,
      };

      const mainResponse = await api.post('/categories', mainCategoryPayload);
      const mainCategoryId = mainResponse.data.data.id;

      // Create subcategories if any
      if (mainCategoryForm.subcategories.length > 0) {
        await Promise.all(
          mainCategoryForm.subcategories.map((sub, index) =>
            api.post('/categories', {
              name: sub.name,
              type: activeTab,
              organizationId: user?.organizationId,
              parentId: mainCategoryId,
              allowCustomTitle: sub.allowCustomTitle,
              sortOrder: sub.sortOrder,
            })
          )
        );
      }

      await loadData();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create category');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const payload = {
        ...formData,
        type: activeTab,
        organizationId: user?.organizationId,
      };

      if (editingCategory) {
        await api.patch(`/categories/${editingCategory.id}`, payload);
      } else {
        await api.post('/categories', payload);
      }
      
      await loadData();
      resetForm();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save category');
    }
  };

  const addSubcategoryField = () => {
    setMainCategoryForm({
      ...mainCategoryForm,
      subcategories: [
        ...mainCategoryForm.subcategories,
        { name: '', allowCustomTitle: false, sortOrder: mainCategoryForm.subcategories.length },
      ],
    });
  };

  const removeSubcategoryField = (index: number) => {
    setMainCategoryForm({
      ...mainCategoryForm,
      subcategories: mainCategoryForm.subcategories.filter((_, i) => i !== index),
    });
  };

  const updateSubcategoryField = (index: number, field: 'name' | 'allowCustomTitle' | 'sortOrder', value: any) => {
    const updated = [...mainCategoryForm.subcategories];
    updated[index] = { ...updated[index], [field]: value };
    setMainCategoryForm({
      ...mainCategoryForm,
      subcategories: updated,
    });
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      parentId: category.parentId || '',
      allowCustomTitle: category.allowCustomTitle,
      sortOrder: category.sortOrder,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string, categoryName?: string, hasChildren?: boolean, childCount?: number) => {
    // Get category details if not provided
    const category = categories.find(c => c.id === id);
    const actualChildCount = childCount ?? subcategoriesByParent[id]?.length ?? 0;
    const isMainCategory = !category?.parentId && actualChildCount > 0;

    let confirmMessage = 'Delete this category? This action cannot be undone.';
    let shouldCascade = false;

    if (isMainCategory) {
      // Show detailed confirmation for main category with subcategories
      const subcatList = subcategoriesByParent[id]?.map(sub => `  • ${sub.name}`).join('\n') || '';
      confirmMessage = `Delete "${categoryName || category?.name}" and all ${actualChildCount} subcategories?\n\n` +
        `This will permanently remove:\n` +
        `  • ${categoryName || category?.name} (main category)\n` +
        `${subcatList}\n\n` +
        `This action cannot be undone.\n\n` +
        `Click OK to delete all, or Cancel to go back.`;
      shouldCascade = true;
    }

    if (!confirm(confirmMessage)) return;

    try {
      const url = shouldCascade ? `/categories/${id}?cascade=true` : `/categories/${id}`;
      await api.delete(url);
      await loadData();
      setError(''); // Clear any previous errors
    } catch (err: any) {
      const errorData = err.response?.data;
      
      // Check if cascade delete is possible
      if (errorData?.canCascade && errorData?.childCount > 0) {
        // Show option to cascade delete
        const shouldRetryWithCascade = confirm(
          `This category has ${errorData.childCount} subcategories.\n\n` +
          `Would you like to delete the category AND all its subcategories?\n\n` +
          `Click OK to delete all, or Cancel to keep them.`
        );
        
        if (shouldRetryWithCascade) {
          try {
            await api.delete(`/categories/${id}?cascade=true`);
            await loadData();
            setError('');
            return;
          } catch (cascadeErr: any) {
            setError(cascadeErr.response?.data?.error || 'Failed to delete category');
          }
        }
      } else {
        const errorMessage = errorData?.error || 'Failed to delete category';
        setError(errorMessage);
      }
      
      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: activeTab,
      parentId: '',
      allowCustomTitle: false,
      sortOrder: 0,
    });
    setMainCategoryForm({
      name: '',
      sortOrder: 0,
      subcategories: [],
    });
    setEditingCategory(null);
    setShowForm(false);
    setCreatingMainCategory(false);
  };

  // Handle populate data - seeds predefined Food Safety and Machine & Equipment categories
  const handlePopulateData = async () => {
    if (!user?.organizationId) {
      setError('Organization ID is required');
      return;
    }

    // Check if categories already exist BEFORE showing confirmation
    if (categories.length > 0) {
      alert(
        `⚠️ Categories Already Exist\n\n` +
        `This organization already has ${categories.length} categories populated.\n\n` +
        `Data population is only allowed for new organizations without existing categories.\n\n` +
        `You can manually add, edit, or delete categories using the buttons above.`
      );
      return;
    }

    const confirmMessage = 
      'This will populate the database with predefined categories:\n\n' +
      'FOOD SAFETY (8 categories):\n' +
      '• Foreign Material, Microbiological, Allergen, Labeling\n' +
      '• Temperature, Sanitation, Supplier, Packaging\n\n' +
      'MACHINE & EQUIPMENT (8 categories):\n' +
      '• Mechanical, Electrical, Controls, Pneumatics\n' +
      '• Sensors, Lubrication, Calibration, Changeover\n\n' +
      'WORKPLACE SAFETY (11 categories):\n' +
      '• Physical Injury Hazards, Ergonomic & Musculoskeletal Safety\n' +
      '• Machine & Equipment Safety, Chemical & Hazardous Materials Safety\n' +
      '• Environmental & Exposure Hazards, Fire & Emergency Safety\n' +
      '• Material Handling & Traffic Safety, Personal Protective Equipment (PPE)\n' +
      '• Facility & Infrastructure Safety, Behavioral, Training & Compliance Safety\n' +
      '• Health & Medical Management\n\n' +
      'Each category includes comprehensive subcategories.\n\n' +
      'Proceed?';

    if (!confirm(confirmMessage)) return;

    setIsPopulating(true);
    setError('');
    setPopulateSuccess(null);

    try {
      const response = await api.post('/categories/populate', {
        organizationId: user.organizationId,
      });
      
      const { foodSafetyAdded, machineEquipmentAdded, workplaceSafetyAdded, skippedCategories } = response.data.data;
      
      let successMessage = `Successfully populated ${foodSafetyAdded} Food Safety, ${machineEquipmentAdded} Machine & Equipment, and ${workplaceSafetyAdded || 0} Workplace Safety categories with all subcategories.`;
      
      if (skippedCategories && skippedCategories.length > 0) {
        successMessage += ` (Skipped ${skippedCategories.length} existing categories)`;
      }
      
      setPopulateSuccess(successMessage);
      await loadData();
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setPopulateSuccess(null);
      }, 5000);
    } catch (err: any) {
      // Handle 409 Conflict - categories already exist
      if (err.response?.status === 409) {
        const existingCount = err.response?.data?.existingCount || 0;
        alert(
          `⚠️ Categories Already Exist\n\n` +
          `This organization already has ${existingCount} categories populated.\n\n` +
          `Data population is only allowed for new organizations without existing categories.\n\n` +
          `You can manually add, edit, or delete categories using the buttons above.`
        );
        setError('');
      } else {
        setError(err.response?.data?.error || 'Failed to populate categories');
      }
    } finally {
      setIsPopulating(false);
    }
  };

  const handleAllowCustomTitleChange = async (checked: boolean) => {
    setFormData({ ...formData, allowCustomTitle: checked });
    
    // Auto-save if editing an existing category
    if (editingCategory) {
      try {
        await api.patch(`/categories/${editingCategory.id}`, {
          allowCustomTitle: checked,
        });
        await loadData();
        // Show success message with activation status
        const successMsg = document.createElement('div');
        successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in';
        successMsg.textContent = checked ? '✓ "Other" Category Activated' : '✓ "Other" Category Deactivated';
        document.body.appendChild(successMsg);
        setTimeout(() => {
          successMsg.classList.add('opacity-0', 'transition-opacity', 'duration-300');
          setTimeout(() => successMsg.remove(), 300);
        }, 2000);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to update category');
        // Show error message
        const errorMsg = document.createElement('div');
        errorMsg.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        errorMsg.textContent = '✗ Failed to save';
        document.body.appendChild(errorMsg);
        setTimeout(() => errorMsg.remove(), 3000);
      }
    }
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  // Group categories by parent
  const parentCategories = categories.filter(c => !c.parentId);
  const subcategoriesByParent = categories
    .filter(c => c.parentId)
    .reduce((acc, cat) => {
      if (!acc[cat.parentId!]) acc[cat.parentId!] = [];
      acc[cat.parentId!].push(cat);
      return acc;
    }, {} as Record<string, Category[]>);

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SYSTEM_ADMIN]}>
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="text-center text-gray-600 dark:text-gray-400">Loading...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.SYSTEM_ADMIN]}>
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">Category Management</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1 text-xs sm:text-sm">
              Manage categories and subcategories for incident classification
            </p>
          </div>
          {canManageCategories && (
            <div className="grid grid-cols-2 sm:flex gap-2">
              <button
                onClick={handlePopulateData}
                disabled={isPopulating}
                className="px-2.5 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm touch-manipulation"
              >
                {isPopulating ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 sm:h-4 sm:w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="hidden sm:inline">Populating...</span>
                  </>
                ) : (
                  <>📊 <span className="hidden xs:inline">Populate Data</span><span className="xs:hidden">Populate</span></>
                )}
              </button>
              <button
                onClick={() => setShowFieldConfigModal(true)}
                className="px-2.5 sm:px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm touch-manipulation"
              >
                ⚙️ <span className="hidden xs:inline">Field Configuration</span><span className="xs:hidden">Config</span>
              </button>
              <button
                onClick={() => {
                  setMainCategoryForm({ name: '', sortOrder: 0, subcategories: [] });
                  setEditingCategory(null);
                  setCreatingMainCategory(true);
                  setShowForm(true);
                }}
                className="px-2.5 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs sm:text-sm touch-manipulation"
              >
                + <span className="hidden sm:inline">New Main </span>Category
              </button>
              <button
                onClick={() => {
                  setFormData({ name: '', type: activeTab, parentId: '', allowCustomTitle: false, sortOrder: 0 });
                  setEditingCategory(null);
                  setCreatingMainCategory(false);
                  setShowForm(true);
                }}
                className="px-2.5 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs sm:text-sm touch-manipulation"
              >
                + <span className="hidden sm:inline">New </span>Subcategory
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
            <p className="text-danger-800 dark:text-danger-200">{error}</p>
          </div>
        )}

        {populateSuccess && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <p className="text-green-800 dark:text-green-200">{populateSuccess}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 sm:mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
            <button
              onClick={() => setActiveTab('FOOD_SAFETY')}
              className={`${
                activeTab === 'FOOD_SAFETY'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation`}
            >
              🍽️ <span className="hidden sm:inline">Food Safety</span><span className="sm:hidden">Food</span>
            </button>
            <button
              onClick={() => setActiveTab('MACHINE_EQUIPMENT')}
              className={`${
                activeTab === 'MACHINE_EQUIPMENT'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation`}
            >
              ⚙️ <span className="hidden sm:inline">Machine & Equipment</span><span className="sm:hidden">Machine</span>
            </button>
            <button
              onClick={() => setActiveTab('WORKPLACE_SAFETY')}
              className={`${
                activeTab === 'WORKPLACE_SAFETY'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation`}
            >
              🦺 <span className="hidden sm:inline">Workplace Safety</span><span className="sm:hidden">Workplace</span>
            </button>
            <button
              onClick={() => setActiveTab('OPERATIONS')}
              className={`${
                activeTab === 'OPERATIONS'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
              } whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm touch-manipulation`}
            >
              📊 <span className="hidden sm:inline">Operations</span><span className="sm:hidden">Ops</span>
            </button>
          </nav>
        </div>

        {/* Workplace Safety Sub-navigation */}
        {activeTab === 'WORKPLACE_SAFETY' && (
          <div className="mb-6 flex gap-2">
            <button
              onClick={() => setWorkplaceSafetyView('categories')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                workplaceSafetyView === 'categories'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              📁 Categories & Subcategories
            </button>
            <button
              onClick={() => setWorkplaceSafetyView('dropdowns')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                workplaceSafetyView === 'dropdowns'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              📋 Dropdown Options
            </button>
          </div>
        )}

        {/* Dropdown Options Manager for Workplace Safety */}
        {activeTab === 'WORKPLACE_SAFETY' && workplaceSafetyView === 'dropdowns' && user?.organizationId && (
          <DropdownOptionsManager organizationId={user.organizationId} />
        )}

        {/* Categories View - shown when not in dropdown mode for Workplace Safety */}
        {(activeTab !== 'WORKPLACE_SAFETY' || workplaceSafetyView === 'categories') && <>
        
        {showForm && canManageCategories && creatingMainCategory && (
          <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Create New Main Category
            </h2>

            <form onSubmit={handleMainCategorySubmit} className="space-y-6">
              {/* Main Category Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Main Category Name *
                </label>
                <input
                  type="text"
                  value={mainCategoryForm.name}
                  onChange={(e) => setMainCategoryForm({ ...mainCategoryForm, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Foreign Material, Chemical, Equipment Failure"
                />
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={mainCategoryForm.sortOrder}
                  onChange={(e) => setMainCategoryForm({ ...mainCategoryForm, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Lower numbers appear first in lists
                </p>
              </div>

              {/* Subcategories Section */}
              <div className="border-t border-gray-200 dark:border-slate-700 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Subcategories (Optional)
                  </label>
                  <button
                    type="button"
                    onClick={addSubcategoryField}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    + Add Subcategory
                  </button>
                </div>

                {mainCategoryForm.subcategories.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-4">
                    No subcategories added yet. Click "+ Add Subcategory" to add one.
                  </p>
                )}

                <div className="space-y-4">
                  {mainCategoryForm.subcategories.map((sub, index) => (
                    <div key={index} className="flex gap-3 items-center p-4 bg-gray-50 dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={sub.name}
                          onChange={(e) => updateSubcategoryField(index, 'name', e.target.value)}
                          placeholder="Subcategory name (e.g., Metal, Plastic, Glass)"
                          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600 dark:text-gray-400">Order:</label>
                        <input
                          type="number"
                          value={sub.sortOrder}
                          onChange={(e) => updateSubcategoryField(index, 'sortOrder', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSubcategoryField(index)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        title="Remove subcategory"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                <button
                  type="submit"
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Create Main Category {mainCategoryForm.subcategories.length > 0 && `& ${mainCategoryForm.subcategories.length} Subcategories`}
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

        {showForm && canManageCategories && !creatingMainCategory && (
          <div className="mb-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingCategory 
                  ? (editingCategory.parentId ? 'Edit Subcategory' : 'Edit Main Category')
                  : 'Create New Subcategory'
                }
              </h2>
              {editingCategory && !editingCategory.parentId && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  💡 Tip: Use "+ Add Subcategory" button to add more subcategories
                </span>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Main Category Selection - Always show for subcategories */}
              {!editingCategory || editingCategory.parentId ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Main Category *
                  </label>
                  <select
                    value={formData.parentId}
                    onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select main category</option>
                    {parentCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Choose which main category this subcategory belongs to
                  </p>
                </div>
              ) : null}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subcategory Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g., Metal, Plastic, Glass, Mechanical, Electrical"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="0"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Lower numbers appear first in lists
                </p>
              </div>

              {/* "Other" checkbox for subcategories */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="allowCustomTitle"
                  checked={formData.allowCustomTitle}
                  onChange={(e) => handleAllowCustomTitleChange(e.target.checked)}
                  className="w-4 h-4 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="allowCustomTitle" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Is "Other" Category (requires custom detail from user)
                </label>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
                {editingCategory 
                  ? '✓ Auto-saves when changed' 
                  : 'Check this box if this subcategory is "Other" and needs the user to provide specific details'
                }
              </p>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingCategory ? 'Update' : 'Create'}
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

        {/* Categories List */}
        <div className="space-y-6">
          {parentCategories.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center border border-gray-200 dark:border-slate-700">
              <p className="text-gray-500 dark:text-gray-400">
                No categories found for {activeTab === 'FOOD_SAFETY' ? 'Food Safety' : activeTab === 'MACHINE_EQUIPMENT' ? 'Machine & Equipment' : activeTab === 'WORKPLACE_SAFETY' ? 'Workplace Safety' : 'Operations'}. Create your first category to get started.
              </p>
            </div>
          ) : (
            parentCategories.map((parent) => {
              const isExpanded = expandedCategories.has(parent.id);
              const subcategoryCount = subcategoriesByParent[parent.id]?.length || 0;
              
              return (
                <div
                  key={parent.id}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden"
                >
                  {/* Parent Category Header - Clickable to expand/collapse */}
                  <div 
                    className="bg-gray-50 dark:bg-slate-900 px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-slate-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800/50 transition-colors touch-manipulation"
                    onClick={() => toggleCategory(parent.id)}
                  >
                    <div className="flex items-start sm:items-center justify-between gap-2">
                      <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        {/* Expand/Collapse Icon */}
                        <svg
                          className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-500 dark:text-gray-400 transition-transform shrink-0 mt-0.5 sm:mt-0 ${
                            isExpanded ? 'transform rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">
                              {parent.name}
                            </h3>
                            {parent.allowCustomTitle && (
                              <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full border border-amber-300 dark:border-amber-700">
                                <span className="hidden sm:inline">Requires Custom Detail</span><span className="sm:hidden">Custom</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">
                            {subcategoryCount} subcategor{subcategoryCount === 1 ? 'y' : 'ies'}
                          </p>
                        </div>
                      </div>
                      {canManageCategories && (
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setFormData({ 
                                name: '',
                                type: activeTab,
                                parentId: parent.id,
                                allowCustomTitle: false,
                                sortOrder: 0
                              });
                              setEditingCategory(null);
                              setShowForm(true);
                            }}
                            className="px-2 sm:px-3 py-1 text-xs sm:text-sm bg-primary-600 text-white rounded hover:bg-primary-700 touch-manipulation whitespace-nowrap"
                            title="Add a new subcategory"
                          >
                            + <span className="hidden sm:inline">Add </span>Subcategory
                          </button>
                          <div className="flex gap-1 sm:gap-2">
                            <button
                              onClick={() => handleEdit(parent)}
                              className="px-2 sm:px-3 py-1 text-xs sm:text-sm text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 touch-manipulation"
                              title="Edit category name"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(parent.id, parent.name, true, subcategoryCount)}
                              className="px-2 sm:px-3 py-1 text-xs sm:text-sm text-danger-600 hover:text-danger-900 dark:text-danger-400 dark:hover:text-danger-300 touch-manipulation"
                              title="Delete category and all subcategories"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                </div>

                {/* Subcategories - Only show when expanded */}
                {isExpanded && subcategoriesByParent[parent.id] && subcategoriesByParent[parent.id].length > 0 && (
                  <div className="divide-y divide-gray-200 dark:divide-slate-700">
                    {subcategoriesByParent[parent.id].map((sub) => (
                      <div key={sub.id} className="px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 gap-2">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <span className="text-gray-400 dark:text-gray-500 text-sm sm:text-base shrink-0">└─</span>
                          <span className="text-gray-900 dark:text-white font-medium text-xs sm:text-base truncate">
                            {sub.name}
                          </span>
                          {sub.allowCustomTitle && (
                            <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full border border-amber-300 dark:border-amber-700 shrink-0">
                              <span className="hidden sm:inline">Requires Custom Detail</span><span className="sm:hidden">Custom</span>
                            </span>
                          )}
                        </div>
                        {canManageCategories && (
                          <div className="flex gap-1 sm:gap-2 shrink-0">
                            <button
                              onClick={() => handleEdit(sub)}
                              className="text-xs sm:text-sm text-primary-600 hover:text-primary-900 dark:text-primary-400 dark:hover:text-primary-300 touch-manipulation px-1 sm:px-2"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(sub.id)}
                              className="text-xs sm:text-sm text-danger-600 hover:text-danger-900 dark:text-danger-400 dark:hover:text-danger-300 touch-manipulation px-1 sm:px-2"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
            })
          )}
        </div>
        </>}
        
        {/* Field Configuration Modal */}
        {showFieldConfigModal && user?.organizationId && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl shadow-2xl w-full sm:max-w-6xl sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700">
                <div>
                  <h2 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white">⚙️ Field Configuration</h2>
                  <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5 sm:mt-1">Configure form fields for incident types</p>
                </div>
                <button
                  onClick={() => setShowFieldConfigModal(false)}
                  className="p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 touch-manipulation"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                <DropdownOptionsManager organizationId={user.organizationId} initialTab="fields" hideTabNavigation={true} />
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
