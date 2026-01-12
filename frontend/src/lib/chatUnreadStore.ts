/**
 * Chat Unread Count Store
 * 
 * Manages persistent unread message counts across page navigations.
 * Uses localStorage for persistence and provides real-time updates via events.
 */

const STORAGE_KEY = 'dashmet_chat_unread_counts';

interface UnreadCounts {
  [incidentId: string]: number;
}

type UnreadCountListener = (incidentId: string, count: number) => void;

class ChatUnreadStore {
  private static instance: ChatUnreadStore;
  private listeners: Set<UnreadCountListener> = new Set();
  private counts: UnreadCounts = {};

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): ChatUnreadStore {
    if (!ChatUnreadStore.instance) {
      ChatUnreadStore.instance = new ChatUnreadStore();
    }
    return ChatUnreadStore.instance;
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.counts = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load unread counts from storage:', error);
      this.counts = {};
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.counts));
    } catch (error) {
      console.error('Failed to save unread counts to storage:', error);
    }
  }

  private notifyListeners(incidentId: string, count: number): void {
    this.listeners.forEach(listener => {
      try {
        listener(incidentId, count);
      } catch (error) {
        console.error('Error in unread count listener:', error);
      }
    });
  }

  /**
   * Get unread count for an incident
   */
  getCount(incidentId: string): number {
    return this.counts[incidentId] || 0;
  }

  /**
   * Set unread count for an incident (used when syncing with backend)
   */
  setCount(incidentId: string, count: number): void {
    const oldCount = this.counts[incidentId] || 0;
    if (count === 0) {
      delete this.counts[incidentId];
    } else {
      this.counts[incidentId] = count;
    }
    this.saveToStorage();
    
    if (oldCount !== count) {
      this.notifyListeners(incidentId, count);
    }
  }

  /**
   * Increment unread count for an incident
   */
  incrementCount(incidentId: string): number {
    const newCount = (this.counts[incidentId] || 0) + 1;
    this.counts[incidentId] = newCount;
    this.saveToStorage();
    this.notifyListeners(incidentId, newCount);
    return newCount;
  }

  /**
   * Clear unread count for an incident (when user opens chat)
   */
  clearCount(incidentId: string): void {
    if (this.counts[incidentId]) {
      delete this.counts[incidentId];
      this.saveToStorage();
      this.notifyListeners(incidentId, 0);
    }
  }

  /**
   * Get total unread count across all incidents
   */
  getTotalCount(): number {
    return Object.values(this.counts).reduce((sum, count) => sum + count, 0);
  }

  /**
   * Subscribe to unread count changes
   */
  subscribe(listener: UnreadCountListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get all unread counts
   */
  getAllCounts(): UnreadCounts {
    return { ...this.counts };
  }
}

export const chatUnreadStore = ChatUnreadStore.getInstance();
