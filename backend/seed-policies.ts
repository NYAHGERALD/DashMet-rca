import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type PolicyType = 'PRIVACY_POLICY' | 'TERMS_OF_SERVICE' | 'COOKIE_POLICY' | 'SECURITY';

async function seedPolicies() {
  console.log('📄 Seeding professional policy documents...\n');

  const now = new Date();
  const effectiveDate = now.toISOString().slice(0, 10);

  const policies: Array<{ type: PolicyType; title: string; content: string }> = [
    {
      type: 'PRIVACY_POLICY',
      title: 'Privacy Policy',
      content: `# Privacy Policy

**Effective Date:** ${effectiveDate}
**Last Updated:** ${effectiveDate}

DASHMET RCA ("DASHMET," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Root Cause Analysis and Incident Management platform (the "Platform").

---

## 1. Information We Collect

### 1.1 Account Information
When you register or are provisioned an account, we collect:
- Full name and email address
- Employee ID and job title
- Department and organizational affiliation
- Role and access permissions
- Profile preferences (language, theme, timezone)

### 1.2 Incident and Investigation Data
Through normal use of the Platform, we process:
- Incident reports including descriptions, dates, locations, and classifications
- Root cause analysis data (5 Whys, Fishbone diagrams, investigation findings)
- Corrective and preventive action (CAPA) records
- Evidence and attachments (documents, images, reports)
- Witness statements and interview notes
- Investigation timelines and audit trails

### 1.3 Workplace Safety Information
For workplace safety incidents, we may collect:
- Injury and illness details
- Body parts affected and medical treatment information
- Equipment and environmental conditions
- PPE usage and safety protocol compliance
- Near-miss and hazard reports

### 1.4 Automatically Collected Information
We automatically collect:
- Device information (browser type, operating system, screen resolution)
- Access logs (login times, IP addresses, pages visited)
- Feature usage analytics and interaction patterns
- Error logs and performance data

### 1.5 Communication Data
- In-platform messages and chat communications
- Support requests and feedback
- Email notifications and preferences

---

## 2. How We Use Your Information

We use collected information to:

**Provide Core Services**
- Authenticate users and manage access permissions
- Enable incident reporting and root cause analysis workflows
- Generate investigation reports and compliance documentation
- Facilitate team collaboration and communication
- Track corrective actions and preventive controls

**Improve the Platform**
- Analyze usage patterns to enhance features
- Identify and fix technical issues
- Develop new capabilities based on user needs
- Optimize performance and reliability

**Ensure Safety and Compliance**
- Maintain audit trails for regulatory compliance
- Support workplace safety programs and reporting requirements
- Enable trend analysis for safety improvements
- Generate required regulatory reports (OSHA, internal audits)

**Communicate With You**
- Send service notifications and updates
- Provide customer support
- Alert you to assigned tasks and deadlines
- Deliver training and onboarding information

---

## 3. AI-Assisted Features

DASHMET RCA includes AI-powered features to assist with:
- Automated 5 Whys analysis suggestions
- Root cause identification and validation
- Corrective action recommendations
- Investigation report generation

**Important AI Disclosures:**
- AI suggestions are provided as assistance only and require human review
- AI-generated content should be validated by qualified personnel
- Your data may be processed by AI models to provide suggestions
- AI features can be disabled by organization administrators
- We do not use your incident data to train general AI models

---

## 4. Data Sharing and Disclosure

### 4.1 Within Your Organization
- Data is shared with authorized users within your organization based on role permissions
- Organization administrators can access usage reports and audit logs
- Supervisors can view incidents and investigations they are assigned to

### 4.2 Service Providers
We engage trusted third parties to help operate the Platform:
- Cloud hosting and infrastructure (data storage and processing)
- Authentication services (Firebase Authentication)
- Email delivery services (notifications and alerts)
- Analytics providers (usage insights)

All service providers are contractually bound to protect your data and use it only for specified purposes.

### 4.3 Legal Requirements
We may disclose information:
- To comply with applicable laws, regulations, or legal processes
- To respond to lawful requests from public authorities
- To protect our rights, privacy, safety, or property
- To enforce our terms and agreements

### 4.4 Business Transfers
In the event of a merger, acquisition, or sale of assets, user data may be transferred to the acquiring entity with continued protection under this policy.

**We do not sell your personal information.**

---

## 5. Data Retention

We retain your information according to the following guidelines:

| Data Type | Retention Period |
|-----------|------------------|
| Account information | Duration of account plus 30 days after deletion |
| Incident records | As configured by organization (typically 7 years for compliance) |
| Investigation data | As configured by organization (typically 7 years for compliance) |
| Audit logs | 7 years minimum for regulatory compliance |
| Communication data | 2 years or as required by organization |
| Analytics data | 2 years in aggregate form |

Organizations may configure longer retention periods based on regulatory requirements. Data can be exported before deletion upon request.

---

## 6. Data Security

We implement comprehensive security measures:

**Technical Safeguards**
- TLS encryption for all data in transit
- Encryption at rest for sensitive data
- Secure token-based authentication (JWT)
- Regular security assessments and penetration testing

**Access Controls**
- Role-based access control (RBAC)
- Multi-tenant data isolation
- Session management and automatic timeouts
- Audit logging of all data access

**Operational Security**
- Employee security training
- Incident response procedures
- Regular backup and disaster recovery testing
- Vulnerability management program

---

## 7. Your Rights and Choices

Depending on your location, you may have rights to:

**Access** – Request a copy of your personal data
**Correction** – Update inaccurate or incomplete information
**Deletion** – Request deletion of your data (subject to retention requirements)
**Portability** – Receive your data in a structured format
**Restriction** – Limit how we process your data
**Objection** – Object to certain processing activities

**To exercise your rights:**
1. Contact your organization administrator for data managed by your organization
2. Submit a request through the Platform's support feature
3. Email our privacy team (contact information available in the Platform)

Note: Some requests may be subject to legal retention requirements or legitimate business needs.

---

## 8. International Data Transfers

If your data is transferred to countries outside your jurisdiction, we ensure appropriate safeguards are in place, including:
- Standard Contractual Clauses approved by relevant authorities
- Data processing agreements with recipients
- Compliance with applicable transfer regulations

---

## 9. Children's Privacy

DASHMET RCA is designed for business use and is not intended for individuals under 18 years of age. We do not knowingly collect information from children.

---

## 10. Changes to This Policy

We may update this Privacy Policy periodically. We will:
- Update the "Last Updated" date at the top
- Notify users of material changes through the Platform
- Maintain previous versions for reference

Continued use of the Platform after changes constitutes acceptance of the updated policy.

---

## 11. Contact Us

For privacy-related questions or concerns:

**Organization-Level Inquiries:** Contact your organization administrator through the Platform

**Platform Support:** Use the in-app support request feature

**Data Protection Inquiries:** Submit a request through the Platform's privacy settings

---

*This Privacy Policy is provided for informational purposes. Your organization may have additional privacy requirements and policies that apply to your use of the Platform.*
`,
    },
    {
      type: 'TERMS_OF_SERVICE',
      title: 'Terms of Service',
      content: `# Terms of Service

**Effective Date:** ${effectiveDate}
**Last Updated:** ${effectiveDate}

These Terms of Service ("Terms") constitute a legally binding agreement between you and DASHMET RCA ("DASHMET," "we," "us," or "our") governing your access to and use of the DASHMET RCA platform and related services (collectively, the "Platform").

**By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, do not use the Platform.**

---

## 1. Definitions

**"Customer"** means the organization that has contracted with DASHMET for access to the Platform.

**"User"** means any individual authorized by a Customer to access the Platform.

**"Content"** means any data, text, files, images, reports, or other materials submitted to or generated through the Platform.

**"Services"** means the root cause analysis, incident management, and related features provided through the Platform.

---

## 2. Account Registration and Access

### 2.1 Authorization
- Access to the Platform requires authorization from a Customer organization
- You must be designated by your organization's administrator to receive access
- You must provide accurate information when creating your account

### 2.2 Account Security
You are responsible for:
- Maintaining the confidentiality of your login credentials
- All activities that occur under your account
- Immediately notifying your administrator of any unauthorized access
- Using strong passwords and following security best practices

### 2.3 Access Codes
- Some features may require organization-specific access codes
- Access codes must be kept confidential within your organization
- Sharing access codes outside your organization is prohibited

---

## 3. Acceptable Use

### 3.1 Permitted Uses
You may use the Platform to:
- Report and investigate incidents within your organization
- Conduct root cause analysis using provided methodologies
- Collaborate with authorized team members
- Generate reports and track corrective actions
- Access training and reference materials

### 3.2 Prohibited Activities
You agree NOT to:
- Access the Platform without proper authorization
- Share login credentials or access codes with unauthorized persons
- Attempt to access data belonging to other organizations
- Upload malicious software, viruses, or harmful code
- Reverse engineer, decompile, or disassemble the Platform
- Use the Platform for any unlawful purpose
- Interfere with or disrupt Platform operations
- Circumvent security measures or access controls
- Scrape, harvest, or collect data through automated means
- Use AI features to generate misleading or fabricated investigation data
- Submit false incident reports or investigation findings
- Impersonate other users or misrepresent your identity

### 3.3 Content Standards
All Content you submit must:
- Be accurate and truthful to the best of your knowledge
- Comply with applicable laws and regulations
- Not infringe on intellectual property rights of others
- Not contain discriminatory, harassing, or offensive material
- Be appropriate for a professional business environment

---

## 4. Intellectual Property

### 4.1 Platform Ownership
DASHMET and its licensors retain all right, title, and interest in:
- The Platform and all related software
- Our trademarks, logos, and branding
- Platform documentation and training materials
- AI models and analytical methodologies

### 4.2 Customer Data
- Customers retain ownership of their organizational data
- You retain ownership of Content you create (subject to your organization's policies)
- By using the Platform, you grant us a license to process your Content solely to provide the Services

### 4.3 Feedback
If you provide suggestions or feedback about the Platform, we may use such feedback without obligation to you.

---

## 5. AI-Assisted Features

### 5.1 Nature of AI Assistance
- AI features provide suggestions and recommendations only
- AI-generated content requires human review and validation
- AI suggestions should not replace professional judgment

### 5.2 User Responsibility
You acknowledge that:
- You are responsible for reviewing and validating AI suggestions
- AI outputs may contain errors or inaccuracies
- Final decisions in investigations remain with qualified personnel
- AI-assisted analysis does not constitute professional advice

### 5.3 AI Limitations
We do not guarantee that AI features will:
- Identify all relevant root causes
- Provide complete or accurate suggestions
- Be available at all times
- Meet specific regulatory requirements

---

## 6. Data Protection and Privacy

### 6.1 Data Processing
- We process data in accordance with our Privacy Policy
- Customer data is logically separated by organization
- We implement security measures to protect data

### 6.2 Data Ownership
- Customer organizations own and control their data
- Users should follow their organization's data handling policies
- Data export capabilities are available to authorized administrators

### 6.3 Compliance
- Customers are responsible for ensuring their use complies with applicable laws
- We provide features to support compliance but do not guarantee regulatory compliance
- Industry-specific requirements (OSHA, etc.) are the Customer's responsibility

---

## 7. Service Levels and Availability

### 7.1 Availability
- We strive to maintain high Platform availability
- Scheduled maintenance will be communicated in advance when possible
- We do not guarantee uninterrupted or error-free service

### 7.2 Modifications
We may:
- Update, modify, or discontinue features with reasonable notice
- Release new versions and require updates
- Change these Terms with notice to Users

### 7.3 Support
- Support is available through the Platform's built-in support request feature
- Response times may vary based on Customer agreement
- Users should contact their organization administrator for first-level support

---

## 8. Disclaimers

### 8.1 "As Is" Basis
THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.

### 8.2 No Professional Advice
The Platform provides tools for investigation and analysis but does not constitute:
- Legal advice
- Medical advice
- Professional safety consulting
- Regulatory compliance certification

### 8.3 Third-Party Services
We are not responsible for third-party services integrated with the Platform.

---

## 9. Limitation of Liability

### 9.1 Exclusion of Damages
TO THE MAXIMUM EXTENT PERMITTED BY LAW, DASHMET SHALL NOT BE LIABLE FOR ANY:
- Indirect, incidental, special, consequential, or punitive damages
- Loss of profits, revenue, data, or business opportunities
- Damages arising from reliance on AI-generated content
- Damages resulting from unauthorized access to your account

### 9.2 Liability Cap
OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID BY CUSTOMER FOR THE SERVICES IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.

### 9.3 Exceptions
These limitations do not apply to liability that cannot be excluded by law.

---

## 10. Indemnification

You agree to indemnify and hold harmless DASHMET from claims arising from:
- Your violation of these Terms
- Your violation of any law or regulation
- Content you submit that infringes third-party rights
- Your use of AI features contrary to these Terms

---

## 11. Termination

### 11.1 By You
You may stop using the Platform at any time. Contact your administrator to deactivate your account.

### 11.2 By Us
We may suspend or terminate access if:
- You violate these Terms
- Your organization's agreement with us ends
- Required by law
- Necessary to protect the Platform or other users

### 11.3 Effect of Termination
Upon termination:
- Your access rights cease immediately
- You must stop using the Platform
- Data may be retained per our retention policies and Customer agreements

---

## 12. Dispute Resolution

### 12.1 Governing Law
These Terms are governed by the laws of the jurisdiction specified in your organization's agreement with us.

### 12.2 Informal Resolution
Before initiating formal proceedings, parties agree to attempt informal resolution.

### 12.3 Arbitration
Disputes may be subject to binding arbitration as specified in Customer agreements.

---

## 13. General Provisions

### 13.1 Entire Agreement
These Terms, together with our Privacy Policy and any Customer agreement, constitute the entire agreement.

### 13.2 Severability
If any provision is found unenforceable, the remaining provisions remain in effect.

### 13.3 No Waiver
Failure to enforce any provision does not constitute a waiver.

### 13.4 Assignment
You may not assign your rights under these Terms without our consent.

---

## 14. Changes to Terms

We may modify these Terms by:
- Posting updated Terms on the Platform
- Notifying Users of material changes
- Updating the "Last Updated" date

Continued use after changes become effective constitutes acceptance.

---

## 15. Contact Information

**For questions about these Terms:**
- Contact your organization administrator
- Use the in-app support request feature
- Review the help documentation within the Platform

---

*These Terms of Service supplement any agreement between DASHMET and your organization. In case of conflict, the Customer agreement takes precedence.*
`,
    },
    {
      type: 'COOKIE_POLICY',
      title: 'Cookie & Local Storage Policy',
      content: `# Cookie & Local Storage Policy

**Effective Date:** ${effectiveDate}
**Last Updated:** ${effectiveDate}

This policy explains how DASHMET RCA ("DASHMET," "we," "us," or "our") uses cookies, local storage, and similar technologies when you access our Platform.

---

## 1. Technologies We Use

### 1.1 Local Storage
Local storage is a web technology that allows websites to store data in your browser. Unlike cookies, local storage data is not automatically sent to servers with each request.

**We primarily use local storage instead of traditional cookies.**

### 1.2 Session Storage
Session storage is similar to local storage but is cleared when you close your browser tab.

### 1.3 Cookies
Cookies are small text files stored on your device. We use minimal cookies, primarily for:
- Third-party service integrations
- Analytics (if enabled by your organization)

---

## 2. What We Store and Why

### 2.1 Authentication Data
| Data | Purpose | Storage Type | Duration |
|------|---------|--------------|----------|
| Authentication tokens | Keep you securely signed in | Local Storage | Until logout or token expiration |
| Session information | Maintain your active session | Session Storage | Browser session |

### 2.2 User Preferences
| Data | Purpose | Storage Type | Duration |
|------|---------|--------------|----------|
| Theme preference | Remember dark/light mode | Local Storage | Persistent |
| Language setting | Display content in your language | Local Storage | Persistent |
| UI state | Remember collapsed menus, view preferences | Local Storage | Persistent |

### 2.3 Application State
| Data | Purpose | Storage Type | Duration |
|------|---------|--------------|----------|
| Draft content | Preserve unsaved work | Local Storage | Until saved or cleared |
| Navigation state | Remember your place in workflows | Session Storage | Browser session |
| Notification counts | Track unread messages | Local Storage | Until read |

### 2.4 Analytics (If Enabled)
| Data | Purpose | Storage Type | Duration |
|------|---------|--------------|----------|
| Usage metrics | Improve Platform performance | Local Storage | 30 days |
| Error tracking | Identify and fix issues | Session Storage | Browser session |

---

## 3. Third-Party Technologies

### 3.1 Firebase Authentication
We use Firebase Authentication for secure sign-in. Firebase may use:
- Authentication tokens stored in local storage
- Cookies for session management

**Firebase Privacy Policy:** https://firebase.google.com/support/privacy

### 3.2 Analytics Services
If enabled by your organization, analytics services may set cookies to:
- Track page views and feature usage
- Measure performance
- Identify technical issues

---

## 4. Categories of Storage

### 4.1 Strictly Necessary
Required for the Platform to function:
- Authentication tokens
- Security-related data
- Session management

**These cannot be disabled** as the Platform requires them to operate.

### 4.2 Functional
Enhance your experience:
- Theme preferences
- Language settings
- UI customizations

You can clear these, but your preferences will reset.

### 4.3 Performance
Help us improve the Platform:
- Feature usage data
- Error logs
- Performance metrics

May be controlled through organization settings.

---

## 5. Data We Do NOT Store Locally

We do **NOT** store the following in your browser:
- Incident report content
- Investigation data
- Personal information of other users
- Sensitive business data
- Passwords or raw credentials

This data is stored securely on our servers, not in your browser.

---

## 6. Managing Your Data

### 6.1 Viewing Stored Data
Most browsers allow you to view local storage:
1. Open browser developer tools (F12 or right-click > Inspect)
2. Navigate to "Application" or "Storage" tab
3. View Local Storage and Session Storage

### 6.2 Clearing Data
**Through Your Browser:**
- Clear browsing data/cache in browser settings
- Clear specific site data for DASHMET RCA

**Through the Platform:**
- Log out to clear authentication data
- Use "Clear Preferences" if available in settings

### 6.3 Browser Settings
You can configure your browser to:
- Block all cookies and local storage (may prevent Platform from working)
- Clear data when closing the browser
- Block third-party cookies only

**Warning:** Blocking essential storage will prevent you from using the Platform.

---

## 7. Impact of Blocking Storage

| If You Block... | Impact |
|-----------------|--------|
| All local storage | Cannot use the Platform |
| All cookies | Some features may not work |
| Third-party cookies | Analytics may not function |
| Session storage | Must re-authenticate frequently |

---

## 8. Security of Stored Data

We protect locally stored data by:
- Using secure (HTTPS) connections only
- Implementing token expiration
- Not storing sensitive data locally
- Using industry-standard encryption for tokens

**Your responsibilities:**
- Use a secure, updated browser
- Don't use shared or public computers for sensitive work
- Log out when finished, especially on shared devices
- Keep your device secure

---

## 9. Children's Privacy

The Platform is not designed for users under 18. We do not knowingly collect data from children through cookies or local storage.

---

## 10. Organization Controls

Your organization's administrator may:
- Enable or disable certain analytics
- Configure data retention preferences
- Set security policies affecting storage

Contact your administrator for organization-specific policies.

---

## 11. Changes to This Policy

We may update this policy to reflect:
- Changes in technologies we use
- New features or services
- Regulatory requirements

Updates will be posted with a new "Last Updated" date.

---

## 12. Contact Us

**Questions about this policy:**
- Contact your organization administrator
- Use the in-app support request feature

---

## 13. Technical Reference

For developers and security teams:

**Local Storage Keys Used:**
- \`firebaseToken\` - Authentication token
- \`userLanguage\` - Language preference
- \`theme\` - UI theme preference
- \`chatUnreadCounts\` - Notification state

**Session Storage Keys:**
- Temporary application state
- Form draft data

---

*This policy is specific to the DASHMET RCA platform. Your organization may have additional policies governing browser storage and cookies.*
`,
    },
    {
      type: 'SECURITY',
      title: 'Security',
      content: `# Security Overview

**Effective Date:** ${effectiveDate}
**Last Updated:** ${effectiveDate}

At DASHMET RCA, security is foundational to everything we do. This document outlines our security practices, your responsibilities, and how we work together to protect sensitive incident and investigation data.

---

## 1. Our Security Commitment

DASHMET RCA is designed to handle sensitive workplace incident data, including:
- Safety and injury information
- Root cause investigations
- Corrective action tracking
- Compliance documentation

We implement comprehensive security measures appropriate for this sensitive data.

---

## 2. Authentication & Access Control

### 2.1 Authentication
- **Token-based authentication** using industry-standard JWT (JSON Web Tokens)
- **Firebase Authentication** for secure identity management
- **Automatic token refresh** with configurable session timeouts
- **Secure password requirements** enforced at account creation

### 2.2 Role-Based Access Control (RBAC)
We implement granular access controls:

| Role | Access Level |
|------|--------------|
| **System Administrator** | Platform-wide configuration and management |
| **Organization Admin** | Full access within organization |
| **CI Manager** | Investigation management and oversight |
| **Safety/Security Manager** | Safety programs and compliance |
| **Supervisor** | Team-level incident management |
| **Employee** | Report incidents, view assigned items |

### 2.3 Access Code Protection
- Organization-specific access codes for registration
- Codes can be regenerated by administrators
- Access codes are separate from user credentials

### 2.4 Session Management
- Automatic session timeout after inactivity
- Secure logout clears authentication tokens
- Concurrent session management available

---

## 3. Data Protection

### 3.1 Encryption
**In Transit:**
- All communications encrypted with TLS 1.2 or higher
- HTTPS enforced for all connections
- Secure WebSocket connections for real-time features

**At Rest:**
- Database encryption for sensitive fields
- Encrypted file storage for attachments
- Secure key management practices

### 3.2 Multi-Tenant Isolation
- Strict logical separation between organizations
- Database-level tenant isolation
- API-level access validation
- No cross-organization data access

### 3.3 Data Minimization
- Collect only necessary information
- Configurable data retention policies
- Secure data deletion procedures

---

## 4. Infrastructure Security

### 4.1 Cloud Security
- Hosted on enterprise-grade cloud infrastructure
- Regular security patching and updates
- Network segmentation and firewalls
- DDoS protection

### 4.2 Monitoring & Detection
- Real-time security monitoring
- Intrusion detection systems
- Automated alerting for anomalies
- 24/7 infrastructure monitoring

### 4.3 Backup & Recovery
- Regular automated backups
- Geographically distributed backup storage
- Tested disaster recovery procedures
- Point-in-time recovery capability

---

## 5. Application Security

### 5.1 Secure Development
- Security-focused development practices
- Code review requirements
- Dependency vulnerability scanning
- Regular security assessments

### 5.2 Input Validation
- Server-side validation of all inputs
- Protection against injection attacks (SQL, XSS, etc.)
- File upload scanning and restrictions
- Rate limiting on API endpoints

### 5.3 Audit Logging
Comprehensive audit trails including:
- User authentication events
- Data access and modifications
- Administrative actions
- Security-relevant events

Audit logs are:
- Tamper-resistant
- Retained per compliance requirements
- Available for security investigations

---

## 6. AI Security

### 6.1 AI Data Handling
- AI processes data within secure boundaries
- No training on customer-specific data
- AI suggestions are clearly labeled
- Human review required for AI outputs

### 6.2 AI Access Controls
- AI features respect user permissions
- Organization can disable AI features
- AI outputs subject to same access controls as user data

---

## 7. Compliance & Certifications

### 7.1 Supported Compliance Frameworks
The Platform includes features to support:
- **OSHA** workplace safety reporting requirements
- **ISO 45001** occupational health and safety management
- **Internal audit** requirements for incident management
- **Industry-specific** compliance needs

### 7.2 Data Privacy Compliance
We support compliance with:
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Other applicable privacy regulations

*Note: Compliance is a shared responsibility. Organizations must configure and use the Platform appropriately for their specific requirements.*

---

## 8. Incident Response

### 8.1 Our Process
1. **Detection** - Automated monitoring and alerting
2. **Assessment** - Rapid triage and impact analysis
3. **Containment** - Immediate protective measures
4. **Remediation** - Root cause fix and recovery
5. **Communication** - Timely notification to affected parties
6. **Review** - Post-incident analysis and improvements

### 8.2 Security Incident Notification
- Affected organizations notified promptly
- Clear communication about scope and impact
- Guidance on protective measures
- Follow-up on remediation status

---

## 9. Your Security Responsibilities

### 9.1 Account Security
✅ **DO:**
- Use strong, unique passwords
- Keep credentials confidential
- Log out on shared devices
- Report suspicious activity immediately
- Enable additional security features when available

❌ **DON'T:**
- Share your login credentials
- Use the same password across services
- Leave sessions unattended
- Ignore security notifications
- Access from unsecured networks

### 9.2 Data Handling
✅ **DO:**
- Follow your organization's data policies
- Report only accurate information
- Use appropriate classification for sensitive data
- Verify recipients before sharing reports

❌ **DON'T:**
- Export data to unsecured locations
- Share investigation details inappropriately
- Upload unauthorized files
- Bypass data access controls

### 9.3 Device Security
✅ **DO:**
- Keep browsers and devices updated
- Use antivirus/anti-malware software
- Lock devices when unattended
- Use secure networks

❌ **DON'T:**
- Access from compromised devices
- Use outdated browsers
- Ignore security updates
- Connect via unsecured public WiFi

---

## 10. Administrator Security Guide

### 10.1 User Management
- Regularly review user access and permissions
- Promptly remove access for departed employees
- Use principle of least privilege
- Document access decisions

### 10.2 Organization Settings
- Configure appropriate session timeouts
- Review and rotate access codes periodically
- Enable audit logging
- Configure data retention appropriately

### 10.3 Monitoring
- Review audit logs regularly
- Investigate unusual activity
- Track failed authentication attempts
- Monitor for data exfiltration indicators

---

## 11. Reporting Security Issues

### 11.1 How to Report
If you discover a potential security vulnerability:

1. **Do not** exploit the vulnerability or access data beyond what's necessary to demonstrate the issue
2. **Report immediately** through one of these channels:
   - In-app support request (mark as security-related)
   - Contact your organization administrator
   - Email details securely (contact information available in Platform)

### 11.2 What to Include
- Description of the vulnerability
- Steps to reproduce
- Potential impact assessment
- Your contact information

### 11.3 Response Expectations
- Acknowledgment within 24 hours
- Assessment and prioritization
- Regular updates on remediation progress
- Recognition for responsible disclosure (if desired)

---

## 12. Security Updates & Communication

### 12.1 How We Communicate
- Security announcements in the Platform
- Email notifications for critical issues
- Documentation updates
- Release notes for security improvements

### 12.2 Staying Informed
- Enable notifications for security updates
- Review release notes regularly
- Follow administrator guidance
- Participate in security training

---

## 13. Third-Party Security

### 13.1 Vendor Management
We carefully evaluate and monitor third-party services:
- Security assessments before engagement
- Contractual security requirements
- Regular review of vendor security posture
- Data processing agreements

### 13.2 Key Third Parties
- **Cloud Infrastructure** - Enterprise-grade hosting with security certifications
- **Firebase** - Google's secure authentication platform
- **AI Services** - Processed with appropriate data protections

---

## 14. Business Continuity

### 14.1 Availability
- High-availability architecture
- Geographic redundancy
- Automated failover capabilities
- Regular disaster recovery testing

### 14.2 Recovery Objectives
- Recovery Time Objective (RTO): Minimize downtime
- Recovery Point Objective (RPO): Minimal data loss
- Regular backup verification
- Documented recovery procedures

---

## 15. Continuous Improvement

We continuously improve security through:
- Regular security assessments
- Penetration testing
- Bug bounty considerations
- Industry best practice adoption
- Security training and awareness
- Incident learnings integration

---

## 16. Questions & Support

**Security Questions:**
- Contact your organization administrator
- Use the in-app support request feature
- Review this documentation and help resources

**Emergency Security Issues:**
- Report immediately through available channels
- Contact your organization's IT security team
- Do not delay reporting critical issues

---

*Security is a shared responsibility. Together, we can protect the sensitive incident and investigation data that organizations trust us to handle.*

---

**Document Version:** 1.0
**Classification:** Public
**Review Cycle:** Annual or as needed
`,
    },
  ];

  // Get admin user for updatedBy reference
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (!admin) {
    console.log('⚠️  No admin user found, creating policies without updatedBy reference');
  }

  for (const policy of policies) {
    try {
      const existing = await prisma.policyDocument.findUnique({
        where: { type: policy.type },
      });

      const nextVersion = (existing?.version ?? 0) + 1;

      await prisma.policyDocument.upsert({
        where: { type: policy.type },
        update: {
          title: policy.title,
          content: policy.content,
          version: nextVersion,
          isPublished: true,
          publishedAt: now,
          updatedByUserId: admin?.id,
        },
        create: {
          type: policy.type,
          title: policy.title,
          content: policy.content,
          version: 1,
          isPublished: true,
          publishedAt: now,
          updatedByUserId: admin?.id,
        },
      });

      console.log(`✅ ${policy.title} - Version ${nextVersion}`);
    } catch (error) {
      console.error(`❌ Failed to seed ${policy.type}:`, error);
    }
  }

  console.log('\n🎉 Policy documents seeded successfully!');
}

seedPolicies()
  .catch((e) => {
    console.error('Error seeding policies:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
