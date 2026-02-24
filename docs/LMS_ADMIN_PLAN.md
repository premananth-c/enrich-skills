# LMS Admin App – Implementation Plan & Tool Recommendations

This document outlines how to turn the current admin app into a full LMS Admin with **Courses**, **Batches**, **Calendar Scheduler**, **Scheduler Notes**, and **Batch Video Uploads**, using **cheap but stable** tools and environments.

---

## 1. Cheapest but Stable Tools & Environments

### 1.1 Database
- **Current:** PostgreSQL via Prisma.
- **Recommendation:** **Keep PostgreSQL.** For cost:
  - **Neon** (neon.tech): Free tier (0.5 GB, 1 branch), then ~$19/mo. Serverless, good for dev/small prod.
  - **Supabase** (supabase.com): Free tier (500 MB, 2 projects). Optional use of Supabase Auth/Storage if you want to consolidate later.
  - **Self‑hosted:** Fly.io Postgres, or a small VPS (Hetzner ~€4/mo, DigitalOcean $6/mo) + managed Postgres or Docker Postgres.
- **Verdict:** Use **Neon** or **Supabase** free tier for stability and minimal cost; move to a small VPS only if you outgrow or need full control.

### 1.2 File Storage (PDFs & Recorded Videos)
- **Need:** Store course PDFs and batch-level recorded videos; serve via URLs (and optionally range requests for video).
- **Recommendations (cheapest first):**
  1. **Cloudflare R2** – S3-compatible, **no egress fees**. Pay for storage and Class B operations. Very cheap for video.
  2. **Backblaze B2** – Low storage cost; egress free to Cloudflare if you front with CF.
  3. **Supabase Storage** – Included in free tier (1 GB); good if you already use Supabase.
  4. **Local filesystem** – For dev only; e.g. `apps/api/uploads` and serve via a simple route. Not for production at scale.
- **Verdict:** **Cloudflare R2** for production (stable, predictable, no egress surprise). Use **local filesystem** in dev. Use one abstraction (e.g. “storage service”) so you can switch.

### 1.3 Calendar / Scheduler
- **Need:** Calendar per batch; events/slots stored in DB; notes per day per batch.
- **Recommendation:** **No external calendar SaaS.** Use:
  - **PostgreSQL** for events and notes (see data model below).
  - **React calendar library** in the admin app, e.g.:
    - **react-big-calendar** (free, widely used) or
    - **FullCalendar** (free for basic use; paid for advanced).
- **Verdict:** **react-big-calendar** or **FullCalendar** + your own API. No recurring cost.

### 1.4 Video Playback
- **Need:** Upload recorded videos at batch level; students (and admin) view them.
- **Recommendation:** Store files in **R2/B2/local**; serve via **signed URLs** or a proxy endpoint that streams (range requests for seeking). Play in browser with **HTML5 `<video>`** or **Video.js** (free). No need for a dedicated “video platform” at first.
- **Optional (if you need transcoding/adaptive streaming later):** Mux.com or Cloudflare Stream (pay per minute). Skip until you have a clear need.

### 1.5 Hosting / Runtime
- **Current:** Node (Fastify) API, React (Vite) admin and student apps.
- **Recommendations:**
  - **Railway** or **Render** – Simple deploy for API + optional static admin/student; free or low-cost tiers.
  - **Vercel** – Admin and student frontends (static/SSR); API can stay on Railway/Render or a small VPS.
  - **Single VPS** (Hetzner, DigitalOcean) – One box for API + Postgres + file storage (local or S3-compatible). Cheapest at ~$6–12/mo if you’re comfortable with ops.
- **Verdict:** **Railway** or **Render** for API + **Vercel** for admin/student for minimal ops; or **one VPS** for lowest cost and full control.

### 1.6 Summary Table

| Need              | Recommended (cheap & stable)     | Alternatives                    |
|-------------------|-----------------------------------|----------------------------------|
| Database          | PostgreSQL (Neon / Supabase free) | Self-hosted on VPS               |
| PDF/Video storage | Cloudflare R2 (prod), local (dev) | Backblaze B2, Supabase Storage   |
| Calendar          | PostgreSQL + react-big-calendar   | FullCalendar                     |
| Video playback    | R2 + signed URL + HTML5/Video.js  | Mux/Cloudflare Stream (later)    |
| Hosting           | Railway/Render + Vercel           | Single VPS (Hetzner/DO)          |

---

## 2. Data Model (Prisma) – Additions & Changes

Below are the model changes needed. Your existing `Course` and `Assignment` stay; we add structure for chapters/topics, batches, calendar, notes, and videos.

### 2.1 Batch & Student Membership
- Add a **Batch** model; link **User** to **Batch** via a join table (many-to-many) so a student can be in multiple batches.
- Keep or phase out `User.cohortIds` once Batch is in use.

```prisma
model Batch {
  id          String   @id @default(uuid())
  tenantId    String
  name        String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant   Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  members  BatchMember[]
  schedules BatchScheduleEvent[]
  notes    SchedulerNote[]
  videos   BatchVideo[]
  courseAssignments CourseAssignment[]  // course assigned to batch
}

model BatchMember {
  id       String   @id @default(uuid())
  batchId  String
  userId   String
  joinedAt DateTime @default(now())

  batch Batch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([batchId, userId])
  @@index([batchId])
  @@index([userId])
}
```

- On **User**, add: `BatchMember[] batchMembers` and remove or deprecate `cohortIds` when you migrate.

### 2.2 Course Structure (Chapters, Topics, Materials, Evaluations)
- Extend **Course** with optional **chapter → topic** hierarchy and support for PDF materials, activities, and evaluations (e.g. link to existing **Test** or a future “quiz” type).

```prisma
model Course {
  id          String   @id @default(uuid())
  tenantId    String
  title       String
  description String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  assignments Assignment[]
  chapters    CourseChapter[]
  courseAssignments CourseAssignment[]  // assignment of course to batch or user
}

model CourseChapter {
  id       String   @id @default(uuid())
  courseId String
  title    String
  order    Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  course  Course         @relation(fields: [courseId], references: [id], onDelete: Cascade)
  topics  CourseTopic[]
}

model CourseTopic {
  id        String   @id @default(uuid())
  chapterId String
  title     String
  order     Int      @default(0)
  content   String?  // rich text or markdown
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  chapter    CourseChapter   @relation(fields: [chapterId], references: [id], onDelete: Cascade)
  materials  CourseMaterial[]
  activities CourseActivity[]
  evaluations CourseEvaluation[]
}

model CourseMaterial {
  id       String   @id @default(uuid())
  topicId  String
  type     String   // pdf, link, etc.
  title    String
  storageKey String? // key in R2/local for PDF
  url      String?  // optional external URL
  order    Int      @default(0)
  createdAt DateTime @default(now())

  topic CourseTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)
}

model CourseActivity {
  id       String   @id @default(uuid())
  topicId  String
  type     String   // assignment, discussion, etc.
  title    String
  config   Json     @default("{}")
  order    Int      @default(0)
  createdAt DateTime @default(now())

  topic CourseTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)
}

model CourseEvaluation {
  id       String   @id @default(uuid())
  topicId  String
  type     String   // quiz, test, mcp
  title    String
  testId   String?  // link to existing Test for quiz/coding
  config   Json     @default("{}")
  order    Int      @default(0)
  createdAt DateTime @default(now())

  topic CourseTopic @relation(fields: [topicId], references: [id], onDelete: Cascade)
  test  Test?       @relation(fields: [testId], references: [id], onDelete: SetNull)
}
```

- **Assignment** (existing) can stay for “due date + grading” at course level; **CourseAssignment** below links a **Course** to a **Batch** or **User**.

### 2.3 Assigning Courses to Batch or Student
- One model to assign a course either to a batch or to an individual user.

```prisma
model CourseAssignment {
  id         String   @id @default(uuid())
  tenantId   String
  courseId   String
  batchId    String?  // null = per-user assignment
  userId     String?  // null = batch assignment
  assignedBy String
  assignedAt DateTime @default(now())
  dueDate    DateTime?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  course Course @relation(fields: [courseId], references: [id], onDelete: Cascade)
  batch  Batch? @relation(fields: [batchId], references: [id], onDelete: Cascade)
  user   User?  @relation(fields: [userId], references: [id], onDelete: Cascade)
  // Constraint: exactly one of batchId or userId must be set (enforce in API)
}
```

- Add to **User**: `CourseAssignment[] courseAssignments`.
- Add to **Tenant**: `CourseAssignment[] courseAssignments` if you want tenant-scoped listing.

### 2.4 Calendar Scheduler (per batch)
- One model for calendar events per batch (and optionally per course/assignment).

```prisma
model BatchScheduleEvent {
  id        String   @id @default(uuid())
  batchId   String
  title     String
  startAt   DateTime
  endAt     DateTime
  type      String?  // class, exam, live_session, etc.
  courseId  String?
  location  String?
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  batch  Batch  @relation(fields: [batchId], references: [id], onDelete: Cascade)
  course Course? @relation(fields: [courseId], references: [id], onDelete: SetNull)
}
```

- Add **Course** relation: `BatchScheduleEvent[] scheduleEvents` (optional, for “events for this course” views).

### 2.5 Notes on Scheduler (per day, per batch)
- Notes visible only to that batch, attached to a calendar day.

```prisma
model SchedulerNote {
  id        String   @id @default(uuid())
  batchId   String
  date      DateTime @db.Date  // calendar day (no time)
  content   String   // plain or rich text
  createdBy String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  batch Batch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  author User @relation(fields: [createdBy], references: [id], onDelete: Cascade)
}
```

### 2.6 Batch-Level Recorded Videos
- Store metadata in DB; file in R2/local.

```prisma
model BatchVideo {
  id          String   @id @default(uuid())
  batchId     String
  title       String
  description String?
  storageKey  String   // key in R2 or path locally
  mimeType    String   @default("video/mp4")
  sizeBytes   Int?
  durationSeconds Int?
  order       Int      @default(0)
  uploadedBy  String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  batch Batch @relation(fields: [batchId], references: [id], onDelete: Cascade)
  uploader User @relation(fields: [uploadedBy], references: [id], onDelete: Cascade)
}
```

### 2.7 Relations to Add on Existing Models
- **User:** `batchMembers BatchMember[]`, `courseAssignments CourseAssignment[]`, `schedulerNotes SchedulerNote[]`, `batchVideos BatchVideo[]`.
- **Course:** `scheduleEvents BatchScheduleEvent[]`, `courseAssignments CourseAssignment[]`.
- **Tenant:** `batches Batch[]`, `CourseAssignment[]` if you add it.

---

## 3. Admin App Features – Implementation Outline

### 3.1 Course (CRUD + structure)
- **List/Detail:** List courses; drill into course → chapters → topics.
- **CRUD:** Create/Edit/Delete course; reorder chapters/topics.
- **Materials:** Per topic – upload PDF (multipart to API → save to R2/local, store `storageKey` in `CourseMaterial`); or add link.
- **Activities / Evaluations:** Per topic – add activity (type + config); add evaluation (type: quiz/test/MCP, optionally link `Test`).
- **Assignment of course:** From course or from Batch/Student screen – “Assign this course to Batch X” or “Assign to Student Y” (create `CourseAssignment` with `batchId` or `userId`).

### 3.2 Batch (CRUD + students + assignments)
- **CRUD:** Batches list; create/edit/delete batch.
- **Students:** “Add students to batch” (create `BatchMember`); remove from batch.
- **Assignments:** “Assign course to this batch” or “Assign test to this batch” (reuse/expand existing test allocation; for course use `CourseAssignment` with `batchId`).
- **Calendar:** Link to batch calendar (see below).
- **Videos:** Link to “Recorded videos” for this batch (upload/list/delete).

### 3.3 Calendar Scheduler (per batch)
- **View:** Admin selects a batch → calendar view (e.g. **react-big-calendar** by week/month); events from `BatchScheduleEvent` for that `batchId`.
- **CRUD:** Create/edit/delete event (title, start/end, type, optional course/location).
- **API:** `GET/POST/PUT/DELETE /api/v1/batches/:batchId/schedule` (or `/schedule-events`).

### 3.4 Scheduler Notes (per day, per batch)
- **View:** In the same batch calendar view, show a “Notes” section for the selected day (or a side panel). List `SchedulerNote` where `batchId` = current batch and `date` = selected day.
- **CRUD:** Add/edit/delete note for that batch + date. Only that batch sees the note (enforce in API by `batchId` and tenant).

### 3.5 Recorded Videos (batch level)
- **Upload:** Admin selects batch → “Upload recorded video” → multipart upload to API → API saves file to R2 (or local), creates `BatchVideo` with `storageKey`, `title`, etc.
- **List/Play/Delete:** List videos for batch; play via signed URL or proxy; delete (remove from storage + delete `BatchVideo`).
- **API:** `POST /api/v1/batches/:batchId/videos` (upload), `GET .../videos`, `GET .../videos/:id/url` (signed URL), `DELETE .../videos/:id`.

---

## 4. API Routes to Add

| Area           | Suggested routes |
|----------------|------------------|
| Batches        | `GET/POST /api/v1/batches`, `GET/PUT/DELETE /api/v1/batches/:id`, `POST/DELETE /api/v1/batches/:id/members` |
| Courses        | `GET/POST /api/v1/courses`, `GET/PUT/DELETE /api/v1/courses/:id`, chapters/topics/materials/activities/evaluations as nested or separate resources |
| Course assign  | `POST/GET/DELETE /api/v1/course-assignments` (filter by batch/user/course) |
| Schedule       | `GET/POST/PUT/DELETE /api/v1/batches/:batchId/schedule-events` |
| Notes          | `GET/POST/PUT/DELETE /api/v1/batches/:batchId/notes?date=YYYY-MM-DD` |
| Videos         | `GET/POST /api/v1/batches/:batchId/videos`, `GET /api/v1/batches/:batchId/videos/:id/url`, `DELETE .../videos/:id` |
| File upload    | `POST /api/v1/upload` or per-resource (e.g. course material, batch video) with multipart |

---

## 5. Implementation Order (suggested)

1. **Prisma:** Add Batch, BatchMember, CourseChapter, CourseTopic, CourseMaterial, CourseActivity, CourseEvaluation, CourseAssignment, BatchScheduleEvent, SchedulerNote, BatchVideo; add relations on User, Course, Tenant. Run migrate.
2. **Storage:** Implement a small storage service (local + R2 adapter) and env config (e.g. `STORAGE_PROVIDER=local|r2`).
3. **API:** Batches CRUD + members; Course CRUD + chapters/topics/materials/activities/evaluations; CourseAssignment; schedule events; scheduler notes; batch videos (upload + signed URL).
4. **Admin UI:** Batches list/detail + members; Courses list/detail + chapter/topic/materials/activities/evaluations; assign course to batch/student; batch calendar (react-big-calendar) + notes; batch videos upload/list.

This keeps the stack minimal and cost-effective while remaining stable and scalable. If you want, the next step can be a concrete Prisma schema patch (diff) and a single “storage service” interface plus R2/local implementation in the API.
