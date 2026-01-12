// Phase 3.2: Evidence Upload Component - Redesigned UX
// Files auto-staged on add, inline rename, upload on Submit Incident
// Supports photos, videos, documents, and voice recordings
// Added: Image cropping and Video trimming

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import api from '@/lib/api';

// Custom compact audio player component - fully inline, no popups
const CompactAudioPlayer = ({ src, type = 'audio/webm' }: { src: string; type?: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const newVolume = volume === 0 ? 0.7 : 0;
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, []);

  return (
    <div className="flex items-center gap-1.5 bg-slate-600 rounded-full px-1.5 py-1">
      <audio ref={audioRef} src={src} preload="metadata">
        <source src={src} type={type} />
      </audio>
      
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="w-6 h-6 flex items-center justify-center rounded-full bg-white hover:bg-slate-100 text-slate-800 transition-colors flex-shrink-0"
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="5,3 19,12 5,21" />
          </svg>
        )}
      </button>
      
      {/* Mute/Unmute button */}
      <button
        onClick={toggleMute}
        className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white transition-colors flex-shrink-0"
        title={volume === 0 ? 'Unmute' : 'Mute'}
      >
        {volume === 0 ? (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        )}
      </button>
    </div>
  );
};

// Size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DOCUMENT_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_VOICE_SIZE = 25 * 1024 * 1024; // 25MB

interface EvidenceFile {
  id: string;
  type: 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'VOICE_RECORDING';
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  preview?: string;
  transcription?: string;
}

// Staged file (before upload to server)
export interface StagedFile {
  id: string;
  file: File;
  customName: string;
  originalName: string;
  type: 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'VOICE_RECORDING';
  preview?: string;
  isEditing: boolean;
  knownDuration?: number; // Store duration for trimmed videos
  transcription?: string; // Voice recording transcription
}

// Crop selection area
interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Video trim range
interface TrimRange {
  start: number;
  end: number;
}

interface EvidenceUploadProps {
  incidentId?: string;
  onStagedFilesChange?: (files: StagedFile[]) => void;
  onUploadComplete?: (files: EvidenceFile[]) => void;
  onRemove?: (fileId: string) => void;
  existingEvidence?: EvidenceFile[];
  disabled?: boolean;
}

export default function EvidenceUpload({
  incidentId,
  onStagedFilesChange,
  onUploadComplete,
  onRemove,
  existingEvidence = [],
  disabled = false,
}: EvidenceUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceFile[]>(existingEvidence);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'VOICE_RECORDING'>('PHOTO');
  
  // Staged files (auto-added on selection, uploaded on submit)
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  
  // Image preview modal state
  const [previewImage, setPreviewImage] = useState<EvidenceFile | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Image crop modal state (for staged files)
  const [cropImage, setCropImage] = useState<StagedFile | null>(null);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const cropImageRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  
  // Video trim modal state (for staged files)
  const [trimVideo, setTrimVideo] = useState<StagedFile | null>(null);
  const [trimRange, setTrimRange] = useState<TrimRange>({ start: 0, end: 0 });
  const [originalTrimRange, setOriginalTrimRange] = useState<TrimRange>({ start: 0, end: 0 }); // Track original range to detect changes
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const trimVideoRef = useRef<HTMLVideoElement>(null);
  
  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  
  // Ref for detecting clicks outside editable filename
  const editingInputRef = useRef<HTMLInputElement>(null);

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (timerRef.current) clearInterval(timerRef.current);
      stagedFiles.forEach(sf => {
        if (sf.preview) URL.revokeObjectURL(sf.preview);
      });
    };
  }, []);

  // Notify parent of staged files changes
  useEffect(() => {
    if (onStagedFilesChange) {
      onStagedFilesChange(stagedFiles);
    }
  }, [stagedFiles, onStagedFilesChange]);

  // Handle click outside to finish editing filename
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (editingInputRef.current && !editingInputRef.current.contains(e.target as Node)) {
        setStagedFiles(prev => prev.map(sf => ({ ...sf, isEditing: false })));
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validateFileSize = (file: File, type: string): boolean => {
    let maxSize = MAX_DOCUMENT_SIZE;
    let typeName = 'Document';
    
    if (type === 'PHOTO') {
      maxSize = MAX_IMAGE_SIZE;
      typeName = 'Image';
    } else if (type === 'VIDEO') {
      maxSize = MAX_VIDEO_SIZE;
      typeName = 'Video';
    } else if (type === 'VOICE_RECORDING') {
      maxSize = MAX_VOICE_SIZE;
      typeName = 'Voice recording';
    }
    
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      setError(`${typeName} "${file.name}" exceeds ${maxSizeMB}MB limit`);
      return false;
    }
    return true;
  };

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  };

  // Handle file selection - auto-stage files
  const handleFileSelect = async (files: FileList | null, type: 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'VOICE_RECORDING') => {
    if (!files || files.length === 0) return;

    // Validate file sizes
    for (const file of Array.from(files)) {
      if (!validateFileSize(file, type)) return;
    }

    setError('');

    // Auto-stage files with preview for images/videos
    const newStagedFiles: StagedFile[] = Array.from(files).map((file) => {
      const preview = (type === 'PHOTO' || type === 'VIDEO') ? URL.createObjectURL(file) : undefined;
      return {
        id: `staged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        customName: file.name.replace(/\.[^/.]+$/, ''), // Name without extension
        originalName: file.name,
        type,
        preview,
        isEditing: false,
      };
    });

    setStagedFiles(prev => [...prev, ...newStagedFiles]);

    // Reset file inputs
    if (photoInputRef.current) photoInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
  };

  // Start inline editing of filename
  const startEditing = (id: string) => {
    setStagedFiles(prev => prev.map(sf => ({
      ...sf,
      isEditing: sf.id === id
    })));
  };

  // Update staged file name
  const updateStagedFileName = (id: string, newName: string) => {
    setStagedFiles(prev => prev.map(sf => 
      sf.id === id ? { ...sf, customName: newName } : sf
    ));
  };

  // Finish editing (on blur or Enter)
  const finishEditing = (id: string) => {
    setStagedFiles(prev => prev.map(sf => 
      sf.id === id ? { ...sf, isEditing: false } : sf
    ));
  };

  // Handle key press in filename input
  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      finishEditing(id);
    } else if (e.key === 'Escape') {
      setStagedFiles(prev => prev.map(sf => 
        sf.id === id ? { ...sf, customName: sf.originalName.replace(/\.[^/.]+$/, ''), isEditing: false } : sf
      ));
    }
  };

  // Remove staged file
  const removeStagedFile = (id: string) => {
    const file = stagedFiles.find(sf => sf.id === id);
    if (file?.preview) URL.revokeObjectURL(file.preview);
    setStagedFiles(prev => prev.filter(sf => sf.id !== id));
  };

  // Delete uploaded evidence
  const handleRemove = async (fileId: string) => {
    if (!confirm('Delete this evidence file?')) return;

    try {
      if (incidentId) {
        await api.delete(`/incidents/${incidentId}/evidence/${fileId}`);
      }
      
      setEvidence(prev => prev.filter(e => e.id !== fileId));
      if (onRemove) onRemove(fileId);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎤';
    if (mimeType.includes('pdf')) return '📄';
    return '📎';
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Voice Recording Functions with Real-time Transcription
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm') 
        ? 'audio/webm' 
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/wav';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);
      setAudioUrl(null);
      setTranscription('');

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Start speech recognition for real-time transcription
      startSpeechRecognition();

    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found.');
      } else {
        setError('Failed to start recording: ' + err.message);
      }
    }
  };

  // Start Web Speech API for transcription
  const startSpeechRecognition = () => {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.log('Speech recognition not supported in this browser');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      let finalTranscript = '';

      recognition.onstart = () => {
        setIsTranscribing(true);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }
        
        setTranscription(finalTranscript + interimTranscript);
      };

      recognition.onerror = (event: any) => {
        console.log('Speech recognition error:', event.error);
        // Don't show error to user - transcription is optional
        if (event.error !== 'no-speech') {
          setIsTranscribing(false);
        }
      };

      recognition.onend = () => {
        setIsTranscribing(false);
        // Restart if still recording
        if (isRecording && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // Ignore restart errors
          }
        }
      };

      recognition.start();
    } catch (err) {
      console.log('Failed to start speech recognition:', err);
    }
  };

  // Stop speech recognition
  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors
      }
      recognitionRef.current = null;
    }
    setIsTranscribing(false);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopSpeechRecognition();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setTranscription('');
    stopSpeechRecognition();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Save voice recording as staged file with transcription
  const saveVoiceRecording = () => {
    if (!audioBlob) return;

    if (audioBlob.size > MAX_VOICE_SIZE) {
      setError(`Voice recording exceeds ${MAX_VOICE_SIZE / (1024 * 1024)}MB limit`);
      return;
    }

    const fileName = `voice_recording_${Date.now()}.webm`;
    const file = new File([audioBlob], fileName, { type: 'audio/webm' });
    
    const stagedFile: StagedFile = {
      id: `staged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      customName: `Voice Recording ${new Date().toLocaleTimeString()}`,
      originalName: fileName,
      type: 'VOICE_RECORDING',
      preview: audioUrl || undefined,
      isEditing: false,
      transcription: transcription.trim() || undefined,
    };

    setStagedFiles(prev => [...prev, stagedFile]);
    
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setTranscription('');
  };

  // ==================== IMAGE CROP FUNCTIONS ====================
  
  // Open image crop modal for staged file
  const openCropModal = (sf: StagedFile) => {
    setCropImage(sf);
    setCropArea(null);
  };

  // Close crop modal
  const closeCropModal = () => {
    setCropImage(null);
    setCropArea(null);
    setIsDragging(false);
    setDragStart(null);
    setResizeHandle(null);
  };

  // Initialize - no default selection, user draws their own
  const handleCropImageLoad = () => {
    // Don't set default crop area - let user draw freely
    setCropArea(null);
  };

  // Get mouse position relative to image (accounting for display scaling)
  const getRelativePosition = (e: React.MouseEvent) => {
    if (!cropImageRef.current) return { x: 0, y: 0 };
    const img = cropImageRef.current;
    const rect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    return {
      x: Math.max(0, Math.min((e.clientX - rect.left) * scaleX, img.naturalWidth)),
      y: Math.max(0, Math.min((e.clientY - rect.top) * scaleY, img.naturalHeight))
    };
  };

  // Start drawing crop area - completely free-hand
  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (resizeHandle) return;
    const pos = getRelativePosition(e);
    setIsDragging(true);
    setDragStart(pos);
    setCropArea({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  // Update crop area while dragging - no minimum size restriction during drawing
  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!cropImageRef.current) return;
    const img = cropImageRef.current;
    const pos = getRelativePosition(e);

    if (resizeHandle && cropArea && dragStart) {
      // Handle resize - free-hand, no minimum
      let newArea = { ...cropArea };
      
      if (resizeHandle.includes('e')) {
        newArea.width = Math.max(1, Math.min(pos.x - cropArea.x, img.naturalWidth - cropArea.x));
      }
      if (resizeHandle.includes('w')) {
        const newX = Math.max(0, Math.min(pos.x, cropArea.x + cropArea.width - 1));
        newArea.width = cropArea.x + cropArea.width - newX;
        newArea.x = newX;
      }
      if (resizeHandle.includes('s')) {
        newArea.height = Math.max(1, Math.min(pos.y - cropArea.y, img.naturalHeight - cropArea.y));
      }
      if (resizeHandle.includes('n')) {
        const newY = Math.max(0, Math.min(pos.y, cropArea.y + cropArea.height - 1));
        newArea.height = cropArea.y + cropArea.height - newY;
        newArea.y = newY;
      }
      
      setCropArea(newArea);
    } else if (isDragging && dragStart) {
      // Draw new selection - completely free
      const x = Math.min(dragStart.x, pos.x);
      const y = Math.min(dragStart.y, pos.y);
      const width = Math.abs(pos.x - dragStart.x);
      const height = Math.abs(pos.y - dragStart.y);
      
      // Clamp to image bounds only
      setCropArea({
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: Math.min(width, img.naturalWidth - Math.max(0, x)),
        height: Math.min(height, img.naturalHeight - Math.max(0, y))
      });
    }
  };

  // Finish drawing/resizing crop area
  const handleCropMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
    setResizeHandle(null);
  };

  // Start resize handle drag
  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    setResizeHandle(handle);
    setDragStart(getRelativePosition(e));
  };

  // Apply crop to staged file - allow any size
  const applyCrop = async () => {
    if (!cropImage || !cropArea || !cropImageRef.current) return;
    if (cropArea.width < 1 || cropArea.height < 1) {
      setError('Please select a crop area');
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = Math.round(cropArea.width);
      canvas.height = Math.round(cropArea.height);

      // Draw cropped area to canvas
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = cropImage.preview || '';
      });

      ctx.drawImage(
        img,
        Math.round(cropArea.x), Math.round(cropArea.y), 
        Math.round(cropArea.width), Math.round(cropArea.height),
        0, 0, Math.round(cropArea.width), Math.round(cropArea.height)
      );

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create blob'));
        }, cropImage.file.type, 0.92);
      });

      // Create new file from cropped blob
      const ext = getFileExtension(cropImage.originalName);
      const croppedFile = new File(
        [blob],
        cropImage.customName + '_cropped' + ext,
        { type: cropImage.file.type }
      );

      // Create new preview URL
      const newPreview = URL.createObjectURL(blob);

      // Update staged file with cropped version
      setStagedFiles(prev => prev.map(sf => {
        if (sf.id === cropImage.id) {
          // Revoke old preview URL
          if (sf.preview) URL.revokeObjectURL(sf.preview);
          return {
            ...sf,
            file: croppedFile,
            customName: sf.customName + '_cropped',
            preview: newPreview
          };
        }
        return sf;
      }));

      closeCropModal();
    } catch (err) {
      console.error('Crop error:', err);
      setError('Failed to crop image');
    }
  };

  // ==================== VIDEO TRIM FUNCTIONS ====================

  // Open video trim modal for staged file
  const openTrimModal = (sf: StagedFile) => {
    setTrimVideo(sf);
    setTrimRange({ start: 0, end: 0 });
    setVideoDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setIsMuted(false);
  };

  // Close trim modal
  const closeTrimModal = () => {
    setTrimVideo(null);
    setTrimRange({ start: 0, end: 0 });
    setVideoDuration(0);
    setCurrentTime(0);
    setIsPlaying(false);
    setIsMuted(false);
  };

  // Handle video metadata loaded
  const handleVideoLoaded = () => {
    if (!trimVideoRef.current || !trimVideo) return;
    
    const video = trimVideoRef.current;
    let duration = video.duration;
    
    // First check if we have a known duration stored (from previous trim)
    if (trimVideo.knownDuration && trimVideo.knownDuration > 0) {
      setVideoDuration(trimVideo.knownDuration);
      const initialRange = { start: 0, end: trimVideo.knownDuration };
      setTrimRange(initialRange);
      setOriginalTrimRange(initialRange); // Store original to detect changes
      setCurrentTime(0);
      return;
    }
    
    // Check if duration is valid
    if (isFinite(duration) && !isNaN(duration) && duration > 0) {
      setVideoDuration(duration);
      const initialRange = { start: 0, end: duration };
      setTrimRange(initialRange);
      setOriginalTrimRange(initialRange); // Store original to detect changes
      setCurrentTime(0);
      return;
    }
    
    // For webm blobs, duration is often Infinity - use seek trick
    const fixDuration = async () => {
      try {
        // Seek to end to get actual duration
        video.currentTime = 1e101; // Very large number
        
        video.addEventListener('seeked', function onSeeked() {
          video.removeEventListener('seeked', onSeeked);
          
          const actualDuration = video.duration;
          if (isFinite(actualDuration) && !isNaN(actualDuration) && actualDuration > 0) {
            // Seek back to start
            video.currentTime = 0;
            setVideoDuration(actualDuration);
            const initialRange = { start: 0, end: actualDuration };
            setTrimRange(initialRange);
            setOriginalTrimRange(initialRange); // Store original to detect changes
            setCurrentTime(0);
          }
        }, { once: true });
      } catch (e) {
        console.warn('Could not determine video duration:', e);
      }
    };
    
    fixDuration();
  };

  // Handle video time update
  const handleVideoTimeUpdate = () => {
    if (trimVideoRef.current) {
      setCurrentTime(trimVideoRef.current.currentTime);
      // Auto-pause at trim end
      if (trimVideoRef.current.currentTime >= trimRange.end && isPlaying) {
        trimVideoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  // Toggle play/pause
  const togglePlayPause = () => {
    if (trimVideoRef.current) {
      if (isPlaying) {
        trimVideoRef.current.pause();
      } else {
        // Start from trim start if at end or before start
        if (trimVideoRef.current.currentTime >= trimRange.end || trimVideoRef.current.currentTime < trimRange.start) {
          trimVideoRef.current.currentTime = trimRange.start;
        }
        trimVideoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Seek video to position
  const seekVideo = (time: number) => {
    if (trimVideoRef.current) {
      trimVideoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Format time as M:SS for short display
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format time as HH:MM:SS for inputs
  const formatTimeHMS = (seconds: number) => {
    if (!isFinite(seconds) || isNaN(seconds)) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Parse HH:MM:SS to seconds
  const parseTimeHMS = (timeStr: string): number => {
    const parts = timeStr.split(':').map(p => parseInt(p) || 0);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return parts[0] || 0;
  };

  // Handle trim range change from slider
  const handleTrimStartChange = (value: number) => {
    const newStart = Math.min(value, trimRange.end - 0.1);
    setTrimRange(prev => ({ ...prev, start: Math.max(0, newStart) }));
    seekVideo(newStart);
  };

  const handleTrimEndChange = (value: number) => {
    const newEnd = Math.max(value, trimRange.start + 0.1);
    setTrimRange(prev => ({ ...prev, end: Math.min(videoDuration, newEnd) }));
  };

  // Handle time input change
  const handleStartTimeInput = (timeStr: string) => {
    const seconds = parseTimeHMS(timeStr);
    if (seconds >= 0 && seconds < trimRange.end) {
      setTrimRange(prev => ({ ...prev, start: seconds }));
      seekVideo(seconds);
    }
  };

  const handleEndTimeInput = (timeStr: string) => {
    const seconds = parseTimeHMS(timeStr);
    if (seconds > trimRange.start && seconds <= videoDuration) {
      setTrimRange(prev => ({ ...prev, end: seconds }));
    }
  };

  // Handle range slider drag (dual handle)
  const handleRangeSliderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * videoDuration;
    
    // Seek to clicked position
    seekVideo(time);
  };

  // State for trim processing
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimProgress, setTrimProgress] = useState(0);

  // Simple and reliable trim using MediaRecorder
  const applyTrim = async () => {
    if (!trimVideo || !trimVideoRef.current) return;
    
    const duration = trimRange.end - trimRange.start;
    if (duration < 0.5) {
      setError('Please select at least 0.5 seconds of video');
      return;
    }

    setIsTrimming(true);
    setTrimProgress(0);
    setError('');

    try {
      // Check if already webm to avoid quality loss from re-encoding
      const isAlreadyWebm = trimVideo.file.type === 'video/webm' || 
                            trimVideo.originalName.toLowerCase().endsWith('.webm');
      
      // Create video element for processing
      const video = document.createElement('video');
      video.src = trimVideo.preview || '';
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      // Keep audio unmuted and at full volume for capture
      video.muted = false;
      video.volume = 1;
      
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video'));
        setTimeout(() => reject(new Error('Video load timeout')), 10000);
      });

      setTrimProgress(10);

      // Create canvas for capturing
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Get best supported mime type - use higher quality for first encode
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
        ? 'video/webm;codecs=vp8,opus'
        : 'video/webm';

      // Create canvas stream with high framerate
      const canvasStream = canvas.captureStream(30);
      
      // Setup audio capture BEFORE any playback
      let audioCtx: AudioContext | null = null;
      let audioSource: MediaElementAudioSourceNode | null = null;
      let audioDest: MediaStreamAudioDestinationNode | null = null;
      
      try {
        audioCtx = new AudioContext();
        // Resume audio context (required for some browsers)
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        audioSource = audioCtx.createMediaElementSource(video);
        audioDest = audioCtx.createMediaStreamDestination();
        // Connect source to destination for recording
        audioSource.connect(audioDest);
        // Also connect to speakers so we can hear it (optional, but helps with sync)
        audioSource.connect(audioCtx.destination);
        
        const audioTrack = audioDest.stream.getAudioTracks()[0];
        if (audioTrack) {
          canvasStream.addTrack(audioTrack);
          console.log('Audio track added successfully');
        }
      } catch (e) {
        console.warn('Audio capture setup failed:', e);
      }

      // Setup recorder - use higher bitrate if re-encoding to minimize quality loss
      const videoBitrate = isAlreadyWebm ? 8000000 : 5000000; // 8 Mbps for re-encode, 5 Mbps for first encode
      const recorder = new MediaRecorder(canvasStream, { 
        mimeType, 
        videoBitsPerSecond: videoBitrate,
        audioBitsPerSecond: 128000 // 128 kbps audio
      });
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { 
        if (e.data.size > 0) chunks.push(e.data); 
      };

      setTrimProgress(15);

      // Seek to start position
      video.currentTime = trimRange.start;
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });

      setTrimProgress(20);

      // Start recording and playing
      recorder.start(100);
      
      // Small delay to ensure recorder is ready
      await new Promise(r => setTimeout(r, 50));
      
      await video.play();

      // Capture frames until we reach trim end
      await new Promise<void>((resolve) => {
        const checkAndDraw = () => {
          if (video.currentTime >= trimRange.end - 0.05 || video.paused || video.ended) {
            video.pause();
            setTimeout(() => {
              if (recorder.state === 'recording') {
                recorder.stop();
              }
              resolve();
            }, 200);
            return;
          }
          
          // Draw frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Update progress (20-90%)
          const elapsed = video.currentTime - trimRange.start;
          const progress = 20 + (elapsed / duration) * 70;
          setTrimProgress(Math.min(90, Math.round(progress)));
          
          requestAnimationFrame(checkAndDraw);
        };
        checkAndDraw();
      });

      // Wait for recorder to finish
      const outputBlob = await new Promise<Blob>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Recording timeout')), 5000);
        recorder.onstop = () => {
          clearTimeout(timeout);
          if (chunks.length === 0) {
            reject(new Error('No video data recorded'));
            return;
          }
          resolve(new Blob(chunks, { type: mimeType }));
        };
      });

      setTrimProgress(95);

      // Cleanup audio context
      if (audioSource) {
        try { audioSource.disconnect(); } catch (e) { /* ignore */ }
      }
      if (audioCtx) {
        try { await audioCtx.close(); } catch (e) { /* ignore */ }
      }
      video.pause();
      video.src = '';

      if (outputBlob.size < 1000) {
        throw new Error('Trimmed video is too small');
      }

      // Create new file
      const trimmedFile = new File(
        [outputBlob], 
        `${trimVideo.customName}_trimmed.webm`,
        { type: mimeType }
      );
      const newPreview = URL.createObjectURL(outputBlob);

      // Update staged files
      setStagedFiles(prev => prev.map(sf => {
        if (sf.id === trimVideo.id) {
          if (sf.preview) URL.revokeObjectURL(sf.preview);
          return {
            ...sf,
            file: trimmedFile,
            customName: `${trimVideo.customName}_trimmed`,
            originalName: trimmedFile.name,
            preview: newPreview,
            knownDuration: duration
          };
        }
        return sf;
      }));

      setTrimProgress(100);
      setTimeout(() => {
        closeTrimModal();
        setIsTrimming(false);
        setTrimProgress(0);
      }, 500);

    } catch (err: any) {
      console.error('Trim error:', err);
      setError(`Failed to trim video: ${err.message || 'Unknown error'}`);
      setIsTrimming(false);
      setTrimProgress(0);
    }
  };

  // Image URL helper
  const getImageUrl = (file: EvidenceFile) => {
    if (!file.filePath) return '';
    if (file.filePath.startsWith('http')) return file.filePath;
    
    let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002/api';
    baseUrl = baseUrl.replace(/\/api\/?$/, '');
    
    let cleanPath = file.filePath;
    if (cleanPath.startsWith('./')) cleanPath = cleanPath.substring(1);
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
    
    return `${baseUrl}${cleanPath}`;
  };

  const openImagePreview = (file: EvidenceFile) => {
    setImageLoaded(false);
    setPreviewImage(file);
  };

  const closeImagePreview = () => {
    setPreviewImage(null);
    setImageLoaded(false);
  };

  const filteredEvidence = evidence.filter(e => e.type === activeTab);
  const filteredStagedFiles = stagedFiles.filter(sf => sf.type === activeTab);
  const totalCount = (type: string) => 
    evidence.filter(e => e.type === type).length + stagedFiles.filter(sf => sf.type === type).length;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
          Evidence Attachments
        </h3>
        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
          {evidence.length + stagedFiles.length} file(s)
        </span>
      </div>

      {error && (
        <div className="p-2 sm:p-3 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg text-danger-700 dark:text-danger-300 text-xs sm:text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 sm:gap-2 border-b border-gray-200 dark:border-slate-600 overflow-x-auto">
        {(['PHOTO', 'VIDEO', 'DOCUMENT', 'VOICE_RECORDING'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation ${
              activeTab === tab
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'PHOTO' && '📸'} {tab === 'VIDEO' && '🎥'} {tab === 'DOCUMENT' && '📄'} {tab === 'VOICE_RECORDING' && '🎤'}
            {' '}<span className="hidden sm:inline">{tab === 'VOICE_RECORDING' ? 'Voice' : tab.charAt(0) + tab.slice(1).toLowerCase() + 's'}</span> ({totalCount(tab)})
          </button>
        ))}
      </div>

      {/* Upload Section */}
      <div className="space-y-2 sm:space-y-3">
        {activeTab === 'PHOTO' && (
          <div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              disabled={disabled || uploading}
              onChange={(e) => handleFileSelect(e.target.files, 'PHOTO')}
              className="hidden"
              id="photo-upload"
            />
            <label
              htmlFor="photo-upload"
              className={`block w-full px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                disabled || uploading
                  ? 'border-gray-300 dark:border-slate-600 text-gray-400 cursor-not-allowed'
                  : 'border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10'
              }`}
            >
              📸 <span className="hidden sm:inline">Upload Photos (JPG, PNG, GIF, WebP) - </span>Max 10MB<span className="hidden sm:inline"> each</span>
            </label>
          </div>
        )}

        {activeTab === 'VIDEO' && (
          <div>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/*"
              multiple
              disabled={disabled || uploading}
              onChange={(e) => handleFileSelect(e.target.files, 'VIDEO')}
              className="hidden"
              id="video-upload"
            />
            <label
              htmlFor="video-upload"
              className={`block w-full px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                disabled || uploading
                  ? 'border-gray-300 dark:border-slate-600 text-gray-400 cursor-not-allowed'
                  : 'border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10'
              }`}
            >
              🎥 <span className="hidden sm:inline">Upload Videos (MP4, MOV, AVI) - </span>Max 50MB<span className="hidden sm:inline"> each</span>
            </label>
          </div>
        )}

        {activeTab === 'DOCUMENT' && (
          <div>
            <input
              ref={documentInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              multiple
              disabled={disabled || uploading}
              onChange={(e) => handleFileSelect(e.target.files, 'DOCUMENT')}
              className="hidden"
              id="document-upload"
            />
            <label
              htmlFor="document-upload"
              className={`block w-full px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${
                disabled || uploading
                  ? 'border-gray-300 dark:border-slate-600 text-gray-400 cursor-not-allowed'
                  : 'border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10'
              }`}
            >
              📄 <span className="hidden sm:inline">Upload Documents (PDF, Word, Excel) - </span>Max 25MB<span className="hidden sm:inline"> each</span>
            </label>
          </div>
        )}

        {activeTab === 'VOICE_RECORDING' && (
          <div className="p-3 sm:p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
            {!isRecording && !audioUrl && (
              <div className="text-center">
                <button
                  onClick={startRecording}
                  disabled={disabled}
                  className={`inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base rounded-full text-white font-medium transition-all touch-manipulation ${
                    disabled ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 hover:scale-105'
                  }`}
                >
                  <span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-white animate-pulse"></span>
                  Start Recording
                </button>
                <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  🎤 Tap to start <span className="hidden sm:inline">recording voice note </span>(Max 25MB)
                </p>
              </div>
            )}

            {isRecording && (
              <div className="text-center">
                <div className="mb-3 sm:mb-4">
                  <div className="inline-flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                    <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-500 animate-pulse"></span>
                    <span className="text-xl sm:text-2xl font-mono text-red-600 dark:text-red-400">
                      {formatRecordingTime(recordingTime)}
                    </span>
                    {isTranscribing && (
                      <span className="text-[10px] sm:text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <span className="hidden sm:inline">Transcribing</span>
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Live Transcription Display */}
                {transcription && (
                  <div className="mb-3 sm:mb-4 mx-auto max-w-lg p-2 sm:p-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600 text-left">
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mb-1">📝 Live Transcription:</p>
                    <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 italic">{transcription}</p>
                  </div>
                )}
                
                <div className="flex justify-center gap-2 sm:gap-4">
                  <button
                    onClick={stopRecording}
                    className="px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium touch-manipulation"
                  >
                    ⏹️ Stop
                  </button>
                  <button
                    onClick={cancelRecording}
                    className="px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 font-medium touch-manipulation"
                  >
                    ✖️ Cancel
                  </button>
                </div>
              </div>
            )}

            {audioUrl && !isRecording && (
              <div className="space-y-3 sm:space-y-4 text-center">
                <p className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                  Recording Complete ({formatRecordingTime(recordingTime)})
                </p>
                <audio controls className="w-full max-w-md mx-auto">
                  <source src={audioUrl} type="audio/webm" />
                </audio>
                
                {/* Editable Transcription */}
                <div className="mx-auto max-w-lg text-left">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    📝 Transcription {transcription ? '' : '(No speech detected)'}
                  </label>
                  <textarea
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    placeholder="No transcription available. You can type or paste the text here..."
                    className="w-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Edit the transcription if needed.
                  </p>
                </div>
                
                <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
                  <button
                    onClick={saveVoiceRecording}
                    className="px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium touch-manipulation"
                  >
                    ✅ Add
                  </button>
                  <button
                    onClick={cancelRecording}
                    className="px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 font-medium touch-manipulation"
                  >
                    🗑️ Discard
                  </button>
                  <button
                    onClick={startRecording}
                    className="px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium touch-manipulation"
                  >
                    🔄 Redo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Staged Files - Ready to upload on Submit */}
      {filteredStagedFiles.length > 0 && (
        <div className="space-y-1.5 sm:space-y-2">
          <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 sm:gap-2">
            <span>📎</span> Attached ({filteredStagedFiles.length})
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-normal hidden sm:inline">
              - Click filename to rename{activeTab === 'PHOTO' ? ', click image to crop' : activeTab === 'VIDEO' ? ', click video to trim' : ''}
            </span>
          </h4>
          <div className="space-y-1.5 sm:space-y-2">
            {filteredStagedFiles.map((sf) => (
              <div key={sf.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                {/* Preview - Clickable for photo (crop) and video (trim) */}
                {sf.type === 'PHOTO' && sf.preview && (
                  <button 
                    onClick={() => openCropModal(sf)}
                    className="relative group w-10 h-10 sm:w-12 sm:h-12 rounded overflow-hidden border-2 border-transparent hover:border-primary-500 transition-colors flex-shrink-0"
                    title="Click to view full size & crop"
                  >
                    <img src={sf.preview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs">✂️</span>
                    </div>
                  </button>
                )}
                {sf.type === 'VIDEO' && sf.preview && (
                  <button 
                    onClick={() => openTrimModal(sf)}
                    className="relative group w-10 h-10 sm:w-12 sm:h-12 rounded overflow-hidden border-2 border-transparent hover:border-primary-500 transition-colors flex-shrink-0"
                    title="Click to preview & trim"
                  >
                    <video src={sf.preview} className="w-full h-full object-cover" muted />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs">✂️</span>
                    </div>
                  </button>
                )}
                {(sf.type === 'DOCUMENT' || sf.type === 'VOICE_RECORDING') && (
                  sf.type === 'DOCUMENT' ? (
                    <button
                      onClick={() => {
                        // Create a download link to open the file
                        const link = document.createElement('a');
                        link.href = sf.preview || URL.createObjectURL(sf.file);
                        link.download = sf.customName + getFileExtension(sf.originalName);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="group w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gray-100 dark:bg-slate-600 rounded hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors cursor-pointer flex-shrink-0"
                      title="Click to download & open document"
                    >
                      <span className="text-xl sm:text-2xl group-hover:scale-110 transition-transform">📄</span>
                    </button>
                  ) : (
                    <span className="text-xl sm:text-2xl w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gray-100 dark:bg-slate-600 rounded flex-shrink-0">
                      🎤
                    </span>
                  )
                )}
                
                {/* Filename - Click to edit */}
                <div className="flex-1 min-w-0">
                  {sf.isEditing ? (
                    <div className="flex items-center gap-1">
                      <input
                        ref={editingInputRef}
                        type="text"
                        value={sf.customName}
                        onChange={(e) => updateStagedFileName(sf.id, e.target.value)}
                        onBlur={() => finishEditing(sf.id)}
                        onKeyDown={(e) => handleKeyDown(e, sf.id)}
                        autoFocus
                        className="flex-1 px-2 py-1 text-xs sm:text-sm border border-primary-400 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      />
                      <span className="text-[10px] sm:text-xs text-gray-500">{getFileExtension(sf.originalName)}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditing(sf.id)}
                      className="text-left w-full group"
                    >
                      <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400">
                        {sf.customName}<span className="text-gray-500">{getFileExtension(sf.originalName)}</span>
                        <span className="ml-1 sm:ml-2 text-[10px] sm:text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
                      </p>
                    </button>
                  )}
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    <span className="hidden sm:inline">Original: {sf.originalName} • </span>{formatFileSize(sf.file.size)}
                  </p>
                </div>

                {/* Audio preview for voice recordings */}
                {sf.type === 'VOICE_RECORDING' && sf.preview && (
                  <CompactAudioPlayer src={sf.preview} type="audio/webm" />
                )}

                {/* Remove button */}
                <button
                  onClick={() => removeStagedFile(sf.id)}
                  className="text-danger-600 hover:text-danger-700 dark:text-danger-400 p-1.5 sm:p-2 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded touch-manipulation flex-shrink-0"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uploaded Evidence List */}
      {filteredEvidence.length > 0 && (
        <div className="space-y-1.5 sm:space-y-2">
          <h4 className="text-xs sm:text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-1.5 sm:gap-2">
            <span>✅</span> Uploaded ({filteredEvidence.length})
          </h4>
          <div className="space-y-1.5 sm:space-y-2">
            {filteredEvidence.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
              >
                <div 
                  className={`flex items-center gap-2 sm:gap-3 flex-1 min-w-0 ${
                    file.type === 'PHOTO' || file.type === 'DOCUMENT' ? 'cursor-pointer hover:opacity-80' : ''
                  }`}
                  onClick={() => {
                    if (file.type === 'PHOTO') {
                      openImagePreview(file);
                    } else if (file.type === 'DOCUMENT') {
                      // Trigger download so it opens in native app
                      const link = document.createElement('a');
                      link.href = getImageUrl(file);
                      link.download = file.fileName;
                      link.target = '_blank';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  }}
                >
                  {file.type === 'PHOTO' && (
                    <img 
                      src={getImageUrl(file)} 
                      alt={file.fileName}
                      className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded bg-gray-200 dark:bg-slate-600 flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  {file.type === 'DOCUMENT' && (
                    <span 
                      className="text-xl sm:text-2xl w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gray-100 dark:bg-slate-600 rounded hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors flex-shrink-0"
                      title="Click to download & open document"
                    >
                      {getFileIcon(file.mimeType)}
                    </span>
                  )}
                  {file.type !== 'PHOTO' && file.type !== 'DOCUMENT' && (
                    <span className="text-xl sm:text-2xl w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gray-100 dark:bg-slate-600 rounded flex-shrink-0">
                      {getFileIcon(file.mimeType)}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
                      {file.fileName}
                    </p>
                    <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.fileSize)}
                      {file.type === 'PHOTO' && <span className="ml-1 sm:ml-2 text-primary-500 hidden sm:inline">(Click to preview)</span>}
                      {file.type === 'DOCUMENT' && <span className="ml-1 sm:ml-2 text-primary-500 hidden sm:inline">(Click to download)</span>}
                    </p>
                  </div>
                </div>
                {file.type === 'VOICE_RECORDING' && (
                  <div className="mx-2 sm:mx-3">
                    <CompactAudioPlayer src={getImageUrl(file)} type={file.mimeType} />
                  </div>
                )}
                {!disabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(file.id);
                    }}
                    className="text-danger-600 hover:text-danger-700 dark:text-danger-400 text-xs sm:text-sm font-medium ml-2 sm:ml-3 touch-manipulation flex-shrink-0"
                  >
                    <span className="hidden sm:inline">Delete</span>
                    <span className="sm:hidden">✕</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {filteredEvidence.length === 0 && filteredStagedFiles.length === 0 && (
        <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
          No {activeTab.toLowerCase().replace('_', ' ')} files added yet
        </div>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-8 text-center shadow-xl">
            <div className="w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg font-medium text-gray-900 dark:text-white">Uploading Evidence...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Please wait while files are being uploaded</p>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={closeImagePreview}
        >
          <div 
            className="relative w-full max-w-5xl bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 bg-gray-100 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{previewImage.fileName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(previewImage.fileSize)}</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={getImageUrl(previewImage)}
                  download={previewImage.fileName}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                >
                  ⬇️ Download
                </a>
                <button
                  onClick={closeImagePreview}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium text-sm"
                >
                  ✕ Close
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center bg-gray-900 min-h-[400px] max-h-[70vh] overflow-auto p-4">
              {!imageLoaded && (
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <div className="w-8 h-8 border-4 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading image...</span>
                </div>
              )}
              <img
                src={getImageUrl(previewImage)}
                alt={previewImage.fileName}
                className={`max-w-full max-h-[65vh] object-contain ${imageLoaded ? 'block' : 'hidden'}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(true)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Image Crop Modal (for staged files) - Clean Free-hand Design */}
      {cropImage && cropImage.preview && (
        <div 
          className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 p-4"
          onClick={closeCropModal}
        >
          <div 
            className="relative w-full max-w-5xl bg-slate-800 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="text-center py-4 px-4 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white mb-1">Crop Image</h2>
              <p className="text-slate-400 text-sm">
                Draw freely to select any area you want to crop
              </p>
            </div>
            
            {/* Crop Canvas - Full width, better interaction */}
            <div 
              ref={cropContainerRef}
              className="relative bg-slate-900 flex items-center justify-center cursor-crosshair"
              style={{ minHeight: '400px', maxHeight: '60vh' }}
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onMouseLeave={handleCropMouseUp}
            >
              <img
                ref={cropImageRef}
                src={cropImage.preview}
                alt="Crop preview"
                className="max-w-full max-h-[55vh] object-contain select-none"
                onLoad={handleCropImageLoad}
                draggable={false}
              />
              
              {/* Crop overlay and selection */}
              {cropArea && cropArea.width > 0 && cropArea.height > 0 && cropImageRef.current && (
                <>
                  {/* Semi-transparent overlay on entire image */}
                  <div 
                    className="absolute pointer-events-none bg-black/50"
                    style={{
                      left: cropImageRef.current.offsetLeft,
                      top: cropImageRef.current.offsetTop,
                      width: cropImageRef.current.clientWidth,
                      height: cropImageRef.current.clientHeight,
                    }}
                  />
                  
                  {/* Clear crop selection area */}
                  <div
                    className="absolute border-2 border-cyan-400 bg-transparent pointer-events-none"
                    style={{
                      left: cropImageRef.current.offsetLeft + (cropArea.x / cropImageRef.current.naturalWidth) * cropImageRef.current.clientWidth,
                      top: cropImageRef.current.offsetTop + (cropArea.y / cropImageRef.current.naturalHeight) * cropImageRef.current.clientHeight,
                      width: (cropArea.width / cropImageRef.current.naturalWidth) * cropImageRef.current.clientWidth,
                      height: (cropArea.height / cropImageRef.current.naturalHeight) * cropImageRef.current.clientHeight,
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                    }}
                  >
                    {/* Grid lines for alignment */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                      <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                      <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                      <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
                    </div>
                    
                    {/* Corner resize handles */}
                    {['nw', 'ne', 'sw', 'se'].map(handle => (
                      <div
                        key={handle}
                        className="absolute w-4 h-4 bg-cyan-400 rounded-full border-2 border-white shadow-lg pointer-events-auto"
                        style={{
                          top: handle.includes('n') ? -8 : 'auto',
                          bottom: handle.includes('s') ? -8 : 'auto',
                          left: handle.includes('w') ? -8 : 'auto',
                          right: handle.includes('e') ? -8 : 'auto',
                          cursor: handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize',
                        }}
                        onMouseDown={(e) => handleResizeStart(e, handle)}
                      />
                    ))}
                    
                    {/* Edge resize handles */}
                    {['n', 's', 'e', 'w'].map(handle => (
                      <div
                        key={handle}
                        className="absolute bg-cyan-400 rounded-full shadow-lg pointer-events-auto"
                        style={{
                          width: handle === 'n' || handle === 's' ? 24 : 8,
                          height: handle === 'e' || handle === 'w' ? 24 : 8,
                          top: handle === 'n' ? -4 : handle === 's' ? 'auto' : '50%',
                          bottom: handle === 's' ? -4 : 'auto',
                          left: handle === 'w' ? -4 : handle === 'e' ? 'auto' : '50%',
                          right: handle === 'e' ? -4 : 'auto',
                          transform: (handle === 'n' || handle === 's') ? 'translateX(-50%)' : 'translateY(-50%)',
                          cursor: handle === 'n' || handle === 's' ? 'ns-resize' : 'ew-resize',
                        }}
                        onMouseDown={(e) => handleResizeStart(e, handle)}
                      />
                    ))}
                  </div>
                  
                  {/* Size indicator */}
                  <div 
                    className="absolute px-2 py-1 bg-slate-800/90 text-cyan-400 text-xs rounded font-mono whitespace-nowrap pointer-events-none"
                    style={{
                      left: cropImageRef.current.offsetLeft + (cropArea.x / cropImageRef.current.naturalWidth) * cropImageRef.current.clientWidth,
                      top: cropImageRef.current.offsetTop + (cropArea.y / cropImageRef.current.naturalHeight) * cropImageRef.current.clientHeight - 28,
                    }}
                  >
                    {Math.round(cropArea.width)} × {Math.round(cropArea.height)} px
                  </div>
                </>
              )}
              
              {/* Instructions when no selection */}
              {(!cropArea || cropArea.width === 0) && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="px-4 py-2 bg-slate-800/80 rounded-lg text-slate-300 text-sm">
                    Click and drag to select crop area
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer with actions */}
            <div className="flex items-center justify-between p-4 bg-slate-800 border-t border-slate-700">
              <div className="text-sm text-slate-400">
                {cropArea && cropArea.width > 0 ? (
                  <span>Selected: <span className="text-cyan-400 font-mono">{Math.round(cropArea.width)} × {Math.round(cropArea.height)}</span> pixels</span>
                ) : (
                  <span>Original: {formatFileSize(cropImage.file.size)}</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setCropArea(null)}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 font-medium text-sm transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={closeCropModal}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={applyCrop}
                  disabled={!cropArea || cropArea.width < 1 || cropArea.height < 1}
                  className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${
                    cropArea && cropArea.width > 0 && cropArea.height > 0
                      ? 'bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 text-slate-900 hover:from-cyan-300 hover:via-teal-200 hover:to-emerald-300 shadow-xl shadow-cyan-400/50 ring-2 ring-cyan-300/50'
                      : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  Apply Crop
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Video Trim Modal (for staged files) - Modern Design */}
      {trimVideo && trimVideo.preview && (
        <div 
          className="fixed inset-0 bg-slate-900 flex items-center justify-center z-50 p-4"
          onClick={closeTrimModal}
        >
          <div 
            className="relative w-full max-w-3xl bg-slate-800 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="text-center py-6 px-4">
              <h2 className="text-2xl font-bold text-white mb-2">Video Trimmer</h2>
              <p className="text-slate-400 text-sm">
                Trim your video easily with the slider or input specific start and end times.
              </p>
            </div>
            
            {/* Video Preview with Play Button Overlay */}
            <div className="relative bg-black mx-4 rounded-lg overflow-hidden">
              <video
                ref={trimVideoRef}
                src={trimVideo.preview}
                className="w-full max-h-[40vh] object-contain"
                preload="metadata"
                muted={isMuted}
                playsInline
                onLoadedMetadata={handleVideoLoaded}
                onLoadedData={handleVideoLoaded}
                onDurationChange={handleVideoLoaded}
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onClick={togglePlayPause}
              />
              
              {/* Play button overlay */}
              {!isPlaying && (
                <button
                  onClick={togglePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
                >
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <svg className="w-8 h-8 text-slate-800 ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </button>
              )}
              
              {/* Time display on video */}
              <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/70 rounded text-white text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(videoDuration)}
              </div>
              
              {/* Video controls */}
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 bg-black/70 rounded hover:bg-black/90 text-white transition-colors"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? '🔇' : '🔊'}
                </button>
                <button 
                  onClick={() => {
                    if (trimVideoRef.current) {
                      if (trimVideoRef.current.requestFullscreen) {
                        trimVideoRef.current.requestFullscreen();
                      }
                    }
                  }}
                  className="p-2 bg-black/70 rounded hover:bg-black/90 text-white"
                >
                  ⛶
                </button>
              </div>
            </div>
            
            {/* Timeline Range Slider - Modern dual handle design */}
            <div className="px-6 py-4">
              {/* Time markers */}
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>{formatTimeHMS(0)}</span>
                <span>{formatTimeHMS(videoDuration)}</span>
              </div>
              
              {/* Custom range slider track */}
              <div 
                className="relative h-2 bg-slate-600 rounded-full cursor-pointer"
                onClick={handleRangeSliderClick}
              >
                {/* Selected range (cyan/teal color like reference) */}
                <div 
                  className="absolute h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full"
                  style={{
                    left: `${(trimRange.start / videoDuration) * 100}%`,
                    width: `${((trimRange.end - trimRange.start) / videoDuration) * 100}%`
                  }}
                />
                
                {/* Start trim handle - Left edge */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-cyan-400 rounded-full border-2 border-cyan-300 shadow-lg cursor-ew-resize hover:scale-110 hover:bg-cyan-300 transition-transform flex items-center justify-center group z-10"
                  style={{ left: `calc(${(trimRange.start / videoDuration) * 100}% - 12px)` }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const slider = e.currentTarget.parentElement;
                    if (!slider) return;
                    
                    const handleDrag = (moveEvent: MouseEvent) => {
                      const rect = slider.getBoundingClientRect();
                      const percent = Math.max(0, Math.min((moveEvent.clientX - rect.left) / rect.width, 1));
                      const newStart = percent * videoDuration;
                      // Ensure start doesn't go past end - 0.5s minimum
                      if (newStart < trimRange.end - 0.5) {
                        handleTrimStartChange(newStart);
                      }
                    };
                    const handleUp = () => {
                      document.removeEventListener('mousemove', handleDrag);
                      document.removeEventListener('mouseup', handleUp);
                    };
                    document.addEventListener('mousemove', handleDrag);
                    document.addEventListener('mouseup', handleUp);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const slider = e.currentTarget.parentElement;
                    if (!slider) return;
                    
                    const handleDrag = (moveEvent: TouchEvent) => {
                      const rect = slider.getBoundingClientRect();
                      const touch = moveEvent.touches[0];
                      const percent = Math.max(0, Math.min((touch.clientX - rect.left) / rect.width, 1));
                      const newStart = percent * videoDuration;
                      if (newStart < trimRange.end - 0.5) {
                        handleTrimStartChange(newStart);
                      }
                    };
                    const handleUp = () => {
                      document.removeEventListener('touchmove', handleDrag);
                      document.removeEventListener('touchend', handleUp);
                    };
                    document.addEventListener('touchmove', handleDrag);
                    document.addEventListener('touchend', handleUp);
                  }}
                >
                  {/* Inner dot indicator */}
                  <div className="w-2 h-2 bg-slate-800 rounded-full opacity-60 group-hover:opacity-80" />
                </div>
                
                {/* End trim handle - Right edge */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-cyan-400 rounded-full border-2 border-cyan-300 shadow-lg cursor-ew-resize hover:scale-110 hover:bg-cyan-300 transition-transform flex items-center justify-center group z-10"
                  style={{ left: `calc(${(trimRange.end / videoDuration) * 100}% - 12px)` }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const slider = e.currentTarget.parentElement;
                    if (!slider) return;
                    
                    const handleDrag = (moveEvent: MouseEvent) => {
                      const rect = slider.getBoundingClientRect();
                      const percent = Math.max(0, Math.min((moveEvent.clientX - rect.left) / rect.width, 1));
                      const newEnd = percent * videoDuration;
                      // Ensure end doesn't go before start + 0.5s minimum
                      if (newEnd > trimRange.start + 0.5) {
                        handleTrimEndChange(newEnd);
                      }
                    };
                    const handleUp = () => {
                      document.removeEventListener('mousemove', handleDrag);
                      document.removeEventListener('mouseup', handleUp);
                    };
                    document.addEventListener('mousemove', handleDrag);
                    document.addEventListener('mouseup', handleUp);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const slider = e.currentTarget.parentElement;
                    if (!slider) return;
                    
                    const handleDrag = (moveEvent: TouchEvent) => {
                      const rect = slider.getBoundingClientRect();
                      const touch = moveEvent.touches[0];
                      const percent = Math.max(0, Math.min((touch.clientX - rect.left) / rect.width, 1));
                      const newEnd = percent * videoDuration;
                      if (newEnd > trimRange.start + 0.5) {
                        handleTrimEndChange(newEnd);
                      }
                    };
                    const handleUp = () => {
                      document.removeEventListener('touchmove', handleDrag);
                      document.removeEventListener('touchend', handleUp);
                    };
                    document.addEventListener('touchmove', handleDrag);
                    document.addEventListener('touchend', handleUp);
                  }}
                >
                  {/* Inner dot indicator */}
                  <div className="w-2 h-2 bg-slate-800 rounded-full opacity-60 group-hover:opacity-80" />
                </div>
                
                {/* Current playhead - Draggable to scrub freely within trim range */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-8 bg-white rounded shadow-lg cursor-grab active:cursor-grabbing z-20 hover:bg-cyan-100 transition-colors border border-slate-300 select-none"
                  style={{ left: `calc(${(currentTime / videoDuration) * 100}% - 8px)` }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Pause video when scrubbing
                    if (trimVideoRef.current && isPlaying) {
                      trimVideoRef.current.pause();
                      setIsPlaying(false);
                    }
                    
                    const slider = e.currentTarget.parentElement;
                    if (!slider) return;
                    const rect = slider.getBoundingClientRect();
                    
                    const handleDrag = (moveEvent: MouseEvent) => {
                      // Calculate position freely
                      const x = moveEvent.clientX - rect.left;
                      const percent = x / rect.width;
                      const clampedPercent = Math.max(0, Math.min(1, percent));
                      const rawTime = clampedPercent * videoDuration;
                      
                      // Constrain within trim range
                      const newTime = Math.max(trimRange.start, Math.min(trimRange.end, rawTime));
                      
                      // Update UI immediately for smooth scrubbing
                      setCurrentTime(newTime);
                      
                      // Update video (may lag slightly but UI is smooth)
                      if (trimVideoRef.current) {
                        trimVideoRef.current.currentTime = newTime;
                      }
                    };
                    
                    const handleUp = () => {
                      document.removeEventListener('mousemove', handleDrag);
                      document.removeEventListener('mouseup', handleUp);
                      document.body.style.cursor = '';
                    };
                    
                    // Change cursor while dragging
                    document.body.style.cursor = 'grabbing';
                    document.addEventListener('mousemove', handleDrag);
                    document.addEventListener('mouseup', handleUp);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    
                    // Pause video when scrubbing
                    if (trimVideoRef.current && isPlaying) {
                      trimVideoRef.current.pause();
                      setIsPlaying(false);
                    }
                    
                    const slider = e.currentTarget.parentElement;
                    if (!slider) return;
                    const rect = slider.getBoundingClientRect();
                    
                    const handleDrag = (moveEvent: TouchEvent) => {
                      const touch = moveEvent.touches[0];
                      const x = touch.clientX - rect.left;
                      const percent = x / rect.width;
                      const clampedPercent = Math.max(0, Math.min(1, percent));
                      const rawTime = clampedPercent * videoDuration;
                      
                      // Constrain within trim range
                      const newTime = Math.max(trimRange.start, Math.min(trimRange.end, rawTime));
                      
                      // Update UI immediately
                      setCurrentTime(newTime);
                      
                      // Update video
                      if (trimVideoRef.current) {
                        trimVideoRef.current.currentTime = newTime;
                      }
                    };
                    
                    const handleUp = () => {
                      document.removeEventListener('touchmove', handleDrag);
                      document.removeEventListener('touchend', handleUp);
                    };
                    
                    document.addEventListener('touchmove', handleDrag, { passive: false });
                    document.addEventListener('touchend', handleUp);
                  }}
                  title="Drag to scrub through video"
                />
              </div>
              
              {/* Click anywhere on track to seek */}
              <p className="text-xs text-slate-500 mt-2 text-center">
                Drag the white playhead to preview • Drag cyan handles to set trim range
              </p>
            </div>
            
            {/* Time Input Fields - Grid layout like reference */}
            <div className="grid grid-cols-4 gap-4 px-6 pb-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Start</label>
                <input
                  type="text"
                  value={formatTimeHMS(trimRange.start)}
                  onChange={(e) => handleStartTimeInput(e.target.value)}
                  disabled={isTrimming}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">End</label>
                <input
                  type="text"
                  value={formatTimeHMS(trimRange.end)}
                  onChange={(e) => handleEndTimeInput(e.target.value)}
                  disabled={isTrimming}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-center font-mono text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Duration</label>
                <div className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 text-center font-mono text-sm">
                  {isFinite(trimRange.end - trimRange.start) ? Math.round(trimRange.end - trimRange.start) : 0}s
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Output</label>
                <div className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-300 text-center text-sm">
                  {(() => {
                    const isWebm = trimVideo.file.type === 'video/webm' || trimVideo.originalName.toLowerCase().endsWith('.webm');
                    if (trimVideo.knownDuration) {
                      return <span className="text-amber-400">webm (re-trim)</span>;
                    }
                    return isWebm ? 'webm' : `${trimVideo.file.name.split('.').pop()?.toUpperCase()} → webm`;
                  })()}
                </div>
              </div>
            </div>
            
            {/* Done Button with Progress */}
            <div className="px-6 pb-6">
              {isTrimming ? (
                <div className="space-y-2">
                  <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-300"
                      style={{ width: `${trimProgress}%` }}
                    />
                  </div>
                  <p className="text-center text-slate-400 text-sm">
                    Processing video... {Math.round(trimProgress)}%
                  </p>
                </div>
              ) : (() => {
                // Check if trim range has changed from original
                const hasRangeChanges = Math.abs(trimRange.start - originalTrimRange.start) > 0.01 || 
                                        Math.abs(trimRange.end - originalTrimRange.end) > 0.01;
                // Check if trim duration equals full video duration (no actual trim)
                const trimDuration = trimRange.end - trimRange.start;
                const isFullDuration = Math.abs(trimDuration - videoDuration) < 0.05;
                // Has changes only if range changed AND it's not still the full duration
                const hasChanges = hasRangeChanges && !isFullDuration;
                const isValidDuration = trimDuration >= 0.5;
                const canApplyTrim = hasChanges && isValidDuration;
                
                return (
                  <div className="space-y-2">
                    <button
                      onClick={applyTrim}
                      disabled={!canApplyTrim}
                      className="w-full py-3 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-900 font-bold text-lg rounded-xl hover:from-cyan-400 hover:to-teal-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      Done!
                    </button>
                    {!hasChanges && isValidDuration && (
                      <p className="text-center text-slate-500 text-xs">
                        Adjust the trim handles to enable processing
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
            
            {/* Close button */}
            <button
              onClick={closeTrimModal}
              disabled={isTrimming}
              className="absolute top-4 right-4 w-8 h-8 bg-slate-700 hover:bg-slate-600 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Export helper function to upload staged files
export const uploadStagedEvidence = async (
  stagedFiles: StagedFile[],
  incidentId: string,
  onProgress?: (uploaded: number, total: number) => void
): Promise<any[]> => {
  if (stagedFiles.length === 0 || !incidentId) return [];

  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? '.' + parts.pop() : '';
  };

  const filesByType = stagedFiles.reduce((acc, sf) => {
    if (!acc[sf.type]) acc[sf.type] = [];
    acc[sf.type].push(sf);
    return acc;
  }, {} as Record<string, StagedFile[]>);

  const allUploadedFiles: any[] = [];
  let uploaded = 0;
  const total = stagedFiles.length;

  for (const [type, files] of Object.entries(filesByType)) {
    const formData = new FormData();
    
    // Collect transcriptions for voice recordings
    const transcriptions: string[] = [];
    
    files.forEach((sf) => {
      const ext = getFileExtension(sf.originalName);
      const finalName = sf.customName + ext;
      const renamedFile = new File([sf.file], finalName, { type: sf.file.type });
      formData.append('files', renamedFile);
      
      // Add transcription if it's a voice recording
      if (sf.type === 'VOICE_RECORDING') {
        transcriptions.push(sf.transcription || '');
      }
    });
    formData.append('type', type);
    
    // Send transcriptions as JSON string for voice recordings
    if (type === 'VOICE_RECORDING' && transcriptions.length > 0) {
      formData.append('transcriptions', JSON.stringify(transcriptions));
    }

    const response = await api.post(`/incidents/${incidentId}/evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    allUploadedFiles.push(...response.data.data);
    uploaded += files.length;
    if (onProgress) onProgress(uploaded, total);
  }

  return allUploadedFiles;
};
