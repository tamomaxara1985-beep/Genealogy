import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/adminAuth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Relationship from "@/lib/models/Relationship"
import Event from "@/lib/models/Event"

type Params = { params: Promise<{ userId: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { userId } = await params
  const { role } = await req.json()

  if (!["user", "admin"].includes(role))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })

  if (userId === session.user.id && role === "user")
    return NextResponse.json({ error: "Cannot demote yourself" }, { status: 400 })

  await connectDB()
  const user = await User.findByIdAndUpdate(
    userId,
    { role },
    { new: true, projection: { password: 0 } }
  )
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(user)
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { userId } = await params

  if (userId === session.user.id)
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 })

  await connectDB()

  const trees = await Tree.find({ ownerId: userId }, "_id").lean()
  const treeIds = trees.map((t) => t._id)

  if (treeIds.length > 0) {
    const persons = await Person.find({ treeId: { $in: treeIds } }, "_id").lean()
    const personIds = persons.map((p) => p._id)
    if (personIds.length > 0) {
      await Event.deleteMany({ personId: { $in: personIds } })
    }
    await Relationship.deleteMany({ treeId: { $in: treeIds } })
    await Person.deleteMany({ treeId: { $in: treeIds } })
    await Tree.deleteMany({ ownerId: userId })
  }

  await User.findByIdAndDelete(userId)
  return new NextResponse(null, { status: 204 })
}
