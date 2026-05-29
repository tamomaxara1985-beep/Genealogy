import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Person from "@/lib/models/Person";
import Tree from "@/lib/models/Tree";

type Params = { params: Promise<{ personId: string }> };

async function authorizePersonAccess(personId: string, userId: string) {
  const person = await Person.findById(personId);
  if (!person) return null;
  const tree = await Tree.findOne({ _id: person.treeId, ownerId: userId });
  if (!tree) return null;
  return person;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { personId } = await params;
  await connectDB();
  const person = await authorizePersonAccess(personId, session.user.id);
  if (!person)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(person);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { personId } = await params;
  await connectDB();
  const person = await authorizePersonAccess(personId, session.user.id);
  if (!person)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  Object.assign(person, body);
  await person.save();
  return NextResponse.json(person);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { personId } = await params;
  await connectDB();
  const person = await authorizePersonAccess(personId, session.user.id);
  if (!person)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await person.deleteOne();
  return NextResponse.json({ success: true });
}
