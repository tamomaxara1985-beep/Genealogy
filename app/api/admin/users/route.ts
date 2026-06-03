import { NextResponse } from "next/server"
import { getAdminSession } from "@/lib/adminAuth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"

export async function GET() {
  const session = await getAdminSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await connectDB()
  const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 }).lean()
  return NextResponse.json(users)
}
