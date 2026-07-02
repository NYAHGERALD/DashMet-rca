# DashMet Native Mobile Architecture

## Decision

DashMet keeps two client surfaces with a controlled handoff between them:

- `frontend/`: the existing Next.js web app served at `www.dashmet.com`.
- `mobile-native/`: the bundled Capacitor native app for Android and iOS.

The native package owns the native-only responsibilities: Firebase phone
authentication, secure local token storage, and push registration. After native
login succeeds, it opens the existing DashMet web UI through a short-lived,
one-time backend handoff. This preserves the browser web app while allowing the
installed Android/iOS app to run the same enterprise workflow UI.

Hosted WebView mode is still treated as a temporary smoke-test build only. The
production app should start from the bundled native login shell, then enter the
web UI through the secure handoff.

## Security Model

Firebase Authentication proves phone-number ownership. DashMet still owns
authorization, organization membership, roles, departments, sessions, audit logs,
and push-notification registration.

The native app never trusts user IDs, Firebase UIDs, phone numbers, or emails
from its own request body for authorization. The backend derives identity from
the verified Firebase ID token:

1. Native app requests phone OTP through Firebase native SDK.
2. Firebase returns a signed ID token after SMS verification.
3. Native app sends that ID token to `POST /api/mobile/session/firebase`.
4. Node backend verifies the token with Firebase Admin.
5. Backend finds the DashMet user by linked `firebaseUid` or verified phone hash.
6. Backend issues normal DashMet access and refresh tokens.
7. Native app stores DashMet tokens in the OS secure store.
8. All protected API calls use `Authorization: Bearer <dashmet-access-token>`.

If the Firebase phone is not linked to a DashMet account, the native app asks for
the DashMet account email and uses the existing email OTP channel:

1. Native app sends email to `POST /api/mobile/session/email-link/start` with the
   Firebase ID token.
2. Backend sends a generic response to avoid account enumeration.
3. User enters the email OTP.
4. Native app calls `POST /api/mobile/session/email-link/verify`.
5. Backend verifies the OTP, links the Firebase UID and phone hash to the user,
   then issues a DashMet mobile session.

## Token Storage

Native access and refresh tokens are stored with secure native storage:

- Android: AndroidKeyStore-backed encrypted storage.
- iOS: Keychain-backed storage.
- Browser fallback is not considered secure and is used only for local UI preview.

The existing web app continues using cookie sessions and CSRF protection.

## Native-to-Web Handoff

The native app never passes DashMet access or refresh tokens in a URL. It uses a
one-time handoff code:

1. Native phone login creates a DashMet mobile session.
2. Native app calls `POST /api/mobile/session/web-handoff` with its bearer token.
3. Backend stores only a SHA-256 hash of a random handoff code with a two-minute
   expiry.
4. Native app opens `https://www.dashmet.com/mobile-session?code=...`.
5. The web page calls `POST /api/mobile/session/web-handoff/redeem`.
6. Backend marks the handoff used, creates a normal web cookie session, sets the
   existing HttpOnly auth cookies plus CSRF cookie, and redirects the user to the
   web dashboard.

When the web UI is running inside the installed app, `/mobile-session` stores a
validated native return URL. Web logout clears the web cookies and returns to the
bundled native sign-in screen with `nativeSignedOut=1`, allowing the native app
to clear its secure mobile session too.

## Push Notifications

Push registration happens only after a DashMet session exists:

1. Native app requests notification permission.
2. Capacitor returns the FCM/APNs-facing device token.
3. Native app sends it to `POST /api/mobile/push/device-token`.
4. Backend associates the token with the authenticated DashMet user.
5. Logout unregisters/clears the local token state before clearing the session.

The backend already supports FCM and Expo-style token providers. iOS production
push should be validated with the selected provider path before App Store release.

## Native Runtime

The production native package uses:

- Node 22
- Capacitor 8
- `@capacitor-firebase/authentication` 8.x
- Firebase JS/native SDK 12.x
- Vite 8

This is intentionally isolated from the Next.js web frontend so modern native
SDK requirements do not force a risky upgrade of the browser application.

## Firebase Console Setup

Required before real device phone-login testing:

- Enable Firebase Phone Authentication.
- Add Android app package: `com.dashmet.operations`.
- Add Android SHA-1 and SHA-256 fingerprints for the debug/release keystores.
- Download `google-services.json` into `mobile-native/android/app/`.
- Add iOS bundle id: `com.dashmet.operations`.
- Download `GoogleService-Info.plist` into `mobile-native/ios/App/App/`.
- Configure iOS URL schemes and APNs/Auth settings required by Firebase.

Firebase public client config values are not secrets, but service-account
credentials remain backend-only and must never ship in the native app.

## Build Modes

Production/native build:

```bash
cd mobile-native
nvm use 22.22.2
npm install
npm run build
npm run cap:sync
```

Android debug APK:

```bash
cd mobile-native/android
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ./gradlew assembleDebug
```

Hosted web smoke test, preview only:

```bash
CAPACITOR_WEB_MODE=hosted CAPACITOR_SERVER_URL=https://www.dashmet.com npx cap sync android
```

Do not release hosted mode as the production native app.

## Deployment Boundary

The web app and native app share the Node API, database, Firebase project, and
push infrastructure. They do not share runtime packaging:

- Web deploys to the existing web host.
- Backend deploys to the existing Node API host.
- Native builds ship through APK/TestFlight/App Store/Play Store channels.

This keeps the web app available to browser users while allowing Android and iOS
users to install a native app with secure storage, native phone auth, and native
push notification registration.
