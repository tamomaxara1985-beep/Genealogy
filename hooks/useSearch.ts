import type { ISearchResult } from "@/types";
import type { SearchParams } from "@/lib/search";

export async function runSearch(
  params: SearchParams
): Promise<{ results: ISearchResult[]; truncated: boolean }> {
  const qs = new URLSearchParams();
  if (params.firstName) qs.set("firstName", params.firstName);
  if (params.lastName) qs.set("lastName", params.lastName);
  if (params.location) qs.set("location", params.location);
  const res = await fetch(`/api/search?${qs.toString()}`);
  if (!res.ok) return { results: [], truncated: false };
  return res.json();
}
