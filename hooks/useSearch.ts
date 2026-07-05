import type { ISearchResult } from "@/types";

export async function runSearch(
  term: string
): Promise<{ results: ISearchResult[]; truncated: boolean }> {
  const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
  if (!res.ok) return { results: [], truncated: false };
  return res.json();
}
