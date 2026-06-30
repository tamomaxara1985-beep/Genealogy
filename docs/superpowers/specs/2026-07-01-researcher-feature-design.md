# Researcher Feature Design

**Date:** 2026-07-01

## Problem

Users who want professional help building their family tree should be able to see a researcher assigned to them. Only administrators may assign and manage that researcher's information.

## Decisions

- **Storage:** embed a `researcher` sub-document on the `User` model (one researcher per user). The researcher is admin-entered information, not a platform account.
- **Admin management:** extend the existing admin Users table with a per-row Researcher action + dialog.
- **Profile display:** the user's own `/profile` page shows their assigned researcher (read-only), fetched server-side.
- **i18n:** new UI strings are hardcoded English, matching the existing person-profile relationship UI precedent (avoids three-locale churn and missing-key runtime errors).

---

## 1. Data model

`lib/models/User.ts` — add an optional `researcher` sub-document to `IUserDoc` and the schema; `types/index.ts` — mirror on the `IUser` DTO.

```ts
// shared shape
interface IResearcher {
  fullName: string
  contact: string                 // free-form: email / phone / preferred method
  notes?: string
  assignmentDate?: string         // ISO date string (YYYY-MM-DD)
  status: 'Assigned' | 'In Progress' | 'Completed'
}
```

Schema: a nested object with `fullName`/`contact` as `String, required` *within* the sub-document, `notes` optional `String`, `assignmentDate` optional `String`, `status` `String` enum `['Assigned','In Progress','Completed']` default `'Assigned'`. The whole `researcher` field is optional (absent = unassigned). No default on the sub-document itself, so a new user has no researcher.

`IUser` DTO gains `researcher?: IResearcher`. The `IResearcher` interface is exported from `types/index.ts`.

The admin users list (`GET /api/admin/users`) already returns full user docs minus `password`, so `researcher` is included automatically — no change needed there.

## 2. Admin API — `/api/admin/users/[userId]/researcher`

New file `app/api/admin/users/[userId]/researcher/route.ts`. Both handlers start with `getAdminSession()` → 403 if not an admin, then `connectDB()`.

- `PUT` — body `{ fullName, contact, notes?, assignmentDate?, status? }`:
  - Validate: `fullName` and `contact` are non-empty strings → else 400.
  - Validate: if `status` present it must be one of the enum → else 400. Default `status` to `'Assigned'` when omitted.
  - Default `assignmentDate` to today (`new Date().toISOString().slice(0,10)`) when omitted/empty.
  - `User.findByIdAndUpdate(userId, { $set: { researcher: {...} } }, { new: true, projection: { password: 0 } })`. 404 if no user. Return the updated user.
- `DELETE` — unassign: `User.findByIdAndUpdate(userId, { $unset: { researcher: 1 } }, { new: true, projection: { password: 0 } })`. 404 if no user. Return the updated user.

The existing role `PATCH` on `/api/admin/users/[userId]` is untouched.

## 3. Admin UI — extend the Users table

`app/(dashboard)/admin/users/page.tsx`:
- Extend the `AdminUser` interface with `researcher?: IResearcher`.
- Add a **Researcher** button in each row's action cell (next to delete). Clicking sets `researcherTarget = user` and seeds a form state from `user.researcher` (or blanks).
- A dialog (reusing the existing `Dialog` components) with fields:
  - Full name — text input (required)
  - Contact — text input (required), placeholder "email, phone, or preferred method"
  - Notes — textarea (optional)
  - Assignment date — date input (defaults to today when blank)
  - Status — `Select` with Assigned / In Progress / Completed
- **Save** → `PUT /api/admin/users/${id}/researcher` with the form; on ok `mutate()` + close.
- **Unassign** button (shown only when `user.researcher` exists) → `DELETE` the same URL; on ok `mutate()` + close.
- Disable Save while submitting; basic client guard that fullName + contact are filled.
- A small indicator in the row (e.g. the researcher's status or a dot) is optional; minimum is the button. Include a subtle status text in the row when assigned.

Strings hardcoded English.

## 4. Profile display — `/profile`

`app/(dashboard)/profile/page.tsx` (server component) currently shows name/email only. Add:
- After `auth()`, `connectDB()` and `User.findById(session.user.id, { researcher: 1 }).lean()` to read the current user's researcher.
- Render a **Researcher** `Card` below the existing profile card:
  - If `researcher` present: rows for Full name, Contact, Notes (if any), Assignment date (if any), and a Status badge (reuse `Badge`).
  - Else: muted text "No researcher assigned yet."
- Read-only — the user cannot edit. Strings hardcoded English.

Reading the User doc directly server-side avoids a new read endpoint.

## 5. Authorization summary

- Assign / edit / unassign: admin only, enforced by `getAdminSession()` in the API route. No client-only gating is trusted.
- View: the profile page reads only `session.user.id`'s own researcher.

---

## Out of scope (YAGNI)

- Researcher as a reusable shared entity across users.
- Researcher login / accounts.
- Multiple researchers per user.
- Separate structured email/phone fields (single free-form `contact`).
- i18n translations for the new strings (hardcoded English now).

## Testing

- Unit (Vitest): a small pure validator for the researcher PUT body (required fields, status enum, date default) if extracted; otherwise rely on manual verification.
- Manual: as admin, assign a researcher to a user via the Users table dialog → fields persist and prefill on re-open; change status; unassign. As that user, open `/profile` → researcher card shows the info; after unassign → "No researcher assigned yet." As a non-admin, `PUT/DELETE` the endpoint → 403.

## Files

- `lib/models/User.ts` — add `researcher` sub-document
- `types/index.ts` — add `IResearcher`, `IUser.researcher`
- `app/api/admin/users/[userId]/researcher/route.ts` (new) — PUT + DELETE
- `app/(dashboard)/admin/users/page.tsx` — Researcher button + dialog + unassign
- `app/(dashboard)/profile/page.tsx` — Researcher card (server-side read)
