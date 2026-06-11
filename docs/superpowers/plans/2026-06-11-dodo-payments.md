# Dodo Payments Subscription Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Dodo Payments subscription billing with Free/Standard/Premium tiers, enforced at both API and UI layers.

**Architecture:** `@dodopayments/nextjs` adapter handles checkout, customer portal, and webhook parsing. Subscription state lives as 5 fields on the existing User Mongoose document. Plan is forwarded through the NextAuth JWT so client components read it from `useSession()` without extra DB hits. Feature gates run server-side in the API routes (hard block) and client-side in the UI (soft inline banners).

**Tech Stack:** `@dodopayments/nextjs`, Next.js 16 App Router, Mongoose 9, NextAuth v5 beta.31, TypeScript, Tailwind CSS v4, shadcn/ui (Base UI, `render` prop — no `asChild`)

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `lib/plans.ts` | Plan type, limits constants, productId→plan mapping |
| `components/billing/SubscribeButton.tsx` | Client button: fetch checkout URL, redirect |
| `app/api/checkout/route.ts` | Dodo static checkout handler (GET) |
| `app/api/customer-portal/route.ts` | Dodo customer portal redirect (GET) |
| `app/api/webhooks/dodo/route.ts` | Webhook handler — updates User plan fields |
| `app/(marketing)/layout.tsx` | Minimal public layout (header with Login link) |
| `app/(marketing)/pricing/page.tsx` | Public 3-column pricing page |
| `app/(dashboard)/settings/billing/page.tsx` | Billing management (reads fresh from DB) |

### Modified files
| File | What changes |
|------|-------------|
| `lib/models/User.ts` | Add 5 billing fields to schema + interface |
| `types/index.ts` | Add `plan` + `planStatus` to `IUser` DTO |
| `lib/auth.ts` | Type augment NextAuth; forward plan through JWT/session |
| `app/api/trees/route.ts` | Gate POST by tree count |
| `app/api/trees/[treeId]/persons/route.ts` | Gate POST by person count (free tier) |
| `app/api/ai/chat/route.ts` | Gate POST by plan |
| `components/ai/ChatWidget.tsx` | Show upgrade banner when plan is free |
| `app/(dashboard)/dashboard/page.tsx` | Show tree-limit banner before create form |

---

## Task 1: Install package and configure environment

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Install the adapter**

```bash
npm install @dodopayments/nextjs
```

Expected output: `added 1 package` (or similar, no errors)

- [ ] **Step 2: Add env vars to `.env.local`**

Append these lines:

```
DODO_PAYMENTS_API_KEY=MPDvcls9p07O2Wq0.okyqGCy2GtjqY3MvDYzM3kLs3XMaJqJ4csDm0tLjHgJJAQDI
DODO_PAYMENTS_WEBHOOK_KEY=<paste from Dodo dashboard → Developer → Webhooks → signing secret>
DODO_PAYMENTS_RETURN_URL=http://localhost:3000/settings/billing
DODO_PAYMENTS_ENVIRONMENT=test_mode
```

To get `DODO_PAYMENTS_WEBHOOK_KEY`: log into Dodo dashboard → Developer → Webhooks → create endpoint `https://<your-domain>/api/webhooks/dodo` → copy the signing secret.

- [ ] **Step 3: Verify TypeScript sees the package**

```bash
npx tsc --noEmit 2>&1 | head -5
```

Expected: no errors about `@dodopayments/nextjs` (other errors OK for now).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @dodopayments/nextjs adapter"
```

---

## Task 2: Create plan constants (`lib/plans.ts`)

**Files:**
- Create: `lib/plans.ts`

- [ ] **Step 1: Create the file**

```ts
// lib/plans.ts
export type Plan = 'free' | 'standard' | 'premium'
export type PlanStatus = 'active' | 'cancelled' | 'on_hold' | 'expired'

// TODO: add premium product ID when available: 'pdt_PREMIUM_ID_HERE': 'premium'
export const PLAN_PRODUCT_MAP: Record<string, Plan> = {
  pdt_0Ngp959eAaBGtnmvgciKO: 'standard',
}

export const PLAN_LIMITS = {
  free:     { maxTrees: 1,        maxPersonsPerTree: 30,       aiChat: false },
  standard: { maxTrees: 1,        maxPersonsPerTree: Infinity, aiChat: true  },
  premium:  { maxTrees: Infinity, maxPersonsPerTree: Infinity, aiChat: true  },
} as const

export function getPlanFromProductId(productId: string): Plan {
  return PLAN_PRODUCT_MAP[productId] ?? 'free'
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit 2>&1 | grep "lib/plans"
```

Expected: no output (no errors in that file).

- [ ] **Step 3: Commit**

```bash
git add lib/plans.ts
git commit -m "feat: add plan constants and limits"
```

---

## Task 3: Update User model

**Files:**
- Modify: `lib/models/User.ts`

- [ ] **Step 1: Replace `lib/models/User.ts` with updated version**

```ts
import mongoose, { Schema, Document, models, model } from "mongoose";

export interface IUserDoc extends Document {
  name: string;
  email: string;
  password?: string;
  image?: string;
  role: "user" | "admin";
  plan: "free" | "standard" | "premium";
  planStatus: "active" | "cancelled" | "on_hold" | "expired";
  dodoCustomerId?: string | null;
  dodoSubscriptionId?: string | null;
  planExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDoc>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },
    image: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    plan: {
      type: String,
      enum: ["free", "standard", "premium"],
      default: "free",
    },
    planStatus: {
      type: String,
      enum: ["active", "cancelled", "on_hold", "expired"],
      default: "active",
    },
    dodoCustomerId: { type: String, default: null },
    dodoSubscriptionId: { type: String, default: null },
    planExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default models.User ?? model<IUserDoc>("User", UserSchema);
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep "models/User"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/models/User.ts
git commit -m "feat: add billing fields to User model"
```

---

## Task 4: Update IUser DTO

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add `plan` and `planStatus` to `IUser`**

Find the `IUser` interface (lines 1–8 of `types/index.ts`) and replace it:

```ts
export interface IUser {
  _id: string
  name: string
  email: string
  image?: string
  role: 'user' | 'admin'
  plan: 'free' | 'standard' | 'premium'
  planStatus: 'active' | 'cancelled' | 'on_hold' | 'expired'
  createdAt: Date
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep "types/index"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add plan fields to IUser DTO"
```

---

## Task 5: Forward plan through NextAuth session

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Replace `lib/auth.ts` with updated version**

```ts
import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDB } from "./db";
import User from "./models/User";
import type { Plan, PlanStatus } from "./plans";

declare module "next-auth" {
  interface User {
    role?: string;
    plan?: Plan;
    planStatus?: PlanStatus;
  }
  interface Session {
    user: {
      id: string;
      role: string;
      plan: Plan;
      planStatus: PlanStatus;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    plan?: string;
    planStatus?: string;
  }
}

const googleProvider =
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ...googleProvider,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        await connectDB();
        const user = await User.findOne({
          email: (credentials.email as string).toLowerCase(),
        });

        if (!user?.password) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!valid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          plan: user.plan,
          planStatus: user.planStatus,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "google") {
        if (!token.email) throw new Error("Google account missing email");
        await connectDB();
        const dbUser = await User.findOneAndUpdate(
          { email: token.email },
          {
            $set: { name: token.name, image: token.picture },
            $setOnInsert: { email: token.email },
          },
          { upsert: true, new: true }
        );
        token.id = dbUser._id.toString();
        token.role = dbUser.role;
        token.plan = dbUser.plan ?? "free";
        token.planStatus = dbUser.planStatus ?? "active";
      } else if (user) {
        token.id = user.id;
        token.role = user.role;
        token.plan = user.plan ?? "free";
        token.planStatus = user.planStatus ?? "active";
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      if (token.role) session.user.role = token.role as string;
      session.user.plan = (token.plan ?? "free") as Plan;
      session.user.planStatus = (token.planStatus ?? "active") as PlanStatus;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit 2>&1 | grep "lib/auth"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/auth.ts
git commit -m "feat: forward plan and planStatus through NextAuth JWT session"
```

---

## Task 6: Checkout API route

**Files:**
- Create: `app/api/checkout/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { Checkout } from "@dodopayments/nextjs";

export const GET = Checkout({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  returnUrl: process.env.DODO_PAYMENTS_RETURN_URL!,
  environment: (process.env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode") as
    | "test_mode"
    | "live_mode",
  type: "static",
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "api/checkout"
```

Expected: no output.

- [ ] **Step 3: Smoke-test the route (start dev server first)**

```bash
curl "http://localhost:3000/api/checkout?productId=pdt_0Ngp959eAaBGtnmvgciKO&email=test@example.com"
```

Expected: JSON response containing a `checkout_url` field.

- [ ] **Step 4: Commit**

```bash
git add app/api/checkout/route.ts
git commit -m "feat: add Dodo static checkout API route"
```

---

## Task 7: Customer portal API route

**Files:**
- Create: `app/api/customer-portal/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { CustomerPortal } from "@dodopayments/nextjs";

export const GET = CustomerPortal({
  bearerToken: process.env.DODO_PAYMENTS_API_KEY!,
  environment: (process.env.DODO_PAYMENTS_ENVIRONMENT ?? "test_mode") as
    | "test_mode"
    | "live_mode",
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "customer-portal"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/customer-portal/route.ts
git commit -m "feat: add Dodo customer portal API route"
```

---

## Task 8: Webhook handler

**Files:**
- Create: `app/api/webhooks/dodo/route.ts`

- [ ] **Step 1: Create the handler**

```ts
import { Webhooks } from "@dodopayments/nextjs";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { getPlanFromProductId } from "@/lib/plans";

type SubscriptionData = {
  subscription_id?: string;
  product_id?: string;
  next_billing_date?: string;
  customer?: { customer_id: string; email?: string };
};

async function handleSubscriptionEvent(
  type: string,
  data: SubscriptionData
) {
  await connectDB();

  const subId = data.subscription_id;
  const customerId = data.customer?.customer_id;
  const email = data.customer?.email;

  switch (type) {
    case "subscription.active": {
      if (!subId || !customerId) return;
      const plan = getPlanFromProductId(data.product_id ?? "");
      const update = {
        plan,
        planStatus: "active",
        dodoCustomerId: customerId,
        dodoSubscriptionId: subId,
        planExpiresAt: data.next_billing_date
          ? new Date(data.next_billing_date)
          : null,
      };
      // Try subscription ID first (idempotency), then customer ID, then email
      const bySubId = await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        update
      );
      if (!bySubId) {
        const byCustomerId = await User.findOneAndUpdate(
          { dodoCustomerId: customerId },
          update
        );
        if (!byCustomerId && email) {
          await User.findOneAndUpdate({ email }, update);
        }
      }
      break;
    }

    case "subscription.renewed": {
      if (!subId) return;
      await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        {
          planStatus: "active",
          planExpiresAt: data.next_billing_date
            ? new Date(data.next_billing_date)
            : null,
        }
      );
      break;
    }

    case "subscription.cancelled": {
      if (!subId) return;
      await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        { planStatus: "cancelled" }
      );
      break;
    }

    case "subscription.on_hold": {
      if (!subId) return;
      await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        { planStatus: "on_hold" }
      );
      break;
    }

    case "subscription.expired": {
      if (!subId) return;
      await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        {
          plan: "free",
          planStatus: "active",
          dodoSubscriptionId: null,
          planExpiresAt: null,
        }
      );
      break;
    }

    case "subscription.plan_changed": {
      if (!subId || !data.product_id) return;
      await User.findOneAndUpdate(
        { dodoSubscriptionId: subId },
        { plan: getPlanFromProductId(data.product_id) }
      );
      break;
    }
  }
}

export const POST = Webhooks({
  webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY!,
  onPayload: async (payload) => {
    const { type } = payload;
    if (!type.startsWith("subscription.")) return;
    await handleSubscriptionEvent(
      type,
      (payload.data ?? {}) as SubscriptionData
    );
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "webhooks/dodo"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/dodo/route.ts
git commit -m "feat: add Dodo webhook handler for subscription lifecycle events"
```

---

## Task 9: Create SubscribeButton component

**Files:**
- Create: `components/billing/SubscribeButton.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  productId: string;
  email: string;
  label?: string;
  className?: string;
}

export function SubscribeButton({
  productId,
  email,
  label = "Subscribe",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/checkout?productId=${encodeURIComponent(productId)}&email=${encodeURIComponent(email)}`
      );
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} className={className}>
      {loading ? "Loading…" : label}
    </Button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "billing/SubscribeButton"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/billing/SubscribeButton.tsx
git commit -m "feat: add SubscribeButton client component"
```

---

## Task 10: Gate tree creation by plan

**Files:**
- Modify: `app/api/trees/route.ts`

- [ ] **Step 1: Replace `app/api/trees/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import { PLAN_LIMITS } from "@/lib/plans";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const trees = await Tree.find({ ownerId: session.user.id }).sort({
    updatedAt: -1,
  });
  return NextResponse.json(trees);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, isPublic } = await req.json();
  if (!name)
    return NextResponse.json({ error: "Name is required" }, { status: 400 });

  await connectDB();

  const plan = session.user.plan ?? "free";
  const limit = PLAN_LIMITS[plan].maxTrees;
  const count = await Tree.countDocuments({ ownerId: session.user.id });
  if (count >= limit) {
    return NextResponse.json(
      { error: "Tree limit reached for your plan", upgradeRequired: true },
      { status: 403 }
    );
  }

  const tree = await Tree.create({
    name,
    description,
    isPublic: isPublic ?? false,
    ownerId: session.user.id,
  });
  return NextResponse.json(tree, { status: 201 });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "api/trees/route"
```

Expected: no output.

- [ ] **Step 3: Smoke-test (dev server running, logged in as free user with 1 tree)**

```bash
curl -X POST http://localhost:3000/api/trees \
  -H "Content-Type: application/json" \
  -H "Cookie: <your session cookie>" \
  -d '{"name":"Second Tree"}'
```

Expected for free user with 1 tree: `{"error":"Tree limit reached for your plan","upgradeRequired":true}` with status 403.

- [ ] **Step 4: Commit**

```bash
git add app/api/trees/route.ts
git commit -m "feat: gate tree creation by plan tree limit"
```

---

## Task 11: Gate person creation by plan

**Files:**
- Modify: `app/api/trees/[treeId]/persons/route.ts`

- [ ] **Step 1: Replace `app/api/trees/[treeId]/persons/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import Person from "@/lib/models/Person";
import { PLAN_LIMITS } from "@/lib/plans";

type Params = { params: Promise<{ treeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  await connectDB();

  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const persons = await Person.find({ treeId }).sort({ lastName: 1 });
  return NextResponse.json(persons);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  await connectDB();

  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const plan = session.user.plan ?? "free";
  const limit = PLAN_LIMITS[plan].maxPersonsPerTree;
  if (limit !== Infinity) {
    const count = await Person.countDocuments({ treeId });
    if (count >= limit) {
      return NextResponse.json(
        { error: "Person limit reached for your plan", upgradeRequired: true },
        { status: 403 }
      );
    }
  }

  const body = await req.json();
  if (!body.firstName || !body.lastName)
    return NextResponse.json(
      { error: "firstName and lastName are required" },
      { status: 400 }
    );

  const person = await Person.create({ ...body, treeId });
  return NextResponse.json(person, { status: 201 });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "persons/route"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/api/trees/[treeId]/persons/route.ts"
git commit -m "feat: gate person creation at 30 for free tier"
```

---

## Task 12: Gate AI chat by plan

**Files:**
- Modify: `app/api/ai/chat/route.ts`

- [ ] **Step 1: Add plan check at the top of the POST handler**

After the existing `if (!process.env.OPENROUTER_API_KEY)` check (line 82 in the current file), add:

```ts
  const plan = session.user.plan ?? "free";
  if (plan === "free") {
    return NextResponse.json(
      { error: "AI chat requires a Standard or Premium plan", upgradeRequired: true },
      { status: 403 }
    );
  }
```

The full POST handler start becomes:

```ts
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.OPENROUTER_API_KEY)
    return NextResponse.json(
      { error: "AI service not configured" },
      { status: 500 }
    )

  const plan = session.user.plan ?? "free"
  if (plan === "free") {
    return NextResponse.json(
      { error: "AI chat requires a Standard or Premium plan", upgradeRequired: true },
      { status: 403 }
    )
  }

  // ... rest of handler unchanged
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "ai/chat"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add app/api/ai/chat/route.ts
git commit -m "feat: gate AI chat route to paid plans"
```

---

## Task 13: ChatWidget plan gate (UI)

**Files:**
- Modify: `components/ai/ChatWidget.tsx`

- [ ] **Step 1: Add `useSession` import and plan-aware input area**

Add to the top of the file (after existing imports):

```ts
import { useSession } from "next-auth/react"
```

Inside the `ChatWidget` function body, after `const treeId = ...`:

```ts
  const { data: session } = useSession()
  const plan = session?.user?.plan ?? "free"
```

Replace the bottom input section (the `<div className="border-t border-gray-100 p-3 flex gap-2">` block) with:

```tsx
          {plan === "free" ? (
            <div className="border-t border-gray-100 p-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                <p className="text-sm font-medium text-amber-800">
                  AI chat is a paid feature
                </p>
                <a
                  href="/pricing"
                  className="text-xs text-amber-600 underline mt-1 inline-block"
                >
                  Upgrade to Standard →
                </a>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-100 p-3 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your ancestors..."
                disabled={streaming}
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-amber-400 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || streaming}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg px-3 py-2 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          )}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "ChatWidget"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/ai/ChatWidget.tsx
git commit -m "feat: show upgrade banner in ChatWidget for free plan users"
```

---

## Task 14: Dashboard tree limit banner (UI)

**Files:**
- Modify: `app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Add `useSession` and plan-aware new-tree logic**

Add imports at the top (after existing imports):

```ts
import { useSession } from "next-auth/react"
import { PLAN_LIMITS } from "@/lib/plans"
import Link from "next/link"
```

Inside `DashboardPage` function body, after `const [creating, setCreating] = useState(false);`:

```ts
  const { data: session } = useSession()
  const plan = session?.user?.plan ?? "free"
  const treeLimit = PLAN_LIMITS[plan].maxTrees
  const atTreeLimit = trees.length >= treeLimit
```

Replace the `<Button onClick={() => setShowForm(true)}>+ New Tree</Button>` with:

```tsx
        {atTreeLimit ? (
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1 text-sm bg-amber-50 border border-amber-300 text-amber-800 px-3 py-2 rounded-lg hover:bg-amber-100 transition-colors"
          >
            Upgrade for more trees →
          </Link>
        ) : (
          <Button onClick={() => setShowForm(true)}>+ New Tree</Button>
        )}
```

Replace the `{showForm && ( ... )}` block's opening condition so the form only shows when not at limit:

The condition `showForm` already prevents showing the form when `atTreeLimit` is true (since the button that sets `showForm` won't render). No further change needed here.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "dashboard/page"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/page.tsx"
git commit -m "feat: show tree upgrade prompt on dashboard when plan limit reached"
```

---

## Task 15: Marketing layout and pricing page

**Files:**
- Create: `app/(marketing)/layout.tsx`
- Create: `app/(marketing)/pricing/page.tsx`

- [ ] **Step 1: Create `app/(marketing)/layout.tsx`**

```tsx
import Link from "next/link";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-amber-500 text-lg">
          Genealogy
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-amber-500"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create `app/(marketing)/pricing/page.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { SubscribeButton } from "@/components/billing/SubscribeButton";
import { Check } from "lucide-react";

const FREE_FEATURES = [
  "1 family tree",
  "Up to 30 people per tree",
  "Relationship mapping",
  "Family tree canvas",
];

const STANDARD_FEATURES = [
  "1 family tree",
  "Unlimited people per tree",
  "Relationship mapping",
  "Family tree canvas",
  "AI research assistant",
];

const PREMIUM_FEATURES = [
  "Unlimited family trees",
  "Unlimited people per tree",
  "Relationship mapping",
  "Family tree canvas",
  "AI research assistant",
];

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-gray-600">
      <Check size={16} className="text-amber-500 shrink-0" />
      {text}
    </li>
  );
}

export default async function PricingPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const currentPlan = session?.user?.plan ?? null;

  return (
    <div className="bg-gray-50 py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-3">Choose your plan</h1>
        <p className="text-center text-gray-500 mb-12">
          Start free. Upgrade when you&apos;re ready.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Free</h2>
              <div className="text-3xl font-bold mt-1">$0</div>
              <p className="text-sm text-gray-500 mt-1">Forever free</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {FREE_FEATURES.map((f) => (
                <FeatureItem key={f} text={f} />
              ))}
            </ul>
            {currentPlan === "free" || !currentPlan ? (
              <div className="w-full text-center py-2 text-sm font-medium text-gray-400 border border-gray-200 rounded-lg">
                Current plan
              </div>
            ) : (
              <a
                href="/register"
                className="w-full text-center py-2 text-sm font-medium border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Get started
              </a>
            )}
          </div>

          {/* Standard */}
          <div className="bg-white rounded-2xl border-2 border-amber-400 p-6 flex flex-col relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-white text-xs font-semibold px-3 py-1 rounded-full">
              Most popular
            </div>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Standard</h2>
              <div className="text-3xl font-bold mt-1">TBD</div>
              <p className="text-sm text-gray-500 mt-1">per month</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {STANDARD_FEATURES.map((f) => (
                <FeatureItem key={f} text={f} />
              ))}
            </ul>
            {currentPlan === "standard" ? (
              <div className="w-full text-center py-2 text-sm font-medium text-gray-400 border border-gray-200 rounded-lg">
                Current plan
              </div>
            ) : email ? (
              <SubscribeButton
                productId="pdt_0Ngp959eAaBGtnmvgciKO"
                email={email}
                label="Subscribe"
                className="w-full"
              />
            ) : (
              <a
                href="/register"
                className="w-full text-center py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
              >
                Get started
              </a>
            )}
          </div>

          {/* Premium */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Premium</h2>
              <div className="text-3xl font-bold mt-1">TBD</div>
              <p className="text-sm text-gray-500 mt-1">per month</p>
            </div>
            <ul className="space-y-2 flex-1 mb-6">
              {PREMIUM_FEATURES.map((f) => (
                <FeatureItem key={f} text={f} />
              ))}
            </ul>
            <div className="w-full text-center py-2 text-sm font-medium text-gray-400 border border-gray-200 rounded-lg">
              Coming soon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "marketing"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add "app/(marketing)/layout.tsx" "app/(marketing)/pricing/page.tsx"
git commit -m "feat: add public pricing page with Free/Standard/Premium tiers"
```

---

## Task 16: Billing settings page

**Files:**
- Create: `app/(dashboard)/settings/billing/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  standard: "Standard",
  premium: "Premium",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  cancelled: "Cancelled",
  on_hold: "On Hold",
  expired: "Expired",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  on_hold: "bg-yellow-100 text-yellow-800",
  expired: "bg-gray-100 text-gray-600",
};

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  await connectDB();
  const user = await User.findById(session.user.id)
    .select("plan planStatus dodoCustomerId planExpiresAt")
    .lean();

  if (!user) redirect("/login");

  const plan = user.plan ?? "free";
  const planStatus = user.planStatus ?? "active";
  const customerId = user.dodoCustomerId ?? null;
  const nextBilling = user.planExpiresAt
    ? new Date(user.planExpiresAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Billing</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Plan</span>
            <span className="font-semibold">{PLAN_LABELS[plan] ?? plan}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Status</span>
            <span
              className={`text-xs font-medium px-2 py-1 rounded-full ${
                STATUS_COLORS[planStatus] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {STATUS_LABELS[planStatus] ?? planStatus}
            </span>
          </div>
          {nextBilling && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Next billing</span>
              <span className="text-sm">{nextBilling}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {plan !== "free" && customerId && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Manage Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Update your payment method, view invoices, or cancel your
              subscription.
            </p>
            <a
              href={`/api/customer-portal?customer_id=${customerId}`}
              className="inline-flex items-center px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Open customer portal →
            </a>
          </CardContent>
        </Card>
      )}

      {plan === "free" && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800">Upgrade your plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 mb-4">
              You&apos;re on the free plan. Upgrade to Standard for unlimited
              people and AI features, or Premium for unlimited trees.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center px-4 py-2 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
            >
              View plans →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "billing"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add "app/(dashboard)/settings/billing/page.tsx"
git commit -m "feat: add billing settings page with plan status and portal link"
```

---

## Task 17: Add Billing link to settings sidebar and full build check

**Files:**
- Modify: `app/(dashboard)/settings/page.tsx` (add link to billing)
- Run: `npm run build`

- [ ] **Step 1: Add billing link to Settings page**

Replace the contents of `app/(dashboard)/settings/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span>{session?.user?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span>{session?.user?.email ?? "—"}</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/billing"
            className="text-sm text-amber-600 hover:underline"
          >
            Manage your plan and subscription →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: builds successfully, no errors.

- [ ] **Step 4: Commit**

```bash
git add "app/(dashboard)/settings/page.tsx"
git commit -m "feat: add billing link to settings page"
```

---

## Self-Review Checklist

All spec requirements covered:

| Requirement | Task |
|-------------|------|
| User model billing fields | Task 3 |
| IUser DTO update | Task 4 |
| NextAuth session plan | Task 5 |
| Checkout API route | Task 6 |
| Customer portal route | Task 7 |
| Webhook handler (all 6 events) | Task 8 |
| SubscribeButton component | Task 9 |
| Tree count gate (API) | Task 10 |
| Person count gate (API) | Task 11 |
| AI chat gate (API) | Task 12 |
| ChatWidget UI gate | Task 13 |
| Dashboard tree limit banner | Task 14 |
| Public pricing page | Task 15 |
| Billing settings page | Task 16 |
| PLAN_PRODUCT_MAP with TODO for premium | Task 2 |

**Premium product ID:** When available, add to `lib/plans.ts` `PLAN_PRODUCT_MAP` and update the Premium pricing card in `app/(marketing)/pricing/page.tsx` to use a `SubscribeButton` instead of "Coming soon".
