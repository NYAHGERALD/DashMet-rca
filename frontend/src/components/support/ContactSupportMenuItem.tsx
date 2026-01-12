'use client';

import { useState } from 'react';
import SupportModal from '@/components/support/SupportModal';

export function ContactSupportMenuItem() {
  const [showSupportModal, setShowSupportModal] = useState(false);

  return (
    <>
      <SupportModal open={showSupportModal} onOpenChange={setShowSupportModal} />
      <button
        onClick={() => setShowSupportModal(true)}
        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
        </svg>
        Contact Support
      </button>
    </>
  );
}
