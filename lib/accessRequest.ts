export const ACCESS_STATUSES = ["pending", "approved", "denied", "revoked"] as const;
export type AccessStatus = (typeof ACCESS_STATUSES)[number];
export type AccessAction = "approve" | "deny" | "revoke";

type InputResult = { ok: true; value: { message: string } } | { ok: false; error: string };
type ActionResult =
  | { ok: true; value: { nextStatus: AccessStatus; grant: boolean; revoke: boolean } }
  | { ok: false; error: string };

export function validateAccessRequestInput(input: unknown): InputResult {
  const o = (input ?? {}) as Record<string, unknown>;
  const message = typeof o.message === "string" ? o.message.trim() : "";
  if (message.length > 2000) return { ok: false, error: "message too long" };
  return { ok: true, value: { message } };
}

export function resolveAction(action: string, current: AccessStatus): ActionResult {
  if (action === "approve") {
    if (current !== "pending") return { ok: false, error: "can only approve a pending request" };
    return { ok: true, value: { nextStatus: "approved", grant: true, revoke: false } };
  }
  if (action === "deny") {
    if (current !== "pending") return { ok: false, error: "can only deny a pending request" };
    return { ok: true, value: { nextStatus: "denied", grant: false, revoke: false } };
  }
  if (action === "revoke") {
    if (current !== "approved") return { ok: false, error: "can only revoke an approved request" };
    return { ok: true, value: { nextStatus: "revoked", grant: false, revoke: true } };
  }
  return { ok: false, error: "unknown action" };
}
