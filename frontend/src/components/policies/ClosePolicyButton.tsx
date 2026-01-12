'use client';

import { useRouter } from 'next/navigation';

export function ClosePolicyButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
          router.back();
          return;
        }
        router.push('/');
      }}
      className="shrink-0 inline-flex items-center justify-center rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
      aria-label="Close"
    >
      Close
    </button>
  );
}
