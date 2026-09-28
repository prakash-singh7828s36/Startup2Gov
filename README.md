# Startup2Gov — Startup Module

A **startup copilot for government challenges**: match scores, eligibility checks,
deadline urgency, an autosaving apply wizard, and an application tracker — with mock
auth + localStorage persistence so the full flow runs without a backend.

Brutalist UI (dotted grid, hard offset shadows, yellow secondary) with **dark and
light themes**. All data is SAMPLE and deadlines are relative to today, so the demo
never expires.

## Run

```bash
npm install
npm run dev    # http://localhost:5173
npm run build
npm run lint
```

Node 22+ recommended (Vite 8). If `vite: not found` or rolldown binding errors
appear, reinstall `node_modules` with the right Node version.

## Routes

| URL | Access | Page |
| --- | ------ | ---- |
| `/` | Public | Landing page |
| `/login`, `/signup` | Public | Mock auth |
| `/dashboard` | Protected | Copilot dashboard |
| `/profile` | Protected | Startup profile |
| `/challenges` | Protected | Browse + compare |
| `/challenges/:id` | Protected | Challenge details |
| `/apply/:id` | Protected | 3-step apply wizard |
| `/applications` | Protected | Application tracker |
| `*` | Public | 404 |

Unauthenticated visits to protected routes redirect to `/login` (then back). Login
defaults to `/dashboard`.

## Features

### Landing page (`/`)
- Sticky nav with theme toggle, sign-in / get-started actions
- Hero with live counts, stats band (challenges, departments, pilot range, scoring)
- Department ticker, 3-step "How it works", featured-challenge cards
- Match-engine weight breakdown, CTA band, footer — all themed dark/light

### Mock auth
- Signup / login with validation (6-char demo password rule), session persisted in
  `localStorage`, protected-route guard with return-to redirect
- Brutalist auth card matching the reference: dotted bg, offset shadow, yellow logo
  block, mono uppercase labels

### Copilot dashboard (`/dashboard`)
- **Next-best-action hero**: profile completion → resume draft → most urgent unapplied
  deadline → top match → track applications
- Derived stats (available / submitted / in review / approved), profile-completion %
- **Recommended for you**: top-3 unapplied matches with score bars + reasons
- **Closing soon** urgency list + **pipeline funnel** (Submitted → In review → Approved)
- **Draft resume** cards with relative timestamps, **activity feed**, recent-applications
  table, quick actions

### Smart browse (`/challenges`)
- 12 sample challenges across 8 categories (IDs 1–6 stable) with budget, duration,
  tags, eligibility rules, relative deadlines
- **0–100 match badge** + top reason on every card, urgency-colored deadlines
- Sort (Best match / Closing soon / Newest), search across title/department/tags/
  location, **Eligible-for-me** and **Saved** filter chips, skeleton shimmer loading
- **Bookmarks** (per-user persist) and **compare tray** (up to 3 → side-by-side modal)

### Rich details (`/challenges/:id`)
- Match pill, tag chips, key-facts grid (department, location, budget, duration,
  category, posted date), deadline countdown, save button
- **"Why X% for you"** panel (reasons + profile-boost nudges), **eligibility
  checklist** (ok / soft-warn / fail), requirements + pilot note
- Draft-resume banner, related challenges, apply CTA that becomes "Track Application"
  after applying, sticky bottom apply bar

### Apply wizard (`/apply/:id`)
- 3 steps (Startup → Solution → Docs & Review) with progress pills and per-step
  validation; startup fields prefilled from profile
- **Autosave drafts** (debounced, per user + challenge) with "saved x ago" indicator;
  file validation (PDF/DOC/DOCX, 5MB) with name-only draft persistence
- Review screen with edit jump-links; **success screen** with app ID, status timeline,
  **Add deadline to calendar** (.ics download), duplicate-apply protection

### Application tracker (`/applications`)
- Derived summary (total / in progress / approved), status filter + text search
- Per-application **Details drawer**: timeline, full details grid, complete answers,
  document info, **Export summary** (Markdown download), withdraw with confirm
- Handles sparse seed rows gracefully; empty state with CTA

### Pro profile (`/profile`)
- Core info (name, founder, contact, website, location, industry, description) plus
  matching fields: **stage, team size, founded year, DPIIT number** (mock format
  check), core technology, tech tags, deck link — all validated
- **Profile-strength meter** (13 fields) with missing-field nudges and a **"How
  departments see you"** preview card; every field feeds match scores immediately

### Demo kit (sidebar → Demo data)
- **Judge demo**: rich CleanTech profile, 3 own applications across the pipeline,
  half-finished draft, bookmarks, activity history — one click + reload
- **Reset**: wipes everything the account created and restores canonical samples

### Theming
- `ThemeContext` (`s2g_theme` in localStorage, `html[data-theme]`, dark default)
- Toggle in sidebar + auth screens + landing nav; yellow secondary throughout
  (logo, active nav, CTAs, badges, avatars, focus rings, selection)

## Services (`src/services/`, all async → Supabase-swappable)

- `challengeService` — list / by-id / closing-soon / featured / by-deadline
- `startupService` — profile get/save, core completion %, extended strength, DPIIT check
- `applicationService` — submit (clears draft, logs activity), list, recent, stats,
  has-applied guard, withdraw
- `matching` — explainable 0–100 score (industry 30 / keywords 30 / profile 20 /
  stage 10 / team 10) with reasons + missing nudges; eligibility checklist where
  missing info is a soft warn, never a hard block
- `deadlines` — days-left, urgency bands (urgent ≤7d / soon ≤21d), badge labels,
  sorting, .ics generation (all date math via `date-fns`)
- `bookmarks`, `drafts`, `activity` (+ per-application timelines), `authService`
  (mock users/session), `storageService` (mock upload), `demoKit` (seed/reset),
  `mockDb` (localStorage keys, IDs, delay helper)

## 60-second judge script

For a local, non-production demo, set `VITE_DEMO_MODE=true`; demo accounts are disabled otherwise.

1. Land on `/` → **Sign in** (`demo@startup.in` / `password123`).
2. Sidebar → **Judge demo** → dashboard hero, recommended rail, funnel, activity.
3. **Browse**: sort *Best match*, toggle *Eligible for me*, bookmark one, select two →
   **Compare**.
4. **Details** (challenge 1): why-score, eligibility, key facts, sticky apply.
5. **Apply** (challenge 7): wizard + autosave → review → submit → calendar download.
6. **My Applications** → **Details** drawer → export. Sidebar → **Reset**.

## Architecture & Stack

- **Frontend**: React 19, Vite 8, React Router v7, Recharts, Lucide Icons, Axios
- **Backend (server/)**: Node.js, Express.js, MongoDB Atlas (Mongoose), bcryptjs, jsonwebtoken (JWT)
- **Security**: Server-side role enforcement (RBAC), Helmet HTTP headers, CORS origin whitelist, Express rate-limiting, bcrypt salt rounds >= 10, JWT Bearer tokens
- **Persistence**: MongoDB Atlas with Mongoose models (`User`), and fallback health monitoring

## Quick Start & Running Locally

### 1. Frontend Setup (Port 3000)
```bash
npm install
npm run dev        # http://localhost:3000 (proxies /api -> http://localhost:5000)
npm run build      # Production bundle
npm run lint       # ESLint verification
```

### 2. Backend Setup (Port 5000)
```bash
cd server
cp .env.example .env   # Configure MONGODB_URI and JWT_SECRET
npm install
npm run dev            # Starts backend on http://localhost:5000 with auto-reload
npm test               # Runs automated test suite (17 tests)
npm run seed           # Seeds standard demo accounts into MongoDB
```

## Backend API Endpoints

### Authentication (Phase 1)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | Service health and MongoDB connection status |
| `POST` | `/api/auth/signup` | Public (Rate-limited) | Register new `startup` or `government` user |
| `POST` | `/api/auth/login` | Public (Rate-limited) | Authenticate user, verify bcrypt hash, return JWT |
| `GET` | `/api/auth/me` | Authenticated (JWT) | Get current verified user profile from token |
| `POST` | `/api/auth/logout` | Public | Clear session / client token invalidation |
| `GET` | `/api/auth/role-check/government` | Role: `government`, `admin` | Verification endpoint for RBAC |
| `GET` | `/api/auth/role-check/startup` | Role: `startup` | Verification endpoint for RBAC |

### Challenge Management (Phase 2)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/challenges` | Public / Opt-Auth | List published challenges with pagination, search, category filter, and personalized match score |
| `GET` | `/api/challenges/owned` | Role: `government`, `admin` | Get all challenges created by the logged-in department |
| `GET` | `/api/challenges/:id` | Public / Opt-Auth | Get challenge details by ObjectId, customId, or slug (Drafts restricted to owner) |
| `POST` | `/api/challenges` | Role: `government`, `admin` | Create a new challenge owned by the authenticated government user |
| `PUT` | `/api/challenges/:id` | Role: `government`, `admin` | Update owned challenge details (enforces ownership and writable field limits) |
| `PATCH` | `/api/challenges/:id/status` | Role: `government`, `admin` | Set challenge status (`Open`, `Closed`, `Draft`) |
| `DELETE` | `/api/challenges/:id` | Role: `government`, `admin` | Delete owned challenge (demo challenges protected) |

### Startup Profile (Phase 2)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/profile/me` | Role: `startup`, `admin` | Get authenticated startup's profile with completion & strength scores |
| `PUT` | `/api/profile/me` | Role: `startup`, `admin` | Upsert startup's profile (validates 15 fields including DPIIT, team size, URLs) |

### Applications & Drafts (Phase 3)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/applications/drafts/:challengeId` | Role: `startup`, `admin` | Retrieve autosaved draft for the challenge |
| `POST` | `/api/applications/drafts/:challengeId` | Role: `startup`, `admin` | Debounced autosave of proposal form and document metadata |
| `DELETE` | `/api/applications/drafts/:challengeId` | Role: `startup`, `admin` | Clear saved draft |
| `GET` | `/api/applications/my` | Role: `startup`, `admin` | List all applications submitted by current startup |
| `GET` | `/api/applications/:id` | Authenticated | View application details (enforces ownership and access permissions) |
| `POST` | `/api/applications` | Role: `startup`, `admin` | Submit final proposal (validates required fields, deadline, and rejects duplicate active submissions) |
| `DELETE` | `/api/applications/:id` | Role: `startup`, `admin` | Withdraw submitted application (cannot withdraw approved applications) |
| `GET` | `/api/applications/gov/inbox` | Role: `government`, `admin` | Department inbox for applications to owned challenges with queue stats |
| `PATCH` | `/api/applications/:id/review` | Role: `government`, `admin` | Submit review decision (`Approved`, `Rejected`, `Under Review`) with audit trail |

### Secure Document Storage (Phase 3)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/documents/upload` | Authenticated | Securely upload proposal PDF/Word doc (5MB limit, sanitized UUID storage key) |
| `GET` | `/api/documents/:storageKey` | Authenticated | Private authorized download (applicant, owning department officer, or admin only) |


## Transparent Matching & Scoring Formula (100 Points Total)

Both server (`server/services/matchingService.js`) and client (`src/services/matching.js`) use the exact same transparent evaluation breakdown:
1. **Industry Fit (30 pts)**: Exact match = 30 pts, Related tech field = 22 pts, Cross-domain = 6 pts.
2. **Keyword Overlap (30 pts)**: Proportional match between profile tags/description and challenge keywords (up to 5 keywords).
3. **Profile Strength & Completeness (20 pts)**: Calculated from the percentage completion of core and extended profile fields.
4. **Startup Stage Fit (10 pts)**: Current stage matches challenge eligibility requirements = 10 pts, Idea/Early stage = 4 pts.
5. **Team Size Readiness (10 pts)**: Team size meets challenge threshold (`minTeam`) = 10 pts, partial team = 5 pts.

## Idempotent Demo Seeding Scripts

Run the following commands from `server/`:
- Set `SEED_DEMO_USERS=true` and run `npm run seed` only in non-production to create standard demo users (`demo@startup.in`, `demo@gov.in`). The script refuses to seed these credentials in production.
- `node scripts/seedChallenges.js`: Seeds or updates the 12 canonical SIH demo challenges with `isDemo: true`, without overwriting any user-created challenges.


## Environment Configuration

- Root `.env.example`: frontend configuration (`VITE_API_URL=/api`)
- `server/.env.example`: backend configuration (`PORT`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_URL`)
- All `.env` and `.env.*` files are explicitly ignored by `.gitignore`.

## Services (`src/services/`)
