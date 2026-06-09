"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { IPerson } from "@/types";

interface Props {
  persons: IPerson[];
  onHighlight: (ids: Set<string>) => void;
  onSurnameFilter: (surname: string | null) => void;
}

export function TreeToolbar({ persons, onHighlight, onSurnameFilter }: Props) {
  const [query, setQuery] = useState("");
  const [activeSurname, setActiveSurname] = useState<string | null>(null);

  function handleSearch(q: string) {
    setQuery(q);
    setActiveSurname(null);
    onSurnameFilter(null);
    if (!q.trim()) { onHighlight(new Set()); return; }
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

  function handleSurnameChange(value: string | null) {
    if (!value || value === "__all__") {
      setActiveSurname(null);
      onSurnameFilter(null);
      onHighlight(new Set());
    } else {
      setActiveSurname(value);
      setQuery("");
      onHighlight(new Set());
      onSurnameFilter(value);
    }
  }

  // Unique surnames (lastName + maidenName) sorted alphabetically
  const surnames = [
    ...new Set(
      persons.flatMap((p) =>
        [p.lastName, p.maidenName].filter((s): s is string => !!s)
      )
    ),
  ].sort();

  const living = persons.filter((p) => p.isLiving).length;
  const deceased = persons.length - living;

  return (
    <div className="flex flex-col gap-2">
      {/* Search row */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Search people…"
          className="w-52 h-8 text-sm"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {surnames.length > 0 && (
          <Select value={activeSurname ?? ""} onValueChange={handleSurnameChange}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder="Filter by surname…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All surnames</SelectItem>
              {surnames.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
    </div>
  );
}
