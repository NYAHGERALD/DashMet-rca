# Cookie Policy

**Effective Date:** May 12, 2026
**Product:** DashMet Operations Intelligence / DashMet RCA Engine
**Version:** 1.0

This Cookie Policy explains how DashMet Operations Intelligence ("DashMet", "we", "us", or "our") uses cookies and similar technologies in the DashMet web application, mobile application, APIs, and related enterprise services.

DashMet is a private operations, food safety, workplace safety, root cause analysis, CAPA, bakery metrics, meeting, and collaboration platform used by authorized organizations and their invited users. The technologies described in this policy are used to operate the service, protect accounts, remember trusted devices, preserve user preferences, support mobile notifications, and enable collaboration features.

We do not use cookies for behavioral advertising or cross-site advertising tracking.

## 1. What Cookies and Similar Technologies Mean in DashMet

Cookies are small pieces of data stored by a browser when a user accesses a website. DashMet also uses similar technologies, including:

- Browser local storage, used for preferences, draft work, notification state, and interface settings.
- Browser session storage, used for temporary call/session state.
- Mobile secure storage, used by the DashMet mobile app to protect session, trusted-device, biometric-login, and push-notification information on the device.
- Push notification tokens, used to deliver authorized mobile alerts.
- Device and browser information, used for security, audit logging, trusted-device review, and abuse prevention.

These technologies are not all "cookies" in the strict browser sense, but they serve similar purposes: keeping the application secure, usable, and consistent for authorized users.

## 2. Why DashMet Uses Cookies and Similar Technologies

DashMet uses cookies and similar technologies for the following purposes:

- Authenticate users and maintain secure sessions.
- Protect against cross-site request forgery and unauthorized requests.
- Remember a private trusted device when the user chooses "Remember this device".
- Support email verification, account lockout, rate limiting, and security auditing.
- Preserve user preferences such as theme, language, timezone, side navigation state, and notification settings.
- Save draft work and autosave preferences for incident reports, RCA work, bakery metrics, workplace safety reports, and related forms.
- Support browser notifications, unread chat state, active team call state, and in-app notification history.
- Register mobile devices for push notifications when the user enables mobile alerts.
- Support mobile biometric unlock for a saved DashMet session when the user enables it.
- Enable team video calls, screen sharing, chat, meeting recordings, transcription, evidence uploads, and collaboration tools.
- Maintain service reliability, diagnose errors, prevent abuse, and support enterprise audit requirements.

## 3. Cookies Used by the DashMet Web Application

The DashMet web application uses the following first-party cookies for necessary authentication and security functions.

| Cookie Name | Type | Purpose | Typical Duration |
| --- | --- | --- | --- |
| `dashmet_access` | Strictly necessary authentication cookie | Keeps an authenticated user signed in during active use of the web app. This cookie is HTTP-only and is not readable by browser JavaScript. | About 15 minutes, refreshed during valid session activity. |
| `dashmet_refresh` | Strictly necessary authentication cookie | Allows the application to refresh the authenticated session without asking the user to sign in again during the permitted session period. This cookie is HTTP-only and is not readable by browser JavaScript. | About 7 days, subject to server session controls and logout. |
| `dashmet_csrf` | Strictly necessary security cookie | Helps protect authenticated requests from cross-site request forgery. The application reads this value and sends it back as an `X-CSRF-Token` header for protected requests. | About 7 days, subject to session renewal and logout. |
| `dashmet_trusted_device` | Strictly necessary trusted-device cookie | Used only when a user checks "Remember this device" after email verification. It helps DashMet recognize the same private browser/device and avoid repeated email verification when there is no security reason to challenge the user again. This cookie is HTTP-only and scoped to the login endpoint. | Default is about 30 days, unless changed by DashMet configuration, revoked, expired, or cleared. |

These cookies are required for the web application to function securely. If a browser blocks or deletes them, the user may be unable to sign in, may be asked to verify email again, or may lose trusted-device behavior.

## 4. Trusted Device and Email Verification

When a user signs in and email verification is required, DashMet may offer the option to remember the device. If the user checks "Remember this device", DashMet stores a secure trusted-device cookie and a matching server-side trusted-device record.

DashMet uses this trusted-device flow to reduce unnecessary email verification on private devices while keeping security controls in place. DashMet may still require email verification again when:

- The trusted-device cookie is missing, expired, invalid, or cleared.
- The server-side trusted-device record has expired or been revoked.
- The user logs in from a different browser or device.
- The user explicitly logs out and the trusted-device cookie is cleared.
- The user changes or resets a password.
- There are too many wrong password attempts, too many verification requests, account lockout activity, suspected session abuse, or another security signal.
- An administrator or security control revokes trusted devices.

Users should only select "Remember this device" on a private device they control.

## 5. Browser Local Storage and Session Storage

DashMet uses browser local storage and session storage to make the application usable and efficient. These values are stored on the user’s browser and are not used for advertising.

Examples include:

- Theme, language, translation, timezone, and sidebar preferences.
- RCA auto-save preference.
- Incident form auto-save preference.
- Workplace safety auto-save preference.
- Bakery metrics draft data and submit-readiness preference.
- Bakery metrics AI task completion state.
- Browser notification permission state and notification history.
- Chat unread counts and chat open/closed state.
- Temporary team call state while a call is active.

Local storage usually remains until the user clears browser data, uses browser privacy controls, changes browsers, or the application removes the value. Session storage is usually cleared when the browser tab or session ends.

If local storage is disabled or cleared, DashMet can still protect the account, but some preferences, drafts, notification state, and convenience features may reset.

## 6. Mobile App Secure Storage and Push Notification Tokens

The DashMet mobile app uses mobile secure storage rather than browser cookies for most mobile session and device features.

The mobile app may store:

- Access and refresh session tokens.
- Trusted-device token information used with the backend trusted-device flow.
- The last login email, to improve the sign-in experience.
- Biometric-login preference and the email associated with that preference.
- A mobile push notification token.
- A device installation identifier used to manage push notifications.
- Onboarding state and other app preferences.

Mobile session and trusted-device values are stored using secure device storage where available. Push notification tokens are registered only when the user enables mobile notifications and the operating system grants notification permission.

Users can manage mobile notification permission in iOS or Android settings. Logging out of DashMet clears the saved mobile session. Disabling notifications or uninstalling the app may remove or invalidate mobile notification tokens.

## 7. Browser and Mobile Notifications

DashMet supports browser notifications and mobile push notifications for operational workflows such as:

- LSW task reminders and overdue alerts.
- Bakery metrics submissions and exceptions.
- Incident activity.
- Team incident invitations.
- CAPA board creation.
- Issues reported.
- Other work, safety, and compliance reminders configured in DashMet.

Notification delivery uses the user’s browser notification permission, the mobile operating system notification permission, and DashMet notification preferences. Mobile push notifications may be delivered through Expo and Firebase Cloud Messaging/APNs infrastructure depending on the device and platform.

DashMet does not use notification tokens for advertising.

## 8. Video Calls, Screen Sharing, Recordings, and Collaboration

DashMet includes team collaboration features such as incident chat, video calling, screen sharing, meeting recordings, transcription, and evidence review.

For video calls, DashMet uses Daily.co to create private meeting rooms and meeting tokens for authorized users. When a user joins a call, the browser or Daily.co call frame may use temporary storage, device permissions, media session information, and related technologies needed to provide live audio, video, screen sharing, chat, and meeting controls.

For recordings and evidence storage, DashMet may store files in Firebase Storage or related cloud storage configured for the application. Recordings, transcripts, evidence, and collaboration records are linked to the relevant incident, meeting, RCA, or organization record according to DashMet permissions and retention controls.

## 9. Service Providers Related to Cookies and Similar Technologies

DashMet uses service providers to operate core platform features. These providers may process limited data necessary to deliver the requested service.

Depending on which features are enabled, DashMet may use:

- Render or other hosting infrastructure to run the web application, API, and related services.
- PostgreSQL database infrastructure to store application records.
- Firebase Admin, Firebase Storage, and Firebase messaging-related services for authentication support, file storage, recordings, and push notification infrastructure.
- Expo push notification services for mobile notification delivery.
- Daily.co for private team video calls, meeting tokens, audio, video, screen sharing, and call controls.
- Resend or configured email infrastructure for verification codes, invitations, alerts, reports, and service emails.
- Twilio, when configured, for SMS notifications or phone verification workflows.
- OpenAI, when an authorized user requests AI-powered features such as summaries, RCA assistance, transcription, recommendations, policy matching, or report generation.

These providers are used to deliver DashMet functionality. DashMet does not use these providers to place advertising cookies or to sell personal information.

## 10. Analytics, Advertising, and Sale or Sharing of Personal Information

DashMet does not currently use advertising cookies, retargeting pixels, or third-party behavioral advertising trackers in the application.

DashMet does not sell personal information.

DashMet does not use cookies to track users across unrelated websites for advertising.

If DashMet later adds analytics, advertising, or cross-site tracking technologies, this Cookie Policy should be updated before those technologies are used, and any required consent, opt-out, or Global Privacy Control handling should be implemented.

## 11. Security and Audit Logs

DashMet may collect and store security and audit information when users access the platform. This may include:

- IP address.
- Browser type and user-agent information.
- Device information.
- Session identifiers stored in hashed or protected form.
- Login success, login failure, email verification, trusted-device, lockout, password reset, and session refresh events.
- Timestamps and organization/user identifiers needed for audit trails.

This information is used for account security, abuse prevention, troubleshooting, enterprise auditability, and compliance support.

## 12. How Users Can Manage Cookies and Similar Technologies

Users can manage cookies through their browser settings. Users can also clear browser cookies, local storage, and site data for DashMet.

Important effects of blocking or clearing DashMet cookies:

- The user may be signed out.
- The browser may no longer be remembered as a trusted device.
- The user may need to complete email verification again.
- CSRF protection may prevent protected requests until a new security token is issued.
- Saved preferences, local drafts, notification state, and interface settings may reset.

Users can manage browser notifications through browser settings. Users can manage mobile notifications through iOS or Android notification settings. Users can also manage notification categories inside DashMet notification settings when those settings are available.

## 13. Organization Controls

DashMet is an enterprise application. A user’s organization may configure or control:

- Who is authorized to access DashMet.
- User roles and permissions.
- Notification settings and delivery channels.
- Meeting recording retention.
- Evidence, incident, RCA, CAPA, and compliance record retention.
- Trusted-device policy duration and limits.
- Security review, audit, and session-management requirements.

Users should contact their organization administrator if they need help understanding organization-specific settings.

## 14. Changes to This Cookie Policy

We may update this Cookie Policy when DashMet changes how it uses cookies, local storage, mobile secure storage, notifications, trusted-device features, video calling, recordings, or service providers.

When the policy is updated, the Effective Date and version should be updated. Material changes may also be communicated through the application, email, or administrator notice where appropriate.

## 15. Contact

Questions about this Cookie Policy should be directed to privacy@dashmet.com or submitted through DashMet Contact Support.
