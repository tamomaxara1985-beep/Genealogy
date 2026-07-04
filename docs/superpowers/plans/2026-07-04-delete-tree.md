# Delete Tree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tree owner permanently delete a tree (with all its persons, relationships, events, and sibling-hides) from the trees list and from inside the open tree, behind a type-the-name confirmation.

**Architecture:** Extend the existing owner-scoped `DELETE /api/trees/[treeId]` handler to cascade-delete dependent documents. Add one shared `DeleteTreeDialog` React component (type-name-to-confirm) used by both the trees-list cards and the tree-page header.

**Tech Stack:** Next.js 16 App Router (route handlers), React 19, TypeScript, Mongoose 9, shadcn/ui Dialog/Input/Button, next-intl.

## Global Constraints

- Path alias `@/*` maps to project root. Import as `@/lib/...`, `@/components/...`, `@/types`.
- Every API handler calls `await auth()` and returns 401 if no session — there is no middleware guard. Owner scope enforced by querying with `ownerId: session.user.id`.
- Model default exports: `Tree`, `Person`, `Relationship`, `SiblingHide` (all carry `treeId`); `Event` (carries `personId`, not `treeId`).
- i18n keys must be added to ALL three locales (`en`, `ka`, `he`) in the `tree` namespace, kept parallel. Reuse existing `common.delete` / `common.deleting` / `common.cancel`.
- No automated API-route or React-component tests in this repo (convention). Do NOT invent a test harness; validate with `npm run lint`, `npm test` (existing 38 must stay green), `npm run build`, and manual DB check.
- Destructive-button styling matches existing pattern: `variant="outline"` + `className="text-red-600 hover:text-red-700 hover:border-red-300"`.

---

### Task 1: Cascade delete in the DELETE route

**Files:**
- Modify: `app/api/trees/[treeId]/route.ts`

**Interfaces:**
- Consumes: existing `auth`, `connectDB`, `Tree`.
- Produces: `DELETE /api/trees/[treeId]` → `200 { success: true }` on owner delete (after cascade), `404 { error: "Not found" }` for non-owner/missing, `401` if unauthenticated.

- [ ] **Step 1: Add model imports**

At the top of `app/api/trees/[treeId]/route.ts`, below the existing `import Tree from "@/lib/models/Tree";`, add:

```ts
import Person from "@/lib/models/Person";
import Relationship from "@/lib/models/Relationship";
import Event from "@/lib/models/Event";
import SiblingHide from "@/lib/models/SiblingHide";
```

- [ ] **Step 2: Replace the DELETE handler with a cascading version**

Replace the entire existing `export async function DELETE(...) { ... }` block with:

```ts
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  await connectDB();

  // Ownership gate: a sharee or stranger gets 404, never deletes.
  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascade: Events reference personId (not treeId), so resolve person IDs first.
  const personIds = (await Person.find({ treeId }).select("_id")).map((p) => p._id);
  await Event.deleteMany({ personId: { $in: personIds } });
  await Person.deleteMany({ treeId });
  await Relationship.deleteMany({ treeId });
  await SiblingHide.deleteMany({ treeId });
  await Tree.deleteOne({ _id: treeId, ownerId: session.user.id });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Typecheck + lint the route**

Run: `npm run lint`
Expected: no new errors for `app/api/trees/[treeId]/route.ts` (a pre-existing unrelated `DashboardClient.tsx` error may remain).

Run: `npm run build`
Expected: compiles clean. (If it fails with NextAuth "Unexpected token '<'" / `/api/auth` 404, delete the whole `.next` directory and rebuild — known cache-corruption issue.)

- [ ] **Step 4: Commit**

```bash
git add "app/api/trees/[treeId]/route.ts"
git commit -m "feat: cascade-delete persons/relationships/events/sibling-hides on tree delete"
```

---

### Task 2: i18n keys + DeleteTreeDialog component

**Files:**
- Modify: `messages/en.json`, `messages/ka.json`, `messages/he.json`
- Create: `components/tree/DeleteTreeDialog.tsx`

**Interfaces:**
- Consumes: the cascading `DELETE /api/trees/[treeId]` from Task 1.
- Produces: `DeleteTreeDialog` React component with props:
  ```ts
  interface Props {
    treeId: string;
    treeName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDeleted: () => void;
  }
  ```
  Named export `DeleteTreeDialog`.

- [ ] **Step 1: Add i18n keys to `messages/en.json`**

In the `"tree"` object (it contains keys like `"newTree"`, `"creating"`, `"print"`), add these four keys (place them anywhere inside the `tree` object, keeping valid JSON — e.g. right after `"creating"`):

```json
    "deleteTree": "Delete tree",
    "deleteTreeWarning": "This permanently deletes “{name}” and all its people, relationships, and events. This cannot be undone.",
    "deleteTreeTypeName": "Type the tree name to confirm",
    "deleteError": "Could not delete the tree. Please try again.",
```

- [ ] **Step 2: Add the same keys to `messages/ka.json`**

In the `"tree"` object of `messages/ka.json`, add:

```json
    "deleteTree": "ხის წაშლა",
    "deleteTreeWarning": "ეს სამუდამოდ წაშლის ხეს „{name}“ და მასში არსებულ ყველა ადამიანს, კავშირსა და მოვლენას. მოქმედება შეუქცევადია.",
    "deleteTreeTypeName": "დასადასტურებლად აკრიფეთ ხის სახელი",
    "deleteError": "ხის წაშლა ვერ მოხერხდა. სცადეთ თავიდან.",
```

- [ ] **Step 3: Add the same keys to `messages/he.json`**

In the `"tree"` object of `messages/he.json`, add:

```json
    "deleteTree": "מחיקת עץ",
    "deleteTreeWarning": "פעולה זו תמחק לצמיתות את העץ „{name}“ ואת כל האנשים, הקשרים והאירועים שבו. לא ניתן לבטל.",
    "deleteTreeTypeName": "הקלד את שם העץ לאישור",
    "deleteError": "לא ניתן למחוק את העץ. נסו שוב.",
```

- [ ] **Step 4: Validate JSON**

Run: `node -e "['en','ka','he'].forEach(l=>{const o=require('./messages/'+l+'.json');['deleteTree','deleteTreeWarning','deleteTreeTypeName','deleteError'].forEach(k=>{if(!o.tree[k])throw new Error(l+' missing '+k)})});console.log('i18n ok')"`
Expected: prints `i18n ok` (JSON parses and all four keys exist in `tree` for all three locales).

- [ ] **Step 5: Create `components/tree/DeleteTreeDialog.tsx`**

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
  treeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteTreeDialog({ treeId, treeName, open, onOpenChange, onDeleted }: Props) {
  const t = useTranslations("tree");
  const tc = useTranslations("common");
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/trees/${treeId}`, { method: "DELETE" });
    if (res.ok) {
      setTyped("");
      onDeleted();
      onOpenChange(false);
    } else {
      setError(t("deleteError"));
    }
    setDeleting(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setTyped("");
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("deleteTree")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("deleteTreeWarning", { name: treeName })}
          </p>
          <div className="space-y-1">
            <Label htmlFor="confirmTreeName">{t("deleteTreeTypeName")}</Label>
            <Input
              id="confirmTreeName"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={treeName}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
              {tc("cancel")}
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:border-red-300"
              onClick={handleDelete}
              disabled={typed !== treeName || deleting}
            >
              {deleting ? tc("deleting") : tc("delete")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 6: Lint + build**

Run: `npm run lint`
Expected: no new errors for the new file.

Run: `npm run build`
Expected: compiles clean.

- [ ] **Step 7: Commit**

```bash
git add messages/en.json messages/ka.json messages/he.json components/tree/DeleteTreeDialog.tsx
git commit -m "feat: DeleteTreeDialog (type-name confirm) + delete-tree i18n keys"
```

---

### Task 3: Wire delete into the trees list and the tree page

**Files:**
- Modify: `app/(dashboard)/trees/page.tsx`
- Modify: `app/(dashboard)/trees/[treeId]/page.tsx`

**Interfaces:**
- Consumes: `DeleteTreeDialog` (Task 2), `useTrees().mutate`, `useRouter`.
- Produces: nothing downstream.

- [ ] **Step 1: Trees list — imports + state**

In `app/(dashboard)/trees/page.tsx`:

Add these imports near the existing imports:

```ts
import { DeleteTreeDialog } from "@/components/tree/DeleteTreeDialog"
import { Trash2 } from "lucide-react"
import type { ITree } from "@/types"
```

Inside the `TreesPage` component, add state next to the other `useState` hooks:

```ts
  const [deleteTarget, setDeleteTarget] = useState<ITree | null>(null)
```

- [ ] **Step 2: Trees list — delete button on each owned card**

In the owned-trees `.map((tree) => (...))`, replace the `<CardHeader>` of the owned card with a header that carries a delete button. The owned card currently is:

```tsx
                <CardHeader>
                  <CardTitle className="text-lg">{tree.name}</CardTitle>
                </CardHeader>
```

Replace that block with:

```tsx
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-lg">{tree.name}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:border-red-300"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(tree)
                    }}
                    aria-label={t("deleteTree")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
```

(Only the OWNED card gets this — leave the shared-tree card's header unchanged.)

- [ ] **Step 3: Trees list — render the dialog**

Just before the final closing `</div>` of the returned JSX (after the `{!isLoading && ( ... )}` block), add:

```tsx
      {deleteTarget && (
        <DeleteTreeDialog
          treeId={deleteTarget._id}
          treeName={deleteTarget.name}
          open={!!deleteTarget}
          onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
          onDeleted={() => { setDeleteTarget(null); mutate() }}
        />
      )}
```

- [ ] **Step 4: Trees list — lint + build**

Run: `npm run lint`
Expected: no new errors.

Run: `npm run build`
Expected: compiles clean.

- [ ] **Step 5: Tree page — imports + state**

In `app/(dashboard)/trees/[treeId]/page.tsx`:

Add imports near the existing ones:

```ts
import { useRouter } from "next/navigation";
import { DeleteTreeDialog } from "@/components/tree/DeleteTreeDialog";
```

Inside the `TreePage` component body, add the router and a dialog-open state (place near the other `useState` hooks, e.g. beside `shareOpen`):

```ts
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
```

- [ ] **Step 6: Tree page — owner-only Delete button in the header**

In the header action row, the owner-only block currently is:

```tsx
          {isOwner && (
            <>
              <Button variant="outline" onClick={() => setShareOpen(true)}>{t("share")}</Button>
              <Button variant="outline" onClick={() => setLinkOpen(true)}>{t("linkPeople")}</Button>
              <Button onClick={() => setAddPersonOpen(true)}>{t("addPerson")}</Button>
            </>
          )}
```

Add a Delete button inside that fragment, after the Add-person button:

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

- [ ] **Step 7: Tree page — render the dialog**

Add near the other dialogs in the returned JSX (e.g. right after the Share dialog `</Dialog>`), guarded so it only mounts for an owner with loaded metadata:

```tsx
      {isOwner && treeMeta && (
        <DeleteTreeDialog
          treeId={treeId}
          treeName={treeMeta.name}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onDeleted={() => router.push("/trees")}
        />
      )}
```

- [ ] **Step 8: Full gate**

Grep both edited pages to confirm `DeleteTreeDialog` is imported and used, and (tree page) `useRouter`/`router` are wired.

Run: `npm run lint`
Expected: no new errors.

Run: `npm test`
Expected: existing 38 tests still PASS (no regressions).

Run: `npm run build`
Expected: compiles clean.

- [ ] **Step 9: Commit**

```bash
git add "app/(dashboard)/trees/page.tsx" "app/(dashboard)/trees/[treeId]/page.tsx"
git commit -m "feat: delete-tree controls on trees list cards and tree page header"
```

---

### Task 4: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background). Open `http://localhost:3000`, log in.

> If `/api/auth` 404s or NextAuth throws "Unexpected token '<'", stop the server, wipe the whole `.next` directory, and `npm run dev` again.

- [ ] **Step 2: Verify owner-only visibility**

On `/trees`: each OWNED tree card shows a red trash button; SHARED-with-me cards do not. Open an owned tree → header shows a red "Delete tree" button. Open a shared (view-only) tree → NO delete button.

- [ ] **Step 3: Verify typed confirmation**

Click delete (either location). The dialog's Delete button is disabled. Type a wrong name → still disabled. Type the exact tree name → enabled. Cancel → nothing deleted.

- [ ] **Step 4: Verify deletion + cascade**

Create a throwaway tree with a few persons/relationships/events, then delete it. From the list: the card disappears. From the tree page: the app navigates to `/trees` and the tree is gone. Confirm in the DB (or via the API) that no `Person`/`Relationship`/`Event`/`SiblingHide` documents remain for that `treeId`, and that OTHER trees and their data are untouched.

- [ ] **Step 5: Verify non-owner is blocked at the API**

As a non-owner (or logged out → 401), `curl -X DELETE http://localhost:3000/api/trees/<someoneElsesTreeId>` returns 404/401 and deletes nothing.

- [ ] **Step 6: Final quality gate**

Run: `npm run lint && npm test && npm run build`
Expected: all pass.

Report verification results (with actual output) before declaring complete.
