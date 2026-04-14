/**
 * Browser Notification Service
 * 
 * Handles Web Notifications API with:
 * - Permission management
 * - Notification persistence
 * - Snooze/dismiss functionality
 * - Cross-browser compatibility
 * - Smart notification delivery
 */

export type NotificationType = 
  | 'team_invitation' 
  | 'chat_message' 
  | 'incident_update'
  | 'mention'
  | 'lsw_task_overdue'
  | 'lsw_todo_overdue'
  | 'lsw_meeting_overdue'
  | 'lsw_followup_overdue'
  | 'lsw_upcoming_reminder'
  | 'lsw_frequency_task_due'
  | 'bakery_metrics_submitted';

export interface BrowserNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;
  tag?: string; // Groups notifications by tag
  data?: {
    incidentId?: string;
    incidentNumber?: string;
    chatId?: string;
    url?: string;
    senderId?: string;
    senderName?: string;
    lswNotificationId?: string;
  };
  createdAt: number;
  expiresAt?: number;
  snoozedUntil?: number;
  dismissed?: boolean;
  clicked?: boolean;
}

interface PersistedNotification extends BrowserNotification {
  lastShown?: number;
}

// Storage keys
const STORAGE_KEYS = {
  NOTIFICATIONS: 'dashmet_browser_notifications',
  PERMISSION: 'dashmet_notification_permission',
  SNOOZE_SETTINGS: 'dashmet_snooze_settings',
  CHAT_OPEN_STATE: 'dashmet_chat_open_state',
};

// Snooze durations in milliseconds
export const SNOOZE_DURATIONS = {
  '15_MINUTES': 15 * 60 * 1000,
  '30_MINUTES': 30 * 60 * 1000,
  '1_HOUR': 60 * 60 * 1000,
  '2_HOURS': 2 * 60 * 60 * 1000,
  '4_HOURS': 4 * 60 * 60 * 1000,
  'UNTIL_TOMORROW': 24 * 60 * 60 * 1000,
} as const;

export type SnoozeDuration = keyof typeof SNOOZE_DURATIONS;

class BrowserNotificationService {
  private static instance: BrowserNotificationService;
  private notifications: Map<string, PersistedNotification> = new Map();
  private isSupported: boolean = false;
  private permission: NotificationPermission = 'default';
  private onNotificationClick?: (notification: BrowserNotification) => void;
  private onNotificationDismiss?: (notificationId: string) => void;
  private activeNotifications: Map<string, Notification> = new Map();

  private constructor() {
    this.isSupported = typeof window !== 'undefined' && 'Notification' in window;
    if (this.isSupported) {
      this.permission = Notification.permission;
      this.loadPersistedNotifications();
    }
  }

  static getInstance(): BrowserNotificationService {
    if (!BrowserNotificationService.instance) {
      BrowserNotificationService.instance = new BrowserNotificationService();
    }
    return BrowserNotificationService.instance;
  }

  /**
   * Check if browser notifications are supported
   */
  isNotificationSupported(): boolean {
    return this.isSupported;
  }

  /**
   * Get current permission state
   */
  getPermission(): NotificationPermission {
    return this.permission;
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      console.warn('Browser notifications are not supported');
      return 'denied';
    }

    try {
      this.permission = await Notification.requestPermission();
      localStorage.setItem(STORAGE_KEYS.PERMISSION, this.permission);
      return this.permission;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied';
    }
  }

  /**
   * Set callback for notification click
   */
  setOnNotificationClick(callback: (notification: BrowserNotification) => void): void {
    this.onNotificationClick = callback;
  }

  /**
   * Set callback for notification dismiss
   */
  setOnNotificationDismiss(callback: (notificationId: string) => void): void {
    this.onNotificationDismiss = callback;
  }

  /**
   * Show a browser notification
   */
  async showNotification(notification: BrowserNotification): Promise<boolean> {
    if (!this.isSupported || this.permission !== 'granted') {
      console.log('Notifications not available or not permitted');
      // Still persist the notification for in-app display
      this.persistNotification(notification);
      return false;
    }

    // Check if notification is snoozed
    if (notification.snoozedUntil && notification.snoozedUntil > Date.now()) {
      console.log('Notification is snoozed until:', new Date(notification.snoozedUntil));
      return false;
    }

    // Check if notification was dismissed
    if (notification.dismissed) {
      return false;
    }

    try {
      const browserNotification = new Notification(notification.title, {
        body: notification.body,
        icon: notification.icon || '/icon-192x192.png',
        tag: notification.tag || notification.id,
        requireInteraction: true, // Keep notification visible until user interacts
        silent: false,
        data: notification,
      });

      // Track active notification
      this.activeNotifications.set(notification.id, browserNotification);

      browserNotification.onclick = () => {
        window.focus();
        browserNotification.close();
        this.activeNotifications.delete(notification.id);
        this.markAsClicked(notification.id);
        if (this.onNotificationClick) {
          this.onNotificationClick(notification);
        }
      };

      browserNotification.onclose = () => {
        this.activeNotifications.delete(notification.id);
      };

      browserNotification.onerror = (error) => {
        console.error('Notification error:', error);
        this.activeNotifications.delete(notification.id);
      };

      // Persist notification
      this.persistNotification({
        ...notification,
        lastShown: Date.now(),
      });

      return true;
    } catch (error) {
      console.error('Error showing notification:', error);
      return false;
    }
  }

  /**
   * Show team invitation notification
   */
  async showTeamInvitation(data: {
    incidentId: string;
    incidentNumber: string;
    customTitle?: string;
    invitedBy: { firstName: string; lastName: string };
    role: string;
  }): Promise<boolean> {
    const notification: BrowserNotification = {
      id: `invitation_${data.incidentId}_${Date.now()}`,
      type: 'team_invitation',
      title: '👥 Team Incident Invitation',
      body: `${data.invitedBy.firstName} ${data.invitedBy.lastName} invited you to join ${data.customTitle || data.incidentNumber}`,
      tag: `invitation_${data.incidentId}`,
      data: {
        incidentId: data.incidentId,
        incidentNumber: data.incidentNumber,
        senderName: `${data.invitedBy.firstName} ${data.invitedBy.lastName}`,
        url: `/incidents?filter=team`,
      },
      createdAt: Date.now(),
    };

    return this.showNotification(notification);
  }

  /**
   * Show chat message notification (only if chat is not open)
   */
  async showChatNotification(data: {
    incidentId: string;
    incidentNumber: string;
    senderName: string;
    senderId: string;
    messagePreview: string;
    isMention?: boolean;
  }): Promise<boolean> {
    // Check if chat is currently open for this incident
    if (this.isChatOpen(data.incidentId)) {
      return false;
    }

    // Check if there's a recent notification for this incident (throttle)
    const existingNotification = this.getNotificationByTag(`chat_${data.incidentId}`);
    if (existingNotification && Date.now() - existingNotification.createdAt < 30000) {
      // Update existing notification instead of creating new one
      return false;
    }

    const notification: BrowserNotification = {
      id: `chat_${data.incidentId}_${Date.now()}`,
      type: data.isMention ? 'mention' : 'chat_message',
      title: data.isMention 
        ? `📣 ${data.senderName} mentioned you`
        : `💬 New message from ${data.senderName}`,
      body: data.messagePreview.length > 100 
        ? data.messagePreview.substring(0, 100) + '...' 
        : data.messagePreview,
      tag: `chat_${data.incidentId}`,
      data: {
        incidentId: data.incidentId,
        incidentNumber: data.incidentNumber,
        senderId: data.senderId,
        senderName: data.senderName,
        url: `/incidents/${data.incidentId}`,
      },
      createdAt: Date.now(),
    };

    return this.showNotification(notification);
  }

  /**
   * Show an LSW notification (overdue or reminder)
   */
  async showLswNotification(data: {
    id: string;
    type: string;
    title: string;
    message: string;
  }): Promise<boolean> {
    const typeMap: Record<string, NotificationType> = {
      LSW_TASK_OVERDUE: 'lsw_task_overdue',
      LSW_TODO_OVERDUE: 'lsw_todo_overdue',
      LSW_MEETING_OVERDUE: 'lsw_meeting_overdue',
      LSW_FOLLOWUP_OVERDUE: 'lsw_followup_overdue',
      LSW_UPCOMING_REMINDER: 'lsw_upcoming_reminder',
      LSW_FREQUENCY_TASK_DUE: 'lsw_frequency_task_due',
      BAKERY_METRICS_SUBMITTED: 'bakery_metrics_submitted',
    };

    const notification: BrowserNotification = {
      id: `lsw_${data.id}`,
      type: typeMap[data.type] || 'lsw_task_overdue',
      title: data.title,
      body: data.message,
      tag: `lsw_${data.type}_${data.id}`,
      data: {
        url: '/lsw',
        lswNotificationId: data.id,
      },
      createdAt: Date.now(),
    };

    return this.showNotification(notification);
  }

  /**
   * Mark chat as open for an incident (prevents notifications)
   */
  setChatOpen(incidentId: string, isOpen: boolean): void {
    const state = this.getChatOpenState();
    if (isOpen) {
      state[incidentId] = Date.now();
    } else {
      delete state[incidentId];
    }
    localStorage.setItem(STORAGE_KEYS.CHAT_OPEN_STATE, JSON.stringify(state));
  }

  /**
   * Check if chat is open for an incident
   */
  isChatOpen(incidentId: string): boolean {
    const state = this.getChatOpenState();
    const openTime = state[incidentId];
    // Consider chat open if it was opened within the last 5 minutes
    return openTime ? Date.now() - openTime < 5 * 60 * 1000 : false;
  }

  private getChatOpenState(): Record<string, number> {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.CHAT_OPEN_STATE);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Snooze a notification
   */
  snoozeNotification(notificationId: string, duration: SnoozeDuration): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.snoozedUntil = Date.now() + SNOOZE_DURATIONS[duration];
      this.persistNotifications();
      
      // Close active browser notification
      const activeNotification = this.activeNotifications.get(notificationId);
      if (activeNotification) {
        activeNotification.close();
        this.activeNotifications.delete(notificationId);
      }
    }
  }

  /**
   * Dismiss a notification permanently
   */
  dismissNotification(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.dismissed = true;
      this.persistNotifications();
      
      // Close active browser notification
      const activeNotification = this.activeNotifications.get(notificationId);
      if (activeNotification) {
        activeNotification.close();
        this.activeNotifications.delete(notificationId);
      }

      if (this.onNotificationDismiss) {
        this.onNotificationDismiss(notificationId);
      }
    }
  }

  /**
   * Mark notification as clicked
   */
  private markAsClicked(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.clicked = true;
      this.persistNotifications();
    }
  }

  /**
   * Get all active (non-dismissed, non-snoozed) notifications
   */
  getActiveNotifications(): BrowserNotification[] {
    const now = Date.now();
    return Array.from(this.notifications.values())
      .filter(n => !n.dismissed && (!n.snoozedUntil || n.snoozedUntil <= now))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get all notifications including snoozed/dismissed
   */
  getAllNotifications(): BrowserNotification[] {
    return Array.from(this.notifications.values())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get notification by tag
   */
  private getNotificationByTag(tag: string): BrowserNotification | undefined {
    return Array.from(this.notifications.values())
      .find(n => n.tag === tag && !n.dismissed);
  }

  /**
   * Clear all notifications
   */
  clearAllNotifications(): void {
    this.notifications.clear();
    this.persistNotifications();
    
    // Close all active browser notifications
    this.activeNotifications.forEach(notification => notification.close());
    this.activeNotifications.clear();
  }

  /**
   * Remove expired notifications (older than 7 days)
   */
  cleanupExpiredNotifications(): void {
    const expiryTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    const toDelete: string[] = [];
    
    this.notifications.forEach((notification, id) => {
      if (notification.createdAt < expiryTime || notification.dismissed) {
        toDelete.push(id);
      }
    });

    toDelete.forEach(id => this.notifications.delete(id));
    this.persistNotifications();
  }

  /**
   * Persist notification
   */
  private persistNotification(notification: PersistedNotification): void {
    this.notifications.set(notification.id, notification);
    this.persistNotifications();
  }

  /**
   * Persist all notifications to localStorage
   */
  private persistNotifications(): void {
    try {
      const data = Array.from(this.notifications.entries());
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(data));
    } catch (error) {
      console.error('Error persisting notifications:', error);
    }
  }

  /**
   * Load persisted notifications from localStorage
   */
  private loadPersistedNotifications(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (stored) {
        const data: [string, PersistedNotification][] = JSON.parse(stored);
        this.notifications = new Map(data);
        this.cleanupExpiredNotifications();
      }
    } catch (error) {
      console.error('Error loading persisted notifications:', error);
      this.notifications = new Map();
    }
  }

  /**
   * Get unread count (active notifications that haven't been clicked)
   */
  getUnreadCount(): number {
    const now = Date.now();
    return Array.from(this.notifications.values())
      .filter(n => !n.dismissed && !n.clicked && (!n.snoozedUntil || n.snoozedUntil <= now))
      .length;
  }
}

// Export singleton instance
export const browserNotificationService = BrowserNotificationService.getInstance();

// Export helper function for checking support
export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// Export helper for generating notification IDs
export function generateNotificationId(type: NotificationType, entityId: string): string {
  return `${type}_${entityId}_${Date.now()}`;
}
