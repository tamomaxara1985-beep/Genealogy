import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Person from "@/lib/models/Person";
import Tree from "@/lib/models/Tree";
import Event from "@/lib/models/Event";

type Params = { params: Promise<{ personId: string }> };

async function authorize(personId: string, userId: string) {
  const person = await Person.findById(personId);
  if (!person) return null;
  const tree = await Tree.findOne({ _id: person.treeId, ownerId: userId });
  return tree ? person : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { personId } = await params;
  await connectDB();
  if (!(await authorize(personId, session.user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const events = await Event.find({ personId }).sort({ date: 1 });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { personId } = await params;
  await connectDB();
  if (!(await authorize(personId, session.user.id)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  if (!body.type)
    return NextResponse.json({ error: "type required" }, { status: 400 });

  const event = await Event.create({ ...body, personId });
  return NextResponse.json(event, { status: 201 });
}
