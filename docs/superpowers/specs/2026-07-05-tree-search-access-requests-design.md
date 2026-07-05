# Tree Search + Access Requests — Design

Date: 2026-07-05
Status: Approved (design phase)

## Goal

Let logged-in users discover other users' family trees via search, contact tree
owners by email, and request permission to view private trees. Owners keep full
control: approve, deny, and revoke access at any time. Private-tree contents stay
inaccessible until the owner explicitly grants access.

## Decisions (locked)

- **Search target:** person names + free-text place. Match `firstName`/`lastName`
  and `birthPlace`/`deathPlace` via case-insensitive substring. No schema change;
  Country/City are matched as substrings of the existing place strings.
- **Result exposure:** all trees discoverable (public + private). Result cards show
  minimal data only. No living-person filter.
- **Who can use it:** logged-in users only (search, message, request).
- **Messaging:** email owner's registered address via existing `lib/mail.ts`.
  `Reply-To` = requester. Nothing stored in DB.
- **Notifications:** email owner on new access request only. No requester-facing
  emails (decision or revoke shown in-app).
- **UI placement:** two new dashboard pages — `/search` and `/requests`.

### Accepted exposure trade-off

Private trees' person names and places become searchable to every logged-in user,
living persons included. Search reveals only the minimal card; tree contents remain
gated. Owner explicitly accepted this in brainstorming.

## Existing machinery reused

- `Tree.sharedEmails: string[]` — email-based viewer grant.
- `resolveTreeAccess(treeId, session)` in `lib/treeAccess.ts` — already returns
  `viewer` role when the caller's email is in `sharedEmails`. **No change needed.**
- `lib/mail.ts` — nodemailer/Gmail SMTP transporter. Add new send helpers.
- API auth pattern: every handler calls `await auth()`, returns 401 if no session.

## Data model

New model `lib/models/AccessRequest.ts`:

```
treeId         ObjectId ref Tree      (indexed)
requesterId    ObjectId ref User      (indexed)
requesterEmail String                 (snapshot of requester email at request time)
status         "pending" | "approved" | "denied" | "revoked"
message        String  (optional note included with the request)
decidedAt      Date    (optional; set when owner acts)
createdAt / updatedAt  (timestamps)
```

- Compound **unique** index `{ treeId, requesterId }`: one request doc per user per
  tree. Re-requesting updates the same doc (e.g. `denied` → `pending`).
- Follows the hot-reload guard pattern: `models.AccessRequest ?? model(...)`.

### Status transitions

| From | Action (owner) | To | Side effect |
|------|----------------|----|-------------|
| — | requester creates | `pending` | email owner |
| `pending` | approve | `approved` | `$addToSet Tree.sharedEmails = requesterEmail` |
| `pending` | deny | `denied` | none |
| `approved` | revoke | `revoked` | `$pull Tree.sharedEmails = requesterEmail` |
| `denied`/`revoked` | requester re-requests | `pending` | email owner |

Approve is a no-op grant if requester is already owner or already in `sharedEmails`.

## API routes

All handlers auth-gated (401 if no session).

### `GET /api/search?q=<term>&field=name|place`
- `q` required, trimmed, min length 2. `field` defaults to `name`.
- `name` → regex on `firstName` + `lastName`. `place` → regex on `birthPlace` +
  `deathPlace`. Case-insensitive, escaped for regex-special chars.
- Joins each matched `Person` to its `Tree` and the tree's owner (`User`).
- Returns array of cards:
  ```
  { personId, personName, place, treeId, treeName, ownerName,
    access: "owner" | "viewer" | "pending" | "none" }
  ```
  `access` computed from ownerId, sharedEmails membership, and the caller's
  existing AccessRequest status.
- Result cap (e.g. 50) with a flag when truncated; log the cap (no silent
  truncation).

### `POST /api/trees/[treeId]/contact-owner`
- Body `{ subject, message }`. Loads tree + owner email.
- Sends email via new `sendOwnerMessageEmail(ownerEmail, requester, subject, message)`
  — `From` FamilyRoots, `Reply-To` requester email.
- Nothing persisted. Returns `{ ok: true }`.

### `POST /api/trees/[treeId]/access-requests`
- Body `{ message? }`. No-op (200, no new doc) if caller is owner or already viewer.
- Upserts AccessRequest `{treeId, requesterId}` → `status: pending`,
  snapshot `requesterEmail`, `message`.
- Emails owner ("new access request") via new `sendAccessRequestEmail`.

### `GET /api/access-requests?role=incoming|outgoing`
- `incoming` — requests targeting trees I own (join tree, filter `ownerId == me`).
  Grouped/annotated by tree; includes requester name + email + status.
- `outgoing` — requests I created, with tree name + owner name + status.

### `PATCH /api/access-requests/[id]`
- Body `{ action: "approve" | "deny" | "revoke" }`.
- Owner-only guard: load request → load tree → require `tree.ownerId == me`
  (reuse `resolveTreeAccess` role check). 403 otherwise.
- Applies the transition + side effect from the table above. Sets `decidedAt`.
- Returns updated request.

## Enforcement (unchanged)

Private-tree viewing stays gated by `resolveTreeAccess` returning `viewer`/`owner`.
Search returns only cards; opening a tree/person still requires a real role. No new
bypass path is introduced.

## UI

Two new pages under `app/(dashboard)/`, both client components using SWR hooks
(match existing `hooks/` pattern). New sidebar entries in
`components/layout/Sidebar.tsx` with i18n `t()` label keys.

### `/search`
- Search input + field toggle (Name / Place).
- Result cards. Per card, action depends on `access`:
  - `owner`/`viewer` → "Open tree" link, no request/message.
  - `none` → **Request access** button + **Message owner** button (dialog with
    subject + message).
  - `pending` → disabled "Requested" state.

### `/requests`
- **Incoming** — per owned tree: pending requests (requester name/email + note,
  Approve / Deny buttons); granted list (Revoke button).
- **My requests** — outgoing requests: tree name, owner, status badge.

## Out of scope (YAGNI)

- Structured country/city fields on Person.
- In-app message inbox / stored owner messages.
- Requester-facing decision/revoke emails.
- Living-person search filtering.
- Public (logged-out) search.

## Testing

- Unit (vitest, existing runner): AccessRequest status transitions + side effects
  on `sharedEmails`; search regex escaping; `access` computation.
- API guard tests: owner-only PATCH, 401 unauth, no-op grant when already viewer.
