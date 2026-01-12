# Please do this without breaking existing working logics and implementation and program flow.
# ENTERPRISE RCA WEB APP
## GitHub Copilot Execution Checklist
### Strict Build Order • No Skipped Phases • Enterprise-Grade

This checklist defines the **exact implementation sequence** Copilot must follow.
Each phase must be **fully completed and verified before proceeding**.

---

# PHASE 0 — PROJECT FOUNDATION (MANDATORY) ✅ COMPLETE

✅ 0.1 Initialize Web App Project - **COMPLETE**
- ✅ Create frontend framework (Next.js 14 + React + TypeScript)
- ✅ Create backend API project (Express + TypeScript)
- ✅ Configure environment variables
- ✅ Enable CORS
- ✅ Enable secure API routing
- ✅ Setup base routing system

✅ 0.2 Global App Structure - **COMPLETE**
- ✅ Create App Layout
- ✅ Create Protected Layout
- ✅ Create Public Layout
- ✅ Create Navigation System

✅ 0.3 Global UI Systems - **COMPLETE**
- ✅ Theme Engine (Dark / Light)
- ✅ Language Engine (English / Spanish / French)
- ✅ Role Context Provider
- ✅ Organization Context Provider

✅ 0.4 Security Baseline - **COMPLETE**
- ✅ Central Authorization Middleware
- ✅ API Request Validation
- ✅ Rate Limiting
- ✅ Input Sanitization
- ✅ Secure File Upload Validation

**Phase 0 Status**: ✅ FULLY COMPLETE (December 7, 2025)
**Build Summary**: See BUILD_COMPLETE_PHASE_0.md

---

# PHASE 1 — AUTHENTICATION & RBAC (NO RCA WITHOUT THIS)

🔄 1.1 Authentication System - **IN PROGRESS (Firebase Migration)**  
-
Use the information below to design a professional, enterprise-level Phase 1.1 Authentication System.
We are using Firebase Authentication strictly for identity (Google Login + Email/Password Login), while all profile data is stored in our PostgreSQL database.
Firebase Storage will be used later for file handling—this prompt focuses only on authentication and onboarding.

Authentication Requirements
1. a - Email-First Login (Firebase Email/Password)

Only the email field is shown initially.

When the user enters an email, the system checks in our PostgreSQL users table`:

If the email does NOT exist →

Register the user in Firebase Auth using the provided email + newly created password.

After successful Firebase registration → prompt the user to complete their Profile Setup (see profile fields below).

After profile submission, save the profile to PostgreSQL.

If the email exists →

Proceed with regular Firebase Email/Password login.

After successful Firebase login → look up the user’s role in PostgreSQL and redirect them to the correct portal.

1. b -  Google Login (Firebase OAuth)

User authenticates via Google using Firebase Auth.

After the first successful Google login, check PostgreSQL for their email:

If NOT found → prompt the user to complete Profile Setup and save to PostgreSQL.

If found → proceed to portal routing (see “Role Routing” section).

# 1. c - Profile Setup Requirements (Stored in PostgreSQL)
Roles (Fixed Enum)

SUPERVISOR

QA / FOOD SAFETY

MAINTENANCE / ENGINEERING

CI / MANAGER

ADMIN

SYSTEM_ADMIN

Profile Fields

Select Role

If the user chooses ADMIN or SYSTEM_ADMIN, immediately display:

Access Code input field

The Access Code is validated against an access_codes table in PostgreSQL.

Seed the access_codes table with 4 rows, each containing a 6-digit code, and each access code can be use with ADMIN, SYSTEM_ADMIN.

If the Access Code passes validation:

if the ADMIN or the SYSTEM ADMIN role is selected, and the Access code validation passed, then the requierd Organization field appears and a check box to add a required Facility field which will also create a fasility during ADMIN or the SYSTEM ADMIN profile creation. note that ADMIN or the SYSTEM ADMIN can always chose to create facility after profile creation in portal.

The Standard Profile Fields (all users including Admin/System Admin creation flow) are:

First Name

Last Name

Select Organization field (visible only when the selected role is NOT Admin or System Admin)

Select Facility field (visible only when the selected role is NOT Admin or System Admin)

All profile information is saved in PostgreSQL after completion.

1. d -  Role-Based Portal Routing

After every successful Firebase login, the system must:

Look up the user’s profile in PostgreSQL using their email.

Read the user’s role.

Redirect them to the appropriate portal:

SUPERVISOR Portal

QA / FOOD SAFETY Portal

MAINTENANCE / ENGINEERING Portal

CI / MANAGER Portal

ADMIN Portal and SYSTEM_ADMIN Portal.

# correct login and registration flow
Why does the system display the second screen immediately after I enter my email on the initial login screen? The expected behavior is as follows:
When a user enters their email on the first login screen, the system should first verify whether the email exists in Firebase and in the database.
If the email exists in Firebase, it should also exist in the database. In this case, the system should prompt the user to enter their password to log in to the app.
If the email does not exist in Firebase, it should also not exist in the database. The system should then prompt the user to create a password.
Once the password is successfully created, the account registration in Firebase is completed. The user’s email should then be saved in the database.
After successful registration, the user should be directed to the profile creation screen (using the existing profile page).
Once the profile is created, the user can access the app.
On subsequent logins, the system should check whether the email exists in Firebase, exists in the database, and has an associated profile.
If all conditions are met, the user is prompted to enter their password.
After successful authentication with Firebase, the user is granted access to the app.

# Firebase

const firebaseConfig = {
  apiKey: "AIzaSyCiZt4zyyH6wgBPUlwUopbP_sj_LfICCtI",
  authDomain: "dashmet-resolve-1ce6d.firebaseapp.com",
  projectId: "dashmet-resolve-1ce6d",
  storageBucket: "dashmet-resolve-1ce6d.firebasestorage.app",
  messagingSenderId: "589525716102",
  appId: "1:589525716102:web:b2366d4401bb1c632d9507",
  measurementId: "G-0HXN5D0E9V"
};



# firebase service account - file in project directory -> firebase-adminsdk-fbsvc.json


- Logout System
- Session Handling
- Token Refresh
- Password Reset
- Account Lockout

✅ 1.2 Role-Based Access Control  
**REAL-WORLD MANUFACTURING HIERARCHY:**
- **SUPERVISOR** (Floor Level - Primary Users)
  - Create/Report Incidents (on behalf of floor operators)
  - View Team Incidents
  - Basic RCA participation
  - NO admin access

- **QA / FOOD SAFETY** (Specialist)
  - All Supervisor features +
  - Food Safety incident focus
  - Quality documentation

- **MAINTENANCE / ENGINEERING** (Specialist)
  - All Supervisor features +
  - Machine/Equipment incident focus
  - Technical RCA

- **CI / MANAGER** (Management)
  - All Supervisor features +
  - Analytics & Reporting
  - Assign incidents
  - Approve RCA conclusions
  - Cross-facility visibility

- **ADMIN** (IT/System)
  - All Manager features +
  - User Management
  - Organization Configuration
  - Facility/Line/Category setup

- **SYSTEM_ADMIN** (Super User)
  - Full system access
  - Multi-organization management
  - System-wide configuration

**NOTE:** No OPERATOR role - floor workers don't have computer access.
Supervisors create incidents on behalf of operators who report issues verbally.

Enforce:
- Route Protection
- Feature-Level Access
- Data-Level Access

✅ 1.3 User Preferences  
- Theme Selection
- Default Language
- Default Site & Line

---

# PHASE 2 — MULTI-TENANT ORGANIZATION ENGINE

✅ 2.1 Organization Creation  
- Company Setup
- Region Setup (USA, Mexico, Canada)
- Default Language

✅ 2.2 Facility & Line Management  
- Plants
- Areas
- Lines
- Shifts
- Timezones

✅ 2.3 Category Management (Dynamic Filters)  
Implement Runtime Managed Categories:

FOOD SAFETY ISSUES
1. Foreign Material

Metal shavings (equipment wear, broken blades, fasteners)

Plastic fragments (bags, liners, guards, tools)

Rubber pieces (gaskets, belts, seals)

Glass fragments (light fixtures, gauges)

Wood splinters (pallets, crates)

Stones/gravel (raw materials, footwear)

Paper/cardboard pieces

Hair or beard hair

Jewelry (rings, earrings)

Gloves or glove fragments

Packaging film pieces

Pest fragments (insects, rodents)

Paint flakes

Screws, nuts, bolts

Product-to-product cross contamination (wrong SKU in case)

2. Microbiological (Micro)

Listeria contamination

Salmonella contamination

E. coli contamination

Yeast or mold growth

Biofilm formation

Poor environmental monitoring results

Cross-contamination from raw to RTE areas

Condensation drip contamination

Improper handwashing

Inadequate sanitation effectiveness

Standing water

Poor zone control (Zone 1–4 breaches)

Employee illness exposure

Unsanitary tools or utensils

3. Allergen

Undeclared allergen presence

Cross-contact between allergen and non-allergen products

Improper changeover cleaning

Shared utensils or equipment

Incorrect ingredient usage

Rework containing allergens added incorrectly

Allergen residue on belts or conveyors

Inadequate allergen labeling

Poor allergen segregation

Improper storage of allergen ingredients

Employee handling allergen then non-allergen product

Incomplete allergen verification

4. Labeling

Incorrect product label applied

Missing allergen declaration

Wrong nutrition facts

Wrong ingredient statement

Incorrect net weight

Incorrect product name

Wrong lot code

Wrong expiration date

Missing date code

Smudged or unreadable label

Incorrect language requirement

Label mismatch with product inside case

Wrong country-of-origin statement

Incorrect UPC/barcode

Missing handling instructions

5. Temperature

Product out of temperature specification

Inadequate cooking temperature

Insufficient cooling rate

Improper holding temperature

Cold chain break

Freezer temperature excursion

Cooler malfunction

Product exposed too long at ambient temperature

Incorrect temperature monitoring

Thermometer out of calibration

Manual temperature logs not completed

Hot product entering cold storage

Condensation due to temperature differences

6. Sanitation

Incomplete cleaning

Missed sanitation steps

Improper chemical concentration

Wrong chemical used

Chemical residue on food-contact surfaces

Poor pre-op inspection results

Dirty tools or equipment

Inadequate sanitation frequency

Cross-contamination during cleaning

Unsanitary drains

Improper waste handling

Pest attraction due to poor sanitation

Employee hygiene issues

Missing sanitation records

7. Supplier

Non-conforming raw materials

Supplier COA missing or incorrect

Foreign material from supplier

Microbial contamination from supplier

Allergen misstatement by supplier

Packaging defects from supplier

Temperature abuse during transport

Late delivery impacting food safety

Unapproved supplier usage

Poor supplier traceability

Rejected material not properly controlled

Supplier audit failure

Inconsistent ingredient quality

8. Packaging

Damaged packaging

Incomplete seals

Leakers

Wrong packaging material

Packaging contamination

Weak seals

Torn film or bags

Incorrect case count

Incorrect packaging size

Packaging not food-grade

Ink transfer from packaging

Packaging foreign material

Misaligned seals

Packaging integrity failure

Overfilled or underfilled packages

MACHINE & EQUIPMENT ISSUES
1. Mechanical

Broken belts

Worn bearings

Loose fasteners

Shaft misalignment

Gear wear or failure

Broken guards

Conveyor jams

Excessive vibration

Mechanical fatigue

Worn rollers

Chain failure

Blade damage

Mechanical obstruction

Structural cracks

2. Electrical

Power loss

Tripped breakers

Blown fuses

Faulty wiring

Loose electrical connections

Motor failure

Overheating motors

Electrical shorts

Panel faults

Emergency stop failure

Grounding issues

Damaged cables

Electrical noise interference

3. Controls

PLC fault

Program error

Incorrect logic sequence

HMI communication failure

Recipe selection error

Sensor input not recognized

Control system freeze

Software update failure

Incorrect parameter settings

Loss of communication between devices

Unauthorized program changes

Control response delay

4. Pneumatics

Air leaks

Low air pressure

Failed solenoids

Sticking cylinders

Moisture in air lines

Broken air hoses

Improper actuator movement

Air regulator malfunction

Delayed pneumatic response

Air contamination (oil/water)

Inconsistent air supply

5. Sensors

Sensor misalignment

Sensor failure

Dirty sensors

False readings

No signal output

Delayed detection

Calibration drift

Blocked photo eyes

Incorrect sensor type installed

Sensor wiring issues

Environmental interference (dust, steam)

6. Lubrication

Over-lubrication

Under-lubrication

Wrong lubricant type

Non-food-grade lubricant use

Lubricant leaks

Grease contamination on product

Missed lubrication schedule

Poor lubrication access points

Breakdown due to lack of lubrication

Cross-contamination from lubricant

7. Calibration

Out-of-calibration instruments

Missed calibration schedule

Incorrect calibration procedure

Failed calibration verification

Uncalibrated thermometers

Scale inaccuracies

Weight check failures

Sensor calibration drift

Calibration records missing

Improper calibration tools used

8. Changeover

Incomplete cleaning between runs

Wrong parts installed

Incorrect setup configuration

Residual product left behind

Improper tool usage

Missed changeover checklist steps

Wrong recipe selected

Allergen carryover

Misaligned components after changeover

Extended downtime

Employee training gaps during changeover

✅ 2.4 "Other" Logic  
- Auto-Show Custom Title Field If Selected

---

# PHASE 3 — INCIDENT CAPTURE ENGINE (INTAKE SYSTEM)

⚠️ **IMPORTANT NOTE - Internationalization (i18n)**:
Multi-language support is currently disabled in settings (Phase 0 placeholder).
Full i18n implementation will be added in Phase 3+ using:
- next-intl or react-i18next library
- Automated string extraction from codebase
- Translation keys instead of hardcoded text
- Integration with translation APIs (Google Translate/DeepL)
- Locale-specific formatting (dates, numbers, currencies)
- RTL language support
This ensures professional, maintainable translations as the app scales.

✅ 3.1 Incident Creation Flow - **COMPLETE**
- Type Selection (Food Safety or Machine)
- Dynamic Category Filtering
- Sub-Category Filtering
- Auto Show Custom Title Field
- Context Fields:
  - Facility
  - Line
  - Product
  - Lot
  - Date/Time
  - Shift
  - Machine ID (If Applicable)

✅ 3.2 Evidence Capture - **COMPLETE**
- ✅ Photo Upload (Firebase Storage)
- ✅ Video Upload (Firebase Storage)
- ✅ Document Upload (Firebase Storage)
- ✅ Voice Recording + Transcription (Web Speech API)

✅ 3.3 AI Incident Summary  
- Convert raw text → professional summary
- Editable by user

✅ 3.4 Save, Draft & Submit Modes  
- Save as Draft
- Final Submit
- Edit Before Close

---

# PHASE 4 — TRIAGE & AUTO-ASSIGNMENT ENGINE

✅ 4.1 Severity Engine  
- Manual Severity
- AI Severity Detection

✅ 4.2 Auto-Assignment Rules  
- Based on Type
- Based on Area
- Based on Category
- Based on Severity

✅ 4.3 SLA & Deadline System  
✅ 4.4 Notifications (Email + In-App)

---

# PHASE 5 — RCA WORKSPACE CORE

✅ 5.1 RCA Workspace Shell  
- Incident Viewer
- Evidence Panel
- Timeline Panel
- Collaboration Comments

✅ 5.2 RCA Method Selector  
- 5 Whys
- Fishbone

✅ 5.3 AI Method Recommendation  
- Based on complexity
- Based on recurrence
- User override always allowed

---

# PHASE 6 — 5 WHYS ENGINE

✅ 6.1 Guided 5 Whys Builder  
- Why 1 – Why 5
- Evidence Per Why
- User Edits Always Allowed

✅ 6.2 AI Assistance  
- Suggest Deeper Causes
- Detect Symptom-Level Answers
- Rewrite into Professional Language

✅ 6.3 Version History  
✅ 6.4 Re-Analyze With AI Without Data Loss

---

# PHASE 7 — FISHBONE ENGINE

✅ 7.1 Drag-and-Drop Visual Builder  
✅ 7.2 Configurable Bone Categories  
✅ 7.3 Evidence Attachments  
✅ 7.4 AI Sub-Cause Suggestions  
✅ 7.5 Convert Diagram → Root Cause Text

---

# PHASE 8 — ROOT CAUSE VALIDATION SYSTEM

✅ 8.1 Candidate Cause Generator  
✅ 8.2 Team Voting System  
✅ 8.3 Approval Locking  
✅ 8.4 Bias Detection  
✅ 8.5 Pattern Matching With History

---

# PHASE 9 — CAPA ENGINE (CORRECTIVE & PREVENTIVE ACTIONS)

✅ 9.1 Action Creation  
- Corrective
- Preventive

- Owner
- Due Date
- Priority
- Resource Impact

✅ 9.2 AI Action Quality Review  
✅ 9.3 Weak Action Detection  
✅ 9.4 Regulatory Tag Mapping

---

# PHASE 10 — ACTION TRACKING & EFFECTIVENESS

✅ 10.1 CAPA Board  
✅ 10.2 Status Progression  
✅ 10.3 Automated Effectiveness Review  
✅ 10.4 Recurrence Detection

---

# PHASE 11 — REPORTING & COMPLIANCE

✅ 11.1 Full RCA PDF Export  
✅ 11.2 Audit Reports  
✅ 11.3 Regulatory Evidence Archives  
✅ 11.4 Executive Dashboards

---

# PHASE 12 — ANALYTICS & INTELLIGENCE

✅ 12.1 Trend Dashboards  
✅ 12.2 Downtime Analytics  
✅ 12.3 Food Safety Risk Trends  
✅ 12.4 Machine Reliability Trends  
✅ 12.5 Predictive Recurrence Detection

---

# PHASE 13 — KNOWLEDGE BASE

✅ 13.1 Auto-Generate Knowledge Article From Closed RCA  
✅ 13.2 Similar Incident Search  
✅ 13.3 AI-Guided RCA Coach

---

# PHASE 14 — ENTERPRISE HARDENING

✅ 14.1 Audit Logs  
✅ 14.2 Regulatory Readiness  
✅ 14.3 API-First External Integration Layer  
✅ 14.4 Load & Stress Testing  
✅ 14.5 Multi-Region Readiness

---

# FINAL ACCEPTANCE RULE

🚨 **NO PHASE MAY BE SKIPPED.**  
🚨 Each Phase Requires:
- Functional Completion
- Security Validation
- UI Verification
- AI Validation (If Applicable)

---

END OF COPILOT EXECUTION CHECKLIST





Enhancement Request: Add SAFETY as a New Incident Type (Enterprise-Level)
1. New Incident Type: SAFETY

Add a new incident type called SAFETY to the system.
This incident type must be treated as a first-class category (equal to Food Safety and Machine & Equipment) and fully supported across:

Database schema

Incident creation forms

RCA workflows

Reporting & analytics

Populate Data initialization action

All safety categories and sub-categories listed below must be pre-seeded into the database and automatically linked to the Organization ID when the Populate Data action is executed.
Each organization must be able to edit, add, or deactivate its own safety categories without impacting other organizations.

2. Workplace Safety Categories & Sub-Categories (Manufacturing)
1. Physical Injury Hazards

Injuries caused by contact, movement, or applied force

Slips, Trips & Falls

Cuts, Lacerations & Abrasions

Punctures

Bruises / Contusions

Struck-By Objects

Caught-In / Caught-Between

Pinch Points

Falling Objects

Head Injuries

Eye Injuries

Hand & Finger Injuries

Foot & Ankle Injuries

2. Ergonomic & Musculoskeletal Safety

A primary source of OSHA recordable injuries

Manual Material Handling

Overexertion

Repetitive Motion

Awkward Postures

Forceful Exertions

Push / Pull Hazards

Lifting & Carrying

Cumulative Trauma Disorders (CTD)

3. Machine & Equipment Safety

Injury prevention related to equipment and machinery

Machine Guarding

Lockout / Tagout (LOTO)

Mechanical Hazards

Electrical Hazards

Pneumatic / Hydraulic Hazards

Sensors & Interlocks

Emergency Stops

Unexpected Startup

Unsafe Changeovers

Maintenance Safety

4. Chemical & Hazardous Materials Safety

Employee exposure and injury risk

Chemical Exposure

Ammonia Exposure

Cleaning & Sanitation Chemicals

SDS / GHS Labeling

Chemical Storage

Chemical Spills

Incompatible Chemical Mixing

Compressed Gases

Chemical PPE

5. Environmental & Exposure Hazards

Workplace conditions affecting employee health

Heat Stress

Cold Stress

Noise Exposure (Hearing Conservation)

Air Quality / Ventilation

Dust Exposure

Fumes & Vapors

Lighting Deficiencies

Radiation (where applicable)

6. Fire & Emergency Safety

Emergency preparedness and response

Fire Hazards

Flammable Materials

Emergency Evacuation

Alarm Systems

Emergency Exits & Egress

Fire Suppression Systems

Emergency Drills

First Aid & AED

Emergency Response Procedures

7. Material Handling & Traffic Safety

Movement of people, equipment, and loads

Forklift Safety

Pallet Jack Safety

Dock Safety

Trailer Safety

Load Securing

Pedestrian vs Vehicle Traffic

Racking & Storage Safety

8. Personal Protective Equipment (PPE)

Required protective controls

Head Protection

Eye & Face Protection

Hand Protection

Foot Protection

Hearing Protection

Respiratory Protection

Chemical-Resistant PPE

High-Visibility PPE

9. Facility & Infrastructure Safety

Building and structural hazards

Floors & Walkways

Stairs & Handrails

Platforms & Mezzanines

Doors & Dock Plates

Roof Leaks / Condensation (Slip Risk)

Housekeeping

Structural Integrity

10. Behavioral, Training & Compliance Safety

Human-factor and compliance risks

Unsafe Acts

SOP Non-Compliance

Lack of Training

Failure to Use PPE

Near Misses

Incident Reporting

Contractor Safety

Visitor Safety

Work Rule Violations

11. Health & Medical Management

Case tracking and post-incident management

First Aid

OSHA Recordable Injuries

Restricted Duty

Lost Time Injuries

Occupational Illness

Return-to-Work

Fatigue Management

3. Required Safety-Specific Fields (For Strong RCA Outcomes)

When SAFETY is selected as the incident type, dynamically display and require the following fields to support high-quality RCA analysis:

Incident Context

Injury Type (First Aid / Recordable / Near Miss / Lost Time)

Body Part(s) Affected (Multi-select)

Task Being Performed

Normal vs Non-Routine Task (Yes/No)

Shift / Department / Line / Area

Exposure & Risk Factors

Duration of Exposure

Frequency of Task

Weight / Force (if applicable)

Environmental Conditions (Heat, Noise, Lighting, etc.)

Controls & Compliance

PPE Required (Yes/No)

PPE Worn (Yes/No)

Machine Safeguards in Place (Yes/No/N/A)

LOTO Required (Yes/No/N/A)

SOP Available (Yes/No)

SOP Followed (Yes/No)

Immediate Actions

First Aid Provided (Yes/No)

Medical Treatment Required (Yes/No)

Supervisor Notified (Yes/No)

Area Secured (Yes/No)

RCA Enablement

Direct Cause

Contributing Factors (People / Process / Equipment / Environment)

Unsafe Act vs Unsafe Condition

Previous Similar Incidents (Yes/No)

4. Populate Data Behavior (Critical)

The Populate Data action must:

Insert all SAFETY categories and sub-categories

Tie all records to the Organization ID

Preserve existing organization data

Allow organizations to manage their own safety taxonomy independently



not all of those are true “root causes” for this problem.
Several are systemic contributors, but only a small subset, if fixed, would realistically prevent recurrence of the wrist injury.

Problem Statement (Correct)

Employee experienced wrist pain after lifting heavy items.

This is a musculoskeletal strain from manual material handling.
So the root cause must directly explain why the lift exceeded safe ergonomic limits or controls failed at the task level.

Root Cause Test (Very Important)

A true root cause must pass this test:

If this item were corrected, would this specific injury likely NOT happen again?

If the answer is no, it is not a primary root cause — it’s a contributing or systemic issue.

CONTRIBUTING / SYSTEMIC FACTORS (Not primary root causes)

If the root causes for individual cotegories under the Fishborn section for the individual Whys you are validating do NOT directly explain the injury, or any incident that is Being Analysed using the Fishbone Methodology, but they increase risk long-term.

They should be listed as contributing factors, not main root causes.

Why these are NOT main root causes

Tracking systems do not prevent a wrist strain at the moment of lifting

Cost mindset explains why controls weren’t funded, not how the injury occurred

👉 These belong in:

Management system findings

Organizational contributing factors

Safety culture observations

So rewrite the AI prompt to Analys and validate. the individual root causes. for the individual 5 Whys.