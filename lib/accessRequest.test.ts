// lib/accessRequest.test.ts
import { describe, it, expect } from "vitest";
import { validateAccessRequestInput, resolveAction } from "./accessRequest";

describe("validateAccessRequestInput", () => {
  it("accepts empty/absent message and defaults to empty string", () => {
    expect(validateAccessRequestInput({})).toEqual({ ok: true, value: { message: "" } });
    expect(validateAccessRequestInput({ message: "  hi  " })).toEqual({ ok: true, value: { message: "hi" } });
  });
  it("rejects an over-long message", () => {
    expect(validateAccessRequestInput({ message: "x".repeat(2001) }).ok).toBe(false);
  });
});

describe("resolveAction", () => {
  it("approve: pending -> approved with grant", () => {
    expect(resolveAction("approve", "pending")).toEqual({ ok: true, value: { nextStatus: "approved", grant: true, revoke: false } });
  });
  it("deny: pending -> denied, no grant", () => {
    expect(resolveAction("deny", "pending")).toEqual({ ok: true, value: { nextStatus: "denied", grant: false, revoke: false } });
  });
  it("revoke: approved -> revoked with revoke", () => {
    expect(resolveAction("revoke", "approved")).toEqual({ ok: true, value: { nextStatus: "revoked", grant: false, revoke: true } });
  });
  it("rejects invalid transitions and unknown actions", () => {
    expect(resolveAction("approve", "approved").ok).toBe(false);
    expect(resolveAction("revoke", "pending").ok).toBe(false);
    expect(resolveAction("deny", "revoked").ok).toBe(false);
    expect(resolveAction("bogus", "pending").ok).toBe(false);
  });
});
