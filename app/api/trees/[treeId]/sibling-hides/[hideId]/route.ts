import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import SiblingHide from "@/lib/models/SiblingHide";

type Params = { params: Promise<{ treeId: string; hideId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId, hideId } = await params;
  await connectDB();

  const tree = await Tree.findOne({ _id: treeId, ownerId: session.user.id });
  if (!tree)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const hide = await SiblingHide.findOneAndDelete({ _id: hideId, treeId });
  if (!hide)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
