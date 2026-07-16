import { describe, it, expect } from "vitest";
import { validateLoginInput } from "./mobileLogin";

describe("validateLoginInput", () => {
  it("trims + lowercases email and keeps password", () => {
    expect(validateLoginInput({ email: "  A@B.COM ", password: "pw" })).toEqual({
      ok: true,
      value: { email: "a@b.com", password: "pw" },
    });
  });

  it("rejects missing email or password", () => {
    expect(validateLoginInput({ password: "pw" }).ok).toBe(false);
    expect(validateLoginInput({ email: "a@b.com" }).ok).toBe(false);
    expect(validateLoginInput({}).ok).toBe(false);
    expect(validateLoginInput(null).ok).toBe(false);
  });

  it("rejects non-string fields", () => {
    expect(validateLoginInput({ email: 1, password: 2 }).ok).toBe(false);
  });
});
