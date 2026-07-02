import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createFirebaseMobileSession,
  getCurrentUser,
  logoutMobileSession,
  startEmailLink,
  verifyEmailLink,
} from './api';
import { hasFirebaseClientConfig, mobileConfig } from './config';
import {
  confirmPhoneCode,
  isNativePhoneAuthAvailable,
  signOutFirebasePhone,
  startPhoneSignIn,
} from './firebasePhoneAuth';
import { clearMobileSession, loadMobileSession, saveMobileSession } from './secureSession';
import { registerPushForSession } from './push';
import type { MobileSession } from './types';

type LoginStep = 'phone' | 'sms' | 'email' | 'email-code';

function normalizePhoneInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return `+${trimmed.replace(/\D/g, '')}`;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

function getFriendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('not implemented') || message.includes('unimplemented')) {
    return 'Native Firebase phone authentication is not installed in this build yet.';
  }
  return message || 'Something went wrong. Please try again.';
}

export default function App() {
  const [session, setSession] = useState<MobileSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<LoginStep>('phone');
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [firebaseIdToken, setFirebaseIdToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pushStatus, setPushStatus] = useState('');

  const nativePhoneAuthReady = useMemo(() => isNativePhoneAuthAvailable(), []);

  useEffect(() => {
    let mounted = true;

    async function restoreSession() {
      try {
        const storedSession = await loadMobileSession();
        if (!storedSession) return;

        const user = await getCurrentUser(storedSession.accessToken);
        if (!mounted) return;
        setSession({ ...storedSession, user });
        setPushStatus(await registerPushForSession(storedSession.accessToken));
      } catch {
        await clearMobileSession();
      } finally {
        if (mounted) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      mounted = false;
    };
  }, []);

  async function completeDashMetSession(idToken: string) {
    const response = await createFirebaseMobileSession(idToken);
    if (response.requiresEmailVerification) {
      setFirebaseIdToken(idToken);
      setStep('email');
      setMessage(response.message);
      return;
    }

    await saveMobileSession(response.data);
    setSession(response.data);
    setMessage('Signed in successfully.');
    setPushStatus(await registerPushForSession(response.data.accessToken));
  }

  async function handlePhoneSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (!nativePhoneAuthReady) {
        throw new Error('Native Firebase phone authentication is only available in Android/iOS builds.');
      }

      const normalizedPhone = normalizePhoneInput(phone);
      if (!/^\+\d{10,15}$/.test(normalizedPhone)) {
        throw new Error('Enter the phone number in a valid format.');
      }

      await startPhoneSignIn(normalizedPhone, {
        onCodeSent: (id) => {
          setVerificationId(id);
          setStep('sms');
          setBusy(false);
          setMessage('Enter the verification code sent to your phone.');
        },
        onAutoVerified: async (idToken) => {
          try {
            await completeDashMetSession(idToken);
          } catch (innerError) {
            setError(getFriendlyError(innerError));
          } finally {
            setBusy(false);
          }
        },
        onFailed: (failureMessage) => {
          setError(failureMessage);
          setBusy(false);
        },
      });
    } catch (submitError) {
      setError(getFriendlyError(submitError));
      setBusy(false);
    }
  }

  async function handleSmsSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      const code = smsCode.replace(/\D/g, '');
      if (!verificationId || !/^\d{6}$/.test(code)) {
        throw new Error('Enter the 6-digit SMS code.');
      }
      const idToken = await confirmPhoneCode(verificationId, code);
      await completeDashMetSession(idToken);
    } catch (submitError) {
      setError(getFriendlyError(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (!firebaseIdToken) throw new Error('Phone verification expired. Please start again.');
      await startEmailLink(firebaseIdToken, email);
      setStep('email-code');
      setMessage('Check your DashMet account email for a 6-digit code.');
    } catch (submitError) {
      setError(getFriendlyError(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailCodeSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');

    try {
      if (!firebaseIdToken) throw new Error('Phone verification expired. Please start again.');
      const newSession = await verifyEmailLink(firebaseIdToken, email, emailCode);
      await saveMobileSession(newSession);
      setSession(newSession);
      setMessage('Phone linked and DashMet session started.');
      setPushStatus(await registerPushForSession(newSession.accessToken));
    } catch (submitError) {
      setError(getFriendlyError(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (!session) return;
    setBusy(true);
    setError('');

    try {
      await logoutMobileSession(session);
    } catch {
      // The local session must still be cleared when the network is unavailable.
    } finally {
      await signOutFirebasePhone();
      await clearMobileSession();
      setSession(null);
      setStep('phone');
      setPhone('');
      setSmsCode('');
      setEmail('');
      setEmailCode('');
      setVerificationId('');
      setFirebaseIdToken('');
      setPushStatus('');
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="screen center-screen">
        <section className="glass-panel compact">
          <div className="brand-mark">D</div>
          <p className="muted">Preparing DashMet...</p>
        </section>
      </main>
    );
  }

  if (session) {
    return (
      <main className="screen">
        <section className="glass-panel">
          <div className="brand-row">
            <div className="brand-mark">D</div>
            <div>
              <p className="eyebrow">DashMet Native</p>
              <h1>{session.user.firstName} {session.user.lastName}</h1>
            </div>
          </div>

          <div className="profile-grid">
            <div>
              <span>Email</span>
              <strong>{session.user.email}</strong>
            </div>
            <div>
              <span>Role</span>
              <strong>{session.user.role.replaceAll('_', ' ')}</strong>
            </div>
            <div>
              <span>API</span>
              <strong>{mobileConfig.apiBaseUrl.replace('/api', '')}</strong>
            </div>
          </div>

          {pushStatus && <p className="status success">{pushStatus}</p>}

          <button className="primary-button" onClick={handleLogout} disabled={busy}>
            {busy ? 'Signing out...' : 'Sign out'}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="screen">
      <section className="glass-panel">
        <div className="brand-row">
          <div className="brand-mark">D</div>
          <div>
            <p className="eyebrow">DashMet</p>
            <h1>Native sign in</h1>
          </div>
        </div>

        {!hasFirebaseClientConfig && (
          <p className="status warning">
            Firebase client config is missing from this mobile build environment.
          </p>
        )}

        {!nativePhoneAuthReady && (
          <p className="status warning">
            Open this screen from an Android or iOS build to use phone authentication.
          </p>
        )}

        {message && <p className="status success">{message}</p>}
        {error && <p className="status error">{error}</p>}

        {step === 'phone' && (
          <form onSubmit={handlePhoneSubmit} className="form-stack">
            <label>
              Phone number
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="+1 555 123 4567"
              />
            </label>
            <button className="primary-button" disabled={busy}>
              {busy ? 'Sending code...' : 'Send verification code'}
            </button>
          </form>
        )}

        {step === 'sms' && (
          <form onSubmit={handleSmsSubmit} className="form-stack">
            <label>
              SMS code
              <input
                value={smsCode}
                onChange={(event) => setSmsCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
              />
            </label>
            <button className="primary-button" disabled={busy}>
              {busy ? 'Verifying...' : 'Verify phone'}
            </button>
          </form>
        )}

        {step === 'email' && (
          <form onSubmit={handleEmailSubmit} className="form-stack">
            <label>
              DashMet account email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                inputMode="email"
                autoComplete="email"
                placeholder="name@company.com"
              />
            </label>
            <button className="primary-button" disabled={busy}>
              {busy ? 'Sending code...' : 'Send email code'}
            </button>
          </form>
        )}

        {step === 'email-code' && (
          <form onSubmit={handleEmailCodeSubmit} className="form-stack">
            <label>
              Email verification code
              <input
                value={emailCode}
                onChange={(event) => setEmailCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
              />
            </label>
            <button className="primary-button" disabled={busy}>
              {busy ? 'Linking phone...' : 'Link phone and sign in'}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
