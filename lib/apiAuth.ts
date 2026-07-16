import type { Session } from "next-auth";
import { auth } from "@/lib/auth";
import { verifyMobileToken } from "@/lib/mobileToken";

// Accepts EITHER a NextAuth cookie session (web) OR a mobile Bearer JWT.
// Returns a Session-shaped object so it drops in wherever `auth()` was used.
export async function getSession(req: Request): Promise<Session | null> {
  const cookieSession = await auth();
  if (cookieSession?.user?.id) return cookieSession;

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;

  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  const claims = await verifyMobileToken(token, secret);
  if (!claims) return null;

  return {
    user: {
      id: claims.sub,
      email: claims.email,
      name: claims.name,
      role: claims.role,
    },
    expires: "",
  } as unknown as Session;
}
