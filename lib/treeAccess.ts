import type { Session } from "next-auth";
import { connectDB } from "@/lib/db";
import Tree, { type ITreeDoc } from "@/lib/models/Tree";
import Person, { type IPersonDoc } from "@/lib/models/Person";

export type TreeRole = "owner" | "viewer" | null;

// Resolve the caller's access to a tree. Returns the tree doc and role, or
// { tree: null, role: null } if the tree does not exist or the caller has no access.
export async function resolveTreeAccess(
  treeId: string,
  session: Session | null
): Promise<{ tree: ITreeDoc | null; role: TreeRole }> {
  const userId = session?.user?.id;
  if (!userId) return { tree: null, role: null };

  await connectDB();
  const tree = await Tree.findById(treeId);
  if (!tree) return { tree: null, role: null };

  if (tree.ownerId.toString() === userId) return { tree, role: "owner" };

  const email = session.user?.email?.toLowerCase();
  if (email && tree.sharedEmails?.some((e: string) => e.toLowerCase() === email)) {
    return { tree, role: "viewer" };
  }

  return { tree: null, role: null };
}

// Resolve the caller's access to a person via that person's tree.
export async function resolvePersonAccess(
  personId: string,
  session: Session | null
): Promise<{ person: IPersonDoc | null; role: TreeRole }> {
  const userId = session?.user?.id;
  if (!userId) return { person: null, role: null };

  await connectDB();
  const person = await Person.findById(personId);
  if (!person) return { person: null, role: null };

  const { tree, role } = await resolveTreeAccess(person.treeId.toString(), session);
  if (!tree || !role) return { person: null, role: null };
  return { person, role };
}
