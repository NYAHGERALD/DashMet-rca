// Redirect to main login page
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FirebaseLoginRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-white">Redirecting to login...</div>
    </div>
  );
}
