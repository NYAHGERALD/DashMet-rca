'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { exchangeOutlookCode } from '@/lib/lswApi';

/**
 * Outlook OAuth Callback Page
 * Microsoft redirects here after the user completes consent.
 * This page exchanges the authorization code for tokens via our backend,
 * then redirects back to the LSW page.
 */
export default function OutlookCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (error) {
      setStatus('error');
      setErrorMsg(errorDescription || error || 'Microsoft returned an error');
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMsg('No authorization code received from Microsoft');
      return;
    }

    // Exchange the code for tokens
    exchangeOutlookCode(code, state || '')
      .then((result) => {
        setStatus('success');
        // Redirect back to LSW page after a brief success message
        setTimeout(() => {
          router.push('/lsw?outlookConnected=true');
        }, 1500);
      })
      .catch((err) => {
        setStatus('error');
        setErrorMsg(err?.response?.data?.error || err.message || 'Failed to connect Outlook');
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
        {status === 'processing' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Connecting Outlook...
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Please wait while we link your Outlook calendar.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Outlook Connected!
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Your calendar meetings will now appear in your LSW page. Redirecting...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
              Connection Failed
            </h2>
            <p className="text-red-500 dark:text-red-400 text-sm mb-4">
              {errorMsg}
            </p>
            <button
              onClick={() => router.push('/lsw')}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors"
            >
              Back to LSW
            </button>
          </>
        )}
      </div>
    </div>
  );
}
