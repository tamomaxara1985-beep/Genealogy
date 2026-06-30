import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import Relationship from "@/lib/models/Relationship";
import { resolveTreeAccess } from "@/lib/treeAccess";
import { coParentPairForChild } from "@/lib/coParentCouple";
import type { IRelationship } from "@/types";

type Params = { params: Promise<{ treeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const { tree, role } = await resolveTreeAccess(treeId, session);
  if (!tree || !role)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const relationships = await Relationship.find({ treeId });
  return NextResponse.json(relationships);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  await connectDB();

  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const { type, person1Id, person2Id } = await req.json();
  if (!type || !person1Id || !person2Id)
    return NextResponse.json(
      { error: "type, person1Id, person2Id required" },
      { status: 400 }
    );

  const rel = await Relationship.create({ treeId, type, person1Id, person2Id });

  if (type === "parent-child") {
    const docs = await Relationship.find({ treeId }).lean();
    const rels = docs.map((d) => ({
      _id: String(d._id),
      treeId: String(d.treeId),
      type: d.type,
      person1Id: String(d.person1Id),
      person2Id: String(d.person2Id),
      endDate: d.endDate,
    })) as IRelationship[];
    const pair = coParentPairForChild(String(person2Id), rels);
    if (pair) {
      await Relationship.create({
        treeId,
        type: "spouse",
        person1Id: pair[0],
        person2Id: pair[1],
      });
    }
  }

  return NextResponse.json(rel, { status: 201 });
}
