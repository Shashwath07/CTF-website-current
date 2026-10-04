# CryptX CTF Platform

Custom Capture The Flag competition platform for CryptX, organised by Digital Defence Club (DDC), CBIT.

## Overview

This repository contains the public CryptX event website and the authenticated participant interface. The public experience includes the cinematic Pages 01–03 journey. The participant application provides login, a protected dashboard, persistent competition navigation, and the foundation for server-assigned challenges.

Event registration is handled externally through Unstop. The custom DDC platform handles competition access and gameplay.

## Current features

- Cinematic public landing website with the approved Page 01, Page 02, and Page 03 scenes.
- Three.js globe/network scene, GSAP/ScrollTrigger choreography, Lenis integration, responsive layouts, and reduced-motion handling.
- Participant login with bcrypt password verification and HttpOnly session cookies.
- Persistent sessions restored through `/api/auth/me`; protected participant routes redirect unauthenticated visitors to `/login`.
- Authenticated dashboard with participant identity, event countdown, assignment status, statistics, announcements, categories, and recent activity.
- Persistent participant topbar across dashboard, challenges, challenge detail, submissions, leaderboard, and rules routes.
- Server-side starting-challenge assignment that is saved and remains stable on refresh or concurrent starts.
- Logout that invalidates the server session.
- Timed CTF: a global event window (UPCOMING / LIVE / ENDED) gates challenge starts and flag submissions server-side, while each participant's own per-challenge clock (`started_at` → `solved_at`) decides points.
- Time-decay scoring persisted at solve time, an auditable score ledger, and a real leaderboard.

Five challenges are playable inside the participant shell: WEB-101 — Ghost 404 (source/storage/archive investigation) and WEB-102 — Wrong Key, Right State (participant-seeded browser-state puzzle). Their shared submission flow validates on the server, records attempts privately, and persists the first solve. Further challenge environments, hints and penalties, password recovery, admin tooling, and Unstop-to-platform account provisioning are not implemented yet. FORENSICS-103 — Cold Boot: Shattered Cache is a static memory-image investigation reached through NEXT CHALLENGE. CRYPTO-104 — Dead Drop 64: Receiver’s Copy serves a privately prebuilt evidence archive, also reached through NEXT CHALLENGE ([setup notes](docs/CRYPTO104.md)). CRYPTO-105 — Shift Change is a medium static evidence challenge built the same way ([setup notes](docs/CRYPTO105.md)). Organizer solution notes are kept outside this public repository.

## Tech stack

Frontend: React, TypeScript, Vinext/Vite, Three.js, GSAP/ScrollTrigger, Lenis, and Lucide icons.

Backend: Vinext server routes running through the Cloudflare Vite/Wrangler integration, Cloudflare D1 with SQLite-compatible SQL, bcryptjs password hashing, and opaque server-side sessions stored as SHA-256 token hashes.

## Project structure

```text
app/                  public and participant routes plus API handlers
components/           public scenes, login UI, and participant UI
db/                   Drizzle schema and SQL migrations
lib/server/           D1 access, authentication, API helpers, and competition logic
lib/participant/      shared participant types
public/assets/        approved visual assets and textures
scripts/              local database migration and provisioning helpers
tests/                participant integration checks
docs/                 participant platform setup and deployment notes
```

## Application routes

```text
/                         Public Pages 01–03 journey
/challenge-vectors        Standalone Page 02 view
/login                    Participant login
/dashboard                Protected participant dashboard
/challenges               Protected challenge catalogue
/challenges/:challengeId Protected assigned challenge route
/submissions              Flag entry and private attempt history
/leaderboard              Protected live/final standings
/rules                    Protected rules placeholder
```

## Backend API

```text
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
GET  /api/dashboard
GET  /api/challenges
POST /api/challenges/start
POST /api/challenges/next
GET  /api/submissions
POST /api/submissions
GET  /api/leaderboard
```

## Authentication

Participants sign in with an organizer-provisioned username or email and password. Passwords are stored only as bcrypt hashes. Successful login creates a random opaque session token; only its SHA-256 hash is stored in D1 and the token is sent in an HttpOnly, SameSite cookie. The session survives refresh and route changes. Protected pages and APIs validate the server-side session. Logout deletes it.

The participant provisioning command is local-only by design. The final production account provisioning workflow must be approved by the organizers.

## Challenge flow

```text
Login → Dashboard → Start Challenge
       → server selects an active starting challenge
       → assignment and participant start time are persisted
       → participant enters the assigned challenge route
```

Migration `0002_web101.sql` publishes WEB-101 as a starting challenge. Its inspectable HTML environment is playable after configuring the private server-side flag. Migration `0004_submissions.sql` adds attempt history and submission throttling. Participants can submit through `/submissions?challenge=WEB-101`; correctness is checked against the server secret and the first solve persists atomically with the attempt. Scoring remains future work. Migration 0006_challenge_progression.sql preserves assignments while enabling multiple completed challenges and one current challenge per participant. Solves show completion; explicit NEXT CHALLENGE selects another eligible unsolved challenge server-side. Existing participant assignments are preserved by migrations and refreshes. Migration `0007_forensics103.sql` adds FORENSICS-103 as an active non-starting challenge; its evidence image is generated server-side from `FORENSICS103_FLAG` (`node scripts/generate-forensics103.mjs` writes a local copy). Migration `0008_crypto104.sql` adds CRYPTO-104 the same way; its evidence is staged at build time from a private directory (see `docs/CRYPTO104.md`). Migration `0009_crypto105.sql` adds CRYPTO-105 the same way (see `docs/CRYPTO105.md`).

## Timed scoring

Two separate clocks:

- **Global event clock** — `event_config` (migration `0010_timed_scoring.sql`): `event_start_at`, `event_end_at` (UTC epoch ms) and `timezone` (`Asia/Kolkata`, display only). It only answers "can this participant play now?". Before start, login/dashboard work but `POST /api/challenges/start|next` and `POST /api/submissions` return 403 `EVENT_NOT_STARTED`; from `event_end_at` onwards (server receipt time, end exclusive) they return 403 `EVENT_ENDED`. Progress and the leaderboard stay visible. A NULL end means LIVE with no end.
- **Individual challenge clock** — `participant_challenges.started_at` is written once by the first start and never reset by refreshes, new tabs, re-login or reopening the challenge. The first accepted flag writes `solved_at`, `duration_seconds` and `awarded_points` in the same D1 transaction as a `SOLVE` row in `score_events`.

`awarded = round(max_points - (max_points - min_points) * min(elapsed_minutes / decay_minutes, 1))`, never below `min_points`. Event time is never an input. Persisted points are never recalculated when challenge config changes. Leaderboard totals are `SUM(score_events.points)`, ranked by score, then solves, then earliest final solve, then participant ID.

Provisional values (randomised once, stored in the migration):

| Challenge | max | min | decay |
|---|---|---|---|
| WEB-101 | 150 | 75 | 45 min |
| WEB-102 | 200 | 100 | 60 min |
| CRYPTO-105 | 175 | 90 | 90 min |
| FORENSICS-103 | 250 | 125 | 120 min |
| CRYPTO-104 | 300 | 150 | 120 min |

Code: `lib/scoring.ts` (pure `getEventState`, `isEventLive`, `getChallengeElapsed`, `calculateChallengeScore`), `lib/server/event-window.ts` (`requireEventLive`), `lib/server/leaderboard.ts`.

Event window commands (local D1 only; times need an explicit offset):

```sh
npm run event:show:local
npm run event:set:local -- --live 6
npm run event:set:local -- --start 2026-10-12T10:00:00+05:30 --end 2026-10-12T16:00:00+05:30
```

Production: apply migrations, then e.g. `wrangler d1 execute DB --remote --command "UPDATE event_config SET event_start_at=<ms>, event_end_at=<ms>, updated_at=<ms> WHERE id=1"`.

## Local development

Requirements: Node.js 22.13.0 or newer, npm, and Git.

```sh
git clone https://github.com/Kritt29/CTF-website-current.git
cd CTF-website-current
npm ci
npm run setup
npm run dev
```

`npm run setup` applies the D1 migrations to the local database (the same one `npm run dev` uses) and then interactively creates a local participant. It asks for a username, an optional display name (defaults to the username), and a password with confirmation; the password is hidden while typed, must be 12+ characters and at most 72 UTF-8 bytes, and is stored only as a bcrypt hash through the same code as `participant:create:local`. The email (`<username>@local.ddc.invalid`) and participant ID (`LOCAL-…`) are generated. Setup never touches remote D1 and stops without changes if the username already exists; re-run it with a different username to add more local participants. To reset the local database, stop the dev server and delete `.wrangler/state/v3/d1` (this erases all local data), then run `npm run setup` again.

Open `http://localhost:5173/login` and sign in with the username and password you just chose. The migrated event window starts on 12 Oct 2026, so starting challenges and submitting flags are blocked locally until you open a window, e.g. `npm run event:set:local -- --live 6`.

`npm run db:migrate:local` only applies migrations. For scripted provisioning, pass JSON through standard input to `npm run participant:create:local`. The required fields are `username`, `email`, `password`, `displayName`, and `participantId`. Do not put passwords in shell history or commit them. To publish a local starting challenge, use `npm run challenge:add:local`; see [docs/PARTICIPANT_PLATFORM.md](docs/PARTICIPANT_PLATFORM.md) for the exact fields and production requirements.

Useful checks:

```sh
npx tsc --noEmit --incremental false
npm run build
npm run lint
node tests/participant.integration.mjs
npm run test:scoring
node tests/scoring.integration.mjs
```

`npm start` runs the built Worker locally after `npm run build`. The included `wrangler.local.json` and D1 database ID are local development configuration, not production infrastructure.

## Environment variables

Cloudflare deployment configuration supplies the D1 binding named `DB`. `WEB101_FLAG`, `WEB102_FLAG`, `FORENSICS103_FLAG`, `CRYPTO104_FLAG`, and `CRYPTO105_FLAG` are separate server-only challenge flags: set them in ignored `.dev.vars` for local development and as Worker secrets in production. `.env.example` documents placeholders only. Configure the production D1 database and HTTPS deployment through the hosting environment; never commit credentials, flags, tokens, or secret keys.

## Registration

Event registration is handled separately through [Unstop](https://unstop.com/hackathons/cryptx-chaitanya-bharathi-institute-of-technology-cbit-hyderabad-1761452). The custom platform handles participant login and competition gameplay after organizer-approved account provisioning.

## Security notes

- Platform authentication, participant records, assignments, and session state are server-controlled.
- Client-side state is never trusted for authentication, scoring, or challenge validation.
- Password hashes and unrelated secrets are never returned to the browser. Session tokens are confined to HttpOnly cookies. A challenge flag is returned only at its intended authenticated discovery endpoint after assignment verification; never bundle flags into frontend code.
- Intentionally vulnerable CTF challenges must run in isolated environments separate from platform authentication and data.
- Mutating API requests enforce same-origin checks and login attempts are rate-limited.

## Current status and next work

- Add validators and environments for further challenges (progression already assigns any active, unsolved challenge).
- Add hints (as negative HINT rows in `score_events`) and rebalance the provisional point values after blind testing.
- Add organizer/admin tooling and approved production account provisioning.
- Confirm the event start/end and set them in production `event_config`; configure production D1/Cloudflare deployment.
- Load-test production asset delivery and participant APIs before the event.

## Registration CTA source

The shared registration destination is defined in `components/shared/registration.ts`. Do not duplicate or replace it with a new URL in individual components.
