import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { validateResearcher } from "@/lib/researcher";

type Params = { params: Promise<{ userId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  const body = await req.json();
  const today = new Date().toISOString().slice(0, 10);
  const result = validateResearcher(body, today);
  if (!result.ok)
    return NextResponse.json({ error: result.error }, { status: 400 });

  await connectDB();
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { researcher: result.value } },
    { new: true, projection: { password: 0 } }
  );
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId } = await params;
  await connectDB();
  const user = await User.findByIdAndUpdate(
    userId,
    { $unset: { researcher: 1 } },
    { new: true, projection: { password: 0 } }
  );
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}
