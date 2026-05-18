# Security Policy

**Effective Date:** May 12, 2026
**Product:** DashMet Operations Intelligence / DashMet RCA Engine
**Version:** 1.0

This Security Policy explains how **404UPDATE**, operating DashMet Operations Intelligence and DashMet RCA Engine ("DashMet", "we", "us", or "our"), protects the DashMet web application, mobile application, APIs, notifications, reporting tools, collaboration tools, and related services (collectively, the "Services").

DashMet is a private enterprise operations, food safety, workplace safety, root cause analysis, CAPA, bakery metrics, meeting, evidence, and collaboration platform. Security is designed into the Services to protect authorized organizations, users, incident records, evidence, production metrics, notifications, recordings, transcripts, and administrative workflows.

This policy is intended to give customers, users, administrators, and app store reviewers a clear summary of DashMet’s security practices. It does not disclose confidential system architecture, secrets, private keys, credentials, source code, internal network details, or operational procedures that could weaken the security of the Services.

## 1. Security Program Overview

DashMet uses administrative, technical, and operational safeguards to protect the Services and the information processed through them. Our security approach is based on practical enterprise security principles, including:

- Protecting accounts and sessions from unauthorized access.
- Limiting access to information based on organization, role, permissions, and workflow participation.
- Using secure-by-default authentication and session controls.
- Reducing unnecessary collection, storage, and exposure of sensitive information.
- Preserving auditability for important business, compliance, and security events.
- Monitoring for misuse, failed access attempts, and operational issues.
- Reviewing third-party service providers used to deliver DashMet functionality.
- Maintaining incident response procedures for suspected security events.

DashMet’s security practices are risk-based and designed to evolve as the product, customers, regulatory expectations, and threat environment change.

## 2. Scope of This Policy

This Security Policy applies to the DashMet Services, including:

- Web application access.
- Mobile application access.
- Backend APIs.
- Account authentication and trusted-device workflows.
- Incident, RCA, CAPA, bakery metrics, workplace safety, issue, and investigation workflows.
- Evidence uploads, photos, videos, documents, voice notes, meeting recordings, transcripts, and summaries.
- Team chat, discussions, video calls, screen sharing, and collaboration features.
- Browser notifications, mobile push notifications, and service emails.
- Administrative controls, organization settings, role privileges, audit logs, and policy documents.

This policy does not apply to external websites, networks, devices, or services that are not controlled by DashMet, except where those services are used by DashMet as service providers to deliver the Services.

## 3. Account and Authentication Security

DashMet is designed for authorized business users. Access to the Services requires an account that is invited, approved, or otherwise authorized by an organization or by DashMet.

DashMet may use the following account protection controls:

- Password-based authentication.
- Email verification codes when additional sign-in verification is required.
- Trusted-device recognition when a user chooses to remember a private device.
- Account lockout and rate limiting for repeated failed login or verification attempts.
- Session management and refresh controls.
- Logout and session revocation.
- Password reset and password change controls.
- Administrative access restrictions based on role and account status.

Users should use strong, unique passwords and should not share accounts. Administrators should remove access promptly when a user no longer needs DashMet.

## 4. Trusted Devices and Email Verification

DashMet may allow a user to mark a private device as trusted after successful verification. Trusted-device controls are intended to reduce repeated verification prompts on the same private device while maintaining protection when the user signs in from a new, changed, expired, revoked, or suspicious device context.

DashMet may still require email verification when a trusted device is missing, expired, invalid, revoked, or when security controls detect risk signals such as unusual access behavior, repeated failed attempts, password changes, password resets, account lockout activity, or administrative revocation.

Users should select "Remember this device" only on a private device they control. Shared, public, borrowed, or kiosk devices should not be remembered.

## 5. Session and Browser Security

The DashMet web application uses secure session practices designed to protect authenticated users and reduce common web risks.

These practices may include:

- Authentication cookies that are protected from direct browser script access where appropriate.
- Secure cookie settings in production environments.
- Cross-site request forgery protection for protected requests.
- Short-lived access sessions supported by controlled refresh behavior.
- Session expiration, logout, and server-side session revocation.
- No-store cache headers for sensitive API responses.
- Browser permission controls that restrict unnecessary device capabilities unless a feature requires explicit user permission.

If a browser blocks or clears required cookies or site data, the user may be signed out, may need to verify again, or may lose trusted-device behavior.

## 6. Mobile App Security

The DashMet mobile application uses mobile platform protections to help protect the user’s session and device-specific preferences.

The mobile app may use secure device storage for session tokens, trusted-device information, push notification registration, last-login convenience information, onboarding state, and biometric-login preferences.

Biometric unlock, including Face ID, Touch ID, or fingerprint unlock, is handled by the device operating system. DashMet does not receive, store, or process biometric templates. Biometrics are used only as a device-level unlock convenience for an already authorized DashMet session or trusted login flow.

Mobile features may require user permission for camera, photos, microphone, notifications, or local authentication. Users can manage these permissions through iOS or Android settings.

## 7. Role-Based Access and Organization Isolation

DashMet uses organization scoping and role-based access controls to limit what users can see and do inside the Services.

Access decisions may consider:

- The user’s organization.
- The user’s role.
- Feature-level privileges configured by administrators.
- Whether the user created, owns, or is assigned to a record.
- Whether the user is a participant in an incident, meeting, RCA, CAPA, issue, or workflow.
- Record visibility settings, such as private, team, or public organization visibility.

Users should only access records and features that are necessary for their authorized business responsibilities.

## 8. Data Protection

DashMet is designed to protect operational, safety, quality, compliance, and collaboration data processed through the Services.

DashMet may process:

- User account and organization information.
- Incident and RCA records.
- CAPA records and action items.
- Bakery metrics and production performance data.
- Workplace safety and investigation records.
- Evidence files, photos, videos, documents, and voice notes.
- Team chat, discussions, meeting recordings, transcripts, and summaries.
- Notification preferences, push notification tokens, and delivery records.
- Audit logs, security events, and support records.

DashMet uses access controls, secure transport, provider security controls, retention controls, and operational safeguards to protect this information. Sensitive content should be uploaded only when it is necessary for an authorized DashMet workflow.

## 9. Evidence, Recordings, and Collaboration Security

DashMet includes collaboration features such as team calls, screen sharing, chat, discussions, evidence review, meeting recordings, transcription, and meeting summaries.

These features are designed for authorized workspaces and workflow participants. Meeting rooms, call access, recordings, transcripts, summaries, and evidence records are associated with the relevant organization and workflow context.

Evidence and recording features should be used only with proper authorization and consent. Users and organizations are responsible for following workplace policies, privacy laws, recording laws, labor obligations, confidentiality obligations, and applicable regulatory requirements when recording, uploading, sharing, or retaining content.

## 10. Notifications and Messaging Security

DashMet may send email, browser, and mobile push notifications for authorized operational workflows such as:

- Account verification and password reset.
- Incident creation and team incident activity.
- Team member invitations.
- CAPA board creation.
- Issues reported.
- Bakery metrics submissions and performance exceptions.
- Task reminders, overdue alerts, and follow-up notifications.

Push notification tokens are used to deliver DashMet notifications to authorized devices and are not used for advertising. Notification delivery depends on user preferences, organization settings, browser permissions, mobile operating system permissions, network availability, and third-party provider availability.

Users should avoid including unnecessary sensitive information in notification-visible fields where another person could see the device screen.

## 11. AI-Assisted Feature Security

DashMet may provide AI-assisted features for summaries, RCA assistance, CAPA suggestions, recommendations, policy matching, transcription, report drafting, and operational insights.

AI-assisted features are designed to support authorized users, not replace professional judgment. Users and organizations are responsible for reviewing AI output before relying on it for food safety, workplace safety, compliance, legal, operational, employment, or regulatory decisions.

DashMet does not use AI features for behavioral advertising. Data may be processed by service providers only as needed to deliver the requested feature, support the Services, maintain security, or comply with applicable obligations.

## 12. Audit Logging and Monitoring

DashMet supports auditability for important application, organization, and security events. Audit records may include user, organization, action, entity, timestamp, IP address, user-agent, and change details where appropriate.

Audit logs may be used to:

- Support compliance and administrative review.
- Investigate suspected unauthorized access.
- Diagnose operational problems.
- Monitor account activity and workflow changes.
- Support incident response.

Access to audit information is limited based on role, organization, and administrative permissions.

## 13. Service Providers and Infrastructure

DashMet uses selected third-party providers to deliver the Services. Depending on the features enabled, service providers may support:

- Application hosting and backend infrastructure.
- Database services.
- File storage and evidence storage.
- Mobile push notifications.
- Browser or mobile notification delivery.
- Email delivery.
- SMS or phone verification workflows when configured.
- Video calling, screen sharing, and meeting controls.
- AI-assisted processing, transcription, summarization, or recommendations.

DashMet uses these providers to operate product functionality, not to sell personal information or provide behavioral advertising. Provider access and processing are limited to what is needed to deliver, secure, support, and maintain the Services.

## 14. Secure Development and Change Management

DashMet security is considered during product design, development, implementation, and maintenance.

Our development practices may include:

- Reviewing authentication, authorization, and data access boundaries.
- Reducing unnecessary sensitive data exposure in user interfaces, APIs, logs, and documentation.
- Using environment-based configuration for secrets and service credentials.
- Avoiding publication of secrets, private keys, access tokens, and production credentials.
- Reviewing code changes before deployment when appropriate.
- Testing security-sensitive workflows before release.
- Updating security controls as risks, product features, and customer requirements evolve.

No public policy can describe every internal control in detail. DashMet intentionally avoids publishing information that would make attacks easier.

## 15. Vulnerability Reporting

If you believe you have found a security vulnerability in DashMet, please report it responsibly.

You may contact DashMet at **support@dashmet.com** with the subject line **Security Report**, or submit the issue through DashMet Contact Support.

When reporting a security concern, please include:

- A clear description of the issue.
- Steps to reproduce the issue, if available.
- The affected page, API, workflow, or mobile screen.
- Any relevant screenshots, logs, timestamps, browser/device information, or account context.
- Your contact information so we can follow up if needed.

Please do not:

- Access, modify, delete, download, or disclose data that does not belong to you.
- Attempt to disrupt DashMet, degrade service availability, or bypass rate limits.
- Use social engineering, phishing, malware, credential stuffing, spam, or denial-of-service techniques.
- Publicly disclose the issue before DashMet has had a reasonable opportunity to investigate and address it.

DashMet will review good-faith reports and take action based on severity, exploitability, customer impact, and operational risk.

## 16. Security Incident Response

DashMet maintains procedures for reviewing suspected security incidents. Depending on the nature of the event, response actions may include:

- Investigating the reported or detected activity.
- Containing unauthorized access.
- Revoking sessions, trusted devices, tokens, or credentials.
- Restricting accounts or permissions.
- Preserving relevant logs and records.
- Applying fixes or configuration changes.
- Notifying affected organizations, users, service providers, or authorities when required.

The timing and content of notifications will depend on the facts of the incident, applicable law, contractual obligations, and the information available during the investigation.

## 17. Customer and User Responsibilities

Security is a shared responsibility. Organizations and users are responsible for using DashMet safely and according to their internal policies.

Organizations should:

- Invite only authorized users.
- Assign roles and privileges based on business need.
- Review user access regularly.
- Remove or suspend users who no longer need access.
- Train users on incident reporting, evidence handling, privacy, and recording obligations.
- Configure notification and retention settings appropriately.
- Review records, AI outputs, reports, and exports before relying on them.
- Maintain secure devices, browsers, email accounts, and networks used to access DashMet.

Users should:

- Use strong, unique passwords.
- Protect their email account and mobile device.
- Use trusted-device and biometric features only on private devices.
- Log out from shared devices.
- Avoid uploading unnecessary personal, confidential, or regulated information.
- Report suspected unauthorized access or security concerns promptly.

## 18. No Guarantee of Absolute Security

DashMet works to protect the Services using reasonable administrative, technical, and operational safeguards. However, no application, network, device, service provider, or method of electronic storage or transmission can be guaranteed to be completely secure.

Users and organizations should maintain their own security, backup, business continuity, compliance, and incident response procedures in addition to using DashMet’s built-in controls.

## 19. Changes to This Security Policy

DashMet may update this Security Policy as our Services, security practices, providers, legal obligations, or customer requirements change.

When this policy is updated, the Effective Date and version should be updated. Material changes may also be communicated through the Services, email, administrator notice, or another reasonable method.

## 20. Contact

Questions about this Security Policy or security concerns should be directed to:

**404UPDATE**
Email: **support@dashmet.com**
Privacy: **privacy@dashmet.com**

Security concerns may be submitted through DashMet Contact Support or emailed to **support@dashmet.com** with the subject line **Security Report**.
