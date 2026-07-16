import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/apiAuth";
import { connectDB } from "@/lib/db";
import Tree from "@/lib/models/Tree";
import User from "@/lib/models/User";
import AccessRequest from "@/lib/models/AccessRequest";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const role = new URL(req.url).searchParams.get("role") === "outgoing" ? "outgoing" : "incoming";

  if (role === "outgoing") {
    const reqs = await AccessRequest.find({ requesterId: session.user.id }).sort({ updatedAt: -1 }).lean();
    const treeIds = [...new Set(reqs.map((r) => r.treeId.toString()))];
    const trees = await Tree.find({ _id: { $in: treeIds } }).lean();
    const treeById = new Map(trees.map((t) => [t._id.toString(), t]));
    const ownerIds = [...new Set(trees.map((t) => t.ownerId.toString()))];
    const owners = await User.find({ _id: { $in: ownerIds } }).select("name").lean();
    const ownerById = new Map(owners.map((u) => [u._id.toString(), u]));
    const requests = reqs.map((r) => {
      const t = treeById.get(r.treeId.toString());
      return {
        id: r._id.toString(),
        treeId: r.treeId.toString(),
        treeName: t?.name ?? "Unknown",
        counterpartyName: t ? ownerById.get(t.ownerId.toString())?.name ?? "Unknown" : "Unknown",
        status: r.status,
      };
    });
    return NextResponse.json({ requests });
  }

  // incoming: requests to trees I own
  const myTrees = await Tree.find({ ownerId: session.user.id }).select("name").lean();
  const myTreeIds = myTrees.map((t) => t._id.toString());
  const treeById = new Map(myTrees.map((t) => [t._id.toString(), t]));
  const reqs = await AccessRequest.find({ treeId: { $in: myTreeIds } }).sort({ updatedAt: -1 }).lean();
  const requesterIds = [...new Set(reqs.map((r) => r.requesterId.toString()))];
  const requesters = await User.find({ _id: { $in: requesterIds } }).select("name email").lean();
  const reqById = new Map(requesters.map((u) => [u._id.toString(), u]));
  const requests = reqs.map((r) => ({
    id: r._id.toString(),
    treeId: r.treeId.toString(),
    treeName: treeById.get(r.treeId.toString())?.name ?? "Unknown",
    counterpartyName: reqById.get(r.requesterId.toString())?.name ?? "Unknown",
    counterpartyEmail: reqById.get(r.requesterId.toString())?.email ?? r.requesterEmail,
    message: r.message,
    status: r.status,
  }));
  return NextResponse.json({ requests });
}
