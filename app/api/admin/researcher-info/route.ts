import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import ResearcherInfo from "@/lib/models/ResearcherInfo";
import { validateResearcher } from "@/lib/researcher";

const BLANK = { name: "", surname: "", email: "", phone: "", region: "" };

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const info = await ResearcherInfo.findOne().lean();
  return NextResponse.json(info ?? BLANK);
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const result = validateResearcher(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await connectDB();
  const info = await ResearcherInfo.findOneAndUpdate(
    {},
    { $set: result.value },
    { upsert: true, new: true }
  ).lean();
  return NextResponse.json(info);
}
