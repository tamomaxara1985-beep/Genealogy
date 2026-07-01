# Global Researcher Info + In-App Access to Contact & Researcher

**Date:** 2026-07-02

## Problem

Every registered user must be able to view the organization's **Contact information** and **Researcher information** — no admin permission required — always showing the latest data the administrator manages. The current researcher feature is *per-user* (an admin assigns each user their own researcher). The requirement is a **single, global researcher** that all users see identically, like the contact section.

## Decisions

- **Researcher becomes a global singleton** (`ResearcherInfo`), admin-managed, viewed by all users — mirroring the existing `ContactInfo` / `SiteSettings` singleton pattern.
- **Replace** the per-user researcher entirely (remove the `User.researcher` sub-document, its admin dialog, and its profile/dashboard cards). No per-user researcher remains.
- **Access** for all registered users via **Sidebar links** to a new in-shell `/researcher` page and the existing public `/contact` page.
- **Reuse** the existing `lib/georgiaRegions.ts` `REGION_CODES`, the `researcher` and `regions` i18n namespaces, and the existing `validateResearcher` validator (its shape `{ name, surname, email, phone, region }` is exactly the global researcher shape).
- **Latest data:** both views read their singleton server-side on each request (no stale cache); admin edits reflect immediately.

---

## 1. New model — `lib/models/ResearcherInfo.ts` (singleton)

```ts
interface IResearcherInfoDoc extends Document {
  name: string
  surname: string
  email: string
  phone: string
  region: string      // one of REGION_CODES (validated on write)
  updatedAt: Date
}
```

Schema: all five fields `String, default: ""`; `timestamps: true`; hot-reload guard `models.ResearcherInfo ?? model(...)`. No fields required at schema level (a fresh site is blank); the admin PUT validator enforces shape.

## 2. Admin API — `app/api/admin/researcher-info/route.ts`

Both handlers: `getAdminSession()` → 403 if not admin, then `connectDB()`.

- `GET`: `ResearcherInfo.findOne().lean()` → return it, or blank default `{ name:"", surname:"", email:"", phone:"", region:"" }`.
- `PUT`: `validateResearcher(body)` (existing validator in `lib/researcher.ts`, arg-free, requires all five + region ∈ REGION_CODES + email shape) → 400 on failure; `ResearcherInfo.findOneAndUpdate({}, { $set: result.value }, { upsert: true, new: true }).lean()`; return it.

Mirrors `app/api/admin/contact-info/route.ts`. Stores only the validated `result.value` (allow-listed), never the raw body.

## 3. Admin page — `app/(dashboard)/admin/researcher/page.tsx` (client)

- SWR `GET /api/admin/researcher-info`; seed a form state `{ name, surname, email, phone, region }`.
- Inputs: name, surname, email (`type=email`), phone (`type=tel`); region `Select` over `REGION_CODES` with translated labels (`useTranslations("regions")`).
- Save → `PUT /api/admin/researcher-info`; on ok `mutate()` + saved indicator; disable while saving; client guard requires all five non-empty (mirrors validator).
- Labels via `useTranslations("researcher")`.
- Add to `components/admin/AdminSidebar.tsx`: `{ href: "/admin/researcher", label: t("researcher"), icon: Microscope }` (a generic lucide icon; NOT a brand icon).

## 4. User view — `app/(dashboard)/researcher/page.tsx` (server component)

- Renders inside the dashboard shell. Gates on login exactly like `profile/page.tsx`: `const session = await auth(); if (!session?.user) redirect("/login")`.
- `connectDB()`, `ResearcherInfo.findOne().lean()`, `getTranslations("researcher")` + `getTranslations("regions")`.
- If set: a `Card` with name+surname, email (`mailto:`), phone (`tel:`), translated region (`tRegions(region)`). If unset (or blank name): `researcher.none`.
- Always reflects the latest admin edit (read per request).

## 5. Sidebar links — `components/layout/Sidebar.tsx`

Add two entries to the `nav` array (visible to all users), after `profile`:
- `{ href: "/researcher", label: t("researcher"), icon: Microscope }`
- `{ href: "/contact", label: t("contact"), icon: Mail }`

Import `Microscope` and `Mail` from lucide (generic icons). `/contact` is the existing public page (renders its own standalone layout); navigating there from the Sidebar is acceptable and shows the same latest info.

## 6. Remove the per-user researcher (replace)

- `lib/models/User.ts` — remove the `researcher` sub-document from `IUserDoc` and the schema (revert `User` to its pre-researcher shape: `name, email, password?, image?, role, bio?`).
- `app/api/admin/users/[userId]/researcher/route.ts` — **delete** the file (and the now-empty `researcher/` directory).
- `app/(dashboard)/admin/users/page.tsx` — remove the researcher column header + name cell, the researcher action button, the researcher dialog, all researcher state/handlers (`researcherTarget`, `rForm`, `rValid`, `openResearcher`, `saveResearcher`, `unassignResearcher`), the `REGION_CODES`/`IResearcher`/`Microscope` imports used only by it, and the `researcher?` field on the `AdminUser` interface. Leave the role Select, delete dialog, and pagination intact. Update the empty-row `colSpan` back to `5`.
- `app/(dashboard)/profile/page.tsx` — remove the researcher `Card`, the `researcher` read (`User.findById(..., { researcher: 1 })`), and the `researcher`/`regions` translation loads used only by it. Keep the profile card.
- `components/dashboard/DashboardClient.tsx` — remove the researcher `Card`, the `researcher` field on the `Stats` interface, and the `tRes`/`tRegions` hooks + `IResearcher` import used only by it.
- `app/api/dashboard/stats/route.ts` — remove `researcher` from the `.select(...)` projection and from the returned JSON (revert to `bio name`).
- `types/index.ts` — keep `IResearcher = { name, surname, email, phone, region }` (now reused as the `ResearcherInfo` DTO shape); remove `IUser.researcher`.
- `lib/researcher.ts` + `lib/researcher.test.ts` — **keep unchanged**; `validateResearcher` is reused by the new admin API.

## 7. i18n — `messages/{en,ka,he}.json`

The `researcher` namespace already has `title, name, surname, email, phone, region, none` (and unused `add`/`edit` which may remain). Add:
- `nav.researcher` and `nav.contact` (Sidebar labels).
- `admin.researcher` (admin sidebar label).

| key | en | ka | he |
|-----|----|----|----|
| nav.researcher | Researcher | მკვლევარი | חוקר |
| nav.contact | Contact | კონტაქტი | צור קשר |
| admin.researcher | Researcher | მკვლევარი | חוקר |

(`admin.contact` already exists.)

## 8. Authorization summary

- View `/researcher` and `/contact`: any logged-in user (no admin needed). `/contact` is fully public.
- Edit researcher / contact info: admin only, `getAdminSession()` → 403 in the admin API routes; the admin pages sit under the admin-guarded layout.

## Out of scope (YAGNI)

- Migrating old per-user researcher data into the global record (dropped; admin re-enters once).
- Multiple researchers / researcher directory.
- Per-locale researcher values (single canonical values; labels + region names translated).

## Files

- `lib/models/ResearcherInfo.ts` (new)
- `app/api/admin/researcher-info/route.ts` (new)
- `app/(dashboard)/admin/researcher/page.tsx` (new)
- `app/(dashboard)/researcher/page.tsx` (new)
- `components/admin/AdminSidebar.tsx` — add Researcher link
- `components/layout/Sidebar.tsx` — add Researcher + Contact links
- `lib/models/User.ts` — remove `researcher` sub-doc
- `app/api/admin/users/[userId]/researcher/route.ts` — delete
- `app/(dashboard)/admin/users/page.tsx` — remove per-user researcher UI
- `app/(dashboard)/profile/page.tsx` — remove researcher card
- `components/dashboard/DashboardClient.tsx` — remove researcher card
- `app/api/dashboard/stats/route.ts` — remove researcher field
- `types/index.ts` — drop `IUser.researcher`, keep `IResearcher`
- `messages/en.json`, `messages/ka.json`, `messages/he.json` — add nav + admin labels
