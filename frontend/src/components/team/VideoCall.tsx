'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import api from '@/lib/api';
import TranscriptionPanel, { TranscriptEntry } from './TranscriptionPanel';
import EvidenceSpotlightPanel from './EvidenceSpotlightPanel';
import MeetingRecorder from './MeetingRecorder';
import RecordingHistory from './RecordingHistory';

interface VideoCallProps {
  incidentId: string;
  rcaId?: string;
  onClose: () => void;
  roomUrl?: string;
  roomName?: string;
  onRoomCreated?: (roomUrl: string, roomName: string) => void;
  onMinimize?: () => void;
  onScreenShareChange?: (isSharing: boolean) => void;
}

interface Participant {
  id: string;
  user_name: string;
  video: boolean;
  audio: boolean;
  screen: boolean;
}

// Connection states for better tracking
type ConnectionState = 'idle' | 'checking-devices' | 'creating-room' | 'getting-token' | 'connecting' | 'joining' | 'connected' | 'failed';

// Detect mobile device
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);
};

export default function VideoCall({ incidentId, rcaId, onClose, roomUrl: initialRoomUrl, roomName: initialRoomName, onRoomCreated, onMinimize, onScreenShareChange }: VideoCallProps) {
  const callFrameRef = useRef<DailyCall | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [roomUrl, setRoomUrl] = useState<string | null>(initialRoomUrl || null);
  const [roomName, setRoomName] = useState<string | null>(initialRoomName || null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(true);  // Start muted
  const [isVideoOff, setIsVideoOff] = useState(true);  // Start with video off
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [usePopupMode, setUsePopupMode] = useState(false);  // Fallback to popup
  const [isMobile, setIsMobile] = useState(false);  // Track if on mobile
  const [token, setToken] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [showPopupFallback, setShowPopupFallback] = useState(false);
  const [shouldRetry, setShouldRetry] = useState(false); // Trigger retry via state
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('You');
  const [showSpotlightPanel, setShowSpotlightPanel] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [showRecordingHistory, setShowRecordingHistory] = useState(false);
  const speechRecognitionRef = useRef<any>(null);
  const initializingRef = useRef(false);  // Prevent double init
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const MAX_RETRIES = 2;

  // Detect mobile on mount
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  // Clear all timeouts
  const clearAllTimeouts = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    if (stateTimeoutRef.current) {
      clearTimeout(stateTimeoutRef.current);
      stateTimeoutRef.current = null;
    }
  }, []);

  // Check if devices are available (non-blocking)
  const checkDeviceAvailability = useCallback(async (): Promise<{ hasAudio: boolean; hasVideo: boolean }> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasAudio = devices.some(d => d.kind === 'audioinput');
      const hasVideo = devices.some(d => d.kind === 'videoinput');
      console.log('📹 Device check - Audio:', hasAudio, 'Video:', hasVideo);
      return { hasAudio, hasVideo };
    } catch (err) {
      console.warn('📹 Device enumeration failed (will try anyway):', err);
      return { hasAudio: true, hasVideo: true }; // Assume available, let Daily handle it
    }
  }, []);

  // Auto-fallback to popup after failed attempts
  const handleConnectionFailure = useCallback((reason: string) => {
    console.log('📹 Connection failure:', reason, 'Retry count:', retryCount);
    
    if (retryCount < MAX_RETRIES) {
      // Auto-retry with exponential backoff
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`📹 Auto-retrying in ${delay}ms...`);
      setLoadingStatus(`Connection issue, retrying in ${delay / 1000}s...`);
      
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        initializingRef.current = false;
        if (callFrameRef.current) {
          try {
            callFrameRef.current.destroy();
          } catch (e) {
            console.warn('📹 Error destroying call frame:', e);
          }
          callFrameRef.current = null;
        }
        setConnectionState('idle');
        setShouldRetry(true); // Trigger retry via state
      }, delay);
    } else {
      // Max retries reached, show popup fallback option
      setShowPopupFallback(true);
      setError(reason);
      setIsLoading(false);
    }
  }, [retryCount]);

  // Set a state-specific timeout - if we don't progress past a state, fail
  const setStateTimeout = useCallback((state: ConnectionState, timeoutMs: number) => {
    if (stateTimeoutRef.current) {
      clearTimeout(stateTimeoutRef.current);
    }
    
    stateTimeoutRef.current = setTimeout(() => {
      if (connectionState === state && isLoading) {
        console.log(`📹 Stuck in state '${state}' for ${timeoutMs}ms`);
        handleConnectionFailure(`Connection stalled at: ${state}. Please check your network and try again.`);
      }
    }, timeoutMs);
  }, [connectionState, isLoading, handleConnectionFailure]);

  // Create or join room
  const initializeCall = useCallback(async () => {
    // Prevent double initialization
    if (initializingRef.current) {
      console.log('📹 [VideoCall] Already initializing, skipping...');
      return;
    }
    initializingRef.current = true;
    
    try {
      setIsLoading(true);
      setError(null);
      clearAllTimeouts();
      
      console.log('📹 [VideoCall] initializeCall called with roomUrl:', roomUrl, 'roomName:', roomName);

      // Step 1: Check device availability (non-blocking, just informational)
      setConnectionState('checking-devices');
      setLoadingStatus('Checking device availability...');
      const devices = await checkDeviceAvailability();
      console.log('📹 Devices available:', devices);

      let url = roomUrl;
      let name = roomName;
      let isExistingRoom = false;

      console.log('📹 [VideoCall] Starting with - url:', url, 'name:', name);

      // If no room URL provided, create a new room
      if (!url) {
        setConnectionState('creating-room');
        setStateTimeout('creating-room', 15000); // 15s to create room
        console.log('📹 [VideoCall] No roomUrl provided, creating new room...');
        setLoadingStatus('Creating video room...');
        const response = await api.post('/video-call/create-room', {
          incidentId,
          rcaId,
        });

        if (response.data.success && response.data.room) {
          url = response.data.room.url;
          name = response.data.room.name;
          isExistingRoom = response.data.room.isExisting === true;
          
          // Validate that we received valid room data
          if (!url || !name) {
            console.error('📹 [VideoCall] Invalid room data received:', response.data);
            throw new Error('Server returned invalid room data. Please try again.');
          }
          
          setRoomUrl(url);
          setRoomName(name);
          
          console.log('📹 [VideoCall] Room response - isExisting:', isExistingRoom, 'url:', url, 'name:', name);
          
          // Only notify parent if this is a NEW room (not existing)
          // This prevents multiple users from broadcasting the same call
          if (onRoomCreated && url && name && !isExistingRoom) {
            console.log('📹 [VideoCall] New room created, calling onRoomCreated');
            onRoomCreated(url, name);
          } else if (isExistingRoom) {
            console.log('📹 [VideoCall] Joining existing room, skipping onRoomCreated');
          }
        } else {
          throw new Error(response.data.error || 'Failed to create room');
        }
      }

      // Ensure we have a valid room name before proceeding
      if (!name) {
        console.error('📹 [VideoCall] No room name available after room creation');
        throw new Error('Room name not available. Please try again.');
      }

      setConnectionState('getting-token');
      setStateTimeout('getting-token', 15000); // 15s to get token
      setLoadingStatus('Getting access token...');
      console.log('📹 [VideoCall] Requesting token for room:', name);
      // Get meeting token
      const tokenResponse = await api.post('/video-call/get-token', {
        roomName: name,
      });

      if (!tokenResponse.data.success) {
        throw new Error(tokenResponse.data.error || 'Failed to get meeting token');
      }

      const meetingToken = tokenResponse.data.token;
      setToken(meetingToken);
      
      setConnectionState('connecting');
      setStateTimeout('connecting', 20000); // 20s to connect
      setLoadingStatus('Connecting to video call...');

      // On mobile devices, open directly in Daily.co's mobile-optimized URL
      // This provides a much better experience than embedded iframe on mobile
      const shouldUseMobileMode = isMobile || usePopupMode;
      
      if (shouldUseMobileMode) {
        const mobileUrl = `${url}?t=${meetingToken}`;
        console.log('📹 Opening in mobile/popup mode:', mobileUrl);
        
        // On mobile, open in same tab for better UX (avoids popup blockers)
        if (isMobile) {
          // Store state before navigating so we can restore when they return
          sessionStorage.setItem('dashmet_call_state', JSON.stringify({
            incidentId,
            rcaId,
            roomUrl: url,
            roomName: name,
            timestamp: Date.now()
          }));
          window.location.href = mobileUrl;
        } else {
          // Desktop popup mode
          window.open(mobileUrl, 'DailyVideoCall', 'width=1200,height=800,menubar=no,toolbar=no');
        }
        setIsLoading(false);
        setConnectionState('connected');
        clearAllTimeouts();
        return;
      }

      // Create Daily call frame
      if (containerRef.current && !callFrameRef.current) {
        console.log('📹 Creating Daily call frame with URL:', url);
        console.log('📹 Container dimensions:', containerRef.current.offsetWidth, 'x', containerRef.current.offsetHeight);
        
        // Ensure container has dimensions
        if (containerRef.current.offsetWidth === 0 || containerRef.current.offsetHeight === 0) {
          console.warn('📹 Container has no dimensions, waiting...');
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        callFrameRef.current = DailyIframe.createFrame(containerRef.current, {
          iframeStyle: {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '12px',
          },
          showLeaveButton: false,
          showFullscreenButton: true,
        });

        // Set up event listeners
        callFrameRef.current.on('joining-meeting', () => {
          console.log('📹 Joining meeting...');
          setConnectionState('joining');
          setLoadingStatus('Joining meeting...');
          // Clear connecting timeout, set joining timeout
          if (stateTimeoutRef.current) clearTimeout(stateTimeoutRef.current);
          setStateTimeout('joining', 25000); // 25s to fully join
        });

        callFrameRef.current.on('joined-meeting', () => {
          console.log('📹 Successfully joined meeting!');
          setConnectionState('connected');
          setLoadingStatus('Connected!');
          setIsLoading(false);
          clearAllTimeouts();
          setRetryCount(0); // Reset retry count on success
          updateParticipants();
        });

        callFrameRef.current.on('participant-joined', () => {
          updateParticipants();
        });

        callFrameRef.current.on('participant-left', () => {
          updateParticipants();
        });

        callFrameRef.current.on('participant-updated', (event: any) => {
          updateParticipants();
          
          // Check if the local participant started screen sharing
          // Auto-minimize to prevent recursive mirror effect
          if (event?.participant?.local && event?.participant?.screen) {
            console.log('📹 Local screen sharing detected, auto-minimizing to prevent mirror effect');
            setIsScreenSharing(true);
            onScreenShareChange?.(true);
            // Auto-minimize the call window when screen sharing starts
            if (onMinimize) {
              onMinimize();
            }
          } else if (event?.participant?.local && !event?.participant?.screen) {
            setIsScreenSharing(false);
            onScreenShareChange?.(false);
          }
        });

        // Listen for screen share start/stop events
        callFrameRef.current.on('local-screen-share-started', () => {
          console.log('📹 Local screen share started');
          setIsScreenSharing(true);
          onScreenShareChange?.(true);
          // Auto-minimize to prevent mirror effect
          if (onMinimize) {
            console.log('📹 Auto-minimizing call to prevent screen share mirror effect');
            onMinimize();
          }
        });

        callFrameRef.current.on('local-screen-share-stopped', () => {
          console.log('📹 Local screen share stopped');
          setIsScreenSharing(false);
          onScreenShareChange?.(false);
        });

        callFrameRef.current.on('error', (e) => {
          console.error('📹 Daily error:', e);
          console.error('📹 Error details:', JSON.stringify(e, null, 2));
          handleConnectionFailure(`Call error: ${e?.errorMsg || e?.error || 'Unknown error'}`);
        });

        callFrameRef.current.on('camera-error', (e) => {
          console.error('📹 Camera error:', e);
          // Don't block - camera errors are not fatal
        });

        callFrameRef.current.on('left-meeting', () => {
          console.log('📹 Left meeting');
          clearAllTimeouts();
          onClose();
        });

        callFrameRef.current.on('load-attempt-failed', (e) => {
          console.error('📹 Load attempt failed:', e);
          console.error('📹 Load failure details:', JSON.stringify(e, null, 2));
          handleConnectionFailure(`Failed to load video call. This may be due to browser restrictions or network issues.`);
        });

        callFrameRef.current.on('network-connection', (e: any) => {
          console.log('📹 Network connection event:', e);
          if (e?.type === 'connected') {
            setLoadingStatus('Network connected, joining call...');
          }
        });

        callFrameRef.current.on('nonfatal-error', (e) => {
          console.warn('📹 Non-fatal error:', e);
          // Just log non-fatal errors, don't block the call
        });

        // Transcription events
        callFrameRef.current.on('transcription-started', () => {
          console.log('📝 Transcription started event');
          setIsTranscribing(true);
        });

        callFrameRef.current.on('transcription-stopped', () => {
          console.log('📝 Transcription stopped event');
          setIsTranscribing(false);
        });

        callFrameRef.current.on('transcription-message', (event: any) => {
          console.log('📝 Transcription message event:', event);
          if (event?.text) {
            const entry: TranscriptEntry = {
              timestamp: new Date(),
              speakerId: event.participantId || event.participant_id || 'unknown',
              speakerName: event.user_name || 'Unknown Speaker',
              text: event.text,
            };
            setTranscriptEntries(prev => [...prev, entry]);
          }
        });

        callFrameRef.current.on('transcription-error', (e) => {
          console.error('📝 Transcription error:', e);
        });

        console.log('📹 Attempting to join room...');
        console.log('📹 Room URL being used:', url);
        console.log('📹 Room Name being used:', name);
        console.log('📹 Token (first 20 chars):', meetingToken?.substring(0, 20) + '...');
        setLoadingStatus('Connecting to call (devices off)...');
        
        // Join with video/audio OFF first - this avoids device permission blocking
        // User can enable camera/mic after successfully joining
        try {
          await callFrameRef.current.join({
            url: url!,
            token: meetingToken,
            startVideoOff: true,
            startAudioOff: true,
          });
          console.log('📹 Join request completed successfully');
        } catch (joinError: any) {
          console.error('📹 Join failed with error:', joinError);
          throw new Error(`Failed to join call: ${joinError?.message || joinError}`);
        }
      }
    } catch (err) {
      console.error('Error initializing call:', err);
      handleConnectionFailure(err instanceof Error ? err.message : 'Failed to start video call');
      initializingRef.current = false;
    }
  }, [incidentId, rcaId, roomUrl, roomName, onClose, onRoomCreated, clearAllTimeouts, checkDeviceAvailability, setStateTimeout, handleConnectionFailure, usePopupMode, isMobile]);

  const updateParticipants = useCallback(() => {
    if (callFrameRef.current) {
      const participantsObj = callFrameRef.current.participants();
      console.log('📹 [updateParticipants] Raw participants:', participantsObj);
      const participantsList: Participant[] = Object.values(participantsObj).map((p: any) => ({
        id: p.user_id || p.session_id,
        user_name: p.user_name || 'Guest',
        video: p.video,
        audio: p.audio,
        screen: p.screen,
      }));
      console.log('📹 [updateParticipants] Participant count:', participantsList.length);
      setParticipants(participantsList);
    }
  }, []);

  // Initial mount effect
  useEffect(() => {
    initializeCall();

    return () => {
      clearAllTimeouts();
      if (callFrameRef.current) {
        callFrameRef.current.destroy();
        callFrameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount - initializeCall handles its own logic

  // Handle retry trigger
  useEffect(() => {
    if (shouldRetry) {
      setShouldRetry(false);
      initializeCall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRetry]);

  const toggleMute = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalAudio(!isMuted ? false : true);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (callFrameRef.current) {
      callFrameRef.current.setLocalVideo(!isVideoOff ? false : true);
      setIsVideoOff(!isVideoOff);
    }
  };

  const toggleScreenShare = async () => {
    if (callFrameRef.current) {
      if (isScreenSharing) {
        callFrameRef.current.stopScreenShare();
        setIsScreenSharing(false);
      } else {
        // Check if screen sharing is supported (not available on mobile)
        if (!navigator.mediaDevices?.getDisplayMedia) {
          alert('Screen sharing is not supported on mobile devices. Please use a desktop browser.');
          return;
        }
        try {
          await callFrameRef.current.startScreenShare();
          setIsScreenSharing(true);
        } catch (error: any) {
          console.error('Screen share error:', error);
          if (error.message?.includes('getDisplayMedia') || error.name === 'NotAllowedError') {
            alert('Screen sharing is not available on this device or was denied.');
          }
        }
      }
    }
  };

  // Initialize transcript record when call starts
  const initializeTranscript = useCallback(async (roomNameParam: string) => {
    try {
      const response = await api.post('/transcripts', {
        incidentId,
        roomName: roomNameParam,
      });
      if (response.data.success) {
        setTranscriptId(response.data.transcript.id);
        console.log('📝 Transcript initialized:', response.data.transcript.id);
        return response.data.transcript.id;
      }
    } catch (error) {
      console.error('Failed to initialize transcript:', error);
    }
    return null;
  }, [incidentId]);

  // Save transcript entries to backend (batched)
  const saveTranscriptEntries = useCallback(async (entries: TranscriptEntry[]) => {
    if (!transcriptId || entries.length === 0) return;
    try {
      await api.patch(`/transcripts/${transcriptId}/entries`, { entries });
    } catch (error) {
      console.error('Failed to save transcript entries:', error);
    }
  }, [transcriptId]);

  // Handle transcription message from Daily.co
  const handleTranscriptionMessage = useCallback((event: any) => {
    console.log('📝 Transcription message:', event);
    if (event?.text) {
      const entry: TranscriptEntry = {
        timestamp: new Date(),
        speakerId: event.participantId || 'unknown',
        speakerName: event.user_name || 'Unknown Speaker',
        text: event.text,
      };
      setTranscriptEntries(prev => [...prev, entry]);
      
      // Batch save every 5 entries
      setTranscriptEntries(prev => {
        if (prev.length % 5 === 0) {
          saveTranscriptEntries(prev.slice(-5));
        }
        return prev;
      });
    }
  }, [saveTranscriptEntries]);

  // Get current user's name from call
  useEffect(() => {
    if (callFrameRef.current && connectionState === 'connected') {
      const localParticipant = callFrameRef.current.participants()?.local;
      if (localParticipant?.user_name) {
        setUserName(localParticipant.user_name);
      }
      // Get userId from the participant's user_id
      if (localParticipant?.user_id) {
        setUserId(localParticipant.user_id);
      }
      // Set call start time when connected
      if (!callStartTime) {
        setCallStartTime(new Date());
      }
    }
  }, [connectionState, callStartTime]);

  // Toggle transcription on/off using Web Speech API (browser-based)
  const toggleTranscription = useCallback(async () => {
    try {
      if (isTranscribing) {
        // Stop transcription
        if (speechRecognitionRef.current) {
          speechRecognitionRef.current.stop();
          speechRecognitionRef.current = null;
        }
        setIsTranscribing(false);
        console.log('📝 Transcription stopped');
        
        // End the meeting transcript
        if (transcriptId) {
          await api.patch(`/transcripts/${transcriptId}/end`);
        }
      } else {
        // Check if Web Speech API is available
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
          alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
          return;
        }

        // First initialize transcript record if needed
        let currentTranscriptId = transcriptId;
        if (!currentTranscriptId && roomName) {
          currentTranscriptId = await initializeTranscript(roomName);
        }

        // Initialize Web Speech API
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let finalTranscript = '';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript = transcript;
              
              // Add to transcript entries
              const entry: TranscriptEntry = {
                timestamp: new Date(),
                speakerId: 'local',
                speakerName: userName,
                text: finalTranscript.trim(),
              };
              
              if (entry.text) {
                console.log('📝 Transcript entry:', entry);
                setTranscriptEntries(prev => [...prev, entry]);
              }
              
              finalTranscript = '';
            } else {
              interimTranscript += transcript;
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('📝 Speech recognition error:', event.error);
          if (event.error === 'no-speech') {
            // This is normal, restart recognition
            try {
              recognition.start();
            } catch (e) {
              // Already started
            }
          }
        };

        recognition.onend = () => {
          // Auto-restart if recognition ref still exists (means we're still transcribing)
          if (speechRecognitionRef.current) {
            try {
              recognition.start();
            } catch (e) {
              console.log('📝 Recognition already started or stopped');
            }
          }
        };

        speechRecognitionRef.current = recognition;
        recognition.start();
        setIsTranscribing(true);
        console.log('📝 Transcription started (Web Speech API)');
      }
    } catch (error) {
      console.error('Failed to toggle transcription:', error);
      alert('Failed to start transcription. Please check microphone permissions.');
    }
  }, [isTranscribing, transcriptId, roomName, initializeTranscript, userName]);

  // Cleanup speech recognition on unmount
  useEffect(() => {
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current = null;
      }
    };
  }, []);

  const leaveCall = async () => {
    // Stop transcription if running
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    if (callFrameRef.current) {
      await callFrameRef.current.leave();
      callFrameRef.current.destroy();
      callFrameRef.current = null;
    }
    onClose();
  };

  const copyRoomLink = () => {
    if (roomUrl) {
      navigator.clipboard.writeText(roomUrl);
      // Could add a toast notification here
    }
  };

  // Open in popup window (fallback mode)
  const openInPopup = useCallback(() => {
    if (roomUrl) {
      const popupUrl = token ? `${roomUrl}?t=${token}` : roomUrl;
      window.open(popupUrl, 'DailyVideoCall', 'width=1200,height=800,menubar=no,toolbar=no');
    }
  }, [roomUrl, token]);

  // Auto-open popup if showPopupFallback is set and we have a room URL
  useEffect(() => {
    if (showPopupFallback && roomUrl && token) {
      // Auto-open popup after a brief delay
      const timer = setTimeout(() => {
        openInPopup();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [showPopupFallback, roomUrl, token, openInPopup]);

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 sm:p-8 max-w-lg w-full mx-auto">
          <div className="text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 sm:w-8 sm:h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Unable to Start Call
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4 whitespace-pre-line text-xs sm:text-sm">{error}</p>
            
            {/* Mobile-specific message */}
            {isMobile && roomUrl && (
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-3 font-medium">
                  📱 Mobile users: Tap below to join the call
                </p>
                <button
                  onClick={() => {
                    const callUrl = token ? `${roomUrl}?t=${token}` : roomUrl;
                    window.location.href = callUrl;
                  }}
                  className="w-full px-4 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 text-base font-semibold transition-colors shadow-lg"
                >
                  Join Video Call
                </button>
              </div>
            )}
            
            {/* Show popup fallback prominently when auto-retry exhausted */}
            {showPopupFallback && roomUrl && !isMobile && (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-300 mb-3 font-medium">
                  ✨ The call is opening in a popup window...
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mb-3">
                  If the popup was blocked, click the button below:
                </p>
                <button
                  onClick={openInPopup}
                  className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
                >
                  Open Video Call in Popup
                </button>
              </div>
            )}
            
            {roomUrl && !showPopupFallback && !isMobile && (
              <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Alternative options:</p>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={openInPopup}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    Open in Popup Window
                  </button>
                  <button
                    onClick={() => window.open(roomUrl, '_blank')}
                    className="text-blue-600 dark:text-blue-400 text-sm underline hover:no-underline"
                  >
                    Open in New Tab →
                  </button>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 justify-center">
              <button
                onClick={() => {
                  setError(null);
                  setShowPopupFallback(false);
                  setRetryCount(0);
                  setConnectionState('idle');
                  setIsLoading(true);
                  initializingRef.current = false;
                  if (callFrameRef.current) {
                    try {
                      callFrameRef.current.destroy();
                    } catch (e) {
                      console.warn('📹 Error destroying call frame:', e);
                    }
                    callFrameRef.current = null;
                  }
                  initializeCall();
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Retry
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      {/* Header */}
      <div className="bg-gray-900 px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse flex-shrink-0"></div>
            <span className="text-white font-medium text-sm sm:text-base truncate">Team Call</span>
          </div>
          <span className="text-gray-400 text-xs sm:text-sm whitespace-nowrap">
            {participants.length} <span className="hidden xs:inline">participant{participants.length !== 1 ? 's' : ''}</span>
          </span>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Toggle Transcription */}
          <button
            onClick={toggleTranscription}
            className={`flex p-1.5 sm:p-2 rounded-lg items-center gap-1 sm:gap-1.5 text-sm transition-colors ${
              isTranscribing
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title={isTranscribing ? 'Stop transcription' : 'Start transcription'}
          >
            {isTranscribing && <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full animate-pulse" />}
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          
          {/* Show Transcript Panel */}
          <button
            onClick={() => setShowTranscriptPanel(!showTranscriptPanel)}
            className={`flex p-1.5 sm:p-2 rounded-lg transition-colors ${
              showTranscriptPanel
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title={showTranscriptPanel ? 'Hide transcript' : 'Show transcript'}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            {transcriptEntries.length > 0 && (
              <span className="ml-1 text-xs bg-gray-600 px-1 sm:px-1.5 rounded">
                {transcriptEntries.length}
              </span>
            )}
          </button>

          {/* Evidence Spotlight Button */}
          <button
            onClick={() => setShowSpotlightPanel(!showSpotlightPanel)}
            className={`flex p-1.5 sm:p-2 rounded-lg transition-colors ${
              showSpotlightPanel
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            title={showSpotlightPanel ? 'Hide evidence spotlight' : 'Show evidence spotlight'}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Separator */}
          <div className="w-px h-4 sm:h-6 bg-gray-600" />

          {/* Meeting Recorder */}
          {roomName && userId && (
            <MeetingRecorder
              incidentId={incidentId}
              roomName={roomName}
              userId={userId}
            />
          )}

          {/* Recording History Button */}
          <button
            onClick={() => setShowRecordingHistory(true)}
            className="flex p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
            title="View recording history"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
            </svg>
          </button>

          {/* Separator */}
          <div className="w-px h-4 sm:h-6 bg-gray-600" />

          <button
            onClick={copyRoomLink}
            className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
            title="Copy invite link"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Minimize Button */}
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
              title="Minimize call"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Container */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center max-w-md px-4">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-white mb-2">{loadingStatus}</p>
                {retryCount > 0 && (
                  <p className="text-yellow-400 text-sm mb-2">
                    Retry attempt {retryCount} of {MAX_RETRIES}
                  </p>
                )}
                <p className="text-gray-400 text-sm">Your camera & microphone will be OFF initially</p>
                <p className="text-gray-500 text-xs mt-1">You can enable them after connecting</p>
                
                {/* Connection state indicator */}
                <div className="mt-4 flex justify-center space-x-1">
                  {['checking-devices', 'creating-room', 'getting-token', 'connecting', 'joining'].map((state, index) => (
                    <div
                      key={state}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        connectionState === state 
                          ? 'bg-blue-500 animate-pulse' 
                          : ['checking-devices', 'creating-room', 'getting-token', 'connecting', 'joining'].indexOf(connectionState) > index
                            ? 'bg-green-500'
                            : 'bg-gray-600'
                      }`}
                      title={state}
                    />
                  ))}
                </div>
                <p className="text-gray-600 text-xs mt-2 capitalize">{connectionState.replace('-', ' ')}</p>
              </div>
            </div>
          )}
          <div ref={containerRef} className="w-full h-full" />
        </div>

        {/* Transcription Panel */}
        {showTranscriptPanel && (
          <TranscriptionPanel
            incidentId={incidentId}
            roomName={roomName || ''}
            isOpen={showTranscriptPanel}
            onClose={() => setShowTranscriptPanel(false)}
            entries={transcriptEntries}
            isRecording={isTranscribing}
            transcriptId={transcriptId || undefined}
          />
        )}
      </div>

      {/* Evidence Spotlight Panel - Floating overlay */}
      {showSpotlightPanel && roomName && userId && (
        <EvidenceSpotlightPanel
          incidentId={incidentId}
          roomName={roomName}
          userId={userId}
          isExpanded={showSpotlightPanel}
          onToggle={() => setShowSpotlightPanel(!showSpotlightPanel)}
          callStartTime={callStartTime || undefined}
        />
      )}

      {/* Controls */}
      <div className="bg-gray-900 px-2 sm:px-4 py-2 sm:py-4">
        <div className="flex items-center justify-center space-x-2 sm:space-x-4">
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            className={`p-2.5 sm:p-4 rounded-full transition-colors ${
              isMuted
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          {/* Video Button */}
          <button
            onClick={toggleVideo}
            className={`p-2.5 sm:p-4 rounded-full transition-colors ${
              isVideoOff
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
          >
            {isVideoOff ? (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>

          {/* Screen Share Button */}
          <button
            onClick={toggleScreenShare}
            className={`flex p-2.5 sm:p-4 rounded-full transition-colors ${
              isScreenSharing
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </button>

          {/* Leave Call Button */}
          <button
            onClick={leaveCall}
            className="p-2.5 sm:p-4 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors"
            title="Leave call"
          >
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Recording History Modal */}
      <RecordingHistory
        incidentId={incidentId}
        isOpen={showRecordingHistory}
        onClose={() => setShowRecordingHistory(false)}
        currentRoomName={roomName || undefined}
      />
    </div>
  );
}
