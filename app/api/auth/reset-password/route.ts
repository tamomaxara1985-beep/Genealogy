import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import PasswordResetToken from "@/lib/models/PasswordResetToken";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Reset token is required" }, { status: 400 });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    await connectDB();

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await PasswordResetToken.findOne({ tokenHash });

    // Reject missing or expired tokens. (TTL index may not have purged it yet.)
    if (!record || record.expiresAt.getTime() < Date.now()) {
      if (record) await PasswordResetToken.deleteOne({ _id: record._id });
      return NextResponse.json(
        { error: "Reset link is invalid or has expired" },
        { status: 400 }
      );
    }

    const hashed = await bcrypt.hash(password, 12);
    await User.updateOne({ _id: record.userId }, { $set: { password: hashed } });

    // Single use: consume the token now.
    await PasswordResetToken.deleteOne({ _id: record._id });

    return NextResponse.json({ message: "Password updated. You can now sign in." });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
