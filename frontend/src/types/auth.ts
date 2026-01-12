// Authentication Types

export enum UserRole {
  OPERATOR = 'OPERATOR',
  SUPERVISOR = 'SUPERVISOR',
  QA_FOOD_SAFETY = 'QA_FOOD_SAFETY',
  MAINTENANCE_ENGINEERING = 'MAINTENANCE_ENGINEERING',
  CI_MANAGER = 'CI_MANAGER',
  SAFETY_SECURITY_MANAGER = 'SAFETY_SECURITY_MANAGER',
  ADMIN = 'ADMIN',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  organizationId: string;
  theme: string;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
