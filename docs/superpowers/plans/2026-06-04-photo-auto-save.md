# Person Photo Auto-Save Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When editing an existing person in the tree canvas sheet panel, uploading a photo immediately saves to the database and updates the UI — no "Save person" click required.

**Architecture:** Export `uploadFile` from `cloudinary-upload.tsx`, then add a photo avatar + hidden file input + "Change photo" button to the sheet view-mode in the tree page. On file pick: upload to Cloudinary → PATCH person via PUT endpoint → update local state + SWR.

**Tech Stack:** Next.js App Router, React 19, SWR, Cloudinary (existing), Mongoose PUT endpoint (existing), shadcn Avatar component (existing).

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `components/ui/cloudinary-upload.tsx` | Modify | Export `uploadFile` (add `export` keyword) |
| `app/(dashboard)/trees/[treeId]/page.tsx` | Modify | Add `useRef`, Avatar imports, `uploadFile` import; add `photoUploading`/`photoError`/`photoInputRef` state; add `handlePhotoChange` fn; add avatar + button in sheet view-mode |

---

## Task 1: Export `uploadFile` from cloudinary-upload.tsx

**Files:**
- Modify: `components/ui/cloudinary-upload.tsx:26`

- [ ] **Step 1: Add `export` to `uploadFile`**

Open `components/ui/cloudinary-upload.tsx`. On line 26, change:

```ts
async function uploadFile(file: File, folder: string): Promise<string> {
```

to:

```ts
export async function uploadFile(file: File, folder: string): Promise<string> {
```

- [ ] **Step 2: Verify build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors. (Build may fail on other unrelated issues — only care that the export change itself is clean.)

- [ ] **Step 3: Commit**

```bash
git add components/ui/cloudinary-upload.tsx
git commit -m "feat: export uploadFile from CloudinaryUpload"
```

---

## Task 2: Add photo avatar + auto-save to tree page sheet view

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

### Step 1: Update imports

- [ ] **Add `useRef` to React import (line 3)**

Change:
```ts
import { use, useState, useCallback } from "react";
```
to:
```ts
import { use, useState, useCallback, useRef } from "react";
```

- [ ] **Add Avatar imports after the existing `Label` import**

```ts
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadFile } from "@/components/ui/cloudinary-upload";
```

### Step 2: Add state variables

- [ ] **Add three new state vars after the existing `deleting` state (around line 111)**

Find:
```ts
const [deleting, setDeleting] = useState(false);
```

Add after it:
```ts
const [photoUploading, setPhotoUploading] = useState(false);
const [photoError, setPhotoError] = useState<string | null>(null);
const photoInputRef = useRef<HTMLInputElement>(null);
```

### Step 3: Add `handlePhotoChange` function

- [ ] **Add after `handleDeletePerson` function (after line ~187)**

Find the closing `}` of `handleDeletePerson`, then add:

```ts
async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file || !selectedPerson) return;
  setPhotoError(null);
  setPhotoUploading(true);
  try {
    const url = await uploadFile(file, "genealogy/photos");
    const res = await fetch(`/api/persons/${selectedPerson._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoUrl: url }),
    });
    if (!res.ok) throw new Error("Failed to save photo");
    const updated: IPerson = await res.json();
    setSelectedPerson(updated);
    await mutatePersons();
  } catch (err) {
    setPhotoError(err instanceof Error ? err.message : "Upload failed");
  } finally {
    setPhotoUploading(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }
}
```

### Step 4: Add avatar + button to sheet view-mode

- [ ] **Add photo section at the top of the view-mode `<div>` (before the `<dl>`)**

Find the view-mode block that starts with:
```tsx
<div className="mt-4 space-y-3">
  <dl className="space-y-1 text-sm">
```

Insert before `<dl className="space-y-1 text-sm">`:

```tsx
<div className="flex flex-col items-center gap-2 pb-3">
  <Avatar className="h-20 w-20 border-2 border-white shadow">
    <AvatarImage src={selectedPerson.photoUrl} />
    <AvatarFallback className="text-xl font-bold">
      {selectedPerson.firstName[0] ?? "?"}{selectedPerson.lastName[0] ?? ""}
    </AvatarFallback>
  </Avatar>
  <input
    ref={photoInputRef}
    type="file"
    accept="image/*"
    className="hidden"
    onChange={handlePhotoChange}
  />
  <Button
    variant="outline"
    size="sm"
    disabled={photoUploading}
    onClick={() => photoInputRef.current?.click()}
  >
    {photoUploading ? "Uploading…" : "Change photo"}
  </Button>
  {photoError && <p className="text-xs text-destructive">{photoError}</p>}
</div>
```

### Step 5: Verify

- [ ] **Run lint**

```bash
npm run lint 2>&1 | tail -30
```

Expected: no new errors.

- [ ] **Start dev server and manually test**

```bash
npm run dev
```

1. Open `http://localhost:3000/trees/<any-treeId>`
2. Click a person node → sheet opens
3. Confirm avatar shows (initials fallback if no photo)
4. Click "Change photo" → pick an image file ≤ 2 MB
5. Button shows "Uploading…" while in flight
6. Avatar updates to new photo without page reload
7. Close sheet, reopen same person → photo still there (persisted to DB)
8. Click "Edit" on same person → PersonForm shows new photo in its preview
9. Test error: pick a file > 2 MB → error text appears under avatar

- [ ] **Step 6: Commit**

```bash
git add app/(dashboard)/trees/[treeId]/page.tsx
git commit -m "feat: auto-save person photo from sheet view"
```
