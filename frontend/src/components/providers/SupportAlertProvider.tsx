'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useWebSocket } from '@/lib/websocket';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, AlertCircle, User, Clock, ArrowRight, Paperclip, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

interface SupportRequestNotification {
  id: string;
  subject: string;
  description: string;
  category: string;
  recipientRole: string | null;
  status: string;
  createdAt: string;
  submittedByUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
    profilePicture?: string;
  } | null;
  submittedByUserEmail: string;
  hasAttachments: boolean;
}

interface SupportAlertContextType {
  pendingAlerts: SupportRequestNotification[];
  dismissAlert: (id: string) => void;
  dismissAllAlerts: () => void;
  refreshAlerts: () => void;
}

const SupportAlertContext = createContext<SupportAlertContextType | null>(null);

const categoryLabels: Record<string, string> = {
  GENERAL_INQUIRY: 'General Inquiry',
  TECHNICAL_ISSUE: 'Technical Issue',
  BILLING_QUESTION: 'Billing Question',
  FEATURE_REQUEST: 'Feature Request',
  BUG_REPORT: 'Bug Report',
  ACCOUNT_ASSISTANCE: 'Account Assistance',
  OTHER: 'Other',
};

export function SupportAlertProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, getIdToken } = useAuth();
  const { onSupportNewRequest, isConnected, connect } = useWebSocket();
  
  const [pendingAlerts, setPendingAlerts] = useState<SupportRequestNotification[]>([]);
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const hasFetchedRef = useRef(false);
  const dismissingRef = useRef<Set<string>>(new Set());
  
  // Check if user can receive support alerts (Admin or QC Manager)
  const canReceiveAlerts = user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN' || user?.role === 'QUALITY_CONTROL_MANAGER';
  
  // Fetch pending alerts from the database
  const fetchPendingAlerts = useCallback(async () => {
    if (!user || !canReceiveAlerts || isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await api.get('/support/alerts/pending');
      const alerts = response.data?.data || [];
      console.log('📬 Fetched pending alerts from database:', alerts.length);
      setPendingAlerts(alerts);
      setCurrentAlertIndex(0);
    } catch (error) {
      console.error('Error fetching pending alerts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, canReceiveAlerts, isLoading]);
  
  // Fetch alerts when user logs in or when component mounts
  useEffect(() => {
    if (user && canReceiveAlerts && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchPendingAlerts();
    }
    
    // Reset the flag when user changes
    if (!user) {
      hasFetchedRef.current = false;
      setPendingAlerts([]);
    }
  }, [user, canReceiveAlerts, fetchPendingAlerts]);
  
  // Auto-connect WebSocket when user is logged in
  useEffect(() => {
    if (user && !isConnected && canReceiveAlerts) {
      connect(user.id, user.organizationId);
    }
  }, [user, isConnected, connect, canReceiveAlerts]);
  
  // Listen for new support requests via WebSocket
  useEffect(() => {
    if (!user || !canReceiveAlerts) return;
    
    const unsubscribe = onSupportNewRequest((data: SupportRequestNotification) => {
      console.log('📬 SupportAlertProvider: Received new support request via WebSocket:', data);
      
      // Check if this alert should be shown to this user based on recipientRole
      const shouldShow = 
        !data.recipientRole || // No specific recipient - show to all
        (data.recipientRole === 'ADMIN' && (user.role === 'ADMIN' || user.role === 'SYSTEM_ADMIN')) ||
        (data.recipientRole === 'QUALITY_CONTROL_MANAGER' && user.role === 'QUALITY_CONTROL_MANAGER');
      
      if (!shouldShow) {
        console.log('📬 SupportAlertProvider: Alert not for this user role, skipping');
        return;
      }
      
      // Add to pending alerts (the alert will persist until dismissed via API)
      setPendingAlerts(prev => {
        // Don't add duplicates
        if (prev.some(alert => alert.id === data.id)) return prev;
        return [...prev, data];
      });
    });
    
    return unsubscribe;
  }, [user, canReceiveAlerts, onSupportNewRequest]);
  
  // Dismiss a single alert via API
  const dismissAlert = useCallback(async (id: string) => {
    // Prevent double-dismiss
    if (dismissingRef.current.has(id)) return;
    dismissingRef.current.add(id);
    
    // Optimistically remove from UI
    setPendingAlerts(prev => prev.filter(alert => alert.id !== id));
    setCurrentAlertIndex(0);
    
    try {
      await api.post(`/support/alerts/${id}/dismiss`);
      console.log('📬 Alert dismissed in database:', id);
    } catch (error) {
      console.error('Error dismissing alert:', error);
      // Refetch to restore state if the API call failed
      fetchPendingAlerts();
    } finally {
      dismissingRef.current.delete(id);
    }
  }, [fetchPendingAlerts]);
  
  // Dismiss all alerts via API
  const dismissAllAlerts = useCallback(async () => {
    if (pendingAlerts.length === 0) return;
    
    // Optimistically clear the UI
    const alertIds = pendingAlerts.map(a => a.id);
    setPendingAlerts([]);
    setCurrentAlertIndex(0);
    
    try {
      await api.post('/support/alerts/dismiss-all');
      console.log('📬 All alerts dismissed in database');
    } catch (error) {
      console.error('Error dismissing all alerts:', error);
      // Refetch to restore state if the API call failed
      fetchPendingAlerts();
    }
  }, [pendingAlerts, fetchPendingAlerts]);
  
  const handleViewRequest = useCallback((id: string) => {
    router.push(`/support-inbox?view=${id}`);
    dismissAlert(id);
  }, [router, dismissAlert]);
  
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };
  
  const currentAlert = pendingAlerts[currentAlertIndex];
  
  return (
    <SupportAlertContext.Provider value={{ pendingAlerts, dismissAlert, dismissAllAlerts, refreshAlerts: fetchPendingAlerts }}>
      {children}
      
      {/* Alert Modal Overlay - Beautiful Glassmorphic Design */}
      <AnimatePresence>
        {currentAlert && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-black/30 via-black/40 to-black/50 backdrop-blur-md p-4"
          >
            {/* Floating ambient particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 0.3, 0],
                    scale: [0.5, 1, 0.5],
                    y: [-10, -60],
                    x: [0, (i % 2 === 0 ? 15 : -15)]
                  }}
                  transition={{ 
                    duration: 2.5,
                    delay: i * 0.3,
                    repeat: Infinity,
                    repeatDelay: 0.5
                  }}
                  className="absolute w-2 h-2 rounded-full bg-emerald-400/60"
                  style={{ 
                    left: `${25 + i * 13}%`,
                    top: '60%'
                  }}
                />
              ))}
            </div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
              className="relative w-full max-w-lg bg-white/85 dark:bg-gray-900/85 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] border border-white/40 dark:border-gray-700/50 overflow-hidden"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="support-alert-title"
            >
              {/* Subtle gradient overlay for glass effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/60 via-transparent to-transparent dark:from-white/5 pointer-events-none" />
              
              {/* Header with enhanced styling */}
              <div className="relative flex items-center justify-between p-5 border-b border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center gap-4">
                  <motion.div 
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', delay: 0.1, bounce: 0.5 }}
                    className="relative"
                  >
                    {/* Pulsing glow ring */}
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-2xl bg-emerald-400 blur-md"
                    />
                    <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                  </motion.div>
                  <div>
                    <motion.h2 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      id="support-alert-title" 
                      className="text-lg font-bold text-gray-900 dark:text-white"
                    >
                      New Support Request
                    </motion.h2>
                    <motion.p 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-sm text-gray-500 dark:text-gray-400"
                    >
                      {pendingAlerts.length > 1 
                        ? `${currentAlertIndex + 1} of ${pendingAlerts.length} requests`
                        : 'Requires your attention'}
                    </motion.p>
                  </div>
                </div>
                
                {/* Navigation for multiple alerts */}
                {pendingAlerts.length > 1 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.25 }}
                    className="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-1"
                  >
                    <button
                      onClick={() => setCurrentAlertIndex(prev => Math.max(0, prev - 1))}
                      disabled={currentAlertIndex === 0}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white/60 dark:hover:bg-gray-700/60 transition-all duration-200"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setCurrentAlertIndex(prev => Math.min(pendingAlerts.length - 1, prev + 1))}
                      disabled={currentAlertIndex === pendingAlerts.length - 1}
                      className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-white/60 dark:hover:bg-gray-700/60 transition-all duration-200"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}
              </div>
              
              {/* Content with staggered animations */}
              <div className="relative p-5">
                {/* Subject */}
                <motion.h3 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-lg font-semibold text-gray-900 dark:text-white mb-3"
                >
                  {currentAlert.subject}
                </motion.h3>
                
                {/* Meta info with icons */}
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4"
                >
                  <span className="flex items-center gap-1.5 bg-gray-100/80 dark:bg-gray-800/80 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {currentAlert.submittedByUser 
                        ? `${currentAlert.submittedByUser.firstName} ${currentAlert.submittedByUser.lastName}`
                        : currentAlert.submittedByUserEmail}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {formatTime(currentAlert.createdAt)}
                  </span>
                  {currentAlert.hasAttachments && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.35, type: 'spring' }}
                      className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full"
                    >
                      <Paperclip className="w-4 h-4" />
                      <span className="text-xs font-medium">Attachments</span>
                    </motion.span>
                  )}
                </motion.div>
                
                {/* Category badge with glow */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mb-4"
                >
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-100/80 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 backdrop-blur-sm border border-blue-200/50 dark:border-blue-700/30 shadow-sm">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {categoryLabels[currentAlert.category] || currentAlert.category}
                  </span>
                </motion.div>
                
                {/* Description preview - Glassmorphic card */}
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="relative p-4 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-200/40 dark:border-gray-700/40 shadow-inner"
                >
                  {/* Subtle gradient overlay */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-gray-100/30 to-transparent dark:from-gray-700/20 pointer-events-none" />
                  <p className="relative text-sm text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed">
                    {currentAlert.description}
                  </p>
                </motion.div>
              </div>
              
              {/* Actions with glassmorphic footer */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="relative flex items-center justify-between p-5 border-t border-gray-200/40 dark:border-gray-700/40 bg-gradient-to-r from-gray-50/80 via-gray-100/50 to-gray-50/80 dark:from-gray-800/80 dark:via-gray-900/50 dark:to-gray-800/80 backdrop-blur-sm"
              >
                <button
                  onClick={() => dismissAlert(currentAlert.id)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200"
                >
                  Dismiss
                </button>
                
                <div className="flex items-center gap-3">
                  {pendingAlerts.length > 1 && (
                    <button
                      onClick={dismissAllAlerts}
                      className="px-4 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200"
                    >
                      Dismiss All
                    </button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.03, boxShadow: '0 8px 30px rgba(16, 185, 129, 0.3)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleViewRequest(currentAlert.id)}
                    className="relative flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
                  >
                    {/* Button shimmer effect */}
                    <motion.div
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3 }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                    />
                    <span className="relative">View Request</span>
                    <ArrowRight className="relative w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SupportAlertContext.Provider>
  );
}

export function useSupportAlerts() {
  const context = useContext(SupportAlertContext);
  if (!context) {
    throw new Error('useSupportAlerts must be used within a SupportAlertProvider');
  }
  return context;
}
