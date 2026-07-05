import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import User from "@/lib/models/User";
import AccessRequest from "@/lib/models/AccessRequest";
import { resolveTreeAccess } from "@/lib/treeAccess";
import { validateAccessRequestInput } from "@/lib/accessRequest";
import { sendAccessRequestEmail } from "@/lib/mail";

type Params = { params: Promise<{ treeId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { treeId } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = validateAccessRequestInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  await connectDB();
  // No-op if caller already has access.
  const { tree, role } = await resolveTreeAccess(treeId, session);
  if (role === "owner") return NextResponse.json({ status: "owner" });
  if (role === "viewer") return NextResponse.json({ status: "viewer" });

  // resolveTreeAccess returns null tree when no access; fetch directly to confirm existence.
  const target = tree ?? (await Tree.findById(treeId));
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const email = (session.user.email ?? "").toLowerCase();
  const updated = await AccessRequest.findOneAndUpdate(
    { treeId, requesterId: session.user.id },
    { $set: { status: "pending", requesterEmail: email, message: parsed.value.message }, $unset: { decidedAt: "" } },
    { upsert: true, new: true }
  );

  const owner = await User.findById(target.ownerId).select("email");
  if (owner?.email) {
    await sendAccessRequestEmail(
      owner.email,
      session.user.name ?? "A FamilyRoots user",
      target.name,
      parsed.value.message
    );
  }
  return NextResponse.json({ status: updated.status });
}
