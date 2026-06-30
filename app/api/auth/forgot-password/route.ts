import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import User from "@/lib/models/User";
import PasswordResetToken from "@/lib/models/PasswordResetToken";
import { sendPasswordResetEmail } from "@/lib/mail";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() });

    // Only send a mail when the account exists AND has a password (credentials user).
    // Either way we return the same success response to avoid email enumeration.
    if (user?.password) {
      // Invalidate any outstanding tokens for this user.
      await PasswordResetToken.deleteMany({ userId: user._id });

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      await PasswordResetToken.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      });

      const baseUrl = process.env.AUTH_URL ?? req.nextUrl.origin;
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (mailErr) {
        console.error("[forgot-password] mail send failed", mailErr);
        return NextResponse.json(
          { error: "Failed to send reset email. Try again later." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (err) {
    console.error("[forgot-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
