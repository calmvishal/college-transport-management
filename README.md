# College Transport Management System

A production-ready transport booking, clubbing, and attendance system for a
college, built on Next.js (App Router, TypeScript) with Google Sheets as the
database. Deployable to Vercel.

## Core concept

Every student has a **Default Vehicle** (permanent) and, per date, an
**Operational Vehicle** (what they're actually scheduled on after clubbing).
Attendance is always derived from the Operational Vehicle, never the
Default Vehicle. See `lib/transportLogic.ts` — every dashboard, the driver
roster, and the monthly PDF all call into the same functions there, so their
numbers can never disagree.

Pipeline: **Booking → Clubbing → Operational Vehicle → Vehicle Sent/Not Sent
→ Attendance → Dashboards/Reports**.

## 1. Prerequisites

- Node.js 18.18+ (Next.js 14 requirement)
- A Google Cloud project with the Sheets API enabled
- A Google Sheet to use as the database

## 2. Google Sheets setup

1. Go to https://console.cloud.google.com/, create/select a project.
2. Enable the **Google Sheets API** (APIs & Services → Library).
3. Create a **Service Account** (APIs & Services → Credentials → Create
   Credentials → Service Account).
4. Open the service account → Keys → Add Key → Create new key → JSON.
   Download it — you'll need the `client_email` and `private_key` fields.
5. Create a new Google Sheet (any name, e.g. "College Transport DB").
6. Click **Share** on the sheet and add the service account's
   `client_email` as an **Editor**.
7. Copy the Spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

## 3. Local setup

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```
GOOGLE_SHEETS_SPREADSHEET_ID=...
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
APP_TIMEZONE=Asia/Kolkata
```

Provision the sheet tabs and headers (safe to re-run):

```bash
npm run setup:sheets
```

Seed demo data (vehicles, students, drivers, and one login per role):

```bash
npm run seed:demo
```

This prints demo credentials, e.g.:

```
Route Incharge -> incharge@example.com / incharge123
Driver (Bus 1) -> driver1@example.com   / driver123
Student (Rahul) -> student1@example.com / student123
```

Run the app:

```bash
npm run dev
```

Visit http://localhost:3000 and log in.

## 4. Adding real users

There's no self-registration flow by design — a Route Incharge adds
students/vehicles/drivers via the Master Data screens, and a separate
`Users` row must be manually added (or provisioned by an admin script you
extend) for each person's login, with a bcrypt-hashed password. To hash a
password for a new manual row, run:

```bash
node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"
```

Paste the resulting hash into the `Password Hash` column, matching the
person's role, route, and (for drivers) `Vehicle ID` or (for students)
`Student ID`.

## 5. Deploying to Vercel

1. Push this project to a GitHub repository.
2. Import the repo in Vercel.
3. In Vercel → Project → Settings → Environment Variables, add the same
   variables as `.env.local` (set `NEXTAUTH_URL` to your production URL,
   e.g. `https://your-app.vercel.app`).
4. Deploy. Vercel will run `next build` automatically.
5. Because Google service-account credentials are only read in
   `lib/sheets.ts`, which is marked `server-only` and used exclusively from
   API routes and server components, they are never bundled into
   client-side JavaScript.

## 6. Project structure

```
app/
  api/                 API routes (all business logic + role checks live here)
  login/               Shared login page
  student/             Student dashboard
  driver/              Driver attendance
  incharge/            Route Incharge dashboards + master data management
lib/
  sheets.ts            Low-level Google Sheets client (server-only)
  repository.ts        Typed CRUD over each sheet
  transportLogic.ts    Single source of truth: operational vehicle + attendance derivation
  authOptions.ts        NextAuth config (credentials against Users sheet)
  apiAuth.ts           requireRole()/requireSession() guards for API routes
  dateUtils.ts         Timezone-aware date helpers (next-day booking, month ranges)
components/            Shared UI (NavBar, StatusBadge, DateNav, ConfirmDialog, Toast)
scripts/
  setupSheets.ts       Provisions sheet tabs + headers
  seedDemoData.ts      Seeds demo vehicles/students/drivers/users
types/index.ts         Canonical domain types shared by backend and frontend
```

## 7. Testing the critical business rules

The following scenarios (matching the spec's Critical Test Cases) can be
walked through manually against the demo data:

1. **Normal booking** — log in as the student, book tomorrow. Confirm the
   Incharge Daily Dashboard shows the booking under Bus 1.
2. **Clubbing** — as Incharge, go to Clubbing, move Rahul from Bus 1 to
   Bus 2. Confirm Rahul's Default Vehicle is still Bus 1 on the Students
   page, but his Operational Vehicle on the Daily Dashboard is Bus 2.
3. **Original vehicle not sent** — mark Bus 1 "Not Sent" on the Daily
   Dashboard. Confirm Rahul (clubbed to Bus 2) is NOT marked absent.
4. **Operational vehicle not sent** — mark Bus 2 "Not Sent" instead.
   Confirm Rahul is now "Absent — Vehicle Not Sent" without the driver
   doing anything.
5. **Driver marks absent** — with Bus 2 Sent, log in as the Bus 2 driver
   and uncheck a present student; confirm "Absent — Student" appears.
6. **Monthly PDF** — go to Reports, generate the current month; confirm
   the vehicle-wise, student-wise, vehicle-not-sent, and clubbing-history
   sections reconcile with what the Daily Dashboard showed on each date.

## 8. Notes on scope

This implementation covers every module in the spec: authentication and
role-based server-side authorization, next-day booking, clubbing with
capacity validation and audit trail, vehicle sent/not-sent with automatic
absence derivation, driver attendance, the Route Incharge Daily Dashboard
(summary cards, vehicle-wise and student-wise tables, date navigation),
monthly PDF reports, and master data management (students/vehicles/drivers)
with Active/Inactive status instead of deletion. The audit log
(`AuditLog` sheet) records administrative CREATE/UPDATE actions; extend
`recordAudit()` calls if you want more granular old-value tracking on
specific fields.
