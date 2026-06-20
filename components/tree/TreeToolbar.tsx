"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  collapsedCount: number;
  onExpandAll: () => void;
}

export function TreeToolbar({ persons, onHighlight, onSurnameFilter, collapsedCount, onExpandAll }: Props) {
  const t = useTranslations("tree");
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
          placeholder={t("searchPeople")}
          className="w-52 h-8 text-sm"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {surnames.length > 0 && (
          <Select value={activeSurname ?? ""} onValueChange={handleSurnameChange}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder={t("filterSurname")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("allSurnames")}</SelectItem>
              {surnames.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {collapsedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExpandAll}
            className="border-amber-400 text-amber-600 hover:bg-amber-50 hover:text-amber-700 whitespace-nowrap"
          >
            {t("expandAll")}
          </Button>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{persons.length} {t("people")}</Badge>
          <Badge variant="outline" className="text-green-600">
            {living} {t("treeLiving")}
          </Badge>
          {deceased > 0 && (
            <Badge variant="outline" className="text-gray-500">
              {deceased} {t("treeDeceased")}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
