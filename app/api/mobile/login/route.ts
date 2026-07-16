import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import { validateLoginInput } from "@/lib/mobileLogin";
import { issueMobileToken } from "@/lib/mobileToken";

export async function POST(req: NextRequest) {
  const parsed = validateLoginInput(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { email, password } = parsed.value;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  await connectDB();
  const user = await User.findOne({ email });
  if (!user?.password)
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid)
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  const token = await issueMobileToken(
    {
      sub: user._id.toString(),
      email: user.email,
      role: user.role ?? "user",
      name: user.name ?? null,
    },
    secret
  );

  return NextResponse.json({
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role ?? "user",
    },
  });
}
