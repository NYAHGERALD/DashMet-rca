'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import api from '@/lib/api';
import {
  X,
  Loader2,
  Calendar,
  MapPin,
  Tag,
  Users,
  Target,
  ListChecks,
  Settings,
  Mic,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Building2,
  MessageSquare,
  CheckCircle,
  Smartphone,
  Download,
  Search,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────

interface Department {
  id: string;
  name: string;
}

interface OrgUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  profilePicture: string | null;
  phone: string | null;
}

interface ParticipantEntry {
  id?: string;
  name: string;
  email: string;
  role: string;
  profilePicture?: string | null;
  phone?: string | null;
}

const meetingTypes = [
  { value: 'GENERAL', label: 'General', icon: '💬' },
  { value: 'STANDUP', label: 'Standup', icon: '🧍' },
  { value: 'PLANNING', label: 'Planning', icon: '📋' },
  { value: 'RETROSPECTIVE', label: 'Retrospective', icon: '🔄' },
  { value: 'ONE_ON_ONE', label: '1:1', icon: '👥' },
  { value: 'BRAINSTORM', label: 'Brainstorm', icon: '💡' },
  { value: 'REVIEW', label: 'Review', icon: '📊' },
  { value: 'TRAINING', label: 'Training', icon: '📚' },
  { value: 'INTERVIEW', label: 'Interview', icon: '🎤' },
  { value: 'CLIENT', label: 'Client', icon: '🤝' },
  { value: 'INCIDENT_REVIEW', label: 'Incident Review', icon: '🚨' },
  { value: 'SAFETY_BRIEFING', label: 'Safety Briefing', icon: '🦺' },
];

const locationTypes = ['On-site', 'Remote', 'Hybrid', 'Custom'];

const aiModes = [
  { value: 'ExecutiveSummary', label: 'Executive Summary' },
  { value: 'DetailedMinutes', label: 'Detailed Minutes' },
  { value: 'ActionFocused', label: 'Action Focused' },
  { value: 'Compliance', label: 'Compliance' },
];

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (meeting: any) => void;
  /** Pre-select "start recording" flow */
  startRecordingAfter?: boolean;
}

export default function CreateMeetingModal({
  isOpen,
  onClose,
  onCreated,
  startRecordingAfter = false,
}: CreateMeetingModalProps) {
  const { user } = useAuth();

  // ─── Form State ────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState('GENERAL');
  const [scheduledDate, setScheduledDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [locationType, setLocationType] = useState('On-site');
  const [customLocation, setCustomLocation] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [objective, setObjective] = useState('');
  const [agendaItems, setAgendaItems] = useState<string[]>([]);
  const [newAgendaItem, setNewAgendaItem] = useState('');

  // Participants
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [isLoadingOrgUsers, setIsLoadingOrgUsers] = useState(false);
  const [participantSearch, setParticipantSearch] = useState('');
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const participantDropdownRef = useRef<HTMLDivElement>(null);

  // Department
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [isLoadingDepartments, setIsLoadingDepartments] = useState(false);

  // AI Settings
  const [showAISettings, setShowAISettings] = useState(false);
  const [liveTranscriptionEnabled, setLiveTranscriptionEnabled] = useState(true);
  const [aiProcessingMode, setAiProcessingMode] = useState('ExecutiveSummary');
  const [confidentialityLevel, setConfidentialityLevel] = useState('TeamVisible');

  // State
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // ─── Click outside to close participant dropdown ──────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (participantDropdownRef.current && !participantDropdownRef.current.contains(e.target as Node)) {
        setShowParticipantDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ─── Load departments & org users ─────────────────────
  useEffect(() => {
    if (!isOpen) return;
    loadDepartments();
    loadOrgUsers();
  }, [isOpen]);

  const loadDepartments = async () => {
    setIsLoadingDepartments(true);
    try {
      const res = await api.get('/facilities/departments');
      if (res.data.success) {
        setDepartments(res.data.data?.departments || []);
      }
    } catch {
      // Departments optional
    } finally {
      setIsLoadingDepartments(false);
    }
  };

  const loadOrgUsers = async () => {
    if (!user) return;
    setIsLoadingOrgUsers(true);
    try {
      // Try user's organizationId, fallback to fetching from any available org
      const orgId = user.organizationId;
      if (orgId) {
        const res = await api.get(`/mobile/tasks/users/organization/${orgId}`);
        if (res.data.success) {
          // Exclude self from the list
          setOrgUsers((res.data.users || []).filter((u: OrgUser) => u.id !== user.id));
        }
      }
    } catch {
      // Org users optional — fall back to manual entry
    } finally {
      setIsLoadingOrgUsers(false);
    }
  };

  // ─── Reset form ────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setSelectedType('GENERAL');
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      setScheduledDate(now.toISOString().slice(0, 16));
      setLocationType('On-site');
      setCustomLocation('');
      setTags([]);
      setTagInput('');
      setObjective('');
      setAgendaItems([]);
      setNewAgendaItem('');
      setParticipants([]);
      setParticipantSearch('');
      setShowParticipantDropdown(false);
      setSelectedDepartmentId('');
      setShowAISettings(false);
      setLiveTranscriptionEnabled(true);
      setAiProcessingMode('ExecutiveSummary');
      setConfidentialityLevel('TeamVisible');
      setError(null);
    }
  }, [isOpen]);

  // ─── Add agenda item ───────────────────────────────────
  const addAgendaItem = () => {
    const trimmed = newAgendaItem.trim();
    if (trimmed) {
      setAgendaItems(prev => [...prev, trimmed]);
      setNewAgendaItem('');
    }
  };

  // ─── Add participant from org user ─────────────────────
  const addOrgUserAsParticipant = (orgUser: OrgUser) => {
    // Don't add duplicates
    if (participants.some(p => p.id === orgUser.id)) return;
    const fullName = [orgUser.firstName, orgUser.lastName].filter(Boolean).join(' ') || orgUser.email;
    setParticipants(prev => [
      ...prev,
      {
        id: orgUser.id,
        name: fullName,
        email: orgUser.email,
        role: orgUser.role || '',
        profilePicture: orgUser.profilePicture,
        phone: orgUser.phone,
      },
    ]);
    setParticipantSearch('');
    setShowParticipantDropdown(false);
  };

  // Filtered org users for search
  const filteredOrgUsers = orgUsers.filter(u => {
    if (participants.some(p => p.id === u.id)) return false;
    if (!participantSearch.trim()) return true;
    const q = participantSearch.toLowerCase();
    const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').toLowerCase();
    return fullName.includes(q) || u.email.toLowerCase().includes(q) || (u.phone && u.phone.includes(q));
  });

  // ─── Create meeting ────────────────────────────────────
  const handleCreate = async () => {
    if (!user) return;
    setIsCreating(true);
    setError(null);

    try {
      // tags array is already maintained via chip input

      const payload: any = {
        title: title.trim() || null,
        meetingType: selectedType,
        scheduledAt: new Date(scheduledDate).toISOString(),
        locationType,
        location: locationType === 'Custom' ? customLocation.trim() : locationType,
        tags,
        objective: objective.trim() || null,
        agendaItems,
        liveTranscriptionEnabled,
        aiProcessingMode,
        confidentialityLevel,
        departmentId: selectedDepartmentId || null,
        creatorId: user.id,
        organizationId: user.organizationId || undefined,
        participants: participants.length > 0
          ? participants.map(p => ({
              name: p.name || null,
              email: p.email || null,
            }))
          : undefined,
      };

      const res = await api.post('/mobile/meetings', payload);

      if (res.data.success) {
        onCreated(res.data.meeting);
        onClose();
      } else {
        setError(res.data.error || 'Failed to create meeting');
      }
    } catch (err: any) {
      console.error('Create meeting error:', err);
      setError(err.response?.data?.error || 'Failed to create meeting');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  const selectedTypeObj = meetingTypes.find(t => t.value === selectedType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Cancel
          </button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            New Meeting
          </h2>
          {/* Meeting Type Menu */}
          <div className="relative">
            <button
              onClick={() => setShowTypeMenu(!showTypeMenu)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Change meeting type"
            >
              <svg
                className="w-5 h-5 text-gray-600 dark:text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            {showTypeMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTypeMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-20 py-2 max-h-72 overflow-y-auto">
                  {meetingTypes.map(type => (
                    <button
                      key={type.value}
                      onClick={() => {
                        setSelectedType(type.value);
                        setShowTypeMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        selectedType === type.value
                          ? 'text-purple-600 dark:text-purple-400 font-medium bg-purple-50 dark:bg-purple-900/20'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="text-lg">{type.icon}</span>
                      <span>{type.label}</span>
                      {selectedType === type.value && (
                        <CheckCircle className="w-4 h-4 ml-auto text-purple-600 dark:text-purple-400" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Error */}
          {error && (
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Section 1: Meeting Type Display */}
          <section>
            <SectionLabel>Meeting Type</SectionLabel>
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              <div className="w-12 h-12 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 rounded-xl text-2xl">
                {selectedTypeObj?.icon || '💬'}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {selectedTypeObj?.label || 'General'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Tap menu to change
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Meeting Details */}
          <section>
            <SectionLabel>Meeting Details</SectionLabel>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-700">
              {/* Title */}
              <div className="flex items-center gap-3 p-4">
                <span className="text-purple-600 dark:text-purple-400 font-bold text-lg">Aa</span>
                <input
                  type="text"
                  placeholder="Meeting Title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none text-sm"
                />
              </div>

              {/* Date & Time */}
              <div className="flex items-center gap-3 p-4">
                <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  title="Meeting date and time"
                  className="flex-1 bg-transparent text-gray-900 dark:text-white outline-none text-sm [color-scheme:dark] dark:[color-scheme:dark]"
                />
              </div>

              {/* Location Type */}
              <div className="flex items-center gap-3 p-4">
                <MapPin className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <div className="flex gap-1 flex-1">
                  {locationTypes.map(lt => (
                    <button
                      key={lt}
                      onClick={() => setLocationType(lt)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        locationType === lt
                          ? 'bg-purple-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      {lt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Location */}
              {locationType === 'Custom' && (
                <div className="flex items-center gap-3 p-4">
                  <MapPin className="w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Custom Location"
                    value={customLocation}
                    onChange={e => setCustomLocation(e.target.value)}
                    className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-sm"
                  />
                </div>
              )}

              {/* Department */}
              <div className="flex items-center gap-3 p-4">
                <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">Department</span>
                <div className="ml-auto min-w-[180px]">
                  {isLoadingDepartments ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-auto" />
                  ) : departments.length === 0 ? (
                    <span className="text-xs text-gray-400 block text-right">No departments</span>
                  ) : (
                    <select
                      value={selectedDepartmentId}
                      onChange={e => setSelectedDepartmentId(e.target.value)}
                      title="Select department"
                      className="w-full text-sm bg-transparent text-purple-600 dark:text-purple-400 outline-none cursor-pointer text-right"
                    >
                      <option value="">None</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <Tag className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-1 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 items-center">
                      {tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => setTags(prev => prev.filter((_, i) => i !== idx))}
                            className="ml-0.5 hover:text-purple-900 dark:hover:text-purple-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        placeholder={tags.length === 0 ? 'Type a tag and press Enter' : 'Add more...'}
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            const val = tagInput.trim().replace(/,$/,'');
                            if (val && !tags.includes(val)) {
                              setTags(prev => [...prev, val]);
                            }
                            setTagInput('');
                          } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
                            setTags(prev => prev.slice(0, -1));
                          }
                        }}
                        className="flex-1 min-w-[120px] bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Participants */}
          <section>
            <SectionLabel>Participants</SectionLabel>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-700">
              {/* Selected participants */}
              {participants.map((p, idx) => (
                <div key={p.id || idx} className="flex items-center gap-3 p-4">
                  {p.profilePicture ? (
                    <img
                      src={p.profilePicture}
                      alt={p.name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                      {(p.name || p.email || '?').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {p.email}{p.phone ? ` · ${p.phone}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setParticipants(prev => prev.filter((_, i) => i !== idx))}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Search / Add participant */}
              <div className="p-4 relative" ref={participantDropdownRef}>
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder={isLoadingOrgUsers ? 'Loading team members...' : 'Search team members...'}
                    value={participantSearch}
                    onChange={e => {
                      setParticipantSearch(e.target.value);
                      setShowParticipantDropdown(true);
                    }}
                    onFocus={() => setShowParticipantDropdown(true)}
                    className="flex-1 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 outline-none text-sm"
                  />
                  {isLoadingOrgUsers && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                </div>

                {/* Dropdown */}
                {showParticipantDropdown && filteredOrgUsers.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 mx-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 max-h-52 overflow-y-auto">
                    {filteredOrgUsers.map(u => {
                      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;
                      return (
                        <button
                          key={u.id}
                          onClick={() => addOrgUserAsParticipant(u)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          {u.profilePicture ? (
                            <img
                              src={u.profilePicture}
                              alt={fullName}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold">
                              {fullName.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{fullName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {u.email}{u.phone ? ` · ${u.phone}` : ''}
                            </p>
                          </div>
                          {u.role && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-medium whitespace-nowrap">
                              {u.role}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {showParticipantDropdown && !isLoadingOrgUsers && filteredOrgUsers.length === 0 && participantSearch.trim() && (
                  <div className="absolute left-0 right-0 top-full mt-1 mx-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-30 px-4 py-3">
                    <p className="text-xs text-gray-400 text-center">No matching team members</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Section 4: Objective & Agenda */}
          <section>
            <SectionLabel>Objective &amp; Agenda</SectionLabel>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-700">
              {/* Objective */}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Objective
                  </span>
                </div>
                <textarea
                  placeholder="What's the goal of this meeting?"
                  value={objective}
                  onChange={e => setObjective(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 outline-none resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  System uses this to focus summaries and improve action extraction
                </p>
              </div>

              {/* Agenda Items */}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    Agenda Items
                  </span>
                  <span className="text-xs text-gray-400 ml-auto">Optional</span>
                </div>

                {agendaItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-center">{idx + 1}.</span>
                    <span className="flex-1 text-sm text-gray-900 dark:text-white">{item}</span>
                    <button
                      onClick={() => setAgendaItems(prev => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add agenda item"
                    value={newAgendaItem}
                    onChange={e => setNewAgendaItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addAgendaItem()}
                    className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    onClick={addAgendaItem}
                    disabled={!newAgendaItem.trim()}
                    className="p-1.5 bg-purple-600 text-white rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: System & Transcription Settings (Collapsible) */}
          <section>
            <button
              onClick={() => setShowAISettings(!showAISettings)}
              className="w-full flex items-center justify-between py-2"
            >
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  System &amp; Transcription Settings
                </span>
              </div>
              {showAISettings ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showAISettings && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl divide-y divide-gray-200 dark:divide-gray-700 mt-2">
                {/* Live Transcription */}
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Live Transcription
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={liveTranscriptionEnabled}
                      onChange={e => setLiveTranscriptionEnabled(e.target.checked)}
                      title="Toggle live transcription"
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-300 dark:bg-gray-600 peer-checked:bg-purple-600 rounded-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                  </label>
                </div>

                {/* AI Processing Mode */}
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    AI Processing Mode
                  </span>
                  <select
                    value={aiProcessingMode}
                    onChange={e => setAiProcessingMode(e.target.value)}
                    title="AI processing mode"
                    className="text-sm bg-transparent text-purple-600 dark:text-purple-400 outline-none cursor-pointer text-right"
                  >
                    {aiModes.map(m => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Confidentiality */}
                <div className="flex items-center justify-between p-4">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Confidentiality
                  </span>
                  <select
                    value={confidentialityLevel}
                    onChange={e => setConfidentialityLevel(e.target.value)}
                    title="Confidentiality level"
                    className="text-sm bg-transparent text-purple-600 dark:text-purple-400 outline-none cursor-pointer text-right"
                  >
                    <option value="Private">Private</option>
                    <option value="TeamVisible">Team Visible</option>
                    <option value="Restricted">Restricted</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          {/* Section 6: Quick Actions */}
          <section>
            <SectionLabel>Quick Actions</SectionLabel>
            <button
              onClick={() => setShowDownloadModal(true)}
              className="w-full flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Mic className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Start Recording
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Record meetings using the Dashmet mobile app
                </p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90" />
            </button>
          </section>

          {/* Bottom spacing for sticky button */}
          <div className="h-20" />
        </div>

        {/* Download Mobile App Modal */}
        {showDownloadModal && (
          <DownloadAppModal onClose={() => setShowDownloadModal(false)} />
        )}

        {/* Sticky Create Button */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-white dark:bg-gray-900">
          <button
            onClick={handleCreate}
            disabled={isCreating}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Meeting'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Section Label ──────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
      {children}
    </h3>
  );
}

// ─── Download Mobile App Modal ──────────────────────────
function DownloadAppModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-[60] flex items-center justify-center p-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm rounded-2xl" onClick={onClose} />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Gradient */}
        <div className="relative bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 px-6 pt-8 pb-10 text-center">
          {/* Decorative circles */}
          <div className="absolute top-3 left-4 w-16 h-16 rounded-full bg-white/10" />
          <div className="absolute top-10 right-6 w-10 h-10 rounded-full bg-white/10" />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-white/5" />

          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-1">
              Record on Mobile
            </h3>
            <p className="text-sm text-purple-100 leading-relaxed">
              Meeting recording is available on the<br />Dashmet mobile apps
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center leading-relaxed">
            Download <span className="font-semibold text-gray-900 dark:text-white">Dashmet</span> on your phone to record meetings with real-time transcription, AI summaries, and automatic action item extraction.
          </p>

          {/* App Store Buttons */}
          <div className="space-y-3">
            {/* iOS */}
            <a
              href="https://apps.apple.com/app/dashmet"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 w-full px-4 py-3.5 bg-gray-900 dark:bg-gray-800 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors group"
            >
              <div className="w-10 h-10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-gray-400 leading-none">Download on the</p>
                <p className="text-base font-semibold text-white -mt-0.5">App Store</p>
              </div>
              <Download className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            </a>

            {/* Android */}
            <a
              href="https://play.google.com/store/apps/details?id=com.dashmet"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-4 w-full px-4 py-3.5 bg-gray-900 dark:bg-gray-800 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-700 transition-colors group"
            >
              <div className="w-10 h-10 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
                  <path d="M3.18 23.08c-.44-.27-.68-.72-.68-1.22V2.14c0-.5.24-.95.68-1.22l10.48 11.08L3.18 23.08z" fill="#4285F4"/>
                  <path d="M17.15 8.51l-3.49 3.49 3.49 3.49 3.94-2.22c.45-.25.72-.7.72-1.2 0-.5-.27-.95-.72-1.2l-3.94-2.36z" fill="#FBBC04"/>
                  <path d="M3.18.92C3.35.8 3.56.73 3.78.73c.27 0 .54.08.78.24l9.1 5.18-3.49 3.49L3.18.92z" fill="#34A853"/>
                  <path d="M13.66 15.49l-3.49-3.49-6.99 7.59 9.1 5.18c.24.14.51.22.78.22.22 0 .43-.07.6-.19l-3.49-3.49.49-.49 3-3.33z" fill="#EA4335"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[10px] text-gray-400 leading-none">Get it on</p>
                <p className="text-base font-semibold text-white -mt-0.5">Google Play</p>
              </div>
              <Download className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
            </a>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Mic className="w-4 h-4 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
              <p className="text-[10px] text-purple-700 dark:text-purple-300 font-medium">Live Record</p>
            </div>
            <div className="text-center p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mx-auto mb-1" />
              <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">Transcription</p>
            </div>
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
              <p className="text-[10px] text-blue-700 dark:text-blue-300 font-medium">AI Actions</p>
            </div>
          </div>
        </div>

        {/* Close */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
