# Requirements Traceability Matrix (RTM)
# White-label SaaS Mock Test & Coding Assessment Platform

## Document Control

| Field | Value |
|-------|-------|
| Document Name | Requirements Traceability Matrix |
| Version | v1.0 |
| Date | 15 Feb 2026 |
| Related | [BRD v2.1](BRD-v2.1.md) |

---

## 1. Purpose

This matrix maps functional requirements (FR) and non-functional requirements (NFR) to use cases (UC) and test coverage areas. It supports traceability for compliance, validation, and regression testing.

---

## 2. Requirement IDs

### Functional Requirements (FR)

| ID | Requirement |
|----|-------------|
| FR-01 | Multi-tenant white-label: theming, custom domain, TLS |
| FR-02 | Tenant feature flags (platform defines; tenant enables) |
| FR-03 | Tenant onboarding workflow and data export |
| FR-04 | LMS: Attendance (session-based, manual) |
| FR-05 | LMS: Assignments (auto/manual/hybrid grading, deadlines) |
| FR-06 | LMS: Course authoring (modules, chapters, content) |
| FR-07 | Student app: sign-up, login, profile |
| FR-08 | Student app: test discovery, practice, attempts |
| FR-09 | Coding editor: languages, run, submit, output |
| FR-10 | Result review: score, test cases, AI ratings |
| FR-11 | Admin: user management, roles, cohorts |
| FR-12 | Admin: question bank, test cases (public/hidden) |
| FR-13 | Admin: test builder, scoring, schedule |
| FR-14 | Admin: proctoring configuration (Phase 1.5) |
| FR-15 | Admin: reporting, dashboards, exports |
| FR-16 | Coding evaluation: sandbox, test cases, partial scoring |
| FR-17 | AI feedback: ratings, hints, fallback |
| FR-18 | Payments: Stripe/Razorpay, webhooks, entitlements |
| FR-19 | Proctoring: pre-check, webcam, live, audit (Phase 1.5) |
| FR-20 | MCQ: question bank, timed exams, explanations |

### Non-Functional Requirements (NFR)

| ID | Requirement |
|----|-------------|
| NFR-01 | Tenant isolation; no data leakage |
| NFR-02 | p95 API latency < 300 ms (CRUD) |
| NFR-03 | Code execution p95 < 10 s |
| NFR-04 | Uptime ≥ 99.5% |
| NFR-05 | OWASP ASVS security controls |
| NFR-06 | Session management (timeout, concurrent limits) |
| NFR-07 | Proctoring media: encryption, access control |
| NFR-08 | Data residency (India); configurable retention |
| NFR-09 | WCAG 2.1 AA accessibility |
| NFR-10 | Audit logs for admin/proctor actions |

---

## 3. Use Case Mapping

| Use Case | Title | FRs | NFRs |
|----------|-------|-----|------|
| UC-01 | Student attempts coding test | FR-07, FR-08, FR-09, FR-10, FR-16, FR-17 | NFR-01, NFR-02, NFR-03, NFR-05 |
| UC-02 | Admin configures proctoring | FR-14, FR-19 | NFR-01, NFR-05, NFR-10 |
| UC-03 | Proctor monitors live session | FR-19 | NFR-01, NFR-05, NFR-07, NFR-10 |
| UC-04 | Tenant launches white-label site | FR-01, FR-02, FR-03 | NFR-01, NFR-04 |

---

## 4. FR to Use Case Matrix

| FR | UC-01 | UC-02 | UC-03 | UC-04 |
|----|-------|-------|-------|-------|
| FR-01 | | | | X |
| FR-02 | | | | X |
| FR-03 | | | | X |
| FR-04 | | | | |
| FR-05 | | | | |
| FR-06 | | | | |
| FR-07 | X | | | |
| FR-08 | X | | | |
| FR-09 | X | | | |
| FR-10 | X | | | |
| FR-11 | | | | |
| FR-12 | | | | |
| FR-13 | | | | |
| FR-14 | | X | | |
| FR-15 | | | | |
| FR-16 | X | | | |
| FR-17 | X | | | |
| FR-18 | | | | |
| FR-19 | | X | X | |
| FR-20 | | | | |

---

## 5. NFR to Use Case Matrix

| NFR | UC-01 | UC-02 | UC-03 | UC-04 |
|-----|-------|-------|-------|-------|
| NFR-01 | X | X | X | X |
| NFR-02 | X | | | |
| NFR-03 | X | | | |
| NFR-04 | | | | X |
| NFR-05 | X | X | X | |
| NFR-06 | X | | | |
| NFR-07 | | | X | |
| NFR-08 | | | | |
| NFR-09 | X | X | X | X |
| NFR-10 | | X | X | |

---

## 6. Test Coverage Mapping

| Test Area | Requirements | Priority |
|-----------|--------------|----------|
| Auth & Tenant | FR-01, FR-02, FR-03, FR-07, NFR-01 | P0 |
| Question & Test | FR-12, FR-13, FR-16 | P0 |
| Student Test Flow | FR-08, FR-09, FR-10, FR-16, FR-17, NFR-02, NFR-03 | P0 |
| Admin & Reporting | FR-11, FR-15 | P1 |
| Payments | FR-18 | P1 |
| LMS | FR-04, FR-05, FR-06 | P1 |
| Proctoring | FR-14, FR-19, NFR-07, NFR-10 | P2 |
| Security & Compliance | NFR-05, NFR-06, NFR-08, NFR-09 | P0 |

---

## 7. Coverage Summary

| Category | Total | Mapped to UC | Test Area Assigned |
|----------|-------|--------------|---------------------|
| Functional (FR) | 20 | 12 | 20 |
| Non-Functional (NFR) | 10 | 8 | 10 |
| Use Cases | 4 | - | 4 |

Note: FR-04 through FR-06, FR-11, FR-18, FR-20 support additional user journeys (admin flows, LMS, payments) not explicitly listed in the 4 key use cases. All FRs are assigned to test areas.
