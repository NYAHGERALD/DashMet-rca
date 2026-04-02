'use client';

import Link from 'next/link';
import Image from 'next/image';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import SupportRequestsClient from './SupportRequestsClient';

// Support Request Management is SYSTEM_ADMIN ONLY
// This is the System Admin Portal feature for managing ALL support requests
// across all organizations. Organization Admins should NOT have access.
export default function SupportAdminPage() {
  return (
    <ProtectedRoute allowedRoles={['SYSTEM_ADMIN']}>
      <SupportPageContent />
    </ProtectedRoute>
  );
}

function SupportPageContent() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="relative w-8 h-8">
                <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support Request Management</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">System Admin Portal</span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                SYSTEM ADMIN
              </span>
            </div>
          </div>
        </div>
      </nav>

      <main className="py-6 px-4 sm:px-6 lg:px-8">
        <SupportRequestsClient />
      </main>
    </div>
  );
}
