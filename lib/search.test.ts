import { describe, it, expect } from "vitest";
import { escapeRegex, validateSearchParams, computeAccess } from "./search";

describe("escapeRegex", () => {
  it("escapes regex-special characters", () => {
    expect(escapeRegex("a.b*c(d)")).toBe("a\\.b\\*c\\(d\\)");
  });
});

describe("validateSearchParams", () => {
  it("trims and accepts any single field", () => {
    expect(validateSearchParams({ firstName: "  Ann  " })).toEqual({
      ok: true,
      value: { firstName: "Ann", lastName: "", location: "" },
    });
    expect(validateSearchParams({ lastName: "Roe" }).ok).toBe(true);
    expect(validateSearchParams({ location: "Tbilisi" }).ok).toBe(true);
  });
  it("accepts combinations of fields (AND search)", () => {
    expect(validateSearchParams({ firstName: "Ann", lastName: "Roe", location: "Tbilisi" })).toEqual({
      ok: true,
      value: { firstName: "Ann", lastName: "Roe", location: "Tbilisi" },
    });
  });
  it("rejects when all fields empty", () => {
    expect(validateSearchParams({}).ok).toBe(false);
    expect(validateSearchParams({ firstName: "  ", lastName: "", location: "" }).ok).toBe(false);
  });
  it("rejects combined input shorter than 2 chars", () => {
    expect(validateSearchParams({ firstName: "a" }).ok).toBe(false);
  });
  it("rejects an over-long field", () => {
    expect(validateSearchParams({ location: "x".repeat(101) }).ok).toBe(false);
  });
});

describe("computeAccess", () => {
  const tree = { ownerId: "u1", sharedEmails: ["viewer@x.com"] };
  it("owner wins", () => {
    expect(computeAccess(tree, { userId: "u1", email: "u1@x.com" }, null)).toBe("owner");
  });
  it("shared email -> viewer (case-insensitive)", () => {
    expect(computeAccess(tree, { userId: "u2", email: "VIEWER@x.com" }, null)).toBe("viewer");
  });
  it("pending request -> pending", () => {
    expect(computeAccess(tree, { userId: "u3", email: "u3@x.com" }, "pending")).toBe("pending");
  });
  it("otherwise none (denied/revoked count as none)", () => {
    expect(computeAccess(tree, { userId: "u3", email: "u3@x.com" }, "denied")).toBe("none");
    expect(computeAccess(tree, { userId: "u3", email: "u3@x.com" }, null)).toBe("none");
  });
});
