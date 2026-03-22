'use client';

import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import BakeryMetricsAdmin from '@/components/bakery-metrics/BakeryMetricsAdmin';
import { ArrowLeft, Wheat } from 'lucide-react';

export default function BakerySettingsPage() {
  const router = useRouter();

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 w-full">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 transition-colors active:scale-95 flex-shrink-0"
                title="Go Back"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Wheat className="w-6 h-6 text-amber-600" />
                  Bakery KPI Settings
                </h1>
                <p className="mt-0.5 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Manage weekly sheets, KPI targets, and performance thresholds
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <BakeryMetricsAdmin />
        </div>
      </div>
    </ProtectedRoute>
  );
}
