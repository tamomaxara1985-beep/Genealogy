# Rename Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tree owner rename a tree from the tree-page header via an edit button + dialog.

**Architecture:** A `RenameTreeDialog` (mirrors the existing `DeleteTreeDialog`) PUTs `{ name }` to the existing owner-scoped `PUT /api/trees/[treeId]`; an owner-only pencil button in the tree-page header opens it and `mutateTree()` refreshes on success.

**Tech Stack:** Next.js 16, React 19, TypeScript, shadcn/ui, next-intl, SWR.

## Global Constraints

- Path alias `@/*` = project root. Import as `@/components/...`.
- i18n keys go in the `tree` namespace of ALL three locales (en/ka/he), parallel. Reuse existing `tree.treeName`, `common.save`, `common.saving`, `common.cancel`.
- Owner-only: button + dialog render only inside the existing `isOwner` block / `isOwner && treeMeta` guard.
- No component tests in repo (convention) — validate with the JSON check + `npm run lint` + `npm test` (existing must stay green) + `npm run build`.
- Reuse the `DeleteTreeDialog` structure/pattern (reset-on-close, inline error).

---

### Task 1: i18n keys + RenameTreeDialog component

**Files:**
- Modify: `messages/en.json`, `messages/ka.json`, `messages/he.json`
- Create: `components/tree/RenameTreeDialog.tsx`

**Interfaces:**
- Produces: `RenameTreeDialog` (named export), props `{ treeId: string; currentName: string; open: boolean; onOpenChange: (open: boolean) => void; onRenamed: () => void }`.

- [ ] **Step 1: Add i18n keys to `messages/en.json`** (inside the `"tree"` object, e.g. after `"deleteError"`):

```json
    "renameTree": "Rename tree",
    "renameError": "Could not rename the tree. Please try again.",
```

- [ ] **Step 2: Add to `messages/ka.json`** (inside its `"tree"` object):

```json
    "renameTree": "ხის სახელის შეცვლა",
    "renameError": "სახელის შეცვლა ვერ მოხერხდა. სცადეთ თავიდან.",
```

- [ ] **Step 3: Add to `messages/he.json`** (inside its `"tree"` object):

```json
    "renameTree": "שינוי שם העץ",
    "renameError": "לא ניתן לשנות את שם העץ. נסו שוב.",
```

- [ ] **Step 4: Validate JSON**

Run: `node -e "['en','ka','he'].forEach(l=>{const o=require('./messages/'+l+'.json');['renameTree','renameError'].forEach(k=>{if(!o.tree[k])throw new Error(l+' missing '+k)})});console.log('i18n ok')"`
Expected: prints `i18n ok`.

- [ ] **Step 5: Create `components/tree/RenameTreeDialog.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  treeId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: () => void;
}

export function RenameTreeDialog({ treeId, currentName, open, onOpenChange, onRenamed }: Props) {
  const t = useTranslations("tree");
  const tc = useTranslations("common");
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const unchangedOrEmpty = trimmed === "" || trimmed === currentName;

  async function handleSave() {
    if (unchangedOrEmpty) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/trees/${treeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      onRenamed();
      onOpenChange(false);
    } else {
      setError(t("renameError"));
    }
    setSaving(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setName(currentName);
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("renameTree")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="renameTreeName">{t("treeName")}</Label>
            <Input
              id="renameTreeName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || unchangedOrEmpty}>
              {saving ? tc("saving") : tc("save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Lint + build**

Run: `npm run lint` → no new errors (pre-existing DashboardClient error may remain).
Run: `npm run build` → clean. (If NextAuth "Unexpected token '<'"/api 404, wipe `.next` and rebuild.)

- [ ] **Step 7: Commit**

```bash
git add messages/en.json messages/ka.json messages/he.json components/tree/RenameTreeDialog.tsx
git commit -m "feat: RenameTreeDialog + rename-tree i18n keys"
```

---

### Task 2: Wire the edit button into the tree page

**Files:**
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

**Interfaces:**
- Consumes: `RenameTreeDialog` (Task 1); existing `mutateTree`, `treeMeta`, `isOwner`.

- [ ] **Step 1: Imports + state**

Add imports (near the existing `DeleteTreeDialog` import and lucide imports — the file already imports icons/`DeleteTreeDialog`):

```ts
import { Pencil } from "lucide-react";
import { RenameTreeDialog } from "@/components/tree/RenameTreeDialog";
```

Add state near `const [deleteOpen, setDeleteOpen] = useState(false);`:

```ts
  const [renameOpen, setRenameOpen] = useState(false);
```

- [ ] **Step 2: Add the pencil button to the owner header block**

The current owner block is:

```tsx
          {isOwner && (
            <>
              <Button variant="outline" onClick={() => setShareOpen(true)}>{t("share")}</Button>
              <Button variant="outline" onClick={() => setLinkOpen(true)}>{t("linkPeople")}</Button>
              <Button onClick={() => setAddPersonOpen(true)}>{t("addPerson")}</Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:border-red-300"
                onClick={() => setDeleteOpen(true)}
              >
                {t("deleteTree")}
              </Button>
            </>
          )}
```

Insert a pencil (rename) button right after the Share button:

```tsx
          {isOwner && (
            <>
              <Button variant="outline" onClick={() => setShareOpen(true)}>{t("share")}</Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("renameTree")}
                title={t("renameTree")}
                onClick={() => setRenameOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => setLinkOpen(true)}>{t("linkPeople")}</Button>
              <Button onClick={() => setAddPersonOpen(true)}>{t("addPerson")}</Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:border-red-300"
                onClick={() => setDeleteOpen(true)}
              >
                {t("deleteTree")}
              </Button>
            </>
          )}
```

- [ ] **Step 3: Render the dialog**

Right after the existing `DeleteTreeDialog` render block (`{isOwner && treeMeta && ( <DeleteTreeDialog ... /> )}`), add:

```tsx
      {isOwner && treeMeta && (
        <RenameTreeDialog
          key={treeMeta.name}
          treeId={treeId}
          currentName={treeMeta.name}
          open={renameOpen}
          onOpenChange={setRenameOpen}
          onRenamed={() => mutateTree()}
        />
      )}
```

> `key={treeMeta.name}` remounts the dialog when the name changes, so the input's initial value stays in sync with the latest name after a rename.

- [ ] **Step 4: Gate**

Run: `npm run lint` → no new errors.
Run: `npm test` → existing suite still green (no new tests here).
Run: `npm run build` → clean.

- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/trees/[treeId]/page.tsx"
git commit -m "feat: rename-tree edit button in tree page header"
```

---

### Task 3: Verification

**Files:** none.

- [ ] **Step 1:** `npm run dev` (background), open a tree as owner. A pencil button shows in the header; a view-only (shared) tree does NOT show it.
- [ ] **Step 2:** Click it → dialog opens pre-filled with the current name. Save is disabled until the name changes to a non-empty value.
- [ ] **Step 3:** Rename → dialog closes, no manual refresh needed; open the Delete dialog or Print — the new name is used (confirms `treeMeta` refreshed). Reopen the rename dialog → it shows the new name.
- [ ] **Step 4:** Final gate `npm run lint && npm test && npm run build` all pass. Report results.
