"use client";

import { use, useState, useCallback } from "react";
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
import { PersonForm } from "@/components/person/PersonForm";
import { FamilyTree } from "@/components/tree/FamilyTree";
import { TreeToolbar } from "@/components/tree/TreeToolbar";
import { buildTreeData } from "@/lib/buildTreeData";
import type { IPerson, IRelationship, RelativeRole } from "@/types";

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

export default function TreePage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = use(params);

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

  // Link two existing persons
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkP1, setLinkP1] = useState("");
  const [linkP2, setLinkP2] = useState("");
  const [linkType, setLinkType] = useState<"parent-child" | "spouse">("spouse");
  const [linkSaving, setLinkSaving] = useState(false);

  // Person detail sheet
  const [selectedPerson, setSelectedPerson] = useState<IPerson | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    } else {
      setAddPersonOpen(false);
    }

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

  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkP1 || !linkP2 || linkP1 === linkP2) return;
    setLinkSaving(true);
    await fetch(`/api/trees/${treeId}/relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: linkType, person1Id: linkP1, person2Id: linkP2 }),
    });
    await mutateRels();
    setLinkOpen(false);
    setLinkP1("");
    setLinkP2("");
    setLinkSaving(false);
  }

  const dialogOpen = addPersonOpen || !!pendingRole;
  const dialogTitle = pendingRole ? `Add ${pendingRole}` : "Add person";
  const defaultGender = pendingRole ? roleGender(pendingRole) : "unknown";

  const { nodes, edges } = buildTreeData(persons, relationships, { onAddRelative: handleAddRelative, onSelect: handleSelect }, highlighted);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Family Tree</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <TreeToolbar persons={persons} onHighlight={setHighlighted} />
          <Button variant="outline" onClick={() => setLinkOpen(true)}>Link people</Button>
          <Button onClick={() => setAddPersonOpen(true)}>+ Add Person</Button>
        </div>
      </div>

      {persons.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed rounded-xl text-muted-foreground">
          <div className="text-center">
            <p className="mb-3">No people yet</p>
            <Button onClick={() => setAddPersonOpen(true)}>Add first person</Button>
          </div>
        </div>
      ) : (
        <FamilyTree nodes={nodes} edges={edges} />
      )}

      {/* Add / Add-relative dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) { setAddPersonOpen(false); setPendingRole(null); setPendingFromId(null); }
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
        </DialogContent>
      </Dialog>

      {/* Link existing persons dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Link existing people</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitLink} className="space-y-3">
            <div className="space-y-1">
              <Label>Person 1</Label>
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
              <Label>Relationship</Label>
              <Select value={linkType} onValueChange={(v) => setLinkType(v as "parent-child" | "spouse")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="spouse">Spouse / Partner</SelectItem>
                  <SelectItem value="parent-child">Parent → Child (Person 1 is parent)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Person 2</Label>
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
            <Button type="submit" className="w-full" disabled={!linkP1 || !linkP2 || linkSaving}>
              {linkSaving ? "Saving…" : "Create relationship"}
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
                  <Button variant="outline" className="w-full mt-2" onClick={() => setEditMode(false)}>Cancel</Button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">Gender</dt><dd className="capitalize">{selectedPerson.gender}</dd></div>
                    {selectedPerson.birthDate && <div className="flex justify-between"><dt className="text-muted-foreground">Born</dt><dd>{selectedPerson.birthDate}</dd></div>}
                    {selectedPerson.birthPlace && <div className="flex justify-between"><dt className="text-muted-foreground">Birth place</dt><dd>{selectedPerson.birthPlace}</dd></div>}
                    {selectedPerson.deathDate && <div className="flex justify-between"><dt className="text-muted-foreground">Died</dt><dd>{selectedPerson.deathDate}</dd></div>}
                    {selectedPerson.deathPlace && <div className="flex justify-between"><dt className="text-muted-foreground">Death place</dt><dd>{selectedPerson.deathPlace}</dd></div>}
                    {selectedPerson.maidenName && <div className="flex justify-between"><dt className="text-muted-foreground">Maiden name</dt><dd>{selectedPerson.maidenName}</dd></div>}
                    {selectedPerson.notes && <div className="pt-1"><dt className="text-muted-foreground mb-1">Notes</dt><dd className="text-gray-700">{selectedPerson.notes}</dd></div>}
                  </dl>
                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1" onClick={() => setEditMode(true)}>Edit</Button>
                    <Button variant="outline" className="flex-1 text-red-600 hover:text-red-700 hover:border-red-300" onClick={handleDeletePerson} disabled={deleting}>
                      {deleting ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                  <Link href={`/person/${selectedPerson._id}`} className="block">
                    <Button variant="outline" className="w-full">View full profile →</Button>
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
