'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import api from '@/lib/api';
import Link from 'next/link';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Sparkles,
  Calendar,
  Clock,
  User,
  Users,
  MessageSquare,
  FileText,
  Plus,
  Upload,
  Send,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Download,
  Image as ImageIcon,
  Pencil,
  Save,
  Check,
  History,
  GripVertical,
  Lock,
  Unlock,
  Building,
} from 'lucide-react';

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  dueDate: string | null;
  startDate: string | null;
  departmentId: string | null;
  department: {
    id: string;
    name: string;
  } | null;
  completedAt: string | null;
  completedById: string | null;
  completedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  isLocked: boolean;
  lockedAt: string | null;
  lockedById: string | null;
  lockedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  sourceText: string | null;
  isAiExtracted: boolean;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  assignee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  assignees: Array<{
    id: string;
    userId: string;
    assignedAt: string;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      profilePicture?: string;
    };
    assigner: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  }>;
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    replies?: Array<{
      id: string;
      content: string;
      createdAt: string;
      author: {
        id: string;
        firstName: string;
        lastName: string;
      };
    }>;
  }>;
  evidence: Array<{
    id: string;
    title: string;
    description: string | null;
    fileUrl: string | null;
    fileType: string | null;
    fileName: string | null;
    createdAt: string;
    uploader: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
}

interface ActivityLog {
  id: string;
  taskId: string;
  userId: string;
  action: string;
  field: string | null;
  previousValue: string | null;
  newValue: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePicture?: string | null;
  };
}

interface OrgUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture?: string;
}

// Helper to generate initials
function getInitials(firstName?: string, lastName?: string, email?: string): string {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  if (first || last) return `${first}${last}`;
  return email?.substring(0, 2).toUpperCase() || '??';
}

// Helper to format date for activity log
function formatActivityDate(dateString: string): string {
  const date = new Date(dateString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = days[date.getDay()];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${dayName}, ${month} ${day} ${year}`;
}

// Helper to format time for activity log  
function formatActivityTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
}

// Helper to get action description
function getActionDescription(log: ActivityLog): string {
  const userName = `${log.user.firstName} ${log.user.lastName}`;
  
  switch (log.action) {
    case 'UPDATE_STATUS':
      return `${userName} changed status from "${log.previousValue}" to "${log.newValue}"`;
    case 'UPDATE_PRIORITY':
      return `${userName} changed priority from "${log.previousValue}" to "${log.newValue}"`;
    case 'UPDATE_PROGRESS':
      return `${userName} changed progress from ${log.previousValue}% to ${log.newValue}%`;
    case 'UPDATE_TITLE':
      return `${userName} updated the title`;
    case 'UPDATE_DESCRIPTION':
      return `${userName} updated the description`;
    case 'UPDATE_DUE_DATE':
      const oldDate = log.previousValue ? new Date(log.previousValue).toLocaleDateString() : 'none';
      const newDate = log.newValue ? new Date(log.newValue).toLocaleDateString() : 'none';
      return `${userName} changed due date from ${oldDate} to ${newDate}`;
    case 'UPDATE_START_DATE':
      const oldStartDate = log.previousValue ? new Date(log.previousValue).toLocaleDateString() : 'none';
      const newStartDate = log.newValue ? new Date(log.newValue).toLocaleDateString() : 'none';
      return `${userName} changed start date from ${oldStartDate} to ${newStartDate}`;
    case 'UPDATE_DEPARTMENT':
      return `${userName} changed department from "${log.previousValue || 'none'}" to "${log.newValue || 'none'}"`;
    case 'ADD_ASSIGNEE':
      return `${userName} assigned "${log.newValue}" to this task`;
    case 'REMOVE_ASSIGNEE':
      return `${userName} removed "${log.previousValue}" from this task`;
    case 'LOCK_TASK':
      return `${userName} locked this task`;
    case 'UNLOCK_TASK':
      return `${userName} unlocked this task`;
    case 'ADD_COMMENT':
      return `${userName} added a comment`;
    case 'DELETE_COMMENT':
      return `${userName} deleted a comment`;
    case 'ADD_EVIDENCE':
      const fileName = log.metadata?.fileName ? ` (${log.metadata.fileName})` : '';
      return `${userName} added evidence "${log.newValue}"${fileName}`;
    case 'DELETE_EVIDENCE':
      const deletedFile = log.metadata?.fileName ? ` (${log.metadata.fileName})` : '';
      return `${userName} deleted evidence "${log.previousValue}"${deletedFile}`;
    default:
      return `${userName} performed an action`;
  }
}

function ActionItemDetailContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const isReadOnly = searchParams?.get('source') === 'assigned';
  const meetingId = params?.id as string;
  const actionId = params?.actionId as string;

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  // Organization users for assignee picker
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Add assignee modal
  const [showAddAssignee, setShowAddAssignee] = useState(false);
  const [addingAssignee, setAddingAssignee] = useState(false);

  // Add comment state
  const [showAddComment, setShowAddComment] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);

  // Add evidence state
  const [showAddEvidence, setShowAddEvidence] = useState(false);
  const [evidenceTitle, setEvidenceTitle] = useState('');
  const [evidenceDescription, setEvidenceDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete evidence state
  const [deletingEvidenceId, setDeletingEvidenceId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [evidenceToDelete, setEvidenceToDelete] = useState<string | null>(null);

  // Remove assignee confirmation state
  const [showRemoveAssigneeConfirm, setShowRemoveAssigneeConfirm] = useState(false);
  const [assigneeToRemove, setAssigneeToRemove] = useState<{ userId: string; firstName: string; lastName: string; email: string } | null>(null);
  const [removingAssignee, setRemovingAssignee] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Lock state
  const [locking, setLocking] = useState(false);

  // Due Date edit state
  const [isEditingDueDate, setIsEditingDueDate] = useState(false);
  const [editDueDate, setEditDueDate] = useState<string>('');
  const [savingDueDate, setSavingDueDate] = useState(false);

  // Start Date edit state
  const [isEditingStartDate, setIsEditingStartDate] = useState(false);
  const [editStartDate, setEditStartDate] = useState<string>('');
  const [savingStartDate, setSavingStartDate] = useState(false);

  // Department state
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [isEditingDepartment, setIsEditingDepartment] = useState(false);
  const [savingDepartment, setSavingDepartment] = useState(false);

  // Completion edit state
  const [editCompletedDate, setEditCompletedDate] = useState<string>('');
  const [editCompletedTime, setEditCompletedTime] = useState<string>('');
  const [savingCompletion, setSavingCompletion] = useState(false);

  // AI Enhancement state
  const [isEnhancingDescription, setIsEnhancingDescription] = useState(false);
  const [justEnhancedDescription, setJustEnhancedDescription] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

  // Activity Log state
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Activity Log pagination state
  const [activityLogPage, setActivityLogPage] = useState(1);
  const [activityLogPageSize, setActivityLogPageSize] = useState(5);
  const [activityLogPosition, setActivityLogPosition] = useState({ x: 0, y: 0 });
  const [isActivityLogDragging, setIsActivityLogDragging] = useState(false);
  const [useActivityLogCustomPosition, setUseActivityLogCustomPosition] = useState(false);
  const activityLogDragRef = useRef<HTMLDivElement>(null);
  const activityLogDragStartRef = useRef({ x: 0, y: 0, initialX: 0, initialY: 0 });

  // Tab state
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');

  // Activity Log drag handlers
  const handleActivityLogDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsActivityLogDragging(true);
    setUseActivityLogCustomPosition(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    if (activityLogDragRef.current) {
      const rect = activityLogDragRef.current.getBoundingClientRect();
      activityLogDragStartRef.current = {
        x: clientX,
        y: clientY,
        initialX: rect.left,
        initialY: rect.top
      };
    }
  }, []);

  useEffect(() => {
    if (!isActivityLogDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const deltaX = clientX - activityLogDragStartRef.current.x;
      const deltaY = clientY - activityLogDragStartRef.current.y;
      
      const newX = activityLogDragStartRef.current.initialX + deltaX;
      const newY = activityLogDragStartRef.current.initialY + deltaY;
      
      const maxX = window.innerWidth - (activityLogDragRef.current?.offsetWidth || 0) - 10;
      const maxY = window.innerHeight - (activityLogDragRef.current?.offsetHeight || 0) - 10;
      
      setActivityLogPosition({
        x: Math.max(10, Math.min(maxX, newX)),
        y: Math.max(10, Math.min(maxY, newY))
      });
    };

    const handleEnd = () => {
      setIsActivityLogDragging(false);
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
  }, [isActivityLogDragging]);

  // Activity Log pagination calculations
  const activityLogTotalPages = Math.ceil(activityLogs.length / activityLogPageSize);
  const activityLogStartIndex = (activityLogPage - 1) * activityLogPageSize;
  const activityLogEndIndex = activityLogStartIndex + activityLogPageSize;
  const paginatedActivityLogs = activityLogs.slice(activityLogStartIndex, activityLogEndIndex);

  // Reset activity log page when page size changes
  useEffect(() => {
    setActivityLogPage(1);
  }, [activityLogPageSize]);

  // Auto-resize textarea when entering edit mode
  useEffect(() => {
    if (isEditing && descriptionTextareaRef.current) {
      const textarea = descriptionTextareaRef.current;
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }, [isEditing, editDescription]);

  // AI Enhancement function for description
  const enhanceDescription = async () => {
    if (!editDescription || editDescription.trim().length < 10 || isEnhancingDescription) return;

    setIsEnhancingDescription(true);
    try {
      const response = await fetch(`${API_URL}/grammar/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: editDescription,
          style: 'professional',
          context: 'Action Item description for a meeting task',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.enhancedText) {
          setEditDescription(data.data.enhancedText);
          setJustEnhancedDescription(true);
          setTimeout(() => setJustEnhancedDescription(false), 3000);
        }
      }
    } catch (err) {
      console.error('AI Enhancement error:', err);
    } finally {
      setIsEnhancingDescription(false);
    }
  };

  // Handle file selection with preview
  const handleFileSelect = (file: File | null) => {
    console.log('📁 handleFileSelect called:', file ? { name: file.name, type: file.type, size: file.size } : null);
    
    // Revoke previous preview URL to prevent memory leaks
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
    }
    
    setSelectedFile(file);
    
    if (file && file.type.startsWith('image/')) {
      const previewUrl = URL.createObjectURL(file);
      console.log('📷 Image preview created:', previewUrl);
      setFilePreview(previewUrl);
    } else {
      setFilePreview(null);
    }
  };

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
      }
    };
  }, [filePreview]);

  const fetchTask = useCallback(async () => {
    if (!actionId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/mobile/tasks/${actionId}`);
      if (response.data.success) {
        setTask(response.data.task);
      } else {
        setError(response.data.error || 'Failed to fetch action item');
      }
    } catch (err: any) {
      console.error('Error fetching task:', err);
      setError(err.response?.data?.error || 'Failed to load action item');
    } finally {
      setLoading(false);
    }
  }, [actionId]);

  const fetchOrgUsers = useCallback(async () => {
    if (!user?.organizationId) return;

    setLoadingUsers(true);
    try {
      const response = await api.get(`/mobile/tasks/users/organization/${user.organizationId}`);
      if (response.data.success) {
        setOrgUsers(response.data.users || []);
      }
    } catch (err) {
      console.error('Error fetching org users:', err);
    } finally {
      setLoadingUsers(false);
    }
  }, [user?.organizationId]);

  const fetchActivityLogs = useCallback(async () => {
    if (!actionId) return;

    setLoadingLogs(true);
    try {
      const response = await api.get(`/mobile/tasks/${actionId}/activity-logs`);
      if (response.data.success) {
        setActivityLogs(response.data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching activity logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  }, [actionId]);

  const fetchDepartments = useCallback(async () => {
    setLoadingDepartments(true);
    try {
      const response = await api.get('/facilities/departments');
      if (response.data.success) {
        setDepartments(response.data.data?.departments || []);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
    } finally {
      setLoadingDepartments(false);
    }
  }, []);

  useEffect(() => {
    fetchTask();
    fetchActivityLogs();
    fetchDepartments();
  }, [fetchTask, fetchActivityLogs, fetchDepartments]);

  useEffect(() => {
    if (showAddAssignee) {
      fetchOrgUsers();
    }
  }, [showAddAssignee, fetchOrgUsers]);

  const updateStatus = async (status: string) => {
    if (!task || !user) return;
    setUpdating(true);
    try {
      const response = await api.patch(`/mobile/tasks/${task.id}`, { status, userId: user.id });
      if (response.data.success) {
        setTask(response.data.task);
        fetchActivityLogs(); // Refresh activity logs
      }
    } catch (err) {
      console.error('Error updating status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const updatePriority = async (priority: string) => {
    if (!task || !user) return;
    setUpdating(true);
    try {
      const response = await api.patch(`/mobile/tasks/${task.id}`, { priority, userId: user.id });
      if (response.data.success) {
        setTask(response.data.task);
        fetchActivityLogs(); // Refresh activity logs
      }
    } catch (err) {
      console.error('Error updating priority:', err);
    } finally {
      setUpdating(false);
    }
  };

  const saveChanges = async () => {
    if (!task || !user) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = { userId: user.id };
      if (editTitle !== task.title) updates.title = editTitle;
      if (editDescription !== task.description) updates.description = editDescription;

      // Include start date changes
      const currentStartDate = task.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '';
      if (editStartDate !== currentStartDate) {
        updates.startDate = editStartDate ? new Date(editStartDate).toISOString() : null;
      }

      // Include due date changes
      const currentDueDate = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
      if (editDueDate !== currentDueDate) {
        updates.dueDate = editDueDate ? new Date(editDueDate).toISOString() : null;
      }

      if (Object.keys(updates).length > 1) { // > 1 because userId is always present
        const response = await api.patch(`/mobile/tasks/${task.id}`, updates);
        if (response.data.success) {
          setTask(response.data.task);
          fetchActivityLogs(); // Refresh activity logs
        }
      }
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving changes:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateProgress = async (progress: number) => {
    if (!task || !user) return;
    setUpdating(true);
    try {
      const response = await api.patch(`/mobile/tasks/${task.id}`, { progress, userId: user.id });
      if (response.data.success) {
        setTask(response.data.task);
        fetchActivityLogs(); // Refresh activity logs
      }
    } catch (err) {
      console.error('Error updating progress:', err);
    } finally {
      setUpdating(false);
    }
  };

  const toggleLock = async () => {
    if (!task || !user) return;
    setLocking(true);
    try {
      const response = await api.patch(`/mobile/tasks/${task.id}`, { 
        isLocked: !task.isLocked, 
        userId: user.id 
      });
      if (response.data.success) {
        setTask(response.data.task);
        fetchActivityLogs(); // Refresh activity logs
      }
    } catch (err: any) {
      console.error('Error toggling lock:', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      }
    } finally {
      setLocking(false);
    }
  };

  const updateDueDate = async () => {
    if (!task || !user) return;
    setSavingDueDate(true);
    try {
      const dueDate = editDueDate ? new Date(editDueDate).toISOString() : null;
      const response = await api.patch(`/mobile/tasks/${task.id}`, { 
        dueDate, 
        userId: user.id 
      });
      if (response.data.success) {
        setTask(response.data.task);
        fetchActivityLogs(); // Refresh activity logs
        setIsEditingDueDate(false);
      }
    } catch (err: any) {
      console.error('Error updating due date:', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      }
    } finally {
      setSavingDueDate(false);
    }
  };

  const updateStartDate = async () => {
    if (!task || !user) return;
    setSavingStartDate(true);
    try {
      const startDate = editStartDate ? new Date(editStartDate).toISOString() : null;
      const response = await api.patch(`/mobile/tasks/${task.id}`, { 
        startDate, 
        userId: user.id 
      });
      if (response.data.success) {
        setTask(response.data.task);
        fetchActivityLogs();
        setIsEditingStartDate(false);
      }
    } catch (err: any) {
      console.error('Error updating start date:', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      }
    } finally {
      setSavingStartDate(false);
    }
  };

  const updateDepartment = async (departmentId: string | null) => {
    if (!task || !user) return;
    setSavingDepartment(true);
    try {
      const response = await api.patch(`/mobile/tasks/${task.id}`, { 
        departmentId, 
        userId: user.id 
      });
      if (response.data.success) {
        setTask(response.data.task);
        fetchActivityLogs();
        setIsEditingDepartment(false);
      }
    } catch (err: any) {
      console.error('Error updating department:', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      }
    } finally {
      setSavingDepartment(false);
    }
  };

  const updateCompletionDetails = async () => {
    if (!task || !user) return;
    if (!editCompletedDate && !editCompletedTime) return;
    
    setSavingCompletion(true);
    try {
      // Get current values or use edited ones
      const currentDate = task.completedAt ? new Date(task.completedAt).toISOString().split('T')[0] : '';
      const currentTime = task.completedAt ? new Date(task.completedAt).toTimeString().slice(0, 5) : '12:00';
      
      const finalDate = editCompletedDate || currentDate;
      const finalTime = editCompletedTime || currentTime;
      
      if (!finalDate) {
        alert('Please enter a completion date');
        setSavingCompletion(false);
        return;
      }
      
      // Combine date and time into a single datetime
      const dateTime = new Date(`${finalDate}T${finalTime}:00`);
      
      const response = await api.patch(`/mobile/tasks/${task.id}`, { 
        completedAt: dateTime.toISOString(),
        userId: user.id 
      });
      if (response.data.success) {
        setTask(response.data.task);
        setEditCompletedDate('');
        setEditCompletedTime('');
        fetchActivityLogs();
      }
    } catch (err: any) {
      console.error('Error updating completion details:', err);
      if (err.response?.data?.error) {
        alert(err.response.data.error);
      }
    } finally {
      setSavingCompletion(false);
    }
  };

  const addAssignee = async (userId: string) => {
    if (!task || !user) return;
    setAddingAssignee(true);
    try {
      const response = await api.post(`/mobile/tasks/${task.id}/assignees`, {
        userIds: [userId],
        assignedBy: user.id,
      });
      if (response.data.success) {
        await fetchTask();
        fetchActivityLogs(); // Refresh activity logs
        setShowAddAssignee(false);
      }
    } catch (err) {
      console.error('Error adding assignee:', err);
    } finally {
      setAddingAssignee(false);
    }
  };

  const removeAssignee = async (userId: string) => {
    if (!task || !user) return;
    setRemovingAssignee(true);
    try {
      await api.delete(`/mobile/tasks/${task.id}/assignees/${userId}?removedBy=${user.id}`);
      await fetchTask();
      fetchActivityLogs(); // Refresh activity logs
      setShowRemoveAssigneeConfirm(false);
      setAssigneeToRemove(null);
    } catch (err) {
      console.error('Error removing assignee:', err);
    } finally {
      setRemovingAssignee(false);
    }
  };

  const addComment = async () => {
    if (!task || !user || !newComment.trim()) return;
    setAddingComment(true);
    try {
      const response = await api.post(`/mobile/tasks/${task.id}/comments`, {
        content: newComment.trim(),
        authorId: user.id,
      });
      if (response.data.success) {
        await fetchTask();
        setNewComment('');
        setShowAddComment(false);
        fetchActivityLogs(); // Refresh activity logs
      }
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setAddingComment(false);
    }
  };

  const addEvidence = async () => {
    console.log('🔍 addEvidence called with:', { 
      hasTask: !!task, 
      hasUser: !!user, 
      title: evidenceTitle, 
      selectedFile: selectedFile ? { name: selectedFile.name, type: selectedFile.type, size: selectedFile.size } : null 
    });
    
    if (!task || !user || !evidenceTitle.trim()) {
      console.log('❌ Early return - missing required fields');
      return;
    }
    setUploadingEvidence(true);
    setUploadProgress(0);
    setUploadError(null);
    
    try {
      let fileUrl: string | null = null;
      let fileType: string | null = null;
      let fileName: string | null = null;

      // Upload file to Firebase Storage if selected
      if (selectedFile) {
        fileType = selectedFile.type;
        fileName = selectedFile.name;
        
        console.log('📤 Starting Firebase upload:', { fileName, fileType, size: selectedFile.size });
        
        // Create unique path in Firebase Storage
        const storagePath = `task-evidence/${task.id}/${Date.now()}_${selectedFile.name}`;
        const storageRef = ref(storage, storagePath);
        
        // Upload with progress tracking
        const uploadTask = uploadBytesResumable(storageRef, selectedFile);
        
        // Wait for upload to complete
        fileUrl = await new Promise<string>((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(Math.round(progress));
              console.log('📤 Upload progress:', Math.round(progress) + '%');
            },
            (error) => {
              console.error('❌ Firebase upload error:', error);
              reject(error);
            },
            async () => {
              try {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                console.log('✅ Firebase upload complete, URL:', downloadURL);
                resolve(downloadURL);
              } catch (err) {
                console.error('❌ Error getting download URL:', err);
                reject(err);
              }
            }
          );
        });
      }

      console.log('📤 Sending evidence to backend:', { title: evidenceTitle, fileUrl, fileType, fileName });
      
      const response = await api.post(`/mobile/tasks/${task.id}/evidence`, {
        title: evidenceTitle.trim(),
        description: evidenceDescription.trim() || null,
        fileUrl,
        fileType,
        fileName,
        uploaderId: user.id,
      });

      console.log('📤 Backend response:', response.data);

      if (response.data.success) {
        await fetchTask();
        setEvidenceTitle('');
        setEvidenceDescription('');
        handleFileSelect(null);
        setUploadProgress(0);
        setShowAddEvidence(false);
        fetchActivityLogs(); // Refresh activity logs
      } else {
        setUploadError(response.data.error || 'Failed to save evidence');
      }
    } catch (err: any) {
      console.error('❌ Error adding evidence:', err);
      setUploadError(err.message || 'Failed to upload evidence');
    } finally {
      setUploadingEvidence(false);
      setUploadProgress(0);
    }
  };

  const deleteEvidence = async (evidenceId: string) => {
    setDeletingEvidenceId(evidenceId);
    try {
      const response = await api.delete(`/mobile/tasks/evidence/${evidenceId}?userId=${user?.id}`);
      if (response.data.success) {
        await fetchTask();
        fetchActivityLogs(); // Refresh activity logs
      }
    } catch (err) {
      console.error('Error deleting evidence:', err);
    } finally {
      setDeletingEvidenceId(null);
      setShowDeleteConfirm(false);
      setEvidenceToDelete(null);
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
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-purple-200 dark:border-purple-900/50" />
            <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-purple-600 border-r-purple-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-purple-600 animate-pulse" />
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Loading action item details...</p>
          <div className="flex items-center gap-1.5 mt-6">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">{error || 'Action item not found'}</p>
          <Link href="/assigned-actions" className="mt-4 inline-block text-purple-600 hover:underline">
            ← Back to My Action Items
          </Link>
        </div>
      </div>
    );
  }

  const isOverdue = task.status !== 'COMPLETED' && task.dueDate && new Date(task.dueDate) < new Date();
  const daysOverdue = task.dueDate ? getDaysOverdue(task.dueDate) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="px-6 lg:px-10">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link
                href="/assigned-actions"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Action Item</h1>
            </div>
            <div className="flex items-center gap-3">
              {updating && <Loader2 className="w-5 h-5 animate-spin text-purple-600" />}
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditTitle(task?.title || '');
                      setEditDescription(task?.description || '');
                      setEditStartDate('');
                      setEditDueDate('');
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveChanges}
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save
                  </button>
                </div>
              ) : !isReadOnly ? (
                <div className="flex items-center gap-2">
                  {/* Lock/Unlock Button */}
                  <button
                    onClick={toggleLock}
                    disabled={locking}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      task.isLocked === true
                        ? 'bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700'
                        : 'border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    title={task.isLocked === true ? 'Unlock this action item' : 'Lock this action item'}
                  >
                    {locking ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : task.isLocked === true ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <Unlock className="w-4 h-4" />
                    )}
                    {task.isLocked === true ? 'Locked' : 'Lock'}
                  </button>
                  {/* Edit Button - disabled when locked */}
                  <button
                    onClick={() => {
                      setEditTitle(task?.title || '');
                      setEditDescription(task?.description || '');
                      setEditStartDate(task?.startDate ? new Date(task.startDate).toISOString().split('T')[0] : '');
                      setEditDueDate(task?.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
                      setIsEditing(true);
                    }}
                    disabled={task.isLocked === true}
                    className={`inline-flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 text-sm font-medium rounded-lg transition-colors ${
                      task.isLocked === true
                        ? 'opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-500'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    title={task.isLocked === true ? 'Unlock the task to edit' : 'Edit this action item'}
                  >
                    <Pencil className="w-4 h-4" />
                    Edit
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-6 lg:px-10">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('details')}
              className={`relative py-4 text-sm font-medium transition-colors ${
                activeTab === 'details'
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Details
              {activeTab === 'details' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`relative py-4 text-sm font-medium transition-colors ${
                activeTab === 'activity'
                  ? 'text-purple-600 dark:text-purple-400'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4" />
                Activity Log
                {activityLogs.length > 0 && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                    {activityLogs.length}
                  </span>
                )}
              </span>
              {activeTab === 'activity' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400 rounded-full" />
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="px-6 lg:px-10 py-8">
        {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status & Priority Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              {/* Locked Banner */}
              {task.isLocked && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm text-amber-700 dark:text-amber-300">
                    This action item is locked and cannot be modified.
                    {task.lockedBy && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">
                        Locked by {task.lockedBy.firstName} {task.lockedBy.lastName}
                        {task.lockedAt && ` on ${new Date(task.lockedAt).toLocaleString()}`}
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 mb-6">
                {/* Status Dropdown */}
                <div className="relative">
                  <select
                    value={task.status}
                    onChange={(e) => updateStatus(e.target.value)}
                    disabled={updating || task.isLocked}
                    className={`appearance-none px-4 py-2 pr-10 rounded-full text-sm font-semibold cursor-pointer transition-colors ${
                      task.status === 'COMPLETED'
                        ? 'bg-green-500 text-white'
                        : task.status === 'IN_PROGRESS'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                    } ${task.isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Priority Dropdown */}
                <div className="relative">
                  <select
                    value={task.priority}
                    onChange={(e) => updatePriority(e.target.value)}
                    disabled={updating || task.isLocked || isReadOnly}
                    className={`appearance-none px-4 py-2 pr-10 rounded-full text-sm font-semibold cursor-pointer transition-colors ${
                      task.priority === 'URGENT'
                        ? 'bg-red-500 text-white'
                        : task.priority === 'HIGH'
                        ? 'bg-orange-500 text-white'
                        : task.priority === 'MEDIUM'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                    } ${(task.isLocked || isReadOnly) ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                  {!isReadOnly && <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />}
                </div>
              </div>

              {/* Title */}
              {isEditing ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-2xl font-bold text-gray-900 dark:text-white mb-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Action item title"
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {task.title}
                </h2>
              )}

              {/* Description */}
              {isEditing ? (
                <div className="relative mb-4">
                  {/* AI Enhancement Button */}
                  <div 
                    className={`absolute -top-1 right-0 z-10 transition-all duration-300 ease-out ${editDescription && editDescription.trim().length >= 10 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}`}
                  >
                    <button
                      type="button"
                      onClick={enhanceDescription}
                      disabled={isEnhancingDescription || editDescription.trim().length < 10}
                      title={justEnhancedDescription ? 'Text enhanced!' : 'DashMet AI - Enhance text'}
                      className={`
                        group/btn relative flex items-center justify-center
                        h-7 rounded-full overflow-hidden
                        transition-all duration-300 ease-out
                        shadow-md hover:shadow-lg hover:shadow-emerald-500/30
                        transform hover:scale-105 active:scale-95
                        disabled:cursor-not-allowed
                        ${justEnhancedDescription
                          ? 'bg-gradient-to-br from-emerald-400 to-green-600 w-7'
                          : 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 hover:from-emerald-400 hover:via-green-400 hover:to-teal-500 w-7 hover:w-[85px]'
                        }
                        ${isEnhancingDescription ? 'w-7' : ''}
                      `}
                    >
                      <span className="relative z-10 flex items-center justify-center gap-1.5 px-1.5">
                        {isEnhancingDescription ? (
                          <Loader2 className="w-4 h-4 text-white animate-spin flex-shrink-0" />
                        ) : justEnhancedDescription ? (
                          <Check className="w-4 h-4 text-white flex-shrink-0" />
                        ) : (
                          <>
                            <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                              <span className="text-[8px] font-bold text-white tracking-tight select-none">DM</span>
                            </span>
                            <span className="text-[10px] font-semibold text-white whitespace-nowrap overflow-hidden w-0 group-hover/btn:w-[45px] transition-all duration-300 ease-out opacity-0 group-hover/btn:opacity-100">
                              Enhance
                            </span>
                          </>
                        )}
                      </span>
                      {!isEnhancingDescription && !justEnhancedDescription && (
                        <>
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-75 group-hover/btn:opacity-0 transition-opacity" />
                          <span className="absolute -top-0.5 -right-0.5 w-1 h-1 bg-white rounded-full group-hover/btn:opacity-0 transition-opacity" />
                        </>
                      )}
                    </button>
                  </div>
                  <div className="relative">
                    <textarea
                      ref={descriptionTextareaRef}
                      value={editDescription}
                      onChange={(e) => {
                        setEditDescription(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                      }}
                      rows={1}
                      className={`w-full text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none overflow-hidden transition-all ${justEnhancedDescription ? 'ring-2 ring-green-400 border-green-400' : ''} ${isEnhancingDescription ? 'bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20' : ''}`}
                      placeholder="Description (optional)"
                      style={{ minHeight: '42px' }}
                    />
                    {isEnhancingDescription && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 overflow-hidden rounded-t-lg">
                        <div className="h-full w-full bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500 animate-pulse" />
                      </div>
                    )}
                  </div>
                </div>
              ) : task.description ? (
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {task.description}
                </p>
              ) : null}

              {/* Start Date Field */}
              <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Start Date</span>
                </div>
                {isEditing ? (
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    title="Start date"
                    className="mt-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {task.startDate
                      ? new Date(task.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                      : 'Not set'}
                  </p>
                )}
              </div>

              {/* Due Date Field */}
              <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Due Date</span>
                </div>
                {isEditing ? (
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    title="Due date"
                    className="mt-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                ) : (
                  <p className={`text-sm font-medium mt-1 ${task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                      : 'Not set'}
                  </p>
                )}
              </div>

              {/* Overdue Indicator */}
              {isOverdue && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">{daysOverdue}d overdue</span>
                </div>
              )}
            </div>

            {/* Progress Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-purple-600 rounded" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Progress</h3>
                </div>
                <span className={`text-lg font-bold ${
                  task.progress <= 20 ? 'text-red-500' :
                  task.progress <= 50 ? 'text-yellow-500' :
                  task.progress <= 80 ? 'text-green-500' : 'text-blue-500'
                }`}>{task.progress}%</span>
              </div>

              {/* Progress Bar - colors appear at their range positions: Red 0-20%, Yellow 20-50%, Green 50-80%, Blue 80-100% */}
              <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full mb-4 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
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

              {/* Progress Buttons - 5% increments in scrollable container */}
              <div className="overflow-x-auto pb-2 -mx-2 px-2">
                <div className="flex gap-1.5 min-w-max">
                  {Array.from({ length: 21 }, (_, i) => i * 5).map((value) => (
                    <button
                      key={value}
                      onClick={() => updateProgress(value)}
                      disabled={updating || task.isLocked}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        task.progress === value
                          ? value <= 20 ? 'bg-red-500 text-white ring-2 ring-red-300'
                          : value <= 50 ? 'bg-yellow-500 text-white ring-2 ring-yellow-300'
                          : value <= 80 ? 'bg-green-500 text-white ring-2 ring-green-300'
                          : 'bg-blue-500 text-white ring-2 ring-blue-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      } ${task.isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Completion Section - shown when task is 100% and COMPLETED */}
            {task.progress === 100 && task.status === 'COMPLETED' && task.completedAt && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-green-700 dark:text-green-300">Completion Details</h3>
                  </div>
                  {task.isLocked !== true && (editCompletedDate || editCompletedTime) && (
                    <button
                      onClick={updateCompletionDetails}
                      disabled={savingCompletion}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all active:scale-95"
                    >
                      {savingCompletion ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          Save Changes
                        </>
                      )}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Completed Date</span>
                    </div>
                    <input
                      type="date"
                      value={editCompletedDate || (task.completedAt ? new Date(task.completedAt).toISOString().split('T')[0] : '')}
                      onChange={(e) => setEditCompletedDate(e.target.value)}
                      disabled={task.isLocked === true}
                      className="w-full text-sm font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer hover:border-green-400"
                    />
                  </div>
                  <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Completed Time</span>
                    </div>
                    <input
                      type="time"
                      value={editCompletedTime || (task.completedAt ? new Date(task.completedAt).toTimeString().slice(0, 5) : '')}
                      onChange={(e) => setEditCompletedTime(e.target.value)}
                      disabled={task.isLocked === true}
                      className="w-full text-sm font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer hover:border-green-400"
                    />
                  </div>
                  <div className="flex-1 min-w-[160px] bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <User className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Completed By</span>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white px-3 py-2">
                      {task.completedBy 
                        ? `${task.completedBy.firstName} ${task.completedBy.lastName}`
                        : `${task.owner.firstName} ${task.owner.lastName}`}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Extracted From Section */}
            {task.sourceText && (
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200 dark:border-purple-700/50 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-700 dark:text-purple-300">Extracted From</h3>
                </div>
                <p className="text-gray-700 dark:text-gray-300 italic bg-white/50 dark:bg-gray-800/50 rounded-lg p-4">
                  "{task.sourceText}"
                </p>
              </div>
            )}

            {/* Comments Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-orange-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Comments</h3>
                </div>
                <button
                  onClick={() => setShowAddComment(true)}
                  disabled={task.isLocked === true}
                  className={`inline-flex items-center gap-1 text-sm font-medium ${task.isLocked === true ? 'text-gray-400 cursor-not-allowed' : 'text-purple-600 hover:text-purple-700'}`}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {/* Add Comment Form */}
              {showAddComment && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={3}
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button
                      onClick={() => { setShowAddComment(false); setNewComment(''); }}
                      className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addComment}
                      disabled={addingComment || !newComment.trim()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {addingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Post
                    </button>
                  </div>
                </div>
              )}

              {/* Comments List */}
              {task.comments.length > 0 ? (
                <div className="space-y-3">
                  {task.comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <User className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {comment.author.firstName} {comment.author.lastName}
                          </span>
                          <span className="text-xs text-gray-500 ml-2">
                            {formatDate(comment.createdAt)}
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 text-sm ml-10">
                        {comment.content}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-6">No comments yet</p>
              )}
            </div>

            {/* Evidence & Attachments Section */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Evidence & Attachments</h3>
                </div>
                <button
                  onClick={() => setShowAddEvidence(true)}
                  disabled={task.isLocked === true}
                  className={`inline-flex items-center gap-1 text-sm font-medium ${task.isLocked === true ? 'text-gray-400 cursor-not-allowed' : 'text-purple-600 hover:text-purple-700'}`}
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>

              {/* Add Evidence Form */}
              {showAddEvidence && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <input
                    type="text"
                    value={evidenceTitle}
                    onChange={(e) => setEvidenceTitle(e.target.value)}
                    placeholder="Evidence title"
                    className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <textarea
                    value={evidenceDescription}
                    onChange={(e) => setEvidenceDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-3 py-2 mb-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    rows={2}
                  />
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Upload className="w-4 h-4" />
                      {selectedFile ? selectedFile.name : 'Attach file'}
                    </button>
                    {selectedFile && (
                      <button onClick={() => handleFileSelect(null)} className="text-gray-500 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {/* Image Preview Thumbnail */}
                  {filePreview && (
                    <div className="mb-3 relative inline-block">
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="max-w-full max-h-64 object-contain rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                      />
                      <button
                        onClick={() => handleFileSelect(null)}
                        className="absolute top-2 right-2 p-1 bg-black/50 hover:bg-black/70 rounded-full text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                  
                  {/* Upload Progress Bar */}
                  {uploadingEvidence && uploadProgress > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <span>Uploading...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-600 transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Upload Error Display */}
                  {uploadError && (
                    <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-sm rounded-lg">
                      {uploadError}
                    </div>
                  )}
                  
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => { setShowAddEvidence(false); setEvidenceTitle(''); setEvidenceDescription(''); handleFileSelect(null); setUploadProgress(0); setUploadError(null); }}
                      className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addEvidence}
                      disabled={uploadingEvidence || !evidenceTitle.trim()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {uploadingEvidence ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      Add Evidence
                    </button>
                  </div>
                </div>
              )}

              {/* Evidence List */}
              {task.evidence.length > 0 ? (
                <div className="flex flex-wrap gap-4">
                  {task.evidence.map((item) => {
                    // Check if item is an image by fileType, fileName extension, or URL patterns
                    const isImage = 
                      item.fileType?.startsWith('image') ||
                      /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(item.fileName || '') ||
                      /\.(jpg|jpeg|png|gif|webp|bmp|svg)/i.test(item.fileUrl || '') ||
                      // Firebase storage URLs with image extensions
                      (item.fileUrl && item.fileUrl.includes('firebasestorage') && /\.(jpg|jpeg|png|gif|webp)/i.test(item.fileUrl));
                    
                    return (
                      <div key={item.id} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg overflow-hidden relative group inline-block">
                        {/* Delete button - hidden when locked */}
                        {task.isLocked !== true && (
                          <button
                            onClick={() => {
                              setEvidenceToDelete(item.id);
                              setShowDeleteConfirm(true);
                            }}
                            disabled={deletingEvidenceId === item.id}
                            className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg disabled:opacity-50"
                            title="Delete evidence"
                          >
                            {deletingEvidenceId === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <X className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        
                        {/* Image Preview - natural size, no stretching */}
                        {isImage && item.fileUrl ? (
                          <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                            <img 
                              src={item.fileUrl} 
                              alt={item.title} 
                              className="max-w-full h-auto rounded-t-lg hover:opacity-90 transition-opacity"
                              style={{ maxHeight: '280px' }}
                              onError={(e) => {
                                // Hide img on error and show fallback
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                            <div className="hidden w-full h-32 bg-gray-200 dark:bg-gray-700 flex items-center justify-center rounded-lg">
                              <FileText className="w-12 h-12 text-gray-400" />
                            </div>
                          </a>
                        ) : (
                          <div className="w-full h-32 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                            <FileText className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                        
                        {/* Details */}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white text-sm truncate">{item.title}</p>
                              {item.description && (
                                <p className="text-xs text-gray-500 truncate mt-1">{item.description}</p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                by {item.uploader.firstName} {item.uploader.lastName}
                              </p>
                              {!item.fileUrl && (
                                <p className="text-xs text-orange-500 mt-1">No file attached</p>
                              )}
                            </div>
                            {item.fileUrl && (
                              <a
                                href={item.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg flex-shrink-0"
                              >
                                <Download className="w-4 h-4 text-gray-500" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !showAddEvidence ? (
                <div
                  onClick={() => task.isLocked !== true && setShowAddEvidence(true)}
                  className={`w-full text-center py-8 rounded-lg transition-colors ${task.isLocked === true ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer'}`}
                >
                  <div className="w-16 h-16 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">No evidence attached</p>
                  <p className="text-gray-400 text-xs mt-1">{task.isLocked === true ? 'Unlock to attach photos or files' : 'Click to attach photos or files'}</p>
                </div>
              ) : null}
              
              {/* Delete Confirmation Dialog */}
              {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete Evidence</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-4">Are you sure you want to delete this evidence? This action cannot be undone.</p>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => { setShowDeleteConfirm(false); setEvidenceToDelete(null); }}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => evidenceToDelete && deleteEvidence(evidenceToDelete)}
                        disabled={deletingEvidenceId !== null}
                        className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {deletingEvidenceId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Remove Assignee Confirmation Dialog */}
              {showRemoveAssigneeConfirm && assigneeToRemove && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setShowRemoveAssigneeConfirm(false); setAssigneeToRemove(null); }}>
                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remove User</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                      Are you sure you want to remove <strong>{assigneeToRemove.firstName} {assigneeToRemove.lastName}</strong> from this action item?
                    </p>
                    <p className="text-gray-500 dark:text-gray-500 text-sm mb-4">
                      They will no longer have access to this action item. You can always re-add them at any time.
                    </p>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => { setShowRemoveAssigneeConfirm(false); setAssigneeToRemove(null); }}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => removeAssignee(assigneeToRemove.userId)}
                        disabled={removingAssignee}
                        className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        {removingAssignee ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Confirm Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Responsible Parties */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Responsible Parties</h3>
                </div>
                {user?.id === task.owner.id && (
                  <button
                    onClick={() => setShowAddAssignee(true)}
                    disabled={task.isLocked === true}
                    className={`inline-flex items-center gap-1 text-sm font-medium ${task.isLocked === true ? 'text-gray-400 cursor-not-allowed' : 'text-purple-600 hover:text-purple-700'}`}
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                )}
              </div>

              {task.assignees.length > 0 ? (
                <div className="space-y-3">
                  {task.assignees.map((assignee) => (
                    <div key={assignee.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        {assignee.user.profilePicture ? (
                          <img
                            src={assignee.user.profilePicture}
                            alt={`${assignee.user.firstName} ${assignee.user.lastName}`}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                              {getInitials(assignee.user.firstName, assignee.user.lastName, assignee.user.email)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-sm">
                            {assignee.user.firstName} {assignee.user.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{assignee.user.email}</p>
                        </div>
                      </div>
                      {task.isLocked !== true && user?.id === task.owner.id && (
                        <button
                          onClick={() => {
                            setAssigneeToRemove({
                              userId: assignee.userId,
                              firstName: assignee.user.firstName,
                              lastName: assignee.user.lastName,
                              email: assignee.user.email
                            });
                            setShowRemoveAssigneeConfirm(true);
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          <X className="w-4 h-4 text-gray-400 hover:text-red-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto mb-2 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-sm">No assignees yet</p>
                  <p className="text-gray-400 text-xs mt-1">Tap + Add to assign responsible parties</p>
                </div>
              )}
            </div>

            {/* Responsible Department */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">Responsible Department</h3>
                </div>
                {task.isLocked !== true && !isEditingDepartment && (
                  <button
                    onClick={() => setIsEditingDepartment(true)}
                    className="p-1 text-gray-400 hover:text-purple-600 rounded"
                    title="Edit department"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isEditingDepartment ? (
                <div className="space-y-3">
                  <div className="relative">
                    <select
                      value={task.departmentId || ''}
                      onChange={(e) => updateDepartment(e.target.value || null)}
                      disabled={savingDepartment || loadingDepartments}
                      title="Select department"
                      className="w-full appearance-none px-3 py-2.5 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                    >
                      <option value="">No department</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                  {savingDepartment && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </div>
                  )}
                  <button
                    onClick={() => setIsEditingDepartment(false)}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <Building className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {task.department?.name || 'Not assigned'}
                    </p>
                    {!task.department && (
                      <p className="text-xs text-gray-400 mt-0.5">Click edit to assign a department</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Details</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <User className="w-4 h-4" />
                    <span className="text-sm">Owner</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {task.owner.firstName} {task.owner.lastName}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Created</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(task.createdAt)}
                  </span>
                </div>

                {task.dueDate && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">Due Date</span>
                    </div>
                    <span className={`text-sm font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                      {new Date(task.dueDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                )}

                {task.startDate && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">Start Date</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(task.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                )}

                {task.department && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Building className="w-4 h-4" />
                      <span className="text-sm">Department</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {task.department.name}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <MessageSquare className="w-4 h-4" />
                    <span className="text-sm">Comments</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {task.comments.length}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm">Evidence</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {task.evidence.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Activity Log Tab */}
        {activeTab === 'activity' && (
          <div className="w-full">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-2 mb-6">
                <History className="w-6 h-6 text-purple-500" />
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Activity Log</h2>
                <span className="ml-2 px-2.5 py-0.5 text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                  {activityLogs.length} {activityLogs.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>

              {loadingLogs ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                </div>
              ) : activityLogs.length > 0 ? (
                <div className="space-y-4">
                  {paginatedActivityLogs.map((log) => (
                    <div key={log.id} className="border-l-2 border-purple-200 dark:border-purple-800 pl-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-r-lg transition-colors">
                      <div className="flex items-start gap-3">
                        {log.user.profilePicture ? (
                          <img
                            src={log.user.profilePicture}
                            alt={`${log.user.firstName} ${log.user.lastName}`}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 mt-0.5"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                              {getInitials(log.user.firstName, log.user.lastName, log.user.email)}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {getActionDescription(log)}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                            <span>{formatActivityDate(log.createdAt)}</span>
                            <span>•</span>
                            <span>{formatActivityTime(log.createdAt)}</span>
                          </div>
                          {/* Show previous/new values for certain actions */}
                          {(log.action === 'UPDATE_TITLE' || log.action === 'UPDATE_DESCRIPTION') && log.previousValue && (
                            <div className="mt-3 text-sm">
                              <div className="text-gray-400 mb-1.5 text-xs font-medium">Previous value:</div>
                              <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg line-through">
                                {log.previousValue.substring(0, 200)}{log.previousValue.length > 200 ? '...' : ''}
                              </div>
                              {log.newValue && (
                                <>
                                  <div className="text-gray-400 mb-1.5 mt-3 text-xs font-medium">New value:</div>
                                  <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-3 py-2 rounded-lg">
                                    {log.newValue.substring(0, 200)}{log.newValue.length > 200 ? '...' : ''}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <History className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 text-base font-medium">No activity yet</p>
                  <p className="text-gray-400 text-sm mt-1">Changes to this action item will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Activity Log Draggable Pagination */}
        {activeTab === 'activity' && !loadingLogs && activityLogs.length > 0 && (
          <div
            ref={activityLogDragRef}
            className={`fixed bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl z-40 select-none ${
              isActivityLogDragging ? 'cursor-grabbing' : ''
            }`}
            style={{
              ...(useActivityLogCustomPosition
                ? { left: activityLogPosition.x, top: activityLogPosition.y, right: 'auto', bottom: 'auto', transform: 'none' }
                : { bottom: '24px', left: '50%', transform: 'translateX(-50%)' }),
              transition: isActivityLogDragging ? 'none' : 'box-shadow 0.2s ease',
              boxShadow: isActivityLogDragging ? '0 25px 50px -12px rgba(0, 0, 0, 0.35)' : undefined,
            }}
          >
            <div className="px-4 py-3 flex items-center gap-4">
              {/* Drag Handle */}
              <div
                onMouseDown={handleActivityLogDragStart}
                onTouchStart={handleActivityLogDragStart}
                onDoubleClick={() => setUseActivityLogCustomPosition(false)}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Drag to move • Double-click to reset"
              >
                <GripVertical className="w-5 h-5 text-gray-400" />
              </div>
              {/* Page Size Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Rows per page:</span>
                <select
                  value={activityLogPageSize}
                  onChange={(e) => setActivityLogPageSize(Number(e.target.value))}
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
                Showing {activityLogStartIndex + 1}-{Math.min(activityLogEndIndex, activityLogs.length)} of {activityLogs.length} entries
              </div>

              {/* Page Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActivityLogPage(1)}
                  disabled={activityLogPage === 1}
                  className="p-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="First page"
                >
                  First
                </button>
                <button
                  onClick={() => setActivityLogPage(p => Math.max(1, p - 1))}
                  disabled={activityLogPage === 1}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <span className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Page {activityLogPage} of {activityLogTotalPages}
                </span>
                <button
                  onClick={() => setActivityLogPage(p => Math.min(activityLogTotalPages, p + 1))}
                  disabled={activityLogPage === activityLogTotalPages}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => setActivityLogPage(activityLogTotalPages)}
                  disabled={activityLogPage === activityLogTotalPages}
                  className="p-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Last page"
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Assignee Modal */}
      {showAddAssignee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddAssignee(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add Assignee</h3>
              <button onClick={() => setShowAddAssignee(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto">
              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                </div>
              ) : orgUsers.length > 0 ? (
                <div className="space-y-2">
                  {orgUsers
                    .filter((u) => u.id !== user?.id && !task.assignees.some((a) => a.userId === u.id))
                    .map((orgUser) => (
                      <button
                        key={orgUser.id}
                        onClick={() => addAssignee(orgUser.id)}
                        disabled={addingAssignee}
                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors text-left"
                      >
                        {orgUser.profilePicture ? (
                          <img
                            src={orgUser.profilePicture}
                            alt={`${orgUser.firstName} ${orgUser.lastName}`}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                            <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                              {getInitials(orgUser.firstName, orgUser.lastName, orgUser.email)}
                            </span>
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {orgUser.firstName} {orgUser.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{orgUser.email}</p>
                        </div>
                      </button>
                    ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-8">No users available</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActionItemDetailPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={null}>
        <ActionItemDetailContent />
      </Suspense>
    </ProtectedRoute>
  );
}
