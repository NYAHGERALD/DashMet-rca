'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { RoleGate, useHasMinimumRole, useIsAdmin } from '@/lib/rbac';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import DashboardMetrics from '@/components/dashboard/DashboardMetrics';
import SystemAdminDashboard from '@/components/dashboard/SystemAdminDashboard';
import { useI18n } from '@/lib/i18n/I18nProvider';

function DashboardContent() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isAdmin = useIsAdmin();
  const isSupervisorPlus = useHasMinimumRole('SUPERVISOR');
  const isSystemAdmin = user?.role === 'SYSTEM_ADMIN';

  if (!user) return null;

  return (
    <div className="w-full">
      <div className="p-4 sm:p-8">
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2 sm:mb-4 text-center">
          {t('dashboard.welcome')}, {user.firstName}!
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6 text-center">
          {t('dashboard.loggedInAs')} <strong>{user.role}</strong>
        </p>

        {/* Dashboard Metrics & Charts */}
        {isSystemAdmin ? (
          <div className="mt-8">
            <SystemAdminDashboard />
          </div>
        ) : isSupervisorPlus ? (
          <div className="mt-8">
            <DashboardMetrics />
          </div>
        ) : null}
      </div>
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
