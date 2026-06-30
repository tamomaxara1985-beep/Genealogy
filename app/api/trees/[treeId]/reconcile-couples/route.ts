import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import Relationship from "@/lib/models/Relationship";
import { coParentPairsNeedingSpouse } from "@/lib/coParentCouple";
import type { IRelationship } from "@/types";

type Params = { params: Promise<{ treeId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  await connectDB();

  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (tree.coParentBackfillAt)
    return NextResponse.json({ created: 0, alreadyDone: true });

  const docs = await Relationship.find({ treeId }).lean();
  const rels = docs.map((d) => ({
    _id: String(d._id),
    treeId: String(d.treeId),
    type: d.type,
    person1Id: String(d.person1Id),
    person2Id: String(d.person2Id),
    endDate: d.endDate,
  })) as IRelationship[];

  const pairs = coParentPairsNeedingSpouse(rels);
  if (pairs.length > 0) {
    await Relationship.insertMany(
      pairs.map(([person1Id, person2Id]) => ({
        treeId,
        type: "spouse",
        person1Id,
        person2Id,
      }))
    );
  }

  tree.coParentBackfillAt = new Date();
  await tree.save();

  return NextResponse.json({ created: pairs.length });
}
