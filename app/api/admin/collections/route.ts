// app/api/admin/collections/route.ts
import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/adminAuth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"
import Tree from "@/lib/models/Tree"
import Person from "@/lib/models/Person"
import Relationship from "@/lib/models/Relationship"
import Event from "@/lib/models/Event"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { Model } from "mongoose"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODELS: Record<string, Model<any>> = {
  users: User,
  trees: Tree,
  persons: Person,
  relationships: Relationship,
  events: Event,
}

export const ALLOWED_COLLECTIONS = Object.keys(MODELS)

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const counts = await Promise.all(
    ALLOWED_COLLECTIONS.map(async (name) => ({
      name,
      count: await MODELS[name].countDocuments(),
    }))
  )
  return NextResponse.json(counts)
}
