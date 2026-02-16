# Business Requirements Document (BRD)
# White-label SaaS Mock Test & Coding Assessment Platform

## Document Control

| Field | Value |
|-------|-------|
| Document Name | BRD - White-label SaaS Mock Test Platform |
| Version | v2.1 |
| Date | 15 Feb 2026 |
| Owner | Platform Product & Engineering |
| Confidentiality | Confidential - For internal and client evaluation use |

---

## 1. Executive Summary

This document defines the business requirements for a multi-tenant, white-label SaaS platform that enables students and job seekers to practice coding assessments and mock tests. The platform will also provide MCQ-based preparation for bank and other competitive exams in India. The solution includes a student-facing application, a client admin application, and a platform-operator (super admin) console.

Version 2 additions: (a) configurable proctoring per test (live human proctoring and/or webcam monitoring), and (b) Phase 2 hybrid mobile apps.

---

## 2. Glossary

| Term | Definition |
|------|------------|
| **Tenant** | A client organization (training institute, college, coaching center, corporate) that uses the platform under a subscription. Each tenant has isolated data, branding, and configuration. |
| **Cohort** | A group of students/candidates grouped for a specific course, batch, or test campaign. Used for targeted tests and reporting. |
| **Sandbox** | Isolated, resource-limited execution environment for running user-submitted code. No outbound network access; strict CPU/memory/time limits. |
| **Proctoring Mode** | The type of proctoring enabled for a test: (a) live human proctoring, (b) webcam monitoring (automated), or (c) both. |
| **Attempt** | A single instance of a student taking a test from start to submission. An attempt may have multiple question submissions. |
| **Hidden Test Case** | Test cases not visible to the student; used for final scoring. Contrast with sample/public test cases. |
| **Sample Test Case** | Test cases visible to the student with input/output examples; used for "Run" during practice. May be a subset of hidden cases or distinct. |
| **Public Test Case** | Same as sample—visible I/O for student validation before submit. |
| **Feature Flag** | Configuration toggle that enables/disables a capability (e.g., coding, MCQ, proctoring) for a tenant or test. |
| **Entitlement** | A tenant's right to use a feature or resource based on their plan (e.g., proctoring minutes, test limits). |

---

## 3. Acronyms

| Acronym | Full Form |
|---------|-----------|
| BRD | Business Requirements Document |
| LMS | Learning Management System |
| NFR | Non-Functional Requirement |
| OWASP | Open Web Application Security Project |
| ASVS | Application Security Verification Standard |
| TLS | Transport Layer Security |
| WAF | Web Application Firewall |
| CSV | Comma-Separated Values |
| PDF | Portable Document Format |
| GST | Goods and Services Tax (India) |
| MVP | Minimum Viable Product |
| NPS | Net Promoter Score |
| SLA | Service Level Agreement |
| API | Application Programming Interface |
| JWT | JSON Web Token |
| WCAG | Web Content Accessibility Guidelines |

---

## 4. Business Objectives

- Offer a robust practice and mock test environment for coding skills evaluation with automated grading and AI-based insights.
- Provide a white-label SaaS model enabling clients (training institutes, colleges, coaching centers, corporates) to launch branded sites.
- Enable monetization via subscriptions and/or pay-per-test using Stripe/Razorpay.
- Deliver enterprise-grade security, tenant isolation, auditability, and compliance-by-design.

---

## 5. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Student NPS | ≥ 40 | Quarterly survey of active students |
| Tenant Churn (monthly) | < 5% | Tenants canceling vs active base |
| p95 API Latency | < 300 ms | For standard CRUD (excluding code execution) |
| Code Execution p95 | < 10 s | Per submission evaluation time |
| Platform Uptime | ≥ 99.5% | Monthly availability for core services |
| Proctoring Session Success Rate | ≥ 98% | Sessions completing without technical failure |
| Payment Success Rate | ≥ 99% | Successful webhook processing post-payment |

---

## 6. In Scope

### 6.1 Phase 1 (Web MVP)

- Full-fledged LMS features (scoped in Section 9.2) such as attendance, assignments, and course authoring.
- Student web app: sign-up/login, profile, practice, attempt tests, coding editor, submissions, results, review.
- Admin web app (per tenant): branding, user management, question bank, test creation, proctoring configuration (settings only—no live/webcam in Phase 1), reporting.
- Platform operator console: tenant onboarding, plans, feature flags, abuse monitoring, global settings.
- Coding evaluation: compile/run in sandbox with test cases, scoring, partial scoring, time/memory limits. Supported languages: Python 3.x, Java 11+, C++17, JavaScript (Node.js 18+).
- AI-based feedback: code quality signals, hints, skill rubric scores (configurable by platform; tenant enables per test), plagiarism signals (optional).
- **AI Ratings per Student per Test**: For each test attempt, the system generates AI-derived ratings across dimensions: (a) Code Quality, (b) Problem-Solving Approach, (c) Efficiency (time/space), (d) Correctness. Ratings are stored per-question and aggregated at attempt level; displayed in student result review and admin analytics.
- Stripe/Razorpay payments: plans, coupons, invoices, webhooks, entitlement management. Primary gateway for India: Razorpay; Stripe for international. Tenant selects gateway at onboarding based on geography.
- Reporting: per attempt, per test, per cohort, export to CSV/PDF.
- MCQ exam preparation (banking/competitive exams): question bank, timed exams, explanations, analytics.

### 6.2 Phase 1.5 (Proctoring MVP)

- Proctoring enabled: webcam monitoring and/or live human proctoring per test configuration.
- Admin configures proctoring per test; students undergo pre-checks and consent.
- Proctor dashboard for live monitoring; event logging and audit trail.
- Phase 1 provides "proctoring-ready" baseline: proctoring settings UI, role assignment, configuration stored—but no active webcam/live proctoring until Phase 1.5.

### 6.3 Phase 2 (Hybrid Mobile Apps)

- Hybrid mobile app for students (Android first, then iOS): attempt tests, view results, notifications, **limited** practice (run sample cases; full editor experience on web recommended for complex coding).
- Mobile-friendly proctoring for supported tests where feasible, or explicit restrictions per test (e.g., "Web only" flag).
- Admin access remains web-first; limited admin approvals may be provided on mobile if needed.

### 6.4 Future Phases (Indicative)

- Live classes / cohorts integration (optional).
- Marketplace of test packs (optional).

---

## 7. Out of Scope (for v2.1)

- Native (non-hybrid) mobile apps in Phase 2.
- Guaranteed offline test-taking on mobile (online-only in Phase 2 unless explicitly added later).
- High-stakes exam certification compliance unless separately contracted (platform supports proctoring but is not a certifying authority).

---

## 8. Stakeholders and Roles

| Role | Description |
|------|-------------|
| **Student/Candidate** | Practices and attempts coding/MCQ tests. |
| **Tenant Admin (Client)** | Configures white-label branding, manages tests, users, and reporting. |
| **Proctor (Tenant role)** | Monitors proctored sessions and records incidents. |
| **Platform Operator (Super Admin)** | Manages tenants, subscriptions, global policies, and incident response. |
| **Content Author/Reviewer (Tenant role)** | Creates questions, test cases, solutions, and explanations. |

---

## 9. Assumptions and Constraints

- Multi-tenant architecture must prevent data leakage across tenants.
- Coding execution must run in isolated sandboxes with strict resource limits.
- Proctoring requires explicit candidate consent and clear privacy disclosures.
- Stripe/Razorpay is the single source of truth for payment status; platform entitlements sync via webhooks.
- Initial target geography is India; support for multiple time zones and localization (e.g., Hindi, regional languages) is required.

---

## 10. Personas

### 10.1 Student

Wants realistic interview-style coding practice, fast feedback, and progress tracking.

### 10.2 Tenant Admin (Client)

Wants a branded portal to run tests for their cohorts, configure pricing, and track outcomes.

### 10.3 Proctor

Wants a dashboard to monitor candidate sessions, flag violations, and generate incident reports.

### 10.4 Platform Operator

Wants to onboard tenants, ensure compliance/security, and maintain platform reliability.

---

## 11. High-Level User Journeys

### 11.1 Student Journey (Coding)

1. Student signs up, verifies email/phone (optional), and completes profile.
2. Student selects a practice set or scheduled test.
3. Student reads problem, writes code, runs sample tests (public test cases with visible I/O), and submits.
4. System evaluates submission against hidden test cases and generates AI feedback.
5. Student views score, test case status, time/memory usage, AI ratings, and suggestions; repeats for improvement.

### 11.2 Student Journey (Proctored Test) – Phase 1.5+

1. Student starts test; system performs proctoring pre-checks (camera/mic permissions if enabled).
2. During test, webcam monitoring and/or live proctoring runs per test configuration.
3. Suspicious events are recorded (e.g., face not detected, multiple faces, tab switch), and proctor may intervene.
4. At completion, results and proctoring summary are available based on tenant policy.

### 11.3 Tenant Journey (White-label)

1. Client signs up for a plan, creates tenant, configures custom domain and branding.
2. Client creates question bank, assembles tests, and sets proctoring requirements per test (Phase 1.5).
3. Client invites candidates or imports users; shares test links.
4. Client monitors live attempts (optional), reviews results and proctoring events, and exports reports.

---

## 12. Functional Requirements

### 12.1 Multi-tenant White-label

- Tenant-level theming: logo, colors, typography, email templates, and login page.
- Custom domain support with automated TLS.
- **Tenant-specific feature flags**: Platform operator defines available flags per plan; tenant admin enables within their plan (e.g., coding on/off, MCQ on/off, proctoring on/off).
- Configurable data retention and export policies per tenant.
- **Tenant onboarding workflow**: Self-serve sign-up → plan selection → payment → tenant creation. Optional: platform approval gate for enterprise plans; trial period (e.g., 14 days) configurable per plan.
- **Tenant data export/portability**: On contract termination, tenant can request full data export (users, tests, attempts, reports) in machine-readable format within 30 days.

### 12.2 LMS Features (Phase 1 Scope)

- **Attendance**: Automated based on login/session for scheduled tests; manual mark-by-admin for live sessions. Session = test attempt start; attendance tied to course/cohort.
- **Assignments**: Grading types—manual (admin review), auto (coding/MCQ), hybrid (auto + manual for open-ended). Deadlines with configurable late submission policy (allow/penalize/block). One assignment can link to one or more tests.
- **Course Authoring**: Module → Chapter → Content structure. Content types: rich text, embedded video (URL), embedded coding problem. Course → Assignment → Test dependency: assignments belong to a course; tests can be attached to assignments.
- **Dependency**: Course (optional) → Assignment → Test. Tests can exist standalone (practice) or within assignments.

### 12.3 Student Application

- Responsive web UI for test discovery, practice, and attempts.
- Coding editor with language selection (Python, Java, C++, JavaScript), auto-save, run (against sample/public test cases), submit, and compilation/runtime output.
- Result review with per-test-case status (pass/fail/timeouts), score breakdown, AI ratings, and explanations (where enabled).
- Profile progress: topic-wise performance, streaks, and recommendations.

### 12.4 Admin Application (Tenant)

- User management: invite/import, roles, groups/cohorts, disable/ban, reset attempts.
- Question bank: coding problems, test cases (public/sample vs hidden), constraints, reference solution, tags, difficulty.
- Test builder: sections, timers, scoring rules (partial scoring: per-test-case weights; all-or-nothing or proportional configurable per question), attempt limits, schedule window, eligibility rules.
- Reporting: dashboards, filters, exports, candidate-level and cohort-level analytics. Real-time for active sessions; batch for historical (refresh: on-demand or scheduled, e.g., daily). Role-based access: admin (full), proctor (proctoring reports), content author (question/test performance only).

### 12.5 Proctoring (Phase 1.5) – Technical Details

- Admin can enable proctoring per test and choose mode: (a) live human proctoring, (b) webcam monitoring, or (c) both.
- Admin can configure: identity check required, camera mandatory, mic required, allowed warnings, auto-terminate thresholds, tab-switch policy, minimum network quality.
- **Minimum browser/device requirements**: Chrome 90+, Firefox 90+, Edge 90+; WebRTC support; camera resolution ≥ 480p; stable broadband. Unsupported devices blocked at test start with clear message.
- **"Repeated looking away" detection**: Frame-based face angle analysis; configurable threshold (e.g., >30° deviation for >5s). False positive handling: configurable sensitivity; human review option for flagged events; appeal workflow for students.
- **Proctoring storage**: Event log (immutable, per attempt); optional video chunks per tenant policy. Retention configurable (e.g., 30/90/365 days or "no recording"—event log only).
- **Recording indicator**: Visible to candidate during test (e.g., red dot, "Recording" label) when recording is enabled.
- Student pre-check flow: device compatibility check, camera/mic permission, environment instructions, consent capture.
- Live proctoring: proctor dashboard, alerts, chat/warn, terminate/lock.
- Proctoring audit trail: immutable event timeline; who intervened and why.
- Privacy controls: consent, recording indicators, configurable retention, secure access (signed URLs, access logging).

### 12.6 Payments and Plans

- **Gateway strategy**: Razorpay primary for India (INR, GST support). Stripe for international tenants or multi-currency. Tenant selects at onboarding; one gateway per tenant.
- Stripe/Razorpay subscriptions and one-time payments; per-tenant plan tiers and add-ons (e.g., proctoring minutes).
- Webhook-driven entitlement updates; grace periods and dunning support.
- Tenant-level invoices and receipts; GST details configurable if required by client.
- **Refund policy**: Platform supports refund initiation; actual policy (eligibility, window) defined per tenant. Platform provides refund API; tenant admin or support initiates.
- **Trial/freemium**: Configurable trial period per plan (e.g., 14 days); freemium tier with limited tests/users if enabled by platform.

### 12.7 AI Feedback and Ratings

- **Skill rubric configuration**: Platform operator defines available rubrics; tenant admin enables and optionally customizes weights per test.
- **AI feedback latency**: Best-effort real-time (<30s target); fallback: queue for batch processing; configurable toggle to disable AI feedback per test if service unavailable.
- **AI ratings**: Code Quality, Problem-Solving, Efficiency, Correctness; per-question and overall; stored with attempt; displayed in results and reports.

---

## 13. Non-Functional Requirements

### 13.1 Security

- Strong tenant isolation, least-privilege access control, and per-tenant encryption boundaries where feasible.
- Sandboxed code execution; no outbound network by default; strict CPU/memory/time limits.
- Secure handling of proctoring media: encryption in transit and at rest; signed URLs; access logging.
- OWASP ASVS-aligned controls: input validation, CSRF/XSS protection, rate limiting, secrets management.
- **Session management**: Idle timeout 30 min (configurable); max 1 concurrent session per user (configurable); forced logout on password change; session invalidation on role change.
- **API authentication**: JWT for web/mobile; OAuth2 for optional SSO; API keys for server-to-server integrations (tenant webhooks, exports).
- **Proctoring media access control**: Only proctor and tenant admin with proctoring role; access logged; retention window enforced; no download by default (stream only).

### 13.2 Performance and Availability

- Target p95 API latency < 300 ms for standard CRUD operations (excluding code execution).
- **Code execution SLA**: p95 evaluation time < 10 s per submission.
- **Concurrent users**: Support up to 500 concurrent users per tenant during scheduled tests; platform scales to 10,000+ concurrent across tenants.
- Scalable judge/execution cluster to support bursts during scheduled tests.
- High availability for core services; graceful degradation when AI feedback is delayed.
- **Database and storage**: Horizontal scaling for read replicas; object storage for media/submissions; retention policies aligned with tenant config.

### 13.3 Compliance and Privacy

- Clear privacy policy, consent management for camera/mic and recordings.
- Configurable retention periods and deletion workflows for candidate data and proctoring recordings.
- Audit logs for admin/proctor actions.
- **Data residency**: Primary data stored in India; cross-border transfer only with tenant consent and compliant mechanisms (e.g., SCCs).
- **Accessibility**: WCAG 2.1 AA target for student and admin web applications.
- **Incident response**: Defined process for breach detection, containment, notification (regulators, tenants, users as applicable), and post-incident review.

---

## 14. Reporting Requirements

- Attempt report: score, time taken, test case breakdown, compiler/runtime outputs, AI feedback summary, AI ratings.
- Cohort analytics: distribution, top skills, question-wise difficulty, completion rates.
- Proctoring report (if enabled): event timeline, violations summary, interventions, recording links (if stored).
- Exports: CSV for raw data; PDF for shareable reports.

---

## 15. Use Cases (Key)

### UC-01: Student attempts a coding test

**Actors:** Student, System

**Preconditions:** Student is authenticated and eligible for the test.

**Main Flow:**

1. Student opens the test and reads instructions.
2. Student writes code in selected language and runs sample cases (public test cases with visible I/O).
3. Student submits solution.
4. System compiles and executes solution in sandbox against hidden test cases.
5. System stores submission, computes score (including partial scoring per rules), and generates AI feedback and ratings.
6. Student views result with score, test case status, AI ratings, and suggestions.

**Alternate / Exception Flows:**

- Compilation error: show error output and allow resubmission if attempts remain.
- Timeout / memory limit: mark relevant test cases and compute partial score.
- AI feedback unavailable: result shows without AI section; feedback queued for later if enabled.

**Postconditions:** Attempt result is available in the student dashboard and admin reporting.

---

### UC-02: Admin configures proctoring for a test (Phase 1.5)

**Actors:** Tenant Admin, System

**Preconditions:** Admin has permissions to edit tests; test exists in draft or editable state; tenant has proctoring entitlement.

**Main Flow:**

1. Admin opens test settings and navigates to Proctoring.
2. Admin selects mode: live, webcam monitoring, or both.
3. Admin configures rule parameters and retention settings.
4. Admin assigns proctor role users (for live proctoring) and saves configuration.
5. System validates configuration and applies to the test schedule.

**Alternate / Exception Flows:**

- Browser/device constraints set: system blocks unsupported devices during test start.
- Retention set to 'no recording': only event logs are stored.

**Postconditions:** Proctoring requirements are enforced when students start the test.

---

### UC-03: Proctor monitors a live session (Phase 1.5)

**Actors:** Proctor, Student, System

**Preconditions:** Test has live proctoring enabled; student has started the test.

**Main Flow:**

1. Proctor logs in and opens the Proctor Dashboard.
2. Proctor selects an active session to view video stream and live alerts.
3. Proctor issues a warning or chat message if suspicious behavior is observed.
4. Proctor optionally pauses or terminates the attempt based on policy.
5. System records interventions in the audit trail.

**Postconditions:** Session ends with proctoring summary attached to the attempt.

---

### UC-04: Tenant launches a white-label site

**Actors:** Tenant Admin, Platform Operator, System

**Preconditions:** Tenant is onboarded and has an active plan.

**Main Flow:**

1. Admin configures branding and custom domain.
2. System issues TLS certificate and validates domain ownership.
3. Admin configures email templates and publishes the site.
4. Students access tenant-branded portal to sign up and take tests.

**Postconditions:** Tenant-branded portal is live and isolated from other tenants.

---

## 16. Phase 1 Acceptance Criteria

| Area | Acceptance Criteria |
|------|---------------------|
| **Auth & Tenant** | Student and admin can sign up, log in, and manage profile. Tenant can be created with branding; custom domain validates and serves over TLS. |
| **Question Bank** | Admin can create coding and MCQ questions; add public and hidden test cases for coding; tag and set difficulty. |
| **Test Builder** | Admin can create tests with sections, timers, scoring rules, schedule, attempt limits. Proctoring settings UI present (configuration only). |
| **Student Test Flow** | Student can discover, start, and complete a coding/MCQ test; run sample cases; submit; view results with score, test cases, AI ratings. |
| **Coding Evaluation** | Submissions compile/run in sandbox; pass/fail per test case; partial scoring; time/memory limits enforced. |
| **AI Feedback** | AI ratings (Code Quality, Problem-Solving, Efficiency, Correctness) generated and displayed per attempt. Graceful degradation when unavailable. |
| **Payments** | Tenant can subscribe via Razorpay (India) or Stripe (international); webhooks update entitlements; invoices generated. |
| **Reporting** | Admin can view attempt, test, and cohort reports; export CSV/PDF. Role-based access enforced. |
| **LMS** | Attendance (session-based), assignments (auto/manual/hybrid), course authoring (modules, chapters, content) functional for Phase 1 scope. |

---

## 17. Phased Roadmap

| Phase | Scope |
|-------|-------|
| **Phase 1** | Web SaaS: coding + MCQ + LMS + reporting + Stripe/Razorpay + AI feedback + AI ratings. Proctoring configuration only (no live/webcam). |
| **Phase 1.5** | Proctoring MVP: webcam monitoring + live proctoring + proctor dashboard for selected tenants. |
| **Phase 2** | Hybrid mobile app for students: test attempts, results, notifications, limited practice, selected proctoring support. |

---

## 18. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Proctoring privacy concerns | Explicit consent, configurable recording, clear disclosures, retention controls. |
| Code execution abuse | Strict sandboxing, rate limits, malware scanning on outputs/artifacts, WAF. |
| Peak load during scheduled exams | Autoscaling execution workers and queue-based evaluation. |
| Third-party payment gateway downtime | Fallback gateway option, queue retries, manual reconciliation workflow. |
| AI service unavailability | Graceful degradation; queue feedback for later; configurable toggle per test. |
| Proctoring false positives | Configurable thresholds; human review workflow; appeal process for students. |
| Tenant custom domain DNS misconfiguration | Clear documentation; validation wizard; support runbook. |

---

## 19. Related Documents

- [Technical Design Document (TDD)](TDD.md) – Architecture, tenant isolation, judge, proctoring pipeline, API design.
- [Requirements Traceability Matrix](REQUIREMENTS-TRACEABILITY-MATRIX.md) – Mapping of requirements to use cases and NFRs.

---

## 20. Implementation Readiness Checklist

Before development starts, ensure:

1. **Prioritized backlog**: Auth → tenant setup → question bank → test builder → student test flow → AI feedback → payments → reporting.
2. **Data model**: Core entities (Tenant, User, Test, Question, Attempt, Submission, ProctoringSession) defined; see TDD.
3. **Integration contracts**: Stripe/Razorpay webhook payloads, idempotency handling documented.
4. **Proctoring compliance**: Legal review for consent forms and privacy notices in target regions.
