# this one
Enhancement Request: Add Safety as a New Incident Type (Enterprise-Level)
1. New Incident Type: Safety

Add a new incident type called "Workplace Safety" to the system.
This incident type must be treated as a first-class category type (equal to Food Safety and Machine & Equipment) and fully supported across:
The form should have base fields, Evidence Submission, AI-Generated Summary, plus the new dynamic fields that is specific to Workplace safety. Fields are dynamic base on category and sub-category selected.

Database schema

Incident creation forms

RCA workflows

Reporting & analytics

Populate Data initialization action

All safety categories and sub-categories listed below must be pre-seeded all of them into the database and automatically linked to the Organization ID when the Populate Data action is executed.
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

Insert all Safety categories and sub-categories

Tie all records to the Organization ID

Preserve existing organization data

Allow organizations to manage their own safety taxonomy independently.


Please do this without breaking existing working logics and implementation and program flow.



Implement this such that When the "Populate Data" button is clicked, seed the database for Workplace Safety Categories & Sub-Categories. just Like how the Food Safety, and Machine & Equipment are implemented.

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







