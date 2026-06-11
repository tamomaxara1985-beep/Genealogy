import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import { PLAN_LIMITS } from "@/lib/plans";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const trees = await Tree.find({ ownerId: session.user.id }).sort({
    updatedAt: -1,
  });
  return NextResponse.json(trees);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, isPublic } = await req.json();
  if (!name)
    return NextResponse.json({ error: "Name is required" }, { status: 400 });

  await connectDB();

  const plan = session.user.plan ?? "free";
  const limit = PLAN_LIMITS[plan].maxTrees;
  const count = await Tree.countDocuments({ ownerId: session.user.id });
  if (count >= limit) {
    return NextResponse.json(
      { error: "Tree limit reached for your plan", upgradeRequired: true },
      { status: 403 }
    );
  }

  const tree = await Tree.create({
    name,
    description,
    isPublic: isPublic ?? false,
    ownerId: session.user.id,
  });
  return NextResponse.json(tree, { status: 201 });
}
