'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5001/api');

const NATIVE_SHELL_KEY = 'dashmetNativeShell';
const NATIVE_RETURN_URL_KEY = 'dashmetNativeReturnUrl';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const getHandoffApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return '/api';
    }
  }
  return API_BASE_URL;
};

const isAllowedNativeReturnUrl = (value: string | null): value is string => {
  if (!value) return false;

  try {
    const url = new URL(value);
    const isLocalHost = url.hostname === 'localhost';
    const isAllowedProtocol = ['capacitor:', 'ionic:', 'http:', 'https:'].includes(url.protocol);
    return isLocalHost && isAllowedProtocol;
  } catch {
    return false;
  }
};

async function redeemMobileHandoff(code: string) {
  const response = await fetch(`${normalizeBaseUrl(getHandoffApiBaseUrl())}/mobile/session/web-handoff/redeem`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-DashMet-Mobile-App': 'rca-mobile',
    },
    body: JSON.stringify({ code }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || 'Unable to open your DashMet session.');
  }
}

function MobileSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Opening your DashMet workspace...');
  const [error, setError] = useState('');

  const code = useMemo(() => searchParams.get('code')?.trim() || '', [searchParams]);
  const returnTo = useMemo(() => searchParams.get('returnTo'), [searchParams]);

  useEffect(() => {
    let mounted = true;

    async function redeem() {
      try {
        if (!/^[A-Za-z0-9_-]{32,}$/.test(code)) {
          throw new Error('This mobile sign-in link is invalid. Please sign in again.');
        }

        await redeemMobileHandoff(code);
        if (!mounted) return;

        if (isAllowedNativeReturnUrl(returnTo)) {
          window.localStorage.setItem(NATIVE_SHELL_KEY, 'true');
          window.localStorage.setItem(NATIVE_RETURN_URL_KEY, returnTo);
        }

        window.history.replaceState({}, '', '/mobile-session');
        setStatus('Session ready. Redirecting...');
        router.replace('/dashboard');
      } catch (redeemError) {
        if (!mounted) return;
        setError(redeemError instanceof Error ? redeemError.message : 'Unable to open DashMet.');
        setStatus('Please return to the DashMet app and sign in again.');
      }
    }

    redeem();
    return () => {
      mounted = false;
    };
  }, [code, returnTo, router]);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <section className="w-full max-w-sm rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400 text-slate-950 font-semibold">
            D
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">DashMet Native</p>
            <h1 className="text-xl font-semibold">Mobile session</h1>
          </div>
        </div>

        <p className="text-sm text-cyan-50">{status}</p>
        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200/30 bg-rose-500/20 px-3 py-2 text-sm text-rose-50">
            {error}
          </p>
        ) : (
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-300" />
          </div>
        )}
      </section>
    </main>
  );
}

export default function MobileSessionPage() {
  return (
    <Suspense fallback={null}>
      <MobileSessionContent />
    </Suspense>
  );
}
