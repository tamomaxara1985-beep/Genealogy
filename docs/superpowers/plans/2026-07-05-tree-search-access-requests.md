# Tree Search + Access Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in users search other users' family trees by person name/place, message owners by email, and request/approve/deny/revoke view access.

**Architecture:** Pure, unit-tested logic lives in `lib/` (validation, status transitions, regex/access computation) following the existing `{ ok, value } | { ok, error }` validator pattern. Thin auth-gated App Router API handlers call that logic. Grants reuse `Tree.sharedEmails` + `resolveTreeAccess` — no change to the existing viewer path. Two new dashboard pages consume SWR hooks.

**Tech Stack:** Next.js 16 App Router, React 19, Mongoose 9, next-auth v5, next-intl, SWR, vitest, nodemailer (existing `lib/mail.ts`).

## Global Constraints

- Every API handler calls `await auth()` and returns `NextResponse.json({ error: "Unauthorized" }, { status: 401 })` when `!session?.user?.id`. No middleware guard exists.
- Call `await connectDB()` before any Mongoose query in a handler.
- Mongoose models use the hot-reload guard: `models.X ?? model("X", Schema)`.
- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/types`.
- Pure logic returns discriminated unions `{ ok: true, value } | { ok: false, error }` (see `lib/contact.ts`).
- Tests use vitest: `import { describe, it, expect } from "vitest"`. Run with `npm test` (`vitest run`).
- Emerald scheme (`#059669` / `emerald-*`). Compose classes with `cn()` from `@/lib/utils`.
- Logged-in users only — no public/logged-out access to any new route.
- Frontend DTO types go in `types/index.ts` (single source of truth).

---

### Task 1: AccessRequest model + status-transition logic

**Files:**
- Create: `lib/models/AccessRequest.ts`
- Create: `lib/accessRequest.ts`
- Test: `lib/accessRequest.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `ACCESS_STATUSES = ["pending","approved","denied","revoked"] as const` and `type AccessStatus`.
  - `type AccessAction = "approve" | "deny" | "revoke"`.
  - `validateAccessRequestInput(input: unknown): { ok: true; value: { message: string } } | { ok: false; error: string }`.
  - `resolveAction(action: string, current: AccessStatus): { ok: true; value: { nextStatus: AccessStatus; grant: boolean; revoke: boolean } } | { ok: false; error: string }`.
  - Default export: `AccessRequest` Mongoose model with doc interface `IAccessRequestDoc`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/accessRequest.test.ts
import { describe, it, expect } from "vitest";
import { validateAccessRequestInput, resolveAction } from "./accessRequest";

describe("validateAccessRequestInput", () => {
  it("accepts empty/absent message and defaults to empty string", () => {
    expect(validateAccessRequestInput({})).toEqual({ ok: true, value: { message: "" } });
    expect(validateAccessRequestInput({ message: "  hi  " })).toEqual({ ok: true, value: { message: "hi" } });
  });
  it("rejects an over-long message", () => {
    expect(validateAccessRequestInput({ message: "x".repeat(2001) }).ok).toBe(false);
  });
});

describe("resolveAction", () => {
  it("approve: pending -> approved with grant", () => {
    expect(resolveAction("approve", "pending")).toEqual({ ok: true, value: { nextStatus: "approved", grant: true, revoke: false } });
  });
  it("deny: pending -> denied, no grant", () => {
    expect(resolveAction("deny", "pending")).toEqual({ ok: true, value: { nextStatus: "denied", grant: false, revoke: false } });
  });
  it("revoke: approved -> revoked with revoke", () => {
    expect(resolveAction("revoke", "approved")).toEqual({ ok: true, value: { nextStatus: "revoked", grant: false, revoke: true } });
  });
  it("rejects invalid transitions and unknown actions", () => {
    expect(resolveAction("approve", "approved").ok).toBe(false);
    expect(resolveAction("revoke", "pending").ok).toBe(false);
    expect(resolveAction("deny", "revoked").ok).toBe(false);
    expect(resolveAction("bogus", "pending").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- accessRequest`
Expected: FAIL — cannot resolve `./accessRequest`.

- [ ] **Step 3: Write the model**

```ts
// lib/models/AccessRequest.ts
import mongoose, { Schema, Document, models, model } from "mongoose";

export type AccessStatus = "pending" | "approved" | "denied" | "revoked";

export interface IAccessRequestDoc extends Document {
  treeId: mongoose.Types.ObjectId;
  requesterId: mongoose.Types.ObjectId;
  requesterEmail: string;
  status: AccessStatus;
  message: string;
  decidedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AccessRequestSchema = new Schema<IAccessRequestDoc>(
  {
    treeId: { type: Schema.Types.ObjectId, ref: "Tree", required: true, index: true },
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requesterEmail: { type: String, required: true },
    status: { type: String, enum: ["pending", "approved", "denied", "revoked"], default: "pending" },
    message: { type: String, default: "" },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

AccessRequestSchema.index({ treeId: 1, requesterId: 1 }, { unique: true });

export default models.AccessRequest ?? model<IAccessRequestDoc>("AccessRequest", AccessRequestSchema);
```

- [ ] **Step 4: Write the pure logic**

```ts
// lib/accessRequest.ts
export const ACCESS_STATUSES = ["pending", "approved", "denied", "revoked"] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];
export type AccessAction = "approve" | "deny" | "revoke";

type InputResult = { ok: true; value: { message: string } } | { ok: false; error: string };
type ActionResult =
  | { ok: true; value: { nextStatus: AccessStatus; grant: boolean; revoke: boolean } }
  | { ok: false; error: string };

export function validateAccessRequestInput(input: unknown): InputResult {
  const o = (input ?? {}) as Record<string, unknown>;
  const message = typeof o.message === "string" ? o.message.trim() : "";
  if (message.length > 2000) return { ok: false, error: "message too long" };
  return { ok: true, value: { message } };
}

export function resolveAction(action: string, current: AccessStatus): ActionResult {
  if (action === "approve") {
    if (current !== "pending") return { ok: false, error: "can only approve a pending request" };
    return { ok: true, value: { nextStatus: "approved", grant: true, revoke: false } };
  }
  if (action === "deny") {
    if (current !== "pending") return { ok: false, error: "can only deny a pending request" };
    return { ok: true, value: { nextStatus: "denied", grant: false, revoke: false } };
  }
  if (action === "revoke") {
    if (current !== "approved") return { ok: false, error: "can only revoke an approved request" };
    return { ok: true, value: { nextStatus: "revoked", grant: false, revoke: true } };
  }
  return { ok: false, error: "unknown action" };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- accessRequest`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/models/AccessRequest.ts lib/accessRequest.ts lib/accessRequest.test.ts
git commit -m "feat: AccessRequest model + status-transition logic"
```

---

### Task 2: Search query + access-computation logic

**Files:**
- Create: `lib/search.ts`
- Test: `lib/search.test.ts`

**Interfaces:**
- Consumes: `AccessStatus` from `@/lib/accessRequest`.
- Produces:
  - `escapeRegex(s: string): string`.
  - `type SearchField = "name" | "place"`.
  - `validateSearchQuery(q: unknown, field: unknown): { ok: true; value: { term: string; field: SearchField } } | { ok: false; error: string }`.
  - `computeAccess(tree: { ownerId: string; sharedEmails: string[] }, viewer: { userId: string; email: string | null }, requestStatus: AccessStatus | null): "owner" | "viewer" | "pending" | "none"`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/search.test.ts
import { describe, it, expect } from "vitest";
import { escapeRegex, validateSearchQuery, computeAccess } from "./search";

describe("escapeRegex", () => {
  it("escapes regex-special characters", () => {
    expect(escapeRegex("a.b*c(d)")).toBe("a\\.b\\*c\\(d\\)");
  });
});

describe("validateSearchQuery", () => {
  it("trims term, defaults field to name", () => {
    expect(validateSearchQuery("  Ann  ", undefined)).toEqual({ ok: true, value: { term: "Ann", field: "name" } });
  });
  it("accepts place field", () => {
    expect(validateSearchQuery("Tbilisi", "place")).toEqual({ ok: true, value: { term: "Tbilisi", field: "place" } });
  });
  it("rejects short terms and unknown fields", () => {
    expect(validateSearchQuery("a", "name").ok).toBe(false);
    expect(validateSearchQuery("Ann", "bogus").ok).toBe(false);
    expect(validateSearchQuery("x".repeat(101), "name").ok).toBe(false);
  });
});

describe("computeAccess", () => {
  const tree = { ownerId: "u1", sharedEmails: ["viewer@x.com"] };
  it("owner wins", () => {
    expect(computeAccess(tree, { userId: "u1", email: "u1@x.com" }, null)).toBe("owner");
  });
  it("shared email -> viewer (case-insensitive)", () => {
    expect(computeAccess(tree, { userId: "u2", email: "VIEWER@x.com" }, null)).toBe("viewer");
  });
  it("pending request -> pending", () => {
    expect(computeAccess(tree, { userId: "u3", email: "u3@x.com" }, "pending")).toBe("pending");
  });
  it("otherwise none (denied/revoked count as none)", () => {
    expect(computeAccess(tree, { userId: "u3", email: "u3@x.com" }, "denied")).toBe("none");
    expect(computeAccess(tree, { userId: "u3", email: "u3@x.com" }, null)).toBe("none");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- search`
Expected: FAIL — cannot resolve `./search`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/search.ts
import type { AccessStatus } from "@/lib/accessRequest";

export type SearchField = "name" | "place";

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type QueryResult =
  | { ok: true; value: { term: string; field: SearchField } }
  | { ok: false; error: string };

export function validateSearchQuery(q: unknown, field: unknown): QueryResult {
  const term = typeof q === "string" ? q.trim() : "";
  if (term.length < 2) return { ok: false, error: "search term too short" };
  if (term.length > 100) return { ok: false, error: "search term too long" };
  const f: SearchField = field === "place" ? "place" : field === "name" || field == null ? "name" : "invalid" as SearchField;
  if (f !== "name" && f !== "place") return { ok: false, error: "invalid field" };
  return { ok: true, value: { term, field: f } };
}

export function computeAccess(
  tree: { ownerId: string; sharedEmails: string[] },
  viewer: { userId: string; email: string | null },
  requestStatus: AccessStatus | null
): "owner" | "viewer" | "pending" | "none" {
  if (tree.ownerId === viewer.userId) return "owner";
  const email = viewer.email?.toLowerCase();
  if (email && tree.sharedEmails.some((e) => e.toLowerCase() === email)) return "viewer";
  if (requestStatus === "pending") return "pending";
  return "none";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- search`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/search.ts lib/search.test.ts
git commit -m "feat: search query validation + access computation"
```

---

### Task 3: Mail helpers for owner message + access-request notice

**Files:**
- Modify: `lib/mail.ts` (append two exports after `sendPasswordResetEmail`)

**Interfaces:**
- Consumes: existing `transporter`, `SMTP_USER` in `lib/mail.ts`.
- Produces:
  - `sendOwnerMessageEmail(to: string, fromEmail: string, fromName: string, subject: string, message: string): Promise<void>`.
  - `sendAccessRequestEmail(to: string, requesterName: string, treeName: string, message: string): Promise<void>`.

No dedicated unit test (send-only I/O wrappers; matches existing untested `sendPasswordResetEmail`). Verified via `npm run build` + manual send.

- [ ] **Step 1: Add the two helpers**

```ts
// lib/mail.ts — append below sendPasswordResetEmail
export async function sendOwnerMessageEmail(
  to: string,
  fromEmail: string,
  fromName: string,
  subject: string,
  message: string
) {
  await transporter.sendMail({
    from: `"FamilyRoots" <${SMTP_USER}>`,
    to,
    replyTo: fromEmail,
    subject: `[FamilyRoots] ${subject}`,
    text: `${fromName} (${fromEmail}) sent you a message via FamilyRoots:\n\n${message}\n\nReply directly to this email to respond.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#059669;margin:0 0 16px;">New message via FamilyRoots</h2>
        <p style="color:#374151;font-size:14px;">From: <strong>${fromName}</strong> (${fromEmail})</p>
        <p style="color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap;">${message}</p>
        <p style="color:#9ca3af;font-size:12px;">Reply directly to this email to respond.</p>
      </div>`,
  });
}

export async function sendAccessRequestEmail(
  to: string,
  requesterName: string,
  treeName: string,
  message: string
) {
  await transporter.sendMail({
    from: `"FamilyRoots" <${SMTP_USER}>`,
    to,
    subject: `[FamilyRoots] Access request for "${treeName}"`,
    text: `${requesterName} requested access to your tree "${treeName}".${message ? `\n\nNote: ${message}` : ""}\n\nReview it in your FamilyRoots Requests page.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#059669;margin:0 0 16px;">New access request</h2>
        <p style="color:#374151;font-size:14px;line-height:1.6;">
          <strong>${requesterName}</strong> requested access to your tree <strong>${treeName}</strong>.
        </p>
        ${message ? `<p style="color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap;">Note: ${message}</p>` : ""}
        <p style="color:#9ca3af;font-size:12px;">Review it in your FamilyRoots Requests page.</p>
      </div>`,
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles without type errors.

- [ ] **Step 3: Commit**

```bash
git add lib/mail.ts
git commit -m "feat: mail helpers for owner message + access-request notice"
```

---

### Task 4: Search API route

**Files:**
- Create: `app/api/search/route.ts`

**Interfaces:**
- Consumes: `validateSearchQuery`, `escapeRegex`, `computeAccess` from `@/lib/search`; `AccessRequest` model; `Person`, `Tree`, `User` models; `connectDB`, `auth`.
- Produces: `GET` returning `{ results: SearchResult[], truncated: boolean }` where each `SearchResult` matches the `ISearchResult` type added in Task 8.

Route is a thin wrapper over Task 2 logic; no unit test (no API test harness in repo). Verify via `npm run build`, `npm test` (logic already covered), and manual curl in Step 3.

- [ ] **Step 1: Write the route**

```ts
// app/api/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Person from "@/lib/models/Person";
import Tree from "@/lib/models/Tree";
import User from "@/lib/models/User";
import AccessRequest from "@/lib/models/AccessRequest";
import { validateSearchQuery, escapeRegex, computeAccess } from "@/lib/search";

const LIMIT = 50;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = validateSearchQuery(searchParams.get("q"), searchParams.get("field"));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { term, field } = parsed.value;

  await connectDB();
  const rx = new RegExp(escapeRegex(term), "i");
  const personFilter =
    field === "name"
      ? { $or: [{ firstName: rx }, { lastName: rx }] }
      : { $or: [{ birthPlace: rx }, { deathPlace: rx }] };

  const persons = await Person.find(personFilter).limit(LIMIT + 1).lean();
  const truncated = persons.length > LIMIT;
  const page = persons.slice(0, LIMIT);

  const treeIds = [...new Set(page.map((p) => p.treeId.toString()))];
  const trees = await Tree.find({ _id: { $in: treeIds } }).lean();
  const treeById = new Map(trees.map((t) => [t._id.toString(), t]));

  const ownerIds = [...new Set(trees.map((t) => t.ownerId.toString()))];
  const owners = await User.find({ _id: { $in: ownerIds } }).select("name").lean();
  const ownerById = new Map(owners.map((u) => [u._id.toString(), u]));

  const myRequests = await AccessRequest.find({
    requesterId: session.user.id,
    treeId: { $in: treeIds },
  }).lean();
  const statusByTree = new Map(myRequests.map((r) => [r.treeId.toString(), r.status]));

  const viewer = { userId: session.user.id, email: session.user.email ?? null };

  const results = page
    .map((p) => {
      const tree = treeById.get(p.treeId.toString());
      if (!tree) return null;
      const owner = ownerById.get(tree.ownerId.toString());
      const access = computeAccess(
        { ownerId: tree.ownerId.toString(), sharedEmails: tree.sharedEmails ?? [] },
        viewer,
        statusByTree.get(tree._id.toString()) ?? null
      );
      return {
        personId: p._id.toString(),
        personName: [p.firstName, p.lastName].filter(Boolean).join(" "),
        place: p.birthPlace || p.deathPlace || "",
        treeId: tree._id.toString(),
        treeName: tree.name,
        ownerName: owner?.name ?? "Unknown",
        access,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ results, truncated });
}
```

- [ ] **Step 2: Verify build + existing tests**

Run: `npm run build && npm test`
Expected: build compiles, all tests pass.

- [ ] **Step 3: Manual verify**

Start `npm run dev`, log in, then in the browser devtools console (carries auth cookie):
```js
await (await fetch("/api/search?q=an&field=name")).json()
```
Expected: `{ results: [...], truncated: false }` with `access` populated. Verify a tree you own shows `access: "owner"`.

- [ ] **Step 4: Commit**

```bash
git add app/api/search/route.ts
git commit -m "feat: search API route"
```

---

### Task 5: Contact-owner API route

**Files:**
- Create: `app/api/trees/[treeId]/contact-owner/route.ts`

**Interfaces:**
- Consumes: `validateContactMessage`-style inline validation; `sendOwnerMessageEmail` from `@/lib/mail`; `Tree`, `User` models; `connectDB`, `auth`.
- Produces: `POST` returning `{ ok: true }`.

- [ ] **Step 1: Write the route**

```ts
// app/api/trees/[treeId]/contact-owner/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import User from "@/lib/models/User";
import { sendOwnerMessageEmail } from "@/lib/mail";

type Params = { params: Promise<{ treeId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const body = await req.json();
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!subject || !message)
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  if (subject.length > 200 || message.length > 5000)
    return NextResponse.json({ error: "Field too long" }, { status: 400 });

  await connectDB();
  const tree = await Tree.findById(treeId);
  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const owner = await User.findById(tree.ownerId).select("email");
  if (!owner?.email)
    return NextResponse.json({ error: "Owner has no email" }, { status: 400 });
  if (owner.email.toLowerCase() === session.user.email?.toLowerCase())
    return NextResponse.json({ error: "You own this tree" }, { status: 400 });

  await sendOwnerMessageEmail(
    owner.email,
    session.user.email ?? "",
    session.user.name ?? "A FamilyRoots user",
    subject,
    message
  );
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 3: Manual verify**

With dev server + two accounts: from account B, POST to `/api/trees/<A's treeId>/contact-owner` with `{subject, message}`. Confirm account A's inbox receives the email with Reply-To = B.

- [ ] **Step 4: Commit**

```bash
git add "app/api/trees/[treeId]/contact-owner/route.ts"
git commit -m "feat: contact-owner API route"
```

---

### Task 6: Access-request create + list routes

**Files:**
- Create: `app/api/trees/[treeId]/access-requests/route.ts` (POST)
- Create: `app/api/access-requests/route.ts` (GET)

**Interfaces:**
- Consumes: `validateAccessRequestInput` from `@/lib/accessRequest`; `resolveTreeAccess` from `@/lib/treeAccess`; `sendAccessRequestEmail`; `AccessRequest`, `Tree`, `User` models.
- Produces:
  - `POST /api/trees/[treeId]/access-requests` → `{ status: AccessStatus }` (or `{ status: "owner"|"viewer" }` no-op).
  - `GET /api/access-requests?role=incoming|outgoing` → `{ requests: IAccessRequestView[] }` (type from Task 8).

- [ ] **Step 1: Write the create route**

```ts
// app/api/trees/[treeId]/access-requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import User from "@/lib/models/User";
import AccessRequest from "@/lib/models/AccessRequest";
import { resolveTreeAccess } from "@/lib/treeAccess";
import { validateAccessRequestInput } from "@/lib/accessRequest";
import { sendAccessRequestEmail } from "@/lib/mail";

type Params = { params: Promise<{ treeId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = validateAccessRequestInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await connectDB();
  // No-op if caller already has access.
  const { tree, role } = await resolveTreeAccess(treeId, session);
  if (role === "owner") return NextResponse.json({ status: "owner" });
  if (role === "viewer") return NextResponse.json({ status: "viewer" });

  // resolveTreeAccess returns null tree when no access; fetch directly to confirm existence.
  const target = tree ?? (await Tree.findById(treeId));
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const email = (session.user.email ?? "").toLowerCase();
  const updated = await AccessRequest.findOneAndUpdate(
    { treeId, requesterId: session.user.id },
    { $set: { status: "pending", requesterEmail: email, message: parsed.value.message }, $unset: { decidedAt: "" } },
    { upsert: true, new: true }
  );

  const owner = await User.findById(target.ownerId).select("email");
  if (owner?.email) {
    await sendAccessRequestEmail(
      owner.email,
      session.user.name ?? "A FamilyRoots user",
      target.name,
      parsed.value.message
    );
  }
  return NextResponse.json({ status: updated.status });
}
```

- [ ] **Step 2: Write the list route**

```ts
// app/api/access-requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import User from "@/lib/models/User";
import AccessRequest from "@/lib/models/AccessRequest";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const role = new URL(req.url).searchParams.get("role") === "outgoing" ? "outgoing" : "incoming";

  if (role === "outgoing") {
    const reqs = await AccessRequest.find({ requesterId: session.user.id }).sort({ updatedAt: -1 }).lean();
    const treeIds = [...new Set(reqs.map((r) => r.treeId.toString()))];
    const trees = await Tree.find({ _id: { $in: treeIds } }).lean();
    const treeById = new Map(trees.map((t) => [t._id.toString(), t]));
    const ownerIds = [...new Set(trees.map((t) => t.ownerId.toString()))];
    const owners = await User.find({ _id: { $in: ownerIds } }).select("name").lean();
    const ownerById = new Map(owners.map((u) => [u._id.toString(), u]));
    const requests = reqs.map((r) => {
      const t = treeById.get(r.treeId.toString());
      return {
        id: r._id.toString(),
        treeId: r.treeId.toString(),
        treeName: t?.name ?? "Unknown",
        counterpartyName: t ? ownerById.get(t.ownerId.toString())?.name ?? "Unknown" : "Unknown",
        status: r.status,
      };
    });
    return NextResponse.json({ requests });
  }

  // incoming: requests to trees I own
  const myTrees = await Tree.find({ ownerId: session.user.id }).select("name").lean();
  const myTreeIds = myTrees.map((t) => t._id.toString());
  const treeById = new Map(myTrees.map((t) => [t._id.toString(), t]));
  const reqs = await AccessRequest.find({ treeId: { $in: myTreeIds } }).sort({ updatedAt: -1 }).lean();
  const requesterIds = [...new Set(reqs.map((r) => r.requesterId.toString()))];
  const requesters = await User.find({ _id: { $in: requesterIds } }).select("name email").lean();
  const reqById = new Map(requesters.map((u) => [u._id.toString(), u]));
  const requests = reqs.map((r) => ({
    id: r._id.toString(),
    treeId: r.treeId.toString(),
    treeName: treeById.get(r.treeId.toString())?.name ?? "Unknown",
    counterpartyName: reqById.get(r.requesterId.toString())?.name ?? "Unknown",
    counterpartyEmail: reqById.get(r.requesterId.toString())?.email ?? r.requesterEmail,
    message: r.message,
    status: r.status,
  }));
  return NextResponse.json({ requests });
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 4: Manual verify**

From account B, POST `/api/trees/<A treeId>/access-requests` `{message:"please"}` → `{status:"pending"}`, account A gets email. `GET /api/access-requests?role=outgoing` (as B) shows it; `GET /api/access-requests?role=incoming` (as A) shows it with B's email. POST again as owner A on own tree → `{status:"owner"}`.

- [ ] **Step 5: Commit**

```bash
git add "app/api/trees/[treeId]/access-requests/route.ts" "app/api/access-requests/route.ts"
git commit -m "feat: access-request create + list routes"
```

---

### Task 7: Access-request decision route (approve/deny/revoke)

**Files:**
- Create: `app/api/access-requests/[id]/route.ts` (PATCH)

**Interfaces:**
- Consumes: `resolveAction` from `@/lib/accessRequest`; `resolveTreeAccess`; `AccessRequest`, `Tree` models.
- Produces: `PATCH` returning `{ status: AccessStatus }`.

- [ ] **Step 1: Write the route**

```ts
// app/api/access-requests/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import AccessRequest from "@/lib/models/AccessRequest";
import { resolveTreeAccess } from "@/lib/treeAccess";
import { resolveAction } from "@/lib/accessRequest";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";

  await connectDB();
  const request = await AccessRequest.findById(id);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Owner-only guard.
  const { role } = await resolveTreeAccess(request.treeId.toString(), session);
  if (role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const resolved = resolveAction(action, request.status);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
  const { nextStatus, grant, revoke } = resolved.value;

  if (grant)
    await Tree.updateOne({ _id: request.treeId }, { $addToSet: { sharedEmails: request.requesterEmail } });
  if (revoke)
    await Tree.updateOne({ _id: request.treeId }, { $pull: { sharedEmails: request.requesterEmail } });

  request.status = nextStatus;
  request.decidedAt = new Date();
  await request.save();

  return NextResponse.json({ status: nextStatus });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 3: Manual verify**

As owner A, `PATCH /api/access-requests/<id>` `{action:"approve"}` → `{status:"approved"}`; confirm B's email now in `Tree.sharedEmails` and B sees the tree under "shared" (`GET /api/trees`). `{action:"revoke"}` → removed. As non-owner → 403. Invalid transition (approve twice) → 400.

- [ ] **Step 4: Commit**

```bash
git add "app/api/access-requests/[id]/route.ts"
git commit -m "feat: access-request approve/deny/revoke route"
```

---

### Task 8: DTO types + SWR hooks

**Files:**
- Modify: `types/index.ts` (append)
- Create: `hooks/useSearch.ts`
- Create: `hooks/useAccessRequests.ts`

**Interfaces:**
- Consumes: routes from Tasks 4, 6, 7.
- Produces:
  - Types `ISearchResult`, `IAccessRequestView`, `AccessStatusDTO` in `@/types`.
  - `useAccessRequests(role: "incoming" | "outgoing")` → `{ requests, isLoading, mutate }`.
  - Search uses direct `fetch` in the page (query is imperative), so no search hook is strictly needed — provide `runSearch(term, field)` helper in `hooks/useSearch.ts`.

- [ ] **Step 1: Append types**

```ts
// types/index.ts — append
export type AccessStatusDTO = "pending" | "approved" | "denied" | "revoked";

export interface ISearchResult {
  personId: string
  personName: string
  place: string
  treeId: string
  treeName: string
  ownerName: string
  access: "owner" | "viewer" | "pending" | "none"
}

export interface IAccessRequestView {
  id: string
  treeId: string
  treeName: string
  counterpartyName: string
  counterpartyEmail?: string
  message?: string
  status: AccessStatusDTO
}
```

- [ ] **Step 2: Write the hooks**

```ts
// hooks/useSearch.ts
import type { ISearchResult } from "@/types";

export async function runSearch(
  term: string,
  field: "name" | "place"
): Promise<{ results: ISearchResult[]; truncated: boolean }> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(term)}&field=${field}`);
  if (!res.ok) return { results: [], truncated: false };
  return res.json();
}
```

```ts
// hooks/useAccessRequests.ts
import useSWR from "swr";
import type { IAccessRequestView } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useAccessRequests(role: "incoming" | "outgoing") {
  const { data, error, isLoading, mutate } = useSWR<{ requests: IAccessRequestView[] }>(
    `/api/access-requests?role=${role}`,
    fetcher
  );
  return { requests: data?.requests ?? [], error, isLoading, mutate };
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts hooks/useSearch.ts hooks/useAccessRequests.ts
git commit -m "feat: DTO types + search/access-request hooks"
```

---

### Task 9: Sidebar nav + i18n keys + Search page

**Files:**
- Modify: `messages/en.json`, `messages/he.json`, `messages/ka.json` (add `nav.search`, `nav.requests`)
- Modify: `components/layout/Sidebar.tsx` (add two nav entries)
- Create: `app/(dashboard)/search/page.tsx`

**Interfaces:**
- Consumes: `runSearch` from `@/hooks/useSearch`; `ISearchResult`.
- Produces: `/search` page; nav links to `/search` and `/requests`.

Note: `he`/`ka` get English strings for the two new nav keys as a placeholder; proper translation is a follow-up (flagged, not silent).

- [ ] **Step 1: Add nav keys to all three locale files**

In `messages/en.json` under `"nav"` add:
```json
"search": "Search",
"requests": "Requests"
```
In `messages/he.json` and `messages/ka.json` under `"nav"` add the same two keys with English values (placeholder):
```json
"search": "Search",
"requests": "Requests"
```

- [ ] **Step 2: Add nav entries in Sidebar**

In `components/layout/Sidebar.tsx`, extend the import and `nav` array:
```ts
import { Home, Trees, User, Dna, ShieldCheck, Microscope, Mail, Search, Inbox } from "lucide-react";
```
```ts
  const nav = [
    { href: "/dashboard", label: t("dashboard"), icon: Home },
    { href: "/trees", label: t("trees"), icon: Trees },
    { href: "/search", label: t("search"), icon: Search },
    { href: "/requests", label: t("requests"), icon: Inbox },
    { href: "/profile", label: t("profile"), icon: User },
    { href: "/researcher", label: t("researcher"), icon: Microscope },
    { href: "/contact", label: t("contact"), icon: Mail },
    { href: "/dna", label: t("dna"), icon: Dna },
  ];
```

- [ ] **Step 3: Write the Search page**

```tsx
// app/(dashboard)/search/page.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { runSearch } from "@/hooks/useSearch";
import type { ISearchResult } from "@/types";
import { cn } from "@/lib/utils";

export default function SearchPage() {
  const [term, setTerm] = useState("");
  const [field, setField] = useState<"name" | "place">("name");
  const [results, setResults] = useState<ISearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [msgFor, setMsgFor] = useState<ISearchResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (term.trim().length < 2) return;
    setLoading(true);
    const r = await runSearch(term.trim(), field);
    setResults(r.results);
    setSearched(true);
    setLoading(false);
  }

  async function requestAccess(treeId: string) {
    await fetch(`/api/trees/${treeId}/access-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    setResults((rs) => rs.map((r) => (r.treeId === treeId ? { ...r, access: "pending" } : r)));
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Search family trees</h1>
      <form onSubmit={submit} className="flex gap-2 mb-6">
        <select
          value={field}
          onChange={(e) => setField(e.target.value as "name" | "place")}
          className="border rounded-md px-2 text-sm"
        >
          <option value="name">Name</option>
          <option value="place">Place</option>
        </select>
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="First/last name or city/country…"
          className="flex-1 border rounded-md px-3 py-2 text-sm"
        />
        <button className="bg-emerald-600 text-white rounded-md px-4 text-sm font-medium">Search</button>
      </form>

      {loading && <p className="text-sm text-gray-500">Searching…</p>}
      {searched && !loading && results.length === 0 && (
        <p className="text-sm text-gray-500">No matches.</p>
      )}

      <ul className="space-y-3">
        {results.map((r) => (
          <li key={r.personId} className="border rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{r.personName}</p>
                {r.place && <p className="text-sm text-gray-500">{r.place}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  Tree: {r.treeName} · Owner: {r.ownerName}
                </p>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {(r.access === "owner" || r.access === "viewer") && (
                  <Link href={`/trees/${r.treeId}`} className="text-emerald-700 text-sm font-medium">
                    Open tree
                  </Link>
                )}
                {r.access === "none" && (
                  <>
                    <button
                      onClick={() => requestAccess(r.treeId)}
                      className="bg-emerald-600 text-white rounded-md px-3 py-1 text-xs font-medium"
                    >
                      Request access
                    </button>
                    <button
                      onClick={() => setMsgFor(r)}
                      className="border rounded-md px-3 py-1 text-xs font-medium"
                    >
                      Message owner
                    </button>
                  </>
                )}
                {r.access === "pending" && (
                  <span className={cn("text-xs text-amber-600 font-medium")}>Requested</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {msgFor && <MessageDialog result={msgFor} onClose={() => setMsgFor(null)} />}
    </div>
  );
}

function MessageDialog({ result, onClose }: { result: ISearchResult; onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function send() {
    await fetch(`/api/trees/${result.treeId}/contact-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message }),
    });
    setSent(true);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-semibold mb-3">Message {result.ownerName}</h2>
        {sent ? (
          <p className="text-sm text-emerald-700">Message sent.</p>
        ) : (
          <>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="w-full border rounded-md px-3 py-2 text-sm mb-2"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Your message…"
              rows={4}
              className="w-full border rounded-md px-3 py-2 text-sm mb-3"
            />
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="text-sm px-3 py-1">Cancel</button>
              <button
                onClick={send}
                disabled={!subject.trim() || !message.trim()}
                className="bg-emerald-600 text-white rounded-md px-4 py-1 text-sm font-medium disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify build + manual**

Run: `npm run build`
Then `npm run dev`: visit `/search`, search by name and place, confirm result cards, request-access flips to "Requested", message dialog sends.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/he.json messages/ka.json components/layout/Sidebar.tsx "app/(dashboard)/search/page.tsx"
git commit -m "feat: search page + sidebar nav + i18n keys"
```

---

### Task 10: Requests page (incoming + outgoing)

**Files:**
- Create: `app/(dashboard)/requests/page.tsx`

**Interfaces:**
- Consumes: `useAccessRequests` from `@/hooks/useAccessRequests`; `IAccessRequestView`.
- Produces: `/requests` page with Approve/Deny/Revoke (incoming) + status list (outgoing).

- [ ] **Step 1: Write the page**

```tsx
// app/(dashboard)/requests/page.tsx
"use client";
import { useAccessRequests } from "@/hooks/useAccessRequests";
import type { IAccessRequestView, AccessStatusDTO } from "@/types";

async function act(id: string, action: "approve" | "deny" | "revoke") {
  await fetch(`/api/access-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

const badge: Record<AccessStatusDTO, string> = {
  pending: "text-amber-600",
  approved: "text-emerald-700",
  denied: "text-gray-500",
  revoked: "text-red-600",
};

export default function RequestsPage() {
  const incoming = useAccessRequests("incoming");
  const outgoing = useAccessRequests("outgoing");

  async function run(id: string, action: "approve" | "deny" | "revoke") {
    await act(id, action);
    incoming.mutate();
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Incoming requests</h1>
        {incoming.requests.length === 0 && <p className="text-sm text-gray-500">No requests.</p>}
        <ul className="space-y-3">
          {incoming.requests.map((r: IAccessRequestView) => (
            <li key={r.id} className="border rounded-lg p-4">
              <p className="font-medium">{r.counterpartyName}</p>
              <p className="text-xs text-gray-400">{r.counterpartyEmail} · Tree: {r.treeName}</p>
              {r.message && <p className="text-sm text-gray-600 mt-1">{r.message}</p>}
              <div className="flex gap-2 mt-3 items-center">
                <span className={`text-xs font-medium ${badge[r.status]}`}>{r.status}</span>
                {r.status === "pending" && (
                  <>
                    <button onClick={() => run(r.id, "approve")} className="bg-emerald-600 text-white rounded-md px-3 py-1 text-xs font-medium">Approve</button>
                    <button onClick={() => run(r.id, "deny")} className="border rounded-md px-3 py-1 text-xs font-medium">Deny</button>
                  </>
                )}
                {r.status === "approved" && (
                  <button onClick={() => run(r.id, "revoke")} className="border border-red-300 text-red-600 rounded-md px-3 py-1 text-xs font-medium">Revoke</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">My requests</h2>
        {outgoing.requests.length === 0 && <p className="text-sm text-gray-500">No requests sent.</p>}
        <ul className="space-y-3">
          {outgoing.requests.map((r: IAccessRequestView) => (
            <li key={r.id} className="border rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{r.treeName}</p>
                <p className="text-xs text-gray-400">Owner: {r.counterpartyName}</p>
              </div>
              <span className={`text-xs font-medium ${badge[r.status]}`}>{r.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify build + full end-to-end**

Run: `npm run build && npm test`
Then `npm run dev` with two accounts A and B:
1. B searches, requests access to A's tree.
2. A visits `/requests`, sees incoming pending, clicks Approve.
3. B's `/trees` now lists A's tree (viewer). B opens it.
4. A clicks Revoke; B loses access (tree view returns 404/no access).
5. Confirm Deny path and outgoing status badges.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/requests/page.tsx"
git commit -m "feat: requests page (incoming + outgoing)"
```

---

## Self-Review

**Spec coverage:**
- Search by first/last name → Task 2/4 (`name` field). ✓
- Search by country/city → Task 2/4 (`place` field, substring of birthPlace/deathPlace). ✓
- Discoverable trees → Task 4 searches all trees. ✓
- Message owner's email → Tasks 3/5. ✓
- Request access → Task 6. ✓
- Owner approve/deny → Task 7. ✓
- Owner revoke anytime → Task 7 (revoke from approved). ✓
- Private tree access only after grant → unchanged `resolveTreeAccess`; grant via `sharedEmails` (Task 7); search exposes card only. ✓
- Logged-in only → 401 guard on every route. ✓

**Placeholder scan:** No TBD/TODO. `he`/`ka` nav strings intentionally English (flagged in Task 9), not a silent gap.

**Type consistency:** `AccessStatus`/`AccessStatusDTO` values identical across model, `lib/accessRequest.ts`, `types/index.ts`. `computeAccess` return union matches `ISearchResult.access`. `resolveAction` field names (`nextStatus`, `grant`, `revoke`) match Task 7 usage. Hook/return shapes (`requests`, `mutate`) match page usage.

## Known follow-ups (out of scope)

- Real `he`/`ka` translations for `nav.search` / `nav.requests` and page copy.
- Page-level i18n (pages use inline English strings; rest of app is translated).
- Requester-facing decision emails (owner explicitly deferred).
