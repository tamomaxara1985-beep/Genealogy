import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import Relationship from "@/lib/models/Relationship";

type Params = { params: Promise<{ treeId: string; relId: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId, relId } = await params;
  await connectDB();

  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if ("startDate" in body) update.startDate = body.startDate ?? null;
  if ("endDate" in body) update.endDate = body.endDate ?? null;

  const rel = await Relationship.findOneAndUpdate(
    { _id: relId, treeId },
    { $set: update },
    { new: true }
  );
  if (!rel)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(rel);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId, relId } = await params;
  await connectDB();

  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const rel = await Relationship.findOneAndDelete({ _id: relId, treeId });
  if (!rel)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
