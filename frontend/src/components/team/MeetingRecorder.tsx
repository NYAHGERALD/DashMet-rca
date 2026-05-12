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
  compact?: boolean;
  onRecordingStarted?: () => void;
  onRecordingStopped?: (recordingId: string) => void;
  onError?: (error: string) => void;
}

type RecordingState = 'idle' | 'selecting' | 'recording' | 'stopping' | 'uploading' | 'complete' | 'error';

const RECORDING_MAX_WIDTH = 1280;
const RECORDING_MAX_HEIGHT = 720;
const RECORDING_FRAME_RATE = 15;
const RECORDING_VIDEO_BITRATE = 800_000;
const RECORDING_AUDIO_BITRATE = 64_000;

export default function MeetingRecorder({
  incidentId,
  roomName,
  userId,
  userName = 'Participant',
  compact = false,
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
  const recordingDurationRef = useRef(0);

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

  const clearDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const getElapsedRecordingSeconds = useCallback(() => {
    const startedAt = recordingStartTimeRef.current;
    if (!startedAt) return recordingDurationRef.current;

    const elapsed = Math.ceil((Date.now() - startedAt.getTime()) / 1000);
    return Math.max(recordingDurationRef.current, elapsed);
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    clearDurationTimer();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
  }, [clearDurationTimer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Start screen selection
  const handleStartRecording = async () => {
    // Check if screen sharing is supported (not available on mobile)
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setErrorMessage('Screen recording is not supported on this device. Please use a desktop browser.');
      setRecordingState('error');
      onError?.('Screen recording is not supported on mobile devices');
      return;
    }
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
      // Check if screen sharing is supported (not available on mobile)
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setErrorMessage('Screen recording is not supported on this device. Please use a desktop browser.');
        setRecordingState('error');
        setShowSourceSelector(false);
        onError?.('Screen recording is not supported on mobile devices');
        return;
      }

      setRecordingState('recording');
      setShowSourceSelector(false);

      // Get display media with web-optimized constraints to keep files manageable.
      const displayMediaOptions: DisplayMediaStreamOptions = {
        video: {
          displaySurface: sourceType === 'screen' ? 'monitor' : sourceType === 'window' ? 'window' : 'browser',
          width: { ideal: RECORDING_MAX_WIDTH, max: RECORDING_MAX_WIDTH },
          height: { ideal: RECORDING_MAX_HEIGHT, max: RECORDING_MAX_HEIGHT },
          frameRate: { ideal: RECORDING_FRAME_RATE, max: RECORDING_FRAME_RATE }
        } as any,
        audio: true
      };

      let displayStream: MediaStream;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
      } catch (err: any) {
        if (err?.name !== 'TypeError' && err?.name !== 'OverconstrainedError') {
          throw err;
        }

        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: sourceType === 'screen' ? 'monitor' : sourceType === 'window' ? 'window' : 'browser',
          } as any,
          audio: true,
        });
      }

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

      const preferredMimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const mimeType = preferredMimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: RECORDING_VIDEO_BITRATE,
        audioBitsPerSecond: RECORDING_AUDIO_BITRATE,
      });

      recordedChunksRef.current = [];
      recordingDurationRef.current = 0;
      setUploadProgress(0);

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
        const elapsed = getElapsedRecordingSeconds();
        recordingDurationRef.current = elapsed;
        setRecordingDuration(elapsed);
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
      const finalDuration = getElapsedRecordingSeconds();
      recordingDurationRef.current = finalDuration;
      setRecordingDuration(finalDuration);
      clearDurationTimer();
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
      const recordedMimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
      const blob = new Blob(recordedChunksRef.current, { type: recordedMimeType });
      const fileSize = blob.size;
      const duration = Math.max(1, getElapsedRecordingSeconds());
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
              mimeType: recordedMimeType,
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
        className={compact
          ? 'inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white transition-colors hover:bg-red-700'
          : 'flex items-center gap-1.5 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-xs'}
        title="Start Recording"
        aria-label="Start recording"
      >
        <Circle className={compact ? 'h-3.5 w-3.5 fill-current' : 'w-3 h-3 fill-current'} />
        {!compact && <span className="font-medium">Record</span>}
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
    if (compact) {
      return (
        <div className="inline-flex h-8 items-center overflow-hidden rounded-md border border-red-500/60 bg-red-600/20 text-white">
          <div className="inline-flex h-full items-center gap-1.5 px-2 text-[11px] font-semibold text-red-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
            </span>
            <span className="font-mono">{formatDuration(recordingDuration)}</span>
          </div>
          <button
            onClick={handleStopRecording}
            className="inline-flex h-full w-8 items-center justify-center border-l border-red-500/50 text-white transition-colors hover:bg-red-600/40"
            title="Stop Recording"
            aria-label="Stop recording"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
        </div>
      );
    }

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
    if (compact) {
      return (
        <div
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-blue-300"
          title={recordingState === 'stopping' ? 'Stopping recording' : `Uploading recording ${uploadProgress}%`}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      );
    }

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
    if (compact) {
      return (
        <div
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-green-600/20 text-green-300"
          title="Recording saved"
        >
          <CheckCircle className="h-4 w-4" />
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-600/20 border border-green-500/50 rounded-lg">
        <CheckCircle className="w-5 h-5 text-green-400" />
        <span className="text-sm text-green-400">Recording saved!</span>
      </div>
    );
  }

  if (recordingState === 'error') {
    if (compact) {
      return (
        <button
          onClick={() => {
            setRecordingState('idle');
            setErrorMessage(null);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-600/20 text-red-300 transition-colors hover:bg-red-600/30"
          title={errorMessage || 'Recording failed'}
          aria-label="Dismiss recording error"
        >
          <AlertCircle className="h-4 w-4" />
        </button>
      );
    }

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
