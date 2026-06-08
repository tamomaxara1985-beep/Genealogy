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
  const [activeSurname, setActiveSurname] = useState<string | null>(null);

  function handleSearch(q: string) {
    setQuery(q);
    setActiveSurname(null);
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

  function handleSurnameClick(surname: string) {
    if (activeSurname === surname) {
      setActiveSurname(null);
      onHighlight(new Set());
    } else {
      setActiveSurname(surname);
      setQuery("");
      const ids = new Set(
        persons
          .filter((p) => p.lastName === surname || p.maidenName === surname)
          .map((p) => p._id)
      );
      onHighlight(ids);
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

      {/* Surname filter row */}
      {surnames.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">Surnames:</span>
          {surnames.map((s) => (
            <button
              key={s}
              onClick={() => handleSurnameClick(s)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                activeSurname === s
                  ? "bg-amber-100 border-amber-400 text-amber-800 font-medium"
                  : "bg-white border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700"
              }`}
            >
              {s}
            </button>
          ))}
          {activeSurname && (
            <button
              onClick={() => { setActiveSurname(null); onHighlight(new Set()); }}
              className="text-xs text-muted-foreground hover:text-gray-800 ml-1 cursor-pointer"
            >
              × clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
