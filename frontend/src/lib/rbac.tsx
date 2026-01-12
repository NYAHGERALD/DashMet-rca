'use client';

import { useAuth } from '@/components/providers/AuthProvider';

interface RoleGateProps {
  children: React.ReactNode;
  allowedRoles: string[];
  fallback?: React.ReactNode;
}

// Component to show/hide content based on user role
export function RoleGate({ children, allowedRoles, fallback = null }: RoleGateProps) {
  const { user } = useAuth();

  if (!user || !allowedRoles.includes(user.role)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Hook to check if user has specific role
export function useHasRole(role: string | string[]): boolean {
  const { user } = useAuth();
  
  if (!user) return false;
  
  if (Array.isArray(role)) {
    return role.includes(user.role);
  }
  
  return user.role === role;
}

// Hook to check if user has any of the specified roles
export function useHasAnyRole(roles: string[]): boolean {
  const { user } = useAuth();
  
  if (!user) return false;
  
  return roles.includes(user.role);
}

// Hook to check if user has all of the specified roles
export function useIsAdmin(): boolean {
  const { user } = useAuth();
  
  if (!user) return false;
  
  return ['SYSTEM_ADMIN', 'ADMIN'].includes(user.role);
}

// Permission levels hierarchy
export const ROLE_HIERARCHY: Record<string, number> = {
  OPERATOR: 1,
  SUPERVISOR: 2,
  QA_FOOD_SAFETY: 3,
  MAINTENANCE_ENGINEERING: 3,
  CI_MANAGER: 4,
  ADMIN: 5,
  SYSTEM_ADMIN: 6,
};

// Check if user role has sufficient permission level
export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 999;
  return userLevel >= requiredLevel;
}

// Hook to check minimum role level
export function useHasMinimumRole(requiredRole: string): boolean {
  const { user } = useAuth();
  
  if (!user) return false;
  
  return hasMinimumRole(user.role, requiredRole);
}
