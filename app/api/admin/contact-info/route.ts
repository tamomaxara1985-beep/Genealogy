import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import ContactInfo from "@/lib/models/ContactInfo";
import { validateContactInfo } from "@/lib/contact";

const BLANK = { orgName: "", address: "", mapQuery: "", phone: "", email: "", hours: [], socials: [] };

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const info = await ContactInfo.findOne().lean();
  return NextResponse.json(info ?? BLANK);
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const result = validateContactInfo(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await connectDB();
  const info = await ContactInfo.findOneAndUpdate(
    {},
    { $set: result.value },
    { upsert: true, new: true }
  ).lean();
  return NextResponse.json(info);
}
