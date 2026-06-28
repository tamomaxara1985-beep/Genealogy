import type { IPerson } from "@/types";

/**
 * Root / home person of a tree = earliest-created person.
 * Returns null for an empty list.
 */
export function getRootPersonId(persons: IPerson[]): string | null {
  if (persons.length === 0) return null;
  let root = persons[0];
  for (const p of persons) {
    if (new Date(p.createdAt).getTime() < new Date(root.createdAt).getTime()) {
      root = p;
    }
  }
  return root._id;
}
