import { describe, it, expect } from "vitest";
import { escapeRegex, validateSearchQuery, computeAccess } from "./search";

describe("escapeRegex", () => {
  it("escapes regex-special characters", () => {
    expect(escapeRegex("a.b*c(d)")).toBe("a\\.b\\*c\\(d\\)");
  });
});

describe("validateSearchQuery", () => {
  it("trims term, defaults field to all", () => {
    expect(validateSearchQuery("  Ann  ", undefined)).toEqual({ ok: true, value: { term: "Ann", field: "all" } });
  });
  it("accepts explicit name and place fields", () => {
    expect(validateSearchQuery("Ann", "name")).toEqual({ ok: true, value: { term: "Ann", field: "name" } });
    expect(validateSearchQuery("Tbilisi", "place")).toEqual({ ok: true, value: { term: "Tbilisi", field: "place" } });
  });
  it("rejects short terms and unknown fields", () => {
    expect(validateSearchQuery("a", "name").ok).toBe(false);
    expect(validateSearchQuery("Ann", "bogus").ok).toBe(false);
    expect(validateSearchQuery("x".repeat(101), "name").ok).toBe(false);
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
