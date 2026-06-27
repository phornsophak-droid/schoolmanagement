# Data & Privacy Notes — Chbar Chros Community School App

A starting map for a technical/privacy review (child-data protection, security).
Not legal advice. The school is in Cambodia; COPPA (US) and GDPR (EU) are foreign
laws, but their *principles* — data minimisation, security, access control,
consent, retention — are the bar we aim for.

> ⚠️ For the reviewer: please start with **#1 (Supabase RLS)** below — it's the
> single highest-risk item.

---

## 1. What personal data the app stores

Per student (in `StudentScore`):
- **Name**, **gender**, **class/grade**, **អត្តលេខ (student ID)** (optional),
  **date of birth** (optional)
- **Academic scores** (per subject, monthly / semester / annual) and averages
- **Attendance** (per session: present / late / permission / absent) and a free-text
  **absence reason** (e.g. "ឈឺ" / sick)
- **Teacher remarks**
- Optional **student photo** for the merit certificate — stored **locally only**
  (`localStorage`), never synced to the cloud

Also stored: **principal & teacher signature images** (in `school_settings`),
class list, teacher accounts, and work reports.

> Note: the source roster spreadsheets contain much more (parents' names & jobs,
> home address, phone, disability/poverty status). The app's DOB import reads
> **only the DOB and student ID** from those files — the richer fields are **not**
> imported or stored in the app.

## 2. Where it's stored

| Location | Contents | Notes |
|---|---|---|
| **Supabase** (cloud, Postgres) | `student_scores`, `student_attendance`, `teacher_attendance`, `school_reports`, `school_settings`, `school_grades` | Authoritative store. HTTPS. Currently a **free-tier** project. |
| **IndexedDB** (browser, per device) | scores + attendance cache | Local mirror for offline/speed. |
| **localStorage** (browser) | signatures, student photos, session, custom PINs/users, settings | Photos & some settings live **only** here. |

## 3. Access & authentication

- **PIN login** — default principal PIN `1111`, teacher PIN `1234` (custom PINs
  supported). Shared/weak by default.
- **Teachers** are scoped to their own class (reports/summary).
- **Parent portal** (`/parent`) — a parent picks a class and **types a child's
  name** to view that child's report card. There is **no per-parent login**, so
  anyone who reaches the page can look up any child in any class.

## 4. Third-party data flows

| Service | Data sent | Notes |
|---|---|---|
| **Vercel** | app hosting / traffic | — |
| **Supabase** | all student data | the cloud store |
| **Google Gemini API** (optional) | the school-summary **digest** | **Now anonymised** — no individual student names, only counts and class/subject aggregates. Only used if `VITE_GEMINI_API_KEY` is set. Free-tier API data may be used by Google to improve models — hence the anonymisation. |
| **Google Fonts** | none (PII) | fonts only |

## 5. Open items for the security/privacy review (ranked)

1. **🔴 Supabase Row-Level Security (RLS).** `VITE_SUPABASE_ANON_KEY` ships inside
   the browser bundle (it's public by design). Verify RLS so this anon key **cannot
   read or write all student records**. This is the biggest exposure.
2. **🟠 Gemini API key** is client-side (browser bundle) if used → consider moving
   the call behind a serverless function so the key isn't exposed.
3. **🟠 Authentication strength** — shared/default PINs; the open parent portal.
   Consider per-user credentials and a real gate on the parent view.
4. **🟡 Data minimisation & retention** — keep only what's needed; define a
   retention period and a way to delete a student's data (erasure).
5. **🟡 Parent consent & a short privacy notice** — what's collected, why, who sees it.
6. **🟡 Backups** — the JSON export (Factory Reset / backup) contains the full
   dataset; handle and store those files securely.

## 5b. RLS audit results (June 2026)

Audited via `pg_tables` / `pg_policies` / `role_table_grants`:

- **RLS is enabled** on all `public` tables (`rowsecurity = true`) — good baseline.
- **But each table has permissive policies** (2 per table) that let the `anon` role
  do everything; the app works using only the public anon key, so the policies are
  effectively `USING (true)`. Net effect: **the public key can read every student
  record.** RLS is on but not protecting confidentiality.
- **`anon` (and `authenticated`) were granted `TRUNCATE` + `REFERENCES`** on all
  tables. `TRUNCATE` **bypasses RLS**, so the public key could wipe tables
  regardless of policies.

**Action taken:** `REVOKE TRUNCATE, REFERENCES ... FROM anon, authenticated;` — the
app uses only SELECT/INSERT/UPDATE/DELETE, so this removes the data-destruction
capability with no impact on the app. Read-confidentiality still requires the
server-proxy below (the browser must stop using the anon key directly).

## 6. Privacy measures already in place

- Transport is HTTPS (Vercel + Supabase).
- The AI summary digest is **anonymised** (no child names leave the app).
- Student photos are **local-only** (never uploaded to the cloud).
- Teachers are scoped to their own class in the reports/summary.
