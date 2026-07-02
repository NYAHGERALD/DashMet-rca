type MobileRuntimeConfig = {
  apiBaseUrl: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId: string;
  };
};

declare const __DASHMET_MOBILE_CONFIG__: MobileRuntimeConfig;

export const mobileConfig: MobileRuntimeConfig = __DASHMET_MOBILE_CONFIG__;

export const hasFirebaseClientConfig = Boolean(
  mobileConfig.firebase.apiKey &&
    mobileConfig.firebase.authDomain &&
    mobileConfig.firebase.projectId &&
    mobileConfig.firebase.appId
);
