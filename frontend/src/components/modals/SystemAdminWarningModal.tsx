'use client';

import { AlertTriangle, X, ShieldAlert, ArrowRight } from 'lucide-react';

interface SystemAdminWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRedirect: () => void;
}

export default function SystemAdminWarningModal({
  isOpen,
  onClose,
  onRedirect,
}: SystemAdminWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop - red tinted for urgency, no click handler to force explicit choice */}
        <div
          className="fixed inset-0 bg-red-900/40 backdrop-blur-sm transition-opacity"
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full transform transition-all border-2 border-red-500 dark:border-red-600">
          {/* Red warning header */}
          <div className="bg-gradient-to-r from-red-600 to-red-700 rounded-t-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <ShieldAlert className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Security Restriction
                </h3>
                <p className="text-red-100 text-sm">
                  Unauthorized Access Attempt
                </p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Warning icon with animation */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
                <div className="relative p-4 bg-red-100 dark:bg-red-900/50 rounded-full">
                  <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </div>

            {/* Warning message */}
            <div className="text-center mb-6">
              <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                System Administrator Detected
              </h4>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                You are attempting to access the system using a{' '}
                <span className="font-semibold text-red-600 dark:text-red-400">
                  System Administrator account
                </span>{' '}
                through the regular login portal.
              </p>
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-left">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-800 dark:text-red-200">
                    <p className="font-semibold mb-1">Security Policy Violation</p>
                    <p>
                      System Administrators must authenticate through the{' '}
                      <span className="font-bold">dedicated Control Center portal</span>{' '}
                      using enterprise authentication controls. This is required for security compliance.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={onRedirect}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-red-500/25"
              >
                <ShieldAlert className="w-5 h-5" />
                Go to Control Center Portal
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* Footer note */}
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
              Your session has been terminated for security purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
