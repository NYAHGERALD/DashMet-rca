'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function RegisterPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('/images/landing-page-image.jpg')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/92" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative w-16 h-16">
              <Image src="/images/logo.png" alt="DASHMET Logo" fill className="object-contain" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white mb-3">Invitation Required</h1>
          <p className="text-sm text-gray-300 mb-6">
            Self-registration is disabled. Ask your organization administrator to send you an invitation link.
          </p>

          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-lg hover:from-blue-700 hover:to-blue-600 transition-all font-medium shadow-lg"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
