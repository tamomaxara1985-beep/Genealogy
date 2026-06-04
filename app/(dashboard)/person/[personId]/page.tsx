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
import type { IPerson, IEvent } from "@/types";
import { useTranslations } from "next-intl";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const EVENT_ICONS: Record<string, string> = {
  birth: "👶", death: "✝️", marriage: "💍", divorce: "📄",
  immigration: "🚢", other: "📌",
};

export default function PersonProfilePage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = use(params);
  const tp = useTranslations("person");
  const te = useTranslations("event");
  const tc = useTranslations("common");

  const { data: person } = useSWR<IPerson>(
    `/api/persons/${personId}`,
    fetcher
  );
  const { data: events = [], mutate: mutateEvents } = useSWR<IEvent[]>(
    `/api/persons/${personId}/events`,
    fetcher
  );

  const [addEventOpen, setAddEventOpen] = useState(false);

  if (!person) return <div className="p-8 text-muted-foreground">{tc("loading")}</div>;

  const initials = `${person.firstName[0] ?? "?"}${person.lastName[0] ?? ""}`;
  const gender = person.gender ?? "unknown";

  const genderColor: Record<string, string> = {
    male: "bg-blue-50 text-blue-700",
    female: "bg-pink-50 text-pink-700",
    other: "bg-purple-50 text-purple-700",
    unknown: "bg-gray-50 text-gray-600",
  };

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

      {/* Life Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{tp("lifeEvents")}</CardTitle>
          <Button size="sm" onClick={() => setAddEventOpen(true)}>{tp("addEvent")}</Button>
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
    </div>
  );
}
