// Profile Setup Page - Complete user registration after Firebase auth
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

type Role = 'SUPERVISOR' | 'QA_FOOD_SAFETY' | 'MAINTENANCE_ENGINEERING' | 'CI_MANAGER' | 'SAFETY_SECURITY_MANAGER' | 'ADMIN' | 'SYSTEM_ADMIN';

interface Organization {
  id: string;
  name: string;
}

interface Facility {
  id: string;
  name: string;
  organizationId: string;
}

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user, firebaseUser, loading: authLoading, needsProfileSetup, refreshUser } = useAuth();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const [accessCode, setAccessCode] = useState('');
  const [accessCodeValidated, setAccessCodeValidated] = useState(false);
  const [validatingCode, setValidatingCode] = useState(false);
  
  // For ADMIN/SYSTEM_ADMIN - create new org/facility
  const [newOrganizationName, setNewOrganizationName] = useState('');
  const [createFacility, setCreateFacility] = useState(false);
  const [newFacilityName, setNewFacilityName] = useState('');
  
  // For other roles - organization signup code
  const [orgSignupCode, setOrgSignupCode] = useState('');
  const [orgCodeValidated, setOrgCodeValidated] = useState(false);
  const [validatingOrgCode, setValidatingOrgCode] = useState(false);
  const [validatedOrganization, setValidatedOrganization] = useState<Organization | null>(null);
  const [selectedFacility, setSelectedFacility] = useState('');
  const [availableFacilities, setAvailableFacilities] = useState<Facility[]>([]);
  
  // Role-specific access code state
  const [isRoleSpecificCode, setIsRoleSpecificCode] = useState(false);
  const [orgAccessCodeId, setOrgAccessCodeId] = useState<string | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  const isAdminRole = role === 'ADMIN' || role === 'SYSTEM_ADMIN';
  const needsAccessCode = isAdminRole;
  const isNonAdminRole = role && !isAdminRole;

  useEffect(() => {
    // If user has a complete profile, redirect to dashboard
    if (user) {
      router.push('/dashboard');
      return;
    }
    
    // If auth is done loading and there's no Firebase user, redirect to login
    if (!authLoading && !firebaseUser && !needsProfileSetup) {
      router.push('/login');
    }
  }, [user, firebaseUser, authLoading, needsProfileSetup, router]);

  // Validate organization signup code for non-admin roles
  const validateOrgSignupCode = async () => {
    if (!orgSignupCode.trim() || orgSignupCode.length !== 6) {
      setError('Please enter a valid 6-digit organization code');
      return;
    }
    
    setValidatingOrgCode(true);
    setError('');
    
    try {
      const response = await api.post('/firebase-auth/public/validate-org-code', {
        code: orgSignupCode.trim()
      });
      
      if (response.data.success && response.data.data.valid) {
        setOrgCodeValidated(true);
        // Handle both PascalCase (Organization) and camelCase (organization) response formats
        setValidatedOrganization(response.data.data.Organization || response.data.data.organization);
        setAvailableFacilities(response.data.data.Facility || response.data.data.facilities || []);
        
        // Check if this is a role-specific access code
        if (response.data.data.isRoleSpecific && response.data.data.role) {
          setIsRoleSpecificCode(true);
          setRole(response.data.data.role as Role);
          setOrgAccessCodeId(response.data.data.accessCodeId);
        } else {
          setIsRoleSpecificCode(false);
          setOrgAccessCodeId(null);
        }
      } else {
        setError(response.data.data.message || 'Invalid organization code. Please check with your administrator.');
        setOrgCodeValidated(false);
        setValidatedOrganization(null);
        setAvailableFacilities([]);
        setIsRoleSpecificCode(false);
        setOrgAccessCodeId(null);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to validate organization code';
      setError(errorMessage);
      setOrgCodeValidated(false);
      setValidatedOrganization(null);
      setAvailableFacilities([]);
      setIsRoleSpecificCode(false);
      setOrgAccessCodeId(null);
    } finally {
      setValidatingOrgCode(false);
    }
  };

  // Validate access code when it changes (for admin roles)
  const validateAccessCode = async () => {
    if (!accessCode.trim() || !role) return;
    
    setValidatingCode(true);
    setError('');
    
    try {
      const response = await api.post('/firebase-auth/validate-access-code', {
        code: accessCode.trim(),
        role
      });
      
      if (response.data.success && response.data.data.valid) {
        setAccessCodeValidated(true);
      } else {
        setError('Invalid access code for this role');
        setAccessCodeValidated(false);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to validate access code';
      setError(errorMessage);
      setAccessCodeValidated(false);
    } finally {
      setValidatingCode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required');
      setLoading(false);
      return;
    }

    if (!role) {
      setError('Please select a role');
      setLoading(false);
      return;
    }

    if (needsAccessCode && !accessCodeValidated) {
      setError('Please validate your access code first');
      setLoading(false);
      return;
    }

    // For ADMIN role, organization name is required
    if (role === 'ADMIN' && !newOrganizationName.trim()) {
      setError('Organization name is required for Admin role');
      setLoading(false);
      return;
    }

    // If facility checkbox is checked, facility name is required
    if (createFacility && !newFacilityName.trim()) {
      setError('Facility name is required when creating a facility');
      setLoading(false);
      return;
    }

    // For non-admin roles, organization code validation and facility selection is required
    if (isNonAdminRole && !orgCodeValidated) {
      setError('Please validate your organization code first');
      setLoading(false);
      return;
    }

    if (isNonAdminRole && !validatedOrganization) {
      setError('Please enter a valid organization code');
      setLoading(false);
      return;
    }

    if (isNonAdminRole && !selectedFacility) {
      setError('Please select a facility');
      setLoading(false);
      return;
    }

    try {
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        accessCode: needsAccessCode ? accessCode.trim() : undefined,
      };

      if (isAdminRole) {
        // ADMIN/SYSTEM_ADMIN create new organization/facility
        if (newOrganizationName.trim()) {
          payload.newOrganizationName = newOrganizationName.trim();
        }
        if (createFacility && newFacilityName.trim()) {
          payload.newFacilityName = newFacilityName.trim();
        }
      } else {
        // Other roles use validated organization and selected facility
        payload.organizationId = validatedOrganization!.id;
        payload.facilityId = selectedFacility;
        // Include orgAccessCodeId if a role-specific code was used
        if (orgAccessCodeId) {
          payload.orgAccessCodeId = orgAccessCodeId;
        }
      }

      await api.post('/firebase-auth/create-profile', payload);
      
      // Profile created successfully - refresh auth state then redirect
      await refreshUser();
      router.push('/dashboard');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to create profile';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-3 py-4 xs:p-4 sm:p-6">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
      </div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-[calc(100vw-1.5rem)] xs:max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl shadow-2xl p-3 xs:p-4 sm:p-6 md:p-8">
          <div className="text-center mb-3 xs:mb-4 sm:mb-6 md:mb-8">
            <h1 className="text-lg xs:text-xl sm:text-2xl md:text-3xl font-bold text-white mb-1 sm:mb-2">
              Complete Your Profile
            </h1>
            <p className="text-xs xs:text-sm sm:text-base text-gray-300">
              Tell us a bit about yourself to get started
            </p>
            {firebaseUser && (
              <p className="text-[10px] xs:text-xs sm:text-sm text-gray-400 mt-1 sm:mt-2">
                Signed in as: <span className="font-medium text-white break-all">{firebaseUser.email}</span>
              </p>
            )}
          </div>

          {error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs sm:text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 xs:space-y-4 sm:space-y-5 md:space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 xs:gap-4 sm:gap-5 md:gap-6">
              <div>
                <label className="block text-[10px] xs:text-xs sm:text-sm font-medium text-gray-200 mb-1 xs:mb-1.5 sm:mb-2">
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full px-2.5 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-xs xs:text-sm sm:text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                  placeholder="John"
                />
              </div>

              <div>
                <label className="block text-[10px] xs:text-xs sm:text-sm font-medium text-gray-200 mb-1 xs:mb-1.5 sm:mb-2">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full px-2.5 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-xs xs:text-sm sm:text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                  placeholder="Doe"
                />
              </div>
            </div>

            {/* Organization Access Code - SHOWN FIRST */}
            <div>
              <label className="block text-[10px] xs:text-xs sm:text-sm font-medium text-gray-200 mb-1 xs:mb-1.5 sm:mb-2">
                Organization Access Code *
              </label>
              <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
                <input
                  type="text"
                  value={orgSignupCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOrgSignupCode(value);
                    if (orgCodeValidated) {
                      setOrgCodeValidated(false);
                      setValidatedOrganization(null);
                      setAvailableFacilities([]);
                      setSelectedFacility('');
                      setIsRoleSpecificCode(false);
                      setOrgAccessCodeId(null);
                      setRole('');
                    }
                  }}
                  maxLength={6}
                  disabled={orgCodeValidated}
                  className="flex-1 px-2.5 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm xs:text-base sm:text-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent disabled:opacity-50 font-mono tracking-widest"
                  placeholder="000000"
                />
                <button
                  type="button"
                  onClick={validateOrgSignupCode}
                  disabled={validatingOrgCode || orgCodeValidated || orgSignupCode.length !== 6}
                  className={`px-3 xs:px-4 sm:px-6 py-2 xs:py-2.5 sm:py-3 rounded-lg font-medium text-xs xs:text-sm sm:text-base transition-colors whitespace-nowrap ${
                    orgCodeValidated
                      ? 'bg-green-600 text-white cursor-default'
                      : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  {validatingOrgCode ? 'Validating...' : orgCodeValidated ? '✓ Validated' : 'Validate'}
                </button>
              </div>
              <p className="mt-1 xs:mt-1.5 sm:mt-2 text-[9px] xs:text-[10px] sm:text-xs text-gray-400">
                Enter the 6-digit code provided by your organization administrator
              </p>
              {orgCodeValidated && (
                <button
                  type="button"
                  onClick={() => {
                    setOrgCodeValidated(false);
                    setOrgSignupCode('');
                    setValidatedOrganization(null);
                    setAvailableFacilities([]);
                    setSelectedFacility('');
                    setIsRoleSpecificCode(false);
                    setOrgAccessCodeId(null);
                    setRole('');
                  }}
                  className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                >
                  Use a different code
                </button>
              )}
            </div>

            {/* Show validated info after code validation */}
            {orgCodeValidated && validatedOrganization && (
              <>
                {/* Organization Display */}
                <div>
                  <label className="block text-[10px] xs:text-xs sm:text-sm font-medium text-gray-200 mb-1 xs:mb-1.5 sm:mb-2">
                    Organization
                  </label>
                  <div className="w-full px-2.5 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 rounded-lg border border-green-500/30 bg-green-500/10 text-white">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-xs xs:text-sm sm:text-base font-medium">{validatedOrganization.name}</span>
                    </div>
                  </div>
                </div>

                {/* Role Display - Auto-assigned */}
                {isRoleSpecificCode && role && (
                  <div>
                    <label className="block text-[10px] xs:text-xs sm:text-sm font-medium text-gray-200 mb-1 xs:mb-1.5 sm:mb-2">
                      Role
                    </label>
                    <div className="w-full px-2.5 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 rounded-lg border border-green-500/30 bg-green-500/10 text-white">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-xs xs:text-sm sm:text-base font-medium">
                          {role === 'SUPERVISOR' && 'Supervisor'}
                          {role === 'QA_FOOD_SAFETY' && 'QA / Food Safety'}
                          {role === 'QUALITY_CONTROL_MANAGER' && 'Quality Control Manager'}
                          {role === 'MAINTENANCE_ENGINEERING' && 'Maintenance / Engineering'}
                          {role === 'CI_MANAGER' && 'CI / Manager'}
                          {role === 'SAFETY_SECURITY_MANAGER' && 'Safety & Security Manager'}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 xs:mt-1.5 sm:mt-2 text-[9px] xs:text-[10px] sm:text-xs text-green-400">
                      ✓ Role automatically assigned based on your access code
                    </p>
                  </div>
                )}

                {/* Facility Selection */}
                <div>
                  <label className="block text-[10px] xs:text-xs sm:text-sm font-medium text-gray-200 mb-1 xs:mb-1.5 sm:mb-2">
                    Facility *
                  </label>
                  {availableFacilities.length > 0 ? (
                    <select
                      value={selectedFacility}
                      onChange={(e) => setSelectedFacility(e.target.value)}
                      required
                      className="w-full px-2.5 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-xs xs:text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent [&>option]:bg-slate-800 [&>option]:text-white"
                    >
                      <option value="">Select a facility</option>
                      {availableFacilities.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs sm:text-sm">
                      No facilities available. Please contact your administrator.
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Divider for Admin path */}
            {!orgCodeValidated && (
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-slate-800/80 text-gray-400">or for Admin access</span>
                </div>
              </div>
            )}

            {/* Admin Role Selection - Only shown if no org code validated */}
            {!orgCodeValidated && (
              <div>
                <label className="block text-[10px] xs:text-xs sm:text-sm font-medium text-gray-200 mb-1 xs:mb-1.5 sm:mb-2">
                  Admin Role
                </label>
                <select
                  value={isAdminRole ? role : ''}
                  onChange={(e) => {
                    const selectedRole = e.target.value as Role;
                    setRole(selectedRole);
                    setAccessCode('');
                    setAccessCodeValidated(false);
                    setNewOrganizationName('');
                    setNewFacilityName('');
                    setCreateFacility(false);
                    setError('');
                  }}
                  className="w-full px-2.5 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-xs xs:text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent [&>option]:bg-slate-800 [&>option]:text-white"
                >
                  <option value="">Select admin role (if applicable)</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SYSTEM_ADMIN">System Admin</option>
                </select>
                <p className="mt-1 xs:mt-1.5 sm:mt-2 text-[9px] xs:text-[10px] sm:text-xs text-gray-400">
                  Only select if you are setting up as an Admin or System Admin
                </p>
              </div>
            )}

            {/* Access Code for Admin Roles */}
            {needsAccessCode && (
              <div>
                <label className="block text-[10px] xs:text-xs sm:text-sm font-medium text-gray-200 mb-1 xs:mb-1.5 sm:mb-2">
                  Access Code *
                </label>
                <div className="flex flex-col xs:flex-row gap-2 sm:gap-3">
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => {
                      setAccessCode(e.target.value);
                      setAccessCodeValidated(false);
                    }}
                    required
                    disabled={accessCodeValidated}
                    className="flex-1 px-2.5 xs:px-3 sm:px-4 py-2 xs:py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-xs xs:text-sm sm:text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent disabled:opacity-50"
                    placeholder="Enter 6-digit code"
                  />
                  <button
                    type="button"
                    onClick={validateAccessCode}
                    disabled={validatingCode || accessCodeValidated || !accessCode.trim()}
                    className={`px-3 xs:px-4 sm:px-6 py-2 xs:py-2.5 sm:py-3 rounded-lg font-medium text-xs xs:text-sm sm:text-base transition-colors whitespace-nowrap ${
                      accessCodeValidated
                        ? 'bg-green-600 text-white cursor-default'
                        : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-700 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
                    }`}
                  >
                    {validatingCode ? 'Validating...' : accessCodeValidated ? '✓ Validated' : 'Validate'}
                  </button>
                </div>
                <p className="mt-1 xs:mt-1.5 sm:mt-2 text-[9px] xs:text-[10px] sm:text-xs text-gray-400">
                  Admin and System Admin roles require a valid access code
                </p>
              </div>
            )}

            {/* ADMIN/SYSTEM_ADMIN - Create Organization (shown after access code validation) */}
            {isAdminRole && accessCodeValidated && (
              <>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-200 mb-1.5 sm:mb-2">
                    Organization Name {role === 'ADMIN' ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    value={newOrganizationName}
                    onChange={(e) => setNewOrganizationName(e.target.value)}
                    required={role === 'ADMIN'}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm sm:text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                    placeholder="Enter organization name"
                  />
                  <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-400">
                    {role === 'SYSTEM_ADMIN' 
                      ? 'As System Admin, you can create an organization now or later from the portal'
                      : 'Create a new organization for your team'
                    }
                  </p>
                </div>

                {/* Optional Facility Creation */}
                <div className="border border-white/10 rounded-lg p-3 sm:p-4 bg-white/5">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <input
                      type="checkbox"
                      id="createFacility"
                      checked={createFacility}
                      onChange={(e) => {
                        setCreateFacility(e.target.checked);
                        if (!e.target.checked) {
                          setNewFacilityName('');
                        }
                      }}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded border-white/20 bg-white/5 text-blue-600 focus:ring-blue-500/50"
                    />
                    <label htmlFor="createFacility" className="text-xs sm:text-sm font-medium text-gray-200">
                      Also create a facility now
                    </label>
                  </div>
                  <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-400 ml-6 sm:ml-8">
                    You can always create facilities later from the admin portal
                  </p>

                  {createFacility && (
                    <div className="mt-3 sm:mt-4">
                      <label className="block text-xs sm:text-sm font-medium text-gray-200 mb-1.5 sm:mb-2">
                        Facility Name *
                      </label>
                      <input
                        type="text"
                        value={newFacilityName}
                        onChange={(e) => setNewFacilityName(e.target.value)}
                        required={createFacility}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-white/5 border border-white/10 rounded-lg text-white text-sm sm:text-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent"
                        placeholder="Enter facility name"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="pt-2 xs:pt-3 sm:pt-4">
              <button
                type="submit"
                disabled={
                  loading || 
                  !role || 
                  (needsAccessCode && !accessCodeValidated) || 
                  (isRoleSpecificCode && (!orgCodeValidated || !selectedFacility))
                }
                className="w-full px-3 xs:px-4 sm:px-6 py-2 xs:py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-xs xs:text-sm sm:text-base rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg"
              >
                {loading ? 'Creating Profile...' : 'Complete Setup'}
              </button>
            </div>
          </form>

          <div className="mt-3 xs:mt-4 sm:mt-6 text-center space-y-1.5 xs:space-y-2 sm:space-y-3">
            <p className="text-[10px] xs:text-xs sm:text-sm text-gray-400">
              Need help? Contact your system administrator
            </p>
            <button
              type="button"
              onClick={async () => {
                try {
                  await signOut(auth);
                  localStorage.removeItem('firebaseToken');
                  router.push('/');
                } catch (err) {
                  console.error('Failed to sign out:', err);
                }
              }}
              className="text-[10px] xs:text-xs sm:text-sm text-blue-400 hover:text-blue-300 underline"
            >
              Use a different account? Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
