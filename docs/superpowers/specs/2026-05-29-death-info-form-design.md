# Death Info in PersonForm — Design

**Date:** 2026-05-29

## Goal

Allow users to mark a person as deceased in `PersonForm`, with or without a known death date.

## Data Model

No changes needed. `IPerson` already has:
- `isLiving: boolean`
- `deathDate?: string`
- `deathPlace?: string`

## Form Changes (`components/person/PersonForm.tsx`)

Replace the always-visible death date/place fields with a "Deceased" checkbox that conditionally reveals them.

### Layout

```
[ ] Deceased
    (when checked)
    Death date — optional, year only is fine
    [DateInput]
    Death place
    [Input]
```

### Behavior

| Action | Effect |
|--------|--------|
| Check "Deceased" | `isLiving = false`, reveal date + place fields |
| Uncheck "Deceased" | `isLiving = true`, clear `deathDate` + `deathPlace`, hide fields |
| Enter a death date | Auto-check "Deceased" (`isLiving = false`) |

### Implementation Notes

- Derive `isDeceased` from `!form.isLiving` — no separate state variable
- Use shadcn `Checkbox` component (already available)
- Death fields render only when `!form.isLiving`
- On uncheck: call `set("isLiving", true)`, `set("deathDate", undefined)`, `set("deathPlace", undefined)`
- On date change: if value is non-empty, also call `set("isLiving", false)`

## Display (No Changes)

- `PersonCard`: already shows `d. date` only when `!isLiving && deathDate` ✓
- Person detail page: already shows "Living" / "Deceased" badge from `isLiving` ✓

## Scope

Single file edit: `components/person/PersonForm.tsx`.
