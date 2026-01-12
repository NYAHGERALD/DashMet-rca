'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import { chatUnreadStore } from '@/lib/chatUnreadStore';
import { useAuth } from '@/components/providers/AuthProvider';

interface UnreadIncident {
  incidentId: string;
  count: number;
}

export default function GlobalChatIndicator() {
  const { user } = useAuth();
  const router = useRouter();
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadIncidents, setUnreadIncidents] = useState<UnreadIncident[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Subscribe to unread count changes
  useEffect(() => {
    if (!user) {
      console.log('🔔 GlobalChatIndicator: No user, skipping');
      return;
    }

    console.log('🔔 GlobalChatIndicator: Subscribing to unread count changes');
    
    // Initial load
    updateUnreadState();

    // Subscribe to changes
    const unsubscribe = chatUnreadStore.subscribe((incidentId, count) => {
      console.log(`🔔 GlobalChatIndicator: Received update for ${incidentId}: ${count}`);
      updateUnreadState();
    });

    return () => {
      console.log('🔔 GlobalChatIndicator: Unsubscribing');
      unsubscribe();
    };
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateUnreadState = () => {
    const total = chatUnreadStore.getTotalCount();
    const counts = chatUnreadStore.getAllCounts();
    
    console.log('🔔 GlobalChatIndicator: Updating state', { total, counts });
    
    setTotalUnread(total);
    setUnreadIncidents(
      Object.entries(counts)
        .filter(([_, count]) => count > 0)
        .map(([incidentId, count]) => ({ incidentId, count }))
        .sort((a, b) => b.count - a.count)
    );
  };

  const handleIncidentClick = (incidentId: string) => {
    setIsOpen(false);
    router.push(`/incidents/${incidentId}`);
  };

  const handleClearAll = () => {
    unreadIncidents.forEach(({ incidentId }) => {
      chatUnreadStore.clearCount(incidentId);
    });
    setIsOpen(false);
  };

  // Don't render if no unread messages
  if (totalUnread === 0) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Chat Indicator Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        aria-label={`${totalUnread} unread chat messages`}
      >
        <MessageCircle className="w-6 h-6" />
        
        {/* Badge */}
        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full px-1 animate-pulse">
          {totalUnread > 99 ? '99+' : totalUnread}
        </span>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Unread Messages
            </h3>
            {unreadIncidents.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {unreadIncidents.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">
                No unread messages
              </div>
            ) : (
              unreadIncidents.map(({ incidentId, count }) => (
                <button
                  key={incidentId}
                  onClick={() => handleIncidentClick(incidentId)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <MessageCircle className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Incident Chat
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {count} unread message{count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="min-w-[24px] h-6 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full px-2">
                    {count > 99 ? '99+' : count}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Click on an incident to view messages
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
