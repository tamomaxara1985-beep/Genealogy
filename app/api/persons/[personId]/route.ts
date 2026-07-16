import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/apiAuth";
import { connectDB } from "@/lib/db";
import Person from "@/lib/models/Person";
import Tree from "@/lib/models/Tree";
import Relationship from "@/lib/models/Relationship";
import Event from "@/lib/models/Event";
import { resolvePersonAccess } from "@/lib/treeAccess";

type Params = { params: Promise<{ personId: string }> };

async function authorizePersonAccess(personId: string, userId: string) {
  const person = await Person.findById(personId);
  if (!person) return null;
  const tree = await Tree.findOne({ _id: person.treeId, ownerId: userId });
  if (!tree) return null;
  return person;
}

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getSession(req);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { personId } = await params;
  const { person, role } = await resolvePersonAccess(personId, session);
  if (!person || !role)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(person);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getSession(req);
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

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getSession(req);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { personId } = await params;
  await connectDB();
  const person = await authorizePersonAccess(personId, session.user.id);
  if (!person)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await person.deleteOne();
  // Cascade: remove relationships and events that referenced this person so
  // no orphaned rels remain (which would otherwise show as ghost relatives).
  await Relationship.deleteMany({
    $or: [{ person1Id: personId }, { person2Id: personId }],
  });
  await Event.deleteMany({ personId });
  return NextResponse.json({ success: true });
}
