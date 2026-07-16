# PWA Support — FamilyRoots Web App — Design

**Date:** 2026-07-16
**Status:** Approved design, pending implementation plan

## Goal

Make the FamilyRoots Next.js web app an installable Progressive Web App with an
offline app shell: users can add it to their home screen / install it, launch it
standalone, and get a branded offline fallback when the network is unavailable.

Offline **data** (reading trees/persons without a connection) is explicitly out
of scope — API responses are never cached, so authenticated content is never
served stale.

## Key Decisions

| Area | Decision |
|------|----------|
| Scope | Installable + offline app shell (no offline data) |
| Service worker | Hand-written `public/sw.js` (no plugin) — immune to Turbopack/webpack-plugin issues |
| Icons | Generated emerald placeholder, rasterized from SVG via headless Chromium |
| Registration | Client component, **production-only** (avoids SW+Turbopack dev HMR breakage) |
| Manifest | Single `app/manifest.ts` (en/ltr); per-locale manifests out of scope |

## Stack Context

- Next.js 16 App Router (Turbopack), React 19, TypeScript, next-intl (en/ka/he,
  Hebrew RTL), dynamic theme/fonts from `lib/siteSettings`.
- No existing PWA assets, no app icons (only default Next SVGs in `public/`).
- Root layout `app/layout.tsx` sets `<html lang dir>` and `metadata`.
- Emerald brand color `#059669`.

> **Next 16 note:** before implementing, read the relevant guides under
> `node_modules/next/dist/docs/` (per repo AGENTS.md). Specifically confirm the
> `MetadataRoute.Manifest` shape, that `themeColor` belongs in an exported
> `viewport` object (not `metadata`), and app-icon/metadata conventions.

## Components

### 1. Web App Manifest — `app/manifest.ts`

A metadata route exporting a default function returning `MetadataRoute.Manifest`:

- `name`: "FamilyRoots — Discover Your Family History"
- `short_name`: "FamilyRoots"
- `description`: "Build, explore, and share your family tree with AI-powered tools"
- `start_url`: "/"
- `id`: "/"
- `display`: "standalone"
- `background_color`: "#ffffff"
- `theme_color`: "#059669"
- `lang`: "en"
- `dir`: "ltr"
- `icons`:
  - `{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" }`
  - `{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" }`
  - `{ src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }`

Next automatically injects `<link rel="manifest" href="/manifest.webmanifest">`.

### 2. Icons — generated emerald placeholder

Author one source SVG (512×512, emerald `#059669` background, simple white
roots/tree glyph). Rasterize via headless Chromium (the repo already has
Playwright + a Chromium browser cached) to `public/icons/`:

- `icon-192.png` (192×192)
- `icon-512.png` (512×512)
- `maskable-512.png` (512×512, glyph inset to ~80% for the maskable safe zone)
- `apple-touch-icon.png` (180×180)

These are placeholders; real brand art can be dropped in later by replacing the
files (paths are fixed).

### 3. Service Worker — `public/sw.js`

Hand-written, served from the origin root so its scope is the whole app. Plain
JS (not processed by the bundler). A versioned cache name (e.g.
`familyroots-shell-v1`) enables cache-busting on update.

- **install:** open the cache, precache the offline fallback (`/offline`) and the
  icon files; call `self.skipWaiting()`.
- **activate:** delete caches whose name is not the current version; call
  `self.clients.claim()`.
- **fetch (GET only):**
  - Ignore non-GET requests and any request to `/api/*` — always go to the
    network (never cache authenticated API data).
  - **Navigation requests** (`request.mode === "navigate"`): network-first. On
    network failure, serve the cached `/offline` page.
  - **Static assets** (`/_next/static/*`, `/icons/*`, other same-origin static
    GET): cache-first with stale-while-revalidate (serve cache, update in
    background).
  - Everything else: pass through to network.

### 4. Service Worker Registration — `components/pwa/RegisterSW.tsx`

A `"use client"` component with a `useEffect` that:
- Runs only when `process.env.NODE_ENV === "production"` and
  `"serviceWorker" in navigator`.
- Registers `/sw.js`.
- Is a no-op render (returns `null`).

Mounted once in `app/layout.tsx` `<body>`. Production-only guard prevents the SW
from caching dev assets and breaking Turbopack HMR.

### 5. Offline Fallback — `app/offline/page.tsx`

A minimal, self-contained branded page ("You're offline — reconnect to keep
exploring your family tree") using the emerald palette. Must not depend on
runtime data or network. Precached by the SW during install.

### 6. Metadata / Viewport — `app/layout.tsx`

- Add `export const viewport: Viewport = { themeColor: "#059669" }`.
- Extend `metadata` with:
  - `appleWebApp: { capable: true, title: "FamilyRoots", statusBarStyle: "default" }`
  - `icons` including the apple-touch icon (`/icons/apple-touch-icon.png`).
- `manifest` link is emitted automatically by `app/manifest.ts` — no manual tag.

## Testing / Verification

- **Build:** `npm run build` succeeds; `/manifest.webmanifest` and `/offline`
  are generated.
- **Manifest served:** `curl` `/manifest.webmanifest` returns valid JSON with the
  icons.
- **Icons:** the four PNGs exist with correct dimensions.
- **SW served:** `curl /sw.js` returns the script with `Content-Type`
  JavaScript.
- **Offline shell:** in a production run, load the app, then simulate offline and
  confirm navigations fall back to `/offline`; confirm `/api/*` is never served
  from cache. (Manual, via browser devtools Application/Network panels.)
- **Install:** Chrome shows the install prompt / "Installable" in Lighthouse PWA
  audit.

## Out of Scope

Offline data / cached API reads · push notifications · background sync ·
periodic sync · per-locale (ka/he) manifests · app-shortcuts · share-target ·
custom install-prompt UI.
