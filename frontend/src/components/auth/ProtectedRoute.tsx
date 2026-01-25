'use client';

import { useAuth } from '@/components/providers/AuthProvider';
import { hasMinimumRole } from '@/lib/rbac';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import FloatingSupportButton from '@/components/support/FloatingSupportButton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  minRole?: string;
  requireAuth?: boolean;
  loginRedirect?: string; // Custom login redirect URL
}

export default function ProtectedRoute({ 
  children, 
  allowedRoles,
  minRole,
  requireAuth = true,
  loginRedirect = '/login'
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      // Redirect to login if auth is required but user not logged in
      if (requireAuth && !user) {
        router.push(loginRedirect);
        return;
      }

      // Check role-based access
      if (user && allowedRoles && allowedRoles.length > 0) {
        if (!allowedRoles.includes(user.role)) {
          router.push('/unauthorized');
        }
      }

      // Check minimum role-based access
      if (user && minRole) {
        if (!hasMinimumRole(user.role, minRole)) {
          router.push('/unauthorized');
        }
      }
    }
  }, [user, loading, requireAuth, allowedRoles, minRole, router, loginRedirect]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if auth required but no user
  if (requireAuth && !user) {
    return null;
  }

  // Don't render if user doesn't have required role
  if (user && allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return null;
  }

  // Don't render if user doesn't have required minimum role
  if (user && minRole && !hasMinimumRole(user.role, minRole)) {
    return null;
  }

  return (
    <>
      {children}
      {/* Floating Support Button for non-Admin users */}
      <FloatingSupportButton />
    </>
  );
}
