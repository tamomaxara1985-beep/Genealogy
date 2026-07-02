import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import Researcher from "@/lib/models/Researcher";
import { validateResearcher } from "@/lib/researcher";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const list = await Researcher.find().sort({ createdAt: 1 }).lean();
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const result = validateResearcher(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await connectDB();
  const doc = await Researcher.create(result.value);
  return NextResponse.json(doc, { status: 201 });
}
