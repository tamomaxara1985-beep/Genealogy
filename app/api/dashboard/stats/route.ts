import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Event from "@/lib/models/Event"
import User from "@/lib/models/User"
import mongoose from "mongoose"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await connectDB()
  const userId = new mongoose.Types.ObjectId(session.user.id)

  const [trees, user] = await Promise.all([
    Tree.find({ ownerId: userId }).sort({ updatedAt: -1 }).lean(),
    User.findById(userId).select("bio name researcher").lean(),
  ])
  const treeIds = trees.map((t) => t._id)

  const [personCount, eventCount] = await Promise.all([
    Person.countDocuments({ treeId: { $in: treeIds } }),
    Event.countDocuments({
      personId: {
        $in: await Person.distinct("_id", { treeId: { $in: treeIds } }),
      },
    }),
  ])

  return NextResponse.json({
    treeCount: trees.length,
    personCount,
    eventCount,
    bio: user?.bio ?? "",
    researcher: user?.researcher ?? null,
  })
}
