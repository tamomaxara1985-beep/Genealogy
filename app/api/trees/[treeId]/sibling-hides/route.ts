import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import SiblingHide from "@/lib/models/SiblingHide";
import { resolveTreeAccess } from "@/lib/treeAccess";
import { normalizePair } from "@/lib/deriveSiblings";

type Params = { params: Promise<{ treeId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const { tree, role } = await resolveTreeAccess(treeId, session);
  if (!tree || !role)
    return NextResponse.json({ error: "Tree not found" }, { status: 404 });

  const hides = await SiblingHide.find({ treeId });
  return NextResponse.json(hides);
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

  const { personAId, personBId } = await req.json();
  if (!personAId || !personBId)
    return NextResponse.json(
      { error: "personAId, personBId required" },
      { status: 400 }
    );

  const [a, b] = normalizePair(personAId, personBId);
  const hide = await SiblingHide.findOneAndUpdate(
    { treeId, personAId: a, personBId: b },
    { $setOnInsert: { treeId, personAId: a, personBId: b } },
    { new: true, upsert: true }
  );
  return NextResponse.json(hide, { status: 201 });
}
