export type LoginResult =
  | { ok: true; value: { email: string; password: string } }
  | { ok: false; error: string };

export function validateLoginInput(body: unknown): LoginResult {
  const b = (body ?? {}) as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (!email || !password) {
    return { ok: false, error: "Email and password are required" };
  }
  return { ok: true, value: { email, password } };
}
