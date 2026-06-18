import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/adminAuth"
import { connectDB } from "@/lib/db"
import SiteContent from "@/lib/models/SiteContent"

export async function GET(request: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") ?? "en"

  await connectDB()
  const docs = await SiteContent.find({ locale }).lean()
  return NextResponse.json(docs)
}

export async function PUT(request: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { locale, key, value } = await request.json()
  if (!locale || !key || value === undefined) {
    return NextResponse.json({ error: "locale, key, value required" }, { status: 400 })
  }

  await connectDB()
  const doc = await SiteContent.findOneAndUpdate(
    { locale, key },
    { $set: { value } },
    { upsert: true, new: true }
  ).lean()
  return NextResponse.json(doc)
}
