'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { RoleGate, useHasMinimumRole, useIsAdmin } from '@/lib/rbac';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Link from 'next/link';
import Image from 'next/image';
import SlidingSidebar from '@/components/ui/SlidingSidebar';
import DashboardMetrics from '@/components/dashboard/DashboardMetrics';
import SystemAdminDashboard from '@/components/dashboard/SystemAdminDashboard';
import NotificationCenter from '@/components/layout/NotificationCenter';
import { ContactSupportMenuItem } from '@/components/support/ContactSupportMenuItem';
import { useI18n } from '@/lib/i18n/I18nProvider';

function DashboardContent() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const isAdmin = useIsAdmin();
  const isSupervisorPlus = useHasMinimumRole('SUPERVISOR');
  const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close modal on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowProfileModal(false);
        setShowDropdown(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-3 sm:px-4 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-3">
              <div className="relative w-8 h-8 sm:w-10 sm:h-10">
                <Image 
                  src="/images/logo.png" 
                  alt="DASHMET Logo" 
                  fill 
                  className="object-contain"
                />
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">
                DASHMET <span className="text-sm sm:text-base font-normal text-gray-500 dark:text-gray-400">RCA ENGINE</span>
              </h1>
              {/* Organization Name - Hide for SYSTEM_ADMIN */}
              {user.organizationName && !isSystemAdmin && (
                <div className="hidden sm:flex items-center ml-4 px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {user.organizationName}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Browser Notifications - System Admin sees support-focused notifications */}
              <NotificationCenter isSystemAdmin={isSystemAdmin} />
              
              <Link
                href="/settings"
                className="p-2 sm:px-3 sm:py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                <span className="hidden sm:inline">⚙️ {t('nav.settings')}</span>
                <span className="sm:hidden">⚙️</span>
              </Link>
              
              {/* User Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-1 sm:gap-2 p-1.5 sm:px-3 sm:py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-primary-600 flex items-center justify-center text-white text-xs font-bold">
                    {user.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt={`${user.firstName} ${user.lastName}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>
                    )}
                  </div>
                  <span className="hidden sm:inline">{user.firstName} {user.lastName}</span>
                  <svg className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
                    <button
                      onClick={() => {
                        setShowProfileModal(true);
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {t('nav.profile')}
                    </button>
                    <ContactSupportMenuItem />
                    <hr className="my-1 border-gray-200 dark:border-gray-700" />
                    <button
                      onClick={() => {
                        logout();
                        setShowDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-danger-600 dark:text-danger-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
              
              <span className="hidden sm:inline-flex px-2 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200">
                {user.role}
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-4 sm:py-6 px-3 sm:px-4 lg:px-8">
        <div className="w-full">
          <div className="p-4 sm:p-8">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-4 text-center">
              {t('dashboard.welcome')}, {user.firstName}!
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 text-center">
              {t('dashboard.loggedInAs')} <strong>{user.role}</strong>
            </p>

            {/* Sliding Sidebar for Quick Navigation - Left */}
            <SlidingSidebar
              title={t('common.quickNavigation')}
              position="left"
              links={isSystemAdmin ? [
                // SYSTEM_ADMIN only sees system-level features (no incident/RCA access)
                { href: '/system-admin', icon: '🏢', label: t('nav.systemAdmin') || 'System Admin Portal' },
                { href: '/settings', icon: '⚙️', label: t('nav.settings') },
              ] : [
                // Regular users see full navigation
                { href: '/incidents/new', icon: '➕', label: t('nav.createIncident') },
                { href: '/incidents', icon: '📋', label: t('nav.myIncidents') },
                { href: '/incidents?filter=team', icon: '👥', label: t('nav.teamIncidents'), show: isSupervisorPlus },
                { href: '/incidents?filter=public', icon: '🌐', label: t('nav.publicIncidents') },
                { href: '/rca', icon: '🔍', label: t('nav.rcaWorkspace'), show: isSupervisorPlus },
                { href: '/capa', icon: '✅', label: t('nav.capaBoard'), show: isSupervisorPlus },
                { href: '/reports', icon: '📊', label: t('nav.reportsCompliance'), show: isSupervisorPlus },
                { href: '/analytics', icon: '📈', label: t('nav.analyticsInsights'), show: isSupervisorPlus },
                { href: '/knowledge', icon: '📚', label: t('nav.knowledgeBase'), show: isSupervisorPlus },
                { href: '/workplace-report', icon: '📝', label: t('nav.workplaceReport') },
                { href: '/investigation-report', icon: '🔎', label: t('nav.investigationReport') },
                { href: '/fmir', icon: '⚠️', label: t('nav.fmir') || 'Foreign Material' },
                { href: '/settings', icon: '⚙️', label: t('nav.settings') },
              ]}
            />

            {/* Sliding Sidebar for Organization Management - Right (Admin only) */}
            {isAdmin && (
              <SlidingSidebar
                title={t('common.organizationManagement')}
                position="right"
                links={user.role === 'SYSTEM_ADMIN' ? [
                  // SYSTEM_ADMIN sees organization-level management only (no user data access)
                  { href: '/system-admin', icon: '🏢', label: t('nav.systemAdmin') || 'System Admin Portal' },
                  { href: '/admin/policies', icon: '📄', label: t('nav.policies') },
                  { href: '/admin/support', icon: '📨', label: t('nav.supportRequests') },
                ] : [
                  // Regular ADMIN sees full organization management within their org
                  { href: '/admin/organizations', icon: '🏢', label: t('nav.organizations') },
                  { href: '/admin/facilities', icon: '🏭', label: t('nav.facilities') },
                  { href: '/admin/departments', icon: '🏛️', label: t('nav.departments') },
                  { href: '/admin/areas', icon: '📦', label: t('nav.areas') },
                  { href: '/admin/lines', icon: '🔄', label: t('nav.lines') },
                  { href: '/admin/shifts', icon: '🕐', label: t('nav.shifts') },
                  { href: '/admin/categories', icon: '🏷️', label: t('nav.categories') },
                  { href: '/admin', icon: '👥', label: t('nav.userManagement') },
                  { href: '/admin/enterprise', icon: '🛡️', label: t('nav.enterprise') },
                ]}
              />
            )}

            {/* Dashboard Metrics & Charts */}
            {isSystemAdmin ? (
              /* SYSTEM_ADMIN sees platform-level stats (no incident/RCA data) */
              <div className="mt-8">
                <SystemAdminDashboard />
              </div>
            ) : isSupervisorPlus ? (
              /* Regular users see incident/RCA metrics */
              <div className="mt-8">
                <DashboardMetrics />
              </div>
            ) : null}

          </div>
        </div>
      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={() => setShowProfileModal(false)}
            />
            
            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md transform transition-all">
              {/* Close button */}
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Profile Header */}
              <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-8 rounded-t-xl text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-white/20 overflow-hidden flex items-center justify-center text-white text-3xl font-bold mb-3">
                  {user.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span>{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>
                  )}
                </div>
                <h3 className="text-xl font-semibold text-white">
                  {user.firstName} {user.lastName}
                </h3>
                <p className="text-primary-100 text-sm mt-1">{user.email}</p>
                <span className="inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full bg-white/20 text-white">
                  {user.role}
                </span>
              </div>
              
              {/* Profile Details */}
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('profile.organization')}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{user.organizationName || 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('settings.theme')}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{user.theme}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">{t('settings.language')}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white uppercase">{user.language}</span>
                </div>
                
                {/* Action Buttons */}
                <div className="pt-4 space-y-3">
                  {/* Admin-only: Manage Users */}
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setShowProfileModal(false)}
                      className="block w-full px-4 py-2 text-sm font-medium text-center text-white bg-warning-600 hover:bg-warning-700 rounded-lg transition-colors"
                    >
                      👥 {t('dashboard.manageUsers')}
                    </Link>
                  )}
                  <div className="flex gap-3">
                    <Link
                      href="/settings"
                      onClick={() => setShowProfileModal(false)}
                      className="flex-1 px-4 py-2 text-sm font-medium text-center text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      {t('dashboard.editSettings')}
                    </Link>
                    <button
                      onClick={() => {
                        setShowProfileModal(false);
                        logout();
                      }}
                      className="flex-1 px-4 py-2 text-sm font-medium text-white bg-danger-600 hover:bg-danger-700 rounded-lg transition-colors"
                    >
                      {t('nav.logout')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute requireAuth={true}>
      <DashboardContent />
    </ProtectedRoute>
  );
}
