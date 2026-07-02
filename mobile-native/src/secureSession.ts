import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import type { MobileSession } from './types';

const SESSION_KEY = 'dashmet.mobile.session';

export async function saveMobileSession(session: MobileSession): Promise<void> {
  await SecureStoragePlugin.set({
    key: SESSION_KEY,
    value: JSON.stringify(session),
  });
}

export async function loadMobileSession(): Promise<MobileSession | null> {
  try {
    const result = await SecureStoragePlugin.get({ key: SESSION_KEY });
    return JSON.parse(result.value) as MobileSession;
  } catch {
    return null;
  }
}

export async function clearMobileSession(): Promise<void> {
  try {
    await SecureStoragePlugin.remove({ key: SESSION_KEY });
  } catch {
    // Missing keys are harmless during logout and first launch.
  }
}
