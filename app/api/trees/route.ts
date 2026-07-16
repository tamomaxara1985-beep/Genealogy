import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/apiAuth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const owned = await Tree.find({ ownerId: session.user.id })
    .select("-sharedEmails")
    .sort({
      updatedAt: -1,
    });

  const email = session.user.email?.toLowerCase();
  const shared = email
    ? await Tree.find({
        sharedEmails: email,
        ownerId: { $ne: session.user.id },
      })
        .select("-sharedEmails")
        .sort({ updatedAt: -1 })
    : [];

  return NextResponse.json({ owned, shared });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, isPublic } = await req.json();
  if (!name)
    return NextResponse.json({ error: "Name is required" }, { status: 400 });

  await connectDB();

  const tree = await Tree.create({
    name,
    description,
    isPublic: isPublic ?? false,
    ownerId: session.user.id,
  });
  return NextResponse.json(tree, { status: 201 });
}
