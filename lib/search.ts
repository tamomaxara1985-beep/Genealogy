import type { AccessStatus } from "@/lib/accessRequest";

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type SearchParams = { firstName: string; lastName: string; location: string };

type ParamsResult =
  | { ok: true; value: SearchParams }
  | { ok: false; error: string };

// Validate the three optional search fields. Each is trimmed; any subset may be
// provided, but at least one must be non-empty and the combined input must be at
// least 2 characters (guards against matching the entire collection).
export function validateSearchParams(input: unknown): ParamsResult {
  const o = (input ?? {}) as Record<string, unknown>;
  const firstName = typeof o.firstName === "string" ? o.firstName.trim() : "";
  const lastName = typeof o.lastName === "string" ? o.lastName.trim() : "";
  const location = typeof o.location === "string" ? o.location.trim() : "";

  if (firstName.length > 100 || lastName.length > 100 || location.length > 100)
    return { ok: false, error: "search term too long" };

  const provided = [firstName, lastName, location].filter(Boolean);
  if (provided.length === 0)
    return { ok: false, error: "at least one field is required" };
  if (provided.join("").length < 2)
    return { ok: false, error: "search term too short" };

  return { ok: true, value: { firstName, lastName, location } };
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
