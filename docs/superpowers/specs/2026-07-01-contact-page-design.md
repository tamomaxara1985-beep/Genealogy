# Contact Page Feature Design

**Date:** 2026-07-01

## Problem

The site needs a dedicated, public Contact page with standard organization contact information, an embedded map, social links, and a "Contact Us" form. Submitted messages must be stored for admin review. Admins must be able to edit all contact information, business hours, map location, social links, and manage submitted messages.

## Decisions

- **Storage:** a `ContactInfo` singleton document (one row for the whole site, mirroring the existing `SiteSettings` pattern) + a `ContactMessage` collection for form submissions.
- **Map:** address-driven embed with no API key — `https://www.google.com/maps?q=<encoded>&output=embed` in an iframe, plus a "View on Google Maps" link. Admin edits a plain address / `mapQuery`.
- **Access:** the Contact page and form are public (no auth). Basic anti-spam via a hidden honeypot field.
- **Social links:** an admin-managed list of `{ platform, url }` rows; known platforms map to lucide icons.
- **i18n:** UI labels translated to English/Georgian/Hebrew (`en`/`ka`/`he`); the contact values themselves (address, hours, phone, etc.) are entered once by the admin, matching the researcher-feature precedent. `he` is RTL (already handled in root layout).
- **Aesthetic:** the public page follows the landing page look (parchment/amber palette, Fraunces display serif).

---

## 1. Data models

### `lib/models/ContactInfo.ts` — singleton

```ts
interface IContactHour { days: string; hours: string }        // e.g. { days: "Mon–Fri", hours: "9:00–18:00" }
interface IContactSocial { platform: string; url: string }    // platform ∈ SOCIAL_PLATFORMS

interface IContactInfoDoc extends Document {
  orgName: string
  address: string            // multiline, shown to users
  mapQuery: string           // optional; map embed uses mapQuery || address
  phone: string
  email: string
  hours: IContactHour[]
  socials: IContactSocial[]
  updatedAt: Date
}
```

Schema: all scalar fields `String` with `default: ""`; `hours` and `socials` are arrays of sub-schemas (`_id: false`) with `String` fields. `timestamps: true`. Hot-reload guard: `models.ContactInfo ?? model(...)`. No fields required at the schema level (a fresh site may have blanks); the admin PUT validator enforces shape.

### `lib/models/ContactMessage.ts`

```ts
interface IContactMessageDoc extends Document {
  fullName: string
  email: string
  subject: string
  message: string
  status: "new" | "read"
  createdAt: Date
  updatedAt: Date
}
```

Schema: `fullName`/`email`/`subject`/`message` `String, required`; `status` `String` enum `["new","read"]` default `"new"`; `timestamps: true`. Hot-reload guard.

## 2. Shared constants + validation — `lib/contact.ts`

```ts
export const SOCIAL_PLATFORMS = [
  "facebook", "x", "instagram", "linkedin", "youtube", "tiktok", "telegram", "whatsapp", "website",
] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]
```

Pure validators (no DB, unit-tested):

- `validateContactMessage(input): { ok: true; value: {fullName,email,subject,message} } | { ok: false; error }`
  - Trim all four; each required non-empty → else `"<field> is required"`.
  - `email` basic shape check (`@` not first/last, no spaces) → else `"invalid email"`.
  - Length caps: `fullName` ≤ 200, `email` ≤ 200, `subject` ≤ 200, `message` ≤ 5000 → else `"<field> too long"`.
- `validateContactInfo(input): { ok: true; value } | { ok: false; error }`
  - Coerce/trim scalars (`orgName`, `address`, `mapQuery`, `phone`, `email`); `email` optional but if present must pass shape check.
  - `hours`: array (default `[]`); keep only entries with a non-empty `days` or `hours`, trimmed; cap 20 rows.
  - `socials`: array (default `[]`); keep only entries whose `platform ∈ SOCIAL_PLATFORMS` and `url` non-empty (basic `http(s)://` prefix check); trimmed; cap 20 rows.
  - Returns the sanitized object with exactly the allow-listed fields.

`lib/contact.test.ts` — vitest: message valid/each-missing/bad-email/too-long; info sanitization (drops empty rows, drops unknown platform, rejects bad email, caps).

## 3. Public page — `app/contact/page.tsx` (server component)

- `connectDB()`, `ContactInfo.findOne().lean()` (null → render blanks / "not set" placeholders). `getTranslations("contact")`.
- Standalone public layout (not the dashboard shell): a light header with the FamilyRoots logo linking `/`, and a "Sign in" link. Parchment/amber background, Fraunces headings.
- **Info section:** org name; address (whitespace-pre-line); phone as `tel:` link; email as `mailto:` link; **hours** rendered as a small two-column table from `hours[]`; **socials** as a row of icon links (icon by `platform`, fallback generic link icon), `target="_blank" rel="noopener noreferrer"`.
- **Map section:** if `mapQuery || address` non-empty, an `<iframe>` with `src={https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed}`, `loading="lazy"`, titled; plus a "View on Google Maps" anchor to `https://www.google.com/maps?q=${encodeURIComponent(q)}`. If empty, omit.
- **Form:** rendered by `components/contact/ContactForm.tsx` (client).
- Responsive; inherits `dir` from root layout for RTL.

### `components/contact/ContactForm.tsx` (client)

- Controlled fields: `fullName`, `email`, `subject`, `message`; plus a visually hidden honeypot input named `company` (label off-screen, `tabIndex={-1}`, `autoComplete="off"`).
- Client validation mirrors the backend (non-empty + email shape) to disable submit / show inline messages.
- Submit → `POST /api/contact` with JSON `{ fullName, email, subject, message, company }`. On ok: clear form, show success message (`contact.sent`). On non-ok: show error (`contact.sendError`). Disable button while sending.
- Labels/placeholders/buttons via `useTranslations("contact")`.

## 4. Public API — `app/api/contact/route.ts`

`POST` only. No auth.
- Parse JSON body.
- **Honeypot:** if `company` is a non-empty string → return `200 { ok: true }` WITHOUT storing (silent drop).
- `validateContactMessage(body)` → `400 { error }` on failure.
- `connectDB()`, `ContactMessage.create(result.value)`.
- Return `200 { ok: true }`.

No rate limiting (YAGNI); honeypot is the anti-spam measure.

## 5. Admin API

All handlers: `getAdminSession()` → `403` if not admin, then `connectDB()`.

### `app/api/admin/contact-info/route.ts`
- `GET`: `ContactInfo.findOne().lean()` → return it or a blank default object `{ orgName:"", address:"", mapQuery:"", phone:"", email:"", hours:[], socials:[] }`.
- `PUT`: `validateContactInfo(body)` → 400 on fail; `ContactInfo.findOneAndUpdate({}, { $set: result.value }, { upsert: true, new: true }).lean()`; return it.

### `app/api/admin/contact-messages/route.ts`
- `GET`: `ContactMessage.find().sort({ createdAt: -1 }).lean()` → array.

### `app/api/admin/contact-messages/[id]/route.ts`
- `PATCH`: body `{ status }`; validate `status ∈ ["new","read"]` → 400 else; `findByIdAndUpdate(id, { $set: { status } }, { new: true })`; 404 if missing; return updated.
- `DELETE`: `findByIdAndDelete(id)`; 404 if missing; return `{ ok: true }`.

## 6. Admin page — `app/(dashboard)/admin/contact/page.tsx` (client)

Two sections on one page:

**Contact information editor**
- SWR `GET /api/admin/contact-info`; seed a form state.
- Inputs: orgName, address (textarea), mapQuery, phone, email.
- **Hours** editor: list of `{ days, hours }` rows with two inputs each; "Add row" and per-row remove.
- **Socials** editor: list of `{ platform, url }` rows — platform `Select` (SOCIAL_PLATFORMS), url `Input`; "Add row" and per-row remove.
- Save → `PUT /api/admin/contact-info`; on ok `mutate()` + a saved indicator. Disable while saving.

**Messages**
- SWR `GET /api/admin/contact-messages`; table newest-first: name, email, subject, date, status badge (`new` amber / `read` muted).
- Row click → dialog showing full message; buttons: **Mark read** (`PATCH status:"read"`, only when `new`) and **Delete** (`DELETE`, with confirm). `mutate()` after each.

### Sidebar
`components/admin/AdminSidebar.tsx` — add `{ href: "/admin/contact", label: t("contact"), icon: Mail }` to the links array.

## 7. i18n — `messages/{en,ka,he}.json`

Add a `contact` namespace with keys for: page title/intro, field labels (`orgName`, `address`, `phone`, `email`, `hours`, `map`, `viewOnMap`, `social`, `follow`), form labels (`formTitle`, `fullName`, `emailField`, `subject`, `message`, `send`, `sending`, `sent`, `sendError`), admin labels (`info`, `messages`, `addRow`, `remove`, `markRead`, `status`, `statusNew`, `statusRead`, `noMessages`, `platform`, `url`, `save`, `saved`, `notSet`). All three locales get identical keys with translated values. Social platform display names may reuse a `socials` sub-map keyed by platform code, or capitalize the code inline (decide in plan; default: capitalize the code, no per-platform translation).

Add `"contact": "Contact"` to the `admin` namespace (sidebar label) in all three locales, and a `"contact"` entry under `nav` if a landing link needs it.

## 8. Landing nav — `app/page.tsx`

Add a "Contact" link (to `/contact`) in the fixed top nav (next to Sign in) and in the footer. Styled to match existing nav buttons.

## 9. Authorization summary

- View Contact page + submit form: public.
- Edit contact info / manage messages: admin only, enforced by `getAdminSession()` in every admin route. No client-only gating trusted.
- Honeypot drops obvious bots silently.

## Out of scope (YAGNI)

- Email notification to admin on new submission (nodemailer exists; defer).
- CAPTCHA / rate limiting beyond honeypot.
- Replying to messages from the panel.
- Per-locale contact values (single canonical values only).

## Files

- `lib/models/ContactInfo.ts` (new)
- `lib/models/ContactMessage.ts` (new)
- `lib/contact.ts` (new) — `SOCIAL_PLATFORMS`, `validateContactMessage`, `validateContactInfo`
- `lib/contact.test.ts` (new)
- `app/contact/page.tsx` (new) — public page
- `components/contact/ContactForm.tsx` (new) — client form
- `app/api/contact/route.ts` (new) — public POST
- `app/api/admin/contact-info/route.ts` (new) — GET/PUT
- `app/api/admin/contact-messages/route.ts` (new) — GET
- `app/api/admin/contact-messages/[id]/route.ts` (new) — PATCH/DELETE
- `app/(dashboard)/admin/contact/page.tsx` (new) — admin editor + messages
- `components/admin/AdminSidebar.tsx` — add Contact link
- `app/page.tsx` — add Contact nav + footer link
- `messages/en.json`, `messages/ka.json`, `messages/he.json` — `contact` namespace + `admin.contact`
