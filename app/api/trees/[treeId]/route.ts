import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import Person from "@/lib/models/Person";
import Relationship from "@/lib/models/Relationship";
import Event from "@/lib/models/Event";
import SiblingHide from "@/lib/models/SiblingHide";
import { resolveTreeAccess } from "@/lib/treeAccess";

type Params = { params: Promise<{ treeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const { tree, role } = await resolveTreeAccess(treeId, session);
  if (!tree || !role)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const obj = tree.toObject() as Record<string, unknown>;
  if (role !== "owner") delete obj.sharedEmails;
  return NextResponse.json({ ...obj, role });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const body = await req.json();
  await connectDB();
  const tree = await Tree.findOneAndUpdate(
    { _id: treeId, ownerId: session.user.id },
    { $set: body },
    { new: true }
  );
  if (!tree)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tree);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  await connectDB();

  // Ownership gate: a sharee or stranger gets 404, never deletes.
  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascade: Events reference personId (not treeId), so resolve person IDs first.
  const personIds = (await Person.find({ treeId }).select("_id")).map((p) => p._id);
  await Event.deleteMany({ personId: { $in: personIds } });
  await Person.deleteMany({ treeId });
  await Relationship.deleteMany({ treeId });
  await SiblingHide.deleteMany({ treeId });
  await Tree.deleteOne({ _id: treeId, ownerId: session.user.id });

  return NextResponse.json({ success: true });
}
