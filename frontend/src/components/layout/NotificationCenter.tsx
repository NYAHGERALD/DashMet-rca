'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { X, Bell, BellOff, Clock, ExternalLink, Trash2, ChevronDown, CheckCircle, AlertCircle, MessageSquare, Users, Volume2, VolumeX } from 'lucide-react';
import { 
  browserNotificationService, 
  BrowserNotification, 
  SNOOZE_DURATIONS, 
  SnoozeDuration 
} from '@/lib/browserNotifications';
import { Inbox, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { alertSoundService } from '@/lib/alertSounds';

interface NotificationCenterProps {
  className?: string;
  isSystemAdmin?: boolean;
}

const SNOOZE_OPTIONS: { label: string; value: SnoozeDuration }[] = [
  { label: '15 minutes', value: '15_MINUTES' },
  { label: '30 minutes', value: '30_MINUTES' },
  { label: '1 hour', value: '1_HOUR' },
  { label: '2 hours', value: '2_HOURS' },
  { label: '4 hours', value: '4_HOURS' },
  { label: 'Until tomorrow', value: 'UNTIL_TOMORROW' },
];

export default function NotificationCenter({ className = '', isSystemAdmin = false }: NotificationCenterProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<BrowserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const snoozeRef = useRef<HTMLDivElement>(null);

  // Load notifications and check permission
  useEffect(() => {
    const loadNotifications = () => {
      const active = browserNotificationService.getActiveNotifications();
      setNotifications(active);
      setUnreadCount(browserNotificationService.getUnreadCount());
      setPermissionState(browserNotificationService.getPermission());
    };

    loadNotifications();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSnoozeOpenId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle notification click callback
  useEffect(() => {
    browserNotificationService.setOnNotificationClick((notification) => {
      if (notification.data?.url) {
        router.push(notification.data.url);
      }
      alertSoundService.stopRepeat();
      refreshNotifications();
    });

    browserNotificationService.setOnNotificationDismiss(() => {
      refreshNotifications();
    });
  }, [router]);

  const refreshNotifications = useCallback(() => {
    const active = browserNotificationService.getActiveNotifications();
    setNotifications(active);
    setUnreadCount(browserNotificationService.getUnreadCount());
  }, []);

  const handleRequestPermission = async () => {
    setIsRequestingPermission(true);
    try {
      const permission = await browserNotificationService.requestPermission();
      setPermissionState(permission);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleSnooze = (notificationId: string, duration: SnoozeDuration) => {
    browserNotificationService.snoozeNotification(notificationId, duration);
    setSnoozeOpenId(null);
    refreshNotifications();
  };

  const handleDismiss = (notificationId: string) => {
    browserNotificationService.dismissNotification(notificationId);
    refreshNotifications();
  };

  const handleOpen = (notification: BrowserNotification) => {
    if (notification.data?.url) {
      router.push(notification.data.url);
    }
    setIsOpen(false);
  };

  const handleClearAll = () => {
    browserNotificationService.clearAllNotifications();
    refreshNotifications();
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'team_invitation':
        return <Users className="w-5 h-5 text-blue-500" />;
      case 'chat_message':
        return <MessageSquare className="w-5 h-5 text-green-500" />;
      case 'mention':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'incident_update':
        return <CheckCircle className="w-5 h-5 text-purple-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatSnoozeRemaining = (snoozedUntil?: number) => {
    if (!snoozedUntil) return null;
    const remaining = snoozedUntil - Date.now();
    if (remaining <= 0) return null;
    
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    
    if (hours > 0) return `Snoozed for ${hours}h ${minutes}m`;
    return `Snoozed for ${minutes}m`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
        aria-label="Browser Notifications"
        title="Browser Notifications"
      >
        {permissionState === 'granted' ? (
          <Bell className="w-6 h-6" />
        ) : (
          <BellOff className="w-6 h-6 opacity-60" />
        )}
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="fixed inset-x-8 top-14 sm:absolute sm:inset-auto sm:right-0 sm:top-auto sm:mt-2 w-auto sm:w-[380px] md:w-[420px] sm:max-w-[420px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              <h3 className="font-semibold text-sm sm:text-base">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs bg-white/20 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="p-1 sm:p-1.5 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
                  title="Clear all"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 sm:p-1.5 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>

          {/* Permission Request Banner */}
          {permissionState !== 'granted' && (
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {permissionState === 'denied' ? (
                    <VolumeX className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-200">
                    {permissionState === 'denied' 
                      ? 'Browser notifications are blocked'
                      : 'Enable browser notifications'
                    }
                  </p>
                  <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    {permissionState === 'denied'
                      ? 'Please enable notifications in your browser settings to receive alerts.'
                      : 'Get notified about team invitations and messages even when the app is in the background.'
                    }
                  </p>
                  {permissionState === 'default' && (
                    <button
                      onClick={handleRequestPermission}
                      disabled={isRequestingPermission}
                      className="mt-2 px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50 touch-manipulation"
                    >
                      {isRequestingPermission ? 'Requesting...' : 'Enable Notifications'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notification List */}
          <div className="max-h-[60vh] sm:max-h-[400px] overflow-y-auto">
            {isSystemAdmin ? (
              /* System Admin specific notification content */
              <div className="p-6 sm:p-8 text-center">
                <Inbox className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-medium">No notifications</p>
                <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">
                  You're all caught up!
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                  Notifications will appear here for new support requests.
                </p>
                <Link
                  href="/admin/support"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                >
                  <HelpCircle className="w-4 h-4" />
                  View Support Requests
                </Link>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 sm:p-8 text-center">
                <Bell className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-300 dark:text-gray-600" />
                <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 font-medium">No notifications</p>
                <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1">
                  You're all caught up!
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`relative px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-100 dark:border-slate-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
                    !notification.clicked ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                >
                  <div className="flex gap-2 sm:gap-3">
                    {/* Icon */}
                    <div className="flex-shrink-0 mt-0.5 sm:mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs sm:text-sm text-gray-900 dark:text-white ${!notification.clicked ? 'font-semibold' : ''}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                        {notification.body}
                      </p>
                      
                      {/* Meta info */}
                      <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2">
                        <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                        {notification.data?.incidentNumber && (
                          <span className="text-[10px] sm:text-xs text-primary-600 dark:text-primary-400">
                            {notification.data.incidentNumber}
                          </span>
                        )}
                      </div>

                      {/* Snooze info */}
                      {notification.snoozedUntil && notification.snoozedUntil > Date.now() && (
                        <p className="text-[10px] sm:text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          {formatSnoozeRemaining(notification.snoozedUntil)}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                        <button
                          onClick={() => handleOpen(notification)}
                          className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors touch-manipulation"
                        >
                          <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          Open
                        </button>
                        
                        {/* Snooze Dropdown */}
                        <div className="relative" ref={snoozeOpenId === notification.id ? snoozeRef : undefined}>
                          <button
                            onClick={() => setSnoozeOpenId(snoozeOpenId === notification.id ? null : notification.id)}
                            className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-lg transition-colors touch-manipulation"
                          >
                            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            <span className="hidden xs:inline">Snooze</span>
                            <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          </button>
                          
                          {snoozeOpenId === notification.id && (
                            <div className="absolute left-0 mt-1 w-32 sm:w-36 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 z-10 py-1">
                              {SNOOZE_OPTIONS.map((option) => (
                                <button
                                  key={option.value}
                                  onClick={() => handleSnooze(notification.id, option.value)}
                                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 text-left text-[10px] sm:text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors touch-manipulation"
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <button
                          onClick={() => handleDismiss(notification.id)}
                          className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors touch-manipulation"
                        >
                          <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                          <span className="hidden xs:inline">Dismiss</span>
                        </button>
                      </div>
                    </div>

                    {/* Unread indicator */}
                    {!notification.clicked && (
                      <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
