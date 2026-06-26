import { NextRequest, NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import Tree from "@/lib/models/Tree";
import { resolveTreeAccess } from "@/lib/treeAccess";

type Params = { params: Promise<{ treeId: string }> };

function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

async function requireOwner(treeId: string, session: Session | null) {
  const { tree, role } = await resolveTreeAccess(treeId, session);
  return role === "owner" ? tree : null;
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const tree = await requireOwner(treeId, session);
  if (!tree)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const email = normalizeEmail(body.email);
  if (!email)
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  if (email === session.user.email?.toLowerCase())
    return NextResponse.json({ error: "You cannot share a tree with yourself" }, { status: 400 });

  await Tree.updateOne({ _id: treeId }, { $addToSet: { sharedEmails: email } });
  const updated = await Tree.findById(treeId);
  return NextResponse.json({ sharedEmails: updated?.sharedEmails ?? [] });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const tree = await requireOwner(treeId, session);
  if (!tree)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const email = normalizeEmail(body.email);
  if (!email)
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  await Tree.updateOne({ _id: treeId }, { $pull: { sharedEmails: email } });
  const updated = await Tree.findById(treeId);
  return NextResponse.json({ sharedEmails: updated?.sharedEmails ?? [] });
}
