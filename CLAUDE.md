# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build
npm run lint     # ESLint (flat config, Next.js CWV + TS rules)
```

Playwright is installed but no test suite configured yet.

## Environment

Required in `.env.local`:
```
MONGODB_URI=      # Atlas connection string (replica set, TLS)
AUTH_SECRET=      # NextAuth JWT signing key
AUTH_URL=         # e.g. http://localhost:3000
```

## Stack

- **Next.js 16** App Router — read `node_modules/next/dist/docs/` before writing Next.js code; APIs differ from training data
- **React 19** with strict TypeScript
- **Tailwind CSS v4** — `@import "tailwindcss"` in CSS, no `tailwind.config.js`, uses `@tailwindcss/postcss`
- **shadcn/ui** (base-nova style) — components in `components/ui/`, add via `npx shadcn add <component>`
- **Base UI** (`@base-ui/react`) — shadcn primitive layer; Button uses `render` prop not `asChild`
- **React Flow** (`@xyflow/react`) + **dagre** — family tree canvas with auto-layout
- **SWR** — data fetching via hooks in `hooks/`
- **MongoDB** via **Mongoose 9** — models in `lib/models/`, connection singleton in `lib/db.ts`
- **NextAuth v5** (beta.31) — Credentials provider, JWT sessions, custom `/login` page

## Path Alias

`@/*` maps to project root (not `src/`). Import as `@/components/...`, `@/lib/...`, `@/types`.

## Architecture

### Route Groups

```
app/
  (auth)/           — public pages, centered layout
    login/          — credentials sign-in
    register/       — new account (calls /api/auth/register, then user must log in separately)
  (dashboard)/      — shell with Navbar + Sidebar
    dashboard/      — overview
    trees/          — tree list + [treeId] canvas page
    person/[id]/    — person detail
    profile/, settings/, dna/
```

No `middleware.ts` — dashboard routes render without auth check in the UI. Auth is enforced at the API layer only.

### API Routes

All under `app/api/`. Every handler calls `await auth()` manually and returns 401 if no session — there is no middleware guard. Pattern:

```ts
const session = await auth()
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

Routes: `/api/auth/register`, `/api/auth/[...nextauth]`, `/api/trees`, `/api/trees/[treeId]`, `/api/trees/[treeId]/persons`, `/api/trees/[treeId]/relationships`, `/api/persons/[personId]`, `/api/persons/[personId]/events`.

### Data Layer

**Mongoose models** in `lib/models/`: `User`, `Tree`, `Person`, `Relationship`, `Event`. Each exports with hot-reload guard: `models.X ?? model("X", Schema)`. Doc interfaces (e.g. `IUserDoc`) extend `Document`; frontend DTO types live in `types/index.ts` (single source of truth).

**DB connection** (`lib/db.ts`): global singleton, `bufferCommands=false`, `minPoolSize=1`, pre-warmed at server start to eliminate cold-connect latency.

**Auth** (`lib/auth.ts`): NextAuth v5 Credentials provider. JWT callback injects `user.id` into token; session callback exposes `session.user.id`. Password hashing: bcryptjs 12 rounds in the register API route.

### Family Tree Canvas

`components/tree/FamilyTree.tsx` — client component. Layout via `lib/treeLayout.ts` (`applyDagreLayout`). Data built in `lib/buildTreeData.ts` which converts persons + relationships into `TreeNode[]` + `TreeEdge[]`.

**Couple node strategy**: first spouse pairing becomes a `CoupleNode` (used as edge source/target for children); additional spouses create individual `PersonNode`s. `useMemo` re-layout trigger is keyed on concatenated node/edge IDs, not object refs, to avoid thrashing.

Node types: `personNode` → `PersonNode.tsx`, `coupleNode` → `CoupleNode.tsx`. Handles: top = target (parent), bottom = source (child).

### Data Types

`types/index.ts`: `IUser`, `ITree`, `IPerson`, `IEvent`, `IRelationship`, `RelativeRole`, `TreeNode`, `TreeEdge`.

### Component Conventions

- Server components by default; `"use client"` only for hooks/events
- Controlled forms use single `set(key, value)` pattern (see `PersonForm.tsx`)
- `cn()` from `lib/utils.ts` (clsx + tailwind-merge) for all className composition
- Amber color scheme: `#f59e0b` / `amber-*` Tailwind classes

### Planned Phases

- **Phase 4:** AI features — Claude Sonnet 4.6 for story generation, Claude Haiku 4.5 for OCR/GEDCOM, Tesseract.js
- **Phase 5:** Public tree sharing, GEDCOM import/export
