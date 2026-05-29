# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (http://localhost:3000)
npm run build    # production build
npm run lint     # ESLint (flat config, Next.js CWV + TS rules)
```

No test runner configured yet.

## Stack

- **Next.js 16** App Router — read `node_modules/next/dist/docs/` before writing Next.js code; APIs differ from training data
- **React 19** with strict TypeScript
- **Tailwind CSS v4** — uses `@tailwindcss/postcss`, not the old `tailwindcss` plugin; `@import "tailwindcss"` in CSS, no `tailwind.config.js`
- **shadcn/ui** (base-nova style) — components in `components/ui/`, add via `npx shadcn add <component>`
- **Base UI** (`@base-ui/react`) — shadcn uses this as primitive layer; Button uses `render` prop not `asChild`
- **React Flow** (`@xyflow/react`) — family tree canvas
- **SWR** — data fetching (stubbed, awaiting backend)
- **MongoDB** (Phase 2) — Mongoose models planned; interfaces in `types/index.ts` reflect schema

## Path Alias

`@/*` maps to project root (not `src/`). Import as `@/components/...`, `@/lib/...`, `@/types`.

## Architecture

### Route Groups

```
app/
  (auth)/       — public auth pages, centered layout
  (dashboard)/  — protected shell: Navbar + Sidebar + main content
```

No auth middleware yet — `(dashboard)` routes are unprotected.

### Data Types

All shared interfaces live in `types/index.ts`: `IUser`, `ITree`, `IPerson`, `IEvent`, `IRelationship`. These mirror planned Mongoose schemas (MongoDB `_id: string`, timestamps). React Flow–specific types (`TreeNode`, `TreeEdge`) are also here.

### Family Tree Canvas

`components/tree/FamilyTree.tsx` — client component wrapping `ReactFlow` with amber theme. Custom node type `personNode` → `PersonNode.tsx`. Nodes have top (target) and bottom (source) handles for parent-child edges.

### Component Conventions

- Server components by default; add `"use client"` only when using hooks/events
- Controlled forms use a single `set(key, value)` pattern (see `PersonForm.tsx`)
- `cn()` from `lib/utils.ts` (clsx + tailwind-merge) for all className composition
- Amber color scheme: `#f59e0b` / `amber-*` Tailwind classes

### Planned Phases

- **Phase 2:** MongoDB + Mongoose, API routes, SWR hooks
- **Phase 3:** NextAuth v5 (Google, magic link)
- **Phase 4:** AI features — Claude Sonnet 4.6 for story generation, Claude Haiku 4.5 for OCR/GEDCOM, Tesseract.js
- **Phase 5:** Public tree sharing, GEDCOM import/export
