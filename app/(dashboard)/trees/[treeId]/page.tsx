"use client";

import { use, useState, useCallback, useRef } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { uploadFile } from "@/components/ui/cloudinary-upload";
import { PersonForm } from "@/components/person/PersonForm";
import { FamilyTree } from "@/components/tree/FamilyTree";
import { TreeToolbar } from "@/components/tree/TreeToolbar";
import { buildTreeData } from "@/lib/buildTreeData";
import type { IPerson, IRelationship, RelativeRole } from "@/types";
import { useTranslations } from "next-intl";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function roleToRelationship(
  role: RelativeRole,
  selectedId: string,
  newId: string
): { type: "parent-child" | "spouse"; person1Id: string; person2Id: string } {
  switch (role) {
    case "father":
    case "mother":
      return { type: "parent-child", person1Id: newId, person2Id: selectedId };
    case "son":
    case "daughter":
    case "brother":
    case "sister":
      return { type: "parent-child", person1Id: selectedId, person2Id: newId };
    case "spouse":
      return { type: "spouse", person1Id: selectedId, person2Id: newId };
  }
}

function roleGender(role: RelativeRole): IPerson["gender"] {
  if (role === "father" || role === "son" || role === "brother") return "male";
  if (role === "mother" || role === "daughter" || role === "sister") return "female";
  return "unknown";
}

function linkRoleToRelationship(
  role: "child-of" | "parent-of" | "spouse-of",
  linkToId: string,
  newId: string
): { type: "parent-child" | "spouse"; person1Id: string; person2Id: string } {
  switch (role) {
    case "child-of":
      return { type: "parent-child", person1Id: linkToId, person2Id: newId };
    case "parent-of":
      return { type: "parent-child", person1Id: newId, person2Id: linkToId };
    case "spouse-of":
      return { type: "spouse", person1Id: linkToId, person2Id: newId };
  }
}

export default function TreePage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = use(params);
  const t = useTranslations("tree");
  const tp = useTranslations("person");
  const tc = useTranslations("common");

  const { data: persons = [], mutate: mutatePersons } = useSWR<IPerson[]>(
    `/api/trees/${treeId}/persons`,
    fetcher
  );
  const { data: relationships = [], mutate: mutateRels } = useSWR<IRelationship[]>(
    `/api/trees/${treeId}/relationships`,
    fetcher
  );

  // Add new person
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add relative (from node button)
  const [pendingRole, setPendingRole] = useState<RelativeRole | null>(null);
  const [pendingFromId, setPendingFromId] = useState<string | null>(null);
  const [linkToId, setLinkToId] = useState("");
  const [linkRole, setLinkRole] = useState<"child-of" | "parent-of" | "spouse-of">("child-of");

  // Link two existing persons
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkP1, setLinkP1] = useState("");
  const [linkP2, setLinkP2] = useState("");
  const [linkType, setLinkType] = useState<"parent-child" | "spouse" | "sibling">("spouse");
  const [linkParent, setLinkParent] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);

  // Person detail sheet
  const [selectedPerson, setSelectedPerson] = useState<IPerson | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Search highlight
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());

  const handleAddRelative = useCallback((personId: string, role: RelativeRole) => {
    setPendingFromId(personId);
    setPendingRole(role);
  }, []);

  const handleSelect = useCallback((person: IPerson) => {
    setSelectedPerson(person);
    setEditMode(false);
  }, []);

  async function submitNewPerson(data: Partial<IPerson>) {
    setSaving(true);
    const res = await fetch(`/api/trees/${treeId}/persons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) { setSaving(false); return; }

    const newPerson: IPerson = await res.json();

    if (pendingFromId && pendingRole) {
      const rel = roleToRelationship(pendingRole, pendingFromId, newPerson._id);
      await fetch(`/api/trees/${treeId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rel),
      });
      await mutateRels();
      setPendingRole(null);
      setPendingFromId(null);
    } else if (linkToId) {
      const rel = linkRoleToRelationship(linkRole, linkToId, newPerson._id);
      await fetch(`/api/trees/${treeId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rel),
      });
      await mutateRels();
    }

    setAddPersonOpen(false);
    setLinkToId("");
    setLinkRole("child-of");
    await mutatePersons();
    setSaving(false);
  }

  async function submitEditPerson(data: Partial<IPerson>) {
    if (!selectedPerson) return;
    setSaving(true);
    const res = await fetch(`/api/persons/${selectedPerson._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setSelectedPerson(await res.json());
      setEditMode(false);
      await mutatePersons();
    }
    setSaving(false);
  }

  async function handleDeletePerson() {
    if (!selectedPerson) return;
    setDeleting(true);
    await fetch(`/api/persons/${selectedPerson._id}`, { method: "DELETE" });
    await mutatePersons();
    setSelectedPerson(null);
    setDeleting(false);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedPerson) return;
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError(tp("photoSizeError"));
      return;
    }
    const personId = selectedPerson._id;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const url = await uploadFile(file, "genealogy/photos");
      const res = await fetch(`/api/persons/${personId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: url }),
      });
      if (!res.ok) throw new Error(tp("photoSaveError"));
      const updated: IPerson = await res.json();
      if (selectedPerson?._id === personId) {
        setSelectedPerson(updated);
      }
      await mutatePersons();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : tp("photoSaveError"));
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkP1 || !linkP2 || linkP1 === linkP2) return;
    if (linkType === "sibling" && !linkParent) return;
    setLinkSaving(true);

    if (linkType === "sibling") {
      await Promise.all([
        fetch(`/api/trees/${treeId}/relationships`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "parent-child", person1Id: linkParent, person2Id: linkP1 }),
        }),
        fetch(`/api/trees/${treeId}/relationships`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "parent-child", person1Id: linkParent, person2Id: linkP2 }),
        }),
      ]);
    } else {
      await fetch(`/api/trees/${treeId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: linkType, person1Id: linkP1, person2Id: linkP2 }),
      });
    }

    await mutateRels();
    setLinkOpen(false);
    setLinkP1("");
    setLinkP2("");
    setLinkParent("");
    setLinkType("spouse");
    setLinkSaving(false);
  }

  const dialogOpen = addPersonOpen || !!pendingRole;
  const dialogTitle = pendingRole ? `Add ${pendingRole}` : t("addPerson");
  const defaultGender = pendingRole ? roleGender(pendingRole) : "unknown";

  const { nodes, edges } = buildTreeData(persons, relationships, { onAddRelative: handleAddRelative, onSelect: handleSelect }, highlighted);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <TreeToolbar persons={persons} onHighlight={setHighlighted} />
          <Button variant="outline" onClick={() => setLinkOpen(true)}>{t("linkPeople")}</Button>
          <Button onClick={() => setAddPersonOpen(true)}>{t("addPerson")}</Button>
        </div>
      </div>

      {persons.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground">
          <div className="text-center">
            <p className="mb-3">{t("noPersons")}</p>
            <Button onClick={() => setAddPersonOpen(true)}>{t("addFirstPerson")}</Button>
          </div>
        </div>
      ) : (
        <FamilyTree nodes={nodes} edges={edges} />
      )}

      {/* Add / Add-relative dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAddPersonOpen(false);
            setPendingRole(null);
            setPendingFromId(null);
            setLinkToId("");
            setLinkRole("child-of");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">{dialogTitle}</DialogTitle>
          </DialogHeader>
          <PersonForm
            key={pendingRole ?? "standalone"}
            initial={{ gender: defaultGender }}
            onSubmit={submitNewPerson}
            loading={saving}
          />
          {!pendingRole && persons.length > 0 && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                {t("linkOptional")}
              </p>
              <Select value={linkToId} onValueChange={(v) => setLinkToId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectPerson")} />
                </SelectTrigger>
                <SelectContent>
                  {persons.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {linkToId && (
                <Select
                  value={linkRole}
                  onValueChange={(v) => setLinkRole(v as typeof linkRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="child-of">{t("childOf")}</SelectItem>
                    <SelectItem value="parent-of">{t("parentOf")}</SelectItem>
                    <SelectItem value="spouse-of">{t("spouseOf")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Link existing persons dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("linkExisting")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitLink} className="space-y-3">
            <div className="space-y-1">
              <Label>{t("person1")}</Label>
              <Select value={linkP1} onValueChange={(v) => setLinkP1(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {persons.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("relationship")}</Label>
              <Select value={linkType} onValueChange={(v) => setLinkType(v as "parent-child" | "spouse" | "sibling")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">{t("spouse")}</SelectItem>
                  <SelectItem value="parent-child">{t("parentChild")}</SelectItem>
                  <SelectItem value="sibling">{t("sibling")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {linkType === "sibling" && (
              <div className="space-y-1">
                <Label>{t("sharedParent")}</Label>
                <Select value={linkParent} onValueChange={(v) => setLinkParent(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder={t("selectPerson")} /></SelectTrigger>
                  <SelectContent>
                    {persons
                      .filter((p) => p._id !== linkP1 && p._id !== linkP2)
                      .map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.firstName} {p.lastName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>{t("person2")}</Label>
              <Select value={linkP2} onValueChange={(v) => setLinkP2(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {persons.filter((p) => p._id !== linkP1).map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={!linkP1 || !linkP2 || (linkType === "sibling" && !linkParent) || linkSaving}>
              {linkSaving ? tc("saving") : t("createRelationship")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Person detail sheet */}
      <Sheet
        open={!!selectedPerson}
        onOpenChange={(o) => { if (!o) { setSelectedPerson(null); setEditMode(false); } }}
      >
        <SheetContent className="w-96 overflow-y-auto">
          {selectedPerson && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedPerson.firstName} {selectedPerson.lastName}</SheetTitle>
              </SheetHeader>

              {editMode ? (
                <div className="mt-4">
                  <PersonForm initial={selectedPerson} onSubmit={submitEditPerson} loading={saving} />
                  <Button variant="outline" className="w-full mt-2" onClick={() => setEditMode(false)}>{tc("cancel")}</Button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
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
                      {photoUploading ? tc("uploading") : tp("changePhoto")}
                    </Button>
                    {photoError && <p className="text-xs text-destructive">{photoError}</p>}
                  </div>
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">{tp("gender")}</dt><dd className="capitalize">{selectedPerson.gender}</dd></div>
                    {selectedPerson.birthDate && <div className="flex justify-between"><dt className="text-muted-foreground">{tp("birthDate")}</dt><dd>{selectedPerson.birthDate}</dd></div>}
                    {selectedPerson.birthPlace && <div className="flex justify-between"><dt className="text-muted-foreground">{tp("birthPlace")}</dt><dd>{selectedPerson.birthPlace}</dd></div>}
                    {selectedPerson.deathDate && <div className="flex justify-between"><dt className="text-muted-foreground">{tp("deathDate")}</dt><dd>{selectedPerson.deathDate}</dd></div>}
                    {selectedPerson.deathPlace && <div className="flex justify-between"><dt className="text-muted-foreground">{tp("deathPlace")}</dt><dd>{selectedPerson.deathPlace}</dd></div>}
                    {selectedPerson.maidenName && <div className="flex justify-between"><dt className="text-muted-foreground">{tp("maidenName")}</dt><dd>{selectedPerson.maidenName}</dd></div>}
                    {selectedPerson.notes && <div className="pt-1"><dt className="text-muted-foreground mb-1">{tp("notes")}</dt><dd className="text-gray-700">{selectedPerson.notes}</dd></div>}
                  </dl>
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1" onClick={() => setEditMode(true)}>{tp("edit")}</Button>
                    <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700 hover:border-red-300" onClick={handleDeletePerson} disabled={deleting}>
                      {deleting ? tp("deleting") : tp("delete")}
                    </Button>
                  </div>
                  <Link href={`/person/${selectedPerson._id}`} className="block">
                    <Button variant="outline" className="w-full">{tp("viewProfile")}</Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
