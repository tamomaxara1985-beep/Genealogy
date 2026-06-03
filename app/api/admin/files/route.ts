import { NextRequest, NextResponse } from "next/server"
import { getAdminSession } from "@/lib/adminAuth"

function basicAuth() {
  const key = process.env.CLOUDINARY_API_KEY!
  const secret = process.env.CLOUDINARY_API_SECRET!
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64")
}

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME
const BASE = `https://api.cloudinary.com/v1_1/${CLOUD}`

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const auth = basicAuth()

  const [imagesRes, rawRes] = await Promise.all([
    fetch(
      `${BASE}/resources/image?prefix=genealogy/photos&type=upload&max_results=500`,
      { headers: { Authorization: auth } }
    ),
    fetch(
      `${BASE}/resources/raw?prefix=genealogy/documents&type=upload&max_results=500`,
      { headers: { Authorization: auth } }
    ),
  ])

  const [images, raw] = await Promise.all([imagesRes.json(), rawRes.json()])
  const resources = [
    ...(images.resources ?? []),
    ...(raw.resources ?? []),
  ]

  return NextResponse.json(resources)
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { publicId, resourceType } = await req.json()
  if (!publicId || !resourceType)
    return NextResponse.json(
      { error: "publicId and resourceType required" },
      { status: 400 }
    )

  const auth = basicAuth()
  const res = await fetch(
    `${BASE}/resources/${resourceType}/upload?public_ids[]=${encodeURIComponent(publicId)}`,
    { method: "DELETE", headers: { Authorization: auth } }
  )

  if (!res.ok)
    return NextResponse.json({ error: "Cloudinary delete failed" }, { status: 500 })

  return NextResponse.json({ deleted: publicId })
}
