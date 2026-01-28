'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Video,
  Square,
  Circle,
  Monitor,
  Camera,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  HardDrive
} from 'lucide-react';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import api from '@/lib/api';

interface ScreenInfo {
  id: string;
  name: string;
  type: 'screen' | 'window' | 'tab';
  thumbnail?: string;
}

interface MeetingRecorderProps {
  incidentId: string;
  roomName: string;
  userId: string;
  userName?: string;
  onRecordingStarted?: () => void;
  onRecordingStopped?: (recordingId: string) => void;
  onError?: (error: string) => void;
}

type RecordingState = 'idle' | 'selecting' | 'recording' | 'stopping' | 'uploading' | 'complete' | 'error';

export default function MeetingRecorder({
  incidentId,
  roomName,
  userId,
  userName = 'Participant',
  onRecordingStarted,
  onRecordingStopped,
  onError
}: MeetingRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [showSourceSelector, setShowSourceSelector] = useState(false);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<Date | null>(null);

  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Cleanup function
  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Start screen selection
  const handleStartRecording = async () => {
    setShowSourceSelector(true);
    setRecordingState('selecting');
    setErrorMessage(null);
  };

  // Cancel selection
  const handleCancelSelection = () => {
    setShowSourceSelector(false);
    setRecordingState('idle');
    setSelectedSources([]);
  };

  // Start recording with selected source
  const startRecordingWithSource = async (sourceType: 'screen' | 'window' | 'tab') => {
    try {
      setRecordingState('recording');
      setShowSourceSelector(false);

      // Get display media with audio
      const displayMediaOptions: DisplayMediaStreamOptions = {
        video: {
          displaySurface: sourceType === 'screen' ? 'monitor' : sourceType === 'window' ? 'window' : 'browser'
        } as any,
        audio: true
      };

      const displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

      // Try to get user audio as well (microphone)
      let audioStream: MediaStream | null = null;
      try {
        audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } catch (err) {
        console.warn('Could not get microphone access:', err);
      }

      // Combine streams
      const tracks = [...displayStream.getTracks()];
      if (audioStream) {
        audioStream.getAudioTracks().forEach(track => tracks.push(track));
      }

      const combinedStream = new MediaStream(tracks);
      streamRef.current = combinedStream;

      // Handle stream ending (user clicks "Stop sharing")
      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        handleStopRecording();
      });

      // Create MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') 
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm';

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps
      });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await processRecording();
      };

      mediaRecorder.onerror = (event: any) => {
        console.error('MediaRecorder error:', event.error);
        setErrorMessage(`Recording error: ${event.error?.message || 'Unknown error'}`);
        setRecordingState('error');
        cleanup();
        onError?.(`Recording error: ${event.error?.message || 'Unknown error'}`);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every second

      // Start duration timer
      const startTime = new Date();
      setRecordingStartTime(startTime);
      recordingStartTimeRef.current = startTime;
      setRecordingDuration(0);
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      onRecordingStarted?.();
      console.log('🎥 Recording started');

    } catch (err: any) {
      console.error('Error starting recording:', err);
      if (err.name === 'NotAllowedError') {
        setErrorMessage('Screen sharing permission denied');
      } else {
        setErrorMessage(`Failed to start recording: ${err.message}`);
      }
      setRecordingState('error');
      cleanup();
      onError?.(err.message);
    }
  };

  // Stop recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      setRecordingState('stopping');
      mediaRecorderRef.current.stop();
    }
  };

  // Process and upload recording
  const processRecording = async () => {
    if (recordedChunksRef.current.length === 0) {
      setErrorMessage('No recording data captured');
      setRecordingState('error');
      cleanup();
      return;
    }

    setRecordingState('uploading');

    try {
      // Create blob from recorded chunks
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const fileSize = blob.size;
      const duration = recordingDuration;
      const fileName = `recording_${incidentId}_${Date.now()}.webm`;
      const firebasePath = `recordings/${incidentId}/${fileName}`;

      console.log('🎥 Uploading recording:', { fileName, fileSize: formatFileSize(fileSize), duration });

      // Upload to Firebase Storage
      const storageRef = ref(storage, firebasePath);
      const uploadTask = uploadBytesResumable(storageRef, blob);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error('Upload error:', error);
          setErrorMessage(`Upload failed: ${error.message}`);
          setRecordingState('error');
          cleanup();
          onError?.(`Upload failed: ${error.message}`);
        },
        async () => {
          // Upload complete - get download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          console.log('🎥 Upload complete:', downloadURL);

          // Save recording metadata to database
          try {
            const response = await api.post('/recordings', {
              incidentId,
              roomName,
              title: `Meeting Recording - ${new Date().toLocaleString()}`,
              fileName,
              fileUrl: downloadURL,
              firebasePath,
              fileSize,
              duration,
              mimeType: 'video/webm',
              recordingType: 'screen',
              startedAt: recordingStartTimeRef.current?.toISOString() || new Date().toISOString(),
              endedAt: new Date().toISOString()
            });

            console.log('🎥 Recording saved to database:', response.data);
            setRecordingState('complete');
            cleanup();
            onRecordingStopped?.(response.data.id);

            // Reset after a moment
            setTimeout(() => {
              setRecordingState('idle');
              setRecordingDuration(0);
              setUploadProgress(0);
            }, 3000);

          } catch (dbError: any) {
            console.error('Error saving recording to database:', dbError);
            setErrorMessage('Recording uploaded but failed to save metadata');
            setRecordingState('error');
            cleanup();
          }
        }
      );

    } catch (err: any) {
      console.error('Error processing recording:', err);
      setErrorMessage(`Processing failed: ${err.message}`);
      setRecordingState('error');
      cleanup();
      onError?.(err.message);
    }
  };

  // Render based on state
  if (recordingState === 'idle') {
    return (
      <button
        onClick={handleStartRecording}
        className="flex items-center gap-1.5 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-xs"
        title="Start Recording"
      >
        <Circle className="w-3 h-3 fill-current" />
        <span className="font-medium">Record</span>
      </button>
    );
  }

  if (recordingState === 'selecting' && showSourceSelector) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md shadow-2xl">
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Video className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Select Recording Source</h3>
                  <p className="text-sm text-gray-400">Choose what to record</p>
                </div>
              </div>
              <button
                onClick={handleCancelSelection}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <button
              onClick={() => startRecordingWithSource('screen')}
              className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left"
            >
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Monitor className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Entire Screen</h4>
                <p className="text-sm text-gray-400">Record your entire display</p>
              </div>
            </button>

            <button
              onClick={() => startRecordingWithSource('window')}
              className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left"
            >
              <div className="p-3 bg-green-500/20 rounded-lg">
                <Square className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Window</h4>
                <p className="text-sm text-gray-400">Record a specific application window</p>
              </div>
            </button>

            <button
              onClick={() => startRecordingWithSource('tab')}
              className="w-full flex items-center gap-4 p-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left"
            >
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <Camera className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h4 className="text-white font-medium">Browser Tab</h4>
                <p className="text-sm text-gray-400">Record a specific browser tab</p>
              </div>
            </button>
          </div>

          <div className="p-4 border-t border-gray-700 bg-gray-800/50 rounded-b-xl">
            <p className="text-xs text-gray-500 text-center">
              Recordings are automatically saved and linked to this incident
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (recordingState === 'recording') {
    return (
      <div className="flex items-center gap-3">
        {/* Recording indicator */}
        <div className="flex items-center gap-2 px-3 py-2 bg-red-600/20 border border-red-500/50 rounded-lg">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          <span className="text-sm font-medium text-red-400">REC</span>
          <span className="text-sm font-mono text-white">{formatDuration(recordingDuration)}</span>
        </div>

        {/* Stop button */}
        <button
          onClick={handleStopRecording}
          className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          title="Stop Recording"
        >
          <Square className="w-4 h-4 fill-current" />
          <span className="text-sm">Stop</span>
        </button>
      </div>
    );
  }

  if (recordingState === 'stopping' || recordingState === 'uploading') {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-700/50 rounded-lg">
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        <div className="flex flex-col">
          <span className="text-sm text-white">
            {recordingState === 'stopping' ? 'Stopping...' : 'Uploading...'}
          </span>
          {recordingState === 'uploading' && (
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{uploadProgress}%</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (recordingState === 'complete') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-600/20 border border-green-500/50 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-400" />
        <span className="text-sm text-green-400">Recording saved!</span>
      </div>
    );
  }

  if (recordingState === 'error') {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-red-600/20 border border-red-500/50 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-sm text-red-400">{errorMessage || 'Recording failed'}</span>
        </div>
        <button
          onClick={() => {
            setRecordingState('idle');
            setErrorMessage(null);
          }}
          className="px-3 py-2 text-gray-400 hover:text-white text-sm"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return null;
}
