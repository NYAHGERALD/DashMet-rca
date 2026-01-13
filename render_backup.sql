--
-- PostgreSQL database dump
--

\restrict 7RgVOZybPgJ3QA3NfHIFlxmoiUba8ABmPJq9Iggc7PJl9A69FaqzL86IBV0dcok

-- Dumped from database version 18.1 (Debian 18.1-1.pgdg12+2)
-- Dumped by pg_dump version 18.1 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: rca_engine_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO rca_engine_user;

--
-- Name: ActionPriority; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."ActionPriority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE public."ActionPriority" OWNER TO rca_engine_user;

--
-- Name: ActionStatus; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."ActionStatus" AS ENUM (
    'PLANNED',
    'IN_PROGRESS',
    'COMPLETED',
    'VERIFIED',
    'INEFFECTIVE'
);


ALTER TYPE public."ActionStatus" OWNER TO rca_engine_user;

--
-- Name: ActionType; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."ActionType" AS ENUM (
    'CORRECTIVE',
    'PREVENTIVE'
);


ALTER TYPE public."ActionType" OWNER TO rca_engine_user;

--
-- Name: AuditAction; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."AuditAction" AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'LOGIN',
    'LOGOUT',
    'EXPORT',
    'VIEW'
);


ALTER TYPE public."AuditAction" OWNER TO rca_engine_user;

--
-- Name: ChatArchiveReason; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."ChatArchiveReason" AS ENUM (
    'TEAM_TO_PRIVATE',
    'TEAM_TO_PUBLIC',
    'LAST_MEMBER_REMOVED'
);


ALTER TYPE public."ChatArchiveReason" OWNER TO rca_engine_user;

--
-- Name: ChatMessageType; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."ChatMessageType" AS ENUM (
    'TEXT',
    'SYSTEM',
    'FILE',
    'IMAGE',
    'EVIDENCE_LINK',
    'RCA_LINK',
    'ACTION_ITEM',
    'STATUS_UPDATE',
    'HANDOFF',
    'DECISION',
    'QUESTION',
    'UPDATE',
    'ANNOUNCEMENT'
);


ALTER TYPE public."ChatMessageType" OWNER TO rca_engine_user;

--
-- Name: DropdownType; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."DropdownType" AS ENUM (
    'INJURY_TYPE',
    'TASK_FREQUENCY',
    'UNSAFE_ACT_CONDITION',
    'INJURY_DEVELOPMENT',
    'SEVERITY_LEVEL',
    'BODY_PART',
    'ENVIRONMENTAL_CONDITION',
    'CASE_CLASSIFICATION',
    'INJURY_WORK_RELATION',
    'TASK_ROUTINE_TYPE',
    'WEIGHT_FORCE_UNIT',
    'CONTRIBUTING_FACTOR_TYPE',
    'POSITION_JOB_TYPE',
    'INJURY_MECHANISM',
    'CORRECTIVE_ACTION_TYPE',
    'INCIDENT_PATTERN',
    'EMPLOYEE_LANGUAGE',
    'EMPLOYEE_GENDER',
    'RESPONSIBLE_PARTY',
    'PREVENTIVE_CONTROL_TYPE'
);


ALTER TYPE public."DropdownType" OWNER TO rca_engine_user;

--
-- Name: EvidenceType; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."EvidenceType" AS ENUM (
    'PHOTO',
    'VIDEO',
    'DOCUMENT',
    'VOICE_RECORDING'
);


ALTER TYPE public."EvidenceType" OWNER TO rca_engine_user;

--
-- Name: IncidentStatus; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."IncidentStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'IN_TRIAGE',
    'ASSIGNED',
    'IN_PROGRESS',
    'IN_REVIEW',
    'CLOSED',
    'REJECTED'
);


ALTER TYPE public."IncidentStatus" OWNER TO rca_engine_user;

--
-- Name: IncidentType; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."IncidentType" AS ENUM (
    'FOOD_SAFETY',
    'MACHINE_EQUIPMENT',
    'WORKPLACE_SAFETY'
);


ALTER TYPE public."IncidentType" OWNER TO rca_engine_user;

--
-- Name: IncidentVisibility; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."IncidentVisibility" AS ENUM (
    'PRIVATE',
    'TEAM',
    'PUBLIC'
);


ALTER TYPE public."IncidentVisibility" OWNER TO rca_engine_user;

--
-- Name: InvitationStatus; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."InvitationStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED'
);


ALTER TYPE public."InvitationStatus" OWNER TO rca_engine_user;

--
-- Name: Language; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."Language" AS ENUM (
    'ENGLISH',
    'SPANISH',
    'FRENCH',
    'GERMAN',
    'PORTUGUESE',
    'ITALIAN',
    'CHINESE',
    'JAPANESE',
    'KOREAN',
    'ARABIC',
    'HINDI',
    'RUSSIAN',
    'DUTCH',
    'POLISH',
    'TURKISH',
    'VIETNAMESE',
    'THAI',
    'INDONESIAN',
    'MALAY',
    'FILIPINO'
);


ALTER TYPE public."Language" OWNER TO rca_engine_user;

--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."NotificationType" AS ENUM (
    'INCIDENT_ASSIGNED',
    'INCIDENT_STATUS_CHANGED',
    'RCA_COMPLETED',
    'CAPA_DUE_SOON',
    'CAPA_OVERDUE',
    'COMMENT_ADDED',
    'INCIDENT_SUBMITTED',
    'INCIDENT_ESCALATED',
    'SLA_RESPONSE_WARNING',
    'SLA_RESPONSE_BREACHED',
    'SLA_RESOLUTION_WARNING',
    'SLA_RESOLUTION_BREACHED',
    'INCIDENT_UPDATED'
);


ALTER TYPE public."NotificationType" OWNER TO rca_engine_user;

--
-- Name: ParticipantRole; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."ParticipantRole" AS ENUM (
    'OWNER',
    'LEAD',
    'MEMBER',
    'OBSERVER'
);


ALTER TYPE public."ParticipantRole" OWNER TO rca_engine_user;

--
-- Name: PolicyType; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."PolicyType" AS ENUM (
    'PRIVACY_POLICY',
    'TERMS_OF_SERVICE',
    'COOKIE_POLICY',
    'SECURITY'
);


ALTER TYPE public."PolicyType" OWNER TO rca_engine_user;

--
-- Name: RCAMethod; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."RCAMethod" AS ENUM (
    'FIVE_WHYS',
    'FISHBONE',
    'FMEA',
    'FAULT_TREE'
);


ALTER TYPE public."RCAMethod" OWNER TO rca_engine_user;

--
-- Name: RCAStatus; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."RCAStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'IN_REVIEW',
    'VALIDATED',
    'COMPLETED'
);


ALTER TYPE public."RCAStatus" OWNER TO rca_engine_user;

--
-- Name: Region; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."Region" AS ENUM (
    'USA',
    'MEXICO',
    'CANADA'
);


ALTER TYPE public."Region" OWNER TO rca_engine_user;

--
-- Name: Severity; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."Severity" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE public."Severity" OWNER TO rca_engine_user;

--
-- Name: SupportCategory; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."SupportCategory" AS ENUM (
    'GENERAL_INQUIRY',
    'TECHNICAL_ISSUE',
    'BILLING_QUESTION',
    'FEATURE_REQUEST',
    'BUG_REPORT',
    'ACCOUNT_ASSISTANCE',
    'OTHER'
);


ALTER TYPE public."SupportCategory" OWNER TO rca_engine_user;

--
-- Name: SupportRequestStatus; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."SupportRequestStatus" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED'
);


ALTER TYPE public."SupportRequestStatus" OWNER TO rca_engine_user;

--
-- Name: Theme; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."Theme" AS ENUM (
    'LIGHT',
    'DARK',
    'SYSTEM'
);


ALTER TYPE public."Theme" OWNER TO rca_engine_user;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: rca_engine_user
--

CREATE TYPE public."UserRole" AS ENUM (
    'OPERATOR',
    'SUPERVISOR',
    'QA_FOOD_SAFETY',
    'MAINTENANCE_ENGINEERING',
    'CI_MANAGER',
    'ADMIN',
    'SYSTEM_ADMIN',
    'SAFETY_SECURITY_MANAGER'
);


ALTER TYPE public."UserRole" OWNER TO rca_engine_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AccessCode; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."AccessCode" (
    id text NOT NULL,
    code text NOT NULL,
    role public."UserRole" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "usedCount" integer DEFAULT 0 NOT NULL,
    "maxUses" integer DEFAULT 1000 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AccessCode" OWNER TO rca_engine_user;

--
-- Name: ArchivedChatMessage; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."ArchivedChatMessage" (
    id text NOT NULL,
    "originalMessageId" text NOT NULL,
    "incidentId" text NOT NULL,
    "userId" text NOT NULL,
    content text NOT NULL,
    "messageType" public."ChatMessageType" DEFAULT 'TEXT'::public."ChatMessageType" NOT NULL,
    "replyToId" text,
    "isEdited" boolean DEFAULT false NOT NULL,
    attachments jsonb,
    mentions text[] DEFAULT ARRAY[]::text[],
    "isPinned" boolean DEFAULT false NOT NULL,
    "pinnedAt" timestamp(3) without time zone,
    "pinnedById" text,
    "actionItemId" text,
    "evidenceId" text,
    "handoffData" jsonb,
    "rcaAnalysisId" text,
    "rcaItemId" text,
    "rcaItemType" text,
    "statusChange" jsonb,
    "announcementData" jsonb,
    "decisionData" jsonb,
    "questionData" jsonb,
    "updateData" jsonb,
    "originalCreatedAt" timestamp(3) without time zone NOT NULL,
    "archivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "archiveReason" public."ChatArchiveReason" DEFAULT 'TEAM_TO_PRIVATE'::public."ChatArchiveReason" NOT NULL,
    "archivedByUserId" text NOT NULL,
    "archiveBatchId" text NOT NULL,
    "senderFirstName" text NOT NULL,
    "senderLastName" text NOT NULL,
    "senderEmail" text NOT NULL
);


ALTER TABLE public."ArchivedChatMessage" OWNER TO rca_engine_user;

--
-- Name: Area; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Area" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "facilityId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "departmentId" text
);


ALTER TABLE public."Area" OWNER TO rca_engine_user;

--
-- Name: AssignmentRule; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."AssignmentRule" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "organizationId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    "incidentType" public."IncidentType",
    "categoryId" text,
    "facilityId" text,
    "areaId" text,
    severity public."Severity",
    "assignToUserId" text,
    "assignToRole" public."UserRole",
    "slaResponseHours" integer,
    "slaResolutionHours" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AssignmentRule" OWNER TO rca_engine_user;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    action public."AuditAction" NOT NULL,
    entity text NOT NULL,
    "entityId" text NOT NULL,
    "userId" text,
    changes jsonb,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuditLog" OWNER TO rca_engine_user;

--
-- Name: CAPAction; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."CAPAction" (
    id text NOT NULL,
    "actionType" public."ActionType" NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    status public."ActionStatus" DEFAULT 'PLANNED'::public."ActionStatus" NOT NULL,
    priority public."ActionPriority" NOT NULL,
    "ownerId" text NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "effectivenessReviewDate" timestamp(3) without time zone,
    "effectivenessScore" integer,
    "isEffective" boolean,
    "recurrenceDetected" boolean DEFAULT false NOT NULL,
    "aiQualityScore" double precision,
    "aiWeaknessFlags" text[],
    "resourceImpact" text,
    "rcaAnalysisId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "completedById" text,
    "completionEvidence" text,
    "completionNotes" text,
    "implementationNotes" text,
    "implementationPlan" text,
    "startedAt" timestamp(3) without time zone,
    "startedById" text,
    "verificationNotes" text,
    "verifiedAt" timestamp(3) without time zone,
    "verifiedById" text,
    "regulatoryTags" text[]
);


ALTER TABLE public."CAPAction" OWNER TO rca_engine_user;

--
-- Name: CAPAuditLog; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."CAPAuditLog" (
    id text NOT NULL,
    "capActionId" text NOT NULL,
    action text NOT NULL,
    "previousStatus" text,
    "newStatus" text,
    "previousData" jsonb,
    "newData" jsonb,
    notes text,
    evidence text,
    "performedById" text NOT NULL,
    "performedByName" text NOT NULL,
    "performedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "ipAddress" text,
    "userAgent" text
);


ALTER TABLE public."CAPAuditLog" OWNER TO rca_engine_user;

--
-- Name: Category; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    type public."IncidentType" NOT NULL,
    name text NOT NULL,
    "parentId" text,
    "allowCustomTitle" boolean DEFAULT false NOT NULL,
    "organizationId" text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Category" OWNER TO rca_engine_user;

--
-- Name: ChatMessage; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."ChatMessage" (
    id text NOT NULL,
    "incidentId" text NOT NULL,
    "userId" text NOT NULL,
    content text NOT NULL,
    "messageType" public."ChatMessageType" DEFAULT 'TEXT'::public."ChatMessageType" NOT NULL,
    "replyToId" text,
    "isEdited" boolean DEFAULT false NOT NULL,
    "isDeleted" boolean DEFAULT false NOT NULL,
    attachments jsonb,
    "readBy" text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isPinned" boolean DEFAULT false NOT NULL,
    mentions text[] DEFAULT ARRAY[]::text[],
    "pinnedAt" timestamp(3) without time zone,
    "pinnedById" text,
    "actionItemId" text,
    "evidenceId" text,
    "handoffData" jsonb,
    "rcaAnalysisId" text,
    "rcaItemId" text,
    "rcaItemType" text,
    "statusChange" jsonb,
    "announcementData" jsonb,
    "decisionData" jsonb,
    "questionData" jsonb,
    "updateData" jsonb
);


ALTER TABLE public."ChatMessage" OWNER TO rca_engine_user;

--
-- Name: ChatMessageReaction; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."ChatMessageReaction" (
    id text NOT NULL,
    "messageId" text NOT NULL,
    "userId" text NOT NULL,
    emoji text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ChatMessageReaction" OWNER TO rca_engine_user;

--
-- Name: ChatMessageTemplate; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."ChatMessageTemplate" (
    id text NOT NULL,
    "userId" text NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'general'::text NOT NULL,
    content text NOT NULL,
    "isGlobal" boolean DEFAULT false NOT NULL,
    "usageCount" integer DEFAULT 0 NOT NULL,
    "lastUsedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ChatMessageTemplate" OWNER TO rca_engine_user;

--
-- Name: Comment; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    content text NOT NULL,
    "userId" text NOT NULL,
    "incidentId" text,
    "rcaAnalysisId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Comment" OWNER TO rca_engine_user;

--
-- Name: Department; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Department" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "facilityId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Department" OWNER TO rca_engine_user;

--
-- Name: DropdownOption; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."DropdownOption" (
    id text NOT NULL,
    "optionType" public."DropdownType" NOT NULL,
    value text NOT NULL,
    label text NOT NULL,
    description text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isDefault" boolean DEFAULT false NOT NULL,
    "isRequired" boolean DEFAULT false NOT NULL,
    placeholder text,
    "organizationId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."DropdownOption" OWNER TO rca_engine_user;

--
-- Name: Evidence; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Evidence" (
    id text NOT NULL,
    type public."EvidenceType" NOT NULL,
    "fileName" text NOT NULL,
    "filePath" text NOT NULL,
    "fileSize" integer NOT NULL,
    "mimeType" text NOT NULL,
    transcription text,
    "incidentId" text,
    "rcaAnalysisId" text,
    "uploadedById" text NOT NULL,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Evidence" OWNER TO rca_engine_user;

--
-- Name: Facility; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Facility" (
    id text NOT NULL,
    name text NOT NULL,
    timezone text DEFAULT 'America/New_York'::text NOT NULL,
    address text,
    "organizationId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Facility" OWNER TO rca_engine_user;

--
-- Name: FieldConfiguration; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."FieldConfiguration" (
    id text NOT NULL,
    "incidentType" text NOT NULL,
    "fieldName" text NOT NULL,
    "fieldLabel" text NOT NULL,
    "fieldType" text NOT NULL,
    "isRequired" boolean DEFAULT false NOT NULL,
    placeholder text,
    "helpText" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "organizationId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."FieldConfiguration" OWNER TO rca_engine_user;

--
-- Name: Incident; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Incident" (
    id text NOT NULL,
    "incidentNumber" text NOT NULL,
    type public."IncidentType" NOT NULL,
    "categoryId" text NOT NULL,
    "customTitle" text,
    "facilityId" text NOT NULL,
    "areaId" text,
    "lineId" text,
    "shiftId" text,
    "productName" text,
    "lotNumber" text,
    "machineId" text,
    description text NOT NULL,
    "aiSummary" text,
    "aiAnalysisData" jsonb,
    "occurredAt" timestamp(3) without time zone NOT NULL,
    "reportedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."IncidentStatus" DEFAULT 'DRAFT'::public."IncidentStatus" NOT NULL,
    severity public."Severity",
    "aiSuggestedSeverity" public."Severity",
    "createdById" text NOT NULL,
    "assignedToId" text,
    "dueDate" timestamp(3) without time zone,
    "organizationId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "departmentId" text,
    "additionalEmployerHours" text,
    "additionalEmployerStartDate" timestamp(3) without time zone,
    "additionalEmployers" text,
    "allBodyPartsInjured" text,
    "areaSecured" text,
    "assignmentRuleId" text,
    "autoAssigned" boolean DEFAULT false NOT NULL,
    "bodyPartsAffected" text[],
    "caseClassification" text,
    "contributingActsConditions" text,
    "contributingFactors" jsonb,
    "dateIncidentReported" timestamp(3) without time zone,
    "dateInjuryKnownWorkRelated" timestamp(3) without time zone,
    "dateOfInjury" timestamp(3) without time zone,
    "dateTimeLeftWork" timestamp(3) without time zone,
    "dateTimeReturnedToWork" timestamp(3) without time zone,
    "didLeaveWork" boolean,
    "didReturnToWork" boolean,
    "didSiteRevealCause" boolean,
    "directCause" text,
    "employedElsewhere" boolean,
    "employeeIdNumber" text,
    "employeeName" text,
    "environmentalConditions" text[],
    "escalatedAt" timestamp(3) without time zone,
    "escalatedToId" text,
    "exposureDuration" text,
    "firstAidProvided" boolean,
    "hadPhysicalRestrictions" boolean,
    "incidentDate" timestamp(3) without time zone,
    "incidentDescriptionDetailed" text,
    "incidentTime" text,
    "inconsistencyExplanation" text,
    "injuryCausedByWork" text,
    "injuryDescriptionDetailed" text,
    "injuryDevelopedOverTime" boolean,
    "injuryDevelopmentPattern" text,
    "injuryLocation" text,
    "injuryType" text,
    "injuryTypeDescription" text,
    "injuryWitnessed" boolean,
    "injuryWorkRelation" text,
    "interviewedNames" text,
    "investigationBodyParts" text[],
    "investigationInjuryType" text,
    "investigationSubmittedAt" timestamp(3) without time zone,
    "investigationSubmittedById" text,
    "isAreaUnderSurveillance" boolean,
    "isOshaRecordable" boolean,
    "isRoutineTask" boolean,
    "knownRestrictions" text,
    "leaderActsConditionsOpinion" text,
    "lotoRequired" text,
    "machineSafeguardsInPlace" text,
    "medicalProvidersInvolved" text,
    "medicalTreatmentRequired" boolean,
    "notifiedIndividuals" text,
    "otherBodyPartDetail" text,
    "otherDutiesExplanation" text,
    "otherEmployerNames" text,
    "positionAtTimeOfIncident" text,
    "ppeRequired" boolean,
    "ppeWorn" boolean,
    "preventionRecommendations" text,
    "previousSimilarConditionDetails" text,
    "previousSimilarConditionReported" boolean,
    "previousSimilarIncidents" boolean,
    "priorSurgeryDescription" text,
    "priorSurgeryPerformed" boolean,
    "reportedToMedicalDept" boolean,
    "resolvedAt" timestamp(3) without time zone,
    "respondedAt" timestamp(3) without time zone,
    "siteRevealExplanation" text,
    "siteViewDate" timestamp(3) without time zone,
    "siteViewTime" text,
    "slaResolutionBreached" boolean DEFAULT false NOT NULL,
    "slaResolutionDeadline" timestamp(3) without time zone,
    "slaResponseBreached" boolean DEFAULT false NOT NULL,
    "slaResponseDeadline" timestamp(3) without time zone,
    "sopAvailable" boolean,
    "sopFollowed" boolean,
    "specificInjuryLocation" text,
    "supervisorActions" text,
    "supervisorNotified" boolean,
    "taskBeingPerformed" text,
    "taskFrequency" text,
    "timeOfInjury" text,
    "treatingDoctors" text,
    "unsafeActOrCondition" text,
    "wasClockedIn" boolean,
    "wasIncidentSiteViewed" boolean,
    "wasInjuryConsistentWithSite" boolean,
    "wasInjuryWitnessed" boolean,
    "wasPerformingOtherDuties" boolean,
    "wasSurveillanceAvailable" boolean,
    "weightOrForce" text,
    "weightOrForceUnit" text,
    "wereCoworkersPresent" boolean,
    "wereInterviewsDocumented" boolean,
    "werePhotosVideosTaken" boolean,
    "witnessNames" text,
    "witnessNamesList" text,
    "workedForOtherLast6Months" boolean,
    "environmentalConditionsNA" boolean,
    "bodyPartsAffectedNA" boolean,
    "departmentWhereInjury" text,
    "employeeEmail" text,
    "employeeGender" text,
    "employeeHomeAddress" text,
    "employeeLanguage" text,
    "employeeLastSSN4" text,
    "employeePhone" text,
    "interpreterAssisting" boolean,
    "isLostTime" boolean,
    "jobAssignmentAtInjury" text,
    "needsInterpreter" boolean,
    "oshaCaseNumber" text,
    "ownedJobTitle" text,
    "wasEmployeeInstructedInSOP" boolean,
    "wasProperProcedureFollowed" boolean,
    "wasViolationOfSafetyRules" boolean,
    "isTeamIncident" boolean DEFAULT false NOT NULL,
    visibility public."IncidentVisibility" DEFAULT 'PRIVATE'::public."IncidentVisibility" NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    "sharedWithUserIds" text[],
    "contributingFactorTypes" text[],
    "correctiveActionTypes" text[],
    "incidentPattern" text,
    "injuryDevelopmentType" text,
    "taskRoutineType" text
);


ALTER TABLE public."Incident" OWNER TO rca_engine_user;

--
-- Name: IncidentParticipant; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."IncidentParticipant" (
    id text NOT NULL,
    "incidentId" text NOT NULL,
    "userId" text NOT NULL,
    role public."ParticipantRole" DEFAULT 'MEMBER'::public."ParticipantRole" NOT NULL,
    "addedById" text NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "leftAt" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "canEdit" boolean DEFAULT true NOT NULL,
    "canChat" boolean DEFAULT true NOT NULL,
    "lastViewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "invitationStatus" public."InvitationStatus" DEFAULT 'PENDING'::public."InvitationStatus" NOT NULL,
    "invitedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "respondedAt" timestamp(3) without time zone
);


ALTER TABLE public."IncidentParticipant" OWNER TO rca_engine_user;

--
-- Name: KnowledgeArticle; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."KnowledgeArticle" (
    id text NOT NULL,
    title text NOT NULL,
    summary text NOT NULL,
    "sourceIncidentId" text NOT NULL,
    "incidentType" public."IncidentType" NOT NULL,
    "categoryNames" text[],
    "rootCause" text NOT NULL,
    "successfulActions" text[],
    keywords text[],
    "viewCount" integer DEFAULT 0 NOT NULL,
    "helpfulCount" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."KnowledgeArticle" OWNER TO rca_engine_user;

--
-- Name: Line; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Line" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "machineIds" text[],
    "areaId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lineNumber" text
);


ALTER TABLE public."Line" OWNER TO rca_engine_user;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    type public."NotificationType" NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "userId" text NOT NULL,
    "incidentId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Notification" OWNER TO rca_engine_user;

--
-- Name: Organization; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Organization" (
    id text NOT NULL,
    name text NOT NULL,
    region public."Region" NOT NULL,
    "defaultLanguage" public."Language" DEFAULT 'ENGLISH'::public."Language" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "regulatoryRuleset" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    "signupCode" text
);


ALTER TABLE public."Organization" OWNER TO rca_engine_user;

--
-- Name: PolicyDocument; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."PolicyDocument" (
    id text NOT NULL,
    type public."PolicyType" NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "isPublished" boolean DEFAULT false NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "updatedByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PolicyDocument" OWNER TO rca_engine_user;

--
-- Name: PolicyRevision; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."PolicyRevision" (
    id text NOT NULL,
    "policyId" text NOT NULL,
    version integer NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    "createdByUserId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."PolicyRevision" OWNER TO rca_engine_user;

--
-- Name: RCAAnalysis; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."RCAAnalysis" (
    id text NOT NULL,
    method public."RCAMethod" NOT NULL,
    status public."RCAStatus" DEFAULT 'NOT_STARTED'::public."RCAStatus" NOT NULL,
    "incidentId" text NOT NULL,
    "aiRecommendedMethod" public."RCAMethod",
    "aiRecommendationReason" text,
    "rootCauseStatement" text,
    "fiveWhysData" jsonb,
    "fishboneData" jsonb,
    "isValidated" boolean DEFAULT false NOT NULL,
    "validatedAt" timestamp(3) without time zone,
    "validatedById" text,
    "analystId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."RCAAnalysis" OWNER TO rca_engine_user;

--
-- Name: RCAVersion; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."RCAVersion" (
    id text NOT NULL,
    "versionNumber" integer NOT NULL,
    data jsonb NOT NULL,
    "changedBy" text NOT NULL,
    "changeReason" text,
    "rcaAnalysisId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."RCAVersion" OWNER TO rca_engine_user;

--
-- Name: SLAConfiguration; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."SLAConfiguration" (
    id text NOT NULL,
    "organizationId" text NOT NULL,
    severity public."Severity" NOT NULL,
    "responseTimeHours" integer NOT NULL,
    "resolutionTimeHours" integer NOT NULL,
    "escalationEnabled" boolean DEFAULT true NOT NULL,
    "escalationAfterHours" integer,
    "escalationToRole" public."UserRole",
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."SLAConfiguration" OWNER TO rca_engine_user;

--
-- Name: Session; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "userId" text NOT NULL,
    token text NOT NULL,
    "refreshToken" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "deviceInfo" text,
    "ipAddress" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Session" OWNER TO rca_engine_user;

--
-- Name: Shift; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."Shift" (
    id text NOT NULL,
    name text NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text NOT NULL,
    "facilityId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lineId" text
);


ALTER TABLE public."Shift" OWNER TO rca_engine_user;

--
-- Name: ShiftLine; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."ShiftLine" (
    id text NOT NULL,
    "shiftId" text NOT NULL,
    "lineId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ShiftLine" OWNER TO rca_engine_user;

--
-- Name: SupportRequest; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."SupportRequest" (
    id text NOT NULL,
    "submittedByUserId" text,
    "organizationId" text,
    category public."SupportCategory" NOT NULL,
    description text NOT NULL,
    status public."SupportRequestStatus" DEFAULT 'OPEN'::public."SupportRequestStatus" NOT NULL,
    "internalNotes" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    "resolvedByUserId" text,
    subject text NOT NULL,
    "submittedByUserEmail" text
);


ALTER TABLE public."SupportRequest" OWNER TO rca_engine_user;

--
-- Name: User; Type: TABLE; Schema: public; Owner: rca_engine_user
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    password text,
    "workEmail" text,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    role public."UserRole" NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "emailVerified" boolean DEFAULT false NOT NULL,
    "mfaEnabled" boolean DEFAULT false NOT NULL,
    "mfaSecret" text,
    theme public."Theme" DEFAULT 'LIGHT'::public."Theme" NOT NULL,
    language public."Language" DEFAULT 'ENGLISH'::public."Language" NOT NULL,
    "defaultSiteId" text,
    "defaultLineId" text,
    "loginAttempts" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp(3) without time zone,
    "lastLoginAt" timestamp(3) without time zone,
    "lastLoginIp" text,
    "passwordResetToken" text,
    "passwordResetExpires" timestamp(3) without time zone,
    "organizationId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "firebaseUid" text,
    "isOnline" boolean DEFAULT false NOT NULL,
    "lastSeenAt" timestamp(3) without time zone,
    "socketId" text,
    "profilePicture" text
);


ALTER TABLE public."User" OWNER TO rca_engine_user;

--
-- Data for Name: AccessCode; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."AccessCode" (id, code, role, "isActive", "usedCount", "maxUses", "createdAt", "updatedAt") FROM stdin;
98078265-cc3e-4fc7-9856-ad94b9e446b4	299053	ADMIN	t	0	1	2026-01-12 01:05:12.342	2026-01-12 01:18:35.014
baaa46e8-255f-4cf3-8773-34b1db074874	123456	ADMIN	t	1	1	2026-01-11 23:02:46.535	2026-01-12 01:19:01.886
4b82f81c-c394-4780-bc11-80bfc99ee09f	654321	SYSTEM_ADMIN	t	1	1000	2026-01-12 05:18:11.835	2026-01-12 05:21:18.299
\.


--
-- Data for Name: ArchivedChatMessage; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."ArchivedChatMessage" (id, "originalMessageId", "incidentId", "userId", content, "messageType", "replyToId", "isEdited", attachments, mentions, "isPinned", "pinnedAt", "pinnedById", "actionItemId", "evidenceId", "handoffData", "rcaAnalysisId", "rcaItemId", "rcaItemType", "statusChange", "announcementData", "decisionData", "questionData", "updateData", "originalCreatedAt", "archivedAt", "archiveReason", "archivedByUserId", "archiveBatchId", "senderFirstName", "senderLastName", "senderEmail") FROM stdin;
\.


--
-- Data for Name: Area; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Area" (id, name, description, "facilityId", "createdAt", "updatedAt", "departmentId") FROM stdin;
b00e65f1-7027-47a9-8039-c9e55e714197	RTE (Ready To Eat)	\N	\N	2026-01-12 01:46:40.044	2026-01-12 01:46:40.044	281de2b5-5a90-4023-a313-34cda9d643b4
8e3771ff-739f-4cad-b7fe-4c5b6b71e457	Raw Area	\N	\N	2026-01-12 01:47:06.543	2026-01-12 01:47:06.543	281de2b5-5a90-4023-a313-34cda9d643b4
\.


--
-- Data for Name: AssignmentRule; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."AssignmentRule" (id, name, description, "organizationId", "isActive", priority, "incidentType", "categoryId", "facilityId", "areaId", severity, "assignToUserId", "assignToRole", "slaResponseHours", "slaResolutionHours", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."AuditLog" (id, action, entity, "entityId", "userId", changes, "ipAddress", "userAgent", "createdAt") FROM stdin;
\.


--
-- Data for Name: CAPAction; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."CAPAction" (id, "actionType", title, description, status, priority, "ownerId", "dueDate", "completedAt", "effectivenessReviewDate", "effectivenessScore", "isEffective", "recurrenceDetected", "aiQualityScore", "aiWeaknessFlags", "resourceImpact", "rcaAnalysisId", "createdAt", "updatedAt", "completedById", "completionEvidence", "completionNotes", "implementationNotes", "implementationPlan", "startedAt", "startedById", "verificationNotes", "verifiedAt", "verifiedById", "regulatoryTags") FROM stdin;
d9ea01f3-6afb-444a-8726-1200ad817e83	PREVENTIVE	Conduct a safety stand-down to review LOTO procedures with all employees on the Die Cut Line 1	Long-Term Action: Conduct a safety stand-down to review LOTO procedures with all employees on the Die Cut Line 1	PLANNED	HIGH	434f6086-a5b2-46b9-ae5c-ca7e83635325	2026-02-11 03:58:12.017	\N	\N	\N	\N	f	50	{"Lacks specific action verbs","No measurable success criteria"}	\N	d4e4aa7d-5282-463c-8e59-2f518a247d15	2026-01-12 03:58:12.573	2026-01-12 03:58:12.573	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{}
5a2e2139-324e-4528-9200-f4f205427c5a	PREVENTIVE	Implement immediate supervision and oversight on Die Cut Line 1 to ensure compliance with safety procedures	Long-Term Action: Implement immediate supervision and oversight on Die Cut Line 1 to ensure compliance with safety procedures	PLANNED	HIGH	434f6086-a5b2-46b9-ae5c-ca7e83635325	2026-02-11 03:58:12.58	\N	\N	\N	\N	f	70	{"No measurable success criteria"}	\N	d4e4aa7d-5282-463c-8e59-2f518a247d15	2026-01-12 03:58:13.618	2026-01-12 03:58:13.618	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{}
ce3ae5f1-cbad-4782-9d21-e605db6ea72e	PREVENTIVE	Update the safety training program to include comprehensive LOTO procedures and conduct mandatory training sessions	Long-Term Action: Update the safety training program to include comprehensive LOTO procedures and conduct mandatory training sessions	PLANNED	MEDIUM	434f6086-a5b2-46b9-ae5c-ca7e83635325	2026-02-11 03:58:13.623	\N	\N	\N	\N	f	70	{"No measurable success criteria"}	\N	d4e4aa7d-5282-463c-8e59-2f518a247d15	2026-01-12 03:58:14.135	2026-01-12 03:58:14.135	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{}
6f620c82-6371-42f8-8e08-efc5b32d8d89	PREVENTIVE	Develop and distribute updated safety protocol documentation to all employees	Long-Term Action: Develop and distribute updated safety protocol documentation to all employees	PLANNED	MEDIUM	434f6086-a5b2-46b9-ae5c-ca7e83635325	2026-02-11 03:58:14.141	\N	\N	\N	\N	f	45	{"No measurable success criteria","Missing preventive focus"}	\N	d4e4aa7d-5282-463c-8e59-2f518a247d15	2026-01-12 03:58:14.233	2026-01-12 03:58:14.233	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{}
aa200e94-062a-419f-b026-1dc05849ff8b	PREVENTIVE	Establish a regular review and update schedule for all safety training programs and protocols	Long-Term Action: Establish a regular review and update schedule for all safety training programs and protocols	PLANNED	MEDIUM	434f6086-a5b2-46b9-ae5c-ca7e83635325	2026-02-11 03:58:14.238	\N	\N	\N	\N	f	60	{"No measurable success criteria"}	\N	d4e4aa7d-5282-463c-8e59-2f518a247d15	2026-01-12 03:58:14.298	2026-01-12 03:58:14.298	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{}
ef7f7813-cc5a-4049-93f7-af152264cc81	PREVENTIVE	Invest in a digital training platform to facilitate ongoing safety education and assessments	Long-Term Action: Invest in a digital training platform to facilitate ongoing safety education and assessments	PLANNED	LOW	434f6086-a5b2-46b9-ae5c-ca7e83635325	2026-02-11 03:58:14.303	\N	\N	\N	\N	f	60	{"No measurable success criteria"}	\N	d4e4aa7d-5282-463c-8e59-2f518a247d15	2026-01-12 03:58:15.182	2026-01-12 03:58:15.182	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	{}
\.


--
-- Data for Name: CAPAuditLog; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."CAPAuditLog" (id, "capActionId", action, "previousStatus", "newStatus", "previousData", "newData", notes, evidence, "performedById", "performedByName", "performedAt", "ipAddress", "userAgent") FROM stdin;
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Category" (id, type, name, "parentId", "allowCustomTitle", "organizationId", "sortOrder", "isActive", "createdAt", "updatedAt") FROM stdin;
00000000-0000-0000-0000-000000000100	FOOD_SAFETY	Foreign Material	\N	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:57.977	2026-01-11 22:41:57.977
00000000-0000-0000-0000-000000000101	FOOD_SAFETY	Metal	00000000-0000-0000-0000-000000000100	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:57.981	2026-01-11 22:41:57.981
00000000-0000-0000-0000-000000000102	FOOD_SAFETY	Plastic	00000000-0000-0000-0000-000000000100	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:57.983	2026-01-11 22:41:57.983
00000000-0000-0000-0000-000000000103	FOOD_SAFETY	Glass	00000000-0000-0000-0000-000000000100	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:57.984	2026-01-11 22:41:57.984
00000000-0000-0000-0000-000000000104	FOOD_SAFETY	Wood	00000000-0000-0000-0000-000000000100	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:57.986	2026-01-11 22:41:57.986
00000000-0000-0000-0000-000000000105	FOOD_SAFETY	Other	00000000-0000-0000-0000-000000000100	t	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:57.988	2026-01-11 22:41:57.988
00000000-0000-0000-0000-000000000110	FOOD_SAFETY	Micro	\N	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:57.989	2026-01-11 22:41:57.989
00000000-0000-0000-0000-000000000111	FOOD_SAFETY	Allergen	\N	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:57.99	2026-01-11 22:41:57.99
00000000-0000-0000-0000-000000000112	FOOD_SAFETY	Labeling	\N	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:57.992	2026-01-11 22:41:57.992
00000000-0000-0000-0000-000000000113	FOOD_SAFETY	Temperature	\N	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:57.993	2026-01-11 22:41:57.993
00000000-0000-0000-0000-000000000114	FOOD_SAFETY	Sanitation	\N	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:57.994	2026-01-11 22:41:57.994
00000000-0000-0000-0000-000000000115	FOOD_SAFETY	Supplier	\N	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:57.998	2026-01-11 22:41:57.998
00000000-0000-0000-0000-000000000116	FOOD_SAFETY	Packaging	\N	f	00000000-0000-0000-0000-000000000001	8	t	2026-01-11 22:41:58.006	2026-01-11 22:41:58.006
00000000-0000-0000-0000-000000000200	MACHINE_EQUIPMENT	Mechanical	\N	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.008	2026-01-11 22:41:58.008
00000000-0000-0000-0000-000000000201	MACHINE_EQUIPMENT	Electrical	\N	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.013	2026-01-11 22:41:58.013
00000000-0000-0000-0000-000000000202	MACHINE_EQUIPMENT	Controls	\N	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.015	2026-01-11 22:41:58.015
00000000-0000-0000-0000-000000000203	MACHINE_EQUIPMENT	Pneumatics	\N	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.016	2026-01-11 22:41:58.016
00000000-0000-0000-0000-000000000204	MACHINE_EQUIPMENT	Sensors	\N	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.02	2026-01-11 22:41:58.02
00000000-0000-0000-0000-000000000205	MACHINE_EQUIPMENT	Lubrication	\N	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.022	2026-01-11 22:41:58.022
00000000-0000-0000-0000-000000000206	MACHINE_EQUIPMENT	Calibration	\N	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.025	2026-01-11 22:41:58.025
00000000-0000-0000-0000-000000000207	MACHINE_EQUIPMENT	Changeover	\N	f	00000000-0000-0000-0000-000000000001	8	t	2026-01-11 22:41:58.048	2026-01-11 22:41:58.048
00000000-0000-0000-0000-000000000300	WORKPLACE_SAFETY	Physical Injury Hazards	\N	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.049	2026-01-11 22:41:58.049
00000000-0000-0000-0000-000000000301	WORKPLACE_SAFETY	Slips, Trips & Falls	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.05	2026-01-11 22:41:58.05
00000000-0000-0000-0000-000000000302	WORKPLACE_SAFETY	Cuts, Lacerations & Abrasions	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.051	2026-01-11 22:41:58.051
00000000-0000-0000-0000-000000000303	WORKPLACE_SAFETY	Punctures	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.052	2026-01-11 22:41:58.052
00000000-0000-0000-0000-000000000304	WORKPLACE_SAFETY	Bruises / Contusions	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.053	2026-01-11 22:41:58.053
00000000-0000-0000-0000-000000000305	WORKPLACE_SAFETY	Struck-By Objects	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.054	2026-01-11 22:41:58.054
00000000-0000-0000-0000-000000000306	WORKPLACE_SAFETY	Caught-In / Caught-Between	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.055	2026-01-11 22:41:58.055
00000000-0000-0000-0000-000000000307	WORKPLACE_SAFETY	Pinch Points	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.056	2026-01-11 22:41:58.056
00000000-0000-0000-0000-000000000308	WORKPLACE_SAFETY	Falling Objects	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	8	t	2026-01-11 22:41:58.057	2026-01-11 22:41:58.057
00000000-0000-0000-0000-000000000309	WORKPLACE_SAFETY	Head Injuries	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	9	t	2026-01-11 22:41:58.058	2026-01-11 22:41:58.058
00000000-0000-0000-0000-00000000030A	WORKPLACE_SAFETY	Eye Injuries	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	10	t	2026-01-11 22:41:58.059	2026-01-11 22:41:58.059
00000000-0000-0000-0000-00000000030B	WORKPLACE_SAFETY	Hand & Finger Injuries	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	11	t	2026-01-11 22:41:58.06	2026-01-11 22:41:58.06
00000000-0000-0000-0000-00000000030C	WORKPLACE_SAFETY	Foot & Ankle Injuries	00000000-0000-0000-0000-000000000300	f	00000000-0000-0000-0000-000000000001	12	t	2026-01-11 22:41:58.061	2026-01-11 22:41:58.061
00000000-0000-0000-0000-000000000310	WORKPLACE_SAFETY	Ergonomic & Musculoskeletal Safety	\N	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.062	2026-01-11 22:41:58.062
00000000-0000-0000-0000-000000000311	WORKPLACE_SAFETY	Manual Material Handling	00000000-0000-0000-0000-000000000310	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.063	2026-01-11 22:41:58.063
00000000-0000-0000-0000-000000000312	WORKPLACE_SAFETY	Overexertion	00000000-0000-0000-0000-000000000310	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.064	2026-01-11 22:41:58.064
00000000-0000-0000-0000-000000000313	WORKPLACE_SAFETY	Repetitive Motion	00000000-0000-0000-0000-000000000310	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.065	2026-01-11 22:41:58.065
00000000-0000-0000-0000-000000000314	WORKPLACE_SAFETY	Awkward Postures	00000000-0000-0000-0000-000000000310	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.066	2026-01-11 22:41:58.066
00000000-0000-0000-0000-000000000315	WORKPLACE_SAFETY	Forceful Exertions	00000000-0000-0000-0000-000000000310	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.067	2026-01-11 22:41:58.067
00000000-0000-0000-0000-000000000316	WORKPLACE_SAFETY	Push / Pull Hazards	00000000-0000-0000-0000-000000000310	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.068	2026-01-11 22:41:58.068
00000000-0000-0000-0000-000000000317	WORKPLACE_SAFETY	Lifting & Carrying	00000000-0000-0000-0000-000000000310	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.069	2026-01-11 22:41:58.069
00000000-0000-0000-0000-000000000318	WORKPLACE_SAFETY	Cumulative Trauma Disorders (CTD)	00000000-0000-0000-0000-000000000310	f	00000000-0000-0000-0000-000000000001	8	t	2026-01-11 22:41:58.07	2026-01-11 22:41:58.07
00000000-0000-0000-0000-000000000320	WORKPLACE_SAFETY	Machine & Equipment Safety	\N	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.071	2026-01-11 22:41:58.071
00000000-0000-0000-0000-000000000321	WORKPLACE_SAFETY	Machine Guarding	00000000-0000-0000-0000-000000000320	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.072	2026-01-11 22:41:58.072
00000000-0000-0000-0000-000000000322	WORKPLACE_SAFETY	Lockout / Tagout (LOTO)	00000000-0000-0000-0000-000000000320	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.073	2026-01-11 22:41:58.073
00000000-0000-0000-0000-000000000323	WORKPLACE_SAFETY	Mechanical Hazards	00000000-0000-0000-0000-000000000320	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.081	2026-01-11 22:41:58.081
00000000-0000-0000-0000-000000000324	WORKPLACE_SAFETY	Electrical Hazards	00000000-0000-0000-0000-000000000320	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.082	2026-01-11 22:41:58.082
00000000-0000-0000-0000-000000000325	WORKPLACE_SAFETY	Pneumatic / Hydraulic Hazards	00000000-0000-0000-0000-000000000320	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.083	2026-01-11 22:41:58.083
00000000-0000-0000-0000-000000000326	WORKPLACE_SAFETY	Sensors & Interlocks	00000000-0000-0000-0000-000000000320	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.084	2026-01-11 22:41:58.084
00000000-0000-0000-0000-000000000327	WORKPLACE_SAFETY	Emergency Stops	00000000-0000-0000-0000-000000000320	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.085	2026-01-11 22:41:58.085
00000000-0000-0000-0000-000000000328	WORKPLACE_SAFETY	Unexpected Startup	00000000-0000-0000-0000-000000000320	f	00000000-0000-0000-0000-000000000001	8	t	2026-01-11 22:41:58.086	2026-01-11 22:41:58.086
00000000-0000-0000-0000-000000000329	WORKPLACE_SAFETY	Unsafe Changeovers	00000000-0000-0000-0000-000000000320	f	00000000-0000-0000-0000-000000000001	9	t	2026-01-11 22:41:58.087	2026-01-11 22:41:58.087
00000000-0000-0000-0000-00000000032A	WORKPLACE_SAFETY	Maintenance Safety	00000000-0000-0000-0000-000000000320	f	00000000-0000-0000-0000-000000000001	10	t	2026-01-11 22:41:58.088	2026-01-11 22:41:58.088
00000000-0000-0000-0000-000000000330	WORKPLACE_SAFETY	Chemical & Hazardous Materials Safety	\N	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.089	2026-01-11 22:41:58.089
00000000-0000-0000-0000-000000000331	WORKPLACE_SAFETY	Chemical Exposure	00000000-0000-0000-0000-000000000330	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.09	2026-01-11 22:41:58.09
00000000-0000-0000-0000-000000000332	WORKPLACE_SAFETY	Ammonia Exposure	00000000-0000-0000-0000-000000000330	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.09	2026-01-11 22:41:58.09
00000000-0000-0000-0000-000000000333	WORKPLACE_SAFETY	Cleaning & Sanitation Chemicals	00000000-0000-0000-0000-000000000330	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.091	2026-01-11 22:41:58.091
00000000-0000-0000-0000-000000000334	WORKPLACE_SAFETY	SDS / GHS Labeling	00000000-0000-0000-0000-000000000330	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.092	2026-01-11 22:41:58.092
00000000-0000-0000-0000-000000000335	WORKPLACE_SAFETY	Chemical Storage	00000000-0000-0000-0000-000000000330	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.093	2026-01-11 22:41:58.093
00000000-0000-0000-0000-000000000336	WORKPLACE_SAFETY	Chemical Spills	00000000-0000-0000-0000-000000000330	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.094	2026-01-11 22:41:58.094
00000000-0000-0000-0000-000000000337	WORKPLACE_SAFETY	Incompatible Chemical Mixing	00000000-0000-0000-0000-000000000330	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.095	2026-01-11 22:41:58.095
00000000-0000-0000-0000-000000000338	WORKPLACE_SAFETY	Compressed Gases	00000000-0000-0000-0000-000000000330	f	00000000-0000-0000-0000-000000000001	8	t	2026-01-11 22:41:58.096	2026-01-11 22:41:58.096
00000000-0000-0000-0000-000000000339	WORKPLACE_SAFETY	Chemical PPE	00000000-0000-0000-0000-000000000330	f	00000000-0000-0000-0000-000000000001	9	t	2026-01-11 22:41:58.097	2026-01-11 22:41:58.097
00000000-0000-0000-0000-000000000340	WORKPLACE_SAFETY	Environmental & Exposure Hazards	\N	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.098	2026-01-11 22:41:58.098
00000000-0000-0000-0000-000000000341	WORKPLACE_SAFETY	Heat Stress	00000000-0000-0000-0000-000000000340	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.099	2026-01-11 22:41:58.099
00000000-0000-0000-0000-000000000342	WORKPLACE_SAFETY	Cold Stress	00000000-0000-0000-0000-000000000340	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.1	2026-01-11 22:41:58.1
00000000-0000-0000-0000-000000000343	WORKPLACE_SAFETY	Noise Exposure (Hearing Conservation)	00000000-0000-0000-0000-000000000340	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.101	2026-01-11 22:41:58.101
00000000-0000-0000-0000-000000000344	WORKPLACE_SAFETY	Air Quality / Ventilation	00000000-0000-0000-0000-000000000340	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.102	2026-01-11 22:41:58.102
00000000-0000-0000-0000-000000000345	WORKPLACE_SAFETY	Dust Exposure	00000000-0000-0000-0000-000000000340	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.103	2026-01-11 22:41:58.103
00000000-0000-0000-0000-000000000346	WORKPLACE_SAFETY	Fumes & Vapors	00000000-0000-0000-0000-000000000340	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.104	2026-01-11 22:41:58.104
00000000-0000-0000-0000-000000000347	WORKPLACE_SAFETY	Lighting Deficiencies	00000000-0000-0000-0000-000000000340	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.104	2026-01-11 22:41:58.104
00000000-0000-0000-0000-000000000348	WORKPLACE_SAFETY	Radiation (where applicable)	00000000-0000-0000-0000-000000000340	f	00000000-0000-0000-0000-000000000001	8	t	2026-01-11 22:41:58.106	2026-01-11 22:41:58.106
00000000-0000-0000-0000-000000000350	WORKPLACE_SAFETY	Fire & Emergency Safety	\N	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.107	2026-01-11 22:41:58.107
00000000-0000-0000-0000-000000000351	WORKPLACE_SAFETY	Fire Hazards	00000000-0000-0000-0000-000000000350	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.108	2026-01-11 22:41:58.108
00000000-0000-0000-0000-000000000352	WORKPLACE_SAFETY	Flammable Materials	00000000-0000-0000-0000-000000000350	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.108	2026-01-11 22:41:58.108
00000000-0000-0000-0000-000000000353	WORKPLACE_SAFETY	Emergency Evacuation	00000000-0000-0000-0000-000000000350	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.109	2026-01-11 22:41:58.109
00000000-0000-0000-0000-000000000354	WORKPLACE_SAFETY	Alarm Systems	00000000-0000-0000-0000-000000000350	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.11	2026-01-11 22:41:58.11
00000000-0000-0000-0000-000000000355	WORKPLACE_SAFETY	Emergency Exits & Egress	00000000-0000-0000-0000-000000000350	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.111	2026-01-11 22:41:58.111
00000000-0000-0000-0000-000000000356	WORKPLACE_SAFETY	Fire Suppression Systems	00000000-0000-0000-0000-000000000350	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.112	2026-01-11 22:41:58.112
00000000-0000-0000-0000-000000000357	WORKPLACE_SAFETY	Emergency Drills	00000000-0000-0000-0000-000000000350	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.113	2026-01-11 22:41:58.113
00000000-0000-0000-0000-000000000358	WORKPLACE_SAFETY	First Aid & AED	00000000-0000-0000-0000-000000000350	f	00000000-0000-0000-0000-000000000001	8	t	2026-01-11 22:41:58.113	2026-01-11 22:41:58.113
00000000-0000-0000-0000-000000000359	WORKPLACE_SAFETY	Emergency Response Procedures	00000000-0000-0000-0000-000000000350	f	00000000-0000-0000-0000-000000000001	9	t	2026-01-11 22:41:58.114	2026-01-11 22:41:58.114
00000000-0000-0000-0000-000000000360	WORKPLACE_SAFETY	Material Handling & Traffic Safety	\N	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.116	2026-01-11 22:41:58.116
00000000-0000-0000-0000-000000000361	WORKPLACE_SAFETY	Forklift Safety	00000000-0000-0000-0000-000000000360	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.116	2026-01-11 22:41:58.116
00000000-0000-0000-0000-000000000362	WORKPLACE_SAFETY	Pallet Jack Safety	00000000-0000-0000-0000-000000000360	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.117	2026-01-11 22:41:58.117
00000000-0000-0000-0000-000000000363	WORKPLACE_SAFETY	Dock Safety	00000000-0000-0000-0000-000000000360	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.118	2026-01-11 22:41:58.118
00000000-0000-0000-0000-000000000364	WORKPLACE_SAFETY	Trailer Safety	00000000-0000-0000-0000-000000000360	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.119	2026-01-11 22:41:58.119
00000000-0000-0000-0000-000000000365	WORKPLACE_SAFETY	Load Securing	00000000-0000-0000-0000-000000000360	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.119	2026-01-11 22:41:58.119
00000000-0000-0000-0000-000000000366	WORKPLACE_SAFETY	Pedestrian vs Vehicle Traffic	00000000-0000-0000-0000-000000000360	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.12	2026-01-11 22:41:58.12
00000000-0000-0000-0000-000000000367	WORKPLACE_SAFETY	Racking & Storage Safety	00000000-0000-0000-0000-000000000360	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.121	2026-01-11 22:41:58.121
00000000-0000-0000-0000-000000000370	WORKPLACE_SAFETY	Personal Protective Equipment (PPE)	\N	f	00000000-0000-0000-0000-000000000001	8	t	2026-01-11 22:41:58.122	2026-01-11 22:41:58.122
00000000-0000-0000-0000-000000000371	WORKPLACE_SAFETY	Head Protection	00000000-0000-0000-0000-000000000370	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.123	2026-01-11 22:41:58.123
00000000-0000-0000-0000-000000000372	WORKPLACE_SAFETY	Eye & Face Protection	00000000-0000-0000-0000-000000000370	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.124	2026-01-11 22:41:58.124
00000000-0000-0000-0000-000000000373	WORKPLACE_SAFETY	Hand Protection	00000000-0000-0000-0000-000000000370	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.125	2026-01-11 22:41:58.125
00000000-0000-0000-0000-000000000374	WORKPLACE_SAFETY	Foot Protection	00000000-0000-0000-0000-000000000370	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.126	2026-01-11 22:41:58.126
00000000-0000-0000-0000-000000000375	WORKPLACE_SAFETY	Hearing Protection	00000000-0000-0000-0000-000000000370	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.126	2026-01-11 22:41:58.126
00000000-0000-0000-0000-000000000376	WORKPLACE_SAFETY	Respiratory Protection	00000000-0000-0000-0000-000000000370	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.127	2026-01-11 22:41:58.127
00000000-0000-0000-0000-000000000377	WORKPLACE_SAFETY	Chemical-Resistant PPE	00000000-0000-0000-0000-000000000370	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.128	2026-01-11 22:41:58.128
00000000-0000-0000-0000-000000000378	WORKPLACE_SAFETY	High-Visibility PPE	00000000-0000-0000-0000-000000000370	f	00000000-0000-0000-0000-000000000001	8	t	2026-01-11 22:41:58.129	2026-01-11 22:41:58.129
00000000-0000-0000-0000-000000000380	WORKPLACE_SAFETY	Facility & Infrastructure Safety	\N	f	00000000-0000-0000-0000-000000000001	9	t	2026-01-11 22:41:58.13	2026-01-11 22:41:58.13
00000000-0000-0000-0000-000000000381	WORKPLACE_SAFETY	Floors & Walkways	00000000-0000-0000-0000-000000000380	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.131	2026-01-11 22:41:58.131
00000000-0000-0000-0000-000000000382	WORKPLACE_SAFETY	Stairs & Handrails	00000000-0000-0000-0000-000000000380	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.132	2026-01-11 22:41:58.132
00000000-0000-0000-0000-000000000383	WORKPLACE_SAFETY	Platforms & Mezzanines	00000000-0000-0000-0000-000000000380	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.133	2026-01-11 22:41:58.133
00000000-0000-0000-0000-000000000384	WORKPLACE_SAFETY	Doors & Dock Plates	00000000-0000-0000-0000-000000000380	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.133	2026-01-11 22:41:58.133
00000000-0000-0000-0000-000000000385	WORKPLACE_SAFETY	Roof Leaks / Condensation (Slip Risk)	00000000-0000-0000-0000-000000000380	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.134	2026-01-11 22:41:58.134
00000000-0000-0000-0000-000000000386	WORKPLACE_SAFETY	Housekeeping	00000000-0000-0000-0000-000000000380	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.135	2026-01-11 22:41:58.135
00000000-0000-0000-0000-000000000387	WORKPLACE_SAFETY	Structural Integrity	00000000-0000-0000-0000-000000000380	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.136	2026-01-11 22:41:58.136
00000000-0000-0000-0000-000000000390	WORKPLACE_SAFETY	Behavioral, Training & Compliance Safety	\N	f	00000000-0000-0000-0000-000000000001	10	t	2026-01-11 22:41:58.137	2026-01-11 22:41:58.137
00000000-0000-0000-0000-000000000391	WORKPLACE_SAFETY	Unsafe Acts	00000000-0000-0000-0000-000000000390	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.137	2026-01-11 22:41:58.137
00000000-0000-0000-0000-000000000392	WORKPLACE_SAFETY	SOP Non-Compliance	00000000-0000-0000-0000-000000000390	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.139	2026-01-11 22:41:58.139
00000000-0000-0000-0000-000000000393	WORKPLACE_SAFETY	Lack of Training	00000000-0000-0000-0000-000000000390	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.14	2026-01-11 22:41:58.14
00000000-0000-0000-0000-000000000394	WORKPLACE_SAFETY	Failure to Use PPE	00000000-0000-0000-0000-000000000390	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.141	2026-01-11 22:41:58.141
00000000-0000-0000-0000-000000000395	WORKPLACE_SAFETY	Near Misses	00000000-0000-0000-0000-000000000390	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.142	2026-01-11 22:41:58.142
00000000-0000-0000-0000-000000000396	WORKPLACE_SAFETY	Incident Reporting	00000000-0000-0000-0000-000000000390	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.143	2026-01-11 22:41:58.143
00000000-0000-0000-0000-000000000397	WORKPLACE_SAFETY	Contractor Safety	00000000-0000-0000-0000-000000000390	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.145	2026-01-11 22:41:58.145
00000000-0000-0000-0000-000000000398	WORKPLACE_SAFETY	Visitor Safety	00000000-0000-0000-0000-000000000390	f	00000000-0000-0000-0000-000000000001	8	t	2026-01-11 22:41:58.146	2026-01-11 22:41:58.146
00000000-0000-0000-0000-000000000399	WORKPLACE_SAFETY	Work Rule Violations	00000000-0000-0000-0000-000000000390	f	00000000-0000-0000-0000-000000000001	9	t	2026-01-11 22:41:58.147	2026-01-11 22:41:58.147
00000000-0000-0000-0000-0000000003A0	WORKPLACE_SAFETY	Health & Medical Management	\N	f	00000000-0000-0000-0000-000000000001	11	t	2026-01-11 22:41:58.148	2026-01-11 22:41:58.148
00000000-0000-0000-0000-0000000003A1	WORKPLACE_SAFETY	First Aid	00000000-0000-0000-0000-0000000003A0	f	00000000-0000-0000-0000-000000000001	1	t	2026-01-11 22:41:58.149	2026-01-11 22:41:58.149
00000000-0000-0000-0000-0000000003A2	WORKPLACE_SAFETY	OSHA Recordable Injuries	00000000-0000-0000-0000-0000000003A0	f	00000000-0000-0000-0000-000000000001	2	t	2026-01-11 22:41:58.151	2026-01-11 22:41:58.151
00000000-0000-0000-0000-0000000003A3	WORKPLACE_SAFETY	Restricted Duty	00000000-0000-0000-0000-0000000003A0	f	00000000-0000-0000-0000-000000000001	3	t	2026-01-11 22:41:58.152	2026-01-11 22:41:58.152
00000000-0000-0000-0000-0000000003A4	WORKPLACE_SAFETY	Lost Time Injuries	00000000-0000-0000-0000-0000000003A0	f	00000000-0000-0000-0000-000000000001	4	t	2026-01-11 22:41:58.153	2026-01-11 22:41:58.153
00000000-0000-0000-0000-0000000003A5	WORKPLACE_SAFETY	Occupational Illness	00000000-0000-0000-0000-0000000003A0	f	00000000-0000-0000-0000-000000000001	5	t	2026-01-11 22:41:58.157	2026-01-11 22:41:58.157
00000000-0000-0000-0000-0000000003A6	WORKPLACE_SAFETY	Return-to-Work	00000000-0000-0000-0000-0000000003A0	f	00000000-0000-0000-0000-000000000001	6	t	2026-01-11 22:41:58.16	2026-01-11 22:41:58.16
00000000-0000-0000-0000-0000000003A7	WORKPLACE_SAFETY	Fatigue Management	00000000-0000-0000-0000-0000000003A0	f	00000000-0000-0000-0000-000000000001	7	t	2026-01-11 22:41:58.161	2026-01-11 22:41:58.161
24c3142a-d1dc-400a-96d5-076ccb96d4a4	FOOD_SAFETY	Foreign Material	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.255	2026-01-12 01:57:51.255
64c430bb-b300-4043-af53-667087c45465	FOOD_SAFETY	Metal	24c3142a-d1dc-400a-96d5-076ccb96d4a4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.262	2026-01-12 01:57:51.262
e0500911-82cb-42e6-bbde-368bda5371bd	FOOD_SAFETY	Plastic	24c3142a-d1dc-400a-96d5-076ccb96d4a4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.262	2026-01-12 01:57:51.262
93d79b50-908b-4c50-b114-cb0f409b69d5	FOOD_SAFETY	Glass	24c3142a-d1dc-400a-96d5-076ccb96d4a4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.262	2026-01-12 01:57:51.262
08e9ef71-452c-44cf-8829-fa3a1a04530f	FOOD_SAFETY	Wood	24c3142a-d1dc-400a-96d5-076ccb96d4a4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.262	2026-01-12 01:57:51.262
6057f466-5c87-4996-9664-f4585c260e28	FOOD_SAFETY	Stone/Rocks	24c3142a-d1dc-400a-96d5-076ccb96d4a4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.262	2026-01-12 01:57:51.262
c6e4aedf-1b74-4493-8f23-ce1e53856407	FOOD_SAFETY	Rubber	24c3142a-d1dc-400a-96d5-076ccb96d4a4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.262	2026-01-12 01:57:51.262
b0abc05f-1db5-4913-a440-58b24013ce84	FOOD_SAFETY	Paper/Cardboard	24c3142a-d1dc-400a-96d5-076ccb96d4a4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.262	2026-01-12 01:57:51.262
ffef5494-001f-4a1d-8b04-3777753d5af6	FOOD_SAFETY	Insects/Pests	24c3142a-d1dc-400a-96d5-076ccb96d4a4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.262	2026-01-12 01:57:51.262
d9b06386-f413-4a4e-add3-2b73c6e6aa00	FOOD_SAFETY	Hair/Personal Items	24c3142a-d1dc-400a-96d5-076ccb96d4a4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.262	2026-01-12 01:57:51.262
e47713a3-e67c-4a5f-8d9e-278ffc6c81ed	FOOD_SAFETY	Other Foreign Material	24c3142a-d1dc-400a-96d5-076ccb96d4a4	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	9	t	2026-01-12 01:57:51.262	2026-01-12 01:57:51.262
3bdf830b-1eb9-4382-95eb-919b21fd8800	FOOD_SAFETY	Microbiological	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.268	2026-01-12 01:57:51.268
d240a71b-ced2-4779-8249-0b4ba6630d72	FOOD_SAFETY	Salmonella	3bdf830b-1eb9-4382-95eb-919b21fd8800	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.269	2026-01-12 01:57:51.269
b1a11bdb-5ca0-4807-8a70-853f0a831df9	FOOD_SAFETY	Listeria	3bdf830b-1eb9-4382-95eb-919b21fd8800	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.269	2026-01-12 01:57:51.269
b449a28d-242e-4b6a-9980-08b9616b3fb9	FOOD_SAFETY	E. coli	3bdf830b-1eb9-4382-95eb-919b21fd8800	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.269	2026-01-12 01:57:51.269
faa0ab7a-be35-4aa5-8f2a-0a2350842cf6	FOOD_SAFETY	Staphylococcus	3bdf830b-1eb9-4382-95eb-919b21fd8800	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.269	2026-01-12 01:57:51.269
818cb447-1e74-4a78-8863-8675cbc057ca	FOOD_SAFETY	Campylobacter	3bdf830b-1eb9-4382-95eb-919b21fd8800	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.269	2026-01-12 01:57:51.269
f15d918f-3de8-4e49-89cd-a411f05fb82e	FOOD_SAFETY	Yeast & Mold	3bdf830b-1eb9-4382-95eb-919b21fd8800	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.269	2026-01-12 01:57:51.269
1bb6079d-aebf-45ff-9b16-db842ee3e4e6	FOOD_SAFETY	Coliforms	3bdf830b-1eb9-4382-95eb-919b21fd8800	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.269	2026-01-12 01:57:51.269
8a43c4c4-8151-4ed4-a372-eed7a23cf0ea	FOOD_SAFETY	Total Plate Count (TPC)	3bdf830b-1eb9-4382-95eb-919b21fd8800	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.269	2026-01-12 01:57:51.269
85820b1e-1a8d-4fb8-96be-d6f27bdea31c	FOOD_SAFETY	Enterobacteriaceae	3bdf830b-1eb9-4382-95eb-919b21fd8800	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.269	2026-01-12 01:57:51.269
b4545d48-6f02-4a15-9186-cbaf636dd437	FOOD_SAFETY	Other Microbiological	3bdf830b-1eb9-4382-95eb-919b21fd8800	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	9	t	2026-01-12 01:57:51.269	2026-01-12 01:57:51.269
c2a96ef4-a02a-4490-a897-b808f4ed5f6f	FOOD_SAFETY	Allergen	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.273	2026-01-12 01:57:51.273
263b9fe1-d82b-4189-b5c8-b1c402be4ce0	FOOD_SAFETY	Milk/Dairy	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
53358dd5-fbf3-4f7b-a371-9a365ef32f9f	FOOD_SAFETY	Eggs	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
76f49fa7-1afd-4e87-b4bb-361300dff90b	FOOD_SAFETY	Fish	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
bd269b63-b328-4f0a-917d-fee0fbabd3a0	FOOD_SAFETY	Shellfish/Crustaceans	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
3222b762-f7ea-45f2-aa22-7d04d35ba576	FOOD_SAFETY	Tree Nuts	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
fe7cdb6e-0b40-4cbb-a7e8-a8e61d852fc1	FOOD_SAFETY	Peanuts	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
c9b53a17-6d59-47ac-830b-193083631bbb	FOOD_SAFETY	Wheat/Gluten	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
b7012c17-8289-4b05-a05f-400a73a86f4e	FOOD_SAFETY	Soy	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
e0e5b3c5-6269-4243-a7df-3e45c8baead0	FOOD_SAFETY	Sesame	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
8ed6abdc-c0c7-4b77-b81b-3b7909491441	FOOD_SAFETY	Cross-Contact	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	9	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
87b624df-ca28-476a-a141-c0f33a157575	FOOD_SAFETY	Undeclared Allergen	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	10	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
c7da8978-2324-47e2-9a34-c7c972eba1aa	FOOD_SAFETY	Other Allergen	c2a96ef4-a02a-4490-a897-b808f4ed5f6f	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	11	t	2026-01-12 01:57:51.275	2026-01-12 01:57:51.275
60a487cf-c4c5-4d53-a6ae-929c534be88e	FOOD_SAFETY	Labeling	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.28	2026-01-12 01:57:51.28
c6f6a9c8-9d79-4600-baab-0d02f55260b2	FOOD_SAFETY	Missing Label	60a487cf-c4c5-4d53-a6ae-929c534be88e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.281	2026-01-12 01:57:51.281
cefc0e13-b401-4268-9db6-e277d9995e01	FOOD_SAFETY	Incorrect Information	60a487cf-c4c5-4d53-a6ae-929c534be88e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.281	2026-01-12 01:57:51.281
b965d9b1-7dd0-45cd-97d8-207743f68574	FOOD_SAFETY	Wrong Product Label	60a487cf-c4c5-4d53-a6ae-929c534be88e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.281	2026-01-12 01:57:51.281
963d1aa3-4f5e-4f7b-87c1-c032972c94ba	FOOD_SAFETY	Missing Allergen Declaration	60a487cf-c4c5-4d53-a6ae-929c534be88e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.281	2026-01-12 01:57:51.281
d6d5f186-4279-4bf4-a256-88f143764bd7	FOOD_SAFETY	Incorrect Date Code	60a487cf-c4c5-4d53-a6ae-929c534be88e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.281	2026-01-12 01:57:51.281
2b706c6e-d158-41e5-828d-07937eb6b2c9	FOOD_SAFETY	Barcode Error	60a487cf-c4c5-4d53-a6ae-929c534be88e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.281	2026-01-12 01:57:51.281
24ebb885-9d57-4c4f-8b62-2dcff38775e7	FOOD_SAFETY	Missing Nutritional Info	60a487cf-c4c5-4d53-a6ae-929c534be88e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.281	2026-01-12 01:57:51.281
fbb2d4df-6746-40f9-b01b-e700556bb3ba	FOOD_SAFETY	Language/Translation Error	60a487cf-c4c5-4d53-a6ae-929c534be88e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.281	2026-01-12 01:57:51.281
d6d26e58-4669-43eb-a6f5-0f5923ada9e6	FOOD_SAFETY	Other Labeling	60a487cf-c4c5-4d53-a6ae-929c534be88e	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.281	2026-01-12 01:57:51.281
220c232a-f3cf-4af0-8052-c3be8a9b60af	FOOD_SAFETY	Temperature	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.285	2026-01-12 01:57:51.285
fc695281-653b-4018-819c-9938829f418c	FOOD_SAFETY	Cold Chain Break	220c232a-f3cf-4af0-8052-c3be8a9b60af	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.285	2026-01-12 01:57:51.285
ba2c093a-47c3-41c2-979f-124b70a4665c	FOOD_SAFETY	Cooking Temperature	220c232a-f3cf-4af0-8052-c3be8a9b60af	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.285	2026-01-12 01:57:51.285
ab9900a3-a249-428e-8311-8da91ea6882f	FOOD_SAFETY	Cooling Rate Issue	220c232a-f3cf-4af0-8052-c3be8a9b60af	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.285	2026-01-12 01:57:51.285
db4f171f-0580-449f-bd47-4aeb24bfb316	FOOD_SAFETY	Hot Holding Issue	220c232a-f3cf-4af0-8052-c3be8a9b60af	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.285	2026-01-12 01:57:51.285
2e82c4ea-2c76-4eff-90b0-502000af2486	FOOD_SAFETY	Cold Storage Issue	220c232a-f3cf-4af0-8052-c3be8a9b60af	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.285	2026-01-12 01:57:51.285
8449c1b0-c47b-402c-b1c1-49be75da5d10	FOOD_SAFETY	Freezer Malfunction	220c232a-f3cf-4af0-8052-c3be8a9b60af	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.285	2026-01-12 01:57:51.285
72a0611b-9200-4923-bf15-839d6e5b0875	FOOD_SAFETY	Temperature Abuse	220c232a-f3cf-4af0-8052-c3be8a9b60af	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.285	2026-01-12 01:57:51.285
587385f7-ea50-4d2d-ae7f-ce30ffadccf6	FOOD_SAFETY	Refrigeration Failure	220c232a-f3cf-4af0-8052-c3be8a9b60af	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.285	2026-01-12 01:57:51.285
7de86cd6-666d-4739-afe8-2bae42b46641	FOOD_SAFETY	Other Temperature	220c232a-f3cf-4af0-8052-c3be8a9b60af	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.285	2026-01-12 01:57:51.285
88bb1607-dbb2-4926-b60f-84738ec6ac46	FOOD_SAFETY	Sanitation	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.291	2026-01-12 01:57:51.291
0f5b8b64-6c3a-4903-8405-031bda567a88	FOOD_SAFETY	Equipment Cleanliness	88bb1607-dbb2-4926-b60f-84738ec6ac46	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.292	2026-01-12 01:57:51.292
d6076e7e-4974-42b2-90c4-28244f0ae0ee	FOOD_SAFETY	Personnel Hygiene	88bb1607-dbb2-4926-b60f-84738ec6ac46	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.292	2026-01-12 01:57:51.292
98e5459b-529f-45eb-b6d1-655bfeb3df25	FOOD_SAFETY	Cross-Contamination	88bb1607-dbb2-4926-b60f-84738ec6ac46	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.292	2026-01-12 01:57:51.292
3a716668-5217-4b23-a039-d90115b392e9	FOOD_SAFETY	Pest Activity	88bb1607-dbb2-4926-b60f-84738ec6ac46	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.292	2026-01-12 01:57:51.292
85c5a812-3b34-439e-bbb1-32db46ec4053	FOOD_SAFETY	Floor/Drain Issues	88bb1607-dbb2-4926-b60f-84738ec6ac46	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.292	2026-01-12 01:57:51.292
4f0bcdc2-28f5-4a4c-866f-491ff47a509d	FOOD_SAFETY	Chemical Residue	88bb1607-dbb2-4926-b60f-84738ec6ac46	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.292	2026-01-12 01:57:51.292
05f9beaa-791e-4072-916d-cbd4554a3ecb	FOOD_SAFETY	Handwashing Compliance	88bb1607-dbb2-4926-b60f-84738ec6ac46	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.292	2026-01-12 01:57:51.292
60c800e3-bde7-4a07-8fb0-d9fae1372943	FOOD_SAFETY	Sanitation Schedule	88bb1607-dbb2-4926-b60f-84738ec6ac46	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.292	2026-01-12 01:57:51.292
e8c2f512-00bf-4337-8220-5e3068a14dde	FOOD_SAFETY	Other Sanitation	88bb1607-dbb2-4926-b60f-84738ec6ac46	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.292	2026-01-12 01:57:51.292
7c4dc110-935c-4a54-a103-a74e28a9e293	FOOD_SAFETY	Supplier	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.296	2026-01-12 01:57:51.296
b4152e62-8431-499b-a4c8-57ba4abe5ed3	FOOD_SAFETY	Quality Issue	7c4dc110-935c-4a54-a103-a74e28a9e293	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.297	2026-01-12 01:57:51.297
54cd320b-f5f8-4801-9dfc-26bffe6977a7	FOOD_SAFETY	Wrong Product Received	7c4dc110-935c-4a54-a103-a74e28a9e293	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.297	2026-01-12 01:57:51.297
168b6531-d429-4a60-b7b1-f5b34a124939	FOOD_SAFETY	Damaged Goods	7c4dc110-935c-4a54-a103-a74e28a9e293	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.297	2026-01-12 01:57:51.297
08dba99e-a38c-4bca-9f37-dc6c6878db4a	FOOD_SAFETY	Missing Documentation	7c4dc110-935c-4a54-a103-a74e28a9e293	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.297	2026-01-12 01:57:51.297
090017c6-eace-44f7-99c6-2f5af1391098	FOOD_SAFETY	Expired Product	7c4dc110-935c-4a54-a103-a74e28a9e293	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.297	2026-01-12 01:57:51.297
b4e373e3-1067-4730-b906-cf20d08a9afc	FOOD_SAFETY	Incorrect Quantity	7c4dc110-935c-4a54-a103-a74e28a9e293	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.297	2026-01-12 01:57:51.297
b5aae918-a045-4af7-a969-ef5f9c530600	FOOD_SAFETY	Contaminated Raw Material	7c4dc110-935c-4a54-a103-a74e28a9e293	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.297	2026-01-12 01:57:51.297
da803544-435d-49aa-8013-e47fbbb30364	FOOD_SAFETY	Temperature Violation	7c4dc110-935c-4a54-a103-a74e28a9e293	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.297	2026-01-12 01:57:51.297
7df23c5f-fd83-4ac4-9b1d-ed5cdf327c84	FOOD_SAFETY	Other Supplier	7c4dc110-935c-4a54-a103-a74e28a9e293	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.297	2026-01-12 01:57:51.297
ca6bbf26-4bdb-4eac-8884-5a84c018e314	FOOD_SAFETY	Packaging	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.3	2026-01-12 01:57:51.3
6c4c3e8b-6621-4789-b785-46f68242f7cf	FOOD_SAFETY	Damaged Package	ca6bbf26-4bdb-4eac-8884-5a84c018e314	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.301	2026-01-12 01:57:51.301
3e345c25-f44e-4674-b3a2-2f655a383525	FOOD_SAFETY	Seal Failure	ca6bbf26-4bdb-4eac-8884-5a84c018e314	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.301	2026-01-12 01:57:51.301
70a3ba64-5a0d-45df-a98e-ba8a30ff6028	FOOD_SAFETY	Leaking Container	ca6bbf26-4bdb-4eac-8884-5a84c018e314	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.301	2026-01-12 01:57:51.301
9b5b051a-5acb-4745-bb0f-c33375f4fe35	FOOD_SAFETY	Torn Wrapper	ca6bbf26-4bdb-4eac-8884-5a84c018e314	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.301	2026-01-12 01:57:51.301
8bd31132-8ce3-4306-a148-676e61469803	FOOD_SAFETY	Missing Component	ca6bbf26-4bdb-4eac-8884-5a84c018e314	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.301	2026-01-12 01:57:51.301
e017399a-afe5-46f0-a2ae-6a2fe3ba8e3c	FOOD_SAFETY	Incorrect Packaging	ca6bbf26-4bdb-4eac-8884-5a84c018e314	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.301	2026-01-12 01:57:51.301
fddf2e55-7b65-482e-9503-6c08d9637290	FOOD_SAFETY	Defective Material	ca6bbf26-4bdb-4eac-8884-5a84c018e314	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.301	2026-01-12 01:57:51.301
431a40ac-1bd8-456c-b891-89f75026c471	FOOD_SAFETY	Vacuum/MAP Failure	ca6bbf26-4bdb-4eac-8884-5a84c018e314	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.301	2026-01-12 01:57:51.301
828563fc-6c01-4761-949a-ff556ec7e409	FOOD_SAFETY	Other Packaging	ca6bbf26-4bdb-4eac-8884-5a84c018e314	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.301	2026-01-12 01:57:51.301
9e217477-e184-4cf4-b5bb-cdb946190067	MACHINE_EQUIPMENT	Mechanical	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.304	2026-01-12 01:57:51.304
f7ec7d8d-ce2d-4d42-97a6-616b827626b0	MACHINE_EQUIPMENT	Bearing Failure	9e217477-e184-4cf4-b5bb-cdb946190067	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.307	2026-01-12 01:57:51.307
a6056152-73f1-4a73-a1c5-8b8d85b0aec3	MACHINE_EQUIPMENT	Belt/Chain Issues	9e217477-e184-4cf4-b5bb-cdb946190067	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.307	2026-01-12 01:57:51.307
0558c084-233b-41fe-a846-3bf6884e687e	MACHINE_EQUIPMENT	Gear Problems	9e217477-e184-4cf4-b5bb-cdb946190067	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.307	2026-01-12 01:57:51.307
9883a192-7426-4e49-b7e8-bcf97a8067ff	MACHINE_EQUIPMENT	Shaft Misalignment	9e217477-e184-4cf4-b5bb-cdb946190067	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.307	2026-01-12 01:57:51.307
79f0add9-335b-44d1-9f89-ed82dfd4a04b	MACHINE_EQUIPMENT	Coupling Failure	9e217477-e184-4cf4-b5bb-cdb946190067	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.307	2026-01-12 01:57:51.307
a5eada8c-79f4-4cb4-bc80-c72111cd24a5	MACHINE_EQUIPMENT	Vibration	9e217477-e184-4cf4-b5bb-cdb946190067	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.307	2026-01-12 01:57:51.307
14e6d249-7c1f-48c1-a7b4-c3483923314a	MACHINE_EQUIPMENT	Wear & Tear	9e217477-e184-4cf4-b5bb-cdb946190067	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.307	2026-01-12 01:57:51.307
63b40aa4-0fc5-409e-9b92-228e2b40fffe	MACHINE_EQUIPMENT	Jam/Blockage	9e217477-e184-4cf4-b5bb-cdb946190067	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.307	2026-01-12 01:57:51.307
d44294eb-a012-4008-9c82-3a093970928f	MACHINE_EQUIPMENT	Other Mechanical	9e217477-e184-4cf4-b5bb-cdb946190067	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.307	2026-01-12 01:57:51.307
ca151f35-a806-4475-ad9e-c5adf970dda9	MACHINE_EQUIPMENT	Electrical	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.31	2026-01-12 01:57:51.31
21d7e086-227c-4ff1-81de-c48f9ecf596d	MACHINE_EQUIPMENT	Motor Failure	ca151f35-a806-4475-ad9e-c5adf970dda9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.311	2026-01-12 01:57:51.311
340b4f36-8340-4924-9f8a-f9b758d5ba1d	MACHINE_EQUIPMENT	Wiring Issue	ca151f35-a806-4475-ad9e-c5adf970dda9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.311	2026-01-12 01:57:51.311
cec742a7-a1b4-412d-98f0-3166fae583a7	MACHINE_EQUIPMENT	Circuit Breaker Trip	ca151f35-a806-4475-ad9e-c5adf970dda9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.311	2026-01-12 01:57:51.311
0a22c822-20ca-4884-a53e-235d6112a433	MACHINE_EQUIPMENT	Overheating	ca151f35-a806-4475-ad9e-c5adf970dda9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.311	2026-01-12 01:57:51.311
bd5de394-d6c8-4705-b62b-cd36ceb7c698	MACHINE_EQUIPMENT	Short Circuit	ca151f35-a806-4475-ad9e-c5adf970dda9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.311	2026-01-12 01:57:51.311
037289d6-84e7-4c7a-b6f6-e436bc7a325a	MACHINE_EQUIPMENT	Power Supply	ca151f35-a806-4475-ad9e-c5adf970dda9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.311	2026-01-12 01:57:51.311
52c1455b-7e67-4f10-8f43-31280097e9dc	MACHINE_EQUIPMENT	Ground Fault	ca151f35-a806-4475-ad9e-c5adf970dda9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.311	2026-01-12 01:57:51.311
63b151fb-6d72-4251-931f-35fddbe9dcf4	MACHINE_EQUIPMENT	Connector Issues	ca151f35-a806-4475-ad9e-c5adf970dda9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.311	2026-01-12 01:57:51.311
096eccfc-f68e-4f91-adc9-530f4392e519	MACHINE_EQUIPMENT	Other Electrical	ca151f35-a806-4475-ad9e-c5adf970dda9	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.311	2026-01-12 01:57:51.311
b8ce74c3-7f06-40cd-a14d-ff154fc38975	MACHINE_EQUIPMENT	Controls	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.314	2026-01-12 01:57:51.314
6f4cd368-5e34-4979-a1de-41475538eb31	MACHINE_EQUIPMENT	PLC Error	b8ce74c3-7f06-40cd-a14d-ff154fc38975	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.315	2026-01-12 01:57:51.315
a43f9ebe-6f6b-4aca-884d-d46e56b3fd9b	MACHINE_EQUIPMENT	HMI Malfunction	b8ce74c3-7f06-40cd-a14d-ff154fc38975	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.315	2026-01-12 01:57:51.315
bec7a368-1e1d-4f60-ba44-6c80b541d5b5	MACHINE_EQUIPMENT	Software Issue	b8ce74c3-7f06-40cd-a14d-ff154fc38975	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.315	2026-01-12 01:57:51.315
8f6fb794-43e8-4c70-9333-7efb57107ffc	MACHINE_EQUIPMENT	Programming Error	b8ce74c3-7f06-40cd-a14d-ff154fc38975	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.315	2026-01-12 01:57:51.315
456cae4b-e3b4-4964-ba99-a1109e1ae221	MACHINE_EQUIPMENT	Network/Communication	b8ce74c3-7f06-40cd-a14d-ff154fc38975	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.315	2026-01-12 01:57:51.315
b9dd1d6b-8149-4d8f-ad3c-cb7083830e0d	MACHINE_EQUIPMENT	Touchscreen Failure	b8ce74c3-7f06-40cd-a14d-ff154fc38975	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.315	2026-01-12 01:57:51.315
7a5bb061-b784-45a6-898b-984f2001818d	MACHINE_EQUIPMENT	Controller Fault	b8ce74c3-7f06-40cd-a14d-ff154fc38975	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.315	2026-01-12 01:57:51.315
1fe5d0b8-a04c-4eef-baf3-4ab5038550c9	MACHINE_EQUIPMENT	Emergency Stop	b8ce74c3-7f06-40cd-a14d-ff154fc38975	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.315	2026-01-12 01:57:51.315
4572e5ed-d164-451d-94db-fda517cf6c72	MACHINE_EQUIPMENT	Other Controls	b8ce74c3-7f06-40cd-a14d-ff154fc38975	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.315	2026-01-12 01:57:51.315
faa7e785-2cc3-414b-9068-aea5e2778be9	MACHINE_EQUIPMENT	Pneumatics	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.318	2026-01-12 01:57:51.318
cb07f0e0-928d-4ea2-8899-67a056ef6d6e	MACHINE_EQUIPMENT	Air Leak	faa7e785-2cc3-414b-9068-aea5e2778be9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.318	2026-01-12 01:57:51.318
495ed295-7576-434a-ab9f-44bb0f57ba85	MACHINE_EQUIPMENT	Cylinder Failure	faa7e785-2cc3-414b-9068-aea5e2778be9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.318	2026-01-12 01:57:51.318
ca72a4d7-7014-4c0c-9e3a-dc18d4b9faef	MACHINE_EQUIPMENT	Valve Malfunction	faa7e785-2cc3-414b-9068-aea5e2778be9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.318	2026-01-12 01:57:51.318
036a8151-4c12-47e9-93b0-01e66d5b344c	MACHINE_EQUIPMENT	Low Air Pressure	faa7e785-2cc3-414b-9068-aea5e2778be9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.318	2026-01-12 01:57:51.318
a5bcf656-0a73-430a-8210-660ffda471cb	MACHINE_EQUIPMENT	Hose Damage	faa7e785-2cc3-414b-9068-aea5e2778be9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.318	2026-01-12 01:57:51.318
7e8d18b1-6b5b-47f6-a107-12d74b50aee7	MACHINE_EQUIPMENT	Fitting Issues	faa7e785-2cc3-414b-9068-aea5e2778be9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.318	2026-01-12 01:57:51.318
ebf908d2-9cf9-48eb-b0ea-577304ac6c08	MACHINE_EQUIPMENT	Compressor Issue	faa7e785-2cc3-414b-9068-aea5e2778be9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.318	2026-01-12 01:57:51.318
483d1056-9dc4-4002-b6fb-9cc54e4f0d78	MACHINE_EQUIPMENT	Filter/Regulator	faa7e785-2cc3-414b-9068-aea5e2778be9	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.318	2026-01-12 01:57:51.318
6bb608b7-9833-4a82-a6d5-81d41ba7ce3d	MACHINE_EQUIPMENT	Other Pneumatics	faa7e785-2cc3-414b-9068-aea5e2778be9	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.318	2026-01-12 01:57:51.318
4d76d6b5-10a9-46a2-8133-57ed821af24c	MACHINE_EQUIPMENT	Sensors	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.321	2026-01-12 01:57:51.321
aec77d79-0f14-42b0-9bbb-d8ac9c23c6c5	MACHINE_EQUIPMENT	Proximity Sensor	4d76d6b5-10a9-46a2-8133-57ed821af24c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.322	2026-01-12 01:57:51.322
bf657f20-ceeb-44a8-871e-e5bd1985fe7f	MACHINE_EQUIPMENT	Photo Eye	4d76d6b5-10a9-46a2-8133-57ed821af24c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.322	2026-01-12 01:57:51.322
e5ad9f3e-8112-42be-8b9c-4548db160ffc	MACHINE_EQUIPMENT	Temperature Sensor	4d76d6b5-10a9-46a2-8133-57ed821af24c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.322	2026-01-12 01:57:51.322
6bbf8f33-2a32-457e-bd6e-a2e75a46a77c	MACHINE_EQUIPMENT	Pressure Sensor	4d76d6b5-10a9-46a2-8133-57ed821af24c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.322	2026-01-12 01:57:51.322
ce056cb5-0b41-450d-97b0-4237af5eeca1	MACHINE_EQUIPMENT	Flow Sensor	4d76d6b5-10a9-46a2-8133-57ed821af24c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.322	2026-01-12 01:57:51.322
d4dc7b6f-4ccd-4569-918e-95c203e04fc0	MACHINE_EQUIPMENT	Level Sensor	4d76d6b5-10a9-46a2-8133-57ed821af24c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.322	2026-01-12 01:57:51.322
8ec77d2c-1d9c-42e3-a0a9-73b89ffa1d86	MACHINE_EQUIPMENT	Encoder Failure	4d76d6b5-10a9-46a2-8133-57ed821af24c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.322	2026-01-12 01:57:51.322
fdffa85c-c06f-4dbd-b817-a6b66f656233	MACHINE_EQUIPMENT	Vision System	4d76d6b5-10a9-46a2-8133-57ed821af24c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.322	2026-01-12 01:57:51.322
9009e312-896d-4503-85f6-32fcc611dfc1	MACHINE_EQUIPMENT	Other Sensors	4d76d6b5-10a9-46a2-8133-57ed821af24c	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.322	2026-01-12 01:57:51.322
dfadaa06-b49c-46de-aa14-667dd7e52940	MACHINE_EQUIPMENT	Lubrication	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.329	2026-01-12 01:57:51.329
e72c62b4-9120-47ce-9acc-4e223dbc63a6	MACHINE_EQUIPMENT	Insufficient Lubrication	dfadaa06-b49c-46de-aa14-667dd7e52940	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.332	2026-01-12 01:57:51.332
fdfab663-afb8-4655-9c2a-39db0a23fe1c	MACHINE_EQUIPMENT	Contaminated Lubricant	dfadaa06-b49c-46de-aa14-667dd7e52940	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.332	2026-01-12 01:57:51.332
66f1e58c-6b37-41ec-8649-4c6d34665740	MACHINE_EQUIPMENT	Wrong Lubricant Type	dfadaa06-b49c-46de-aa14-667dd7e52940	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.332	2026-01-12 01:57:51.332
7ebd4b29-fa01-4b08-95b4-3cc96548c93b	MACHINE_EQUIPMENT	Lubrication System Failure	dfadaa06-b49c-46de-aa14-667dd7e52940	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.332	2026-01-12 01:57:51.332
3df47711-f0fc-410d-b8ba-03ca45c012c9	MACHINE_EQUIPMENT	Seal Leak	dfadaa06-b49c-46de-aa14-667dd7e52940	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.332	2026-01-12 01:57:51.332
9cb38f37-486c-4535-88b5-016fa4ec0d54	MACHINE_EQUIPMENT	Grease Fitting Issue	dfadaa06-b49c-46de-aa14-667dd7e52940	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.332	2026-01-12 01:57:51.332
8ed1a311-f80a-48ed-b5e3-95dc40f6c174	MACHINE_EQUIPMENT	Oil Level Low	dfadaa06-b49c-46de-aa14-667dd7e52940	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.332	2026-01-12 01:57:51.332
400a8659-d1f3-4dd2-8823-287246d360fe	MACHINE_EQUIPMENT	Lubrication Schedule	dfadaa06-b49c-46de-aa14-667dd7e52940	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.332	2026-01-12 01:57:51.332
9b9d286a-49a0-4c41-a558-c8ea8ed3e5fd	MACHINE_EQUIPMENT	Other Lubrication	dfadaa06-b49c-46de-aa14-667dd7e52940	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.332	2026-01-12 01:57:51.332
015d1e31-64a8-448b-b7c1-263fe7e788a2	MACHINE_EQUIPMENT	Calibration	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.336	2026-01-12 01:57:51.336
b0038f21-9935-4149-9b82-4eec8d8bfcb5	MACHINE_EQUIPMENT	Weight/Scale Calibration	015d1e31-64a8-448b-b7c1-263fe7e788a2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.337	2026-01-12 01:57:51.337
92badaf0-58dd-4de1-b10b-34e4f188902e	MACHINE_EQUIPMENT	Temperature Calibration	015d1e31-64a8-448b-b7c1-263fe7e788a2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.337	2026-01-12 01:57:51.337
a5c7bae9-bcfd-474d-b709-19d81c30e208	MACHINE_EQUIPMENT	Pressure Calibration	015d1e31-64a8-448b-b7c1-263fe7e788a2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.337	2026-01-12 01:57:51.337
a2b5e617-51ae-4fbe-9f07-ce6281212a7e	MACHINE_EQUIPMENT	Flow Calibration	015d1e31-64a8-448b-b7c1-263fe7e788a2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.337	2026-01-12 01:57:51.337
593614c5-8a39-4449-8db4-9ed01ab616cd	MACHINE_EQUIPMENT	Dimensional Calibration	015d1e31-64a8-448b-b7c1-263fe7e788a2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.337	2026-01-12 01:57:51.337
6f4f7cfa-d4be-4c44-b615-220dd479e9b0	MACHINE_EQUIPMENT	Sensor Calibration	015d1e31-64a8-448b-b7c1-263fe7e788a2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.337	2026-01-12 01:57:51.337
37b22e28-9cc3-4661-a7f7-93e3a65052c1	MACHINE_EQUIPMENT	Timing Calibration	015d1e31-64a8-448b-b7c1-263fe7e788a2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.337	2026-01-12 01:57:51.337
57bb8220-53a0-40de-962c-25456861425f	MACHINE_EQUIPMENT	Speed Calibration	015d1e31-64a8-448b-b7c1-263fe7e788a2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.337	2026-01-12 01:57:51.337
a4ed17a9-b4eb-4f28-a473-4a4e4938a8ad	MACHINE_EQUIPMENT	Other Calibration	015d1e31-64a8-448b-b7c1-263fe7e788a2	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.337	2026-01-12 01:57:51.337
0bfcc3af-619c-4c6b-8371-36970cadc8a6	MACHINE_EQUIPMENT	Changeover	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.341	2026-01-12 01:57:51.341
2d4619f1-de96-4351-96ec-8871f5f370c2	MACHINE_EQUIPMENT	Setup Error	0bfcc3af-619c-4c6b-8371-36970cadc8a6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.343	2026-01-12 01:57:51.343
ba18b669-2ade-46a9-8f32-0c60a485964f	MACHINE_EQUIPMENT	Missing Parts	0bfcc3af-619c-4c6b-8371-36970cadc8a6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.343	2026-01-12 01:57:51.343
351008e7-1441-4bef-ae3a-e92ab96b7194	MACHINE_EQUIPMENT	Incorrect Settings	0bfcc3af-619c-4c6b-8371-36970cadc8a6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.343	2026-01-12 01:57:51.343
ca691d9d-21f6-4571-881d-77c57fdaef97	MACHINE_EQUIPMENT	Tooling Issue	0bfcc3af-619c-4c6b-8371-36970cadc8a6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.343	2026-01-12 01:57:51.343
21cf84ca-d432-4f1a-bbbe-cca7f7225087	MACHINE_EQUIPMENT	Recipe/Program Error	0bfcc3af-619c-4c6b-8371-36970cadc8a6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.343	2026-01-12 01:57:51.343
02606804-b1c3-43d7-8f1e-b87abdc44615	MACHINE_EQUIPMENT	Size Change Issue	0bfcc3af-619c-4c6b-8371-36970cadc8a6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.343	2026-01-12 01:57:51.343
7cde42c3-4d9e-4116-aa11-c70ffad36c84	MACHINE_EQUIPMENT	Format Change Issue	0bfcc3af-619c-4c6b-8371-36970cadc8a6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.343	2026-01-12 01:57:51.343
b47641f9-1962-47e7-a5ea-3432611afd58	MACHINE_EQUIPMENT	Delay/Extended Time	0bfcc3af-619c-4c6b-8371-36970cadc8a6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.343	2026-01-12 01:57:51.343
464bbd8a-06f3-4ab8-b5c7-49139591d85b	MACHINE_EQUIPMENT	Other Changeover	0bfcc3af-619c-4c6b-8371-36970cadc8a6	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.343	2026-01-12 01:57:51.343
975a4eb1-7cf0-45a0-9e60-5eda1019538e	WORKPLACE_SAFETY	Physical Injury Hazards	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.348	2026-01-12 01:57:51.348
4024d3ef-24e9-437b-9c66-925a85f4f449	WORKPLACE_SAFETY	Slips, Trips & Falls	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
694e4504-d868-451f-a8fe-05e2c6d8202b	WORKPLACE_SAFETY	Cuts, Lacerations & Abrasions	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
70089e27-8247-4215-8801-7b35a8cdb44d	WORKPLACE_SAFETY	Punctures	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
0f33ea24-fc31-4785-826b-81c6218e2977	WORKPLACE_SAFETY	Bruises / Contusions	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
502f70fc-00a0-4e76-8834-1bd96e0d1308	WORKPLACE_SAFETY	Struck-By Objects	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
f855bdba-5e56-4db0-a159-73478259d157	WORKPLACE_SAFETY	Caught-In / Caught-Between	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
9ab87fff-9f3a-4d36-8f0b-88be3466f805	WORKPLACE_SAFETY	Pinch Points	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
e2b3e820-5eda-45af-8518-0b7584a91096	WORKPLACE_SAFETY	Falling Objects	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
037b8da2-1f69-4d5b-befc-d8ef58d65f6a	WORKPLACE_SAFETY	Head Injuries	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
30b5a00d-c169-4b57-be34-04fa80758a81	WORKPLACE_SAFETY	Eye Injuries	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	9	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
d61ce1b8-0e81-4cce-9b8e-efee108c06a8	WORKPLACE_SAFETY	Hand & Finger Injuries	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	10	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
b7703bea-4134-43da-97b6-d2cc5bc99238	WORKPLACE_SAFETY	Foot & Ankle Injuries	975a4eb1-7cf0-45a0-9e60-5eda1019538e	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	11	t	2026-01-12 01:57:51.351	2026-01-12 01:57:51.351
abaf335a-05cb-49c1-b4fd-5d8b775ae8f6	WORKPLACE_SAFETY	Ergonomic & Musculoskeletal Safety	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.358	2026-01-12 01:57:51.358
0f0242b0-d06b-4c19-992b-3e7f7e23a896	WORKPLACE_SAFETY	Manual Material Handling	abaf335a-05cb-49c1-b4fd-5d8b775ae8f6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.36	2026-01-12 01:57:51.36
dae0ef59-ffb8-400d-bede-0d6da95e267c	WORKPLACE_SAFETY	Overexertion	abaf335a-05cb-49c1-b4fd-5d8b775ae8f6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.36	2026-01-12 01:57:51.36
9dbf3b26-7641-4525-b42a-08ef61d95191	WORKPLACE_SAFETY	Repetitive Motion	abaf335a-05cb-49c1-b4fd-5d8b775ae8f6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.36	2026-01-12 01:57:51.36
d29ce9a6-7ffa-426b-ab41-470bb278763e	WORKPLACE_SAFETY	Awkward Postures	abaf335a-05cb-49c1-b4fd-5d8b775ae8f6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.36	2026-01-12 01:57:51.36
316f09e3-4006-40fa-b84b-a07eed61ffd6	WORKPLACE_SAFETY	Forceful Exertions	abaf335a-05cb-49c1-b4fd-5d8b775ae8f6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.36	2026-01-12 01:57:51.36
2772c178-19d1-4c08-9389-975d4db8ed01	WORKPLACE_SAFETY	Push / Pull Hazards	abaf335a-05cb-49c1-b4fd-5d8b775ae8f6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.36	2026-01-12 01:57:51.36
8e56b528-57a3-4add-9ba3-fb1cd86f2a67	WORKPLACE_SAFETY	Lifting & Carrying	abaf335a-05cb-49c1-b4fd-5d8b775ae8f6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.36	2026-01-12 01:57:51.36
df21c35d-3f58-49f3-bdb8-24cc00d54abf	WORKPLACE_SAFETY	Cumulative Trauma Disorders (CTD)	abaf335a-05cb-49c1-b4fd-5d8b775ae8f6	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.36	2026-01-12 01:57:51.36
e31f808b-9bf0-4c2a-ad73-2475168dee3f	WORKPLACE_SAFETY	Machine & Equipment Safety	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.4	2026-01-12 01:57:51.4
cdaf1807-59cc-46fa-980e-fcf53de7a57b	WORKPLACE_SAFETY	Machine Guarding	e31f808b-9bf0-4c2a-ad73-2475168dee3f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.404	2026-01-12 01:57:51.404
b521ce05-7b41-43ef-b70b-ac4f22f3ec72	WORKPLACE_SAFETY	Lockout / Tagout (LOTO)	e31f808b-9bf0-4c2a-ad73-2475168dee3f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.404	2026-01-12 01:57:51.404
093be57e-2544-44e7-b09a-7d06fea78eec	WORKPLACE_SAFETY	Mechanical Hazards	e31f808b-9bf0-4c2a-ad73-2475168dee3f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.404	2026-01-12 01:57:51.404
669c11d2-2f51-4351-b726-bdceae26fe48	WORKPLACE_SAFETY	Electrical Hazards	e31f808b-9bf0-4c2a-ad73-2475168dee3f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.404	2026-01-12 01:57:51.404
891fdd04-3d24-4f89-bbab-95b6c70a1813	WORKPLACE_SAFETY	Pneumatic / Hydraulic Hazards	e31f808b-9bf0-4c2a-ad73-2475168dee3f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.404	2026-01-12 01:57:51.404
7969459f-5f2f-4ebe-8bdd-324e94da19c5	WORKPLACE_SAFETY	Sensors & Interlocks	e31f808b-9bf0-4c2a-ad73-2475168dee3f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.404	2026-01-12 01:57:51.404
7ab07625-baa1-48f2-8ed8-b508764f6dda	WORKPLACE_SAFETY	Emergency Stops	e31f808b-9bf0-4c2a-ad73-2475168dee3f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.404	2026-01-12 01:57:51.404
a04c9d9e-03e8-44e3-a372-096766904e5a	WORKPLACE_SAFETY	Unexpected Startup	e31f808b-9bf0-4c2a-ad73-2475168dee3f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.404	2026-01-12 01:57:51.404
45c47cf5-f952-48de-8713-e1442d25e09f	WORKPLACE_SAFETY	Unsafe Changeovers	e31f808b-9bf0-4c2a-ad73-2475168dee3f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.404	2026-01-12 01:57:51.404
fd1c715c-2797-457e-bef2-96f7786e7aaf	WORKPLACE_SAFETY	Maintenance Safety	e31f808b-9bf0-4c2a-ad73-2475168dee3f	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	9	t	2026-01-12 01:57:51.404	2026-01-12 01:57:51.404
dcae5ab0-d541-4bea-bc03-7152e4c860f2	WORKPLACE_SAFETY	Chemical & Hazardous Materials Safety	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.417	2026-01-12 01:57:51.417
116505ff-54b9-4500-aa7a-5051e77b2ff5	WORKPLACE_SAFETY	Chemical Exposure	dcae5ab0-d541-4bea-bc03-7152e4c860f2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.419	2026-01-12 01:57:51.419
4b182c80-729b-460f-af2a-f3b2fe5acf60	WORKPLACE_SAFETY	Ammonia Exposure	dcae5ab0-d541-4bea-bc03-7152e4c860f2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.419	2026-01-12 01:57:51.419
2dc3f4a8-8b13-45c8-827c-df3c0155fd0c	WORKPLACE_SAFETY	Cleaning & Sanitation Chemicals	dcae5ab0-d541-4bea-bc03-7152e4c860f2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.419	2026-01-12 01:57:51.419
4a688a4d-4816-4d61-a066-1d2ce4b72683	WORKPLACE_SAFETY	SDS / GHS Labeling	dcae5ab0-d541-4bea-bc03-7152e4c860f2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.419	2026-01-12 01:57:51.419
5e180df4-f8a6-4d83-8c01-ee6eaef838df	WORKPLACE_SAFETY	Chemical Storage	dcae5ab0-d541-4bea-bc03-7152e4c860f2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.419	2026-01-12 01:57:51.419
45a3ae2f-86f3-4f39-bb14-692772ad495a	WORKPLACE_SAFETY	Chemical Spills	dcae5ab0-d541-4bea-bc03-7152e4c860f2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.419	2026-01-12 01:57:51.419
3f46101d-27e9-444d-a27e-18e6f832c26b	WORKPLACE_SAFETY	Incompatible Chemical Mixing	dcae5ab0-d541-4bea-bc03-7152e4c860f2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.419	2026-01-12 01:57:51.419
e2e3fb8a-eff3-4787-a42a-ff6fafd2b9c1	WORKPLACE_SAFETY	Compressed Gases	dcae5ab0-d541-4bea-bc03-7152e4c860f2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.419	2026-01-12 01:57:51.419
b3fc1133-3fb7-4c52-a349-ec4cdd5b2bf8	WORKPLACE_SAFETY	Chemical PPE	dcae5ab0-d541-4bea-bc03-7152e4c860f2	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.419	2026-01-12 01:57:51.419
4b38fa92-0f4c-410a-8c16-975b04368111	WORKPLACE_SAFETY	Environmental & Exposure Hazards	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.426	2026-01-12 01:57:51.426
3d07972d-63df-4938-8143-4a917aeeff1a	WORKPLACE_SAFETY	Heat Stress	4b38fa92-0f4c-410a-8c16-975b04368111	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.427	2026-01-12 01:57:51.427
b7427993-baa5-4a78-99b0-5adaab3e108d	WORKPLACE_SAFETY	Cold Stress	4b38fa92-0f4c-410a-8c16-975b04368111	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.427	2026-01-12 01:57:51.427
3a213784-7b9f-4827-b9c9-d9eb31c05bb0	WORKPLACE_SAFETY	Noise Exposure (Hearing Conservation)	4b38fa92-0f4c-410a-8c16-975b04368111	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.427	2026-01-12 01:57:51.427
ebbe9dbf-b48a-4112-8ac9-5bdc5f7684c6	WORKPLACE_SAFETY	Air Quality / Ventilation	4b38fa92-0f4c-410a-8c16-975b04368111	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.427	2026-01-12 01:57:51.427
82c411d4-9f09-4a1e-8eec-7d07b81d3e06	WORKPLACE_SAFETY	Dust Exposure	4b38fa92-0f4c-410a-8c16-975b04368111	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.427	2026-01-12 01:57:51.427
c8683910-4a7f-4e11-b5fc-1ae2a0b097dd	WORKPLACE_SAFETY	Fumes & Vapors	4b38fa92-0f4c-410a-8c16-975b04368111	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.427	2026-01-12 01:57:51.427
5cb2af62-3d5c-4c09-aff6-61a85fc7574a	WORKPLACE_SAFETY	Lighting Deficiencies	4b38fa92-0f4c-410a-8c16-975b04368111	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.427	2026-01-12 01:57:51.427
3bf85435-4ceb-4ff0-b390-be1be8fcff58	WORKPLACE_SAFETY	Radiation (where applicable)	4b38fa92-0f4c-410a-8c16-975b04368111	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.427	2026-01-12 01:57:51.427
5f83c0f9-6ade-4bba-b8ab-e6db6633cf85	WORKPLACE_SAFETY	Fire & Emergency Safety	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.433	2026-01-12 01:57:51.433
b6a9fddd-77f3-4c1f-a17b-c28b3132d837	WORKPLACE_SAFETY	Fire Hazards	5f83c0f9-6ade-4bba-b8ab-e6db6633cf85	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.439	2026-01-12 01:57:51.439
45602ed3-50b2-42a4-80e3-bf67d72c82bf	WORKPLACE_SAFETY	Flammable Materials	5f83c0f9-6ade-4bba-b8ab-e6db6633cf85	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.439	2026-01-12 01:57:51.439
27022303-5b88-44d4-9620-d6a0b0396d70	WORKPLACE_SAFETY	Emergency Evacuation	5f83c0f9-6ade-4bba-b8ab-e6db6633cf85	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.439	2026-01-12 01:57:51.439
e0a74dff-c29b-4c79-9906-c9c287303187	WORKPLACE_SAFETY	Alarm Systems	5f83c0f9-6ade-4bba-b8ab-e6db6633cf85	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.439	2026-01-12 01:57:51.439
98f76863-f552-4e48-b7d9-add53942a812	WORKPLACE_SAFETY	Emergency Exits & Egress	5f83c0f9-6ade-4bba-b8ab-e6db6633cf85	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.439	2026-01-12 01:57:51.439
9e58f83e-60f3-45ab-ab89-3b52b654cafd	WORKPLACE_SAFETY	Fire Suppression Systems	5f83c0f9-6ade-4bba-b8ab-e6db6633cf85	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.439	2026-01-12 01:57:51.439
d6325c78-9132-46ce-8113-36e5f9536489	WORKPLACE_SAFETY	Emergency Drills	5f83c0f9-6ade-4bba-b8ab-e6db6633cf85	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.439	2026-01-12 01:57:51.439
ffa24eb0-a1f1-499b-b28c-100deda304a6	WORKPLACE_SAFETY	First Aid & AED	5f83c0f9-6ade-4bba-b8ab-e6db6633cf85	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.439	2026-01-12 01:57:51.439
43313aca-a7b9-4f03-aee0-57fa94c1c4eb	WORKPLACE_SAFETY	Emergency Response Procedures	5f83c0f9-6ade-4bba-b8ab-e6db6633cf85	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.439	2026-01-12 01:57:51.439
069c2837-201d-465e-956f-28c3e2d072f4	WORKPLACE_SAFETY	Material Handling & Traffic Safety	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.451	2026-01-12 01:57:51.451
8a9637d2-baa0-4f78-8b1e-d1d4a53ea576	WORKPLACE_SAFETY	Forklift Safety	069c2837-201d-465e-956f-28c3e2d072f4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.455	2026-01-12 01:57:51.455
d1bccd7a-6d66-4b51-bda7-6e772f26aaab	WORKPLACE_SAFETY	Pallet Jack Safety	069c2837-201d-465e-956f-28c3e2d072f4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.455	2026-01-12 01:57:51.455
a9d1760f-759b-4940-a7fc-302c3d50273f	WORKPLACE_SAFETY	Dock Safety	069c2837-201d-465e-956f-28c3e2d072f4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.455	2026-01-12 01:57:51.455
138daf3e-792d-428d-aa4d-6a02676a9c8e	WORKPLACE_SAFETY	Trailer Safety	069c2837-201d-465e-956f-28c3e2d072f4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.455	2026-01-12 01:57:51.455
10a37766-2c1e-4855-8067-bd8b258c3577	WORKPLACE_SAFETY	Load Securing	069c2837-201d-465e-956f-28c3e2d072f4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.455	2026-01-12 01:57:51.455
99daa801-988d-452d-a21d-b45f610497a6	WORKPLACE_SAFETY	Pedestrian vs Vehicle Traffic	069c2837-201d-465e-956f-28c3e2d072f4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.455	2026-01-12 01:57:51.455
192ba7db-8c79-46b2-813f-c035a7ee7932	WORKPLACE_SAFETY	Racking & Storage Safety	069c2837-201d-465e-956f-28c3e2d072f4	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.455	2026-01-12 01:57:51.455
0ad0d5ce-d6af-4975-b914-35b15b9f9135	WORKPLACE_SAFETY	Personal Protective Equipment (PPE)	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.46	2026-01-12 01:57:51.46
a5c47218-e326-4c7e-883c-acb44570e133	WORKPLACE_SAFETY	Head Protection	0ad0d5ce-d6af-4975-b914-35b15b9f9135	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.461	2026-01-12 01:57:51.461
688f3445-9d05-454b-94d1-7e5f85606cb1	WORKPLACE_SAFETY	Eye & Face Protection	0ad0d5ce-d6af-4975-b914-35b15b9f9135	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.461	2026-01-12 01:57:51.461
3fdc5a7b-3cad-4c0d-b706-40091f542fd1	WORKPLACE_SAFETY	Hand Protection	0ad0d5ce-d6af-4975-b914-35b15b9f9135	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.461	2026-01-12 01:57:51.461
9c610e59-605b-488f-b4ee-a51024c20262	WORKPLACE_SAFETY	Foot Protection	0ad0d5ce-d6af-4975-b914-35b15b9f9135	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.461	2026-01-12 01:57:51.461
9f528fa2-93a3-49ac-98ff-bc26e716909e	WORKPLACE_SAFETY	Hearing Protection	0ad0d5ce-d6af-4975-b914-35b15b9f9135	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.461	2026-01-12 01:57:51.461
3649d779-86fd-4de1-96a1-3e72de160c3f	WORKPLACE_SAFETY	Respiratory Protection	0ad0d5ce-d6af-4975-b914-35b15b9f9135	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.461	2026-01-12 01:57:51.461
579b6b5b-3df9-47fd-a903-240c1beb735b	WORKPLACE_SAFETY	Chemical-Resistant PPE	0ad0d5ce-d6af-4975-b914-35b15b9f9135	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.461	2026-01-12 01:57:51.461
bb057670-0462-4936-aae0-2fcc162d4058	WORKPLACE_SAFETY	High-Visibility PPE	0ad0d5ce-d6af-4975-b914-35b15b9f9135	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.461	2026-01-12 01:57:51.461
4937b7b5-b6e8-4914-a74b-33175b87198c	WORKPLACE_SAFETY	Facility & Infrastructure Safety	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.464	2026-01-12 01:57:51.464
7885c89a-bddf-4fcd-a099-20fcf39a1f5b	WORKPLACE_SAFETY	Floors & Walkways	4937b7b5-b6e8-4914-a74b-33175b87198c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.465	2026-01-12 01:57:51.465
8b0339f2-4e39-4fda-bbb2-ceff4184bc7f	WORKPLACE_SAFETY	Stairs & Handrails	4937b7b5-b6e8-4914-a74b-33175b87198c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.465	2026-01-12 01:57:51.465
5d052db3-7842-4ce0-b79f-2534dae9c888	WORKPLACE_SAFETY	Platforms & Mezzanines	4937b7b5-b6e8-4914-a74b-33175b87198c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.465	2026-01-12 01:57:51.465
a6701d3c-af24-46df-85c2-f54b59ad7145	WORKPLACE_SAFETY	Doors & Dock Plates	4937b7b5-b6e8-4914-a74b-33175b87198c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.465	2026-01-12 01:57:51.465
ceb39297-f88c-4219-81eb-907920427e18	WORKPLACE_SAFETY	Roof Leaks / Condensation (Slip Risk)	4937b7b5-b6e8-4914-a74b-33175b87198c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.465	2026-01-12 01:57:51.465
43720abe-458a-42dd-8f5f-3800ddf6f39f	WORKPLACE_SAFETY	Housekeeping	4937b7b5-b6e8-4914-a74b-33175b87198c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.465	2026-01-12 01:57:51.465
8400b40a-fa5e-436c-9fab-b543579e32cc	WORKPLACE_SAFETY	Structural Integrity	4937b7b5-b6e8-4914-a74b-33175b87198c	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.465	2026-01-12 01:57:51.465
246562bb-d9b1-4010-ab65-615c3ddf7eac	WORKPLACE_SAFETY	Behavioral, Training & Compliance Safety	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.468	2026-01-12 01:57:51.468
5fe4ea01-1b21-4849-a58f-c5f36fa16a7b	WORKPLACE_SAFETY	Unsafe Acts	246562bb-d9b1-4010-ab65-615c3ddf7eac	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.469	2026-01-12 01:57:51.469
9d85da18-4bd0-4fe3-883f-9ddaab86fc04	WORKPLACE_SAFETY	SOP Non-Compliance	246562bb-d9b1-4010-ab65-615c3ddf7eac	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.469	2026-01-12 01:57:51.469
e7a89c71-09ca-47c7-a02f-a2b9cdcbdc35	WORKPLACE_SAFETY	Lack of Training	246562bb-d9b1-4010-ab65-615c3ddf7eac	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.469	2026-01-12 01:57:51.469
0cb66f84-7be6-48a1-8781-06fd4912ec01	WORKPLACE_SAFETY	Failure to Use PPE	246562bb-d9b1-4010-ab65-615c3ddf7eac	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.469	2026-01-12 01:57:51.469
96353482-ab01-4d0e-9039-e956c50ea1a6	WORKPLACE_SAFETY	Near Misses	246562bb-d9b1-4010-ab65-615c3ddf7eac	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.469	2026-01-12 01:57:51.469
023ba9a7-adb0-40ff-bfe6-94ddf4f78a4d	WORKPLACE_SAFETY	Incident Reporting	246562bb-d9b1-4010-ab65-615c3ddf7eac	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.469	2026-01-12 01:57:51.469
d8cab0d9-daa9-4b6d-8fac-7532a1b70435	WORKPLACE_SAFETY	Contractor Safety	246562bb-d9b1-4010-ab65-615c3ddf7eac	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.469	2026-01-12 01:57:51.469
8a0cf280-f150-45f0-bc88-5a6527c01b9d	WORKPLACE_SAFETY	Visitor Safety	246562bb-d9b1-4010-ab65-615c3ddf7eac	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	7	t	2026-01-12 01:57:51.469	2026-01-12 01:57:51.469
2b8497e5-a2fe-43ca-b243-8cbd1cd738a2	WORKPLACE_SAFETY	Work Rule Violations	246562bb-d9b1-4010-ab65-615c3ddf7eac	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	8	t	2026-01-12 01:57:51.469	2026-01-12 01:57:51.469
f8de3b0f-43ca-4f11-bdab-4c3ed9904f65	WORKPLACE_SAFETY	Health & Medical Management	\N	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.473	2026-01-12 01:57:51.473
056fed96-30f1-4421-86d6-176cc89cac75	WORKPLACE_SAFETY	First Aid	f8de3b0f-43ca-4f11-bdab-4c3ed9904f65	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	0	t	2026-01-12 01:57:51.474	2026-01-12 01:57:51.474
88302821-e373-4a22-bf3a-cf88f895ac60	WORKPLACE_SAFETY	OSHA Recordable Injuries	f8de3b0f-43ca-4f11-bdab-4c3ed9904f65	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	1	t	2026-01-12 01:57:51.474	2026-01-12 01:57:51.474
7da05852-2116-4c75-8442-42843d6d7520	WORKPLACE_SAFETY	Restricted Duty	f8de3b0f-43ca-4f11-bdab-4c3ed9904f65	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2	t	2026-01-12 01:57:51.474	2026-01-12 01:57:51.474
940c0e04-7c96-4e93-a1e1-e468895a7b2f	WORKPLACE_SAFETY	Lost Time Injuries	f8de3b0f-43ca-4f11-bdab-4c3ed9904f65	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	3	t	2026-01-12 01:57:51.474	2026-01-12 01:57:51.474
a5a8078e-1219-4bc7-8559-748b20ee9fe7	WORKPLACE_SAFETY	Occupational Illness	f8de3b0f-43ca-4f11-bdab-4c3ed9904f65	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	4	t	2026-01-12 01:57:51.474	2026-01-12 01:57:51.474
7d6e03ba-1979-4382-9d1d-2be9dd6386cc	WORKPLACE_SAFETY	Return-to-Work	f8de3b0f-43ca-4f11-bdab-4c3ed9904f65	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	5	t	2026-01-12 01:57:51.474	2026-01-12 01:57:51.474
7a08c7fd-2e24-4cb2-aa69-655402eee34c	WORKPLACE_SAFETY	Fatigue Management	f8de3b0f-43ca-4f11-bdab-4c3ed9904f65	f	1221d3d5-5bc1-41cd-b816-80fa9de527ef	6	t	2026-01-12 01:57:51.474	2026-01-12 01:57:51.474
\.


--
-- Data for Name: ChatMessage; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."ChatMessage" (id, "incidentId", "userId", content, "messageType", "replyToId", "isEdited", "isDeleted", attachments, "readBy", "createdAt", "updatedAt", "isPinned", mentions, "pinnedAt", "pinnedById", "actionItemId", "evidenceId", "handoffData", "rcaAnalysisId", "rcaItemId", "rcaItemType", "statusChange", "announcementData", "decisionData", "questionData", "updateData") FROM stdin;
73acc67e-25bb-49d4-82fb-ac82e7c9310a	ecd4a118-100c-4ac8-8182-126d5276eac2	3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	Hope you are doing good?	DECISION	\N	f	t	\N	{3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,434f6086-a5b2-46b9-ae5c-ca7e83635325}	2026-01-12 03:28:54.972	2026-01-12 03:30:20.241	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2940e68e-7ab6-45ba-938e-15f18c35cf71	ecd4a118-100c-4ac8-8182-126d5276eac2	434f6086-a5b2-46b9-ae5c-ca7e83635325	Status changed from DRAFT to SUBMITTED	STATUS_UPDATE	\N	f	f	\N	{434f6086-a5b2-46b9-ae5c-ca7e83635325,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407}	2026-01-12 02:36:21.386	2026-01-12 03:26:33.787	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	{"to": "SUBMITTED", "from": "DRAFT", "changedAt": "2026-01-12T02:36:21.385Z", "changedBy": "434f6086-a5b2-46b9-ae5c-ca7e83635325"}	\N	\N	\N	\N
79a812d9-c375-4f39-9619-832286a211ba	ecd4a118-100c-4ac8-8182-126d5276eac2	434f6086-a5b2-46b9-ae5c-ca7e83635325	Status changed from SUBMITTED to DRAFT	STATUS_UPDATE	\N	f	f	\N	{434f6086-a5b2-46b9-ae5c-ca7e83635325,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407}	2026-01-12 02:38:38.868	2026-01-12 03:26:33.787	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	{"to": "DRAFT", "from": "SUBMITTED", "changedAt": "2026-01-12T02:38:38.867Z", "changedBy": "434f6086-a5b2-46b9-ae5c-ca7e83635325"}	\N	\N	\N	\N
822d6c36-5166-44e7-9b4a-0132fb07d2a1	ecd4a118-100c-4ac8-8182-126d5276eac2	434f6086-a5b2-46b9-ae5c-ca7e83635325	Status changed from DRAFT to SUBMITTED	STATUS_UPDATE	\N	f	f	\N	{434f6086-a5b2-46b9-ae5c-ca7e83635325,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407}	2026-01-12 02:49:41.666	2026-01-12 03:26:33.787	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	{"to": "SUBMITTED", "from": "DRAFT", "changedAt": "2026-01-12T02:49:41.665Z", "changedBy": "434f6086-a5b2-46b9-ae5c-ca7e83635325"}	\N	\N	\N	\N
e25482f3-f636-4461-b1e6-c59ca432142a	ecd4a118-100c-4ac8-8182-126d5276eac2	434f6086-a5b2-46b9-ae5c-ca7e83635325	Tchouminyi Nkamtchou invited Gerald Chwoung to the team (pending acceptance)	SYSTEM	\N	f	f	\N	{434f6086-a5b2-46b9-ae5c-ca7e83635325,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407}	2026-01-12 03:25:26.428	2026-01-12 03:26:33.787	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
1a414d7a-a160-4411-b7c7-fe2d43e041b2	ecd4a118-100c-4ac8-8182-126d5276eac2	3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	Gerald Chwoung has joined the team	SYSTEM	\N	f	f	\N	{434f6086-a5b2-46b9-ae5c-ca7e83635325,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407}	2026-01-12 03:25:43.802	2026-01-12 03:26:33.787	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
2fd838e9-f9f1-4a05-925a-d5464175f2a5	ecd4a118-100c-4ac8-8182-126d5276eac2	3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	hello goo	TEXT	\N	t	f	\N	{3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,434f6086-a5b2-46b9-ae5c-ca7e83635325}	2026-01-12 03:27:54.863	2026-01-12 03:30:53.929	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
f5162508-3624-49f4-8ee9-2d177d6920a0	ecd4a118-100c-4ac8-8182-126d5276eac2	3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	hello team	TEXT	\N	f	f	\N	{3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,434f6086-a5b2-46b9-ae5c-ca7e83635325}	2026-01-12 03:26:49.896	2026-01-12 03:26:49.902	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
33b587bf-b22a-40a9-9392-d635aa8bacd8	ecd4a118-100c-4ac8-8182-126d5276eac2	434f6086-a5b2-46b9-ae5c-ca7e83635325	Good evening	TEXT	\N	f	f	\N	{434f6086-a5b2-46b9-ae5c-ca7e83635325,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,434f6086-a5b2-46b9-ae5c-ca7e83635325}	2026-01-12 03:27:26.265	2026-01-12 03:27:26.28	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
227ee7bb-8b87-4e48-bf9a-ed8d9a574051	ecd4a118-100c-4ac8-8182-126d5276eac2	3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	play	TEXT	\N	f	f	\N	{3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,434f6086-a5b2-46b9-ae5c-ca7e83635325,434f6086-a5b2-46b9-ae5c-ca7e83635325}	2026-01-12 03:31:38.907	2026-01-12 03:31:55.543	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7ae81a26-0ea5-44cb-9f20-0793c2151256	ecd4a118-100c-4ac8-8182-126d5276eac2	3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	how are you doing	TEXT	\N	t	f	\N	{3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,434f6086-a5b2-46b9-ae5c-ca7e83635325}	2026-01-12 03:28:38.105	2026-01-12 03:31:07.835	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
d6ef13a3-68b7-49d3-919e-367f11c5a4fa	ecd4a118-100c-4ac8-8182-126d5276eac2	434f6086-a5b2-46b9-ae5c-ca7e83635325	I am good sir	TEXT	\N	f	f	\N	{434f6086-a5b2-46b9-ae5c-ca7e83635325,434f6086-a5b2-46b9-ae5c-ca7e83635325,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407}	2026-01-12 03:29:20.664	2026-01-12 03:29:20.678	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
dcbb8a15-fe25-4214-8fe9-659ea92553a8	ecd4a118-100c-4ac8-8182-126d5276eac2	434f6086-a5b2-46b9-ae5c-ca7e83635325	how is everything?	TEXT	\N	f	f	\N	{434f6086-a5b2-46b9-ae5c-ca7e83635325,434f6086-a5b2-46b9-ae5c-ca7e83635325,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,434f6086-a5b2-46b9-ae5c-ca7e83635325}	2026-01-12 03:29:47.46	2026-01-12 03:29:47.468	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
7535ebdb-0f1f-4b9b-8014-44b9c6dc8d7d	ecd4a118-100c-4ac8-8182-126d5276eac2	3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	01-JENNI.jpg	IMAGE	\N	f	t	{"fileUrl": "https://storage.googleapis.com/dashmet-resolve-1ce6d.firebasestorage.app/chat/ecd4a118-100c-4ac8-8182-126d5276eac2/ab9bcfe9-e93f-4af4-b00e-03369e19c1f7.jpg", "fileName": "01-JENNI.jpg", "filePath": "https://storage.googleapis.com/dashmet-resolve-1ce6d.firebasestorage.app/chat/ecd4a118-100c-4ac8-8182-126d5276eac2/ab9bcfe9-e93f-4af4-b00e-03369e19c1f7.jpg", "fileSize": 309407, "mimeType": "image/jpeg", "firebasePath": "chat/ecd4a118-100c-4ac8-8182-126d5276eac2/ab9bcfe9-e93f-4af4-b00e-03369e19c1f7.jpg", "isVoiceMessage": false}	{434f6086-a5b2-46b9-ae5c-ca7e83635325,434f6086-a5b2-46b9-ae5c-ca7e83635325,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407,3bf6dd64-1e2b-4532-ade7-d3fe2dc69407}	2026-01-12 03:33:00.924	2026-01-12 03:33:25.817	f	{}	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N
\.


--
-- Data for Name: ChatMessageReaction; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."ChatMessageReaction" (id, "messageId", "userId", emoji, "createdAt") FROM stdin;
4d3033ed-7fb5-4f63-98b1-e896354f2ba1	d6ef13a3-68b7-49d3-919e-367f11c5a4fa	3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	❤️	2026-01-12 03:30:26.381
2fadad1f-e2d7-475a-bcf9-f9ba608ca5df	7ae81a26-0ea5-44cb-9f20-0793c2151256	3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	😂	2026-01-12 03:32:17.49
\.


--
-- Data for Name: ChatMessageTemplate; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."ChatMessageTemplate" (id, "userId", name, category, content, "isGlobal", "usageCount", "lastUsedAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Comment" (id, content, "userId", "incidentId", "rcaAnalysisId", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Department; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Department" (id, name, description, "facilityId", "createdAt", "updatedAt") FROM stdin;
281de2b5-5a90-4023-a313-34cda9d643b4	Bakery	The bakery department is in charge for producing tortillas for Line 3 and 5 at the main plant	5aa61300-b20b-4189-9d91-6cf2a1c565b7	2026-01-12 01:45:34.01	2026-01-12 01:45:34.01
\.


--
-- Data for Name: DropdownOption; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."DropdownOption" (id, "optionType", value, label, description, "sortOrder", "isActive", "isDefault", "isRequired", placeholder, "organizationId", "createdAt", "updatedAt") FROM stdin;
b6e9aaa3-ad7c-41c0-ac16-b678d77d668b	INJURY_TYPE	FIRST_AID	First Aid	Minor injuries treated on-site	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.961	2026-01-12 01:58:07.961
548ed188-364f-45a8-977b-17051f0fcdad	INJURY_TYPE	RECORDABLE	OSHA Recordable	Injuries requiring medical treatment beyond first aid	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.966	2026-01-12 01:58:07.966
19cec4c8-8c16-4147-b3d2-581380257430	INJURY_TYPE	NEAR_MISS	Near Miss	Incident that could have resulted in injury	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.967	2026-01-12 01:58:07.967
22811c94-7c43-49b3-9f59-c6b1c7dd97c8	INJURY_TYPE	LOST_TIME	Lost Time	Injuries resulting in missed work days	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.968	2026-01-12 01:58:07.968
b491994a-e37a-4b4e-b477-d9b47cba0492	INJURY_TYPE	RESTRICTED_DUTY	Restricted Duty	Injuries requiring modified work duties	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.969	2026-01-12 01:58:07.969
2d027dfb-dd80-44fe-a0f6-27e05cf877ad	INJURY_TYPE	FATALITY	Fatality	Work-related death	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.971	2026-01-12 01:58:07.971
c4a8f554-ceb0-4c36-b003-2e90a39b5cb2	TASK_FREQUENCY	CONTINUOUS	Continuous	Task performed continuously throughout shift	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.972	2026-01-12 01:58:07.972
3ae37d12-8e92-4a82-8bb4-ec4ceef2768a	TASK_FREQUENCY	HOURLY	Hourly	Task performed every hour	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.973	2026-01-12 01:58:07.973
9118ef0d-2784-4a21-9942-db6e157c4283	TASK_FREQUENCY	DAILY	Daily	Task performed once per day	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.975	2026-01-12 01:58:07.975
3ef929b6-9d3c-4c6b-a79e-63c2b9cb179d	TASK_FREQUENCY	WEEKLY	Weekly	Task performed once per week	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.977	2026-01-12 01:58:07.977
813b2aaf-0bed-4b0f-81b5-0c5338949c6a	TASK_FREQUENCY	MONTHLY	Monthly	Task performed once per month	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.978	2026-01-12 01:58:07.978
43e0fe8f-7b0f-4925-8c0b-2cdb9f38b4f3	TASK_FREQUENCY	RARELY	Rarely	Task performed infrequently	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.98	2026-01-12 01:58:07.98
ae2f4e35-4dec-4e72-bbdc-2e7d5dc548c5	TASK_FREQUENCY	FIRST_TIME	First Time	First time performing this task	6	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.981	2026-01-12 01:58:07.981
45a81acf-278b-4d8a-a928-1caa0fba715f	UNSAFE_ACT_CONDITION	UNSAFE_ACT	Unsafe Act	Human behavior that caused or contributed to the incident	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.983	2026-01-12 01:58:07.983
ce5ca050-e33a-4f35-b1ad-3aec0eac57fc	UNSAFE_ACT_CONDITION	UNSAFE_CONDITION	Unsafe Condition	Environmental or equipment condition that caused or contributed	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.984	2026-01-12 01:58:07.984
f3a71954-3527-4028-8533-8ceef1b09b85	UNSAFE_ACT_CONDITION	BOTH	Both	Combination of unsafe act and unsafe condition	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.988	2026-01-12 01:58:07.988
92562671-47f2-459d-a5ca-0452bb0b94d2	UNSAFE_ACT_CONDITION	UNDETERMINED	Undetermined	Unable to determine at this time	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.989	2026-01-12 01:58:07.989
eb7a39bd-b2e3-402c-bf13-ebf5ce436907	INJURY_DEVELOPMENT	SPECIFIC_DATE	Occurred on Specific Date	Injury happened at a specific time	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.99	2026-01-12 01:58:07.99
1293e418-e4ac-40d4-855e-54e472c5f7f9	INJURY_DEVELOPMENT	DEVELOPED_OVER_TIME	Developed Over Time	Injury developed gradually over time	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.99	2026-01-12 01:58:07.99
0945aa9e-201a-4b21-b212-a2d281640b95	INJURY_DEVELOPMENT	AGGRAVATION	Aggravation of Pre-existing	Work aggravated a pre-existing condition	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.991	2026-01-12 01:58:07.991
f3a2b95f-e650-42b6-b8dc-b95d1b987e2a	SEVERITY_LEVEL	LOW	Low	Minor incident with no or minimal impact	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.991	2026-01-12 01:58:07.991
3219888d-1ff2-4377-b35b-9ab0718c6e9c	SEVERITY_LEVEL	MEDIUM	Medium	Moderate incident requiring attention	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.992	2026-01-12 01:58:07.992
326d6237-5ea6-4ac7-a246-d2619548fa24	SEVERITY_LEVEL	HIGH	High	Serious incident requiring immediate action	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.993	2026-01-12 01:58:07.993
cac46477-770d-4767-bb51-da91c66288b2	SEVERITY_LEVEL	CRITICAL	Critical	Severe incident with major impact	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.994	2026-01-12 01:58:07.994
555ba98e-4ac9-4269-a164-a05ef9586a7c	BODY_PART	HEAD	Head	Head injuries including skull	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.997	2026-01-12 01:58:07.997
4929221e-2d8e-46bd-b97f-578d53e9b28b	BODY_PART	EYES	Eyes	Eye injuries	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.997	2026-01-12 01:58:07.997
bb31c5df-2478-4ef7-804f-38d5d7a7ad4f	BODY_PART	FACE	Face	Facial injuries	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.998	2026-01-12 01:58:07.998
45aeb6fa-dedd-402f-ad29-7a1f8c009a66	BODY_PART	NECK	Neck	Neck injuries	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.998	2026-01-12 01:58:07.998
fc272c97-bff9-4849-b32d-6bfddf8609e6	BODY_PART	SHOULDER	Shoulder	Shoulder injuries	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:07.999	2026-01-12 01:58:07.999
65e099cb-0f3d-44ae-a170-de61dc4321a5	BODY_PART	ARM	Arm	Upper arm injuries	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08	2026-01-12 01:58:08
13863d9e-1b07-4261-b777-fcd1e8d0ff1a	BODY_PART	ELBOW	Elbow	Elbow injuries	6	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.001	2026-01-12 01:58:08.001
dcbcac02-69b4-4f75-992c-cd2867c7afde	BODY_PART	FOREARM	Forearm	Forearm injuries	7	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.001	2026-01-12 01:58:08.001
dc640eb6-ecff-4d5a-8f08-c2bf8d013820	BODY_PART	WRIST	Wrist	Wrist injuries	8	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.002	2026-01-12 01:58:08.002
80ec67dc-df60-45c5-9105-231cb94b4c25	BODY_PART	HAND	Hand	Hand injuries	9	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.004	2026-01-12 01:58:08.004
ddd60454-f452-43a5-9cfc-d08a07db3e73	BODY_PART	FINGERS	Fingers	Finger injuries	10	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.004	2026-01-12 01:58:08.004
0ab9372a-adc2-46cb-9f38-59c4498d0a0c	BODY_PART	BACK_UPPER	Upper Back	Upper back/thoracic spine injuries	11	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.005	2026-01-12 01:58:08.005
38a014ce-78bc-4b50-a084-97ca25a243f3	BODY_PART	BACK_LOWER	Lower Back	Lower back/lumbar spine injuries	12	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.006	2026-01-12 01:58:08.006
d2496b5a-aa4d-4191-90e0-b76992d149b0	BODY_PART	CHEST	Chest	Chest/rib injuries	13	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.007	2026-01-12 01:58:08.007
a1dcb423-0272-4ab7-a406-b710f0df6cb0	BODY_PART	ABDOMEN	Abdomen	Abdominal injuries	14	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.008	2026-01-12 01:58:08.008
eac7cfd1-0b1b-40d2-b329-12df34724f33	BODY_PART	HIP	Hip	Hip injuries	15	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.009	2026-01-12 01:58:08.009
3c902b50-58b6-4bf9-a854-03d694b0f63b	BODY_PART	LEG	Leg	Upper leg/thigh injuries	16	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.009	2026-01-12 01:58:08.009
57cf4aa7-4645-42b7-8163-ea760a505a9d	BODY_PART	KNEE	Knee	Knee injuries	17	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.012	2026-01-12 01:58:08.012
fa19b7d0-aaa3-48c2-b813-7c604d6198a6	BODY_PART	ANKLE	Ankle	Ankle injuries	18	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.013	2026-01-12 01:58:08.013
ca73af4d-342d-4a73-a9b5-8de4cf9bf3aa	BODY_PART	FOOT	Foot	Foot injuries	19	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.014	2026-01-12 01:58:08.014
bd76973a-2165-44ce-86dd-99399e51912a	BODY_PART	TOES	Toes	Toe injuries	20	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.015	2026-01-12 01:58:08.015
11baaf6f-67bb-42c3-9cb4-8961ba48d9bf	BODY_PART	MULTIPLE	Multiple Body Parts	Multiple body parts affected	21	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.017	2026-01-12 01:58:08.017
2c540353-c7b4-4837-9d4f-724d676412e4	ENVIRONMENTAL_CONDITION	HEAT	Heat	High temperature conditions	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.018	2026-01-12 01:58:08.018
252e91f1-12cd-46ec-9c97-d3583186629a	ENVIRONMENTAL_CONDITION	COLD	Cold	Low temperature conditions	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.02	2026-01-12 01:58:08.02
c3fff6e1-8705-43b9-970e-fda2b124786f	ENVIRONMENTAL_CONDITION	NOISE	Noise	High noise levels	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.021	2026-01-12 01:58:08.021
488b6421-6558-49d8-8ffc-0edd5e8a75a8	ENVIRONMENTAL_CONDITION	POOR_LIGHTING	Poor Lighting	Inadequate lighting	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.021	2026-01-12 01:58:08.021
0ab24cfc-2520-4e36-bca6-4f7e2e9db80d	ENVIRONMENTAL_CONDITION	WET_SLIPPERY	Wet/Slippery	Wet or slippery surfaces	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.022	2026-01-12 01:58:08.022
daa13e9c-8d54-44cd-974e-be23ee0dcca1	ENVIRONMENTAL_CONDITION	CONFINED_SPACE	Confined Space	Working in confined spaces	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.022	2026-01-12 01:58:08.022
45674462-6995-4fa0-9cf6-d0e896abacf6	ENVIRONMENTAL_CONDITION	DUST	Dust	Dusty conditions	6	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.023	2026-01-12 01:58:08.023
5ea70c52-b46b-44ba-a9fd-f8c5879c7686	ENVIRONMENTAL_CONDITION	FUMES	Fumes	Chemical fumes present	7	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.023	2026-01-12 01:58:08.023
cd6bcfd2-8477-48ed-91ba-ed767e54c860	ENVIRONMENTAL_CONDITION	VIBRATION	Vibration	Equipment vibration exposure	8	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.024	2026-01-12 01:58:08.024
7e8d28b2-fbd4-4d41-a526-65485279d3c2	ENVIRONMENTAL_CONDITION	HEIGHT	Height	Working at heights	9	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.024	2026-01-12 01:58:08.024
814814a4-d35c-4c02-bd21-149cd2fd34c6	ENVIRONMENTAL_CONDITION	ELECTRICAL	Electrical Hazard	Electrical hazards present	10	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.025	2026-01-12 01:58:08.025
cf3399a0-2fc5-4b14-9053-b2f0a92b86df	ENVIRONMENTAL_CONDITION	PRESSURE	Pressure	High pressure systems	11	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.025	2026-01-12 01:58:08.025
9f86af93-1619-4272-b572-aeed07fa4799	ENVIRONMENTAL_CONDITION	RADIATION	Radiation	Radiation exposure	12	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.026	2026-01-12 01:58:08.026
7b573298-a569-438e-bd18-f955bef663d7	CASE_CLASSIFICATION	MEDICAL_ONLY	Medical Only	Required medical treatment but no lost time or restricted duty	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.026	2026-01-12 01:58:08.026
7147a8fb-83d5-4767-ad13-69daee6a70c6	CASE_CLASSIFICATION	RESTRICTED_WORK	Restricted Work/Transfer	Unable to perform normal duties, assigned to modified work	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.027	2026-01-12 01:58:08.027
a358b00a-b1bc-4db0-b1f1-15ac789dff0f	CASE_CLASSIFICATION	LOST_TIME	Days Away from Work	Employee unable to work due to injury	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.028	2026-01-12 01:58:08.028
6ce3c456-f7b0-4046-89f1-e1400c7c151d	CASE_CLASSIFICATION	FATALITY	Fatality	Work-related death	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.029	2026-01-12 01:58:08.029
65681308-6fbe-4306-9550-f726338e85cc	CASE_CLASSIFICATION	FIRST_AID	First Aid Only	Minor treatment not requiring recordkeeping	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.03	2026-01-12 01:58:08.03
236196ca-b575-4906-9774-1cb40508584c	CASE_CLASSIFICATION	NO_TREATMENT	No Treatment Required	No medical treatment needed	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.03	2026-01-12 01:58:08.03
9742a77f-ba0b-4a89-91e4-778743463ec7	INJURY_WORK_RELATION	CAUSED_BY_WORK	Caused by Work Activity	Injury was directly caused by work activities	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.031	2026-01-12 01:58:08.031
c0683eb3-167c-4c43-9479-2a58b0bd2d21	INJURY_WORK_RELATION	MADE_WORSE_BY_WORK	Made Worse by Work Activity	Pre-existing condition aggravated by work	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.031	2026-01-12 01:58:08.031
d050597d-8fb6-4999-b02a-b0f31d6f75ec	INJURY_WORK_RELATION	AGGRAVATED_PREEXISTING	Aggravated Pre-existing Condition	Work significantly worsened a known condition	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.032	2026-01-12 01:58:08.032
2d65fe7e-28c3-4deb-8694-8b692f59f5c9	INJURY_WORK_RELATION	WORK_RELATED	Work-Related (General)	Injury occurred in the work environment	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.033	2026-01-12 01:58:08.033
ac8cac5f-19c4-47cc-9e50-c18ab188e071	INJURY_WORK_RELATION	NOT_WORK_RELATED	Not Work-Related	Injury occurred outside of work activities	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.033	2026-01-12 01:58:08.033
09d84b38-1764-4b0f-8dd7-412f05e2b00e	INJURY_WORK_RELATION	UNDER_INVESTIGATION	Under Investigation	Work-relatedness still being determined	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.034	2026-01-12 01:58:08.034
82f42412-2f65-4584-bdf8-8b96d7fc3830	CONTRIBUTING_FACTOR_TYPE	PEOPLE_TRAINING	People - Lack of Training	Insufficient training or knowledge	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.035	2026-01-12 01:58:08.035
c3ee43f7-b2d0-4aa9-9544-ceb9785fbe63	CONTRIBUTING_FACTOR_TYPE	PEOPLE_FATIGUE	People - Fatigue/Distraction	Employee fatigue, distraction, or inattention	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.039	2026-01-12 01:58:08.039
6da251c8-a444-46ca-a25c-02e99142dc88	CONTRIBUTING_FACTOR_TYPE	PEOPLE_UNSAFE_ACT	People - Unsafe Act	Willful violation of safety procedures	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.039	2026-01-12 01:58:08.039
456bb939-9517-47d9-a5a0-4eee83e0f32b	CONTRIBUTING_FACTOR_TYPE	PEOPLE_COMMUNICATION	People - Communication Failure	Poor communication or misunderstanding	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.041	2026-01-12 01:58:08.041
2cdc47e2-3a16-4d1b-adb4-0ea5a78b2d05	CONTRIBUTING_FACTOR_TYPE	PEOPLE_PHYSICAL	People - Physical Limitation	Physical capability issue or pre-existing condition	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.042	2026-01-12 01:58:08.042
d6450448-5c0e-4935-8eb6-80cb8342c720	CONTRIBUTING_FACTOR_TYPE	PROCESS_NO_SOP	Process - Missing SOP	Standard operating procedure not available	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.043	2026-01-12 01:58:08.043
33c0a66a-d794-4a93-8b27-45bffd3fe821	CONTRIBUTING_FACTOR_TYPE	PROCESS_INADEQUATE_SOP	Process - Inadequate SOP	SOP exists but is insufficient or unclear	6	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.046	2026-01-12 01:58:08.046
44cf77bd-25e1-4eab-8d97-6029a861bb13	CONTRIBUTING_FACTOR_TYPE	PROCESS_NOT_FOLLOWED	Process - SOP Not Followed	Procedure exists but was not followed	7	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.047	2026-01-12 01:58:08.047
006a2a34-dcab-4dce-af6a-23b5e7fadb23	CONTRIBUTING_FACTOR_TYPE	PROCESS_SUPERVISION	Process - Lack of Supervision	Insufficient oversight or supervision	8	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.048	2026-01-12 01:58:08.048
f6dc0eb8-1808-4f21-b284-57e453bcfdad	CONTRIBUTING_FACTOR_TYPE	PROCESS_PLANNING	Process - Poor Planning	Inadequate job planning or task assessment	9	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.048	2026-01-12 01:58:08.048
9b326548-2b77-480c-9a24-0f563bfc89e3	CONTRIBUTING_FACTOR_TYPE	EQUIPMENT_MALFUNCTION	Equipment - Malfunction	Equipment failure or malfunction	10	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.049	2026-01-12 01:58:08.049
cd2a3526-fa7b-48a2-b335-c5006e316dfd	CONTRIBUTING_FACTOR_TYPE	EQUIPMENT_NO_GUARD	Equipment - Missing Guard	Safety guards or barriers not in place	11	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.05	2026-01-12 01:58:08.05
78a264d9-be3e-457a-bf61-46c35ccf89ca	CONTRIBUTING_FACTOR_TYPE	EQUIPMENT_MAINTENANCE	Equipment - Poor Maintenance	Inadequate preventive maintenance	12	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.05	2026-01-12 01:58:08.05
0bc0e58b-0de3-411d-af19-ea6c755cf7db	CONTRIBUTING_FACTOR_TYPE	EQUIPMENT_DESIGN	Equipment - Design Flaw	Inherent design deficiency	13	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.051	2026-01-12 01:58:08.051
11575152-2868-446c-99e9-e06b1d5faeb5	CONTRIBUTING_FACTOR_TYPE	EQUIPMENT_PPE	Equipment - PPE Issue	Missing or inadequate PPE	14	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.051	2026-01-12 01:58:08.051
7a6640fd-8817-46ce-850e-60d6181082b7	CONTRIBUTING_FACTOR_TYPE	ENVIRONMENT_HOUSEKEEPING	Environment - Housekeeping	Poor housekeeping or cluttered area	15	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.055	2026-01-12 01:58:08.055
2276c93c-8feb-43ad-b1b0-f60c246ee2bf	CONTRIBUTING_FACTOR_TYPE	ENVIRONMENT_LIGHTING	Environment - Lighting	Inadequate or excessive lighting	16	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.056	2026-01-12 01:58:08.056
16090ac4-5d64-491d-89c4-07f929de23c0	CONTRIBUTING_FACTOR_TYPE	ENVIRONMENT_TEMPERATURE	Environment - Temperature	Extreme heat or cold conditions	17	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.058	2026-01-12 01:58:08.058
9cfee1d5-0eda-43d9-a628-280c03bc8d7d	CONTRIBUTING_FACTOR_TYPE	ENVIRONMENT_NOISE	Environment - Noise	Excessive noise levels	18	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.059	2026-01-12 01:58:08.059
86ffdfbd-23a5-4c26-96ed-a7934c9321f2	CONTRIBUTING_FACTOR_TYPE	ENVIRONMENT_FLOOR	Environment - Floor Condition	Wet, slippery, or uneven floor surfaces	19	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.061	2026-01-12 01:58:08.061
8a5202fa-dc27-4c45-a800-a8078d3793f9	CONTRIBUTING_FACTOR_TYPE	ENVIRONMENT_SPACE	Environment - Workspace	Confined or cramped work area	20	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.063	2026-01-12 01:58:08.063
f467dbe4-57b3-4046-bfe5-2658d484da31	POSITION_JOB_TYPE	LINE_OPERATOR	Line Operator	Production line operator	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.064	2026-01-12 01:58:08.064
8141a3ea-f350-4f89-840f-c317d616b157	POSITION_JOB_TYPE	MACHINE_OPERATOR	Machine Operator	Operates specific machinery	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.065	2026-01-12 01:58:08.065
91a2df63-7866-4d53-b98e-23b1c15c19c0	POSITION_JOB_TYPE	FORKLIFT_DRIVER	Forklift Driver	Operates forklift or powered industrial truck	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.066	2026-01-12 01:58:08.066
8d707672-2d60-43dc-b9d0-ea69f9c0c3a9	POSITION_JOB_TYPE	MAINTENANCE_TECH	Maintenance Technician	Equipment maintenance and repair	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.069	2026-01-12 01:58:08.069
eb6534a3-d769-4d8f-802e-6be57d41901c	POSITION_JOB_TYPE	QUALITY_TECH	Quality Technician	Quality assurance and inspection	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.071	2026-01-12 01:58:08.071
02a4601a-eaa2-4e87-b7e3-8deed9877cd7	POSITION_JOB_TYPE	SANITATION	Sanitation Worker	Cleaning and sanitation duties	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.071	2026-01-12 01:58:08.071
d146084a-5525-457c-8c54-dca216acbf52	POSITION_JOB_TYPE	WAREHOUSE	Warehouse Associate	Warehouse operations and logistics	6	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.072	2026-01-12 01:58:08.072
6f4e879d-a909-45f4-87b4-a2b94b967cf8	POSITION_JOB_TYPE	MATERIAL_HANDLER	Material Handler	Moving materials and supplies	7	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.072	2026-01-12 01:58:08.072
7f05703e-8100-4b19-8bf6-2230dfad6416	POSITION_JOB_TYPE	PACKER	Packer	Packaging finished products	8	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.073	2026-01-12 01:58:08.073
bdffea2d-b870-4b95-af54-b18dbf35bfa4	POSITION_JOB_TYPE	INSPECTOR	Inspector	Product or safety inspection	9	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.073	2026-01-12 01:58:08.073
745330de-1cf4-4ee2-9481-791788892ad9	POSITION_JOB_TYPE	SUPERVISOR	Supervisor/Lead	Team lead or supervisor role	10	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.073	2026-01-12 01:58:08.073
47986c86-3bbe-4db5-9b65-5cefe38c7ef5	POSITION_JOB_TYPE	CONTRACTOR	Contractor	External contractor or vendor	11	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.074	2026-01-12 01:58:08.074
5d26e3bc-6783-4b03-ad3a-1870f7939d08	POSITION_JOB_TYPE	TEMP_WORKER	Temporary Worker	Temporary or seasonal employee	12	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.074	2026-01-12 01:58:08.074
75d76234-e084-43c0-934b-acae0b5880e0	POSITION_JOB_TYPE	OTHER	Other	Other position not listed	13	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.075	2026-01-12 01:58:08.075
38605837-a708-4ca5-abc8-477771ab9a3e	INJURY_MECHANISM	STRUCK_BY	Struck By Object	Hit by moving or falling object	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.075	2026-01-12 01:58:08.075
bbc7fd74-bf5c-47f1-b751-b0a09ffe41f1	INJURY_MECHANISM	STRUCK_AGAINST	Struck Against Object	Contact with stationary object	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.076	2026-01-12 01:58:08.076
7770a194-1d28-49d1-9ea5-aa892453c1c2	INJURY_MECHANISM	CAUGHT_IN	Caught In/Between	Caught in or compressed by equipment	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.077	2026-01-12 01:58:08.077
850edb6d-cd8c-4e01-9a07-f6b4e4a823d3	INJURY_MECHANISM	FALL_SAME_LEVEL	Fall - Same Level	Slip, trip, or fall on same level	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.078	2026-01-12 01:58:08.078
0899381f-72d4-4eb4-a7dd-085a9eedeac6	INJURY_MECHANISM	FALL_DIFFERENT_LEVEL	Fall - Different Level	Fall from height or elevation	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.079	2026-01-12 01:58:08.079
fc309cb2-91d8-4d7e-9214-71f4e2ffa0b5	INJURY_MECHANISM	OVEREXERTION	Overexertion	Lifting, pushing, pulling, or carrying	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.08	2026-01-12 01:58:08.08
a2e8fa05-399f-44f2-84cb-4904c85b7bf4	INJURY_MECHANISM	REPETITIVE_MOTION	Repetitive Motion	Cumulative trauma from repetition	6	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.08	2026-01-12 01:58:08.08
c9448235-4044-4ab1-a27c-e4e1a3fd8d49	INJURY_MECHANISM	EXPOSURE_CHEMICAL	Exposure - Chemical	Contact with harmful substance	7	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.081	2026-01-12 01:58:08.081
5042859b-1a4e-4db6-9509-ce0d1283ea1f	INJURY_MECHANISM	EXPOSURE_TEMPERATURE	Exposure - Temperature	Heat or cold exposure	8	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.082	2026-01-12 01:58:08.082
b55d75a0-064b-4457-8b0c-49a5765bbdd6	INJURY_MECHANISM	EXPOSURE_NOISE	Exposure - Noise	Harmful noise exposure	9	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.083	2026-01-12 01:58:08.083
2b01fe0a-ed10-42c1-a2fb-19e9bc61a332	INJURY_MECHANISM	ELECTRICAL	Electrical Contact	Contact with electrical current	10	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.083	2026-01-12 01:58:08.083
01d30570-9308-4fa0-a209-c5a987434ef2	INJURY_MECHANISM	CUT_LACERATION	Cut/Laceration	Cut by sharp object or edge	11	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.084	2026-01-12 01:58:08.084
9147c9f1-603a-43c6-8898-c98a1ba30185	INJURY_MECHANISM	PUNCTURE	Puncture	Piercing by pointed object	12	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.084	2026-01-12 01:58:08.084
981a7ff9-5649-4013-83b3-a24f3c48ae84	INJURY_MECHANISM	MOTOR_VEHICLE	Motor Vehicle	Vehicle-related incident	13	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.087	2026-01-12 01:58:08.087
60d284b0-20f6-4161-b31a-5f25c6c1e6e1	INJURY_MECHANISM	OTHER	Other	Other mechanism not listed	14	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.087	2026-01-12 01:58:08.087
54e9fac7-2514-403d-8233-57a3fe5be21f	CORRECTIVE_ACTION_TYPE	ENGINEERING	Engineering Control	Physical changes to equipment or workspace	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.088	2026-01-12 01:58:08.088
c24856bf-f732-4ea0-9803-f1e5916120bb	CORRECTIVE_ACTION_TYPE	ADMINISTRATIVE	Administrative Control	Changes to procedures, training, or work practices	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.088	2026-01-12 01:58:08.088
0fce08e4-e1ca-4835-91ee-0c2fea96e4f1	CORRECTIVE_ACTION_TYPE	PPE	PPE Requirement	Personal protective equipment changes	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.089	2026-01-12 01:58:08.089
fa08e09c-61ac-4b5a-9b35-7c1798f4f4d0	CORRECTIVE_ACTION_TYPE	TRAINING	Training/Education	Employee training or retraining	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.089	2026-01-12 01:58:08.089
eb716c4a-8ec7-4812-922a-44a899c8295f	CORRECTIVE_ACTION_TYPE	SOP_UPDATE	SOP Update	Update or create standard operating procedure	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.09	2026-01-12 01:58:08.09
746b886d-da52-4164-bb11-7d1f177e13b0	CORRECTIVE_ACTION_TYPE	EQUIPMENT_REPAIR	Equipment Repair	Repair or replace faulty equipment	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.09	2026-01-12 01:58:08.09
85ac1e12-3a9f-445b-9474-e00c971e4d34	CORRECTIVE_ACTION_TYPE	GUARD_INSTALL	Guard Installation	Install or improve machine guarding	6	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.091	2026-01-12 01:58:08.091
c0b328c4-3515-4650-8a19-286c4258c8a0	CORRECTIVE_ACTION_TYPE	SIGNAGE	Signage/Warning	Add or improve safety signage	7	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.091	2026-01-12 01:58:08.091
099299db-b7ed-4abe-8469-4c640b1d2544	CORRECTIVE_ACTION_TYPE	HOUSEKEEPING	Housekeeping Improvement	Improve cleanliness and organization	8	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.093	2026-01-12 01:58:08.093
a36fae9d-cd14-44f6-b657-27eceb18ea00	CORRECTIVE_ACTION_TYPE	DISCIPLINE	Disciplinary Action	Employee disciplinary measure	9	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.093	2026-01-12 01:58:08.093
1d9815d3-0876-49da-8d5f-11ce964d6503	CORRECTIVE_ACTION_TYPE	PROCESS_CHANGE	Process Change	Modify work process or workflow	10	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.095	2026-01-12 01:58:08.095
8952b8d0-4b45-4543-8b8c-a039b1ca6429	CORRECTIVE_ACTION_TYPE	MONITORING	Enhanced Monitoring	Increase supervision or monitoring	11	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.095	2026-01-12 01:58:08.095
bd32d16b-a393-4601-a231-6a4732b05f04	INCIDENT_PATTERN	ISOLATED	Isolated Incident	One-time incident with no prior similar occurrences	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.096	2026-01-12 01:58:08.096
a20d67b8-c5bc-48ad-8e20-abd45fdcd0d3	INCIDENT_PATTERN	RECURRING	Recurring Pattern	Similar incidents have occurred before	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.096	2026-01-12 01:58:08.096
f2fbb949-6655-4ef3-9ad7-265eaf38a87f	INCIDENT_PATTERN	TRENDING	Trending Upward	Frequency of similar incidents is increasing	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.097	2026-01-12 01:58:08.097
9ef34d24-c6df-4714-9dc5-a9061db90ac5	INCIDENT_PATTERN	SEASONAL	Seasonal Pattern	Incidents occur more frequently during certain times	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.097	2026-01-12 01:58:08.097
649a16f8-568a-437d-a859-04648507d70d	INCIDENT_PATTERN	SHIFT_RELATED	Shift-Related	Pattern associated with specific shifts	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.098	2026-01-12 01:58:08.098
b9ab7670-567a-4fc4-b957-661446d15a42	INCIDENT_PATTERN	LOCATION_SPECIFIC	Location-Specific	Incidents cluster in specific areas	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.098	2026-01-12 01:58:08.098
5a833388-ef9e-4622-a155-9186bd04a449	INCIDENT_PATTERN	TASK_SPECIFIC	Task-Specific	Incidents occur during specific tasks or operations	6	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.1	2026-01-12 01:58:08.1
04766b2d-1c8d-4f0c-8a20-fd5da7d7346a	INCIDENT_PATTERN	EQUIPMENT_RELATED	Equipment-Related	Pattern tied to specific equipment or machinery	7	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.101	2026-01-12 01:58:08.101
83e2f404-069b-499c-a5f0-7b33b3a86c2d	INCIDENT_PATTERN	EMPLOYEE_RELATED	Employee-Related	Pattern involves specific employee group or tenure	8	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.101	2026-01-12 01:58:08.101
9f4ece2e-9eac-48ed-a8a7-c79904c70e1a	INCIDENT_PATTERN	NEW_PROCESS	New Process/Change	Incident related to recent process or equipment changes	9	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.102	2026-01-12 01:58:08.102
035bdc1a-0ac8-4f80-a245-9425ccc3d90a	TASK_ROUTINE_TYPE	ROUTINE	Normal/Routine Task	Regular, expected work activity performed frequently	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.103	2026-01-12 01:58:08.103
81858891-d3ab-44bb-898e-5a78e45823e1	TASK_ROUTINE_TYPE	NON_ROUTINE	Non-Routine Task	Unusual or infrequent task outside normal operations	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.104	2026-01-12 01:58:08.104
a2debf7c-9c82-4c86-badd-e626ae2dd29c	WEIGHT_FORCE_UNIT	LBS	Pounds (lbs)	Weight measured in pounds	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.104	2026-01-12 01:58:08.104
86945717-2b37-49ff-b9c5-0a10ac28451e	WEIGHT_FORCE_UNIT	KG	Kilograms (kg)	Weight measured in kilograms	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.105	2026-01-12 01:58:08.105
f11c1372-ea88-4cf3-8fa2-7a2de9aee0a7	WEIGHT_FORCE_UNIT	OZ	Ounces (oz)	Weight measured in ounces	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.105	2026-01-12 01:58:08.105
c43b3431-039a-45c6-9b83-7a2c3945fa1f	WEIGHT_FORCE_UNIT	NEWTONS	Newtons (N)	Force measured in Newtons	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.106	2026-01-12 01:58:08.106
faa1f352-b32d-4805-a625-11c8f2433692	WEIGHT_FORCE_UNIT	KGF	Kilogram-force (kgf)	Force measured in kilogram-force	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.106	2026-01-12 01:58:08.106
1f82937a-b73e-4b20-93fc-b6e2e4796b1d	WEIGHT_FORCE_UNIT	LBF	Pound-force (lbf)	Force measured in pound-force	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.106	2026-01-12 01:58:08.106
96991c6c-8fe8-4e87-bd13-4d0ee8ffe0a9	EMPLOYEE_LANGUAGE	ENGLISH	English	English language	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.107	2026-01-12 01:58:08.107
d83d4bc1-8d5d-47d2-827c-ed6967af8114	EMPLOYEE_LANGUAGE	SPANISH	Spanish	Spanish language	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.108	2026-01-12 01:58:08.108
4795498d-ff72-44c7-94f2-e6d75a5916c5	EMPLOYEE_LANGUAGE	FRENCH	French	French language	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.108	2026-01-12 01:58:08.108
6855d71b-c39b-4e5b-bdcb-bf122275c938	EMPLOYEE_LANGUAGE	CHINESE	Chinese	Chinese (Mandarin/Cantonese)	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.111	2026-01-12 01:58:08.111
21dc0e8d-115e-4062-aa9e-43f3e8e9802b	EMPLOYEE_LANGUAGE	VIETNAMESE	Vietnamese	Vietnamese language	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.114	2026-01-12 01:58:08.114
7f677bad-fca9-4892-9324-ef3c92605123	EMPLOYEE_LANGUAGE	KOREAN	Korean	Korean language	5	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.116	2026-01-12 01:58:08.116
0b616ca2-8b01-4049-8ce1-c93a584771e6	EMPLOYEE_LANGUAGE	TAGALOG	Tagalog	Tagalog/Filipino language	6	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.117	2026-01-12 01:58:08.117
83d59280-dc1e-4f6d-a282-46d00d67e895	EMPLOYEE_LANGUAGE	PORTUGUESE	Portuguese	Portuguese language	7	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.118	2026-01-12 01:58:08.118
a8b90102-ba37-4d52-bb3a-407c1a4d1ee0	EMPLOYEE_LANGUAGE	HINDI	Hindi	Hindi language	8	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.119	2026-01-12 01:58:08.119
58053581-614d-4aa5-add3-e070f8782508	EMPLOYEE_LANGUAGE	OTHER	Other	Other language not listed	9	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.12	2026-01-12 01:58:08.12
d3acc04b-0bdf-461d-bc59-645d94288f15	EMPLOYEE_GENDER	MALE	Male	Male gender	0	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.12	2026-01-12 01:58:08.12
9037d121-c560-46d9-92c8-99bece904bf8	EMPLOYEE_GENDER	FEMALE	Female	Female gender	1	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.121	2026-01-12 01:58:08.121
b17c80b9-b029-4801-8d42-e8b03742be50	EMPLOYEE_GENDER	NON_BINARY	Non-Binary	Non-binary gender identity	2	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.142	2026-01-12 01:58:08.142
380141e9-663e-4b32-ade0-87d030e25743	EMPLOYEE_GENDER	PREFER_NOT_TO_SAY	Prefer Not to Say	Prefer not to disclose	3	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.143	2026-01-12 01:58:08.143
2f7bb070-e192-4249-bd4b-40dbfb87e28f	EMPLOYEE_GENDER	OTHER	Other	Other gender identity	4	t	t	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:58:08.145	2026-01-12 01:58:08.145
25153d38-2b40-4993-aa29-69c9ef46755b	RESPONSIBLE_PARTY	QA	QA	\N	0	t	f	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 01:59:52.486	2026-01-12 02:00:04.073
25e5eb5c-d14d-45b4-959f-aa5e10f39d34	RESPONSIBLE_PARTY	MAINTENANCE	Maintenance team	\N	1	t	f	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:00:32.624	2026-01-12 02:00:32.624
7a2f32f1-a5c6-41e2-8966-4ebab62fe5ea	PREVENTIVE_CONTROL_TYPE	PROCESS_CHANGE	Process change	\N	0	t	f	f	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:00.915	2026-01-12 02:01:00.915
\.


--
-- Data for Name: Evidence; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Evidence" (id, type, "fileName", "filePath", "fileSize", "mimeType", transcription, "incidentId", "rcaAnalysisId", "uploadedById", "uploadedAt") FROM stdin;
052fcb77-7c08-4e53-bbe2-8b819c182825	DOCUMENT	RCA_Report_INC-000001_1768190399685.pptx	powerpoint-reports/d4e4aa7d-5282-463c-8e59-2f518a247d15/RCA_Report_INC-000001_1768190399685.pptx	266718	application/vnd.openxmlformats-officedocument.presentationml.presentation	\N	ecd4a118-100c-4ac8-8182-126d5276eac2	d4e4aa7d-5282-463c-8e59-2f518a247d15	434f6086-a5b2-46b9-ae5c-ca7e83635325	2026-01-12 04:00:06.893
\.


--
-- Data for Name: Facility; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Facility" (id, name, timezone, address, "organizationId", "createdAt", "updatedAt") FROM stdin;
5aa61300-b20b-4189-9d91-6cf2a1c565b7	Don Miguel	America/New_York	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-11 23:03:57.372	2026-01-11 23:03:57.372
8792a2ff-31e7-4f55-a911-f9aca5447a1b	Orange Foods	America/New_York	\N	4f5a78d6-4c01-47b1-8da7-cc54a1cda611	2026-01-11 23:09:37.841	2026-01-11 23:09:37.841
\.


--
-- Data for Name: FieldConfiguration; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."FieldConfiguration" (id, "incidentType", "fieldName", "fieldLabel", "fieldType", "isRequired", placeholder, "helpText", "sortOrder", "isActive", "organizationId", "createdAt", "updatedAt") FROM stdin;
8ccfe746-e55e-424e-a2fc-c85489d82515	FOOD_SAFETY	title	Incident Title	text	t	Enter a brief title for this incident	\N	1	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:16.985	2026-01-12 02:01:16.985
66736f60-0cca-45c6-9eb3-6b29a29e95e9	FOOD_SAFETY	description	Description	textarea	t	Describe what happened in detail...	\N	2	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:16.992	2026-01-12 02:01:16.992
e3ef4293-ed4f-4148-b89b-81577c98979d	FOOD_SAFETY	category	Category	select	t	Select a category	\N	3	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:16.995	2026-01-12 02:01:16.995
e18813c4-8410-49b5-9ab7-fd84096695b4	FOOD_SAFETY	subCategory	Sub-Category	select	f	Select a sub-category	\N	4	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:16.998	2026-01-12 02:01:16.998
8d1bd426-3941-4612-8193-685b58144457	FOOD_SAFETY	severity	Severity Level	select	t	Select severity level	\N	5	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.002	2026-01-12 02:01:17.002
eb1468f0-4034-4720-b0d0-f5a67d6c8433	FOOD_SAFETY	facility	Facility	select	t	Select facility	\N	6	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.004	2026-01-12 02:01:17.004
e0082d1b-5c21-4359-8e87-e1343b5dbf96	FOOD_SAFETY	line	Line	select	f	Select production line	\N	7	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.005	2026-01-12 02:01:17.005
f29e8af4-0e5e-4d82-b230-adee90519399	FOOD_SAFETY	product	Product Affected	text	f	Enter product name or SKU	\N	8	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.006	2026-01-12 02:01:17.006
48286e60-8f74-4232-b0c5-baf30a97ee97	FOOD_SAFETY	lotNumber	Lot Number	text	f	Enter lot/batch number	\N	9	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.008	2026-01-12 02:01:17.008
a51e5d34-3c2c-47f4-9fb4-b11f4b08b3c2	FOOD_SAFETY	incidentDate	Date of Incident	date	t	\N	\N	10	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.009	2026-01-12 02:01:17.009
443d61f4-0a49-469e-b866-96a61bb9b339	FOOD_SAFETY	incidentTime	Time of Incident	time	f	\N	\N	11	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.01	2026-01-12 02:01:17.01
b30df936-cd28-4c34-99dd-d59f641fcb39	FOOD_SAFETY	immediateActions	Immediate Actions Taken	textarea	f	Describe any immediate actions taken...	\N	12	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.012	2026-01-12 02:01:17.012
63c2778c-14a5-4fe3-b6cb-5284360406ef	MACHINE_EQUIPMENT	title	Incident Title	text	t	Enter a brief title for this incident	\N	1	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.013	2026-01-12 02:01:17.013
3d22fb24-604c-44a8-9fd8-eefa12b3417d	MACHINE_EQUIPMENT	description	Description	textarea	t	Describe the equipment issue in detail...	\N	2	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.015	2026-01-12 02:01:17.015
610919d1-dba6-41a9-952d-665ff4a09eec	MACHINE_EQUIPMENT	category	Category	select	t	Select a category	\N	3	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.016	2026-01-12 02:01:17.016
a8fcd0cc-2435-4894-8837-66070e0ef064	MACHINE_EQUIPMENT	subCategory	Sub-Category	select	f	Select a sub-category	\N	4	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.017	2026-01-12 02:01:17.017
86ae89ca-9211-495f-8df4-32158cefd142	MACHINE_EQUIPMENT	severity	Severity Level	select	t	Select severity level	\N	5	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.019	2026-01-12 02:01:17.019
0f3d840e-af08-4476-be86-979c5c7a90e5	MACHINE_EQUIPMENT	facility	Facility	select	t	Select facility	\N	6	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.02	2026-01-12 02:01:17.02
17d53bba-6be2-42be-850b-72c8130aca7d	MACHINE_EQUIPMENT	line	Line	select	f	Select production line	\N	7	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.021	2026-01-12 02:01:17.021
77c13e47-ed6c-4c03-aac8-8d8867ea9ce2	MACHINE_EQUIPMENT	machineId	Machine/Equipment ID	text	t	Enter machine ID or name	\N	8	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.023	2026-01-12 02:01:17.023
5a468266-75b9-48b5-a56b-969332980690	MACHINE_EQUIPMENT	incidentDate	Date of Incident	date	t	\N	\N	9	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.025	2026-01-12 02:01:17.025
f23f1d96-76d2-44ec-b914-60a8128be205	MACHINE_EQUIPMENT	incidentTime	Time of Incident	time	f	\N	\N	10	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.026	2026-01-12 02:01:17.026
614a0899-2fb3-495b-a3e3-b82f91e06f99	MACHINE_EQUIPMENT	downtimeMinutes	Downtime (minutes)	text	f	Enter estimated downtime	\N	11	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.028	2026-01-12 02:01:17.028
b0e8bce0-0445-4b31-8fc1-ee8740f3565a	MACHINE_EQUIPMENT	immediateActions	Immediate Actions Taken	textarea	f	Describe any immediate actions taken...	\N	12	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.029	2026-01-12 02:01:17.029
e0f4177f-4fad-4bc2-bdc9-30c9d1d6891d	WORKPLACE_SAFETY	title	Incident Title	text	t	Enter a brief title for this incident	\N	1	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.031	2026-01-12 02:01:17.031
43bcb9d6-305e-4a5d-bd51-aab5967e1819	WORKPLACE_SAFETY	description	Description	textarea	t	Describe the safety incident in detail...	\N	2	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.033	2026-01-12 02:01:17.033
feb86ce0-29e3-4511-a89d-84409490fddc	WORKPLACE_SAFETY	category	Category	select	t	Select a category	\N	3	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.034	2026-01-12 02:01:17.034
92a0366f-64a1-411e-b9cc-e39448279eb9	WORKPLACE_SAFETY	subCategory	Sub-Category	select	f	Select a sub-category	\N	4	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.035	2026-01-12 02:01:17.035
542d532d-e561-4e8f-ad5b-8497556e4eca	WORKPLACE_SAFETY	injuryType	Injury Type	select	t	Select injury type	\N	5	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.036	2026-01-12 02:01:17.036
e8b57f44-f960-43f0-963f-a17fa861a898	WORKPLACE_SAFETY	severity	Severity Level	select	t	Select severity level	\N	6	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.037	2026-01-12 02:01:17.037
ec4ecaa0-f12d-4cc0-a4b5-cec930c0c1c8	WORKPLACE_SAFETY	bodyPart	Body Part(s) Affected	multiselect	t	Select affected body parts	\N	7	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.039	2026-01-12 02:01:17.039
a2734d48-0f3d-4e03-9ba0-98135d64012d	WORKPLACE_SAFETY	facility	Facility	select	t	Select facility	\N	8	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.042	2026-01-12 02:01:17.042
ad9c303c-4b2a-4642-8cd2-59581af3c59a	WORKPLACE_SAFETY	line	Line/Area	select	f	Select line or area	\N	9	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.043	2026-01-12 02:01:17.043
57e3dde7-091b-4880-ab77-4959eb4a01d7	WORKPLACE_SAFETY	taskBeingPerformed	Task Being Performed	text	t	What task was being performed?	\N	10	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.045	2026-01-12 02:01:17.045
a0793d77-c16b-4ca1-9655-a3a3bcb0ade4	WORKPLACE_SAFETY	taskRoutineType	Task Routine Type	select	f	Select task type	\N	11	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.046	2026-01-12 02:01:17.046
675a553c-434f-4938-9751-ea8ba3e078d7	WORKPLACE_SAFETY	incidentDate	Date of Incident	date	t	\N	\N	12	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.048	2026-01-12 02:01:17.048
7e0635cf-4f6f-439d-8565-d5fc6171030b	WORKPLACE_SAFETY	incidentTime	Time of Incident	time	f	\N	\N	13	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.049	2026-01-12 02:01:17.049
99986b46-6528-403e-8692-b9d22cf55b90	WORKPLACE_SAFETY	environmentalCondition	Environmental Conditions	multiselect	f	Select environmental conditions	\N	14	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.051	2026-01-12 02:01:17.051
795e3358-a246-4c4a-bdcb-c5183f62a406	WORKPLACE_SAFETY	ppeRequired	PPE Required	checkbox	f	\N	\N	15	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.052	2026-01-12 02:01:17.052
adab2885-663f-46ea-8017-40f6ce9d08f8	WORKPLACE_SAFETY	ppeWorn	PPE Worn	checkbox	f	\N	\N	16	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.053	2026-01-12 02:01:17.053
2ae66c0d-b180-4295-a1b8-2ac856909609	WORKPLACE_SAFETY	firstAidProvided	First Aid Provided	checkbox	f	\N	\N	17	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.058	2026-01-12 02:01:17.058
c58e2008-5796-439c-860c-47f6f7a226fe	WORKPLACE_SAFETY	medicalTreatmentRequired	Medical Treatment Required	checkbox	f	\N	\N	18	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.059	2026-01-12 02:01:17.059
8f251f47-d487-410b-af86-23f87eb6ea75	WORKPLACE_SAFETY	immediateActions	Immediate Actions Taken	textarea	f	Describe any immediate actions taken...	\N	19	t	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:01:17.061	2026-01-12 02:01:17.061
\.


--
-- Data for Name: Incident; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Incident" (id, "incidentNumber", type, "categoryId", "customTitle", "facilityId", "areaId", "lineId", "shiftId", "productName", "lotNumber", "machineId", description, "aiSummary", "aiAnalysisData", "occurredAt", "reportedAt", status, severity, "aiSuggestedSeverity", "createdById", "assignedToId", "dueDate", "organizationId", "createdAt", "updatedAt", "departmentId", "additionalEmployerHours", "additionalEmployerStartDate", "additionalEmployers", "allBodyPartsInjured", "areaSecured", "assignmentRuleId", "autoAssigned", "bodyPartsAffected", "caseClassification", "contributingActsConditions", "contributingFactors", "dateIncidentReported", "dateInjuryKnownWorkRelated", "dateOfInjury", "dateTimeLeftWork", "dateTimeReturnedToWork", "didLeaveWork", "didReturnToWork", "didSiteRevealCause", "directCause", "employedElsewhere", "employeeIdNumber", "employeeName", "environmentalConditions", "escalatedAt", "escalatedToId", "exposureDuration", "firstAidProvided", "hadPhysicalRestrictions", "incidentDate", "incidentDescriptionDetailed", "incidentTime", "inconsistencyExplanation", "injuryCausedByWork", "injuryDescriptionDetailed", "injuryDevelopedOverTime", "injuryDevelopmentPattern", "injuryLocation", "injuryType", "injuryTypeDescription", "injuryWitnessed", "injuryWorkRelation", "interviewedNames", "investigationBodyParts", "investigationInjuryType", "investigationSubmittedAt", "investigationSubmittedById", "isAreaUnderSurveillance", "isOshaRecordable", "isRoutineTask", "knownRestrictions", "leaderActsConditionsOpinion", "lotoRequired", "machineSafeguardsInPlace", "medicalProvidersInvolved", "medicalTreatmentRequired", "notifiedIndividuals", "otherBodyPartDetail", "otherDutiesExplanation", "otherEmployerNames", "positionAtTimeOfIncident", "ppeRequired", "ppeWorn", "preventionRecommendations", "previousSimilarConditionDetails", "previousSimilarConditionReported", "previousSimilarIncidents", "priorSurgeryDescription", "priorSurgeryPerformed", "reportedToMedicalDept", "resolvedAt", "respondedAt", "siteRevealExplanation", "siteViewDate", "siteViewTime", "slaResolutionBreached", "slaResolutionDeadline", "slaResponseBreached", "slaResponseDeadline", "sopAvailable", "sopFollowed", "specificInjuryLocation", "supervisorActions", "supervisorNotified", "taskBeingPerformed", "taskFrequency", "timeOfInjury", "treatingDoctors", "unsafeActOrCondition", "wasClockedIn", "wasIncidentSiteViewed", "wasInjuryConsistentWithSite", "wasInjuryWitnessed", "wasPerformingOtherDuties", "wasSurveillanceAvailable", "weightOrForce", "weightOrForceUnit", "wereCoworkersPresent", "wereInterviewsDocumented", "werePhotosVideosTaken", "witnessNames", "witnessNamesList", "workedForOtherLast6Months", "environmentalConditionsNA", "bodyPartsAffectedNA", "departmentWhereInjury", "employeeEmail", "employeeGender", "employeeHomeAddress", "employeeLanguage", "employeeLastSSN4", "employeePhone", "interpreterAssisting", "isLostTime", "jobAssignmentAtInjury", "needsInterpreter", "oshaCaseNumber", "ownedJobTitle", "wasEmployeeInstructedInSOP", "wasProperProcedureFollowed", "wasViolationOfSafetyRules", "isTeamIncident", visibility, "isPublic", "sharedWithUserIds", "contributingFactorTypes", "correctiveActionTypes", "incidentPattern", "injuryDevelopmentType", "taskRoutineType") FROM stdin;
ecd4a118-100c-4ac8-8182-126d5276eac2	INC-000001	WORKPLACE_SAFETY	d61ce1b8-0e81-4cce-9b8e-efee108c06a8		5aa61300-b20b-4189-9d91-6cf2a1c565b7	8e3771ff-739f-4cad-b7fe-4c5b6b71e457	3ec0188c-42ce-41dc-b027-cd4ea8524228	5dd86fa9-e8ca-45e1-b371-6b7332c04e43				The employee was trying to remove dough stuck between two returning belts when his finger got caught under the moving flat belt.	On January 8, 2026, at the Don Miguel facility's Raw Area, an incident occurred on Die Cut Line 1 during the second shift. A machine operator sustained an OSHA recordable injury to his fingers while attempting to clear a dough jam between two returning belts without following the standard operating procedure (SOP) for lockout/tagout (LOTO). Despite wearing the required personal protective equipment (PPE) and having machine safeguards in place, the operator's fingers were caught under the moving flat belt, necessitating medical treatment beyond first aid. The task was rarely performed, and the environmental conditions were cold, which may have contributed to the incident. Immediate actions included providing first aid, notifying the supervisor, and securing the area. This incident is classified as an unsafe act, with no previous similar incidents reported.	null	2026-01-08 18:05:00	2026-01-12 02:21:31.591	IN_PROGRESS	HIGH	\N	434f6086-a5b2-46b9-ae5c-ca7e83635325	\N	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:21:31.591	2026-01-12 03:58:15.191	\N		\N		Middle finger nail of right hand	YES	\N	f	{FINGERS}	MEDICAL_ONLY	Did not stop the line	{"people": [], "process": [], "equipment": [], "environment": []}	2026-01-08 00:00:00	2026-01-08 00:00:00	2026-01-08 00:00:00	\N	\N	f	\N	t	clearing jam without proper lockout	f	54113	Nablullah Rajalkil	{COLD}	\N	\N	2 hours 30 minutes	t	f	2026-01-08 00:00:00	While trying to clear a jam, the employee's finger got caught in the belt.	06:05		YES	While trying to clear a jam, the employee's finger got caught in the belt.	\N	SPECIFIC_DATE	On the return belt near the oven area on Die cut Line 1 	RECORDABLE	Cut	t	CAUSED_BY_WORK	Saumon Shoul	{FINGERS}	RECORDABLE	2026-01-12 02:49:11.028	434f6086-a5b2-46b9-ae5c-ca7e83635325	f	f	\N		The fact the area was missing a guard and employee was not trained on safe procedure	YES	YES	Medcor	t	Riak Choi, Hasib 				OTHER	t	t	All employees working in the raw area should avoid doing tasks they haven't been trained for.		f	f		f	t	\N	\N	the area where his finger got caught was missing a guard	2026-01-08 00:00:00	19:45	f	\N	f	\N	t	f	On the return belt near the oven area on Die cut Line 1 	Conduct a training and follow up making sure every one is align	t	Machine Operator	RARELY	06:05	Medcor	UNSAFE_ACT	t	t	t	t	f	\N	40 lbs	\N	f	t	\N	Saumon Shoul	Saumon Shoul	f	f	f	Bakery	geraldnyah4@gmail.com	MALE	9637 FOREST LN APT 815	SPANISH	3465	(469) 716-1494	t	f	Mixer Operator	t	N/A	Mixer Operator	f	f	t	t	TEAM	f	\N	{PEOPLE_TRAINING,PEOPLE_UNSAFE_ACT,PROCESS_NOT_FOLLOWED,EQUIPMENT_NO_GUARD}	{GUARD_INSTALL,TRAINING,SOP_UPDATE}	TASK_SPECIFIC	SPECIFIC_DATE	NON_ROUTINE
\.


--
-- Data for Name: IncidentParticipant; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."IncidentParticipant" (id, "incidentId", "userId", role, "addedById", "joinedAt", "leftAt", "isActive", "canEdit", "canChat", "lastViewedAt", "createdAt", "updatedAt", "invitationStatus", "invitedAt", "respondedAt") FROM stdin;
0cffa3c3-8f46-41af-89b8-adc3db0f375c	ecd4a118-100c-4ac8-8182-126d5276eac2	3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	MEMBER	434f6086-a5b2-46b9-ae5c-ca7e83635325	2026-01-12 03:25:43.798	\N	t	t	t	2026-01-12 03:29:53.208	2026-01-12 03:25:26.42	2026-01-12 03:29:53.208	ACCEPTED	2026-01-12 03:25:26.419	2026-01-12 03:25:43.798
c01e648a-52a4-4e8e-8bbb-55ddbb00fb07	ecd4a118-100c-4ac8-8182-126d5276eac2	434f6086-a5b2-46b9-ae5c-ca7e83635325	OWNER	434f6086-a5b2-46b9-ae5c-ca7e83635325	2026-01-12 03:25:26.382	\N	t	t	t	2026-01-12 03:43:42.579	2026-01-12 03:25:26.382	2026-01-12 03:43:42.58	ACCEPTED	2026-01-12 03:25:26.382	2026-01-12 03:25:26.381
\.


--
-- Data for Name: KnowledgeArticle; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."KnowledgeArticle" (id, title, summary, "sourceIncidentId", "incidentType", "categoryNames", "rootCause", "successfulActions", keywords, "viewCount", "helpfulCount", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Line; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Line" (id, name, description, "machineIds", "areaId", "createdAt", "updatedAt", "lineNumber") FROM stdin;
3ec0188c-42ce-41dc-b027-cd4ea8524228	Die Cut Line 1	\N	\N	8e3771ff-739f-4cad-b7fe-4c5b6b71e457	2026-01-12 01:47:48.818	2026-01-12 01:47:48.818	Line 1
cd922354-579f-4cbb-b5f0-4d7a2dbbbd37	Die Cut Line 2	\N	\N	8e3771ff-739f-4cad-b7fe-4c5b6b71e457	2026-01-12 01:48:05.494	2026-01-12 01:48:05.494	Line 2
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Notification" (id, type, title, message, "isRead", "userId", "incidentId", "createdAt") FROM stdin;
8c4cc806-eb96-4f74-bd00-4a525e369c13	INCIDENT_STATUS_CHANGED	Incident Status Updated	Incident INC-000001 status changed from DRAFT to SUBMITTED by Tchouminyi Nkamtchou	f	434f6086-a5b2-46b9-ae5c-ca7e83635325	ecd4a118-100c-4ac8-8182-126d5276eac2	2026-01-12 02:36:21.381
d72d4407-ede7-4323-93f7-d21c5295be14	INCIDENT_STATUS_CHANGED	Incident Status Updated	Incident INC-000001 status changed from SUBMITTED to DRAFT by Tchouminyi Nkamtchou	f	434f6086-a5b2-46b9-ae5c-ca7e83635325	ecd4a118-100c-4ac8-8182-126d5276eac2	2026-01-12 02:38:38.866
1ac17b5b-2c21-404e-bc91-31a57a272acd	INCIDENT_STATUS_CHANGED	Incident Status Updated	Incident INC-000001 status changed from DRAFT to SUBMITTED by Tchouminyi Nkamtchou	f	434f6086-a5b2-46b9-ae5c-ca7e83635325	ecd4a118-100c-4ac8-8182-126d5276eac2	2026-01-12 02:49:41.661
42f9b778-a3e9-4d86-a387-b1f16672ad27	INCIDENT_ASSIGNED	Team Incident Invitation	You have been invited to join the team for incident INC-000001. Please accept or decline the invitation.	f	3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	ecd4a118-100c-4ac8-8182-126d5276eac2	2026-01-12 03:25:26.431
da278ba4-5e86-4c29-902d-75d29c36f573	INCIDENT_ASSIGNED	Team Invitation Accepted	Gerald Chwoung has accepted the invitation to join incident INC-000001	f	434f6086-a5b2-46b9-ae5c-ca7e83635325	ecd4a118-100c-4ac8-8182-126d5276eac2	2026-01-12 03:25:43.804
\.


--
-- Data for Name: Organization; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Organization" (id, name, region, "defaultLanguage", "isActive", "regulatoryRuleset", "createdAt", "updatedAt", "isPublic", "signupCode") FROM stdin;
00000000-0000-0000-0000-000000000001	Demo Corporation	USA	ENGLISH	t	\N	2026-01-11 22:41:57.605	2026-01-11 22:41:57.605	f	\N
4f5a78d6-4c01-47b1-8da7-cc54a1cda611	Homel foods	USA	ENGLISH	t	\N	2026-01-11 23:09:37.838	2026-01-11 23:09:37.838	f	\N
1221d3d5-5bc1-41cd-b816-80fa9de527ef	MegaMex Foods	USA	ENGLISH	t	\N	2026-01-11 23:03:57.367	2026-01-12 02:51:27.519	t	611620
e4c36e47-77cc-4032-af75-027c041d81da	DASHMET	USA	ENGLISH	t	\N	2026-01-12 05:21:18.304	2026-01-12 05:21:18.304	f	\N
\.


--
-- Data for Name: PolicyDocument; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."PolicyDocument" (id, type, title, content, version, "isPublished", "publishedAt", "updatedByUserId", "createdAt", "updatedAt") FROM stdin;
6775f6df-b9f4-42ca-b5fc-3d5c068e6190	COOKIE_POLICY	Cookie & Local Storage Policy	# Cookie & Local Storage Policy\n\n**Effective Date:** 01-12-2026\n**Last Updated:** 01-12-2026\n\nThis policy explains how DASHMET RCA ("DASHMET," "we," "us," or "our") uses cookies, local storage, and similar technologies when you access our Platform.\n\n---\n\n## 1. Technologies We Use\n\n### 1.1 Local Storage\nLocal storage is a web technology that allows websites to store data in your browser. Unlike cookies, local storage data is not automatically sent to servers with each request.\n\n**We primarily use local storage instead of traditional cookies.**\n\n### 1.2 Session Storage\nSession storage is similar to local storage but is cleared when you close your browser tab.\n\n### 1.3 Cookies\nCookies are small text files stored on your device. We use minimal cookies, primarily for:\n- Third-party service integrations\n- Analytics (if enabled by your organization)\n\n---\n\n## 2. What We Store and Why\n\n### 2.1 Authentication Data\n| Data | Purpose | Storage Type | Duration |\n|------|---------|--------------|----------|\n| Authentication tokens | Keep you securely signed in | Local Storage | Until logout or token expiration |\n| Session information | Maintain your active session | Session Storage | Browser session |\n\n### 2.2 User Preferences\n| Data | Purpose | Storage Type | Duration |\n|------|---------|--------------|----------|\n| Theme preference | Remember dark/light mode | Local Storage | Persistent |\n| Language setting | Display content in your language | Local Storage | Persistent |\n| UI state | Remember collapsed menus, view preferences | Local Storage | Persistent |\n\n### 2.3 Application State\n| Data | Purpose | Storage Type | Duration |\n|------|---------|--------------|----------|\n| Draft content | Preserve unsaved work | Local Storage | Until saved or cleared |\n| Navigation state | Remember your place in workflows | Session Storage | Browser session |\n| Notification counts | Track unread messages | Local Storage | Until read |\n\n### 2.4 Analytics (If Enabled)\n| Data | Purpose | Storage Type | Duration |\n|------|---------|--------------|----------|\n| Usage metrics | Improve Platform performance | Local Storage | 30 days |\n| Error tracking | Identify and fix issues | Session Storage | Browser session |\n\n---\n\n## 3. Third-Party Technologies\n\n### 3.1 Firebase Authentication\nWe use Firebase Authentication for secure sign-in. Firebase may use:\n- Authentication tokens stored in local storage\n- Cookies for session management\n\n**Firebase Privacy Policy:** https://firebase.google.com/support/privacy\n\n### 3.2 Analytics Services\nIf enabled by your organization, analytics services may set cookies to:\n- Track page views and feature usage\n- Measure performance\n- Identify technical issues\n\n---\n\n## 4. Categories of Storage\n\n### 4.1 Strictly Necessary\nRequired for the Platform to function:\n- Authentication tokens\n- Security-related data\n- Session management\n\n**These cannot be disabled** as the Platform requires them to operate.\n\n### 4.2 Functional\nEnhance your experience:\n- Theme preferences\n- Language settings\n- UI customizations\n\nYou can clear these, but your preferences will reset.\n\n### 4.3 Performance\nHelp us improve the Platform:\n- Feature usage data\n- Error logs\n- Performance metrics\n\nMay be controlled through organization settings.\n\n---\n\n## 5. Data We Do NOT Store Locally\n\nWe do **NOT** store the following in your browser:\n- Incident report content\n- Investigation data\n- Personal information of other users\n- Sensitive business data\n- Passwords or raw credentials\n\nThis data is stored securely on our servers, not in your browser.\n\n---\n\n## 6. Managing Your Data\n\n### 6.1 Viewing Stored Data\nMost browsers allow you to view local storage:\n1. Open browser developer tools (F12 or right-click > Inspect)\n2. Navigate to "Application" or "Storage" tab\n3. View Local Storage and Session Storage\n\n### 6.2 Clearing Data\n**Through Your Browser:**\n- Clear browsing data/cache in browser settings\n- Clear specific site data for DASHMET RCA\n\n**Through the Platform:**\n- Log out to clear authentication data\n- Use "Clear Preferences" if available in settings\n\n### 6.3 Browser Settings\nYou can configure your browser to:\n- Block all cookies and local storage (may prevent Platform from working)\n- Clear data when closing the browser\n- Block third-party cookies only\n\n**Warning:** Blocking essential storage will prevent you from using the Platform.\n\n---\n\n## 7. Impact of Blocking Storage\n\n| If You Block... | Impact |\n|-----------------|--------|\n| All local storage | Cannot use the Platform |\n| All cookies | Some features may not work |\n| Third-party cookies | Analytics may not function |\n| Session storage | Must re-authenticate frequently |\n\n---\n\n## 8. Security of Stored Data\n\nWe protect locally stored data by:\n- Using secure (HTTPS) connections only\n- Implementing token expiration\n- Not storing sensitive data locally\n- Using industry-standard encryption for tokens\n\n**Your responsibilities:**\n- Use a secure, updated browser\n- Don't use shared or public computers for sensitive work\n- Log out when finished, especially on shared devices\n- Keep your device secure\n\n---\n\n## 9. Children's Privacy\n\nThe Platform is not designed for users under 18. We do not knowingly collect data from children through cookies or local storage.\n\n---\n\n## 10. Organization Controls\n\nYour organization's administrator may:\n- Enable or disable certain analytics\n- Configure data retention preferences\n- Set security policies affecting storage\n\nContact your administrator for organization-specific policies.\n\n---\n\n## 11. Changes to This Policy\n\nWe may update this policy to reflect:\n- Changes in technologies we use\n- New features or services\n- Regulatory requirements\n\nUpdates will be posted with a new "Last Updated" date.\n\n---\n\n## 12. Contact Us\n\n**Questions about this policy:**\n- Contact your organization administrator\n- Use the in-app support request feature\n\n---\n\n## 13. Technical Reference\n\nFor developers and security teams:\n\n**Local Storage Keys Used:**\n- `firebaseToken` - Authentication token\n- `userLanguage` - Language preference\n- `theme` - UI theme preference\n- `chatUnreadCounts` - Notification state\n\n**Session Storage Keys:**\n- Temporary application state\n- Form draft data\n\n---\n\n*This policy is specific to the DASHMET RCA platform. Your organization may have additional policies governing browser storage and cookies.*\n	3	t	2026-01-12 04:48:54.737	\N	2026-01-11 22:41:57.955	2026-01-12 04:48:54.744
750073d3-29e6-4116-a2be-84f328026e9b	PRIVACY_POLICY	Privacy Policy	# Privacy Policy\n\n**Effective Date:** 01-12-2026\n**Last Updated:** 01-12-2026\n\nDASHMET RCA is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Root Cause Analysis and Incident Management platform (the "Platform").\n\n---\n\n## 1. Information We Collect\n\n### 1.1 Account Information\nWhen you register or are provisioned an account, we collect:\n- Full name and email address\n- Employee ID and job title\n- Department and organizational affiliation\n- Role and access permissions\n- Profile preferences (language, theme, timezone)\n\n### 1.2 Incident and Investigation Data\nThrough normal use of the Platform, we process:\n- Incident reports including descriptions, dates, locations, and classifications\n- Root cause analysis data (5 Whys, Fishbone diagrams, investigation findings)\n- Corrective and preventive action (CAPA) records\n- Evidence and attachments (documents, images, reports)\n- Witness statements and interview notes\n- Investigation timelines and audit trails\n\n### 1.3 Workplace Safety Information\nFor workplace safety incidents, we may collect:\n- Injury and illness details\n- Body parts affected and medical treatment information\n- Equipment and environmental conditions\n- PPE usage and safety protocol compliance\n- Near-miss and hazard reports\n\n### 1.4 Automatically Collected Information\nWe automatically collect:\n- Device information (browser type, operating system, screen resolution)\n- Access logs (login times, IP addresses, pages visited)\n- Feature usage analytics and interaction patterns\n- Error logs and performance data\n\n### 1.5 Communication Data\n- In-platform messages and chat communications\n- Support requests and feedback\n- Email notifications and preferences\n\n---\n\n## 2. How We Use Your Information\n\nWe use collected information to:\n\n**Provide Core Services**\n- Authenticate users and manage access permissions\n- Enable incident reporting and root cause analysis workflows\n- Generate investigation reports and compliance documentation\n- Facilitate team collaboration and communication\n- Track corrective actions and preventive controls\n\n**Improve the Platform**\n- Analyze usage patterns to enhance features\n- Identify and fix technical issues\n- Develop new capabilities based on user needs\n- Optimize performance and reliability\n\n**Ensure Safety and Compliance**\n- Maintain audit trails for regulatory compliance\n- Support workplace safety programs and reporting requirements\n- Enable trend analysis for safety improvements\n- Generate required regulatory reports (OSHA, internal audits)\n\n**Communicate With You**\n- Send service notifications and updates\n- Provide customer support\n- Alert you to assigned tasks and deadlines\n- Deliver training and onboarding information\n\n---\n\n## 3. AI-Assisted Features\n\nDASHMET RCA includes AI-powered features to assist with:\n- Automated 5 Whys analysis suggestions\n- Root cause identification and validation\n- Corrective action recommendations\n- Investigation report generation\n\n**Important AI Disclosures:**\n- AI suggestions are provided as assistance only and require human review\n- AI-generated content should be validated by qualified personnel\n- Your data may be processed by AI models to provide suggestions\n- AI features can be disabled by organization administrators\n- We do not use your incident data to train general AI models\n\n---\n\n## 4. Data Sharing and Disclosure\n\n### 4.1 Within Your Organization\n- Data is shared with authorized users within your organization based on role permissions\n- Organization administrators can access usage reports and audit logs\n- Supervisors can view incidents and investigations they are assigned to\n\n### 4.2 Service Providers\nWe engage trusted third parties to help operate the Platform:\n- Cloud hosting and infrastructure (data storage and processing)\n- Authentication services (Firebase Authentication)\n- Email delivery services (notifications and alerts)\n- Analytics providers (usage insights)\n\nAll service providers are contractually bound to protect your data and use it only for specified purposes.\n\n### 4.3 Legal Requirements\nWe may disclose information:\n- To comply with applicable laws, regulations, or legal processes\n- To respond to lawful requests from public authorities\n- To protect our rights, privacy, safety, or property\n- To enforce our terms and agreements\n\n### 4.4 Business Transfers\nIn the event of a merger, acquisition, or sale of assets, user data may be transferred to the acquiring entity with continued protection under this policy.\n\n**We do not sell your personal information.**\n\n---\n\n## 5. Data Retention\n\nWe retain your information according to the following guidelines:\n\n| Data Type | Retention Period |\n|-----------|------------------|\n| Account information | Duration of account plus 30 days after deletion |\n| Incident records | As configured by organization (typically 7 years for compliance) |\n| Investigation data | As configured by organization (typically 7 years for compliance) |\n| Audit logs | 7 years minimum for regulatory compliance |\n| Communication data | 2 years or as required by organization |\n| Analytics data | 2 years in aggregate form |\n\nOrganizations may configure longer retention periods based on regulatory requirements. Data can be exported before deletion upon request.\n\n---\n\n## 6. Data Security\n\nWe implement comprehensive security measures:\n\n**Technical Safeguards**\n- TLS encryption for all data in transit\n- Encryption at rest for sensitive data\n- Secure token-based authentication (JWT)\n- Regular security assessments and penetration testing\n\n**Access Controls**\n- Role-based access control (RBAC)\n- Multi-tenant data isolation\n- Session management and automatic timeouts\n- Audit logging of all data access\n\n**Operational Security**\n- Employee security training\n- Incident response procedures\n- Regular backup and disaster recovery testing\n- Vulnerability management program\n\n---\n\n## 7. Your Rights and Choices\n\nDepending on your location, you may have rights to:\n\n**Access** – Request a copy of your personal data\n**Correction** – Update inaccurate or incomplete information\n**Deletion** – Request deletion of your data (subject to retention requirements)\n**Portability** – Receive your data in a structured format\n**Restriction** – Limit how we process your data\n**Objection** – Object to certain processing activities\n\n**To exercise your rights:**\n1. Contact your organization administrator for data managed by your organization\n2. Submit a request through the Platform's support feature\n3. Email our privacy team (contact information available in the Platform)\n\nNote: Some requests may be subject to legal retention requirements or legitimate business needs.\n\n---\n\n## 8. International Data Transfers\n\nIf your data is transferred to countries outside your jurisdiction, we ensure appropriate safeguards are in place, including:\n- Standard Contractual Clauses approved by relevant authorities\n- Data processing agreements with recipients\n- Compliance with applicable transfer regulations\n\n---\n\n## 9. Children's Privacy\n\nDASHMET RCA is designed for business use and is not intended for individuals under 18 years of age. We do not knowingly collect information from children.\n\n---\n\n## 10. Changes to This Policy\n\nWe may update this Privacy Policy periodically. We will:\n- Update the "Last Updated" date at the top\n- Notify users of material changes through the Platform\n- Maintain previous versions for reference\n\nContinued use of the Platform after changes constitutes acceptance of the updated policy.\n\n---\n\n## 11. Contact Us\n\nFor privacy-related questions or concerns:\n\n**Organization-Level Inquiries:** Contact your organization administrator through the Platform\n\n**Platform Support:** Use the in-app support request feature\n\n**Data Protection Inquiries:** Submit a request through the Platform's privacy settings\n\n---\n\n*This Privacy Policy is provided for informational purposes. Your organization may have additional privacy requirements and policies that apply to your use of the Platform.*\n	5	t	2026-01-12 04:48:05.863	\N	2026-01-11 22:41:57.934	2026-01-12 04:48:05.872
8cbf6c88-c9eb-4a7e-90fd-947f914ca28d	TERMS_OF_SERVICE	Terms of Service	# Terms of Service\n\n**Effective Date:** 01-12-2026\n**Last Updated:** 01-12-2026\n\nThese Terms of Service ("Terms") constitute a legally binding agreement between you and DASHMET RCA ("DASHMET," "we," "us," or "our") governing your access to and use of the DASHMET RCA platform and related services (collectively, the "Platform").\n\n**By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, do not use the Platform.**\n\n---\n\n## 1. Definitions\n\n**"Customer"** means the organization that has contracted with DASHMET for access to the Platform.\n\n**"User"** means any individual authorized by a Customer to access the Platform.\n\n**"Content"** means any data, text, files, images, reports, or other materials submitted to or generated through the Platform.\n\n**"Services"** means the root cause analysis, incident management, and related features provided through the Platform.\n\n---\n\n## 2. Account Registration and Access\n\n### 2.1 Authorization\n- Access to the Platform requires authorization from a Customer organization\n- You must be designated by your organization's administrator to receive access\n- You must provide accurate information when creating your account\n\n### 2.2 Account Security\nYou are responsible for:\n- Maintaining the confidentiality of your login credentials\n- All activities that occur under your account\n- Immediately notifying your administrator of any unauthorized access\n- Using strong passwords and following security best practices\n\n### 2.3 Access Codes\n- Some features may require organization-specific access codes\n- Access codes must be kept confidential within your organization\n- Sharing access codes outside your organization is prohibited\n\n---\n\n## 3. Acceptable Use\n\n### 3.1 Permitted Uses\nYou may use the Platform to:\n- Report and investigate incidents within your organization\n- Conduct root cause analysis using provided methodologies\n- Collaborate with authorized team members\n- Generate reports and track corrective actions\n- Access training and reference materials\n\n### 3.2 Prohibited Activities\nYou agree NOT to:\n- Access the Platform without proper authorization\n- Share login credentials or access codes with unauthorized persons\n- Attempt to access data belonging to other organizations\n- Upload malicious software, viruses, or harmful code\n- Reverse engineer, decompile, or disassemble the Platform\n- Use the Platform for any unlawful purpose\n- Interfere with or disrupt Platform operations\n- Circumvent security measures or access controls\n- Scrape, harvest, or collect data through automated means\n- Use AI features to generate misleading or fabricated investigation data\n- Submit false incident reports or investigation findings\n- Impersonate other users or misrepresent your identity\n\n### 3.3 Content Standards\nAll Content you submit must:\n- Be accurate and truthful to the best of your knowledge\n- Comply with applicable laws and regulations\n- Not infringe on intellectual property rights of others\n- Not contain discriminatory, harassing, or offensive material\n- Be appropriate for a professional business environment\n\n---\n\n## 4. Intellectual Property\n\n### 4.1 Platform Ownership\nDASHMET and its licensors retain all right, title, and interest in:\n- The Platform and all related software\n- Our trademarks, logos, and branding\n- Platform documentation and training materials\n- AI models and analytical methodologies\n\n### 4.2 Customer Data\n- Customers retain ownership of their organizational data\n- You retain ownership of Content you create (subject to your organization's policies)\n- By using the Platform, you grant us a license to process your Content solely to provide the Services\n\n### 4.3 Feedback\nIf you provide suggestions or feedback about the Platform, we may use such feedback without obligation to you.\n\n---\n\n## 5. AI-Assisted Features\n\n### 5.1 Nature of AI Assistance\n- AI features provide suggestions and recommendations only\n- AI-generated content requires human review and validation\n- AI suggestions should not replace professional judgment\n\n### 5.2 User Responsibility\nYou acknowledge that:\n- You are responsible for reviewing and validating AI suggestions\n- AI outputs may contain errors or inaccuracies\n- Final decisions in investigations remain with qualified personnel\n- AI-assisted analysis does not constitute professional advice\n\n### 5.3 AI Limitations\nWe do not guarantee that AI features will:\n- Identify all relevant root causes\n- Provide complete or accurate suggestions\n- Be available at all times\n- Meet specific regulatory requirements\n\n---\n\n## 6. Data Protection and Privacy\n\n### 6.1 Data Processing\n- We process data in accordance with our Privacy Policy\n- Customer data is logically separated by organization\n- We implement security measures to protect data\n\n### 6.2 Data Ownership\n- Customer organizations own and control their data\n- Users should follow their organization's data handling policies\n- Data export capabilities are available to authorized administrators\n\n### 6.3 Compliance\n- Customers are responsible for ensuring their use complies with applicable laws\n- We provide features to support compliance but do not guarantee regulatory compliance\n- Industry-specific requirements (OSHA, etc.) are the Customer's responsibility\n\n---\n\n## 7. Service Levels and Availability\n\n### 7.1 Availability\n- We strive to maintain high Platform availability\n- Scheduled maintenance will be communicated in advance when possible\n- We do not guarantee uninterrupted or error-free service\n\n### 7.2 Modifications\nWe may:\n- Update, modify, or discontinue features with reasonable notice\n- Release new versions and require updates\n- Change these Terms with notice to Users\n\n### 7.3 Support\n- Support is available through the Platform's built-in support request feature\n- Response times may vary based on Customer agreement\n- Users should contact their organization administrator for first-level support\n\n---\n\n## 8. Disclaimers\n\n### 8.1 "As Is" Basis\nTHE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.\n\n### 8.2 No Professional Advice\nThe Platform provides tools for investigation and analysis but does not constitute:\n- Legal advice\n- Medical advice\n- Professional safety consulting\n- Regulatory compliance certification\n\n### 8.3 Third-Party Services\nWe are not responsible for third-party services integrated with the Platform.\n\n---\n\n## 9. Limitation of Liability\n\n### 9.1 Exclusion of Damages\nTO THE MAXIMUM EXTENT PERMITTED BY LAW, DASHMET SHALL NOT BE LIABLE FOR ANY:\n- Indirect, incidental, special, consequential, or punitive damages\n- Loss of profits, revenue, data, or business opportunities\n- Damages arising from reliance on AI-generated content\n- Damages resulting from unauthorized access to your account\n\n### 9.2 Liability Cap\nOUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID BY CUSTOMER FOR THE SERVICES IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.\n\n### 9.3 Exceptions\nThese limitations do not apply to liability that cannot be excluded by law.\n\n---\n\n## 10. Indemnification\n\nYou agree to indemnify and hold harmless DASHMET from claims arising from:\n- Your violation of these Terms\n- Your violation of any law or regulation\n- Content you submit that infringes third-party rights\n- Your use of AI features contrary to these Terms\n\n---\n\n## 11. Termination\n\n### 11.1 By You\nYou may stop using the Platform at any time. Contact your administrator to deactivate your account.\n\n### 11.2 By Us\nWe may suspend or terminate access if:\n- You violate these Terms\n- Your organization's agreement with us ends\n- Required by law\n- Necessary to protect the Platform or other users\n\n### 11.3 Effect of Termination\nUpon termination:\n- Your access rights cease immediately\n- You must stop using the Platform\n- Data may be retained per our retention policies and Customer agreements\n\n---\n\n## 12. Dispute Resolution\n\n### 12.1 Governing Law\nThese Terms are governed by the laws of the jurisdiction specified in your organization's agreement with us.\n\n### 12.2 Informal Resolution\nBefore initiating formal proceedings, parties agree to attempt informal resolution.\n\n### 12.3 Arbitration\nDisputes may be subject to binding arbitration as specified in Customer agreements.\n\n---\n\n## 13. General Provisions\n\n### 13.1 Entire Agreement\nThese Terms, together with our Privacy Policy and any Customer agreement, constitute the entire agreement.\n\n### 13.2 Severability\nIf any provision is found unenforceable, the remaining provisions remain in effect.\n\n### 13.3 No Waiver\nFailure to enforce any provision does not constitute a waiver.\n\n### 13.4 Assignment\nYou may not assign your rights under these Terms without our consent.\n\n---\n\n## 14. Changes to Terms\n\nWe may modify these Terms by:\n- Posting updated Terms on the Platform\n- Notifying Users of material changes\n- Updating the "Last Updated" date\n\nContinued use after changes become effective constitutes acceptance.\n\n---\n\n## 15. Contact Information\n\n**For questions about these Terms:**\n- Contact your organization administrator\n- Use the in-app support request feature\n- Review the help documentation within the Platform\n\n---\n\n*These Terms of Service supplement any agreement between DASHMET and your organization. In case of conflict, the Customer agreement takes precedence.*\n	3	t	2026-01-12 04:48:39.031	\N	2026-01-11 22:41:57.949	2026-01-12 04:48:39.035
43ea9bf6-5129-4d6c-bc20-e65efad1df9c	SECURITY	Security	# Security Overview\n\n**Effective Date:** 01-12-2026\n**Last Updated:** 01-12-2026\n\nAt DASHMET RCA, security is foundational to everything we do. This document outlines our security practices, your responsibilities, and how we work together to protect sensitive incident and investigation data.\n\n---\n\n## 1. Our Security Commitment\n\nDASHMET RCA is designed to handle sensitive workplace incident data, including:\n- Safety and injury information\n- Root cause investigations\n- Corrective action tracking\n- Compliance documentation\n\nWe implement comprehensive security measures appropriate for this sensitive data.\n\n---\n\n## 2. Authentication & Access Control\n\n### 2.1 Authentication\n- **Token-based authentication** using industry-standard JWT (JSON Web Tokens)\n- **Firebase Authentication** for secure identity management\n- **Automatic token refresh** with configurable session timeouts\n- **Secure password requirements** enforced at account creation\n\n### 2.2 Role-Based Access Control (RBAC)\nWe implement granular access controls:\n\n| Role | Access Level |\n|------|--------------|\n| **System Administrator** | Platform-wide configuration and management |\n| **Organization Admin** | Full access within organization |\n| **CI Manager** | Investigation management and oversight |\n| **Safety/Security Manager** | Safety programs and compliance |\n| **Supervisor** | Team-level incident management |\n| **Employee** | Report incidents, view assigned items |\n\n### 2.3 Access Code Protection\n- Organization-specific access codes for registration\n- Codes can be regenerated by administrators\n- Access codes are separate from user credentials\n\n### 2.4 Session Management\n- Automatic session timeout after inactivity\n- Secure logout clears authentication tokens\n- Concurrent session management available\n\n---\n\n## 3. Data Protection\n\n### 3.1 Encryption\n**In Transit:**\n- All communications encrypted with TLS 1.2 or higher\n- HTTPS enforced for all connections\n- Secure WebSocket connections for real-time features\n\n**At Rest:**\n- Database encryption for sensitive fields\n- Encrypted file storage for attachments\n- Secure key management practices\n\n### 3.2 Multi-Tenant Isolation\n- Strict logical separation between organizations\n- Database-level tenant isolation\n- API-level access validation\n- No cross-organization data access\n\n### 3.3 Data Minimization\n- Collect only necessary information\n- Configurable data retention policies\n- Secure data deletion procedures\n\n---\n\n## 4. Infrastructure Security\n\n### 4.1 Cloud Security\n- Hosted on enterprise-grade cloud infrastructure\n- Regular security patching and updates\n- Network segmentation and firewalls\n- DDoS protection\n\n### 4.2 Monitoring & Detection\n- Real-time security monitoring\n- Intrusion detection systems\n- Automated alerting for anomalies\n- 24/7 infrastructure monitoring\n\n### 4.3 Backup & Recovery\n- Regular automated backups\n- Geographically distributed backup storage\n- Tested disaster recovery procedures\n- Point-in-time recovery capability\n\n---\n\n## 5. Application Security\n\n### 5.1 Secure Development\n- Security-focused development practices\n- Code review requirements\n- Dependency vulnerability scanning\n- Regular security assessments\n\n### 5.2 Input Validation\n- Server-side validation of all inputs\n- Protection against injection attacks (SQL, XSS, etc.)\n- File upload scanning and restrictions\n- Rate limiting on API endpoints\n\n### 5.3 Audit Logging\nComprehensive audit trails including:\n- User authentication events\n- Data access and modifications\n- Administrative actions\n- Security-relevant events\n\nAudit logs are:\n- Tamper-resistant\n- Retained per compliance requirements\n- Available for security investigations\n\n---\n\n## 6. AI Security\n\n### 6.1 AI Data Handling\n- AI processes data within secure boundaries\n- No training on customer-specific data\n- AI suggestions are clearly labeled\n- Human review required for AI outputs\n\n### 6.2 AI Access Controls\n- AI features respect user permissions\n- Organization can disable AI features\n- AI outputs subject to same access controls as user data\n\n---\n\n## 7. Compliance & Certifications\n\n### 7.1 Supported Compliance Frameworks\nThe Platform includes features to support:\n- **OSHA** workplace safety reporting requirements\n- **ISO 45001** occupational health and safety management\n- **Internal audit** requirements for incident management\n- **Industry-specific** compliance needs\n\n### 7.2 Data Privacy Compliance\nWe support compliance with:\n- General Data Protection Regulation (GDPR)\n- California Consumer Privacy Act (CCPA)\n- Other applicable privacy regulations\n\n*Note: Compliance is a shared responsibility. Organizations must configure and use the Platform appropriately for their specific requirements.*\n\n---\n\n## 8. Incident Response\n\n### 8.1 Our Process\n1. **Detection** - Automated monitoring and alerting\n2. **Assessment** - Rapid triage and impact analysis\n3. **Containment** - Immediate protective measures\n4. **Remediation** - Root cause fix and recovery\n5. **Communication** - Timely notification to affected parties\n6. **Review** - Post-incident analysis and improvements\n\n### 8.2 Security Incident Notification\n- Affected organizations notified promptly\n- Clear communication about scope and impact\n- Guidance on protective measures\n- Follow-up on remediation status\n\n---\n\n## 9. Your Security Responsibilities\n\n### 9.1 Account Security\n✅ **DO:**\n- Use strong, unique passwords\n- Keep credentials confidential\n- Log out on shared devices\n- Report suspicious activity immediately\n- Enable additional security features when available\n\n❌ **DON'T:**\n- Share your login credentials\n- Use the same password across services\n- Leave sessions unattended\n- Ignore security notifications\n- Access from unsecured networks\n\n### 9.2 Data Handling\n✅ **DO:**\n- Follow your organization's data policies\n- Report only accurate information\n- Use appropriate classification for sensitive data\n- Verify recipients before sharing reports\n\n❌ **DON'T:**\n- Export data to unsecured locations\n- Share investigation details inappropriately\n- Upload unauthorized files\n- Bypass data access controls\n\n### 9.3 Device Security\n✅ **DO:**\n- Keep browsers and devices updated\n- Use antivirus/anti-malware software\n- Lock devices when unattended\n- Use secure networks\n\n❌ **DON'T:**\n- Access from compromised devices\n- Use outdated browsers\n- Ignore security updates\n- Connect via unsecured public WiFi\n\n---\n\n## 10. Administrator Security Guide\n\n### 10.1 User Management\n- Regularly review user access and permissions\n- Promptly remove access for departed employees\n- Use principle of least privilege\n- Document access decisions\n\n### 10.2 Organization Settings\n- Configure appropriate session timeouts\n- Review and rotate access codes periodically\n- Enable audit logging\n- Configure data retention appropriately\n\n### 10.3 Monitoring\n- Review audit logs regularly\n- Investigate unusual activity\n- Track failed authentication attempts\n- Monitor for data exfiltration indicators\n\n---\n\n## 11. Reporting Security Issues\n\n### 11.1 How to Report\nIf you discover a potential security vulnerability:\n\n1. **Do not** exploit the vulnerability or access data beyond what's necessary to demonstrate the issue\n2. **Report immediately** through one of these channels:\n   - In-app support request (mark as security-related)\n   - Contact your organization administrator\n   - Email details securely (contact information available in Platform)\n\n### 11.2 What to Include\n- Description of the vulnerability\n- Steps to reproduce\n- Potential impact assessment\n- Your contact information\n\n### 11.3 Response Expectations\n- Acknowledgment within 24 hours\n- Assessment and prioritization\n- Regular updates on remediation progress\n- Recognition for responsible disclosure (if desired)\n\n---\n\n## 12. Security Updates & Communication\n\n### 12.1 How We Communicate\n- Security announcements in the Platform\n- Email notifications for critical issues\n- Documentation updates\n- Release notes for security improvements\n\n### 12.2 Staying Informed\n- Enable notifications for security updates\n- Review release notes regularly\n- Follow administrator guidance\n- Participate in security training\n\n---\n\n## 13. Third-Party Security\n\n### 13.1 Vendor Management\nWe carefully evaluate and monitor third-party services:\n- Security assessments before engagement\n- Contractual security requirements\n- Regular review of vendor security posture\n- Data processing agreements\n\n### 13.2 Key Third Parties\n- **Cloud Infrastructure** - Enterprise-grade hosting with security certifications\n- **Firebase** - Google's secure authentication platform\n- **AI Services** - Processed with appropriate data protections\n\n---\n\n## 14. Business Continuity\n\n### 14.1 Availability\n- High-availability architecture\n- Geographic redundancy\n- Automated failover capabilities\n- Regular disaster recovery testing\n\n### 14.2 Recovery Objectives\n- Recovery Time Objective (RTO): Minimize downtime\n- Recovery Point Objective (RPO): Minimal data loss\n- Regular backup verification\n- Documented recovery procedures\n\n---\n\n## 15. Continuous Improvement\n\nWe continuously improve security through:\n- Regular security assessments\n- Penetration testing\n- Bug bounty considerations\n- Industry best practice adoption\n- Security training and awareness\n- Incident learnings integration\n\n---\n\n## 16. Questions & Support\n\n**Security Questions:**\n- Contact your organization administrator\n- Use the in-app support request feature\n- Review this documentation and help resources\n\n**Emergency Security Issues:**\n- Report immediately through available channels\n- Contact your organization's IT security team\n- Do not delay reporting critical issues\n\n---\n\n*Security is a shared responsibility. Together, we can protect the sensitive incident and investigation data that organizations trust us to handle.*\n\n---\n\n**Document Version:** 1.0\n**Classification:** Public\n**Review Cycle:** Annual or as needed\n	3	t	2026-01-12 04:49:36.24	\N	2026-01-11 22:41:57.958	2026-01-12 04:49:36.246
\.


--
-- Data for Name: PolicyRevision; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."PolicyRevision" (id, "policyId", version, title, content, "createdByUserId", "createdAt") FROM stdin;
7792e7db-5988-48c6-94d2-5e5eaa6a0595	6775f6df-b9f4-42ca-b5fc-3d5c068e6190	1	Cookie Policy	# Cookie Policy\n\n**Effective Date:** 2026-01-11\n\nThis Cookie Policy explains how DASHMET RCA uses cookies and similar technologies.\n\n## 1. What Are Cookies?\nCookies are small text files stored on your device when you visit a website. Similar technologies include local storage, pixels, and other identifiers.\n\n## 2. Types of Cookies We Use\n- **Strictly Necessary:** Required for the Services to function (e.g., session management, security).\n- **Preferences:** Remember settings such as theme and language.\n- **Analytics/Performance:** Help us understand usage and improve performance.\n\n## 3. How We Use Cookies\nWe use cookies to:\n- Keep you signed in and secure the Services.\n- Store preferences.\n- Monitor reliability and performance.\n\n## 4. Managing Cookies\nYou can control cookies through your browser settings. Blocking some cookies may impact functionality and your ability to access certain features.\n\n## 5. Changes to This Cookie Policy\nWe may update this policy periodically. We will update the Effective Date when changes are made.\n	\N	2026-01-11 22:41:57.957
19524b52-1103-479f-b08f-ca473b861351	750073d3-29e6-4116-a2be-84f328026e9b	3	Privacy Policy	# Privacy Policy\n\n**Effective Date:** 2026-01-12\n**Last Updated:** 2026-01-12\n\nDASHMET RCA ("DASHMET," "we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Root Cause Analysis and Incident Management platform (the "Platform").\n\n---\n\n## 1. Information We Collect\n\n### 1.1 Account Information\nWhen you register or are provisioned an account, we collect:\n- Full name and email address\n- Employee ID and job title\n- Department and organizational affiliation\n- Role and access permissions\n- Profile preferences (language, theme, timezone)\n\n### 1.2 Incident and Investigation Data\nThrough normal use of the Platform, we process:\n- Incident reports including descriptions, dates, locations, and classifications\n- Root cause analysis data (5 Whys, Fishbone diagrams, investigation findings)\n- Corrective and preventive action (CAPA) records\n- Evidence and attachments (documents, images, reports)\n- Witness statements and interview notes\n- Investigation timelines and audit trails\n\n### 1.3 Workplace Safety Information\nFor workplace safety incidents, we may collect:\n- Injury and illness details\n- Body parts affected and medical treatment information\n- Equipment and environmental conditions\n- PPE usage and safety protocol compliance\n- Near-miss and hazard reports\n\n### 1.4 Automatically Collected Information\nWe automatically collect:\n- Device information (browser type, operating system, screen resolution)\n- Access logs (login times, IP addresses, pages visited)\n- Feature usage analytics and interaction patterns\n- Error logs and performance data\n\n### 1.5 Communication Data\n- In-platform messages and chat communications\n- Support requests and feedback\n- Email notifications and preferences\n\n---\n\n## 2. How We Use Your Information\n\nWe use collected information to:\n\n**Provide Core Services**\n- Authenticate users and manage access permissions\n- Enable incident reporting and root cause analysis workflows\n- Generate investigation reports and compliance documentation\n- Facilitate team collaboration and communication\n- Track corrective actions and preventive controls\n\n**Improve the Platform**\n- Analyze usage patterns to enhance features\n- Identify and fix technical issues\n- Develop new capabilities based on user needs\n- Optimize performance and reliability\n\n**Ensure Safety and Compliance**\n- Maintain audit trails for regulatory compliance\n- Support workplace safety programs and reporting requirements\n- Enable trend analysis for safety improvements\n- Generate required regulatory reports (OSHA, internal audits)\n\n**Communicate With You**\n- Send service notifications and updates\n- Provide customer support\n- Alert you to assigned tasks and deadlines\n- Deliver training and onboarding information\n\n---\n\n## 3. AI-Assisted Features\n\nDASHMET RCA includes AI-powered features to assist with:\n- Automated 5 Whys analysis suggestions\n- Root cause identification and validation\n- Corrective action recommendations\n- Investigation report generation\n\n**Important AI Disclosures:**\n- AI suggestions are provided as assistance only and require human review\n- AI-generated content should be validated by qualified personnel\n- Your data may be processed by AI models to provide suggestions\n- AI features can be disabled by organization administrators\n- We do not use your incident data to train general AI models\n\n---\n\n## 4. Data Sharing and Disclosure\n\n### 4.1 Within Your Organization\n- Data is shared with authorized users within your organization based on role permissions\n- Organization administrators can access usage reports and audit logs\n- Supervisors can view incidents and investigations they are assigned to\n\n### 4.2 Service Providers\nWe engage trusted third parties to help operate the Platform:\n- Cloud hosting and infrastructure (data storage and processing)\n- Authentication services (Firebase Authentication)\n- Email delivery services (notifications and alerts)\n- Analytics providers (usage insights)\n\nAll service providers are contractually bound to protect your data and use it only for specified purposes.\n\n### 4.3 Legal Requirements\nWe may disclose information:\n- To comply with applicable laws, regulations, or legal processes\n- To respond to lawful requests from public authorities\n- To protect our rights, privacy, safety, or property\n- To enforce our terms and agreements\n\n### 4.4 Business Transfers\nIn the event of a merger, acquisition, or sale of assets, user data may be transferred to the acquiring entity with continued protection under this policy.\n\n**We do not sell your personal information.**\n\n---\n\n## 5. Data Retention\n\nWe retain your information according to the following guidelines:\n\n| Data Type | Retention Period |\n|-----------|------------------|\n| Account information | Duration of account plus 30 days after deletion |\n| Incident records | As configured by organization (typically 7 years for compliance) |\n| Investigation data | As configured by organization (typically 7 years for compliance) |\n| Audit logs | 7 years minimum for regulatory compliance |\n| Communication data | 2 years or as required by organization |\n| Analytics data | 2 years in aggregate form |\n\nOrganizations may configure longer retention periods based on regulatory requirements. Data can be exported before deletion upon request.\n\n---\n\n## 6. Data Security\n\nWe implement comprehensive security measures:\n\n**Technical Safeguards**\n- TLS encryption for all data in transit\n- Encryption at rest for sensitive data\n- Secure token-based authentication (JWT)\n- Regular security assessments and penetration testing\n\n**Access Controls**\n- Role-based access control (RBAC)\n- Multi-tenant data isolation\n- Session management and automatic timeouts\n- Audit logging of all data access\n\n**Operational Security**\n- Employee security training\n- Incident response procedures\n- Regular backup and disaster recovery testing\n- Vulnerability management program\n\n---\n\n## 7. Your Rights and Choices\n\nDepending on your location, you may have rights to:\n\n**Access** – Request a copy of your personal data\n**Correction** – Update inaccurate or incomplete information\n**Deletion** – Request deletion of your data (subject to retention requirements)\n**Portability** – Receive your data in a structured format\n**Restriction** – Limit how we process your data\n**Objection** – Object to certain processing activities\n\n**To exercise your rights:**\n1. Contact your organization administrator for data managed by your organization\n2. Submit a request through the Platform's support feature\n3. Email our privacy team (contact information available in the Platform)\n\nNote: Some requests may be subject to legal retention requirements or legitimate business needs.\n\n---\n\n## 8. International Data Transfers\n\nIf your data is transferred to countries outside your jurisdiction, we ensure appropriate safeguards are in place, including:\n- Standard Contractual Clauses approved by relevant authorities\n- Data processing agreements with recipients\n- Compliance with applicable transfer regulations\n\n---\n\n## 9. Children's Privacy\n\nDASHMET RCA is designed for business use and is not intended for individuals under 18 years of age. We do not knowingly collect information from children.\n\n---\n\n## 10. Changes to This Policy\n\nWe may update this Privacy Policy periodically. We will:\n- Update the "Last Updated" date at the top\n- Notify users of material changes through the Platform\n- Maintain previous versions for reference\n\nContinued use of the Platform after changes constitutes acceptance of the updated policy.\n\n---\n\n## 11. Contact Us\n\nFor privacy-related questions or concerns:\n\n**Organization-Level Inquiries:** Contact your organization administrator through the Platform\n\n**Platform Support:** Use the in-app support request feature\n\n**Data Protection Inquiries:** Submit a request through the Platform's privacy settings\n\n---\n\n*This Privacy Policy is provided for informational purposes. Your organization may have additional privacy requirements and policies that apply to your use of the Platform.*\n	\N	2026-01-12 04:48:04.874
522b924f-14dd-4b8f-978b-148a1516f8f5	750073d3-29e6-4116-a2be-84f328026e9b	4	Privacy Policy	# Privacy Policy\n\n**Effective Date:** 01-12-2026\n**Last Updated:** 01-12-2026\n\nDASHMET RCA is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Root Cause Analysis and Incident Management platform (the "Platform").\n\n---\n\n## 1. Information We Collect\n\n### 1.1 Account Information\nWhen you register or are provisioned an account, we collect:\n- Full name and email address\n- Employee ID and job title\n- Department and organizational affiliation\n- Role and access permissions\n- Profile preferences (language, theme, timezone)\n\n### 1.2 Incident and Investigation Data\nThrough normal use of the Platform, we process:\n- Incident reports including descriptions, dates, locations, and classifications\n- Root cause analysis data (5 Whys, Fishbone diagrams, investigation findings)\n- Corrective and preventive action (CAPA) records\n- Evidence and attachments (documents, images, reports)\n- Witness statements and interview notes\n- Investigation timelines and audit trails\n\n### 1.3 Workplace Safety Information\nFor workplace safety incidents, we may collect:\n- Injury and illness details\n- Body parts affected and medical treatment information\n- Equipment and environmental conditions\n- PPE usage and safety protocol compliance\n- Near-miss and hazard reports\n\n### 1.4 Automatically Collected Information\nWe automatically collect:\n- Device information (browser type, operating system, screen resolution)\n- Access logs (login times, IP addresses, pages visited)\n- Feature usage analytics and interaction patterns\n- Error logs and performance data\n\n### 1.5 Communication Data\n- In-platform messages and chat communications\n- Support requests and feedback\n- Email notifications and preferences\n\n---\n\n## 2. How We Use Your Information\n\nWe use collected information to:\n\n**Provide Core Services**\n- Authenticate users and manage access permissions\n- Enable incident reporting and root cause analysis workflows\n- Generate investigation reports and compliance documentation\n- Facilitate team collaboration and communication\n- Track corrective actions and preventive controls\n\n**Improve the Platform**\n- Analyze usage patterns to enhance features\n- Identify and fix technical issues\n- Develop new capabilities based on user needs\n- Optimize performance and reliability\n\n**Ensure Safety and Compliance**\n- Maintain audit trails for regulatory compliance\n- Support workplace safety programs and reporting requirements\n- Enable trend analysis for safety improvements\n- Generate required regulatory reports (OSHA, internal audits)\n\n**Communicate With You**\n- Send service notifications and updates\n- Provide customer support\n- Alert you to assigned tasks and deadlines\n- Deliver training and onboarding information\n\n---\n\n## 3. AI-Assisted Features\n\nDASHMET RCA includes AI-powered features to assist with:\n- Automated 5 Whys analysis suggestions\n- Root cause identification and validation\n- Corrective action recommendations\n- Investigation report generation\n\n**Important AI Disclosures:**\n- AI suggestions are provided as assistance only and require human review\n- AI-generated content should be validated by qualified personnel\n- Your data may be processed by AI models to provide suggestions\n- AI features can be disabled by organization administrators\n- We do not use your incident data to train general AI models\n\n---\n\n## 4. Data Sharing and Disclosure\n\n### 4.1 Within Your Organization\n- Data is shared with authorized users within your organization based on role permissions\n- Organization administrators can access usage reports and audit logs\n- Supervisors can view incidents and investigations they are assigned to\n\n### 4.2 Service Providers\nWe engage trusted third parties to help operate the Platform:\n- Cloud hosting and infrastructure (data storage and processing)\n- Authentication services (Firebase Authentication)\n- Email delivery services (notifications and alerts)\n- Analytics providers (usage insights)\n\nAll service providers are contractually bound to protect your data and use it only for specified purposes.\n\n### 4.3 Legal Requirements\nWe may disclose information:\n- To comply with applicable laws, regulations, or legal processes\n- To respond to lawful requests from public authorities\n- To protect our rights, privacy, safety, or property\n- To enforce our terms and agreements\n\n### 4.4 Business Transfers\nIn the event of a merger, acquisition, or sale of assets, user data may be transferred to the acquiring entity with continued protection under this policy.\n\n**We do not sell your personal information.**\n\n---\n\n## 5. Data Retention\n\nWe retain your information according to the following guidelines:\n\n| Data Type | Retention Period |\n|-----------|------------------|\n| Account information | Duration of account plus 30 days after deletion |\n| Incident records | As configured by organization (typically 7 years for compliance) |\n| Investigation data | As configured by organization (typically 7 years for compliance) |\n| Audit logs | 7 years minimum for regulatory compliance |\n| Communication data | 2 years or as required by organization |\n| Analytics data | 2 years in aggregate form |\n\nOrganizations may configure longer retention periods based on regulatory requirements. Data can be exported before deletion upon request.\n\n---\n\n## 6. Data Security\n\nWe implement comprehensive security measures:\n\n**Technical Safeguards**\n- TLS encryption for all data in transit\n- Encryption at rest for sensitive data\n- Secure token-based authentication (JWT)\n- Regular security assessments and penetration testing\n\n**Access Controls**\n- Role-based access control (RBAC)\n- Multi-tenant data isolation\n- Session management and automatic timeouts\n- Audit logging of all data access\n\n**Operational Security**\n- Employee security training\n- Incident response procedures\n- Regular backup and disaster recovery testing\n- Vulnerability management program\n\n---\n\n## 7. Your Rights and Choices\n\nDepending on your location, you may have rights to:\n\n**Access** – Request a copy of your personal data\n**Correction** – Update inaccurate or incomplete information\n**Deletion** – Request deletion of your data (subject to retention requirements)\n**Portability** – Receive your data in a structured format\n**Restriction** – Limit how we process your data\n**Objection** – Object to certain processing activities\n\n**To exercise your rights:**\n1. Contact your organization administrator for data managed by your organization\n2. Submit a request through the Platform's support feature\n3. Email our privacy team (contact information available in the Platform)\n\nNote: Some requests may be subject to legal retention requirements or legitimate business needs.\n\n---\n\n## 8. International Data Transfers\n\nIf your data is transferred to countries outside your jurisdiction, we ensure appropriate safeguards are in place, including:\n- Standard Contractual Clauses approved by relevant authorities\n- Data processing agreements with recipients\n- Compliance with applicable transfer regulations\n\n---\n\n## 9. Children's Privacy\n\nDASHMET RCA is designed for business use and is not intended for individuals under 18 years of age. We do not knowingly collect information from children.\n\n---\n\n## 10. Changes to This Policy\n\nWe may update this Privacy Policy periodically. We will:\n- Update the "Last Updated" date at the top\n- Notify users of material changes through the Platform\n- Maintain previous versions for reference\n\nContinued use of the Platform after changes constitutes acceptance of the updated policy.\n\n---\n\n## 11. Contact Us\n\nFor privacy-related questions or concerns:\n\n**Organization-Level Inquiries:** Contact your organization administrator through the Platform\n\n**Platform Support:** Use the in-app support request feature\n\n**Data Protection Inquiries:** Submit a request through the Platform's privacy settings\n\n---\n\n*This Privacy Policy is provided for informational purposes. Your organization may have additional privacy requirements and policies that apply to your use of the Platform.*\n	\N	2026-01-12 04:48:05.867
4d5422b4-c8e6-4a15-95a2-e854c0201574	8cbf6c88-c9eb-4a7e-90fd-947f914ca28d	2	Terms of Service	# Terms of Service\n\n**Effective Date:** 2026-01-12\n**Last Updated:** 2026-01-12\n\nThese Terms of Service ("Terms") constitute a legally binding agreement between you and DASHMET RCA ("DASHMET," "we," "us," or "our") governing your access to and use of the DASHMET RCA platform and related services (collectively, the "Platform").\n\n**By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree, do not use the Platform.**\n\n---\n\n## 1. Definitions\n\n**"Customer"** means the organization that has contracted with DASHMET for access to the Platform.\n\n**"User"** means any individual authorized by a Customer to access the Platform.\n\n**"Content"** means any data, text, files, images, reports, or other materials submitted to or generated through the Platform.\n\n**"Services"** means the root cause analysis, incident management, and related features provided through the Platform.\n\n---\n\n## 2. Account Registration and Access\n\n### 2.1 Authorization\n- Access to the Platform requires authorization from a Customer organization\n- You must be designated by your organization's administrator to receive access\n- You must provide accurate information when creating your account\n\n### 2.2 Account Security\nYou are responsible for:\n- Maintaining the confidentiality of your login credentials\n- All activities that occur under your account\n- Immediately notifying your administrator of any unauthorized access\n- Using strong passwords and following security best practices\n\n### 2.3 Access Codes\n- Some features may require organization-specific access codes\n- Access codes must be kept confidential within your organization\n- Sharing access codes outside your organization is prohibited\n\n---\n\n## 3. Acceptable Use\n\n### 3.1 Permitted Uses\nYou may use the Platform to:\n- Report and investigate incidents within your organization\n- Conduct root cause analysis using provided methodologies\n- Collaborate with authorized team members\n- Generate reports and track corrective actions\n- Access training and reference materials\n\n### 3.2 Prohibited Activities\nYou agree NOT to:\n- Access the Platform without proper authorization\n- Share login credentials or access codes with unauthorized persons\n- Attempt to access data belonging to other organizations\n- Upload malicious software, viruses, or harmful code\n- Reverse engineer, decompile, or disassemble the Platform\n- Use the Platform for any unlawful purpose\n- Interfere with or disrupt Platform operations\n- Circumvent security measures or access controls\n- Scrape, harvest, or collect data through automated means\n- Use AI features to generate misleading or fabricated investigation data\n- Submit false incident reports or investigation findings\n- Impersonate other users or misrepresent your identity\n\n### 3.3 Content Standards\nAll Content you submit must:\n- Be accurate and truthful to the best of your knowledge\n- Comply with applicable laws and regulations\n- Not infringe on intellectual property rights of others\n- Not contain discriminatory, harassing, or offensive material\n- Be appropriate for a professional business environment\n\n---\n\n## 4. Intellectual Property\n\n### 4.1 Platform Ownership\nDASHMET and its licensors retain all right, title, and interest in:\n- The Platform and all related software\n- Our trademarks, logos, and branding\n- Platform documentation and training materials\n- AI models and analytical methodologies\n\n### 4.2 Customer Data\n- Customers retain ownership of their organizational data\n- You retain ownership of Content you create (subject to your organization's policies)\n- By using the Platform, you grant us a license to process your Content solely to provide the Services\n\n### 4.3 Feedback\nIf you provide suggestions or feedback about the Platform, we may use such feedback without obligation to you.\n\n---\n\n## 5. AI-Assisted Features\n\n### 5.1 Nature of AI Assistance\n- AI features provide suggestions and recommendations only\n- AI-generated content requires human review and validation\n- AI suggestions should not replace professional judgment\n\n### 5.2 User Responsibility\nYou acknowledge that:\n- You are responsible for reviewing and validating AI suggestions\n- AI outputs may contain errors or inaccuracies\n- Final decisions in investigations remain with qualified personnel\n- AI-assisted analysis does not constitute professional advice\n\n### 5.3 AI Limitations\nWe do not guarantee that AI features will:\n- Identify all relevant root causes\n- Provide complete or accurate suggestions\n- Be available at all times\n- Meet specific regulatory requirements\n\n---\n\n## 6. Data Protection and Privacy\n\n### 6.1 Data Processing\n- We process data in accordance with our Privacy Policy\n- Customer data is logically separated by organization\n- We implement security measures to protect data\n\n### 6.2 Data Ownership\n- Customer organizations own and control their data\n- Users should follow their organization's data handling policies\n- Data export capabilities are available to authorized administrators\n\n### 6.3 Compliance\n- Customers are responsible for ensuring their use complies with applicable laws\n- We provide features to support compliance but do not guarantee regulatory compliance\n- Industry-specific requirements (OSHA, etc.) are the Customer's responsibility\n\n---\n\n## 7. Service Levels and Availability\n\n### 7.1 Availability\n- We strive to maintain high Platform availability\n- Scheduled maintenance will be communicated in advance when possible\n- We do not guarantee uninterrupted or error-free service\n\n### 7.2 Modifications\nWe may:\n- Update, modify, or discontinue features with reasonable notice\n- Release new versions and require updates\n- Change these Terms with notice to Users\n\n### 7.3 Support\n- Support is available through the Platform's built-in support request feature\n- Response times may vary based on Customer agreement\n- Users should contact their organization administrator for first-level support\n\n---\n\n## 8. Disclaimers\n\n### 8.1 "As Is" Basis\nTHE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.\n\n### 8.2 No Professional Advice\nThe Platform provides tools for investigation and analysis but does not constitute:\n- Legal advice\n- Medical advice\n- Professional safety consulting\n- Regulatory compliance certification\n\n### 8.3 Third-Party Services\nWe are not responsible for third-party services integrated with the Platform.\n\n---\n\n## 9. Limitation of Liability\n\n### 9.1 Exclusion of Damages\nTO THE MAXIMUM EXTENT PERMITTED BY LAW, DASHMET SHALL NOT BE LIABLE FOR ANY:\n- Indirect, incidental, special, consequential, or punitive damages\n- Loss of profits, revenue, data, or business opportunities\n- Damages arising from reliance on AI-generated content\n- Damages resulting from unauthorized access to your account\n\n### 9.2 Liability Cap\nOUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNTS PAID BY CUSTOMER FOR THE SERVICES IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.\n\n### 9.3 Exceptions\nThese limitations do not apply to liability that cannot be excluded by law.\n\n---\n\n## 10. Indemnification\n\nYou agree to indemnify and hold harmless DASHMET from claims arising from:\n- Your violation of these Terms\n- Your violation of any law or regulation\n- Content you submit that infringes third-party rights\n- Your use of AI features contrary to these Terms\n\n---\n\n## 11. Termination\n\n### 11.1 By You\nYou may stop using the Platform at any time. Contact your administrator to deactivate your account.\n\n### 11.2 By Us\nWe may suspend or terminate access if:\n- You violate these Terms\n- Your organization's agreement with us ends\n- Required by law\n- Necessary to protect the Platform or other users\n\n### 11.3 Effect of Termination\nUpon termination:\n- Your access rights cease immediately\n- You must stop using the Platform\n- Data may be retained per our retention policies and Customer agreements\n\n---\n\n## 12. Dispute Resolution\n\n### 12.1 Governing Law\nThese Terms are governed by the laws of the jurisdiction specified in your organization's agreement with us.\n\n### 12.2 Informal Resolution\nBefore initiating formal proceedings, parties agree to attempt informal resolution.\n\n### 12.3 Arbitration\nDisputes may be subject to binding arbitration as specified in Customer agreements.\n\n---\n\n## 13. General Provisions\n\n### 13.1 Entire Agreement\nThese Terms, together with our Privacy Policy and any Customer agreement, constitute the entire agreement.\n\n### 13.2 Severability\nIf any provision is found unenforceable, the remaining provisions remain in effect.\n\n### 13.3 No Waiver\nFailure to enforce any provision does not constitute a waiver.\n\n### 13.4 Assignment\nYou may not assign your rights under these Terms without our consent.\n\n---\n\n## 14. Changes to Terms\n\nWe may modify these Terms by:\n- Posting updated Terms on the Platform\n- Notifying Users of material changes\n- Updating the "Last Updated" date\n\nContinued use after changes become effective constitutes acceptance.\n\n---\n\n## 15. Contact Information\n\n**For questions about these Terms:**\n- Contact your organization administrator\n- Use the in-app support request feature\n- Review the help documentation within the Platform\n\n---\n\n*These Terms of Service supplement any agreement between DASHMET and your organization. In case of conflict, the Customer agreement takes precedence.*\n	\N	2026-01-12 04:48:39.034
6d97342b-1d3e-42a9-b6b6-e13f07db497e	6775f6df-b9f4-42ca-b5fc-3d5c068e6190	2	Cookie & Local Storage Policy	# Cookie & Local Storage Policy\n\n**Effective Date:** 2026-01-12\n**Last Updated:** 2026-01-12\n\nThis policy explains how DASHMET RCA ("DASHMET," "we," "us," or "our") uses cookies, local storage, and similar technologies when you access our Platform.\n\n---\n\n## 1. Technologies We Use\n\n### 1.1 Local Storage\nLocal storage is a web technology that allows websites to store data in your browser. Unlike cookies, local storage data is not automatically sent to servers with each request.\n\n**We primarily use local storage instead of traditional cookies.**\n\n### 1.2 Session Storage\nSession storage is similar to local storage but is cleared when you close your browser tab.\n\n### 1.3 Cookies\nCookies are small text files stored on your device. We use minimal cookies, primarily for:\n- Third-party service integrations\n- Analytics (if enabled by your organization)\n\n---\n\n## 2. What We Store and Why\n\n### 2.1 Authentication Data\n| Data | Purpose | Storage Type | Duration |\n|------|---------|--------------|----------|\n| Authentication tokens | Keep you securely signed in | Local Storage | Until logout or token expiration |\n| Session information | Maintain your active session | Session Storage | Browser session |\n\n### 2.2 User Preferences\n| Data | Purpose | Storage Type | Duration |\n|------|---------|--------------|----------|\n| Theme preference | Remember dark/light mode | Local Storage | Persistent |\n| Language setting | Display content in your language | Local Storage | Persistent |\n| UI state | Remember collapsed menus, view preferences | Local Storage | Persistent |\n\n### 2.3 Application State\n| Data | Purpose | Storage Type | Duration |\n|------|---------|--------------|----------|\n| Draft content | Preserve unsaved work | Local Storage | Until saved or cleared |\n| Navigation state | Remember your place in workflows | Session Storage | Browser session |\n| Notification counts | Track unread messages | Local Storage | Until read |\n\n### 2.4 Analytics (If Enabled)\n| Data | Purpose | Storage Type | Duration |\n|------|---------|--------------|----------|\n| Usage metrics | Improve Platform performance | Local Storage | 30 days |\n| Error tracking | Identify and fix issues | Session Storage | Browser session |\n\n---\n\n## 3. Third-Party Technologies\n\n### 3.1 Firebase Authentication\nWe use Firebase Authentication for secure sign-in. Firebase may use:\n- Authentication tokens stored in local storage\n- Cookies for session management\n\n**Firebase Privacy Policy:** https://firebase.google.com/support/privacy\n\n### 3.2 Analytics Services\nIf enabled by your organization, analytics services may set cookies to:\n- Track page views and feature usage\n- Measure performance\n- Identify technical issues\n\n---\n\n## 4. Categories of Storage\n\n### 4.1 Strictly Necessary\nRequired for the Platform to function:\n- Authentication tokens\n- Security-related data\n- Session management\n\n**These cannot be disabled** as the Platform requires them to operate.\n\n### 4.2 Functional\nEnhance your experience:\n- Theme preferences\n- Language settings\n- UI customizations\n\nYou can clear these, but your preferences will reset.\n\n### 4.3 Performance\nHelp us improve the Platform:\n- Feature usage data\n- Error logs\n- Performance metrics\n\nMay be controlled through organization settings.\n\n---\n\n## 5. Data We Do NOT Store Locally\n\nWe do **NOT** store the following in your browser:\n- Incident report content\n- Investigation data\n- Personal information of other users\n- Sensitive business data\n- Passwords or raw credentials\n\nThis data is stored securely on our servers, not in your browser.\n\n---\n\n## 6. Managing Your Data\n\n### 6.1 Viewing Stored Data\nMost browsers allow you to view local storage:\n1. Open browser developer tools (F12 or right-click > Inspect)\n2. Navigate to "Application" or "Storage" tab\n3. View Local Storage and Session Storage\n\n### 6.2 Clearing Data\n**Through Your Browser:**\n- Clear browsing data/cache in browser settings\n- Clear specific site data for DASHMET RCA\n\n**Through the Platform:**\n- Log out to clear authentication data\n- Use "Clear Preferences" if available in settings\n\n### 6.3 Browser Settings\nYou can configure your browser to:\n- Block all cookies and local storage (may prevent Platform from working)\n- Clear data when closing the browser\n- Block third-party cookies only\n\n**Warning:** Blocking essential storage will prevent you from using the Platform.\n\n---\n\n## 7. Impact of Blocking Storage\n\n| If You Block... | Impact |\n|-----------------|--------|\n| All local storage | Cannot use the Platform |\n| All cookies | Some features may not work |\n| Third-party cookies | Analytics may not function |\n| Session storage | Must re-authenticate frequently |\n\n---\n\n## 8. Security of Stored Data\n\nWe protect locally stored data by:\n- Using secure (HTTPS) connections only\n- Implementing token expiration\n- Not storing sensitive data locally\n- Using industry-standard encryption for tokens\n\n**Your responsibilities:**\n- Use a secure, updated browser\n- Don't use shared or public computers for sensitive work\n- Log out when finished, especially on shared devices\n- Keep your device secure\n\n---\n\n## 9. Children's Privacy\n\nThe Platform is not designed for users under 18. We do not knowingly collect data from children through cookies or local storage.\n\n---\n\n## 10. Organization Controls\n\nYour organization's administrator may:\n- Enable or disable certain analytics\n- Configure data retention preferences\n- Set security policies affecting storage\n\nContact your administrator for organization-specific policies.\n\n---\n\n## 11. Changes to This Policy\n\nWe may update this policy to reflect:\n- Changes in technologies we use\n- New features or services\n- Regulatory requirements\n\nUpdates will be posted with a new "Last Updated" date.\n\n---\n\n## 12. Contact Us\n\n**Questions about this policy:**\n- Contact your organization administrator\n- Use the in-app support request feature\n\n---\n\n## 13. Technical Reference\n\nFor developers and security teams:\n\n**Local Storage Keys Used:**\n- `firebaseToken` - Authentication token\n- `userLanguage` - Language preference\n- `theme` - UI theme preference\n- `chatUnreadCounts` - Notification state\n\n**Session Storage Keys:**\n- Temporary application state\n- Form draft data\n\n---\n\n*This policy is specific to the DASHMET RCA platform. Your organization may have additional policies governing browser storage and cookies.*\n	\N	2026-01-12 04:48:54.741
527acbdb-e8bb-457f-ba43-65c6cd69bff3	43ea9bf6-5129-4d6c-bc20-e65efad1df9c	2	Security	# Security Overview\n\n**Effective Date:** 2026-01-12\n**Last Updated:** 2026-01-12\n\nAt DASHMET RCA, security is foundational to everything we do. This document outlines our security practices, your responsibilities, and how we work together to protect sensitive incident and investigation data.\n\n---\n\n## 1. Our Security Commitment\n\nDASHMET RCA is designed to handle sensitive workplace incident data, including:\n- Safety and injury information\n- Root cause investigations\n- Corrective action tracking\n- Compliance documentation\n\nWe implement comprehensive security measures appropriate for this sensitive data.\n\n---\n\n## 2. Authentication & Access Control\n\n### 2.1 Authentication\n- **Token-based authentication** using industry-standard JWT (JSON Web Tokens)\n- **Firebase Authentication** for secure identity management\n- **Automatic token refresh** with configurable session timeouts\n- **Secure password requirements** enforced at account creation\n\n### 2.2 Role-Based Access Control (RBAC)\nWe implement granular access controls:\n\n| Role | Access Level |\n|------|--------------|\n| **System Administrator** | Platform-wide configuration and management |\n| **Organization Admin** | Full access within organization |\n| **CI Manager** | Investigation management and oversight |\n| **Safety/Security Manager** | Safety programs and compliance |\n| **Supervisor** | Team-level incident management |\n| **Employee** | Report incidents, view assigned items |\n\n### 2.3 Access Code Protection\n- Organization-specific access codes for registration\n- Codes can be regenerated by administrators\n- Access codes are separate from user credentials\n\n### 2.4 Session Management\n- Automatic session timeout after inactivity\n- Secure logout clears authentication tokens\n- Concurrent session management available\n\n---\n\n## 3. Data Protection\n\n### 3.1 Encryption\n**In Transit:**\n- All communications encrypted with TLS 1.2 or higher\n- HTTPS enforced for all connections\n- Secure WebSocket connections for real-time features\n\n**At Rest:**\n- Database encryption for sensitive fields\n- Encrypted file storage for attachments\n- Secure key management practices\n\n### 3.2 Multi-Tenant Isolation\n- Strict logical separation between organizations\n- Database-level tenant isolation\n- API-level access validation\n- No cross-organization data access\n\n### 3.3 Data Minimization\n- Collect only necessary information\n- Configurable data retention policies\n- Secure data deletion procedures\n\n---\n\n## 4. Infrastructure Security\n\n### 4.1 Cloud Security\n- Hosted on enterprise-grade cloud infrastructure\n- Regular security patching and updates\n- Network segmentation and firewalls\n- DDoS protection\n\n### 4.2 Monitoring & Detection\n- Real-time security monitoring\n- Intrusion detection systems\n- Automated alerting for anomalies\n- 24/7 infrastructure monitoring\n\n### 4.3 Backup & Recovery\n- Regular automated backups\n- Geographically distributed backup storage\n- Tested disaster recovery procedures\n- Point-in-time recovery capability\n\n---\n\n## 5. Application Security\n\n### 5.1 Secure Development\n- Security-focused development practices\n- Code review requirements\n- Dependency vulnerability scanning\n- Regular security assessments\n\n### 5.2 Input Validation\n- Server-side validation of all inputs\n- Protection against injection attacks (SQL, XSS, etc.)\n- File upload scanning and restrictions\n- Rate limiting on API endpoints\n\n### 5.3 Audit Logging\nComprehensive audit trails including:\n- User authentication events\n- Data access and modifications\n- Administrative actions\n- Security-relevant events\n\nAudit logs are:\n- Tamper-resistant\n- Retained per compliance requirements\n- Available for security investigations\n\n---\n\n## 6. AI Security\n\n### 6.1 AI Data Handling\n- AI processes data within secure boundaries\n- No training on customer-specific data\n- AI suggestions are clearly labeled\n- Human review required for AI outputs\n\n### 6.2 AI Access Controls\n- AI features respect user permissions\n- Organization can disable AI features\n- AI outputs subject to same access controls as user data\n\n---\n\n## 7. Compliance & Certifications\n\n### 7.1 Supported Compliance Frameworks\nThe Platform includes features to support:\n- **OSHA** workplace safety reporting requirements\n- **ISO 45001** occupational health and safety management\n- **Internal audit** requirements for incident management\n- **Industry-specific** compliance needs\n\n### 7.2 Data Privacy Compliance\nWe support compliance with:\n- General Data Protection Regulation (GDPR)\n- California Consumer Privacy Act (CCPA)\n- Other applicable privacy regulations\n\n*Note: Compliance is a shared responsibility. Organizations must configure and use the Platform appropriately for their specific requirements.*\n\n---\n\n## 8. Incident Response\n\n### 8.1 Our Process\n1. **Detection** - Automated monitoring and alerting\n2. **Assessment** - Rapid triage and impact analysis\n3. **Containment** - Immediate protective measures\n4. **Remediation** - Root cause fix and recovery\n5. **Communication** - Timely notification to affected parties\n6. **Review** - Post-incident analysis and improvements\n\n### 8.2 Security Incident Notification\n- Affected organizations notified promptly\n- Clear communication about scope and impact\n- Guidance on protective measures\n- Follow-up on remediation status\n\n---\n\n## 9. Your Security Responsibilities\n\n### 9.1 Account Security\n✅ **DO:**\n- Use strong, unique passwords\n- Keep credentials confidential\n- Log out on shared devices\n- Report suspicious activity immediately\n- Enable additional security features when available\n\n❌ **DON'T:**\n- Share your login credentials\n- Use the same password across services\n- Leave sessions unattended\n- Ignore security notifications\n- Access from unsecured networks\n\n### 9.2 Data Handling\n✅ **DO:**\n- Follow your organization's data policies\n- Report only accurate information\n- Use appropriate classification for sensitive data\n- Verify recipients before sharing reports\n\n❌ **DON'T:**\n- Export data to unsecured locations\n- Share investigation details inappropriately\n- Upload unauthorized files\n- Bypass data access controls\n\n### 9.3 Device Security\n✅ **DO:**\n- Keep browsers and devices updated\n- Use antivirus/anti-malware software\n- Lock devices when unattended\n- Use secure networks\n\n❌ **DON'T:**\n- Access from compromised devices\n- Use outdated browsers\n- Ignore security updates\n- Connect via unsecured public WiFi\n\n---\n\n## 10. Administrator Security Guide\n\n### 10.1 User Management\n- Regularly review user access and permissions\n- Promptly remove access for departed employees\n- Use principle of least privilege\n- Document access decisions\n\n### 10.2 Organization Settings\n- Configure appropriate session timeouts\n- Review and rotate access codes periodically\n- Enable audit logging\n- Configure data retention appropriately\n\n### 10.3 Monitoring\n- Review audit logs regularly\n- Investigate unusual activity\n- Track failed authentication attempts\n- Monitor for data exfiltration indicators\n\n---\n\n## 11. Reporting Security Issues\n\n### 11.1 How to Report\nIf you discover a potential security vulnerability:\n\n1. **Do not** exploit the vulnerability or access data beyond what's necessary to demonstrate the issue\n2. **Report immediately** through one of these channels:\n   - In-app support request (mark as security-related)\n   - Contact your organization administrator\n   - Email details securely (contact information available in Platform)\n\n### 11.2 What to Include\n- Description of the vulnerability\n- Steps to reproduce\n- Potential impact assessment\n- Your contact information\n\n### 11.3 Response Expectations\n- Acknowledgment within 24 hours\n- Assessment and prioritization\n- Regular updates on remediation progress\n- Recognition for responsible disclosure (if desired)\n\n---\n\n## 12. Security Updates & Communication\n\n### 12.1 How We Communicate\n- Security announcements in the Platform\n- Email notifications for critical issues\n- Documentation updates\n- Release notes for security improvements\n\n### 12.2 Staying Informed\n- Enable notifications for security updates\n- Review release notes regularly\n- Follow administrator guidance\n- Participate in security training\n\n---\n\n## 13. Third-Party Security\n\n### 13.1 Vendor Management\nWe carefully evaluate and monitor third-party services:\n- Security assessments before engagement\n- Contractual security requirements\n- Regular review of vendor security posture\n- Data processing agreements\n\n### 13.2 Key Third Parties\n- **Cloud Infrastructure** - Enterprise-grade hosting with security certifications\n- **Firebase** - Google's secure authentication platform\n- **AI Services** - Processed with appropriate data protections\n\n---\n\n## 14. Business Continuity\n\n### 14.1 Availability\n- High-availability architecture\n- Geographic redundancy\n- Automated failover capabilities\n- Regular disaster recovery testing\n\n### 14.2 Recovery Objectives\n- Recovery Time Objective (RTO): Minimize downtime\n- Recovery Point Objective (RPO): Minimal data loss\n- Regular backup verification\n- Documented recovery procedures\n\n---\n\n## 15. Continuous Improvement\n\nWe continuously improve security through:\n- Regular security assessments\n- Penetration testing\n- Bug bounty considerations\n- Industry best practice adoption\n- Security training and awareness\n- Incident learnings integration\n\n---\n\n## 16. Questions & Support\n\n**Security Questions:**\n- Contact your organization administrator\n- Use the in-app support request feature\n- Review this documentation and help resources\n\n**Emergency Security Issues:**\n- Report immediately through available channels\n- Contact your organization's IT security team\n- Do not delay reporting critical issues\n\n---\n\n*Security is a shared responsibility. Together, we can protect the sensitive incident and investigation data that organizations trust us to handle.*\n\n---\n\n**Document Version:** 1.0\n**Classification:** Public\n**Review Cycle:** Annual or as needed\n	\N	2026-01-12 04:49:36.244
799fcee5-8c4c-4f6f-af2c-5689d603708d	750073d3-29e6-4116-a2be-84f328026e9b	1	Privacy Policy	# Privacy Policy\n\n**Effective Date:** 2026-01-11\n\nThis Privacy Policy explains how DASHMET RCA ("we", "us", or "our") collects, uses, discloses, and protects information when you access or use our web application and related services (the "Services").\n\n## 1. Information We Collect\n\n### 1.1 Information You Provide\n- Account information (e.g., name, email address, role/organization details).\n- Content you submit through the Services (e.g., incident reports, attachments, messages, comments).\n\n### 1.2 Information Collected Automatically\n- Usage data (e.g., pages viewed, actions taken, timestamps).\n- Device and log information (e.g., IP address, browser type, operating system, approximate location derived from IP).\n\n### 1.3 Cookies and Similar Technologies\nWe use cookies and similar technologies to operate the Services, remember preferences, and understand usage. See our Cookie Policy for details.\n\n## 2. How We Use Information\nWe use information to:\n- Provide, operate, maintain, and improve the Services.\n- Authenticate users, enforce access controls, and prevent fraud or abuse.\n- Communicate with you about service updates, security notices, and support.\n- Comply with legal obligations and protect our rights.\n\n## 3. How We Share Information\nWe may share information:\n- With your organization and authorized users as part of normal Service operation.\n- With service providers who process data on our behalf (e.g., hosting, analytics, email delivery) under appropriate safeguards.\n- For legal, security, or compliance reasons (e.g., to respond to lawful requests).\n\nWe do not sell personal information.\n\n## 4. Data Retention\nWe retain information for as long as necessary to provide the Services, meet contractual commitments, comply with legal requirements, and resolve disputes. Retention periods may vary by data type and organization configuration.\n\n## 5. Security\nWe implement administrative, technical, and physical safeguards designed to protect information. No method of transmission or storage is completely secure; therefore, we cannot guarantee absolute security.\n\n## 6. Your Choices and Rights\nDepending on your location and applicable law, you may have rights to access, correct, delete, or restrict processing of certain information. Requests can be made through your organization administrator or by contacting us.\n\n## 7. International Transfers\nIf information is transferred across borders, we take steps designed to ensure appropriate protections are in place consistent with applicable law.\n\n## 8. Changes to This Policy\nWe may update this policy from time to time. We will update the Effective Date and, where appropriate, provide additional notice.\n\n## 9. Contact Us\nIf you have questions about this Privacy Policy, contact your organization administrator or reach out to support through the application.\n	\N	2026-01-11 22:41:57.942
f8d56ddb-28f3-419e-bde8-66ec53b4404e	8cbf6c88-c9eb-4a7e-90fd-947f914ca28d	1	Terms of Service	# Terms of Service\n\n**Effective Date:** 2026-01-11\n\nThese Terms of Service ("Terms") govern your access to and use of DASHMET RCA (the "Services"). By accessing or using the Services, you agree to these Terms.\n\n## 1. Eligibility and Accounts\n- You must be authorized by your organization to use the Services.\n- You are responsible for maintaining the confidentiality of your credentials and for all activity under your account.\n\n## 2. Use of the Services\nYou agree to:\n- Use the Services only for lawful business purposes and in accordance with your organization’s policies.\n- Provide accurate information and keep it up to date.\n\nYou agree not to:\n- Attempt to gain unauthorized access to any system or data.\n- Upload malware or disrupt the Services.\n- Reverse engineer or interfere with the Services except to the extent permitted by law.\n\n## 3. Customer Data and Content\nContent submitted to the Services (including incident reports and attachments) is generally controlled by the organization that provides you access (the "Customer"). Your use of the Services is subject to the Customer’s directions and permissions.\n\n## 4. Intellectual Property\nWe and our licensors retain all right, title, and interest in and to the Services, including all related intellectual property rights. These Terms do not grant you any rights to our trademarks or branding.\n\n## 5. Availability and Changes\nWe may modify, suspend, or discontinue parts of the Services. We do not guarantee that the Services will be available at all times.\n\n## 6. Third-Party Services\nThe Services may integrate with third-party services. We are not responsible for third-party services and your use of them may be governed by their terms.\n\n## 7. Disclaimers\nTHE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE". TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED.\n\n## 8. Limitation of Liability\nTO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES.\n\n## 9. Termination\nAccess may be suspended or terminated if you violate these Terms or if your organization’s access ends.\n\n## 10. Changes to These Terms\nWe may update these Terms from time to time. Continued use after changes become effective constitutes acceptance of the updated Terms.\n\n## 11. Contact\nQuestions about these Terms should be directed to your organization administrator or support through the application.\n	\N	2026-01-11 22:41:57.951
d912a8be-120d-4d11-a253-fe978677597c	43ea9bf6-5129-4d6c-bc20-e65efad1df9c	1	Security	# Security\n\n**Effective Date:** 2026-01-11\n\nWe take security seriously and maintain safeguards designed to protect the confidentiality, integrity, and availability of the Services.\n\n## 1. Access Controls\n- Role-based access controls restrict access to authorized users.\n- Administrative controls are available to Customer administrators.\n\n## 2. Authentication\nWe support secure authentication mechanisms, including token-based authentication where applicable. Users are responsible for using strong passwords and protecting their credentials.\n\n## 3. Data Protection\nWe use protections designed to secure data in transit and at rest where appropriate. Security controls may include encryption, network protections, monitoring, and auditing.\n\n## 4. Incident Response\nWe maintain procedures designed to detect, respond to, and recover from security incidents. If a security issue is confirmed, we take steps designed to mitigate impact.\n\n## 5. Your Responsibilities\nYou and your organization are responsible for:\n- Managing user access appropriately.\n- Keeping devices and browsers up to date.\n- Reporting suspected security issues promptly.\n\n## 6. Reporting Security Issues\nIf you believe you have found a security vulnerability, please contact support through the application with details and reproduction steps.\n	\N	2026-01-11 22:41:57.959
\.


--
-- Data for Name: RCAAnalysis; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."RCAAnalysis" (id, method, status, "incidentId", "aiRecommendedMethod", "aiRecommendationReason", "rootCauseStatement", "fiveWhysData", "fishboneData", "isValidated", "validatedAt", "validatedById", "analystId", "createdAt", "updatedAt") FROM stdin;
d4e4aa7d-5282-463c-8e59-2f518a247d15	FIVE_WHYS	VALIDATED	ecd4a118-100c-4ac8-8182-126d5276eac2	FIVE_WHYS	This appears to be a straightforward workplace injury where an employee bypassed the lockout/tagout procedure to clear a dough jam, resulting in a finger injury. The 5 Whys method will help drill down from the unsafe act to understand why the employee did not follow the SOP, despite safeguards and PPE being in place, and identify any training or procedural gaps.	Lack of a systematic review and update process for the safety training program, resulting in outdated procedures and insufficient employee knowledge on safety protocols.	{"steps": [{"answer": "The employee did not stop the machine before clearing the jam point", "question": "Why did the employee's finger get caught under the moving flat belt?", "stepNumber": 1, "aiGenerated": false, "isSymptomLevel": true}, {"answer": "The employee was not aware of the proper lockout/tagout (LOTO) procedures for clearing jams", "question": "Why did the employee not stop the machine before clearing the jam point?", "stepNumber": 2, "aiGenerated": true, "isSymptomLevel": true}, {"answer": "There was inadequate training and reinforcement of safety protocols for machine operation and maintenance", "question": "Why was the employee not aware of the proper lockout/tagout (LOTO) procedures for clearing jams?", "stepNumber": 3, "aiGenerated": true, "isSymptomLevel": false}, {"answer": "The safety training program is outdated and does not include regular refreshers or assessments", "question": "Why was there inadequate training and reinforcement of safety protocols?", "stepNumber": 4, "aiGenerated": true, "isSymptomLevel": false}, {"answer": "There is no systematic review and update process for the safety training program, leading to gaps in employee knowledge and compliance", "question": "Why is the safety training program outdated and lacking regular refreshers or assessments?", "stepNumber": 5, "aiGenerated": true, "isSymptomLevel": false}], "rootCause": "Lack of a systematic review and update process for the safety training program, resulting in outdated procedures and insufficient employee knowledge on safety protocols.", "actionPlans": {"longTerm": [{"id": "lt-1", "action": "Establish a regular review and update schedule for all safety training programs and protocols", "status": "pending", "priority": "medium"}, {"id": "lt-2", "action": "Invest in a digital training platform to facilitate ongoing safety education and assessments", "status": "pending", "priority": "low"}], "immediate": [{"id": "imm-1", "action": "Conduct a safety stand-down to review LOTO procedures with all employees on the Die Cut Line 1", "status": "pending", "priority": "high"}, {"id": "imm-2", "action": "Implement immediate supervision and oversight on Die Cut Line 1 to ensure compliance with safety procedures", "status": "pending", "priority": "high"}], "shortTerm": [{"id": "st-1", "action": "Update the safety training program to include comprehensive LOTO procedures and conduct mandatory training sessions", "status": "pending", "priority": "medium"}, {"id": "st-2", "action": "Develop and distribute updated safety protocol documentation to all employees", "status": "pending", "priority": "medium"}]}, "preventiveControls": []}	{"problem": "The employee was trying to remove dough stuck between two returning belts when his finger got caught under the moving flat belt.", "categories": [{"id": "1", "name": "Machine", "causes": []}, {"id": "2", "name": "Man (Operator)", "causes": []}, {"id": "3", "name": "Material", "causes": []}, {"id": "4", "name": "Method", "causes": []}, {"id": "5", "name": "Measurement", "causes": []}, {"id": "6", "name": "Mother Nature (Environment)", "causes": []}]}	t	2026-01-12 03:58:04.929	434f6086-a5b2-46b9-ae5c-ca7e83635325	434f6086-a5b2-46b9-ae5c-ca7e83635325	2026-01-12 03:41:56.598	2026-01-12 03:58:04.929
\.


--
-- Data for Name: RCAVersion; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."RCAVersion" (id, "versionNumber", data, "changedBy", "changeReason", "rcaAnalysisId", "createdAt") FROM stdin;
b3f57efd-2561-455d-bad2-c555736a4858	1	{"steps": [{"answer": "The employee did not stop the machine before clearing the jam point", "question": "Why did the employee's finger get caught under the moving flat belt?", "stepNumber": 1, "aiGenerated": false, "isSymptomLevel": true}, {"answer": "The employee was not aware of the proper lockout/tagout (LOTO) procedures for clearing jams", "question": "Why did the employee not stop the machine before clearing the jam point?", "stepNumber": 2, "aiGenerated": true, "isSymptomLevel": true}, {"answer": "There was inadequate training and reinforcement of safety protocols for machine operation and maintenance", "question": "Why was the employee not aware of the proper lockout/tagout (LOTO) procedures for clearing jams?", "stepNumber": 3, "aiGenerated": true, "isSymptomLevel": false}, {"answer": "The safety training program is outdated and does not include regular refreshers or assessments", "question": "Why was there inadequate training and reinforcement of safety protocols?", "stepNumber": 4, "aiGenerated": true, "isSymptomLevel": false}, {"answer": "There is no systematic review and update process for the safety training program, leading to gaps in employee knowledge and compliance", "question": "Why is the safety training program outdated and lacking regular refreshers or assessments?", "stepNumber": 5, "aiGenerated": true, "isSymptomLevel": false}], "rootCause": "Lack of a systematic review and update process for the safety training program, resulting in outdated procedures and insufficient employee knowledge on safety protocols.", "actionPlans": {"longTerm": [{"id": "lt-1", "action": "Establish a regular review and update schedule for all safety training programs and protocols", "status": "pending", "priority": "medium"}, {"id": "lt-2", "action": "Invest in a digital training platform to facilitate ongoing safety education and assessments", "status": "pending", "priority": "low"}], "immediate": [{"id": "imm-1", "action": "Conduct a safety stand-down to review LOTO procedures with all employees on the Die Cut Line 1", "status": "pending", "priority": "high"}, {"id": "imm-2", "action": "Implement immediate supervision and oversight on Die Cut Line 1 to ensure compliance with safety procedures", "status": "pending", "priority": "high"}], "shortTerm": [{"id": "st-1", "action": "Update the safety training program to include comprehensive LOTO procedures and conduct mandatory training sessions", "status": "pending", "priority": "medium"}, {"id": "st-2", "action": "Develop and distribute updated safety protocol documentation to all employees", "status": "pending", "priority": "medium"}]}, "preventiveControls": []}	434f6086-a5b2-46b9-ae5c-ca7e83635325	Updated 5 Whys analysis	d4e4aa7d-5282-463c-8e59-2f518a247d15	2026-01-12 03:57:49.974
31c4ab94-7aee-4f84-988e-3915959e448f	2	{"steps": [{"answer": "The employee did not stop the machine before clearing the jam point", "question": "Why did the employee's finger get caught under the moving flat belt?", "stepNumber": 1, "aiGenerated": false, "isSymptomLevel": true}, {"answer": "The employee was not aware of the proper lockout/tagout (LOTO) procedures for clearing jams", "question": "Why did the employee not stop the machine before clearing the jam point?", "stepNumber": 2, "aiGenerated": true, "isSymptomLevel": true}, {"answer": "There was inadequate training and reinforcement of safety protocols for machine operation and maintenance", "question": "Why was the employee not aware of the proper lockout/tagout (LOTO) procedures for clearing jams?", "stepNumber": 3, "aiGenerated": true, "isSymptomLevel": false}, {"answer": "The safety training program is outdated and does not include regular refreshers or assessments", "question": "Why was there inadequate training and reinforcement of safety protocols?", "stepNumber": 4, "aiGenerated": true, "isSymptomLevel": false}, {"answer": "There is no systematic review and update process for the safety training program, leading to gaps in employee knowledge and compliance", "question": "Why is the safety training program outdated and lacking regular refreshers or assessments?", "stepNumber": 5, "aiGenerated": true, "isSymptomLevel": false}], "rootCause": "Lack of a systematic review and update process for the safety training program, resulting in outdated procedures and insufficient employee knowledge on safety protocols.", "actionPlans": {"longTerm": [{"id": "lt-1", "action": "Establish a regular review and update schedule for all safety training programs and protocols", "status": "pending", "priority": "medium"}, {"id": "lt-2", "action": "Invest in a digital training platform to facilitate ongoing safety education and assessments", "status": "pending", "priority": "low"}], "immediate": [{"id": "imm-1", "action": "Conduct a safety stand-down to review LOTO procedures with all employees on the Die Cut Line 1", "status": "pending", "priority": "high"}, {"id": "imm-2", "action": "Implement immediate supervision and oversight on Die Cut Line 1 to ensure compliance with safety procedures", "status": "pending", "priority": "high"}], "shortTerm": [{"id": "st-1", "action": "Update the safety training program to include comprehensive LOTO procedures and conduct mandatory training sessions", "status": "pending", "priority": "medium"}, {"id": "st-2", "action": "Develop and distribute updated safety protocol documentation to all employees", "status": "pending", "priority": "medium"}]}, "preventiveControls": []}	434f6086-a5b2-46b9-ae5c-ca7e83635325	Updated 5 Whys analysis	d4e4aa7d-5282-463c-8e59-2f518a247d15	2026-01-12 03:58:04.854
\.


--
-- Data for Name: SLAConfiguration; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."SLAConfiguration" (id, "organizationId", severity, "responseTimeHours", "resolutionTimeHours", "escalationEnabled", "escalationAfterHours", "escalationToRole", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Session; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Session" (id, "userId", token, "refreshToken", "expiresAt", "deviceInfo", "ipAddress", "createdAt") FROM stdin;
\.


--
-- Data for Name: Shift; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."Shift" (id, name, "startTime", "endTime", "facilityId", "createdAt", "updatedAt", "lineId") FROM stdin;
baabcb50-7504-424f-b527-2114c9630ec0	First Shift	04:00	12:30	\N	2026-01-12 01:48:44.526	2026-01-12 01:48:44.526	\N
eaa4fdca-c6bb-47da-bea2-da8b0d46994e	First Shift	04:00	12:30	\N	2026-01-12 01:49:14.585	2026-01-12 01:49:14.585	\N
a3e607af-8626-4cca-b271-bdca52bd6c09	Bakery First Shift	04:00	12:30	\N	2026-01-12 01:53:12.548	2026-01-12 01:53:12.548	\N
bd678f6e-2bec-42e5-afba-6222a09c6c8e	First Shift Bakery	04:00	12:30	5aa61300-b20b-4189-9d91-6cf2a1c565b7	2026-01-12 01:56:39.372	2026-01-12 01:56:39.372	\N
5dd86fa9-e8ca-45e1-b371-6b7332c04e43	Second Shift Bakery	13:00	21:30	5aa61300-b20b-4189-9d91-6cf2a1c565b7	2026-01-12 01:57:37.466	2026-01-12 01:57:37.466	\N
\.


--
-- Data for Name: ShiftLine; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."ShiftLine" (id, "shiftId", "lineId", "createdAt") FROM stdin;
624e7398-9915-4b62-a12c-f99adec3646b	baabcb50-7504-424f-b527-2114c9630ec0	3ec0188c-42ce-41dc-b027-cd4ea8524228	2026-01-12 01:48:44.526
e077992a-7bb4-476e-b430-bcf729301770	baabcb50-7504-424f-b527-2114c9630ec0	cd922354-579f-4cbb-b5f0-4d7a2dbbbd37	2026-01-12 01:48:44.526
f4818d0b-0b19-4aae-befc-16704c676360	eaa4fdca-c6bb-47da-bea2-da8b0d46994e	3ec0188c-42ce-41dc-b027-cd4ea8524228	2026-01-12 01:49:14.585
19f9647a-c946-458f-9f2d-0cd4e0ce4655	eaa4fdca-c6bb-47da-bea2-da8b0d46994e	cd922354-579f-4cbb-b5f0-4d7a2dbbbd37	2026-01-12 01:49:14.585
9dea1938-361e-4177-beae-51025e7fb79b	a3e607af-8626-4cca-b271-bdca52bd6c09	3ec0188c-42ce-41dc-b027-cd4ea8524228	2026-01-12 01:53:12.548
83e473ab-e418-4f67-9670-0cf889219ff2	a3e607af-8626-4cca-b271-bdca52bd6c09	cd922354-579f-4cbb-b5f0-4d7a2dbbbd37	2026-01-12 01:53:12.548
ce9097a7-83a6-471f-8814-53977dd4eb5f	bd678f6e-2bec-42e5-afba-6222a09c6c8e	3ec0188c-42ce-41dc-b027-cd4ea8524228	2026-01-12 01:56:39.372
323a48f4-fd5c-4e77-8cbf-3c2386542019	bd678f6e-2bec-42e5-afba-6222a09c6c8e	cd922354-579f-4cbb-b5f0-4d7a2dbbbd37	2026-01-12 01:56:39.372
413a9a51-ed6c-4562-b6c9-7378dd3536f2	5dd86fa9-e8ca-45e1-b371-6b7332c04e43	3ec0188c-42ce-41dc-b027-cd4ea8524228	2026-01-12 01:57:37.466
46f912d5-5127-4afd-a5d0-070323c318f1	5dd86fa9-e8ca-45e1-b371-6b7332c04e43	cd922354-579f-4cbb-b5f0-4d7a2dbbbd37	2026-01-12 01:57:37.466
\.


--
-- Data for Name: SupportRequest; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."SupportRequest" (id, "submittedByUserId", "organizationId", category, description, status, "internalNotes", "createdAt", "updatedAt", "resolvedAt", "resolvedByUserId", subject, "submittedByUserEmail") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: rca_engine_user
--

COPY public."User" (id, email, password, "workEmail", "firstName", "lastName", role, "isActive", "emailVerified", "mfaEnabled", "mfaSecret", theme, language, "defaultSiteId", "defaultLineId", "loginAttempts", "lockedUntil", "lastLoginAt", "lastLoginIp", "passwordResetToken", "passwordResetExpires", "organizationId", "createdAt", "updatedAt", "firebaseUid", "isOnline", "lastSeenAt", "socketId", "profilePicture") FROM stdin;
53bfcdfd-b747-47c6-8660-45504ba349d3	nyahgerald4@gmail.com	\N	\N	Gerald	Nyah	SYSTEM_ADMIN	t	t	f	\N	DARK	ENGLISH	\N	\N	0	\N	2026-01-12 05:22:17.707	\N	\N	\N	e4c36e47-77cc-4032-af75-027c041d81da	2026-01-12 05:21:18.306	2026-01-12 05:22:17.708	CyvsT8qOr5MbLOLdUOMQzATwtSp2	t	2026-01-12 05:22:17.695	esZ7RDC0cvXOkfpgAAAL	\N
434f6086-a5b2-46b9-ae5c-ca7e83635325	gcnyah@gmail.com	\N	\N	Tchouminyi	Nkamtchou	ADMIN	t	t	f	\N	DARK	ENGLISH	\N	\N	0	\N	2026-01-13 00:50:13.805	\N	\N	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-11 23:03:57.378	2026-01-13 00:50:13.806	m0IGJOXLNzT1GZrrujDO95fitjU2	f	2026-01-12 04:49:41.161	\N	https://storage.googleapis.com/dashmet-resolve-1ce6d.firebasestorage.app/profile-pictures/434f6086-a5b2-46b9-ae5c-ca7e83635325/1768184196210.jpg
3bf6dd64-1e2b-4532-ade7-d3fe2dc69407	nyah.gerard@gmail.com	\N	\N	Gerald	Chwoung	SUPERVISOR	t	t	f	\N	DARK	ENGLISH	\N	\N	0	\N	2026-01-13 00:49:39.897	\N	\N	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-12 02:52:24.525	2026-01-13 01:05:54.18	9jyd7jaZhbPRHEVvvcczV1auLlK2	t	2026-01-13 01:05:54.179	86so5sVk42CnLbACAAAZ	https://storage.googleapis.com/dashmet-resolve-1ce6d.firebasestorage.app/profile-pictures/3bf6dd64-1e2b-4532-ade7-d3fe2dc69407/1768186363496.jpg
a20f89f7-7b57-48ad-85b6-a66a22a27473	bakerymetrics@gmail.com	\N	\N	Andreina	Goncalves	SUPERVISOR	t	t	f	\N	DARK	ENGLISH	\N	\N	0	\N	2026-01-13 00:41:35.33	\N	\N	\N	1221d3d5-5bc1-41cd-b816-80fa9de527ef	2026-01-11 23:23:34.279	2026-01-13 00:42:39.282	LYh855r8y7f0Rwmg5p6uN8l2BnA3	f	2026-01-13 00:42:39.281	\N	https://storage.googleapis.com/dashmet-resolve-1ce6d.firebasestorage.app/profile-pictures/a20f89f7-7b57-48ad-85b6-a66a22a27473/1768264894431.jpg
\.


--
-- Name: AccessCode AccessCode_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."AccessCode"
    ADD CONSTRAINT "AccessCode_pkey" PRIMARY KEY (id);


--
-- Name: ArchivedChatMessage ArchivedChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ArchivedChatMessage"
    ADD CONSTRAINT "ArchivedChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: Area Area_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Area"
    ADD CONSTRAINT "Area_pkey" PRIMARY KEY (id);


--
-- Name: AssignmentRule AssignmentRule_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."AssignmentRule"
    ADD CONSTRAINT "AssignmentRule_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: CAPAction CAPAction_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."CAPAction"
    ADD CONSTRAINT "CAPAction_pkey" PRIMARY KEY (id);


--
-- Name: CAPAuditLog CAPAuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."CAPAuditLog"
    ADD CONSTRAINT "CAPAuditLog_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessageReaction ChatMessageReaction_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ChatMessageReaction"
    ADD CONSTRAINT "ChatMessageReaction_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessageTemplate ChatMessageTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ChatMessageTemplate"
    ADD CONSTRAINT "ChatMessageTemplate_pkey" PRIMARY KEY (id);


--
-- Name: ChatMessage ChatMessage_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: Department Department_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_pkey" PRIMARY KEY (id);


--
-- Name: DropdownOption DropdownOption_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."DropdownOption"
    ADD CONSTRAINT "DropdownOption_pkey" PRIMARY KEY (id);


--
-- Name: Evidence Evidence_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_pkey" PRIMARY KEY (id);


--
-- Name: Facility Facility_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Facility"
    ADD CONSTRAINT "Facility_pkey" PRIMARY KEY (id);


--
-- Name: FieldConfiguration FieldConfiguration_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."FieldConfiguration"
    ADD CONSTRAINT "FieldConfiguration_pkey" PRIMARY KEY (id);


--
-- Name: IncidentParticipant IncidentParticipant_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."IncidentParticipant"
    ADD CONSTRAINT "IncidentParticipant_pkey" PRIMARY KEY (id);


--
-- Name: Incident Incident_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Incident"
    ADD CONSTRAINT "Incident_pkey" PRIMARY KEY (id);


--
-- Name: KnowledgeArticle KnowledgeArticle_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."KnowledgeArticle"
    ADD CONSTRAINT "KnowledgeArticle_pkey" PRIMARY KEY (id);


--
-- Name: Line Line_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Line"
    ADD CONSTRAINT "Line_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Organization Organization_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_pkey" PRIMARY KEY (id);


--
-- Name: PolicyDocument PolicyDocument_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."PolicyDocument"
    ADD CONSTRAINT "PolicyDocument_pkey" PRIMARY KEY (id);


--
-- Name: PolicyRevision PolicyRevision_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."PolicyRevision"
    ADD CONSTRAINT "PolicyRevision_pkey" PRIMARY KEY (id);


--
-- Name: RCAAnalysis RCAAnalysis_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."RCAAnalysis"
    ADD CONSTRAINT "RCAAnalysis_pkey" PRIMARY KEY (id);


--
-- Name: RCAVersion RCAVersion_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."RCAVersion"
    ADD CONSTRAINT "RCAVersion_pkey" PRIMARY KEY (id);


--
-- Name: SLAConfiguration SLAConfiguration_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."SLAConfiguration"
    ADD CONSTRAINT "SLAConfiguration_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: ShiftLine ShiftLine_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ShiftLine"
    ADD CONSTRAINT "ShiftLine_pkey" PRIMARY KEY (id);


--
-- Name: Shift Shift_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Shift"
    ADD CONSTRAINT "Shift_pkey" PRIMARY KEY (id);


--
-- Name: SupportRequest SupportRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."SupportRequest"
    ADD CONSTRAINT "SupportRequest_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: AccessCode_code_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "AccessCode_code_idx" ON public."AccessCode" USING btree (code);


--
-- Name: AccessCode_code_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "AccessCode_code_key" ON public."AccessCode" USING btree (code);


--
-- Name: AccessCode_role_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "AccessCode_role_idx" ON public."AccessCode" USING btree (role);


--
-- Name: ArchivedChatMessage_archiveBatchId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ArchivedChatMessage_archiveBatchId_idx" ON public."ArchivedChatMessage" USING btree ("archiveBatchId");


--
-- Name: ArchivedChatMessage_archivedAt_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ArchivedChatMessage_archivedAt_idx" ON public."ArchivedChatMessage" USING btree ("archivedAt");


--
-- Name: ArchivedChatMessage_incidentId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ArchivedChatMessage_incidentId_idx" ON public."ArchivedChatMessage" USING btree ("incidentId");


--
-- Name: ArchivedChatMessage_originalCreatedAt_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ArchivedChatMessage_originalCreatedAt_idx" ON public."ArchivedChatMessage" USING btree ("originalCreatedAt");


--
-- Name: Area_departmentId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Area_departmentId_idx" ON public."Area" USING btree ("departmentId");


--
-- Name: Area_facilityId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Area_facilityId_idx" ON public."Area" USING btree ("facilityId");


--
-- Name: AssignmentRule_incidentType_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "AssignmentRule_incidentType_idx" ON public."AssignmentRule" USING btree ("incidentType");


--
-- Name: AssignmentRule_organizationId_isActive_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "AssignmentRule_organizationId_isActive_idx" ON public."AssignmentRule" USING btree ("organizationId", "isActive");


--
-- Name: AssignmentRule_severity_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "AssignmentRule_severity_idx" ON public."AssignmentRule" USING btree (severity);


--
-- Name: AuditLog_createdAt_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "AuditLog_createdAt_idx" ON public."AuditLog" USING btree ("createdAt");


--
-- Name: AuditLog_entity_entityId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "AuditLog_entity_entityId_idx" ON public."AuditLog" USING btree (entity, "entityId");


--
-- Name: AuditLog_userId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "AuditLog_userId_idx" ON public."AuditLog" USING btree ("userId");


--
-- Name: CAPAction_ownerId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "CAPAction_ownerId_idx" ON public."CAPAction" USING btree ("ownerId");


--
-- Name: CAPAction_rcaAnalysisId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "CAPAction_rcaAnalysisId_idx" ON public."CAPAction" USING btree ("rcaAnalysisId");


--
-- Name: CAPAction_status_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "CAPAction_status_idx" ON public."CAPAction" USING btree (status);


--
-- Name: CAPAuditLog_capActionId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "CAPAuditLog_capActionId_idx" ON public."CAPAuditLog" USING btree ("capActionId");


--
-- Name: CAPAuditLog_performedAt_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "CAPAuditLog_performedAt_idx" ON public."CAPAuditLog" USING btree ("performedAt");


--
-- Name: CAPAuditLog_performedById_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "CAPAuditLog_performedById_idx" ON public."CAPAuditLog" USING btree ("performedById");


--
-- Name: Category_organizationId_type_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Category_organizationId_type_idx" ON public."Category" USING btree ("organizationId", type);


--
-- Name: Category_parentId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Category_parentId_idx" ON public."Category" USING btree ("parentId");


--
-- Name: ChatMessageReaction_messageId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessageReaction_messageId_idx" ON public."ChatMessageReaction" USING btree ("messageId");


--
-- Name: ChatMessageReaction_messageId_userId_emoji_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "ChatMessageReaction_messageId_userId_emoji_key" ON public."ChatMessageReaction" USING btree ("messageId", "userId", emoji);


--
-- Name: ChatMessageReaction_userId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessageReaction_userId_idx" ON public."ChatMessageReaction" USING btree ("userId");


--
-- Name: ChatMessageTemplate_category_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessageTemplate_category_idx" ON public."ChatMessageTemplate" USING btree (category);


--
-- Name: ChatMessageTemplate_isGlobal_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessageTemplate_isGlobal_idx" ON public."ChatMessageTemplate" USING btree ("isGlobal");


--
-- Name: ChatMessageTemplate_userId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessageTemplate_userId_idx" ON public."ChatMessageTemplate" USING btree ("userId");


--
-- Name: ChatMessage_actionItemId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessage_actionItemId_idx" ON public."ChatMessage" USING btree ("actionItemId");


--
-- Name: ChatMessage_createdAt_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessage_createdAt_idx" ON public."ChatMessage" USING btree ("createdAt");


--
-- Name: ChatMessage_evidenceId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessage_evidenceId_idx" ON public."ChatMessage" USING btree ("evidenceId");


--
-- Name: ChatMessage_incidentId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessage_incidentId_idx" ON public."ChatMessage" USING btree ("incidentId");


--
-- Name: ChatMessage_isPinned_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessage_isPinned_idx" ON public."ChatMessage" USING btree ("isPinned");


--
-- Name: ChatMessage_messageType_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessage_messageType_idx" ON public."ChatMessage" USING btree ("messageType");


--
-- Name: ChatMessage_rcaAnalysisId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessage_rcaAnalysisId_idx" ON public."ChatMessage" USING btree ("rcaAnalysisId");


--
-- Name: ChatMessage_userId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ChatMessage_userId_idx" ON public."ChatMessage" USING btree ("userId");


--
-- Name: Comment_incidentId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Comment_incidentId_idx" ON public."Comment" USING btree ("incidentId");


--
-- Name: Comment_rcaAnalysisId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Comment_rcaAnalysisId_idx" ON public."Comment" USING btree ("rcaAnalysisId");


--
-- Name: Comment_userId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Comment_userId_idx" ON public."Comment" USING btree ("userId");


--
-- Name: Department_facilityId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Department_facilityId_idx" ON public."Department" USING btree ("facilityId");


--
-- Name: DropdownOption_optionType_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "DropdownOption_optionType_idx" ON public."DropdownOption" USING btree ("optionType");


--
-- Name: DropdownOption_organizationId_optionType_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "DropdownOption_organizationId_optionType_idx" ON public."DropdownOption" USING btree ("organizationId", "optionType");


--
-- Name: DropdownOption_organizationId_optionType_value_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "DropdownOption_organizationId_optionType_value_key" ON public."DropdownOption" USING btree ("organizationId", "optionType", value);


--
-- Name: Evidence_incidentId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Evidence_incidentId_idx" ON public."Evidence" USING btree ("incidentId");


--
-- Name: Evidence_rcaAnalysisId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Evidence_rcaAnalysisId_idx" ON public."Evidence" USING btree ("rcaAnalysisId");


--
-- Name: Facility_organizationId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Facility_organizationId_idx" ON public."Facility" USING btree ("organizationId");


--
-- Name: FieldConfiguration_incidentType_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "FieldConfiguration_incidentType_idx" ON public."FieldConfiguration" USING btree ("incidentType");


--
-- Name: FieldConfiguration_organizationId_incidentType_fieldName_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "FieldConfiguration_organizationId_incidentType_fieldName_key" ON public."FieldConfiguration" USING btree ("organizationId", "incidentType", "fieldName");


--
-- Name: FieldConfiguration_organizationId_incidentType_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "FieldConfiguration_organizationId_incidentType_idx" ON public."FieldConfiguration" USING btree ("organizationId", "incidentType");


--
-- Name: IncidentParticipant_incidentId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "IncidentParticipant_incidentId_idx" ON public."IncidentParticipant" USING btree ("incidentId");


--
-- Name: IncidentParticipant_incidentId_userId_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "IncidentParticipant_incidentId_userId_key" ON public."IncidentParticipant" USING btree ("incidentId", "userId");


--
-- Name: IncidentParticipant_invitationStatus_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "IncidentParticipant_invitationStatus_idx" ON public."IncidentParticipant" USING btree ("invitationStatus");


--
-- Name: IncidentParticipant_isActive_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "IncidentParticipant_isActive_idx" ON public."IncidentParticipant" USING btree ("isActive");


--
-- Name: IncidentParticipant_userId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "IncidentParticipant_userId_idx" ON public."IncidentParticipant" USING btree ("userId");


--
-- Name: Incident_assignedToId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Incident_assignedToId_idx" ON public."Incident" USING btree ("assignedToId");


--
-- Name: Incident_createdById_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Incident_createdById_idx" ON public."Incident" USING btree ("createdById");


--
-- Name: Incident_incidentNumber_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Incident_incidentNumber_idx" ON public."Incident" USING btree ("incidentNumber");


--
-- Name: Incident_incidentNumber_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "Incident_incidentNumber_key" ON public."Incident" USING btree ("incidentNumber");


--
-- Name: Incident_organizationId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Incident_organizationId_idx" ON public."Incident" USING btree ("organizationId");


--
-- Name: Incident_slaResolutionDeadline_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Incident_slaResolutionDeadline_idx" ON public."Incident" USING btree ("slaResolutionDeadline");


--
-- Name: Incident_slaResponseDeadline_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Incident_slaResponseDeadline_idx" ON public."Incident" USING btree ("slaResponseDeadline");


--
-- Name: Incident_status_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Incident_status_idx" ON public."Incident" USING btree (status);


--
-- Name: Incident_visibility_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Incident_visibility_idx" ON public."Incident" USING btree (visibility);


--
-- Name: KnowledgeArticle_incidentType_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "KnowledgeArticle_incidentType_idx" ON public."KnowledgeArticle" USING btree ("incidentType");


--
-- Name: KnowledgeArticle_keywords_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "KnowledgeArticle_keywords_idx" ON public."KnowledgeArticle" USING btree (keywords);


--
-- Name: KnowledgeArticle_sourceIncidentId_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "KnowledgeArticle_sourceIncidentId_key" ON public."KnowledgeArticle" USING btree ("sourceIncidentId");


--
-- Name: Line_areaId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Line_areaId_idx" ON public."Line" USING btree ("areaId");


--
-- Name: Notification_incidentId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Notification_incidentId_idx" ON public."Notification" USING btree ("incidentId");


--
-- Name: Notification_userId_isRead_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Notification_userId_isRead_idx" ON public."Notification" USING btree ("userId", "isRead");


--
-- Name: Organization_name_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Organization_name_idx" ON public."Organization" USING btree (name);


--
-- Name: Organization_signupCode_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Organization_signupCode_idx" ON public."Organization" USING btree ("signupCode");


--
-- Name: Organization_signupCode_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "Organization_signupCode_key" ON public."Organization" USING btree ("signupCode");


--
-- Name: PolicyDocument_isPublished_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "PolicyDocument_isPublished_idx" ON public."PolicyDocument" USING btree ("isPublished");


--
-- Name: PolicyDocument_type_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "PolicyDocument_type_idx" ON public."PolicyDocument" USING btree (type);


--
-- Name: PolicyDocument_type_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "PolicyDocument_type_key" ON public."PolicyDocument" USING btree (type);


--
-- Name: PolicyRevision_policyId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "PolicyRevision_policyId_idx" ON public."PolicyRevision" USING btree ("policyId");


--
-- Name: PolicyRevision_policyId_version_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "PolicyRevision_policyId_version_key" ON public."PolicyRevision" USING btree ("policyId", version);


--
-- Name: RCAAnalysis_incidentId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "RCAAnalysis_incidentId_idx" ON public."RCAAnalysis" USING btree ("incidentId");


--
-- Name: RCAAnalysis_status_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "RCAAnalysis_status_idx" ON public."RCAAnalysis" USING btree (status);


--
-- Name: RCAVersion_rcaAnalysisId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "RCAVersion_rcaAnalysisId_idx" ON public."RCAVersion" USING btree ("rcaAnalysisId");


--
-- Name: SLAConfiguration_organizationId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "SLAConfiguration_organizationId_idx" ON public."SLAConfiguration" USING btree ("organizationId");


--
-- Name: SLAConfiguration_organizationId_severity_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "SLAConfiguration_organizationId_severity_key" ON public."SLAConfiguration" USING btree ("organizationId", severity);


--
-- Name: Session_refreshToken_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "Session_refreshToken_key" ON public."Session" USING btree ("refreshToken");


--
-- Name: Session_token_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Session_token_idx" ON public."Session" USING btree (token);


--
-- Name: Session_token_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "Session_token_key" ON public."Session" USING btree (token);


--
-- Name: Session_userId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Session_userId_idx" ON public."Session" USING btree ("userId");


--
-- Name: ShiftLine_lineId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ShiftLine_lineId_idx" ON public."ShiftLine" USING btree ("lineId");


--
-- Name: ShiftLine_shiftId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "ShiftLine_shiftId_idx" ON public."ShiftLine" USING btree ("shiftId");


--
-- Name: ShiftLine_shiftId_lineId_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "ShiftLine_shiftId_lineId_key" ON public."ShiftLine" USING btree ("shiftId", "lineId");


--
-- Name: Shift_facilityId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Shift_facilityId_idx" ON public."Shift" USING btree ("facilityId");


--
-- Name: Shift_lineId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "Shift_lineId_idx" ON public."Shift" USING btree ("lineId");


--
-- Name: SupportRequest_category_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "SupportRequest_category_idx" ON public."SupportRequest" USING btree (category);


--
-- Name: SupportRequest_organizationId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "SupportRequest_organizationId_idx" ON public."SupportRequest" USING btree ("organizationId");


--
-- Name: SupportRequest_resolvedByUserId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "SupportRequest_resolvedByUserId_idx" ON public."SupportRequest" USING btree ("resolvedByUserId");


--
-- Name: SupportRequest_status_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "SupportRequest_status_idx" ON public."SupportRequest" USING btree (status);


--
-- Name: SupportRequest_submittedByUserId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "SupportRequest_submittedByUserId_idx" ON public."SupportRequest" USING btree ("submittedByUserId");


--
-- Name: User_email_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "User_email_idx" ON public."User" USING btree (email);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_firebaseUid_key; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE UNIQUE INDEX "User_firebaseUid_key" ON public."User" USING btree ("firebaseUid");


--
-- Name: User_isOnline_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "User_isOnline_idx" ON public."User" USING btree ("isOnline");


--
-- Name: User_organizationId_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "User_organizationId_idx" ON public."User" USING btree ("organizationId");


--
-- Name: User_role_idx; Type: INDEX; Schema: public; Owner: rca_engine_user
--

CREATE INDEX "User_role_idx" ON public."User" USING btree (role);


--
-- Name: ArchivedChatMessage ArchivedChatMessage_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ArchivedChatMessage"
    ADD CONSTRAINT "ArchivedChatMessage_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public."Incident"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Area Area_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Area"
    ADD CONSTRAINT "Area_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Area Area_facilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Area"
    ADD CONSTRAINT "Area_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CAPAction CAPAction_ownerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."CAPAction"
    ADD CONSTRAINT "CAPAction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: CAPAction CAPAction_rcaAnalysisId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."CAPAction"
    ADD CONSTRAINT "CAPAction_rcaAnalysisId_fkey" FOREIGN KEY ("rcaAnalysisId") REFERENCES public."RCAAnalysis"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CAPAuditLog CAPAuditLog_capActionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."CAPAuditLog"
    ADD CONSTRAINT "CAPAuditLog_capActionId_fkey" FOREIGN KEY ("capActionId") REFERENCES public."CAPAction"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Category Category_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Category Category_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ChatMessageReaction ChatMessageReaction_messageId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ChatMessageReaction"
    ADD CONSTRAINT "ChatMessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES public."ChatMessage"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatMessageReaction ChatMessageReaction_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ChatMessageReaction"
    ADD CONSTRAINT "ChatMessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatMessageTemplate ChatMessageTemplate_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ChatMessageTemplate"
    ADD CONSTRAINT "ChatMessageTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatMessage ChatMessage_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public."Incident"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ChatMessage ChatMessage_replyToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES public."ChatMessage"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ChatMessage ChatMessage_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ChatMessage"
    ADD CONSTRAINT "ChatMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Comment Comment_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public."Incident"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_rcaAnalysisId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_rcaAnalysisId_fkey" FOREIGN KEY ("rcaAnalysisId") REFERENCES public."RCAAnalysis"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Comment Comment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Department Department_facilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DropdownOption DropdownOption_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."DropdownOption"
    ADD CONSTRAINT "DropdownOption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Evidence Evidence_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public."Incident"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Evidence Evidence_rcaAnalysisId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Evidence"
    ADD CONSTRAINT "Evidence_rcaAnalysisId_fkey" FOREIGN KEY ("rcaAnalysisId") REFERENCES public."RCAAnalysis"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Facility Facility_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Facility"
    ADD CONSTRAINT "Facility_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: FieldConfiguration FieldConfiguration_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."FieldConfiguration"
    ADD CONSTRAINT "FieldConfiguration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IncidentParticipant IncidentParticipant_addedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."IncidentParticipant"
    ADD CONSTRAINT "IncidentParticipant_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: IncidentParticipant IncidentParticipant_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."IncidentParticipant"
    ADD CONSTRAINT "IncidentParticipant_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public."Incident"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: IncidentParticipant IncidentParticipant_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."IncidentParticipant"
    ADD CONSTRAINT "IncidentParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Incident Incident_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Incident"
    ADD CONSTRAINT "Incident_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public."Area"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Incident Incident_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Incident"
    ADD CONSTRAINT "Incident_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Incident Incident_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Incident"
    ADD CONSTRAINT "Incident_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Incident Incident_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Incident"
    ADD CONSTRAINT "Incident_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Incident Incident_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Incident"
    ADD CONSTRAINT "Incident_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Incident Incident_facilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Incident"
    ADD CONSTRAINT "Incident_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Incident Incident_investigationSubmittedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Incident"
    ADD CONSTRAINT "Incident_investigationSubmittedById_fkey" FOREIGN KEY ("investigationSubmittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Incident Incident_lineId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Incident"
    ADD CONSTRAINT "Incident_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES public."Line"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Incident Incident_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Incident"
    ADD CONSTRAINT "Incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Incident Incident_shiftId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Incident"
    ADD CONSTRAINT "Incident_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES public."Shift"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Line Line_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Line"
    ADD CONSTRAINT "Line_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public."Area"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public."Incident"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PolicyDocument PolicyDocument_updatedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."PolicyDocument"
    ADD CONSTRAINT "PolicyDocument_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PolicyRevision PolicyRevision_createdByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."PolicyRevision"
    ADD CONSTRAINT "PolicyRevision_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: PolicyRevision PolicyRevision_policyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."PolicyRevision"
    ADD CONSTRAINT "PolicyRevision_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES public."PolicyDocument"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RCAAnalysis RCAAnalysis_analystId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."RCAAnalysis"
    ADD CONSTRAINT "RCAAnalysis_analystId_fkey" FOREIGN KEY ("analystId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: RCAAnalysis RCAAnalysis_incidentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."RCAAnalysis"
    ADD CONSTRAINT "RCAAnalysis_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES public."Incident"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RCAVersion RCAVersion_rcaAnalysisId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."RCAVersion"
    ADD CONSTRAINT "RCAVersion_rcaAnalysisId_fkey" FOREIGN KEY ("rcaAnalysisId") REFERENCES public."RCAAnalysis"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShiftLine ShiftLine_lineId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ShiftLine"
    ADD CONSTRAINT "ShiftLine_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES public."Line"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ShiftLine ShiftLine_shiftId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."ShiftLine"
    ADD CONSTRAINT "ShiftLine_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES public."Shift"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Shift Shift_facilityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."Shift"
    ADD CONSTRAINT "Shift_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES public."Facility"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupportRequest SupportRequest_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."SupportRequest"
    ADD CONSTRAINT "SupportRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SupportRequest SupportRequest_resolvedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."SupportRequest"
    ADD CONSTRAINT "SupportRequest_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SupportRequest SupportRequest_submittedByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."SupportRequest"
    ADD CONSTRAINT "SupportRequest_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: rca_engine_user
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO rca_engine_user;


--
-- Name: DEFAULT PRIVILEGES FOR TYPES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TYPES TO rca_engine_user;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO rca_engine_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TABLES TO rca_engine_user;


--
-- PostgreSQL database dump complete
--

\unrestrict 7RgVOZybPgJ3QA3NfHIFlxmoiUba8ABmPJq9Iggc7PJl9A69FaqzL86IBV0dcok

