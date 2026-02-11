'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Edit2,
  Check,
  X,
  AlertCircle,
  CheckCircle,
  FileSpreadsheet,
  File,
  Clock,
  User,
  ArrowLeft,
  Loader2,
  Info,
  Shield,
  RefreshCw,
  ClipboardList,
  FileUp,
  History,
  ExternalLink,
  ChevronDown,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkOrderTemplate {
  id: string;
  name: string;
  fileName: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  description: string | null;
  version: number;
  isActive: boolean;
  uploadedAt: string;
  updatedAt: string;
  UploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface WorkOrder {
  id: string;
  woNumber: string;
  type: 'IN_APP' | 'UPLOADED';
  assessmentId: string;
  assessmentNumber: string;
  sectionId: string | null;
  itemId: string | null;
  itemDescription: string | null;
  requestDate: string | null;
  expenseClass: string | null;
  originator: string | null;
  woType: string | null;
  priority: number | null;
  description: string | null;
  equipmentNo: string | null;
  equipmentDescription: string | null;
  fullDescriptionOfIssue: string | null;
  department: string | null;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  uploadedAt: string | null;
  assignedTo: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  completionDate: string | null;
  createdAt: string;
  updatedAt: string;
  CreatedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  AssignedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  Assessment: {
    id: string;
    assessmentNumber: string;
    date: string;
    department: string | null;
    status: string;
  };
  StatusHistory: StatusHistoryItem[];
}

interface StatusHistoryItem {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: string;
  notes: string | null;
  ChangedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

// Helper to get file icon based on mime type
const getFileIcon = (mimeType: string | null) => {
  if (!mimeType) return <File className="w-8 h-8 text-gray-400" />;
  
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileText className="w-8 h-8 text-blue-500" />;
  }
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return <FileSpreadsheet className="w-8 h-8 text-green-500" />;
  }
  if (mimeType.includes('pdf')) {
    return <FileText className="w-8 h-8 text-red-500" />;
  }
  return <File className="w-8 h-8 text-gray-400" />;
};

// Helper to format file size
const formatFileSize = (bytes: number | null) => {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function WorkOrderTemplatesContent() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState<'templates' | 'in-app' | 'uploaded'>('templates');
  
  // State
  const [templates, setTemplates] = useState<WorkOrderTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<WorkOrderTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Work Orders State
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNotes, setStatusNotes] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  
  // Form state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Edit state
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  
  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Work Order Settings
  const [settings, setSettings] = useState({
    enableInAppForm: true,
    enableTemplateDownload: false,
    preferredOption: 'form',
    formTitle: 'Maintenance Work Order Request',
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Fetch templates on mount
  useEffect(() => {
    fetchTemplates();
    fetchSettings();
    fetchWorkOrders();
  }, []);

  // Fetch work orders when tab changes
  useEffect(() => {
    if (activeTab !== 'templates') {
      fetchWorkOrders();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/work-order-templates/settings');
      if (response.data?.data?.settings) {
        setSettings(response.data.data.settings);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const fetchWorkOrders = async () => {
    try {
      setLoadingWorkOrders(true);
      const response = await api.get('/work-orders');
      setWorkOrders(response.data.data || []);
    } catch (err) {
      console.error('Error fetching work orders:', err);
    } finally {
      setLoadingWorkOrders(false);
    }
  };

  const updateWorkOrderStatus = async () => {
    if (!selectedWorkOrder || !newStatus) return;

    try {
      setSavingStatus(true);
      await api.put(`/work-orders/${selectedWorkOrder.id}/status`, {
        status: newStatus,
        notes: statusNotes || null,
      });

      setSuccess('Work order status updated successfully');
      setShowStatusModal(false);
      setSelectedWorkOrder(null);
      setNewStatus('');
      setStatusNotes('');
      fetchWorkOrders();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update status');
    } finally {
      setSavingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getPriorityLabel = (priority: number | null) => {
    switch (priority) {
      case 1:
        return { label: 'Emergency', color: 'text-red-600 dark:text-red-400' };
      case 2:
        return { label: 'Rush', color: 'text-amber-600 dark:text-amber-400' };
      case 3:
        return { label: 'Plan & Schedule', color: 'text-blue-600 dark:text-blue-400' };
      default:
        return { label: '-', color: 'text-gray-500' };
    }
  };

  const inAppWorkOrders = workOrders.filter(wo => wo.type === 'IN_APP');
  const uploadedWorkOrders = workOrders.filter(wo => wo.type === 'UPLOADED');

  const saveSettings = async (newSettings: typeof settings) => {
    try {
      setSavingSettings(true);
      await api.put('/work-order-templates/settings', newSettings);
      setSettings(newSettings);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const [allResponse, activeResponse] = await Promise.all([
        api.get('/work-order-templates/all'),
        api.get('/work-order-templates'),
      ]);
      
      setTemplates(allResponse.data.data.templates || []);
      setActiveTemplate(activeResponse.data.data.template || null);
    } catch (err: any) {
      console.error('Error fetching templates:', err);
      setError(err.response?.data?.error || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
    ];
    
    const allowedExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.pdf'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
      setError('Invalid file type. Please upload a Word document (.doc, .docx), Excel file (.xls, .xlsx), or PDF.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit.');
      return;
    }

    setSelectedFile(file);
    if (!templateName) {
      // Auto-fill name from filename (without extension)
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setTemplateName(nameWithoutExt);
    }
    setError(null);
  };

  const handleUpload = async () => {
    if (!selectedFile || !templateName.trim()) {
      setError('Please provide a template name and select a file.');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      // Upload to Firebase Storage
      const timestamp = Date.now();
      const sanitizedFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storageRef = ref(
        storage,
        `work-order-templates/${user?.organizationId}/${timestamp}_${sanitizedFileName}`
      );

      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          setError('Failed to upload file to storage.');
          setUploading(false);
        },
        async () => {
          // Get download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

          // Save template metadata to database
          const response = await api.post('/work-order-templates', {
            name: templateName.trim(),
            fileName: selectedFile.name,
            fileUrl: downloadURL,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type,
            description: templateDescription.trim() || null,
          });

          setSuccess('Work order template uploaded successfully!');
          setShowUploadForm(false);
          setTemplateName('');
          setTemplateDescription('');
          setSelectedFile(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          
          // Refresh templates list
          fetchTemplates();
          
          setUploading(false);
          setTimeout(() => setSuccess(null), 3000);
        }
      );
    } catch (err: any) {
      console.error('Error uploading template:', err);
      setError(err.response?.data?.error || 'Failed to upload template');
      setUploading(false);
    }
  };

  const handleEdit = (template: WorkOrderTemplate) => {
    setEditingTemplate(template.id);
    setEditName(template.name);
    setEditDescription(template.description || '');
  };

  const handleSaveEdit = async (templateId: string) => {
    try {
      await api.put(`/work-order-templates/${templateId}`, {
        name: editName.trim(),
        description: editDescription.trim() || null,
      });

      setSuccess('Template updated successfully!');
      setEditingTemplate(null);
      fetchTemplates();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error updating template:', err);
      setError(err.response?.data?.error || 'Failed to update template');
    }
  };

  const handleSetActive = async (templateId: string) => {
    try {
      await api.put(`/work-order-templates/${templateId}`, {
        isActive: true,
      });

      setSuccess('Template set as active!');
      fetchTemplates();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error setting active template:', err);
      setError(err.response?.data?.error || 'Failed to set active template');
    }
  };

  const handleDelete = async (templateId: string) => {
    try {
      setDeleting(true);
      await api.delete(`/work-order-templates/${templateId}`);

      setSuccess('Template deleted successfully!');
      setDeleteConfirm(null);
      fetchTemplates();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Error deleting template:', err);
      setError(err.response?.data?.error || 'Failed to delete template');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Toast Notifications */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-4 bg-red-500/90 text-white rounded-xl shadow-lg flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-80">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-4 bg-green-500/90 text-white rounded-xl shadow-lg flex items-center gap-3"
          >
            <CheckCircle className="w-5 h-5" />
            <span>{success}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-white/20 dark:border-gray-700/50 shadow-lg">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <button className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              </Link>
              
              <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Work Order Templates
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Manage templates for safety assessment work orders
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchTemplates}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setShowUploadForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-xl hover:shadow-lg transition-all"
              >
                <Upload className="w-4 h-4" />
                Upload Template
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-6">
          <div className="flex flex-wrap gap-2 p-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'templates'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              Templates & Settings
            </button>
            <button
              onClick={() => setActiveTab('in-app')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'in-app'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              In-App Work Orders
              {inAppWorkOrders.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'in-app' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {inAppWorkOrders.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('uploaded')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === 'uploaded'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <FileUp className="w-4 h-4" />
              Uploaded Work Orders
              {uploadedWorkOrders.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === 'uploaded' 
                    ? 'bg-white/20 text-white' 
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                }`}>
                  {uploadedWorkOrders.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Templates Tab Content */}
        {activeTab === 'templates' && (
          <>
        {/* Info Banner */}
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium mb-1">How Work Order Templates Work</p>
              <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                <li>Upload a Word (.doc, .docx), Excel (.xls, .xlsx), or PDF template for work orders</li>
                <li>Only one template can be active at a time</li>
                <li>When users click "Create work order" in safety assessments, they&apos;ll be prompted to download your template</li>
                <li>Users can then fill out the template and upload it as an attachment</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Work Order Settings */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            Work Order Settings
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Configure what users see when they click &quot;Create work order&quot; in safety assessments
          </p>

          <div className="space-y-6">
            {/* Preferred Option Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                When users click &quot;Create work order&quot;, show:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* In-App Form Option */}
                <button
                  type="button"
                  onClick={() => {
                    const newSettings = { ...settings, preferredOption: 'form', enableInAppForm: true, enableTemplateDownload: false };
                    saveSettings(newSettings);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    settings.preferredOption === 'form'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      settings.preferredOption === 'form' ? 'border-emerald-500' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {settings.preferredOption === 'form' && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      )}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">In-App Form</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                    Users fill out a work order form directly in the app
                  </p>
                </button>

                {/* Download Template Option */}
                <button
                  type="button"
                  onClick={() => {
                    if (!activeTemplate) {
                      setError('Please upload a template first before enabling template download');
                      return;
                    }
                    const newSettings = { ...settings, preferredOption: 'template', enableInAppForm: false, enableTemplateDownload: true };
                    saveSettings(newSettings);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    settings.preferredOption === 'template'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } ${!activeTemplate ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      settings.preferredOption === 'template' ? 'border-blue-500' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {settings.preferredOption === 'template' && (
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">Download Template</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                    Users download your uploaded template file
                  </p>
                </button>

                {/* Both Disabled Option */}
                <button
                  type="button"
                  onClick={() => {
                    const newSettings = { ...settings, preferredOption: 'disabled', enableInAppForm: false, enableTemplateDownload: false };
                    saveSettings(newSettings);
                  }}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    settings.preferredOption === 'disabled'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      settings.preferredOption === 'disabled' ? 'border-amber-500' : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {settings.preferredOption === 'disabled' && (
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                      )}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">Disabled</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 ml-6">
                    Show a message that work orders are not available
                  </p>
                </button>
              </div>
            </div>

            {/* Form Title (only shown when in-app form is selected) */}
            {settings.preferredOption === 'form' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Form Title
                </label>
                <input
                  type="text"
                  value={settings.formTitle}
                  onChange={(e) => setSettings({ ...settings, formTitle: e.target.value })}
                  onBlur={() => saveSettings(settings)}
                  className="w-full max-w-md px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                  placeholder="e.g., Maintenance Work Order Request"
                />
              </div>
            )}

            {savingSettings && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving settings...
              </div>
            )}
          </div>
        </div>

        {/* Current Active Template Card */}
        {activeTemplate && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-green-500" />
              Active Template
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-green-200 dark:border-green-700 p-6">
              <div className="flex items-start gap-4">
                {getFileIcon(activeTemplate.mimeType)}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {activeTemplate.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {activeTemplate.fileName}
                  </p>
                  {activeTemplate.description && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      {activeTemplate.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Uploaded {format(new Date(activeTemplate.uploadedAt), 'MMM d, yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {activeTemplate.UploadedBy.firstName} {activeTemplate.UploadedBy.lastName}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {formatFileSize(activeTemplate.fileSize)}
                    </span>
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                      v{activeTemplate.version}
                    </span>
                  </div>
                </div>
                <a
                  href={activeTemplate.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </a>
              </div>
            </div>
          </div>
        )}

        {/* All Templates List */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            All Templates ({templates.length})
          </h2>

          {templates.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Templates Yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Upload a work order template for your organization
              </p>
              <button
                onClick={() => setShowUploadForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-xl hover:shadow-lg transition-all"
              >
                <Upload className="w-4 h-4" />
                Upload First Template
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg border p-4 transition-all ${
                    template.isActive
                      ? 'border-green-200 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {editingTemplate === template.id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Template Name
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description (Optional)
                        </label>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingTemplate(null)}
                          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(template.id)}
                          className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-1"
                        >
                          <Check className="w-4 h-4" />
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex items-center gap-4">
                      {getFileIcon(template.mimeType)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900 dark:text-white truncate">
                            {template.name}
                          </h3>
                          {template.isActive && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                              Active
                            </span>
                          )}
                          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
                            v{template.version}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {template.fileName} • {formatFileSize(template.fileSize)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Uploaded by {template.UploadedBy.firstName} {template.UploadedBy.lastName} on{' '}
                          {format(new Date(template.uploadedAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!template.isActive && (
                          <button
                            onClick={() => handleSetActive(template.id)}
                            className="px-3 py-1.5 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Set as active"
                          >
                            Set Active
                          </button>
                        )}
                        <a
                          href={template.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleEdit(template)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(template.id)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        </>
        )}

        {/* In-App Work Orders Tab Content */}
        {activeTab === 'in-app' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-emerald-500" />
                In-App Work Orders ({inAppWorkOrders.length})
              </h2>
              <button
                onClick={fetchWorkOrders}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loadingWorkOrders ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingWorkOrders ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
              </div>
            ) : inAppWorkOrders.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center border border-gray-200 dark:border-gray-700">
                <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No In-App Work Orders Yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Work orders created using the in-app form will appear here
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">WO #</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Assessment</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Request Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expense Class</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Originator</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">WO Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Equipment</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {inAppWorkOrders.map((wo) => (
                        <tr key={wo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-emerald-600 dark:text-emerald-400">{wo.woNumber}</td>
                          <td className="px-4 py-3">
                            <Link 
                              href={`/workplace-safety?edit=${wo.assessmentId}`}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              {wo.assessmentNumber}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            {wo.requestDate ? format(new Date(wo.requestDate), 'MMM d, yyyy') : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{wo.expenseClass || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{wo.originator || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{wo.woType || '-'}</td>
                          <td className={`px-4 py-3 text-sm font-medium ${getPriorityLabel(wo.priority).color}`}>
                            {getPriorityLabel(wo.priority).label}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={wo.description || ''}>
                            {wo.description || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{wo.equipmentNo || '-'}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setSelectedWorkOrder(wo);
                                setNewStatus(wo.status);
                                setShowStatusModal(true);
                              }}
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)} hover:opacity-80 transition-opacity flex items-center gap-1`}
                            >
                              {wo.status.replace('_', ' ')}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setSelectedWorkOrder(wo);
                                setShowHistoryModal(true);
                              }}
                              className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="View History"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Uploaded Work Orders Tab Content */}
        {activeTab === 'uploaded' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <FileUp className="w-5 h-5 text-blue-500" />
                Uploaded Work Orders ({uploadedWorkOrders.length})
              </h2>
              <button
                onClick={fetchWorkOrders}
                className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loadingWorkOrders ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingWorkOrders ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : uploadedWorkOrders.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-12 text-center border border-gray-200 dark:border-gray-700">
                <FileUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Uploaded Work Orders Yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Work orders uploaded as attachments will appear here
                </p>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">WO #</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Assessment</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">File Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Uploaded Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Uploaded By</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item Description</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {uploadedWorkOrders.map((wo) => (
                        <tr key={wo.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">{wo.woNumber}</td>
                          <td className="px-4 py-3">
                            <Link 
                              href={`/workplace-safety?edit=${wo.assessmentId}`}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              {wo.assessmentNumber}
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            {wo.fileUrl ? (
                              <a
                                href={wo.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                              >
                                {wo.fileName || 'Download'}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-sm text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            {wo.uploadedAt ? format(new Date(wo.uploadedAt), 'MMM d, yyyy h:mm a') : 
                             wo.createdAt ? format(new Date(wo.createdAt), 'MMM d, yyyy h:mm a') : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                            {wo.CreatedBy ? `${wo.CreatedBy.firstName} ${wo.CreatedBy.lastName}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate" title={wo.itemDescription || ''}>
                            {wo.itemDescription || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setSelectedWorkOrder(wo);
                                setNewStatus(wo.status);
                                setShowStatusModal(true);
                              }}
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wo.status)} hover:opacity-80 transition-opacity flex items-center gap-1`}
                            >
                              {wo.status.replace('_', ' ')}
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </td>
                          <td className="px-4 py-3 flex items-center gap-1">
                            {wo.fileUrl && (
                              <a
                                href={wo.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-blue-500 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Open File"
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                            )}
                            <button
                              onClick={() => {
                                setSelectedWorkOrder(wo);
                                setShowHistoryModal(true);
                              }}
                              className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                              title="View History"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !uploading && setShowUploadForm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-600 text-white">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Work Order Template
                </h3>
                <p className="text-sm text-amber-100 opacity-90 mt-1">
                  Upload a Word, Excel, or PDF template for work orders
                </p>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Template Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Maintenance Work Order Form"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500"
                    disabled={uploading}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Instructions / Description (Optional)
                  </label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Add instructions for users on how to fill out this form..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-amber-500 resize-none"
                    disabled={uploading}
                  />
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Template File <span className="text-red-500">*</span>
                  </label>
                  {selectedFile ? (
                    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      {getFileIcon(selectedFile.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                      {!uploading && (
                        <button
                          onClick={() => {
                            setSelectedFile(null);
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-amber-400 dark:hover:border-amber-500 transition-colors">
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Click to select file or drag and drop
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Word (.doc, .docx), Excel (.xls, .xlsx), or PDF (max 10MB)
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".doc,.docx,.xls,.xlsx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={uploading}
                      />
                    </label>
                  )}
                </div>

                {/* Upload Progress */}
                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Uploading...</span>
                      <span className="text-amber-600 dark:text-amber-400">{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-600 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowUploadForm(false);
                    setTemplateName('');
                    setTemplateDescription('');
                    setSelectedFile(null);
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  disabled={uploading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !selectedFile || !templateName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Template
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !deleting && setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Delete Template?
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Change Modal */}
      <AnimatePresence>
        {showStatusModal && selectedWorkOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !savingStatus && setShowStatusModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <h3 className="text-lg font-semibold">Update Work Order Status</h3>
                <p className="text-sm text-blue-100 opacity-90 mt-1">
                  {selectedWorkOrder.woNumber}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Status
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map((status) => (
                      <button
                        key={status}
                        onClick={() => setNewStatus(status)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          newStatus === status
                            ? getStatusColor(status) + ' ring-2 ring-offset-2 ring-blue-500'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {status.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    placeholder="Add a note about this status change..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowStatusModal(false);
                    setSelectedWorkOrder(null);
                    setNewStatus('');
                    setStatusNotes('');
                  }}
                  disabled={savingStatus}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={updateWorkOrderStatus}
                  disabled={savingStatus || !newStatus || newStatus === selectedWorkOrder.status}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingStatus ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Update Status
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status History Modal */}
      <AnimatePresence>
        {showHistoryModal && selectedWorkOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
            >
              <div className="px-6 py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white flex-shrink-0">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Status History
                </h3>
                <p className="text-sm text-gray-200 mt-1">
                  {selectedWorkOrder.woNumber}
                </p>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {selectedWorkOrder.StatusHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No status history available</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedWorkOrder.StatusHistory.map((history, index) => (
                      <div
                        key={history.id}
                        className={`relative pl-6 pb-4 ${
                          index !== selectedWorkOrder.StatusHistory.length - 1 
                            ? 'border-l-2 border-gray-200 dark:border-gray-700' 
                            : ''
                        }`}
                      >
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800" />
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            {history.fromStatus && (
                              <>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(history.fromStatus)}`}>
                                  {history.fromStatus.replace('_', ' ')}
                                </span>
                                <span className="text-gray-400">→</span>
                              </>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(history.toStatus)}`}>
                              {history.toStatus.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            By {history.ChangedBy.firstName} {history.ChangedBy.lastName} on{' '}
                            {format(new Date(history.changedAt), 'MMM d, yyyy h:mm a')}
                          </p>
                          {history.notes && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 italic">
                              &quot;{history.notes}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedWorkOrder(null);
                  }}
                  className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WorkOrderTemplatesPage() {
  return (
    <ProtectedRoute requireAuth={true} allowedRoles={['ADMIN', 'SYSTEM_ADMIN']}>
      <WorkOrderTemplatesContent />
    </ProtectedRoute>
  );
}
