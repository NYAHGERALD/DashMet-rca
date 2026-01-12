'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Send,
  X,
  Loader2,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import api from '@/lib/api';

interface VoiceRecorderProps {
  incidentId: string;
  onUploadComplete: (message: any) => void;
  onClose: () => void;
}

// Detect mobile device
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
};

// Detect iOS specifically
const isIOSDevice = () => {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Check if Safari browser
const isSafariBrowser = () => {
  if (typeof window === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

// Check if running in secure context (HTTPS or localhost)
const isSecureContext = () => {
  if (typeof window === 'undefined') return false;
  return window.isSecureContext || 
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1';
};

// Trigger haptic feedback on supported devices
const triggerHapticFeedback = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[type]);
  }
};

export default function VoiceRecorder({
  incidentId,
  onUploadComplete,
  onClose,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isSecure, setIsSecure] = useState(true);
  const [isHolding, setIsHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // Detect mobile/iOS on mount
  useEffect(() => {
    setIsMobile(isMobileDevice());
    setIsIOS(isIOSDevice());
    setIsSafari(isSafariBrowser());
    setIsSecure(isSecureContext());
    
    // Show warning immediately if not secure on mobile
    if (isMobileDevice() && !isSecureContext()) {
      setError('HTTPS is required for microphone access on mobile devices. Please access this site via HTTPS.');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      releaseWakeLock();
    };
  }, [audioUrl]);

  // Request wake lock to prevent screen sleep during recording
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (err) {
      console.log('Wake Lock not supported or failed:', err);
    }
  };

  // Release wake lock
  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
      } catch (err) {
        console.log('Wake Lock release failed:', err);
      }
    }
  };

  // Get optimal audio constraints for mobile devices
  const getMobileAudioConstraints = (): MediaTrackConstraints => {
    const baseConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    if (isMobile) {
      return {
        ...baseConstraints,
        // Mobile-optimized settings
        sampleRate: isIOS ? 44100 : 48000,
        channelCount: 1, // Mono for smaller file size
        // Try to use the device's default microphone
      };
    }

    return baseConstraints;
  };

  // Get supported mime type with mobile fallbacks
  const getSupportedMimeType = (): string => {
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg;codecs=opus',
      'audio/wav',
    ];

    // iOS Safari prefers mp4/aac
    if (isIOS || isSafari) {
      const iosMimeTypes = ['audio/mp4', 'audio/aac', 'audio/wav', ...mimeTypes];
      for (const mimeType of iosMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          return mimeType;
        }
      }
    }

    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }

    return ''; // Let browser decide
  };

  // Analyze audio levels for visual feedback
  const startAudioLevelMonitoring = (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevel = () => {
        if (!analyserRef.current) return;
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(Math.min(100, (average / 128) * 100));
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (err) {
      console.log('Audio level monitoring not supported:', err);
    }
  };

  const stopAudioLevelMonitoring = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const startRecording = useCallback(async () => {
    setError(null);
    audioChunksRef.current = [];

    try {
      // Request wake lock to prevent screen sleep
      await requestWakeLock();

      // Mobile-optimized audio constraints
      const constraints = getMobileAudioConstraints();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      streamRef.current = stream;

      // Start audio level monitoring for visual feedback
      startAudioLevelMonitoring(stream);

      // Get best supported mime type
      const mimeType = getSupportedMimeType();
      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};

      // iOS Safari requires specific handling
      if (isIOS && isSafari) {
        recorderOptions.audioBitsPerSecond = 128000;
      }

      const mediaRecorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType || 'audio/webm',
        });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));

        // Stop all tracks and cleanup
        stream.getTracks().forEach((track) => track.stop());
        stopAudioLevelMonitoring();
        releaseWakeLock();
      };

      // Use smaller timeslice on mobile for better responsiveness
      const timeslice = isMobile ? 250 : 100;
      mediaRecorder.start(timeslice);
      setIsRecording(true);
      triggerHapticFeedback('medium');

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          // Max recording time: 5 minutes
          if (prev >= 300) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      releaseWakeLock();
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setError(
          isMobile
            ? 'Microphone access denied. Please allow microphone access in your browser settings and try again.'
            : 'Microphone access denied. Please allow microphone access to record voice messages.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Microphone is being used by another application. Please close other apps using the microphone.');
      } else {
        setError(
          isMobile
            ? 'Failed to start recording. Please check your browser settings and ensure microphone access is allowed.'
            : 'Failed to start recording. Please check your microphone.'
        );
      }
    }
  }, [isMobile, isIOS, isSafari]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      setIsHolding(false);
      setHoldProgress(0);
      triggerHapticFeedback('light');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopAudioLevelMonitoring();
    }
  }, [isRecording]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      triggerHapticFeedback('light');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording, isPaused]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      triggerHapticFeedback('light');
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
  }, [isRecording, isPaused]);

  // Touch hold handlers for mobile "hold to record" functionality
  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isMobile || isRecording || audioBlob) return;
    
    e.preventDefault();
    setIsHolding(true);
    triggerHapticFeedback('light');
    
    // Start progress animation
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 2;
      setHoldProgress(progress);
      
      if (progress >= 100) {
        clearInterval(progressInterval);
        startRecording();
      }
    }, 10);
    
    holdTimerRef.current = setTimeout(() => {
      clearInterval(progressInterval);
    }, 600);
    
    // Store interval reference for cleanup
    (holdTimerRef as any).progressInterval = progressInterval;
  }, [isMobile, isRecording, audioBlob, startRecording]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || audioBlob) return;
    
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      if ((holdTimerRef as any).progressInterval) {
        clearInterval((holdTimerRef as any).progressInterval);
      }
    }
    
    if (isRecording) {
      // Stop recording on release
      stopRecording();
    } else if (isHolding && holdProgress < 100) {
      // If released before threshold, just tap behavior
      setIsHolding(false);
      setHoldProgress(0);
      startRecording();
    }
    
    setIsHolding(false);
    setHoldProgress(0);
  }, [isMobile, isRecording, isHolding, holdProgress, audioBlob, stopRecording, startRecording]);

  const discardRecording = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [audioUrl]);

  const playPauseAudio = useCallback(async () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      triggerHapticFeedback('light');
    } else {
      try {
        // iOS requires user interaction to play audio
        if (isIOS) {
          audioRef.current.load();
        }
        await audioRef.current.play();
        setIsPlaying(true);
        triggerHapticFeedback('light');
      } catch (err) {
        console.error('Failed to play audio:', err);
        setError('Failed to play audio. Please try again.');
      }
    }
  }, [isPlaying, audioUrl, isIOS]);

  // Track playback time
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentPlaybackTime(audio.currentTime);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    return () => audio.removeEventListener('timeupdate', handleTimeUpdate);
  }, [audioUrl]);

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  }, []);

  const sendVoiceMessage = useCallback(async () => {
    if (!audioBlob) return;

    setUploading(true);
    setError(null);
    triggerHapticFeedback('medium');

    try {
      const formData = new FormData();
      // Determine file extension based on mime type
      let extension = 'webm';
      if (audioBlob.type.includes('mp4') || audioBlob.type.includes('aac')) {
        extension = 'm4a';
      } else if (audioBlob.type.includes('wav')) {
        extension = 'wav';
      } else if (audioBlob.type.includes('ogg')) {
        extension = 'ogg';
      }
      
      const fileName = `voice-message-${Date.now()}.${extension}`;
      formData.append('file', audioBlob, fileName);
      formData.append('messageType', 'VOICE');

      const response = await api.post(`/chat/${incidentId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      triggerHapticFeedback('heavy');
      onUploadComplete(response.data?.data);
      onClose();
    } catch (err: any) {
      console.error('Failed to send voice message:', err);
      setError(err.response?.data?.error || 'Failed to send voice message. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [audioBlob, incidentId, onUploadComplete, onClose]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto safe-area-inset-bottom">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              🎤 Voice Message
            </h3>
            {isMobile && (
              <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                Mobile
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full touch-manipulation"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6">
          {/* HTTPS Required Warning for Mobile */}
          {isMobile && !isSecure && (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-300 mb-2">
                    HTTPS Required for Mobile Microphone
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                    Mobile browsers require a secure (HTTPS) connection to access the microphone. You&apos;re currently using HTTP.
                  </p>
                  <div className="text-xs text-amber-600 dark:text-amber-500 space-y-2">
                    <p className="font-medium">Solutions:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Use this feature on a desktop/laptop browser</li>
                      <li>Access via HTTPS (ask your admin to enable SSL)</li>
                      <li>On Chrome Android: Go to <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded">chrome://flags</code> → Enable &quot;Insecure origins treated as secure&quot; → Add this URL</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !(!isSecure && isMobile) && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p>{error}</p>
                {isMobile && permissionDenied && (
                  <p className="mt-2 text-xs opacity-75">
                    On mobile: Go to your browser settings → Site Settings → Microphone → Allow for this site
                  </p>
                )}
              </div>
            </div>
          )}

          {/* HTTPS Required State for Mobile */}
          {isMobile && !isSecure ? (
            <div className="text-center py-6 sm:py-8">
              <div className="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                <Mic className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Voice recording is unavailable over HTTP on mobile devices.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 active:scale-95 transition-transform touch-manipulation"
              >
                Close
              </button>
            </div>
          ) : permissionDenied ? (
            <div className="text-center py-6 sm:py-8">
              <Mic className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Microphone access is required for voice messages.
              </p>
              {isMobile && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-left">
                  <p className="font-medium text-blue-700 dark:text-blue-300 mb-2">How to enable microphone:</p>
                  <ol className="list-decimal list-inside text-blue-600 dark:text-blue-400 space-y-1">
                    <li>Tap the lock/info icon in your browser&apos;s address bar</li>
                    <li>Find &quot;Microphone&quot; in permissions</li>
                    <li>Change to &quot;Allow&quot;</li>
                    <li>Refresh this page</li>
                  </ol>
                </div>
              )}
              <button
                onClick={() => {
                  setPermissionDenied(false);
                  setError(null);
                  startRecording();
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-transform touch-manipulation"
              >
                Try Again
              </button>
            </div>
          ) : !audioBlob ? (
            /* Recording State */
            <div className="text-center py-6 sm:py-8">
              {/* Recording Indicator with Audio Level Visualization */}
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-6">
                {/* Audio level ring */}
                {isRecording && !isPaused && (
                  <div 
                    className="absolute inset-0 rounded-full bg-red-200 dark:bg-red-900/40 transition-transform"
                    style={{
                      transform: `scale(${1 + (audioLevel / 200)})`,
                      opacity: 0.5 + (audioLevel / 200),
                    }}
                  />
                )}
                {/* Hold progress ring (mobile) */}
                {isHolding && !isRecording && (
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx="50%"
                      cy="50%"
                      r="48%"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-blue-500"
                      strokeDasharray={`${holdProgress * 3.14} 314`}
                    />
                  </svg>
                )}
                <div
                  className={`absolute inset-0 rounded-full ${
                    isRecording && !isPaused
                      ? 'bg-red-100 dark:bg-red-900/30 animate-pulse'
                      : 'bg-gray-100 dark:bg-slate-700'
                  }`}
                />
                <button
                  onClick={!isMobile ? (isRecording ? stopRecording : startRecording) : undefined}
                  onTouchStart={isMobile ? handleTouchStart : undefined}
                  onTouchEnd={isMobile ? handleTouchEnd : undefined}
                  onMouseDown={isMobile ? handleTouchStart : undefined}
                  onMouseUp={isMobile ? handleTouchEnd : undefined}
                  onMouseLeave={isMobile && isHolding ? handleTouchEnd : undefined}
                  className={`relative w-full h-full rounded-full flex items-center justify-center transition-all touch-manipulation select-none ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 active:bg-red-700'
                      : 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700'
                  } ${isHolding ? 'scale-95' : ''}`}
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  {isRecording ? (
                    <Square className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  ) : (
                    <Mic className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                  )}
                </button>
              </div>

              {/* Timer */}
              <div className="text-3xl sm:text-4xl font-mono text-gray-900 dark:text-white mb-4 tabular-nums">
                {formatTime(recordingTime)}
              </div>

              {/* Recording Controls */}
              {isRecording && (
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    className="p-3 sm:p-4 bg-gray-100 dark:bg-slate-700 rounded-full hover:bg-gray-200 dark:hover:bg-slate-600 active:scale-95 transition-transform touch-manipulation"
                  >
                    {isPaused ? (
                      <Play className="w-6 h-6 sm:w-7 sm:h-7 text-gray-700 dark:text-gray-300" />
                    ) : (
                      <Pause className="w-6 h-6 sm:w-7 sm:h-7 text-gray-700 dark:text-gray-300" />
                    )}
                  </button>
                </div>
              )}

              {/* Instructions */}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 px-4">
                {isRecording
                  ? isPaused
                    ? 'Recording paused. Tap play to resume or stop to finish.'
                    : isMobile 
                      ? 'Recording... Tap the button to stop.'
                      : 'Recording... Click the button to stop.'
                  : isMobile
                    ? 'Tap the microphone to start recording'
                    : 'Tap the microphone to start recording'}
              </p>
              <p className="text-xs text-gray-400 mt-2">Max duration: 5 minutes</p>
              
              {/* Audio level indicator during recording */}
              {isRecording && !isPaused && (
                <div className="mt-4 flex items-center justify-center gap-1 h-8">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-red-500 rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(4, Math.min(32, (audioLevel / 100) * 32 * (0.5 + Math.random() * 0.5)))}px`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Playback State */
            <div className="text-center py-6 sm:py-8">
              <audio
                ref={audioRef}
                src={audioUrl || undefined}
                onEnded={handleAudioEnded}
                preload="auto"
                playsInline
              />

              {/* Waveform Visualization */}
              <div className="h-16 mb-6 flex items-center justify-center gap-0.5 sm:gap-1 px-4">
                {Array.from({ length: isMobile ? 25 : 30 }).map((_, i) => {
                  const height = 20 + Math.sin(i * 0.5) * 15 + Math.random() * 10;
                  const isActive = isPlaying && (currentPlaybackTime / recordingTime) * (isMobile ? 25 : 30) > i;
                  return (
                    <div
                      key={i}
                      className={`w-1 sm:w-1.5 rounded-full transition-colors ${
                        isActive ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'
                      }`}
                      style={{ height: `${height}px` }}
                    />
                  );
                })}
              </div>

              {/* Duration */}
              <div className="text-2xl font-mono text-gray-900 dark:text-white mb-6 tabular-nums">
                {isPlaying ? formatTime(Math.floor(currentPlaybackTime)) : formatTime(recordingTime)}
                <span className="text-gray-400"> / {formatTime(recordingTime)}</span>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center justify-center gap-3 sm:gap-4">
                <button
                  onClick={discardRecording}
                  className="p-3 sm:p-4 bg-red-100 dark:bg-red-900/30 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 active:scale-95 transition-transform touch-manipulation"
                  title="Discard"
                >
                  <Trash2 className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 dark:text-red-400" />
                </button>
                <button
                  onClick={playPauseAudio}
                  className="p-4 sm:p-5 bg-blue-500 rounded-full hover:bg-blue-600 active:scale-95 transition-transform touch-manipulation"
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  ) : (
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  )}
                </button>
                <button
                  onClick={sendVoiceMessage}
                  disabled={uploading}
                  className="p-3 sm:p-4 bg-green-100 dark:bg-green-900/30 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 active:scale-95 transition-transform touch-manipulation"
                  title="Send"
                >
                  {uploading ? (
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 dark:text-green-400" />
                  )}
                </button>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                Listen to your recording before sending
              </p>
            </div>
          )}
        </div>

        {/* Mobile safe area padding */}
        <div className="h-safe-area-inset-bottom sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
}
