# PWA Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the FamilyRoots Next.js web app an installable PWA with an offline app shell (installable + branded offline fallback; no offline data).

**Architecture:** Native Next 16 metadata route for the manifest, generated emerald placeholder icons, a hand-written `public/sw.js` (no build-plugin, Turbopack-safe) that network-firsts navigations with an offline fallback and cache-firsts static assets, registered by a production-only client component. `/api/*` is never cached.

**Tech Stack:** Next.js 16 App Router (Turbopack), React 19, TypeScript. Icons rasterized with the repo's existing Playwright + Chromium. No new runtime dependencies.

## Global Constraints

- Brand color emerald **`#059669`**; manifest `background_color` **`#ffffff`**.
- Service worker MUST skip non-GET requests and all `/api/*` requests (never cache authenticated data).
- SW registration MUST be gated to `process.env.NODE_ENV === "production"` (SW caching breaks Turbopack dev HMR).
- `themeColor` goes in an exported `viewport: Viewport` object (NOT in `metadata`) — Next 16 requirement. `metadata` and `viewport` may both be exported from `app/layout.tsx`.
- `app/manifest.ts` exports `default function manifest(): MetadataRoute.Manifest`; Next auto-emits `<link rel="manifest" href="/manifest.webmanifest">` — do NOT add a manual manifest link.
- No automated test surface (assets/config/SW/RSC) — verification is `npm run build` + `curl` + manual browser checks. There is no vitest to add; do not fabricate unit tests.
- Icon files live at fixed paths under `public/icons/` so real brand art can replace them later.
- Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md` and `.../04-functions/generate-viewport.md` before editing metadata (already summarized in the spec).
- **Env hygiene:** a `next dev` server may already be running on :3000 — stop it before any `npm run build`/`npm run start` step (port clash). Mixing `next build` and `next dev` against the same `.next` corrupts it (→ `/api/*` 404s, NextAuth "Unexpected token '<'"); if that appears, delete the whole `.next` directory and rebuild.

---

## Task 1: Generate emerald placeholder icons

Author two source SVGs and a rasterizer; produce the four PNGs. Commit both the sources (for regeneration) and the PNGs.

**Files:**
- Create: `scripts/pwa-icons/icon.svg`
- Create: `scripts/pwa-icons/maskable.svg`
- Create: `scripts/pwa-icons/rasterize.mjs`
- Create (generated): `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/maskable-512.png`, `public/icons/apple-touch-icon.png`

**Interfaces:**
- Produces: the four PNG files at the paths above (consumed by Tasks 2 & 4).

- [ ] **Step 1: Create the primary icon SVG**

Create `scripts/pwa-icons/icon.svg` (512×512, emerald field, white tree-with-roots glyph filling most of the canvas):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#059669"/>
  <g fill="none" stroke="#ffffff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">
    <!-- trunk -->
    <path d="M256 150 V330"/>
    <!-- upper branches -->
    <path d="M256 210 L196 160"/>
    <path d="M256 210 L316 160"/>
    <path d="M256 260 L188 216"/>
    <path d="M256 260 L324 216"/>
    <!-- roots -->
    <path d="M256 330 L196 392"/>
    <path d="M256 330 L316 392"/>
    <path d="M256 330 L150 360"/>
    <path d="M256 330 L362 360"/>
  </g>
  <g fill="#ffffff">
    <circle cx="196" cy="160" r="20"/>
    <circle cx="316" cy="160" r="20"/>
    <circle cx="188" cy="216" r="18"/>
    <circle cx="324" cy="216" r="18"/>
    <circle cx="256" cy="150" r="22"/>
  </g>
</svg>
```

- [ ] **Step 2: Create the maskable SVG (glyph inset for the safe zone)**

Create `scripts/pwa-icons/maskable.svg` — same artwork but scaled to ~72% and centered so it survives maskable cropping; full-bleed emerald background:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#059669"/>
  <g transform="translate(256 256) scale(0.72) translate(-256 -256)">
    <g fill="none" stroke="#ffffff" stroke-width="26" stroke-linecap="round" stroke-linejoin="round">
      <path d="M256 150 V330"/>
      <path d="M256 210 L196 160"/>
      <path d="M256 210 L316 160"/>
      <path d="M256 260 L188 216"/>
      <path d="M256 260 L324 216"/>
      <path d="M256 330 L196 392"/>
      <path d="M256 330 L316 392"/>
      <path d="M256 330 L150 360"/>
      <path d="M256 330 L362 360"/>
    </g>
    <g fill="#ffffff">
      <circle cx="196" cy="160" r="20"/>
      <circle cx="316" cy="160" r="20"/>
      <circle cx="188" cy="216" r="18"/>
      <circle cx="324" cy="216" r="18"/>
      <circle cx="256" cy="150" r="22"/>
    </g>
  </g>
</svg>
```

- [ ] **Step 3: Create the rasterizer script**

Create `scripts/pwa-icons/rasterize.mjs` (uses the repo's Playwright + Chromium; renders each SVG at the target size and screenshots it):

```js
import pw from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const jobs = [
  { svg: "icon.svg", size: 192, out: "icon-192.png" },
  { svg: "icon.svg", size: 512, out: "icon-512.png" },
  { svg: "icon.svg", size: 180, out: "apple-touch-icon.png" },
  { svg: "maskable.svg", size: 512, out: "maskable-512.png" },
];

const browser = await pw.chromium.launch();
const page = await browser.newPage();
for (const job of jobs) {
  const svg = readFileSync(join(here, job.svg), "utf8");
  const b64 = Buffer.from(svg).toString("base64");
  await page.setViewportSize({ width: job.size, height: job.size });
  await page.setContent(
    `<html><body style="margin:0;padding:0">
       <img width="${job.size}" height="${job.size}"
            src="data:image/svg+xml;base64,${b64}"/>
     </body></html>`,
    { waitUntil: "networkidle" }
  );
  await page.screenshot({
    path: join(outDir, job.out),
    clip: { x: 0, y: 0, width: job.size, height: job.size },
    omitBackground: false,
  });
  console.log("wrote", job.out, `${job.size}x${job.size}`);
}
await browser.close();
```

- [ ] **Step 4: Run the rasterizer**

Run from repo root: `node scripts/pwa-icons/rasterize.mjs`
Expected: prints four `wrote ...` lines; `public/icons/` now holds the four PNGs.

- [ ] **Step 5: Verify the PNG dimensions**

Run: `node -e "const{readdirSync,readFileSync}=require('fs');for(const f of readdirSync('public/icons')){const b=readFileSync('public/icons/'+f);const w=b.readUInt32BE(16),h=b.readUInt32BE(20);console.log(f,w+'x'+h)}"`
Expected:
```
apple-touch-icon.png 180x180
icon-192.png 192x192
icon-512.png 512x512
maskable-512.png 512x512
```
(PNG width/height live at byte offsets 16/20 in the IHDR chunk.)

- [ ] **Step 6: Commit**

```bash
git add scripts/pwa-icons public/icons
git commit -m "feat: generate emerald PWA placeholder icons"
```

---

## Task 2: Web app manifest + viewport/metadata

Add the manifest route and wire theme-color + apple metadata in the root layout. This makes the app installable.

**Files:**
- Create: `app/manifest.ts`
- Modify: `app/layout.tsx` (add `viewport` export; extend `metadata`)

**Interfaces:**
- Consumes: icon PNGs from Task 1.
- Produces: `/manifest.webmanifest` (auto-linked by Next); `theme-color`, apple-web-app, and apple-touch-icon `<meta>`/`<link>` tags.

- [ ] **Step 1: Create the manifest route**

Create `app/manifest.ts`:

```ts
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FamilyRoots — Discover Your Family History",
    short_name: "FamilyRoots",
    description: "Build, explore, and share your family tree with AI-powered tools",
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#059669",
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
```

- [ ] **Step 2: Add `viewport` export and extend `metadata` in `app/layout.tsx`**

In `app/layout.tsx`, change the `next` type import and the metadata block. Replace:

```ts
import type { Metadata } from "next"
```
with:
```ts
import type { Metadata, Viewport } from "next"
```

Then replace the existing `metadata` export:

```ts
export const metadata: Metadata = {
  title: "FamilyRoots — Discover Your Family History",
  description: "Build, explore, and share your family tree with AI-powered tools",
}
```
with:

```ts
export const metadata: Metadata = {
  title: "FamilyRoots — Discover Your Family History",
  description: "Build, explore, and share your family tree with AI-powered tools",
  appleWebApp: {
    capable: true,
    title: "FamilyRoots",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#059669",
}
```

Leave the rest of the layout (html lang/dir, head links, providers) unchanged.

- [ ] **Step 3: Build and verify the manifest + meta tags**

Run: `npm run build`
Expected: build succeeds with no type errors.

Then run: `npm run start` in the background and:
```bash
curl -s http://localhost:3000/manifest.webmanifest
```
Expected: JSON containing `"short_name":"FamilyRoots"`, `"theme_color":"#059669"`, and the three icons. Then:
```bash
curl -s http://localhost:3000/ | grep -oE '<meta name="theme-color"[^>]*>|<link rel="manifest"[^>]*>|apple-touch-icon'
```
Expected: a `theme-color` meta with `#059669`, a `rel="manifest"` link to `/manifest.webmanifest`, and an `apple-touch-icon` reference. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add app/manifest.ts app/layout.tsx
git commit -m "feat: web app manifest, theme-color, and apple PWA metadata"
```

---

## Task 3: Offline fallback page

A self-contained branded page the SW serves when a navigation fails offline.

**Files:**
- Create: `app/offline/page.tsx`

**Interfaces:**
- Produces: route `/offline` (precached by the SW in Task 4).

- [ ] **Step 1: Create the offline page**

Create `app/offline/page.tsx` (server component, no data/network dependencies, inline styles so it renders without external CSS if needed):

```tsx
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Offline — FamilyRoots",
}

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 24,
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: "#059669",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 36,
          fontWeight: 700,
        }}
      >
        FR
      </div>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>You&apos;re offline</h1>
      <p style={{ color: "#4b5563", maxWidth: 360, margin: 0 }}>
        Reconnect to keep exploring your family tree. This page works without a
        connection, but your data needs the network.
      </p>
    </main>
  )
}
```

- [ ] **Step 2: Build and verify the route renders**

Run: `npm run build`
Expected: build succeeds; output lists `/offline` as a route.

With `npm run start` running:
```bash
curl -s http://localhost:3000/offline | grep -o "You&#x27;re offline\|You're offline\|offline"
```
Expected: matches the offline heading text. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add app/offline/page.tsx
git commit -m "feat: offline fallback page"
```

---

## Task 4: Service worker + registration (offline shell)

The hand-written SW plus its production-only registrar. This completes the offline shell.

**Files:**
- Create: `public/sw.js`
- Create: `components/pwa/RegisterSW.tsx`
- Modify: `app/layout.tsx` (mount `<RegisterSW />` in `<body>`)

**Interfaces:**
- Consumes: `/offline` (Task 3), icon PNGs (Task 1).
- Produces: registered service worker controlling the origin.

- [ ] **Step 1: Create the service worker**

Create `public/sw.js` (plain JS, not bundled; served at origin root so scope = whole app):

```js
// FamilyRoots service worker — offline app shell.
// Bump CACHE version to invalidate old precaches on deploy.
const CACHE = "familyroots-shell-v1";
const OFFLINE_URL = "/offline";
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET; never cache API responses.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigations: network-first, fall back to the cached offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE).then((cache) => cache.match(OFFLINE_URL))
      )
    );
    return;
  }

  // Static assets: cache-first with background revalidation.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
```

- [ ] **Step 2: Create the registration component**

Create `components/pwa/RegisterSW.tsx`:

```tsx
"use client"

import { useEffect } from "react"

export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal; the app still works online.
      })
    }
    window.addEventListener("load", onLoad)
    return () => window.removeEventListener("load", onLoad)
  }, [])

  return null
}
```

- [ ] **Step 3: Mount `<RegisterSW />` in the root layout**

In `app/layout.tsx`, add the import near the other component imports:

```ts
import { RegisterSW } from "@/components/pwa/RegisterSW"
```

Then render it inside `<body>`, just before the `NextIntlClientProvider` (or anywhere inside `<body>`):

```tsx
      <body>
        <RegisterSW />
        <NextIntlClientProvider locale={locale} messages={mergedMessages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
```

- [ ] **Step 4: Build and verify the SW is served + lint**

Run: `npm run build && npm run lint`
Expected: both succeed, no type/lint errors.

With `npm run start` running:
```bash
curl -s -I http://localhost:3000/sw.js | grep -iE "HTTP/|content-type"
```
Expected: `200` and a JavaScript content-type. Then confirm the registrar is present in the served HTML:
```bash
curl -s http://localhost:3000/ | grep -c "serviceWorker" || echo "note: registration runs client-side; grep may be 0 if minified"
```
(Informational — the effect is client-side.)

- [ ] **Step 5: Manual offline-shell verification (browser)**

Instructions to run manually (production mode is required — SW is gated to prod):
1. `npm run build && npm run start`.
2. Open `http://localhost:3000`, sign in, load a page.
3. DevTools → Application → Service Workers: confirm `sw.js` is **activated**.
4. DevTools → Network → set **Offline**. Navigate to a new route.
   Expected: the branded `/offline` page appears (not the browser error page).
5. Confirm in the Network panel that `/api/*` requests are **not** served from
   the SW cache (they fail/normal when offline, are never stale).
6. Lighthouse → PWA category: "Installable" passes.

- [ ] **Step 6: Commit**

```bash
git add public/sw.js components/pwa/RegisterSW.tsx app/layout.tsx
git commit -m "feat: offline service worker + production-only registration"
```

---

## Self-Review Checklist (controller, after all tasks)

- Manifest served at `/manifest.webmanifest` with emerald `theme_color` and three icons; `<link rel="manifest">` auto-injected. (Task 2)
- `themeColor` in `viewport` export, not `metadata`. (Task 2)
- Four icons exist at correct dimensions. (Task 1)
- `/offline` route builds and renders standalone. (Task 3)
- SW skips non-GET and `/api/*`; network-first navigations → offline fallback; cache-first static. (Task 4)
- Registration gated to production only. (Task 4)
- `npm run build` and `npm run lint` pass on the final tree.

## Out of Scope

Offline data / cached API reads · push notifications · background/periodic sync ·
per-locale (ka/he) manifests · app shortcuts · share target · custom
install-prompt UI.
