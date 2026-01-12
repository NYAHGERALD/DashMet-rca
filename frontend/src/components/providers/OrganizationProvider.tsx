// Phase 2: Organization Context Provider

'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';
import api from '@/lib/api';

interface Organization {
  id: string;
  name: string;
  region: string;
  defaultLanguage: string;
}

interface OrganizationContextType {
  organization: Organization | null;
  loading: boolean;
  refreshOrganization: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchOrganization();
    } else {
      setOrganization(null);
      setLoading(false);
    }
  }, [user]);

  const fetchOrganization = async () => {
    if (!user) return;
    
    try {
      const response = await api.get(`/organizations/${user.organizationId}`);
      setOrganization(response.data.data);
    } catch (error) {
      console.error('Failed to fetch organization:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshOrganization = async () => {
    await fetchOrganization();
  };

  return (
    <OrganizationContext.Provider value={{ organization, loading, refreshOrganization }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
