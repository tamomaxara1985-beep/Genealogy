import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { folder } = await req.json()
  if (!folder || typeof folder !== "string")
    return NextResponse.json({ error: "folder required" }, { status: 400 })

  const apiSecret = process.env.CLOUDINARY_API_SECRET
  const apiKey = process.env.CLOUDINARY_API_KEY
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME

  if (!apiSecret || !apiKey || !cloudName)
    return NextResponse.json({ error: "Cloudinary not configured" }, { status: 500 })

  const timestamp = Math.round(Date.now() / 1000)
  // Params must be sorted alphabetically before signing
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`
  const signature = crypto.createHash("sha1").update(toSign).digest("hex")

  return NextResponse.json({ signature, timestamp, apiKey, cloudName, folder })
}
