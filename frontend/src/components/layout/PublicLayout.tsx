// Phase 0.2: Public Layout (for non-authenticated pages)

import Link from 'next/link';
import Image from 'next/image';

interface PublicLayoutProps {
  children: React.ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-3">
              <div className="relative w-10 h-10">
                <Image 
                  src="/images/logo.png" 
                  alt="DASHMET Logo" 
                  fill 
                  className="object-contain"
                />
              </div>
              <div className="text-2xl font-bold text-primary-600">DashMet</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">RCA Engine</div>
            </Link>
            
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="btn btn-primary"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-12">
        {children}
      </main>

      <footer className="mt-12 border-t border-gray-200 dark:border-gray-700">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-sm text-gray-500 dark:text-gray-400">
            <p>&copy; {new Date().getFullYear()} DashMet Corporation. All rights reserved.</p>
            <p className="mt-2">USA • Mexico • Canada</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
