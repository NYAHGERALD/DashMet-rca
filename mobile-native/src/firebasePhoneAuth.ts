import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';

type PhoneCodeSentEvent = {
  verificationId: string;
};

type PhoneVerificationFailedEvent = {
  message?: string;
};

type PhoneAuthCallbacks = {
  onCodeSent: (verificationId: string) => void;
  onAutoVerified: (firebaseIdToken: string) => void;
  onFailed: (message: string) => void;
};

let activeListeners: PluginListenerHandle[] = [];

async function removePhoneAuthListeners() {
  await Promise.all(activeListeners.map((listener) => listener.remove().catch(() => undefined)));
  activeListeners = [];
}

export function isNativePhoneAuthAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

export async function startPhoneSignIn(
  phoneNumber: string,
  callbacks: PhoneAuthCallbacks
): Promise<void> {
  await removePhoneAuthListeners();

  const [codeSent, autoVerified, failed] = await Promise.all([
    FirebaseAuthentication.addListener('phoneCodeSent', (event: PhoneCodeSentEvent) => {
      callbacks.onCodeSent(event.verificationId);
    }),
    FirebaseAuthentication.addListener('phoneVerificationCompleted', async () => {
      try {
        const result = await FirebaseAuthentication.getIdToken({ forceRefresh: true });
        callbacks.onAutoVerified(result.token);
      } catch {
        callbacks.onFailed('Phone verification completed, but the Firebase token could not be read.');
      }
    }),
    FirebaseAuthentication.addListener('phoneVerificationFailed', (event) => {
      callbacks.onFailed(event.message || 'Phone verification failed.');
    }),
  ]);

  activeListeners = [codeSent, autoVerified, failed];
  await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber });
}

export async function confirmPhoneCode(
  verificationId: string,
  verificationCode: string
): Promise<string> {
  await FirebaseAuthentication.confirmVerificationCode({
    verificationId,
    verificationCode,
  });
  const result = await FirebaseAuthentication.getIdToken({ forceRefresh: true });
  return result.token;
}

export async function signOutFirebasePhone(): Promise<void> {
  await removePhoneAuthListeners();
  try {
    await FirebaseAuthentication.signOut();
  } catch {
    // Local DashMet session cleanup should still continue if Firebase sign-out
    // cannot run because the native plugin has not been installed yet.
  }
}
