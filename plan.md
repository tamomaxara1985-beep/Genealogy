# FamilyRoots — Genealogy Platform

Public genealogy site (like Ancestry.com / MyHeritage). Users build family trees, upload documents, share trees publicly.

## Tech Stack

- **Frontend:** Next.js 15 (App Router), Tailwind CSS, shadcn/ui, React Flow
- **Backend:** Next.js API Routes, Mongoose, MongoDB Atlas
- **Auth:** NextAuth v5 — email/password, Google, Facebook, magic link
- **AI:** Anthropic Claude (story generation, OCR extraction), Tesseract.js (OCR), GEDCOM parsing

## Phases

### Phase 1 — Frontend
- [ ] Scaffold Next.js + shadcn/ui + dependencies
- [ ] Shared TypeScript types
- [ ] Landing page
- [ ] Auth layout + login/register pages (UI only)
- [ ] Dashboard layout — Navbar + Sidebar
- [ ] PersonCard + PersonForm components
- [ ] Family tree canvas (React Flow + PersonNode)

### Phase 2 — Backend + Mongoose
- [ ] DB connection singleton (`lib/db.ts`)
- [ ] Models: User, Tree, Person, Event, Relationship
- [ ] Trees API (`/api/trees`, `/api/trees/[treeId]`)
- [ ] Persons API (`/api/trees/[treeId]/persons`, `/api/persons/[personId]`)
- [ ] Relationships API
- [ ] SWR hooks: `useTree`, `usePerson`
- [ ] Wire tree page to real data + AddPersonModal

### Phase 3 — Auth
- [ ] NextAuth v5 config with all providers
- [ ] Registration API (`/api/auth/register`)
- [ ] Wire login/register forms to NextAuth
- [ ] Middleware — protect dashboard routes

### Phase 4 — AI
- [ ] Story generation — Claude API → auto-bio per person
- [ ] Document OCR — Tesseract.js + Claude extraction
- [ ] GEDCOM parsing + AI match detection

### Phase 5 — Polish
- [ ] Public tree listing + read-only view
- [ ] Share toggle on tree edit page
- [ ] Build verification + env checklist

## Data Models

```
User       → name, email, password, image
Tree       → name, description, ownerId, isPublic
Person     → treeId, firstName, lastName, gender, birthDate/Place, deathDate/Place, isLiving, photoUrl, bio
Event      → personId, type (birth/death/marriage/...), date, place, documentUrls
Relationship → treeId, type (parent-child|spouse), person1Id, person2Id
```

## Key Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/login` `/register` | Auth |
| `/dashboard` | User's trees |
| `/trees/[treeId]` | Interactive tree canvas |
| `/person/[personId]` | Person profile + AI bio |
| `/dna` | GEDCOM upload + matching |
| `/public/trees` | Public tree discovery |

## AI Features

| Feature | Stack | Route |
|---------|-------|-------|
| Biography generation | Claude claude-sonnet-4-6 | `POST /api/ai/story` |
| Document OCR + extraction | Tesseract.js + claude-haiku-4-5 | `POST /api/ai/ocr` |
| GEDCOM / ancestry matching | GEDCOM parser + claude-haiku-4-5 | `POST /api/ai/dna` |

## Full Plan

See [`docs/superpowers/plans/2026-05-29-genealogy-tree.md`](docs/superpowers/plans/2026-05-29-genealogy-tree.md) for step-by-step tasks with code.
