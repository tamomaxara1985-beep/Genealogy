import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Researcher from "@/lib/models/Researcher";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const list = await Researcher.find().sort({ createdAt: 1 }).lean();
  return NextResponse.json(list);
}
