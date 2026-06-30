"use client";

import { use, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EventForm } from "@/components/person/EventForm";
import type { IPerson, IEvent, IRelationship, ITree, ISiblingHide } from "@/types";
import { deriveSiblingIds, splitSiblingsByHide } from "@/lib/deriveSiblings";
import { useTranslations } from "next-intl";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const EVENT_ICONS: Record<string, string> = {
  birth: "👶", death: "✝️", marriage: "💍", divorce: "📄",
  immigration: "🚢", other: "📌",
};

const LINK_ROLES = [
  { value: "father",   label: "Father"   },
  { value: "mother",   label: "Mother"   },
  { value: "spouse",   label: "Spouse"   },
  { value: "son",      label: "Son"      },
  { value: "daughter", label: "Daughter" },
] as const;

type LinkRole = typeof LINK_ROLES[number]["value"];

function roleToPayload(role: LinkRole, currentId: string, selectedId: string) {
  if (role === "father" || role === "mother")
    return { type: "parent-child", person1Id: selectedId, person2Id: currentId };
  if (role === "son" || role === "daughter")
    return { type: "parent-child", person1Id: currentId, person2Id: selectedId };
  return { type: "spouse", person1Id: currentId, person2Id: selectedId };
}

export default function PersonProfilePage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = use(params);
  const tp = useTranslations("person");
  const te = useTranslations("event");
  const tc = useTranslations("common");

  const { data: person } = useSWR<IPerson>(`/api/persons/${personId}`, fetcher);
  const { data: events = [], mutate: mutateEvents } = useSWR<IEvent[]>(
    `/api/persons/${personId}/events`,
    fetcher
  );
  const { data: allPersons = [] } = useSWR<IPerson[]>(
    person ? `/api/trees/${person.treeId}/persons` : null,
    fetcher
  );
  const { data: allRels = [], mutate: mutateRels } = useSWR<IRelationship[]>(
    person ? `/api/trees/${person.treeId}/relationships` : null,
    fetcher
  );
  const { data: siblingHides = [], mutate: mutateHides } = useSWR<ISiblingHide[]>(
    person ? `/api/trees/${person.treeId}/sibling-hides` : null,
    fetcher
  );
  const { data: treeMeta } = useSWR<ITree>(
    person ? `/api/trees/${person.treeId}` : null,
    fetcher
  );
  const isOwner = treeMeta?.role === "owner";

  const [addEventOpen, setAddEventOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkRole, setLinkRole] = useState<LinkRole>("father");
  const [linkPersonId, setLinkPersonId] = useState("");
  const [divorceRelId, setDivorceRelId] = useState<string | null>(null);
  const [divorceDate, setDivorceDate] = useState("");

  if (!person) return <div className="p-8 text-muted-foreground">{tc("loading")}</div>;

  const initials = `${person.firstName[0] ?? "?"}${person.lastName[0] ?? ""}`;
  const gender = person.gender ?? "unknown";

  const genderColor: Record<string, string> = {
    male: "bg-blue-50 text-blue-700",
    female: "bg-pink-50 text-pink-700",
    other: "bg-purple-50 text-purple-700",
    unknown: "bg-gray-50 text-gray-600",
  };

  // Derive relationships for this person
  const parents = allRels.filter(
    (r) => r.type === "parent-child" && r.person2Id === personId
  );
  const children = allRels.filter(
    (r) => r.type === "parent-child" && r.person1Id === personId
  );
  const spouses = allRels.filter(
    (r) => r.type === "spouse" && (r.person1Id === personId || r.person2Id === personId)
  );
  const allSiblingIds = deriveSiblingIds(personId, allRels);
  const { visible: siblingIds, hidden: hiddenSiblings } = splitSiblingsByHide(
    personId,
    allSiblingIds,
    siblingHides
  );
  const hasRelationships =
    parents.length + children.length + spouses.length + siblingIds.length > 0;

  const personById = new Map(allPersons.map((p) => [p._id, p]));
  const availablePersons = allPersons.filter((p) => p._id !== personId);

  async function handleLink() {
    if (!linkPersonId) return;
    const payload = roleToPayload(linkRole, personId, linkPersonId);
    await fetch(`/api/trees/${person!.treeId}/relationships`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await mutateRels();
    setLinkOpen(false);
    setLinkPersonId("");
  }

  async function handleDivorce() {
    if (!divorceRelId) return;
    await fetch(`/api/trees/${person!.treeId}/relationships/${divorceRelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate: divorceDate || null }),
    });
    await mutateRels();
    setDivorceRelId(null);
    setDivorceDate("");
  }

  async function handleUnlink(relId: string) {
    await fetch(`/api/trees/${person!.treeId}/relationships/${relId}`, {
      method: "DELETE",
    });
    await mutateRels();
  }

  async function handleUnlinkSibling(siblingId: string) {
    await fetch(`/api/trees/${person!.treeId}/sibling-hides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personAId: personId, personBId: siblingId }),
    });
    await mutateHides();
  }

  async function handleRelinkSibling(hideId: string) {
    await fetch(`/api/trees/${person!.treeId}/sibling-hides/${hideId}`, {
      method: "DELETE",
    });
    await mutateHides();
  }

  function PersonLink({ id }: { id: string }) {
    const p = personById.get(id);
    if (!p) return <span className="text-sm text-muted-foreground italic">Unknown</span>;
    return (
      <Link
        href={`/person/${id}`}
        className="text-sm font-medium hover:text-amber-600 hover:underline"
      >
        {p.firstName} {p.lastName}
      </Link>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start gap-6">
        <Avatar className="h-24 w-24 border-4 border-white shadow-md">
          <AvatarImage src={person.photoUrl} />
          <AvatarFallback className={`text-2xl font-bold ${genderColor[gender]}`}>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold">
              {person.firstName} {person.lastName}
            </h1>
            {person.maidenName && (
              <span className="text-muted-foreground text-lg">
                (née {person.maidenName})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={person.isLiving ? "default" : "secondary"}>
              {person.isLiving ? tp("living") : tp("deceased")}
            </Badge>
            <Badge variant="outline" className="capitalize">{gender}</Badge>
          </div>
          {(person.birthDate || person.deathDate) && (
            <p className="text-muted-foreground mt-1">
              {person.birthDate && `b. ${person.birthDate}`}
              {person.birthDate && person.deathDate && " · "}
              {person.deathDate && `d. ${person.deathDate}`}
            </p>
          )}
          {person.birthPlace && (
            <p className="text-sm text-muted-foreground">{person.birthPlace}</p>
          )}
          <div className="mt-3">
            <Button size="sm" nativeButton={false} render={<Link href={`/trees/${person.treeId}`} />}>
              {tp("backToTree")}
            </Button>
          </div>
        </div>
      </div>

      {/* Notes / Bio */}
      {(person.notes || person.bio) && (
        <Card>
          <CardHeader><CardTitle>{tp("about")}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {person.bio && <p>{person.bio}</p>}
            {person.notes && <p className="text-muted-foreground">{person.notes}</p>}
          </CardContent>
        </Card>
      )}

      {/* Relationships */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Relationships</CardTitle>
          {isOwner && (
            <Button size="sm" onClick={() => { setLinkOpen(true); setLinkPersonId(""); }}>
              Link person
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasRelationships && (
            <p className="text-sm text-muted-foreground">
              No relationships yet. Use &quot;Link person&quot; to connect relatives.
            </p>
          )}

          {parents.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Parents
              </p>
              <div className="space-y-1">
                {parents.map((r) => (
                  <div key={r._id} className="flex items-center justify-between">
                    <PersonLink id={r.person1Id} />
                    {isOwner && (
                      <button
                        className="text-[11px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded border border-gray-200 hover:border-red-300 transition-colors"
                        onClick={() => handleUnlink(r._id)}
                      >
                        unlink
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {siblingIds.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Siblings
              </p>
              <div className="space-y-1">
                {siblingIds.map((sibId) => (
                  <div key={sibId} className="flex items-center justify-between">
                    <PersonLink id={sibId} />
                    {isOwner && (
                      <button
                        className="text-[11px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded border border-gray-200 hover:border-red-300 transition-colors"
                        onClick={() => handleUnlinkSibling(sibId)}
                      >
                        unlink
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isOwner && hiddenSiblings.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1.5">
                Hidden siblings
              </p>
              <div className="space-y-1">
                {hiddenSiblings.map(({ siblingId, hideId }) => (
                  <div key={hideId} className="flex items-center justify-between opacity-60">
                    <PersonLink id={siblingId} />
                    <button
                      className="text-[11px] text-gray-400 hover:text-amber-600 px-1.5 py-0.5 rounded border border-gray-200 hover:border-amber-300 transition-colors"
                      onClick={() => handleRelinkSibling(hideId)}
                    >
                      relink
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {spouses.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Spouses
              </p>
              <div className="space-y-1.5">
                {spouses.map((r) => {
                  const spouseId = r.person1Id === personId ? r.person2Id : r.person1Id;
                  const isDivorced = !!r.endDate;
                  return (
                    <div key={r._id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <PersonLink id={spouseId} />
                        {isDivorced && (
                          <span className="text-[10px] text-red-500 border border-red-200 rounded px-1 shrink-0">
                            div.{r.endDate ? ` ${r.endDate}` : ""}
                          </span>
                        )}
                      </div>
                      {isOwner && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            className="text-[11px] text-gray-400 hover:text-amber-600 px-1.5 py-0.5 rounded border border-gray-200 hover:border-amber-300 transition-colors"
                            onClick={() => {
                              setDivorceRelId(r._id);
                              setDivorceDate(r.endDate ?? "");
                            }}
                          >
                            {isDivorced ? "edit divorce" : "÷ divorce"}
                          </button>
                          <button
                            className="text-[11px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded border border-gray-200 hover:border-red-300 transition-colors"
                            onClick={() => handleUnlink(r._id)}
                          >
                            unlink
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {children.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                Children
              </p>
              <div className="space-y-1">
                {children.map((r) => (
                  <div key={r._id} className="flex items-center justify-between">
                    <PersonLink id={r.person2Id} />
                    {isOwner && (
                      <button
                        className="text-[11px] text-gray-400 hover:text-red-500 px-1.5 py-0.5 rounded border border-gray-200 hover:border-red-300 transition-colors"
                        onClick={() => handleUnlink(r._id)}
                      >
                        unlink
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Life Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{tp("lifeEvents")}</CardTitle>
          {isOwner && <Button size="sm" onClick={() => setAddEventOpen(true)}>{tp("addEvent")}</Button>}
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tp("noEvents")}</p>
          ) : (
            <ol className="relative border-l border-gray-200 space-y-4 ml-3">
              {events.map((ev) => (
                <li key={ev._id} className="ml-4">
                  <span className="absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-white border border-gray-200 text-xs">
                    {EVENT_ICONS[ev.type] ?? "📌"}
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="capitalize font-medium text-sm">{ev.type}</span>
                    {ev.date && <span className="text-xs text-muted-foreground">{ev.date}</span>}
                    {ev.place && <span className="text-xs text-muted-foreground">· {ev.place}</span>}
                  </div>
                  {ev.description && (
                    <p className="text-sm text-gray-600 mt-0.5">{ev.description}</p>
                  )}
                  {ev.documentUrls?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {ev.documentUrls.map((url, i) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-amber-600 hover:underline"
                        >
                          📎 Document {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {/* Add Event Dialog */}
      <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{te("add")}</DialogTitle></DialogHeader>
          <EventForm
            personId={personId}
            onSuccess={async () => {
              await mutateEvents();
              setAddEventOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Link Person Dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Link existing person</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Role</label>
              <select
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={linkRole}
                onChange={(e) => setLinkRole(e.target.value as LinkRole)}
              >
                {LINK_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Person</label>
              <select
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                value={linkPersonId}
                onChange={(e) => setLinkPersonId(e.target.value)}
              >
                <option value="">Select a person…</option>
                {availablePersons.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={handleLink} disabled={!linkPersonId}>
              Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Divorce Dialog */}
      <Dialog open={!!divorceRelId} onOpenChange={(open) => !open && setDivorceRelId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark divorced</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Divorce date (optional)</label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                placeholder="e.g. 1985 or 12 Mar 1985"
                value={divorceDate}
                onChange={(e) => setDivorceDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDivorce}>Save</Button>
              {divorceDate !== "" && (
                <Button
                  onClick={() => {
                    setDivorceDate("");
                    handleDivorce();
                  }}
                >
                  Clear divorce
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
