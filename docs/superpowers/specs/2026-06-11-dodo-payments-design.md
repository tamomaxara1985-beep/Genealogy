# Dodo Payments Subscription Integration — Design Spec

**Date:** 2026-06-11  
**Status:** Approved

---

## Overview

Integrate Dodo Payments subscription billing into the genealogy app using the `@dodopayments/nextjs` adapter. Two paid plans (Standard, Premium) on top of a free tier, gated by tree count and person count limits.

---

## Tier Structure

| Tier | Trees | Persons/tree | AI chat | Price |
|------|-------|--------------|---------|-------|
| **Free** | 1 | 30 max | No | $0 |
| **Standard** | 1 | Unlimited | Yes | TBD |
| **Premium** | Unlimited | Unlimited | Yes | TBD |

**Product IDs (Dodo Payments):**
- Standard: `pdt_0Ngp959eAaBGtnmvgciKO`
- Premium: TBD (to be added before implementation)

---

## Approach

Adapter-based (`@dodopayments/nextjs`). Subscription state stored as fields on the existing `User` Mongoose document. No separate Subscription model needed.

---

## Data Model

### User schema additions (`lib/models/User.ts`)

```ts
plan: {
  type: String,
  enum: ['free', 'standard', 'premium'],
  default: 'free'
}
planStatus: {
  type: String,
  enum: ['active', 'cancelled', 'on_hold', 'expired'],
  default: 'active'
}
dodoCustomerId: { type: String, default: null }
dodoSubscriptionId: { type: String, default: null }
planExpiresAt: { type: Date, default: null }
```

### IUserDoc interface additions (`lib/models/User.ts`)

```ts
plan: 'free' | 'standard' | 'premium'
planStatus: 'active' | 'cancelled' | 'on_hold' | 'expired'
dodoCustomerId?: string | null
dodoSubscriptionId?: string | null
planExpiresAt?: Date | null
```

### IUser DTO additions (`types/index.ts`)

```ts
plan: 'free' | 'standard' | 'premium'
planStatus: 'active' | 'cancelled' | 'on_hold' | 'expired'
```

### NextAuth session (`lib/auth.ts`)

JWT callback: forward `plan` and `planStatus` from DB user into token.  
Session callback: expose `session.user.plan` and `session.user.planStatus`.

---

## Environment Variables

Add to `.env.local`:

```
DODO_PAYMENTS_API_KEY=<your key>
DODO_PAYMENTS_WEBHOOK_KEY=<from dodo dashboard>
DODO_PAYMENTS_RETURN_URL=http://localhost:3000/settings/billing
DODO_PAYMENTS_ENVIRONMENT=test_mode
```

Production values use `live_mode` and the deployed URL.

---

## New Files

### `app/api/checkout/route.ts`

Static GET checkout handler. Accepts `?productId=` query param. Dodo adapter redirects user to hosted checkout page.

```ts
import { Checkout } from "@dodopayments/nextjs"
export const GET = Checkout({ ... type: "static" })
```

### `app/api/customer-portal/route.ts`

GET handler. Accepts `?customer_id=`. Redirects user to Dodo customer portal (manage/cancel subscription).

### `app/api/webhooks/dodo/route.ts`

POST handler. Adapter verifies signature with `DODO_PAYMENTS_WEBHOOK_KEY`. Handles:

| Event | DB write |
|-------|---------|
| `subscription.active` | `plan` (derived from productId), `planStatus='active'`, `dodoCustomerId`, `dodoSubscriptionId` |
| `subscription.renewed` | `planExpiresAt` |
| `subscription.cancelled` | `planStatus='cancelled'` |
| `subscription.on_hold` | `planStatus='on_hold'` |
| `subscription.expired` | `plan='free'`, `planStatus='active'`, clear subscription fields |
| `subscription.plan_changed` | update `plan` |

Lookup user by `dodoSubscriptionId` (or `dodoCustomerId` on first activation). All writes are idempotent.

### `app/(marketing)/pricing/page.tsx`

Public page (no auth required). 3-column card layout:
- Free / Standard / Premium
- Feature list per tier
- CTA buttons: Free = "Get Started" (→ `/register`), paid = "Subscribe" (→ `/api/checkout?productId=...&email=...`)

### `app/(dashboard)/settings/billing/page.tsx`

Authenticated page showing:
- Current plan badge + status
- Next billing date (if subscribed)
- "Manage subscription" button → `GET /api/customer-portal?customer_id=...`
- Upgrade/downgrade links for other plans
- Inline upgrade prompts if on free tier

---

## Feature Gating

### API enforcement (hard block)

| Route | Check |
|-------|-------|
| `POST /api/trees` | Count user trees. Free/Standard: reject 403 if count ≥ 1. |
| `POST /api/trees/[treeId]/persons` | Count persons in tree. Free: reject 403 if count ≥ 30. |
| `POST /api/ai/chat` | Reject 403 if `plan === 'free'`. |

Plan read from `auth()` session → `session.user.plan`.

### UI enforcement (soft block — inline banners)

- **Dashboard** "New Tree" button: if tree limit hit, show amber inline banner "Upgrade to Premium to create more trees" instead of create form.
- **Person form**: if free + persons ≥ 30, show inline banner "Upgrade to Standard to add unlimited people".
- **AI chat widget**: if `plan === 'free'`, replace input with inline banner "Upgrade to Standard to use AI features".

Banners link to `/pricing` or trigger the relevant `/api/checkout` redirect.

---

## Checkout Flow

1. User clicks "Subscribe" on `/pricing` or `/settings/billing`
2. Client calls `GET /api/checkout?productId=pdt_xxx&email=user@email.com`
3. Adapter returns `{ checkout_url }` → client redirects to Dodo hosted checkout
4. Dodo processes payment, fires `subscription.active` webhook
5. Webhook handler sets plan fields on User document
6. Dodo redirects browser to `DODO_PAYMENTS_RETURN_URL` (`/settings/billing`)
7. `/settings/billing` shows updated plan (NextAuth session may need refresh — force re-fetch on page load)

---

## Security

- Webhook signature verified by adapter using `DODO_PAYMENTS_WEBHOOK_KEY` — returns 401 on invalid
- API key never exposed to client — all Dodo calls server-side only
- Feature-gate checks on API routes cannot be bypassed by client
- No secrets committed to version control

---

## Out of Scope

- GEDCOM import limits per plan (Phase 5)
- Storage/upload limits per plan
- Proration UI (Dodo handles this server-side)
- Email notifications on plan change (can be added via webhook handler later)
