'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MessageCircle, X, ChevronUp } from 'lucide-react';
import { chatUnreadStore } from '@/lib/chatUnreadStore';
import { useAuth } from '@/components/providers/AuthProvider';

interface UnreadIncident {
  incidentId: string;
  count: number;
}

export default function FloatingChatIndicator() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [totalUnread, setTotalUnread] = useState(0);
  const [unreadIncidents, setUnreadIncidents] = useState<UnreadIncident[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Don't show on login/register pages or when user is not authenticated
  const isAuthPage = pathname?.startsWith('/login') || 
                     pathname?.startsWith('/register') || 
                     pathname?.startsWith('/forgot-password') ||
                     pathname?.startsWith('/reset-password');

  // Don't show on incident detail pages (ChatSidebar handles it there)
  // Match /incidents/[uuid] pattern - any path starting with /incidents/ followed by a UUID-like string
  const incidentIdPattern = /^\/incidents\/[a-f0-9-]{36}/i;
  const isIncidentPage = pathname ? incidentIdPattern.test(pathname) : false;

  // Subscribe to unread count changes
  useEffect(() => {
    if (!user) return;

    console.log('🔔 FloatingChatIndicator: Subscribing to unread count changes');
    
    // Initial load
    updateUnreadState();

    // Subscribe to changes
    const unsubscribe = chatUnreadStore.subscribe((incidentId, count) => {
      console.log(`🔔 FloatingChatIndicator: Received update for ${incidentId}: ${count}`);
      updateUnreadState();
    });

    return () => {
      console.log('🔔 FloatingChatIndicator: Unsubscribing');
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
    
    console.log('🔔 FloatingChatIndicator: Updating state', { total, counts });
    
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

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    unreadIncidents.forEach(({ incidentId }) => {
      chatUnreadStore.clearCount(incidentId);
    });
    setIsOpen(false);
  };

  // DEBUG: Log render state
  console.log('🎯 FloatingChatIndicator render:', { user: !!user, isAuthPage, isIncidentPage, totalUnread });

  // Don't render if not authenticated or on auth pages
  if (!user || isAuthPage) {
    console.log('🎯 FloatingChatIndicator: Not rendering - no user or auth page');
    return null;
  }

  // Don't render on incident pages (ChatSidebar handles notifications there)
  if (isIncidentPage) {
    console.log('🎯 FloatingChatIndicator: Not rendering - incident page has ChatSidebar');
    return null;
  }

  // Don't render if no unread messages
  if (totalUnread === 0) {
    console.log('🎯 FloatingChatIndicator: Not rendering - no unread messages');
    return null;
  }

  return (
    <div 
      className="fixed bottom-6 left-6 z-[9999]" 
      ref={dropdownRef}
    >
      {/* Dropdown (appears above the button) */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-600 to-primary-700">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Unread Messages
            </h3>
            <button
              onClick={handleClearAll}
              className="text-xs text-primary-100 hover:text-white transition-colors"
            >
              Clear all
            </button>
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {unreadIncidents.map(({ incidentId, count }) => (
              <button
                key={incidentId}
                onClick={() => handleIncidentClick(incidentId)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Incident Chat
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {count} new message{count !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <span className="min-w-[28px] h-7 flex items-center justify-center text-sm font-bold text-white bg-red-500 rounded-full px-2">
                  {count > 99 ? '99+' : count}
                </span>
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Click to view messages
            </p>
          </div>
        </div>
      )}

      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
        aria-label={`${totalUnread} unread chat messages`}
      >
        <MessageCircle className="w-6 h-6" />
        
        {/* Badge */}
        <span className="absolute -top-1 -right-1 min-w-[24px] h-6 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full px-1.5 shadow-md animate-pulse">
          {totalUnread > 99 ? '99+' : totalUnread}
        </span>

        {/* Expand indicator */}
        {isOpen && (
          <ChevronUp className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-4 h-4 text-gray-400" />
        )}
      </button>
    </div>
  );
}
