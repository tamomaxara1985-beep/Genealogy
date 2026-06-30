import nodemailer from "nodemailer";

const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASSWORD = process.env.SMTP_PASSWORD;

if (!SMTP_USER || !SMTP_PASSWORD) {
  // Surface a clear error at boot rather than a cryptic auth failure at send time.
  console.warn(
    "[mail] SMTP_USER / SMTP_PASSWORD not set — password reset emails will fail."
  );
}

// Gmail SMTP. SMTP_PASSWORD must be a Gmail App Password, not the account password.
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASSWORD,
  },
});

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await transporter.sendMail({
    from: `"FamilyRoots" <${SMTP_USER}>`,
    to,
    subject: "Reset your FamilyRoots password",
    text: `Reset your password using this link (valid for 1 hour):\n\n${resetUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
        <h2 style="color:#f59e0b;margin:0 0 16px;">Reset your password</h2>
        <p style="color:#374151;font-size:14px;line-height:1.6;">
          We received a request to reset your FamilyRoots password. Click the button below to choose a new one. This link is valid for 1 hour.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;margin:16px 0;padding:10px 20px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
          Reset password
        </a>
        <p style="color:#9ca3af;font-size:12px;line-height:1.6;">
          If you did not request this, you can safely ignore this email. Your password will not change.
        </p>
      </div>
    `,
  });
}
