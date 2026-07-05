import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Person from "@/lib/models/Person";
import Tree from "@/lib/models/Tree";
import User from "@/lib/models/User";
import AccessRequest from "@/lib/models/AccessRequest";
import { validateSearchQuery, escapeRegex, computeAccess } from "@/lib/search";

const LIMIT = 50;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parsed = validateSearchQuery(searchParams.get("q"), searchParams.get("field"));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { term, field } = parsed.value;

  await connectDB();
  const rx = new RegExp(escapeRegex(term), "i");
  const personFilter =
    field === "name"
      ? { $or: [{ firstName: rx }, { lastName: rx }] }
      : { $or: [{ birthPlace: rx }, { deathPlace: rx }] };

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
