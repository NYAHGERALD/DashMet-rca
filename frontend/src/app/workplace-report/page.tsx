'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
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
  FileSpreadsheet,
  X,
  ToggleLeft,
  ToggleRight,
  Users,
  Share2,
  Globe,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';

interface Incident {
  id: string;
  incidentNumber: string;
  customTitle?: string;
  description: string;
  employeeName?: string;
  dateOfInjury?: string;
  occurredAt: string;
  status: string;
  severity?: string;
  Facility?: {
    name: string;
  };
  Category?: {
    name: string;
  };
  createdAt: string;
  createdById?: string;
  isPublic?: boolean;
  sharedWithUserIds?: string[];
}

interface OrganizationUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function WorkplaceReportPage() {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  const { t } = useLanguage();
  
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Visibility and sharing states
  const [showShareModal, setShowShareModal] = useState(false);
  const [organizationUsers, setOrganizationUsers] = useState<OrganizationUser[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const [deletingIncident, setDeletingIncident] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents?type=WORKPLACE_SAFETY`,
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
      // API returns { success, data: { incidents, pagination } }
      const incidentsList = data.data?.incidents || data.incidents || [];
      setIncidents(Array.isArray(incidentsList) ? incidentsList : []);
    } catch (err) {
      console.error('Error fetching incidents:', err);
      setError('Failed to load workplace safety incidents. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const filteredIncidents = incidents.filter((incident) => {
    const query = searchQuery.toLowerCase();
    return (
      incident.incidentNumber?.toLowerCase().includes(query) ||
      incident.customTitle?.toLowerCase().includes(query) ||
      incident.employeeName?.toLowerCase().includes(query) ||
      incident.description?.toLowerCase().includes(query)
    );
  });

  // Check if current user is the owner of an incident
  const isOwner = (incident: Incident) => {
    return incident.createdById === user?.id;
  };

  // Get the selected incident object
  const getSelectedIncidentData = () => {
    return incidents.find(inc => inc.id === selectedIncident);
  };

  // Fetch organization users for sharing
  const fetchOrganizationUsers = async () => {
    setLoadingUsers(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/organization`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        const usersList = data.data?.users || data.users || [];
        // Filter out current user
        setOrganizationUsers(usersList.filter((u: OrganizationUser) => u.id !== user?.id));
      }
    } catch (err) {
      console.error('Error fetching organization users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Delete incident handler
  const handleDeleteIncident = async (incidentId: string) => {
    if (!confirm('Are you sure you want to delete this incident? This action cannot be undone.')) {
      return;
    }
    
    setDeletingIncident(incidentId);
    try {
      const token = await getIdToken();
      if (!token) return;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        setIncidents(incidents.filter(inc => inc.id !== incidentId));
        if (selectedIncident === incidentId) {
          setSelectedIncident(null);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete incident');
      }
    } catch (err) {
      console.error('Error deleting incident:', err);
      setError('Failed to delete incident. Please try again.');
    } finally {
      setDeletingIncident(null);
    }
  };

  // Toggle visibility for organization
  const handleToggleVisibility = async (incidentId: string, isPublic: boolean) => {
    setUpdatingVisibility(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${incidentId}/toggle-public`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isPublic }),
        }
      );
      
      if (response.ok) {
        setIncidents(incidents.map(inc => 
          inc.id === incidentId ? { ...inc, isPublic } : inc
        ));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update visibility');
      }
    } catch (err) {
      console.error('Error updating visibility:', err);
      setError('Failed to update visibility. Please try again.');
    } finally {
      setUpdatingVisibility(false);
    }
  };

  // Share with specific users
  const handleShareWithUsers = async () => {
    if (!selectedIncident) return;
    
    setUpdatingVisibility(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/incidents/${selectedIncident}/share`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userIds: selectedUsers }),
        }
      );
      
      if (response.ok) {
        setIncidents(incidents.map(inc => 
          inc.id === selectedIncident ? { ...inc, sharedWithUserIds: selectedUsers } : inc
        ));
        setShowShareModal(false);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to share incident');
      }
    } catch (err) {
      console.error('Error sharing incident:', err);
      setError('Failed to share incident. Please try again.');
    } finally {
      setUpdatingVisibility(false);
    }
  };

  // Open share modal
  const openShareModal = () => {
    const incident = getSelectedIncidentData();
    if (incident) {
      setSelectedUsers(incident.sharedWithUserIds || []);
      fetchOrganizationUsers();
      setShowShareModal(true);
    }
  };

  const handleGenerateReport = async (action: 'download' | 'preview' | 'excel') => {
    if (!selectedIncident) return;
    
    setGenerating(true);
    setError(null);
    
    try {
      const token = await getIdToken();
      if (!token) {
        setError('Authentication required. Please log in again.');
        return;
      }
      
      const endpoint = action === 'excel' 
        ? `${process.env.NEXT_PUBLIC_API_URL}/workplace-report/${selectedIncident}/generate-excel`
        : `${process.env.NEXT_PUBLIC_API_URL}/workplace-report/${selectedIncident}/generate-pdf`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate report');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      if (action === 'download' || action === 'excel') {
        const incident = incidents.find(i => i.id === selectedIncident);
        const extension = action === 'excel' ? 'xlsx' : 'pdf';
        const fileName = `workplace-report-${incident?.incidentNumber || selectedIncident}.${extension}`;
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
      RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      CLOSED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    };
    
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || statusColors.DRAFT}`}>
        {status.replace('_', ' ')}
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
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Workplace Safety Reports
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Generate and download standardized Employee Injury/Illness Report forms pre-filled with incident data.
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
          {/* Search and Refresh */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
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
                onClick={fetchIncidents}
                disabled={loading}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Incidents List */}
          <div className="max-h-[500px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                <span className="ml-3 text-gray-500 dark:text-gray-400">Loading incidents...</span>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                <FileText className="w-12 h-12 mb-3 opacity-50" />
                <p className="font-medium">No workplace safety incidents found</p>
                <p className="text-sm">Create a workplace safety incident to generate reports.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredIncidents.map((incident) => (
                  <div
                    key={incident.id}
                    className={`relative p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      selectedIncident === incident.id
                        ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500'
                        : ''
                    }`}
                  >
                    {/* Delete button - only visible to owner */}
                    {isOwner(incident) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteIncident(incident.id);
                        }}
                        disabled={deletingIncident === incident.id}
                        className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors z-10"
                        title="Delete incident"
                      >
                        {deletingIncident === incident.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    
                    <button
                      onClick={() => setSelectedIncident(incident.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-4 pr-8">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-sm font-medium text-primary-600 dark:text-primary-400">
                              {incident.incidentNumber}
                            </span>
                            {getStatusBadge(incident.status)}
                            {getSeverityBadge(incident.severity)}
                            {/* Visibility indicator */}
                            {isOwner(incident) && (
                              <span className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                                incident.isPublic 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }`}>
                                {incident.isPublic ? (
                                  <><Globe className="w-3 h-3" /> Public</>
                                ) : (
                                  <><Lock className="w-3 h-3" /> Private</>
                                )}
                              </span>
                            )}
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
                              {format(new Date(incident.dateOfInjury || incident.occurredAt), 'MMM d, yyyy')}
                            </span>
                            {incident.Facility?.name && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5" />
                                {incident.Facility.name}
                              </span>
                            )}
                            {/* Shared users count */}
                            {isOwner(incident) && incident.sharedWithUserIds && incident.sharedWithUserIds.length > 0 && (
                              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <Users className="w-3.5 h-3.5" />
                                Shared with {incident.sharedWithUserIds.length}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform ${
                          selectedIncident === incident.id ? 'transform rotate-90' : ''
                        }`} />
                      </div>
                    </button>
                  </div>
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
              Generate Report
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
                  The report will be auto-filled with all available incident data including employee information, injury details, and investigation findings.
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
                  
                  <button
                    onClick={() => handleGenerateReport('excel')}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {generating ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-5 h-5" />
                    )}
                    Download Excel
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
                
                {/* Owner Controls - Visibility & Sharing */}
                {(() => {
                  const selectedInc = getSelectedIncidentData();
                  if (selectedInc && isOwner(selectedInc)) {
                    return (
                      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                          <Share2 className="w-4 h-4" />
                          Sharing & Visibility
                        </h3>
                        
                        {/* Visibility Toggle */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            {selectedInc.isPublic ? (
                              <Globe className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                              <Lock className="w-4 h-4 text-gray-500" />
                            )}
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {selectedInc.isPublic ? 'Visible to organization' : 'Private'}
                            </span>
                          </div>
                          <button
                            onClick={() => handleToggleVisibility(selectedInc.id, !selectedInc.isPublic)}
                            disabled={updatingVisibility}
                            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                            style={{ backgroundColor: selectedInc.isPublic ? '#22c55e' : '#9ca3af' }}
                          >
                            {updatingVisibility ? (
                              <Loader2 className="absolute left-1/2 -translate-x-1/2 w-4 h-4 animate-spin text-white" />
                            ) : (
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  selectedInc.isPublic ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            )}
                          </button>
                        </div>
                        
                        {/* Share with Specific Users Button */}
                        <button
                          onClick={openShareModal}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Users className="w-5 h-5" />
                          Share with Specific Users
                          {selectedInc.sharedWithUserIds && selectedInc.sharedWithUserIds.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
                              {selectedInc.sharedWithUserIds.length}
                            </span>
                          )}
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Select an incident from the list to generate a report.
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
              <h3 className="font-semibold text-gray-900 dark:text-white">Report Preview</h3>
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
                title="Report Preview"
              />
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5" />
                Share with Users
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select users in your organization who can view and download this report.
              </p>
              
              {loadingUsers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  <span className="ml-2 text-gray-500">Loading users...</span>
                </div>
              ) : organizationUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No other users in your organization</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {organizationUsers.map((orgUser) => (
                    <label
                      key={orgUser.id}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(orgUser.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUsers([...selectedUsers, orgUser.id]);
                          } else {
                            setSelectedUsers(selectedUsers.filter(id => id !== orgUser.id));
                          }
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {orgUser.firstName} {orgUser.lastName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {orgUser.email}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                        {orgUser.role.replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
              <button
                onClick={() => setShowShareModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShareWithUsers}
                disabled={updatingVisibility}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {updatingVisibility ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Share2 className="w-5 h-5" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
