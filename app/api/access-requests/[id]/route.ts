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
