'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useWebSocket } from '@/lib/websocket';
import { useAuth } from '@/components/providers/AuthProvider';
import DraggableCallBar from '@/components/team/DraggableCallBar';
import api from '@/lib/api';

// Dynamically import VideoCall to avoid SSR issues with Daily.co
const VideoCall = dynamic(() => import('@/components/team/VideoCall'), { ssr: false });

interface VideoCallState {
  isActive: boolean;
  roomUrl: string | null;
  roomName: string | null;
  incidentId: string | null;
  rcaId: string | null;
  startedBy: {
    id: string;
    name: string;
  } | null;
}

interface IncomingCallNotification {
  roomUrl: string;
  roomName: string;
  incidentId: string;
  rcaId?: string;
  startedBy: {
    id: string;
    name: string;
  };
}

interface VideoCallContextType {
  // Current call state
  isCallActive: boolean;
  currentCall: VideoCallState | null;
  isMinimized: boolean;
  
  // Incoming call notification
  incomingCall: IncomingCallNotification | null;
  
  // Rejoin prompt (after page refresh)
  rejoinPrompt: {
    roomUrl: string;
    roomName: string;
    incidentId: string;
  } | null;
  
  // Actions
  startCall: (incidentId: string, rcaId?: string) => void;
  joinCall: (roomUrl: string, roomName: string, incidentId: string, rcaId?: string) => void;
  endCall: () => void;
  terminateCall: (incidentId: string, roomName?: string) => Promise<boolean>; // End call for everyone
  dismissIncomingCall: () => void;
  minimizeCall: () => void;
  maximizeCall: () => void;
  dismissRejoinPrompt: () => void;
}

const VideoCallContext = createContext<VideoCallContextType | null>(null);

export function useVideoCall() {
  const context = useContext(VideoCallContext);
  if (!context) {
    throw new Error('useVideoCall must be used within a VideoCallProvider');
  }
  return context;
}

interface VideoCallProviderProps {
  children: React.ReactNode;
}

export function VideoCallProvider({ children }: VideoCallProviderProps) {
  const { user } = useAuth();
  const { 
    onVideoCallStarted, 
    onVideoCallEnded, 
    emitVideoCallStarted, 
    emitVideoCallEnded 
  } = useWebSocket();
  
  const [currentCall, setCurrentCall] = useState<VideoCallState | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallNotification | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [rejoinPrompt, setRejoinPrompt] = useState<{
    roomUrl: string;
    roomName: string;
    incidentId: string;
  } | null>(null);

  // Session storage key for persisting call state
  const CALL_STATE_KEY = 'dashmet_active_call';

  // Check for stored call state on mount (handles page refresh)
  useEffect(() => {
    const checkStoredCallState = async () => {
      try {
        const storedState = sessionStorage.getItem(CALL_STATE_KEY);
        if (storedState) {
          const { roomUrl, roomName, incidentId, timestamp } = JSON.parse(storedState);
          
          // Only show rejoin prompt if stored less than 5 minutes ago
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          if (timestamp > fiveMinutesAgo && roomUrl && roomName && incidentId) {
            console.log('📹 [VideoCallProvider] Found stored call state, showing rejoin prompt');
            setRejoinPrompt({ roomUrl, roomName, incidentId });
            
            // Auto-dismiss after 30 seconds
            setTimeout(() => {
              setRejoinPrompt(null);
              sessionStorage.removeItem(CALL_STATE_KEY);
            }, 30000);
          } else {
            // Stale data, clean up
            sessionStorage.removeItem(CALL_STATE_KEY);
          }
        }
      } catch (err) {
        console.warn('📹 [VideoCallProvider] Error checking stored call state:', err);
        sessionStorage.removeItem(CALL_STATE_KEY);
      }
    };
    
    checkStoredCallState();
  }, []);

  // Persist call state to sessionStorage when in a call
  useEffect(() => {
    if (currentCall?.isActive && currentCall.roomUrl && currentCall.roomName && currentCall.incidentId) {
      const stateToStore = {
        roomUrl: currentCall.roomUrl,
        roomName: currentCall.roomName,
        incidentId: currentCall.incidentId,
        timestamp: Date.now()
      };
      sessionStorage.setItem(CALL_STATE_KEY, JSON.stringify(stateToStore));
      console.log('📹 [VideoCallProvider] Stored call state to sessionStorage');
    }
  }, [currentCall?.isActive, currentCall?.roomUrl, currentCall?.roomName, currentCall?.incidentId]);

  // Listen for incoming video call notifications
  useEffect(() => {
    const handleVideoCallStarted = (data: any) => {
      console.log('📹 [VideoCallProvider] Received video-call:started event:', data);
      
      // Don't show notification if we started the call
      if (user && data.startedBy === user.id) {
        console.log('📹 [VideoCallProvider] Ignoring - we started this call');
        return;
      }
      
      // Don't show if we're already in a call
      if (currentCall?.isActive) {
        console.log('📹 [VideoCallProvider] Ignoring - already in a call');
        return;
      }
      
      console.log('📹 [VideoCallProvider] Setting incoming call notification:');
      console.log('📹 [VideoCallProvider] - roomUrl from event:', data.roomUrl);
      console.log('📹 [VideoCallProvider] - roomName from event:', data.roomName);
      setIncomingCall({
        roomUrl: data.roomUrl,
        roomName: data.roomName,
        incidentId: data.incidentId,
        rcaId: data.rcaId,
        startedBy: {
          id: data.startedBy,
          name: data.startedByName || 'A team member',
        },
      });
      
      // Auto-dismiss after 30 seconds
      setTimeout(() => {
        setIncomingCall(prev => 
          prev?.roomName === data.roomName ? null : prev
        );
      }, 30000);
    };

    const handleVideoCallEnded = (data: any) => {
      // If the call we're watching for ends, dismiss notification
      if (incomingCall?.roomName === data.roomName) {
        setIncomingCall(null);
      }
    };

    const unsubscribeStarted = onVideoCallStarted(handleVideoCallStarted);
    const unsubscribeEnded = onVideoCallEnded(handleVideoCallEnded);

    return () => {
      unsubscribeStarted();
      unsubscribeEnded();
    };
  }, [onVideoCallStarted, onVideoCallEnded, user, currentCall, incomingCall]);

  const startCall = useCallback((incidentId: string, rcaId?: string) => {
    setCurrentCall({
      isActive: true,
      roomUrl: null, // Will be set when VideoCall component creates the room
      roomName: null,
      incidentId,
      rcaId: rcaId || null,
      startedBy: user ? {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
      } : null,
    });
    
    // Clear any incoming call notification
    setIncomingCall(null);
  }, [user]);

  const joinCall = useCallback((roomUrl: string, roomName: string, incidentId: string, rcaId?: string) => {
    console.log('📹 [VideoCallProvider] joinCall called with:');
    console.log('📹 [VideoCallProvider] - roomUrl:', roomUrl);
    console.log('📹 [VideoCallProvider] - roomName:', roomName);
    console.log('📹 [VideoCallProvider] - incidentId:', incidentId);
    setCurrentCall({
      isActive: true,
      roomUrl,
      roomName,
      incidentId,
      rcaId: rcaId || null,
      startedBy: null,
    });
    
    // Clear incoming call notification
    setIncomingCall(null);
  }, []);

  const endCall = useCallback(() => {
    if (currentCall?.roomName && currentCall?.incidentId) {
      emitVideoCallEnded(currentCall.incidentId, currentCall.roomName);
    }
    setCurrentCall(null);
    setIsMinimized(false);
    setIsScreenSharing(false);
    // Clear stored call state - user intentionally ended the call
    sessionStorage.removeItem(CALL_STATE_KEY);
    console.log('📹 [VideoCallProvider] Call ended, cleared sessionStorage');
  }, [currentCall, emitVideoCallEnded]);

  // Terminate call for everyone - deletes the Daily.co room
  const terminateCall = useCallback(async (incidentId: string, roomName?: string): Promise<boolean> => {
    try {
      console.log('📹 [VideoCallProvider] Terminating call for incident:', incidentId);
      
      // Call backend to delete the room and clear cache
      const response = await api.post(`/video-call/incident/${incidentId}/end-call`, {
        roomName: roomName || currentCall?.roomName,
      });
      
      if (response.data.success) {
        // Emit ended event to notify all participants
        emitVideoCallEnded(incidentId, roomName || currentCall?.roomName || '');
        
        // Clear local state if we're in this call
        if (currentCall?.incidentId === incidentId) {
          setCurrentCall(null);
          setIsMinimized(false);
          sessionStorage.removeItem(CALL_STATE_KEY);
        }
        
        // Clear incoming call notification if it's for this room
        if (incomingCall?.incidentId === incidentId) {
          setIncomingCall(null);
        }
        
        // Clear rejoin prompt if it's for this room
        if (rejoinPrompt?.incidentId === incidentId) {
          setRejoinPrompt(null);
          sessionStorage.removeItem(CALL_STATE_KEY);
        }
        
        console.log('📹 [VideoCallProvider] Call terminated successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('📹 [VideoCallProvider] Error terminating call:', error);
      return false;
    }
  }, [currentCall, incomingCall, rejoinPrompt, emitVideoCallEnded]);

  const dismissIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  const minimizeCall = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const maximizeCall = useCallback(() => {
    setIsMinimized(false);
  }, []);

  const handleScreenShareChange = useCallback((isSharing: boolean) => {
    setIsScreenSharing(isSharing);
  }, []);

  const dismissRejoinPrompt = useCallback(() => {
    setRejoinPrompt(null);
    sessionStorage.removeItem(CALL_STATE_KEY);
  }, []);

  const handleCallRoomCreated = useCallback((roomUrl: string, roomName: string) => {
    console.log('📹 [VideoCallProvider] handleCallRoomCreated called with roomUrl:', roomUrl, 'roomName:', roomName);
    // Update current call with room info
    setCurrentCall(prev => prev ? {
      ...prev,
      roomUrl,
      roomName,
    } : null);
    
    // Emit to notify other team members
    if (currentCall?.incidentId) {
      console.log('📹 [VideoCallProvider] Emitting video-call:started to incident:', currentCall.incidentId);
      emitVideoCallStarted(currentCall.incidentId, roomUrl, roomName);
    } else {
      console.warn('📹 [VideoCallProvider] Cannot emit - no incidentId in currentCall');
    }
  }, [currentCall, emitVideoCallStarted]);

  return (
    <VideoCallContext.Provider
      value={{
        isCallActive: !!currentCall?.isActive,
        currentCall,
        incomingCall,
        isMinimized,
        rejoinPrompt,
        startCall,
        joinCall,
        endCall,
        terminateCall,
        dismissIncomingCall,
        minimizeCall,
        maximizeCall,
        dismissRejoinPrompt,
      }}
    >
      {children}

      {/* Rejoin Call Prompt - Shows after page refresh if user was in a call */}
      {rejoinPrompt && !currentCall?.isActive && (
        <div className="fixed top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-[60] animate-slide-down">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex items-center space-x-3 sm:space-x-4 sm:min-w-[400px]">
            <div className="flex-shrink-0 hidden sm:block">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base sm:text-lg">Rejoin Team Call?</p>
              <p className="text-white/90 text-xs sm:text-sm truncate">
                You were disconnected from a call. Would you like to rejoin?
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  joinCall(rejoinPrompt.roomUrl, rejoinPrompt.roomName, rejoinPrompt.incidentId);
                  setRejoinPrompt(null);
                }}
                className="px-4 py-2 bg-white text-orange-700 font-medium rounded-lg hover:bg-orange-50 transition-colors"
              >
                Rejoin
              </button>
              <button
                onClick={dismissRejoinPrompt}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Dismiss"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Incoming Call Notification Banner */}
      {incomingCall && (
        <div className="fixed top-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-[60] animate-slide-down">
          <div className="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex items-center space-x-3 sm:space-x-4 sm:min-w-[400px]">
            <div className="flex-shrink-0 hidden sm:block">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base sm:text-lg">Team Video Call</p>
              <p className="text-white/90 text-xs sm:text-sm truncate">
                {incomingCall.startedBy?.name || 'A team member'} started a call
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => joinCall(
                  incomingCall.roomUrl,
                  incomingCall.roomName,
                  incomingCall.incidentId,
                  incomingCall.rcaId
                )}
                className="px-4 py-2 bg-white text-green-700 font-medium rounded-lg hover:bg-green-50 transition-colors"
              >
                Join Call
              </button>
              <button
                onClick={dismissIncomingCall}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Dismiss"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Video Call Component - Rendered at app level */}
      {currentCall?.isActive && (
        <>
          {/* Minimized Call Bar - Draggable */}
          {isMinimized && (
            <DraggableCallBar
              onMaximize={maximizeCall}
              onEndCall={endCall}
              isScreenSharing={isScreenSharing}
            />
          )}
          
          {/* Full Video Call - hidden when minimized */}
          <div className={isMinimized ? 'hidden' : ''}>
            <VideoCall
              incidentId={currentCall.incidentId || ''}
              rcaId={currentCall.rcaId || undefined}
              roomUrl={currentCall.roomUrl || undefined}
              roomName={currentCall.roomName || undefined}
              onClose={endCall}
              onRoomCreated={handleCallRoomCreated}
              onMinimize={minimizeCall}
              onScreenShareChange={handleScreenShareChange}
            />
          </div>
        </>
      )}
    </VideoCallContext.Provider>
  );
}
