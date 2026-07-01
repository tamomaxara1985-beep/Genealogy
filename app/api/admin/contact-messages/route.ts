import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db";
import ContactMessage from "@/lib/models/ContactMessage";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const messages = await ContactMessage.find().sort({ createdAt: -1 }).lean();
  return NextResponse.json(messages);
}
