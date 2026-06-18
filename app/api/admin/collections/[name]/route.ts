// app/api/admin/collections/[name]/route.ts
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getModel(name: string): Model<any> | null {
  return MODELS[name] ?? null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name } = await params
  const CollectionModel = getModel(name)
  if (!CollectionModel) return NextResponse.json({ error: "Collection not found" }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"))
  const q = searchParams.get("q") ?? ""

  await connectDB()

  const filter = q
    ? {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { email: { $regex: q, $options: "i" } },
          { firstName: { $regex: q, $options: "i" } },
          { lastName: { $regex: q, $options: "i" } },
        ],
      }
    : {}

  const [docs, total] = await Promise.all([
    CollectionModel.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CollectionModel.countDocuments(filter),
  ])

  return NextResponse.json({
    docs,
    total,
    page,
    pages: Math.ceil(total / limit),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name } = await params
  const CollectionModel = getModel(name)
  if (!CollectionModel) return NextResponse.json({ error: "Collection not found" }, { status: 404 })

  const body = await request.json()
  await connectDB()
  const doc = await CollectionModel.create(body)
  return NextResponse.json(doc, { status: 201 })
}
