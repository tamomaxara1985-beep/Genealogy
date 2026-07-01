import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import ContactMessage from "@/lib/models/ContactMessage";
import { validateContactMessage } from "@/lib/contact";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Honeypot: bots fill the hidden "company" field. Silently accept, don't store.
  if (typeof body?.company === "string" && body.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const result = validateContactMessage(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await connectDB();
  await ContactMessage.create(result.value);
  return NextResponse.json({ ok: true });
}
