export const SOCIAL_PLATFORMS = [
  "facebook", "x", "instagram", "linkedin", "youtube", "tiktok", "telegram", "whatsapp", "website",
] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

type MsgResult =
  | { ok: true; value: { fullName: string; email: string; subject: string; message: string } }
  | { ok: false; error: string };

type InfoValue = {
  orgName: string; address: string; mapQuery: string; phone: string; email: string;
  hours: { days: string; hours: string }[];
  socials: { platform: string; url: string }[];
};
type InfoResult = { ok: true; value: InfoValue } | { ok: false; error: string };

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function isEmail(v: string): boolean {
  const at = v.indexOf("@");
  return at > 0 && at < v.length - 1 && !v.includes(" ");
}
function isUrl(v: string): boolean {
  return /^https?:\/\/\S+$/.test(v);
}

export function validateContactMessage(input: unknown): MsgResult {
  const o = (input ?? {}) as Record<string, unknown>;
  const fullName = str(o.fullName);
  const email = str(o.email);
  const subject = str(o.subject);
  const message = str(o.message);

  if (!fullName) return { ok: false, error: "fullName is required" };
  if (!email) return { ok: false, error: "email is required" };
  if (!isEmail(email)) return { ok: false, error: "invalid email" };
  if (!subject) return { ok: false, error: "subject is required" };
  if (!message) return { ok: false, error: "message is required" };
  if (fullName.length > 200 || email.length > 200 || subject.length > 200)
    return { ok: false, error: "field too long" };
  if (message.length > 5000) return { ok: false, error: "message too long" };

  return { ok: true, value: { fullName, email, subject, message } };
}

export function validateContactInfo(input: unknown): InfoResult {
  const o = (input ?? {}) as Record<string, unknown>;
  const email = str(o.email);
  if (email && !isEmail(email)) return { ok: false, error: "invalid email" };

  const rawHours = Array.isArray(o.hours) ? o.hours : [];
  const hours = rawHours
    .map((h) => ({ days: str((h as Record<string, unknown>)?.days), hours: str((h as Record<string, unknown>)?.hours) }))
    .filter((h) => h.days || h.hours)
    .slice(0, 20);

  const known = new Set<string>(SOCIAL_PLATFORMS);
  const rawSocials = Array.isArray(o.socials) ? o.socials : [];
  const socials = rawSocials
    .map((s) => ({ platform: str((s as Record<string, unknown>)?.platform), url: str((s as Record<string, unknown>)?.url) }))
    .filter((s) => known.has(s.platform) && isUrl(s.url))
    .slice(0, 20);

  return {
    ok: true,
    value: {
      orgName: str(o.orgName),
      address: str(o.address),
      mapQuery: str(o.mapQuery),
      phone: str(o.phone),
      email,
      hours,
      socials,
    },
  };
}
