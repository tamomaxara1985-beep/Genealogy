import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";

type Params = { params: Promise<{ treeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  await connectDB();
  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tree);
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
  const tree = await Tree.findOneAndDelete({
    _id: treeId,
    ownerId: session.user.id,
  });
  if (!tree)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
