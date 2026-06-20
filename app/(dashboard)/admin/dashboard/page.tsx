// app/(dashboard)/admin/dashboard/page.tsx
import { getTranslations } from "next-intl/server"
import { Users, Trees, User, Calendar } from "lucide-react"
import { StatCard } from "@/components/admin/StatCard"
import { AdminCharts } from "@/components/admin/AdminCharts"
import { connectDB } from "@/lib/db"
import UserModel from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Event from "@/lib/models/Event"
import Relationship from "@/lib/models/Relationship"

async function getStats() {
  await connectDB()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [userCount, treeCount, personCount, eventCount] = await Promise.all([
    UserModel.countDocuments(),
    Tree.countDocuments(),
    Person.countDocuments(),
    Event.countDocuments(),
  ])

  const registrations = await UserModel.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { date: "$_id", count: 1, _id: 0 } },
  ])

  const personsOverTime = await Person.aggregate([
    { $match: { createdAt: { $gte: thirtyDaysAgo } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
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
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    { $project: { name: { $ifNull: ["$user.name", "Unknown"] }, count: 1, _id: 0 } },
  ])

  return {
    counts: { users: userCount, trees: treeCount, persons: personCount, events: eventCount },
    registrations,
    personsOverTime,
    relationshipTypes,
    treesPerUser,
  }
}

export default async function AdminDashboardPage() {
  const [stats, t] = await Promise.all([getStats(), getTranslations("admin")])

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">{t("dashboard")}</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t("totalUsers")} value={stats.counts.users} icon={Users} />
        <StatCard title={t("totalTrees")} value={stats.counts.trees} icon={Trees} />
        <StatCard title={t("totalPersons")} value={stats.counts.persons} icon={User} />
        <StatCard title={t("totalEvents")} value={stats.counts.events} icon={Calendar} />
      </div>
      <AdminCharts data={stats} />
    </div>
  )
}
