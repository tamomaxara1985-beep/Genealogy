# Person Photo Auto-Save — Design

## Goal

When editing an existing person in the sheet panel (tree canvas), uploading a photo should immediately save to the database and update the UI — no separate "Save person" form submit required.

## Scope

- Edit flow only (existing person, opened via sheet on tree canvas)
- Photo field only — other fields still require "Save person"
- Add-person flow: unchanged (person doesn't exist in DB yet)

## Architecture

Two file changes. No new components, no new API routes, no new endpoints.

| File | Change |
|------|--------|
| `components/ui/cloudinary-upload.tsx` | Export `uploadFile` function (currently unexported) |
| `app/(dashboard)/trees/[treeId]/page.tsx` | Add photo avatar + upload button in sheet view mode; add `handlePhotoChange`; add `photoUploading` state |

## Upload Flow

```
User clicks "Change photo" in sheet view
  → hidden <input type="file"> triggers
  → uploadFile(file, "genealogy/photos")   ← reuses exported fn from cloudinary-upload.tsx
  → setPhotoUploading(true)
  → PUT /api/persons/:id  { photoUrl }     ← reuses existing endpoint
  → setSelectedPerson(res.json())          ← avatar in sheet updates immediately
  → mutatePersons()                        ← tree canvas node re-renders with new photo
  → setPhotoUploading(false)
```

## State

Add one state variable to tree page:

```ts
const [photoUploading, setPhotoUploading] = useState(false)
```

Reuse existing `selectedPerson` (set via `setSelectedPerson`) and `mutatePersons` — no new SWR keys.

## Sheet View UI Change

Currently sheet view shows no photo. New layout:

```
[Avatar — photoUrl if set, initials fallback]
[Change photo button | "Uploading…" when busy]
[photo error text, if any]
[existing dl: gender, dates, places, notes]
[Edit / Delete / View full profile buttons]
```

Photo error clears on next upload attempt.

## Error Handling

- Cloudinary upload failure: show inline error under avatar, do not PATCH
- PATCH failure: show inline error, revert nothing (photoUrl not changed in DB)
- File > 2 MB: rejected by existing `uploadFile` size check before upload

## Out of Scope

- PersonForm (add-person dialog): no changes
- Person profile page (`/person/[id]`): no changes — read-only, no edit UI
- Event document upload: no changes
- Multiple photos / photo gallery: future work
