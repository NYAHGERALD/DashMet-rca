'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useHasMinimumRole, useIsAdmin } from '@/lib/rbac';
import { useNavAccess, NAV_PRIVILEGES } from '@/lib/usePrivileges';
import Link from 'next/link';
import Image from 'next/image';
import SlidingSidebar from '@/components/ui/SlidingSidebar';
import NotificationCenter from '@/components/layout/NotificationCenter';
import { ContactSupportMenuItem } from '@/components/support/ContactSupportMenuItem';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useSettingsModal } from '@/components/settings/SettingsModalProvider';
import { usePathname, useRouter } from 'next/navigation';
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
  PenTool,
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
  UserPlus,
  Menu,
  X,
  Database,
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

type AppNavLink = {
  href?: string;
  icon: React.ReactNode;
  label: string;
  show?: boolean;
  onClick?: () => void;
  group?: string;
};

// Map pathnames to their nav privilege keys for access revocation detection
const PATH_TO_NAV_KEY: Record<string, string> = {
  '/dashboard': NAV_PRIVILEGES.DASHBOARD,
  '/incidents/new': NAV_PRIVILEGES.CREATE_INCIDENT,
  '/incidents': NAV_PRIVILEGES.MY_INCIDENTS,
  '/rca': NAV_PRIVILEGES.RCA,
  '/capa': NAV_PRIVILEGES.CAPA,
  '/reports': NAV_PRIVILEGES.REPORTS,
  '/analytics': NAV_PRIVILEGES.ANALYTICS,
  '/knowledge': NAV_PRIVILEGES.KNOWLEDGE,
  '/workplace-report': NAV_PRIVILEGES.WORKPLACE_REPORT,
  '/investigation-report': NAV_PRIVILEGES.INVESTIGATION_REPORT,
  '/fmir': NAV_PRIVILEGES.FMIR,
  '/workplace-safety': NAV_PRIVILEGES.SAFETY_ASSESSMENT,
  '/hr': NAV_PRIVILEGES.HR,
  '/bakery-metrics': NAV_PRIVILEGES.BAKERY_METRICS,
  '/production-eos': NAV_PRIVILEGES.PRODUCTION_EOS,
  '/lsw': NAV_PRIVILEGES.LSW,
  '/vacation': NAV_PRIVILEGES.VACATION,
  '/meetings': NAV_PRIVILEGES.MEETINGS,
  '/operations': NAV_PRIVILEGES.OPERATIONS,
  '/assigned-actions': NAV_PRIVILEGES.ACTION_ITEMS,
  '/whiteboard': NAV_PRIVILEGES.CANVAS_AI,
  '/admin/organizations': NAV_PRIVILEGES.ADMIN_ORGANIZATIONS,
  '/admin/facilities': NAV_PRIVILEGES.ADMIN_FACILITIES,
  '/admin/departments': NAV_PRIVILEGES.ADMIN_DEPARTMENTS,
  '/admin/areas': NAV_PRIVILEGES.ADMIN_AREAS,
  '/admin/lines': NAV_PRIVILEGES.ADMIN_LINES,
  '/admin/equipment-registry': NAV_PRIVILEGES.ADMIN_EQUIPMENT,
  '/admin/shifts': NAV_PRIVILEGES.ADMIN_SHIFTS,
  '/admin/categories': NAV_PRIVILEGES.ADMIN_CATEGORIES,
  '/admin': NAV_PRIVILEGES.ADMIN_USERS,
  '/admin/invitations': NAV_PRIVILEGES.ADMIN_INVITATIONS,
  '/admin/privileges': NAV_PRIVILEGES.ADMIN_PRIVILEGES,
  '/admin/work-order-templates': NAV_PRIVILEGES.ADMIN_WORK_ORDERS,
  '/admin/enterprise': NAV_PRIVILEGES.ADMIN_ENTERPRISE,
  '/admin/calendar-config': NAV_PRIVILEGES.ADMIN_CALENDAR,
  '/admin/bakery-settings': NAV_PRIVILEGES.ADMIN_BAKERY_SETTINGS,
  '/admin/production-eos-reference': NAV_PRIVILEGES.ADMIN_PRODUCTION_EOS_REFERENCE,
  '/support-inbox': NAV_PRIVILEGES.SUPPORT_INBOX,
};

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { openSettings } = useSettingsModal();
  const isAdmin = useIsAdmin();
  const isSupervisorPlus = useHasMinimumRole('SUPERVISOR');
  const { hasNavAccess } = useNavAccess();
  const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileQuickNavOpen, setMobileQuickNavOpen] = useState(false);
  const [mobileMenuTab, setMobileMenuTab] = useState<'nav' | 'admin'>('nav');
  const [accessRevoked, setAccessRevoked] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const prevAccessRef = useRef<boolean | null>(null);

  // Real-time access revocation detection
  // When privileges update via WebSocket, check if the current page is still accessible
  useEffect(() => {
    if (!user || isSystemAdmin || !pathname) return;

    // Find the nav key for the current path (match most specific path first)
    const sortedPaths = Object.keys(PATH_TO_NAV_KEY).sort((a, b) => b.length - a.length);
    const matchedPath = sortedPaths.find(p => {
      if (p === '/admin' && pathname === '/admin') return true;
      if (p === '/admin') return false; // Don't match /admin for sub-paths
      return pathname === p || pathname.startsWith(p + '/');
    });

    if (!matchedPath) {
      prevAccessRef.current = null;
      return; // Page not governed by nav privileges
    }

    const navKey = PATH_TO_NAV_KEY[matchedPath];
    const currentAccess = hasNavAccess(navKey);

    // Only trigger modal when access transitions from true → false (not on initial load)
    if (prevAccessRef.current === true && currentAccess === false) {
      setAccessRevoked(true);
    }

    prevAccessRef.current = currentAccess;
  }, [hasNavAccess, pathname, user, isSystemAdmin]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileQuickNavOpen(false);
  }, [pathname]);

  // Prevent body scroll when a mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen || mobileQuickNavOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen, mobileQuickNavOpen]);

  // Handle hamburger click: mobile overlay on small screens, sidebar toggle on desktop
  const handleHamburgerClick = useCallback(() => {
    if (window.innerWidth < 1024) {
      setMobileQuickNavOpen(false);
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
        setShowDropdown(false);
        setMobileMenuOpen(false);
        setMobileQuickNavOpen(false);
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  if (!user) return <>{children}</>;

  const organizationManagementLinks: AppNavLink[] = user.role === 'SYSTEM_ADMIN' ? [
    { href: '/system-admin', icon: <Building2 size={18} strokeWidth={1.8} />, label: 'Organizations' },
    { href: '/admin/policies', icon: <FileKey size={18} strokeWidth={1.8} />, label: t('nav.policies') },
    { href: '/admin/support', icon: <MailOpen size={18} strokeWidth={1.8} />, label: 'Support Requests' },
  ] : [
    { href: '/admin/organizations', icon: <Building2 size={18} strokeWidth={1.8} />, label: t('nav.organizations'), show: hasNavAccess(NAV_PRIVILEGES.ADMIN_ORGANIZATIONS) },
    { href: '/admin/facilities', icon: <Factory size={18} strokeWidth={1.8} />, label: t('nav.facilities'), show: hasNavAccess(NAV_PRIVILEGES.ADMIN_FACILITIES) },
    { href: '/admin/departments', icon: <Landmark size={18} strokeWidth={1.8} />, label: t('nav.departments'), show: hasNavAccess(NAV_PRIVILEGES.ADMIN_DEPARTMENTS) },
    { href: '/admin/areas', icon: <PackageOpen size={18} strokeWidth={1.8} />, label: t('nav.areas'), show: hasNavAccess(NAV_PRIVILEGES.ADMIN_AREAS) },
    { href: '/admin/lines', icon: <RefreshCw size={18} strokeWidth={1.8} />, label: t('nav.lines'), show: hasNavAccess(NAV_PRIVILEGES.ADMIN_LINES) },
    { href: '/admin/equipment-registry', icon: <Cog size={18} strokeWidth={1.8} />, label: 'Machine Registry', show: hasNavAccess(NAV_PRIVILEGES.ADMIN_EQUIPMENT) },
    { href: '/admin/shifts', icon: <Clock size={18} strokeWidth={1.8} />, label: t('nav.shifts'), show: hasNavAccess(NAV_PRIVILEGES.ADMIN_SHIFTS) },
    { href: '/admin/categories', icon: <Tag size={18} strokeWidth={1.8} />, label: t('nav.categories'), show: hasNavAccess(NAV_PRIVILEGES.ADMIN_CATEGORIES) },
    { href: '/admin', icon: <UserCog size={18} strokeWidth={1.8} />, label: t('nav.userManagement'), show: hasNavAccess(NAV_PRIVILEGES.ADMIN_USERS) },
    { href: '/admin/invitations', icon: <UserPlus size={18} strokeWidth={1.8} />, label: 'Invitations', show: hasNavAccess(NAV_PRIVILEGES.ADMIN_INVITATIONS) },
    { href: '/admin/privileges', icon: <KeyRound size={18} strokeWidth={1.8} />, label: 'Priviledges', show: hasNavAccess(NAV_PRIVILEGES.ADMIN_PRIVILEGES) },
    { href: '/admin/work-order-templates', icon: <ListTodo size={18} strokeWidth={1.8} />, label: 'Work Order Templates', show: hasNavAccess(NAV_PRIVILEGES.ADMIN_WORK_ORDERS) },
    { href: '/admin/enterprise', icon: <Shield size={18} strokeWidth={1.8} />, label: t('nav.enterprise'), show: hasNavAccess(NAV_PRIVILEGES.ADMIN_ENTERPRISE) },
    { href: '/admin/calendar-config', icon: <CalendarDays size={18} strokeWidth={1.8} />, label: 'Calendar Year Config', show: hasNavAccess(NAV_PRIVILEGES.ADMIN_CALENDAR) },
    { href: '/admin/bakery-settings', icon: <Wheat size={18} strokeWidth={1.8} />, label: 'Bakery KPI Settings', show: hasNavAccess(NAV_PRIVILEGES.ADMIN_BAKERY_SETTINGS) },
    { href: '/admin/production-eos-reference', icon: <Database size={18} strokeWidth={1.8} />, label: 'Production EOS Data', show: hasNavAccess(NAV_PRIVILEGES.ADMIN_PRODUCTION_EOS_REFERENCE) },
    { href: '/support-inbox', icon: <MailOpen size={18} strokeWidth={1.8} />, label: 'Support Inbox', show: hasNavAccess(NAV_PRIVILEGES.SUPPORT_INBOX) },
  ];
  const qcManagementLinks: AppNavLink[] = [
    { href: '/support-inbox', icon: <MailOpen size={18} strokeWidth={1.8} />, label: 'Support Inbox' },
    { href: '/fmir/privileges', icon: <KeyRound size={18} strokeWidth={1.8} />, label: 'FMIR Privileges' },
  ];
  const rightQuickNavTitle = user.role === 'QUALITY_CONTROL_MANAGER' ? 'QC Management' : t('common.organizationManagement');
  const rightQuickNavLinks = user.role === 'QUALITY_CONTROL_MANAGER'
    ? qcManagementLinks
    : isAdmin
      ? organizationManagementLinks
      : [];
  const visibleRightQuickNavLinks = rightQuickNavLinks.filter(link => !('show' in link) || link.show !== false);
  const hasMobileQuickNav = visibleRightQuickNavLinks.length > 0;

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
              {hasMobileQuickNav && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setMobileQuickNavOpen(prev => !prev);
                  }}
                  title={rightQuickNavTitle}
                  aria-label={`${mobileQuickNavOpen ? 'Close' : 'Open'} ${rightQuickNavTitle}`}
                  aria-expanded={mobileQuickNavOpen}
                  className="lg:hidden group p-2.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white backdrop-blur-md bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200/50 dark:border-gray-600/50 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-black/5 hover:scale-105"
                >
                  {mobileQuickNavOpen ? (
                    <X className="w-5 h-5" strokeWidth={2.2} />
                  ) : (
                    <Menu className="w-5 h-5" strokeWidth={2.2} />
                  )}
                </button>
              )}

              {/* Browser Notifications */}
              <NotificationCenter isSystemAdmin={isSystemAdmin} />
              
              {/* Settings Button - Glass style (icon only) */}
              <button
                onClick={() => openSettings()}
                title={t('nav.settings')}
                aria-label={t('nav.settings')}
                className="group p-2.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white backdrop-blur-md bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-700/80 border border-gray-200/50 dark:border-gray-600/50 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-black/5 hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
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
                          openSettings('profile');
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
                      {isSystemAdmin ? (
                        <Link
                          href="/admin/support"
                          onClick={() => setShowDropdown(false)}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 flex items-center gap-3 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                            <MailOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          Support Requests
                        </Link>
                      ) : (
                        <ContactSupportMenuItem />
                      )}
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
        <div className="hidden lg:flex h-full">
          <SlidingSidebar
          title={t('common.quickNavigation')}
          position="left"
          hideHandle={true}
          isOpen={sidebarOpen}
          onOpenChange={setSidebarOpen}
          links={isSystemAdmin ? [
            { href: '/dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.8} />, label: t('nav.dashboard') || 'Dashboard' },
            { icon: <Settings size={18} strokeWidth={1.8} />, label: t('nav.settings'), onClick: () => openSettings() },
          ] : [
            { href: '/dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.8} />, label: t('nav.dashboard') || 'Dashboard', show: hasNavAccess(NAV_PRIVILEGES.DASHBOARD) },
            { href: '/incidents/new', icon: <Plus size={18} strokeWidth={2} />, label: t('nav.createIncident'), show: hasNavAccess(NAV_PRIVILEGES.CREATE_INCIDENT), group: 'Incidents' },
            { href: '/incidents', icon: <ClipboardList size={18} strokeWidth={1.8} />, label: t('nav.myIncidents'), show: hasNavAccess(NAV_PRIVILEGES.MY_INCIDENTS), group: 'Incidents' },
            { href: '/incidents?filter=team', icon: <UsersRound size={18} strokeWidth={1.8} />, label: t('nav.teamIncidents'), show: hasNavAccess(NAV_PRIVILEGES.TEAM_INCIDENTS), group: 'Incidents' },
            { href: '/incidents?filter=public', icon: <Globe size={18} strokeWidth={1.8} />, label: t('nav.publicIncidents'), show: hasNavAccess(NAV_PRIVILEGES.PUBLIC_INCIDENTS), group: 'Incidents' },
            { href: '/rca', icon: <Microscope size={18} strokeWidth={1.8} />, label: t('nav.rcaWorkspace'), show: hasNavAccess(NAV_PRIVILEGES.RCA), group: 'Analysis' },
            { href: '/capa', icon: <ListChecks size={18} strokeWidth={1.8} />, label: t('nav.capaBoard'), show: hasNavAccess(NAV_PRIVILEGES.CAPA), group: 'Analysis' },
            { href: '/reports', icon: <TrendingUp size={18} strokeWidth={1.8} />, label: t('nav.reportsCompliance'), show: hasNavAccess(NAV_PRIVILEGES.REPORTS), group: 'Analysis' },
            { href: '/analytics', icon: <BarChart3 size={18} strokeWidth={1.8} />, label: t('nav.analyticsInsights'), show: hasNavAccess(NAV_PRIVILEGES.ANALYTICS), group: 'Analysis' },
            { href: '/knowledge', icon: <Library size={18} strokeWidth={1.8} />, label: t('nav.knowledgeBase'), show: hasNavAccess(NAV_PRIVILEGES.KNOWLEDGE), group: 'Analysis' },
            { href: '/workplace-report', icon: <FileWarning size={18} strokeWidth={1.8} />, label: t('nav.workplaceReport'), show: hasNavAccess(NAV_PRIVILEGES.WORKPLACE_REPORT), group: 'Safety & Compliance' },
            { href: '/investigation-report', icon: <FileSearch size={18} strokeWidth={1.8} />, label: t('nav.investigationReport'), show: hasNavAccess(NAV_PRIVILEGES.INVESTIGATION_REPORT), group: 'Safety & Compliance' },
            { href: '/fmir', icon: <ShieldAlert size={18} strokeWidth={1.8} />, label: t('nav.fmir') || 'Foreign Material', show: hasNavAccess(NAV_PRIVILEGES.FMIR), group: 'Safety & Compliance' },
            { href: '/workplace-safety', icon: <ShieldCheck size={18} strokeWidth={1.8} />, label: 'Safety Assessment', show: hasNavAccess(NAV_PRIVILEGES.SAFETY_ASSESSMENT), group: 'Safety & Compliance' },
            { href: '/hr', icon: <Gavel size={18} strokeWidth={1.8} />, label: 'Conflict Resolution', show: hasNavAccess(NAV_PRIVILEGES.HR), group: 'Safety & Compliance' },
            { href: '/bakery-metrics', icon: <PieChart size={18} strokeWidth={1.8} />, label: 'Bakery Metrics', show: hasNavAccess(NAV_PRIVILEGES.BAKERY_METRICS), group: 'Operations' },
            { href: '/production-eos', icon: <Factory size={18} strokeWidth={1.8} />, label: 'Production EOS', show: hasNavAccess(NAV_PRIVILEGES.PRODUCTION_EOS), group: 'Operations' },
            { href: '/lsw', icon: <ClipboardEdit size={18} strokeWidth={1.8} />, label: 'LSW', show: hasNavAccess(NAV_PRIVILEGES.LSW), group: 'Operations' },
            { href: '/vacation', icon: <Palmtree size={18} strokeWidth={1.8} />, label: 'Vacation Hub', show: hasNavAccess(NAV_PRIVILEGES.VACATION), group: 'Operations' },
            { href: '/meetings', icon: <Mic size={18} strokeWidth={1.8} />, label: 'Meeting Intelligence', show: hasNavAccess(NAV_PRIVILEGES.MEETINGS), group: 'Operations' },
            { href: '/operations', icon: <Wrench size={18} strokeWidth={1.8} />, label: 'Operations', show: hasNavAccess(NAV_PRIVILEGES.OPERATIONS), group: 'Operations' },
            { href: '/assigned-actions', icon: <Pin size={18} strokeWidth={1.8} />, label: 'My Action Items', show: hasNavAccess(NAV_PRIVILEGES.ACTION_ITEMS), group: 'Personal' },
            { href: '/whiteboard', icon: <PenTool size={18} strokeWidth={1.8} />, label: 'Whiteboard', show: hasNavAccess(NAV_PRIVILEGES.CANVAS_AI), group: 'Personal' },
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
          <div className="hidden lg:flex h-full">
            <SlidingSidebar
            title={t('common.organizationManagement')}
            position="right"
            links={organizationManagementLinks}
          />
          </div>
        )}

        {/* Right Sidebar - QC Management - Hidden on mobile */}
        {user?.role === 'QUALITY_CONTROL_MANAGER' && (
          <div className="hidden lg:flex h-full">
            <SlidingSidebar
              title="QC Management"
              position="right"
              links={qcManagementLinks}
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
                    { icon: <Settings size={18} strokeWidth={1.8} />, label: t('nav.settings'), onClick: () => { openSettings(); setMobileMenuOpen(false); } },
                  ] : [
                    { href: '/dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.8} />, label: t('nav.dashboard') || 'Dashboard', show: hasNavAccess(NAV_PRIVILEGES.DASHBOARD) },
                    { href: '/incidents/new', icon: <Plus size={18} strokeWidth={2} />, label: t('nav.createIncident'), show: hasNavAccess(NAV_PRIVILEGES.CREATE_INCIDENT) },
                    { href: '/incidents', icon: <ClipboardList size={18} strokeWidth={1.8} />, label: t('nav.myIncidents'), show: hasNavAccess(NAV_PRIVILEGES.MY_INCIDENTS) },
                    { href: '/incidents?filter=team', icon: <UsersRound size={18} strokeWidth={1.8} />, label: t('nav.teamIncidents'), show: hasNavAccess(NAV_PRIVILEGES.TEAM_INCIDENTS) },
                    { href: '/incidents?filter=public', icon: <Globe size={18} strokeWidth={1.8} />, label: t('nav.publicIncidents'), show: hasNavAccess(NAV_PRIVILEGES.PUBLIC_INCIDENTS) },
                    { href: '/rca', icon: <Microscope size={18} strokeWidth={1.8} />, label: t('nav.rcaWorkspace'), show: hasNavAccess(NAV_PRIVILEGES.RCA) },
                    { href: '/capa', icon: <ListChecks size={18} strokeWidth={1.8} />, label: t('nav.capaBoard'), show: hasNavAccess(NAV_PRIVILEGES.CAPA) },
                    { href: '/reports', icon: <TrendingUp size={18} strokeWidth={1.8} />, label: t('nav.reportsCompliance'), show: hasNavAccess(NAV_PRIVILEGES.REPORTS) },
                    { href: '/analytics', icon: <BarChart3 size={18} strokeWidth={1.8} />, label: t('nav.analyticsInsights'), show: hasNavAccess(NAV_PRIVILEGES.ANALYTICS) },
                    { href: '/knowledge', icon: <Library size={18} strokeWidth={1.8} />, label: t('nav.knowledgeBase'), show: hasNavAccess(NAV_PRIVILEGES.KNOWLEDGE) },
                    { href: '/workplace-report', icon: <FileWarning size={18} strokeWidth={1.8} />, label: t('nav.workplaceReport'), show: hasNavAccess(NAV_PRIVILEGES.WORKPLACE_REPORT) },
                    { href: '/investigation-report', icon: <FileSearch size={18} strokeWidth={1.8} />, label: t('nav.investigationReport'), show: hasNavAccess(NAV_PRIVILEGES.INVESTIGATION_REPORT) },
                    { href: '/fmir', icon: <ShieldAlert size={18} strokeWidth={1.8} />, label: t('nav.fmir') || 'Foreign Material', show: hasNavAccess(NAV_PRIVILEGES.FMIR) },
                    { href: '/workplace-safety', icon: <ShieldCheck size={18} strokeWidth={1.8} />, label: 'Safety Assessment', show: hasNavAccess(NAV_PRIVILEGES.SAFETY_ASSESSMENT) },
                    { href: '/hr', icon: <Gavel size={18} strokeWidth={1.8} />, label: 'Conflict Resolution', show: hasNavAccess(NAV_PRIVILEGES.HR) },
                    { href: '/bakery-metrics', icon: <PieChart size={18} strokeWidth={1.8} />, label: 'Bakery Metrics', show: hasNavAccess(NAV_PRIVILEGES.BAKERY_METRICS) },
                    { href: '/production-eos', icon: <Factory size={18} strokeWidth={1.8} />, label: 'Production EOS', show: hasNavAccess(NAV_PRIVILEGES.PRODUCTION_EOS) },
                    { href: '/lsw', icon: <ClipboardEdit size={18} strokeWidth={1.8} />, label: 'LSW', show: hasNavAccess(NAV_PRIVILEGES.LSW) },
                    { href: '/vacation', icon: <Palmtree size={18} strokeWidth={1.8} />, label: 'Vacation Hub', show: hasNavAccess(NAV_PRIVILEGES.VACATION) },
                    { href: '/meetings', icon: <Mic size={18} strokeWidth={1.8} />, label: 'Meeting Intelligence', show: hasNavAccess(NAV_PRIVILEGES.MEETINGS) },
                    { href: '/operations', icon: <Wrench size={18} strokeWidth={1.8} />, label: 'Operations', show: hasNavAccess(NAV_PRIVILEGES.OPERATIONS) },
                    { href: '/assigned-actions', icon: <Pin size={18} strokeWidth={1.8} />, label: 'My Action Items', show: hasNavAccess(NAV_PRIVILEGES.ACTION_ITEMS) },
                    { href: '/whiteboard', icon: <PenTool size={18} strokeWidth={1.8} />, label: 'Whiteboard', show: hasNavAccess(NAV_PRIVILEGES.CANVAS_AI) },
                    { icon: <Settings size={18} strokeWidth={1.8} />, label: t('nav.settings'), onClick: () => { openSettings(); setMobileMenuOpen(false); } },
                  ]).filter(link => !('show' in link) || link.show !== false).map((link, idx) => (
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
                  {visibleRightQuickNavLinks.map((link, idx) => (
                    <Link
                      key={idx}
                      href={link.href || '#'}
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

      {/* ===== MOBILE RIGHT QUICK NAV DRAWER (lg:hidden) ===== */}
      {mobileQuickNavOpen && hasMobileQuickNav && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileQuickNavOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 w-[300px] max-w-[86vw] bg-sky-100/95 dark:bg-gray-900/95 backdrop-blur-xl shadow-2xl flex flex-col animate-slide-in-right" style={{ top: '4rem' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/50 dark:border-gray-700/50">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                  Quick Nav
                </p>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {rightQuickNavTitle}
                </h2>
              </div>
              <button
                onClick={() => setMobileQuickNavOpen(false)}
                aria-label="Close quick navigation"
                className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-sky-200/70 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" strokeWidth={2.2} />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-3 px-3 scrollbar-hide">
              <div className="space-y-1">
                {visibleRightQuickNavLinks.map((link, idx) => (
                  link.onClick ? (
                    <button
                      key={idx}
                      onClick={() => {
                        link.onClick?.();
                        setMobileQuickNavOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-sky-200/60 dark:hover:bg-primary-900/30 hover:text-sky-800 dark:hover:text-primary-300 transition-colors"
                    >
                      {link.icon}
                      <span>{link.label}</span>
                    </button>
                  ) : (
                    <Link
                      key={idx}
                      href={link.href || '#'}
                      onClick={() => setMobileQuickNavOpen(false)}
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
            </nav>
          </div>
        </div>
      )}

      {/* Access Revoked Modal — shown when admin removes user's access to current page in real-time */}
      {accessRevoked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-50 dark:bg-red-900/20 px-6 pt-6 pb-4 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-red-800 dark:text-red-200">
                Access Revoked
              </h3>
              <p className="mt-2 text-sm text-red-600 dark:text-red-300">
                Your access to this page has been revoked by an administrator. You will be redirected to the dashboard.
              </p>
            </div>
            <div className="px-6 py-4 text-center">
              <button
                onClick={() => {
                  setAccessRevoked(false);
                  router.push('/dashboard');
                }}
                className="w-full px-6 py-3 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors shadow-sm"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
