'use client';

import { useState } from 'react';
import { ShieldX, X, AlertCircle } from 'lucide-react';

// ============================================================================
// Helper to detect if an API error is a privilege/access denied error
// ============================================================================

export interface PrivilegeError {
  isPrivilegeError: boolean;
  privilegeKey?: string;
  message?: string;
}

/**
 * Check if an axios error is a 403 privilege denial
 * Returns the privilege key if available, or a flag indicating it's a privilege error
 */
export function isPrivilegeError(error: any): PrivilegeError {
  if (!error?.response) {
    return { isPrivilegeError: false };
  }
  
  const status = error.response.status;
  const data = error.response.data;
  
  // Check for 403 status (Forbidden)
  if (status === 403) {
    return {
      isPrivilegeError: true,
      privilegeKey: data?.privilegeKey || data?.privilegeKeys?.[0],
      message: data?.message || data?.error || 'Access denied',
    };
  }
  
  return { isPrivilegeError: false };
}

/**
 * Handle an API error - if it's a privilege error, show the modal; otherwise call the fallback
 * @param error The caught error from an API call
 * @param showAccessDenied The function to show the access denied modal
 * @param fallbackHandler Optional fallback for non-privilege errors (e.g., setError)
 * @param featureName Optional feature name to display in the modal
 * @returns true if it was a privilege error (handled), false otherwise
 */
export function handlePrivilegeError(
  error: any,
  showAccessDenied: (featureName?: string, privilegeKey?: string) => void,
  fallbackHandler?: (message: string) => void,
  featureName?: string
): boolean {
  const privError = isPrivilegeError(error);
  
  if (privError.isPrivilegeError) {
    showAccessDenied(featureName, privError.privilegeKey);
    return true;
  }
  
  // Not a privilege error - call the fallback handler if provided
  if (fallbackHandler) {
    const errorMessage = error?.response?.data?.error || error?.message || 'An error occurred';
    fallbackHandler(errorMessage);
  }
  
  return false;
}

interface AccessDeniedModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  requiredPrivilege?: string;
}

export default function AccessDeniedModal({
  isOpen,
  onClose,
  featureName = 'this feature',
  requiredPrivilege,
}: AccessDeniedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 rounded-full">
              <ShieldX className="w-12 h-12 text-red-600 dark:text-red-400" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">
            Access Restricted
          </h2>

          {/* Message */}
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            You don't have permission to access{' '}
            <span className="font-medium text-gray-900 dark:text-white">
              {featureName}
            </span>
            . This action requires additional privileges that haven't been granted to your role.
          </p>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="font-medium mb-1">Need access?</p>
                <p className="text-blue-700 dark:text-blue-400">
                  Contact your Administrator or System Admin to request the necessary permissions for your role.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
            >
              Go Back
            </button>
          </div>

          {/* Footer note */}
          <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-4">
            Reference: {requiredPrivilege || 'privilege.required'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Hook for easy privilege checking with modal
// ============================================================================

interface UsePrivilegeGuardOptions {
  featureName?: string;
  onContactSupport?: () => void;
}

interface PrivilegeGuardResult {
  checkPrivilege: (hasPriv: boolean, privilegeKey?: string) => boolean;
  modal: React.ReactNode;
  showAccessDenied: (featureName?: string, privilegeKey?: string) => void;
  closeModal: () => void;
}

import { useCallback } from 'react';

export function useAccessDeniedModal(options: UsePrivilegeGuardOptions = {}): PrivilegeGuardResult {
  const [isOpen, setIsOpen] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(options.featureName || 'this feature');
  const [currentPrivilege, setCurrentPrivilege] = useState<string | undefined>(undefined);

  const showAccessDenied = useCallback((featureName?: string, privilegeKey?: string) => {
    setCurrentFeature(featureName || options.featureName || 'this feature');
    setCurrentPrivilege(privilegeKey);
    setIsOpen(true);
  }, [options.featureName]);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const checkPrivilege = useCallback((hasPriv: boolean, privilegeKey?: string): boolean => {
    if (!hasPriv) {
      showAccessDenied(undefined, privilegeKey);
      return false;
    }
    return true;
  }, [showAccessDenied]);

  const modal = (
    <AccessDeniedModal
      isOpen={isOpen}
      onClose={closeModal}
      featureName={currentFeature}
      requiredPrivilege={currentPrivilege}
      onContactSupport={options.onContactSupport}
    />
  );

  return {
    checkPrivilege,
    modal,
    showAccessDenied,
    closeModal,
  };
}
