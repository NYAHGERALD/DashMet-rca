'use client';

import { createContext, useContext, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SettingsModalContextType {
  isOpen: boolean;
  openSettings: (tab?: 'profile' | 'preferences' | 'notifications' | 'security') => void;
  closeSettings: () => void;
  initialTab: 'profile' | 'preferences' | 'notifications' | 'security';
}

const SettingsModalContext = createContext<SettingsModalContextType>({
  isOpen: false,
  openSettings: () => {},
  closeSettings: () => {},
  initialTab: 'profile',
});

export const useSettingsModal = () => useContext(SettingsModalContext);

export function SettingsModalProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const openSettings = useCallback((tab?: 'profile' | 'preferences' | 'notifications' | 'security') => {
    router.push(`/settings${tab ? `?tab=${tab}` : ''}`);
  }, [router]);

  const closeSettings = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <SettingsModalContext.Provider value={{ isOpen: false, openSettings, closeSettings, initialTab: 'profile' }}>
      {children}
    </SettingsModalContext.Provider>
  );
}
