'use client';

import { createContext, useContext, useState, useCallback } from 'react';

interface SettingsModalContextType {
  isOpen: boolean;
  openSettings: (tab?: 'profile' | 'preferences' | 'security') => void;
  closeSettings: () => void;
  initialTab: 'profile' | 'preferences' | 'security';
}

const SettingsModalContext = createContext<SettingsModalContextType>({
  isOpen: false,
  openSettings: () => {},
  closeSettings: () => {},
  initialTab: 'profile',
});

export const useSettingsModal = () => useContext(SettingsModalContext);

export function SettingsModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<'profile' | 'preferences' | 'security'>('profile');

  const openSettings = useCallback((tab?: 'profile' | 'preferences' | 'security') => {
    if (tab) setInitialTab(tab);
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <SettingsModalContext.Provider value={{ isOpen, openSettings, closeSettings, initialTab }}>
      {children}
    </SettingsModalContext.Provider>
  );
}
