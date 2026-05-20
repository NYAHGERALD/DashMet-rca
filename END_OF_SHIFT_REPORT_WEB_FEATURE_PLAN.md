# End of Shift Report Web Feature Plan

## My Understanding

The goal is to replace the Excel file `End of Shift Report 05-15-2026.xlsx` with a real web application feature.

Users should no longer fill out the spreadsheet manually. Instead, they should fill out the same production summary report in the DashMet web app. The yellow Excel cells become editable web inputs, dropdowns, time pickers, and text areas. The non-yellow cells become read-only calculated fields. Those calculations should run in backend code, using the same business logic as the Excel formulas and the same reference data that currently lives in hidden workbook sheets.

The saved result should live in our backend database, so it can be searched, reported on, audited, used by dashboards, and reused by the bakery daily/standup reporting flow.

## Workbook Analysis

The workbook is not just one form. It is a small calculation system:

| Sheet | Visible | Purpose in the web feature |
| --- | --- | --- |
| `1st Shift Report` | Yes | User-facing form for first shift. Same structure as second shift. |
| `2nd Shift Report ` | Yes | User-facing form for second shift. This matches the screenshot. |
| `DATA` | Hidden | Product/SKU reference data, descriptions, weights, units, line data, wrapper data, and item setup values. |
| `Rates` | Visible | Main rate and lookup table used by report formulas. Item description, case conversion, standard headcount, rates, TMAX, eaches, and labor-related values come from here. |
| `75% Temporary Data L3 & L5` | Hidden | Temporary override reference data for Line 3 and Line 5. Some formulas reference an external workbook, so this must be converted into owned backend reference data. |
| `OEE bottlenecks by Item` | Hidden | Bottleneck and OEE reference data by item and line. |
| `Line 1-Line 2 Mini Taco` | Hidden | Line-specific staffing/rate data for Line 1 and Line 2 mini taco items. |
| `Line 3` | Hidden | Line 3 staffing/rate reference data. |
| `Line 5 New` | Hidden | Line 5 staffing/rate reference data. |
| `MES` | Hidden | MES-style item, line, crew, unit conversion, TMAX, schedule, and average output data. |
| `Bakery` | Hidden | Bakery staffing/rate reference data. |
| `Kitchen` | Hidden | Kitchen staffing/rate reference data. |
| `Sheet1` | Hidden | Empty/unused. |

The visible report sheets have the same high-level structure:

| Area | Excel rows | Web behavior |
| --- | ---: | --- |
| Header | 1-5 | Report metadata, reported by, date, shift, safety notes, quality notes. |
| Production | 7-15 | Main production rows for Kitchen, Line 1, Line 2, Line 3, and Line 5. |
| Changeovers | 17-20 | Additional editable line/item entries for changeover production. |
| Rework | 21-24 | Additional editable line/item entries for rework production. |
| Shift totals | 25 | Calculated totals and averages. Read-only. |
| Downtime and notes | 26-37 | Line-specific free-text notes. |

## Current Excel Dropdowns

The report has three important dropdown behaviors that should become backend-driven options:

| Excel range | Meaning | Current options/source |
| --- | --- | --- |
| `D4:E4` | Reported by | Supervisor list in `BQ2:BQ15`: Alma Trejo, Elena Rodriguez, Lucio Reyes, Yosef Tadesse, Marie Gonzalez, Mohammad Karimi, Anas Abduljabar, Angel Salazar, Ana Castro, Adrian Ruiz. |
| `D5:E5` | Shift | `First`, `Second`. |
| `C17`, `C19`, `C21`, `C23` | Changeover/rework assembly line selector | Line 1 Assembly, Line 2 Assembly, Line 3 Assembly, Line 5 Assembly. The pack-off row is derived automatically. |

In the web app, the supervisor dropdown should preferably come from users/roles instead of a hardcoded Excel list, but the Excel list can be used as the first seed.

## Manual Inputs

These are the fields users should edit in the web feature.

### Header Inputs

| Field | Web control |
| --- | --- |
| Reported by | User dropdown or current user default |
| Date | Date picker |
| Shift | Dropdown: First, Second |
| Safety concerns/incidents | Text area |
| Quality issues/holds | Text area |

### Row Inputs

For production, changeover, and rework rows, the yellow fields become editable controls:

| Field | Web control |
| --- | --- |
| Location/line where applicable | Dropdown, with pack-off rows derived from selected assembly row |
| Item number | Searchable item dropdown, backed by item/rate master data |
| Cases scheduled | Numeric input |
| Cases produced | Numeric input |
| Actual start time | Time picker |
| Actual end time | Time picker |
| Down minutes | Numeric input |
| Downtime team should know about | Text input or text area |
| Waste pounds | Numeric input |
| Actual headcount | Numeric input |

### Notes Inputs

The yellow line notes section should become structured notes:

| Area | Web control |
| --- | --- |
| Line 1 notes | Multiline text area |
| Line 2 notes | Multiline text area |
| Line 3 notes | Multiline text area |
| Line 5 notes | Multiline text area |

## Backend Calculations

The backend should own every calculation. The frontend should display calculated results but should not be trusted as the source of truth.

Important calculations to port from Excel:

| Calculated field | Current Excel behavior | Backend behavior |
| --- | --- | --- |
| Day | `TEXT(date, "dddd")` | Derive from report date using the site timezone. |
| Description | `VLOOKUP(itemNo, Rates, descriptionColumn)` | Lookup item master/rate reference data. |
| Pounds scheduled | Item pounds/case factor x cases scheduled | Lookup conversion factor, multiply by scheduled cases. |
| Pounds produced | Item pounds/case factor x cases produced | Lookup conversion factor, multiply by produced cases. |
| Attainment | Produced / scheduled, sometimes pounds-based and sometimes cases-based | Preserve row-specific Excel behavior. |
| Scheduled start time | Shift plus line schedule helper table | Lookup shift schedule template by line/station/shift. |
| Total time | End time - start time, in minutes | Calculate minutes, including shifts crossing midnight. |
| Minutes late start | Actual start - scheduled start, in minutes | Calculate signed difference; preserve negative/positive behavior. |
| Eaches scheduled | Item eaches factor x cases scheduled | Lookup reference factor. |
| Eaches produced | Item eaches factor x cases produced | Lookup reference factor. |
| Labor efficiency | Produced pounds / actual headcount | Preserve the Excel formula unless the business wants a corrected definition. |
| TMAX rate | Item and line lookup | Lookup from Rates or Line 3/Line 5 override table. |
| Run rate | Produced eaches or cases / total minutes | Preserve row-specific formula. |
| Performance | Run rate / TMAX rate | Calculate in backend. |
| Availability | `(total minutes - downtime adjustment) / total minutes` | Preserve Excel behavior, but validate the current unit handling. |
| Waste percent | Waste pounds / pounds produced | Calculate in backend. |
| Standard headcount | Item and row-type lookup | Lookup standard headcount. |
| Headcount percent | Actual headcount / standard headcount | Calculate in backend. |
| Shift totals | Sums and averages across production/changeover/rework rows | Calculate in backend from saved rows. |

Important note: the visible `OEE %` column is blacked out in the workbook. The shift total row contains an average over the OEE column, but the row cells do not contain active formulas in this workbook version. We should not invent this formula quietly. We should confirm the business rule before making OEE visible. If the intended rule is Performance x Availability x Quality, we can add it, but it should be a confirmed requirement.

## Proposed Database Design

This should be a new production reporting module, not squeezed into the current bakery metrics tables. The existing bakery metrics feature is a smaller weekly KPI submission flow; this end-of-shift workbook captures much more operational detail.

Recommended Prisma models:

### `EndOfShiftReport`

Stores one report header per organization, date, and shift.

Core fields:

| Field | Purpose |
| --- | --- |
| `id` | Primary key |
| `organizationId` | Tenant/org scope |
| `reportDate` | The production date |
| `dayOfWeek` | Backend-derived day name |
| `shift` | First or Second |
| `reportedByUserId` | Linked user when possible |
| `reportedByName` | Display snapshot |
| `safetyConcerns` | Header text area |
| `qualityIssues` | Header text area |
| `status` | Draft, submitted, approved, locked |
| `templateVersion` | Calculation/template version used |
| `calculationSnapshot` | JSON snapshot of totals and calculated summary |
| `submittedAt` | Submission timestamp |
| `submittedByUserId` | User who submitted |
| `createdAt`, `updatedAt` | Audit timestamps |

Suggested unique rule:

```prisma
@@unique([organizationId, reportDate, shift])
```

### `EndOfShiftReportLine`

Stores each row in Production, Changeovers, and Rework.

Core fields:

| Field | Purpose |
| --- | --- |
| `id` | Primary key |
| `reportId` | Parent report |
| `section` | Production, Changeover, Rework |
| `rowKey` | Stable row identity, for example `line1_assembly` |
| `sortOrder` | Display order |
| `location` | Kitchen, Line 1 Assembly, Line 1 Pack Off, etc. |
| `lineGroup` | Kitchen, Line 1, Line 2, Line 3, Line 5 |
| `stationType` | Assembly, PackOff, Kitchen |
| `itemNo` | User-selected item number |
| `itemDescriptionSnapshot` | Description at time of calculation |
| `casesScheduled` | Manual input |
| `casesProduced` | Manual input |
| `actualStartTime` | Manual input |
| `actualEndTime` | Manual input |
| `downMinutes` | Manual input |
| `downtimeComment` | Manual input |
| `wasteLbs` | Manual input |
| `actualHeadcount` | Manual input |
| `calculatedValues` | JSON for formula output and traceability |

We can also store important calculated values as typed numeric columns for faster reporting:

| Column | Why store it |
| --- | --- |
| `lbsScheduled`, `lbsProduced` | Dashboard and report queries |
| `attainmentPct` | KPI trends |
| `scheduledStartTime` | Late-start analysis |
| `totalMinutes`, `lateStartMinutes` | Schedule adherence |
| `eachesScheduled`, `eachesProduced` | Throughput |
| `laborEfficiency` | Labor KPI |
| `tmaxRate`, `runRate`, `performancePct` | Production performance |
| `availabilityPct` | Downtime KPI |
| `wastePct` | Waste KPI |
| `standardHeadcount`, `headcountPct` | Staffing KPI |

### `EndOfShiftReportNote`

Stores the Line 1, Line 2, Line 3, and Line 5 notes as structured records.

### `ProductionItemMaster`

Stores item/SKU master data imported from `DATA`, `Rates`, `MES`, and line-specific reference sheets.

### `ProductionRate`

Stores item-specific calculation factors:

| Example field | Source |
| --- | --- |
| item number | `Rates`, `DATA`, `MES` |
| description | `Rates`, `DATA` |
| pounds per case/conversion factor | `Rates` |
| eaches scheduled factor | `Rates` |
| eaches produced factor | `Rates` |
| standard headcount assembly | `Rates` |
| standard headcount pack-off | `Rates` |
| TMAX assembly | `Rates` |
| TMAX pack-off | `Rates` or line override sheets |
| line applicability | line-specific sheets and `MES` |

### `ShiftScheduleTemplate`

Stores scheduled start/end times by shift and station:

| Field | Purpose |
| --- | --- |
| `shift` | First or Second |
| `location` | Line 1 Assembly, Line 1 Pack Off, etc. |
| `scheduledStartTime` | Backend lookup value |
| `scheduledEndTime` | Optional |
| `scheduledMinutes` | Optional |
| `effectiveFrom`, `effectiveTo` | Versioning for schedule changes |

### `EndOfShiftReportAuditLog`

Stores who changed what and when. This matters because this will become an enterprise operational record, not just a spreadsheet replacement.

## Calculation Engine Plan

Create a backend service such as:

```text
backend/src/services/endOfShiftReportCalculationService.ts
```

Responsibilities:

1. Accept report header plus manual row inputs.
2. Load reference data from the database.
3. Run formula functions that mirror the Excel workbook.
4. Return calculated rows, totals, validation warnings, and formula trace metadata.
5. Save calculated snapshots when reports are saved or submitted.

Use a formula registry so each calculated field is easy to test:

```text
description = lookupDescription(itemNo)
lbsScheduled = poundsPerCase(itemNo) * casesScheduled
lbsProduced = poundsPerCase(itemNo) * casesProduced
attainmentPct = lbsProduced / lbsScheduled
totalMinutes = minutesBetween(actualStart, actualEnd, { allowMidnightWrap: true })
lateStartMinutes = minutesBetween(scheduledStart, actualStart, { signed: true })
wastePct = wasteLbs / lbsProduced
headcountPct = actualHeadcount / standardHeadcount
```

The service must handle:

| Concern | Required behavior |
| --- | --- |
| Midnight crossing | Second shift can start before midnight and end after midnight. Time math must support this. |
| Empty rows | Blank item rows should stay blank and should not break totals. |
| Divide by zero | Return blank or zero exactly where Excel currently does. |
| Missing item references | Show validation errors before submit. |
| Decimal math | Use safe decimal handling, not floating point for final stored KPI values. |
| Formula versioning | Store the calculation version used for each report. |
| Formula traceability | Keep enough metadata to explain how a value was calculated. |

## API Plan

Recommended backend routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/end-of-shift-reports/template?shift=Second` | Return form layout, dropdown options, default rows, and schedule data. |
| `GET` | `/api/end-of-shift-reports/items?query=65768` | Search item/rate master data for item dropdowns. |
| `POST` | `/api/end-of-shift-reports/calculate` | Calculate a draft without saving, useful for live UI updates. |
| `POST` | `/api/end-of-shift-reports` | Create/save draft report. |
| `GET` | `/api/end-of-shift-reports/:id` | Load one report. |
| `PATCH` | `/api/end-of-shift-reports/:id` | Save changes to a draft or editable submitted report. |
| `POST` | `/api/end-of-shift-reports/:id/submit` | Submit and lock calculations. |
| `POST` | `/api/end-of-shift-reports/:id/reopen` | Admin/supervisor reopen flow. |
| `GET` | `/api/end-of-shift-reports` | List/filter reports by date, shift, line, item, status. |
| `GET` | `/api/end-of-shift-reports/:id/export` | Export to PDF or Excel-like file. |
| `POST` | `/api/admin/end-of-shift-reference/import` | Admin-only import/update reference tables from workbook or CSV. |

## Frontend Plan

Create a dedicated web app route, likely:

```text
frontend/src/app/end-of-shift-report/page.tsx
```

or add it under the bakery/operations area if that better matches the current navigation.

Recommended components:

| Component | Purpose |
| --- | --- |
| `EndOfShiftReportPage` | Route-level container, filters, load/save state. |
| `EndOfShiftReportHeader` | Date, shift, reported by, safety, quality. |
| `EndOfShiftReportGrid` | Excel-like operational grid. |
| `EndOfShiftReportRow` | One production/changeover/rework row. |
| `ItemSearchSelect` | Searchable item dropdown with item description preview. |
| `CalculatedCell` | Read-only calculated values with formatting and color states. |
| `ShiftTotalsRow` | Backend-calculated totals and averages. |
| `LineNotesSection` | Structured line notes. |
| `ReportStatusBar` | Draft/submitted/locked status, save state, validation state. |

UX requirements:

1. Keep the form familiar to the Excel users.
2. Make yellow/manual cells visually obvious, but use a cleaner enterprise style than the spreadsheet.
3. Make calculated fields read-only and visibly different from inputs.
4. Autosave drafts or provide a very clear Save Draft button.
5. Provide Submit and Lock behavior for final shift records.
6. Show validation errors inline before submit.
7. Preserve color indicators for good/bad performance, waste, attainment, and headcount percent.
8. Support export back to PDF or Excel-style output for supervisors who still need a printable copy.

## Integration With Existing Bakery Metrics

The current bakery metrics module already stores weekly submissions, daily reports, standup reports, KPI targets, and activity logs. The new end-of-shift report should become a richer upstream data source.

Recommended approach:

1. Build the end-of-shift report as its own module.
2. Add a backend aggregation service that can derive daily/weekly bakery metrics from submitted end-of-shift reports.
3. Let the existing dashboard and standup report eventually read from the submitted end-of-shift data.
4. Keep the current bakery metrics form working during rollout, so operations are not interrupted.

This avoids breaking the existing bakery metrics workflow while giving us a path to retire duplicate manual entry later.

## Import And Migration Plan

The workbook should be used as the source for initial structure and fixtures, but the live web feature should not depend on Excel at runtime.

Steps:

1. Parse `End of Shift Report 05-15-2026.xlsx`.
2. Export reference data from `DATA`, `Rates`, `MES`, line-specific sheets, `Bakery`, and `Kitchen`.
3. Seed the new reference tables.
4. Create a JSON template map for first shift and second shift row layout.
5. Create a calculation fixture from the 05-15-2026 second shift workbook values.
6. Write tests that compare backend calculations against the workbook output.
7. Replace any external workbook links in `75% Temporary Data L3 & L5` with owned backend reference rows.

## Validation And Enterprise Controls

This feature should be treated as an official production record.

Required controls:

| Control | Behavior |
| --- | --- |
| Authentication | Only signed-in users can access the report. |
| Authorization | Role-based access for operators, supervisors, admins, and system admins. |
| Organization scoping | Users can only see reports for their organization. |
| Required fields | Yellow fields needed for a complete report must be enforced before submit. |
| Draft support | Users can save incomplete reports without submitting. |
| Submit/lock | Submitted reports should preserve the calculation snapshot. |
| Reopen/revision | Changes after submit should require permission and audit logging. |
| Audit trail | Track create, edit, submit, reopen, and export events. |
| Server validation | Do not trust client-side calculated values. |
| Reference versioning | Old reports must continue to show the values calculated with the reference data that existed at the time. |

## Suggested Rollout Phases

### Phase 1: Workbook Mapping And Reference Import

Deliverables:

1. Confirm final row/column map for first and second shift.
2. Build a workbook parser/import script.
3. Seed item, rate, schedule, and line reference data.
4. Create backend calculation fixtures from the workbook.

### Phase 2: Backend Data Model, APIs, And Calculation Service

Deliverables:

1. Add Prisma models and migration.
2. Add end-of-shift report routes.
3. Add calculation service.
4. Add validation service.
5. Add unit tests for formulas and time calculations.

### Phase 3: Web Form UI

Deliverables:

1. Build the Excel-like form layout.
2. Add item search/dropdowns.
3. Add live calculation preview using backend calculate endpoint.
4. Add save draft and submit flows.
5. Add validation and success states.

### Phase 4: Reporting, Dashboard, And Export

Deliverables:

1. Add list/detail views for submitted reports.
2. Add filters by date, shift, line, item, supervisor, and status.
3. Add PDF/Excel-style export.
4. Feed submitted data into bakery daily/standup reporting.

### Phase 5: Enterprise Hardening

Deliverables:

1. Add audit logs.
2. Add reopen/revision workflow.
3. Add admin screen for reference tables and schedule templates.
4. Add role-based permissions.
5. Add production monitoring and error logging.

## Open Questions To Confirm Before Implementation

1. Should this report be available only for the Don Miguel bakery operation, or should it be organization-configurable for future customers/sites?
2. Should the supervisor list come from current app users, from a dedicated supervisor table, or from the seeded Excel list?
3. Should first and second shift use exactly the same rows, or can the row template change by shift?
4. What is the official source of truth for `Rates`, `MES`, and line reference data after this feature goes live?
5. Should users be allowed to edit submitted reports, or should they request a supervisor/admin reopen?
6. What is the intended formula for the black `OEE %` column? The current workbook does not clearly calculate the row-level OEE values.
7. Should the app preserve Excel's exact quirks, or should we correct formulas that may contain unit issues, such as availability using downtime minutes divided by 60?
8. Should daily/weekly bakery metrics eventually be auto-generated from submitted end-of-shift reports?

## Recommended Next Step

Start with Phase 1. I would build a workbook-to-backend mapping artifact first, then create the reference import and calculation fixture. That gives us proof that the backend can reproduce the spreadsheet before we build the full UI around it.

Once Phase 1 passes, the rest becomes controlled engineering work: Prisma models, APIs, frontend form, and enterprise workflow.
