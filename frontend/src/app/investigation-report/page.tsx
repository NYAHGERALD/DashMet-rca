'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useLanguage } from '@/components/providers/LanguageProvider';
import {
  FileText,
  Download,
  Printer,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Eye,
  Calendar,
  User,
  Building2,
  ChevronRight,
  Loader2,
  ClipboardList,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';

interface Incident {
  id: string;
  incidentNumber: string;
  customTitle?: string;
  description: string;
  employeeName?: string;
  occurredAt: string;
  reportedAt: string;
  status: string;
  severity?: string;
  type: string;
  Facility?: {
    name: string;
  };
  Department?: {
    name: string;
  };
  Area?: {
    name: string;
  };
}

const INCIDENT_STATUSES = [
  { value: 'ALL', label: 'All Statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_INVESTIGATION', label: 'Under Investigation' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
];

function InvestigationReportContent() {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  const { t } = useLanguage();
  
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }
      
      // Build query params
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/investigation-report/incidents?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch incidents');
      }
      
      const data = await response.json();
      setIncidents(data.incidents || []);
    } catch (err) {
      console.error('Error fetching incidents:', err);
      setError('Failed to load incidents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, statusFilter, searchQuery]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleGenerateReport = async (action: 'download' | 'preview') => {
    if (!selectedIncident) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/investigation-report/${selectedIncident}/generate-pdf`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      if (action === 'download') {
        const incident = incidents.find(i => i.id === selectedIncident);
        const fileName = `investigation-report-${incident?.incidentNumber || selectedIncident}.pdf`;
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        setPreviewUrl(url);
      }
    } catch (err: any) {
      console.error('Error generating report:', err);
      setError(err.message || 'Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = () => {
    if (previewUrl) {
      const printWindow = window.open(previewUrl, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      SUBMITTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      UNDER_INVESTIGATION: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      PENDING_REVIEW: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      CLOSED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || statusColors.DRAFT}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeColors: Record<string, string> = {
      WORKPLACE_SAFETY: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      QUALITY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      FOOD_SAFETY: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      ENVIRONMENTAL: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
      EQUIPMENT: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      PROCESS: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColors[type] || 'bg-gray-100 text-gray-700'}`}>
        {type.replace(/_/g, ' ')}
      </span>
    );
  };

  const getSeverityBadge = (severity?: string) => {
    if (!severity) return null;
    
    const severityColors: Record<string, string> = {
      LOW: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      MEDIUM: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      HIGH: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${severityColors[severity] || ''}`}>
        {severity}
      </span>
    );
  };

  return (
    <div className="w-full px-6 py-8">
      {/* Back Button */}
      <button
        onClick={() => router.back()}
        className="mb-4 flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <ChevronRight className="w-5 h-5 rotate-180" />
        <span>Back</span>
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ClipboardList className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Team Leader Investigation Reports
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Generate and download standardized Team Leader Investigation Report forms pre-filled with workplace safety incident data.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 dark:text-red-400 font-medium">Error</p>
            <p className="text-red-600 dark:text-red-300 text-sm">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incident Selection Panel */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          {/* Search and Filters */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by incident number, title, or employee name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters 
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <Filter className="w-5 h-5" />
              </button>
              <button
                onClick={fetchIncidents}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            
            {/* Filter Dropdown - Status Only */}
            {showFilters && (
              <div className="flex items-center gap-4 pt-2">
                <div className="flex-1 max-w-xs">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Status
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    {INCIDENT_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Incidents List */}
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                <span className="ml-3 text-gray-500 dark:text-gray-400">Loading incidents...</span>
              </div>
            ) : incidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <ClipboardList className="w-12 h-12 mb-3 opacity-50" />
                <p className="font-medium">No incidents found</p>
                <p className="text-sm">Create incidents to generate investigation reports.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {incidents.map((incident) => (
                  <button
                    key={incident.id}
                    onClick={() => setSelectedIncident(incident.id)}
                    className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      selectedIncident === incident.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-sm font-medium text-primary-600 dark:text-primary-400">
                            {incident.incidentNumber}
                          </span>
                          {getTypeBadge(incident.type)}
                          {getStatusBadge(incident.status)}
                          {getSeverityBadge(incident.severity)}
                        </div>
                        <h3 className="font-medium text-gray-900 dark:text-white truncate">
                          {incident.customTitle || incident.description?.slice(0, 60) + '...'}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
                          {incident.employeeName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5" />
                              {incident.employeeName}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(incident.occurredAt), 'MMM d, yyyy')}
                          </span>
                          {incident.Facility?.name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5" />
                              {incident.Facility.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                        selectedIncident === incident.id ? 'transform rotate-90' : ''
                      }`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Panel */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 h-fit">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Generate Investigation Report
            </h2>
          </div>
          
          <div className="p-4">
            {selectedIncident ? (
              <>
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Incident Selected</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                    {incidents.find(i => i.id === selectedIncident)?.incidentNumber}
                  </p>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  The Team Leader Investigation Report will be auto-filled with employee information, incident details, investigation findings, and root cause analysis data.
                </p>
                
                <div className="space-y-3">
                  <button
                    onClick={() => handleGenerateReport('preview')}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                    Preview Report
                  </button>
                  
                  <button
                    onClick={() => handleGenerateReport('download')}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    Download PDF
                  </button>
                  
                  {previewUrl && (
                    <button
                      onClick={handlePrint}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <Printer className="w-5 h-5" />
                      Print Report
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Select an incident from the list to generate an investigation report.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Investigation Report Preview</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
                <button
                  onClick={() => handleGenerateReport('download')}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                src={previewUrl}
                className="w-full h-full min-h-[70vh]"
                title="Investigation Report Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InvestigationReportPage() {
  return (
    <ProtectedRoute>
      <InvestigationReportContent />
    </ProtectedRoute>
  );
}
