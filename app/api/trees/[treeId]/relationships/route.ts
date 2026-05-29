import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import Relationship from "@/lib/models/Relationship";

type Params = { params: Promise<{ treeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  await connectDB();

  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
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
  return NextResponse.json(rel, { status: 201 });
}
