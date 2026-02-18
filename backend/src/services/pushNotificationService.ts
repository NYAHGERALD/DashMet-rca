// Push Notification Service - FCM (Firebase Cloud Messaging)
// Handles push notifications to iOS/Android devices

import { adminMessaging } from '../config/firebase-admin';
import { prisma } from '../utils/prisma';
import type { Message, MulticastMessage, BatchResponse } from 'firebase-admin/messaging';

// ============================================================================
// TYPES
// ============================================================================

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  imageUrl?: string;
}

export interface TaskActivityNotification {
  taskId: string;
  taskTitle: string;
  action: string;
  actorName: string;
  actorId: string;
  field?: string;
  previousValue?: string;
  newValue?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get readable action text for notification body
 */
function getActionText(action: string, actorName: string, field?: string, previousValue?: string, newValue?: string, metadata?: Record<string, any>): string {
  switch (action) {
    case 'CREATE':
      return `${actorName} created this action item`;
    case 'UPDATE_STATUS':
      return `${actorName} changed status from "${previousValue}" to "${newValue}"`;
    case 'UPDATE_PRIORITY':
      return `${actorName} changed priority from "${previousValue}" to "${newValue}"`;
    case 'UPDATE_PROGRESS':
      return `${actorName} changed progress from ${previousValue}% to ${newValue}%`;
    case 'UPDATE_TITLE':
      return `${actorName} updated the title`;
    case 'UPDATE_DESCRIPTION':
      return `${actorName} updated the description`;
    case 'UPDATE_DUE_DATE':
      const oldDate = previousValue ? new Date(previousValue).toLocaleDateString() : 'none';
      const newDate = newValue ? new Date(newValue).toLocaleDateString() : 'none';
      return `${actorName} changed due date from ${oldDate} to ${newDate}`;
    case 'ADD_ASSIGNEE':
      return `${actorName} assigned "${newValue}" to this task`;
    case 'REMOVE_ASSIGNEE':
      return `${actorName} removed "${previousValue}" from this task`;
    case 'ADD_COMMENT':
      return `${actorName} added a comment`;
    case 'DELETE_COMMENT':
      return `${actorName} deleted a comment`;
    case 'ADD_EVIDENCE':
      const fileName = metadata?.fileName;
      return fileName 
        ? `${actorName} added evidence: "${newValue}" (${fileName})`
        : `${actorName} added evidence: "${newValue}"`;
    case 'DELETE_EVIDENCE':
      return `${actorName} deleted evidence: "${previousValue}"`;
    case 'LOCK':
      return `${actorName} locked this action item`;
    case 'UNLOCK':
      return `${actorName} unlocked this action item`;
    case 'COMPLETE':
      return `${actorName} marked this action item as complete`;
    case 'REOPEN':
      return `${actorName} reopened this action item`;
    default:
      return `${actorName} updated this action item`;
  }
}

/**
 * Get notification title based on action type
 */
function getNotificationTitle(action: string, taskTitle: string): string {
  const shortTitle = taskTitle.length > 30 ? taskTitle.substring(0, 27) + '...' : taskTitle;
  
  switch (action) {
    case 'CREATE':
      return `New Action Item`;
    case 'ADD_ASSIGNEE':
      return `You were assigned`;
    case 'REMOVE_ASSIGNEE':
      return `Assignment removed`;
    case 'ADD_COMMENT':
      return `New Comment`;
    case 'ADD_EVIDENCE':
      return `Evidence Added`;
    case 'UPDATE_STATUS':
      return `Status Updated`;
    case 'COMPLETE':
      return `Action Item Completed`;
    case 'LOCK':
      return `Action Item Locked`;
    default:
      return `Action Item Updated`;
  }
}

// ============================================================================
// DEVICE TOKEN MANAGEMENT
// ============================================================================

/**
 * Register or update a device token for a user
 */
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'IOS' | 'ANDROID' | 'WEB' = 'IOS',
  deviceId?: string,
  appVersion?: string
): Promise<boolean> {
  try {
    // Upsert the device token
    await prisma.deviceToken.upsert({
      where: {
        userId_token: {
          userId,
          token,
        },
      },
      update: {
        platform,
        deviceId,
        appVersion,
        isActive: true,
        lastUsedAt: new Date(),
      },
      create: {
        userId,
        token,
        platform,
        deviceId,
        appVersion,
        isActive: true,
      },
    });

    console.log(`✅ Device token registered for user ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to register device token:', error);
    return false;
  }
}

/**
 * Unregister a device token (e.g., on logout)
 */
export async function unregisterDeviceToken(userId: string, token: string): Promise<boolean> {
  try {
    await prisma.deviceToken.updateMany({
      where: {
        userId,
        token,
      },
      data: {
        isActive: false,
      },
    });

    console.log(`✅ Device token unregistered for user ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to unregister device token:', error);
    return false;
  }
}

/**
 * Unregister all device tokens for a user (e.g., on account deletion)
 */
export async function unregisterAllDeviceTokens(userId: string): Promise<boolean> {
  try {
    await prisma.deviceToken.updateMany({
      where: { userId },
      data: { isActive: false },
    });

    console.log(`✅ All device tokens unregistered for user ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to unregister all device tokens:', error);
    return false;
  }
}

/**
 * Get all active device tokens for a user
 */
export async function getActiveDeviceTokens(userId: string): Promise<string[]> {
  const tokens = await prisma.deviceToken.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      token: true,
    },
  });

  return tokens.map(t => t.token);
}

/**
 * Get all active device tokens for multiple users
 */
export async function getActiveDeviceTokensForUsers(userIds: string[]): Promise<Map<string, string[]>> {
  const tokens = await prisma.deviceToken.findMany({
    where: {
      userId: { in: userIds },
      isActive: true,
    },
    select: {
      userId: true,
      token: true,
    },
  });

  const tokenMap = new Map<string, string[]>();
  for (const t of tokens) {
    const existing = tokenMap.get(t.userId) || [];
    existing.push(t.token);
    tokenMap.set(t.userId, existing);
  }

  return tokenMap;
}

// ============================================================================
// PUSH NOTIFICATION SENDING
// ============================================================================

/**
 * Send a push notification to a single device
 */
export async function sendPushNotification(
  token: string,
  payload: PushNotificationPayload
): Promise<boolean> {
  try {
    const message: Message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      apns: {
        payload: {
          aps: {
            badge: payload.badge,
            sound: payload.sound || 'default',
            'mutable-content': 1,
            'content-available': 1,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: payload.sound || 'default',
          priority: 'high',
          channelId: 'action_items',
        },
      },
    };

    const response = await adminMessaging.send(message);
    console.log(`✅ Push notification sent: ${response}`);
    return true;
  } catch (error: any) {
    console.error('❌ Failed to send push notification:', error);
    
    // Handle invalid token - mark as inactive
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      await markTokenAsInvalid(token);
    }
    
    return false;
  }
}

/**
 * Send push notification to multiple devices (multicast)
 */
export async function sendPushNotificationToMultiple(
  tokens: string[],
  payload: PushNotificationPayload
): Promise<{ successCount: number; failureCount: number }> {
  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    // FCM has a limit of 500 tokens per multicast
    const batchSize = 500;
    let totalSuccess = 0;
    let totalFailure = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < tokens.length; i += batchSize) {
      const batchTokens = tokens.slice(i, i + batchSize);
      
      const message: MulticastMessage = {
        tokens: batchTokens,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data,
        apns: {
          payload: {
            aps: {
              badge: payload.badge,
              sound: payload.sound || 'default',
              'mutable-content': 1,
              'content-available': 1,
            },
          },
        },
        android: {
          priority: 'high',
          notification: {
            sound: payload.sound || 'default',
            priority: 'high',
            channelId: 'action_items',
          },
        },
      };

      const response: BatchResponse = await adminMessaging.sendEachForMulticast(message);
      
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;

      // Collect invalid tokens
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          if (resp.error.code === 'messaging/invalid-registration-token' ||
              resp.error.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(batchTokens[idx]);
          }
        }
      });
    }

    // Mark invalid tokens as inactive
    if (invalidTokens.length > 0) {
      await markTokensAsInvalid(invalidTokens);
    }

    console.log(`✅ Multicast sent: ${totalSuccess} success, ${totalFailure} failure`);
    return { successCount: totalSuccess, failureCount: totalFailure };
  } catch (error) {
    console.error('❌ Failed to send multicast push notification:', error);
    return { successCount: 0, failureCount: tokens.length };
  }
}

/**
 * Mark a token as invalid/inactive
 */
async function markTokenAsInvalid(token: string): Promise<void> {
  try {
    await prisma.deviceToken.updateMany({
      where: { token },
      data: { isActive: false },
    });
    console.log(`🔕 Marked invalid token as inactive: ${token.substring(0, 20)}...`);
  } catch (error) {
    console.error('Failed to mark token as invalid:', error);
  }
}

/**
 * Mark multiple tokens as invalid/inactive
 */
async function markTokensAsInvalid(tokens: string[]): Promise<void> {
  try {
    await prisma.deviceToken.updateMany({
      where: { token: { in: tokens } },
      data: { isActive: false },
    });
    console.log(`🔕 Marked ${tokens.length} invalid tokens as inactive`);
  } catch (error) {
    console.error('Failed to mark tokens as invalid:', error);
  }
}

// ============================================================================
// TASK ACTIVITY NOTIFICATIONS
// ============================================================================

/**
 * Send push notifications for a task activity to all relevant users
 * This includes: owner, all assignees (except the actor who triggered the activity)
 */
export async function sendTaskActivityNotification(
  notification: TaskActivityNotification
): Promise<void> {
  try {
    const { taskId, taskTitle, action, actorName, actorId, field, previousValue, newValue, metadata } = notification;

    // Get the task with owner and assignees
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
        assignees: {
          select: {
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!task) {
      console.log(`⚠️ Task not found for notification: ${taskId}`);
      return;
    }

    // Collect all user IDs to notify (owner + all assignees, excluding the actor)
    const userIdsToNotify = new Set<string>();
    
    // Add owner
    if (task.owner.id !== actorId) {
      userIdsToNotify.add(task.owner.id);
    }
    
    // Add assignees
    for (const assignee of task.assignees) {
      if (assignee.user.id !== actorId) {
        userIdsToNotify.add(assignee.user.id);
      }
    }

    if (userIdsToNotify.size === 0) {
      console.log(`📭 No users to notify for task activity (actor is the only relevant user)`);
      return;
    }

    // Get device tokens for all users
    const tokenMap = await getActiveDeviceTokensForUsers(Array.from(userIdsToNotify));
    
    // Collect all tokens
    const allTokens: string[] = [];
    tokenMap.forEach((tokens) => {
      allTokens.push(...tokens);
    });

    if (allTokens.length === 0) {
      console.log(`📭 No device tokens found for users: ${Array.from(userIdsToNotify).join(', ')}`);
      return;
    }

    // Prepare notification payload
    const title = getNotificationTitle(action, taskTitle);
    const body = getActionText(action, actorName, field, previousValue, newValue, metadata);
    
    const payload: PushNotificationPayload = {
      title,
      body,
      sound: 'default',
      badge: 1,
      data: {
        type: 'TASK_ACTIVITY',
        taskId,
        action,
        actorId,
        timestamp: new Date().toISOString(),
      },
    };

    // Send notifications
    const result = await sendPushNotificationToMultiple(allTokens, payload);
    
    console.log(`📬 Task activity notification sent for task ${taskId}: ${result.successCount} delivered, ${result.failureCount} failed`);
  } catch (error) {
    console.error('❌ Failed to send task activity notification:', error);
    // Don't throw - notification failure should not break the main operation
  }
}

/**
 * Send a direct push notification to a specific user
 */
export async function sendPushNotificationToUser(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ successCount: number; failureCount: number }> {
  const tokens = await getActiveDeviceTokens(userId);
  
  if (tokens.length === 0) {
    console.log(`📭 No device tokens found for user: ${userId}`);
    return { successCount: 0, failureCount: 0 };
  }

  return sendPushNotificationToMultiple(tokens, payload);
}
