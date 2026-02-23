'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import Link from 'next/link';
import {
  ClipboardList,
  Calendar,
  Clock,
  User,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Sparkles,
  ArrowLeft,
  GripVertical,
  Trash2,
  MessageSquare,
  Plus,
  X,
} from 'lucide-react';

interface TaskAssignee {
  id: string;
  userId: string;
  taskId: string;
  assignedAt: string;
  assignedBy: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string | null;
  };
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  dueDate: string | null;
  completedAt: string | null;
  isAiExtracted: boolean;
  createdAt: string;
  meetingId: string;
  meeting?: {
    id: string;
    title: string | null;
    meetingType: string;
    createdAt?: string;
  };
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignees: TaskAssignee[];
}

interface MeetingGroup {
  meetingId: string;
  meetingTitle: string;
  meetingType: string;
  meetingDate: string | null;
  tasks: Task[];
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  overdueCount: number;
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  PENDING: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Pending' },
  IN_PROGRESS: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'In Progress' },
  COMPLETED: { color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
};

const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
  LOW: { color: 'text-gray-600', bg: 'bg-gray-100', label: 'Low' },
  MEDIUM: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Medium' },
  HIGH: { color: 'text-orange-600', bg: 'bg-orange-100', label: 'High' },
  URGENT: { color: 'text-red-600', bg: 'bg-red-100', label: 'Urgent' },
};

// Group tasks by meeting
function groupTasksByMeeting(tasks: Task[]): MeetingGroup[] {
  const groups: Record<string, MeetingGroup> = {};
  
  tasks.forEach((task) => {
    const meetingId = task.meetingId || 'unknown';
    const isManual = task.meeting?.meetingType === 'MANUAL';
    
    if (!groups[meetingId]) {
      groups[meetingId] = {
        meetingId,
        meetingTitle: isManual ? 'Manual' : (task.meeting?.title || task.meeting?.meetingType || 'Meeting'),
        meetingType: task.meeting?.meetingType || 'GENERAL',
        meetingDate: task.meeting?.createdAt || task.createdAt,
        tasks: [],
        pendingCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        overdueCount: 0,
      };
    }
    
    groups[meetingId].tasks.push(task);
    
    if (task.status === 'PENDING') groups[meetingId].pendingCount++;
    if (task.status === 'IN_PROGRESS') groups[meetingId].inProgressCount++;
    if (task.status === 'COMPLETED') groups[meetingId].completedCount++;
    if (task.status !== 'COMPLETED' && task.dueDate && new Date(task.dueDate) < new Date()) {
      groups[meetingId].overdueCount++;
    }
  });
  
  // Sort by meeting date descending
  return Object.values(groups).sort((a, b) => {
    const dateA = a.meetingDate ? new Date(a.meetingDate).getTime() : 0;
    const dateB = b.meetingDate ? new Date(b.meetingDate).getTime() : 0;
    return dateB - dateA;
  });
}

function AssignedActionsContent() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewFilter, setViewFilter] = useState<'owned' | 'assigned'>('owned');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Delete state
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create manual task state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createDueDate, setCreateDueDate] = useState('');
  const [createPriority, setCreatePriority] = useState('MEDIUM');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Draggable pagination state
  const [paginationPosition, setPaginationPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [useCustomPosition, setUseCustomPosition] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setUseCustomPosition(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (dragRef.current) {
      const rect = dragRef.current.getBoundingClientRect();
      dragStartRef.current = {
        x: clientX,
        y: clientY,
        initialX: rect.left,
        initialY: rect.top
      };
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      
      const newX = dragStartRef.current.initialX + deltaX;
      const newY = dragStartRef.current.initialY + deltaY;
      
      // Constrain to viewport
      const maxX = window.innerWidth - (dragRef.current?.offsetWidth || 0) - 10;
      const maxY = window.innerHeight - (dragRef.current?.offsetHeight || 0) - 10;
      
      setPaginationPosition({
        x: Math.max(10, Math.min(maxX, newX)),
        y: Math.max(10, Math.min(maxY, newY))
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  const fetchMyTasks = useCallback(async () => {
    if (!user?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/mobile/tasks', {
        params: {
          userId: user.id,
          filter: viewFilter,
        },
      });
      
      if (response.data.success) {
        setTasks(response.data.tasks || []);
      } else {
        setError(response.data.error || 'Failed to fetch action items');
      }
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err.response?.data?.error || 'Failed to load action items');
    } finally {
      setLoading(false);
    }
  }, [user?.id, viewFilter]);

  // Create manual task handler
  const handleCreateManualTask = async () => {
    if (!user?.id || !user?.organizationId || !createTitle.trim()) {
      setCreateError('Title is required');
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    const payload = {
      title: createTitle.trim(),
      description: createDescription.trim() || null,
      dueDate: createDueDate || null,
      priority: createPriority,
      ownerId: user.id,
      organizationId: user.organizationId,
    };
    
    console.log('Creating manual task with payload:', payload);

    try {
      const response = await api.post('/mobile/tasks/manual', payload);

      if (response.data.success) {
        // Add new task to list
        setTasks(prev => [response.data.task, ...prev]);
        // Reset form
        setCreateTitle('');
        setCreateDescription('');
        setCreateDueDate('');
        setCreatePriority('MEDIUM');
        setShowCreateModal(false);
        // Refresh to ensure proper grouping
        fetchMyTasks();
      } else {
        setCreateError(response.data.error || 'Failed to create action item');
      }
    } catch (err: any) {
      console.error('Error creating task:', err);
      setCreateError(err.response?.data?.error || 'Failed to create action item');
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    fetchMyTasks();
  }, [fetchMyTasks]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, viewFilter, pageSize]);

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = searchQuery === '' || 
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Group filtered tasks by meeting
  const meetingGroups = groupTasksByMeeting(filteredTasks);

  // Expand all groups by default when data loads
  useEffect(() => {
    if (meetingGroups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(meetingGroups.map(g => g.meetingId)));
    }
  }, [meetingGroups.length]);

  // Toggle group expansion
  const toggleGroup = (meetingId: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(meetingId)) {
        newSet.delete(meetingId);
      } else {
        newSet.add(meetingId);
      }
      return newSet;
    });
  };

  // Pagination calculations (now based on groups)
  const totalPages = Math.ceil(meetingGroups.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedGroups = meetingGroups.slice(startIndex, endIndex);

  // Delete handler
  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    
    setIsDeleting(true);
    try {
      const response = await api.delete(`/mobile/tasks/${taskToDelete.id}`);
      if (response.data.success) {
        setTasks(prev => prev.filter(t => t.id !== taskToDelete.id));
        setShowDeleteConfirm(false);
        setTaskToDelete(null);
      } else {
        setError(response.data.error || 'Failed to delete action item');
      }
    } catch (err: any) {
      console.error('Error deleting task:', err);
      setError(err.response?.data?.error || 'Failed to delete action item');
    } finally {
      setIsDeleting(false);
    }
  };

  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = now.getTime() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="px-6 lg:px-10">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <div className="flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-purple-600" />
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  My Action Items
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create
              </button>
              <button
                onClick={fetchMyTasks}
                disabled={loading}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-6 lg:px-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1">
          <button
            onClick={() => setViewFilter('owned')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewFilter === 'owned'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Owned
          </button>
          <button
            onClick={() => setViewFilter('assigned')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              viewFilter === 'assigned'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Assigned
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 lg:px-10 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search action items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <main className="px-6 lg:px-10 py-6 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 min-h-[60vh]">
            {/* Animated Logo/Icon */}
            <div className="relative mb-8">
              {/* Outer Ring */}
              <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-purple-200 dark:border-purple-900/50" />
              
              {/* Spinning Ring */}
              <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-purple-600 border-r-purple-600 animate-spin" />
              
              {/* Center Icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                <ClipboardList className="w-8 h-8 text-purple-600 animate-pulse" />
              </div>
            </div>
            
            {/* Hang Tight Message */}
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Hang tight!
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">
              We're fetching your action items...
            </p>
            
            {/* Animated Progress Dots */}
            <div className="flex items-center gap-1.5 mt-6">
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <button
              onClick={fetchMyTasks}
              className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Action Items
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
              {searchQuery || statusFilter !== 'all'
                ? 'No action items match your filters.'
                : viewFilter === 'owned'
                  ? "You don't own any action items yet."
                  : "You haven't been assigned any action items yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.meetingId);
              
              return (
                <div key={group.meetingId} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Meeting Header */}
                  <button
                    onClick={() => toggleGroup(group.meetingId)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {group.meetingTitle}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span className={group.meetingType === 'MANUAL' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'capitalize'}>
                            {group.meetingType === 'MANUAL' ? 'Manual Entry' : group.meetingType.replace(/_/g, ' ').toLowerCase()}
                          </span>
                          {group.meetingDate && (
                            <>
                              <span>•</span>
                              <span>{formatDate(group.meetingDate)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {group.overdueCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full">
                          {group.overdueCount} overdue
                        </span>
                      )}
                      {group.inProgressCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                          {group.inProgressCount} in progress
                        </span>
                      )}
                      {group.pendingCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-full">
                          {group.pendingCount} pending
                        </span>
                      )}
                      {group.completedCount > 0 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                          {group.completedCount} done
                        </span>
                      )}
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                        {group.tasks.length} item{group.tasks.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>

                  {/* Tasks List */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {group.tasks.map((task) => {
                        const isOverdue = task.status !== 'COMPLETED' && task.dueDate && new Date(task.dueDate) < new Date();
                        const daysOverdue = task.dueDate ? getDaysOverdue(task.dueDate) : 0;
                        const status = statusConfig[task.status] || statusConfig.PENDING;
                        const priority = priorityConfig[task.priority] || priorityConfig.MEDIUM;

                        return (
                          <Link
                            key={task.id}
                            href={`/meetings/${task.meetingId}/actions/${task.id}${viewFilter === 'assigned' ? '?source=assigned' : ''}`}
                            className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              {/* Status Indicator */}
                              <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                                task.status === 'COMPLETED' ? 'bg-green-500' :
                                task.status === 'IN_PROGRESS' ? 'bg-blue-500' : 'bg-gray-400'
                              }`} />

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-gray-900 dark:text-white truncate text-sm">
                                      {task.title}
                                    </h4>
                                    {task.description && (
                                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-1">
                                        {task.description}
                                      </p>
                                    )}
                                  </div>
                                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${status.bg} ${status.color}`}>
                                    {status.label}
                                  </span>
                                </div>

                                {/* Meta Info */}
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  {isOverdue && (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">
                                      <Calendar className="w-3 h-3" />
                                      {daysOverdue}d overdue
                                    </span>
                                  )}

                                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${priority.bg} ${priority.color}`}>
                                    ! {priority.label}
                                  </span>

                                  {task.dueDate && !isOverdue && (
                                    <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                      <Clock className="w-3 h-3" />
                                      Due: {formatDate(task.dueDate)}
                                    </span>
                                  )}

                                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                    <User className="w-3 h-3" />
                                    {task.owner.firstName} {task.owner.lastName}
                                  </span>
                                </div>

                                {/* Progress Bar */}
                                {task.progress > 0 && (
                                  <div className="mt-2">
                                    <div className="flex items-center justify-between text-xs mb-0.5">
                                      <span className="text-gray-500 dark:text-gray-400">Progress</span>
                                      <span className={`font-medium ${
                                        task.progress <= 20 ? 'text-red-500' :
                                        task.progress <= 50 ? 'text-yellow-500' :
                                        task.progress <= 80 ? 'text-green-500' : 'text-blue-500'
                                      }`}>{task.progress}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className="h-full rounded-full transition-all duration-300"
                                        style={{ 
                                          width: `${task.progress}%`,
                                          background: task.progress <= 20 
                                            ? '#ef4444' 
                                            : task.progress <= 50 
                                              ? `linear-gradient(90deg, #ef4444 0%, #ef4444 ${(20/task.progress)*100}%, #eab308 100%)`
                                              : task.progress <= 80
                                                ? `linear-gradient(90deg, #ef4444 0%, #ef4444 ${(20/task.progress)*100}%, #eab308 ${(20/task.progress)*100}%, #eab308 ${(50/task.progress)*100}%, #22c55e 100%)`
                                                : `linear-gradient(90deg, #ef4444 0%, #ef4444 ${(20/task.progress)*100}%, #eab308 ${(20/task.progress)*100}%, #eab308 ${(50/task.progress)*100}%, #22c55e ${(50/task.progress)*100}%, #22c55e ${(80/task.progress)*100}%, #3b82f6 100%)`
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                {viewFilter === 'owned' && (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setTaskToDelete(task);
                                      setShowDeleteConfirm(true);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                    title="Delete action item"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && taskToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Delete Action Item
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-2">
              Are you sure you want to delete this action item?
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-4">
              {taskToDelete.title}
            </p>
            <p className="text-sm text-red-600 dark:text-red-400 mb-6">
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setTaskToDelete(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTask}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
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
          </div>
        </div>
      )}

      {/* Create Manual Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <Plus className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Create Action Item
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
                {createError}
              </div>
            )}

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Enter action item title"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Enter description (optional)"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Due Date and Priority Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={createDueDate}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                This action item will be created under the "Manual" group.
              </p>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateTitle('');
                  setCreateDescription('');
                  setCreateDueDate('');
                  setCreatePriority('MEDIUM');
                  setCreateError(null);
                }}
                disabled={isCreating}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateManualTask}
                disabled={isCreating || !createTitle.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draggable Pagination Footer */}
      {!loading && !error && filteredTasks.length > 0 && (
        <div
          ref={dragRef}
          className={`fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl z-40 select-none ${
            isDragging ? 'cursor-grabbing' : ''
          }`}
          style={{
            ...(useCustomPosition
              ? { left: paginationPosition.x, top: paginationPosition.y, right: 'auto', bottom: 'auto', transform: 'none' }
              : { bottom: '24px', left: '50%', transform: 'translateX(-50%)' }),
            transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
            boxShadow: isDragging ? '0 25px 50px -12px rgba(0, 0, 0, 0.35)' : undefined,
          }}
        >
          <div className="px-4 py-3 flex items-center gap-4">
            {/* Drag Handle */}
            <div
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              onDoubleClick={() => setUseCustomPosition(false)}
              className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="Drag to move • Double-click to reset"
            >
              <GripVertical className="w-5 h-5 text-gray-400" />
            </div>
            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Meetings per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Page Info */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing {startIndex + 1}-{Math.min(endIndex, meetingGroups.length)} of {meetingGroups.length} meetings ({filteredTasks.length} {viewFilter} items)
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="First page"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <span className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Last page"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssignedActionsPage() {
  return (
    <ProtectedRoute>
      <AssignedActionsContent />
    </ProtectedRoute>
  );
}
