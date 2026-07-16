# Genealogy Mobile (Expo) — v1 MVP Design

**Date:** 2026-07-16
**Status:** Approved design, pending implementation plan

## Goal

Ship a React Native (Expo) mobile app for the Genealogy product that reuses the
existing Next.js backend and API. v1 is a **read-mostly core viewer**: log in,
browse trees, view person detail, search, manage access requests, contact tree
owners. The interactive React Flow tree canvas, editing, admin, and AI features
are explicitly deferred.

## Key Decisions

| Area | Decision |
|------|----------|
| Scope | Core viewer MVP (read-mostly) |
| Auth | Self-issued Bearer JWT + shared cookie-OR-Bearer backend helper |
| Repo | `mobile/` Expo app in the existing repo; types re-exported from `../../types` |
| Framework | Expo managed workflow, expo-router (file-based) |
| Data | SWR + thin fetch wrapper |
| i18n | English-only UI for v1 (data in any language renders via Unicode) |

## 1. Architecture / Repo Layout

```
Genealogy/                (existing repo)
├── app/ lib/ types/      web + backend — mostly untouched
├── app/api/mobile/       NEW: mobile-specific endpoints (login)
├── lib/apiAuth.ts        NEW: shared cookie-OR-Bearer auth helper
└── mobile/               NEW: Expo app (own package.json, isolated deps)
    ├── app/              expo-router screens
    ├── lib/              api client, auth store/context
    └── types/            re-exports ../../types (single source of truth)
```

- Expo managed workflow. expo-router for file-based navigation (mirrors Next.js
  App Router mental model).
- SWR for data fetching (works in RN).
- `EXPO_PUBLIC_API_URL` points the app at the Next.js backend.
- `mobile/` has its own `package.json` so React Native / Expo deps never clash
  with the web app's Next.js deps.

## 2. Auth Flow + Backend Changes

### New endpoint: `POST /api/mobile/login`

- Accepts `{ email, password }`.
- Reuses the existing bcrypt verification logic (same as the Credentials
  provider `authorize` in `lib/auth.ts`).
- On success, issues a **signed JWT** via `jose` (`SignJWT`, HS256, signed with
  `AUTH_SECRET`), payload `{ sub: userId, role }`, ~30-day expiry.
- Returns `{ token, user }`.

> NextAuth's own session cookie is an encrypted JWE, not a plain JWT. We do NOT
> interoperate with it. The mobile token is a separate, self-issued JWT verified
> by our own helper. Web auth is completely untouched.

### New shared helper: `lib/apiAuth.ts` → `getAuthUser(req)`

Resolution order:
1. `await auth()` (cookie session). If present, return its user — the existing
   web path, unchanged.
2. Else read `Authorization: Bearer <jwt>`, verify with `AUTH_SECRET` via
   `jose.jwtVerify`, return `{ id, role }`.
3. Neither → `null` (caller returns 401).

### Route refactor

Change the MVP routes the app calls from
`const session = await auth(); if (!session) 401`
to
`const user = await getAuthUser(req); if (!user) 401`.

Routes touched:
- `/api/trees`
- `/api/trees/[treeId]`
- `/api/trees/[treeId]/persons`
- `/api/persons/[personId]`
- `/api/persons/[personId]/events`
- `/api/search`
- `/api/access-requests` and `/api/access-requests/[id]`
- `/api/trees/[treeId]/access-requests`
- `/api/trees/[treeId]/contact-owner`
- `/api/profile`

Mechanical change. Web keeps working because resolution path 1 still handles
cookie sessions.

### Mobile side

- Token stored in `expo-secure-store` (encrypted keychain/keystore), NOT
  AsyncStorage.
- Auth state in a small React context/store.
- Fetch wrapper injects `Authorization: Bearer <token>`.
- 401 response → clear token, bounce to Login.

### Security notes

- Token is signed, not merely encoded.
- `AUTH_SECRET` never leaves the server.
- Login endpoint should be rate-limited — flagged as a follow-up, not blocking
  v1.
- Google OAuth deferred; email/password only in v1.

## 3. Screens / Navigation (expo-router)

```
mobile/app/
├── _layout.tsx           root: auth gate → Login or Tabs
├── login.tsx             email/password
└── (tabs)/
    ├── _layout.tsx       bottom tabs
    ├── index.tsx         Trees — list (name, role badge)
    ├── search.tsx        Search — name/place, results w/ access badge
    ├── requests.tsx      Access requests — incoming + outgoing; approve/deny/cancel
    └── profile.tsx       profile + logout
mobile/app/tree/[treeId].tsx    persons list in a tree (flat/grouped list, NO canvas)
mobile/app/person/[id].tsx      person detail + events timeline + "contact owner"
```

Bottom tabs: Trees, Search, Requests, Profile.

Per-screen MVP calls:
- Trees → `GET /api/trees`
- Tree detail → `GET /api/trees/[treeId]/persons`
- Person → `GET /api/persons/[id]`, `GET /api/persons/[id]/events`; contact →
  `POST /api/trees/[treeId]/contact-owner`
- Search → `GET /api/search`
- Requests → `GET/POST/PATCH /api/access-requests` (+ `[id]`)
- Profile → `GET /api/profile`

**Tree is a list, not the React Flow canvas** — the single biggest cut for v1.
Persons render as a searchable list, optionally grouped by generation/surname.
The interactive graph is a future phase.

Read-mostly: no person create/edit in v1. Writes are limited to auth-adjacent
actions — login, access-request approve/deny/cancel, and contact-owner message.

## 4. Data Layer + Errors

### API client — `mobile/lib/api.ts`

Thin `fetch` wrapper:
- Base URL from `EXPO_PUBLIC_API_URL`.
- Injects `Authorization: Bearer <token>` from secure-store.
- Parses JSON; non-2xx → throws typed `ApiError { status, message }`.
- 401 → clears token and triggers logout (auth context listener).

### SWR

- `useSWR(key, fetcher)` where fetcher = the api client; keys are endpoint paths.
- Pull-to-refresh → `mutate()`.
- Mutations (approve/deny/contact) → call, then `mutate` affected keys.

### Types

`mobile/types` re-exports `../../types/index.ts` — zero drift. DTOs already
exist: `ITree`, `IPerson`, `IEvent`, `ISearchResult`, `IAccessRequestView`.

### Error UX

Each screen has loading / error-with-retry / empty states. Network failure →
inline banner, never a crash. Georgian/Hebrew data content renders fine
(Unicode); UI chrome is English-only for v1.

### Config

`mobile/.env` → `EXPO_PUBLIC_API_URL`. In dev this must be the LAN IP of the
Next.js dev server (a physical device cannot reach `localhost`). Documented in
the mobile README.

## 5. Testing + Build

- **Backend (vitest):**
  - `getAuthUser` — cookie path, valid Bearer, expired/tampered Bearer, missing → null.
  - `/api/mobile/login` — valid creds, bad creds, missing fields.
- **Mobile:** api client wrapper test (token injection, 401 handling, `ApiError`).
  Screen smoke via manual Expo Go run — no e2e suite in v1.
- **Manual verify:** run backend, `npx expo start` from `mobile/`, device on the
  same LAN; full flow login → trees → tree → person → search → request.
- **Build/dev:** run `npx expo start` from `mobile/`. Native builds via EAS are
  a future step.

## Out of Scope (v1, explicit)

React Flow tree canvas · person create/edit · AI chat · admin panel · Google
OAuth · Georgian/Hebrew UI + RTL · push notifications · offline cache · native
app-store submission.
