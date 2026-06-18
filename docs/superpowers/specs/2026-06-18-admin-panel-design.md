# Admin Panel — Design Spec

**Date:** 2026-06-18  
**Status:** Approved  
**Scope:** Expand existing `/admin` into full admin panel with theme editor, content editor, generic collections CRUD, and charts dashboard.

---

## 1. Route Structure

Approach B: sub-route admin shell. Existing admin page (users + files tabs) split into dedicated pages under `/admin`.

```
app/(dashboard)/admin/
  layout.tsx                    ← extend: render AdminSidebar + <main>
  page.tsx                      ← redirect → /admin/dashboard
  dashboard/
    page.tsx                    ← stat cards + 4 shadcn charts
  theme/
    page.tsx                    ← color / font / size / radius editor
  content/
    page.tsx                    ← next-intl string override editor
  collections/
    page.tsx                    ← collection list (name + doc count)
    [collection]/
      page.tsx                  ← paginated table + CRUD
  users/
    page.tsx                    ← moved from current admin/page.tsx users tab
  files/
    page.tsx                    ← moved from current admin/page.tsx files tab
```

`AdminSidebar` nav links: Dashboard · Theme · Content · Collections · Users · Files

Auth guard unchanged: `app/(dashboard)/admin/layout.tsx` redirects non-admins to `/dashboard`.

---

## 2. Data Models

### SiteSettings (singleton — upserted, never inserted twice)

```ts
{
  primaryColor: string,       // oklch string e.g. "oklch(0.7 0.15 60)"
  fontFamily: string,         // "Inter" | "Roboto" | "Playfair Display" | "Lato" | "Merriweather"
  fontSize: "sm" | "md" | "lg" | "xl",  // base px: 14 | 16 | 18 | 20
  borderRadius: number,       // rem — maps to CSS --radius
  updatedAt: Date
}
```

### SiteContent (UI string overrides)

```ts
{
  locale: string,   // "en" | "he"
  key: string,      // next-intl message key e.g. "nav.dashboard"
  value: string,    // override text
  updatedAt: Date
}
// unique index: { locale, key }
```

---

## 3. API Routes

All routes: `await auth()` → 401 if unauthenticated, 403 if `role !== "admin"`.

### Stats
```
GET  /api/admin/stats
→ { counts: { users, trees, persons, events },
    registrations: [{ date, count }],       // last 30 days
    personsOverTime: [{ date, count }],     // last 30 days
    relationshipTypes: [{ type, count }],
    treesPerUser: [{ name, count }] }       // top 10
```

### Settings (Theme)
```
GET  /api/admin/settings       → SiteSettings doc (or defaults)
PUT  /api/admin/settings       → upsert SiteSettings
```

### Content
```
GET    /api/admin/content?locale=en       → SiteContent[] for locale
PUT    /api/admin/content                 → upsert { locale, key, value }
DELETE /api/admin/content/[id]            → remove override (reverts to JSON)
```

### Collections CRUD
```
GET    /api/admin/collections                           → [{ name, count }]
GET    /api/admin/collections/[name]?page=1&limit=20&q= → { docs, total, pages }
POST   /api/admin/collections/[name]                    → insert doc
PATCH  /api/admin/collections/[name]/[id]               → JSON merge update
DELETE /api/admin/collections/[name]/[id]               → delete doc
```

**Allowed collections allowlist** (hardcoded, no open reflection):
`users | trees | persons | relationships | events`

---

## 4. Theme Application

1. `app/layout.tsx` calls `getSiteSettings()` server-side (cached 60s via `unstable_cache`).
2. Renders inline `<style>` on `:root` overriding CSS custom properties:
   - `--primary` ← primaryColor
   - `--radius` ← borderRadius
   - `font-size` on `html` element ← fontSize scale (14/16/18/20px)
3. Font loaded via Google Fonts `<link>` in `<head>` based on saved fontFamily.
4. `font-family` injected directly on `html` element via inline style (not via `--font-sans` CSS var, which is circular in globals.css).
4. These override Tailwind v4's `:root` defaults at runtime without rebuilding CSS.

---

## 5. Content Override Application

1. `getMessages()` in `app/layout.tsx` fetches next-intl JSON messages normally.
2. `getSiteContent(locale)` fetches DB overrides for the locale.
3. Deep-merges DB overrides on top of JSON messages (DB wins).
4. Result passed to `NextIntlClientProvider`.

---

## 6. Charts Dashboard (`/admin/dashboard`)

**Stat cards (top row):** Total Users · Total Trees · Total Persons · Total Events

**Charts (2×2 grid):**

| Chart | shadcn Type | Data field |
|---|---|---|
| User Registrations | AreaChart | `registrations` — per day, last 30 days |
| Persons Added | LineChart | `personsOverTime` — per day, last 30 days |
| Relationship Types | PieChart | `relationshipTypes` — count by type |
| Trees per User | BarChart | `treesPerUser` — top 10 users |

Install: `npx shadcn add chart`

---

## 7. Theme Editor UI (`/admin/theme`)

- Color pickers (native `<input type="color">` + hex→oklch conversion via `culori` npm package) for `--primary`, `--accent`, `--background`
- Font family `<Select>`: Inter · Roboto · Playfair Display · Lato · Merriweather
- Font size `<Select>`: Small (14px) · Medium (16px) · Large (18px) · XL (20px)
- Border radius slider: 0rem → 1.5rem
- **Live preview panel** (right column): sample Card + Button + text rendered with current in-state values before save
- Save → PUT `/api/admin/settings` → router.refresh() re-fetches layout server component

---

## 8. Content Editor UI (`/admin/content`)

- Locale tabs: EN | HE | KA
- Searchable table: `key` column · `Default value` (from JSON) · `Override` (editable input)
- Row states: gray = using JSON default · amber highlight = has DB override
- Inline save on blur/Enter per row → PUT `/api/admin/content`
- Delete override icon → DELETE `/api/admin/content/[id]` → row reverts to gray
- Key list: static import from next-intl message JSON files (flattened to dot-notation keys)

---

## 9. Collections Browser UI

### `/admin/collections` — list
- Cards grid: name + doc count + "Browse →" per allowed collection

### `/admin/collections/[name]` — table
- Search bar (server-side `$regex` on string fields)
- Paginated data table — columns from first doc's keys, max 6 visible
- Row actions: **Edit** (JSON editor dialog) · **Delete** (confirm dialog)
- **+ New Document** button → JSON editor dialog with empty `{}`
- JSON editor: `<textarea>` + parse validation inline before submit
- Read-only fields in editor: `_id`, `__v`, `createdAt`, `updatedAt`
- Delete confirmation: requires typing collection name before confirming

---

## 10. Components to Create

| Component | Path |
|---|---|
| AdminSidebar | `components/admin/AdminSidebar.tsx` |
| StatCard | `components/admin/StatCard.tsx` |
| AdminCharts | `components/admin/AdminCharts.tsx` |
| ThemeEditor | `components/admin/ThemeEditor.tsx` |
| ContentEditor | `components/admin/ContentEditor.tsx` |
| CollectionTable | `components/admin/CollectionTable.tsx` |
| JsonEditorDialog | `components/admin/JsonEditorDialog.tsx` |
| ThemePreview | `components/admin/ThemePreview.tsx` |

---

## 11. Out of Scope

- Per-user theme preferences
- Visual layout drag-and-drop builder
- Bulk delete in collections browser
- New collection creation (only browse existing models)
- Marketing page CMS
