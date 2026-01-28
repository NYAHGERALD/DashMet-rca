'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Mic2, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Loader2,
  Circle,
  ArrowRight,
  Square,
  Pencil,
  Type,
  Eraser,
  Undo,
  Trash2,
  Flag,
  CheckCircle,
  Target,
  MessageSquare,
  Bookmark,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw,
  History,
  GripHorizontal
} from 'lucide-react';
import api from '@/lib/api';
import { useWebSocket } from '@/lib/websocket';
import AnnotationCanvas, { Annotation, ViewState } from './AnnotationCanvas';
import DiscussionHistory from './DiscussionHistory';

interface Evidence {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'VOICE_RECORDING';
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt?: string;
  fmirId?: string; // Present if this is FMIR evidence
}

interface SpotlightState {
  isActive: boolean;
  evidenceId: string | null;
  spotlightId: string | null;
  presentedBy: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  } | null;
  startedAt: Date | null;
}

interface DiscussionMarker {
  id: string;
  markerType: string;
  title: string;
  description?: string;
  evidenceId?: string;
  createdBy: { firstName: string; lastName: string };
  timestamp: Date;
  callOffset?: number;
}

interface EvidenceSpotlightPanelProps {
  incidentId: string;
  roomName: string;
  userId: string;
  isExpanded: boolean;
  onToggle: () => void;
  callStartTime?: Date;
}

const markerTypes = [
  { type: 'evidence_discussed', label: 'Evidence Discussed', icon: Eye, color: 'text-blue-500' },
  { type: 'decision_made', label: 'Decision Made', icon: CheckCircle, color: 'text-green-500' },
  { type: 'action_assigned', label: 'Action Assigned', icon: Target, color: 'text-orange-500' },
  { type: 'root_cause_identified', label: 'Root Cause Found', icon: Flag, color: 'text-red-500' },
  { type: 'custom', label: 'Note', icon: MessageSquare, color: 'text-purple-500' },
];

export default function EvidenceSpotlightPanel({
  incidentId,
  roomName,
  userId,
  isExpanded,
  onToggle,
  callStartTime
}: EvidenceSpotlightPanelProps) {
  // Get socket and joinIncident from WebSocket context
  const { socket, joinIncident, isConnected } = useWebSocket();
  
  // Join the incident room when component mounts and on reconnection to receive broadcasts
  useEffect(() => {
    if (!socket || !incidentId) return;
    
    const handleJoinRoom = () => {
      console.log('🔌 [EvidenceSpotlight] Joining incident room:', incidentId, 'connected:', socket.connected);
      if (socket.connected) {
        socket.emit('incident:join', incidentId);
      }
    };
    
    const handleJoinConfirm = (data: { incidentId: string; roomName: string; success: boolean }) => {
      console.log('✅ [EvidenceSpotlight] Joined room successfully:', data.roomName);
    };
    
    // Join immediately if already connected
    if (socket.connected) {
      handleJoinRoom();
    }
    
    // Also join on connect/reconnect
    socket.on('connect', handleJoinRoom);
    socket.on('incident:joined', handleJoinConfirm);
    
    return () => {
      socket.off('connect', handleJoinRoom);
      socket.off('incident:joined', handleJoinConfirm);
    };
  }, [socket, incidentId]);
  
  // Ref to track blob URLs for cleanup
  const blobUrlsRef = useRef<string[]>([]);
  
  // Evidence state
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, string>>({}); // Loaded blob URLs
  const [loadingEvidence, setLoadingEvidence] = useState<Record<string, boolean>>({});

  // Spotlight state
  const [spotlight, setSpotlight] = useState<SpotlightState>({
    isActive: false,
    evidenceId: null,
    spotlightId: null,
    presentedBy: null,
    startedAt: null
  });
  const [isPresenting, setIsPresenting] = useState(false);

  // Annotations state
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [currentTool, setCurrentTool] = useState<'circle' | 'arrow' | 'rectangle' | 'freehand' | 'text' | null>(null);
  const [currentColor, setCurrentColor] = useState('#FF0000');
  const [canUndo, setCanUndo] = useState(false);
  
  // Zoom/Pan state for synchronized viewing
  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  
  // Discussion markers state
  const [markers, setMarkers] = useState<DiscussionMarker[]>([]);
  const [showMarkerModal, setShowMarkerModal] = useState(false);
  const [newMarkerTitle, setNewMarkerTitle] = useState('');
  const [newMarkerType, setNewMarkerType] = useState('evidence_discussed');
  const [newMarkerDescription, setNewMarkerDescription] = useState('');
  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [showDiscussionHistory, setShowDiscussionHistory] = useState(false);

  // Navigation
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'gallery' | 'spotlight'>('gallery');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Drag state
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const positionStartRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const historyRef = useRef<Annotation[][]>([[]]);
  const historyIndexRef = useRef(0);

  // Drag handlers - using refs to avoid stale closures
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isFullscreen) return;
    
    // Prevent text selection and default behavior
    e.preventDefault();
    e.stopPropagation();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartRef.current = { x: clientX, y: clientY };
    positionStartRef.current = { x: position.x, y: position.y };
    isDraggingRef.current = true;
    setIsDragging(true);
  }, [isFullscreen, position]);

  // Use refs to get latest position without re-creating handlers
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) return;
      
      e.preventDefault();
      
      let clientX: number, clientY: number;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else {
        return;
      }
      
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      
      // Calculate new position (inverted because we're using bottom/right positioning)
      const newX = positionStartRef.current.x - deltaX;
      const newY = positionStartRef.current.y - deltaY;
      
      // Simple boundary limits
      const maxOffset = 2000; // Allow generous movement
      setPosition({
        x: Math.max(-maxOffset, Math.min(newX, maxOffset)),
        y: Math.max(-maxOffset, Math.min(newY, maxOffset))
      });
    };

    const handleEnd = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
      }
    };

    // Add listeners to document for better capture
    document.addEventListener('mousemove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('mouseleave', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    window.addEventListener('blur', handleEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('mouseleave', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
      window.removeEventListener('blur', handleEnd);
    };
  }, []);

  // Reset position when going fullscreen
  useEffect(() => {
    if (isFullscreen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isFullscreen]);

  // Fetch evidence for incident (supports both regular incidents and FMIR)
  useEffect(() => {
    const fetchEvidence = async () => {
      try {
        setLoading(true);
        console.log('🔍 [EvidenceSpotlight] Fetching evidence for:', incidentId);
        
        let foundEvidence: Evidence[] = [];
        
        // First, try fetching from regular incident endpoint
        try {
          const incidentResponse = await api.get(`/incidents/${incidentId}`);
          console.log('🔍 [EvidenceSpotlight] Incident response:', incidentResponse.data);
          
          // API returns { success: true, data: incident }
          const incident = incidentResponse.data.data || incidentResponse.data;
          
          // Check for direct Evidence on incident
          const incidentEvidence = incident.Evidence || [];
          console.log('🔍 [EvidenceSpotlight] Direct incident evidence count:', incidentEvidence.length);
          
          if (incidentEvidence.length > 0) {
            console.log('✅ [EvidenceSpotlight] Found', incidentEvidence.length, 'evidence from incident');
            foundEvidence = incidentEvidence;
          }
          
          // Check for linked FMIR evidence (FMIRReport.FMIREvidence)
          if (foundEvidence.length === 0 && incident.FMIRReport?.FMIREvidence?.length > 0) {
            const fmirEvidence = incident.FMIRReport.FMIREvidence;
            console.log('✅ [EvidenceSpotlight] Found', fmirEvidence.length, 'evidence from linked FMIR');
            foundEvidence = fmirEvidence.map((e: any) => ({
              id: e.id,
              type: e.type,
              fileName: e.fileName,
              filePath: e.filePath,
              fileSize: e.fileSize,
              mimeType: e.mimeType,
              uploadedAt: e.uploadedAt,
              fmirId: incident.FMIRReport.id // Track that this is FMIR evidence
            }));
          }
        } catch (incidentErr: any) {
          // Not a regular incident or 404, try FMIR directly
          console.log('🔍 [EvidenceSpotlight] Incident fetch failed:', incidentErr?.response?.status || incidentErr.message);
        }
        
        // If still no evidence, try treating incidentId as FMIR ID
        if (foundEvidence.length === 0) {
          console.log('🔍 [EvidenceSpotlight] Trying FMIR endpoint with ID:', incidentId);
          
          try {
            const fmirResponse = await api.get(`/fmir/${incidentId}`);
            console.log('🔍 [EvidenceSpotlight] FMIR response:', fmirResponse.data);
            // FMIR API returns { success: true, data: { ...report, FMIREvidence: [...] } }
            const fmirData = fmirResponse.data.data || fmirResponse.data;
            const fmirEvidence = fmirData.FMIREvidence || [];
            
            if (fmirEvidence.length > 0) {
              console.log('✅ [EvidenceSpotlight] Found', fmirEvidence.length, 'evidence from FMIR');
              // Map FMIR evidence to the expected Evidence format
              foundEvidence = fmirEvidence.map((e: any) => ({
                id: e.id,
                type: e.type,
                fileName: e.fileName,
                filePath: e.filePath,
                fileSize: e.fileSize,
                mimeType: e.mimeType,
                uploadedAt: e.uploadedAt,
                fmirId: fmirData.id
              }));
            }
          } catch (fmirErr: any) {
            console.log('🔍 [EvidenceSpotlight] FMIR fetch failed:', fmirErr?.response?.status || fmirErr.message);
          }
        }
        
        console.log('📦 [EvidenceSpotlight] Final evidence count:', foundEvidence.length);
        setEvidence(foundEvidence);
        setError(null);
      } catch (err) {
        console.error('Error fetching evidence:', err);
        setError('Failed to load evidence');
      } finally {
        setLoading(false);
      }
    };

    fetchEvidence();
  }, [incidentId]);

  // Check for active spotlight on mount
  useEffect(() => {
    const checkActiveSpotlight = async () => {
      try {
        const response = await api.get(`/evidence/spotlight/room/${roomName}`);
        if (response.data) {
          setSpotlight({
            isActive: true,
            evidenceId: response.data.evidenceId || response.data.fmirEvidenceId,
            spotlightId: response.data.id,
            presentedBy: response.data.presentedBy,
            startedAt: new Date(response.data.presentedAt)
          });
          setViewMode('spotlight');
          
          // Find and select the evidence
          const evidenceId = response.data.evidenceId || response.data.fmirEvidenceId;
          const index = evidence.findIndex(e => e.id === evidenceId);
          if (index >= 0) {
            setSelectedIndex(index);
          }
          
          // Load existing annotations (backend returns 'annotations' not 'annotationsRecords')
          if (response.data.annotations && response.data.annotations.length > 0) {
            setAnnotations(response.data.annotations.map((a: any) => ({
              id: a.id,
              type: a.annotationType,
              evidenceId: evidenceId,
              data: a.data,
              color: a.color,
              strokeWidth: a.strokeWidth,
              userId: a.user?.id || a.userId,
              userName: a.user ? `${a.user.firstName} ${a.user.lastName}` : undefined
            })));
            console.log('📥 Loaded', response.data.annotations.length, 'existing annotations for active spotlight');
          }
        }
      } catch (err) {
        console.log('No active spotlight');
      }
    };

    if (roomName && evidence.length > 0) {
      checkActiveSpotlight();
    }
  }, [roomName, evidence]);

  // Fetch discussion markers
  useEffect(() => {
    const fetchMarkers = async () => {
      try {
        const response = await api.get(`/evidence/markers/incident/${incidentId}?roomName=${roomName}`);
        setMarkers(response.data);
      } catch (err) {
        console.error('Error fetching markers:', err);
      }
    };

    fetchMarkers();
  }, [incidentId, roomName]);

  // WebSocket listeners for real-time updates
  useEffect(() => {
    if (!socket) {
      console.log('⚠️ [EvidenceSpotlight] No socket available for listeners');
      return;
    }
    
    console.log('🎧 [EvidenceSpotlight] Setting up WebSocket listeners, socket connected:', socket.connected);
    
    const handleSpotlightStarted = async (data: any) => {
      console.log('🔦 Spotlight started:', data);
      setSpotlight({
        isActive: true,
        evidenceId: data.evidenceId,
        spotlightId: data.spotlightId,
        presentedBy: data.presentedBy,
        startedAt: new Date(data.startedAt)
      });
      setViewMode('spotlight');
      
      // Fetch existing annotations for this spotlight
      try {
        const response = await api.get(`/evidence/annotations/spotlight/${data.spotlightId}`);
        const existingAnnotations = response.data.map((ann: any) => ({
          id: ann.id,
          type: ann.annotationType,
          evidenceId: data.evidenceId,
          data: ann.data,
          color: ann.color,
          strokeWidth: ann.strokeWidth,
          userId: ann.user?.id,
          userName: ann.user ? `${ann.user.firstName} ${ann.user.lastName}` : undefined
        }));
        setAnnotations(existingAnnotations);
        console.log('📥 Loaded', existingAnnotations.length, 'existing annotations');
      } catch (err) {
        console.error('Error loading annotations:', err);
        setAnnotations([]);
      }
      
      // Find and select the evidence
      const index = evidence.findIndex(e => e.id === data.evidenceId);
      if (index >= 0) {
        setSelectedIndex(index);
      }
    };

    const handleSpotlightEnded = (data: any) => {
      console.log('🔦 Spotlight ended:', data);
      if (data.spotlightId === spotlight.spotlightId) {
        setSpotlight({
          isActive: false,
          evidenceId: null,
          spotlightId: null,
          presentedBy: null,
          startedAt: null
        });
        setViewMode('gallery');
        setAnnotations([]);
        setIsPresenting(false);
        // Reset zoom/pan state
        setViewState({ zoom: 1, panX: 0, panY: 0 });
        setIsPanning(false);
      }
    };

    const handleAnnotationAdded = (data: any) => {
      const receivedEvidenceId = data.annotation?.evidenceId || data.evidenceId;
      
      setAnnotations(prev => {
        // Check if annotation already exists by ID (prevents duplicates)
        const exists = prev.some(a => a.id === data.annotation.id);
        if (exists) {
          // Update the existing annotation with server data
          return prev.map(a => a.id === data.annotation.id ? {
            ...a,
            id: data.annotation.id,
            type: data.annotation.annotationType,
            evidenceId: receivedEvidenceId,
            data: data.annotation.data,
            color: data.annotation.color,
            strokeWidth: data.annotation.strokeWidth,
            userId: data.annotation.user?.id,
            userName: data.annotation.user ? `${data.annotation.user.firstName} ${data.annotation.user.lastName}` : undefined
          } : a);
        }
        // Add new annotation from other users
        return [...prev, {
          id: data.annotation.id,
          type: data.annotation.annotationType,
          evidenceId: receivedEvidenceId,
          data: data.annotation.data,
          color: data.annotation.color,
          strokeWidth: data.annotation.strokeWidth,
          userId: data.annotation.user?.id,
          userName: data.annotation.user ? `${data.annotation.user.firstName} ${data.annotation.user.lastName}` : undefined
        }];
      });
    };

    const handleAnnotationDeleted = (data: any) => {
      setAnnotations(prev => prev.filter(a => a.id !== data.annotationId));
    };

    const handleMarkerAdded = (data: any) => {
      setMarkers(prev => {
        // Avoid duplicates (marker may already be added by the creator)
        if (prev.some(m => m.id === data.marker.id)) return prev;
        return [...prev, {
          ...data.marker,
          timestamp: new Date(data.marker.timestamp)
        }];
      });
    };

    const handleMarkerDeleted = (data: any) => {
      setMarkers(prev => prev.filter(m => m.id !== data.markerId));
    };

    // Handle evidence navigation from other participants
    const handleEvidenceChanged = (data: any) => {
      if (data.spotlightId === spotlight.spotlightId) {
        setSelectedIndex(data.selectedIndex);
      }
    };

    // Handle view state changes (zoom/pan) from other participants
    const handleViewStateChanged = (data: any) => {
      // Only apply if it's for the same spotlight session and from a different user
      if (data.spotlightId === spotlight.spotlightId && data.userId !== userId) {
        setViewState(data.viewState);
      }
    };

    socket.on('spotlight:started', handleSpotlightStarted);
    socket.on('spotlight:ended', handleSpotlightEnded);
    socket.on('spotlight:annotation', handleAnnotationAdded);
    socket.on('spotlight:annotation-deleted', handleAnnotationDeleted);
    socket.on('spotlight:marker-added', handleMarkerAdded);
    socket.on('spotlight:marker-deleted', handleMarkerDeleted);
    socket.on('spotlight:evidence-changed', handleEvidenceChanged);
    socket.on('spotlight:viewChanged', handleViewStateChanged);

    return () => {
      socket.off('spotlight:started', handleSpotlightStarted);
      socket.off('spotlight:ended', handleSpotlightEnded);
      socket.off('spotlight:annotation', handleAnnotationAdded);
      socket.off('spotlight:annotation-deleted', handleAnnotationDeleted);
      socket.off('spotlight:marker-added', handleMarkerAdded);
      socket.off('spotlight:marker-deleted', handleMarkerDeleted);
      socket.off('spotlight:evidence-changed', handleEvidenceChanged);
      socket.off('spotlight:viewChanged', handleViewStateChanged);
    };
  }, [socket, evidence, spotlight.spotlightId, userId]);

  // Start presenting evidence
  const startSpotlight = async (evidenceId: string) => {
    try {
      setIsPresenting(true);
      
      // Find the evidence to check if it's from FMIR
      const ev = evidence.find(e => e.id === evidenceId);
      
      const response = await api.post('/evidence/spotlight', {
        incidentId,
        evidenceId,
        roomName,
        fmirId: ev?.fmirId // Include fmirId if this is FMIR evidence
      });
      console.log('🔦 Started spotlight:', response.data);
      
      // Update spotlight state immediately for better UX
      setSpotlight({
        isActive: true,
        evidenceId,
        spotlightId: response.data.id,
        presentedBy: response.data.presentedBy,
        startedAt: new Date(response.data.presentedAt)
      });
      setViewMode('spotlight');
    } catch (err) {
      console.error('Error starting spotlight:', err);
      setIsPresenting(false);
    }
  };

  // Stop presenting
  const endSpotlight = async () => {
    if (!spotlight.spotlightId) return;
    
    try {
      await api.patch(`/evidence/spotlight/${spotlight.spotlightId}/end`);
      setIsPresenting(false);
    } catch (err) {
      console.error('Error ending spotlight:', err);
    }
  };

  // Add annotation
  const handleAddAnnotation = async (annotation: Annotation) => {
    if (!spotlight.evidenceId || !selectedEvidence) return;

    // Get current user info from localStorage or auth context
    let currentUserName = 'You';
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        currentUserName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'You';
      }
    } catch (e) {
      console.log('Could not get user name');
    }

    // Make sure annotation has the current evidence ID and user name
    const annotationWithEvidence = {
      ...annotation,
      evidenceId: selectedEvidence.id,
      userId: userId,
      userName: currentUserName
    };

    // Add to local state immediately for responsiveness
    setAnnotations(prev => [...prev, annotationWithEvidence]);

    try {
      const response = await api.post('/evidence/annotations', {
        evidenceId: selectedEvidence.id,
        spotlightId: spotlight.spotlightId,
        roomName,
        annotationType: annotation.type,
        data: annotation.data,
        color: annotation.color,
        strokeWidth: annotation.strokeWidth,
        isTemporary: true
      });
      
      // Update local state with server-assigned ID
      setAnnotations(prev => prev.map(a => 
        a.id === annotation.id ? { ...a, id: response.data.id } : a
      ));
      
      // Update history
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      historyRef.current.push([...annotations, { ...annotationWithEvidence, id: response.data.id }]);
      historyIndexRef.current++;
      setCanUndo(true);
    } catch (err) {
      console.error('Error saving annotation:', err);
      // Remove the annotation if save failed
      setAnnotations(prev => prev.filter(a => a.id !== annotation.id));
    }
  };

  // Handle view state changes (zoom/pan) and broadcast to other users
  const handleViewStateChange = useCallback((newViewState: ViewState) => {
    setViewState(newViewState);
    
    // Broadcast to other users in the room
    const currentEvidence = evidence[selectedIndex];
    if (socket && spotlight.isActive && currentEvidence) {
      socket.emit('spotlight:viewChange', {
        incidentId,
        evidenceId: currentEvidence.id,
        spotlightId: spotlight.spotlightId,
        viewState: newViewState,
        userId
      });
    }
  }, [socket, spotlight.isActive, spotlight.spotlightId, evidence, selectedIndex, incidentId, userId]);

  // Handle panning mode change
  const handlePanningChange = useCallback((panning: boolean) => {
    setIsPanning(panning);
    // Clear current tool when enabling pan mode
    if (panning) {
      setCurrentTool(null);
    }
  }, []);

  // Zoom control handlers
  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(viewState.zoom + 0.5, 4);
    handleViewStateChange({ ...viewState, zoom: newZoom });
  }, [viewState, handleViewStateChange]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(viewState.zoom - 0.5, 1);
    // Reset pan when zooming back to 1
    const newState = newZoom === 1 
      ? { zoom: 1, panX: 0, panY: 0 }
      : { ...viewState, zoom: newZoom };
    handleViewStateChange(newState);
    if (newZoom === 1) {
      setIsPanning(false);
    }
  }, [viewState, handleViewStateChange]);

  const handleResetView = useCallback(() => {
    handleViewStateChange({ zoom: 1, panX: 0, panY: 0 });
    setIsPanning(false);
  }, [handleViewStateChange]);

  const togglePanMode = useCallback(() => {
    handlePanningChange(!isPanning);
  }, [isPanning, handlePanningChange]);

  // Undo last annotation
  const handleUndo = useCallback(async () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current--;
      const previousState = historyRef.current[historyIndexRef.current];
      
      // Find removed annotation and delete from server
      const removedAnnotation = annotations.find(a => 
        !previousState.some(p => p.id === a.id)
      );
      
      if (removedAnnotation) {
        try {
          await api.delete(`/evidence/annotations/${removedAnnotation.id}`);
        } catch (err) {
          console.error('Error deleting annotation:', err);
        }
      }
      
      setAnnotations(previousState);
      setCanUndo(historyIndexRef.current > 0);
    }
  }, [annotations]);

  // Clear all annotations
  const handleClearAll = async () => {
    for (const annotation of annotations) {
      try {
        await api.delete(`/evidence/annotations/${annotation.id}`);
      } catch (err) {
        console.error('Error deleting annotation:', err);
      }
    }
    setAnnotations([]);
    historyRef.current = [[]];
    historyIndexRef.current = 0;
    setCanUndo(false);
  };

  // Add discussion marker
  const handleAddMarker = async () => {
    if (!newMarkerTitle.trim() || isAddingMarker) return;

    setIsAddingMarker(true);
    try {
      const callOffset = callStartTime 
        ? Math.round((new Date().getTime() - callStartTime.getTime()) / 1000)
        : undefined;

      const response = await api.post('/evidence/markers', {
        incidentId,
        roomName,
        evidenceId: selectedEvidence?.id || null, // Use actual evidence ID, not spotlight ID
        markerType: newMarkerType,
        title: newMarkerTitle,
        description: newMarkerDescription || undefined,
        callOffset
      });

      // Add marker to local state immediately for responsiveness
      // WebSocket will also broadcast to other participants
      const newMarker = response.data;
      setMarkers(prev => {
        // Avoid duplicates (in case WebSocket event arrives before this)
        if (prev.some(m => m.id === newMarker.id)) return prev;
        return [...prev, {
          ...newMarker,
          timestamp: new Date(newMarker.timestamp)
        }];
      });

      setShowMarkerModal(false);
      setNewMarkerTitle('');
      setNewMarkerType('evidence_discussed');
      setNewMarkerDescription('');
    } catch (err) {
      console.error('Error adding marker:', err);
    } finally {
      setIsAddingMarker(false);
    }
  };

  // Load evidence image via API with authentication
  const loadEvidenceMedia = useCallback(async (ev: Evidence) => {
    if (ev.type !== 'PHOTO' && ev.type !== 'VIDEO') return;
    if (evidenceUrls[ev.id]) return; // Already loaded
    if (loadingEvidence[ev.id]) return; // Already loading
    
    setLoadingEvidence(prev => ({ ...prev, [ev.id]: true }));
    
    try {
      let url: string;
      if (ev.fmirId) {
        url = `/fmir/${ev.fmirId}/evidence/${ev.id}/download`;
      } else {
        url = `/incidents/${incidentId}/evidence/${ev.id}/download`;
      }
      
      console.log('📷 [EvidenceSpotlight] Loading media from:', url);
      const response = await api.get(url, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(response.data);
      console.log('📷 [EvidenceSpotlight] Created blob URL for:', ev.fileName);
      
      // Track blob URL for cleanup
      blobUrlsRef.current.push(blobUrl);
      
      setEvidenceUrls(prev => ({ ...prev, [ev.id]: blobUrl }));
    } catch (err) {
      console.error('📷 [EvidenceSpotlight] Failed to load media:', ev.fileName, err);
    } finally {
      setLoadingEvidence(prev => ({ ...prev, [ev.id]: false }));
    }
  }, [evidenceUrls, loadingEvidence, incidentId]);

  // Load all evidence images when evidence list changes
  useEffect(() => {
    evidence.forEach(ev => {
      if ((ev.type === 'PHOTO' || ev.type === 'VIDEO') && !evidenceUrls[ev.id]) {
        loadEvidenceMedia(ev);
      }
    });
  }, [evidence, loadEvidenceMedia, evidenceUrls]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  // Get evidence URL - returns blob URL if loaded, otherwise placeholder
  const getEvidenceUrl = (ev: Evidence): string | undefined => {
    return evidenceUrls[ev.id];
  };

  // Check if evidence is still loading
  const isEvidenceLoading = (ev: Evidence): boolean => {
    return loadingEvidence[ev.id] || false;
  };

  // Computed values needed for navigation
  const selectedEvidence = evidence[selectedIndex];
  const isImageOrVideo = selectedEvidence?.type === 'PHOTO' || selectedEvidence?.type === 'VIDEO';
  const isMySpotlight = spotlight.presentedBy?.id === userId;

  // Navigate evidence with broadcasting
  const goToNext = useCallback(() => {
    if (selectedIndex < evidence.length - 1) {
      const newIndex = selectedIndex + 1;
      setSelectedIndex(newIndex);
      
      // Reset zoom/pan when changing evidence
      setViewState({ zoom: 1, panX: 0, panY: 0 });
      setIsPanning(false);
      
      // Broadcast navigation change to all participants
      if (socket && spotlight.isActive && isMySpotlight) {
        const newEvidence = evidence[newIndex];
        socket.emit('spotlight:evidence-changed', {
          roomName,
          spotlightId: spotlight.spotlightId,
          evidenceId: newEvidence?.id,
          selectedIndex: newIndex
        });
      }
    }
  }, [selectedIndex, evidence, socket, spotlight, isMySpotlight, roomName]);

  const goToPrevious = useCallback(() => {
    if (selectedIndex > 0) {
      const newIndex = selectedIndex - 1;
      setSelectedIndex(newIndex);
      
      // Reset zoom/pan when changing evidence
      setViewState({ zoom: 1, panX: 0, panY: 0 });
      setIsPanning(false);
      
      // Broadcast navigation change to all participants
      if (socket && spotlight.isActive && isMySpotlight) {
        const newEvidence = evidence[newIndex];
        socket.emit('spotlight:evidence-changed', {
          roomName,
          spotlightId: spotlight.spotlightId,
          evidenceId: newEvidence?.id,
          selectedIndex: newIndex
        });
      }
    }
  }, [selectedIndex, evidence, socket, spotlight, isMySpotlight, roomName]);

  // Format call offset as mm:ss
  const formatCallOffset = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toolColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF', '#000000'];

  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-20 right-4 z-30 bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg transition-all"
        title="Open Evidence Spotlight"
      >
        <ImageIcon className="w-5 h-5" />
        {spotlight.isActive && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
        )}
      </button>
    );
  }

  // Minimized view
  if (isMinimized) {
    return (
      <div
        ref={containerRef}
        style={{
          right: `${8 + position.x}px`,
          bottom: `${80 + position.y}px`,
          transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
        }}
        className={`fixed z-40 bg-gray-900 rounded-lg shadow-2xl border border-gray-700 ${isDragging ? 'shadow-indigo-500/30' : ''}`}
      >
        <div 
          className="flex items-center gap-2 p-2 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <GripHorizontal className="w-4 h-4 text-gray-500" />
          <ImageIcon className="w-4 h-4 text-indigo-400" />
          <span className="text-white text-sm font-medium">Evidence</span>
          {spotlight.isActive && (
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(false); }}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded ml-1"
            title="Expand"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      style={!isFullscreen ? {
        right: `${8 + position.x}px`,
        bottom: `${16 + position.y}px`,
        transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
      } : undefined}
      className={`fixed ${isFullscreen 
        ? 'inset-0 z-50' 
        : 'w-[calc(100vw-1rem)] sm:w-[400px] md:w-[450px] lg:w-[500px] max-h-[calc(100vh-5rem)] sm:max-h-[calc(100vh-6rem)] h-auto z-40'} 
        bg-gray-900 rounded-lg shadow-2xl flex flex-col overflow-hidden border border-gray-700 ${isDragging ? 'shadow-indigo-500/30' : ''}`}
    >
      {/* Header - Draggable */}
      <div 
        className={`flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700 ${!isFullscreen ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onMouseDown={!isFullscreen ? handleDragStart : undefined}
        onTouchStart={!isFullscreen ? handleDragStart : undefined}
      >
        <div className="flex items-center gap-2 select-none">
          {!isFullscreen && <GripHorizontal className="w-4 h-4 text-gray-500" />}
          <ImageIcon className="w-5 h-5 text-indigo-400" />
          <h3 className="text-white font-medium">Evidence Spotlight</h3>
          {spotlight.isActive && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center text-red-400">
          {error}
        </div>
      ) : evidence.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-4 text-center">
          <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
          <p>No evidence uploaded for this incident</p>
          <p className="text-sm mt-1">Upload photos or videos to use the spotlight feature</p>
        </div>
      ) : viewMode === 'gallery' ? (
        /* Gallery View */
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 gap-2">
            {evidence.map((ev, index) => (
              <div
                key={ev.id}
                onClick={() => {
                  setSelectedIndex(index);
                  if (ev.type === 'PHOTO' || ev.type === 'VIDEO') {
                    startSpotlight(ev.id);
                  }
                }}
                className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer 
                  border-2 transition-all hover:border-indigo-500 group
                  ${selectedIndex === index ? 'border-indigo-500' : 'border-transparent'}`}
              >
                {ev.type === 'PHOTO' ? (
                  isEvidenceLoading(ev) || !getEvidenceUrl(ev) ? (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    </div>
                  ) : (
                    <img
                      src={getEvidenceUrl(ev)}
                      alt={ev.fileName}
                      className="w-full h-full object-cover"
                    />
                  )
                ) : ev.type === 'VIDEO' ? (
                  isEvidenceLoading(ev) || !getEvidenceUrl(ev) ? (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                      <Video className="w-8 h-8 text-gray-500" />
                    </div>
                  )
                ) : ev.type === 'DOCUMENT' ? (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-gray-500" />
                  </div>
                ) : (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <Mic2 className="w-8 h-8 text-gray-500" />
                  </div>
                )}
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white" />
                </div>
                
                {/* File name */}
                <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent">
                  <p className="text-white text-xs truncate">{ev.fileName}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Spotlight View */
        <div className="flex-1 flex flex-col">
          {/* Presenter info */}
          {spotlight.isActive && spotlight.presentedBy && (
            <div className="px-3 py-2 bg-indigo-900/30 border-b border-indigo-700/30 flex items-center justify-between">
              <span className="text-indigo-200 text-sm">
                <span className="font-medium">{spotlight.presentedBy.firstName} {spotlight.presentedBy.lastName}</span>
                {' is presenting'}
              </span>
              {isMySpotlight && (
                <button
                  onClick={endSpotlight}
                  className="px-2 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                >
                  Stop Presenting
                </button>
              )}
            </div>
          )}

          {/* Main content area with annotations */}
          <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
            {selectedEvidence?.type === 'PHOTO' ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                {(selectedEvidence && isEvidenceLoading(selectedEvidence)) || !getEvidenceUrl(selectedEvidence!) ? (
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
                    <p className="text-sm">Loading evidence...</p>
                  </div>
                ) : (
                  <>
                    {/* Zoomable container - applies transform to both image and annotations */}
                    <div 
                      className="relative transition-transform duration-150 ease-out"
                      style={{
                        transform: `scale(${viewState.zoom}) translate(${viewState.panX / viewState.zoom}px, ${viewState.panY / viewState.zoom}px)`,
                        transformOrigin: 'center center'
                      }}
                    >
                      <img
                        ref={imageRef}
                        src={getEvidenceUrl(selectedEvidence)}
                        alt={selectedEvidence.fileName}
                        className="max-w-full max-h-full object-contain mx-auto"
                        style={{ maxHeight: isFullscreen ? 'calc(100vh - 280px)' : 'min(50vh, 400px)' }}
                      />
                      {/* Annotation overlay - positioned over the image */}
                      {spotlight.isActive && (
                        <AnnotationCanvas
                          annotations={annotations}
                          currentEvidenceId={selectedEvidence.id}
                          currentTool={currentTool}
                          currentColor={currentColor}
                          strokeWidth={2}
                          onAddAnnotation={handleAddAnnotation}
                          disabled={(!isMySpotlight && currentTool === null) || isPanning}
                          imageRef={imageRef}
                          viewState={viewState}
                          onViewStateChange={handleViewStateChange}
                          isPanning={isPanning}
                          onPanningChange={handlePanningChange}
                        />
                      )}
                    </div>
                    
                    {/* Zoom and Pan Controls - outside transform container */}
                    {spotlight.isActive && (
                      <div className="absolute top-3 right-3 flex flex-col gap-1 z-20">
                        <button
                          onClick={handleZoomIn}
                          disabled={viewState.zoom >= 4}
                          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg"
                          title="Zoom In"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleZoomOut}
                          disabled={viewState.zoom <= 1}
                          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg"
                          title="Zoom Out"
                        >
                          <ZoomOut className="w-4 h-4" />
                        </button>
                        {viewState.zoom > 1 && (
                          <>
                            <button
                              onClick={togglePanMode}
                              className={`p-2 rounded-lg transition-colors shadow-lg ${
                                isPanning 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-black/70 hover:bg-black/90 text-white'
                              }`}
                              title="Pan Mode (drag to move)"
                            >
                              <Move className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleResetView}
                              className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors shadow-lg"
                              title="Reset View"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {/* Zoom level indicator */}
                        {viewState.zoom > 1 && (
                          <div className="text-center text-xs text-white bg-black/70 rounded px-1.5 py-0.5 mt-1 shadow-lg">
                            {Math.round(viewState.zoom * 100)}%
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Pan mode indicator */}
                    {isPanning && viewState.zoom > 1 && (
                      <div className="absolute top-3 left-3 bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-lg z-20">
                        Pan Mode - Drag to move
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : selectedEvidence?.type === 'VIDEO' ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                {(selectedEvidence && isEvidenceLoading(selectedEvidence)) || !getEvidenceUrl(selectedEvidence!) ? (
                  <div className="flex flex-col items-center justify-center text-gray-400">
                    <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
                    <p className="text-sm">Loading evidence...</p>
                  </div>
                ) : (
                  <>
                    {/* Zoomable container - applies transform to both video and annotations */}
                    <div 
                      className="relative transition-transform duration-150 ease-out"
                      style={{
                        transform: `scale(${viewState.zoom}) translate(${viewState.panX / viewState.zoom}px, ${viewState.panY / viewState.zoom}px)`,
                        transformOrigin: 'center center'
                      }}
                    >
                      <video
                        ref={videoRef}
                        src={getEvidenceUrl(selectedEvidence)}
                        controls
                        className="max-w-full max-h-full object-contain mx-auto"
                        style={{ maxHeight: isFullscreen ? 'calc(100vh - 280px)' : 'min(50vh, 400px)' }}
                      />
                      {spotlight.isActive && (
                        <AnnotationCanvas
                          annotations={annotations}
                          currentEvidenceId={selectedEvidence.id}
                          currentTool={currentTool}
                          currentColor={currentColor}
                          strokeWidth={2}
                          onAddAnnotation={handleAddAnnotation}
                          disabled={(!isMySpotlight && currentTool === null) || isPanning}
                          imageRef={videoRef as any}
                          viewState={viewState}
                          onViewStateChange={handleViewStateChange}
                          isPanning={isPanning}
                          onPanningChange={handlePanningChange}
                        />
                      )}
                    </div>
                    
                    {/* Zoom and Pan Controls - outside transform container */}
                    {spotlight.isActive && (
                      <div className="absolute top-3 right-3 flex flex-col gap-1 z-20">
                        <button
                          onClick={handleZoomIn}
                          disabled={viewState.zoom >= 4}
                          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg"
                          title="Zoom In"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                        <button
                          onClick={handleZoomOut}
                          disabled={viewState.zoom <= 1}
                          className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg"
                          title="Zoom Out"
                        >
                          <ZoomOut className="w-4 h-4" />
                        </button>
                        {viewState.zoom > 1 && (
                          <>
                            <button
                              onClick={togglePanMode}
                              className={`p-2 rounded-lg transition-colors shadow-lg ${
                                isPanning 
                                  ? 'bg-blue-500 text-white' 
                                  : 'bg-black/70 hover:bg-black/90 text-white'
                              }`}
                              title="Pan Mode (drag to move)"
                            >
                              <Move className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleResetView}
                              className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-colors shadow-lg"
                              title="Reset View"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {viewState.zoom > 1 && (
                          <div className="text-center text-xs text-white bg-black/70 rounded px-1.5 py-0.5 mt-1 shadow-lg">
                            {Math.round(viewState.zoom * 100)}%
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Pan mode indicator */}
                    {isPanning && viewState.zoom > 1 && (
                      <div className="absolute top-3 left-3 bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-lg z-20">
                        Pan Mode - Drag to move
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-400 p-4">
                <FileText className="w-16 h-16 mx-auto mb-2 opacity-50" />
                <p>{selectedEvidence?.fileName}</p>
                <p className="text-sm mt-1">Document preview not available</p>
              </div>
            )}

            {/* Navigation arrows */}
            {evidence.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  disabled={selectedIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={goToNext}
                  disabled={selectedIndex === evidence.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Annotation toolbar */}
          {spotlight.isActive && isImageOrVideo && (
            <div className="flex-none p-2 bg-gray-800 border-t border-gray-700 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 flex-wrap">
                {/* Drawing tools */}
                <button
                  onClick={() => setCurrentTool(currentTool === 'circle' ? null : 'circle')}
                  className={`p-1.5 sm:p-2 rounded transition-colors ${currentTool === 'circle' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                  title="Circle"
                >
                  <Circle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={() => setCurrentTool(currentTool === 'arrow' ? null : 'arrow')}
                  className={`p-1.5 sm:p-2 rounded transition-colors ${currentTool === 'arrow' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                  title="Arrow"
                >
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={() => setCurrentTool(currentTool === 'rectangle' ? null : 'rectangle')}
                  className={`p-1.5 sm:p-2 rounded transition-colors ${currentTool === 'rectangle' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                  title="Rectangle"
                >
                  <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={() => setCurrentTool(currentTool === 'freehand' ? null : 'freehand')}
                  className={`p-1.5 sm:p-2 rounded transition-colors ${currentTool === 'freehand' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                  title="Freehand"
                >
                  <Pencil className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={() => setCurrentTool(currentTool === 'text' ? null : 'text')}
                  className={`p-1.5 sm:p-2 rounded transition-colors ${currentTool === 'text' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
                  title="Text"
                >
                  <Type className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>

                <div className="w-px h-5 sm:h-6 bg-gray-700 mx-0.5 sm:mx-1" />

                {/* Color picker */}
                <div className="flex items-center gap-0.5">
                  {toolColors.map(color => (
                    <button
                      key={color}
                      onClick={() => setCurrentColor(color)}
                      className={`w-4 h-4 sm:w-5 sm:h-5 rounded-sm border-2 transition-all ${currentColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                <div className="w-px h-5 sm:h-6 bg-gray-700 mx-0.5 sm:mx-1" />

                {/* Actions */}
                <button
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded disabled:opacity-30"
                  title="Undo"
                >
                  <Undo className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={annotations.length === 0}
                  className="p-1.5 sm:p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded disabled:opacity-30"
                  title="Clear All"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>

              {/* Add marker button */}
              <button
                onClick={() => setShowMarkerModal(true)}
                className="flex items-center gap-1 px-2 py-1 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm rounded transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                Add Marker
              </button>
            </div>
          )}

          {/* Back to gallery */}
          {!spotlight.isActive && (
            <div className="p-2 bg-gray-800 border-t border-gray-700">
              <button
                onClick={() => setViewMode('gallery')}
                className="w-full py-2 text-gray-400 hover:text-white text-sm flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Gallery
              </button>
            </div>
          )}
        </div>
      )}

      {/* Discussion markers timeline */}
      {markers.length > 0 && (
        <div className="flex-none p-2 bg-gray-800/50 border-t border-gray-700 max-h-28 sm:max-h-40 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs text-gray-400 font-medium">Discussion Markers</h4>
            <button
              onClick={() => setShowDiscussionHistory(true)}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <History className="w-3 h-3" />
              View All
            </button>
          </div>
          <div className="space-y-2">
            {markers.map(marker => {
              const markerConfig = markerTypes.find(m => m.type === marker.markerType);
              const Icon = markerConfig?.icon || MessageSquare;
              return (
                <div key={marker.id} className="flex items-start gap-2 text-xs bg-gray-700/50 p-2 rounded">
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${markerConfig?.color || 'text-gray-400'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-medium">{marker.title}</span>
                      {marker.callOffset !== undefined && (
                        <span className="text-gray-500">[{formatCallOffset(marker.callOffset)}]</span>
                      )}
                    </div>
                    {marker.description && (
                      <p className="text-gray-400 mt-0.5 truncate">{marker.description}</p>
                    )}
                    <div className="text-gray-500 mt-1 text-[10px]">
                      By {marker.createdBy?.firstName} {marker.createdBy?.lastName}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* View All Discussion History button (shown when no markers in current session) */}
      {markers.length === 0 && (
        <div className="flex-none p-2 bg-gray-800/50 border-t border-gray-700">
          <button
            onClick={() => setShowDiscussionHistory(true)}
            className="w-full flex items-center justify-center gap-2 py-2 text-sm text-indigo-400 hover:text-indigo-300 hover:bg-gray-700/50 rounded transition-colors"
          >
            <History className="w-4 h-4" />
            View Past Discussion History
          </button>
        </div>
      )}

      {/* Add Marker Modal */}
      {showMarkerModal && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-4 w-[90%] max-w-md">
            <h3 className="text-white font-medium mb-4">Add Discussion Marker</h3>
            
            {/* Marker type selector */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {markerTypes.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.type}
                    onClick={() => setNewMarkerType(type.type)}
                    className={`p-2 rounded border transition-colors flex flex-col items-center gap-1 text-xs
                      ${newMarkerType === type.type 
                        ? 'border-indigo-500 bg-indigo-500/20' 
                        : 'border-gray-600 hover:border-gray-500'}`}
                  >
                    <Icon className={`w-5 h-5 ${type.color}`} />
                    <span className="text-gray-300">{type.label}</span>
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={newMarkerTitle}
              onChange={(e) => setNewMarkerTitle(e.target.value)}
              placeholder="Marker title..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 mb-2"
              autoFocus
            />
            
            <textarea
              value={newMarkerDescription}
              onChange={(e) => setNewMarkerDescription(e.target.value)}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 mb-4 resize-none"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowMarkerModal(false);
                  setNewMarkerTitle('');
                  setNewMarkerDescription('');
                }}
                disabled={isAddingMarker}
                className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMarker}
                disabled={!newMarkerTitle.trim() || isAddingMarker}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50 flex items-center gap-2"
              >
                {isAddingMarker && <Loader2 className="w-4 h-4 animate-spin" />}
                {isAddingMarker ? 'Adding...' : 'Add Marker'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discussion History Modal */}
      <DiscussionHistory
        incidentId={incidentId}
        isOpen={showDiscussionHistory}
        onClose={() => setShowDiscussionHistory(false)}
      />
    </div>
  );
}
