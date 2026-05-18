import api from './api';

type TrustedDeviceLoginResponse = {
  trustedDeviceRemembered?: boolean;
  trustedDevice?: {
    remembered?: boolean;
  };
};

const TRUSTED_DEVICE_COOKIE_ERROR =
  'Sign-in was verified, but this browser did not save the trusted-device cookie. Enable cookies for DashMet and use the same web address, then verify again.';

export async function assertWebTrustedDeviceRemembered(
  requested: boolean,
  loginResponseData: TrustedDeviceLoginResponse
) {
  if (!requested) return;

  const serverRemembered =
    loginResponseData.trustedDeviceRemembered === true ||
    loginResponseData.trustedDevice?.remembered === true;

  if (!serverRemembered) {
    throw new Error(
      'Sign-in was verified, but the server could not create a trusted-device record. Please try again or contact support.'
    );
  }

  const statusResponse = await api.get('/auth/login/trusted-device-status', {
    params: { _: Date.now() },
  });

  if (statusResponse.data?.trustedDevice?.trusted !== true) {
    throw new Error(TRUSTED_DEVICE_COOKIE_ERROR);
  }
}
