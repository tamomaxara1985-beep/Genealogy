import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import User from "@/lib/models/User";
import { sendOwnerMessageEmail } from "@/lib/mail";

type Params = { params: Promise<{ treeId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const body = await req.json();
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!subject || !message)
    return NextResponse.json({ error: "Subject and message are required" }, { status: 400 });
  if (subject.length > 200 || message.length > 5000)
    return NextResponse.json({ error: "Field too long" }, { status: 400 });

  await connectDB();
  const tree = await Tree.findById(treeId);
  if (!tree) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const owner = await User.findById(tree.ownerId).select("email");
  if (!owner?.email)
    return NextResponse.json({ error: "Owner has no email" }, { status: 400 });
  if (owner.email.toLowerCase() === session.user.email?.toLowerCase())
    return NextResponse.json({ error: "You own this tree" }, { status: 400 });

  await sendOwnerMessageEmail(
    owner.email,
    session.user.email ?? "",
    session.user.name ?? "A FamilyRoots user",
    subject,
    message
  );
  return NextResponse.json({ ok: true });
}
