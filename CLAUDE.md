# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kizu (formerly RecoveryConnect/PeerHeal) is a peer-to-peer recovery guidance platform where Guides (people who've been through medical procedures or chronic conditions) share recorded stories, offer 1-on-1 video calls, host group sessions, and connect with Seekers (patients seeking guidance). Built with Next.js 16 (App Router), TypeScript, Supabase JS client, Stripe, and Tailwind CSS 4.

**Critical**: The app uses Supabase JS client for all database access — never suggest or add Prisma-based query code. Prisma exists only for schema definition and `prisma generate`. Dev environment is Windows ARM64 (Snapdragon) — never suggest x64-specific binary fixes.

## Build & Development Commands

```bash
npm run build        # prisma generate && next build (use before deploy)
npm run lint         # ESLint
npm run db:seed      # Seed FAQ prompts via prisma/seed.ts
```

**The dev server is managed externally.** Never run `npm run dev`, kill node processes, or restart the server. Assume `localhost:3000` is always running.

No test suite exists. Always run `npm run build` to catch TypeScript errors before deploying.

## Architecture

### Database & Data Access

- **Schema**: `prisma/schema.prisma` — source of truth for all models
- **Client**: `src/lib/supabase.ts` — Supabase service-role client used in all API routes
- **Auth**: `src/lib/auth.ts` — NextAuth.js with CredentialsProvider (email/password, bcryptjs, JWT strategy). Role refreshed from DB on every request.
- **No ORM queries**: All data access uses `supabase.from("Table").select/insert/update/delete`. Prisma client is generated but only used for types.
- **MCP Integration**: Supabase MCP server is connected. When implementing features that require database changes (new tables, columns, enums, RLS policies), apply migrations directly via the MCP `apply_migration` tool instead of asking the user to run SQL manually. Use `execute_sql` for data queries and `list_tables` to inspect schema.

### User Roles

Four roles: `SEEKER`, `GUIDE`, `BOTH`, `ADMIN`. Role stored on User record, injected into JWT via NextAuth callbacks, accessible as `(session?.user as any)?.role`. Guide-only users (`role === "GUIDE"`) need to call `POST /api/user/upgrade-role` before accessing seeker features.

### Key Data Relationships (Supabase foreign key hints)

- Recordings/Series use `contributorId` → User (guide). FK hint: `User!Recording_contributorId_fkey`
- Calls use `patientId` (seeker) and `contributorId` (guide). FK hints: `User!Call_patientId_fkey`, `User!Call_contributorId_fkey`
- Profiles link 1:1 to User via `userId`
- Multi-procedure: `Profile.procedureTypes` (string array), `Profile.activeProcedureType`, `Profile.procedureProfiles` (JSON with per-procedure data)

### Matching Algorithm

`src/lib/matching.ts` — Weighted scoring (procedure 30%, activity 15%, goals 15%, age 10%, gender 10%, details 10%, complications 5%, lifestyle 5%). Applied when displaying recordings and guides to seekers.

### External Services

| Service | Config Location | Purpose |
|---------|----------------|---------|
| Stripe | `src/lib/stripe.ts` | Payments, Stripe Connect payouts (25% platform fee) |
| Resend | `src/lib/email.ts` | Transactional emails from `support@thekizu.com` |
| Daily.co | `src/lib/daily.ts` | Video call rooms |
| OpenAI Whisper | `src/lib/openai.ts` | Recording transcription |
| Supabase Storage | `src/lib/s3.ts` | Media file uploads via presigned URLs |

### Cron Jobs (vercel.json)

- `/api/cron/call-reminders` — daily at 8 AM UTC
- `/api/cron/review-requests` — every 30 minutes

All cron routes verify `Authorization: Bearer ${CRON_SECRET}`.

## Code Editing Rules

- Confirm the correct file path before making changes. The app has parallel dashboard structures: `src/app/dashboard/seeker/` vs `src/app/dashboard/guide/` — do NOT edit the wrong role's files.
- Role-specific components live in `src/components/seeker/` and `src/components/guide/`. Shared components in `src/components/`.
- API routes live in `src/app/api/`. Each route file exports named HTTP method handlers (`GET`, `POST`, `PATCH`, `DELETE`).

## Roles & Permissions

Role-based visibility logic must account for: JWT refresh after role changes, avoiding overly restrictive gating, and ensuring users can't interact with themselves (e.g., booking calls with themselves). When a guide-only user needs seeker features, their role must be upgraded to BOTH via the upgrade-role API before redirecting.

## Domain Logic / Business Rules

- Multi-procedure support: Guides can have multiple procedures stored in `procedureTypes` array. All should be visible and filterable. The "set as main procedure" feature is guide-side only.
- Recordings and series are free — no paywall. Payments exist for calls and group sessions only.
- Content moderation: `src/lib/content-moderation.ts`. Reports system with admin review at `/admin/reports`.
- Guide vetting: Guides apply via `/guide-application`, admin approves via `/admin`. Approved guides (`contributorStatus === "APPROVED"`) get auto-publish on recordings and series.

## Debugging Guidelines

- Investigate the full stack (database schema, enum values, API layer, and frontend) before proposing a fix. Do not assume the issue is only in the frontend. Check for missing database columns, enum values, and RLS policies first.
- When fixing date/time bugs, check whether the issue is server-side UTC conversion vs client-side display. Do not revert existing timezone fixes without understanding the full pipeline.

## UI / Styling

- Tailwind CSS 4 with no component library. All styling is utility classes.
- When implementing UI changes that need to match existing styling (badges, indicators, markers), read the existing component's exact Tailwind classes first and replicate them precisely. Do not approximate.
- Path alias: `@/*` maps to `./src/*`.

## Workflow Preferences

When the user asks to implement a feature that touches multiple user-facing surfaces (dashboards, navbars, settings), enumerate ALL files that need changes upfront in a plan before starting edits. Get user confirmation on the plan before proceeding.

## Deployment

Deployment target is Vercel. Run `npm run build` locally before pushing to catch TypeScript and lint errors. After deploying, remind the user to verify environment variables (Stripe keys, Supabase URL/anon key, Resend API key, CRON_SECRET, DAILY_API_KEY) are set in the Vercel dashboard. Missing env vars have caused non-functional features post-deploy.
