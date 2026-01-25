'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useWebSocket } from '@/lib/websocket';
import { useAuth } from '@/components/providers/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, X, Sparkles } from 'lucide-react';
import api from '@/lib/api';

// Interface for status change notification
interface StatusNotification {
  id: string;
  subject: string;
  status: string;
  previousStatus: string;
  message: string;
  resolvedBy: { id: string; firstName: string; lastName: string } | null;
  updatedAt: string;
}

// Context for external access if needed
const SupportStatusNotificationContext = createContext<{
  pendingNotifications: StatusNotification[];
  dismissNotification: (id: string, status: string) => void;
  refreshNotifications: () => void;
}>({
  pendingNotifications: [],
  dismissNotification: () => {},
  refreshNotifications: () => {},
});

export function useSupportStatusNotification() {
  return useContext(SupportStatusNotificationContext);
}

export function SupportStatusNotificationProvider({ children }: { children: React.ReactNode }) {
  const { onSupportStatusChanged, isConnected, connect } = useWebSocket();
  const { user } = useAuth();
  const [pendingNotifications, setPendingNotifications] = useState<StatusNotification[]>([]);
  const [currentNotification, setCurrentNotification] = useState<StatusNotification | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const hasFetchedRef = useRef(false);
  const dismissingRef = useRef<Set<string>>(new Set());

  // Fetch pending status notifications from the database
  const fetchPendingNotifications = useCallback(async () => {
    if (!user || isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await api.get('/support/status-notifications/pending');
      const notifications = response.data?.data || [];
      console.log('📬 Fetched pending status notifications from database:', notifications.length);
      setPendingNotifications(notifications);
      
      // Show the first notification if available
      if (notifications.length > 0) {
        setCurrentNotification(notifications[0]);
        setIsModalOpen(true);
      }
    } catch (error) {
      console.error('Error fetching pending status notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoading]);

  // Fetch notifications when user logs in
  useEffect(() => {
    if (user && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchPendingNotifications();
    }
    
    // Reset the flag when user changes
    if (!user) {
      hasFetchedRef.current = false;
      setPendingNotifications([]);
      setCurrentNotification(null);
      setIsModalOpen(false);
    }
  }, [user, fetchPendingNotifications]);

  // Auto-connect WebSocket when user is logged in
  useEffect(() => {
    if (user && !isConnected) {
      connect(user.id, user.organizationId);
    }
  }, [user, isConnected, connect]);

  // Dismiss a notification via API
  const dismissNotification = useCallback(async (id: string, status: string) => {
    const key = `${id}:${status}`;
    
    // Prevent double-dismiss
    if (dismissingRef.current.has(key)) return;
    dismissingRef.current.add(key);
    
    // Optimistically update the UI
    setPendingNotifications(prev => {
      const updated = prev.filter(n => n.id !== id);
      // If there are more notifications, show the next one
      if (updated.length > 0) {
        setCurrentNotification(updated[0]);
      } else {
        setCurrentNotification(null);
        setIsModalOpen(false);
      }
      return updated;
    });
    
    try {
      await api.post(`/support/status-notifications/${id}/dismiss`, { status });
      console.log('📬 Status notification dismissed in database:', id, status);
    } catch (error) {
      console.error('Error dismissing status notification:', error);
      // Refetch to restore state if the API call failed
      fetchPendingNotifications();
    } finally {
      dismissingRef.current.delete(key);
    }
  }, [fetchPendingNotifications]);

  // Listen for WebSocket events (real-time updates)
  useEffect(() => {
    if (!isConnected || !user) return;

    const unsubscribe = onSupportStatusChanged((data: StatusNotification) => {
      console.log('📬 Received support status changed notification via WebSocket:', data);
      
      // Add to pending notifications (persist until dismissed via API)
      setPendingNotifications(prev => {
        // Avoid duplicates (same request + status combination)
        if (prev.some(n => n.id === data.id && n.status === data.status)) {
          return prev;
        }
        const updated = [...prev, data];
        // If no current notification is showing, show this one
        if (!currentNotification) {
          setCurrentNotification(data);
          setIsModalOpen(true);
        }
        return updated;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, user, onSupportStatusChanged, currentNotification]);

  // Handle OK button click
  const handleDismiss = () => {
    if (currentNotification) {
      dismissNotification(currentNotification.id, currentNotification.status);
    }
  };

  // Determine status display info
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return {
          icon: Clock,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          gradientFrom: 'from-blue-400',
          gradientTo: 'to-blue-600',
          title: 'Your Request is Being Reviewed',
          description: 'Our team has started working on your support request.',
        };
      case 'RESOLVED':
        return {
          icon: CheckCircle,
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          gradientFrom: 'from-green-400',
          gradientTo: 'to-green-600',
          title: 'Your Request Has Been Resolved',
          description: 'Great news! Your support request has been successfully resolved.',
        };
      default:
        return {
          icon: Sparkles,
          color: 'text-purple-500',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          gradientFrom: 'from-purple-400',
          gradientTo: 'to-purple-600',
          title: 'Request Status Updated',
          description: 'Your support request status has been updated.',
        };
    }
  };

  const statusInfo = currentNotification ? getStatusInfo(currentNotification.status) : null;
  const StatusIcon = statusInfo?.icon || Sparkles;

  return (
    <SupportStatusNotificationContext.Provider value={{ pendingNotifications, dismissNotification, refreshNotifications: fetchPendingNotifications }}>
      {children}

      {/* Beautiful Glassmorphic Animated Modal */}
      <AnimatePresence>
        {isModalOpen && currentNotification && statusInfo && (
          <>
            {/* Animated Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-gradient-to-br from-black/40 via-black/50 to-black/60 backdrop-blur-md z-[100]"
            />

            {/* Floating particles effect */}
            <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 100 }}
                  animate={{ 
                    opacity: [0, 0.4, 0],
                    y: [-20, -100],
                    x: [0, (i % 2 === 0 ? 20 : -20)]
                  }}
                  transition={{ 
                    duration: 3,
                    delay: i * 0.4,
                    repeat: Infinity,
                    repeatDelay: 1
                  }}
                  className={`absolute w-2 h-2 rounded-full ${
                    currentNotification.status === 'RESOLVED' ? 'bg-green-400' : 'bg-blue-400'
                  }`}
                  style={{ 
                    left: `${20 + i * 12}%`,
                    bottom: '30%'
                  }}
                />
              ))}
            </div>

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.6, bounce: 0.35 }}
              className="fixed inset-0 flex items-center justify-center z-[101] p-4"
            >
              <div className="relative bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-w-md w-full overflow-hidden border border-white/40 dark:border-gray-700/50">
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-transparent dark:from-white/5 pointer-events-none" />
                
                {/* Gradient Header with enhanced effects */}
                <div className={`relative bg-gradient-to-r ${statusInfo.gradientFrom} ${statusInfo.gradientTo} p-8 overflow-hidden`}>
                  {/* Animated gradient shimmer */}
                  <motion.div
                    animate={{ x: ['0%', '100%'] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                  />
                  
                  {/* Animated sparkles with staggered animation */}
                  <motion.div
                    initial={{ scale: 0, rotate: 0 }}
                    animate={{ scale: [0, 1.3, 1], rotate: [0, 15, 0] }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="absolute top-3 right-3"
                  >
                    <Sparkles className="w-7 h-7 text-white/40 drop-shadow-lg" />
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0, rotate: 0 }}
                    animate={{ scale: [0, 1.2, 1], rotate: [0, -10, 0] }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="absolute top-7 right-10"
                  >
                    <Sparkles className="w-4 h-4 text-white/25" />
                  </motion.div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.1, 1] }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                    className="absolute top-5 right-16"
                  >
                    <Sparkles className="w-3 h-3 text-white/20" />
                  </motion.div>

                  {/* Main icon with glow effect */}
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', duration: 0.7, bounce: 0.5 }}
                    className="relative w-20 h-20 mx-auto"
                  >
                    {/* Pulsing glow ring */}
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className={`absolute inset-0 rounded-full ${
                        currentNotification.status === 'RESOLVED' ? 'bg-green-400' : 'bg-blue-400'
                      } blur-lg`}
                    />
                    <div className="relative w-full h-full bg-white rounded-full flex items-center justify-center shadow-xl">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <StatusIcon className={`w-10 h-10 ${statusInfo.color}`} />
                      </motion.div>
                    </div>
                  </motion.div>
                </div>

                {/* Content with glassmorphic card */}
                <div className="relative p-6 text-center">
                  <motion.h2
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25, duration: 0.4 }}
                    className="text-xl font-bold text-gray-900 dark:text-white mb-2"
                  >
                    {statusInfo.title}
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.4 }}
                    className="text-gray-600 dark:text-gray-300 mb-5 leading-relaxed"
                  >
                    {statusInfo.description}
                  </motion.p>

                  {/* Request Details - Glassmorphic card */}
                  <motion.div
                    initial={{ opacity: 0, y: 15, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.45, duration: 0.4 }}
                    className="relative bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 mb-5 shadow-sm"
                  >
                    {/* Subtle inner glow */}
                    <div className={`absolute inset-0 rounded-2xl ${
                      currentNotification.status === 'RESOLVED' 
                        ? 'bg-gradient-to-br from-green-100/30 to-transparent dark:from-green-900/20' 
                        : 'bg-gradient-to-br from-blue-100/30 to-transparent dark:from-blue-900/20'
                    } pointer-events-none`} />
                    
                    <div className="relative">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Request Subject</p>
                      <p className="font-semibold text-gray-900 dark:text-white text-base">{currentNotification.subject}</p>
                      
                      {currentNotification.message && (
                        <div className="mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Message</p>
                          <p className="text-sm text-gray-700 dark:text-gray-200">{currentNotification.message}</p>
                        </div>
                      )}

                      {currentNotification.resolvedBy && (
                        <div className="mt-4 pt-4 border-t border-gray-200/60 dark:border-gray-700/60">
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                            {currentNotification.status === 'RESOLVED' ? 'Resolved by' : 'Being handled by'}
                          </p>
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                            {currentNotification.resolvedBy.firstName} {currentNotification.resolvedBy.lastName}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>

                  {/* Pending notifications indicator with subtle animation */}
                  {pendingNotifications.length > 1 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.55 }}
                      className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4"
                    >
                      <motion.span
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                          currentNotification.status === 'RESOLVED' ? 'bg-green-400' : 'bg-blue-400'
                        }`}
                      />
                      +{pendingNotifications.length - 1} more notification{pendingNotifications.length > 2 ? 's' : ''} waiting
                    </motion.div>
                  )}

                  {/* Enhanced OK Button */}
                  <motion.button
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    whileHover={{ scale: 1.03, boxShadow: '0 10px 40px rgba(0,0,0,0.15)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleDismiss}
                    className={`relative w-full py-3.5 px-6 bg-gradient-to-r ${statusInfo.gradientFrom} ${statusInfo.gradientTo} text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden`}
                  >
                    {/* Button shimmer effect */}
                    <motion.div
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12"
                    />
                    <span className="relative">OK, Got it!</span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </SupportStatusNotificationContext.Provider>
  );
}
