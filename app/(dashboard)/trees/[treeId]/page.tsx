"use client";

import { use, useState } from "react";
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
import type { IPerson, IRelationship, TreeNode, TreeEdge } from "@/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function buildNodes(persons: IPerson[]): TreeNode[] {
  return persons.map((p, i) => ({
    id: p._id,
    type: "personNode" as const,
    position: { x: (i % 4) * 220 + 40, y: Math.floor(i / 4) * 180 + 40 },
    data: { person: p },
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

  const {
    data: persons = [],
    mutate: mutatePersons,
  } = useSWR<IPerson[]>(`/api/trees/${treeId}/persons`, fetcher);

  const {
    data: relationships = [],
    mutate: mutateRels,
  } = useSWR<IRelationship[]>(`/api/trees/${treeId}/relationships`, fetcher);

  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [addingPerson, setAddingPerson] = useState(false);

  const [selectedPerson, setSelectedPerson] = useState<IPerson | null>(null);
  const [relType, setRelType] = useState<"parent-child" | "spouse">("parent-child");
  const [relTarget, setRelTarget] = useState("");
  const [addingRel, setAddingRel] = useState(false);

  async function handleAddPerson(data: Partial<IPerson>) {
    setAddingPerson(true);
    const res = await fetch(`/api/trees/${treeId}/persons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      await mutatePersons();
      setAddPersonOpen(false);
    }
    setAddingPerson(false);
  }

  async function handleAddRelationship() {
    if (!selectedPerson || !relTarget) return;
    setAddingRel(true);
    await fetch(`/api/trees/${treeId}/relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: relType,
        person1Id: selectedPerson._id,
        person2Id: relTarget,
      }),
    });
    await mutateRels();
    setRelTarget("");
    setAddingRel(false);
  }

  async function handleDeletePerson() {
    if (!selectedPerson) return;
    await fetch(`/api/persons/${selectedPerson._id}`, { method: "DELETE" });
    await mutatePersons();
    setSelectedPerson(null);
  }

  const otherPersons = persons.filter((p) => p._id !== selectedPerson?._id);

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
            <Button onClick={() => setAddPersonOpen(true)}>
              Add first person
            </Button>
          </div>
        </div>
      ) : (
        <FamilyTree
          nodes={buildNodes(persons)}
          edges={buildEdges(relationships)}
          onNodeClick={(id) => {
            const p = persons.find((x) => x._id === id);
            if (p) setSelectedPerson(p);
          }}
        />
      )}

      {/* Add Person Dialog */}
      <Dialog open={addPersonOpen} onOpenChange={setAddPersonOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add person</DialogTitle>
          </DialogHeader>
          <PersonForm onSubmit={handleAddPerson} loading={addingPerson} />
        </DialogContent>
      </Dialog>

      {/* Person Detail Sheet */}
      <Sheet
        open={!!selectedPerson}
        onOpenChange={(o) => !o && setSelectedPerson(null)}
      >
        <SheetContent className="w-80 overflow-y-auto">
          {selectedPerson && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selectedPerson.firstName} {selectedPerson.lastName}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-1 text-sm text-muted-foreground">
                {selectedPerson.birthDate && (
                  <p>Born: {selectedPerson.birthDate}</p>
                )}
                {selectedPerson.birthPlace && (
                  <p>Place: {selectedPerson.birthPlace}</p>
                )}
                {selectedPerson.deathDate && (
                  <p>Died: {selectedPerson.deathDate}</p>
                )}
                {selectedPerson.notes && (
                  <p className="mt-2 text-gray-700">{selectedPerson.notes}</p>
                )}
              </div>

              {otherPersons.length > 0 && (
                <div className="mt-6 space-y-3">
                  <p className="font-semibold text-sm">Add relationship</p>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={relType}
                      onValueChange={(v) =>
                        setRelType(v as "parent-child" | "spouse")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parent-child">
                          Parent → Child
                        </SelectItem>
                        <SelectItem value="spouse">Spouse</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {relType === "parent-child"
                        ? "Child (person 2)"
                        : "Spouse (person 2)"}
                    </Label>
                    <Select value={relTarget} onValueChange={(v) => setRelTarget(v ?? "")}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select person…" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherPersons.map((p) => (
                          <SelectItem key={p._id} value={p._id}>
                            {p.firstName} {p.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full"
                    disabled={!relTarget || addingRel}
                    onClick={handleAddRelationship}
                  >
                    {addingRel ? "Saving…" : "Add relationship"}
                  </Button>
                </div>
              )}

              <div className="mt-6">
                <Button
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700"
                  onClick={handleDeletePerson}
                >
                  Delete person
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
