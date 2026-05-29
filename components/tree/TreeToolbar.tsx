"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { IPerson } from "@/types";

interface Props {
  persons: IPerson[];
  onHighlight: (ids: Set<string>) => void;
}

export function TreeToolbar({ persons, onHighlight }: Props) {
  const [query, setQuery] = useState("");

  function handleSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      onHighlight(new Set());
      return;
    }
    const lower = q.toLowerCase();
    const matches = new Set(
      persons
        .filter(
          (p) =>
            p.firstName.toLowerCase().includes(lower) ||
            p.lastName.toLowerCase().includes(lower) ||
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(lower)
        )
        .map((p) => p._id)
    );
    onHighlight(matches);
  }

  const living = persons.filter((p) => p.isLiving).length;
  const deceased = persons.length - living;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Input
        placeholder="Search people…"
        className="w-52 h-8 text-sm"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
      />
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{persons.length} people</Badge>
        <Badge variant="outline" className="text-green-600">
          {living} living
        </Badge>
        {deceased > 0 && (
          <Badge variant="outline" className="text-gray-500">
            {deceased} deceased
          </Badge>
        )}
      </div>
    </div>
  );
}
