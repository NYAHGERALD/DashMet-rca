'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { browserNotificationService } from '@/lib/browserNotifications';
import { alertSoundService, type SoundType } from '@/lib/alertSounds';

const POLL_INTERVAL = 60_000; // Poll every 60 seconds

/**
 * Hook that polls for pending LSW browser notifications
 * and displays them via the BrowserNotificationService.
 * Plays alert sounds based on user preferences.
 * Should be mounted in the LSW page or a global layout.
 */
export function useLswBrowserNotifications() {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shownIdsRef = useRef<Set<string>>(new Set());

  const fetchAndShowNotifications = useCallback(async () => {
    try {
      // Don't poll if browser notifications aren't permitted
      if (browserNotificationService.getPermission() !== 'granted') return;

      const res = await api.get('/lsw/notification-preferences/browser-pending');
      if (!res.data?.success) return;

      // Handle both old format (array) and new format ({ notifications, soundPrefs })
      const responseData = res.data.data;
      const pending: Array<{ id: string; type: string; title: string; message: string }> =
        Array.isArray(responseData) ? responseData : (responseData?.notifications || []);
      const soundPrefs = Array.isArray(responseData) ? null : (responseData?.soundPrefs || null);

      let newNotificationCount = 0;
      let hasOverdue = false;

      for (const item of pending) {
        // Skip already-shown notifications this session
        if (shownIdsRef.current.has(item.id)) continue;

        await browserNotificationService.showLswNotification(item);
        shownIdsRef.current.add(item.id);
        newNotificationCount++;

        if (item.type.includes('OVERDUE')) hasOverdue = true;
      }

      // Play alert sound for new notifications
      if (newNotificationCount > 0 && soundPrefs?.soundEnabled) {
        const soundType = (soundPrefs.soundType || 'chime') as SoundType;
        const volume = soundPrefs.soundVolume ?? 80;

        if (hasOverdue && soundPrefs.repeatSoundForOverdue) {
          alertSoundService.startRepeat(soundType, volume, soundPrefs.repeatSoundInterval || 5);
        } else {
          alertSoundService.stopRepeat();
          await alertSoundService.play(soundType, volume);
        }
      }

      // Keep the set from growing unbounded — trim old entries
      if (shownIdsRef.current.size > 200) {
        const arr = Array.from(shownIdsRef.current);
        shownIdsRef.current = new Set(arr.slice(arr.length - 100));
      }
    } catch {
      // Silently fail — don't disrupt the user experience
    }
  }, []);

  useEffect(() => {
    // Set up click handler to navigate to LSW page
    browserNotificationService.setOnNotificationClick((notification) => {
      if (notification.data?.url) {
        router.push(notification.data.url);
        // Stop repeating sound when user acknowledges
        alertSoundService.stopRepeat();
      }
    });

    // Initial fetch
    fetchAndShowNotifications();

    // Poll periodically
    intervalRef.current = setInterval(fetchAndShowNotifications, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      alertSoundService.stopRepeat();
    };
  }, [fetchAndShowNotifications, router]);
}
