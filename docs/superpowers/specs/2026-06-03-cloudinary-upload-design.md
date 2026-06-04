# Cloudinary File Upload — Design Spec

**Date:** 2026-06-03  
**Status:** Approved

## Overview

Add Cloudinary-backed file upload for person photos and life-event documents. Replaces the existing "Photo URL" text input in `PersonForm` with a real file picker. Adds multi-file document upload to the event form.

## Decisions

| Question | Decision |
|---|---|
| Scope | Person photos + event documents |
| Upload timing | Eager — upload fires on file select |
| Auth | Signed uploads — server generates signature, API secret never leaves server |
| File types | Any (`resource_type: auto`) |
| Component strategy | Single reusable `<CloudinaryUpload>` component |

## Environment Variables

Add to `.env.local`:

```
CLOUDINARY_CLOUD_NAME=ddo0vmjcp
CLOUDINARY_API_KEY=847426561346496
CLOUDINARY_API_SECRET=<regenerated — do NOT use the one from chat>
```

## API Route: `POST /api/upload/sign`

- Requires valid NextAuth session (returns 401 otherwise)
- Body: `{ folder: string }`
- Uses Node `crypto` (no `cloudinary` npm package) to compute SHA-1 signature over `folder=...&timestamp=...` + API secret
- Returns: `{ signature, timestamp, apiKey, cloudName, folder }`

Client POSTs a `FormData` directly to:
```
https://api.cloudinary.com/v1_1/{cloudName}/auto/upload
```
with `resource_type: auto` to support images, PDFs, and raw files.

Cloudinary folders:
- `genealogy/photos` — person portrait photos
- `genealogy/documents` — life-event documents

## Component: `components/ui/cloudinary-upload.tsx`

```ts
type Props =
  | {
      mode: "single"
      folder: "genealogy/photos" | "genealogy/documents"
      value: string
      onChange: (url: string) => void
      accept?: string
    }
  | {
      mode: "multi"
      folder: "genealogy/photos" | "genealogy/documents"
      value: string[]
      onChange: (urls: string[]) => void
      accept?: string
      maxFiles?: number  // default 10
    }
```

### Single mode
- File picker button + thumbnail preview when URL is set
- Clicking thumbnail re-opens picker (replaces current photo)
- No explicit clear/delete button

### Multi mode
- File picker button (can select multiple files)
- Renders list of uploaded files: filename + remove button per item
- Appends new URLs to array on each upload

### Upload flow (both modes)
1. User selects file(s)
2. Component checks each file is ≤ 2 MB — shows inline error and aborts if exceeded
3. Component calls `POST /api/upload/sign` with folder
4. Component POSTs `FormData` to Cloudinary directly from browser
5. On success: calls `onChange` with `secure_url` (single) or `[...prev, secure_url]` (multi)
6. Shows inline progress state: idle → uploading → done / error

Max file size: **2 MB** per file. Validated client-side before the sign request is made.

No external upload library. Plain `fetch` + `FormData`.

## Integration: `PersonForm.tsx`

Replace:
```tsx
<Label>Photo URL</Label>
<Input type="url" placeholder="https://…" value={form.photoUrl ?? ""} … />
```

With:
```tsx
<Label>Photo</Label>
<CloudinaryUpload
  mode="single"
  folder="genealogy/photos"
  value={form.photoUrl ?? ""}
  onChange={(url) => set("photoUrl", url as string)}
  accept="image/*"
/>
```

No model or API changes needed. `photoUrl` remains `string` on Person.

## New Component: `components/person/EventForm.tsx`

Extract the inline event form from `app/(dashboard)/person/[personId]/page.tsx` into a standalone component. Owns all event form state including upload state.

Props:
```ts
interface Props {
  personId: string
  onSuccess: () => void
}
```

Renders the existing fields (type, date, place, description) plus:
```tsx
<Label>Documents</Label>
<CloudinaryUpload
  mode="multi"
  folder="genealogy/documents"
  value={form.documentUrls ?? []}
  onChange={(urls) => setForm(f => ({ ...f, documentUrls: urls as string[] }))}
/>
```

`documentUrls` is passed in the POST body to `/api/persons/[personId]/events`. No API changes needed — `Event.create()` already accepts it.

## Integration: Person page (`page.tsx`)

- Remove inline event form state and JSX
- Render `<EventForm personId={personId} onSuccess={() => { mutateEvents(); setAddEventOpen(false); }} />` inside the existing Dialog
- Add document links to event timeline:

```tsx
{ev.documentUrls?.length > 0 && (
  <div className="flex gap-2 mt-1">
    {ev.documentUrls.map((url, i) => (
      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
         className="text-xs text-amber-600 hover:underline">
        📎 Document {i + 1}
      </a>
    ))}
  </div>
)}
```

## Files Changed / Created

| File | Change |
|---|---|
| `.env.local` | Add 3 Cloudinary vars |
| `app/api/upload/sign/route.ts` | New — signature endpoint |
| `components/ui/cloudinary-upload.tsx` | New — reusable upload component |
| `components/person/EventForm.tsx` | New — extracted + enhanced event form |
| `components/person/PersonForm.tsx` | Replace URL input with CloudinaryUpload |
| `app/(dashboard)/person/[personId]/page.tsx` | Use EventForm, show document links |
| `types/index.ts` | Add `documentUrls?: string[]` to `IEvent` if missing |

## Out of Scope

- Deleting uploaded assets from Cloudinary when a person/event is deleted
- Image transformations (resizing, cropping)
- Upload size limits (handled by Cloudinary plan limits)
- Orphan cleanup for abandoned uploads
