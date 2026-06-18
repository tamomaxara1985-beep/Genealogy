import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { connectDB } from "@/lib/db"
import User from "@/lib/models/User"

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { bio } = await request.json()
  if (typeof bio !== "string") return NextResponse.json({ error: "bio must be string" }, { status: 400 })

  await connectDB()
  await User.findByIdAndUpdate(session.user.id, { $set: { bio } })
  return NextResponse.json({ ok: true })
}
