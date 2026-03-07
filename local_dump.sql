--
-- PostgreSQL database dump
--

\restrict RVZx4bi1Ohe2cKWBfaIFb7hpglRUMSxU7ffSrG2whXqs9YgJfS8gDuzURLgGyh9

-- Dumped from database version 18.2
-- Dumped by pg_dump version 18.2

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

ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."Test" DROP CONSTRAINT IF EXISTS "Test_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."TestVariant" DROP CONSTRAINT IF EXISTS "TestVariant_testId_fkey";
ALTER TABLE IF EXISTS ONLY public."TestQuestion" DROP CONSTRAINT IF EXISTS "TestQuestion_variantId_fkey";
ALTER TABLE IF EXISTS ONLY public."TestQuestion" DROP CONSTRAINT IF EXISTS "TestQuestion_testId_fkey";
ALTER TABLE IF EXISTS ONLY public."TestQuestion" DROP CONSTRAINT IF EXISTS "TestQuestion_questionId_fkey";
ALTER TABLE IF EXISTS ONLY public."TestCase" DROP CONSTRAINT IF EXISTS "TestCase_questionId_fkey";
ALTER TABLE IF EXISTS ONLY public."TestAllocation" DROP CONSTRAINT IF EXISTS "TestAllocation_variantId_fkey";
ALTER TABLE IF EXISTS ONLY public."TestAllocation" DROP CONSTRAINT IF EXISTS "TestAllocation_testId_fkey";
ALTER TABLE IF EXISTS ONLY public."Submission" DROP CONSTRAINT IF EXISTS "Submission_questionId_fkey";
ALTER TABLE IF EXISTS ONLY public."Submission" DROP CONSTRAINT IF EXISTS "Submission_attemptId_fkey";
ALTER TABLE IF EXISTS ONLY public."SchedulerNote" DROP CONSTRAINT IF EXISTS "SchedulerNote_createdBy_fkey";
ALTER TABLE IF EXISTS ONLY public."SchedulerNote" DROP CONSTRAINT IF EXISTS "SchedulerNote_batchId_fkey";
ALTER TABLE IF EXISTS ONLY public."Question" DROP CONSTRAINT IF EXISTS "Question_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."Invite" DROP CONSTRAINT IF EXISTS "Invite_variantId_fkey";
ALTER TABLE IF EXISTS ONLY public."Invite" DROP CONSTRAINT IF EXISTS "Invite_testId_fkey";
ALTER TABLE IF EXISTS ONLY public."Invite" DROP CONSTRAINT IF EXISTS "Invite_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."Invite" DROP CONSTRAINT IF EXISTS "Invite_invitedBy_fkey";
ALTER TABLE IF EXISTS ONLY public."Course" DROP CONSTRAINT IF EXISTS "Course_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."CourseTopic" DROP CONSTRAINT IF EXISTS "CourseTopic_chapterId_fkey";
ALTER TABLE IF EXISTS ONLY public."CourseMaterial" DROP CONSTRAINT IF EXISTS "CourseMaterial_topicId_fkey";
ALTER TABLE IF EXISTS ONLY public."CourseEvaluation" DROP CONSTRAINT IF EXISTS "CourseEvaluation_topicId_fkey";
ALTER TABLE IF EXISTS ONLY public."CourseEvaluation" DROP CONSTRAINT IF EXISTS "CourseEvaluation_testId_fkey";
ALTER TABLE IF EXISTS ONLY public."CourseChapter" DROP CONSTRAINT IF EXISTS "CourseChapter_courseId_fkey";
ALTER TABLE IF EXISTS ONLY public."CourseAssignment" DROP CONSTRAINT IF EXISTS "CourseAssignment_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."CourseAssignment" DROP CONSTRAINT IF EXISTS "CourseAssignment_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."CourseAssignment" DROP CONSTRAINT IF EXISTS "CourseAssignment_courseId_fkey";
ALTER TABLE IF EXISTS ONLY public."CourseAssignment" DROP CONSTRAINT IF EXISTS "CourseAssignment_batchId_fkey";
ALTER TABLE IF EXISTS ONLY public."CourseActivity" DROP CONSTRAINT IF EXISTS "CourseActivity_topicId_fkey";
ALTER TABLE IF EXISTS ONLY public."Batch" DROP CONSTRAINT IF EXISTS "Batch_tenantId_fkey";
ALTER TABLE IF EXISTS ONLY public."BatchVideo" DROP CONSTRAINT IF EXISTS "BatchVideo_uploadedBy_fkey";
ALTER TABLE IF EXISTS ONLY public."BatchVideo" DROP CONSTRAINT IF EXISTS "BatchVideo_batchId_fkey";
ALTER TABLE IF EXISTS ONLY public."BatchTestAssignment" DROP CONSTRAINT IF EXISTS "BatchTestAssignment_testId_fkey";
ALTER TABLE IF EXISTS ONLY public."BatchTestAssignment" DROP CONSTRAINT IF EXISTS "BatchTestAssignment_batchId_fkey";
ALTER TABLE IF EXISTS ONLY public."BatchScheduleEvent" DROP CONSTRAINT IF EXISTS "BatchScheduleEvent_courseId_fkey";
ALTER TABLE IF EXISTS ONLY public."BatchScheduleEvent" DROP CONSTRAINT IF EXISTS "BatchScheduleEvent_batchId_fkey";
ALTER TABLE IF EXISTS ONLY public."BatchMember" DROP CONSTRAINT IF EXISTS "BatchMember_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."BatchMember" DROP CONSTRAINT IF EXISTS "BatchMember_batchId_fkey";
ALTER TABLE IF EXISTS ONLY public."Attempt" DROP CONSTRAINT IF EXISTS "Attempt_variantId_fkey";
ALTER TABLE IF EXISTS ONLY public."Attempt" DROP CONSTRAINT IF EXISTS "Attempt_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."Attempt" DROP CONSTRAINT IF EXISTS "Attempt_testId_fkey";
ALTER TABLE IF EXISTS ONLY public."Assignment" DROP CONSTRAINT IF EXISTS "Assignment_courseId_fkey";
ALTER TABLE IF EXISTS ONLY public."AssignmentTest" DROP CONSTRAINT IF EXISTS "AssignmentTest_testId_fkey";
ALTER TABLE IF EXISTS ONLY public."AssignmentTest" DROP CONSTRAINT IF EXISTS "AssignmentTest_assignmentId_fkey";
ALTER TABLE IF EXISTS ONLY public."ActivitySubmission" DROP CONSTRAINT IF EXISTS "ActivitySubmission_userId_fkey";
ALTER TABLE IF EXISTS ONLY public."ActivitySubmission" DROP CONSTRAINT IF EXISTS "ActivitySubmission_activityId_fkey";
DROP INDEX IF EXISTS public."User_tenantId_idx";
DROP INDEX IF EXISTS public."User_tenantId_email_key";
DROP INDEX IF EXISTS public."TestVariant_testId_idx";
DROP INDEX IF EXISTS public."TestQuestion_variantId_idx";
DROP INDEX IF EXISTS public."TestQuestion_testId_questionId_key";
DROP INDEX IF EXISTS public."TestQuestion_testId_idx";
DROP INDEX IF EXISTS public."TestCase_questionId_idx";
DROP INDEX IF EXISTS public."TestAllocation_userId_testId_key";
DROP INDEX IF EXISTS public."TestAllocation_testId_idx";
DROP INDEX IF EXISTS public."Tenant_slug_key";
DROP INDEX IF EXISTS public."Tenant_domain_key";
DROP INDEX IF EXISTS public."Submission_attemptId_questionId_key";
DROP INDEX IF EXISTS public."Submission_attemptId_idx";
DROP INDEX IF EXISTS public."SchedulerNote_batchId_idx";
DROP INDEX IF EXISTS public."SchedulerNote_batchId_date_key";
DROP INDEX IF EXISTS public."RoleDefinition_tenantId_roleKey_key";
DROP INDEX IF EXISTS public."RoleDefinition_tenantId_idx";
DROP INDEX IF EXISTS public."RevisionLog_tenantId_module_entityId_idx";
DROP INDEX IF EXISTS public."RevisionLog_createdAt_idx";
DROP INDEX IF EXISTS public."Notification_userId_isRead_idx";
DROP INDEX IF EXISTS public."Notification_tenantId_idx";
DROP INDEX IF EXISTS public."Invite_token_key";
DROP INDEX IF EXISTS public."Invite_token_idx";
DROP INDEX IF EXISTS public."Invite_tenantId_email_idx";
DROP INDEX IF EXISTS public."Enquiry_status_createdAt_idx";
DROP INDEX IF EXISTS public."CourseTopic_chapterId_idx";
DROP INDEX IF EXISTS public."CourseMaterial_topicId_idx";
DROP INDEX IF EXISTS public."CourseEvaluation_topicId_idx";
DROP INDEX IF EXISTS public."CourseEvaluation_testId_idx";
DROP INDEX IF EXISTS public."CourseChapter_courseId_idx";
DROP INDEX IF EXISTS public."CourseAssignment_userId_idx";
DROP INDEX IF EXISTS public."CourseAssignment_tenantId_idx";
DROP INDEX IF EXISTS public."CourseAssignment_courseId_idx";
DROP INDEX IF EXISTS public."CourseAssignment_batchId_idx";
DROP INDEX IF EXISTS public."CourseActivity_topicId_idx";
DROP INDEX IF EXISTS public."Batch_tenantId_idx";
DROP INDEX IF EXISTS public."BatchVideo_batchId_idx";
DROP INDEX IF EXISTS public."BatchTestAssignment_testId_idx";
DROP INDEX IF EXISTS public."BatchTestAssignment_batchId_testId_key";
DROP INDEX IF EXISTS public."BatchTestAssignment_batchId_idx";
DROP INDEX IF EXISTS public."BatchScheduleEvent_startAt_endAt_idx";
DROP INDEX IF EXISTS public."BatchScheduleEvent_batchId_idx";
DROP INDEX IF EXISTS public."BatchMember_userId_idx";
DROP INDEX IF EXISTS public."BatchMember_batchId_userId_key";
DROP INDEX IF EXISTS public."BatchMember_batchId_idx";
DROP INDEX IF EXISTS public."AssignmentTest_assignmentId_testId_key";
DROP INDEX IF EXISTS public."ActivitySubmission_activityId_userId_key";
DROP INDEX IF EXISTS public."ActivitySubmission_activityId_idx";
ALTER TABLE IF EXISTS ONLY public."User" DROP CONSTRAINT IF EXISTS "User_pkey";
ALTER TABLE IF EXISTS ONLY public."Test" DROP CONSTRAINT IF EXISTS "Test_pkey";
ALTER TABLE IF EXISTS ONLY public."TestVariant" DROP CONSTRAINT IF EXISTS "TestVariant_pkey";
ALTER TABLE IF EXISTS ONLY public."TestQuestion" DROP CONSTRAINT IF EXISTS "TestQuestion_pkey";
ALTER TABLE IF EXISTS ONLY public."TestCase" DROP CONSTRAINT IF EXISTS "TestCase_pkey";
ALTER TABLE IF EXISTS ONLY public."TestAllocation" DROP CONSTRAINT IF EXISTS "TestAllocation_pkey";
ALTER TABLE IF EXISTS ONLY public."Tenant" DROP CONSTRAINT IF EXISTS "Tenant_pkey";
ALTER TABLE IF EXISTS ONLY public."Submission" DROP CONSTRAINT IF EXISTS "Submission_pkey";
ALTER TABLE IF EXISTS ONLY public."SchedulerNote" DROP CONSTRAINT IF EXISTS "SchedulerNote_pkey";
ALTER TABLE IF EXISTS ONLY public."RoleDefinition" DROP CONSTRAINT IF EXISTS "RoleDefinition_pkey";
ALTER TABLE IF EXISTS ONLY public."RevisionLog" DROP CONSTRAINT IF EXISTS "RevisionLog_pkey";
ALTER TABLE IF EXISTS ONLY public."Question" DROP CONSTRAINT IF EXISTS "Question_pkey";
ALTER TABLE IF EXISTS ONLY public."Notification" DROP CONSTRAINT IF EXISTS "Notification_pkey";
ALTER TABLE IF EXISTS ONLY public."Invite" DROP CONSTRAINT IF EXISTS "Invite_pkey";
ALTER TABLE IF EXISTS ONLY public."Enquiry" DROP CONSTRAINT IF EXISTS "Enquiry_pkey";
ALTER TABLE IF EXISTS ONLY public."Course" DROP CONSTRAINT IF EXISTS "Course_pkey";
ALTER TABLE IF EXISTS ONLY public."CourseTopic" DROP CONSTRAINT IF EXISTS "CourseTopic_pkey";
ALTER TABLE IF EXISTS ONLY public."CourseMaterial" DROP CONSTRAINT IF EXISTS "CourseMaterial_pkey";
ALTER TABLE IF EXISTS ONLY public."CourseEvaluation" DROP CONSTRAINT IF EXISTS "CourseEvaluation_pkey";
ALTER TABLE IF EXISTS ONLY public."CourseChapter" DROP CONSTRAINT IF EXISTS "CourseChapter_pkey";
ALTER TABLE IF EXISTS ONLY public."CourseAssignment" DROP CONSTRAINT IF EXISTS "CourseAssignment_pkey";
ALTER TABLE IF EXISTS ONLY public."CourseActivity" DROP CONSTRAINT IF EXISTS "CourseActivity_pkey";
ALTER TABLE IF EXISTS ONLY public."Batch" DROP CONSTRAINT IF EXISTS "Batch_pkey";
ALTER TABLE IF EXISTS ONLY public."BatchVideo" DROP CONSTRAINT IF EXISTS "BatchVideo_pkey";
ALTER TABLE IF EXISTS ONLY public."BatchTestAssignment" DROP CONSTRAINT IF EXISTS "BatchTestAssignment_pkey";
ALTER TABLE IF EXISTS ONLY public."BatchScheduleEvent" DROP CONSTRAINT IF EXISTS "BatchScheduleEvent_pkey";
ALTER TABLE IF EXISTS ONLY public."BatchMember" DROP CONSTRAINT IF EXISTS "BatchMember_pkey";
ALTER TABLE IF EXISTS ONLY public."Attempt" DROP CONSTRAINT IF EXISTS "Attempt_pkey";
ALTER TABLE IF EXISTS ONLY public."Assignment" DROP CONSTRAINT IF EXISTS "Assignment_pkey";
ALTER TABLE IF EXISTS ONLY public."AssignmentTest" DROP CONSTRAINT IF EXISTS "AssignmentTest_pkey";
ALTER TABLE IF EXISTS ONLY public."ActivitySubmission" DROP CONSTRAINT IF EXISTS "ActivitySubmission_pkey";
DROP TABLE IF EXISTS public."User";
DROP TABLE IF EXISTS public."TestVariant";
DROP TABLE IF EXISTS public."TestQuestion";
DROP TABLE IF EXISTS public."TestCase";
DROP TABLE IF EXISTS public."TestAllocation";
DROP TABLE IF EXISTS public."Test";
DROP TABLE IF EXISTS public."Tenant";
DROP TABLE IF EXISTS public."Submission";
DROP TABLE IF EXISTS public."SchedulerNote";
DROP TABLE IF EXISTS public."RoleDefinition";
DROP TABLE IF EXISTS public."RevisionLog";
DROP TABLE IF EXISTS public."Question";
DROP TABLE IF EXISTS public."Notification";
DROP TABLE IF EXISTS public."Invite";
DROP TABLE IF EXISTS public."Enquiry";
DROP TABLE IF EXISTS public."CourseTopic";
DROP TABLE IF EXISTS public."CourseMaterial";
DROP TABLE IF EXISTS public."CourseEvaluation";
DROP TABLE IF EXISTS public."CourseChapter";
DROP TABLE IF EXISTS public."CourseAssignment";
DROP TABLE IF EXISTS public."CourseActivity";
DROP TABLE IF EXISTS public."Course";
DROP TABLE IF EXISTS public."BatchVideo";
DROP TABLE IF EXISTS public."BatchTestAssignment";
DROP TABLE IF EXISTS public."BatchScheduleEvent";
DROP TABLE IF EXISTS public."BatchMember";
DROP TABLE IF EXISTS public."Batch";
DROP TABLE IF EXISTS public."Attempt";
DROP TABLE IF EXISTS public."AssignmentTest";
DROP TABLE IF EXISTS public."Assignment";
DROP TABLE IF EXISTS public."ActivitySubmission";
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ActivitySubmission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ActivitySubmission" (
    id text NOT NULL,
    "activityId" text NOT NULL,
    "userId" text NOT NULL,
    "storageKey" text NOT NULL,
    "fileName" text NOT NULL,
    "fileSizeBytes" integer,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Assignment" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    title text NOT NULL,
    description text,
    "dueDate" timestamp(3) without time zone,
    "gradingType" text DEFAULT 'auto'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AssignmentTest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AssignmentTest" (
    id text NOT NULL,
    "assignmentId" text NOT NULL,
    "testId" text NOT NULL
);


--
-- Name: Attempt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Attempt" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "testId" text NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "submittedAt" timestamp(3) without time zone,
    score double precision,
    "maxScore" double precision,
    status text DEFAULT 'in_progress'::text NOT NULL,
    "variantId" text
);


--
-- Name: Batch; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Batch" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isArchived" boolean DEFAULT false NOT NULL
);


--
-- Name: BatchMember; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BatchMember" (
    id text NOT NULL,
    "batchId" text NOT NULL,
    "userId" text NOT NULL,
    "joinedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: BatchScheduleEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BatchScheduleEvent" (
    id text NOT NULL,
    "batchId" text NOT NULL,
    title text NOT NULL,
    "startAt" timestamp(3) without time zone NOT NULL,
    "endAt" timestamp(3) without time zone NOT NULL,
    type text,
    "courseId" text,
    location text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: BatchTestAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BatchTestAssignment" (
    id text NOT NULL,
    "batchId" text NOT NULL,
    "testId" text NOT NULL,
    "assignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "assignedBy" text
);


--
-- Name: BatchVideo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."BatchVideo" (
    id text NOT NULL,
    "batchId" text NOT NULL,
    title text NOT NULL,
    description text,
    "storageKey" text NOT NULL,
    "mimeType" text DEFAULT 'video/mp4'::text NOT NULL,
    "sizeBytes" integer,
    "durationSeconds" integer,
    "order" integer DEFAULT 0 NOT NULL,
    "uploadedBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Course; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Course" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    title text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isArchived" boolean DEFAULT false NOT NULL
);


--
-- Name: CourseActivity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CourseActivity" (
    id text NOT NULL,
    "topicId" text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CourseAssignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CourseAssignment" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "courseId" text NOT NULL,
    "batchId" text,
    "userId" text,
    "assignedBy" text NOT NULL,
    "assignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "dueDate" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CourseChapter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CourseChapter" (
    id text NOT NULL,
    "courseId" text NOT NULL,
    title text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: CourseEvaluation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CourseEvaluation" (
    id text NOT NULL,
    "topicId" text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    "testId" text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CourseMaterial; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CourseMaterial" (
    id text NOT NULL,
    "topicId" text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    "storageKey" text,
    url text,
    "order" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: CourseTopic; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."CourseTopic" (
    id text NOT NULL,
    "chapterId" text NOT NULL,
    title text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    content text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Enquiry; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Enquiry" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    category text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Invite; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Invite" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    email text NOT NULL,
    token text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "invitedBy" text NOT NULL,
    "testId" text,
    "variantId" text,
    "usedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "tenantId" text NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Question; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Question" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    type text NOT NULL,
    content jsonb NOT NULL,
    difficulty text NOT NULL,
    tags text[] DEFAULT ARRAY[]::text[],
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isArchived" boolean DEFAULT false NOT NULL
);


--
-- Name: RevisionLog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RevisionLog" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    module text NOT NULL,
    "entityId" text NOT NULL,
    action text NOT NULL,
    "userId" text,
    "userName" text,
    details jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: RoleDefinition; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."RoleDefinition" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "roleKey" text NOT NULL,
    "displayName" text NOT NULL,
    permissions jsonb NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: SchedulerNote; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SchedulerNote" (
    id text NOT NULL,
    "batchId" text NOT NULL,
    date date NOT NULL,
    content text NOT NULL,
    "createdBy" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Submission; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Submission" (
    id text NOT NULL,
    "attemptId" text NOT NULL,
    "questionId" text NOT NULL,
    code text,
    language text,
    "selectedOptionId" text,
    status text DEFAULT 'pending'::text NOT NULL,
    score double precision,
    "aiRatings" jsonb,
    output text,
    "errorMessage" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Tenant" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    "planId" text,
    domain text,
    status text DEFAULT 'active'::text NOT NULL,
    "brandingConfig" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "featureFlags" jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: Test; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Test" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    title text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    config jsonb NOT NULL,
    schedule jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    difficulty text
);


--
-- Name: TestAllocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TestAllocation" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "testId" text NOT NULL,
    "variantId" text,
    "assignedBy" text,
    "assignedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TestCase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TestCase" (
    id text NOT NULL,
    "questionId" text NOT NULL,
    input text NOT NULL,
    "expectedOutput" text NOT NULL,
    "isPublic" boolean DEFAULT false NOT NULL,
    weight integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TestQuestion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TestQuestion" (
    id text NOT NULL,
    "testId" text NOT NULL,
    "questionId" text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "variantId" text
);


--
-- Name: TestVariant; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TestVariant" (
    id text NOT NULL,
    "testId" text NOT NULL,
    name text NOT NULL,
    difficulty text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    email text,
    "passwordHash" text NOT NULL,
    name text NOT NULL,
    role text DEFAULT 'student'::text NOT NULL,
    "cohortIds" text[] DEFAULT ARRAY[]::text[],
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    address text,
    "phoneNumber" text
);


--
-- Data for Name: ActivitySubmission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."ActivitySubmission" (id, "activityId", "userId", "storageKey", "fileName", "fileSizeBytes", "submittedAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Assignment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Assignment" (id, "courseId", title, description, "dueDate", "gradingType", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: AssignmentTest; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."AssignmentTest" (id, "assignmentId", "testId") FROM stdin;
\.


--
-- Data for Name: Attempt; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Attempt" (id, "userId", "testId", "startedAt", "submittedAt", score, "maxScore", status, "variantId") FROM stdin;
98843b9b-0673-4cb1-9501-e89b073294fd	f200fdd1-6b46-488e-bacb-dd67c3454a34	894ee9f8-b313-4281-be0f-345fa4bb1721	2026-02-17 10:05:04.149	\N	\N	\N	in_progress	\N
cf3cf0e7-34df-4801-b4d2-f198db59c633	f200fdd1-6b46-488e-bacb-dd67c3454a34	894ee9f8-b313-4281-be0f-345fa4bb1721	2026-02-17 10:17:14.124	\N	\N	\N	in_progress	\N
\.


--
-- Data for Name: Batch; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Batch" (id, "tenantId", name, description, "createdAt", "updatedAt", "isArchived") FROM stdin;
bc623434-f5d6-4932-9a37-1efc68020e03	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	IBPS April 2026	\N	2026-02-19 10:30:50.301	2026-02-19 10:30:50.301	f
914fb804-3a98-47c8-99f6-0ef586ad89e5	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	RBI Feb 2026	\N	2026-02-22 15:07:58.794	2026-03-03 13:36:10.883	t
\.


--
-- Data for Name: BatchMember; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BatchMember" (id, "batchId", "userId", "joinedAt") FROM stdin;
5c736883-2e0e-4b74-96d5-7239ecba9ea5	914fb804-3a98-47c8-99f6-0ef586ad89e5	f200fdd1-6b46-488e-bacb-dd67c3454a34	2026-02-22 15:08:27.994
\.


--
-- Data for Name: BatchScheduleEvent; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BatchScheduleEvent" (id, "batchId", title, "startAt", "endAt", type, "courseId", location, metadata, "createdAt", "updatedAt") FROM stdin;
c5780806-cc4d-47c4-a84e-9bda1d68b5e3	914fb804-3a98-47c8-99f6-0ef586ad89e5	March	2026-03-01 03:30:00	2026-03-31 15:30:00	\N	\N	\N	{}	2026-02-22 15:09:32.304	2026-02-22 15:09:32.304
\.


--
-- Data for Name: BatchTestAssignment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BatchTestAssignment" (id, "batchId", "testId", "assignedAt", "assignedBy") FROM stdin;
\.


--
-- Data for Name: BatchVideo; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."BatchVideo" (id, "batchId", title, description, "storageKey", "mimeType", "sizeBytes", "durationSeconds", "order", "uploadedBy", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Course; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Course" (id, "tenantId", title, description, "createdAt", "updatedAt", "isArchived") FROM stdin;
84d5a77a-b7b5-4c7c-83d0-3742aaf10026	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	IBPS Sample 1	Sample description comes here for 2026	2026-02-19 10:30:26.815	2026-02-19 10:30:26.815	f
bac530a0-2887-4ba6-a730-74265c2019c0	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	RBI Officers	\N	2026-02-22 15:00:17.795	2026-02-22 15:00:17.795	f
\.


--
-- Data for Name: CourseActivity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CourseActivity" (id, "topicId", type, title, config, "order", "createdAt") FROM stdin;
\.


--
-- Data for Name: CourseAssignment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CourseAssignment" (id, "tenantId", "courseId", "batchId", "userId", "assignedBy", "assignedAt", "dueDate", "createdAt", "updatedAt") FROM stdin;
fdc32a91-7e37-497f-94fb-be7092a6bcc4	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	84d5a77a-b7b5-4c7c-83d0-3742aaf10026	\N	f200fdd1-6b46-488e-bacb-dd67c3454a34	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	2026-03-02 07:15:18.849	\N	2026-03-02 07:15:18.849	2026-03-02 07:15:18.849
df0250f7-7dc0-49fd-93df-46a19f73301d	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	bac530a0-2887-4ba6-a730-74265c2019c0	914fb804-3a98-47c8-99f6-0ef586ad89e5	\N	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	2026-03-02 07:45:45.736	\N	2026-03-02 07:45:45.736	2026-03-02 07:45:45.736
\.


--
-- Data for Name: CourseChapter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CourseChapter" (id, "courseId", title, "order", "createdAt", "updatedAt") FROM stdin;
9ee5cd3f-49c8-456c-b0e2-a461476576ee	84d5a77a-b7b5-4c7c-83d0-3742aaf10026	IBPS Introduction	0	2026-02-19 10:31:23.147	2026-02-19 10:31:23.147
342a393d-e2e3-42ac-a13f-5eade623260c	bac530a0-2887-4ba6-a730-74265c2019c0	Introduction to RBI	0	2026-02-22 15:00:40.845	2026-02-22 15:00:40.845
\.


--
-- Data for Name: CourseEvaluation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CourseEvaluation" (id, "topicId", type, title, "testId", config, "order", "createdAt") FROM stdin;
\.


--
-- Data for Name: CourseMaterial; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CourseMaterial" (id, "topicId", type, title, "storageKey", url, "order", "createdAt") FROM stdin;
91292482-6bf5-4580-bf7f-addba309d096	7caa4107-2838-4777-bef9-c0e111a2f52d	link	YouTube Notification	\N	https://www.youtube.com/watch?v=Wf7iusC_V0U	0	2026-02-22 15:05:35.358
\.


--
-- Data for Name: CourseTopic; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."CourseTopic" (id, "chapterId", title, "order", content, "createdAt", "updatedAt") FROM stdin;
5731300e-7742-413e-ba47-7f6e67c2d3c4	9ee5cd3f-49c8-456c-b0e2-a461476576ee	Basic Day 1	0	<p><span style="font-family: Verdana, sans-serif;"><strong>First IBPS topic</strong></span></p><p><span style="font-family: Verdana, sans-serif;">Here is the sample introduction topic.</span></p><ul><li><p>Day 1</p></li><li><p>Day 2</p></li></ul><p><strong><em>Your point of contact</em></strong></p><ol><li><p>Ashasree</p></li><li><p>Prem Ananth</p></li></ol><p></p>	2026-02-19 10:35:28.637	2026-02-19 11:40:40.312
7caa4107-2838-4777-bef9-c0e111a2f52d	342a393d-e2e3-42ac-a13f-5eade623260c	Qualilfication	0	<p><span style="font-family: Verdana, sans-serif; font-size: 14px;"><strong>Educational Qualification:</strong></span></p><p><span style="font-family: Verdana, sans-serif; font-size: 14px;">Any degree</span></p><img src="data:image/png;base64,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/svlDWNufaj4mFx/esh9sRI7dtq+RlaOG/A2qv02tdfdh0REREREeoGGhoZWR/PZGdl3++23Exoayscff8yZM2eIjo5m8uSmoQdNwsPD+dGPfsR//dd/sXfvXt58800mTZpkTmY5ndn69etJSUkhPDyc5557rmmaz/DwcDIyMtiyZUvTtJtbtmxh8eLF5kO08PDDDxMWFsb+/ft58803vfZdvXqV//zP/+TChQtERkZ6dZr16dOHr371q2zfvp29e/eSm5vLK6+8wogRzfMFjRgxghUrVjRNB7p371527drlla61c2pNY+dc//79KSgoYNeuXezatYvPPvuM22+/nVtvvRXcnXx33HEHkZGR5kN0m9bir8FmPPYZExfXEBraPMzK6XTidE/jIp0g6mlezU4jqewdHl282ti2dC07piZQus9jbbueIO0VNj09jtDiLaQ/02nfY+85fNWFn9Je2cTT4yIo3fcjC52M0tl++txXmT2qno+y/sy3PvrCa9+jX5/EiqlDoaqYXzx7lI1ee6X7pJC56VekjaijKGsJi98wpgdslPZyDpnTYqGmkDUzlvg1iqo9KS/nsHYa7F2SbmFKue7Pr3SBzE0cSBvBqVz/1syT60zaq+zInMSAoiweWnwdfg4KsHlr97A0JYJTuUt4cmW7jay0S/chEREREZFAaK2jr7FjZdDw4VRUtPatQcPYsWN54YUXCAsLY82aNYwaNYpvfOMbnDp1ih/84AdcvXq1Ke2KFStITU3l8uXLFBYWEh8fT1xcHEFBQVy4cIFFixbZSmf21FNPcf/99xMbG8sHH3zAqVOn2LBhA8899xwPP/wwV65c4ciRI4SEhDB+/HhCQ0P585//zC9+8QvzocA9Ou2HP/whAL/85S85ePCgOUkLEydO5PnnnycqKorPP/+cTz75hMrKSlJSUhg4cCBvvfUWK1euJDw8nJ/97GckJydTWlrKiRMnCAsLY/z48URERFBQUMALL7zQ6jm1ZsqUKdx000189NFHXLx4sdV9AHfccQdXrlxp9bzi4+MZP348586d48iRI03bGzsJfb130qRJ9O/f3+fvb0t0dDSfnT1Lnz596OPe1qdP4/+gj+nntvTQEX3XkcrXeae4HmJTeKWNacO62tJX1/Hq0jlN690lpMwhc44xLeqnxb3gW+z+6IS6iEqeytOvZvP0uAio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NIZPejFzd15ndPA16tIRfSIiIiIiIiIiIiIiIj2VeURW4+grz5dIW8zx4jl6r73Rfv7QiD4RERERERERERERERELzCP+RHzp7M68tqijT0RERERERERERERERKQX0tSdIiIiIiIiIiIiIiIiIr2QOvpEREREREREREREREREeiF19ImIiIiIiIiIiIiIiIj0Qt3W0ZcaN4ui9AxKpjtYaN4p0gbFjkhLui5Eej9dxyIiIiIiIiIiYle3dfSlj0ogFCAygekR5r2BtXFmBiXpHq+ZgXyglsyegPyOQB2357MbO44hk9kzfVEX1rlN8bMpSc9gT7x5x3Xgej43O7qgHOxeFyK+3bj3lp5A17GIiIiIiIiIiNjVbR19OSdLcQJUlZJXY94r0jo7sRMf9RCvTZnA6MgQ864uMStuFoceWRzQDp72BCoPgTpub9NTysHOdSGB01PiobupHPyj61hEREREREREROzqto6+gnO7SM7JIjEvn2zzzgCbvzuLxBzjVXDFvFd6Ojux872xtxGJi/LjO3nqzeZ6T9zd/ns7Q0zUYCJDgsybu1Sg8hCo4/Y2PaUc7FwXEjg9JR66m8rBP7qORURERERERETErm7r6BPpCsMHAK5Sdn58mvwvzHtFRERERERERERERER6rz5j4uIaQkNDmzY4nU6cTqdXos60cWYGqf09NlwpYoWv0VXxsylJHUDBns3sjJrJsjsSiAwBXC6qTr/Njz88zi7ze4DX7vomjrjBRlpcVJUfI+f9fFZeM6c0bJyZQSpt5SGOEwVZzDjjvau19z2RMJPvjUsgpr97JIPLBUFBPs/ziYSZfG98AjFhRlpnVSl57+3m+zUuj1QeaS0et1OFTea9tAnE1B5jVe5+1pl2xw+dxVv3J8DpPBLfL2nabu3cktmT7mB0WT6JB4rIHD+X9MShRAYBtRcoeP+PzL9Y25Tacux4aK2ewP9za5c7btp2jq0523kW7zj753oHz96VzPAwwFVH+adv89zhEvI93hnfL47MZAepTXEOziuXOHE0j+dKK/jE45ht88iDVXaPa/PcsBw7NsTPpiR1KEffXcfmUI9ju1xUlR1g9cEiNnsmD0T5+lEOVtm9LhaPmsl3xnqU75ULfHLkzzx+7jNzUtustr+Zt84mfUycR/le4HDhn5h/wXOuQjvtg520Brtx1ua52Y0HmyzF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8o6+H94SB5zjozPN294uuwpBCaR6D3rrlZwVh1iRt58Xa43pN3NOHuGoCwiCxglSvz0igVAukf/ubp69XNf03uwzu9l8og7ChjOlZZ8V2SW/Jzkni2RfU1AGUoSDiYOBK8dY/dZ+rzyvO7OfKR8e90oOQFURK/L2tlkOAPPf+h2PnjzN5vrm6UqzTx7nDEBIKDEeaQFwXaJgfzZTPi4h5wtj0/dPngUgtJ/nHKuGbiszERERERERERERERGRAOvajr7gCaTEAOUnyfHYvK70LE6CGDci0WNr73SmpMC0fl8J1aZpIccNDAIG40jLoCTd+/Xd0SHAAIZEer+nWw0aTCRQdeZIy7UJW3HiE/M6hi3LASA+bAwbJy+gaI5nOTgYbU7Y6No58ipNaxie20ViThZ3fmyMGhQREREREREREREREbkRdGlHX+qwRIYDxExmo2cH10NJxiivuMTm6TuvZ83L8vUqzmtO86aOiXCwI+1hUmMHENpLy0RERERERERERERERKS7dGlH3xMj25mb8zqZvrM9Z6sBLpK3w7zuYPNrxjnzu7rR1Ss4gZi4JBzmfR2wLDGJSMBZfpBVHmv0Jebkc8KcWERERERERERERERERLx0XUdf47Sdlw6x1EfH1oPvloKP6TvLr30OwOix01gedn0M+8o5fQEYwvQHZ7JqYASp5gStSE+YS1F6BkWTkju1w61dlZ9yog6ImcRrk1JYFhbStCt9qIO37xrjldyqmH7GcZxVF/nIvUafY+AYNk6+u/WpO23qtjITEREREREREREREREJsD5j4uIaQkNDmzY4nU6czk6eohFIHfV1Nt45hPK/bua+v31m3g0ksyfdwWhXKZu27eLFxs1hqbyXdicx3omBc2zN2c6z5s3tiZ9NSWqceasHj+P6kfZEQRYzznin2jgzg1SKWLG7ed26DdMzcLS2Dt8V77SNNs7MILU/QDX5uW/wVK0pQYSDQzOSae2wgM/8WeGIn0VWaoIxxapZWT6JB4qM/9soh9T42Wxsq3y9ysEdH62UTWu6s8xEREREREREREREREQCqctG9C28eQhwiU9O++rkAyjiozIgaDgTPafvrC3gubePcKKqzmNj7/dUXha/+es5quqMkWxW5JVcxAk4zxaSbe6wCrD8M7t4fM8Bjl66irMxyy4XVWVH+M2H7k4+mwrObGfVR+do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YOeOrZamlOvu/EoXaGP0lNyAwibzXtoEIk9sJ/mwH4so3uAWTljAC0nhnCjIZsYZdRx1Bt2HRERERERERETErPtG9HWaZO4YbqwjExI8CIfHGaX2i+OBuMHGD9UVeujVo3R/vRWcP84J11AcY4ead/nQ/fkVka6VeXsyMVyi4Lg6+exoXN/zhaQBUHWMzerk6yS6D4mIiIiIiIiISEvXxYi+5nWAWlF3kbz9vyejs6YOk07RE+rNET+brNShVB3/M788WkLOFzA2OJqvxU/iiZgS7nz/eFPanpBfCTCN6BPxn3lNuLpzbN29nWctjJgWa3QfEhERERERERERs+uiow9g1fjZTEsYSmSY8W13AOqqOXv6CK8fOcLmLzxTS0/RE+pt1tDJfG9CMqMj3Xlw1VFVeYqCjw6Qcdl7zaWekF8JIHX0ifivsaPPZayJl/PhAVZeMyeSjtJ9SEREREREREREPF03HX0iIiIiIiIiIiIiIiIiN5LrYI0+ERERERERERERERERkRuPOvpEREREREREREREREREeiF19ImIiIiIiIiIiIiIiIj0QuroExEREREREREREREREemF1NEnIiIiIiIiIiIiIiIi0gupo09ERERERERERERERESkF1JHn4iIiIiIiIiIiIiIiEgvpI4+ERERERERERERERERkV5IHX0iIiIiIiIiIiIiIiIivZA6+kRERERERERERERERER6oe7r6ItwcCg9g5LJyeY9IiIiIiIiIiIiIiIiItKO7uvoExERERERERERERERERG/qaNPREREREREREREREREpBe6Ljr64sOS2TN9MSXpGZSkzSYrzJyiWaDSioiIiIiIiIiIiIiIiHSlPmPi4hpCQ0ObNjidTpxOp1eiThHh4NCMZCLN283K8kk8UGTe2qYND2fgGOy5pZqCvW8w/7Lx08aZGaRSxIrd+TgClDbbM5mIiIiIiIiIiIiIiIhIgPX+EX0RDiYONjoIn8pZx6riamAAqY65ZEUEEd8vhfj+wNVqsgOU9hNznkREREREREREREREREQCrOtG9Jk1jvDzYwSfl/jZlKTGcaIgixlnjE0Lxy/ghTEDvJKd/WA9U774amDSltZ5bRMREREREREREREREREJtN7f0deKzPFzeTJxKKFBLspP/InnDn9KvjmRW6DSioiIiIiIiIiIiIiIiATK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"><table style="min-width: 125px;"><colgroup><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"><col style="min-width: 25px;"></colgroup><tbody><tr><th colspan="1" rowspan="1"><p></p></th><th colspan="1" rowspan="1"><p></p></th><th colspan="1" rowspan="1"><p></p></th><th colspan="1" rowspan="1"><p></p></th><th colspan="1" rowspan="1"><p></p></th></tr><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr><tr><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td><td colspan="1" rowspan="1"><p></p></td></tr></tbody></table><p></p>	2026-02-22 15:01:23.543	2026-02-22 15:04:16.847
\.


--
-- Data for Name: Enquiry; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Enquiry" (id, name, email, phone, category, message, status, "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: Invite; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Invite" (id, "tenantId", email, token, "expiresAt", "invitedBy", "testId", "variantId", "usedAt", "createdAt") FROM stdin;
8bfe1d21-6cb1-4226-875c-d7151367ff2f	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	premananthc@gmail.com	076ac465275f4ddba0475647f1e39afd553a6fbb	2026-03-07 12:37:03.326	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	\N	\N	2026-03-05 12:41:35.271	2026-03-05 12:37:03.327
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Notification" (id, "userId", "tenantId", type, title, message, metadata, "isRead", "createdAt") FROM stdin;
\.


--
-- Data for Name: Question; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Question" (id, "tenantId", type, content, difficulty, tags, "createdAt", "updatedAt", "isArchived") FROM stdin;
0b6d8577-714b-44a0-b59b-251af9e4f0ce	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	coding	{"title": "Sum of Two Numbers", "examples": [{"input": "2 3", "output": "5"}], "constraints": ["-1000 <= a, b <= 1000"], "description": "Write a function that returns the sum of two numbers a and b."}	easy	{math,basic}	2026-02-17 09:59:11.964	2026-02-17 09:59:11.964	f
15495a8a-7ff3-4263-8357-c72cb18a7974	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	mcq	{"title": "Who can write competitive exams in India", "options": [{"id": "27f96bad-193d-44d7-941f-28cc7f254d4c", "text": "Indians", "isCorrect": true}, {"id": "e3966e77-ab80-4675-850a-e0a568203099", "text": "Foreign Citizens", "isCorrect": false}, {"id": "31ebb100-f9f0-41a4-9775-100bba0f6602", "text": "Both Indians and Foreign Citizens", "isCorrect": false}], "explanation": "Only Indians are allowed to take roles in the government roles in India"}	easy	{}	2026-03-02 08:05:29.08	2026-03-02 08:05:29.08	f
81c7f477-ecb1-4b1a-bbe4-5e5734f1e9b2	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	mcq	{"title": "Do you need a credit score to appear for Competitive Exams", "options": [{"id": "a4fbdc9a-08bd-4694-abb0-d1dbcb353fab", "text": "Yes", "isCorrect": true}, {"id": "3375151c-2fd0-4d02-abcc-7fccc5abb34d", "text": "No", "isCorrect": false}], "description": "Credit Scores are your educational scores from Schools and Colleges."}	medium	{}	2026-03-03 06:37:22.106	2026-03-03 06:37:22.106	f
\.


--
-- Data for Name: RevisionLog; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RevisionLog" (id, "tenantId", module, "entityId", action, "userId", "userName", details, "createdAt") FROM stdin;
893d6de4-a5c5-4c06-b0f8-866efc8fe3e0	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	batches	914fb804-3a98-47c8-99f6-0ef586ad89e5	archived	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"name": "RBI Feb 2026"}	2026-03-03 13:36:10.895
91a93373-81d5-427b-9cfc-f84568943db4	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	tests	cc554de2-a30d-461d-bd11-1a24cbbe27af	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"title": "Practice test", "status": "published"}	2026-03-03 14:02:07.257
202c7a5a-b3f8-4f49-b98c-8b5e14064faa	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	tests	cc554de2-a30d-461d-bd11-1a24cbbe27af	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"title": "Practice test", "status": "published"}	2026-03-03 14:02:20.764
44f6cec3-77f8-4297-a376-750ce55329f0	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	tests	cc554de2-a30d-461d-bd11-1a24cbbe27af	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"title": "Practice test", "status": "published"}	2026-03-03 14:42:45.346
91dec5da-7f35-4ef9-b568-a045b015a2df	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	tests	cc554de2-a30d-461d-bd11-1a24cbbe27af	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"title": "Practice test", "status": "published"}	2026-03-03 14:53:34.667
87fde884-86a4-46eb-a4f5-8adc913b89be	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	tests	cc554de2-a30d-461d-bd11-1a24cbbe27af	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"title": "Practice test", "status": "published"}	2026-03-03 14:53:39.567
a8984452-3920-4de5-9165-c6cb03862ea9	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	tests	cc554de2-a30d-461d-bd11-1a24cbbe27af	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"title": "Practice test", "status": "published"}	2026-03-03 14:53:43.87
0d6b2e4e-7dd7-4187-9cda-67c19e055b31	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	tests	cc554de2-a30d-461d-bd11-1a24cbbe27af	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"title": "Practice test", "status": "published"}	2026-03-03 14:53:49.079
4fa22bb4-53eb-48a4-9ed5-0f39e295beeb	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	tests	cc554de2-a30d-461d-bd11-1a24cbbe27af	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"title": "Practice test", "status": "published"}	2026-03-03 15:05:17.231
3dd70049-5add-4cb5-bf7b-607fc1d8fe3f	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	tests	cc554de2-a30d-461d-bd11-1a24cbbe27af	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"title": "Practice test", "status": "published"}	2026-03-03 15:05:25.592
35706c3d-f646-4d62-8253-1d6d0e6b72e6	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	tests	cc554de2-a30d-461d-bd11-1a24cbbe27af	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"title": "Practice test", "status": "published"}	2026-03-03 15:26:55.294
d217511d-784c-402c-a011-2ccbb15b715e	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	tests	cc554de2-a30d-461d-bd11-1a24cbbe27af	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"title": "Practice test", "status": "published"}	2026-03-03 15:27:00.523
c750e336-45f5-4410-a7e6-0a548450f47b	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	students	f200fdd1-6b46-488e-bacb-dd67c3454a34	updated	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"name": "Parthiban", "email": "student@example.com", "isActive": true}	2026-03-03 15:35:05.307
858fb45e-ce5a-4265-98c4-db82486fcc0b	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	students	f6c484ad-9695-46c8-9f4a-89dccd321752	created	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	Admin User	{"name": "Prem C", "email": "premananthc@gmail.com"}	2026-03-05 12:41:35.266
\.


--
-- Data for Name: RoleDefinition; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."RoleDefinition" (id, "tenantId", "roleKey", "displayName", permissions, "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: SchedulerNote; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."SchedulerNote" (id, "batchId", date, content, "createdBy", "createdAt", "updatedAt") FROM stdin;
820e7986-c39f-497b-80ec-29014c0452e8	914fb804-3a98-47c8-99f6-0ef586ad89e5	2026-02-23	Prepare for Practice test	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	2026-02-22 15:10:13.064	2026-02-22 15:10:40.696
\.


--
-- Data for Name: Submission; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Submission" (id, "attemptId", "questionId", code, language, "selectedOptionId", status, score, "aiRatings", output, "errorMessage", "createdAt", "updatedAt") FROM stdin;
e69c5870-6cf8-4c76-baa3-bc8b54b0ed10	98843b9b-0673-4cb1-9501-e89b073294fd	0b6d8577-714b-44a0-b59b-251af9e4f0ce	\N	\N	\N	pending	\N	\N	\N	\N	2026-02-17 10:05:04.149	2026-02-17 10:05:04.149
8f842993-df89-42d8-a470-e6d92a589db0	cf3cf0e7-34df-4801-b4d2-f198db59c633	0b6d8577-714b-44a0-b59b-251af9e4f0ce	\N	\N	\N	pending	\N	\N	\N	\N	2026-02-17 10:17:14.124	2026-02-17 10:17:14.124
\.


--
-- Data for Name: Tenant; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Tenant" (id, name, slug, "planId", domain, status, "brandingConfig", "featureFlags", "createdAt", "updatedAt") FROM stdin;
5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	Default Tenant	default	\N	\N	active	{}	{"mcq": true, "coding": true}	2026-02-17 09:59:11.615	2026-02-17 09:59:11.615
\.


--
-- Data for Name: Test; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."Test" (id, "tenantId", title, type, status, config, schedule, "createdAt", "updatedAt", difficulty) FROM stdin;
894ee9f8-b313-4281-be0f-345fa4bb1721	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	Sample Coding Test	coding	published	{"attemptLimit": 3, "partialScoring": true, "durationMinutes": 60, "shuffleQuestions": false, "aiFeedbackEnabled": true, "proctoringEnabled": false, "showResultsImmediately": true}	\N	2026-02-17 09:59:11.969	2026-02-17 09:59:11.969	\N
b4822bef-9152-44b0-b61c-4c0504cef90c	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	Sample test 1	mcq	draft	{"attemptLimit": 3, "partialScoring": true, "durationMinutes": 60, "shuffleQuestions": false, "aiFeedbackEnabled": false, "proctoringEnabled": false, "showResultsImmediately": true}	\N	2026-03-02 07:56:01.921	2026-03-02 07:56:01.921	easy
cc554de2-a30d-461d-bd11-1a24cbbe27af	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	Practice test	mcq	published	{"attemptLimit": 3, "partialScoring": false, "passPercentage": 50, "durationMinutes": 5, "questionWeights": {}, "shuffleQuestions": true, "aiFeedbackEnabled": false, "proctoringEnabled": false, "scoreDistribution": "equal", "showResultsImmediately": true}	\N	2026-03-02 08:04:17.136	2026-03-03 15:27:00.516	easy
\.


--
-- Data for Name: TestAllocation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TestAllocation" (id, "userId", "testId", "variantId", "assignedBy", "assignedAt") FROM stdin;
f99e9498-4400-49c9-901b-43f5051e04ff	f200fdd1-6b46-488e-bacb-dd67c3454a34	894ee9f8-b313-4281-be0f-345fa4bb1721	\N	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	2026-03-02 07:15:36.936
1e5556c4-1d58-4470-a49d-52d7ffccb2b5	f200fdd1-6b46-488e-bacb-dd67c3454a34	cc554de2-a30d-461d-bd11-1a24cbbe27af	00edb2b9-c3b9-4876-a4a1-ff35e8a53734	997dd34c-3b1d-4da5-8ae2-6648b5b1b510	2026-03-02 08:05:48.438
\.


--
-- Data for Name: TestCase; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TestCase" (id, "questionId", input, "expectedOutput", "isPublic", weight, "createdAt") FROM stdin;
a118516f-7bb1-4040-b6bd-caa2a399539f	0b6d8577-714b-44a0-b59b-251af9e4f0ce	1 2	3	t	1	2026-02-17 09:59:11.964
548ba13e-c22b-4e94-be28-871100b678df	0b6d8577-714b-44a0-b59b-251af9e4f0ce	-1 1	0	f	1	2026-02-17 09:59:11.964
\.


--
-- Data for Name: TestQuestion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TestQuestion" (id, "testId", "questionId", "order", "variantId") FROM stdin;
8578943f-b485-4cb3-b821-35ff7549cd5e	894ee9f8-b313-4281-be0f-345fa4bb1721	0b6d8577-714b-44a0-b59b-251af9e4f0ce	0	\N
27d9fd6d-a557-4ad9-99f9-f9654f8e25af	cc554de2-a30d-461d-bd11-1a24cbbe27af	15495a8a-7ff3-4263-8357-c72cb18a7974	0	\N
3676b96f-b943-43d9-8d76-b922971b0c55	cc554de2-a30d-461d-bd11-1a24cbbe27af	81c7f477-ecb1-4b1a-bbe4-5e5734f1e9b2	1	\N
\.


--
-- Data for Name: TestVariant; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."TestVariant" (id, "testId", name, difficulty, "createdAt") FROM stdin;
00edb2b9-c3b9-4876-a4a1-ff35e8a53734	cc554de2-a30d-461d-bd11-1a24cbbe27af	Easy Practice	easy	2026-03-03 06:38:12.821
75552a05-9c51-470b-badc-527e644cf598	cc554de2-a30d-461d-bd11-1a24cbbe27af	Medium Practice	medium	2026-03-03 06:38:26.985
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."User" (id, "tenantId", email, "passwordHash", name, role, "cohortIds", "isActive", "createdAt", "updatedAt", address, "phoneNumber") FROM stdin;
f200fdd1-6b46-488e-bacb-dd67c3454a34	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	student@example.com	$2b$12$5PGTfSiDBMArZ6gB.Hvo2uPtH6RW8VUv2lvOLiuXTGlo59O7eXm7e	Parthiban	student	{}	t	2026-02-17 09:59:11.96	2026-03-03 15:35:05.302	\N	\N
997dd34c-3b1d-4da5-8ae2-6648b5b1b510	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	admin@example.com	$2b$12$ePk3k2hIOg7RaV1Um/abMeW2SJ5LbLmsASXLLfGIXmrZW7wJE5O8K	Admin User	super_admin	{}	t	2026-02-17 09:59:11.787	2026-02-17 09:59:11.787	\N	\N
f6c484ad-9695-46c8-9f4a-89dccd321752	5b98c9a0-1a2f-4a01-a58f-6a2b0adf3ae5	premananthc@gmail.com	$2a$12$0kmuYdhNMEastqu4/mANF.ouU1wM9RU1UkVaB3EwUtgzOpIJ4ukm6	Prem C	student	{}	t	2026-03-05 12:41:35.257	2026-03-05 12:41:35.257	Chennai	+919500802651
\.


--
-- Name: ActivitySubmission ActivitySubmission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivitySubmission"
    ADD CONSTRAINT "ActivitySubmission_pkey" PRIMARY KEY (id);


--
-- Name: AssignmentTest AssignmentTest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentTest"
    ADD CONSTRAINT "AssignmentTest_pkey" PRIMARY KEY (id);


--
-- Name: Assignment Assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_pkey" PRIMARY KEY (id);


--
-- Name: Attempt Attempt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attempt"
    ADD CONSTRAINT "Attempt_pkey" PRIMARY KEY (id);


--
-- Name: BatchMember BatchMember_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchMember"
    ADD CONSTRAINT "BatchMember_pkey" PRIMARY KEY (id);


--
-- Name: BatchScheduleEvent BatchScheduleEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchScheduleEvent"
    ADD CONSTRAINT "BatchScheduleEvent_pkey" PRIMARY KEY (id);


--
-- Name: BatchTestAssignment BatchTestAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchTestAssignment"
    ADD CONSTRAINT "BatchTestAssignment_pkey" PRIMARY KEY (id);


--
-- Name: BatchVideo BatchVideo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchVideo"
    ADD CONSTRAINT "BatchVideo_pkey" PRIMARY KEY (id);


--
-- Name: Batch Batch_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Batch"
    ADD CONSTRAINT "Batch_pkey" PRIMARY KEY (id);


--
-- Name: CourseActivity CourseActivity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseActivity"
    ADD CONSTRAINT "CourseActivity_pkey" PRIMARY KEY (id);


--
-- Name: CourseAssignment CourseAssignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseAssignment"
    ADD CONSTRAINT "CourseAssignment_pkey" PRIMARY KEY (id);


--
-- Name: CourseChapter CourseChapter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseChapter"
    ADD CONSTRAINT "CourseChapter_pkey" PRIMARY KEY (id);


--
-- Name: CourseEvaluation CourseEvaluation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseEvaluation"
    ADD CONSTRAINT "CourseEvaluation_pkey" PRIMARY KEY (id);


--
-- Name: CourseMaterial CourseMaterial_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseMaterial"
    ADD CONSTRAINT "CourseMaterial_pkey" PRIMARY KEY (id);


--
-- Name: CourseTopic CourseTopic_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseTopic"
    ADD CONSTRAINT "CourseTopic_pkey" PRIMARY KEY (id);


--
-- Name: Course Course_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_pkey" PRIMARY KEY (id);


--
-- Name: Enquiry Enquiry_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Enquiry"
    ADD CONSTRAINT "Enquiry_pkey" PRIMARY KEY (id);


--
-- Name: Invite Invite_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invite"
    ADD CONSTRAINT "Invite_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Question Question_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Question"
    ADD CONSTRAINT "Question_pkey" PRIMARY KEY (id);


--
-- Name: RevisionLog RevisionLog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RevisionLog"
    ADD CONSTRAINT "RevisionLog_pkey" PRIMARY KEY (id);


--
-- Name: RoleDefinition RoleDefinition_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."RoleDefinition"
    ADD CONSTRAINT "RoleDefinition_pkey" PRIMARY KEY (id);


--
-- Name: SchedulerNote SchedulerNote_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulerNote"
    ADD CONSTRAINT "SchedulerNote_pkey" PRIMARY KEY (id);


--
-- Name: Submission Submission_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_pkey" PRIMARY KEY (id);


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: TestAllocation TestAllocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestAllocation"
    ADD CONSTRAINT "TestAllocation_pkey" PRIMARY KEY (id);


--
-- Name: TestCase TestCase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestCase"
    ADD CONSTRAINT "TestCase_pkey" PRIMARY KEY (id);


--
-- Name: TestQuestion TestQuestion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestQuestion"
    ADD CONSTRAINT "TestQuestion_pkey" PRIMARY KEY (id);


--
-- Name: TestVariant TestVariant_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestVariant"
    ADD CONSTRAINT "TestVariant_pkey" PRIMARY KEY (id);


--
-- Name: Test Test_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Test"
    ADD CONSTRAINT "Test_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: ActivitySubmission_activityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ActivitySubmission_activityId_idx" ON public."ActivitySubmission" USING btree ("activityId");


--
-- Name: ActivitySubmission_activityId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ActivitySubmission_activityId_userId_key" ON public."ActivitySubmission" USING btree ("activityId", "userId");


--
-- Name: AssignmentTest_assignmentId_testId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AssignmentTest_assignmentId_testId_key" ON public."AssignmentTest" USING btree ("assignmentId", "testId");


--
-- Name: BatchMember_batchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchMember_batchId_idx" ON public."BatchMember" USING btree ("batchId");


--
-- Name: BatchMember_batchId_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BatchMember_batchId_userId_key" ON public."BatchMember" USING btree ("batchId", "userId");


--
-- Name: BatchMember_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchMember_userId_idx" ON public."BatchMember" USING btree ("userId");


--
-- Name: BatchScheduleEvent_batchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchScheduleEvent_batchId_idx" ON public."BatchScheduleEvent" USING btree ("batchId");


--
-- Name: BatchScheduleEvent_startAt_endAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchScheduleEvent_startAt_endAt_idx" ON public."BatchScheduleEvent" USING btree ("startAt", "endAt");


--
-- Name: BatchTestAssignment_batchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchTestAssignment_batchId_idx" ON public."BatchTestAssignment" USING btree ("batchId");


--
-- Name: BatchTestAssignment_batchId_testId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "BatchTestAssignment_batchId_testId_key" ON public."BatchTestAssignment" USING btree ("batchId", "testId");


--
-- Name: BatchTestAssignment_testId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchTestAssignment_testId_idx" ON public."BatchTestAssignment" USING btree ("testId");


--
-- Name: BatchVideo_batchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "BatchVideo_batchId_idx" ON public."BatchVideo" USING btree ("batchId");


--
-- Name: Batch_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Batch_tenantId_idx" ON public."Batch" USING btree ("tenantId");


--
-- Name: CourseActivity_topicId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseActivity_topicId_idx" ON public."CourseActivity" USING btree ("topicId");


--
-- Name: CourseAssignment_batchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseAssignment_batchId_idx" ON public."CourseAssignment" USING btree ("batchId");


--
-- Name: CourseAssignment_courseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseAssignment_courseId_idx" ON public."CourseAssignment" USING btree ("courseId");


--
-- Name: CourseAssignment_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseAssignment_tenantId_idx" ON public."CourseAssignment" USING btree ("tenantId");


--
-- Name: CourseAssignment_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseAssignment_userId_idx" ON public."CourseAssignment" USING btree ("userId");


--
-- Name: CourseChapter_courseId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseChapter_courseId_idx" ON public."CourseChapter" USING btree ("courseId");


--
-- Name: CourseEvaluation_testId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseEvaluation_testId_idx" ON public."CourseEvaluation" USING btree ("testId");


--
-- Name: CourseEvaluation_topicId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseEvaluation_topicId_idx" ON public."CourseEvaluation" USING btree ("topicId");


--
-- Name: CourseMaterial_topicId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseMaterial_topicId_idx" ON public."CourseMaterial" USING btree ("topicId");


--
-- Name: CourseTopic_chapterId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "CourseTopic_chapterId_idx" ON public."CourseTopic" USING btree ("chapterId");


--
-- Name: Enquiry_status_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Enquiry_status_createdAt_idx" ON public."Enquiry" USING btree (status, "createdAt");


--
-- Name: Invite_tenantId_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invite_tenantId_email_idx" ON public."Invite" USING btree ("tenantId", email);


--
-- Name: Invite_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Invite_token_idx" ON public."Invite" USING btree (token);


--
-- Name: Invite_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Invite_token_key" ON public."Invite" USING btree (token);


--
-- Name: Notification_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_tenantId_idx" ON public."Notification" USING btree ("tenantId");


--
-- Name: Notification_userId_isRead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Notification_userId_isRead_idx" ON public."Notification" USING btree ("userId", "isRead");


--
-- Name: RevisionLog_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RevisionLog_createdAt_idx" ON public."RevisionLog" USING btree ("createdAt");


--
-- Name: RevisionLog_tenantId_module_entityId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RevisionLog_tenantId_module_entityId_idx" ON public."RevisionLog" USING btree ("tenantId", module, "entityId");


--
-- Name: RoleDefinition_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "RoleDefinition_tenantId_idx" ON public."RoleDefinition" USING btree ("tenantId");


--
-- Name: RoleDefinition_tenantId_roleKey_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "RoleDefinition_tenantId_roleKey_key" ON public."RoleDefinition" USING btree ("tenantId", "roleKey");


--
-- Name: SchedulerNote_batchId_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "SchedulerNote_batchId_date_key" ON public."SchedulerNote" USING btree ("batchId", date);


--
-- Name: SchedulerNote_batchId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "SchedulerNote_batchId_idx" ON public."SchedulerNote" USING btree ("batchId");


--
-- Name: Submission_attemptId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Submission_attemptId_idx" ON public."Submission" USING btree ("attemptId");


--
-- Name: Submission_attemptId_questionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Submission_attemptId_questionId_key" ON public."Submission" USING btree ("attemptId", "questionId");


--
-- Name: Tenant_domain_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_domain_key" ON public."Tenant" USING btree (domain);


--
-- Name: Tenant_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree (slug);


--
-- Name: TestAllocation_testId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestAllocation_testId_idx" ON public."TestAllocation" USING btree ("testId");


--
-- Name: TestAllocation_userId_testId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TestAllocation_userId_testId_key" ON public."TestAllocation" USING btree ("userId", "testId");


--
-- Name: TestCase_questionId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestCase_questionId_idx" ON public."TestCase" USING btree ("questionId");


--
-- Name: TestQuestion_testId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestQuestion_testId_idx" ON public."TestQuestion" USING btree ("testId");


--
-- Name: TestQuestion_testId_questionId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TestQuestion_testId_questionId_key" ON public."TestQuestion" USING btree ("testId", "questionId");


--
-- Name: TestQuestion_variantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestQuestion_variantId_idx" ON public."TestQuestion" USING btree ("variantId");


--
-- Name: TestVariant_testId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "TestVariant_testId_idx" ON public."TestVariant" USING btree ("testId");


--
-- Name: User_tenantId_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_tenantId_email_key" ON public."User" USING btree ("tenantId", email);


--
-- Name: User_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_tenantId_idx" ON public."User" USING btree ("tenantId");


--
-- Name: ActivitySubmission ActivitySubmission_activityId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivitySubmission"
    ADD CONSTRAINT "ActivitySubmission_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES public."CourseActivity"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ActivitySubmission ActivitySubmission_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ActivitySubmission"
    ADD CONSTRAINT "ActivitySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AssignmentTest AssignmentTest_assignmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentTest"
    ADD CONSTRAINT "AssignmentTest_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."Assignment"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AssignmentTest AssignmentTest_testId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AssignmentTest"
    ADD CONSTRAINT "AssignmentTest_testId_fkey" FOREIGN KEY ("testId") REFERENCES public."Test"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Assignment Assignment_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Assignment"
    ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attempt Attempt_testId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attempt"
    ADD CONSTRAINT "Attempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES public."Test"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attempt Attempt_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attempt"
    ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Attempt Attempt_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Attempt"
    ADD CONSTRAINT "Attempt_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public."TestVariant"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BatchMember BatchMember_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchMember"
    ADD CONSTRAINT "BatchMember_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public."Batch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BatchMember BatchMember_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchMember"
    ADD CONSTRAINT "BatchMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BatchScheduleEvent BatchScheduleEvent_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchScheduleEvent"
    ADD CONSTRAINT "BatchScheduleEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public."Batch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BatchScheduleEvent BatchScheduleEvent_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchScheduleEvent"
    ADD CONSTRAINT "BatchScheduleEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BatchTestAssignment BatchTestAssignment_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchTestAssignment"
    ADD CONSTRAINT "BatchTestAssignment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public."Batch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BatchTestAssignment BatchTestAssignment_testId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchTestAssignment"
    ADD CONSTRAINT "BatchTestAssignment_testId_fkey" FOREIGN KEY ("testId") REFERENCES public."Test"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BatchVideo BatchVideo_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchVideo"
    ADD CONSTRAINT "BatchVideo_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public."Batch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: BatchVideo BatchVideo_uploadedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."BatchVideo"
    ADD CONSTRAINT "BatchVideo_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Batch Batch_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Batch"
    ADD CONSTRAINT "Batch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseActivity CourseActivity_topicId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseActivity"
    ADD CONSTRAINT "CourseActivity_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES public."CourseTopic"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseAssignment CourseAssignment_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseAssignment"
    ADD CONSTRAINT "CourseAssignment_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public."Batch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseAssignment CourseAssignment_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseAssignment"
    ADD CONSTRAINT "CourseAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseAssignment CourseAssignment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseAssignment"
    ADD CONSTRAINT "CourseAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseAssignment CourseAssignment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseAssignment"
    ADD CONSTRAINT "CourseAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseChapter CourseChapter_courseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseChapter"
    ADD CONSTRAINT "CourseChapter_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseEvaluation CourseEvaluation_testId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseEvaluation"
    ADD CONSTRAINT "CourseEvaluation_testId_fkey" FOREIGN KEY ("testId") REFERENCES public."Test"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: CourseEvaluation CourseEvaluation_topicId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseEvaluation"
    ADD CONSTRAINT "CourseEvaluation_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES public."CourseTopic"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseMaterial CourseMaterial_topicId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseMaterial"
    ADD CONSTRAINT "CourseMaterial_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES public."CourseTopic"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: CourseTopic CourseTopic_chapterId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."CourseTopic"
    ADD CONSTRAINT "CourseTopic_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES public."CourseChapter"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Course Course_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Course"
    ADD CONSTRAINT "Course_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invite Invite_invitedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invite"
    ADD CONSTRAINT "Invite_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invite Invite_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invite"
    ADD CONSTRAINT "Invite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Invite Invite_testId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invite"
    ADD CONSTRAINT "Invite_testId_fkey" FOREIGN KEY ("testId") REFERENCES public."Test"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Invite Invite_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Invite"
    ADD CONSTRAINT "Invite_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public."TestVariant"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Question Question_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Question"
    ADD CONSTRAINT "Question_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SchedulerNote SchedulerNote_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulerNote"
    ADD CONSTRAINT "SchedulerNote_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public."Batch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SchedulerNote SchedulerNote_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SchedulerNote"
    ADD CONSTRAINT "SchedulerNote_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Submission Submission_attemptId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES public."Attempt"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Submission Submission_questionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Submission"
    ADD CONSTRAINT "Submission_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES public."Question"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TestAllocation TestAllocation_testId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestAllocation"
    ADD CONSTRAINT "TestAllocation_testId_fkey" FOREIGN KEY ("testId") REFERENCES public."Test"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TestAllocation TestAllocation_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestAllocation"
    ADD CONSTRAINT "TestAllocation_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public."TestVariant"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TestCase TestCase_questionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestCase"
    ADD CONSTRAINT "TestCase_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES public."Question"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TestQuestion TestQuestion_questionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestQuestion"
    ADD CONSTRAINT "TestQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES public."Question"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TestQuestion TestQuestion_testId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestQuestion"
    ADD CONSTRAINT "TestQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES public."Test"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TestQuestion TestQuestion_variantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestQuestion"
    ADD CONSTRAINT "TestQuestion_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES public."TestVariant"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: TestVariant TestVariant_testId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TestVariant"
    ADD CONSTRAINT "TestVariant_testId_fkey" FOREIGN KEY ("testId") REFERENCES public."Test"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Test Test_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Test"
    ADD CONSTRAINT "Test_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict RVZx4bi1Ohe2cKWBfaIFb7hpglRUMSxU7ffSrG2whXqs9YgJfS8gDuzURLgGyh9

