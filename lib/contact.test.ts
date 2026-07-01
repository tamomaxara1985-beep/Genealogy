import { describe, it, expect } from "vitest";
import { validateContactMessage, validateContactInfo } from "./contact";

const MSG = { fullName: "Jane Roe", email: "jane@example.com", subject: "Hi", message: "Hello there" };

describe("validateContactMessage", () => {
  it("accepts a valid payload and trims", () => {
    const r = validateContactMessage({ ...MSG, fullName: "  Jane Roe  " });
    expect(r).toEqual({ ok: true, value: MSG });
  });

  it("rejects each missing field", () => {
    for (const k of ["fullName", "email", "subject", "message"]) {
      expect(validateContactMessage({ ...MSG, [k]: "  " }).ok).toBe(false);
    }
    expect(validateContactMessage({}).ok).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(validateContactMessage({ ...MSG, email: "nope" }).ok).toBe(false);
  });

  it("rejects an over-long message", () => {
    expect(validateContactMessage({ ...MSG, message: "x".repeat(5001) }).ok).toBe(false);
    expect(validateContactMessage({ ...MSG, subject: "x".repeat(201) }).ok).toBe(false);
  });
});

describe("validateContactInfo", () => {
  it("sanitizes scalars and defaults arrays", () => {
    const r = validateContactInfo({ orgName: "  Acme ", phone: " 123 " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.orgName).toBe("Acme");
      expect(r.value.phone).toBe("123");
      expect(r.value.hours).toEqual([]);
      expect(r.value.socials).toEqual([]);
      expect(r.value.address).toBe("");
    }
  });

  it("drops empty hour rows and keeps filled ones", () => {
    const r = validateContactInfo({ hours: [{ days: "Mon–Fri", hours: "9–5" }, { days: "", hours: "" }] });
    expect(r.ok && r.value.hours).toEqual([{ days: "Mon–Fri", hours: "9–5" }]);
  });

  it("keeps only known-platform socials with a valid url", () => {
    const r = validateContactInfo({
      socials: [
        { platform: "facebook", url: "https://fb.com/x" },
        { platform: "myspace", url: "https://m.com" },
        { platform: "x", url: "not-a-url" },
      ],
    });
    expect(r.ok && r.value.socials).toEqual([{ platform: "facebook", url: "https://fb.com/x" }]);
  });

  it("rejects a malformed email when present", () => {
    expect(validateContactInfo({ email: "bad" }).ok).toBe(false);
  });
});
