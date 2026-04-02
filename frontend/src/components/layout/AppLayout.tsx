'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useHasMinimumRole, useIsAdmin } from '@/lib/rbac';
import Link from 'next/link';
import Image from 'next/image';
import SlidingSidebar from '@/components/ui/SlidingSidebar';
import NotificationCenter from '@/components/layout/NotificationCenter';
import { ContactSupportMenuItem } from '@/components/support/ContactSupportMenuItem';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useSettingsModal } from '@/components/settings/SettingsModalProvider';
import { usePathname } from 'next/navigation';
import {
  Plus,
  ClipboardList,
  UsersRound,
  Globe,
  Microscope,
  ListChecks,
  TrendingUp,
  BarChart3,
  Library,
  FileWarning,
  FileSearch,
  ShieldAlert,
  ShieldCheck,
  Gavel,
  PieChart,
  ClipboardEdit,
  Palmtree,
  Mic,
  Wrench,
  Pin,
  Settings,
  Building2,
  Factory,
  Landmark,
  PackageOpen,
  RefreshCw,
  Cog,
  Clock,
  Tag,
  UserCog,
  KeyRound,
  ListTodo,
  Shield,
  CalendarDays,
  Wheat,
  MailOpen,
  FileKey,
  LayoutDashboard,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { openSettings } = useSettingsModal();
  const isAdmin = useIsAdmin();
  const isSupervisorPlus = useHasMinimumRole('SUPERVISOR');
  const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';
  const [showDropdown, setShowDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuTab, setMobileMenuTab] = useState<'nav' | 'admin'>('nav');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Handle hamburger click: mobile overlay on small screens, sidebar toggle on desktop
  const handleHamburgerClick = useCallback(() => {
    if (window.innerWidth < 1024) {
      setMobileMenuOpen(prev => !prev);
    } else {
      setSidebarOpen(prev => !prev);
    }
  }, []);

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

  if (!user) return <>{children}</>;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-950 dark:via-slate-900 dark:to-indigo-950">
      {/* Glassmorphism Navigation */}
      <nav className="shrink-0 z-50 backdrop-blur-xl bg-sky-100/80 dark:bg-gray-900/70 border-b border-sky-200/60 dark:border-gray-700/50 shadow-lg shadow-sky-500/10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-18">
            <div className="flex items-center space-x-4">
              {/* Hamburger Menu Button */}
              <button
                onClick={handleHamburgerClick}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle menu"
              >
                {/* Mobile: X when open, hamburger when closed */}
                <svg
                  className="w-6 h-6 text-gray-600 dark:text-gray-300 lg:hidden"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
                {/* Desktop: X when sidebar open, hamburger when closed */}
                <svg
                  className="w-6 h-6 text-gray-600 dark:text-gray-300 hidden lg:block"
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
              <Link href="/dashboard" className="flex items-center space-x-4">
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
              </Link>
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
              <button
                onClick={() => openSettings()}
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
              </button>
              
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

      <div className="flex flex-1 min-h-0">
        {/* Left Sidebar - Hidden on mobile, visible on lg+ */}
        <div className="hidden lg:block">
          <SlidingSidebar
          title={t('common.quickNavigation')}
          position="left"
          hideHandle={true}
          isOpen={sidebarOpen}
          onOpenChange={setSidebarOpen}
          links={isSystemAdmin ? [
            { href: '/dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.8} />, label: t('nav.dashboard') || 'Dashboard' },
            { href: '/system-admin', icon: <Building2 size={18} strokeWidth={1.8} />, label: t('nav.systemAdmin') || 'System Admin Portal' },
            { icon: <Settings size={18} strokeWidth={1.8} />, label: t('nav.settings'), onClick: () => openSettings() },
          ] : [
            { href: '/dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.8} />, label: t('nav.dashboard') || 'Dashboard' },
            { href: '/incidents/new', icon: <Plus size={18} strokeWidth={2} />, label: t('nav.createIncident') },
            { href: '/incidents', icon: <ClipboardList size={18} strokeWidth={1.8} />, label: t('nav.myIncidents') },
            { href: '/incidents?filter=team', icon: <UsersRound size={18} strokeWidth={1.8} />, label: t('nav.teamIncidents'), show: isSupervisorPlus },
            { href: '/incidents?filter=public', icon: <Globe size={18} strokeWidth={1.8} />, label: t('nav.publicIncidents') },
            { href: '/rca', icon: <Microscope size={18} strokeWidth={1.8} />, label: t('nav.rcaWorkspace'), show: isSupervisorPlus },
            { href: '/capa', icon: <ListChecks size={18} strokeWidth={1.8} />, label: t('nav.capaBoard'), show: isSupervisorPlus },
            { href: '/reports', icon: <TrendingUp size={18} strokeWidth={1.8} />, label: t('nav.reportsCompliance'), show: isSupervisorPlus },
            { href: '/analytics', icon: <BarChart3 size={18} strokeWidth={1.8} />, label: t('nav.analyticsInsights'), show: isSupervisorPlus },
            { href: '/knowledge', icon: <Library size={18} strokeWidth={1.8} />, label: t('nav.knowledgeBase'), show: isSupervisorPlus },
            { href: '/workplace-report', icon: <FileWarning size={18} strokeWidth={1.8} />, label: t('nav.workplaceReport') },
            { href: '/investigation-report', icon: <FileSearch size={18} strokeWidth={1.8} />, label: t('nav.investigationReport') },
            { href: '/fmir', icon: <ShieldAlert size={18} strokeWidth={1.8} />, label: t('nav.fmir') || 'Foreign Material' },
            { href: '/workplace-safety', icon: <ShieldCheck size={18} strokeWidth={1.8} />, label: 'Safety Assessment', show: isSupervisorPlus },
            { href: '/hr', icon: <Gavel size={18} strokeWidth={1.8} />, label: 'HR Resolution', show: isSupervisorPlus },
            { href: '/bakery-metrics', icon: <PieChart size={18} strokeWidth={1.8} />, label: 'Bakery Metrics' },
            { href: '/lsw', icon: <ClipboardEdit size={18} strokeWidth={1.8} />, label: 'Leaders Standard Work' },
            { href: '/vacation', icon: <Palmtree size={18} strokeWidth={1.8} />, label: 'Vacation Hub' },
            { href: '/meetings', icon: <Mic size={18} strokeWidth={1.8} />, label: 'Meeting Intelligence' },
            { href: '/operations', icon: <Wrench size={18} strokeWidth={1.8} />, label: 'Operations' },
            { href: '/assigned-actions', icon: <Pin size={18} strokeWidth={1.8} />, label: 'My Action Items' },
            { icon: <Settings size={18} strokeWidth={1.8} />, label: t('nav.settings'), onClick: () => openSettings() },
          ]}
        />
        </div>

        {/* Main Content Area - expands to fill remaining space, scrolls independently */}
        <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden transition-all duration-300 scrollbar-hide">
          {children}
        </main>

        {/* Right Sidebar - Organization Management (Admin only) - Hidden on mobile */}
        {isAdmin && (
          <div className="hidden lg:block">
            <SlidingSidebar
            title={t('common.organizationManagement')}
            position="right"
            links={user.role === 'SYSTEM_ADMIN' ? [
              { href: '/system-admin', icon: <Building2 size={18} strokeWidth={1.8} />, label: t('nav.systemAdmin') || 'System Admin Portal' },
              { href: '/admin/policies', icon: <FileKey size={18} strokeWidth={1.8} />, label: t('nav.policies') },
              { href: '/admin/support', icon: <MailOpen size={18} strokeWidth={1.8} />, label: t('nav.supportRequests') },
              { href: '/support-inbox', icon: <MailOpen size={18} strokeWidth={1.8} />, label: 'Support Inbox' },
            ] : [
              { href: '/admin/organizations', icon: <Building2 size={18} strokeWidth={1.8} />, label: t('nav.organizations') },
              { href: '/admin/facilities', icon: <Factory size={18} strokeWidth={1.8} />, label: t('nav.facilities') },
              { href: '/admin/departments', icon: <Landmark size={18} strokeWidth={1.8} />, label: t('nav.departments') },
              { href: '/admin/areas', icon: <PackageOpen size={18} strokeWidth={1.8} />, label: t('nav.areas') },
              { href: '/admin/lines', icon: <RefreshCw size={18} strokeWidth={1.8} />, label: t('nav.lines') },
              { href: '/admin/equipment-registry', icon: <Cog size={18} strokeWidth={1.8} />, label: 'Machine Registry' },
              { href: '/admin/shifts', icon: <Clock size={18} strokeWidth={1.8} />, label: t('nav.shifts') },
              { href: '/admin/categories', icon: <Tag size={18} strokeWidth={1.8} />, label: t('nav.categories') },
              { href: '/admin', icon: <UserCog size={18} strokeWidth={1.8} />, label: t('nav.userManagement') },
              { href: '/admin/privileges', icon: <KeyRound size={18} strokeWidth={1.8} />, label: t('nav.privileges') || 'Role Privileges' },
              { href: '/admin/work-order-templates', icon: <ListTodo size={18} strokeWidth={1.8} />, label: 'Work Order Templates' },
              { href: '/admin/enterprise', icon: <Shield size={18} strokeWidth={1.8} />, label: t('nav.enterprise') },
              { href: '/admin/calendar-config', icon: <CalendarDays size={18} strokeWidth={1.8} />, label: 'Calendar Year Config' },
              { href: '/admin/bakery-settings', icon: <Wheat size={18} strokeWidth={1.8} />, label: 'Bakery KPI Settings' },
              { href: '/support-inbox', icon: <MailOpen size={18} strokeWidth={1.8} />, label: 'Support Inbox' },
            ]}
          />
          </div>
        )}

        {/* Right Sidebar - QC Management - Hidden on mobile */}
        {user?.role === 'QUALITY_CONTROL_MANAGER' && (
          <div className="hidden lg:block">
            <SlidingSidebar
              title="QC Management"
              position="right"
              links={[
                { href: '/support-inbox', icon: <MailOpen size={18} strokeWidth={1.8} />, label: 'Support Inbox' },
                { href: '/fmir/privileges', icon: <KeyRound size={18} strokeWidth={1.8} />, label: 'FMIR Privileges' },
              ]}
            />
          </div>
        )}
      </div>

      {/* ===== MOBILE MENU OVERLAY (lg:hidden) ===== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-sky-100/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl flex flex-col animate-slide-in-left" style={{ top: '4rem' }}>
            {/* Tabs (if admin/QC has right sidebar) */}
            {(isAdmin || user?.role === 'QUALITY_CONTROL_MANAGER') && (
              <div className="flex border-b border-gray-200/50 dark:border-gray-700/50 px-2 pt-2">
                <button
                  onClick={() => setMobileMenuTab('nav')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                    mobileMenuTab === 'nav'
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-b-2 border-primary-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  Navigation
                </button>
                <button
                  onClick={() => setMobileMenuTab('admin')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-t-lg transition-colors ${
                    mobileMenuTab === 'admin'
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border-b-2 border-primary-500'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  {user?.role === 'QUALITY_CONTROL_MANAGER' ? 'QC Management' : 'Admin'}
                </button>
              </div>
            )}

            {/* Scrollable links */}
            <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-hide">
              {mobileMenuTab === 'nav' && (
                <div className="space-y-0.5">
                  {(isSystemAdmin ? [
                    { href: '/dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.8} />, label: t('nav.dashboard') || 'Dashboard' },
                    { href: '/system-admin', icon: <Building2 size={18} strokeWidth={1.8} />, label: t('nav.systemAdmin') || 'System Admin Portal' },
                    { icon: <Settings size={18} strokeWidth={1.8} />, label: t('nav.settings'), onClick: () => { openSettings(); setMobileMenuOpen(false); } },
                  ] : [
                    { href: '/dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.8} />, label: t('nav.dashboard') || 'Dashboard' },
                    { href: '/incidents/new', icon: <Plus size={18} strokeWidth={2} />, label: t('nav.createIncident') },
                    { href: '/incidents', icon: <ClipboardList size={18} strokeWidth={1.8} />, label: t('nav.myIncidents') },
                    { href: '/incidents?filter=team', icon: <UsersRound size={18} strokeWidth={1.8} />, label: t('nav.teamIncidents'), show: isSupervisorPlus },
                    { href: '/incidents?filter=public', icon: <Globe size={18} strokeWidth={1.8} />, label: t('nav.publicIncidents') },
                    { href: '/rca', icon: <Microscope size={18} strokeWidth={1.8} />, label: t('nav.rcaWorkspace'), show: isSupervisorPlus },
                    { href: '/capa', icon: <ListChecks size={18} strokeWidth={1.8} />, label: t('nav.capaBoard'), show: isSupervisorPlus },
                    { href: '/reports', icon: <TrendingUp size={18} strokeWidth={1.8} />, label: t('nav.reportsCompliance'), show: isSupervisorPlus },
                    { href: '/analytics', icon: <BarChart3 size={18} strokeWidth={1.8} />, label: t('nav.analyticsInsights'), show: isSupervisorPlus },
                    { href: '/knowledge', icon: <Library size={18} strokeWidth={1.8} />, label: t('nav.knowledgeBase'), show: isSupervisorPlus },
                    { href: '/workplace-report', icon: <FileWarning size={18} strokeWidth={1.8} />, label: t('nav.workplaceReport') },
                    { href: '/investigation-report', icon: <FileSearch size={18} strokeWidth={1.8} />, label: t('nav.investigationReport') },
                    { href: '/fmir', icon: <ShieldAlert size={18} strokeWidth={1.8} />, label: t('nav.fmir') || 'Foreign Material' },
                    { href: '/workplace-safety', icon: <ShieldCheck size={18} strokeWidth={1.8} />, label: 'Safety Assessment', show: isSupervisorPlus },
                    { href: '/hr', icon: <Gavel size={18} strokeWidth={1.8} />, label: 'HR Resolution', show: isSupervisorPlus },
                    { href: '/bakery-metrics', icon: <PieChart size={18} strokeWidth={1.8} />, label: 'Bakery Metrics' },
                    { href: '/lsw', icon: <ClipboardEdit size={18} strokeWidth={1.8} />, label: 'Leaders Standard Work' },
                    { href: '/vacation', icon: <Palmtree size={18} strokeWidth={1.8} />, label: 'Vacation Hub' },
                    { href: '/meetings', icon: <Mic size={18} strokeWidth={1.8} />, label: 'Meeting Intelligence' },
                    { href: '/operations', icon: <Wrench size={18} strokeWidth={1.8} />, label: 'Operations' },
                    { href: '/assigned-actions', icon: <Pin size={18} strokeWidth={1.8} />, label: 'My Action Items' },
                    { icon: <Settings size={18} strokeWidth={1.8} />, label: t('nav.settings'), onClick: () => { openSettings(); setMobileMenuOpen(false); } },
                  ]).filter(link => link.show !== false).map((link, idx) => (
                    link.onClick ? (
                      <button
                        key={idx}
                        onClick={link.onClick}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-sky-200/60 dark:hover:bg-primary-900/30 hover:text-sky-800 dark:hover:text-primary-300 transition-colors"
                      >
                        {link.icon}
                        <span>{link.label}</span>
                      </button>
                    ) : (
                      <Link
                        key={idx}
                        href={link.href!}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          pathname === link.href
                            ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-sky-200/60 dark:hover:bg-primary-900/30 hover:text-sky-800 dark:hover:text-primary-300'
                        }`}
                      >
                        {link.icon}
                        <span>{link.label}</span>
                      </Link>
                    )
                  ))}
                </div>
              )}

              {mobileMenuTab === 'admin' && (
                <div className="space-y-0.5">
                  {(user?.role === 'QUALITY_CONTROL_MANAGER' ? [
                    { href: '/support-inbox', icon: <MailOpen size={18} strokeWidth={1.8} />, label: 'Support Inbox' },
                    { href: '/fmir/privileges', icon: <KeyRound size={18} strokeWidth={1.8} />, label: 'FMIR Privileges' },
                  ] : user?.role === 'SYSTEM_ADMIN' ? [
                    { href: '/system-admin', icon: <Building2 size={18} strokeWidth={1.8} />, label: t('nav.systemAdmin') || 'System Admin Portal' },
                    { href: '/admin/policies', icon: <FileKey size={18} strokeWidth={1.8} />, label: t('nav.policies') },
                    { href: '/admin/support', icon: <MailOpen size={18} strokeWidth={1.8} />, label: t('nav.supportRequests') },
                    { href: '/support-inbox', icon: <MailOpen size={18} strokeWidth={1.8} />, label: 'Support Inbox' },
                  ] : [
                    { href: '/admin/organizations', icon: <Building2 size={18} strokeWidth={1.8} />, label: t('nav.organizations') },
                    { href: '/admin/facilities', icon: <Factory size={18} strokeWidth={1.8} />, label: t('nav.facilities') },
                    { href: '/admin/departments', icon: <Landmark size={18} strokeWidth={1.8} />, label: t('nav.departments') },
                    { href: '/admin/areas', icon: <PackageOpen size={18} strokeWidth={1.8} />, label: t('nav.areas') },
                    { href: '/admin/lines', icon: <RefreshCw size={18} strokeWidth={1.8} />, label: t('nav.lines') },
                    { href: '/admin/equipment-registry', icon: <Cog size={18} strokeWidth={1.8} />, label: 'Machine Registry' },
                    { href: '/admin/shifts', icon: <Clock size={18} strokeWidth={1.8} />, label: t('nav.shifts') },
                    { href: '/admin/categories', icon: <Tag size={18} strokeWidth={1.8} />, label: t('nav.categories') },
                    { href: '/admin', icon: <UserCog size={18} strokeWidth={1.8} />, label: t('nav.userManagement') },
                    { href: '/admin/privileges', icon: <KeyRound size={18} strokeWidth={1.8} />, label: t('nav.privileges') || 'Role Privileges' },
                    { href: '/admin/work-order-templates', icon: <ListTodo size={18} strokeWidth={1.8} />, label: 'Work Order Templates' },
                    { href: '/admin/enterprise', icon: <Shield size={18} strokeWidth={1.8} />, label: t('nav.enterprise') },
                    { href: '/admin/calendar-config', icon: <CalendarDays size={18} strokeWidth={1.8} />, label: 'Calendar Year Config' },
                    { href: '/admin/bakery-settings', icon: <Wheat size={18} strokeWidth={1.8} />, label: 'Bakery KPI Settings' },
                    { href: '/support-inbox', icon: <MailOpen size={18} strokeWidth={1.8} />, label: 'Support Inbox' },
                  ]).map((link, idx) => (
                    <Link
                      key={idx}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        pathname === link.href
                          ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-sky-200/60 dark:hover:bg-primary-900/30 hover:text-sky-800 dark:hover:text-primary-300'
                      }`}
                    >
                      {link.icon}
                      <span>{link.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </nav>
          </div>
        </div>
      )}

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
                    <button
                      onClick={() => { setShowProfileModal(false); openSettings(); }}
                      className="flex-1 px-4 py-2 text-sm font-medium text-center text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      {t('dashboard.editSettings')}
                    </button>
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
