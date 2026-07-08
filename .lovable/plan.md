## Multi-Tenant Architecture Rollout

Full spec in a single pass, keeping existing screens (VSDT, Registers, PPT Vault, Documents, NOC, EduAI, Network) alive and re-plugging them into a conditional shell.

### 1. Database migration
Add missing columns and helpers; keep RLS untouched.

- `profiles`: add `college text`, `phone text`, `batch text`, `professional_tier text default 'Member' check in (Member,Silver,Gold,Platinum)`, `onboarded_at timestamptz`.
- New table `ppt_submissions` (user_id, slot 1..5, title, file_path, status Pending|Approved|Revise, reviewer_notes, risk_recovery bool, created_at). RLS: owner rw, admin all. GRANT authenticated + service_role.
- New table `broadcasts` (id, title, body, audience text default 'core' — core|all, created_by, created_at). RLS: admin insert; authenticated select with audience filter. Realtime enabled.
- Ensure `vset.official@gmail.com` gets admin role on first sign-in (extend `handle_new_user` trigger to assign admin when email matches; also insert admin row for existing user if present). Keep `630karan@gmail.com` admin too (both admins).

### 2. Onboarding flow
- Route `/onboarding` (public route, requires session). Header "System Update: Personalize Your Workspace" + supportive note.
- Form: Name, Phone, Batch/Year, College dropdown (AKTU / VSET / Others). Zod-validated, saves via server fn (`updateOnboarding`).
- Guard in `_authenticated`-style effect in `__root` or in `student.tsx`/`admin.tsx` layout: if session && !profile.college && email !== vset.official@gmail.com → redirect `/onboarding`. Admin bypass.

### 3. Global helper
`src/lib/tenant.ts`:
```
isCoreMember(profile) => profile.college === 'AKTU' || profile.college === 'VSET' || profile.email === 'vset.official@gmail.com'
```
`useTenant()` hook returning `{ profile, isCoreMember, tier, loading }` from a single `profiles` query.

### 4. Student dashboard split (`/student`)
Conditional in `student.index.tsx`:
- **Core Committee "Command Center"**: 6 Physical Registers checklist (localStorage-backed toggles), Top 10 AKTU YouTube Channels (static curated list card), PPT Vault entry card (5 slots status), VSDT Readiness Tracker (reuse existing `student.tracker`), Meeting Alerts (from `broadcasts` where audience='core').
- **Global "Enterprise Mode"**: Core Coursework Ledger, Curated Academic Resources, Venture Feasibility PPTs card, Career Readiness Index (progress ring reusing todo/attendance signals).
- Terminology map util: `Helping Hand → Social Impact Initiative`, etc., applied via a `t()` helper when `!isCoreMember`.
- Header shows name + tier badge (color-coded Silver/Gold/Platinum/Member).

### 5. PPT Vault (`/student/competency` → new route)
- 5 slots, upload to `student-documents` bucket at path `ppt/{uid}/slot-{n}`.
- Core labels: Scholarship Brand PPT, Education Platform PPT, VSDT Concept, Helping Hand Model, Youth Empowerment PPT + mandatory "Risk & Recovery Analysis" checkbox that must be true before submit.
- Global labels: CSR Initiatives, Revenue Roadmaps, Market Feasibility, Growth Blueprint, Leadership Vision. No checkbox.
- Row shows status badge from `ppt_submissions.status`.

### 6. Admin Command Center (`/admin`)
Restrict to email `vset.official@gmail.com` OR existing admin role. Tabs:
- Master User Table: Name, Email, College, Tier, Actions.
- Tier Management: inline dropdown updates `professional_tier` via server fn (admin-only).
- PPT Reviewer: list `ppt_submissions`, Approve/Revise + notes.
- Broadcast Widget: title + body + audience toggle (Core AKTU/VSET | All) → inserts to `broadcasts`; realtime pushes to student dashboards.

### 7. Navigation refactor
- Desktop (≥768px): keep permanent `DesktopSidebar`.
- Mobile (<768px): hide sidebar, show fixed Top Navbar with app name + hamburger → slide-in left `Sheet` drawer containing the same nav items. Retain existing `BottomNav` OR replace — will keep bottom nav for quick actions and add the hamburger drawer for full menu (fewer regressions).

### 8. Files touched / added
Added: `src/routes/onboarding.tsx`, `src/routes/student.competency.tsx`, `src/lib/tenant.ts`, `src/lib/terminology.ts`, `src/components/CoreDashboard.tsx`, `src/components/GlobalDashboard.tsx`, `src/components/TierBadge.tsx`, `src/components/MobileNavbar.tsx`, `src/lib/onboarding.functions.ts`, `src/lib/admin.functions.ts`, `src/lib/ppt.functions.ts`, `src/lib/broadcasts.functions.ts`.
Edited: `__root.tsx` (onboarding guard + mobile navbar), `student.tsx` (layout), `student.index.tsx` (conditional), `admin.tsx` (tabs + restrict), `MobileShell.tsx`, `DesktopSidebar.tsx`.

### 9. What I will NOT touch
- Existing RLS on profiles/documents/user_roles.
- Auto-generated Supabase files.
- Existing routes (network, documents, noc, exams, materials, eduai) — remain accessible via sidebar/drawer; only dashboard index and admin change substantially.

Ready to execute — reply "go" and I'll ship the migration first, then code.