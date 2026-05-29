import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import Person from "@/lib/models/Person";

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

  const persons = await Person.find({ treeId }).sort({ lastName: 1 });
  return NextResponse.json(persons);
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

  const body = await req.json();
  if (!body.firstName || !body.lastName)
    return NextResponse.json(
      { error: "firstName and lastName are required" },
      { status: 400 }
    );

  const person = await Person.create({ ...body, treeId });
  return NextResponse.json(person, { status: 201 });
}
