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
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-purple-200 dark:border-purple-900/50" />
            <div className="w-20 h-20 rounded-full border-4 border-transparent border-t-purple-600 border-r-purple-600 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Hang tight!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-sm">Verifying your session...</p>
          <div className="flex items-center gap-1.5 mt-6">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
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
