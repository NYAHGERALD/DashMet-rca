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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Glassmorphism Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-gray-900/70 border-b border-white/20 dark:border-gray-700/50 shadow-lg shadow-black/5">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-18">
            <div className="flex items-center space-x-4">
              {/* Hamburger Menu Button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
              >
                <svg
                  className="w-6 h-6 text-gray-600 dark:text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {sidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              
              {/* Logo with glow effect */}
              <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-0.5 shadow-lg shadow-blue-500/25">
                <div className="w-full h-full rounded-[10px] bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">
                  <Image 
                    src="/images/logo.png" 
                    alt="DASHMET Logo" 
                    fill 
                    className="object-contain p-1"
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 dark:from-white dark:via-blue-200 dark:to-indigo-200 bg-clip-text text-transparent">
                  DASHMET
                </h1>
                <span className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 tracking-wider uppercase">
                  RCA ENGINE
                </span>
              </div>
              {/* Organization Badge - Glassmorphism style */}
              {user.organizationName && !isSystemAdmin && (
                <div className="hidden sm:flex items-center ml-2 px-3 py-1.5 backdrop-blur-md bg-gradient-to-r from-blue-500/10 to-indigo-500/10 dark:from-blue-400/20 dark:to-indigo-400/20 border border-blue-200/50 dark:border-blue-500/30 rounded-full">
                  <span className="text-sm font-medium bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-300 dark:to-indigo-300 bg-clip-text text-transparent">
                    {user.organizationName}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              {/* Browser Notifications */}
              <NotificationCenter isSystemAdmin={isSystemAdmin} />
              
              {/* Settings Button - Glass style */}
              <Link
                href="/settings"
                className="group p-2.5 sm:px-4 sm:py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white backdrop-blur-md bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200/50 dark:border-gray-600/50 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-black/5 hover:scale-105"
              >
                <span className="hidden sm:inline flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {t('nav.settings')}
                </span>
                <span className="sm:hidden">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
              </Link>
              
              {/* User Dropdown - Glass style */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 sm:gap-3 p-1.5 sm:px-3 sm:py-2 text-sm font-medium text-gray-700 dark:text-gray-200 backdrop-blur-md bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200/50 dark:border-gray-600/50 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-black/5"
                >
                  {/* Avatar with gradient ring */}
                  <div className="relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full opacity-75 group-hover:opacity-100 blur-sm"></div>
                    <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 ring-2 ring-white dark:ring-gray-800 flex items-center justify-center text-white text-xs font-bold">
                      {user.profilePicture ? (
                        <img
                          src={user.profilePicture}
                          alt={`${user.firstName} ${user.lastName}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-sm">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>
                      )}
                    </div>
                  </div>
                  <span className="hidden sm:inline font-medium">{user.firstName} {user.lastName}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {/* Dropdown Menu - Glassmorphism */}
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 backdrop-blur-xl bg-white/90 dark:bg-gray-800/90 rounded-2xl shadow-xl shadow-black/10 border border-white/20 dark:border-gray-700/50 py-2 z-50 overflow-hidden">
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-gray-200/50 dark:border-gray-700/50">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowProfileModal(true);
                          setShowDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 flex items-center gap-3 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        {t('nav.profile')}
                      </button>
                      <ContactSupportMenuItem />
                    </div>
                    <div className="border-t border-gray-200/50 dark:border-gray-700/50 py-1">
                      <button
                        onClick={() => {
                          logout();
                          setShowDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 flex items-center gap-3 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        </div>
                        {t('nav.logout')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Role Badge - Gradient style */}
              <span className="hidden sm:inline-flex px-3 py-1.5 text-xs font-semibold rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/25">
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

            {/* Sliding Sidebar for Quick Navigation - Left (controlled by hamburger button) */}
            <SlidingSidebar
              title={t('common.quickNavigation')}
              position="left"
              hideHandle={true}
              isOpen={sidebarOpen}
              onOpenChange={setSidebarOpen}
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
                { href: '/workplace-safety', icon: '🛡️', label: 'Safety Assessment', show: isSupervisorPlus },
                { href: '/meetings', icon: '🎤', label: 'Meeting Intelligence' },
                { href: '/assigned-actions', icon: '📌', label: 'My Action Items' },
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
                  { href: '/support-inbox', icon: '📬', label: 'Support Inbox' },
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
                  { href: '/admin/privileges', icon: '🔐', label: t('nav.privileges') || 'Role Privileges' },
                  { href: '/admin/work-order-templates', icon: '📋', label: 'Work Order Templates' },
                  { href: '/admin/enterprise', icon: '🛡️', label: t('nav.enterprise') },
                  { href: '/support-inbox', icon: '📬', label: 'Support Inbox' },
                ]}
              />
            )}

            {/* QC Manager Support Inbox Access */}
            {user?.role === 'QUALITY_CONTROL_MANAGER' && (
              <SlidingSidebar
                title="QC Management"
                position="right"
                links={[
                  { href: '/support-inbox', icon: '📬', label: 'Support Inbox' },
                  { href: '/fmir/privileges', icon: '🔐', label: 'FMIR Privileges' },
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
