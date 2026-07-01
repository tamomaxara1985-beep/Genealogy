import { describe, it, expect } from "vitest";
import { validateResearcher } from "./researcher";

const VALID = {
  name: "Jane",
  surname: "Roe",
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
      name: "  Jane ",
      surname: " Roe ",
      email: " jane@example.com ",
      phone: " 123 ",
      region: " imereti ",
    });
    expect(r.ok && r.value.name).toBe("Jane");
    expect(r.ok && r.value.email).toBe("jane@example.com");
    expect(r.ok && r.value.region).toBe("imereti");
  });

  it("rejects each missing required field", () => {
    for (const key of ["name", "surname", "email", "phone", "region"]) {
      const bad = { ...VALID, [key]: "  " };
      expect(validateResearcher(bad).ok).toBe(false);
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
