import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import AccessRequest from "@/lib/models/AccessRequest";
import { resolveTreeAccess } from "@/lib/treeAccess";
import { resolveAction } from "@/lib/accessRequest";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action = typeof body.action === "string" ? body.action : "";

  await connectDB();
  const request = await AccessRequest.findById(id);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Owner-only guard.
  const { role } = await resolveTreeAccess(request.treeId.toString(), session);
  if (role !== "owner") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const resolved = resolveAction(action, request.status);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
  const { nextStatus, grant, revoke } = resolved.value;

  if (grant)
    await Tree.updateOne({ _id: request.treeId }, { $addToSet: { sharedEmails: request.requesterEmail } });
  if (revoke)
    await Tree.updateOne({ _id: request.treeId }, { $pull: { sharedEmails: request.requesterEmail } });

  request.status = nextStatus;
  request.decidedAt = new Date();
  await request.save();

  return NextResponse.json({ status: nextStatus });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await connectDB();
  const request = await AccessRequest.findById(id);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Either party (the requester or the tree owner) may remove the record.
  const isRequester = request.requesterId.toString() === session.user.id;
  const { role } = await resolveTreeAccess(request.treeId.toString(), session);
  if (!isRequester && role !== "owner")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only terminal, non-granting requests are deletable. Approved requests still
  // hold an entry in Tree.sharedEmails — revoke first so access is actually removed.
  if (request.status !== "denied" && request.status !== "revoked")
    return NextResponse.json(
      { error: "Only denied or revoked requests can be deleted" },
      { status: 400 }
    );

  await request.deleteOne();
  return NextResponse.json({ ok: true });
}
