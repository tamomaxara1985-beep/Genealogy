"use client";

import { use, useState, useCallback } from "react";
import useSWR from "swr";
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
import { PersonForm } from "@/components/person/PersonForm";
import { FamilyTree } from "@/components/tree/FamilyTree";
import type {
  IPerson,
  IRelationship,
  RelativeRole,
  TreeNode,
  TreeEdge,
} from "@/types";

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

function buildNodes(
  persons: IPerson[],
  onAddRelative: (personId: string, role: RelativeRole) => void,
  onSelect: (person: IPerson) => void
): TreeNode[] {
  return persons.map((p, i) => ({
    id: p._id,
    type: "personNode" as const,
    position: { x: (i % 4) * 240 + 60, y: Math.floor(i / 4) * 200 + 60 },
    data: { person: p, onAddRelative, onSelect },
  }));
}

function buildEdges(relationships: IRelationship[]): TreeEdge[] {
  return relationships.map((r) => ({
    id: r._id,
    source: r.person1Id,
    target: r.person2Id,
    type: "step" as const,
    label: r.type === "spouse" ? "spouse" : "child",
  }));
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

  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pendingRole, setPendingRole] = useState<RelativeRole | null>(null);
  const [pendingFromId, setPendingFromId] = useState<string | null>(null);

  const [selectedPerson, setSelectedPerson] = useState<IPerson | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      const updated: IPerson = await res.json();
      setSelectedPerson(updated);
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

  const dialogOpen = addPersonOpen || !!pendingRole;
  const dialogTitle = pendingRole ? `Add ${pendingRole}` : "Add person";
  const defaultGender = pendingRole ? roleGender(pendingRole) : "unknown";

  const nodes = buildNodes(persons, handleAddRelative, handleSelect);
  const edges = buildEdges(relationships);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Family Tree</h1>
        <Button onClick={() => setAddPersonOpen(true)}>+ Add Person</Button>
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
          if (!o) {
            setAddPersonOpen(false);
            setPendingRole(null);
            setPendingFromId(null);
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
        </DialogContent>
      </Dialog>

      {/* Person detail / edit sheet */}
      <Sheet
        open={!!selectedPerson}
        onOpenChange={(o) => {
          if (!o) { setSelectedPerson(null); setEditMode(false); }
        }}
      >
        <SheetContent className="w-96 overflow-y-auto">
          {selectedPerson && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selectedPerson.firstName} {selectedPerson.lastName}
                </SheetTitle>
              </SheetHeader>

              {editMode ? (
                <div className="mt-4">
                  <PersonForm
                    initial={selectedPerson}
                    onSubmit={submitEditPerson}
                    loading={saving}
                  />
                  <Button
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => setEditMode(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Gender</dt>
                      <dd className="capitalize">{selectedPerson.gender}</dd>
                    </div>
                    {selectedPerson.birthDate && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Born</dt>
                        <dd>{selectedPerson.birthDate}</dd>
                      </div>
                    )}
                    {selectedPerson.birthPlace && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Birth place</dt>
                        <dd>{selectedPerson.birthPlace}</dd>
                      </div>
                    )}
                    {selectedPerson.deathDate && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Died</dt>
                        <dd>{selectedPerson.deathDate}</dd>
                      </div>
                    )}
                    {selectedPerson.deathPlace && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Death place</dt>
                        <dd>{selectedPerson.deathPlace}</dd>
                      </div>
                    )}
                    {selectedPerson.maidenName && (
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Maiden name</dt>
                        <dd>{selectedPerson.maidenName}</dd>
                      </div>
                    )}
                    {selectedPerson.notes && (
                      <div className="pt-1">
                        <dt className="text-muted-foreground mb-1">Notes</dt>
                        <dd className="text-gray-700">{selectedPerson.notes}</dd>
                      </div>
                    )}
                  </dl>

                  <div className="flex gap-2 pt-2">
                    <Button
                      className="flex-1"
                      onClick={() => setEditMode(true)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600 hover:text-red-700 hover:border-red-300"
                      onClick={handleDeletePerson}
                      disabled={deleting}
                    >
                      {deleting ? "Deleting…" : "Delete"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
