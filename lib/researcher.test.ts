import { describe, it, expect } from "vitest";
import { validateResearcher } from "./researcher";

const VALID = {
  name: { en: "Jane", ka: "", he: "" },
  surname: { en: "Roe", ka: "", he: "" },
  email: "jane@example.com",
  phone: "+995 555 12 34 56",
  region: "imereti",
};

describe("validateResearcher", () => {
  it("accepts a full valid payload", () => {
    const r = validateResearcher(VALID);
    expect(r).toEqual({ ok: true, value: VALID });
  });

  it("trims whitespace on all fields", () => {
    const r = validateResearcher({
      name: { en: "  Jane ", ka: "", he: "" },
      surname: { en: " Roe ", ka: "", he: "" },
      email: " jane@example.com ",
      phone: " 123 ",
      region: " imereti ",
    });
    expect(r.ok && r.value.name.en).toBe("Jane");
    expect(r.ok && r.value.email).toBe("jane@example.com");
    expect(r.ok && r.value.region).toBe("imereti");
  });

  it("rejects missing required fields", () => {
    expect(validateResearcher({ ...VALID, name: { en: "  ", ka: "", he: "" } }).ok).toBe(false);
    expect(validateResearcher({ ...VALID, surname: { en: "  ", ka: "", he: "" } }).ok).toBe(false);
    for (const key of ["email", "phone", "region"]) {
      expect(validateResearcher({ ...VALID, [key]: "  " }).ok).toBe(false);
    }
    expect(validateResearcher({}).ok).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(validateResearcher({ ...VALID, email: "nope" }).ok).toBe(false);
    expect(validateResearcher({ ...VALID, email: "a@" }).ok).toBe(false);
    expect(validateResearcher({ ...VALID, email: "@b.com" }).ok).toBe(false);
  });

  it("rejects a region not in the list", () => {
    expect(validateResearcher({ ...VALID, region: "narnia" }).ok).toBe(false);
  });
});
