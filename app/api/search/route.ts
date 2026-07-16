import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/apiAuth";
import { connectDB } from "@/lib/db";
import Person from "@/lib/models/Person";
import Tree from "@/lib/models/Tree";
import User from "@/lib/models/User";
import AccessRequest from "@/lib/models/AccessRequest";
import { validateSearchParams, escapeRegex, computeAccess } from "@/lib/search";

const LIMIT = 50;

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = validateSearchParams({
    firstName: searchParams.get("firstName"),
    lastName: searchParams.get("lastName"),
    location: searchParams.get("location"),
  });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { firstName, lastName, location } = parsed.value;

  await connectDB();
  const rx = (s: string) => new RegExp(escapeRegex(s), "i");
  // AND across provided fields; location matches either birth or death place.
  const and: Record<string, unknown>[] = [];
  if (firstName) and.push({ firstName: rx(firstName) });
  if (lastName) and.push({ lastName: rx(lastName) });
  if (location) and.push({ $or: [{ birthPlace: rx(location) }, { deathPlace: rx(location) }] });
  const personFilter = and.length === 1 ? and[0] : { $and: and };

  const persons = await Person.find(personFilter).limit(LIMIT + 1).lean();
  const truncated = persons.length > LIMIT;
  const page = persons.slice(0, LIMIT);

  const treeIds = [...new Set(page.map((p) => p.treeId.toString()))];
  const trees = await Tree.find({ _id: { $in: treeIds } }).lean();
  const treeById = new Map(trees.map((t) => [t._id.toString(), t]));

  const ownerIds = [...new Set(trees.map((t) => t.ownerId.toString()))];
  const owners = await User.find({ _id: { $in: ownerIds } }).select("name").lean();
  const ownerById = new Map(owners.map((u) => [u._id.toString(), u]));

  const myRequests = await AccessRequest.find({
    requesterId: session.user.id,
    treeId: { $in: treeIds },
  }).lean();
  const statusByTree = new Map(myRequests.map((r) => [r.treeId.toString(), r.status]));

  const viewer = { userId: session.user.id, email: session.user.email ?? null };

  const results = page
    .map((p) => {
      const tree = treeById.get(p.treeId.toString());
      if (!tree) return null;
      const owner = ownerById.get(tree.ownerId.toString());
      const access = computeAccess(
        { ownerId: tree.ownerId.toString(), sharedEmails: tree.sharedEmails ?? [] },
        viewer,
        statusByTree.get(tree._id.toString()) ?? null
      );
      return {
        personId: p._id.toString(),
        personName: [p.firstName, p.lastName].filter(Boolean).join(" "),
        place: p.birthPlace || p.deathPlace || "",
        treeId: tree._id.toString(),
        treeName: tree.name,
        ownerName: owner?.name ?? "Unknown",
        access,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ results, truncated });
}
