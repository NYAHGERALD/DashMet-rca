// Phase 0.2: Sidebar Navigation Component

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import {
  LayoutDashboard,
  AlertCircle,
  FlaskConical,
  ClipboardCheck,
  BarChart3,
  Settings,
  Building2,
  Users,
  BookOpen,
  FileText,
  ClipboardList,
  AlertTriangle,
  Inbox,
  Shield,
  Scale,
  Wheat,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useI18n();

  const isActive = (path: string) => pathname === path;

  // Phase 1.2: Role-based navigation items
  const navigationItems = [
    {
      name: t('nav.dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['*'], // All roles
    },
    {
      name: t('nav.incidents'),
      href: '/incidents',
      icon: AlertCircle,
      roles: ['*'],
    },
    {
      name: t('nav.rca'),
      href: '/rca',
      icon: FlaskConical,
      roles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
    },
    {
      name: t('nav.capa'),
      href: '/capa',
      icon: ClipboardCheck,
      roles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
    },
    {
      name: t('nav.reports'),
      href: '/reports',
      icon: BarChart3,
      roles: ['SUPERVISOR', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
    },
    {
      name: t('nav.knowledgeBase'),
      href: '/knowledge',
      icon: BookOpen,
      roles: ['*'],
    },
    {
      name: t('nav.workplaceReport'),
      href: '/workplace-report',
      icon: FileText,
      roles: ['*'], // Available to all users
    },
    {
      name: t('nav.investigationReport'),
      href: '/investigation-report',
      icon: ClipboardList,
      roles: ['*'], // Available to all users
    },
    {
      name: t('nav.fmir') || 'Foreign Material',
      href: '/fmir',
      icon: AlertTriangle,
      roles: ['*'], // Available to all users
    },
    {
      name: 'Safety Assessment',
      href: '/workplace-safety',
      icon: Shield,
      roles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'SAFETY_SECURITY_MANAGER', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
    },
    {
      name: 'HR Resolution',
      href: '/hr',
      icon: Scale,
      roles: ['SUPERVISOR', 'QA_FOOD_SAFETY', 'MAINTENANCE_ENGINEERING', 'CI_MANAGER', 'ADMIN', 'SYSTEM_ADMIN'],
    },
    {
      name: 'Bakery Metrics',
      href: '/bakery-metrics',
      icon: Wheat,
      roles: ['*'], // Available to all users
    },
  ];

  // Admin-only items
  const adminItems = [
    {
      name: 'Support Inbox',
      href: '/support-inbox',
      icon: Inbox,
      roles: ['ADMIN', 'SYSTEM_ADMIN', 'QUALITY_CONTROL_MANAGER'],
    },
    {
      name: t('profile.organization'),
      href: '/organization',
      icon: Building2,
      roles: ['ADMIN', 'SYSTEM_ADMIN'],
    },
    {
      name: t('nav.users'),
      href: '/users',
      icon: Users,
      roles: ['ADMIN', 'SYSTEM_ADMIN'],
    },
    {
      name: t('nav.settings'),
      href: '/settings',
      icon: Settings,
      roles: ['ADMIN', 'SYSTEM_ADMIN'],
    },
  ];

  const hasAccess = (roles: string[]) => {
    if (roles.includes('*')) return true;
    return user?.role && roles.includes(user.role);
  };

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-4rem)]">
      <nav className="p-4 space-y-1">
        {/* Main Navigation */}
        {navigationItems.map((item) => {
          if (!hasAccess(item.roles)) return null;

          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* Divider */}
        {adminItems.some((item) => hasAccess(item.roles)) && (
          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {t('common.administration')}
            </p>
          </div>
        )}

        {/* Admin Items */}
        {adminItems.map((item) => {
          if (!hasAccess(item.roles)) return null;

          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
