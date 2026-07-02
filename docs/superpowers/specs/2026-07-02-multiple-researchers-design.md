# Multiple Researchers + Multilingual Names + "Georgia" Region

**Date:** 2026-07-02
**Status:** Approved design, pending implementation plan

## Problem

Today the app has a single global researcher (`ResearcherInfo`, one document, upserted).
We need:

1. **Many researchers**, not one — a flat list the admin manages; the user-facing
   `/researcher` page shows all of them as cards.
2. **Multilingual name/surname** — each researcher's name and surname stored in
   English, Georgian (`ka`), and Hebrew (`he`), entered manually by the admin.
   Display uses the viewer's current locale with English fallback.
3. **"Georgia" region option** — add a `"georgia"` region (the whole country)
   selectable alongside the existing 12 Georgian regions.

UI chrome is already trilingual via next-intl (`en`/`ka`/`he`) — no change needed there.
Only researcher *data* becomes multilingual.

## Non-Goals (YAGNI)

- No per-researcher ordering / drag-sort (flat list, sorted by `createdAt`).
- No region-based filtering or grouping on the user page (show all).
- No auto-translation / transliteration — admin types each language by hand.
- No new locales beyond the existing three.

## Data Model

Rename model `ResearcherInfo` → `Researcher` (concept shifts from "the global info
record" to "a researcher entry"; the collection becomes `researchers`).

```ts
interface LocalizedName { en: string; ka: string; he: string }

interface IResearcherDoc extends Document {
  name:    LocalizedName;   // en required; ka/he optional (default "")
  surname: LocalizedName;   // en required; ka/he optional (default "")
  email:   string;
  phone:   string;
  region:  string;          // one of REGION_CODES ∪ {"georgia"}
  createdAt: Date;          // timestamps: true
  updatedAt: Date;
}
```

Subdocument shape: `{ en: { type: String, default: "" }, ka: ..., he: ... }`, `_id: false`.

**Display rule (both pages):** `name[locale] || name.en` (same for surname).

## Region "Georgia"

- `lib/georgiaRegions.ts`: add `"georgia"` to `REGION_CODES`. Put it **first** so it
  reads as "whole country" above the sub-regions.
- `messages/en.json` `regions.georgia` = `"Georgia"`
- `messages/ka.json` `regions.georgia` = `"საქართველო"`
- `messages/he.json` `regions.georgia` = `"גאורגיה"` (the country; not ג'ורג'יה, which reads as the US state / the name George)
- `validateResearcher` already checks `REGION_CODES.includes(region)`, so adding the
  code makes `"georgia"` valid automatically.

## Validation (`lib/researcher.ts`)

Update `ResearcherValue` and `validateResearcher` for the new shape:

- `name.en` and `surname.en` **required** (English is the fallback, so it must exist).
- `ka` / `he` optional — trimmed, default `""`.
- `email` required + `isEmail`, `phone` required (unchanged).
- `region` required + must be in `REGION_CODES` (now includes `"georgia"`).

Return `{ ok: true, value: { name:{en,ka,he}, surname:{en,ka,he}, email, phone, region } }`.

## API

Replace the single-doc route with a collection.

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET    | `/api/admin/researchers`        | admin | list all (sorted `createdAt` asc) |
| POST   | `/api/admin/researchers`        | admin | create one (validated) |
| PUT    | `/api/admin/researchers/[id]`   | admin | update one (validated) |
| DELETE | `/api/admin/researchers/[id]`   | admin | delete one |
| GET    | `/api/researchers`              | authed user | public list for `/researcher` page |

- Admin routes use `getAdminSession()` → 403 if not admin (existing pattern).
- User GET requires a session (existing dashboard-API pattern) and returns the same
  list; it is read-only.
- Delete the old `app/api/admin/researcher-info/route.ts`.

## Admin Page (`/admin/researcher`)

Convert single form → list + editor:

- Fetch list via SWR from `/api/admin/researchers`.
- Render each researcher as a row/card: display name (current locale, en fallback),
  region, email; **Edit** and **Delete** buttons.
- **"Add researcher"** button (key `researcher.add`, already exists) opens a blank form.
- Editor form fields:
  - Name — three inputs: English / Georgian / Hebrew
  - Surname — three inputs: English / Georgian / Hebrew
  - Email, Phone
  - Region `Select` — maps over `REGION_CODES` (now includes `georgia`), labels via
    `tRegions(code)` (unchanged pattern).
- Save → POST (new) or PUT (existing `_id`). Delete → DELETE, then `mutate()`.
- Client locale for display: `useLocale()` from next-intl.

## User Page (`/researcher`)

Convert single card → grid of cards:

- Server component. Fetch all via `Researcher.find().sort({ createdAt: 1 }).lean()`.
- Locale via `getLocale()` from `next-intl/server`.
- Empty state: `researcher.none` (existing key) when list empty.
- Each card: `name[locale] || name.en` + surname, email (mailto), phone (tel),
  region (`tRegions(region)`). Reuses existing field-label keys.

## i18n Keys

Add to all three `messages/*.json`:

- `regions.georgia` (values above).
- Name-language sub-labels for the admin form, e.g. under `researcher`:
  `nameEn`, `nameKa`, `nameHe`, `surnameEn`, `surnameKa`, `surnameHe`
  (English wording: "Name (English)", "Name (Georgian)", "Name (Hebrew)", etc.;
  translated appropriately in ka/he).
- `researcher.delete` confirm label if a confirm dialog is used (optional — can reuse
  `common.delete`).

## Migration

One existing single doc → new collection.

- One-off migration script (e.g. `scripts/migrate-researchers.mjs`) run manually once:
  1. Connect via existing `MONGODB_URI`.
  2. Read the old `researcherinfos` collection's single doc (if any).
  3. Insert into `researchers`: `name = { en: oldName, ka: "", he: "" }`,
     `surname = { en: oldSurname, ka: "", he: "" }`, copy `email`, `phone`, `region`.
  4. Log inserted `_id`; leave old collection in place (manual drop later).
- Idempotency: skip if a `researchers` doc with the same `email` already exists.

## Files Touched

| File | Change |
|------|--------|
| `lib/models/ResearcherInfo.ts` | rename → `lib/models/Researcher.ts`, new schema |
| `lib/researcher.ts` | new `ResearcherValue` + validation for localized names |
| `lib/georgiaRegions.ts` | add `"georgia"` code (first) |
| `types/index.ts` | `IResearcher` → localized name/surname + `_id` |
| `app/api/admin/researcher-info/route.ts` | delete |
| `app/api/admin/researchers/route.ts` | new — GET list, POST create |
| `app/api/admin/researchers/[id]/route.ts` | new — PUT, DELETE |
| `app/api/researchers/route.ts` | new — GET list (user) |
| `app/(dashboard)/admin/researcher/page.tsx` | list + multi-lang editor |
| `app/(dashboard)/researcher/page.tsx` | grid of cards, localized display |
| `messages/en.json`, `ka.json`, `he.json` | `regions.georgia` + name sub-labels |
| `scripts/migrate-researchers.mjs` | new one-off migration |

## Testing

- Manual: `npm run dev`, add 2+ researchers with all three name languages + `georgia`
  region; switch locale via existing switcher; verify names + region label change and
  fall back to English when ka/he blank.
- Validation: POST with empty `name.en` → 400; invalid region → 400; non-admin → 403.
- `npm run build` + `npm run lint` clean.
