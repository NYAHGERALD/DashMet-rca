/**
 * Video Call Routes - Daily.co Integration
 * Handles creating and managing video call rooms for RCA team collaboration
 */
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const DAILY_API_KEY = process.env.DAILY_API_KEY;
const DAILY_API_URL = 'https://api.daily.co/v1';

// Track active rooms per incident (in-memory cache)
// Key: incidentId, Value: { roomName, roomUrl, createdAt, createdBy }
const activeIncidentRooms = new Map<string, { 
  roomName: string; 
  roomUrl: string; 
  createdAt: Date; 
  createdBy: string;
}>();

// Mutex to prevent race conditions when creating rooms
const pendingRoomCreations = new Map<string, Promise<{ roomName: string; roomUrl: string; createdBy: string } | null>>();

// Clean up expired rooms (older than 4 hours)
setInterval(() => {
  const now = new Date();
  for (const [incidentId, room] of activeIncidentRooms.entries()) {
    const hoursSinceCreation = (now.getTime() - room.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 4) {
      activeIncidentRooms.delete(incidentId);
      console.log(`📹 Cleaned up expired room for incident ${incidentId}`);
    }
  }
}, 60000); // Check every minute

// Create a new video room for an RCA/Incident (or return existing)
router.post('/create-room', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { incidentId, rcaId, roomName } = req.body;
    const userId = req.user?.id;

    if (!DAILY_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Video call service not configured',
      });
    }

    // Check if there's already an active room for this incident
    const existingRoom = activeIncidentRooms.get(incidentId);
    if (existingRoom) {
      // Verify the room still exists on Daily.co
      try {
        const checkResponse = await fetch(`${DAILY_API_URL}/rooms/${existingRoom.roomName}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
        });
        
        if (checkResponse.ok) {
          console.log(`📹 Returning verified existing room for incident ${incidentId}: ${existingRoom.roomName}`);
          return res.json({
            success: true,
            room: {
              name: existingRoom.roomName,
              url: existingRoom.roomUrl,
              createdBy: existingRoom.createdBy,
              incidentId,
              rcaId,
              isExisting: true,
            },
          });
        } else {
          // Room doesn't exist anymore, remove from cache
          console.log(`📹 Cached room ${existingRoom.roomName} no longer exists on Daily.co, creating new one`);
          activeIncidentRooms.delete(incidentId);
        }
      } catch (verifyError) {
        console.error('📹 Error verifying room:', verifyError);
        activeIncidentRooms.delete(incidentId);
      }
    }

    // Check if there's already a pending room creation for this incident (mutex)
    const pendingCreation = pendingRoomCreations.get(incidentId);
    if (pendingCreation) {
      console.log(`📹 Waiting for pending room creation for incident ${incidentId}`);
      const result = await pendingCreation;
      if (result) {
        return res.json({
          success: true,
          room: {
            name: result.roomName,
            url: result.roomUrl,
            createdBy: result.createdBy,
            incidentId,
            rcaId,
            isExisting: true,
          },
        });
      }
    }

    // Create a promise for this room creation (mutex lock)
    const createRoomPromise = (async () => {
      // Double-check if room was created while we were waiting
      const recheck = activeIncidentRooms.get(incidentId);
      if (recheck) {
        return { roomName: recheck.roomName, roomUrl: recheck.roomUrl, createdBy: recheck.createdBy };
      }

      // Create a unique room name based on RCA/Incident
      const uniqueRoomName = roomName || `rca-${rcaId || incidentId}-${Date.now()}`;

      // Create room via Daily.co API
      const response = await fetch(`${DAILY_API_URL}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DAILY_API_KEY}`,
        },
        body: JSON.stringify({
          name: uniqueRoomName,
          privacy: 'private',
          properties: {
            enable_screenshare: true,
            enable_chat: true,
            enable_knocking: false,
            start_video_off: false,
            start_audio_off: false,
            max_participants: 20,
            exp: Math.floor(Date.now() / 1000) + 3600 * 4, // Room expires in 4 hours
            eject_at_room_exp: true,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Daily.co API error:', errorData);
        throw new Error('Failed to create video room');
      }

      const roomData = await response.json() as { name: string; url: string; id: string };

      // Store in active rooms cache
      activeIncidentRooms.set(incidentId, {
        roomName: roomData.name,
        roomUrl: roomData.url,
        createdAt: new Date(),
        createdBy: userId || 'unknown',
      });
      console.log(`📹 Created new room for incident ${incidentId}: ${roomData.name}`);

      return { roomName: roomData.name, roomUrl: roomData.url, createdBy: userId || 'unknown' };
    })();

    // Set the pending creation promise
    pendingRoomCreations.set(incidentId, createRoomPromise);

    try {
      const result = await createRoomPromise;
      
      return res.json({
        success: true,
        room: {
          name: result.roomName,
          url: result.roomUrl,
          createdBy: result.createdBy,
          incidentId,
          rcaId,
          isExisting: false,
        },
      });
    } finally {
      // Clean up pending creation
      pendingRoomCreations.delete(incidentId);
    }
  } catch (error) {
    console.error('Error creating video room:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create video room',
    });
  }
});

// Get meeting token for a participant
router.post('/get-token', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { roomName } = req.body;
    const user = req.user;

    console.log('📹 [get-token] Request for roomName:', roomName, 'by user:', user?.email);

    if (!DAILY_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Video call service not configured',
      });
    }

    if (!roomName) {
      console.log('📹 [get-token] ERROR: No roomName provided');
      return res.status(400).json({
        success: false,
        error: 'Room name is required',
      });
    }

    // Create a meeting token for the user
    // Build token properties including profile picture if available
    const tokenProperties: any = {
      room_name: roomName,
      user_name: `${user?.firstName} ${user?.lastName}`,
      user_id: user?.id,
      enable_screenshare: true,
      start_video_off: false,
      start_audio_off: false,
      exp: Math.floor(Date.now() / 1000) + 3600 * 4, // Token expires in 4 hours
    };

    // Add profile picture if user has one
    if ((user as any)?.profilePicture) {
      tokenProperties.user_picture = (user as any).profilePicture;
    }

    const response = await fetch(`${DAILY_API_URL}/meeting-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DAILY_API_KEY}`,
      },
      body: JSON.stringify({
        properties: tokenProperties,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Daily.co token error:', errorData);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to generate meeting token',
      });
    }

    const tokenData = await response.json() as { token: string };

    res.json({
      success: true,
      token: tokenData.token,
    });
  } catch (error) {
    console.error('Error generating meeting token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate meeting token',
    });
  }
});

// Delete a room
router.delete('/room/:roomName', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { roomName } = req.params;

    if (!DAILY_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Video call service not configured',
      });
    }

    const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorData = await response.json();
      console.error('Daily.co delete error:', errorData);
      return res.status(response.status).json({
        success: false,
        error: 'Failed to delete video room',
      });
    }

    res.json({
      success: true,
      message: 'Room deleted',
    });
  } catch (error) {
    console.error('Error deleting video room:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete video room',
    });
  }
});

// Get room info
router.get('/room/:roomName', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { roomName } = req.params;

    if (!DAILY_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'Video call service not configured',
      });
    }

    const response = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${DAILY_API_KEY}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Room not found',
        });
      }
      const errorData = await response.json();
      return res.status(response.status).json({
        success: false,
        error: 'Failed to get room info',
        details: errorData,
      });
    }

    const roomData = await response.json();

    res.json({
      success: true,
      room: roomData,
    });
  } catch (error) {
    console.error('Error getting room info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get room info',
    });
  }
});

// Get active call for an incident (if any)
router.get('/incident/:incidentId/active-call', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { incidentId } = req.params;

    const activeRoom = activeIncidentRooms.get(incidentId);
    
    if (!activeRoom) {
      return res.json({
        success: true,
        hasActiveCall: false,
        room: null,
      });
    }

    // Verify the room still exists on Daily.co
    if (DAILY_API_KEY) {
      try {
        const checkResponse = await fetch(`${DAILY_API_URL}/rooms/${activeRoom.roomName}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
        });
        
        if (!checkResponse.ok) {
          // Room doesn't exist anymore, remove from cache
          activeIncidentRooms.delete(incidentId);
          return res.json({
            success: true,
            hasActiveCall: false,
            room: null,
          });
        }

        // Get participant count from Daily
        const roomData = await checkResponse.json() as any;
        
        return res.json({
          success: true,
          hasActiveCall: true,
          room: {
            roomName: activeRoom.roomName,
            roomUrl: activeRoom.roomUrl,
            createdAt: activeRoom.createdAt,
            createdBy: activeRoom.createdBy,
          },
        });
      } catch (verifyError) {
        console.error('📹 Error verifying active room:', verifyError);
      }
    }

    // Return cached data without verification
    return res.json({
      success: true,
      hasActiveCall: true,
      room: {
        roomName: activeRoom.roomName,
        roomUrl: activeRoom.roomUrl,
        createdAt: activeRoom.createdAt,
        createdBy: activeRoom.createdBy,
      },
    });
  } catch (error) {
    console.error('Error checking active call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check active call',
    });
  }
});

// End/terminate a call for an incident (deletes room and clears cache)
router.post('/incident/:incidentId/end-call', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { incidentId } = req.params;
    const { roomName } = req.body;

    console.log(`📹 End call request for incident ${incidentId}, room: ${roomName}`);

    // Get the active room from cache
    const activeRoom = activeIncidentRooms.get(incidentId);
    const roomToDelete = roomName || activeRoom?.roomName;

    if (!roomToDelete) {
      // No active room, nothing to end
      return res.json({
        success: true,
        message: 'No active call to end',
      });
    }

    // Delete the room from Daily.co
    if (DAILY_API_KEY) {
      try {
        const deleteResponse = await fetch(`${DAILY_API_URL}/rooms/${roomToDelete}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
        });
        
        if (deleteResponse.ok || deleteResponse.status === 404) {
          console.log(`📹 Deleted room ${roomToDelete} from Daily.co`);
        } else {
          console.warn(`📹 Failed to delete room ${roomToDelete} from Daily.co:`, deleteResponse.status);
        }
      } catch (deleteError) {
        console.error('📹 Error deleting room from Daily.co:', deleteError);
        // Continue anyway - we still want to clear the cache
      }
    }

    // Clear from cache
    activeIncidentRooms.delete(incidentId);
    console.log(`📹 Cleared room from cache for incident ${incidentId}`);

    return res.json({
      success: true,
      message: 'Call ended successfully',
      roomName: roomToDelete,
    });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end call',
    });
  }
});

// Clear room from cache (called when video-call:ended websocket event is received)
// Export for websocket service to use
export const clearRoomFromCache = (incidentId: string, roomName?: string) => {
  const activeRoom = activeIncidentRooms.get(incidentId);
  if (activeRoom && (!roomName || activeRoom.roomName === roomName)) {
    activeIncidentRooms.delete(incidentId);
    console.log(`📹 Cleared room from cache for incident ${incidentId}`);
    return true;
  }
  return false;
};

export default router;
