# Cloudinary File Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cloudinary-backed file upload for person photos and life-event documents, replacing the existing "Photo URL" text input and wiring up the unused `documentUrls` field on events.

**Architecture:** A single reusable `<CloudinaryUpload>` component handles both single (photo) and multi (documents) modes. A new `POST /api/upload/sign` route generates short-lived Cloudinary signatures server-side (keeping the API secret out of the browser); the component then POSTs directly to Cloudinary from the client. Eager upload — file goes to Cloudinary on selection, URL stored in form state.

**Tech Stack:** Next.js 16 App Router, NextAuth v5, Node `crypto` (built-in, no extra package), Cloudinary REST API, React 19, TypeScript, Tailwind CSS v4, shadcn/ui Button.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `.env.local` | Modify | Add 3 Cloudinary env vars |
| `app/api/upload/sign/route.ts` | Create | Auth-gated signature endpoint |
| `components/ui/cloudinary-upload.tsx` | Create | Reusable upload component (single + multi) |
| `components/person/PersonForm.tsx` | Modify | Replace URL input with `<CloudinaryUpload>` |
| `components/person/EventForm.tsx` | Create | Extracted event form with document upload |
| `app/(dashboard)/person/[personId]/page.tsx` | Modify | Use `<EventForm>`, render document links |

---

## Task 1: Add Cloudinary environment variables

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add vars to `.env.local`**

Open `.env.local` and append (use your regenerated secret — NOT the one from the chat):

```
CLOUDINARY_CLOUD_NAME=ddo0vmjcp
CLOUDINARY_API_KEY=847426561346496
CLOUDINARY_API_SECRET=<your-regenerated-secret>
```

- [ ] **Step 2: Verify dev server picks them up**

```bash
npm run dev
```

No errors on startup. Leave server running for manual tests later.

- [ ] **Step 3: Commit**

```bash
git add .env.local
git commit -m "chore: add Cloudinary env vars"
```

---

## Task 2: Create the upload signature API route

**Files:**
- Create: `app/api/upload/sign/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { folder } = await req.json()
  if (!folder || typeof folder !== "string")
    return NextResponse.json({ error: "folder required" }, { status: 400 })

  const apiSecret = process.env.CLOUDINARY_API_SECRET
  const apiKey = process.env.CLOUDINARY_API_KEY
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME

  if (!apiSecret || !apiKey || !cloudName)
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 })

  const timestamp = Math.round(Date.now() / 1000)
  // Params must be sorted alphabetically before signing
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`
  const signature = crypto.createHash("sha1").update(toSign).digest("hex")

  return NextResponse.json({ signature, timestamp, apiKey, cloudName, folder })
}
```

- [ ] **Step 2: Verify route exists and rejects unauthenticated requests**

With dev server running, open a new terminal:

```bash
curl -s -X POST http://localhost:3000/api/upload/sign \
  -H "Content-Type: application/json" \
  -d '{"folder":"genealogy/photos"}' | cat
```

Expected output: `{"error":"Unauthorized"}`

- [ ] **Step 3: Commit**

```bash
git add app/api/upload/sign/route.ts
git commit -m "feat: add Cloudinary upload signature endpoint"
```

---

## Task 3: Create the `<CloudinaryUpload>` component

**Files:**
- Create: `components/ui/cloudinary-upload.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"
import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

type SingleProps = {
  mode: "single"
  folder: "genealogy/photos" | "genealogy/documents"
  value: string
  onChange: (url: string) => void
  accept?: string
}

type MultiProps = {
  mode: "multi"
  folder: "genealogy/photos" | "genealogy/documents"
  value: string[]
  onChange: (urls: string[]) => void
  accept?: string
  maxFiles?: number
}

type Props = SingleProps | MultiProps

async function uploadFile(file: File, folder: string): Promise<string> {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder }),
  })
  if (!signRes.ok) throw new Error("Failed to get upload signature")
  const { signature, timestamp, apiKey, cloudName } = await signRes.json()

  const form = new FormData()
  form.append("file", file)
  form.append("api_key", apiKey)
  form.append("timestamp", String(timestamp))
  form.append("signature", signature)
  form.append("folder", folder)

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: "POST", body: form }
  )
  if (!uploadRes.ok) throw new Error("Upload to Cloudinary failed")
  const data = await uploadRes.json()
  return data.secure_url as string
}

export function CloudinaryUpload(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const maxFiles = props.mode === "multi" ? (props.maxFiles ?? 10) : 1

  async function handleFiles(files: FileList) {
    setError(null)
    const arr = Array.from(files)

    for (const f of arr) {
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" exceeds the 2 MB limit`)
        return
      }
    }

    setUploading(true)
    try {
      if (props.mode === "single") {
        const url = await uploadFile(arr[0], props.folder)
        props.onChange(url)
      } else {
        const remaining = maxFiles - props.value.length
        const toUpload = arr.slice(0, remaining)
        const urls = await Promise.all(toUpload.map((f) => uploadFile(f, props.folder)))
        props.onChange([...props.value, ...urls])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  if (props.mode === "single") {
    return (
      <div className="space-y-2">
        {props.value && (
          <img
            src={props.value}
            alt="Preview"
            className="h-24 w-24 rounded-md object-cover border cursor-pointer"
            onClick={() => inputRef.current?.click()}
          />
        )}
        <input
          ref={inputRef}
          type="file"
          accept={props.accept}
          className="hidden"
          onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : props.value ? "Replace photo" : "Upload photo"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  // multi mode
  return (
    <div className="space-y-2">
      {props.value.length > 0 && (
        <ul className="space-y-1">
          {props.value.map((url, i) => (
            <li key={url} className="flex items-center gap-2 text-sm">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="truncate max-w-xs text-amber-600 hover:underline"
              >
                Document {i + 1}
              </a>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive text-xs"
                onClick={() =>
                  props.onChange(props.value.filter((_, j) => j !== i))
                }
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={props.accept}
        multiple
        className="hidden"
        onChange={(e) => e.target.files?.length && handleFiles(e.target.files)}
      />
      {props.value.length < maxFiles && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Add document"}
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/cloudinary-upload.tsx
git commit -m "feat: add CloudinaryUpload component"
```

---

## Task 4: Update `PersonForm` — replace URL input with upload

**Files:**
- Modify: `components/person/PersonForm.tsx`

- [ ] **Step 1: Add import at top of file**

Add after the existing imports (around line 16):

```typescript
import { CloudinaryUpload } from "@/components/ui/cloudinary-upload"
```

- [ ] **Step 2: Replace the Photo URL field**

Find and replace this block (around line 125–128):

```typescript
      <div className="space-y-2">
        <Label>Photo URL</Label>
        <Input type="url" placeholder="https://…" value={form.photoUrl ?? ""} onChange={(e) => set("photoUrl", e.target.value)} />
      </div>
```

Replace with:

```typescript
      <div className="space-y-2">
        <Label>Photo</Label>
        <CloudinaryUpload
          mode="single"
          folder="genealogy/photos"
          value={form.photoUrl ?? ""}
          onChange={(url) => set("photoUrl", url)}
          accept="image/*"
        />
      </div>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

1. Open `http://localhost:3000` and log in
2. Navigate to any tree → click a person → "Edit" (or add a new person)
3. Verify the "Photo URL" text field is replaced by an "Upload photo" button
4. Select an image under 2 MB — button shows "Uploading…" then disappears, thumbnail appears
5. Select an image over 2 MB — inline error `"filename" exceeds the 2 MB limit`

- [ ] **Step 5: Commit**

```bash
git add components/person/PersonForm.tsx
git commit -m "feat: replace photo URL input with Cloudinary upload in PersonForm"
```

---

## Task 5: Create `EventForm` component

**Files:**
- Create: `components/person/EventForm.tsx`

- [ ] **Step 1: Create the component**

```typescript
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CloudinaryUpload } from "@/components/ui/cloudinary-upload"
import type { IEvent } from "@/types"

const EVENT_TYPES = [
  "birth",
  "death",
  "marriage",
  "divorce",
  "immigration",
  "other",
] as const

const EVENT_ICONS: Record<string, string> = {
  birth: "👶",
  death: "✝️",
  marriage: "💍",
  divorce: "📄",
  immigration: "🚢",
  other: "📌",
}

interface Props {
  personId: string
  onSuccess: () => void
}

export function EventForm({ personId, onSuccess }: Props) {
  const [form, setForm] = useState<Partial<IEvent>>({
    type: "birth",
    documentUrls: [],
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/persons/${personId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    onSuccess()
    setForm({ type: "birth", documentUrls: [] })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label>Type</Label>
        <Select
          value={form.type}
          onValueChange={(v) =>
            setForm((f) => ({ ...f, type: v as IEvent["type"] }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {EVENT_ICONS[t]} {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Date</Label>
          <Input
            type="date"
            value={form.date ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label>Place</Label>
          <Input
            value={form.place ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, place: e.target.value }))}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Description</Label>
        <Textarea
          rows={2}
          value={form.description ?? ""}
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
        />
      </div>

      <div className="space-y-1">
        <Label>Documents</Label>
        <CloudinaryUpload
          mode="multi"
          folder="genealogy/documents"
          value={form.documentUrls ?? []}
          onChange={(urls) => setForm((f) => ({ ...f, documentUrls: urls }))}
        />
      </div>

      <Button type="submit" className="w-full" disabled={saving}>
        {saving ? "Saving…" : "Add event"}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/person/EventForm.tsx
git commit -m "feat: add EventForm component with document upload"
```

---

## Task 6: Update person page — use `EventForm`, show document links

**Files:**
- Modify: `app/(dashboard)/person/[personId]/page.tsx`

- [ ] **Step 1: Update imports**

At the top of the file, add the `EventForm` import and remove the now-unused `Select*`, `Textarea`, `Input` imports **only if** they are not used elsewhere on the page. (Check: `Input` and `Textarea` are not used outside the event dialog; `Select*` components are also only used in the event dialog.)

Replace the current import block:

```typescript
"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { IPerson, IEvent, IRelationship } from "@/types";
```

With:

```typescript
"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventForm } from "@/components/person/EventForm";
import type { IPerson, IEvent } from "@/types";
```

- [ ] **Step 2: Remove inline event state and `submitEvent` handler**

Find and delete these lines (around lines 53–81):

```typescript
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [eventForm, setEventForm] = useState<Partial<IEvent>>({ type: "birth" });
  const [savingEvent, setSavingEvent] = useState(false);
```

and:

```typescript
  async function submitEvent(e: React.FormEvent) {
    e.preventDefault();
    setSavingEvent(true);
    await fetch(`/api/persons/${personId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventForm),
    });
    await mutateEvents();
    setAddEventOpen(false);
    setEventForm({ type: "birth" });
    setSavingEvent(false);
  }
```

Add in their place (keep `mutatePerson` and `mutateEvents` SWR calls, just remove the above state):

```typescript
  const [addEventOpen, setAddEventOpen] = useState(false);
```

- [ ] **Step 3: Add document links to the event timeline**

Find the event list item block (around line 151–167):

```typescript
                <li key={ev._id} className="ml-4">
                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-white border border-gray-200 text-xs">
                    {EVENT_ICONS[ev.type] ?? "📌"}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="capitalize font-medium text-sm">{ev.type}</span>
                    {ev.date && <span className="text-xs text-muted-foreground">{ev.date}</span>}
                    {ev.place && <span className="text-xs text-muted-foreground">· {ev.place}</span>}
                  </div>
                  {ev.description && (
                    <p className="text-sm text-gray-600 mt-0.5">{ev.description}</p>
                  )}
                </li>
```

Replace with:

```typescript
                <li key={ev._id} className="ml-4">
                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-white border border-gray-200 text-xs">
                    {EVENT_ICONS[ev.type] ?? "📌"}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="capitalize font-medium text-sm">{ev.type}</span>
                    {ev.date && <span className="text-xs text-muted-foreground">{ev.date}</span>}
                    {ev.place && <span className="text-xs text-muted-foreground">· {ev.place}</span>}
                  </div>
                  {ev.description && (
                    <p className="text-sm text-gray-600 mt-0.5">{ev.description}</p>
                  )}
                  {ev.documentUrls?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {ev.documentUrls.map((url, i) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-amber-600 hover:underline"
                        >
                          📎 Document {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
```

- [ ] **Step 4: Replace the Dialog content with `<EventForm>`**

Find the Add Event Dialog (around line 171–208):

```typescript
      {/* Add Event Dialog */}
      <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add life event</DialogTitle></DialogHeader>
          <form onSubmit={submitEvent} className="space-y-3">
            <div className="space-y-1">
              <Label>Type</Label>
              <Select
                value={eventForm.type}
                onValueChange={(v) => setEventForm((f) => ({ ...f, type: v as IEvent["type"] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{EVENT_ICONS[t]} {t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={eventForm.date ?? ""} onChange={(e) => setEventForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Place</Label>
                <Input value={eventForm.place ?? ""} onChange={(e) => setEventForm((f) => ({ ...f, place: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea rows={2} value={eventForm.description ?? ""} onChange={(e) => setEventForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <Button type="submit" className="w-full" disabled={savingEvent}>
              {savingEvent ? "Saving…" : "Add event"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
```

Replace with:

```typescript
      {/* Add Event Dialog */}
      <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add life event</DialogTitle></DialogHeader>
          <EventForm
            personId={personId}
            onSuccess={async () => {
              await mutateEvents();
              setAddEventOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
```

- [ ] **Step 5: Remove now-unused `EVENT_TYPES` constant from page.tsx**

Delete only `EVENT_TYPES` — it was only used by the inline Select. Keep `EVENT_ICONS` because the event timeline still uses it to render the icon bullet.

```typescript
// DELETE this line:
const EVENT_TYPES = ["birth","death","marriage","divorce","immigration","other"] as const;

// KEEP this — still used in the timeline rendering:
// const EVENT_ICONS: Record<string, string> = { ... }
```

- [ ] **Step 6: Verify TypeScript compiles with no errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Manual smoke test**

1. Open `http://localhost:3000` and log in
2. Navigate to a person detail page
3. Click **+ Add event**
4. Verify the dialog shows the new form with a "Documents" section and "Add document" button
5. Fill in type/date/place, click "Add document", select any file ≤ 2 MB
6. Verify "Uploading…" appears, then "Document 1" link appears
7. Submit the form — event appears in timeline with "📎 Document 1" link
8. Click the link — file opens in new tab from Cloudinary URL
9. Try uploading a file > 2 MB — verify inline error message appears

- [ ] **Step 8: Commit**

```bash
git add app/"(dashboard)"/person/"[personId]"/page.tsx
git commit -m "feat: use EventForm component, display document links in event timeline"
```

---

## Task 7: Lint check and final cleanup

**Files:** none created, just verification

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: no errors. If ESLint flags unused imports (e.g. `IRelationship` removed from page.tsx), fix them.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: build completes with no type errors or missing module errors.

- [ ] **Step 3: Final commit if lint/build required fixes**

```bash
git add -A
git commit -m "chore: lint and build fixes for Cloudinary upload feature"
```
