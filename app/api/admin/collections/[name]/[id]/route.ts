// app/api/admin/collections/[name]/[id]/route.ts
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name, id } = await params
  const CollectionModel = getModel(name)
  if (!CollectionModel) return NextResponse.json({ error: "Collection not found" }, { status: 404 })

  const body = await request.json()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, __v, createdAt, updatedAt, ...update } = body

  await connectDB()
  const doc = await CollectionModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean()
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(doc)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ name: string; id: string }> }
) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { name, id } = await params
  const CollectionModel = getModel(name)
  if (!CollectionModel) return NextResponse.json({ error: "Collection not found" }, { status: 404 })

  await connectDB()
  const doc = await CollectionModel.findByIdAndDelete(id).lean()
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ ok: true })
}
