// Phase 0.2: Navigation Bar Component

'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { Moon, Sun, User, Settings, LogOut, Globe } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import NotificationBell from './NotificationBell';
import NotificationCenter from './NotificationCenter';

export default function Navigation() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="relative w-8 h-8">
              <Image 
                src="/images/logo.png" 
                alt="DASHMET Logo" 
                fill 
                className="object-contain"
              />
            </div>
            <div className="text-xl font-bold text-primary-600">DASHMET</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">RCA ENGINE</div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Change Language"
              >
                <Globe className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              
              {showLangMenu && (
                <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <button
                    onClick={() => { setLanguage('en'); setShowLangMenu(false); }}
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${language === 'en' ? 'font-bold' : ''}`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => { setLanguage('es'); setShowLangMenu(false); }}
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${language === 'es' ? 'font-bold' : ''}`}
                  >
                    Español
                  </button>
                  <button
                    onClick={() => { setLanguage('fr'); setShowLangMenu(false); }}
                    className={`block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-b-lg ${language === 'fr' ? 'font-bold' : ''}`}
                  >
                    Français
                  </button>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              )}
            </button>

            {/* Phase 4.4: Notifications Bell */}
            <NotificationBell />
            
            {/* Browser Notifications Center */}
            <NotificationCenter />

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-primary-600 text-white font-medium">
                  {user?.profilePicture ? (
                    <img
                      key={user.profilePicture}
                      src={user.profilePicture}
                      alt={`${user?.firstName} ${user?.lastName}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Failed to load profile picture:', user.profilePicture);
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {user?.firstName} {user?.lastName}
                </span>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                    <p className="text-xs text-primary-600 mt-1">{user?.role}</p>
                  </div>
                  
                  <button className="flex items-center space-x-2 w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left">
                    <User className="w-4 h-4" />
                    <span className="text-sm">Profile</span>
                  </button>
                  
                  <button className="flex items-center space-x-2 w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left">
                    <Settings className="w-4 h-4" />
                    <span className="text-sm">{t('nav.settings')}</span>
                  </button>
                  
                  <button
                    onClick={logout}
                    className="flex items-center space-x-2 w-full px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-left text-danger-600 rounded-b-lg"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">{t('auth.logout')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
