// app/api/admin/stats/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Event from "@/lib/models/Event"
import Relationship from "@/lib/models/Relationship"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [userCount, treeCount, personCount, eventCount] = await Promise.all([
    User.countDocuments(),
    Tree.countDocuments(),
    Person.countDocuments(),
    Event.countDocuments(),
  ])

  const registrations = await User.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", count: 1, _id: 0 } },
  ])

  const personsOverTime = await Person.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", count: 1, _id: 0 } },
  ])

  const relationshipTypes = await Relationship.aggregate([
    { $group: { _id: "$type", count: { $sum: 1 } } },
    { $project: { type: "$_id", count: 1, _id: 0 } },
  ])

  const treesPerUser = await Tree.aggregate([
    { $group: { _id: "$ownerId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        name: { $ifNull: ["$user.name", "Unknown"] },
        count: 1,
        _id: 0,
      },
    },
  ])

  return NextResponse.json({
    counts: { users: userCount, trees: treeCount, persons: personCount, events: eventCount },
    registrations,
    personsOverTime,
    relationshipTypes,
    treesPerUser,
  })
}
