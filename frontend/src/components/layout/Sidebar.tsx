// Modern Sidebar Navigation Component

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useSettingsModal } from '@/components/settings/SettingsModalProvider';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard,
  AlertTriangle,
  Microscope,
  ListChecks,
  TrendingUp,
  Settings,
  Building2,
  Users,
  Library,
  FileWarning,
  FileSearch,
  ShieldAlert,
  ShieldCheck,
  Gavel,
  PieChart,
  Inbox,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  ChevronRight,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { openSettings } = useSettingsModal();
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar-collapsed', String(next));
  };

  const isActive = (path: string) => pathname === path || pathname?.startsWith(path + '/');

  // Navigation items
  const navigationItems = [
    { name: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard, roles: ['*'] },
    { name: t('nav.incidents'), href: '/incidents', icon: AlertTriangle, roles: ['*'] },
    { name: t('nav.rca'), href: '/rca', icon: Microscope, roles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'] },
    { name: t('nav.capa'), href: '/capa', icon: ListChecks, roles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'] },
    { name: t('nav.reports'), href: '/reports', icon: TrendingUp, roles: ['SUPERVISOR', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'] },
    { name: t('nav.knowledgeBase'), href: '/knowledge', icon: Library, roles: ['*'] },
  ];

  const reportItems = [
    { name: t('nav.workplaceReport'), href: '/workplace-report', icon: FileWarning, roles: ['*'] },
    { name: t('nav.investigationReport'), href: '/investigation-report', icon: FileSearch, roles: ['*'] },
    { name: t('nav.fmir') || 'Foreign Material', href: '/fmir', icon: ShieldAlert, roles: ['*'] },
    { name: 'Safety Assessment', href: '/workplace-safety', icon: ShieldCheck, roles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'] },
    { name: 'HR Resolution', href: '/hr', icon: Gavel, roles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'] },
    { name: 'Bakery Metrics', href: '/bakery-metrics', icon: PieChart, roles: ['*'] },
  ];

  const adminItems = [
    { name: 'Support Inbox', href: '/support-inbox', icon: Inbox, roles: ['ADMIN', 'SYSTEM_ADMIN', 'QUALITY_CONTROL_MANAGER'] },
    { name: t('profile.organization'), href: '/organization', icon: Building2, roles: ['ADMIN', 'SYSTEM_ADMIN'] },
    { name: t('nav.users'), href: '/users', icon: Users, roles: ['ADMIN', 'SYSTEM_ADMIN'] },
  ];

  const hasAccess = (roles: string[]) => {
    if (roles.includes('*')) return true;
    return user?.role && roles.includes(user.role);
  };

  const handleMouseEnter = (id: string) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => setHoveredItem(id), 100);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setHoveredItem(null);
  };

  const renderNavItem = (item: { name: string; href: string; icon: any; roles: string[] }) => {
    if (!hasAccess(item.roles)) return null;
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <div key={item.href} className="relative group" onMouseEnter={() => handleMouseEnter(item.href)} onMouseLeave={handleMouseLeave}>
        <Link
          href={item.href}
          className={`
            flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative
            ${active
              ? 'bg-primary-500/10 dark:bg-primary-400/15 text-primary-600 dark:text-primary-400 font-semibold shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200'
            }
            ${collapsed ? 'justify-center px-2' : ''}
          `}
        >
          {active && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary-500 dark:bg-primary-400 rounded-r-full" />
          )}
          <Icon className={`shrink-0 ${active ? 'text-primary-600 dark:text-primary-400' : ''}`} size={20} strokeWidth={active ? 2.2 : 1.8} />
          {!collapsed && (
            <span className="text-[13px] truncate">{item.name}</span>
          )}
          {!collapsed && active && (
            <ChevronRight className="ml-auto shrink-0 text-primary-400 dark:text-primary-500" size={14} />
          )}
        </Link>
        {/* Tooltip for collapsed state */}
        {collapsed && hoveredItem === item.href && (
          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none">
            <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
              {item.name}
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-900 dark:border-r-gray-700" />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSectionLabel = (label: string) => {
    if (collapsed) {
      return <div className="mx-3 my-2 border-t border-gray-200 dark:border-gray-700/60" />;
    }
    return (
      <div className="px-3 pt-5 pb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
          {label}
        </span>
      </div>
    );
  };

  const userInitials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`;

  return (
    <aside
      className={`
        flex flex-col bg-white dark:bg-gray-800/95 border-r border-gray-200/80 dark:border-gray-700/50
        min-h-[calc(100vh-3rem)] transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[68px]' : 'w-[260px]'}
      `}
    >
      {/* Collapse toggle */}
      <div className={`flex items-center px-3 pt-3 pb-1 ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          onClick={toggleCollapsed}
          className="p-1.5 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.8} /> : <PanelLeftClose size={18} strokeWidth={1.8} />}
        </button>
      </div>

      {/* Scrollable navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 pb-2 space-y-0.5 scrollbar-hide">
        {/* Main */}
        {renderSectionLabel(t('common.menu') || 'Menu')}
        {navigationItems.map(renderNavItem)}

        {/* Reports & Compliance */}
        {reportItems.some(item => hasAccess(item.roles)) && (
          <>
            {renderSectionLabel('Reports & Compliance')}
            {reportItems.map(renderNavItem)}
          </>
        )}

        {/* Administration */}
        {adminItems.some(item => hasAccess(item.roles)) && (
          <>
            {renderSectionLabel(t('common.administration'))}
            {adminItems.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* Bottom section — Settings + User profile */}
      <div className="border-t border-gray-200/80 dark:border-gray-700/50 px-2.5 py-2.5 space-y-1">
        {/* Settings */}
        {(user?.role === 'ADMIN' || user?.role === 'SYSTEM_ADMIN') && (
          <div className="relative group" onMouseEnter={() => handleMouseEnter('settings')} onMouseLeave={handleMouseLeave}>
            <button
              onClick={() => openSettings()}
              className={`
                flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200
                text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-200
                ${collapsed ? 'justify-center px-2' : ''}
              `}
            >
              <Settings size={20} strokeWidth={1.8} className="shrink-0" />
              {!collapsed && <span className="text-[13px]">{t('nav.settings')}</span>}
            </button>
            {collapsed && hoveredItem === 'settings' && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none">
                <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                  {t('nav.settings')}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-900 dark:border-r-gray-700" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logout */}
        <div className="relative group" onMouseEnter={() => handleMouseEnter('logout')} onMouseLeave={handleMouseLeave}>
          <button
            onClick={logout}
            className={`
              flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200
              text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400
              ${collapsed ? 'justify-center px-2' : ''}
            `}
          >
            <LogOut size={20} strokeWidth={1.8} className="shrink-0" />
            {!collapsed && <span className="text-[13px]">{t('auth.logout')}</span>}
          </button>
          {collapsed && hoveredItem === 'logout' && (
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50 pointer-events-none">
              <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                {t('auth.logout')}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-900 dark:border-r-gray-700" />
              </div>
            </div>
          )}
        </div>

        {/* User profile */}
        <div className={`
          flex items-center gap-3 px-2 py-2.5 rounded-xl mt-1
          bg-gray-50 dark:bg-gray-700/30
          ${collapsed ? 'justify-center' : ''}
        `}>
          <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 ring-2 ring-primary-200 dark:ring-primary-700/50 ring-offset-1 ring-offset-white dark:ring-offset-gray-800">
            {user?.profilePicture ? (
              <img
                src={user.profilePicture}
                alt={`${user?.firstName} ${user?.lastName}`}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-semibold">
                {userInitials}
              </div>
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                {user?.email}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
