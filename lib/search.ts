import type { AccessStatus } from "@/lib/accessRequest";

export type SearchField = "name" | "place" | "all";

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type QueryResult =
  | { ok: true; value: { term: string; field: SearchField } }
  | { ok: false; error: string };

export function validateSearchQuery(q: unknown, field: unknown): QueryResult {
  const term = typeof q === "string" ? q.trim() : "";
  if (term.length < 2) return { ok: false, error: "search term too short" };
  if (term.length > 100) return { ok: false, error: "search term too long" };
  if (field != null && field !== "name" && field !== "place" && field !== "all") {
    return { ok: false, error: "invalid field" };
  }
  // Default: search across name and place together.
  const f: SearchField = field === "name" || field === "place" ? field : "all";
  return { ok: true, value: { term, field: f } };
}

export function computeAccess(
  tree: { ownerId: string; sharedEmails: string[] },
  viewer: { userId: string; email: string | null },
  requestStatus: AccessStatus | null
): "owner" | "viewer" | "pending" | "none" {
  if (tree.ownerId === viewer.userId) return "owner";
  const email = viewer.email?.toLowerCase();
  if (email && tree.sharedEmails.some((e) => e.toLowerCase() === email)) return "viewer";
  if (requestStatus === "pending") return "pending";
  return "none";
}
