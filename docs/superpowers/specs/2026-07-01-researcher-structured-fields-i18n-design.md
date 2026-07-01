# Researcher — Structured Fields, Dashboard Display & i18n

**Date:** 2026-07-01

Supersedes the field model of `2026-07-01-researcher-feature-design.md`.

## Problem

The researcher information (admin-entered, one per user) must:
1. Use structured fields: **name, surname, email, phone, region of Georgia**.
2. Be visible on the user **dashboard** (in addition to the profile page).
3. Have its UI labels **and** region names translated to Georgian (`ka`) and Hebrew (`he`).

Only administrators may add/edit/unassign a researcher (unchanged authorization).

## Decisions

- **Region:** a dropdown of Georgia's named administrative regions. Stored as a stable **region code**; the human name is translated per locale. No free numeric input (avoids invalid values).
- **Field model:** replace the previous shape entirely. Drop `fullName`, free-form `contact`, `notes`, `assignmentDate`, `status`. New: `name`, `surname`, `email`, `phone`, `region`.
- **Dashboard:** add a researcher card to `DashboardClient`, sourced from an extended `/api/dashboard/stats` response. Keep the profile card too.
- **i18n:** use the existing next-intl setup (`en`/`ka`/`he`). New `researcher` and `regions` namespaces in all three message files.
- **Migration:** none. Existing dev researcher docs use the old shape; their name renders blank until an admin re-saves. YAGNI.

---

## 1. Region data — `lib/georgiaRegions.ts` (new)

```ts
export const REGION_CODES = [
  "tbilisi",
  "abkhazia",
  "adjara",
  "guria",
  "imereti",
  "kakheti",
  "kvemo-kartli",
  "mtskheta-mtianeti",
  "racha-lechkhumi",
  "samegrelo",
  "samtskhe-javakheti",
  "shida-kartli",
] as const;

export type RegionCode = (typeof REGION_CODES)[number];
```

Names are NOT stored here — they live in the `regions` message namespace, keyed by code. UI resolves a code to a name via `useTranslations("regions")` / `getTranslations("regions")`.

## 2. Data model

`lib/models/User.ts` — replace the `researcher` sub-document:

```ts
researcher?: {
  name: string
  surname: string
  email: string
  phone: string
  region: string   // one of REGION_CODES
}
```

Schema: nested `Schema` (`_id: false`) with all five fields `String, required`. The `researcher` field itself stays optional (absent = unassigned). No sub-document default.

`types/index.ts` — `IResearcher` becomes `{ name; surname; email; phone; region }`.

## 3. Validator — `lib/researcher.ts` (rewrite)

Remove `RESEARCHER_STATUSES`, `ResearcherStatus`, date/status/notes logic.

```ts
export interface ResearcherValue {
  name: string
  surname: string
  email: string
  phone: string
  region: string
}
```

`validateResearcher(input: unknown): Result`:
- Trim `name`, `surname`, `email`, `phone`, `region`.
- Each required non-empty → else `"<field> is required"`.
- `email` must match a basic shape (contains `@` with non-empty local + domain) → else `"invalid email"`.
- `region` must be in `REGION_CODES` → else `"invalid region"`.
- No `today` parameter anymore.

`lib/researcher.test.ts` — rewrite cases: all-fields-valid ok; each missing field errors; bad email errors; region not in list errors.

## 4. API — `app/api/admin/users/[userId]/researcher/route.ts`

- `PUT`: drop `const today = ...` and the `today` argument; call `validateResearcher(body)`. Rest unchanged (`getAdminSession` 403 guard, `$set researcher`, 404, return user minus password).
- `DELETE`: unchanged (`$unset researcher`).

## 5. Admin UI — `app/(dashboard)/admin/users/page.tsx`

- Remove `RESEARCHER_STATUSES` / `ResearcherStatus` import; import `REGION_CODES` from `@/lib/georgiaRegions`.
- `rForm` state → `{ name, surname, email, phone, region }`.
- `openResearcher` seeds from `user.researcher` (blanks otherwise).
- Dialog fields (labels from `t = useTranslations("researcher")`, region names from `tr = useTranslations("regions")`):
  - Name — `Input` (required)
  - Surname — `Input` (required)
  - Email — `Input type="email"` (required)
  - Phone — `Input type="tel"` (required)
  - Region — `Select`, options `REGION_CODES.map(c => <SelectItem value={c}>{tr(c)}</SelectItem>)` (required)
- Save guard: all five non-empty.
- Row status text (`user.researcher.status`) removed; keep the "Researcher" button. Optionally show a dot/name when assigned (minimum: button).
- Dialog title, buttons: use translated strings (`researcher.title`, `common.save`/`cancel`, etc.).

## 6. Profile card — `app/(dashboard)/profile/page.tsx`

- `getTranslations("researcher")` + `getTranslations("regions")`.
- `findById(..., { researcher: 1 })` unchanged.
- Render when present: `name surname`, email, phone, region name (`tRegions(researcher.region)`). Drop status badge and notes/date rows.
- Else: `t("none")`.

## 7. Dashboard card — `DashboardClient` + stats API

`app/api/dashboard/stats/route.ts`:
- Add `researcher` to the `User.findById(...).select("bio name researcher")` projection.
- Return `researcher: user?.researcher ?? null` in the JSON.

`components/dashboard/DashboardClient.tsx`:
- `Stats` interface gains `researcher: IResearcher | null`.
- Add `tRes = useTranslations("researcher")`, `tRegions = useTranslations("regions")`.
- New `Card` (below stats or below About) rendering the researcher like the profile card, or `tRes("none")` when null.

## 8. i18n — `messages/en.json`, `ka.json`, `he.json`

Add `researcher` namespace to each:

| key | en | ka | he |
|-----|----|----|----|
| title | Researcher | მკვლევარი | חוקר |
| name | Name | სახელი | שם |
| surname | Surname | გვარი | שם משפחה |
| email | Email | ელფოსტა | דוא"ל |
| phone | Phone | ტელეფონი | טלפון |
| region | Region | რეგიონი | אזור |
| none | No researcher assigned yet. | მკვლევარი ჯერ არ არის მინიჭებული. | טרם שובץ חוקר. |

Add `regions` namespace (keyed by code) to each:

| code | en | ka | he |
|------|----|----|----|
| tbilisi | Tbilisi | თბილისი | טביליסי |
| abkhazia | Abkhazia | აფხაზეთი | אבחזיה |
| adjara | Adjara | აჭარა | אג'ריה |
| guria | Guria | გურია | גוריה |
| imereti | Imereti | იმერეთი | אימרתי |
| kakheti | Kakheti | კახეთი | קחתי |
| kvemo-kartli | Kvemo Kartli | ქვემო ქართლი | קוומו קרטלי |
| mtskheta-mtianeti | Mtskheta-Mtianeti | მცხეთა-მთიანეთი | מצחתה-מתיאנתי |
| racha-lechkhumi | Racha-Lechkhumi and Kvemo Svaneti | რაჭა-ლეჩხუმი და ქვემო სვანეთი | רצ'ה-לצ'חומי וקוומו סוואנתי |
| samegrelo | Samegrelo-Zemo Svaneti | სამეგრელო-ზემო სვანეთი | סמגרלו-זמו סוואנתי |
| samtskhe-javakheti | Samtskhe-Javakheti | სამცხე-ჯავახეთი | סמצחה-ג'אווחתי |
| shida-kartli | Shida Kartli | შიდა ქართლი | שידה קרטלי |

## Authorization (unchanged)

- Add/edit/unassign: admin only, `getAdminSession()` in the API route.
- View: profile reads own `session.user.id` researcher; dashboard stats endpoint reads own user.

## Testing

- Unit (Vitest): rewritten `lib/researcher.test.ts` — valid input, each missing field, bad email, invalid region.
- Manual: as admin, assign researcher via Users dialog (region dropdown shows translated names) → persists, prefills on re-open; unassign. As user, `/profile` and `/dashboard` show name/surname/email/phone/region; region name changes with the language switcher (en/ka/he); after unassign → "No researcher assigned yet." Non-admin PUT/DELETE → 403.

## Files

- `lib/georgiaRegions.ts` (new) — `REGION_CODES`, `RegionCode`
- `lib/models/User.ts` — restructure `researcher` sub-document
- `types/index.ts` — restructure `IResearcher`
- `lib/researcher.ts` — rewrite validator
- `lib/researcher.test.ts` — rewrite tests
- `app/api/admin/users/[userId]/researcher/route.ts` — drop `today` arg
- `app/(dashboard)/admin/users/page.tsx` — structured fields + region select + translated labels
- `app/(dashboard)/profile/page.tsx` — structured card, translated region
- `app/api/dashboard/stats/route.ts` — include `researcher`
- `components/dashboard/DashboardClient.tsx` — researcher card
- `messages/en.json`, `messages/ka.json`, `messages/he.json` — `researcher` + `regions` namespaces
