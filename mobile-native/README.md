# DashMet Native Mobile

Production Capacitor app for Android and iOS.

This package is intentionally separate from `frontend/` so Capacitor 8, native
Firebase authentication, and native secure-storage dependencies do not force a
runtime upgrade of the existing Next.js web app.

After native phone sign-in succeeds, the app requests a short-lived backend
handoff code and opens the existing DashMet web UI. Tokens are not placed in the
URL; the web app redeems the code for its normal secure cookie session.

## Requirements

```bash
nvm use 22.22.2
npm install
cp .env.example .env.local
```

Fill `.env.local` with the public Firebase client config, API URL, and web app
URL for the environment being tested.

## Development

```bash
npm run dev
```

Browser preview is only for UI checks. Phone authentication and push
notifications must be tested in Android/iOS builds.

## Native Sync

```bash
npm run cap:sync
```

## Android Debug Build

```bash
cd android
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew assembleDebug
```

APK output:

```text
mobile-native/android/app/build/outputs/apk/debug/app-debug.apk
```

## Required Firebase Files

Real phone authentication requires native Firebase project files:

- `mobile-native/android/app/google-services.json`
- `mobile-native/ios/App/App/GoogleService-Info.plist`

Also add Android debug/release SHA-1 and SHA-256 fingerprints in Firebase
Console for package `com.dashmet.operations`.

Do not put Firebase Admin/service-account credentials in this package.

## Hosted Mode

Hosted mode is only for smoke testing:

```bash
CAPACITOR_WEB_MODE=hosted CAPACITOR_SERVER_URL=https://www.dashmet.com npx cap sync android
```

Production native releases must use bundled assets.
