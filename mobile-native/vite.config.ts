import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const mobileConfig = {
    apiBaseUrl:
      env.VITE_MOBILE_API_URL ||
      env.NEXT_PUBLIC_API_URL ||
      'https://dashmet-rca-api.onrender.com/api',
    firebase: {
      apiKey: env.VITE_FIREBASE_API_KEY || env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      projectId: env.VITE_FIREBASE_PROJECT_ID || env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      storageBucket:
        env.VITE_FIREBASE_STORAGE_BUCKET || env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId:
        env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
        env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
        '',
      appId: env.VITE_FIREBASE_APP_ID || env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
      measurementId:
        env.VITE_FIREBASE_MEASUREMENT_ID || env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
    },
  };

  return {
    plugins: [react()],
    define: {
      __DASHMET_MOBILE_CONFIG__: JSON.stringify(mobileConfig),
    },
    server: {
      port: 5174,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});
