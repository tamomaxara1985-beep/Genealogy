import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import ContactMessage from "@/lib/models/ContactMessage";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body?.status !== "new" && body?.status !== "read")
    return NextResponse.json({ error: "invalid status" }, { status: 400 });

  await connectDB();
  const msg = await ContactMessage.findByIdAndUpdate(id, { $set: { status: body.status } }, { new: true }).lean();
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(msg);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await connectDB();
  const msg = await ContactMessage.findByIdAndDelete(id).lean();
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
