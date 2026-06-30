import { describe, it, expect } from "vitest";
import { validateResearcher } from "./researcher";

const TODAY = "2026-07-01";

describe("validateResearcher", () => {
  it("accepts a full valid payload", () => {
    const r = validateResearcher(
      { fullName: "Dr. Jane Roe", contact: "jane@x.com", notes: "n", assignmentDate: "2026-06-01", status: "In Progress" },
      TODAY
    );
    expect(r).toEqual({
      ok: true,
      value: { fullName: "Dr. Jane Roe", contact: "jane@x.com", notes: "n", assignmentDate: "2026-06-01", status: "In Progress" },
    });
  });

  it("defaults status to Assigned and assignmentDate to today", () => {
    const r = validateResearcher({ fullName: "A", contact: "b" }, TODAY);
    expect(r).toEqual({
      ok: true,
      value: { fullName: "A", contact: "b", assignmentDate: TODAY, status: "Assigned" },
    });
  });

  it("trims whitespace and omits empty notes", () => {
    const r = validateResearcher({ fullName: "  A  ", contact: " b ", notes: "   " }, TODAY);
    expect(r.ok && r.value.fullName).toBe("A");
    expect(r.ok && r.value.contact).toBe("b");
    expect(r.ok && "notes" in r.value).toBe(false);
  });

  it("rejects missing fullName or contact", () => {
    expect(validateResearcher({ contact: "b" }, TODAY).ok).toBe(false);
    expect(validateResearcher({ fullName: "  ", contact: "b" }, TODAY).ok).toBe(false);
    expect(validateResearcher({ fullName: "a" }, TODAY).ok).toBe(false);
  });

  it("rejects an invalid status", () => {
    const r = validateResearcher({ fullName: "a", contact: "b", status: "Done" }, TODAY);
    expect(r.ok).toBe(false);
  });
});
