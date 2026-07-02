import { REGION_CODES } from "@/lib/georgiaRegions";

export interface LocalizedName {
  en: string;
  ka: string;
  he: string;
}

export interface ResearcherValue {
  name: LocalizedName;
  surname: LocalizedName;
  email: string;
  phone: string;
  region: string;
}

type Result =
  | { ok: true; value: ResearcherValue }
  | { ok: false; error: string };

function asTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function localized(v: unknown): LocalizedName {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    en: asTrimmedString(o.en),
    ka: asTrimmedString(o.ka),
    he: asTrimmedString(o.he),
  };
}

function isEmail(v: string): boolean {
  const at = v.indexOf("@");
  return at > 0 && at < v.length - 1 && !v.includes(" ");
}

export function validateResearcher(input: unknown): Result {
  const obj = (input ?? {}) as Record<string, unknown>;

  const name = localized(obj.name);
  const surname = localized(obj.surname);
  const email = asTrimmedString(obj.email);
  const phone = asTrimmedString(obj.phone);
  const region = asTrimmedString(obj.region);

  if (!name.en) return { ok: false, error: "name (English) is required" };
  if (!surname.en) return { ok: false, error: "surname (English) is required" };
  if (!email) return { ok: false, error: "email is required" };
  if (!isEmail(email)) return { ok: false, error: "invalid email" };
  if (!phone) return { ok: false, error: "phone is required" };
  if (!region) return { ok: false, error: "region is required" };
  if (!(REGION_CODES as readonly string[]).includes(region))
    return { ok: false, error: "invalid region" };

  return { ok: true, value: { name, surname, email, phone, region } };
}
