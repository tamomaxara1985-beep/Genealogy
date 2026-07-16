# Genealogy Mobile MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an Expo (React Native) read-mostly viewer app that authenticates against the existing Next.js backend via Bearer JWT and lets users browse trees, view persons/events, search, manage access requests, and contact owners.

**Architecture:** Add mobile-only auth to the existing backend without touching web auth: a self-issued JWT (signed with `AUTH_SECRET`) plus one shared `getSession(req)` helper that accepts *either* the NextAuth cookie session *or* a `Bearer` token. Existing route handlers swap `auth()` → `getSession(req)` — a mechanical change. A new Expo app lives under `mobile/` in this repo, re-uses the repo's `types/`, and talks to the backend through a thin SWR-backed fetch client.

**Tech Stack:** Backend — Next.js 16 route handlers, `jose` (JWT), `bcryptjs`, Mongoose, vitest. Mobile — Expo (managed), expo-router, expo-secure-store, SWR, TypeScript.

## Global Constraints

- **Do not modify web auth.** `lib/auth.ts` and the NextAuth cookie flow stay untouched. Mobile tokens are a separate, self-issued JWT — no interop with NextAuth's encrypted JWE cookie.
- **`getSession(req)` returns a NextAuth `Session`-shaped object** (`{ user: { id, email, name, role }, expires }`) or `null`, so it is a drop-in for the existing `session` variable and works with `resolveTreeAccess(treeId, session)` / `resolvePersonAccess(personId, session)` unchanged.
- **Mobile JWT payload MUST include `email`** — `resolveTreeAccess` and `search` read `session.user.email`.
- **Secret:** sign/verify with `process.env.AUTH_SECRET` (already required in `.env.local`). Algorithm `HS256`.
- **Token storage on device:** `expo-secure-store` only (encrypted keychain/keystore), never AsyncStorage.
- **Backend test convention:** colocated `lib/<name>.test.ts`, `vitest`, node env, alias `@` → repo root (see `vitest.config.ts`). Pure logic extracted into `lib/*.ts`; route handlers stay thin. Result style: `{ ok: true, value } | { ok: false, error }`.
- **Run backend tests with:** `npm test` (from repo root).
- **UI language:** English only for v1. Person data in any language renders via Unicode.
- **v1 is read-mostly.** No person create/edit screens. Writes limited to: login, access-request create/approve/deny/cancel, contact-owner message.

---

## Phase A — Backend (existing app)

### Task 1: Mobile token module (`lib/mobileToken.ts`)

Pure issue/verify functions over `jose`. No DB, no request — fully unit-testable.

**Files:**
- Create: `lib/mobileToken.ts`
- Test: `lib/mobileToken.test.ts`
- Modify: `package.json` (add `jose` as a direct dependency)

**Interfaces:**
- Produces:
  - `interface MobileTokenClaims { sub: string; email: string | null; role: string; name: string | null }`
  - `issueMobileToken(claims: MobileTokenClaims, secret: string): Promise<string>`
  - `verifyMobileToken(token: string, secret: string): Promise<MobileTokenClaims | null>`

- [ ] **Step 1: Add `jose` as a direct dependency**

`jose@6.2.3` is already present transitively (via next-auth). Pin it explicitly:

Run: `npm install jose@^6.2.3`
Expected: `package.json` `dependencies` now lists `"jose"`.

- [ ] **Step 2: Write the failing test**

Create `lib/mobileToken.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { issueMobileToken, verifyMobileToken } from "./mobileToken";

const SECRET = "test-secret-value-123";
const CLAIMS = { sub: "u1", email: "a@b.com", role: "user", name: "Ann" };

describe("mobileToken", () => {
  it("round-trips claims through issue -> verify", async () => {
    const token = await issueMobileToken(CLAIMS, SECRET);
    expect(typeof token).toBe("string");
    const out = await verifyMobileToken(token, SECRET);
    expect(out).toEqual(CLAIMS);
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await issueMobileToken(CLAIMS, SECRET);
    expect(await verifyMobileToken(token, "other-secret")).toBeNull();
  });

  it("returns null for a garbage token", async () => {
    expect(await verifyMobileToken("not.a.jwt", SECRET)).toBeNull();
  });

  it("defaults missing email/name to null and role to 'user'", async () => {
    const token = await issueMobileToken(
      { sub: "u2", email: null, role: "admin", name: null },
      SECRET
    );
    const out = await verifyMobileToken(token, SECRET);
    expect(out).toEqual({ sub: "u2", email: null, role: "admin", name: null });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- mobileToken`
Expected: FAIL — `Cannot find module './mobileToken'`.

- [ ] **Step 4: Write the implementation**

Create `lib/mobileToken.ts`:

```ts
import { SignJWT, jwtVerify } from "jose";

export interface MobileTokenClaims {
  sub: string;
  email: string | null;
  role: string;
  name: string | null;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function issueMobileToken(
  claims: MobileTokenClaims,
  secret: string
): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role, name: claims.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key(secret));
}

export async function verifyMobileToken(
  token: string,
  secret: string
): Promise<MobileTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret));
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: (payload.email as string | null) ?? null,
      role: (payload.role as string) ?? "user",
      name: (payload.name as string | null) ?? null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- mobileToken`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json lib/mobileToken.ts lib/mobileToken.test.ts
git commit -m "feat: mobile JWT issue/verify helpers"
```

---

### Task 2: Shared auth helper (`lib/apiAuth.ts`)

Resolves the caller from *either* a cookie session or a Bearer token, returning a `Session`-shaped object.

**Files:**
- Create: `lib/apiAuth.ts`
- Test: `lib/apiAuth.test.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/auth`; `verifyMobileToken` from `@/lib/mobileToken` (Task 1).
- Produces: `getSession(req: Request): Promise<Session | null>` where the returned object has `user.id`, `user.email`, `user.name`, `user.role`.

- [ ] **Step 1: Write the failing test**

Create `lib/apiAuth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const verifyMock = vi.fn();

vi.mock("@/lib/auth", () => ({ auth: () => authMock() }));
vi.mock("@/lib/mobileToken", () => ({
  verifyMobileToken: (t: string, s: string) => verifyMock(t, s),
}));

import { getSession } from "./apiAuth";

function reqWith(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/x", { headers });
}

describe("getSession", () => {
  beforeEach(() => {
    authMock.mockReset();
    verifyMock.mockReset();
    process.env.AUTH_SECRET = "s";
  });

  it("returns the cookie session when present, ignoring Bearer", async () => {
    authMock.mockResolvedValue({ user: { id: "cookie-user" } });
    const s = await getSession(reqWith({ authorization: "Bearer xyz" }));
    expect(s?.user?.id).toBe("cookie-user");
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("falls back to a valid Bearer token when no cookie session", async () => {
    authMock.mockResolvedValue(null);
    verifyMock.mockResolvedValue({ sub: "tok-user", email: "e@x.com", role: "user", name: "N" });
    const s = await getSession(reqWith({ authorization: "Bearer good" }));
    expect(verifyMock).toHaveBeenCalledWith("good", "s");
    expect(s?.user).toMatchObject({ id: "tok-user", email: "e@x.com", name: "N", role: "user" });
  });

  it("returns null with no cookie and no auth header", async () => {
    authMock.mockResolvedValue(null);
    expect(await getSession(reqWith())).toBeNull();
  });

  it("returns null when the Bearer token is invalid", async () => {
    authMock.mockResolvedValue(null);
    verifyMock.mockResolvedValue(null);
    expect(await getSession(reqWith({ authorization: "Bearer bad" }))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apiAuth`
Expected: FAIL — `Cannot find module './apiAuth'`.

- [ ] **Step 3: Write the implementation**

Create `lib/apiAuth.ts`:

```ts
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/mobileToken";

// Accepts EITHER a NextAuth cookie session (web) OR a mobile Bearer JWT.
// Returns a Session-shaped object so it drops in wherever `auth()` was used.
export async function getSession(req: Request): Promise<Session | null> {
  const cookieSession = await auth();
  if (cookieSession?.user?.id) return cookieSession;

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const claims = await verifyMobileToken(token, secret);
  if (!claims) return null;

  return {
    user: {
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      role: claims.role,
    },
    expires: "",
  } as unknown as Session;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apiAuth`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/apiAuth.ts lib/apiAuth.test.ts
git commit -m "feat: getSession helper accepting cookie or Bearer auth"
```

---

### Task 3: Mobile login endpoint (`/api/mobile/login`)

Validates input (pure), checks bcrypt password, issues a mobile token.

**Files:**
- Create: `lib/mobileLogin.ts`
- Test: `lib/mobileLogin.test.ts`
- Create: `app/api/mobile/login/route.ts`

**Interfaces:**
- Consumes: `issueMobileToken` (Task 1).
- Produces:
  - `validateLoginInput(body: unknown): { ok: true; value: { email: string; password: string } } | { ok: false; error: string }`
  - `POST /api/mobile/login` → `200 { token, user: { id, name, email, role } }` | `400` | `401` | `500`.

- [ ] **Step 1: Write the failing test for validation**

Create `lib/mobileLogin.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validateLoginInput } from "./mobileLogin";

describe("validateLoginInput", () => {
  it("trims + lowercases email and keeps password", () => {
    expect(validateLoginInput({ email: "  A@B.COM ", password: "pw" })).toEqual({
      ok: true,
      value: { email: "a@b.com", password: "pw" },
    });
  });

  it("rejects missing email or password", () => {
    expect(validateLoginInput({ password: "pw" }).ok).toBe(false);
    expect(validateLoginInput({ email: "a@b.com" }).ok).toBe(false);
    expect(validateLoginInput({}).ok).toBe(false);
    expect(validateLoginInput(null).ok).toBe(false);
  });

  it("rejects non-string fields", () => {
    expect(validateLoginInput({ email: 1, password: 2 }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- mobileLogin`
Expected: FAIL — `Cannot find module './mobileLogin'`.

- [ ] **Step 3: Implement validation**

Create `lib/mobileLogin.ts`:

```ts
export type LoginResult =
  | { ok: true; value: { email: string; password: string } }
  | { ok: false; error: string };

export function validateLoginInput(body: unknown): LoginResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!email || !password) {
    return { ok: false, error: "Email and password are required" };
  }
  return { ok: true, value: { email, password } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- mobileLogin`
Expected: PASS (3 tests).

- [ ] **Step 5: Create the route handler**

Create `app/api/mobile/login/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { validateLoginInput } from "@/lib/mobileLogin";
import { issueMobileToken } from "@/lib/mobileToken";

export async function POST(req: NextRequest) {
  const parsed = validateLoginInput(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { email, password } = parsed.value;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  await connectDB();
  const user = await User.findOne({ email });
  if (!user?.password)
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid)
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  const token = await issueMobileToken(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role ?? "user",
      name: user.name ?? null,
    },
    secret
  );

  return NextResponse.json({
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role ?? "user",
    },
  });
}
```

- [ ] **Step 6: Manually verify the endpoint**

Start the backend: `npm run dev`. In another shell, using a real account's credentials:

Run:
```bash
curl -s -X POST http://localhost:3000/api/mobile/login \
  -H "Content-Type: application/json" \
  -d '{"email":"<REAL_EMAIL>","password":"<REAL_PASSWORD>"}'
```
Expected: JSON with a `token` string and a `user` object. Then confirm a bad password returns `{"error":"Invalid email or password"}` with HTTP 401 (`curl -i` shows status).

- [ ] **Step 7: Commit**

```bash
git add lib/mobileLogin.ts lib/mobileLogin.test.ts app/api/mobile/login/route.ts
git commit -m "feat: POST /api/mobile/login issues Bearer token"
```

---

### Task 4: Refactor MVP routes to `getSession(req)`

Mechanical swap across 11 files. Web keeps working because `getSession` tries the cookie session first. Each file: change the import, change the `session` assignment, and ensure the handler has a `req` param to pass.

**Files (modify):**
- `app/api/trees/route.ts`
- `app/api/trees/[treeId]/route.ts`
- `app/api/trees/[treeId]/persons/route.ts`
- `app/api/trees/[treeId]/access-requests/route.ts`
- `app/api/trees/[treeId]/contact-owner/route.ts`
- `app/api/persons/[personId]/route.ts`
- `app/api/persons/[personId]/events/route.ts`
- `app/api/search/route.ts`
- `app/api/access-requests/route.ts`
- `app/api/access-requests/[id]/route.ts`
- `app/api/profile/route.ts`

**Interfaces:**
- Consumes: `getSession` from `@/lib/apiAuth` (Task 2).

- [ ] **Step 1: Swap the import in every file above**

In each file, replace:
```ts
import { auth } from "@/lib/auth";
```
with:
```ts
import { getSession } from "@/lib/apiAuth";
```
(In `app/api/profile/route.ts` the import line is the same string — replace it there too.)

- [ ] **Step 2: Swap every `const session = await auth();` → `const session = await getSession(<req>);`**

Use the handler's request parameter name as `<req>`. Per file:

- `app/api/trees/route.ts`:
  - `GET()` → `GET(req: NextRequest)`, then `const session = await getSession(req);`
  - `POST(req: NextRequest)` → `const session = await getSession(req);`
- `app/api/trees/[treeId]/route.ts`:
  - `GET(_req: NextRequest, { params }: Params)` → rename `_req` to `req`; `const session = await getSession(req);`
  - `PUT(req, ...)` → `getSession(req)`
  - `DELETE(_req, ...)` → rename `_req` to `req`; `getSession(req)`
- `app/api/trees/[treeId]/persons/route.ts`:
  - `GET(_req, ...)` → rename to `req`; `getSession(req)`
  - `POST(req, ...)` → `getSession(req)`
- `app/api/trees/[treeId]/access-requests/route.ts`:
  - `POST(req, ...)` → `getSession(req)`
- `app/api/trees/[treeId]/contact-owner/route.ts`:
  - `POST(req, ...)` → `getSession(req)`
- `app/api/persons/[personId]/route.ts`:
  - `GET(_req, ...)` → rename to `req`; `getSession(req)`
  - `PUT(req, ...)` → `getSession(req)`
  - `DELETE(_req, ...)` → rename to `req`; `getSession(req)`
- `app/api/persons/[personId]/events/route.ts`:
  - `GET(_req, ...)` → rename to `req`; `getSession(req)`
  - `POST(req, ...)` → `getSession(req)`
- `app/api/search/route.ts`:
  - `GET(req: NextRequest)` → `getSession(req)`
- `app/api/access-requests/route.ts`:
  - `GET(req: NextRequest)` → `getSession(req)`
- `app/api/access-requests/[id]/route.ts`:
  - `PATCH(req, ...)` → `getSession(req)`
  - `DELETE(req, ...)` → `getSession(req)`
- `app/api/profile/route.ts`:
  - `PATCH(request: Request)` → `const session = await getSession(request);`

Leave everything else (guards, `resolveTreeAccess(treeId, session)`, response bodies) unchanged.

- [ ] **Step 3: Typecheck / lint**

Run: `npm run lint`
Expected: no errors. In particular, no "unused variable `_req`" and no "cannot find name `req`". If a handler still has no request param but calls `getSession(req)`, add `req: NextRequest` to its signature.

- [ ] **Step 4: Verify web auth still works (regression)**

Run: `npm test`
Expected: all existing tests still PASS. Then `npm run dev`, log into the web app in a browser, open a tree, view a person — confirm nothing 401s. (Cookie path unchanged.)

- [ ] **Step 5: Verify Bearer auth works end-to-end against a real route**

With `npm run dev` running and a `token` from Task 3 Step 6:

Run:
```bash
curl -s http://localhost:3000/api/trees -H "Authorization: Bearer <TOKEN>"
```
Expected: JSON `{ "owned": [...], "shared": [...] }` (not `{"error":"Unauthorized"}`). Then confirm no token → 401:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/trees
```
Expected: `401`.

- [ ] **Step 6: Commit**

```bash
git add app/api
git commit -m "refactor: MVP API routes accept cookie or Bearer auth"
```

---

## Phase B — Mobile app (`mobile/`)

> **Dev networking note:** a physical device or emulator cannot reach the backend at `localhost`. Set `EXPO_PUBLIC_API_URL` to the LAN IP of the machine running `npm run dev` (e.g. `http://192.168.1.20:3000`). Android emulator can use `http://10.0.2.2:3000`.

### Task 5: Scaffold the Expo app

Use the default Expo template (it ships correct, current versions of expo-router + expo-secure-store) and strip the example screens.

**Files:**
- Create: `mobile/` (Expo project — `package.json`, `app.json`, `tsconfig.json`, `app/`, etc.)
- Create: `mobile/types/index.ts` (re-export repo types)
- Create: `mobile/.env.example`, `mobile/.gitignore` additions
- Create: `mobile/README.md`

- [ ] **Step 1: Scaffold with the default template**

Run from the repo root:
```bash
npx create-expo-app@latest mobile
```
Expected: a `mobile/` folder with expo-router pre-wired (`package.json` has `"main": "expo-router/entry"`, an `app/` dir with example tabs).

- [ ] **Step 2: Reset the example app to a blank `app/`**

The template ships an example. Remove it so we start clean:
```bash
cd mobile
npm run reset-project   # template script that moves the example to app-example/ and makes a blank app/
rm -rf app-example
cd ..
```
If `reset-project` does not exist in this template version, instead delete the contents of `mobile/app/` and create a placeholder `mobile/app/index.tsx`:
```tsx
import { Text, View } from "react-native";
export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Genealogy Mobile</Text>
    </View>
  );
}
```

- [ ] **Step 3: Install runtime deps used by later tasks**

```bash
cd mobile
npx expo install expo-secure-store
npm install swr
cd ..
```
Expected: `expo-secure-store` and `swr` in `mobile/package.json`.

- [ ] **Step 4: Wire the path to shared repo types**

Create `mobile/types/index.ts`:
```ts
// Single source of truth lives at the repo root. Re-export it so mobile code
// imports from "@/types" (mobile alias) without duplicating definitions.
export * from "../../types";
```

Edit `mobile/tsconfig.json` to add a path alias mapping `@/*` to the mobile root (merge into existing `compilerOptions`):
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 5: Add env + README**

Create `mobile/.env.example`:
```
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
```

Create `mobile/README.md`:
```markdown
# Genealogy Mobile

Expo app for the Genealogy backend.

## Setup
1. `cd mobile && npm install`
2. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL` to the LAN IP of
   your running Next.js backend (`npm run dev` in the repo root). A device
   cannot reach `localhost`.
3. `npx expo start`, then open in Expo Go or a simulator.

## Auth
Email/password login against `POST /api/mobile/login`. Token stored in
expo-secure-store, sent as `Authorization: Bearer <token>`.
```

Append to `mobile/.gitignore` (create if missing): `.env`.

- [ ] **Step 6: Verify the app boots**

```bash
cd mobile
npx expo start
```
Expected: Metro starts, no type errors; opening the app shows the "Genealogy Mobile" placeholder. Stop with `q`/Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add mobile
git commit -m "chore: scaffold Expo mobile app"
```

---

### Task 6: API client + auth store

The pure `createApiClient` is unit-tested (no RN imports). `api.ts` wires the real token store; `auth.tsx` holds auth state.

**Files:**
- Create: `mobile/lib/apiClient.ts`
- Test: `mobile/lib/apiClient.test.ts`
- Create: `mobile/lib/tokenStore.ts`
- Create: `mobile/lib/api.ts`
- Create: `mobile/lib/auth.tsx`

**Interfaces:**
- Produces:
  - `class ApiError extends Error { status: number }`
  - `createApiClient(opts: { baseUrl: string; getToken: () => Promise<string | null>; onUnauthorized: () => void; fetchImpl?: typeof fetch }): { request<T>(path: string, init?: RequestInit): Promise<T> }`
  - `tokenStore`: `{ get(): Promise<string|null>; set(t: string): Promise<void>; clear(): Promise<void> }`
  - `api`: an app-wide client instance with a `.request<T>(path, init?)` method.
  - `AuthProvider`, `useAuth(): { user: MobileUser | null; ready: boolean; signIn(email, password): Promise<void>; signOut(): void }`
  - `interface MobileUser { id: string; name: string; email: string; role: string }`

- [ ] **Step 1: Write the failing test for the API client**

Create `mobile/lib/apiClient.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createApiClient, ApiError } from "./apiClient";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const base = { baseUrl: "http://api.test", onUnauthorized: () => {} };

describe("createApiClient", () => {
  it("prefixes baseUrl and injects the Bearer token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ ok: 1 }));
    const client = createApiClient({
      ...base,
      getToken: async () => "tok123",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const out = await client.request("/api/trees");
    expect(out).toEqual({ ok: 1 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://api.test/api/trees");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok123");
  });

  it("omits Authorization when there is no token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
    const client = createApiClient({
      ...base,
      getToken: async () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.request("/x");
    const [, init] = fetchImpl.mock.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("throws ApiError with status + server message on non-2xx", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "Not found" }, 404));
    const client = createApiClient({
      ...base,
      getToken: async () => null,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(client.request("/x")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Not found",
    });
    expect((await client.request("/x").catch((e) => e)) instanceof ApiError).toBe(true);
  });

  it("calls onUnauthorized on a 401", async () => {
    const onUnauthorized = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ error: "Unauthorized" }, 401));
    const client = createApiClient({
      baseUrl: "http://api.test",
      onUnauthorized,
      getToken: async () => "expired",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await client.request("/x").catch(() => {});
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from repo root — root vitest picks up `mobile/lib/apiClient.test.ts` via the `**/*.test.ts` pattern): `npm test -- apiClient`
Expected: FAIL — `Cannot find module './apiClient'`.

- [ ] **Step 3: Implement the API client**

Create `mobile/lib/apiClient.ts`:

```ts
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface ApiClientOptions {
  baseUrl: string;
  getToken: () => Promise<string | null>;
  onUnauthorized: () => void;
  fetchImpl?: typeof fetch;
}

export function createApiClient(opts: ApiClientOptions) {
  const doFetch = opts.fetchImpl ?? fetch;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await opts.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await doFetch(`${opts.baseUrl}${path}`, { ...init, headers });

    if (res.status === 401) opts.onUnauthorized();

    const text = await res.text();
    const body = text ? JSON.parse(text) : null;

    if (!res.ok) {
      const message =
        (body && typeof body.error === "string" && body.error) || `Request failed (${res.status})`;
      throw new ApiError(res.status, message);
    }
    return body as T;
  }

  return { request };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apiClient`
Expected: PASS (4 tests).

- [ ] **Step 5: Implement the token store (secure-store)**

Create `mobile/lib/tokenStore.ts`:

```ts
import * as SecureStore from "expo-secure-store";

const KEY = "genealogy_token";

export const tokenStore = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token: string) => SecureStore.setItemAsync(KEY, token),
  clear: () => SecureStore.deleteItemAsync(KEY),
};
```

- [ ] **Step 6: Wire the app-wide client**

Create `mobile/lib/api.ts`:

```ts
import { createApiClient } from "./apiClient";
import { tokenStore } from "./tokenStore";

const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? "";

// Listeners notified on any 401 so the auth layer can sign the user out.
const unauthorizedListeners = new Set<() => void>();
export function onUnauthorized(cb: () => void): () => void {
  unauthorizedListeners.add(cb);
  return () => unauthorizedListeners.delete(cb);
}

export const api = createApiClient({
  baseUrl,
  getToken: () => tokenStore.get(),
  onUnauthorized: () => unauthorizedListeners.forEach((cb) => cb()),
});

// SWR global fetcher: keys are API paths.
export const swrFetcher = (path: string) => api.request(path);
```

- [ ] **Step 7: Implement the auth provider**

Create `mobile/lib/auth.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, onUnauthorized } from "./api";
import { tokenStore } from "./tokenStore";

export interface MobileUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  user: MobileUser | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "genealogy_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Restore session on launch: a stored token implies a stored user.
    (async () => {
      const token = await tokenStore.get();
      const raw = token ? await import("expo-secure-store").then((m) => m.getItemAsync(USER_KEY)) : null;
      if (token && raw) setUser(JSON.parse(raw));
      setReady(true);
    })();
    const off = onUnauthorized(() => {
      void signOut();
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(email: string, password: string) {
    const res = await api.request<{ token: string; user: MobileUser }>("/api/mobile/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await tokenStore.set(res.token);
    const SecureStore = await import("expo-secure-store");
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }

  function signOut() {
    void tokenStore.clear();
    void import("expo-secure-store").then((m) => m.deleteItemAsync(USER_KEY));
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 8: Commit**

```bash
git add mobile/lib
git commit -m "feat: mobile api client, token store, auth provider"
```

---

### Task 7: Root layout auth gate + Login screen

**Files:**
- Create/replace: `mobile/app/_layout.tsx`
- Create: `mobile/app/login.tsx`
- Delete: `mobile/app/index.tsx` (placeholder from Task 5, if present)

**Interfaces:**
- Consumes: `AuthProvider`, `useAuth` (Task 6); `swrFetcher` from `@/lib/api`.

- [ ] **Step 1: Implement the root layout**

Replace `mobile/app/_layout.tsx`:

```tsx
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SWRConfig } from "swr";
import { AuthProvider, useAuth } from "@/lib/auth";
import { swrFetcher } from "@/lib/api";

function AuthGate() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === "login";
    if (!user && !inAuthGroup) router.replace("/login");
    else if (user && inAuthGroup) router.replace("/");
  }, [user, ready, segments, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="tree/[treeId]" options={{ headerShown: true, title: "Tree" }} />
      <Stack.Screen name="person/[id]" options={{ headerShown: true, title: "Person" }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SWRConfig value={{ fetcher: swrFetcher }}>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </SWRConfig>
  );
}
```

If `mobile/app/index.tsx` still exists from Task 5, delete it (the tabs group provides the home route):
```bash
rm -f mobile/app/index.tsx
```

- [ ] **Step 2: Implement the Login screen**

Create `mobile/app/login.tsx`:

```tsx
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/apiClient";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      // AuthGate redirects to "/" once user is set.
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not sign in. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <Text style={styles.title}>Genealogy</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        onPress={onSubmit}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 32, fontWeight: "700", textAlign: "center", marginBottom: 24, color: "#059669" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 14, fontSize: 16 },
  error: { color: "#dc2626" },
  button: { backgroundColor: "#059669", padding: 16, borderRadius: 8, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
```

- [ ] **Step 3: Manually verify login + redirect**

Backend running (`npm run dev` at repo root); `mobile/.env` set to the LAN IP. From `mobile/`: `npx expo start`, open the app.
Expected: app opens on the Login screen. Bad credentials → red error message. Valid credentials → redirects into the app (will land on the tabs once Task 8 lands; before that it may show an empty stack — acceptable at this step). Confirm no crash and the spinner shows while signing in.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/_layout.tsx mobile/app/login.tsx
git commit -m "feat: mobile auth gate and login screen"
```

---

### Task 8: Tabs layout + Trees list

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/index.tsx`
- Create: `mobile/components/Screen.tsx` (shared loading/error/empty wrapper)

**Interfaces:**
- Consumes: SWR (global fetcher), `ITree` from `@/types`.
- Produces: `Screen` wrapper — `<Screen loading error onRetry empty emptyText>{children}</Screen>`.

- [ ] **Step 1: Create the shared Screen state wrapper**

Create `mobile/components/Screen.tsx`:

```tsx
import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

interface ScreenProps {
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: boolean;
  emptyText?: string;
  children?: ReactNode;
}

export function Screen({ loading, error, onRetry, empty, emptyText, children }: ScreenProps) {
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }
  if (error) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{message}</Text>
        {onRetry ? (
          <Pressable style={styles.retry} onPress={onRetry}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>{emptyText ?? "Nothing here yet"}</Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  error: { color: "#dc2626", textAlign: "center" },
  empty: { color: "#6b7280", textAlign: "center" },
  retry: { backgroundColor: "#059669", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  retryText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 2: Create the tabs layout**

Create `mobile/app/(tabs)/_layout.tsx`:

```tsx
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#059669" }}>
      <Tabs.Screen name="index" options={{ title: "Trees" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="requests" options={{ title: "Requests" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
```

> Note: Tasks 8–12 each add one tab screen file. Until all four exist, expo-router will warn about missing routes referenced in `Tabs.Screen`. That is expected mid-implementation and resolves once Tasks 9–12 land. To avoid warnings between tasks you may temporarily comment out the not-yet-created `Tabs.Screen` lines, re-adding each as its screen is created.

- [ ] **Step 3: Create the Trees list screen**

Create `mobile/app/(tabs)/index.tsx`:

```tsx
import useSWR from "swr";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { ITree } from "@/types";
import { Screen } from "@/components/Screen";

interface TreesResponse {
  owned: ITree[];
  shared: ITree[];
}

export default function Trees() {
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<TreesResponse>("/api/trees");

  const rows = data
    ? [
        ...data.owned.map((t) => ({ tree: t, role: "Owner" as const })),
        ...data.shared.map((t) => ({ tree: t, role: "Shared" as const })),
      ]
    : [];

  return (
    <Screen
      loading={isLoading}
      error={error}
      onRetry={() => mutate()}
      empty={!isLoading && !error && rows.length === 0}
      emptyText="No trees yet"
    >
      <FlatList
        data={rows}
        keyExtractor={(r) => r.tree._id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => mutate()} />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/tree/${item.tree._id}`)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.tree.name}</Text>
              {item.tree.description ? (
                <Text style={styles.desc} numberOfLines={1}>
                  {item.tree.description}
                </Text>
              ) : null}
            </View>
            <Text style={styles.badge}>{item.role}</Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: "600" },
  desc: { color: "#6b7280", marginTop: 2 },
  badge: { fontSize: 12, color: "#059669", fontWeight: "600" },
});
```

- [ ] **Step 4: Manually verify**

`npx expo start` from `mobile/`, sign in.
Expected: bottom tabs appear; Trees tab lists your owned + shared trees with role badges. Pull to refresh works. Tapping a tree navigates to `/tree/<id>` (blank until Task 9). If you have no trees, the "No trees yet" empty state shows.

- [ ] **Step 5: Commit**

```bash
git add "mobile/app/(tabs)/_layout.tsx" "mobile/app/(tabs)/index.tsx" mobile/components/Screen.tsx
git commit -m "feat: mobile tabs and trees list"
```

---

### Task 9: Tree detail (persons list) + Person detail

**Files:**
- Create: `mobile/app/tree/[treeId].tsx`
- Create: `mobile/app/person/[id].tsx`

**Interfaces:**
- Consumes: SWR; `IPerson`, `IEvent` from `@/types`; `api` from `@/lib/api` (for the contact-owner POST).

- [ ] **Step 1: Create the Tree detail (persons list) screen**

Create `mobile/app/tree/[treeId].tsx`:

```tsx
import useSWR from "swr";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { IPerson } from "@/types";
import { Screen } from "@/components/Screen";

export default function TreeDetail() {
  const { treeId } = useLocalSearchParams<{ treeId: string }>();
  const router = useRouter();
  const { data, error, isLoading, mutate } = useSWR<IPerson[]>(
    treeId ? `/api/trees/${treeId}/persons` : null
  );

  return (
    <Screen
      loading={isLoading}
      error={error}
      onRetry={() => mutate()}
      empty={!isLoading && !error && (data?.length ?? 0) === 0}
      emptyText="No people in this tree"
    >
      <FlatList
        data={data ?? []}
        keyExtractor={(p) => p._id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => mutate()} />}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => router.push(`/person/${item._id}`)}>
            <Text style={styles.name}>
              {[item.firstName, item.lastName].filter(Boolean).join(" ") || "Unnamed"}
            </Text>
            <Text style={styles.sub}>
              {[item.birthDate, item.birthPlace].filter(Boolean).join(" · ")}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  name: { fontSize: 16, fontWeight: "600" },
  sub: { color: "#6b7280", marginTop: 2 },
});
```

- [ ] **Step 2: Create the Person detail screen (with events + contact owner)**

Create `mobile/app/person/[id].tsx`:

```tsx
import { useState } from "react";
import useSWR from "swr";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { IPerson, IEvent } from "@/types";
import { Screen } from "@/components/Screen";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export default function PersonDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const person = useSWR<IPerson>(id ? `/api/persons/${id}` : null);
  const events = useSWR<IEvent[]>(id ? `/api/persons/${id}/events` : null);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const p = person.data;

  async function contactOwner() {
    if (!p) return;
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Both subject and message are required.");
      return;
    }
    setSending(true);
    try {
      await api.request(`/api/trees/${p.treeId}/contact-owner`, {
        method: "POST",
        body: JSON.stringify({ subject, message }),
      });
      setSubject("");
      setMessage("");
      Alert.alert("Message sent to the tree owner.");
    } catch (e) {
      Alert.alert(e instanceof ApiError ? e.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen loading={person.isLoading} error={person.error} onRetry={() => person.mutate()}>
      {p ? (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>
            {[p.firstName, p.lastName].filter(Boolean).join(" ") || "Unnamed"}
          </Text>
          <Field label="Born" value={[p.birthDate, p.birthPlace].filter(Boolean).join(" · ")} />
          <Field label="Died" value={[p.deathDate, p.deathPlace].filter(Boolean).join(" · ")} />
          <Field label="Maiden name" value={p.maidenName} />
          <Field label="Notes" value={p.notes} />
          <Field label="Bio" value={p.bio} />

          <Text style={styles.section}>Events</Text>
          {events.isLoading ? (
            <Text style={styles.muted}>Loading events…</Text>
          ) : (events.data?.length ?? 0) === 0 ? (
            <Text style={styles.muted}>No events</Text>
          ) : (
            events.data!.map((e) => (
              <View key={e._id} style={styles.event}>
                <Text style={styles.eventType}>{e.type}</Text>
                <Text style={styles.muted}>
                  {[e.date, e.place].filter(Boolean).join(" · ")}
                </Text>
                {e.description ? <Text>{e.description}</Text> : null}
              </View>
            ))
          )}

          <Text style={styles.section}>Contact tree owner</Text>
          <TextInput
            style={styles.input}
            placeholder="Subject"
            value={subject}
            onChangeText={setSubject}
          />
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Message"
            multiline
            value={message}
            onChangeText={setMessage}
          />
          <Pressable
            style={[styles.button, sending && { opacity: 0.6 }]}
            onPress={contactOwner}
            disabled={sending}
          >
            <Text style={styles.buttonText}>{sending ? "Sending…" : "Send message"}</Text>
          </Pressable>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 8 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  field: { marginBottom: 4 },
  fieldLabel: { fontSize: 12, color: "#6b7280", textTransform: "uppercase" },
  fieldValue: { fontSize: 16 },
  section: { fontSize: 18, fontWeight: "600", marginTop: 20, marginBottom: 8 },
  event: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e5e7eb" },
  eventType: { fontWeight: "600", textTransform: "capitalize" },
  muted: { color: "#6b7280" },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 16 },
  multiline: { height: 100, textAlignVertical: "top" },
  button: { backgroundColor: "#059669", padding: 14, borderRadius: 8, alignItems: "center", marginTop: 8 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 3: Manually verify**

From the Trees tab, open a tree → see the persons list (sorted by last name). Tap a person → detail with fields + events. On a tree you do NOT own (a shared or searched one), fill subject + message → "Send message" → success alert (and the owner receives an email). On your own tree, the backend returns "You own this tree" → shown in the alert.
Expected: no crashes; loading/empty/error states behave.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/tree mobile/app/person
git commit -m "feat: mobile tree detail and person detail screens"
```

---

### Task 10: Search screen

**Files:**
- Create: `mobile/app/(tabs)/search.tsx`

**Interfaces:**
- Consumes: SWR; `ISearchResult` from `@/types`.

- [ ] **Step 1: Create the Search screen**

Create `mobile/app/(tabs)/search.tsx`:

```tsx
import { useState } from "react";
import useSWR from "swr";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import type { ISearchResult } from "@/types";
import { Screen } from "@/components/Screen";

interface SearchResponse {
  results: ISearchResult[];
  truncated: boolean;
}

export default function SearchScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState("");

  const params = new URLSearchParams();
  if (firstName.trim()) params.set("firstName", firstName.trim());
  if (lastName.trim()) params.set("lastName", lastName.trim());
  if (location.trim()) params.set("location", location.trim());
  const query = params.toString();

  // Only search once at least one field is filled.
  const { data, error, isLoading } = useSWR<SearchResponse>(
    query ? `/api/search?${query}` : null
  );

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" />
      <TextInput style={styles.input} placeholder="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" />
      <TextInput style={styles.input} placeholder="Place" value={location} onChangeText={setLocation} />

      <View style={styles.results}>
        <Screen
          loading={query ? isLoading : false}
          error={error}
          empty={!!query && !isLoading && !error && (data?.results.length ?? 0) === 0}
          emptyText="No matches"
        >
          {!query ? (
            <Text style={styles.hint}>Enter a name or place to search.</Text>
          ) : (
            <FlatList
              data={data?.results ?? []}
              keyExtractor={(r) => r.personId}
              ListFooterComponent={
                data?.truncated ? <Text style={styles.hint}>Showing first 50 results. Refine your search.</Text> : null
              }
              renderItem={({ item }) => {
                const openable = item.access === "owner" || item.access === "viewer";
                return (
                  <Pressable
                    style={styles.row}
                    onPress={() => openable && router.push(`/person/${item.personId}`)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name}>{item.personName}</Text>
                      <Text style={styles.sub}>
                        {[item.place, item.treeName, item.ownerName].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Text style={styles.badge}>{item.access}</Text>
                  </Pressable>
                );
              }}
            />
          )}
        </Screen>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  input: { borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 12, fontSize: 16 },
  results: { flex: 1, marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: "600" },
  sub: { color: "#6b7280", marginTop: 2 },
  badge: { fontSize: 12, color: "#059669", fontWeight: "600", textTransform: "capitalize" },
  hint: { color: "#6b7280", padding: 8 },
});
```

- [ ] **Step 2: Manually verify**

Search tab: type a first name / last name / place. Results appear as you type (SWR re-fetches on key change). Results show an access badge. Tapping an `owner`/`viewer` result opens the person; `pending`/`none` results are not openable. `truncated` shows the footer hint.
Expected: no crash; empty state on no matches; "Enter a name or place" hint when all fields blank.

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(tabs)/search.tsx"
git commit -m "feat: mobile search screen"
```

---

### Task 11: Requests screen (incoming + outgoing)

**Files:**
- Create: `mobile/app/(tabs)/requests.tsx`

**Interfaces:**
- Consumes: SWR; `IAccessRequestView` from `@/types`; `api` from `@/lib/api`.
- Backend behavior relied upon:
  - `GET /api/access-requests?role=incoming|outgoing` → `{ requests: IAccessRequestView[] }`
  - `PATCH /api/access-requests/{id}` body `{ action: "approve"|"deny"|"revoke" }` (owner only)
  - `DELETE /api/access-requests/{id}` (requester cancels a pending one; denied/revoked deletable)

- [ ] **Step 1: Create the Requests screen**

Create `mobile/app/(tabs)/requests.tsx`:

```tsx
import { useState } from "react";
import useSWR from "swr";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { IAccessRequestView } from "@/types";
import { Screen } from "@/components/Screen";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";

type Tab = "incoming" | "outgoing";

interface RequestsResponse {
  requests: IAccessRequestView[];
}

export default function Requests() {
  const [tab, setTab] = useState<Tab>("incoming");
  const { data, error, isLoading, mutate } = useSWR<RequestsResponse>(
    `/api/access-requests?role=${tab}`
  );

  async function act(id: string, action: "approve" | "deny" | "revoke") {
    try {
      await api.request(`/api/access-requests/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      mutate();
    } catch (e) {
      Alert.alert(e instanceof ApiError ? e.message : "Action failed.");
    }
  }

  async function cancel(id: string) {
    try {
      await api.request(`/api/access-requests/${id}`, { method: "DELETE" });
      mutate();
    } catch (e) {
      Alert.alert(e instanceof ApiError ? e.message : "Could not cancel.");
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(["incoming", "outgoing"] as Tab[]).map((t) => (
          <Pressable key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>

      <Screen
        loading={isLoading}
        error={error}
        onRetry={() => mutate()}
        empty={!isLoading && !error && (data?.requests.length ?? 0) === 0}
        emptyText={tab === "incoming" ? "No incoming requests" : "No outgoing requests"}
      >
        <FlatList
          data={data?.requests ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.treeName}</Text>
                <Text style={styles.sub}>
                  {item.counterpartyName} · {item.status}
                </Text>
                {item.message ? <Text style={styles.msg}>{item.message}</Text> : null}
              </View>
              <View style={styles.actions}>
                {tab === "incoming" && item.status === "pending" ? (
                  <>
                    <Pressable style={[styles.btn, styles.approve]} onPress={() => act(item.id, "approve")}>
                      <Text style={styles.btnText}>Approve</Text>
                    </Pressable>
                    <Pressable style={[styles.btn, styles.deny]} onPress={() => act(item.id, "deny")}>
                      <Text style={styles.btnText}>Deny</Text>
                    </Pressable>
                  </>
                ) : null}
                {tab === "incoming" && item.status === "approved" ? (
                  <Pressable style={[styles.btn, styles.deny]} onPress={() => act(item.id, "revoke")}>
                    <Text style={styles.btnText}>Revoke</Text>
                  </Pressable>
                ) : null}
                {tab === "outgoing" && item.status === "pending" ? (
                  <Pressable style={[styles.btn, styles.deny]} onPress={() => cancel(item.id)}>
                    <Text style={styles.btnText}>Cancel</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabs: { flexDirection: "row", padding: 12, gap: 8 },
  tab: { flex: 1, padding: 10, borderRadius: 8, backgroundColor: "#f3f4f6", alignItems: "center" },
  tabActive: { backgroundColor: "#059669" },
  tabText: { textTransform: "capitalize", color: "#374151", fontWeight: "600" },
  tabTextActive: { color: "#fff" },
  row: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  name: { fontSize: 16, fontWeight: "600" },
  sub: { color: "#6b7280", marginTop: 2, textTransform: "capitalize" },
  msg: { marginTop: 4 },
  actions: { justifyContent: "center", gap: 6 },
  btn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  approve: { backgroundColor: "#059669" },
  deny: { backgroundColor: "#dc2626" },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
```

- [ ] **Step 2: Manually verify**

Requests tab: toggle Incoming / Outgoing. On Incoming, a pending request shows Approve/Deny; approving grants access (verify: the requester's account can then open the tree). An approved one shows Revoke. On Outgoing, a pending request you sent shows Cancel. Each action refreshes the list.
Expected: errors (e.g. cancelling a non-pending) surface via Alert; empty states show per tab.

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(tabs)/requests.tsx"
git commit -m "feat: mobile access-requests screen"
```

---

### Task 12: Profile screen + logout

**Files:**
- Create: `mobile/app/(tabs)/profile.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 6).

- [ ] **Step 1: Create the Profile screen**

Create `mobile/app/(tabs)/profile.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/lib/auth";

export default function Profile() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.name}>{user?.name ?? "—"}</Text>
        <Text style={styles.email}>{user?.email ?? ""}</Text>
        {user?.role === "admin" ? <Text style={styles.role}>Admin</Text> : null}
      </View>
      <Pressable style={styles.signOut} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 24 },
  card: { gap: 4 },
  name: { fontSize: 24, fontWeight: "700" },
  email: { fontSize: 16, color: "#6b7280" },
  role: { marginTop: 4, color: "#059669", fontWeight: "600" },
  signOut: { borderWidth: 1, borderColor: "#dc2626", padding: 14, borderRadius: 8, alignItems: "center" },
  signOutText: { color: "#dc2626", fontWeight: "600" },
});
```

- [ ] **Step 2: Manually verify the full flow**

Profile tab shows the signed-in user's name/email (from the login response, restored across app restarts via secure-store). Tap Sign out → token + user cleared → AuthGate bounces to Login. Kill and relaunch the app while signed in → lands straight in the app (session restored). Force a 401 (e.g. edit the stored token) → app signs out automatically.
Expected: clean sign-out and session-restore behavior.

- [ ] **Step 3: Commit**

```bash
git add "mobile/app/(tabs)/profile.tsx"
git commit -m "feat: mobile profile screen with logout"
```

---

## Final Verification

- [ ] **Backend tests green:** from repo root, `npm test` → all pass (existing + `mobileToken`, `apiAuth`, `mobileLogin`, `apiClient`).
- [ ] **Lint clean:** `npm run lint` → no errors.
- [ ] **Web regression:** log into the web app, open a tree + person — no 401s (cookie path intact).
- [ ] **Mobile end-to-end:** on a device/emulator against the LAN backend — login → Trees → tree → person (view events, contact owner) → Search → Requests (approve/deny/cancel) → Profile → sign out → session restore on relaunch.

## Out of Scope (v1)

React Flow tree canvas · person create/edit · AI chat · admin panel · Google OAuth · Georgian/Hebrew UI + RTL · push notifications · offline cache · rate-limiting on `/api/mobile/login` (flagged as a follow-up) · native app-store submission / EAS builds.
