import { getTranslations } from "next-intl/server"
import Link from "next/link"
import { Database, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Relationship from "@/lib/models/Relationship"
import Event from "@/lib/models/Event"

const COLLECTIONS = [
  { name: "users", Model: User },
  { name: "trees", Model: Tree },
  { name: "persons", Model: Person },
  { name: "relationships", Model: Relationship },
  { name: "events", Model: Event },
]

export default async function AdminCollectionsPage() {
  const [counts, t] = await Promise.all([
    (async () => {
      await connectDB()
      return Promise.all(
        COLLECTIONS.map(async ({ name, Model }) => ({
          name,
          count: await Model.countDocuments(),
        }))
      )
    })(),
    getTranslations("admin"),
  ])

  const collectionLabel: Record<string, string> = {
    users: t("colUsers"),
    trees: t("colTrees"),
    persons: t("colPersons"),
    relationships: t("colRelationships"),
    events: t("colEvents"),
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Database className="h-5 w-5 text-emerald-500" />
        <h1 className="text-xl font-bold">{t("collections")}</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {counts.map(({ name, count }) => (
          <Link key={name} href={`/admin/collections/${name}`}>
            <Card className="hover:border-emerald-400 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{collectionLabel[name] ?? name}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-2xl font-bold">{count.toLocaleString()}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
