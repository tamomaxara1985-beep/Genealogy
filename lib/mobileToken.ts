import { SignJWT, jwtVerify } from "jose";

export interface MobileTokenClaims {
  sub: string;
  email: string | null;
  role: string;
  name: string | null;
}

function key(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function issueMobileToken(
  claims: MobileTokenClaims,
  secret: string
): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role, name: claims.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key(secret));
}

export async function verifyMobileToken(
  token: string,
  secret: string
): Promise<MobileTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: (payload.email as string | null) ?? null,
      role: (payload.role as string) ?? "user",
      name: (payload.name as string | null) ?? null,
    };
  } catch {
    return null;
  }
}
