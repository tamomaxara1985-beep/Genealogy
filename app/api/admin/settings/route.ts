import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/adminAuth"
import { connectDB } from "@/lib/db"
import SiteSettings from "@/lib/models/SiteSettings"
import { revalidateTag } from "next/cache"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const settings = await SiteSettings.findOne().lean()
  return NextResponse.json(
    settings ?? {
      primaryColor: "oklch(0.205 0 0)",
      fontFamily: "Inter",
      fontSize: "md",
      borderRadius: 0.625,
    }
  )
}

export async function PUT(request: Request) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const allowed = ["primaryColor", "fontFamily", "fontSize", "borderRadius"]
  const update = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  )

  await connectDB()
  const settings = await SiteSettings.findOneAndUpdate(
    {},
    { $set: update },
    { upsert: true, new: true }
  ).lean()

  revalidateTag("site-settings")
  return NextResponse.json(settings)
}
