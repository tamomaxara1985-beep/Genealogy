import { notFound } from "next/navigation"
import { Database, ChevronRight } from "lucide-react"
import { CollectionTable } from "@/components/admin/CollectionTable"
import Link from "next/link"

const ALLOWED = ["users", "trees", "persons", "relationships", "events"]

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collection: string }>
}) {
  const { collection } = await params
  if (!ALLOWED.includes(collection)) notFound()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Database className="h-4 w-4" />
        <Link href="/admin/collections" className="hover:text-foreground">Collections</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium capitalize">{collection}</span>
      </div>
      <h1 className="text-xl font-bold capitalize">{collection}</h1>
      <CollectionTable collection={collection} />
    </div>
  )
}
